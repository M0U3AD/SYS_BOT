const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
  var pairs = data.pairs || [];
  var channel = data.channelId ? '<#' + data.channelId + '>' : 'Not set';
  var title = data.title || 'Select Your Roles';
  var message = data.message || 'Not set';

  var pairsList = 'No role pairs added yet.';
  if (pairs.length > 0) {
    pairsList = pairs.map(function(p, i) {
      return '**' + (i + 1) + '.** ' + (p.emojiStr || p.emoji) + ' \u2192 <@&' + p.roleId + '>';
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
      { name: emojis.list + ' Message', value: message, inline: false },
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
    new ButtonBuilder().setCustomId('rr_set_message').setLabel('Set Message').setStyle(ButtonStyle.Primary).setEmoji(emojis.tag),
    new ButtonBuilder().setCustomId('rr_send').setLabel('Send Reaction Role').setStyle(ButtonStyle.Success).setEmoji(emojis.send).setDisabled(!hasPairs || !hasChannel),
    new ButtonBuilder().setCustomId('rr_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji(emojis.cross)
  );
  return [row1, row2];
}

function buildPreviewEmbed(data) {
  var pairs = data.pairs || [];
  var roleLines = pairs.map(function(p) {
    return (p.emojiStr || p.emoji) + ' <@&' + p.roleId + '>';
  }).join('\n');
  var description = data.message || 'Click the buttons below to **earn** or **remove** your roles.';
  description += '\n\n' + roleLines;
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
    if (i > 0 && i % 5 === 0) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId('rr_toggle_' + i)
        .setLabel(p.roleName || 'Role ' + (i + 1))
        .setStyle(ButtonStyle.Success)
        .setEmoji(p.emoji)
    );
  });
  rows.push(currentRow);
  return rows;
}

async function editPanelMessage(interaction) {
  var data = getSetup(interaction.user.id);
  if (!data) return;
  var guild = interaction.client.guilds.cache.get(data.guildId);
  if (!guild) return;
  try {
    var embed = buildPanelEmbed(guild, data);
    var buttons = buildPanelButtons(data.pairs.length > 0, !!data.channelId);
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
    console.error('Panel refresh error:', err.message);
  }
}

async function startSetup(source, client) {
  var guild = source.guild;
  var userId = source.member ? source.member.id : source.user.id;

  var data = {
    userId: userId,
    pairs: [],
    channelId: null,
    title: 'Select Your Roles',
    message: '',
    guildId: guild.id,
    panelMessage: null,
    panelInteraction: typeof source.editReply === 'function' ? source : null,
  };
  saveSetup(data);

  var embed = buildPanelEmbed(guild, data);
  var buttons = buildPanelButtons(false, false);

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

async function showAddModal(interaction) {
  var data = getSetup(interaction.user.id);
  if (!data) return interaction.reply({ embeds: [errorEmbed('Expired', 'Setup expired. Run the command again.')], ephemeral: true });

  var modal = new ModalBuilder().setCustomId('rr_modal_add').setTitle('Add Role Pair');
  var roleInput = new TextInputBuilder().setCustomId('rr_role_input').setLabel('Role (mention or ID)').setPlaceholder('@Moderator or 1234567890123456789').setStyle(TextInputStyle.Short).setRequired(true);
  var emojiInput = new TextInputBuilder().setCustomId('rr_emoji_input').setLabel('Emoji (unicode or custom)').setPlaceholder('🔴 or :moderator: or <a:star:123>').setStyle(TextInputStyle.Short).setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(roleInput), new ActionRowBuilder().addComponents(emojiInput));
  await interaction.showModal(modal);
}

async function resolveEmojiInput(text, interaction) {
  if (!text) return null;
  var animated = false;
  var match = text.match(/^<(?:(a):)?(\w{2,32}):(\d{17,19})>$/);
  if (match) {
    animated = Boolean(match[1]);
    return { animated: animated, name: match[2], id: match[3] };
  }
  var name = text.replace(/^:|:$/g, '').trim();
  if (name.length === 0) return null;
  var emojiColl = interaction.guild.emojis;
  if (!emojiColl) return null;
  var guildEmoji = emojiColl.cache.find(function(e) { return e.name.toLowerCase() === name.toLowerCase(); });
  if (!guildEmoji) {
    try {
      await emojiColl.fetch();
      guildEmoji = emojiColl.cache.find(function(e) { return e.name.toLowerCase() === name.toLowerCase(); });
    } catch (e) {}
  }
  if (guildEmoji) {
    return { animated: guildEmoji.animated, name: guildEmoji.name, id: guildEmoji.id };
  }
  if (text.includes(':') || text.includes('<') || text.includes('>')) return null;
  if (!/[^\x00-\x7F]/.test(text)) return null;
  return text;
}

