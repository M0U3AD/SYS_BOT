const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const Log = require('../../database/models/Log');
const { getGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'ban',
  description: 'Ban a member from the server',
  usage: '!ban <@user> [reason]',
  slash: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for ban'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(message, args) {
    if (!message.member.permissions.has('BanMembers')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Ban Members permission.')] });
    }
    const member = message.mentions.members.first();
    if (!member) {
      return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Please mention a user to ban.\n`!ban <@user> [reason]`')] });
    }
    if (!member.bannable) {
      return message.reply({ embeds: [errorEmbed('Cannot Ban', 'I cannot ban this user. They may have a higher role than me.')] });
    }
    const reason = args.slice(1).join(' ') || 'No reason provided';
    await member.ban({ reason });
    message.reply({ embeds: [successEmbed('Member Banned', `**${member.user.tag}** has been banned.\n**Reason:** ${reason}`)] });

    const config = await getGuildConfig(message.guild.id);
    if (config.logging.modLogChannelId) {
      const ch = message.guild.channels.cache.get(config.logging.modLogChannelId);
      if (ch) {
        ch.send({ embeds: [successEmbed('Member Banned', `**User:** ${member.user.tag}\n**Moderator:** ${message.author.tag}\n**Reason:** ${reason}`)] });
      }
    }
    await Log.addLog(message.guild.id, 'mod', 'ban', message.author.id, member.id, reason);
  },
  async slashExecute(interaction, client) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);
    if (!member) {
      return interaction.reply({ embeds: [errorEmbed('Not Found', 'User not in this server.')], ephemeral: true });
    }
    if (!member.bannable) {
      return interaction.reply({ embeds: [errorEmbed('Cannot Ban', 'I cannot ban this user.')], ephemeral: true });
    }
    await member.ban({ reason });
    interaction.reply({ embeds: [successEmbed('Member Banned', `**${member.user.tag}** has been banned.\n**Reason:** ${reason}`)] });

    const config = await getGuildConfig(interaction.guild.id);
    if (config.logging.modLogChannelId) {
      const ch = interaction.guild.channels.cache.get(config.logging.modLogChannelId);
      if (ch) {
        ch.send({ embeds: [successEmbed('Member Banned', `**User:** ${user.tag}\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`)] });
      }
    }
    await Log.addLog(interaction.guild.id, 'mod', 'ban', interaction.user.id, user.id, reason);
  },
};
