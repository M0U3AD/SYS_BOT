const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  name: 'purge',
  description: 'Bulk delete messages from a channel',
  usage: '!purge <amount>',
  async execute(message, args) {
    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Manage Messages permission.')] });
    }

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply({ embeds: [errorEmbed('Invalid Amount', 'Please provide a number between 1 and 100.')] });
    }

    const deleted = await message.channel.bulkDelete(amount + 1, true);
    const msg = await message.channel.send({ embeds: [successEmbed('Messages Purged', `Deleted **${deleted.size - 1}** message(s).`)] });

    setTimeout(() => msg.delete().catch(() => {}), 3000);
  },
};
