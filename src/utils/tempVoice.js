const {
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const TempChannel = require('../database/models/TempChannel');
const { getGuildConfig } = require('../database/utils/GuildConfig');

const activeChannels = new Map();
const pendingDeletes = new Map();

const OWNER_PERMISSIONS = {
  ViewChannel: true,
  Connect: true,
  Speak: true,
  Stream: true,
  UseVAD: true,
  ManageChannels: true,
  MoveMembers: true,
};

async function getTempVoiceConfig(guildId) {
  const config = await getGuildConfig(guildId);
  return config.tempVoice || {};
}

async function saveEntry(entry) {
  await TempChannel.updateOne(
    { voiceChannelId: entry.voiceChannelId },
    {
      guildId: entry.guildId,
      voiceChannelId: entry.voiceChannelId,
      textChannelId: entry.textChannelId,
      ownerId: entry.ownerId,
      locked: entry.locked,
      panelMessageId: entry.panelMessageId,
      createdAt: new Date(entry.createdAt || Date.now()),
    },
    { upsert: true }
  ).catch(() => {});
}

async function getEntry(voiceChannelId) {
  const cached = activeChannels.get(voiceChannelId);
  if (cached) return cached;
  const doc = await TempChannel.findOne({ voiceChannelId }).lean().catch(() => null);
  if (!doc) return null;
  const entry = {
    voiceChannelId: doc.voiceChannelId,
    textChannelId: doc.textChannelId,
    ownerId: doc.ownerId,
    guildId: doc.guildId,
    createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
    locked: doc.locked || false,
    panelMessageId: doc.panelMessageId || null,
  };
  activeChannels.set(voiceChannelId, entry);
  return entry;
}

async function isActiveRoom(guildId, channelId) {
  const cached = activeChannels.get(channelId);
  if (cached && cached.guildId === guildId) return true;
  return Boolean(await TempChannel.exists({ voiceChannelId: channelId, guildId }).catch(() => null));
}

async function findRoomForUser(guildId, userId) {
  for (const entry of activeChannels.values()) {
    if (entry.guildId === guildId && entry.ownerId === userId) return entry;
  }
  return TempChannel.findOne({ guildId, ownerId: userId }).lean().catch(() => null);
}

function clearScheduledDelete(voiceChannelId) {
  const timer = pendingDeletes.get(voiceChannelId);
  if (timer) {
    clearTimeout(timer);
    pendingDeletes.delete(voiceChannelId);
  }
}

async function scheduleEmptyTimeout(guild, voiceChannelId) {
  clearScheduledDelete(voiceChannelId);
  const tvConfig = await getTempVoiceConfig(guild.id);
  const seconds = Math.max(0, Number(tvConfig.emptyTimeoutSeconds) || 0);
  const timer = setTimeout(async () => {
    pendingDeletes.delete(voiceChannelId);
    const vc = guild.channels.cache.get(voiceChannelId);
    if (vc && vc.members.size === 0) {
      await cleanupChannel(guild, voiceChannelId);
    }
  }, seconds * 1000);
  pendingDeletes.set(voiceChannelId, timer);
}

function buildPanel(voice, entry, color) {
  const members = voice && voice.members ? [...voice.members.values()] : [];

  const embed = new EmbedBuilder()
    .setColor(color || '#5865F2')
    .setTitle('🎛️ Voice Channel Control Panel')
    .setDescription('You are the **owner** of this room. Use the buttons below to manage it.')
    .addFields(
      { name: '👑 Owner', value: '<@' + entry.ownerId + '>', inline: true },
      { name: '🔒 Access', value: entry.locked ? '🔒 Locked' : '🌐 Public', inline: true },
      { name: '👤 Members', value: String(members.length), inline: true },
      { name: '👥 User Limit', value: voice && voice.userLimit ? String(voice.userLimit) : 'Unlimited', inline: true },
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(entry.locked ? 'tv_unlock' : 'tv_lock')
      .setLabel(entry.locked ? 'Unlock' : 'Lock')
      .setEmoji(entry.locked ? '🔓' : '🔒')
      .setStyle(entry.locked ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('tv_rename')
      .setLabel('Rename')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('tv_limit')
      .setLabel('User Limit')
      .setEmoji('👥')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('tv_transfer')
      .setLabel('Transfer')
      .setEmoji('👑')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('tv_delete')
      .setLabel('Delete')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('tv_kick')
      .setLabel('Kick')
      .setEmoji('👢')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('tv_mute')
      .setLabel('Mute')
      .setEmoji('🔇')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('tv_unmute')
      .setLabel('Unmute')
      .setEmoji('🔊')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('tv_refresh')
      .setLabel('Refresh')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2] };
}

function userSelect(placeholder, customId) {
  const row = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .setMinValues(1)
      .setMaxValues(1),
  );
  return { content: placeholder, components: [row], ephemeral: true };
}

