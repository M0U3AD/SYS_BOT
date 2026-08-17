const { EmbedBuilder } = require('discord.js');
const productStore = require('../../api/data/productStore');
const config = require('../../../config.json');

module.exports = {
  name: 'regenerate',
  description: 'Regenerate the key for a product (moderator only)',
  usage: '!regenerate <product_id>',
  async execute(message, args) {
    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed('Permission Denied', 'You need the Manage Messages permission.')],
      });
    }

    const id = args[0];
    if (!id) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed('Invalid Usage', '`!regenerate <product_id>`\n\nUse `!products` to see product IDs.')],
      });
    }

    const product = productStore.regenerateKey(id);
    if (!product) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed('Not Found', 'No product found with that ID.')],
      });
    }

    message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(config.embedColor)
          .setTitle('Key Regenerated')
          .setDescription(`New key for **${product.name}**: \`${product.key}\``)
          .setTimestamp(),
      ],
    });
  },
};
