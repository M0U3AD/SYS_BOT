const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { errorEmbed, successEmbed, dashboardEmbed, COLORS } = require('../utils/embeds');
const emojis = require('../utils/emojis');
const { getGuildConfig, updateGuildConfig } = require('../database/utils/GuildConfig');

const pendingSetups = new Map();

function buildPanelEmbed(guild, data) {
  var pairs = data.pairs || [];
  var channel = data.channelId ? '<#' + data.channelId + '>' : 'Not set';
  var title = data.title || 'Select Your Roles';

  var pairsList = 'No role pairs added yet.';
  if (pairs.length > 0) {
    pairsList = pairs.map(function(p, i) {
      return '**' + (i + 1) + '.** ' + p.emoji + ' \u2192 <@&' + p.roleId + '>';
    }).join('\n');
  }

  return dashboardEmbed(
    emojis.role + ' Reaction Role Setup',
    '\u200b',
    [
      { name: emojis.tag + ' Title', value: title, inline: true },
      { name: emojis.channel + ' Channel', value: channel, inline: true },
      { name: emojis.chart + ' Pairs', value: '' + pairs.length, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: emojis.list + ' Role Pairs', value: pairsList, inline: false },
    ],
    { color: COLORS.blurple }
  );
}

function buildPanelButtons(hasPairs, hasChannel) {
  var row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rr_add_pair').setLabel('Add Role Pair').setStyle(ButtonStyle.Success).setEmoji(emojis.add),
    new ButtonBuilder().setCustomId('rr_remove_pair').setLabel('Remove Pair').setStyle(ButtonStyle.Danger).setEmoji(emojis.remove).setDisabled(!hasPairs),
    new ButtonBuilder().setCustomId('rr_set_channel').setLabel('Set Channel').setStyle(ButtonStyle.Primary).setEmoji(emojis.channel)
  );
  var row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rr_send').setLabel('Send Reaction Role').setStyle(ButtonStyle.Success).setEmoji(emojis.send).setDisabled(!hasPairs || !hasChannel),
    new ButtonBuilder().setCustomId('rr_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji(emojis.cross)
  );
  return [row1, row2];
}

async function refreshPanel(interaction, data) {
  var guild = interaction.guild;
  var embed = buildPanelEmbed(guild, data);
  var buttons = buildPanelButtons(data.pairs.length > 0, !!data.channelId);
  if (interaction.replied || interaction.deferred) {
    await interaction.editReply({ embeds: [embed], components: buttons }).catch(function() {});
  } else {
    await interaction.update({ embeds: [embed], components: buttons }).catch(function() {});
  }
}

function buildPreviewEmbed(data) {
  var pairs = data.pairs || [];
  var roleLines = pairs.map(function(p) {
    return p.emoji + ' <@&' + p.roleId + '>';
  }).join('\n');
  var description = 'Click the buttons below to **earn** or **remove** your roles.\n\n' + roleLines;
  return new EmbedBuilder()
    .setColor(COLORS.blurple)
    .setTitle(data.title || 'Select Your Roles')
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: 'SYS-F1ex \u2022 Reaction Roles' });
}