async function sendControlPanel(textChannel, voice, entry, member, color) {
  const msg = await textChannel
    .send({ content: '<@' + member.id + '>', ...buildPanel(voice, entry, color) })
    .catch(() => null);
  if (msg) {
    entry.panelMessageId = msg.id;
    await saveEntry(entry);
  }
}

async function updateControlPanel(guild, entry) {
  if (!entry.textChannelId || !entry.panelMessageId) return;
  const textChannel = guild.channels.cache.get(entry.textChannelId);
  const voice = guild.channels.cache.get(entry.voiceChannelId);
  if (!textChannel || !voice) return;
  try {
    const config = await getGuildConfig(guild.id);
    const msg = await textChannel.messages.fetch(entry.panelMessageId);
    await msg.edit(buildPanel(voice, entry, config.embedColor));
  } catch (e) {
    // panel message gone, ignore
  }
}

async function createTempChannels(guild, member, tvConfig) {
  const category = guild.channels.cache.get(tvConfig.categoryId) || null;
  const user = member.user;

  const vcName = String(tvConfig.channelNameTemplate || '{user}\'s Channel')
    .replace('{user}', user.username)
    .slice(0, 100) || user.username + ' Channel';

  const voiceOverwrites = [
    { id: member.id, allow: OWNER_PERMISSIONS },
  ];
  for (const rid of tvConfig.modRoleIds || []) {
    const role = guild.roles.cache.get(rid);
    if (role) {
      voiceOverwrites.push({ id: rid, allow: ['ViewChannel', 'Connect', 'MoveMembers', 'ManageChannels'] });
    }
  }

  const voice = await guild.channels.create({
    name: vcName,
    type: ChannelType.GuildVoice,
    parent: category ? category.id : undefined,
    userLimit: tvConfig.userLimit > 0 ? tvConfig.userLimit : 0,
    permissionOverwrites: voiceOverwrites,
  });

  const entry = {
    voiceChannelId: voice.id,
    textChannelId: null,
    ownerId: member.id,
    guildId: guild.id,
    createdAt: Date.now(),
    locked: false,
    panelMessageId: null,
  };
  activeChannels.set(voice.id, entry);
  await saveEntry(entry);

  try {
    await member.voice.setChannel(voice);
  } catch (e) {
    activeChannels.delete(voice.id);
    await TempChannel.deleteMany({ voiceChannelId: voice.id }).catch(() => {});
    await voice.delete('User left before move').catch(() => {});
    return null;
  }

  let text = null;
  if (tvConfig.createModChannel !== false) {
    const modName = String(tvConfig.modChannelName || 'mod-{user}')
      .replace('{user}', user.username)
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .slice(0, 100) || ('mod-' + user.id.slice(0, 8));

    const modOverwrites = [
      { id: guild.id, deny: ['ViewChannel'] },
      { id: member.id, allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'ReadMessageHistory'] },
    ];
    for (const rid of tvConfig.modRoleIds || []) {
      const role = guild.roles.cache.get(rid);
      if (role) {
        modOverwrites.push({ id: rid, allow: ['ViewChannel', 'SendMessages', 'ManageMessages', 'ReadMessageHistory', 'ManageChannels'] });
      }
    }

    text = await guild.channels.create({
      name: modName,
      type: ChannelType.GuildText,
      parent: category ? category.id : undefined,
      permissionOverwrites: modOverwrites,
    });
    entry.textChannelId = text.id;
    await saveEntry(entry);
  }

  if (text) {
    const config = await getGuildConfig(guild.id);
    await text.send({
      content: '🛡️ **Moderation channel** for `' + vcName + '` · Owner: ' + user,
    }).catch(() => {});
    await sendControlPanel(text, voice, entry, member, config.embedColor);
  }

  return { voice, text };
}

