const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');
const { startSetup } = require('../../utils/selfRole');

function statusLines(config) {
  const sr = config.selfRoles || {};
  const roles = sr.roles || [];
  const roleStr = roles.length ? roles.map(id => '<@&' + id + '>').join(' ') : 'None';
  return [
    '**Enabled:** ' + (sr.enabled ? '🟢 ON' : '🔴 OFF'),
    '**Channel:** ' + (sr.enabled && sr.channelId ? '<#' + sr.channelId + '>' : 'Not set'),
    '**Title:** `' + (sr.title || 'Choose Your Roles') + '`',
    '**Roles:** ' + (roles.length ? roles.length + ' · ' + roleStr : 'None configured'),
    '**Menu Message:** ' + (sr.enabled && sr.messageId ? '`' + sr.messageId + '`' : 'Not posted'),
  ].join('\n');
}

async function disableSelfRole(source) {
  const config = await getGuildConfig(source.guild.id);
  const sr = config.selfRoles || {};
  if (sr.enabled && sr.messageId && sr.channelId) {
    try {
      const ch = source.guild.channels.cache.get(sr.channelId);
      if (ch) {
        const m = await ch.messages.fetch(sr.messageId).catch(() => null);
        if (m) await m.delete().catch(() => {});
      }
    } catch (e) {}
  }
  await updateGuildConfig(source.guild.id, {
    'selfRoles.enabled': false,
    'selfRoles.messageId': '',
  });
}

module.exports = {
  name: 'selfrole',
  description: 'Let members pick their own roles from a dropdown menu',
  usage: '!selfrole setup | list | disable',
  slash: new SlashCommandBuilder()
    .setName('selfrole')
    .setDescription('Manage self-assignable roles (dropdown menu)')
    .addSubcommand(sub => sub.setName('setup').setDescription('Interactive self-role menu setup'))
    .addSubcommand(sub => sub.setName('list').setDescription('Show current self-role configuration'))
    .addSubcommand(sub => sub.setName('disable').setDescription('Remove the self-role menu'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(message, args) {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ embeds: [errorEmbed('Access Denied', 'You need the `Manage Server` permission.')] });
    }

    const sub = args[0] || '';

    if (sub === 'list') {
      const config = await getGuildConfig(message.guild.id);
      return message.reply({ embeds: [infoEmbed(emojis.role + ' Self Roles', statusLines(config))] });
    }

    if (sub === 'disable') {
      await disableSelfRole(message);
      return message.reply({ embeds: [successEmbed('Self-Roles Disabled', 'The role menu has been removed.')] });
    }

    if (sub === 'setup' || sub === '') {
      return startSetup(message, null);
    }

    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!selfrole setup|list|disable`')] });
  },

  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      await interaction.deferReply({ ephemeral: true });
      return startSetup(interaction, client);
    }

    if (sub === 'list') {
      const config = await getGuildConfig(interaction.guild.id);
      return interaction.reply({ embeds: [infoEmbed(emojis.role + ' Self Roles', statusLines(config))], ephemeral: true });
    }

    if (sub === 'disable') {
      await disableSelfRole(interaction);
      return interaction.reply({ embeds: [successEmbed('Self-Roles Disabled', 'The role menu has been removed.')] });
    }
  },
};