function buildPreviewButtons(data) {
  var pairs = data.pairs || [];
  if (pairs.length === 0) return [];
  var rows = [];
  var currentRow = new ActionRowBuilder();
  pairs.forEach(function(p, i) {
    if (i > 0 && i % 5 === 0) { rows.push(currentRow); currentRow = new ActionRowBuilder(); }
    currentRow.addComponents(
      new ButtonBuilder().setCustomId('rr_toggle_' + i).setLabel(p.roleName || ('Role ' + (i + 1))).setStyle(ButtonStyle.Success).setEmoji(p.emoji)
    );
  });
  rows.push(currentRow);
  return rows;
}

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
        var reply = { embeds: [errorEmbed('Error', 'An error occurred while executing this command.')], ephemeral: true };
        if (interaction.replied || interaction.deferred) { await interaction.followUp(reply); } else { await interaction.reply(reply); }
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('rr_toggle_')) { return handleReactionRoleToggle(interaction); }
      if (interaction.customId === 'rr_add_pair') { return handleRRAddPair(interaction); }
      if (interaction.customId === 'rr_remove_pair') { return handleRRRemovePair(interaction); }
      if (interaction.customId === 'rr_set_channel') { return handleRRSetChannel(interaction); }
      if (interaction.customId === 'rr_send') { return handleRRSend(interaction); }
      if (interaction.customId === 'rr_cancel') { return handleRRCancel(interaction); }
      if (interaction.customId.startsWith('verify_')) { return handleVerify(interaction); }
      if (interaction.customId === 'ticket_create') { return handleTicketCreate(interaction, client); }
      if (interaction.customId === 'ticket_close') { return handleTicketClose(interaction, client); }
      if (interaction.customId === 'ticket_claim') { return handleTicketClaim(interaction, client); }
      if (interaction.customId.startsWith('app_accept_') || interaction.customId.startsWith('app_deny_')) { return handleApplicationReview(interaction, client); }
      if (interaction.customId.startsWith('giveaway_')) { return handleGiveaway(interaction); }
      if (interaction.customId.startsWith('broadcast_confirm_') || interaction.customId.startsWith('broadcast_cancel_')) { return; }
      if (interaction.customId.startsWith('mod_confirm_') || interaction.customId.startsWith('mod_cancel_')) { return; }
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'rr_select_remove') {
      return handleRRSelectRemove(interaction);
    }

    if (interaction.isChannelSelectMenu() && interaction.customId === 'rr_channel_select') {
      return handleRRChannelSelect(interaction);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'rr_modal_add') {
      return handleRRModalSubmit(interaction);
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
  var role = interaction.guild.roles.cache.get(rr.roles[index].roleId);
  if (!role) return interaction.reply({ content: 'Role not found.', ephemeral: true });
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

async function handleRRAddPair(interaction) {
  var data = pendingSetups.get(interaction.user.id);
  if (!data) return interaction.reply({ embeds: [errorEmbed('Expired', 'Setup expired. Run the command again.')], ephemeral: true });

  var modal = new ModalBuilder().setCustomId('rr_modal_add').setTitle('Add Role Pair');
  var roleInput = new TextInputBuilder().setCustomId('rr_role_input').setLabel('Role (mention or ID)').setPlaceholder('@Moderator or 1234567890123456789').setStyle(TextInputStyle.Short).setRequired(true);
  var emojiInput = new TextInputBuilder().setCustomId('rr_emoji_input').setLabel('Emoji (unicode or custom)').setPlaceholder('🔴 or :moderator: or <a:star:123>').setStyle(TextInputStyle.Short).setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(roleInput), new ActionRowBuilder().addComponents(emojiInput));
  await interaction.showModal(modal);
}

async function handleRRModalSubmit(interaction) {
  var data = pendingSetups.get(interaction.user.id);
  if (!data) return interaction.reply({ embeds: [errorEmbed('Expired', 'Setup expired. Run the command again.')], ephemeral: true });

  var roleText = interaction.fields.getTextInputValue('rr_role_input').trim();
  var emojiText = interaction.fields.getTextInputValue('rr_emoji_input').trim();

  var roleId = null;
  var roleName = roleText;
  var roleMentionMatch = roleText.match(/^<@&(\d+)>$/);
  var directIdMatch = roleText.match(/^\d+$/);

  if (roleMentionMatch) {
    roleId = roleMentionMatch[1];
  } else if (directIdMatch) {
    roleId = directIdMatch[0];
  } else {
    var cleanText = roleText.replace(/^@/, '');
    var found = interaction.guild.roles.cache.find(function(r) { return r.name.toLowerCase() === cleanText.toLowerCase(); });
    if (found) { roleId = found.id; roleName = found.name; }
  }

  if (!roleId) {
    return interaction.reply({ embeds: [errorEmbed('Role Not Found', 'Could not find a role matching **' + roleText + '**.')], ephemeral: true });
  }

  var role = interaction.guild.roles.cache.get(roleId);
  if (role && interaction.guild.members.me && role.position >= interaction.guild.members.me.roles.highest.position) {
    return interaction.reply({ embeds: [errorEmbed('Role Too High', 'I cannot assign this role.')], ephemeral: true });
  }

  var duplicate = data.pairs.find(function(p) { return p.emoji === emojiText || p.roleId === roleId; });
  if (duplicate) {
    return interaction.reply({ embeds: [errorEmbed('Duplicate', 'This emoji or role is already in the list.')], ephemeral: true });
  }

  data.pairs.push({ roleId: roleId, roleName: roleName, emoji: emojiText });
  pendingSetups.set(interaction.user.id, data);

  await interaction.reply({ embeds: [successEmbed('Pair Added', emojis.check + ' Added **' + emojiText + '** \u2192 <@&' + roleId + '> (' + data.pairs.length + ' total pair(s))')], ephemeral: true });

  var embed = buildPanelEmbed(interaction.guild, data);
  var buttons = buildPanelButtons(data.pairs.length > 0, !!data.channelId);
  await interaction.message.edit({ embeds: [embed], components: buttons }).catch(function() {});
}

