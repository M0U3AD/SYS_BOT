const { PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const config = require('../../../config.json');

module.exports = {
  name: 'mute',
  description: 'Timeout a member (mute)',
  usage: '!mute <@user> <duration in minutes> [reason]',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Moderate Members permission.')] });
    }

    const member = message.mentions.members.first();
    if (!member) {
      return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Please mention a user to mute.\n`!mute <@user> <minutes> [reason]`')] });
    }

    if (!member.moderatable) {
      return message.reply({ embeds: [errorEmbed('Cannot Mute', 'I cannot mute this user. They may have a higher role than me.')] });
    }

    const duration = parseInt(args[1]);
    if (isNaN(duration) || duration < 1 || duration > 40320) {
      return message.reply({ embeds: [errorEmbed('Invalid Duration', 'Duration must be between 1 and 40320 minutes (28 days).')] });
    }

    const reason = args.slice(2).join(' ') || 'No reason provided';
    const ms = duration * 60 * 1000;

    await member.timeout(ms, reason);
    message.reply({ embeds: [successEmbed('Member Muted', `**${member.user.tag}** has been muted for **${duration}** minute(s).\n**Reason:** ${reason}`)] });
  },
};
