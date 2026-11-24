const { SlashCommandBuilder } = require('discord.js');
const { infoEmbed } = require('../../utils/embeds');
const Member = require('../../database/models/Member');

const medals = ['🥇', '🥈', '🥉'];

async function getLeaderboard(guildId, voice) {
  const query = voice ? { guildId, voiceXp: { $gt: 0 } } : { guildId };
  const sort = voice ? { voiceLevel: -1, voiceXp: -1 } : { level: -1, xp: -1 };
  return Member.find(query).sort(sort).limit(15);
}

function formatLeaderboard(members, voice) {
  return members.map((member, index) => {
    const rank = medals[index] || `**${index + 1}.**`;
    const level = voice ? member.voiceLevel || 0 : member.level;
    const xp = voice ? member.voiceXp || 0 : member.xp;
    return `${rank} <@${member.userId}> — ${voice ? 'Voice level' : 'Level'} **${level}** (${xp.toLocaleString()} XP)`;
  }).join('\n');
}

module.exports = {
  name: 'levels',
  description: 'View the server level leaderboard',
  usage: '!levels [voice]',
  slash: new SlashCommandBuilder()
    .setName('levels')
    .setDescription('View level leaderboard')
    .addStringOption(opt => opt
      .setName('type')
      .setDescription('Choose the leaderboard')
      .addChoices(
        { name: 'Overall', value: 'overall' },
        { name: 'Voice', value: 'voice' }
      )),
  async execute(message, args) {
    const voice = args[0]?.toLowerCase() === 'voice';
    const top = await getLeaderboard(message.guild.id, voice);
    if (top.length === 0) return message.reply({ embeds: [infoEmbed('Leaderboard', 'No level data yet.')] });

    return message.reply({ embeds: [infoEmbed(voice ? 'Voice Level Leaderboard' : 'Level Leaderboard', formatLeaderboard(top, voice))] });
  },
  async slashExecute(interaction) {
    const voice = interaction.options.getString('type') === 'voice';
    const top = await getLeaderboard(interaction.guild.id, voice);
    if (top.length === 0) return interaction.reply({ embeds: [infoEmbed('Leaderboard', 'No data.')], ephemeral: true });

    return interaction.reply({ embeds: [infoEmbed(voice ? 'Voice Level Leaderboard' : 'Level Leaderboard', formatLeaderboard(top, voice))] });
  },
};
