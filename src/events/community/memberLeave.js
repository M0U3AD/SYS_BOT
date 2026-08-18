const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'guildMemberRemove',
  once: false,
  async execute(member, client) {
    const config = await getGuildConfig(member.guild.id);

    if (!config.goodbye.enabled || !config.goodbye.channelId) return;
    const ch = member.guild.channels.cache.get(config.goodbye.channelId);
    if (!ch) return;

    const msg = config.goodbye.message
      .replace(/{user}/g, member.user.tag)
      .replace(/{server}/g, member.guild.name)
      .replace(/{membercount}/g, member.guild.memberCount);

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setDescription(msg)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    ch.send({ embeds: [embed] });
  },
};
