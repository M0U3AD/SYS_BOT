const { EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  name: 'announce',
  description: 'Send an announcement embed as the bot',
  usage: '!announce <title> | <message>',
  async execute(message, args) {
    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed('Permission Denied', 'You need the Manage Messages permission.')],
      });
    }

    const raw = args.join(' ');
    const parts = raw.split('|').map(p => p.trim());

    if (!parts[0]) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed(
          'Invalid Usage',
          '`!announce <title> | <message>`\n\nThe `|` separator splits the title from the body.'
        )],
      });
    }

    const title = parts[0];
    const body = parts.slice(1).join(' | ') || '';

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(title)
      .setTimestamp()
      .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) });

    if (body) embed.setDescription(body);

    message.delete().catch(() => {});
    message.channel.send({ embeds: [embed] });
  },
};
