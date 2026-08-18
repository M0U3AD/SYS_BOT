const { EmbedBuilder } = require('discord.js');
const { errorEmbed } = require('../utils/embeds');
const { getGuildConfig } = require('../database/utils/GuildConfig');

const pendingSetups = new Map();

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {

    if (interaction.isChatInputCommand()) {
      const command = client.slashCommands?.get(interaction.commandName);
      if (!command) return;
      try {
        await command.slashExecute(interaction, client);
      } catch (error) {
        console.error('Slash command error [' + interaction.commandName + ']:', error);
        var reply = {
          embeds: [errorEmbed('Error', 'An error occurred while executing this command.')],
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('rr_toggle_')) {
        return handleReactionRoleToggle(interaction);
      }
      if (interaction.customId.startsWith('verify_')) {
        return handleVerify(interaction);
      }
      if (interaction.customId === 'ticket_create') {
        return handleTicketCreate(interaction, client);
      }
      if (interaction.customId === 'ticket_close') {
        return handleTicketClose(interaction, client);
      }
      if (interaction.customId === 'ticket_claim') {
        return handleTicketClaim(interaction, client);
      }
      if (interaction.customId.startsWith('app_accept_') || interaction.customId.startsWith('app_deny_')) {
        return handleApplicationReview(interaction, client);
      }
      if (interaction.customId.startsWith('giveaway_')) {
        return handleGiveaway(interaction);
      }
      if (interaction.customId.startsWith('broadcast_confirm_') || interaction.customId.startsWith('broadcast_cancel_')) {
        return;
      }
      if (interaction.customId.startsWith('mod_confirm_') || interaction.customId.startsWith('mod_cancel_')) {
        return;
      }
      if (interaction.customId === 'setup_toggle_automod' || interaction.customId === 'setup_toggle_welcome' ||
          interaction.customId === 'setup_toggle_goodbye' || interaction.customId === 'setup_toggle_tickets' ||
          interaction.customId === 'setup_toggle_xp' || interaction.customId === 'setup_toggle_economy' ||
          interaction.customId === 'setup_toggle_giveaways' || interaction.customId === 'setup_toggle_verification') {
        return handleSetupToggle(interaction);
      }
      if (interaction.customId.startsWith('setup_panel_')) {
        return handleSetupPanel(interaction);
      }
      if (interaction.customId === 'rr_add_pair' || interaction.customId === 'rr_remove_pair' ||
          interaction.customId === 'rr_set_channel' || interaction.customId === 'rr_preview' ||
          interaction.customId === 'rr_send' || interaction.customId === 'rr_cancel') {
        return;
      }
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'rr_select_remove') {
        return handleRRSelectRemove(interaction);
      }
      return;
    }

    if (interaction.isChannelSelectMenu()) {
      if (interaction.customId === 'rr_channel_select') {
        return handleRRChannelSelect(interaction);
      }
      return;
    }
  },
};

async function handleReactionRoleToggle(interaction) {
  var index = parseInt(interaction.customId.replace('rr_toggle_', ''));
  var config = await getGuildConfig(interaction.guild.id);
  var rr = (config.reactionRoles || []).find(function(r) { return r.messageId === interaction.message.id; });
  if (!rr || !rr.roles[index]) {
    return interaction.reply({ content: 'This reaction role is no longer valid.', ephemeral: true });
  }

  var roleData = rr.roles[index];
  var role = interaction.guild.roles.cache.get(roleData.roleId);
  if (!role) {
    return interaction.reply({ content: 'Role not found.', ephemeral: true });
  }

  try {
    if (interaction.member.roles.cache.has(role.id)) {
      await interaction.member.roles.remove(role);
      return interaction.reply({ content: 'Removed role **' + role.name + '**.', ephemeral: true });
    } else {
      await interaction.member.roles.add(role);
      return interaction.reply({ content: 'Added role **' + role.name + '**.', ephemeral: true });
    }
  } catch (err) {
    return interaction.reply({ content: 'Failed to manage role. Contact a mod.', ephemeral: true });
  }
}

