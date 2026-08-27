const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { successEmbed, errorEmbed, dashboardEmbed, COLORS } = require('./embeds');
const emojis = require('./emojis');
const { getGuildConfig, updateGuildConfig } = require('../database/utils/GuildConfig');

const setups = new Map();
const SETUP_TTL = 300000;

function getSetup(userId) {
  return setups.get(userId) || null;
}

function saveSetup(data) {
  if (data._timeout) clearTimeout(data._timeout);
  data._timeout = setTimeout(function() {
    if (setups.get(data.userId) === data) setups.delete(data.userId);
  }, SETUP_TTL);
  setups.set(data.userId, data);
}

function clearSetup(userId) {
  var data = setups.get(userId);
  setups.delete(userId);
  if (data && data._timeout) clearTimeout(data._timeout);
}

function buildPanelEmbed(guild, data) {
  var roles = data.roles || [];
  var channel = data.channelId ? '<#' + data.channelId + '>' : 'Not set';
  var rolesList = roles.length
    ? roles.map(function(id) {
        var r = guild.roles.cache.get(id);
        return r ? r.toString() : '<@&' + id + '>';
      }).join(' ')
    : 'No roles selected yet.';

  return dashboardEmbed(
    emojis.role + ' Self-Role Setup',
    'Display a dropdown so members can pick and remove their own roles.',
    [
      { name: emojis.channel + ' Channel', value: channel, inline: true },
      { name: emojis.tag + ' Title', value: data.title || 'Choose Your Roles', inline: true },
      { name: emojis.chart + ' Roles', value: '' + roles.length + ' / 25', inline: true },
      { name: emojis.edit + ' Description', value: data.description || 'Not set', inline: false },
      { name: emojis.role + ' Roles', value: rolesList, inline: false },
    ],
    { color: COLORS.blurple }
  );
}

function buildPanelButtons(roles, channelId) {
  var hasRoles = roles && roles.length > 0;
  var row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sr_add_roles').setLabel('Add Roles').setStyle(ButtonStyle.Success).setEmoji(emojis.add),
    new ButtonBuilder().setCustomId('sr_clear_roles').setLabel('Clear Roles').setStyle(ButtonStyle.Danger).setEmoji(emojis.remove).setDisabled(!hasRoles),
    new ButtonBuilder().setCustomId('sr_set_channel').setLabel('Set Channel').setStyle(ButtonStyle.Primary).setEmoji(emojis.channel)
  );
  var row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sr_set_message').setLabel('Set Title / Message').setStyle(ButtonStyle.Primary).setEmoji(emojis.edit),
    new ButtonBuilder().setCustomId('sr_send').setLabel('Send Menu').setStyle(ButtonStyle.Success).setEmoji(emojis.send).setDisabled(!hasRoles || !channelId),
    new ButtonBuilder().setCustomId('sr_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji(emojis.cross)
  );
  return [row1, row2];
}

function buildMenuEmbed(guild, data) {
  var roles = data.roles || [];
  var description = data.description || 'Select the roles you want from the dropdown below.';
  var embed = new EmbedBuilder()
    .setColor(COLORS.blurple)
    .setTitle(data.title || 'Choose Your Roles')
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: 'SYS-F1ex ' + '\u2022' + ' Self Roles' });

  var lines = roles.map(function(id) {
    var r = guild.roles.cache.get(id);
    return r ? r.toString() : '<@&' + id + '>';
  }).join(' ');
  if (lines) embed.addFields({ name: emojis.role + ' Available Roles', value: lines });
  return embed;
}

function buildMenuRow(guild, data) {
  var roles = (data.roles || []).slice(0, 25);
  var select = new StringSelectMenuBuilder()
    .setCustomId('sr_pick')
    .setPlaceholder('Pick your roles...')
    .setMinValues(0)
    .setMaxValues(Math.min(roles.length, 25));

  roles.forEach(function(id) {
    var r = guild.roles.cache.get(id);
    select.addOptions({
      label: r ? r.name : 'Role',
      description: r ? 'Toggle this role for yourself' : 'Unknown role',
      value: id,
    });
  });
  return new ActionRowBuilder().addComponents(select);
}

