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

    let raw = args.join(' ').trim();

    let imageUrl = null;
    const attachment = message.attachments.first();

    if (attachment) {
      imageUrl = attachment.url;
    } else {
      const tokens = raw.split(/\s+/);
      const lastToken = tokens[tokens.length - 1];
      if (lastToken && /^https?:\/\/\S+$/i.test(lastToken)) {
        imageUrl = lastToken;
        tokens.pop();
        raw = tokens.join(' ');
      }
    }

    const parts = raw.split('|').map(p => p.trim()).filter(Boolean);

    if (parts.length === 0 && !imageUrl) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed(
          'Invalid Usage',
          '`!announce <title> | <message> | [image URL]`\n\nThe `|` separator splits the title from the body. You can also attach an image to your message.'
        )],
      });
    }

    let title = parts[0] || 'Announcement';
    let body = parts.slice(1).join(' | ').trim();

    if (title.length > 256) title = title.slice(0, 253) + '...';
    if (body.length > 4096) body = body.slice(0, 4093) + '...';

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(title)
      .setTimestamp()
      .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) });

    if (body) embed.setDescription(body);
    if (imageUrl) embed.setImage(imageUrl);

    message.delete().catch(() => {});
    try {
      await message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('announce: failed to send embed:', err);
      message.channel.send({
        content: '⚠️ Could not send the announcement' + (imageUrl ? ' — the image link may be invalid or unreachable. Try a direct link to an image file.' : '.'),
      }).catch(() => {});
    }
  },
};
