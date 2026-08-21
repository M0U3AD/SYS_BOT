const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed, confirmEmbed, modEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const Warning = require('../../database/models/Warning');
const Log = require('../../database/models/Log');
const { getGuildConfig } = require('../../database/utils/GuildConfig');
const { getT } = require('../../i18n');

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
    const t = await getT(message.guild.id);

    if (!message.member.permissions.has('ModerateMembers')) {
      return message.reply({ embeds: [errorEmbed(t('MOD_CONFIRM_TITLE', 'Error'), t('MOD_ACCESS_DENIED', '`Moderate Members`'))] });
    }

    if (args[0] === 'list') {
      const member = message.mentions.members.first();
      if (!member) return message.reply({ embeds: [errorEmbed(t('ERR_INVALID_USAGE'), '`!warn list <@user>`')] });
      const warns = await Warning.getWarnings(message.guild.id, member.id);
      if (warns.length === 0) {
        return message.reply({ embeds: [infoEmbed(t('MOD_WARN_NO_WARNINGS', member.user.tag), emojis.check + ' ' + t('MOD_WARN_NO_WARNINGS', member.user.tag))] });
      }
      const list = warns.map(function(w, i) {
        return t('MOD_WARN_LIST_ENTRY', '' + (i + 1), w.reason, w.moderatorId, new Date(w.date).toLocaleDateString());
      }).join('\n');
      const embed = modEmbed(emojis.warn, t('MOD_WARN_LIST_TITLE', member.user.tag), [
        { name: emojis.chart + ' Total', value: '' + warns.length, inline: true },
        { name: emojis.user + ' User', value: member.user.tag, inline: true },
        { name: '\u200b', value: list, inline: false },
      ], { thumbnail: member.user.displayAvatarURL({ dynamic: true }) });
      return message.reply({ embeds: [embed] });
    }

    if (args[0] === 'clear') {
      const member = message.mentions.members.first();
      if (!member) return message.reply({ embeds: [errorEmbed(t('ERR_INVALID_USAGE'), '`!warn clear <@user>`')] });
      const count = await Warning.clearWarnings(message.guild.id, member.id);
      return message.reply({ embeds: [successEmbed(t('MOD_WARN_TITLE', 'Cleared'), t('MOD_WARN_CLEAR_SUCCESS', '' + count, member.user.tag))] });
    }

    const member = message.mentions.members.first();
    if (!member) {
      return message.reply({ embeds: [errorEmbed(t('ERR_INVALID_USAGE'), '`!warn <@user> [reason]`')] });
    }

    if (member.id === message.author.id) {
      return message.reply({ embeds: [errorEmbed(t('MOD_SELF_ACTION'), t('MOD_SELF_ACTION'))] });
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    const targetStr = member.user.tag + ' (`' + member.id + '`)';

    const confirm = confirmEmbed(
      emojis.warn,
      t('MOD_CONFIRM_TITLE', 'Warn'),
      t('MOD_WARN_CONFIRM', targetStr, reason, message.author.tag),
      { thumbnail: member.user.displayAvatarURL({ dynamic: true }) }
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_warn_' + message.author.id)
        .setLabel(t('MOD_CONFIRM_BTN', 'Warn'))
        .setStyle(ButtonStyle.Warning)
        .setEmoji(emojis.warn),
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
        return i.update({ embeds: [errorEmbed(t('MOD_CANCELLED'), '')], components: [] }).catch(() => {});
      }

      if (i.customId === 'mod_confirm_warn_' + message.author.id) {
        collector.stop('confirmed');
        try {
          await Warning.addWarning(message.guild.id, member.id, message.author.id, reason);
          const total = (await Warning.getWarnings(message.guild.id, member.id)).length;

          const logEmbed = modEmbed(emojis.warn, t('MOD_WARN_TITLE'), [
            { name: emojis.user + ' Target', value: targetStr, inline: true },
            { name: emojis.gavel + ' Moderator', value: message.author.tag, inline: true },
            { name: emojis.chart + ' Total Warnings', value: '' + total, inline: true },
            { name: emojis.tag + ' Reason', value: reason, inline: false },
          ], { color: COLORS.warning, thumbnail: member.user.displayAvatarURL({ dynamic: true }) });

          await i.update({ embeds: [logEmbed], components: [] });

          await Log.addLog(message.guild.id, 'mod', 'warn', message.author.id, member.id, reason);

          const config = await getGuildConfig(message.guild.id);
          if (config.logging.modLogChannelId) {
            const ch = message.guild.channels.cache.get(config.logging.modLogChannelId);
            if (ch) ch.send({ embeds: [logEmbed] }).catch(() => {});
          }

          if (config.moderation.warnAutoMute > 0 && total >= config.moderation.warnAutoMute) {
            await member.timeout(10 * 60 * 1000, 'Auto-mute: warning threshold reached');
            message.channel.send({ embeds: [infoEmbed(t('MOD_WARN_TITLE', 'Auto-Mute'), emojis.mute + ' ' + t('MOD_WARN_AUTO_MUTE', member.user.tag, '' + total))] }).catch(() => {});
          }
          if (config.moderation.warnAutoBan > 0 && total >= config.moderation.warnAutoBan) {
            await member.ban({ reason: 'Auto-ban: warning threshold reached' });
            message.channel.send({ embeds: [infoEmbed(t('MOD_WARN_TITLE', 'Auto-Ban'), emojis.ban + ' ' + t('MOD_WARN_AUTO_BAN', member.user.tag, '' + total))] }).catch(() => {});
          }
        } catch (err) {
          console.error('warn command error:', err);
          await i.update({ embeds: [errorEmbed(t('MOD_WARN_TITLE', 'Error'), err.message)], components: [] }).catch(() => {});
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

    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');

    if (sub === 'list') {
      const warns = await Warning.getWarnings(interaction.guild.id, user.id);
      if (warns.length === 0) {
        return interaction.reply({ embeds: [infoEmbed(t('MOD_WARN_NO_WARNINGS', user.tag), emojis.check + ' ' + t('MOD_WARN_NO_WARNINGS', user.tag))], ephemeral: true });
      }
      const list = warns.map(function(w, i) {
        return t('MOD_WARN_LIST_ENTRY', '' + (i + 1), w.reason, w.moderatorId, new Date(w.date).toLocaleDateString());
      }).join('\n');
      const embed = modEmbed(emojis.warn, t('MOD_WARN_LIST_TITLE', user.tag), [
        { name: emojis.chart + ' Total', value: '' + warns.length, inline: true },
        { name: emojis.user + ' User', value: user.tag, inline: true },
        { name: '\u200b', value: list, inline: false },
      ], { thumbnail: user.displayAvatarURL({ dynamic: true }) });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'clear') {
      const count = await Warning.clearWarnings(interaction.guild.id, user.id);
      return interaction.reply({ embeds: [successEmbed(t('MOD_WARN_TITLE', 'Cleared'), t('MOD_WARN_CLEAR_SUCCESS', '' + count, user.tag))] });
    }

    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (member && member.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed(t('MOD_SELF_ACTION'), t('MOD_SELF_ACTION'))], ephemeral: true });
    }

    const targetStr = user.tag + ' (`' + user.id + '`)';

    const confirm = confirmEmbed(
      emojis.warn,
      t('MOD_CONFIRM_TITLE', 'Warn'),
      t('MOD_WARN_CONFIRM', targetStr, reason, interaction.user.tag),
      { thumbnail: user.displayAvatarURL({ dynamic: true }) }
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_warn_' + interaction.user.id)
        .setLabel(t('MOD_CONFIRM_BTN', 'Warn'))
        .setStyle(ButtonStyle.Warning)
        .setEmoji(emojis.warn),
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
        return i.update({ embeds: [errorEmbed(t('MOD_CANCELLED'), '')], components: [] }).catch(() => {});
      }

      if (i.customId === 'mod_confirm_warn_' + interaction.user.id) {
        collector.stop('confirmed');
        try {
          await Warning.addWarning(interaction.guild.id, user.id, interaction.user.id, reason);
          const total = (await Warning.getWarnings(interaction.guild.id, user.id)).length;

          const logEmbed = modEmbed(emojis.warn, t('MOD_WARN_TITLE'), [
            { name: emojis.user + ' Target', value: targetStr, inline: true },
            { name: emojis.gavel + ' Moderator', value: interaction.user.tag, inline: true },
            { name: emojis.chart + ' Total Warnings', value: '' + total, inline: true },
            { name: emojis.tag + ' Reason', value: reason, inline: false },
          ], { color: COLORS.warning, thumbnail: user.displayAvatarURL({ dynamic: true }) });

          await i.update({ embeds: [logEmbed], components: [] });

          await Log.addLog(interaction.guild.id, 'mod', 'warn', interaction.user.id, user.id, reason);

          const config = await getGuildConfig(interaction.guild.id);
          if (config.logging.modLogChannelId) {
            const ch = interaction.guild.channels.cache.get(config.logging.modLogChannelId);
            if (ch) ch.send({ embeds: [logEmbed] }).catch(() => {});
          }

          if (member && config.moderation.warnAutoMute > 0 && total >= config.moderation.warnAutoMute) {
            await member.timeout(10 * 60 * 1000, 'Auto-mute: warning threshold reached');
            interaction.channel.send({ embeds: [infoEmbed(t('MOD_WARN_TITLE', 'Auto-Mute'), emojis.mute + ' ' + t('MOD_WARN_AUTO_MUTE', user.tag, '' + total))] }).catch(() => {});
          }
          if (config.moderation.warnAutoBan > 0 && total >= config.moderation.warnAutoBan) {
            await interaction.guild.members.ban(user.id, { reason: 'Auto-ban: warning threshold reached' });
            interaction.channel.send({ embeds: [infoEmbed(t('MOD_WARN_TITLE', 'Auto-Ban'), emojis.ban + ' ' + t('MOD_WARN_AUTO_BAN', user.tag, '' + total))] }).catch(() => {});
          }
        } catch (err) {
          console.error('warn slash error:', err);
          await i.update({ embeds: [errorEmbed(t('MOD_WARN_TITLE', 'Error'), err.message)], components: [] }).catch(() => {});
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