async function editPanelMessage(interaction) {
  var data = getSetup(interaction.user.id);
  if (!data) return;
  var guild = interaction.client.guilds.cache.get(data.guildId);
  if (!guild) return;
  try {
    var embed = buildPanelEmbed(guild, data);
    var buttons = buildPanelButtons(data.roles, data.channelId);
    if (data.panelInteraction && data.panelInteraction.editReply && data.panelInteraction.ephemeral) {
      await data.panelInteraction.editReply({ embeds: [embed], components: buttons });
      return;
    }
    if (data.panelMessage && data.panelMessage.edit) {
      await data.panelMessage.edit({ embeds: [embed], components: buttons });
      return;
    }
    if (data.panelMsgId && data.panelChannelId) {
      var channel = guild.channels.cache.get(data.panelChannelId);
      if (!channel || !channel.isTextBased()) return;
      var msg = await channel.messages.fetch(data.panelMsgId);
      await msg.edit({ embeds: [embed], components: buttons });
    }
  } catch (err) {
    console.error('Self-role panel refresh error:', err.message);
  }
}

async function startSetup(source, client) {
  var guild = source.guild;
  var userId = source.member ? source.member.id : source.user.id;

  var data = {
    userId: userId,
    roles: [],
    channelId: null,
    title: 'Choose Your Roles',
    description: '',
    guildId: guild.id,
    panelMessage: null,
    panelInteraction: typeof source.editReply === 'function' ? source : null,
  };
  saveSetup(data);

  var embed = buildPanelEmbed(guild, data);
  var buttons = buildPanelButtons([], null);

  var msg;
  if (source.replied || source.deferred) {
    await source.editReply({ embeds: [embed], components: buttons });
    msg = await source.fetchReply();
  } else {
    msg = await source.reply({ embeds: [embed], components: buttons });
  }

  data.panelMessage = msg;
  saveSetup(data);
}

async function showRoleSelect(interaction) {
  var data = getSetup(interaction.user.id);
  if (!data) return interaction.reply({ embeds: [errorEmbed('Expired', 'Setup expired. Run the command again.')], ephemeral: true });

  var select = new RoleSelectMenuBuilder()
    .setCustomId('sr_role_select')
    .setPlaceholder('Select roles members can self-assign')
    .setMinValues(1)
    .setMaxValues(25);
  var row = new ActionRowBuilder().addComponents(select);
  return interaction.reply({ content: '**Select roles to include in the menu:**', components: [row], ephemeral: true });
}

async function selectRoles(interaction) {
  var data = getSetup(interaction.user.id);
  if (!data) return interaction.reply({ embeds: [errorEmbed('Expired', 'Setup expired. Run the command again.')], ephemeral: true });

  var assignable = [];
  var skipped = [];
  for (const id of interaction.values) {
    var role = interaction.guild.roles.cache.get(id);
    if (!role) continue;
    var me = interaction.guild.members.me;
    if (role.managed) { skipped.push(role.name); continue; }
    if (me && role.position >= me.roles.highest.position) { skipped.push(role.name); continue; }
    assignable.push(id);
  }
  data.roles = assignable;
  saveSetup(data);

  var note = assignable.length ? 'Added **' + assignable.length + '** role(s).' : 'No assignable roles selected.';
  if (skipped.length) note += '\n⚠️ Skipped (I cannot assign these): ' + skipped.join(', ');
  await interaction.reply({ embeds: [successEmbed('Roles Set', note)], ephemeral: true });
  await editPanelMessage(interaction);
}

async function clearRoles(interaction) {
  var data = getSetup(interaction.user.id);
  if (!data) return interaction.reply({ embeds: [errorEmbed('Expired', 'Setup expired. Run the command again.')], ephemeral: true });

  data.roles = [];
  saveSetup(data);
  await interaction.reply({ embeds: [successEmbed('Roles Cleared', 'No roles will be self-assignable.')], ephemeral: true });
  await editPanelMessage(interaction);
}

