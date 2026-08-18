const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const Notification = require('../../database/models/Notification');

module.exports = {
  name: 'twitch',
  description: 'Manage Twitch stream notifications',
  usage: '!twitch add <username> <#channel> | !twitch remove <username> | !twitch list',
  slash: new SlashCommandBuilder()
    .setName('twitch')
    .setDescription('Twitch notifications')
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add a Twitch channel')
      .addStringOption(opt => opt.setName('username').setDescription('Twitch username').setRequired(true))
      .addChannelOption(opt => opt.setName('post_channel').setDescription('Channel to post in').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove a Twitch channel')
      .addStringOption(opt => opt.setName('username').setDescription('Twitch username').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List monitored channels'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(message, args) {
    if (!message.member.permissions.has('ManageGuild')) return message.reply({ embeds: [errorEmbed('Permission Denied', 'Need Manage Server.')] });
    if (args[0] === 'add') {
      const username = args[1];
      const ch = message.mentions.channels.first();
      if (!username || !ch) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!twitch add <username> <#channel>`')] });
      await Notification.create({ guildId: message.guild.id, type: 'twitch', source: username.toLowerCase(), postChannelId: ch.id });
      return message.reply({ embeds: [successEmbed('Added', `Twitch \`${username}\` → ${ch}`)] });
    }
    if (args[0] === 'remove') {
      const username = args[1];
      if (!username) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!twitch remove <username>`')] });
      await Notification.deleteMany({ guildId: message.guild.id, type: 'twitch', source: username.toLowerCase() });
      return message.reply({ embeds: [successEmbed('Removed', `\`${username}\` removed.`)] });
    }
    if (args[0] === 'list') {
      const feeds = await Notification.find({ guildId: message.guild.id, type: 'twitch' });
      if (feeds.length === 0) return message.reply({ embeds: [infoEmbed('Twitch', 'None.')] });
      const list = feeds.map(f => `\`${f.source}\` → <#${f.postChannelId}>`).join('\n');
      return message.reply({ embeds: [infoEmbed('Twitch Feeds', list)] });
    }
    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!twitch add|remove|list`')] });
  },
  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'add') {
      const username = interaction.options.getString('username');
      const ch = interaction.options.getChannel('post_channel');
      await Notification.create({ guildId: interaction.guild.id, type: 'twitch', source: username.toLowerCase(), postChannelId: ch.id });
      return interaction.reply({ embeds: [successEmbed('Added', `\`${username}\` → ${ch}`)] });
    }
    if (sub === 'remove') {
      const username = interaction.options.getString('username');
      await Notification.deleteMany({ guildId: interaction.guild.id, type: 'twitch', source: username.toLowerCase() });
      return interaction.reply({ embeds: [successEmbed('Removed', `\`${username}\`.`)] });
    }
    if (sub === 'list') {
      const feeds = await Notification.find({ guildId: interaction.guild.id, type: 'twitch' });
      if (feeds.length === 0) return interaction.reply({ embeds: [infoEmbed('Twitch', 'None.')], ephemeral: true });
      const list = feeds.map(f => `\`${f.source}\` → <#${f.postChannelId}>`).join('\n');
      return interaction.reply({ embeds: [infoEmbed('Twitch', list)] });
    }
  },
};
