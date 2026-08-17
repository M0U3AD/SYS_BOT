const { EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  name: 'dm',
  description: 'Send a DM as the bot to a user',
  usage: '!dm <@user> <message>',
  async execute(message, args) {
    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed('Permission Denied', 'You need the Manage Messages permission.')],
      });
    }

    const member = message.mentions.members.first();
    if (!member) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed('Invalid Usage', '`!dm <@user> <message>`')],
      });
    }

    const text = args.slice(1).join(' ');
    if (!text) {
      return message.reply({
        embeds: [require('../../utils/embeds').errorEmbed('Invalid Usage', 'Please provide a message to send.')],
      });
    }

    try {
      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setDescription(text)
        .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      await member.send({ embeds: [embed] });
      message.reply({
        embeds: [require('../../utils/embeds').successEmbed('DM Sent', `Message sent to **${member.user.tag}** via DM.`)],
      });
    } catch {
      message.reply({
        embeds: [require('../../utils/embeds').errorEmbed('Failed', `Could not DM **${member.user.tag}**. They may have DMs disabled.`)],
      });
    }
  },
};