async function showChannelSelect(interaction) {
  var data = getSetup(interaction.user.id);
  if (!data) return interaction.reply({ embeds: [errorEmbed('Expired', 'Setup expired. Run the command again.')], ephemeral: true });

  var channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('sr_channel_select')
    .setPlaceholder('Select the channel for the role menu')
    .setChannelTypes(ChannelType.GuildText);
  var row = new ActionRowBuilder().addComponents(channelSelect);
  return interaction.reply({ content: '**Select the channel:**', components: [row], ephemeral: true });
}

async function setChannel(interaction) {
  var data = getSetup(interaction.user.id);
  if (!data) return interaction.reply({ content: 'Setup expired. Run the command again.', ephemeral: true });

  data.channelId = interaction.values[0];
  saveSetup(data);
  await interaction.reply({ embeds: [successEmbed('Channel Set', emojis.channel + ' Role menu will be posted in <#' + interaction.values[0] + '>.')], ephemeral: true });
  await editPanelMessage(interaction);
}

async function showMessageModal(interaction) {
  var data = getSetup(interaction.user.id);
  if (!data) return interaction.reply({ embeds: [errorEmbed('Expired', 'Setup expired. Run the command again.')], ephemeral: true });

  var modal = new ModalBuilder().setCustomId('sr_modal_message').setTitle('Self-Role Menu Message');
  var titleInput = new TextInputBuilder()
    .setCustomId('sr_title_input')
    .setLabel('Embed title')
    .setValue(data.title || 'Choose Your Roles')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(256);
  var descriptionInput = new TextInputBuilder()
    .setCustomId('sr_description_input')
    .setLabel('Description') 
    .setValue(data.description || '')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(2000);
  modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descriptionInput));
  await interaction.showModal(modal);
}

async function submitMessage(interaction) {
  var data = getSetup(interaction.user.id);
  if (!data) return interaction.reply({ embeds: [errorEmbed('Expired', 'Setup expired. Run the command again.')], ephemeral: true });

  data.title = interaction.fields.getTextInputValue('sr_title_input').trim() || 'Choose Your Roles';
  data.description = interaction.fields.getTextInputValue('sr_description_input').trim();
  saveSetup(data);
  await interaction.reply({ embeds: [successEmbed('Message Set', emojis.tag + ' Title: **' + data.title + '**')], ephemeral: true });
  await editPanelMessage(interaction);
}

async function sendMenu(interaction) {
  var data = getSetup(interaction.user.id);
  if (!data) return interaction.reply({ embeds: [errorEmbed('Expired', 'Setup expired. Run the command again.')], ephemeral: true });
  if (!data.roles || data.roles.length === 0) return interaction.reply({ embeds: [errorEmbed('No Roles', 'Add at least one role first.')], ephemeral: true });
  if (!data.channelId) return interaction.reply({ embeds: [errorEmbed('No Channel', 'Set a channel first.')], ephemeral: true });

  var targetChannel = interaction.guild.channels.cache.get(data.channelId);
  if (!targetChannel) return interaction.reply({ embeds: [errorEmbed('Channel Not Found', 'Channel no longer exists.')], ephemeral: true });

  var config = await getGuildConfig(interaction.guild.id);
  var prev = config.selfRoles;
  if (prev && prev.enabled && prev.messageId && prev.channelId) {
    try {
      var oldChannel = interaction.guild.channels.cache.get(prev.channelId);
      if (oldChannel) {
        var oldMsg = await oldChannel.messages.fetch(prev.messageId).catch(() => null);
        if (oldMsg) await oldMsg.delete().catch(() => {});
      }
    } catch (e) {}
  }

  try {
    var sentMsg = await targetChannel.send({
      embeds: [buildMenuEmbed(interaction.guild, data)],
      components: [buildMenuRow(interaction.guild, data)],
    });

    await updateGuildConfig(interaction.guild.id, {
      'selfRoles.enabled': true,
      'selfRoles.channelId': targetChannel.id,
      'selfRoles.messageId': sentMsg.id,
      'selfRoles.title': data.title,
      'selfRoles.description': data.description,
      'selfRoles.roles': data.roles,
    });

    clearSetup(interaction.user.id);
    await interaction.update({
      embeds: [successEmbed('Self-Role Menu Sent', emojis.check + ' Posted to ' + targetChannel.toString() + ' with **' + data.roles.length + '** role(s).')],
      components: [],
    });
  } catch (err) {
    return interaction.reply({ embeds: [errorEmbed('Send Failed', err.message)], ephemeral: true });
  }
}

