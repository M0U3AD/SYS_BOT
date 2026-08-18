const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, infoEmbed } = require('../../utils/embeds');
const Member = require('../../database/models/Member');
const { getGuildConfig } = require('../../database/utils/GuildConfig');
const { xpForLevel } = require('../../utils/xp');

module.exports = {
  name: 'rank',
  description: 'View your rank card or another user\'s',
  usage: '!rank [@user]',
  slash: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('View your rank card')
    .addUserOption(opt => opt.setName('user').setDescription('User to check')),
  async execute(message, args) {
    const config = await getGuildConfig(message.guild.id);
    const target = message.mentions.members.first() || message.member;
    const member = await Member.getMember(message.guild.id, target.id);

    const nextLevelXp = xpForLevel(member.level + 1);
    const currentLevelXp = xpForLevel(member.level);
    const progress = nextLevelXp > currentLevelXp
      ? ((member.xp - currentLevelXp) / (nextLevelXp - currentLevelXp) * 100).toFixed(1)
      : 100;

    const embed = infoEmbed(
      `Rank — ${target.user.tag}`,
      `**Level:** ${member.level}\n**XP:** ${member.xp.toLocaleString()}\n**Progress:** ${progress}% to next level\n**Messages:** ${member.totalMessages.toLocaleString()}`
    ).setThumbnail(target.user.displayAvatarURL({ dynamic: true }));

    message.reply({ embeds: [embed] });
  },
  async slashExecute(interaction, client) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = await Member.getMember(interaction.guild.id, user.id);
    const nextLevelXp = xpForLevel(member.level + 1);
    const currentLevelXp = xpForLevel(member.level);
    const progress = nextLevelXp > currentLevelXp
      ? ((member.xp - currentLevelXp) / (nextLevelXp - currentLevelXp) * 100).toFixed(1)
      : 100;

    const embed = infoEmbed(
      `Rank — ${user.tag}`,
      `**Level:** ${member.level}\n**XP:** ${member.xp.toLocaleString()}\n**Progress:** ${progress}% to next level\n**Messages:** ${member.totalMessages.toLocaleString()}`
    ).setThumbnail(user.displayAvatarURL({ dynamic: true }));

    interaction.reply({ embeds: [embed] });
  },
};
