const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed, modEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');
const { getT } = require('../../i18n');

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
    const t = await getT(message.guild.id);

    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ embeds: [errorEmbed('Access Denied', t('MOD_ACCESS_DENIED', 'Manage Server'))] });
    }

    if (args[0] === 'enable') {
      await updateGuildConfig(message.guild.id, { 'moderation.automod.enabled': true });
      return message.reply({ embeds: [successEmbed('AutoMod Enabled', emojis.shield + ' ' + t('MOD_AUTOMOD_ENABLED') + '\nUse `!automod config` to configure rules.')] });
    }

    if (args[0] === 'disable') {
      await updateGuildConfig(message.guild.id, { 'moderation.automod.enabled': false });
      return message.reply({ embeds: [infoEmbed('AutoMod Disabled', emojis.shield + ' ' + t('MOD_AUTOMOD_DISABLED'))] });
    }

    if (args[0] === 'config') {
      const config = await getGuildConfig(message.guild.id);
      const a = config.moderation.automod;

      const embed = modEmbed(emojis.shield, t('MOD_AUTOMOD_TITLE'), [
        { name: emojis.bolt + ' Status', value: t('MOD_AUTOMOD_STATUS', a.enabled), inline: true },
        { name: emojis.bolt + ' Anti-Spam', value: t('MOD_AUTOMOD_ON', a.antiSpam), inline: true },
        { name: emojis.link + ' Anti-Link', value: t('MOD_AUTOMOD_ON', a.antiLink), inline: true },
        { name: emojis.link + ' Anti-Invite', value: t('MOD_AUTOMOD_ON', a.antiInvite), inline: true },
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
        return message.reply({ embeds: [errorEmbed('Invalid Usage', t('MOD_AUTOMOD_INVALID_USAGE'))] });
      }

      const config = await getGuildConfig(message.guild.id);
      let words = config.moderation.automod.badWords || [];

      if (action === 'add') {
        if (words.includes(word)) return message.reply({ embeds: [errorEmbed('Duplicate', t('MOD_AUTOMOD_WORD_DUPLICATE'))] });
        words.push(word);
      } else {
        words = words.filter(function(w) { return w !== word; });
      }

      await updateGuildConfig(message.guild.id, { 'moderation.automod.badWords': words });
      return message.reply({ embeds: [successEmbed('Word Updated', emojis.check + ' ' + t('MOD_AUTOMOD_WORD_UPDATED', word, action === 'add' ? 'added to' : 'removed from'))] });
    }

    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!automod enable|disable|config|word`')] });
  },

  async slashExecute(interaction, client) {
    const t = await getT(interaction.guild.id);
    const sub = interaction.options.getSubcommand();

    if (sub === 'enable') {
      await updateGuildConfig(interaction.guild.id, { 'moderation.automod.enabled': true });
      return interaction.reply({ embeds: [successEmbed('AutoMod Enabled', emojis.shield + ' ' + t('MOD_AUTOMOD_ENABLED'))] });
    }

    if (sub === 'disable') {
      await updateGuildConfig(interaction.guild.id, { 'moderation.automod.enabled': false });
      return interaction.reply({ embeds: [infoEmbed('AutoMod Disabled', emojis.shield + ' ' + t('MOD_AUTOMOD_DISABLED'))] });
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

        const embed = modEmbed(emojis.shield, t('MOD_AUTOMOD_TITLE'), [
          { name: emojis.bolt + ' Status', value: t('MOD_AUTOMOD_STATUS', a.enabled), inline: true },
          { name: emojis.bolt + ' Anti-Spam', value: t('MOD_AUTOMOD_ON', a.antiSpam), inline: true },
          { name: emojis.link + ' Anti-Link', value: t('MOD_AUTOMOD_ON', a.antiLink), inline: true },
          { name: emojis.link + ' Anti-Invite', value: t('MOD_AUTOMOD_ON', a.antiInvite), inline: true },
          { name: emojis.warning + ' Max Mentions', value: '' + a.maxMentions, inline: true },
          { name: emojis.trash + ' Bad Words', value: a.badWords.length + ' word(s)', inline: true },
        ], { color: COLORS.primary });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      await updateGuildConfig(interaction.guild.id, update);
      return interaction.reply({ embeds: [successEmbed('AutoMod Updated', emojis.check + ' ' + t('MOD_AUTOMOD_UPDATED'))] });
    }

    if (sub === 'word') {
      const action = interaction.options.getString('action');
      const word = interaction.options.getString('word').toLowerCase();
      const config = await getGuildConfig(interaction.guild.id);
      let words = config.moderation.automod.badWords || [];

      if (action === 'add') {
        if (words.includes(word)) return interaction.reply({ embeds: [errorEmbed('Duplicate', t('MOD_AUTOMOD_WORD_DUPLICATE'))], ephemeral: true });
        words.push(word);
      } else {
        words = words.filter(function(w) { return w !== word; });
      }

      await updateGuildConfig(interaction.guild.id, { 'moderation.automod.badWords': words });
      return interaction.reply({ embeds: [successEmbed('Word Updated', emojis.check + ' ' + t('MOD_AUTOMOD_WORD_UPDATED', word, action === 'add' ? 'added' : 'removed'))] });
    }
  },
};
