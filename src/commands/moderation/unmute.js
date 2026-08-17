const { PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  name: 'unmute',
  description: 'Remove timeout from a member (unmute)',
  usage: '!unmute <@user>',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Moderate Members permission.')] });
    }

    const member = message.mentions.members.first();
    if (!member) {
      return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Please mention a user to unmute.\n`!unmute <@user>`')] });
    }

    await member.timeout(null);
    message.reply({ embeds: [successEmbed('Member Unmuted', `**${member.user.tag}** has been unmuted.`)] });
  },
};