async function handleVerify(interaction) {
  var userId = interaction.customId.replace('verify_', '');
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: 'This verification is not for you.', ephemeral: true });
  }
  var config = await getGuildConfig(interaction.guild.id);
  if (!config.verification.enabled || !config.verification.roleId) {
    return interaction.reply({ content: 'Verification is not configured.', ephemeral: true });
  }
  var role = interaction.guild.roles.cache.get(config.verification.roleId);
  if (!role) return interaction.reply({ content: 'Verified role not found.', ephemeral: true });
  try {
    await interaction.member.roles.add(role);
    await interaction.reply({ content: 'You have been verified! Welcome to the server.', ephemeral: true });
    try { await interaction.message.delete(); } catch (e) {}
  } catch (err) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Failed to verify. Contact a mod.', ephemeral: true });
    }
  }
}

async function handleTicketCreate(interaction, client) {
  var config = await getGuildConfig(interaction.guild.id);
  if (!config.tickets.enabled) return;
  var Ticket = require('../database/models/Ticket');
  var existing = await Ticket.findOne({ guildId: interaction.guild.id, creatorId: interaction.user.id, status: 'open' });
  if (existing) {
    return interaction.reply({ content: 'You already have an open ticket: <#' + existing.channelId + '>', ephemeral: true });
  }

  var ticketChannel = await interaction.guild.channels.create({
    name: 'ticket-' + interaction.user.username,
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

  var embed = new EmbedBuilder()
    .setColor(config.embedColor)
    .setTitle('🎫 Support Ticket')
    .setDescription('Welcome ' + interaction.user + '! Describe your issue and a staff member will assist you.')
    .setTimestamp()
    .setFooter({ text: 'SYS-F1ex' });

  var { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  var row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Primary).setEmoji('🙋')
  );

  await ticketChannel.send({ content: '<@' + interaction.user.id + '> <@&' + (config.tickets.supportRoleId || '') + '>', embeds: [embed], components: [row] });
  await interaction.reply({ content: 'Ticket created: ' + ticketChannel, ephemeral: true });
}

async function handleTicketClose(interaction, client) {
  var Ticket = require('../database/models/Ticket');
  var ticket = await Ticket.findOne({ channelId: interaction.channel.id, status: 'open' });
  if (!ticket) return interaction.reply({ content: 'This is not an open ticket.', ephemeral: true });

  var messages = await interaction.channel.messages.fetch({ limit: 100 });
  var transcript = messages.reverse().map(function(m) { return '[' + new Date(m.createdTimestamp).toLocaleString() + '] ' + m.author.tag + ': ' + (m.content || '(no text)'); }).join('\n');

  ticket.status = 'closed';
  ticket.closedBy = interaction.user.id;
  ticket.closedAt = new Date();
  ticket.transcript = transcript;
  await ticket.save();

  var config = await getGuildConfig(interaction.guild.id);
  if (config.tickets.transcriptChannelId) {
    var ch = interaction.guild.channels.cache.get(config.tickets.transcriptChannelId);
    if (ch) {
      var tEmbed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🎫 Ticket Transcript')
        .setDescription('Ticket by <@' + ticket.creatorId + '> — Closed by <@' + interaction.user.id + '>')
        .addFields({ name: 'Transcript', value: transcript.substring(0, 4000) || 'Empty' })
        .setTimestamp();
      ch.send({ embeds: [tEmbed] });
    }
  }

  await interaction.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('🔒 Ticket closed. Deleting in 5s.').setTimestamp()] });
  setTimeout(function() { interaction.channel.delete().catch(function() {}); }, 5000);
}

async function handleTicketClaim(interaction, client) {
  var Ticket = require('../database/models/Ticket');
  var ticket = await Ticket.findOne({ channelId: interaction.channel.id, status: 'open' });
  if (!ticket) return interaction.reply({ content: 'Ticket not found.', ephemeral: true });
  ticket.claimedBy = interaction.user.id;
  await ticket.save();
  await interaction.reply({ embeds: [new EmbedBuilder().setColor('#57F287').setDescription('🙋 Ticket claimed by ' + interaction.user).setTimestamp()] });
}

