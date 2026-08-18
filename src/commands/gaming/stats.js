const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const Leaderboard = require('../../database/models/Leaderboard');

module.exports = {
  name: 'stats',
  description: 'Set or view game stats',
  usage: '!stats set <game> <score> | !stats view <game> [@user] | !stats addwin <game> | !stats addloss <game>',
  slash: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Game stats')
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Set your score')
      .addStringOption(opt => opt.setName('game').setDescription('Game name').setRequired(true))
      .addIntegerOption(opt => opt.setName('score').setDescription('Score').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('View stats')
      .addStringOption(opt => opt.setName('game').setDescription('Game').setRequired(true))
      .addUserOption(opt => opt.setName('user').setDescription('User')))
    .addSubcommand(sub => sub
      .setName('addwin')
      .setDescription('Add a win')
      .addStringOption(opt => opt.setName('game').setDescription('Game').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('addloss')
      .setDescription('Add a loss')
      .addStringOption(opt => opt.setName('game').setDescription('Game').setRequired(true))),
  async execute(message, args) {
    if (args[0] === 'set') {
      const game = args[1];
      const score = parseInt(args[2]);
      if (!game || isNaN(score)) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!stats set <game> <score>`')] });
      await Leaderboard.findOneAndUpdate(
        { guildId: message.guild.id, userId: message.author.id, game },
        { score },
        { upsert: true }
      );
      return message.reply({ embeds: [successEmbed('Stats Updated', `**${game}**: ${score}`)] });
    }

    if (args[0] === 'addwin') {
      const game = args[1];
      if (!game) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!stats addwin <game>`')] });
      const doc = await Leaderboard.findOneAndUpdate(
        { guildId: message.guild.id, userId: message.author.id, game },
        { $inc: { wins: 1, score: 1 } },
        { upsert: true, new: true }
      );
      return message.reply({ embeds: [successEmbed('Win Added', `**${game}**: ${doc.wins}W/${doc.losses}L`)] });
    }

    if (args[0] === 'addloss') {
      const game = args[1];
      if (!game) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!stats addloss <game>`')] });
      const doc = await Leaderboard.findOneAndUpdate(
        { guildId: message.guild.id, userId: message.author.id, game },
        { $inc: { losses: 1 } },
        { upsert: true, new: true }
      );
      return message.reply({ embeds: [successEmbed('Loss Added', `**${game}**: ${doc.wins}W/${doc.losses}L`)] });
    }

    if (args[0] === 'view') {
      const game = args[1];
      if (!game) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!stats view <game>`')] });
      const target = message.mentions.members.first() || message.member;
      const doc = await Leaderboard.findOne({ guildId: message.guild.id, userId: target.id, game });
      if (!doc) return message.reply({ embeds: [infoEmbed('No Stats', `No stats for **${game}**.`)] });
      return message.reply({ embeds: [infoEmbed(`${target.user.tag} — ${game}`,
        `**Score:** ${doc.score}\n**Wins:** ${doc.wins}\n**Losses:** ${doc.losses}`
      )] });
    }

    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!stats set|view|addwin|addloss`')] });
  },
  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const game = interaction.options.getString('game');

    if (sub === 'set') {
      const score = interaction.options.getInteger('score');
      await Leaderboard.findOneAndUpdate(
        { guildId: interaction.guild.id, userId: interaction.user.id, game },
        { score },
        { upsert: true }
      );
      return interaction.reply({ embeds: [successEmbed('Updated', `**${game}**: ${score}`)] });
    }

    if (sub === 'addwin') {
      const doc = await Leaderboard.findOneAndUpdate(
        { guildId: interaction.guild.id, userId: interaction.user.id, game },
        { $inc: { wins: 1, score: 1 } },
        { upsert: true, new: true }
      );
      return interaction.reply({ embeds: [successEmbed('Win Added', `**${game}**: ${doc.wins}W/${doc.losses}L`)] });
    }

    if (sub === 'addloss') {
      const doc = await Leaderboard.findOneAndUpdate(
        { guildId: interaction.guild.id, userId: interaction.user.id, game },
        { $inc: { losses: 1 } },
        { upsert: true, new: true }
      );
      return interaction.reply({ embeds: [successEmbed('Loss Added', `**${game}**: ${doc.wins}W/${doc.losses}L`)] });
    }

    if (sub === 'view') {
      const user = interaction.options.getUser('user') || interaction.user;
      const doc = await Leaderboard.findOne({ guildId: interaction.guild.id, userId: user.id, game });
      if (!doc) return interaction.reply({ embeds: [infoEmbed('No Stats', 'None found.')], ephemeral: true });
      return interaction.reply({ embeds: [infoEmbed(`${user.tag} — ${game}`, `Score: ${doc.score} | W: ${doc.wins} | L: ${doc.losses}`)] });
    }
  },
};
