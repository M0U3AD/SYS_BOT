const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/utils/GuildConfig');
const Log = require('../../database/models/Log');

module.exports = {
  name: 'guildMemberUpdate',
  once: false,
  async execute(oldMember, newMember, client) {
    const config = await getGuildConfig(newMember.guild.id);
    const chId = config.logging.modLogChannelId;
    if (!chId) return;
    const ch = newMember.guild.channels.cache.get(chId);
    if (!ch) return;

    const changes = [];

    // Role changes
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
    if (addedRoles.size > 0) {
      changes.push(`**Roles Added:** ${addedRoles.map(r => r.name).join(', ')}`);
    }
    if (removedRoles.size > 0) {
      changes.push(`**Roles Removed:** ${removedRoles.map(r => r.name).join(', ')}`);
    }

    // Timeout changes
    const wasTimedOut = oldMember.isCommunicationDisabledUntil();
    const isTimedOut = newMember.isCommunicationDisabledUntil();
    if (!wasTimedOut && isTimedOut) {
      changes.push(`**Timed out** until <t:${Math.floor(isTimedOut.getTime() / 1000)}:R>`);
    }
    if (wasTimedOut && !isTimedOut) {
      changes.push('**Timeout removed**');
    }

    // Nickname changes
    if (oldMember.nickname !== newMember.nickname) {
      changes.push(`**Nickname:** \`${oldMember.nickname || 'None'}\` → \`${newMember.nickname || 'None'}\``);
    }

    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
      .setColor('#FEE75C')
      .setTitle('Member Updated')
      .setDescription(`**${newMember.user.tag}**\n\n${changes.join('\n')}`)
      .setTimestamp();

    ch.send({ embeds: [embed] });
    await Log.addLog(newMember.guild.id, 'mod', 'member_update', '', newMember.id, changes.join('; '));
  },
};
