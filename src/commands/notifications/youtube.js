const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const Notification = require('../../database/models/Notification');

module.exports = {
  name: 'youtube',
  description: 'Manage YouTube feed notifications',
  usage: '!youtube add <channelId> <#channel> | !youtube remove <channelId> | !youtube list',
  slash: new SlashCommandBuilder()
    .setName('youtube')
    .setDescription('YouTube notifications')
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add a YouTube channel to monitor')
      .addStringOption(opt => opt.setName('channel_id').setDescription('YouTube Channel ID').setRequired(true))
      .addChannelOption(opt => opt.setName('post_channel').setDescription('Channel to post in').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove a YouTube channel')
      .addStringOption(opt => opt.setName('channel_id').setDescription('YouTube Channel ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List monitored channels'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(message, args) {
    if (!message.member.permissions.has('ManageGuild')) return message.reply({ embeds: [errorEmbed('Permission Denied', 'Need Manage Server.')] });

    if (args[0] === 'add') {
      const channelId = args[1];
      const ch = message.mentions.channels.first();
      if (!channelId || !ch) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!youtube add <channelId> <#channel>`')] });
      await Notification.create({ guildId: message.guild.id, type: 'youtube', source: channelId, postChannelId: ch.id });
      return message.reply({ embeds: [successEmbed('Added', `YouTube channel \`${channelId}\` → ${ch}`)] });
    }
    if (args[0] === 'remove') {
      const channelId = args[1];
      if (!channelId) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!youtube remove <channelId>`')] });
      await Notification.deleteMany({ guildId: message.guild.id, type: 'youtube', source: channelId });
      return message.reply({ embeds: [successEmbed('Removed', `YouTube channel \`${channelId}\` removed.`)] });
    }
    if (args[0] === 'list') {
      const feeds = await Notification.find({ guildId: message.guild.id, type: 'youtube' });
      if (feeds.length === 0) return message.reply({ embeds: [infoEmbed('YouTube Feeds', 'None.')] });
      const list = feeds.map(f => `\`${f.source}\` → <#${f.postChannelId}>`).join('\n');
      return message.reply({ embeds: [infoEmbed('YouTube Feeds', list)] });
    }
    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!youtube add|remove|list`')] });
  },
  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'add') {
      const channelId = interaction.options.getString('channel_id');
      const ch = interaction.options.getChannel('post_channel');
      await Notification.create({ guildId: interaction.guild.id, type: 'youtube', source: channelId, postChannelId: ch.id });
      return interaction.reply({ embeds: [successEmbed('Added', `\`${channelId}\` → ${ch}`)] });
    }
    if (sub === 'remove') {
      const channelId = interaction.options.getString('channel_id');
      await Notification.deleteMany({ guildId: interaction.guild.id, type: 'youtube', source: channelId });
      return interaction.reply({ embeds: [successEmbed('Removed', `\`${channelId}\` removed.`)] });
    }
    if (sub === 'list') {
      const feeds = await Notification.find({ guildId: interaction.guild.id, type: 'youtube' });
      if (feeds.length === 0) return interaction.reply({ embeds: [infoEmbed('YouTube', 'None.')], ephemeral: true });
      const list = feeds.map(f => `\`${f.source}\` → <#${f.postChannelId}>`).join('\n');
      return interaction.reply({ embeds: [infoEmbed('YouTube Feeds', list)] });
    }
  },
};
