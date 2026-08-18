const { SlashCommandBuilder } = require('discord.js');
const { infoEmbed, errorEmbed } = require('../../utils/embeds');
const Member = require('../../database/models/Member');
const { getGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'balance',
  description: 'Check your balance or another user\'s',
  usage: '!balance [@user]',
  slash: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check balance')
    .addUserOption(opt => opt.setName('user').setDescription('User to check')),
  async execute(message, args) {
    const config = await getGuildConfig(message.guild.id);
    if (!config.economy.enabled) return message.reply({ embeds: [errorEmbed('Disabled', 'Economy is not enabled.')] });
    const target = message.mentions.members.first() || message.member;
    const member = await Member.getMember(message.guild.id, target.id);
    const emoji = config.economy.currencyEmoji;
    message.reply({ embeds: [infoEmbed(`${target.user.tag}'s Balance`,
      `**Wallet:** ${emoji} ${member.balance.toLocaleString()}\n**Bank:** ${emoji} ${member.bank.toLocaleString()}\n**Total:** ${emoji} ${(member.balance + member.bank).toLocaleString()}`
    )] });
  },
  async slashExecute(interaction, client) {
    const config = await getGuildConfig(interaction.guild.id);
    if (!config.economy.enabled) return interaction.reply({ embeds: [errorEmbed('Disabled', 'Economy not enabled.')], ephemeral: true });
    const user = interaction.options.getUser('user') || interaction.user;
    const member = await Member.getMember(interaction.guild.id, user.id);
    const emoji = config.economy.currencyEmoji;
    interaction.reply({ embeds: [infoEmbed(`${user.tag}'s Balance`,
      `**Wallet:** ${emoji} ${member.balance.toLocaleString()}\n**Bank:** ${emoji} ${member.bank.toLocaleString()}\n**Total:** ${emoji} ${(member.balance + member.bank).toLocaleString()}`
    )] });
  },
};
