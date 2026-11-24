const { ChannelType, EmbedBuilder } = require('discord.js');
const Member = require('../database/models/Member');
const { getGuildConfig } = require('../database/utils/GuildConfig');
const { calculateLevel } = require('./xp');

let running = false;

async function awardVoiceXp(client) {
  if (running) return;
  running = true;

  try {
    for (const guild of client.guilds.cache.values()) {
      try {
        const config = await getGuildConfig(guild.id);
        if (!config.xp.enabled) continue;

        for (const channel of guild.channels.cache.values()) {
          if (
            (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) ||
            channel.id === guild.afkChannelId ||
            config.xp.ignoredChannels?.includes(channel.id)
          ) continue;

          const listeners = [...channel.members.values()].filter(member => !member.user.bot && !member.voice.deaf);
          if (listeners.length < 2) continue;

          for (const member of listeners) {
            const record = await Member.getMember(guild.id, member.id);
            const oldLevel = record.voiceLevel || 0;
            record.voiceXp = (record.voiceXp || 0) + Math.max(1, config.xp.voiceXpPerMinute || 5);
            record.voiceLevel = calculateLevel(record.voiceXp);
            await record.save();

            if (record.voiceLevel > oldLevel) {
              const announceChannel = config.xp.levelUpChannelId
                ? guild.channels.cache.get(config.xp.levelUpChannelId)
                : guild.systemChannel;

              if (announceChannel?.send) {
                const embed = new EmbedBuilder()
                  .setColor(config.embedColor)
                  .setTitle('Voice Level Up!')
                  .setDescription(`**${member.user.tag}** reached **voice level ${record.voiceLevel}** in <#${channel.id}>.`)
                  .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                  .setTimestamp();
                announceChannel.send({ embeds: [embed] }).catch(() => {});
              }
            }
          }
        }
      } catch (error) {
        console.error('Voice XP update failed for guild ' + guild.id + ':', error);
      }
    }
  } finally {
    running = false;
  }
}

function start(client) {
  const timer = setInterval(() => awardVoiceXp(client), 60000);
  timer.unref?.();
  return timer;
}

module.exports = { start, awardVoiceXp };
