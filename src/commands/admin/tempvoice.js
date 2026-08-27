const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');

function resolveChannel(mention, guild) {
  const id = (mention || '').replace(/[<#>]/g, '');
  return guild.channels.cache.get(id) || null;
}

function resolveRole(mention, guild) {
  const id = (mention || '').replace(/[<@&>]/g, '');
  return guild.roles.cache.get(id) || null;
}

function statusLine(config) {
  const lines = [
    '**Enabled:** ' + (config.enabled ? '🟢 ON' : '🔴 OFF'),
    '**Trigger Channel:** ' + (config.triggerChannelId ? '<#' + config.triggerChannelId + '>' : 'Not set'),
    '**Category:** ' + (config.categoryId ? '<#' + config.categoryId + '>' : 'None'),
    '**Mod Channel:** ' + (config.createModChannel ? 'Created automatically' : 'Disabled'),
    '**Mod Roles:** ' + ((config.modRoleIds || []).length ? config.modRoleIds.map(id => '<@&' + id + '>').join(' ') : 'None'),
    '**Channel Name:** `' + (config.channelNameTemplate || "{user}'s Channel") + '`',
    '**User Limit:** ' + (config.userLimit > 0 ? config.userLimit : 'Unlimited'),
    '**Empty Timeout:** ' + (config.emptyTimeoutSeconds > 0 ? config.emptyTimeoutSeconds + 's' : 'Instant'),
    '**Max Rooms / User:** ' + (config.maxRoomsPerUser || 1),
  ];
  return lines.join('\n');
}

async function autoSetup(guild, categoryName, triggerName) {
  const catName = (categoryName || '🎮 Temporary Channels').slice(0, 100);
  const trigName = (triggerName || '➕ Create Voice').slice(0, 100);

  let category = guild.channels.cache.find(c => c.type === 4 && c.name === catName);
  if (!category) {
    category = await guild.channels.create({ name: catName, type: ChannelType.GuildCategory });
  }

  let trigger = guild.channels.cache.find(c => c.type === 2 && c.name === trigName && c.parentId === category.id);
  if (!trigger) {
    trigger = await guild.channels.create({
      name: trigName,
      type: ChannelType.GuildVoice,
      parent: category.id,
    });
  }

  await updateGuildConfig(guild.id, {
    'tempVoice.enabled': true,
    'tempVoice.triggerChannelId': trigger.id,
    'tempVoice.categoryId': category.id,
  });

  return { category, trigger };
}

module.exports = {
  name: 'tempvoice',
  description: 'Configure join-to-create temporary voice channels',
  usage: '!tempvoice setup <#voice> [#category] | create [name] [channel] | category <#cat> | mod <@role> | unmod <@role> | modchannel on|off | userlimit <0-99> | timeout <seconds> | maxrooms <1-5> | disable | info',
  slash: new SlashCommandBuilder()
    .setName('tempvoice')
    .setDescription('Configure join-to-create temporary voice channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('Auto-create a category and join-to-create channel')
      .addStringOption(opt => opt.setName('category').setDescription('Category name').setRequired(false))
      .addStringOption(opt => opt.setName('channel').setDescription('Join-to-create channel name').setRequired(false)))
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Enable temp voice with a trigger channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Voice channel users join to create a room').setRequired(true))
      .addChannelOption(opt => opt.setName('category').setDescription('Category for created channels (optional)').setRequired(false)))
    .addSubcommand(sub => sub
      .setName('category')
      .setDescription('Set the category for created channels')
      .addChannelOption(opt => opt.setName('category').setDescription('Category channel').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('mod')
      .setDescription('Add a role that can see/manage temp voice mod channels')
      .addRoleOption(opt => opt.setName('role').setDescription('Moderator role').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('unmod')
      .setDescription('Remove a moderator role')
      .addRoleOption(opt => opt.setName('role').setDescription('Moderator role').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('modchannel')
      .setDescription('Toggle the auto-created moderation channel')
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Create a mod channel with each room').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('userlimit')
      .setDescription('Set the default user limit for created rooms')
      .addIntegerOption(opt => opt.setName('limit').setDescription('0 = unlimited').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('timeout')
      .setDescription('Seconds to wait before deleting an empty room (0 = instant)')
      .addIntegerOption(opt => opt.setName('seconds').setDescription('Timeout in seconds').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('maxrooms')
      .setDescription('Max rooms each user can own at once')
      .addIntegerOption(opt => opt.setName('count').setDescription('1-5').setRequired(true)))
    .addSubcommand(sub => sub.setName('disable').setDescription('Disable the temp voice system'))
    .addSubcommand(sub => sub.setName('info').setDescription('Show current temp voice configuration')),

  async execute(message, args) {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ embeds: [errorEmbed('Access Denied', 'You need the `Manage Server` permission.')] });
    }

    const sub = (args.shift() || '').toLowerCase();
    const config = await getGuildConfig(message.guild.id);
    const tv = config.tempVoice;

    if (sub === 'create') {
      try {
        const { category, trigger } = await autoSetup(message.guild, args[0], args[1]);
        const msg = 'Temporary voice system **enabled**.\n📁 ' + category.name + '\n ├── 🔊 ' + trigger.name +
          '\n\nJoining <#' + trigger.id + '> creates your own room inside ' + category.name + '.';
        return message.reply({ embeds: [successEmbed('Temp Voice Auto-Setup', msg)] });
      } catch (err) {
        console.error('tempvoice create error:', err);
        return message.reply({ embeds: [errorEmbed('Setup Failed', 'Could not create channels. Check bot permissions (Manage Channels).')] });
      }
    }

    if (sub === 'setup') {
      const trigger = resolveChannel(args[0], message.guild);
      if (!trigger || trigger.type !== 2) {
        return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Mention a **voice channel** to use as the trigger: `!tempvoice setup <#voice> [#category]`')] });
      }
      const update = {
        'tempVoice.enabled': true,
        'tempVoice.triggerChannelId': trigger.id,
      };
      const category = resolveChannel(args[1], message.guild);
      if (category && category.type === 4) update['tempVoice.categoryId'] = category.id;
      await updateGuildConfig(message.guild.id, update);

      const msg = 'Temporary voice system **enabled**.\nJoin <#' + trigger.id + '> to create a private room' +
        (category && category.type === 4 ? ' inside <#' + category.id + '>' : '') + '.';
      return message.reply({ embeds: [successEmbed('Temp Voice Enabled', msg)] });
    }

    if (sub === 'category') {
      const category = resolveChannel(args[0], message.guild);
      if (!category || category.type !== 4) {
        return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Mention a **category**: `!tempvoice category <#category>`')] });
      }
      await updateGuildConfig(message.guild.id, { 'tempVoice.categoryId': category.id });
      return message.reply({ embeds: [successEmbed('Category Set', 'Created rooms will be placed in <#' + category.id + '>.')] });
    }

    if (sub === 'mod') {
      const role = resolveRole(args[0], message.guild);
      if (!role) return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Mention a role: `!tempvoice mod <@role>`')] });
      const roles = tv.modRoleIds || [];
      if (!roles.includes(role.id)) roles.push(role.id);
      await updateGuildConfig(message.guild.id, { 'tempVoice.modRoleIds': roles });
      return message.reply({ embeds: [successEmbed('Mod Role Added', '<@&' + role.id + '> can now access temp voice mod channels.')] });
    }

    if (sub === 'unmod') {
      const role = resolveRole(args[0], message.guild);
      if (!role) return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Mention a role: `!tempvoice unmod <@role>`')] });
      const roles = (tv.modRoleIds || []).filter(id => id !== role.id);
      await updateGuildConfig(message.guild.id, { 'tempVoice.modRoleIds': roles });
      return message.reply({ embeds: [successEmbed('Mod Role Removed', '<@&' + role.id + '> no longer has access.')] });
    }

    if (sub === 'modchannel') {
      const enabled = args[0] === 'on';
      if (args[0] !== 'on' && args[0] !== 'off') {
        return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Use `!tempvoice modchannel on|off`')] });
      }
      await updateGuildConfig(message.guild.id, { 'tempVoice.createModChannel': enabled });
      return message.reply({ embeds: [successEmbed('Mod Channel ' + (enabled ? 'Enabled' : 'Disabled'), enabled ? 'Each room will get a private moderation channel.' : 'Rooms will be voice-only.')] });
    }

    if (sub === 'userlimit') {
      const limit = parseInt(args[0], 10);
      if (isNaN(limit) || limit < 0 || limit > 99) {
        return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Provide a number between **0** and **99**: `!tempvoice userlimit <0-99>`')] });
      }
      await updateGuildConfig(message.guild.id, { 'tempVoice.userLimit': limit });
      return message.reply({ embeds: [successEmbed('User Limit Set', 'New rooms will have a limit of **' + (limit || 'Unlimited') + '**.')] });
    }

    if (sub === 'timeout') {
      const seconds = parseInt(args[0], 10);
      if (isNaN(seconds) || seconds < 0 || seconds > 600) {
        return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Provide seconds between **0** and **600**: `!tempvoice timeout <seconds>`')] });
      }
      await updateGuildConfig(message.guild.id, { 'tempVoice.emptyTimeoutSeconds': seconds });
      return message.reply({ embeds: [successEmbed('Empty Timeout Set', 'Empty rooms will be deleted after **' + (seconds ? seconds + 's' : 'instant') + '**.')] });
    }

    if (sub === 'maxrooms') {
      const count = parseInt(args[0], 10);
      if (isNaN(count) || count < 1 || count > 5) {
        return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Provide a count between **1** and **5**: `!tempvoice maxrooms <1-5>`')] });
      }
      await updateGuildConfig(message.guild.id, { 'tempVoice.maxRoomsPerUser': count });
      return message.reply({ embeds: [successEmbed('Max Rooms Set', 'Each user can own up to **' + count + '** room(s).')] });
    }

    if (sub === 'disable') {
      await updateGuildConfig(message.guild.id, { 'tempVoice.enabled': false });
      return message.reply({ embeds: [successEmbed('Temp Voice Disabled', 'Join-to-create is now off.')] });
    }

    if (sub === 'info' || sub === '') {
      return message.reply({ embeds: [infoEmbed(emojis.user + ' Temp Voice', statusLine(tv))] });
    }

    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!tempvoice create|setup|category|mod|unmod|modchannel|userlimit|timeout|maxrooms|disable|info`')] });
  },

  async slashExecute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = await getGuildConfig(interaction.guild.id);

    if (sub === 'create') {
      try {
        const categoryName = interaction.options.getString('category') || undefined;
        const triggerName = interaction.options.getString('channel') || undefined;
        const { trigger } = await autoSetup(interaction.guild, categoryName, triggerName);
        return interaction.reply({ embeds: [successEmbed('Temp Voice Auto-Setup', 'Join-to-create channel **' + trigger.name + '** is ready. Joining <#' + trigger.id + '> creates your own room.')] });
      } catch (err) {
        console.error('tempvoice create error:', err);
        return interaction.reply({ embeds: [errorEmbed('Setup Failed', 'Could not create channels. Check bot permissions (Manage Channels).')], ephemeral: true });
      }
    }

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const category = interaction.options.getChannel('category');
      if (!channel || channel.type !== 2) {
        return interaction.reply({ embeds: [errorEmbed('Invalid Channel', 'Select a **voice channel**.')], ephemeral: true });
      }
      const update = { 'tempVoice.enabled': true, 'tempVoice.triggerChannelId': channel.id };
      if (category && category.type === 4) update['tempVoice.categoryId'] = category.id;
      await updateGuildConfig(interaction.guild.id, update);
      return interaction.reply({ embeds: [successEmbed('Temp Voice Enabled', 'Join <#' + channel.id + '> to create your own room.')] });
    }

    if (sub === 'category') {
      const category = interaction.options.getChannel('category');
      if (!category || category.type !== 4) {
        return interaction.reply({ embeds: [errorEmbed('Invalid Category', 'Select a **category**.')], ephemeral: true });
      }
      await updateGuildConfig(interaction.guild.id, { 'tempVoice.categoryId': category.id });
      return interaction.reply({ embeds: [successEmbed('Category Set', 'Rooms will be created inside <#' + category.id + '>.')] });
    }

    if (sub === 'mod') {
      const role = interaction.options.getRole('role');
      const roles = config.tempVoice.modRoleIds || [];
      if (!roles.includes(role.id)) roles.push(role.id);
      await updateGuildConfig(interaction.guild.id, { 'tempVoice.modRoleIds': roles });
      return interaction.reply({ embeds: [successEmbed('Mod Role Added', '<@&' + role.id + '> can now access temp voice mod channels.')] });
    }

    if (sub === 'unmod') {
      const role = interaction.options.getRole('role');
      const roles = (config.tempVoice.modRoleIds || []).filter(id => id !== role.id);
      await updateGuildConfig(interaction.guild.id, { 'tempVoice.modRoleIds': roles });
      return interaction.reply({ embeds: [successEmbed('Mod Role Removed', '<@&' + role.id + '> removed.')] });
    }

    if (sub === 'modchannel') {
      const enabled = interaction.options.getBoolean('enabled');
      await updateGuildConfig(interaction.guild.id, { 'tempVoice.createModChannel': enabled });
      return interaction.reply({ embeds: [successEmbed('Mod Channel ' + (enabled ? 'Enabled' : 'Disabled'), enabled ? 'Rooms get a private moderation channel.' : 'Rooms are voice-only.')] });
    }

    if (sub === 'userlimit') {
      const limit = interaction.options.getInteger('limit');
      if (limit < 0 || limit > 99) {
        return interaction.reply({ embeds: [errorEmbed('Invalid Limit', 'Use **0-99**.')], ephemeral: true });
      }
      await updateGuildConfig(interaction.guild.id, { 'tempVoice.userLimit': limit });
      return interaction.reply({ embeds: [successEmbed('User Limit Set', 'New rooms will have a limit of **' + (limit || 'Unlimited') + '**.')] });
    }

    if (sub === 'timeout') {
      const seconds = interaction.options.getInteger('seconds');
      if (seconds < 0 || seconds > 600) {
        return interaction.reply({ embeds: [errorEmbed('Invalid Timeout', 'Use **0-600** seconds.')], ephemeral: true });
      }
      await updateGuildConfig(interaction.guild.id, { 'tempVoice.emptyTimeoutSeconds': seconds });
      return interaction.reply({ embeds: [successEmbed('Empty Timeout Set', 'Empty rooms will be deleted after **' + (seconds ? seconds + 's' : 'instant') + '**.')] });
    }

    if (sub === 'maxrooms') {
      const count = interaction.options.getInteger('count');
      if (count < 1 || count > 5) {
        return interaction.reply({ embeds: [errorEmbed('Invalid Count', 'Use **1-5**.')], ephemeral: true });
      }
      await updateGuildConfig(interaction.guild.id, { 'tempVoice.maxRoomsPerUser': count });
      return interaction.reply({ embeds: [successEmbed('Max Rooms Set', 'Each user can own up to **' + count + '** room(s).')] });
    }

    if (sub === 'disable') {
      await updateGuildConfig(interaction.guild.id, { 'tempVoice.enabled': false });
      return interaction.reply({ embeds: [successEmbed('Temp Voice Disabled', 'Join-to-create is now off.')] });
    }

    if (sub === 'info') {
      return interaction.reply({ embeds: [infoEmbed(emojis.user + ' Temp Voice', statusLine(config.tempVoice))], ephemeral: true });
    }
  },
};