async function handleRRRemovePair(interaction) {
  var data = pendingSetups.get(interaction.user.id);
  if (!data) return interaction.reply({ embeds: [errorEmbed('Expired', 'Setup expired. Run the command again.')], ephemeral: true });
  if (data.pairs.length === 0) return interaction.reply({ embeds: [errorEmbed('Empty', 'No pairs to remove.')], ephemeral: true });

  var selectMenu = new StringSelectMenuBuilder().setCustomId('rr_select_remove').setPlaceholder('Select pairs to remove').setMinValues(1).setMaxValues(data.pairs.length);
  data.pairs.forEach(function(p, idx) {
    selectMenu.addOptions({ label: p.roleName || ('Role ' + (idx + 1)), description: p.emoji + ' \u2192 Role', value: '' + idx });
  });
  var selectRow = new ActionRowBuilder().addComponents(selectMenu);
  return interaction.reply({ content: '**Select pairs to remove:**', components: [selectRow], ephemeral: true });
}

async function handleRRSelectRemove(interaction) {
  var data = pendingSetups.get(interaction.user.id);
  if (!data) return interaction.reply({ content: 'Setup expired. Run the command again.', ephemeral: true });

  var indices = interaction.values.map(Number).sort(function(a, b) { return b - a; });
  indices.forEach(function(idx) { data.pairs.splice(idx, 1); });
  pendingSetups.set(interaction.user.id, data);

  await interaction.reply({ embeds: [successEmbed('Pairs Removed', emojis.trash + ' Removed **' + indices.length + '** pair(s). (' + data.pairs.length + ' remaining)')], ephemeral: true });

  var embed = buildPanelEmbed(interaction.guild, data);
  var buttons = buildPanelButtons(data.pairs.length > 0, !!data.channelId);
  await interaction.message.edit({ embeds: [embed], components: buttons }).catch(function() {});
}

async function handleRRSetChannel(interaction) {
  var data = pendingSetups.get(interaction.user.id);
  if (!data) return interaction.reply({ embeds: [errorEmbed('Expired', 'Setup expired. Run the command again.')], ephemeral: true });

  var channelSelect = new ChannelSelectMenuBuilder().setCustomId('rr_channel_select').setPlaceholder('Select a channel for reaction roles').setChannelTypes(ChannelType.GuildText);
  var channelRow = new ActionRowBuilder().addComponents(channelSelect);
  return interaction.reply({ content: '**Select the channel:**', components: [channelRow], ephemeral: true });
}

async function handleRRChannelSelect(interaction) {
  var data = pendingSetups.get(interaction.user.id);
  if (!data) return interaction.reply({ content: 'Setup expired. Run the command again.', ephemeral: true });

  data.channelId = interaction.values[0];
  pendingSetups.set(interaction.user.id, data);

  await interaction.reply({ embeds: [successEmbed('Channel Set', emojis.channel + ' Channel set to <#' + interaction.values[0] + '>')], ephemeral: true });

  var embed = buildPanelEmbed(interaction.guild, data);
  var buttons = buildPanelButtons(data.pairs.length > 0, !!data.channelId);
  await interaction.message.edit({ embeds: [embed], components: buttons }).catch(function() {});
}

