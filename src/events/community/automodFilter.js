const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/utils/GuildConfig');

const spamTracker = new Map();

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    const config = await getGuildConfig(message.guild.id);
    const a = config.moderation.automod;
    if (!a.enabled) return;

    const logChannel = a.logChannelId ? message.guild.channels.cache.get(a.logChannelId) : null;

    // Anti-Spam: 5+ messages in 5 seconds
    if (a.antiSpam) {
      const userId = message.author.id;
      const now = Date.now();
      if (!spamTracker.has(userId)) spamTracker.set(userId, []);
      const timestamps = spamTracker.get(userId).filter(t => now - t < 5000);
      timestamps.push(now);
      spamTracker.set(userId, timestamps);

      if (timestamps.length >= 5) {
        spamTracker.set(userId, []);
        try { await message.delete(); } catch {}
        try { await message.member.timeout(60000, 'AutoMod: Spam detected'); } catch {}
        if (logChannel) {
          logChannel.send({ embeds: [new EmbedBuilder().setColor('#ED4245').setTitle('AutoMod: Spam').setDescription(`**${message.author.tag}** was muted for spamming in <#${message.channel.id}>`).setTimestamp()] });
        }
        return;
      }
    }

    // Anti-Link
    if (a.antiLink) {
      const urlRegex = /https?:\/\/[^\s]+/gi;
      if (urlRegex.test(message.content)) {
        const trustedDomains = ['discord.gg', 'youtube.com', 'youtu.be', 'github.com'];
        const urls = message.content.match(urlRegex) || [];
        const hasUntrusted = urls.some(u => !trustedDomains.some(d => u.includes(d)));
        if (hasUntrusted) {
          try { await message.delete(); } catch {}
          const reply = await message.channel.send({ embeds: [new EmbedBuilder().setColor('#FEE75C').setDescription(`**${message.author.tag}**, links are not allowed here.`).setTimestamp()] });
          setTimeout(() => reply.delete().catch(() => {}), 5000);
          if (logChannel) {
            logChannel.send({ embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle('AutoMod: Link Removed').setDescription(`**${message.author.tag}** posted a link in <#${message.channel.id}>`).setTimestamp()] });
          }
          return;
        }
      }
    }

    // Anti-Invite
    if (a.antiInvite) {
      if (/discord\.gg\/|discordapp\.com\/invite\//i.test(message.content)) {
        try { await message.delete(); } catch {}
        const reply = await message.channel.send({ embeds: [new EmbedBuilder().setColor('#FEE75C').setDescription(`**${message.author.tag}**, invite links are not allowed.`).setTimestamp()] });
        setTimeout(() => reply.delete().catch(() => {}), 5000);
        if (logChannel) {
          logChannel.send({ embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle('AutoMod: Invite Removed').setDescription(`**${message.author.tag}** posted an invite in <#${message.channel.id}>`).setTimestamp()] });
        }
        return;
      }
    }

    // Bad Words
    if (a.badWords && a.badWords.length > 0) {
      const lower = message.content.toLowerCase();
      const found = a.badWords.find(w => lower.includes(w));
      if (found) {
        try { await message.delete(); } catch {}
        const reply = await message.channel.send({ embeds: [new EmbedBuilder().setColor('#FEE75C').setDescription(`**${message.author.tag}**, that word is not allowed.`).setTimestamp()] });
        setTimeout(() => reply.delete().catch(() => {}), 5000);
        if (logChannel) {
          logChannel.send({ embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle('AutoMod: Bad Word').setDescription(`**${message.author.tag}** used a blocked word in <#${message.channel.id}>`).setTimestamp()] });
        }
        return;
      }
    }

    // Mass Mention
    if (a.maxMentions && message.mentions.users.size >= a.maxMentions) {
      try { await message.delete(); } catch {}
      try { await message.member.timeout(300000, `AutoMod: Mass mention (${message.mentions.users.size} users)`); } catch {}
      if (logChannel) {
        logChannel.send({ embeds: [new EmbedBuilder().setColor('#ED4245').setTitle('AutoMod: Mass Mention').setDescription(`**${message.author.tag}** mentioned ${message.mentions.users.size} users in <#${message.channel.id}> and was muted.`).setTimestamp()] });
      }
    }
  },
};
