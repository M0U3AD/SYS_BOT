const { EmbedBuilder } = require('discord.js');
const productStore = require('../../api/data/productStore');
const config = require('../../../config.json');

module.exports = {
  name: 'redeem',
  description: 'Redeem a product key to receive product details via DM',
  usage: '!redeem <key>',
  async execute(message, args) {
    const key = args[0];
    if (!key) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed(
          'Invalid Usage',
          '`!redeem <key>`\n\nEnter the product key you received.'
        )],
      });
    }

    const result = productStore.redeem(key, message.author.id, message.author.tag);

    if (!result.success) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed('Redeem Failed', result.error)],
      });
    }

    const product = result.product;

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('Redeem Successful')
      .setDescription(`Check your DMs for **${product.name}** details!`)
      .setTimestamp();

    message.reply({ embeds: [embed] });

    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(product.name)
        .setTimestamp();

      if (product.description) {
        dmEmbed.setDescription(product.description);
      }

      if (product.details) {
        dmEmbed.addFields({ name: 'Details', value: product.details });
      }

      dmEmbed.addFields(
        { name: 'Key', value: `\`${product.key}\``, inline: true },
        { name: 'Redeemed', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
      );

      dmEmbed.setFooter({ text: 'Sys Bot Store' });

      await message.author.send({ embeds: [dmEmbed] });
    } catch {
      // DMs are closed — the reply already told them it succeeded
    }
  },
};
