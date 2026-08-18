const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  name: 'purge',
  description: 'Bulk delete messages from a channel',
  usage: '!purge <amount>',
  slash: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages')
    .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(message, args) {
    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Manage Messages permission.')] });
    }
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply({ embeds: [errorEmbed('Invalid Amount', 'Please provide a number between 1 and 100.')] });
    }
    const deleted = await message.channel.bulkDelete(amount + 1, true);
    const reply = await message.channel.send({ embeds: [successEmbed('Messages Purged', `Deleted **${deleted.size - 1}** messages.`)] });
    setTimeout(() => reply.delete().catch(() => {}), 3000);
  },
  async slashExecute(interaction, client) {
    const amount = interaction.options.getInteger('amount');
    await interaction.deferReply({ ephemeral: true });
    const deleted = await interaction.channel.bulkDelete(amount, true);
    interaction.editReply({ embeds: [successEmbed('Messages Purged', `Deleted **${deleted.size}** messages.`)] });
  },
};
