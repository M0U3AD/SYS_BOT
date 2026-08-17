const { EmbedBuilder } = require('discord.js');
const productStore = require('../../api/data/productStore');
const config = require('../../../config.json');

module.exports = {
  name: 'products',
  description: 'List all products in the store (moderator only)',
  usage: '!products',
  async execute(message, args) {
    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed('Permission Denied', 'You need the Manage Messages permission.')],
      });
    }

    const products = productStore.getAllProducts();

    if (products.length === 0) {
      return message.reply({
        embeds: [require('../../utils/embeds').infoEmbed('Store Empty', 'No products have been added yet.\nUse `!addproduct` to add one.')],
      });
    }

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(`Store — ${products.length} Product(s)`)
      .setTimestamp();

    for (const p of products) {
      const redemptions = productStore.getRedemptionCount(p.id);
      embed.addFields({
        name: p.name,
        value: [
          `**Key:** \`${p.key}\``,
          `**Description:** ${p.description || 'None'}`,
          `**Redeemed:** ${redemptions} time(s)`,
          `**ID:** \`${p.id}\``,
        ].join('\n'),
        inline: false,
      });
    }

    message.reply({ embeds: [embed] });
  },
};
