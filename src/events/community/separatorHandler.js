const { getGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.guild || !message.channel) return;
    if (![0, 5, 15].includes(message.channel.type)) return;

    try {
      const config = await getGuildConfig(message.guild.id);
      const separators = config.separators || [];
      if (separators.length === 0) return;

      const separator = separators.find(s => s.channelId === message.channel.id);
      if (!separator || !separator.mediaUrl) return;

      setTimeout(() => {
        message.channel.send(separator.mediaUrl).catch(() => {});
      }, 250);
    } catch (err) {
      console.error('separator handler error:', err);
    }
  },
};