const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');
const Log = require('../../database/models/Log');

module.exports = {
  name: 'logs',
  description: 'Manage logging configuration',
  usage: '!logs setup | !logs view [type] | !logs types',
  slash: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Manage logging')
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Set up a log channel')
      .addStringOption(opt => opt.setName('type').setDescription('Log type').setRequired(true)
        .addChoices(
          { name: 'Mod', value: 'mod' },
          { name: 'Member', value: 'member' },
          { name: 'Message', value: 'message' },
          { name: 'Server', value: 'server' },
          { name: 'All', value: 'all' }
        ))
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel for logs').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('View recent logs')
      .addStringOption(opt => opt.setName('type').setDescription('Log type')
        .addChoices(
          { name: 'Mod', value: 'mod' },
          { name: 'Member', value: 'member' },
          { name: 'Message', value: 'message' },
          { name: 'Server', value: 'server' },
          { name: 'All', value: '' }
        ))
      .addIntegerOption(opt => opt.setName('limit').setDescription('Number of logs').setMinValue(1).setMaxValue(25)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(message, args) {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Manage Server permission.')] });
    }

    if (args[0] === 'setup') {
      const type = args[1];
      const channel = message.mentions.channels.first();
      if (!type || !channel) {
        return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!logs setup <mod|member|message|server|all> <#channel>`')] });
      }
      const update = {};
      if (type === 'all') {
        update['logging.modLogChannelId'] = channel.id;
        update['logging.memberLogChannelId'] = channel.id;
        update['logging.messageLogChannelId'] = channel.id;
        update['logging.serverLogChannelId'] = channel.id;
      } else {
        update[`logging.${type}LogChannelId`] = channel.id;
      }
      await updateGuildConfig(message.guild.id, update);
      return message.reply({ embeds: [successEmbed('Logs Configured', `**${type}** logs will now be sent to ${channel}.`)] });
    }

    if (args[0] === 'types') {
      const config = await getGuildConfig(message.guild.id);
      return message.reply({ embeds: [infoEmbed('Log Channels',
        `**Mod:** ${config.logging.modLogChannelId ? `<#${config.logging.modLogChannelId}>` : 'Not set'}\n` +
        `**Member:** ${config.logging.memberLogChannelId ? `<#${config.logging.memberLogChannelId}>` : 'Not set'}\n` +
        `**Message:** ${config.logging.messageLogChannelId ? `<#${config.logging.messageLogChannelId}>` : 'Not set'}\n` +
        `**Server:** ${config.logging.serverLogChannelId ? `<#${config.logging.serverLogChannelId}>` : 'Not set'}`
      )] });
    }

    if (args[0] === 'view') {
      const type = args[1] || '';
      const limit = parseInt(args[2]) || 10;
      const logs = await Log.getLogs(message.guild.id, type, limit);
      if (logs.length === 0) {
        return message.reply({ embeds: [infoEmbed('Logs', 'No logs found.')] });
      }
      const list = logs.map(l => `[${l.type}] **${l.action}** — ${l.details || 'N/A'} (${new Date(l.createdAt).toLocaleString()})`).join('\n');
      return message.reply({ embeds: [infoEmbed('Recent Logs', list)] });
    }

    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!logs setup <type> <#channel>` | `!logs view [type]` | `!logs types`')] });
  },
  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const type = interaction.options.getString('type');
      const channel = interaction.options.getChannel('channel');
      const update = {};
      if (type === 'all') {
        update['logging.modLogChannelId'] = channel.id;
        update['logging.memberLogChannelId'] = channel.id;
        update['logging.messageLogChannelId'] = channel.id;
        update['logging.serverLogChannelId'] = channel.id;
      } else {
        update[`logging.${type}LogChannelId`] = channel.id;
      }
      await updateGuildConfig(interaction.guild.id, update);
      return interaction.reply({ embeds: [successEmbed('Logs Configured', `**${type}** logs will now be sent to ${channel}.`)] });
    }

    if (sub === 'view') {
      const type = interaction.options.getString('type') || '';
      const limit = interaction.options.getInteger('limit') || 10;
      const logs = await Log.getLogs(interaction.guild.id, type, limit);
      if (logs.length === 0) {
        return interaction.reply({ embeds: [infoEmbed('Logs', 'No logs found.')], ephemeral: true });
      }
      const list = logs.map(l => `[${l.type}] **${l.action}** — ${l.details || 'N/A'} (${new Date(l.createdAt).toLocaleString()})`).join('\n');
      return interaction.reply({ embeds: [infoEmbed('Recent Logs', list)], ephemeral: true });
    }
  },
};
