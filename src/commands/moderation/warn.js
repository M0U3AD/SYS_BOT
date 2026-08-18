const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed, confirmEmbed, modEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const Warning = require('../../database/models/Warning');
const Log = require('../../database/models/Log');
const { getGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'warn',
  description: 'Warn a member, view warnings, or clear warnings',
  usage: '!warn <@user> [reason] | !warn list <@user> | !warn clear <@user>',
  slash: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Warn a member')
      .addUserOption(opt => opt.setName('user').setDescription('User to warn').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason')))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('View warnings for a user')
      .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('clear')
      .setDescription('Clear warnings for a user')
      .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(message, args) {
    if (!message.member.permissions.has('ModerateMembers')) {
      return message.reply({ embeds: [errorEmbed('Access Denied', 'You need the `Moderate Members` permission.')] });
    }

    if (args[0] === 'list') {
      const member = message.mentions.members.first();
      if (!member) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!warn list <@user>`')] });
      const warns = await Warning.getWarnings(message.guild.id, member.id);
      if (warns.length === 0) {
        return message.reply({ embeds: [infoEmbed('No Warnings', emojis.check + ' ' + member.user.tag + ' has a clean record.')] });
      }
      const list = warns.map(function(w, i) {
        return '**' + (i + 1) + '.** ' + w.reason + ' — <@' + w.moderatorId + '> • ' + new Date(w.date).toLocaleDateString();
      }).join('\n');
      const embed = modEmbed(emojis.warn, 'Warnings for ' + member.user.tag, [
        { name: emojis.chart + ' Total', value: '' + warns.length, inline: true },
        { name: emojis.user + ' User', value: member.user.tag, inline: true },
        { name: '\u200b', value: list, inline: false },
      ], { thumbnail: member.user.displayAvatarURL({ dynamic: true }) });
      return message.reply({ embeds: [embed] });
    }

    if (args[0] === 'clear') {
      const member = message.mentions.members.first();
      if (!member) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!warn clear <@user>`')] });
      const count = await Warning.clearWarnings(message.guild.id, member.id);
      return message.reply({ embeds: [successEmbed('Warnings Cleared', emojis.trash + ' Cleared **' + count + '** warning(s) for **' + member.user.tag + '**.')] });
    }

    const member = message.mentions.members.first();
    if (!member) {
      return message.reply({ embeds: [errorEmbed('Invalid Target', 'Please mention a user to warn.\n`!warn <@user> [reason]`')] });
    }

    if (member.id === message.author.id) {
      return message.reply({ embeds: [errorEmbed('Self-Action', 'You cannot warn yourself.')] });
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    const confirm = confirmEmbed(
      emojis.warn,
      'Warn Confirmation',
      [
        '**Target:** ' + member.user.tag + ' (`' + member.id + '`)',
        '**Reason:** ' + reason,
        '**Moderator:** ' + message.author.tag,
      ].join('\n'),
      { thumbnail: member.user.displayAvatarURL({ dynamic: true }) }
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_warn_' + message.author.id)
        .setLabel('Confirm Warn')
        .setStyle(ButtonStyle.Warning)
        .setEmoji(emojis.warn),
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
        return i.update({ embeds: [errorEmbed('Warn Cancelled', 'Action was cancelled by ' + message.author.tag + '.')], components: [] });
      }

      if (i.customId === 'mod_confirm_warn_' + message.author.id) {
        collector.stop('confirmed');
        try {
          await Warning.addWarning(message.guild.id, member.id, message.author.id, reason);
          const total = (await Warning.getWarnings(message.guild.id, member.id)).length;

          const logEmbed = modEmbed(emojis.warn, 'Member Warned', [
            { name: emojis.user + ' Target', value: member.user.tag + ' (`' + member.id + '`)', inline: true },
            { name: emojis.gavel + ' Moderator', value: message.author.tag, inline: true },
            { name: emojis.chart + ' Total Warnings', value: '' + total, inline: true },
            { name: emojis.tag + ' Reason', value: reason, inline: false },
          ], { color: COLORS.warning, thumbnail: member.user.displayAvatarURL({ dynamic: true }) });

          await i.update({ embeds: [logEmbed], components: [] });

          await Log.addLog(message.guild.id, 'mod', 'warn', message.author.id, member.id, reason);

          const config = await getGuildConfig(message.guild.id);
          if (config.logging.modLogChannelId) {
            const ch = message.guild.channels.cache.get(config.logging.modLogChannelId);
            if (ch) ch.send({ embeds: [logEmbed] });
          }

          if (config.moderation.warnAutoMute > 0 && total >= config.moderation.warnAutoMute) {
            await member.timeout(10 * 60 * 1000, 'Auto-mute: warning threshold reached');
            message.channel.send({ embeds: [infoEmbed('Auto-Mute', emojis.mute + ' ' + member.user.tag + ' has been auto-muted for reaching ' + total + ' warnings.')] });
          }
          if (config.moderation.warnAutoBan > 0 && total >= config.moderation.warnAutoBan) {
            await member.ban({ reason: 'Auto-ban: warning threshold reached' });
            message.channel.send({ embeds: [infoEmbed('Auto-Ban', emojis.ban + ' ' + member.user.tag + ' has been auto-banned for reaching ' + total + ' warnings.')] });
          }
        } catch (err) {
          await i.update({ embeds: [errorEmbed('Warn Failed', 'An error occurred: ' + err.message)], components: [] });
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
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');

    if (sub === 'list') {
      const warns = await Warning.getWarnings(interaction.guild.id, user.id);
      if (warns.length === 0) {
        return interaction.reply({ embeds: [infoEmbed('No Warnings', emojis.check + ' ' + user.tag + ' has a clean record.')], ephemeral: true });
      }
      const list = warns.map(function(w, i) {
        return '**' + (i + 1) + '.** ' + w.reason + ' — <@' + w.moderatorId + '> • ' + new Date(w.date).toLocaleDateString();
      }).join('\n');
      const embed = modEmbed(emojis.warn, 'Warnings for ' + user.tag, [
        { name: emojis.chart + ' Total', value: '' + warns.length, inline: true },
        { name: emojis.user + ' User', value: user.tag, inline: true },
        { name: '\u200b', value: list, inline: false },
      ], { thumbnail: user.displayAvatarURL({ dynamic: true }) });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'clear') {
      const count = await Warning.clearWarnings(interaction.guild.id, user.id);
      return interaction.reply({ embeds: [successEmbed('Warnings Cleared', emojis.trash + ' Cleared **' + count + '** warning(s) for **' + user.tag + '**.')] });
    }

    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);

    if (member && member.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Self-Action', 'You cannot warn yourself.')], ephemeral: true });
    }

    const confirm = confirmEmbed(
      emojis.warn,
      'Warn Confirmation',
      [
        '**Target:** ' + user.tag + ' (`' + user.id + '`)',
        '**Reason:** ' + reason,
        '**Moderator:** ' + interaction.user.tag,
      ].join('\n'),
      { thumbnail: user.displayAvatarURL({ dynamic: true }) }
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_warn_' + interaction.user.id)
        .setLabel('Confirm Warn')
        .setStyle(ButtonStyle.Warning)
        .setEmoji(emojis.warn),
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
        return i.update({ embeds: [errorEmbed('Warn Cancelled', 'Action was cancelled.')], components: [] });
      }

      if (i.customId === 'mod_confirm_warn_' + interaction.user.id) {
        collector.stop('confirmed');
        try {
          await Warning.addWarning(interaction.guild.id, user.id, interaction.user.id, reason);
          const total = (await Warning.getWarnings(interaction.guild.id, user.id)).length;

          const logEmbed = modEmbed(emojis.warn, 'Member Warned', [
            { name: emojis.user + ' Target', value: user.tag + ' (`' + user.id + '`)', inline: true },
            { name: emojis.gavel + ' Moderator', value: interaction.user.tag, inline: true },
            { name: emojis.chart + ' Total Warnings', value: '' + total, inline: true },
            { name: emojis.tag + ' Reason', value: reason, inline: false },
          ], { color: COLORS.warning, thumbnail: user.displayAvatarURL({ dynamic: true }) });

          await i.update({ embeds: [logEmbed], components: [] });

          await Log.addLog(interaction.guild.id, 'mod', 'warn', interaction.user.id, user.id, reason);

          const config = await getGuildConfig(interaction.guild.id);
          if (config.logging.modLogChannelId) {
            const ch = interaction.guild.channels.cache.get(config.logging.modLogChannelId);
            if (ch) ch.send({ embeds: [logEmbed] });
          }
        } catch (err) {
          await i.update({ embeds: [errorEmbed('Warn Failed', err.message)], components: [] });
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
