const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, modEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const Log = require('../../database/models/Log');
const { getT } = require('../../i18n');

module.exports = {
  name: 'unmute',
  description: 'Remove timeout from a member',
  usage: '!unmute <@user>',
  slash: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove timeout from a member')
    .addUserOption(opt => opt.setName('user').setDescription('User to unmute').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(message, args) {
    const t = await getT(message.guild.id);

    if (!message.member.permissions.has('ModerateMembers')) {
      return message.reply({ embeds: [errorEmbed(t('MOD_CONFIRM_TITLE', 'Error'), t('MOD_ACCESS_DENIED', '`Moderate Members`'))] });
    }

    const member = message.mentions.members.first();
    if (!member) {
      return message.reply({ embeds: [errorEmbed(t('ERR_INVALID_USAGE'), '`!unmute <@user>`')] });
    }

    if (!member.isCommunicationDisabled()) {
      return message.reply({ embeds: [errorEmbed(t('MOD_UNMUTE_NOT_MUTED'), '')] });
    }

    const targetStr = member.user.tag + ' (`' + member.id + '`)';

    const confirm = confirmEmbed(
      emojis.unmute,
      t('MOD_CONFIRM_TITLE', 'Unmute'),
      t('MOD_UNMUTE_CONFIRM', targetStr, message.author.tag),
      { thumbnail: member.user.displayAvatarURL({ dynamic: true }) }
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_unmute_' + message.author.id)
        .setLabel(t('MOD_CONFIRM_BTN', 'Unmute'))
        .setStyle(ButtonStyle.Success)
        .setEmoji(emojis.unmute),
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

      if (i.customId === 'mod_confirm_unmute_' + message.author.id) {
        collector.stop('confirmed');
        try {
          await member.timeout(null);

          const logEmbed = modEmbed(emojis.unmute, t('MOD_UNMUTE_TITLE'), [
            { name: emojis.user + ' Target', value: targetStr, inline: true },
            { name: emojis.gavel + ' Moderator', value: message.author.tag, inline: true },
          ], { color: COLORS.success, thumbnail: member.user.displayAvatarURL({ dynamic: true }) });

          await i.update({ embeds: [logEmbed], components: [] });
          await Log.addLog(message.guild.id, 'mod', 'unmute', message.author.id, member.id, '');
        } catch (err) {
          await i.update({ embeds: [errorEmbed(t('MOD_UNMUTE_TITLE', 'Error'), err.message)], components: [] });
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

    const user = interaction.options.getUser('user');
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({ embeds: [errorEmbed(t('MOD_UNMUTE_TITLE', 'Error'), t('MOD_UNMUTE_NOT_FOUND'))], ephemeral: true });
    }
    if (!member.isCommunicationDisabled()) {
      return interaction.reply({ embeds: [errorEmbed(t('MOD_UNMUTE_NOT_MUTED'), '')], ephemeral: true });
    }

    const targetStr = user.tag + ' (`' + user.id + '`)';

    const confirm = confirmEmbed(
      emojis.unmute,
      t('MOD_CONFIRM_TITLE', 'Unmute'),
      t('MOD_UNMUTE_CONFIRM', targetStr, interaction.user.tag),
      { thumbnail: user.displayAvatarURL({ dynamic: true }) }
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_unmute_' + interaction.user.id)
        .setLabel(t('MOD_CONFIRM_BTN', 'Unmute'))
        .setStyle(ButtonStyle.Success)
        .setEmoji(emojis.unmute),
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

      if (i.customId === 'mod_confirm_unmute_' + interaction.user.id) {
        collector.stop('confirmed');
        try {
          await member.timeout(null);

          const logEmbed = modEmbed(emojis.unmute, t('MOD_UNMUTE_TITLE'), [
            { name: emojis.user + ' Target', value: targetStr, inline: true },
            { name: emojis.gavel + ' Moderator', value: interaction.user.tag, inline: true },
          ], { color: COLORS.success, thumbnail: user.displayAvatarURL({ dynamic: true }) });

          await i.update({ embeds: [logEmbed], components: [] });
          await Log.addLog(interaction.guild.id, 'mod', 'unmute', interaction.user.id, user.id, '');
        } catch (err) {
          await i.update({ embeds: [errorEmbed(t('MOD_UNMUTE_TITLE', 'Error'), err.message)], components: [] });
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