async function cleanupChannel(guild, voiceChannelId, entry) {
  clearScheduledDelete(voiceChannelId);
  entry = entry || await getEntry(voiceChannelId);

  if (entry) {
    if (entry.textChannelId) {
      const textChannel = guild.channels.cache.get(entry.textChannelId);
      if (textChannel && textChannel.deletable) {
        await textChannel.delete('Temporary voice channel closed').catch(() => {});
      }
    }
    activeChannels.delete(voiceChannelId);
    await TempChannel.deleteMany({ voiceChannelId }).catch(() => {});
  }

  const voice = guild.channels.cache.get(voiceChannelId);
  if (voice && voice.deletable) {
    await voice.delete('Temporary voice channel closed').catch(() => {});
  }
}

async function handleUserSelect(interaction, entry, voice) {
  const isOwner = interaction.user.id === entry.ownerId;
  const isStaff = interaction.member.permissions.has('ManageGuild') || interaction.member.permissions.has('ManageChannels');
  if (!isOwner && !isStaff) {
    return interaction.reply({ content: 'Only the channel owner can use this panel.', ephemeral: true });
  }

  const guild = interaction.guild;
  const targetId = interaction.values[0];
  const member = guild.members.cache.get(targetId) || await guild.members.fetch(targetId).catch(() => null);

  if (interaction.customId === 'tv_transfer') {
    if (!member || !member.user) {
      return interaction.reply({ content: 'User not found.', ephemeral: true });
    }
    const previousOwnerId = entry.ownerId;
    if (voice) {
      await voice.permissionOverwrites.delete(previousOwnerId).catch(() => {});
      await voice.permissionOverwrites.create(member.id, OWNER_PERMISSIONS).catch(() => {});
    }
    entry.ownerId = member.id;
    await saveEntry(entry);
    await updateControlPanel(guild, entry);
    return interaction.reply({
      content: '👑 Ownership transferred from <@' + previousOwnerId + '> to <@' + member.id + '>.',
      ephemeral: true,
    });
  }

  if (!member || !member.user) {
    return interaction.reply({ content: 'User not found.', ephemeral: true });
  }

  if (interaction.customId === 'tv_kick') {
    try {
      await member.voice.disconnect('Kicked from temporary room').catch(() => {});
      if (voice && voice.members.size === 0) {
        await scheduleEmptyTimeout(guild, entry.voiceChannelId);
      }
      await updateControlPanel(guild, entry);
      return interaction.reply({ content: '👢 Kicked <@' + member.id + '>.', ephemeral: true });
    } catch (e) {
      return interaction.reply({ content: 'Failed to kick that user.', ephemeral: true });
    }
  }

  if (interaction.customId === 'tv_mute') {
    try {
      await member.voice.setMute(true);
      return interaction.reply({ content: '🔇 Server-muted <@' + member.id + '>.', ephemeral: true });
    } catch (e) {
      return interaction.reply({ content: 'Failed to mute that user.', ephemeral: true });
    }
  }

  if (interaction.customId === 'tv_unmute') {
    try {
      await member.voice.setMute(false);
      return interaction.reply({ content: '🔊 Unmuted <@' + member.id + '>.', ephemeral: true });
    } catch (e) {
      return interaction.reply({ content: 'Failed to unmute that user.', ephemeral: true });
    }
  }

  return interaction.reply({ content: 'Unknown action.', ephemeral: true });
}

