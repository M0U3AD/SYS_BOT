const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/utils/GuildConfig');
const Log = require('../../database/models/Log');

module.exports = {
  name: 'messageDelete',
  once: false,
  async execute(message, client) {
    if (message.author?.bot) return;
    if (!message.guild) return;

    const config = await getGuildConfig(message.guild.id);
    const chId = config.logging.messageLogChannelId;
    if (!chId) return;
    const ch = message.guild.channels.cache.get(chId);
    if (!ch) return;

    const content = message.content || '(no text content)';
    const truncated = content.length > 1024 ? content.substring(0, 1021) + '...' : content;

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Message Deleted')
      .setDescription(`Message by **${message.author.tag}** in <#${message.channel.id}>`)
      .addFields(
        { name: 'Content', value: truncated, inline: false },
        { name: 'Author', value: `<@${message.author.id}>`, inline: true },
        { name: 'Channel', value: `<#${message.channel.id}>`, inline: true }
      )
      .setTimestamp();

    if (message.attachments.size > 0) {
      embed.addFields({ name: 'Attachments', value: message.attachments.map(a => a.name).join(', ') });
    }

    ch.send({ embeds: [embed] });
    await Log.addLog(message.guild.id, 'message', 'delete', message.author.id, '', `Deleted in #${message.channel.name}: ${truncated}`, message.channel.id, message.id);
  },
};
