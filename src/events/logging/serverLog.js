const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/utils/GuildConfig');
const Log = require('../../database/models/Log');

module.exports = {
  name: 'guildUpdate',
  once: false,
  async execute(oldGuild, newGuild, client) {
    const config = await getGuildConfig(newGuild.id);
    const chId = config.logging.serverLogChannelId;
    if (!chId) return;
    const ch = newGuild.channels.cache.get(chId);
    if (!ch) return;

    const changes = [];
    if (oldGuild.name !== newGuild.name) changes.push(`**Name:** \`${oldGuild.name}\` → \`${newGuild.name}\``);
    if (oldGuild.iconURL() !== newGuild.iconURL()) changes.push('**Icon** updated');
    if (oldGuild.ownerId !== newGuild.ownerId) changes.push(`**Owner** changed`);
    if (oldGuild.verificationLevel !== newGuild.verificationLevel) changes.push(`**Verification Level** changed`);
    if (oldGuild.systemChannelId !== newGuild.systemChannelId) changes.push('**System Channel** changed');

    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('Server Updated')
      .setDescription(changes.join('\n'))
      .setTimestamp();

    ch.send({ embeds: [embed] });
    await Log.addLog(newGuild.id, 'server', 'update', '', '', changes.join('; '));
  },
};