async function handleInteraction(interaction) {
  const entry = [...activeChannels.values()].find(e => e.textChannelId === interaction.channel.id);
  if (!entry) {
    return interaction.reply({ content: 'This control panel is no longer active.', ephemeral: true });
  }

  const guild = interaction.guild;
  const voice = guild.channels.cache.get(entry.voiceChannelId);

  if (interaction.isUserSelectMenu()) {
    return handleUserSelect(interaction, entry, voice);
  }

  const isOwner = interaction.user.id === entry.ownerId;
  const isStaff = interaction.member.permissions.has('ManageGuild') || interaction.member.permissions.has('ManageChannels');
  if (!isOwner && !isStaff) {
    return interaction.reply({ content: 'Only the channel owner can use this panel.', ephemeral: true });
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'tv_lock' || interaction.customId === 'tv_unlock') {
      if (!voice) return interaction.reply({ content: 'Voice channel not found.', ephemeral: true });
      const locking = interaction.customId === 'tv_lock';
      await voice.permissionOverwrites.edit(guild.id, { Connect: locking ? false : null }).catch(() => {});
      entry.locked = locking;
      await saveEntry(entry);
      const config = await getGuildConfig(guild.id);
      return interaction.update(buildPanel(voice, entry, config.embedColor));
    }

    if (interaction.customId === 'tv_rename') {
      const modal = new ModalBuilder().setCustomId('tv_rename_modal').setTitle('Rename Channel');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tv_name')
          .setLabel('Channel name')
          .setStyle(TextInputStyle.Short)
          .setValue(voice ? voice.name : '')
          .setMaxLength(100)
          .setRequired(true),
      ));
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'tv_limit') {
      const modal = new ModalBuilder().setCustomId('tv_limit_modal').setTitle('User Limit');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tv_limit_value')
          .setLabel('Limit (0 = unlimited)')
          .setStyle(TextInputStyle.Short)
          .setValue(String((voice && voice.userLimit) || 0))
          .setMaxLength(2)
          .setRequired(true),
      ));
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'tv_transfer') {
      return interaction.reply(userSelect('Select the new room owner...', 'tv_transfer'));
    }

    if (interaction.customId === 'tv_kick') {
      return interaction.reply(userSelect('Select a user to kick...', 'tv_kick'));
    }

    if (interaction.customId === 'tv_mute') {
      return interaction.reply(userSelect('Select a user to server-mute...', 'tv_mute'));
    }

    if (interaction.customId === 'tv_unmute') {
      return interaction.reply(userSelect('Select a user to unmute...', 'tv_unmute'));
    }

    if (interaction.customId === 'tv_refresh') {
      const config = await getGuildConfig(guild.id);
      return interaction.update(buildPanel(voice, entry, config.embedColor));
    }

    if (interaction.customId === 'tv_delete') {
      await interaction.reply({ content: '🗑️ Deleting your channel...', ephemeral: true });
      await cleanupChannel(guild, entry.voiceChannelId, entry);
      return;
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'tv_rename_modal') {
      const name = interaction.fields.getTextInputValue('tv_name').trim().slice(0, 100);
      if (!name) return interaction.reply({ content: 'Name cannot be empty.', ephemeral: true });
      if (voice) await voice.setName(name).catch(() => {});
      const config = await getGuildConfig(guild.id);
      return interaction.update(buildPanel(voice, entry, config.embedColor));
    }

    if (interaction.customId === 'tv_limit_modal') {
      const limit = parseInt(interaction.fields.getTextInputValue('tv_limit_value').trim(), 10);
      if (isNaN(limit) || limit < 0 || limit > 99) {
        return interaction.reply({ content: 'Enter a number between **0** and **99**.', ephemeral: true });
      }
      if (voice) await voice.setUserLimit(limit).catch(() => {});
      const config = await getGuildConfig(guild.id);
      return interaction.update(buildPanel(voice, entry, config.embedColor));
    }
  }
}

