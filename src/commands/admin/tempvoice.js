const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const tempVoiceManager = require('../../utils/tempVoiceManager');
const { ensureTriggerPermissions } = tempVoiceManager;
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
    '**Control Panel:** Voice channel chat',
    '**Mod Roles:** ' + ((config.modRoleIds || []).length ? config.modRoleIds.map(id => '<@&' + id + '>').join(' ') : 'None'),
    '**Channel Name:** `' + (config.channelNameTemplate || "{user}'s Room") + '`',
    '**User Limit:** ' + (config.userLimit > 0 ? config.userLimit : 'Unlimited'),
    '**Default Bitrate:** ' + Math.round((config.bitrate || 64000) / 1000) + ' kbps',
    '**Welcome Cheat-sheet:** ' + (config.sendWelcomeEmbed === false ? 'Off' : 'On'),
    '**Creation Cooldown:** ' + (config.cooldownSeconds || 0) + 's',
    '**Allowed Roles:** ' + ((config.whitelistRoleIds || []).length ? config.whitelistRoleIds.map(id => '<@&' + id + '>').join(' ') : 'All members'),
    '**Blocked Roles:** ' + ((config.blacklistRoleIds || []).length ? config.blacklistRoleIds.map(id => '<@&' + id + '>').join(' ') : 'None'),
    '**Empty Timeout:** ' + (config.emptyTimeoutSeconds > 0 ? config.emptyTimeoutSeconds + 's' : 'Instant'),
    '**Max Rooms / User:** ' + (config.maxRoomsPerUser || 1),
  ];
  return lines.join('\n');
}

