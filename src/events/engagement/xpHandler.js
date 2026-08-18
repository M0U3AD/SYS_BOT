const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/utils/GuildConfig');
const Member = require('../../database/models/Member');
const { calculateLevel, randomXp } = require('../../utils/xp');

const cooldowns = new Map();

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    const config = await getGuildConfig(message.guild.id);
    if (!config.xp.enabled) return;
    if (config.xp.ignoredChannels.includes(message.channel.id)) return;

    const key = `${message.guild.id}-${message.author.id}`;
    const now = Date.now();
    if (cooldowns.has(key) && now - cooldowns.get(key) < (config.xp.cooldown || 60) * 1000) return;
    cooldowns.set(key, now);

    const member = await Member.getMember(message.guild.id, message.author.id);
    const xpGain = randomXp(config.xp.xpPerMessage, config.xp.xpPerMessage + (config.xp.xpVariance || 10));
    member.xp += xpGain;
    member.totalMessages += 1;

    const oldLevel = member.level;
    const newLevel = calculateLevel(member.xp);

    if (newLevel > oldLevel) {
      member.level = newLevel;
      const ch = config.xp.levelUpChannelId
        ? message.guild.channels.cache.get(config.xp.levelUpChannelId)
        : message.channel;

      if (ch) {
        const embed = new EmbedBuilder()
          .setColor(config.embedColor)
          .setTitle('Level Up!')
          .setDescription(`**${message.author.tag}** reached **level ${newLevel}**!`)
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
          .setTimestamp();
        ch.send({ embeds: [embed] });
      }
    }

    member.lastXpMessage = now;
    await member.save();
  },
};