function emojiToString(emoji) {
  if (typeof emoji === 'string') return emoji;
  return emoji.animated
    ? '<a:' + emoji.name + ':' + emoji.id + '>'
    : '<' + emoji.name + ':' + emoji.id + '>';
}

async function submitPair(interaction) {
  var data = getSetup(interaction.user.id);
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
    if (found) {
      roleId = found.id;
      roleName = found.name;
    }
  }

  if (!roleId) {
    return interaction.reply({ embeds: [errorEmbed('Role Not Found', 'Could not find a role matching **' + roleText + '**.')], ephemeral: true });
  }

  var role = interaction.guild.roles.cache.get(roleId);
  if (role && interaction.guild.members.me && role.position >= interaction.guild.members.me.roles.highest.position) {
    return interaction.reply({ embeds: [errorEmbed('Role Too High', 'I cannot assign this role.')], ephemeral: true });
  }

  var emoji = await resolveEmojiInput(emojiText, interaction);
  if (!emoji) {
    return interaction.reply({ embeds: [errorEmbed('Invalid Emoji', 'Could not resolve **' + emojiText + '**. Use a unicode emoji, a server emoji name like `:name:`, or a custom emoji like `<:name:id>` or `<a:name:id>`.')], ephemeral: true });
  }
  var emojiStr = emojiToString(emoji);

  var duplicate = data.pairs.find(function(p) { return (p.emojiStr || p.emoji) === emojiStr || p.roleId === roleId; });
  if (duplicate) {
    return interaction.reply({ embeds: [errorEmbed('Duplicate', 'This emoji or role is already in the list.')], ephemeral: true });
  }

  data.pairs.push({ roleId: roleId, roleName: roleName, emoji: emoji, emojiStr: emojiStr });
  saveSetup(data);

  await interaction.reply({ embeds: [successEmbed('Pair Added', emojis.check + ' Added **' + emojiStr + '** \u2192 <@&' + roleId + '> (' + data.pairs.length + ' total pair(s))')], ephemeral: true });
  await editPanelMessage(interaction);
}

async function showRemoveSelect(interaction) {
  var data = getSetup(interaction.user.id);
  if (!data) return interaction.reply({ embeds: [errorEmbed('Expired', 'Setup expired. Run the command again.')], ephemeral: true });
  if (data.pairs.length === 0) return interaction.reply({ embeds: [errorEmbed('Empty', 'No pairs to remove.')], ephemeral: true });

  var selectMenu = new StringSelectMenuBuilder().setCustomId('rr_select_remove').setPlaceholder('Select pairs to remove').setMinValues(1).setMaxValues(data.pairs.length);
  data.pairs.forEach(function(p, idx) {
    selectMenu.addOptions({ label: p.roleName || 'Role ' + (idx + 1), description: (p.emojiStr || p.emoji) + ' \u2192 Role', value: '' + idx });
  });
  var selectRow = new ActionRowBuilder().addComponents(selectMenu);
  return interaction.reply({ content: '**Select pairs to remove:**', components: [selectRow], ephemeral: true });
}

async function removePairs(interaction) {
  var data = getSetup(interaction.user.id);
  if (!data) return interaction.reply({ content: 'Setup expired. Run the command again.', ephemeral: true });

  var indices = interaction.values.map(Number).sort(function(a, b) { return b - a; });
  indices.forEach(function(idx) { data.pairs.splice(idx, 1); });
  saveSetup(data);

  await interaction.reply({ embeds: [successEmbed('Pairs Removed', emojis.trash + ' Removed **' + indices.length + '** pair(s). (' + data.pairs.length + ' remaining)')], ephemeral: true });
  await editPanelMessage(interaction);
}

async function showChannelSelect(interaction) {
  var data = getSetup(interaction.user.id);
  if (!data) return interaction.reply({ embeds: [errorEmbed('Expired', 'Setup expired. Run the command again.')], ephemeral: true });

  var channelSelect = new ChannelSelectMenuBuilder().setCustomId('rr_channel_select').setPlaceholder('Select a channel for reaction roles').setChannelTypes(ChannelType.GuildText);
  var channelRow = new ActionRowBuilder().addComponents(channelSelect);
  return interaction.reply({ content: '**Select the channel:**', components: [channelRow], ephemeral: true });
}

