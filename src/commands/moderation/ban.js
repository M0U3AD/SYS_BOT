const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  name: 'ban',
  description: 'Ban a member from the server',
  usage: '!ban <@user> [reason]',
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
  },
};
