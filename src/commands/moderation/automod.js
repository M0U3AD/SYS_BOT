const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
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
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Manage Server permission.')] });
    }

    if (args[0] === 'enable') {
      await updateGuildConfig(message.guild.id, { 'moderation.automod.enabled': true });
      return message.reply({ embeds: [successEmbed('AutoMod Enabled', 'Auto-moderation is now active. Use `!automod config` to configure rules.')] });
    }
    if (args[0] === 'disable') {
      await updateGuildConfig(message.guild.id, { 'moderation.automod.enabled': false });
      return message.reply({ embeds: [successEmbed('AutoMod Disabled', 'Auto-moderation is now off.')] });
    }
    if (args[0] === 'config') {
      const config = await getGuildConfig(message.guild.id);
      const a = config.moderation.automod;
      return message.reply({ embeds: [infoEmbed('AutoMod Config',
        `**Enabled:** ${a.enabled}\n**Anti-Spam:** ${a.antiSpam}\n**Anti-Link:** ${a.antiLink}\n**Anti-Invite:** ${a.antiInvite}\n**Max Mentions:** ${a.maxMentions}\n**Bad Words:** ${a.badWords.length} word(s)\n**Log Channel:** ${a.logChannelId ? `<#${a.logChannelId}>` : 'Not set'}`
      )] });
    }
    if (args[0] === 'word') {
      const action = args[1];
      const word = args[2]?.toLowerCase();
      if (!action || !word) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!automod word <add|remove> <word>`')] });
      const config = await getGuildConfig(message.guild.id);
      let words = config.moderation.automod.badWords || [];
      if (action === 'add') {
        if (words.includes(word)) return message.reply({ embeds: [errorEmbed('Duplicate', 'Word already in the list.')] });
        words.push(word);
      } else {
        words = words.filter(w => w !== word);
      }
      await updateGuildConfig(message.guild.id, { 'moderation.automod.badWords': words });
      return message.reply({ embeds: [successEmbed('Updated', `Bad word **${word}** ${action === 'add' ? 'added' : 'removed'}.`)] });
    }

    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!automod enable|disable|config|word`')] });
  },
  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'enable') {
      await updateGuildConfig(interaction.guild.id, { 'moderation.automod.enabled': true });
      return interaction.reply({ embeds: [successEmbed('AutoMod Enabled', 'Active. Configure with `/automod config`.')] });
    }
    if (sub === 'disable') {
      await updateGuildConfig(interaction.guild.id, { 'moderation.automod.enabled': false });
      return interaction.reply({ embeds: [successEmbed('AutoMod Disabled', 'Off.')] });
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
      if (badWords) update['moderation.automod.badWords'] = badWords.split(',').map(w => w.trim().toLowerCase());
      if (logChannel) update['moderation.automod.logChannelId'] = logChannel.id;

      if (Object.keys(update).length === 0) {
        const config = await getGuildConfig(interaction.guild.id);
        const a = config.moderation.automod;
        return interaction.reply({ embeds: [infoEmbed('AutoMod Config',
          `**Anti-Spam:** ${a.antiSpam}\n**Anti-Link:** ${a.antiLink}\n**Anti-Invite:** ${a.antiInvite}\n**Max Mentions:** ${a.maxMentions}\n**Bad Words:** ${a.badWords.length}`
        )], ephemeral: true });
      }

      await updateGuildConfig(interaction.guild.id, update);
      return interaction.reply({ embeds: [successEmbed('AutoMod Updated', 'Settings saved.')] });
    }

    if (sub === 'word') {
      const action = interaction.options.getString('action');
      const word = interaction.options.getString('word').toLowerCase();
      const config = await getGuildConfig(interaction.guild.id);
      let words = config.moderation.automod.badWords || [];
      if (action === 'add') {
        if (words.includes(word)) return interaction.reply({ embeds: [errorEmbed('Duplicate', 'Already in list.')], ephemeral: true });
        words.push(word);
      } else {
        words = words.filter(w => w !== word);
      }
      await updateGuildConfig(interaction.guild.id, { 'moderation.automod.badWords': words });
      return interaction.reply({ embeds: [successEmbed('Updated', `**${word}** ${action === 'add' ? 'added' : 'removed'}.`)] });
    }
  },
};
