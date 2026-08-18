const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'welcome',
  description: 'Configure welcome and goodbye messages',
  usage: '!welcome enable | !welcome disable | !welcome channel <#channel> | !welcome message <msg> | !welcome goodbye <msg> | !welcome test',
  slash: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure welcome/goodbye messages')
    .addSubcommand(sub => sub.setName('enable').setDescription('Enable welcome messages'))
    .addSubcommand(sub => sub.setName('disable').setDescription('Disable welcome messages'))
    .addSubcommand(sub => sub
      .setName('channel')
      .setDescription('Set welcome channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('message')
      .setDescription('Set welcome message')
      .addStringOption(opt => opt.setName('message').setDescription('Message (use {user}, {server}, {membercount})').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('goodbye')
      .setDescription('Set goodbye message')
      .addStringOption(opt => opt.setName('message').setDescription('Message').setRequired(true)))
    .addSubcommand(sub => sub.setName('test').setDescription('Test welcome message'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(message, args) {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Manage Server permission.')] });
    }
    const config = await getGuildConfig(message.guild.id);

    if (args[0] === 'enable') {
      await updateGuildConfig(message.guild.id, { 'welcome.enabled': true });
      return message.reply({ embeds: [successEmbed('Welcome Enabled', 'Welcome messages are now active.')] });
    }
    if (args[0] === 'disable') {
      await updateGuildConfig(message.guild.id, { 'welcome.enabled': false, 'goodbye.enabled': false });
      return message.reply({ embeds: [successEmbed('Welcome Disabled', 'Welcome and goodbye messages are now inactive.')] });
    }
    if (args[0] === 'channel') {
      const ch = message.mentions.channels.first();
      if (!ch) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!welcome channel <#channel>`')] });
      await updateGuildConfig(message.guild.id, { 'welcome.channelId': ch.id, 'goodbye.channelId': ch.id });
      return message.reply({ embeds: [successEmbed('Channel Set', `Welcome/goodbye channel set to ${ch}.`)] });
    }
    if (args[0] === 'message') {
      const msg = args.slice(1).join(' ');
      if (!msg) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!welcome message <message>`')] });
      await updateGuildConfig(message.guild.id, { 'welcome.message': msg });
      return message.reply({ embeds: [successEmbed('Message Updated', `Welcome message set to:\n${msg}`)] });
    }
    if (args[0] === 'goodbye') {
      const msg = args.slice(1).join(' ');
      if (!msg) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!welcome goodbye <message>`')] });
      await updateGuildConfig(message.guild.id, { 'goodbye.message': msg });
      return message.reply({ embeds: [successEmbed('Goodbye Updated', `Goodbye message set to:\n${msg}`)] });
    }
    if (args[0] === 'test') {
      const msg = config.welcome.message
        .replace(/{user}/g, `<@${message.author.id}>`)
        .replace(/{server}/g, message.guild.name)
        .replace(/{membercount}/g, message.guild.memberCount);
      return message.reply({ embeds: [infoEmbed('Welcome Test', msg)] });
    }

    return message.reply({ embeds: [infoEmbed('Welcome Config',
      `**Enabled:** ${config.welcome.enabled}\n**Channel:** ${config.welcome.channelId ? `<#${config.welcome.channelId}>` : 'Not set'}\n**Message:** ${config.welcome.message}\n**Goodbye:** ${config.goodbye.message}`
    )] });
  },
  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'enable') {
      await updateGuildConfig(interaction.guild.id, { 'welcome.enabled': true });
      return interaction.reply({ embeds: [successEmbed('Welcome Enabled', 'Welcome messages are now active.')] });
    }
    if (sub === 'disable') {
      await updateGuildConfig(interaction.guild.id, { 'welcome.enabled': false, 'goodbye.enabled': false });
      return interaction.reply({ embeds: [successEmbed('Welcome Disabled', 'Messages disabled.')] });
    }
    if (sub === 'channel') {
      const ch = interaction.options.getChannel('channel');
      await updateGuildConfig(interaction.guild.id, { 'welcome.channelId': ch.id, 'goodbye.channelId': ch.id });
      return interaction.reply({ embeds: [successEmbed('Channel Set', `Set to ${ch}.`)] });
    }
    if (sub === 'message') {
      const msg = interaction.options.getString('message');
      await updateGuildConfig(interaction.guild.id, { 'welcome.message': msg });
      return interaction.reply({ embeds: [successEmbed('Message Updated', msg)] });
    }
    if (sub === 'goodbye') {
      const msg = interaction.options.getString('message');
      await updateGuildConfig(interaction.guild.id, { 'goodbye.message': msg });
      return interaction.reply({ embeds: [successEmbed('Goodbye Updated', msg)] });
    }
    if (sub === 'test') {
      const config = await getGuildConfig(interaction.guild.id);
      const msg = config.welcome.message
        .replace(/{user}/g, `<@${interaction.user.id}>`)
        .replace(/{server}/g, interaction.guild.name)
        .replace(/{membercount}/g, interaction.guild.memberCount);
      return interaction.reply({ embeds: [infoEmbed('Welcome Test', msg)], ephemeral: true });
    }
  },
};
