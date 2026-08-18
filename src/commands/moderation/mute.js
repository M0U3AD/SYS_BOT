const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const Log = require('../../database/models/Log');
const { getGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'mute',
  description: 'Timeout a member',
  usage: '!mute <@user> <minutes> [reason]',
  slash: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a member')
    .addUserOption(opt => opt.setName('user').setDescription('User to mute').setRequired(true))
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for mute'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(message, args) {
    if (!message.member.permissions.has('ModerateMembers')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Moderate Members permission.')] });
    }
    const member = message.mentions.members.first();
    if (!member) {
      return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!mute <@user> <minutes> [reason]`')] });
    }
    const minutes = parseInt(args[1]);
    if (isNaN(minutes) || minutes < 1 || minutes > 40320) {
      return message.reply({ embeds: [errorEmbed('Invalid Duration', 'Please provide a duration between 1 and 40320 minutes.')] });
    }
    const reason = args.slice(2).join(' ') || 'No reason provided';
    await member.timeout(minutes * 60 * 1000, reason);
    message.reply({ embeds: [successEmbed('Member Muted', `**${member.user.tag}** has been muted for **${minutes}** minute(s).\n**Reason:** ${reason}`)] });

    const config = await getGuildConfig(message.guild.id);
    if (config.logging.modLogChannelId) {
      const ch = message.guild.channels.cache.get(config.logging.modLogChannelId);
      if (ch) ch.send({ embeds: [successEmbed('Member Muted', `**User:** ${member.user.tag}\n**Moderator:** ${message.author.tag}\n**Duration:** ${minutes}m\n**Reason:** ${reason}`)] });
    }
    await Log.addLog(message.guild.id, 'mod', 'mute', message.author.id, member.id, `${reason} (${minutes}m)`);
  },
  async slashExecute(interaction, client) {
    const user = interaction.options.getUser('user');
    const minutes = interaction.options.getInteger('minutes');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);
    if (!member) return interaction.reply({ embeds: [errorEmbed('Not Found', 'User not in this server.')], ephemeral: true });
    if (!member.moderatable) return interaction.reply({ embeds: [errorEmbed('Cannot Mute', 'I cannot mute this user.')], ephemeral: true });
    await member.timeout(minutes * 60 * 1000, reason);
    interaction.reply({ embeds: [successEmbed('Member Muted', `**${user.tag}** has been muted for **${minutes}** minute(s).\n**Reason:** ${reason}`)] });

    const config = await getGuildConfig(interaction.guild.id);
    if (config.logging.modLogChannelId) {
      const ch = interaction.guild.channels.cache.get(config.logging.modLogChannelId);
      if (ch) ch.send({ embeds: [successEmbed('Member Muted', `**User:** ${user.tag}\n**Moderator:** ${interaction.user.tag}\n**Duration:** ${minutes}m\n**Reason:** ${reason}`)] });
    }
    await Log.addLog(interaction.guild.id, 'mod', 'mute', interaction.user.id, user.id, `${reason} (${minutes}m)`);
  },
};
