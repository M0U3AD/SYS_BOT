const { SlashCommandBuilder } = require('discord.js');
const { infoEmbed } = require('../../utils/embeds');
const Member = require('../../database/models/Member');

module.exports = {
  name: 'levels',
  description: 'View the server level leaderboard',
  usage: '!levels',
  slash: new SlashCommandBuilder()
    .setName('levels')
    .setDescription('View level leaderboard'),
  async execute(message, args) {
    const top = await Member.find({ guildId: message.guild.id }).sort({ level: -1, xp: -1 }).limit(15);
    if (top.length === 0) return message.reply({ embeds: [infoEmbed('Leaderboard', 'No level data yet.')] });

    const list = top.map((m, i) => {
      const medals = ['🥇', '🥈', '🥉'];
      const prefix = medals[i] || `**${i + 1}.**`;
      return `${prefix} <@${m.userId}> — Level **${m.level}** (${m.xp.toLocaleString()} XP)`;
    }).join('\n');

    message.reply({ embeds: [infoEmbed('Level Leaderboard', list)] });
  },
  async slashExecute(interaction, client) {
    const top = await Member.find({ guildId: interaction.guild.id }).sort({ level: -1, xp: -1 }).limit(15);
    if (top.length === 0) return interaction.reply({ embeds: [infoEmbed('Leaderboard', 'No data.')], ephemeral: true });
    const medals = ['🥇', '🥈', '🥉'];
    const list = top.map((m, i) => {
      const prefix = medals[i] || `**${i + 1}.**`;
      return `${prefix} <@${m.userId}> — Level **${m.level}** (${m.xp.toLocaleString()} XP)`;
    }).join('\n');
    interaction.reply({ embeds: [infoEmbed('Level Leaderboard', list)] });
  },
};