async function handleApplicationReview(interaction, client) {
  var Application = require('../database/models/Application');
  var action = interaction.customId.startsWith('app_accept_') ? 'accepted' : 'denied';
  var appId = interaction.customId.split('_')[2];
  var app = await Application.findById(appId);
  if (!app) return interaction.reply({ content: 'Application not found.', ephemeral: true });

  app.status = action;
  await app.save();

  var member = interaction.guild.members.cache.get(app.userId);
  if (member) {
    var dmEmbed = new EmbedBuilder()
      .setColor(action === 'accepted' ? '#57F287' : '#ED4245')
      .setTitle('Application ' + (action === 'accepted' ? 'Accepted' : 'Denied'))
      .setDescription('Your application for **' + interaction.guild.name + '** has been **' + action + '**.')
      .setTimestamp();
    member.send({ embeds: [dmEmbed] }).catch(function() {});
  }

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(action === 'accepted' ? '#57F287' : '#ED4245').setDescription('Application **' + action + '** by ' + interaction.user).setTimestamp()],
    components: [],
  });
}

async function handleGiveaway(interaction) {
  var giveawayId = interaction.customId.replace('giveaway_', '');
  var Giveaway = require('../database/models/Giveaway');
  var giveaway = await Giveaway.findOne({ messageId: giveawayId, ended: false });
  if (!giveaway) return interaction.reply({ content: 'This giveaway has ended.', ephemeral: true });
  if (giveaway.entries.includes(interaction.user.id)) {
    giveaway.entries = giveaway.entries.filter(function(id) { return id !== interaction.user.id; });
    await giveaway.save();
    return interaction.reply({ content: 'You left the giveaway.', ephemeral: true });
  } else {
    giveaway.entries.push(interaction.user.id);
    await giveaway.save();
    return interaction.reply({ content: 'You entered the giveaway! Good luck!', ephemeral: true });
  }
}

async function handleSetupToggle(interaction) {
  var feature = interaction.customId.replace('setup_toggle_', '');
  var config = await getGuildConfig(interaction.guild.id);
  var { updateGuildConfig } = require('../database/utils/GuildConfig');

  var toggleMap = {
    'automod': 'moderation.automod.enabled',
    'welcome': 'welcome.enabled',
    'goodbye': 'goodbye.enabled',
    'tickets': 'tickets.enabled',
    'xp': 'xp.enabled',
    'economy': 'economy.enabled',
    'giveaways': 'giveaways.enabled',
    'verification': 'verification.enabled',
  };

  var path = toggleMap[feature];
  if (!path) return interaction.reply({ content: 'Unknown feature.', ephemeral: true });

  var current = config;
  var parts = path.split('.');
  for (var i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]];
  }
  var newVal = !current[parts[parts.length - 1]];

  var update = {};
  update[path] = newVal;
  await updateGuildConfig(interaction.guild.id, update);

  await interaction.reply({
    content: 'Feature toggled to **' + (newVal ? 'ON' : 'OFF') + '**.',
    ephemeral: true,
  });
}

