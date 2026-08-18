const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, confirmEmbed, modEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');

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
      return message.reply({ embeds: [errorEmbed('Access Denied', 'You need the `Manage Messages` permission.')] });
    }

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply({ embeds: [errorEmbed('Invalid Amount', 'Please provide a number between **1** and **100**.')] });
    }

    const confirm = confirmEmbed(
      emojis.purge,
      'Purge Confirmation',
      [
        '**Channel:** ' + message.channel,
        '**Amount:** ' + amount + ' message(s)',
        '**Moderator:** ' + message.author.tag,
      ].join('\n')
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_purge_' + message.author.id)
        .setLabel('Confirm Purge')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis.purge),
      new ButtonBuilder()
        .setCustomId('mod_cancel_' + message.author.id)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.cross)
    );

    const msg = await message.reply({ embeds: [confirm], components: [row] });

    const collector = msg.createMessageComponentCollector({ time: 30000 });
    collector.on('collect', async (i) => {
      if (i.user.id !== message.author.id) {
        return i.reply({ content: 'This is not for you.', ephemeral: true });
      }

      if (i.customId === 'mod_cancel_' + message.author.id) {
        collector.stop('cancelled');
        return i.update({ embeds: [errorEmbed('Purge Cancelled', 'Action was cancelled by ' + message.author.tag + '.')], components: [] });
      }

      if (i.customId === 'mod_confirm_purge_' + message.author.id) {
        collector.stop('confirmed');
        try {
          const deleted = await message.channel.bulkDelete(amount + 1, true);

          const logEmbed = modEmbed(emojis.purge, 'Messages Purged', [
            { name: emojis.channel + ' Channel', value: message.channel.toString(), inline: true },
            { name: emojis.gavel + ' Moderator', value: message.author.tag, inline: true },
            { name: emojis.chart + ' Deleted', value: (deleted.size - 1) + ' message(s)', inline: true },
          ], { color: COLORS.primary });

          await i.update({ embeds: [logEmbed], components: [] });

          const autoDelete = await message.channel.send({ embeds: [successEmbed('Purged', emojis.check + ' Deleted **' + (deleted.size - 1) + '** messages.')] });
          setTimeout(function() { autoDelete.delete().catch(function() {}); }, 5000);
        } catch (err) {
          await i.update({ embeds: [errorEmbed('Purge Failed', 'An error occurred: ' + err.message)], components: [] });
        }
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'confirmed' || reason === 'cancelled') return;
      try {
        await msg.edit({ embeds: [errorEmbed('Timed Out', 'Confirmation expired. Action was not executed.')], components: [] });
      } catch {}
    });
  },

  async slashExecute(interaction, client) {
    const amount = interaction.options.getInteger('amount');

    const confirm = confirmEmbed(
      emojis.purge,
      'Purge Confirmation',
      [
        '**Channel:** ' + interaction.channel.toString(),
        '**Amount:** ' + amount + ' message(s)',
        '**Moderator:** ' + interaction.user.tag,
      ].join('\n')
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_purge_' + interaction.user.id)
        .setLabel('Confirm Purge')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis.purge),
      new ButtonBuilder()
        .setCustomId('mod_cancel_' + interaction.user.id)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.cross)
    );

    await interaction.reply({ embeds: [confirm], components: [row] });
    const msg = await interaction.fetchReply();

    const collector = msg.createMessageComponentCollector({ time: 30000 });
    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'This is not for you.', ephemeral: true });
      }

      if (i.customId === 'mod_cancel_' + interaction.user.id) {
        collector.stop('cancelled');
        return i.update({ embeds: [errorEmbed('Purge Cancelled', 'Action was cancelled.')], components: [] });
      }

      if (i.customId === 'mod_confirm_purge_' + interaction.user.id) {
        collector.stop('confirmed');
        try {
          const deleted = await interaction.channel.bulkDelete(amount, true);

          const logEmbed = modEmbed(emojis.purge, 'Messages Purged', [
            { name: emojis.channel + ' Channel', value: interaction.channel.toString(), inline: true },
            { name: emojis.gavel + ' Moderator', value: interaction.user.tag, inline: true },
            { name: emojis.chart + ' Deleted', value: deleted.size + ' message(s)', inline: true },
          ], { color: COLORS.primary });

          await i.update({ embeds: [logEmbed], components: [] });
        } catch (err) {
          await i.update({ embeds: [errorEmbed('Purge Failed', err.message)], components: [] });
        }
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'confirmed' || reason === 'cancelled') return;
      try {
        await msg.edit({ embeds: [errorEmbed('Timed Out', 'Confirmation expired. Action was not executed.')], components: [] });
      } catch {}
    });
  },
};
