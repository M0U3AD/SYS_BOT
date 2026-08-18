const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const Notification = require('../../database/models/Notification');

module.exports = {
  name: 'reddit',
  description: 'Manage Reddit feed notifications',
  usage: '!reddit add <subreddit> <#channel> | !reddit remove <subreddit> | !reddit list',
  slash: new SlashCommandBuilder()
    .setName('reddit')
    .setDescription('Reddit notifications')
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add a subreddit')
      .addStringOption(opt => opt.setName('subreddit').setDescription('Subreddit name').setRequired(true))
      .addChannelOption(opt => opt.setName('post_channel').setDescription('Channel to post in').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove a subreddit')
      .addStringOption(opt => opt.setName('subreddit').setDescription('Subreddit name').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List monitored subreddits'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(message, args) {
    if (!message.member.permissions.has('ManageGuild')) return message.reply({ embeds: [errorEmbed('Permission Denied', 'Need Manage Server.')] });
    if (args[0] === 'add') {
      const sub = args[1];
      const ch = message.mentions.channels.first();
      if (!sub || !ch) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!reddit add <subreddit> <#channel>`')] });
      await Notification.create({ guildId: message.guild.id, type: 'reddit', source: sub.toLowerCase(), postChannelId: ch.id });
      return message.reply({ embeds: [successEmbed('Added', `r/${sub} → ${ch}`)] });
    }
    if (args[0] === 'remove') {
      const sub = args[1];
      if (!sub) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!reddit remove <subreddit>`')] });
      await Notification.deleteMany({ guildId: message.guild.id, type: 'reddit', source: sub.toLowerCase() });
      return message.reply({ embeds: [successEmbed('Removed', `r/${sub} removed.`)] });
    }
    if (args[0] === 'list') {
      const feeds = await Notification.find({ guildId: message.guild.id, type: 'reddit' });
      if (feeds.length === 0) return message.reply({ embeds: [infoEmbed('Reddit', 'None.')] });
      const list = feeds.map(f => `r/${f.source} → <#${f.postChannelId}>`).join('\n');
      return message.reply({ embeds: [infoEmbed('Reddit Feeds', list)] });
    }
    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!reddit add|remove|list`')] });
  },
  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'add') {
      const subreddit = interaction.options.getString('subreddit');
      const ch = interaction.options.getChannel('post_channel');
      await Notification.create({ guildId: interaction.guild.id, type: 'reddit', source: subreddit.toLowerCase(), postChannelId: ch.id });
      return interaction.reply({ embeds: [successEmbed('Added', `r/${subreddit} → ${ch}`)] });
    }
    if (sub === 'remove') {
      const subreddit = interaction.options.getString('subreddit');
      await Notification.deleteMany({ guildId: interaction.guild.id, type: 'reddit', source: subreddit.toLowerCase() });
      return interaction.reply({ embeds: [successEmbed('Removed', `r/${subreddit}.`)] });
    }
    if (sub === 'list') {
      const feeds = await Notification.find({ guildId: interaction.guild.id, type: 'reddit' });
      if (feeds.length === 0) return interaction.reply({ embeds: [infoEmbed('Reddit', 'None.')], ephemeral: true });
      const list = feeds.map(f => `r/${f.source} → <#${f.postChannelId}>`).join('\n');
      return interaction.reply({ embeds: [infoEmbed('Reddit', list)] });
    }
  },
};
