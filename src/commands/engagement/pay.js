const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const Member = require('../../database/models/Member');
const { getGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'pay',
  description: 'Pay another user',
  usage: '!pay <@user> <amount>',
  slash: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Pay a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to pay').setRequired(true))
    .addIntegerOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)),
  async execute(message, args) {
    const config = await getGuildConfig(message.guild.id);
    if (!config.economy.enabled) return message.reply({ embeds: [errorEmbed('Disabled', 'Economy is not enabled.')] });
    const target = message.mentions.members.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount) || amount <= 0) {
      return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!pay <@user> <amount>`')] });
    }
    if (target.id === message.author.id) return message.reply({ embeds: [errorEmbed('Invalid', 'You cannot pay yourself.')] });

    const sender = await Member.getMember(message.guild.id, message.author.id);
    const receiver = await Member.getMember(message.guild.id, target.id);
    if (sender.balance < amount) return message.reply({ embeds: [errorEmbed('Insufficient Funds', `You need **${config.economy.currencyEmoji} ${amount.toLocaleString()}** but only have **${sender.balance.toLocaleString()}**.`)] });

    sender.balance -= amount;
    receiver.balance += amount;
    await sender.save();
    await receiver.save();
    message.reply({ embeds: [successEmbed('Payment Sent', `**${config.economy.currencyEmoji} ${amount.toLocaleString()}** paid to **${target.user.tag}**.`)] });
  },
  async slashExecute(interaction, client) {
    const config = await getGuildConfig(interaction.guild.id);
    if (!config.economy.enabled) return interaction.reply({ embeds: [errorEmbed('Disabled', 'Economy not enabled.')], ephemeral: true });
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    if (user.id === interaction.user.id) return interaction.reply({ embeds: [errorEmbed('Invalid', 'Cannot pay yourself.')], ephemeral: true });
    const sender = await Member.getMember(interaction.guild.id, interaction.user.id);
    const receiver = await Member.getMember(interaction.guild.id, user.id);
    if (sender.balance < amount) return interaction.reply({ embeds: [errorEmbed('Insufficient Funds', `Need ${amount.toLocaleString()}, have ${sender.balance.toLocaleString()}.`)], ephemeral: true });
    sender.balance -= amount;
    receiver.balance += amount;
    await sender.save();
    await receiver.save();
    interaction.reply({ embeds: [successEmbed('Paid', `**${config.economy.currencyEmoji} ${amount.toLocaleString()}** sent to **${user.tag}**.`)] });
  },
};
