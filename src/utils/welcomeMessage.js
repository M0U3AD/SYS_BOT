const path = require('node:path');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');

const bannerPath = path.join(__dirname, '../../assets/welcome-banner.png');

module.exports = (member, message, color) => {
  const avatar = member.user.displayAvatarURL({ dynamic: true });
  const embed = new EmbedBuilder()
    .setColor(color || '#5865F2')
    .setAuthor({ name: member.displayName, iconURL: avatar })
    .setTitle(`Welcome to ${member.guild.name}!`)
    .setDescription(message)
    .setThumbnail(avatar)
    .setImage('attachment://welcome-banner.png')
    .setTimestamp();

  return {
    embeds: [embed],
    files: [new AttachmentBuilder(bannerPath)],
  };
};
