const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/utils/GuildConfig');
const Log = require('../../database/models/Log');

module.exports = {
  name: 'guildMemberRemove',
  once: false,
  async execute(member, client) {
    const config = await getGuildConfig(member.guild.id);
    const chId = config.logging.memberLogChannelId;
    if (!chId) return;
    const ch = member.guild.channels.cache.get(chId);
    if (!ch) return;

    const roles = member.roles.cache
      .filter(r => r.id !== member.guild.id)
      .map(r => r.name)
      .join(', ') || 'None';

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Member Left')
      .setDescription(`**${member.user.tag}** left the server.`)
      .addFields(
        { name: 'Roles', value: roles, inline: false },
        { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true }
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    ch.send({ embeds: [embed] });
    await Log.addLog(member.guild.id, 'member', 'leave', member.id, '', `Left (${member.guild.memberCount} members)`);
  },
};