async function handleSetupPanel(interaction) {
  var panel = interaction.customId.replace('setup_panel_', '');
  var { getGuildConfig: getCfg } = require('../database/utils/GuildConfig');
  var config = await getCfg(interaction.guild.id);
  var emojis = require('../utils/emojis');
  var { COLORS } = require('../utils/embeds');

  var panels = {
    'moderation': {
      title: emojis.shield + ' Moderation Setup',
      desc: 'Configure auto-moderation and punishment settings.',
      fields: [
        { name: 'AutoMod', value: config.moderation.automod.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'Warn Auto-Mute', value: config.moderation.warnAutoMute > 0 ? 'After ' + config.moderation.warnAutoMute + ' warns' : 'Disabled', inline: true },
        { name: 'Warn Auto-Ban', value: config.moderation.warnAutoBan > 0 ? 'After ' + config.moderation.warnAutoBan + ' warns' : 'Disabled', inline: true },
      ],
      toggleId: 'setup_toggle_automod',
    },
    'welcome': {
      title: emojis.wave + ' Welcome/Goodbye Setup',
      desc: 'Configure welcome and goodbye messages.',
      fields: [
        { name: 'Welcome', value: config.welcome.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'Goodbye', value: config.goodbye.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'Welcome Channel', value: config.welcome.channelId ? '<#' + config.welcome.channelId + '>' : 'Not set', inline: true },
      ],
      toggleId: 'setup_toggle_welcome',
    },
    'tickets': {
      title: emojis.ticket + ' Ticket Setup',
      desc: 'Configure the ticket system.',
      fields: [
        { name: 'Enabled', value: config.tickets.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'Support Role', value: config.tickets.supportRoleId ? '<@&' + config.tickets.supportRoleId + '>' : 'Not set', inline: true },
        { name: 'Transcript Channel', value: config.tickets.transcriptChannelId ? '<#' + config.tickets.transcriptChannelId + '>' : 'Not set', inline: true },
      ],
      toggleId: 'setup_toggle_tickets',
    },
    'xp': {
      title: emojis.star + ' XP/Levels Setup',
      desc: 'Configure the XP and leveling system.',
      fields: [
        { name: 'Enabled', value: config.xp.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'XP Per Message', value: '' + config.xp.xpPerMessage, inline: true },
        { name: 'Cooldown', value: config.xp.cooldown + 's', inline: true },
      ],
      toggleId: 'setup_toggle_xp',
    },
    'economy': {
      title: emojis.coin + ' Economy Setup',
      desc: 'Configure the economy system.',
      fields: [
        { name: 'Enabled', value: config.economy.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'Currency', value: config.economy.currencyEmoji + ' ' + config.economy.currencyName, inline: true },
        { name: 'Daily Amount', value: '' + config.economy.dailyAmount, inline: true },
      ],
      toggleId: 'setup_toggle_economy',
    },
    'giveaways': {
      title: emojis.giveaway + ' Giveaway Setup',
      desc: 'Configure the giveaway system.',
      fields: [
        { name: 'Enabled', value: config.giveaways.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'Channel', value: config.giveaways.channelId ? '<#' + config.giveaways.channelId + '>' : 'Not set', inline: true },
      ],
      toggleId: 'setup_toggle_giveaways',
    },
  };

  var panelData = panels[panel];
  if (!panelData) return interaction.reply({ content: 'Unknown panel.', ephemeral: true });

  var embed = new EmbedBuilder()
    .setColor(COLORS.blurple)
    .setTitle(panelData.title)
    .setDescription(panelData.desc)
    .addFields(panelData.fields)
    .setTimestamp()
    .setFooter({ text: 'SYS-F1ex \u2022 Click to toggle' });

  var row = new (require('discord.js').ActionRowBuilder)().addComponents(
    new (require('discord.js').ButtonBuilder)()
      .setCustomId(panelData.toggleId)
      .setLabel('Toggle On/Off')
      .setStyle(config.moderation.automod ? require('discord.js').ButtonStyle.Success : require('discord.js').ButtonStyle.Danger)
      .setEmoji(emojis.bolt),
    new (require('discord.js').ButtonBuilder)()
      .setCustomId('setup_back')
      .setLabel('Back')
      .setStyle(require('discord.js').ButtonStyle.Secondary)
      .setEmoji(emojis.arrow_left)
  );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

function handleRRSelectRemove(interaction) {
  var setupData = pendingSetups.get(interaction.user.id);
  if (!setupData) {
    return interaction.reply({ content: 'Setup expired. Run the command again.', ephemeral: true });
  }
  var indices = interaction.values.map(Number).sort(function(a, b) { return b - a; });
  indices.forEach(function(idx) { setupData.pairs.splice(idx, 1); });
  pendingSetups.set(interaction.user.id, setupData);
  return interaction.reply({ content: 'Removed ' + indices.length + ' pair(s). Run setup again to see changes.', ephemeral: true });
}

function handleRRChannelSelect(interaction) {
  var setupData = pendingSetups.get(interaction.user.id);
  if (!setupData) {
    return interaction.reply({ content: 'Setup expired. Run the command again.', ephemeral: true });
  }
  setupData.channelId = interaction.values[0];
  pendingSetups.set(interaction.user.id, setupData);
  return interaction.reply({ content: 'Channel set to <#' + interaction.values[0] + '>. Run setup again to continue.', ephemeral: true });
}

module.exports.pendingSetups = pendingSetups;
