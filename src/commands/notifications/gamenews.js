const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const Notification = require('../../database/models/Notification');

module.exports = {
  name: 'gamenews',
  description: 'Manage game news RSS notifications',
  usage: '!gamenews add <game> <feedUrl> <#channel> | !gamenews remove <game> | !gamenews list',
  slash: new SlashCommandBuilder()
    .setName('gamenews')
    .setDescription('Game news notifications')
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add a game news feed')
      .addStringOption(opt => opt.setName('game').setDescription('Game name').setRequired(true))
      .addStringOption(opt => opt.setName('feed_url').setDescription('RSS feed URL').setRequired(true))
      .addChannelOption(opt => opt.setName('post_channel').setDescription('Channel to post in').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove a game news feed')
      .addStringOption(opt => opt.setName('game').setDescription('Game name').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List game news feeds'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(message, args) {
    if (!message.member.permissions.has('ManageGuild')) return message.reply({ embeds: [errorEmbed('Permission Denied', 'Need Manage Server.')] });
    if (args[0] === 'add') {
      const game = args[1];
      const feedUrl = args[2];
      const ch = message.mentions.channels.first();
      if (!game || !feedUrl || !ch) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!gamenews add <game> <feedUrl> <#channel>`')] });
      await Notification.create({ guildId: message.guild.id, type: 'gamenews', source: game, feedUrl, postChannelId: ch.id });
      return message.reply({ embeds: [successEmbed('Added', `${game} news → ${ch}`)] });
    }
    if (args[0] === 'remove') {
      const game = args[1];
      if (!game) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!gamenews remove <game>`')] });
      await Notification.deleteMany({ guildId: message.guild.id, type: 'gamenews', source: game });
      return message.reply({ embeds: [successEmbed('Removed', `${game} news removed.`)] });
    }
    if (args[0] === 'list') {
      const feeds = await Notification.find({ guildId: message.guild.id, type: 'gamenews' });
      if (feeds.length === 0) return message.reply({ embeds: [infoEmbed('Game News', 'None.')] });
      const list = feeds.map(f => `**${f.source}** → <#${f.postChannelId}>`).join('\n');
      return message.reply({ embeds: [infoEmbed('Game News Feeds', list)] });
    }
    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!gamenews add|remove|list`')] });
  },
  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'add') {
      const game = interaction.options.getString('game');
      const feedUrl = interaction.options.getString('feed_url');
      const ch = interaction.options.getChannel('post_channel');
      await Notification.create({ guildId: interaction.guild.id, type: 'gamenews', source: game, feedUrl, postChannelId: ch.id });
      return interaction.reply({ embeds: [successEmbed('Added', `${game} → ${ch}`)] });
    }
    if (sub === 'remove') {
      const game = interaction.options.getString('game');
      await Notification.deleteMany({ guildId: interaction.guild.id, type: 'gamenews', source: game });
      return interaction.reply({ embeds: [successEmbed('Removed', `${game}.`)] });
    }
    if (sub === 'list') {
      const feeds = await Notification.find({ guildId: interaction.guild.id, type: 'gamenews' });
      if (feeds.length === 0) return interaction.reply({ embeds: [infoEmbed('Game News', 'None.')], ephemeral: true });
      const list = feeds.map(f => `**${f.source}** → <#${f.postChannelId}>`).join('\n');
      return interaction.reply({ embeds: [infoEmbed('Game News', list)] });
    }
  },
};
