const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'verify',
  description: 'Configure member verification',
  usage: '!verify setup <#channel> <@role> | !verify disable | !verify mode <button|captcha>',
  slash: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Configure verification')
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Set up verification')
      .addChannelOption(opt => opt.setName('channel').setDescription('Verification channel').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Verified role').setRequired(true)))
    .addSubcommand(sub => sub.setName('disable').setDescription('Disable verification'))
    .addSubcommand(sub => sub
      .setName('mode')
      .setDescription('Set verification mode')
      .addStringOption(opt => opt.setName('mode').setDescription('Mode').setRequired(true)
        .addChoices({ name: 'Button', value: 'button' }, { name: 'CAPTCHA', value: 'captcha' })))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(message, args) {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Manage Server permission.')] });
    }

    if (args[0] === 'setup') {
      const ch = message.mentions.channels.first();
      const role = message.mentions.roles.first();
      if (!ch || !role) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!verify setup <#channel> <@role>`')] });
      await updateGuildConfig(message.guild.id, {
        'verification.enabled': true,
        'verification.channelId': ch.id,
        'verification.roleId': role.id,
      });
      return message.reply({ embeds: [successEmbed('Verification Configured', `Verification channel: ${ch}\nVerified role: ${role}\n\nNew members will see a verify button in ${ch}.`)] });
    }

    if (args[0] === 'disable') {
      await updateGuildConfig(message.guild.id, { 'verification.enabled': false });
      return message.reply({ embeds: [successEmbed('Verification Disabled', 'Verification is now off.')] });
    }

    if (args[0] === 'mode') {
      if (!args[1] || !['button', 'captcha'].includes(args[1])) {
        return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!verify mode <button|captcha>`')] });
      }
      await updateGuildConfig(message.guild.id, { 'verification.mode': args[1] });
      return message.reply({ embeds: [successEmbed('Mode Updated', `Verification mode set to **${args[1]}**.`)] });
    }

    const config = await getGuildConfig(message.guild.id);
    return message.reply({ embeds: [infoEmbed('Verification Config',
      `**Enabled:** ${config.verification.enabled}\n**Channel:** ${config.verification.channelId ? `<#${config.verification.channelId}>` : 'Not set'}\n**Role:** ${config.verification.roleId ? `<@&${config.verification.roleId}>` : 'Not set'}\n**Mode:** ${config.verification.mode}`
    )] });
  },
  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'setup') {
      const ch = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');
      await updateGuildConfig(interaction.guild.id, {
        'verification.enabled': true,
        'verification.channelId': ch.id,
        'verification.roleId': role.id,
      });
      return interaction.reply({ embeds: [successEmbed('Verification Configured', `Channel: ${ch}\nRole: ${role}`)] });
    }
    if (sub === 'disable') {
      await updateGuildConfig(interaction.guild.id, { 'verification.enabled': false });
      return interaction.reply({ embeds: [successEmbed('Disabled', 'Verification turned off.')] });
    }
    if (sub === 'mode') {
      const mode = interaction.options.getString('mode');
      await updateGuildConfig(interaction.guild.id, { 'verification.mode': mode });
      return interaction.reply({ embeds: [successEmbed('Mode Updated', `Set to **${mode}**.`)] });
    }
  },
};
