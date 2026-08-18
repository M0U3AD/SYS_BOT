const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed, modEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'automod',
  description: 'Configure auto-moderation rules',
  usage: '!automod enable | !automod disable | !automod config',
  slash: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure auto-moderation')
    .addSubcommand(sub => sub.setName('enable').setDescription('Enable automod'))
    .addSubcommand(sub => sub.setName('disable').setDescription('Disable automod'))
    .addSubcommand(sub => sub
      .setName('config')
      .setDescription('Configure automod settings')
      .addBooleanOption(opt => opt.setName('anti_spam').setDescription('Enable anti-spam'))
      .addBooleanOption(opt => opt.setName('anti_link').setDescription('Enable anti-link'))
      .addBooleanOption(opt => opt.setName('anti_invite').setDescription('Enable anti-invite'))
      .addIntegerOption(opt => opt.setName('max_mentions').setDescription('Max mentions before action').setMinValue(1).setMaxValue(20))
      .addStringOption(opt => opt.setName('bad_words').setDescription('Comma-separated bad words'))
      .addChannelOption(opt => opt.setName('log_channel').setDescription('Channel for automod logs')))
    .addSubcommand(sub => sub
      .setName('word')
      .setDescription('Add/remove bad words')
      .addStringOption(opt => opt.setName('action').setDescription('Action').setRequired(true)
        .addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }))
      .addStringOption(opt => opt.setName('word').setDescription('Word').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(message, args) {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ embeds: [errorEmbed('Access Denied', 'You need the `Manage Server` permission.')] });
    }

    if (args[0] === 'enable') {
      await updateGuildConfig(message.guild.id, { 'moderation.automod.enabled': true });
      return message.reply({ embeds: [successEmbed('AutoMod Enabled', emojis.shield + ' Auto-moderation is now **active**.\nUse `!automod config` to configure rules.')] });
    }

    if (args[0] === 'disable') {
      await updateGuildConfig(message.guild.id, { 'moderation.automod.enabled': false });
      return message.reply({ embeds: [infoEmbed('AutoMod Disabled', emojis.shield + ' Auto-moderation has been **disabled**.')] });
    }

    if (args[0] === 'config') {
      const config = await getGuildConfig(message.guild.id);
      const a = config.moderation.automod;

      const embed = modEmbed(emojis.shield, 'AutoMod Configuration', [
        { name: emojis.bolt + ' Status', value: a.enabled ? 'Enabled' : 'Disabled', inline: true },
        { name: emojis.bolt + ' Anti-Spam', value: a.antiSpam ? 'On' : 'Off', inline: true },
        { name: emojis.link + ' Anti-Link', value: a.antiLink ? 'On' : 'Off', inline: true },
        { name: emojis.link + ' Anti-Invite', value: a.antiInvite ? 'On' : 'Off', inline: true },
        { name: emojis.warning + ' Max Mentions', value: '' + a.maxMentions, inline: true },
        { name: emojis.trash + ' Bad Words', value: a.badWords.length + ' word(s)', inline: true },
        { name: emojis.channel + ' Log Channel', value: a.logChannelId ? '<#' + a.logChannelId + '>' : 'Not set', inline: true },
      ], { color: COLORS.primary });

      return message.reply({ embeds: [embed] });
    }

    if (args[0] === 'word') {
      const action = args[1];
      const word = args[2] ? args[2].toLowerCase() : null;
      if (!action || !word) {
        return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!automod word <add|remove> <word>`')] });
      }

      const config = await getGuildConfig(message.guild.id);
      let words = config.moderation.automod.badWords || [];

      if (action === 'add') {
        if (words.includes(word)) return message.reply({ embeds: [errorEmbed('Duplicate', 'Word is already in the list.')] });
        words.push(word);
      } else {
        words = words.filter(function(w) { return w !== word; });
      }

      await updateGuildConfig(message.guild.id, { 'moderation.automod.badWords': words });
      return message.reply({ embeds: [successEmbed('Word Updated', emojis.check + ' **' + word + '** has been ' + (action === 'add' ? 'added to' : 'removed from') + ' the blocked words list.')] });
    }

    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!automod enable|disable|config|word`')] });
  },

  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'enable') {
      await updateGuildConfig(interaction.guild.id, { 'moderation.automod.enabled': true });
      return interaction.reply({ embeds: [successEmbed('AutoMod Enabled', emojis.shield + ' Auto-moderation is now **active**.')] });
    }

    if (sub === 'disable') {
      await updateGuildConfig(interaction.guild.id, { 'moderation.automod.enabled': false });
      return interaction.reply({ embeds: [infoEmbed('AutoMod Disabled', emojis.shield + ' Auto-moderation has been **disabled**.')] });
    }

    if (sub === 'config') {
      const update = {};
      const antiSpam = interaction.options.getBoolean('anti_spam');
      const antiLink = interaction.options.getBoolean('anti_link');
      const antiInvite = interaction.options.getBoolean('anti_invite');
      const maxMentions = interaction.options.getInteger('max_mentions');
      const badWords = interaction.options.getString('bad_words');
      const logChannel = interaction.options.getChannel('log_channel');

      if (antiSpam !== null) update['moderation.automod.antiSpam'] = antiSpam;
      if (antiLink !== null) update['moderation.automod.antiLink'] = antiLink;
      if (antiInvite !== null) update['moderation.automod.antiInvite'] = antiInvite;
      if (maxMentions !== null) update['moderation.automod.maxMentions'] = maxMentions;
      if (badWords) update['moderation.automod.badWords'] = badWords.split(',').map(function(w) { return w.trim().toLowerCase(); });
      if (logChannel) update['moderation.automod.logChannelId'] = logChannel.id;

      if (Object.keys(update).length === 0) {
        const config = await getGuildConfig(interaction.guild.id);
        const a = config.moderation.automod;

        const embed = modEmbed(emojis.shield, 'AutoMod Configuration', [
          { name: emojis.bolt + ' Status', value: a.enabled ? 'Enabled' : 'Disabled', inline: true },
          { name: emojis.bolt + ' Anti-Spam', value: a.antiSpam ? 'On' : 'Off', inline: true },
          { name: emojis.link + ' Anti-Link', value: a.antiLink ? 'On' : 'Off', inline: true },
          { name: emojis.link + ' Anti-Invite', value: a.antiInvite ? 'On' : 'Off', inline: true },
          { name: emojis.warning + ' Max Mentions', value: '' + a.maxMentions, inline: true },
          { name: emojis.trash + ' Bad Words', value: a.badWords.length + ' word(s)', inline: true },
        ], { color: COLORS.primary });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      await updateGuildConfig(interaction.guild.id, update);
      return interaction.reply({ embeds: [successEmbed('AutoMod Updated', emojis.check + ' Settings have been saved.')] });
    }

    if (sub === 'word') {
      const action = interaction.options.getString('action');
      const word = interaction.options.getString('word').toLowerCase();
      const config = await getGuildConfig(interaction.guild.id);
      let words = config.moderation.automod.badWords || [];

      if (action === 'add') {
        if (words.includes(word)) return interaction.reply({ embeds: [errorEmbed('Duplicate', 'Word is already in the list.')], ephemeral: true });
        words.push(word);
      } else {
        words = words.filter(function(w) { return w !== word; });
      }

      await updateGuildConfig(interaction.guild.id, { 'moderation.automod.badWords': words });
      return interaction.reply({ embeds: [successEmbed('Word Updated', emojis.check + ' **' + word + '** has been ' + (action === 'add' ? 'added' : 'removed') + '.')] });
    }
  },
};
