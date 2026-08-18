const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    if (!interaction.isButton()) return;

    // Verification button
    if (interaction.customId.startsWith('verify_')) {
      const userId = interaction.customId.replace('verify_', '');
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'This verification is not for you.', ephemeral: true });
      }

      const config = await getGuildConfig(interaction.guild.id);
      if (!config.verification.enabled || !config.verification.roleId) {
        return interaction.reply({ content: 'Verification is not configured.', ephemeral: true });
      }

      const role = interaction.guild.roles.cache.get(config.verification.roleId);
      if (!role) {
        return interaction.reply({ content: 'Verified role not found.', ephemeral: true });
      }

      try {
        await interaction.member.roles.add(role);
        await interaction.reply({ content: 'You have been verified! Welcome to the server.', ephemeral: true });
        try { await interaction.message.delete(); } catch {}
      } catch {
        await interaction.reply({ content: 'Failed to verify. Please contact a mod.', ephemeral: true });
      }
      return;
    }

    // Ticket buttons
    if (interaction.customId === 'ticket_create') {
      const config = await getGuildConfig(interaction.guild.id);
      if (!config.tickets.enabled) return;
      return handleTicketCreate(interaction, config, client);
    }
    if (interaction.customId === 'ticket_close') {
      return handleTicketClose(interaction, client);
    }
    if (interaction.customId === 'ticket_claim') {
      return handleTicketClaim(interaction, client);
    }

    // Application buttons
    if (interaction.customId.startsWith('app_accept_') || interaction.customId.startsWith('app_deny_')) {
      return handleApplicationReview(interaction, client);
    }

    // Giveaway entry
    if (interaction.customId.startsWith('giveaway_')) {
      const giveawayId = interaction.customId.replace('giveaway_', '');
      const Giveaway = require('../../database/models/Giveaway');
      const giveaway = await Giveaway.findOne({ messageId: giveawayId, ended: false });
      if (!giveaway) return interaction.reply({ content: 'This giveaway has ended.', ephemeral: true });

      if (giveaway.entries.includes(interaction.user.id)) {
        giveaway.entries = giveaway.entries.filter(id => id !== interaction.user.id);
        await giveaway.save();
        return interaction.reply({ content: 'You left the giveaway.', ephemeral: true });
      } else {
        giveaway.entries.push(interaction.user.id);
        await giveaway.save();
        return interaction.reply({ content: 'You entered the giveaway! Good luck!', ephemeral: true });
      }
    }
  },
};

async function handleTicketCreate(interaction, config, client) {
  const Ticket = require('../../database/models/Ticket');
  const existing = await Ticket.findOne({ guildId: interaction.guild.id, creatorId: interaction.user.id, status: 'open' });
  if (existing) {
    return interaction.reply({ content: `You already have an open ticket: <#${existing.channelId}>`, ephemeral: true });
  }

  const ticketChannel = await interaction.guild.channels.create({
    name: `ticket-${interaction.user.username}`,
    type: 0,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: ['ViewChannel'] },
      { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'AttachFiles'] },
      { id: config.tickets.supportRoleId || interaction.guild.roles.everyone.id, allow: ['ViewChannel', 'SendMessages'] },
    ],
  });

  await Ticket.create({
    guildId: interaction.guild.id,
    channelId: ticketChannel.id,
    creatorId: interaction.user.id,
  });

  const embed = new EmbedBuilder()
    .setColor(config.embedColor)
    .setTitle('Support Ticket')
    .setDescription(`Welcome ${interaction.user}! Describe your issue and a staff member will assist you.`)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Primary).setEmoji('🙋')
  );

  await ticketChannel.send({ content: `<@${interaction.user.id}> <@&${config.tickets.supportRoleId || ''}>`, embeds: [embed], components: [row] });
  await interaction.reply({ content: `Ticket created: ${ticketChannel}`, ephemeral: true });
}

async function handleTicketClose(interaction, client) {
  const Ticket = require('../../database/models/Ticket');
  const ticket = await Ticket.findOne({ channelId: interaction.channel.id, status: 'open' });
  if (!ticket) return interaction.reply({ content: 'This is not an open ticket.', ephemeral: true });

  // Generate transcript
  const messages = await interaction.channel.messages.fetch({ limit: 100 });
  const transcript = messages.reverse().map(m => `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content || '(no text)'}`).join('\n');

  ticket.status = 'closed';
  ticket.closedBy = interaction.user.id;
  ticket.closedAt = new Date();
  ticket.transcript = transcript;
  await ticket.save();

  const config = await getGuildConfig(interaction.guild.id);
  if (config.tickets.transcriptChannelId) {
    const ch = interaction.guild.channels.cache.get(config.tickets.transcriptChannelId);
    if (ch) {
      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('Ticket Transcript')
        .setDescription(`Ticket by <@${ticket.creatorId}> — Closed by <@${interaction.user.id}>`)
        .addFields({ name: 'Transcript', value: transcript.substring(0, 4000) || 'Empty' })
        .setTimestamp();
      ch.send({ embeds: [embed] });
    }
  }

  await interaction.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('Ticket closed. Channel will be deleted in 5 seconds.').setTimestamp()] });
  setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
}

async function handleTicketClaim(interaction, client) {
  const Ticket = require('../../database/models/Ticket');
  const ticket = await Ticket.findOne({ channelId: interaction.channel.id, status: 'open' });
  if (!ticket) return interaction.reply({ content: 'Ticket not found.', ephemeral: true });
  ticket.claimedBy = interaction.user.id;
  await ticket.save();
  await interaction.reply({ embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`Ticket claimed by ${interaction.user}`).setTimestamp()] });
}

async function handleApplicationReview(interaction, client) {
  const Application = require('../../database/models/Application');
  const action = interaction.customId.startsWith('app_accept_') ? 'accepted' : 'denied';
  const appId = interaction.customId.split('_')[2];
  const app = await Application.findById(appId);
  if (!app) return interaction.reply({ content: 'Application not found.', ephemeral: true });

  app.status = action;
  await app.save();

  const member = interaction.guild.members.cache.get(app.userId);
  if (member) {
    const dmEmbed = new EmbedBuilder()
      .setColor(action === 'accepted' ? '#57F287' : '#ED4245')
      .setTitle(`Application ${action === 'accepted' ? 'Accepted' : 'Denied'}`)
      .setDescription(`Your application for **${interaction.guild.name}** has been **${action}**.`)
      .setTimestamp();
    member.send({ embeds: [dmEmbed] }).catch(() => {});
  }

  await interaction.update({ embeds: [new EmbedBuilder().setColor(action === 'accepted' ? '#57F287' : '#ED4245').setDescription(`Application **${action}** by ${interaction.user}`).setTimestamp()], components: [] });
}
