const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const Log = require('../../database/models/Log');
const { getGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'kick',
  description: 'Kick a member from the server',
  usage: '!kick <@user> [reason]',
  slash: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption(opt => opt.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for kick'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(message, args) {
    if (!message.member.permissions.has('KickMembers')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Kick Members permission.')] });
    }
    const member = message.mentions.members.first();
    if (!member) {
      return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Please mention a user to kick.\n`!kick <@user> [reason]`')] });
    }
    if (!member.kickable) {
      return message.reply({ embeds: [errorEmbed('Cannot Kick', 'I cannot kick this user.')] });
    }
    const reason = args.slice(1).join(' ') || 'No reason provided';
    await member.kick(reason);
    message.reply({ embeds: [successEmbed('Member Kicked', `**${member.user.tag}** has been kicked.\n**Reason:** ${reason}`)] });

    const config = await getGuildConfig(message.guild.id);
    if (config.logging.modLogChannelId) {
      const ch = message.guild.channels.cache.get(config.logging.modLogChannelId);
      if (ch) ch.send({ embeds: [successEmbed('Member Kicked', `**User:** ${member.user.tag}\n**Moderator:** ${message.author.tag}\n**Reason:** ${reason}`)] });
    }
    await Log.addLog(message.guild.id, 'mod', 'kick', message.author.id, member.id, reason);
  },
  async slashExecute(interaction, client) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);
    if (!member) return interaction.reply({ embeds: [errorEmbed('Not Found', 'User not in this server.')], ephemeral: true });
    if (!member.kickable) return interaction.reply({ embeds: [errorEmbed('Cannot Kick', 'I cannot kick this user.')], ephemeral: true });
    await member.kick(reason);
    interaction.reply({ embeds: [successEmbed('Member Kicked', `**${user.tag}** has been kicked.\n**Reason:** ${reason}`)] });

    const config = await getGuildConfig(interaction.guild.id);
    if (config.logging.modLogChannelId) {
      const ch = interaction.guild.channels.cache.get(config.logging.modLogChannelId);
      if (ch) ch.send({ embeds: [successEmbed('Member Kicked', `**User:** ${user.tag}\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`)] });
    }
    await Log.addLog(interaction.guild.id, 'mod', 'kick', interaction.user.id, user.id, reason);
  },
};
