module.exports = {
  name: 'say',
  description: 'Send a message as the bot',
  usage: '!say <message> [attach media to your message]',
  async execute(message, args) {
    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed('Permission Denied', 'You need the Manage Messages permission.')],
      });
    }

    const text = args.join(' ').trim();
    const attachments = [...message.attachments.values()];

    if (!text && attachments.length === 0) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed('Invalid Usage', '`!say <message>`\n\nYou can also attach images/files to your message.')],
      });
    }

    message.delete().catch(() => {});
    await message.channel.send({
      content: text || undefined,
      files: attachments,
    });
  },
};
