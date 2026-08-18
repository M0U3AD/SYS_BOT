const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, confirmEmbed, modEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const Log = require('../../database/models/Log');
const { getGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'kick',
  description: 'Kick a member from the server',
  usage: '!kick <@user> [reason]',
  slash: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption(opt => opt.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for kick'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(message, args) {
    if (!message.member.permissions.has('KickMembers')) {
      return message.reply({ embeds: [errorEmbed('Access Denied', 'You need the `Kick Members` permission.')] });
    }

    const member = message.mentions.members.first();
    if (!member) {
      return message.reply({ embeds: [errorEmbed('Invalid Target', 'Please mention a user to kick.\n`!kick <@user> [reason]`')] });
    }

    if (!member.kickable) {
      return message.reply({ embeds: [errorEmbed('Cannot Kick', 'I cannot kick this user. Their role may be higher than mine.')] });
    }

    if (member.id === message.author.id) {
      return message.reply({ embeds: [errorEmbed('Self-Action', 'You cannot kick yourself.')] });
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    const confirm = confirmEmbed(
      emojis.kick,
      'Kick Confirmation',
      [
        '**Target:** ' + member.user.tag + ' (`' + member.id + '`)',
        '**Reason:** ' + reason,
        '**Moderator:** ' + message.author.tag,
      ].join('\n'),
      { thumbnail: member.user.displayAvatarURL({ dynamic: true }) }
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_kick_' + message.author.id)
        .setLabel('Confirm Kick')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis.kick),
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
        return i.update({ embeds: [errorEmbed('Kick Cancelled', 'Action was cancelled by ' + message.author.tag + '.')], components: [] });
      }

      if (i.customId === 'mod_confirm_kick_' + message.author.id) {
        collector.stop('confirmed');
        try {
          await member.kick(reason);

          const logEmbed = modEmbed(emojis.kick, 'Member Kicked', [
            { name: emojis.user + ' Target', value: member.user.tag + ' (`' + member.id + '`)', inline: true },
            { name: emojis.gavel + ' Moderator', value: message.author.tag, inline: true },
            { name: emojis.tag + ' Reason', value: reason, inline: false },
          ], { color: COLORS.error, thumbnail: member.user.displayAvatarURL({ dynamic: true }) });

          await i.update({ embeds: [logEmbed], components: [] });

          const config = await getGuildConfig(message.guild.id);
          if (config.logging.modLogChannelId) {
            const ch = message.guild.channels.cache.get(config.logging.modLogChannelId);
            if (ch) ch.send({ embeds: [logEmbed] });
          }
          await Log.addLog(message.guild.id, 'mod', 'kick', message.author.id, member.id, reason);
        } catch (err) {
          await i.update({ embeds: [errorEmbed('Kick Failed', 'An error occurred: ' + err.message)], components: [] });
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
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({ embeds: [errorEmbed('Not Found', 'User is not in this server.')], ephemeral: true });
    }
    if (!member.kickable) {
      return interaction.reply({ embeds: [errorEmbed('Cannot Kick', 'I cannot kick this user.')], ephemeral: true });
    }
    if (member.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Self-Action', 'You cannot kick yourself.')], ephemeral: true });
    }

    const confirm = confirmEmbed(
      emojis.kick,
      'Kick Confirmation',
      [
        '**Target:** ' + user.tag + ' (`' + user.id + '`)',
        '**Reason:** ' + reason,
        '**Moderator:** ' + interaction.user.tag,
      ].join('\n'),
      { thumbnail: user.displayAvatarURL({ dynamic: true }) }
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_kick_' + interaction.user.id)
        .setLabel('Confirm Kick')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis.kick),
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
        return i.update({ embeds: [errorEmbed('Kick Cancelled', 'Action was cancelled.')], components: [] });
      }

      if (i.customId === 'mod_confirm_kick_' + interaction.user.id) {
        collector.stop('confirmed');
        try {
          await member.kick(reason);

          const logEmbed = modEmbed(emojis.kick, 'Member Kicked', [
            { name: emojis.user + ' Target', value: user.tag + ' (`' + user.id + '`)', inline: true },
            { name: emojis.gavel + ' Moderator', value: interaction.user.tag, inline: true },
            { name: emojis.tag + ' Reason', value: reason, inline: false },
          ], { color: COLORS.error, thumbnail: user.displayAvatarURL({ dynamic: true }) });

          await i.update({ embeds: [logEmbed], components: [] });

          const config = await getGuildConfig(interaction.guild.id);
          if (config.logging.modLogChannelId) {
            const ch = interaction.guild.channels.cache.get(config.logging.modLogChannelId);
            if (ch) ch.send({ embeds: [logEmbed] });
          }
          await Log.addLog(interaction.guild.id, 'mod', 'kick', interaction.user.id, user.id, reason);
        } catch (err) {
          await i.update({ embeds: [errorEmbed('Kick Failed', err.message)], components: [] });
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
