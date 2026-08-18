const { SlashCommandBuilder } = require('discord.js');
const { infoEmbed, errorEmbed } = require('../../utils/embeds');
const Leaderboard = require('../../database/models/Leaderboard');

module.exports = {
  name: 'leaderboard',
  description: 'View the game leaderboard',
  usage: '!leaderboard <game>',
  slash: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Game leaderboard')
    .addStringOption(opt => opt.setName('game').setDescription('Game name').setRequired(true)),
  async execute(message, args) {
    const game = args[0];
    if (!game) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!leaderboard <game>`')] });

    const top = await Leaderboard.find({ guildId: message.guild.id, game }).sort({ score: -1 }).limit(15);
    if (top.length === 0) return message.reply({ embeds: [infoEmbed('Leaderboard', `No data for **${game}**.`)] });

    const medals = ['🥇', '🥈', '🥉'];
    const list = top.map((entry, i) => {
      const prefix = medals[i] || `**${i + 1}.**`;
      return `${prefix} <@${entry.userId}> — **${entry.score}** pts (${entry.wins}W/${entry.losses}L)`;
    }).join('\n');

    message.reply({ embeds: [infoEmbed(`Leaderboard — ${game}`, list)] });
  },
  async slashExecute(interaction, client) {
    const game = interaction.options.getString('game');
    const top = await Leaderboard.find({ guildId: interaction.guild.id, game }).sort({ score: -1 }).limit(15);
    if (top.length === 0) return interaction.reply({ embeds: [infoEmbed('Leaderboard', `No data for **${game}**.`)], ephemeral: true });

    const medals = ['🥇', '🥈', '🥉'];
    const list = top.map((entry, i) => {
      const prefix = medals[i] || `**${i + 1}.**`;
      return `${prefix} <@${entry.userId}> — **${entry.score}** pts (${entry.wins}W/${entry.losses}L)`;
    }).join('\n');

    interaction.reply({ embeds: [infoEmbed(`Leaderboard — ${game}`, list)] });
  },
};
