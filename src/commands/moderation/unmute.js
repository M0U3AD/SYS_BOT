const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const Log = require('../../database/models/Log');

module.exports = {
  name: 'unmute',
  description: 'Remove timeout from a member',
  usage: '!unmute <@user>',
  slash: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove timeout from a member')
    .addUserOption(opt => opt.setName('user').setDescription('User to unmute').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(message, args) {
    if (!message.member.permissions.has('ModerateMembers')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Moderate Members permission.')] });
    }
    const member = message.mentions.members.first();
    if (!member) {
      return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!unmute <@user>`')] });
    }
    await member.timeout(null);
    message.reply({ embeds: [successEmbed('Member Unmuted', `**${member.user.tag}** has been unmuted.`)] });
    await Log.addLog(message.guild.id, 'mod', 'unmute', message.author.id, member.id, '');
  },
  async slashExecute(interaction, client) {
    const user = interaction.options.getUser('user');
    const member = interaction.guild.members.cache.get(user.id);
    if (!member) return interaction.reply({ embeds: [errorEmbed('Not Found', 'User not in this server.')], ephemeral: true });
    await member.timeout(null);
    interaction.reply({ embeds: [successEmbed('Member Unmuted', `**${user.tag}** has been unmuted.`)] });
    await Log.addLog(interaction.guild.id, 'mod', 'unmute', interaction.user.id, user.id, '');
  },
};
