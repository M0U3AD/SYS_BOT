const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const productStore = require('../../api/data/productStore');

module.exports = {
  name: 'deleteproduct',
  description: 'Delete a product from the store (moderator only)',
  usage: '!deleteproduct <product_id>',
  async execute(message, args) {
    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply({
        embeds: [errorEmbed('Permission Denied', 'You need the Manage Messages permission.')],
      });
    }

    const id = args[0];
    if (!id) {
      return message.reply({
        embeds: [errorEmbed('Invalid Usage', '`!deleteproduct <product_id>`\n\nUse `!products` to see product IDs.')],
      });
    }

    const removed = productStore.deleteProduct(id);
    if (!removed) {
      return message.reply({
        embeds: [errorEmbed('Not Found', 'No product found with that ID.')],
      });
    }

    message.reply({
      embeds: [successEmbed('Product Deleted', `**${removed.name}** has been removed from the store.`)],
    });
  },
};
