const { EmbedBuilder } = require('discord.js');
const Giveaway = require('../database/models/Giveaway');

async function endGiveaway(messageId, client) {
  const giveaway = await Giveaway.findOne({ messageId, ended: false });
  if (!giveaway) return null;

  giveaway.ended = true;

  if (giveaway.entries.length === 0) {
    giveaway.winners = [];
    await giveaway.save();
    return { giveaway, winners: [] };
  }

  const winnerCount = Math.min(giveaway.winnerCount, giveaway.entries.length);
  const shuffled = [...giveaway.entries].sort(() => 0.5 - Math.random());
  const winners = shuffled.slice(0, winnerCount);
  giveaway.winners = winners;
  await giveaway.save();

  return { giveaway, winners };
}

async function checkGiveaways(client) {
  const expired = await Giveaway.find({ ended: false, endsAt: { $lte: new Date() } });
  for (const giveaway of expired) {
    const { winners } = await endGiveaway(giveaway.messageId, client);
    try {
      const channel = client.channels.cache.get(giveaway.channelId);
      if (!channel) continue;
      const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (!message) continue;

      const embed = EmbedBuilder.from(message.embeds[0]);
      embed.setColor('#ED4245');
      embed.setTitle('🎉 Giveaway Ended');
      embed.setFooter({ text: `ID: ${giveaway.messageId}` });

      if (winners.length > 0) {
        embed.setDescription(`**Prize:** ${giveaway.prize}\n\n**Winners:** ${winners.map(id => `<@${id}>`).join(', ')}\n\nCongratulations!`);
      } else {
        embed.setDescription(`**Prize:** ${giveaway.prize}\n\nNo entries. No winners.`);
      }

      await message.edit({ embeds: [embed], components: [] });

      if (winners.length > 0) {
        await channel.send(`🎉 Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`);
      }
    } catch {}
  }
}

module.exports = { endGiveaway, checkGiveaways };
