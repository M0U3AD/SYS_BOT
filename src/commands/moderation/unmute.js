const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, modEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const Log = require('../../database/models/Log');

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
    if (!message.member.permissions.has('ModerateMembers')) {
      return message.reply({ embeds: [errorEmbed('Access Denied', 'You need the `Moderate Members` permission.')] });
    }

    const member = message.mentions.members.first();
    if (!member) {
      return message.reply({ embeds: [errorEmbed('Invalid Target', '`!unmute <@user>`')] });
    }

    if (!member.isCommunicationDisabled()) {
      return message.reply({ embeds: [errorEmbed('Not Muted', 'This user is not currently muted.')] });
    }

    const confirm = confirmEmbed(
      emojis.unmute,
      'Unmute Confirmation',
      [
        '**Target:** ' + member.user.tag + ' (`' + member.id + '`)',
        '**Moderator:** ' + message.author.tag,
      ].join('\n'),
      { thumbnail: member.user.displayAvatarURL({ dynamic: true }) }
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_unmute_' + message.author.id)
        .setLabel('Confirm Unmute')
        .setStyle(ButtonStyle.Success)
        .setEmoji(emojis.unmute),
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
        return i.update({ embeds: [errorEmbed('Unmute Cancelled', 'Action was cancelled by ' + message.author.tag + '.')], components: [] });
      }

      if (i.customId === 'mod_confirm_unmute_' + message.author.id) {
        collector.stop('confirmed');
        try {
          await member.timeout(null);

          const logEmbed = modEmbed(emojis.unmute, 'Member Unmuted', [
            { name: emojis.user + ' Target', value: member.user.tag + ' (`' + member.id + '`)', inline: true },
            { name: emojis.gavel + ' Moderator', value: message.author.tag, inline: true },
          ], { color: COLORS.success, thumbnail: member.user.displayAvatarURL({ dynamic: true }) });

          await i.update({ embeds: [logEmbed], components: [] });
          await Log.addLog(message.guild.id, 'mod', 'unmute', message.author.id, member.id, '');
        } catch (err) {
          await i.update({ embeds: [errorEmbed('Unmute Failed', 'An error occurred: ' + err.message)], components: [] });
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
    const user = interaction.options.getUser('user');
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({ embeds: [errorEmbed('Not Found', 'User is not in this server.')], ephemeral: true });
    }
    if (!member.isCommunicationDisabled()) {
      return interaction.reply({ embeds: [errorEmbed('Not Muted', 'This user is not currently muted.')], ephemeral: true });
    }

    const confirm = confirmEmbed(
      emojis.unmute,
      'Unmute Confirmation',
      [
        '**Target:** ' + user.tag + ' (`' + user.id + '`)',
        '**Moderator:** ' + interaction.user.tag,
      ].join('\n'),
      { thumbnail: user.displayAvatarURL({ dynamic: true }) }
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_unmute_' + interaction.user.id)
        .setLabel('Confirm Unmute')
        .setStyle(ButtonStyle.Success)
        .setEmoji(emojis.unmute),
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
        return i.update({ embeds: [errorEmbed('Unmute Cancelled', 'Action was cancelled.')], components: [] });
      }

      if (i.customId === 'mod_confirm_unmute_' + interaction.user.id) {
        collector.stop('confirmed');
        try {
          await member.timeout(null);

          const logEmbed = modEmbed(emojis.unmute, 'Member Unmuted', [
            { name: emojis.user + ' Target', value: user.tag + ' (`' + user.id + '`)', inline: true },
            { name: emojis.gavel + ' Moderator', value: interaction.user.tag, inline: true },
          ], { color: COLORS.success, thumbnail: user.displayAvatarURL({ dynamic: true }) });

          await i.update({ embeds: [logEmbed], components: [] });
          await Log.addLog(interaction.guild.id, 'mod', 'unmute', interaction.user.id, user.id, '');
        } catch (err) {
          await i.update({ embeds: [errorEmbed('Unmute Failed', err.message)], components: [] });
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
