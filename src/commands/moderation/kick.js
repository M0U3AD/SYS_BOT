const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  name: 'kick',
  description: 'Kick a member from the server',
  usage: '!kick <@user> [reason]',
  async execute(message, args) {
    if (!message.member.permissions.has('KickMembers')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Kick Members permission.')] });
    }

    const member = message.mentions.members.first();
    if (!member) {
      return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Please mention a user to kick.\n`!kick <@user> [reason]`')] });
    }

    if (!member.kickable) {
      return message.reply({ embeds: [errorEmbed('Cannot Kick', 'I cannot kick this user. They may have a higher role than me.')] });
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    await member.kick(reason);
    message.reply({ embeds: [successEmbed('Member Kicked', `**${member.user.tag}** has been kicked.\n**Reason:** ${reason}`)] });
  },
};
