const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, confirmEmbed, modEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const { getT } = require('../../i18n');
const Log = require('../../database/models/Log');
const { getGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'ban',
  description: 'Ban a member from the server',
  usage: '!ban <@user> [reason]',
  slash: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for ban'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(message, args) {
    const t = await getT(message.guild.id);

    if (!message.member.permissions.has('BanMembers')) {
      return message.reply({ embeds: [errorEmbed('Access Denied', t('MOD_ACCESS_DENIED', 'Ban Members'))] });
    }

    const member = message.mentions.members.first();
    if (!member) {
      return message.reply({ embeds: [errorEmbed('Invalid Target', 'Please mention a user to ban.\n`!ban <@user> [reason]`')] });
    }

    if (!member.bannable) {
      return message.reply({ embeds: [errorEmbed('Cannot Ban', t('MOD_BAN_CANNOT'))] });
    }

    if (member.id === message.author.id) {
      return message.reply({ embeds: [errorEmbed('Self-Action', t('MOD_SELF_ACTION'))] });
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    const confirm = confirmEmbed(
      emojis.ban,
      t('MOD_CONFIRM_TITLE', t('MOD_BAN_TITLE')),
      t('MOD_BAN_CONFIRM', member.user.tag, reason, message.author.tag),
      { thumbnail: member.user.displayAvatarURL({ dynamic: true }) }
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_ban_' + message.author.id)
        .setLabel(t('MOD_CONFIRM_BTN', 'ban'))
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis.ban),
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
        return i.update({ embeds: [errorEmbed('Ban Cancelled', t('MOD_CANCELLED'))], components: [] });
      }

      if (i.customId === 'mod_confirm_ban_' + message.author.id) {
        collector.stop('confirmed');
        try {
          await member.ban({ reason });

          const logEmbed = modEmbed(emojis.ban, t('MOD_BAN_TITLE'), [
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
          await Log.addLog(message.guild.id, 'mod', 'ban', message.author.id, member.id, reason);
        } catch (err) {
          await i.update({ embeds: [errorEmbed('Ban Failed', err.message)], components: [] });
        }
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'confirmed' || reason === 'cancelled') return;
      try {
        await msg.edit({ embeds: [errorEmbed('Timed Out', t('MOD_TIMED_OUT'))], components: [] });
      } catch {}
    });
  },

  async slashExecute(interaction, client) {
    const t = await getT(interaction.guild.id);

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({ embeds: [errorEmbed('Not Found', t('MOD_BAN_NOT_FOUND'))], ephemeral: true });
    }
    if (!member.bannable) {
      return interaction.reply({ embeds: [errorEmbed('Cannot Ban', t('MOD_BAN_CANNOT'))], ephemeral: true });
    }
    if (member.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Self-Action', t('MOD_SELF_ACTION'))], ephemeral: true });
    }

    const confirm = confirmEmbed(
      emojis.ban,
      t('MOD_CONFIRM_TITLE', t('MOD_BAN_TITLE')),
      t('MOD_BAN_CONFIRM', user.tag, reason, interaction.user.tag),
      { thumbnail: user.displayAvatarURL({ dynamic: true }) }
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_confirm_ban_' + interaction.user.id)
        .setLabel(t('MOD_CONFIRM_BTN', 'ban'))
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis.ban),
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
        return i.update({ embeds: [errorEmbed('Ban Cancelled', t('MOD_CANCELLED'))], components: [] });
      }

      if (i.customId === 'mod_confirm_ban_' + interaction.user.id) {
        collector.stop('confirmed');
        try {
          await member.ban({ reason });

          const logEmbed = modEmbed(emojis.ban, t('MOD_BAN_TITLE'), [
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
          await Log.addLog(interaction.guild.id, 'mod', 'ban', interaction.user.id, user.id, reason);
        } catch (err) {
          await i.update({ embeds: [errorEmbed('Ban Failed', err.message)], components: [] });
        }
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'confirmed' || reason === 'cancelled') return;
      try {
        await msg.edit({ embeds: [errorEmbed('Timed Out', t('MOD_TIMED_OUT'))], components: [] });
      } catch {}
    });
  },
};
