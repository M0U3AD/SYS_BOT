const { infoEmbed } = require('../../utils/embeds');

module.exports = {
  name: 'ping',
  description: 'Show bot latency',
  usage: '!ping',
  async execute(message, args, client) {
    const sent = await message.reply({ embeds: [infoEmbed('Pinging...', 'Calculating latency...')] });
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    sent.edit({
      embeds: [
        infoEmbed('Pong!', `**Bot Latency:** ${latency}ms\n**API Latency:** ${apiLatency}ms`),
      ],
    });
  },
};
