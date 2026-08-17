const { EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  name: 'userinfo',
  description: 'Show user information',
  usage: '!userinfo [@user]',
  async execute(message, args) {
    const member = message.mentions.members.first() || message.member;
    const user = member.user;

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(user.tag)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Username', value: user.username, inline: true },
        { name: 'Discriminator', value: user.discriminator || 'N/A', inline: true },
        { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: 'Roles', value: member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.toString()).join(', ') || 'None', inline: false },
      )
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },
};