async function handleRRSend(interaction) {
  var data = pendingSetups.get(interaction.user.id);
  if (!data) return interaction.reply({ embeds: [errorEmbed('Expired', 'Setup expired. Run the command again.')], ephemeral: true });
  if (data.pairs.length === 0) return interaction.reply({ embeds: [errorEmbed('No Pairs', 'Add at least one role pair.')], ephemeral: true });
  if (!data.channelId) return interaction.reply({ embeds: [errorEmbed('No Channel', 'Set a channel first.')], ephemeral: true });

  var targetChannel = interaction.guild.channels.cache.get(data.channelId);
  if (!targetChannel) return interaction.reply({ embeds: [errorEmbed('Channel Not Found', 'Channel no longer exists.')], ephemeral: true });

  var rrEmbed = buildPreviewEmbed(data);
  var rrButtons = buildPreviewButtons(data);

  try {
    var sentMsg = await targetChannel.send({ embeds: [rrEmbed], components: rrButtons });

    var config = await getGuildConfig(interaction.guild.id);
    if (!config.reactionRoles) config.reactionRoles = [];
    config.reactionRoles.push({
      messageId: sentMsg.id,
      channelId: targetChannel.id,
      title: data.title,
      roles: data.pairs.map(function(p) { return { roleId: p.roleId, emoji: p.emoji, roleName: p.roleName }; }),
    });
    await updateGuildConfig(interaction.guild.id, { reactionRoles: config.reactionRoles });

    pendingSetups.delete(interaction.user.id);
    if (data._timeout) clearTimeout(data._timeout);

    await interaction.update({
      embeds: [successEmbed('Reaction Role Sent', emojis.check + ' Sent to ' + targetChannel.toString() + ' with **' + data.pairs.length + '** role pair(s).')],
      components: []
    });
  } catch (err) {
    return interaction.reply({ embeds: [errorEmbed('Send Failed', err.message)], ephemeral: true });
  }
}

async function handleRRCancel(interaction) {
  var data = pendingSetups.get(interaction.user.id);
  pendingSetups.delete(interaction.user.id);
  if (data && data._timeout) clearTimeout(data._timeout);
  await interaction.update({ embeds: [errorEmbed('Setup Cancelled', 'Reaction role setup cancelled.')], components: [] });
}

function initSetup(userId, data) {
  if (pendingSetups.has(userId)) {
    var old = pendingSetups.get(userId);
    if (old._timeout) clearTimeout(old._timeout);
  }
  data._timeout = setTimeout(function() {
    pendingSetups.delete(userId);
  }, 300000);
  pendingSetups.set(userId, data);
}

module.exports.initSetup = initSetup;
module.exports.pendingSetups = pendingSetups;

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
  if (existing) return interaction.reply({ content: 'You already have an open ticket: <#' + existing.channelId + '>', ephemeral: true });
  var ticketChannel = await interaction.guild.channels.create({
    name: 'ticket-' + interaction.user.username, type: 0,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: ['ViewChannel'] },
      { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'AttachFiles'] },
      { id: config.tickets.supportRoleId || interaction.guild.roles.everyone.id, allow: ['ViewChannel', 'SendMessages'] },
    ],
  });
  await Ticket.create({ guildId: interaction.guild.id, channelId: ticketChannel.id, creatorId: interaction.user.id });
  var embed = new EmbedBuilder().setColor(config.embedColor).setTitle('🎫 Support Ticket').setDescription('Welcome ' + interaction.user + '! Describe your issue and a staff member will assist you.').setTimestamp().setFooter({ text: 'SYS-F1ex' });
  var { ActionRowBuilder: AR, ButtonBuilder: BB, ButtonStyle: BS } = require('discord.js');
  var row = new AR().addComponents(new BB().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(BS.Danger).setEmoji('🔒'), new BB().setCustomId('ticket_claim').setLabel('Claim').setStyle(BS.Primary).setEmoji('🙋'));
  await ticketChannel.send({ content: '<@' + interaction.user.id + '> <@&' + (config.tickets.supportRoleId || '') + '>', embeds: [embed], components: [row] });
  await interaction.reply({ content: 'Ticket created: ' + ticketChannel, ephemeral: true });
}

