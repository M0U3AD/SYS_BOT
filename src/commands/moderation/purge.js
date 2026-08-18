const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, confirmEmbed, modEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const { getT } = require('../../i18n');

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
    const t = await getT(message.guild.id);

    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply({ embeds: [errorEmbed(t('MOD_CONFIRM_TITLE', 'Error'), t('MOD_ACCESS_DENIED', '`Manage Messages`'))] });
    }

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply({ embeds: [errorEmbed(t('ERR_INVALID_USAGE'), '`!purge <1-100>`')] });
    }

    const confirm = confirmEmbed(
      emojis.purge,
      t('MOD_CONFIRM_TITLE', 'Purge'),
      t('MOD_PURGE_CONFIRM', message.channel.toString(), '' + amount, message.author.tag)
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_purge_' + message.author.id)
        .setLabel(t('MOD_CONFIRM_BTN', 'Purge'))
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis.purge),
      new ButtonBuilder()
        .setCustomId('mod_cancel_' + message.author.id)
        .setLabel(t('MOD_CANCEL_BTN'))
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
        return i.update({ embeds: [errorEmbed(t('MOD_CANCELLED'), '')], components: [] });
      }

      if (i.customId === 'mod_confirm_purge_' + message.author.id) {
        collector.stop('confirmed');
        try {
          const deleted = await message.channel.bulkDelete(amount + 1, true);

          const logEmbed = modEmbed(emojis.purge, t('MOD_PURGE_TITLE'), [
            { name: emojis.channel + ' Channel', value: message.channel.toString(), inline: true },
            { name: emojis.gavel + ' Moderator', value: message.author.tag, inline: true },
            { name: emojis.chart + ' Deleted', value: (deleted.size - 1) + ' message(s)', inline: true },
          ], { color: COLORS.primary });

          await i.update({ embeds: [logEmbed], components: [] });

          const autoDelete = await message.channel.send({ embeds: [successEmbed(t('MOD_PURGE_TITLE'), emojis.check + ' ' + t('MOD_PURGE_SUCCESS', '' + (deleted.size - 1)))] });
          setTimeout(function() { autoDelete.delete().catch(function() {}); }, 5000);
        } catch (err) {
          await i.update({ embeds: [errorEmbed(t('MOD_PURGE_TITLE', 'Error'), err.message)], components: [] });
        }
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'confirmed' || reason === 'cancelled') return;
      try {
        await msg.edit({ embeds: [errorEmbed(t('MOD_TIMED_OUT'), '')], components: [] });
      } catch {}
    });
  },

  async slashExecute(interaction, client) {
    const t = await getT(interaction.guild.id);

    const amount = interaction.options.getInteger('amount');

    const confirm = confirmEmbed(
      emojis.purge,
      t('MOD_CONFIRM_TITLE', 'Purge'),
      t('MOD_PURGE_CONFIRM', interaction.channel.toString(), '' + amount, interaction.user.tag)
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_purge_' + interaction.user.id)
        .setLabel(t('MOD_CONFIRM_BTN', 'Purge'))
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis.purge),
      new ButtonBuilder()
        .setCustomId('mod_cancel_' + interaction.user.id)
        .setLabel(t('MOD_CANCEL_BTN'))
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
        return i.update({ embeds: [errorEmbed(t('MOD_CANCELLED'), '')], components: [] });
      }

      if (i.customId === 'mod_confirm_purge_' + interaction.user.id) {
        collector.stop('confirmed');
        try {
          const deleted = await interaction.channel.bulkDelete(amount, true);

          const logEmbed = modEmbed(emojis.purge, t('MOD_PURGE_TITLE'), [
            { name: emojis.channel + ' Channel', value: interaction.channel.toString(), inline: true },
            { name: emojis.gavel + ' Moderator', value: interaction.user.tag, inline: true },
            { name: emojis.chart + ' Deleted', value: deleted.size + ' message(s)', inline: true },
          ], { color: COLORS.primary });

          await i.update({ embeds: [logEmbed], components: [] });
        } catch (err) {
          await i.update({ embeds: [errorEmbed(t('MOD_PURGE_TITLE', 'Error'), err.message)], components: [] });
        }
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'confirmed' || reason === 'cancelled') return;
      try {
        await msg.edit({ embeds: [errorEmbed(t('MOD_TIMED_OUT'), '')], components: [] });
      } catch {}
    });
  },
};