async function handleVoiceStateUpdate(oldState, newState) {
  const guild = newState.guild || (oldState && oldState.guild);
  if (!guild) return;

  const tvConfig = await getTempVoiceConfig(guild.id);
  if (!tvConfig.enabled || !tvConfig.triggerChannelId) return;

  const oldChannelId = oldState ? oldState.channelId : null;
  const newChannelId = newState ? newState.channelId : null;
  const userId = (newState && newState.id) || (oldState && oldState.id);

  if (newChannelId === tvConfig.triggerChannelId) {
    let member = newState.member;
    if (!member || !member.user) {
      try {
        member = await guild.members.fetch(userId).catch(() => null);
      } catch (e) {
        member = null;
      }
    }
    if (!member || !member.user || member.user.bot) return;

    const existing = await findRoomForUser(guild.id, member.id);
    if (existing) {
      const targetVoice = guild.channels.cache.get(existing.voiceChannelId);
      if (targetVoice) {
        await member.voice.setChannel(targetVoice).catch(() => {});
        return;
      }
      await cleanupChannel(guild, existing.voiceChannelId, existing);
      return;
    }

    const maxRooms = Math.max(1, Number(tvConfig.maxRoomsPerUser) || 1);
    const owned = await TempChannel.countDocuments({ guildId: guild.id, ownerId: member.id }).catch(() => 0);
    if (owned >= maxRooms) {
      try {
        await member.voice.setChannel(null).catch(() => {});
      } catch (e) {}
      return;
    }

    try {
      await createTempChannels(guild, member, tvConfig);
    } catch (err) {
      console.error('tempVoice: failed to create channels:', err);
    }
    return;
  }

  if (oldChannelId && oldChannelId !== newChannelId) {
    const isTemp = await isActiveRoom(guild.id, oldChannelId);
    if (isTemp) {
      await scheduleEmptyTimeout(guild, oldChannelId);
    }
  }

  if (newChannelId) {
    const isTemp = await isActiveRoom(guild.id, newChannelId);
    if (isTemp) {
      clearScheduledDelete(newChannelId);
    }
  }
}

async function handleChannelDelete(channel) {
  if (!channel || !channel.guild) return;

  if (channel.type === 2) {
    await cleanupChannel(channel.guild, channel.id);
    return;
  }

  for (const entry of activeChannels.values()) {
    if (entry.textChannelId === channel.id) {
      entry.textChannelId = null;
      entry.panelMessageId = null;
      await saveEntry(entry);
    }
  }
}

async function restoreActiveChannels(client) {
  const docs = await TempChannel.find({}).lean().catch(() => []);
  let restored = 0;
  for (const doc of docs) {
    const guild = client.guilds.cache.get(doc.guildId);
    if (!guild) {
      await TempChannel.deleteMany({ guildId: doc.guildId }).catch(() => {});
      continue;
    }

    const voice = guild.channels.cache.get(doc.voiceChannelId);
    if (!voice || (voice.type !== ChannelType.GuildVoice && voice.type !== 2)) {
      if (doc.textChannelId) {
        const text = guild.channels.cache.get(doc.textChannelId);
        if (text && text.deletable) await text.delete('Temp voice cleanup').catch(() => {});
      }
      await TempChannel.deleteMany({ voiceChannelId: doc.voiceChannelId }).catch(() => {});
      continue;
    }

    const entry = {
      voiceChannelId: doc.voiceChannelId,
      textChannelId: doc.textChannelId,
      ownerId: doc.ownerId,
      guildId: doc.guildId,
      createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
      locked: doc.locked || false,
      panelMessageId: doc.panelMessageId || null,
    };
    activeChannels.set(doc.voiceChannelId, entry);

    const textChannel = guild.channels.cache.get(entry.textChannelId);
    if (textChannel) {
      const config = await getGuildConfig(guild.id);
      if (entry.panelMessageId) {
        const found = await textChannel.messages.fetch(entry.panelMessageId).catch(() => null);
        if (!found) entry.panelMessageId = null;
      }
      if (!entry.panelMessageId) {
        const member = guild.members.cache.get(entry.ownerId) ||
          await guild.members.fetch(entry.ownerId).catch(() => null);
        if (member) {
          await sendControlPanel(textChannel, voice, entry, member, config.embedColor);
        }
      }
    }

    if (voice.members.size === 0) {
      await scheduleEmptyTimeout(guild, doc.voiceChannelId);
    }
    restored++;
  }
  if (restored > 0) {
    console.log('Restored ' + restored + ' temporary voice room(s).');
  }
}

module.exports = {
  activeChannels,
  pendingDeletes,
  getTempVoiceConfig,
  handleVoiceStateUpdate,
  handleChannelDelete,
  handleInteraction,
  createTempChannels,
  cleanupChannel,
  restoreActiveChannels,
  saveEntry,
  scheduleEmptyTimeout,
  buildPanel,
  userSelect,
};