async function showMessageModal(interaction) {
  var data = getSetup(interaction.user.id);
  if (!data) return interaction.reply({ embeds: [errorEmbed('Expired', 'Setup expired. Run the command again.')], ephemeral: true });

  var modal = new ModalBuilder().setCustomId('rr_modal_message').setTitle('Set Reaction Role Message');
  var titleInput = new TextInputBuilder().setCustomId('rr_title_input').setLabel('Embed title').setValue(data.title || 'Select Your Roles').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256);
  var messageInput = new TextInputBuilder().setCustomId('rr_message_input').setLabel('Embed message (role list is appended)').setValue(data.message || '').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(3900);
  modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(messageInput));
  await interaction.showModal(modal);
}

async function submitMessage(interaction) {
  var data = getSetup(interaction.user.id);
  if (!data) return interaction.reply({ embeds: [errorEmbed('Expired', 'Setup expired. Run the command again.')], ephemeral: true });

  data.title = interaction.fields.getTextInputValue('rr_title_input').trim() || 'Select Your Roles';
  data.message = interaction.fields.getTextInputValue('rr_message_input').trim();
  saveSetup(data);

  await interaction.reply({ embeds: [successEmbed('Message Set', emojis.tag + ' Title: **' + data.title + '**\n' + emojis.edit + ' Message set.')], ephemeral: true });
  await editPanelMessage(interaction);
}

async function setChannel(interaction) {
  var data = getSetup(interaction.user.id);
  if (!data) return interaction.reply({ content: 'Setup expired. Run the command again.', ephemeral: true });

  data.channelId = interaction.values[0];
  saveSetup(data);

  await interaction.reply({ embeds: [successEmbed('Channel Set', emojis.channel + ' Channel set to <#' + interaction.values[0] + '>')], ephemeral: true });
  await editPanelMessage(interaction);
}

async function sendPanel(interaction) {
  var data = getSetup(interaction.user.id);
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
      message: data.message,
      roles: data.pairs.map(function(p) {
        return { roleId: p.roleId, emoji: p.emoji, roleName: p.roleName };
      }),
    });
    await updateGuildConfig(interaction.guild.id, { reactionRoles: config.reactionRoles });

    clearSetup(interaction.user.id);

    await interaction.update({
      embeds: [successEmbed('Reaction Role Sent', emojis.check + ' Sent to ' + targetChannel.toString() + ' with **' + data.pairs.length + '** role pair(s).')],
      components: []
    });
  } catch (err) {
    return interaction.reply({ embeds: [errorEmbed('Send Failed', err.message)], ephemeral: true });
  }
}

async function cancelSetup(interaction) {
  clearSetup(interaction.user.id);
  await interaction.update({ embeds: [errorEmbed('Setup Cancelled', 'Reaction role setup cancelled.')], components: [] });
}

async function handleToggle(interaction) {
  var index = parseInt(interaction.customId.replace('rr_toggle_', ''), 10);
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
    }
    await interaction.member.roles.add(role);
    return interaction.reply({ content: 'Added role **' + role.name + '**.', ephemeral: true });
  } catch (err) {
    return interaction.reply({ content: 'Failed to manage role. Contact a mod.', ephemeral: true });
  }
}

async function handleInteraction(interaction) {
  var id = interaction.customId || '';

  if (id.startsWith('rr_toggle_')) return handleToggle(interaction);
  if (id === 'rr_add_pair') return showAddModal(interaction);
  if (id === 'rr_remove_pair') return showRemoveSelect(interaction);
  if (id === 'rr_set_channel') return showChannelSelect(interaction);
  if (id === 'rr_set_message') return showMessageModal(interaction);
  if (id === 'rr_send') return sendPanel(interaction);
  if (id === 'rr_cancel') return cancelSetup(interaction);
  if (interaction.isStringSelectMenu && interaction.isStringSelectMenu() && id === 'rr_select_remove') return removePairs(interaction);
  if (interaction.isChannelSelectMenu && interaction.isChannelSelectMenu() && id === 'rr_channel_select') return setChannel(interaction);
  if (interaction.isModalSubmit && interaction.isModalSubmit() && id === 'rr_modal_add') return submitPair(interaction);
  if (interaction.isModalSubmit && interaction.isModalSubmit() && id === 'rr_modal_message') return submitMessage(interaction);
}

module.exports = {
  startSetup,
  handleInteraction,
  getSetup,
  setups,
};