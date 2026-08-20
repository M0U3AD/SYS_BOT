const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');

function resolveChannel(mention, guild) {
  const id = String(mention || '').replace(/[<#>]/g, '');
  return id ? (guild.channels.cache.get(id) || null) : null;
}

const TEXT_CHANNEL_TYPES = [0, 5, 15];

function isValidMediaUrl(url) {
  return /^https?:\/\/\S+$/i.test(String(url || ''));
}

function buildList(config) {
  const separators = config.separators || [];
  if (separators.length === 0) return 'None configured yet.';
  return separators
    .map(s => '<#' + s.channelId + '> → `' + s.mediaUrl + '`')
    .join('\n');
}

module.exports = {
  name: 'separator',
  description: 'Post a GIF/media divider in a channel after every message',
  usage: '!separator add <#channel> <media-url> | remove <#channel> | list',
  slash: new SlashCommandBuilder()
    .setName('separator')
    .setDescription('Post a GIF/media divider in a channel after each message')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Set a media/GIF divider for a channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel to add a separator to').setRequired(true))
      .addStringOption(opt => opt.setName('media').setDescription('Direct image/GIF URL (https://...)').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove the separator from a channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel to remove the separator from').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List all configured separators')),

  async execute(message, args) {
    if (!message.member.permissions.has('ManageChannels')) {
      return message.reply({ embeds: [errorEmbed('Access Denied', 'You need the `Manage Channels` permission.')] });
    }

    const first = (args[0] || '').toLowerCase();
    const known = ['add', 'remove', 'list'];
    const sub = known.includes(first) ? args.shift().toLowerCase() : 'add';

    const config = await getGuildConfig(message.guild.id);
    const separators = config.separators || [];

    if (sub === 'add') {
      const channel = resolveChannel(args[0], message.guild);
      const url = args[1];

      if (!channel || !TEXT_CHANNEL_TYPES.includes(channel.type)) {
        return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Mention a **text channel** first: `!separator <#channel> <media-url>`')] });
      }
      if (!isValidMediaUrl(url)) {
        return message.reply({ embeds: [errorEmbed('Invalid URL', 'Provide a **direct** media/GIF link starting with `https://`\n(Right-click the GIF/image → **Copy image address**, then paste it here.)')] });
      }

      const existing = separators.find(s => s.channelId === channel.id);
      if (existing) {
        existing.mediaUrl = url;
      } else {
        separators.push({ channelId: channel.id, mediaUrl: url });
      }
      await updateGuildConfig(message.guild.id, { separators });

      return message.reply({
        embeds: [successEmbed('Separator Set', 'I will post the media divider in <#' + channel.id + '> after every message:\n' + url)],
      });
    }

    if (sub === 'remove') {
      const channel = resolveChannel(args[0], message.guild);
      if (!channel) {
        return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!separator remove <#channel>`')] });
      }
      await updateGuildConfig(message.guild.id, { separators: separators.filter(s => s.channelId !== channel.id) });
      return message.reply({ embeds: [successEmbed('Separator Removed', 'No more divider in <#' + channel.id + '>.')] });
    }

    if (sub === 'list' || sub === '') {
      return message.reply({ embeds: [infoEmbed(emojis.image + ' Separators', buildList(config))] });
    }

    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!separator add|remove|list`')] });
  },

  async slashExecute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = await getGuildConfig(interaction.guild.id);

    if (sub === 'add') {
      const channel = interaction.options.getChannel('channel');
      const url = interaction.options.getString('media');
      if (!TEXT_CHANNEL_TYPES.includes(channel.type)) {
        return interaction.reply({ embeds: [errorEmbed('Invalid Channel', 'Select a **text channel**.')], ephemeral: true });
      }
      if (!isValidMediaUrl(url)) {
        return interaction.reply({ embeds: [errorEmbed('Invalid URL', 'Provide a direct media/GIF link starting with `https://`')], ephemeral: true });
      }

      const separators = config.separators || [];
      const existing = separators.find(s => s.channelId === channel.id);
      if (existing) {
        existing.mediaUrl = url;
      } else {
        separators.push({ channelId: channel.id, mediaUrl: url });
      }
      await updateGuildConfig(interaction.guild.id, { separators });
      return interaction.reply({ embeds: [successEmbed('Separator Set', 'Media divider will be posted in <#' + channel.id + '> after every message:\n' + url)] });
    }

    if (sub === 'remove') {
      const channel = interaction.options.getChannel('channel');
      const separators = (config.separators || []).filter(s => s.channelId !== channel.id);
      await updateGuildConfig(interaction.guild.id, { separators });
      return interaction.reply({ embeds: [successEmbed('Separator Removed', 'No more divider in <#' + channel.id + '>.')] });
    }

    if (sub === 'list') {
      return interaction.reply({ embeds: [infoEmbed(emojis.image + ' Separators', buildList(config))], ephemeral: true });
    }
  },
};