async function autoSetup(guild, categoryName, triggerName) {
  const catName = (categoryName || '🎮 Temporary Channels').slice(0, 100);
  const trigName = (triggerName || '➕ Create Voice').slice(0, 100);

  let category = guild.channels.cache.find(c => c.type === 4 && c.name === catName);
  let createdCategory = false;
  if (!category) {
    category = await guild.channels.create({ name: catName, type: ChannelType.GuildCategory });
    createdCategory = true;
  }

  let trigger = guild.channels.cache.find(c => c.type === 2 && c.name === trigName && c.parentId === category.id);
  let createdTrigger = false;
  if (!trigger) {
    trigger = await guild.channels.create({
      name: trigName,
      type: ChannelType.GuildVoice,
      parent: category.id,
    });
    createdTrigger = true;
  }

  try {
    await ensureTriggerPermissions(trigger);
  } catch (error) {
    if (createdTrigger) await trigger.delete('Temp voice setup permission check failed').catch(() => {});
    if (createdCategory) await category.delete('Temp voice setup permission check failed').catch(() => {});
    throw error;
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
      .setDescription('Choose or create a join-to-create channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Existing trigger voice channel (optional)').setRequired(false))
      .addChannelOption(opt => opt.setName('category').setDescription('Category for created channels (optional)').setRequired(false)))
    .addSubcommand(sub => sub
      .setName('config')
      .setDescription('Configure temporary voice defaults')
      .addStringOption(opt => opt.setName('template').setDescription('Name template: {user}, {count}').setMaxLength(100))
      .addIntegerOption(opt => opt.setName('user-limit').setDescription('Default room limit (0 = unlimited)').setMinValue(0).setMaxValue(99))
      .addIntegerOption(opt => opt.setName('max-per-user').setDescription('Maximum rooms per member').setMinValue(1).setMaxValue(5))
      .addIntegerOption(opt => opt.setName('cooldown').setDescription('Creation cooldown in seconds').setMinValue(0).setMaxValue(3600))
      .addIntegerOption(opt => opt.setName('bitrate').setDescription('Default bitrate in kbps').setMinValue(8).setMaxValue(384))
      .addRoleOption(opt => opt.setName('allow-role').setDescription('Add a role allowed to create rooms'))
      .addRoleOption(opt => opt.setName('block-role').setDescription('Add a role blocked from creating rooms'))
      .addBooleanOption(opt => opt.setName('clear-role-rules').setDescription('Clear allowed and blocked role lists'))
      .addBooleanOption(opt => opt.setName('welcome-embed').setDescription('Send a welcome cheat-sheet in new rooms')))
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
        return message.reply({ embeds: [errorEmbed('Setup Failed', err.message || 'Check the bot has Manage Channels and Move Members.')] });
      }
    }

    if (sub === 'setup') {
      const trigger = resolveChannel(args[0], message.guild);
      if (!trigger || trigger.type !== 2) {
        return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Mention a **voice channel** to use as the trigger: `!tempvoice setup <#voice> [#category]`')] });
      }
      try {
        await ensureTriggerPermissions(trigger);
      } catch (err) {
        console.error('tempvoice setup permissions error:', err);
        return message.reply({ embeds: [errorEmbed('Permission Setup Failed', err.message || 'Check the bot channel permissions.')] });
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
        return interaction.reply({ embeds: [errorEmbed('Setup Failed', err.message || 'Check the bot has Manage Channels and Move Members.')], ephemeral: true });
      }
    }

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const category = interaction.options.getChannel('category');
      if (category && category.type !== 4) {
        return interaction.reply({ embeds: [errorEmbed('Invalid Category', 'Choose a server category channel.')], ephemeral: true });
      }
      if (!channel) {
        try {
          const result = await autoSetup(interaction.guild, category?.name);
          return interaction.reply({ embeds: [successEmbed('Temp Voice Enabled', 'Join <#' + result.trigger.id + '> to create your room in **' + result.category.name + '**.')] });
        } catch (err) {
          console.error('tempvoice setup error:', err);
        return interaction.reply({ embeds: [errorEmbed('Setup Failed', err.message || 'Check the bot has Manage Channels and Move Members.')], ephemeral: true });
        }
      }
      if (channel.type !== 2) {
        return interaction.reply({ embeds: [errorEmbed('Invalid Channel', 'Select a **voice channel**.')], ephemeral: true });
      }
      if (!category && config.tempVoice.categoryId && !interaction.guild.channels.cache.get(config.tempVoice.categoryId)) {
        return interaction.reply({ embeds: [errorEmbed('Category Missing', 'The saved room category was deleted. Run `/tempvoice setup` and choose a valid category.')], ephemeral: true });
      }
      try {
        await ensureTriggerPermissions(channel);
      } catch (err) {
        console.error('tempvoice setup permissions error:', err);
        return interaction.reply({ embeds: [errorEmbed('Permission Setup Failed', err.message || 'Check the bot channel permissions.')], ephemeral: true });
      }
      const update = { 'tempVoice.enabled': true, 'tempVoice.triggerChannelId': channel.id };
      if (category && category.type === 4) update['tempVoice.categoryId'] = category.id;
      await updateGuildConfig(interaction.guild.id, update);
      return interaction.reply({ embeds: [successEmbed('Temp Voice Enabled', 'Join <#' + channel.id + '> to create your own room.')] });
    }

    if (sub === 'config') {
      const update = {};
      const template = interaction.options.getString('template');
      const userLimit = interaction.options.getInteger('user-limit');
      const maxPerUser = interaction.options.getInteger('max-per-user');
      const cooldown = interaction.options.getInteger('cooldown');
      const bitrate = interaction.options.getInteger('bitrate');
      const allowRole = interaction.options.getRole('allow-role');
      const blockRole = interaction.options.getRole('block-role');
      const clearRoles = interaction.options.getBoolean('clear-role-rules');
      const welcomeEmbed = interaction.options.getBoolean('welcome-embed');

      if (template !== null) update['tempVoice.channelNameTemplate'] = template;
      if (userLimit !== null) update['tempVoice.userLimit'] = userLimit;
      if (maxPerUser !== null) update['tempVoice.maxRoomsPerUser'] = maxPerUser;
      if (cooldown !== null) update['tempVoice.cooldownSeconds'] = cooldown;
      if (bitrate !== null) update['tempVoice.bitrate'] = bitrate * 1000;
      if (welcomeEmbed !== null) update['tempVoice.sendWelcomeEmbed'] = welcomeEmbed;
      if (clearRoles) {
        update['tempVoice.whitelistRoleIds'] = [];
        update['tempVoice.blacklistRoleIds'] = [];
      }
      if (allowRole) {
        const roles = clearRoles ? [] : [...(config.tempVoice.whitelistRoleIds || [])];
        if (!roles.includes(allowRole.id)) roles.push(allowRole.id);
        update['tempVoice.whitelistRoleIds'] = roles;
      }
      if (blockRole) {
        const roles = clearRoles ? [] : [...(config.tempVoice.blacklistRoleIds || [])];
        if (!roles.includes(blockRole.id)) roles.push(blockRole.id);
        update['tempVoice.blacklistRoleIds'] = roles;
      }
      if (!Object.keys(update).length) {
        return interaction.reply({ content: 'Choose at least one setting to update.', ephemeral: true });
      }
      await updateGuildConfig(interaction.guild.id, update);
      return interaction.reply({ embeds: [successEmbed('Temp Voice Config Updated', 'Room defaults, creation limits, and role rules have been saved.')], ephemeral: true });
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
      if (!config.tempVoice.enabled || !config.tempVoice.triggerChannelId || !interaction.guild.channels.cache.get(config.tempVoice.triggerChannelId)) {
        return interaction.reply({ embeds: [errorEmbed('Temp Voice Not Set Up', 'The join-to-create channel is missing or disabled. Run `/tempvoice setup` to configure it again.')], ephemeral: true });
      }
      if (config.tempVoice.categoryId && !interaction.guild.channels.cache.get(config.tempVoice.categoryId)) {
        return interaction.reply({ embeds: [errorEmbed('Category Missing', 'The saved room category was deleted. Run `/tempvoice setup` and choose a valid category.')], ephemeral: true });
      }
      return interaction.reply({ embeds: [infoEmbed(emojis.user + ' Temp Voice', statusLine(config.tempVoice))], ephemeral: true });
    }
  },
};
