const { EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  name: 'avatar',
  description: 'Show a user\'s avatar',
  usage: '!avatar [@user]',
  async execute(message, args) {
    const member = message.mentions.members.first() || message.member;
    const user = member.user;

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(`${user.tag}'s Avatar`)
      .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },
};
