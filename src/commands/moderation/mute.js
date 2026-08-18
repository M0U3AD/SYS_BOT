const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, confirmEmbed, modEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const Log = require('../../database/models/Log');
const { getGuildConfig } = require('../../database/utils/GuildConfig');
const { getT } = require('../../i18n');

module.exports = {
  name: 'mute',
  description: 'Timeout a member',
  usage: '!mute <@user> <minutes> [reason]',
  slash: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a member')
    .addUserOption(opt => opt.setName('user').setDescription('User to mute').setRequired(true))
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for mute'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(message, args) {
    const t = await getT(message.guild.id);

    if (!message.member.permissions.has('ModerateMembers')) {
      return message.reply({ embeds: [errorEmbed(t('MOD_CONFIRM_TITLE', 'Error'), t('MOD_ACCESS_DENIED', '`Moderate Members`'))] });
    }

    const member = message.mentions.members.first();
    if (!member) {
      return message.reply({ embeds: [errorEmbed(t('ERR_INVALID_USAGE'), '`!mute <@user> <minutes> [reason]`')] });
    }

    if (member.id === message.author.id) {
      return message.reply({ embeds: [errorEmbed(t('MOD_SELF_ACTION'), t('MOD_SELF_ACTION'))] });
    }

    const minutes = parseInt(args[1]);
    if (isNaN(minutes) || minutes < 1 || minutes > 40320) {
      return message.reply({ embeds: [errorEmbed(t('MOD_MUTE_INVALID_DURATION'), '')] });
    }

    const reason = args.slice(2).join(' ') || 'No reason provided';

    const durationStr = minutes >= 1440 ? Math.floor(minutes / 1440) + 'd ' + Math.floor((minutes % 1440) / 60) + 'h' :
                        minutes >= 60 ? Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'm' :
                        minutes + 'm';

    const targetStr = member.user.tag + ' (`' + member.id + '`)';

    const confirm = confirmEmbed(
      emojis.mute,
      t('MOD_CONFIRM_TITLE', 'Mute'),
      t('MOD_MUTE_CONFIRM', targetStr, durationStr, reason, message.author.tag),
      { thumbnail: member.user.displayAvatarURL({ dynamic: true }) }
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_mute_' + message.author.id)
        .setLabel(t('MOD_CONFIRM_BTN', 'Mute'))
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis.mute),
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

      if (i.customId === 'mod_confirm_mute_' + message.author.id) {
        collector.stop('confirmed');
        try {
          await member.timeout(minutes * 60 * 1000, reason);

          const logEmbed = modEmbed(emojis.mute, t('MOD_MUTE_TITLE'), [
            { name: emojis.user + ' Target', value: targetStr, inline: true },
            { name: emojis.gavel + ' Moderator', value: message.author.tag, inline: true },
            { name: emojis.dots + ' Duration', value: durationStr, inline: true },
            { name: emojis.tag + ' Reason', value: reason, inline: false },
          ], { color: COLORS.warning, thumbnail: member.user.displayAvatarURL({ dynamic: true }) });

          await i.update({ embeds: [logEmbed], components: [] });

          const config = await getGuildConfig(message.guild.id);
          if (config.logging.modLogChannelId) {
            const ch = message.guild.channels.cache.get(config.logging.modLogChannelId);
            if (ch) ch.send({ embeds: [logEmbed] });
          }
          await Log.addLog(message.guild.id, 'mod', 'mute', message.author.id, member.id, reason + ' (' + durationStr + ')');
        } catch (err) {
          await i.update({ embeds: [errorEmbed(t('MOD_MUTE_TITLE', 'Error'), err.message)], components: [] });
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
    const minutes = interaction.options.getInteger('minutes');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({ embeds: [errorEmbed(t('MOD_MUTE_TITLE', 'Error'), t('MOD_MUTE_NOT_FOUND'))], ephemeral: true });
    }
    if (!member.moderatable) {
      return interaction.reply({ embeds: [errorEmbed(t('MOD_MUTE_TITLE', 'Error'), t('MOD_MUTE_CANNOT'))], ephemeral: true });
    }
    if (member.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed(t('MOD_SELF_ACTION'), t('MOD_SELF_ACTION'))], ephemeral: true });
    }

    if (minutes < 1 || minutes > 40320) {
      return interaction.reply({ embeds: [errorEmbed(t('MOD_MUTE_INVALID_DURATION'), '')], ephemeral: true });
    }

    const durationStr = minutes >= 1440 ? Math.floor(minutes / 1440) + 'd ' + Math.floor((minutes % 1440) / 60) + 'h' :
                        minutes >= 60 ? Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'm' :
                        minutes + 'm';

    const targetStr = user.tag + ' (`' + user.id + '`)';

    const confirm = confirmEmbed(
      emojis.mute,
      t('MOD_CONFIRM_TITLE', 'Mute'),
      t('MOD_MUTE_CONFIRM', targetStr, durationStr, reason, interaction.user.tag),
      { thumbnail: user.displayAvatarURL({ dynamic: true }) }
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_mute_' + interaction.user.id)
        .setLabel(t('MOD_CONFIRM_BTN', 'Mute'))
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis.mute),
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

      if (i.customId === 'mod_confirm_mute_' + interaction.user.id) {
        collector.stop('confirmed');
        try {
          await member.timeout(minutes * 60 * 1000, reason);

          const logEmbed = modEmbed(emojis.mute, t('MOD_MUTE_TITLE'), [
            { name: emojis.user + ' Target', value: targetStr, inline: true },
            { name: emojis.gavel + ' Moderator', value: interaction.user.tag, inline: true },
            { name: emojis.dots + ' Duration', value: durationStr, inline: true },
            { name: emojis.tag + ' Reason', value: reason, inline: false },
          ], { color: COLORS.warning, thumbnail: user.displayAvatarURL({ dynamic: true }) });

          await i.update({ embeds: [logEmbed], components: [] });

          const config = await getGuildConfig(interaction.guild.id);
          if (config.logging.modLogChannelId) {
            const ch = interaction.guild.channels.cache.get(config.logging.modLogChannelId);
            if (ch) ch.send({ embeds: [logEmbed] });
          }
          await Log.addLog(interaction.guild.id, 'mod', 'mute', interaction.user.id, user.id, reason + ' (' + durationStr + ')');
        } catch (err) {
          await i.update({ embeds: [errorEmbed(t('MOD_MUTE_TITLE', 'Error'), err.message)], components: [] });
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
