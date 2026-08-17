const { EmbedBuilder } = require('discord.js');
const productStore = require('../../api/data/productStore');
const config = require('../../../config.json');

module.exports = {
  name: 'addproduct',
  description: 'Add a new product to the store (moderator only)',
  usage: '!addproduct <name> | <description> | <details>',
  async execute(message, args) {
    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed('Permission Denied', 'You need the Manage Messages permission.')],
      });
    }

    const raw = args.join(' ');
    const parts = raw.split('|').map(p => p.trim());

    if (parts.length < 1 || !parts[0]) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed(
          'Invalid Usage',
          '`!addproduct <name> | <description> | <details>`\n\n**Example:**\n`!addproduct VIP License | Premium access | Includes all features, priority support, and monthly updates`'
        )],
      });
    }

    const name = parts[0];
    const description = parts[1] || '';
    const details = parts[2] || '';

    const product = productStore.addProduct({
      name,
      description,
      details,
      addedBy: message.author.tag,
    });

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('Product Added')
      .addFields(
        { name: 'Product', value: product.name, inline: true },
        { name: 'Key', value: `\`${product.key}\``, inline: true },
        { name: 'Description', value: product.description || 'None' },
      );

    if (product.details) {
      embed.addFields({ name: 'Details', value: product.details });
    }

    embed.setFooter({ text: `Added by ${message.author.tag}` }).setTimestamp();

    message.reply({ embeds: [embed] });
  },
};
