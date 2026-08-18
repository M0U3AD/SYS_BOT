const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const Member = require('../../database/models/Member');
const { getGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'daily',
  description: 'Claim your daily currency reward',
  usage: '!daily',
  slash: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim daily reward'),
  async execute(message, args) {
    const config = await getGuildConfig(message.guild.id);
    if (!config.economy.enabled) return message.reply({ embeds: [errorEmbed('Disabled', 'Economy is not enabled.')] });
    const member = await Member.getMember(message.guild.id, message.author.id);
    const now = Date.now();
    const oneDay = 86400000;
    if (member.lastDaily && now - member.lastDaily < oneDay) {
      const remaining = Math.ceil((oneDay - (now - member.lastDaily)) / 3600000);
      return message.reply({ embeds: [errorEmbed('Already Claimed', `Claim again in **${remaining}** hour(s).`)] });
    }
    member.balance += config.economy.dailyAmount;
    member.lastDaily = now;
    await member.save();
    message.reply({ embeds: [successEmbed('Daily Claimed', `You received **${config.economy.currencyEmoji} ${config.economy.dailyAmount.toLocaleString()}** ${config.economy.currencyName}!`)] });
  },
  async slashExecute(interaction, client) {
    const config = await getGuildConfig(interaction.guild.id);
    if (!config.economy.enabled) return interaction.reply({ embeds: [errorEmbed('Disabled', 'Economy not enabled.')], ephemeral: true });
    const member = await Member.getMember(interaction.guild.id, interaction.user.id);
    const now = Date.now();
    const oneDay = 86400000;
    if (member.lastDaily && now - member.lastDaily < oneDay) {
      const remaining = Math.ceil((oneDay - (now - member.lastDaily)) / 3600000);
      return interaction.reply({ embeds: [errorEmbed('Already Claimed', `Claim in **${remaining}**h.`)], ephemeral: true });
    }
    member.balance += config.economy.dailyAmount;
    member.lastDaily = now;
    await member.save();
    interaction.reply({ embeds: [successEmbed('Daily Claimed', `**${config.economy.currencyEmoji} ${config.economy.dailyAmount.toLocaleString()}** added!`)] });
  },
};