async function handleTicketClose(interaction, client) {
  var Ticket = require('../database/models/Ticket');
  var ticket = await Ticket.findOne({ channelId: interaction.channel.id, status: 'open' });
  if (!ticket) return interaction.reply({ content: 'This is not an open ticket.', ephemeral: true });
  var messages = await interaction.channel.messages.fetch({ limit: 100 });
  var transcript = messages.reverse().map(function(m) { return '[' + new Date(m.createdTimestamp).toLocaleString() + '] ' + m.author.tag + ': ' + (m.content || '(no text)'); }).join('\n');
  ticket.status = 'closed'; ticket.closedBy = interaction.user.id; ticket.closedAt = new Date(); ticket.transcript = transcript;
  await ticket.save();
  var config = await getGuildConfig(interaction.guild.id);
  if (config.tickets.transcriptChannelId) {
    var ch = interaction.guild.channels.cache.get(config.tickets.transcriptChannelId);
    if (ch) { var tEmbed = new EmbedBuilder().setColor('#ED4245').setTitle('🎫 Ticket Transcript').setDescription('Ticket by <@' + ticket.creatorId + '> — Closed by <@' + interaction.user.id + '>').addFields({ name: 'Transcript', value: transcript.substring(0, 4000) || 'Empty' }).setTimestamp(); ch.send({ embeds: [tEmbed] }); }
  }
  await interaction.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('🔒 Ticket closed. Deleting in 5s.').setTimestamp()] });
  setTimeout(function() { interaction.channel.delete().catch(function() {}); }, 5000);
}

async function handleTicketClaim(interaction, client) {
  var Ticket = require('../database/models/Ticket');
  var ticket = await Ticket.findOne({ channelId: interaction.channel.id, status: 'open' });
  if (!ticket) return interaction.reply({ content: 'Ticket not found.', ephemeral: true });
  ticket.claimedBy = interaction.user.id; await ticket.save();
  await interaction.reply({ embeds: [new EmbedBuilder().setColor('#57F287').setDescription('🙋 Ticket claimed by ' + interaction.user).setTimestamp()] });
}

async function handleApplicationReview(interaction, client) {
  var Application = require('../database/models/Application');
  var action = interaction.customId.startsWith('app_accept_') ? 'accepted' : 'denied';
  var appId = interaction.customId.split('_')[2];
  var app = await Application.findById(appId);
  if (!app) return interaction.reply({ content: 'Application not found.', ephemeral: true });
  app.status = action; await app.save();
  var member = interaction.guild.members.cache.get(app.userId);
  if (member) { var dmEmbed = new EmbedBuilder().setColor(action === 'accepted' ? '#57F287' : '#ED4245').setTitle('Application ' + (action === 'accepted' ? 'Accepted' : 'Denied')).setDescription('Your application for **' + interaction.guild.name + '** has been **' + action + '**.').setTimestamp(); member.send({ embeds: [dmEmbed] }).catch(function() {}); }
  await interaction.update({ embeds: [new EmbedBuilder().setColor(action === 'accepted' ? '#57F287' : '#ED4245').setDescription('Application **' + action + '** by ' + interaction.user).setTimestamp()], components: [] });
}

async function handleGiveaway(interaction) {
  var giveawayId = interaction.customId.replace('giveaway_', '');
  var Giveaway = require('../database/models/Giveaway');
  var giveaway = await Giveaway.findOne({ messageId: giveawayId, ended: false });
  if (!giveaway) return interaction.reply({ content: 'This giveaway has ended.', ephemeral: true });
  if (giveaway.entries.includes(interaction.user.id)) { giveaway.entries = giveaway.entries.filter(function(id) { return id !== interaction.user.id; }); await giveaway.save(); return interaction.reply({ content: 'You left the giveaway.', ephemeral: true }); }
  else { giveaway.entries.push(interaction.user.id); await giveaway.save(); return interaction.reply({ content: 'You entered the giveaway! Good luck!', ephemeral: true }); }
}