async function cancelSetup(interaction) {
  clearSetup(interaction.user.id);
  await interaction.update({ embeds: [errorEmbed('Setup Cancelled', 'Self-role setup cancelled.')], components: [] });
}

async function handlePick(interaction) {
  var config = await getGuildConfig(interaction.guild.id);
  var sr = config.selfRoles;
  if (!sr || !sr.enabled || sr.messageId !== interaction.message.id) {
    return interaction.reply({ content: 'This role menu is no longer active.', ephemeral: true });
  }

  var allowed = new Set(sr.roles || []);
  if (allowed.size === 0) return interaction.reply({ content: 'This menu has no roles configured.', ephemeral: true });

  var selected = new Set(interaction.values);
  var held = new Set(interaction.member.roles.cache.keys());

  var toAdd = [...selected].filter(id => allowed.has(id) && !held.has(id));
  var toRemove = [...held].filter(id => allowed.has(id) && !selected.has(id));

  var added = 0;
  var removed = 0;
  var failed = [];
  for (const id of toAdd) {
    var role = interaction.guild.roles.cache.get(id);
    if (!role) continue;
    try {
      await interaction.member.roles.add(role);
      added++;
    } catch (e) {
      failed.push(role.name);
    }
  }
  for (const id of toRemove) {
    var delRole = interaction.guild.roles.cache.get(id);
    if (!delRole) continue;
    try {
      await interaction.member.roles.remove(delRole);
      removed++;
    } catch (e) {
      failed.push(delRole.name);
    }
  }

  var parts = [];
  if (added) parts.push('✅ Added **' + added + '** role(s).');
  if (removed) parts.push('🗑️ Removed **' + removed + '** role(s).');
  if (parts.length === 0) parts.push('No changes.');
  if (failed.length) parts.push('⚠️ Could not update: ' + failed.join(', '));
  return interaction.reply({ content: parts.join('\n'), ephemeral: true });
}

async function handleInteraction(interaction) {
  var id = interaction.customId || '';

  if (id === 'sr_pick') return handlePick(interaction);

  if (interaction.isButton && interaction.isButton()) {
    if (id === 'sr_add_roles') return showRoleSelect(interaction);
    if (id === 'sr_clear_roles') return clearRoles(interaction);
    if (id === 'sr_set_channel') return showChannelSelect(interaction);
    if (id === 'sr_set_message') return showMessageModal(interaction);
    if (id === 'sr_send') return sendMenu(interaction);
    if (id === 'sr_cancel') return cancelSetup(interaction);
  }
  if (interaction.isRoleSelectMenu && interaction.isRoleSelectMenu() && id === 'sr_role_select') return selectRoles(interaction);
  if (interaction.isChannelSelectMenu && interaction.isChannelSelectMenu() && id === 'sr_channel_select') return setChannel(interaction);
  if (interaction.isModalSubmit && interaction.isModalSubmit() && id === 'sr_modal_message') return submitMessage(interaction);
}

module.exports = {
  startSetup,
  handleInteraction,
  getSetup,
  setups,
  buildPanelEmbed,
  buildMenuEmbed,
  buildMenuRow,
};