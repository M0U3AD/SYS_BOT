const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');
const Ticket = require('../../database/models/Ticket');

module.exports = {
  name: 'ticket',
  description: 'Manage the support ticket system',
  usage: '!ticket setup <#channel> <@role> | !ticket close | !ticket add <@user> | !ticket list',
  slash: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system')
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Set up ticket system')
      .addChannelOption(opt => opt.setName('channel').setDescription('Ticket creation channel').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Support role').setRequired(true))
      .addChannelOption(opt => opt.setName('transcript_channel').setDescription('Channel for transcripts')))
    .addSubcommand(sub => sub.setName('close').setDescription('Close current ticket'))
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add user to ticket')
      .addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List open tickets'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(message, args) {
    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need Manage Messages permission.')] });
    }

    if (args[0] === 'setup') {
      const ch = message.mentions.channels.first();
      const role = message.mentions.roles.first();
      if (!ch || !role) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!ticket setup <#channel> <@role>`')] });
      const transcriptCh = message.mentions.channels.find(c => c !== ch && c !== role);

      await updateGuildConfig(message.guild.id, {
        'tickets.enabled': true,
        'tickets.channelId': ch.id,
        'tickets.supportRoleId': role.id,
        'tickets.transcriptChannelId': transcriptCh?.id || '',
      });

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle('Support Tickets')
        .setDescription('Click the button below to create a support ticket.')
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_create').setLabel('Create Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫')
      );

      await ch.send({ embeds: [embed], components: [row] });
      return message.reply({ embeds: [successEmbed('Tickets Configured', `Ticket system active in ${ch}. Support role: ${role}`)] });
    }

    if (args[0] === 'close') {
      const ticket = await Ticket.findOne({ channelId: message.channel.id, status: 'open' });
      if (!ticket) return message.reply({ embeds: [errorEmbed('Not a Ticket', 'This channel is not an open ticket.')] });
      ticket.status = 'closed';
      ticket.closedBy = message.author.id;
      ticket.closedAt = new Date();
      await ticket.save();
      message.reply({ embeds: [successEmbed('Ticket Closed', 'Closing channel in 5 seconds...')] });
      setTimeout(() => message.channel.delete().catch(() => {}), 5000);
      return;
    }

    if (args[0] === 'list') {
      const tickets = await Ticket.find({ guildId: message.guild.id, status: 'open' });
      if (tickets.length === 0) return message.reply({ embeds: [infoEmbed('Tickets', 'No open tickets.')] });
      const list = tickets.map(t => `<#${t.channelId}> — by <@${t.creatorId}>`).join('\n');
      return message.reply({ embeds: [infoEmbed('Open Tickets', list)] });
    }

    if (args[0] === 'add') {
      const member = message.mentions.members.first();
      if (!member) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!ticket add <@user>`')] });
      await message.channel.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true });
      return message.reply({ embeds: [successEmbed('Added', `${member} added to this ticket.`)] });
    }

    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!ticket setup|close|add|list`')] });
  },
  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const ch = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');
      const transcriptCh = interaction.options.getChannel('transcript_channel');
      await updateGuildConfig(interaction.guild.id, {
        'tickets.enabled': true,
        'tickets.channelId': ch.id,
        'tickets.supportRoleId': role.id,
        'tickets.transcriptChannelId': transcriptCh?.id || '',
      });

      const embed = new EmbedBuilder()
        .setColor(interaction.guild.me?.displayHexColor || '#5865F2')
        .setTitle('Support Tickets')
        .setDescription('Click the button below to create a support ticket.')
        .setTimestamp();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_create').setLabel('Create Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫')
      );
      await ch.send({ embeds: [embed], components: [row] });
      return interaction.reply({ embeds: [successEmbed('Tickets Set', `Active in ${ch}. Role: ${role}`)] });
    }

    if (sub === 'close') {
      const ticket = await Ticket.findOne({ channelId: interaction.channel.id, status: 'open' });
      if (!ticket) return interaction.reply({ embeds: [errorEmbed('Not a Ticket', 'This is not an open ticket.')], ephemeral: true });
      ticket.status = 'closed';
      ticket.closedBy = interaction.user.id;
      ticket.closedAt = new Date();
      await ticket.save();
      await interaction.reply({ embeds: [successEmbed('Closing', 'Channel deleted in 5s.')] });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }

    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });
      return interaction.reply({ embeds: [successEmbed('Added', `${user} added.`)] });
    }

    if (sub === 'list') {
      const tickets = await Ticket.find({ guildId: interaction.guild.id, status: 'open' });
      if (tickets.length === 0) return interaction.reply({ embeds: [infoEmbed('Tickets', 'None open.')], ephemeral: true });
      const list = tickets.map(t => `<#${t.channelId}> — <@${t.creatorId}>`).join('\n');
      return interaction.reply({ embeds: [infoEmbed('Open Tickets', list)], ephemeral: true });
    }
  },
};
