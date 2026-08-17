module.exports = {
  name: 'say',
  description: 'Send a message as the bot',
  usage: '!say <message>',
  async execute(message, args) {
    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed('Permission Denied', 'You need the Manage Messages permission.')],
      });
    }

    const text = args.join(' ');
    if (!text) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed('Invalid Usage', '`!say <message>`')],
      });
    }

    message.delete().catch(() => {});
    message.channel.send(text);
  },
};
