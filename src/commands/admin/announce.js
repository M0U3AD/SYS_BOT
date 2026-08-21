const { EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  name: 'announce',
  description: 'Send an announcement embed as the bot',
  usage: '!announce <title> | <message> | [image URL or attachment]',
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
          '`!announce <title> | <message> | [image URL]`\n\nThe `|` separator splits the title from the body. You can also attach an image to your message.'
        )],
      });
    }

    const title = parts[0];
    let body = parts.slice(1).join(' | ').trim();

    let imageUrl = null;
    const attachment = message.attachments.first();

    if (attachment) {
      imageUrl = attachment.url;
    } else if (body) {
      const tokens = body.split(/\s+/);
      const lastToken = tokens[tokens.length - 1];
      if (lastToken && /^https?:\/\/\S+$/.test(lastToken)) {
        imageUrl = lastToken;
        tokens.pop();
        body = tokens.join(' ');
      }
    }

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(title)
      .setTimestamp()
      .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) });

    if (body) embed.setDescription(body);
    if (imageUrl) embed.setImage(imageUrl);

    message.delete().catch(() => {});
    message.channel.send({ embeds: [embed] });
  },
};
