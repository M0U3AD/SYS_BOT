const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} = require('discord.js');
const TempChannel = require('../database/models/TempChannel');
const TempVoicePreference = require('../database/models/TempVoicePreference');
const Guild = require('../database/models/Guild');
const { getGuildConfig, updateGuildConfig } = require('../database/utils/GuildConfig');
const botConfig = require('../../config.json');

const activeChannels = new Map();
const pendingDeletes = new Map();
const creating = new Set();
const lastCreated = new Map();
const renameHistory = new Map();

const OWNER_PERMISSIONS = {
  ViewChannel: true, Connect: true, Speak: true, Stream: true, UseVAD: true,
  SendMessages: true, ReadMessageHistory: true, ManageChannels: true,
  MoveMembers: true, MuteMembers: true,
};

function configFor(guildConfig) {
  return guildConfig.tempVoice || {};
}

async function getTempVoiceConfig(guildId) {
  return configFor(await getGuildConfig(guildId));
}

function entryFrom(doc) {
  return {
    guildId: doc.guildId,
    voiceChannelId: doc.voiceChannelId,
    textChannelId: doc.textChannelId || null,
    ownerId: doc.ownerId,
    panelMessageId: doc.panelMessageId || null,
    locked: Boolean(doc.locked),
    hidden: Boolean(doc.hidden),
    members: (doc.members || []).map(m => ({ userId: m.userId, joinedAt: new Date(m.joinedAt || Date.now()) })),
    bannedUserIds: doc.bannedUserIds || [],
    coOwnerIds: doc.coOwnerIds || [],
    whitelistUserIds: doc.whitelistUserIds || [],
    blacklistUserIds: doc.blacklistUserIds || [],
    trustedUserIds: doc.trustedUserIds || [],
    createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
  };
}

async function saveEntry(entry) {
  await TempChannel.updateOne(
    { voiceChannelId: entry.voiceChannelId },
    { $set: {
      guildId: entry.guildId,
      voiceChannelId: entry.voiceChannelId,
      textChannelId: entry.textChannelId || null,
      ownerId: entry.ownerId,
      panelMessageId: entry.panelMessageId || null,
      locked: Boolean(entry.locked),
      hidden: Boolean(entry.hidden),
      members: entry.members || [],
      bannedUserIds: entry.bannedUserIds || [],
      coOwnerIds: entry.coOwnerIds || [],
      whitelistUserIds: entry.whitelistUserIds || [],
      blacklistUserIds: entry.blacklistUserIds || [],
      trustedUserIds: entry.trustedUserIds || [],
      createdAt: new Date(entry.createdAt || Date.now()),
    } },
    { upsert: true },
  );
}

async function getEntry(channelId) {
  if (activeChannels.has(channelId)) return activeChannels.get(channelId);
  const doc = await TempChannel.findOne({ voiceChannelId: channelId }).lean();
  if (!doc) return null;
  const entry = entryFrom(doc);
  activeChannels.set(channelId, entry);
  return entry;
}

function isStaff(member) {
  return member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels);
}

function isOwnerOrStaff(userId, member, entry) {
  return userId === entry.ownerId || (entry.coOwnerIds || []).includes(userId) || isStaff(member);
}

async function ensureTriggerPermissions(channel) {
  const bot = channel.guild.members.me;
  if (!bot) throw new Error('The bot is not available in this server.');
  const channelPermissions = bot.permissionsIn(channel);
  const missing = [];
  if (!channelPermissions.has(PermissionFlagsBits.ManageChannels)) missing.push('Manage Channels');
  if (!channelPermissions.has(PermissionFlagsBits.ViewChannel)) missing.push('View Channel');
  if (!channelPermissions.has(PermissionFlagsBits.MoveMembers)) missing.push('Move Members');
  if (missing.length) throw new Error('Grant the bot ' + missing.join(', ') + ' in the join-to-create channel.');
}

function channelName(template, username, count) {
  return String(template || '{user}\'s Room')
    .replaceAll('{user}', username)
    .replaceAll('{username}', username)
    .replaceAll('{count}', String(count))
    .trim()
    .slice(0, 100) || username + "'s Room";
}

function makePanel(voice, entry, color) {
  const embed = new EmbedBuilder()
    .setColor(color || '#5865F2')
    .setTitle('Temporary voice controls')
    .setDescription('Only the room owner and server admins can use these controls.')
    .addFields(
      { name: 'Owner', value: '<@' + entry.ownerId + '>', inline: true },
      { name: 'Members', value: String(voice.members.size), inline: true },
      { name: 'Access', value: (entry.locked ? 'Locked' : 'Open') + (entry.hidden ? ' · Hidden' : ''), inline: true },
      { name: 'Commands', value: '`/voice` in this channel: rename, limit, lock, hide, kick, ban, mute, permit, transfer, claim, bitrate, region, save, reset.' },
    )
    .setTimestamp();

  const button = (id, label, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
  const row1 = new ActionRowBuilder().addComponents(
    button('tv_rename', 'Rename'), button('tv_limit', 'User limit'),
    button(entry.locked ? 'tv_unlock' : 'tv_lock', entry.locked ? 'Unlock' : 'Lock', ButtonStyle.Primary),
    button(entry.hidden ? 'tv_unhide' : 'tv_hide', entry.hidden ? 'Unhide' : 'Hide', ButtonStyle.Primary),
    button('tv_transfer', 'Transfer', ButtonStyle.Primary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    button('tv_kick', 'Kick', ButtonStyle.Danger), button('tv_ban', 'Ban', ButtonStyle.Danger),
    button('tv_unban', 'Unban'), button('tv_permit_user', 'Permit user'),
    button('tv_permit_role', 'Permit role'),
  );
  const row3 = new ActionRowBuilder().addComponents(
    button('tv_claim', 'Claim', ButtonStyle.Success), button('tv_bitrate', 'Bitrate'),
    button('tv_region', 'Region'), button('tv_save', 'Save my settings'),
    button('tv_refresh', 'Refresh'),
  );
  const row4 = new ActionRowBuilder().addComponents(
    button('tv_mute', 'Mute'), button('tv_unmute', 'Unmute'), button('tv_reset', 'Reset my settings'),
  );
  return { embeds: [embed], components: [row1, row2, row3, row4] };
}

function buildWelcomeEmbed(owner, channel, prefix = '.') {
  const command = prefix + 'v';
  return new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('👑 Welcome, ' + owner.displayName + ' — ' + channel.name + ' is yours!')
    .setThumbnail(owner.displayAvatarURL({ size: 256 }))
    .setDescription("Here's a quick cheat-sheet so you can manage your channel right away.")
    .addFields(
      { name: '🔒 Privacy', value: '`' + command + ' lock` / `' + command + ' unlock` — Lock the channel\n`' + command + ' hide` / `' + command + ' show` — Hide from everyone\n`' + command + ' limit <n>` — Set user limit\n`' + command + ' name <text>` — Rename the channel', inline: false },
      { name: '👤 Members', value: '`' + command + ' permit <@user>` — Allow someone in\n`' + command + ' reject <@user>` — Kick & deny someone\n`' + command + ' claim` — Take ownership if abandoned\n`' + command + ' transfer <@user>` — Hand the channel over\n`' + command + ' add_owner <@user>` — Add a co-owner', inline: false },
      { name: '❤️ Personal lists', value: '`' + command + ' wl add <@user>` — Whitelist a friend\n`' + command + ' wlpermit` — Permit your whole whitelist\n`' + command + ' bl add <@user>` — Blacklist a user\n`' + command + ' trust <@user>` — Auto-promote to co-owner', inline: false },
      { name: 'ℹ️ Info', value: '`' + command + ' info` • `' + command + ' leaderboard` • `' + command + ' help`', inline: false },
    )
    .setFooter({ text: 'Tip: type ' + command + ' help for the full interactive menu' });
}

async function sendWelcomeEmbed(owner, channel, config) {
  if (config.sendWelcomeEmbed === false) return;
  const prefix = String(botConfig.prefix || '!');
  try {
    await channel.send({
      content: '<@' + owner.id + '>',
      embeds: [buildWelcomeEmbed(owner, channel, prefix)],
      allowedMentions: { users: [owner.id] },
    });
  } catch (error) {
    console.error('tempVoice: welcome embed send failed for channel ' + channel.id + ':', error);
  }
}

async function postPanel(voice, entry) {
  const config = await getGuildConfig(entry.guildId);
  const message = await voice.send({ content: '<@' + entry.ownerId + '>', ...makePanel(voice, entry, config.embedColor) });
  entry.panelMessageId = message.id;
  await saveEntry(entry);
}

async function refreshPanel(guild, entry) {
  const voice = guild.channels.cache.get(entry.voiceChannelId);
  if (!voice) return;
  const config = await getGuildConfig(guild.id);
  if (!entry.panelMessageId) return postPanel(voice, entry);
  const message = await voice.messages.fetch(entry.panelMessageId).catch(() => null);
  if (!message) return postPanel(voice, entry);
  await message.edit(makePanel(voice, entry, config.embedColor));
}

function renameWait(channelId) {
  const now = Date.now();
  const times = (renameHistory.get(channelId) || []).filter(time => now - time < 10 * 60 * 1000);
  if (times.length >= 2) return Math.ceil((10 * 60 * 1000 - (now - times[0])) / 1000);
  times.push(now);
  renameHistory.set(channelId, times);
  return 0;
}

async function renameRoom(guild, voice, entry, name) {
  const wait = renameWait(voice.id);
  if (wait) throw new Error('Discord rename limit reached. Try again in ' + wait + ' seconds.');
  try {
    await voice.setName(name.trim().slice(0, 100));
  } catch (error) {
    if (error.status === 429) throw new Error('Discord is rate-limiting room renames. Try again later.');
    throw error;
  }
  await refreshPanel(guild, entry);
}

async function transferOwner(guild, voice, entry, member) {
  if (!member || member.user.bot) throw new Error('Choose a server member to own the room.');
  if (member.voice.channelId !== voice.id) throw new Error('The new owner must be in this room.');
  const previousOwner = entry.ownerId;
  await voice.permissionOverwrites.delete(previousOwner).catch(() => {});
  await voice.permissionOverwrites.edit(member.id, OWNER_PERMISSIONS);
  entry.ownerId = member.id;
  await saveEntry(entry);
  await refreshPanel(guild, entry);
}

async function takeOwnership(guild, voice, entry, member, adminOverride = false) {
  const currentOwnerPresent = voice.members.has(entry.ownerId);
  if (currentOwnerPresent && !adminOverride) throw new Error('The current owner is still in the room.');
  if (!voice.members.has(member.id)) throw new Error('Join the room before claiming it.');
  await transferOwner(guild, voice, entry, member);
}

async function setAccess(voice, entry, target, { allow, deny = false }) {
  if (!target) throw new Error('That member or role is no longer available.');
  await voice.permissionOverwrites.edit(target.id, {
    ViewChannel: allow ? true : deny ? false : null,
    Connect: allow ? true : deny ? false : null,
  });
}

async function createTempChannels(guild, member, tvConfig) {
  const trigger = guild.channels.cache.get(tvConfig.triggerChannelId);
  if (!trigger || trigger.type !== ChannelType.GuildVoice) throw new Error('The configured join-to-create channel was deleted. Run /tempvoice setup again.');
  await ensureTriggerPermissions(trigger);

  const category = tvConfig.categoryId ? guild.channels.cache.get(tvConfig.categoryId) : null;
  if (tvConfig.categoryId && (!category || category.type !== ChannelType.GuildCategory)) {
    throw new Error('The configured category is missing. Run /tempvoice setup again.');
  }

  const preference = await TempVoicePreference.findOne({ guildId: guild.id, userId: member.id }).lean();
  const ownedCount = await TempChannel.countDocuments({ guildId: guild.id, ownerId: member.id });
  const displayName = member.displayName || member.user.username;
  const name = channelName(preference?.preferredName || tvConfig.channelNameTemplate, displayName, ownedCount + 1);
  const userLimit = preference?.userLimit ?? Number(tvConfig.userLimit || 0);
  const maximumBitrate = guild.maximumBitrate || 96000;
  const bitrate = Math.min(Number(tvConfig.bitrate) || 64000, maximumBitrate);
  const everyone = guild.roles.everyone.id;
  const permissionOverwrites = [
    // Channel creation expects permission names here; OWNER_PERMISSIONS itself is the edit-overwrite format.
    { id: member.id, allow: Object.keys(OWNER_PERMISSIONS) },
    { id: guild.members.me.id, allow: ['ViewChannel', 'Connect', 'SendMessages', 'EmbedLinks', 'ReadMessageHistory', 'ManageChannels', 'MoveMembers', 'MuteMembers'] },
  ];
  if (preference?.locked) permissionOverwrites.push({ id: everyone, deny: ['Connect'] });
  if (preference?.hidden) permissionOverwrites.push({ id: everyone, deny: ['ViewChannel'] });
  if (tvConfig.modRoleIds) {
    for (const roleId of tvConfig.modRoleIds) {
      if (guild.roles.cache.has(roleId)) permissionOverwrites.push({ id: roleId, allow: ['ViewChannel', 'Connect', 'SendMessages', 'ReadMessageHistory', 'ManageChannels', 'MoveMembers', 'MuteMembers'] });
    }
  }

  const voice = await guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    parent: category?.id,
    userLimit: Math.max(0, Math.min(99, Number(userLimit) || 0)),
    bitrate,
    permissionOverwrites,
  });
  const entry = {
    guildId: guild.id,
    voiceChannelId: voice.id,
    textChannelId: null,
    ownerId: member.id,
    panelMessageId: null,
    locked: Boolean(preference?.locked),
    hidden: Boolean(preference?.hidden),
    members: [{ userId: member.id, joinedAt: new Date() }],
    bannedUserIds: [],
    coOwnerIds: [],
    whitelistUserIds: [],
    blacklistUserIds: [],
    trustedUserIds: [],
    createdAt: Date.now(),
  };
  activeChannels.set(voice.id, entry);

  try {
    await saveEntry(entry);
    await postPanel(voice, entry);
    await member.voice.setChannel(voice);
    await sendWelcomeEmbed(member, voice, tvConfig);
    return voice;
  } catch (error) {
    activeChannels.delete(voice.id);
    await TempChannel.deleteOne({ voiceChannelId: voice.id }).catch(() => {});
    await voice.delete('Temporary voice setup failed').catch(() => {});
    throw error;
  }
}

function canCreate(member, config) {
  const tv = configFor(config);
  const roles = member.roles.cache;
  if ((tv.blacklistRoleIds || []).some(id => roles.has(id))) return 'A server role prevents you from creating a temporary room.';
  if ((tv.whitelistRoleIds || []).length && !(tv.whitelistRoleIds || []).some(id => roles.has(id))) return 'You need an allowed role to create a temporary room.';
  return null;
}

async function notifyUser(member, content) {
  await member.send(content).catch(() => {});
}

async function createForMember(guild, member, tvConfig) {
  const lockKey = guild.id + ':' + member.id;
  if (creating.has(lockKey)) return;
  creating.add(lockKey);
  try {
    const config = await getGuildConfig(guild.id);
    const denied = canCreate(member, config);
    if (denied) return notifyUser(member, denied);
    const existing = await TempChannel.findOne({ guildId: guild.id, ownerId: member.id }).lean();
    if (existing) {
      const room = guild.channels.cache.get(existing.voiceChannelId);
      if (room) {
        await member.voice.setChannel(room);
        return;
      }
      await TempChannel.deleteOne({ voiceChannelId: existing.voiceChannelId });
    }
    const owned = await TempChannel.countDocuments({ guildId: guild.id, ownerId: member.id });
    if (owned >= Math.max(1, Number(tvConfig.maxRoomsPerUser) || 1)) {
      return notifyUser(member, 'You already own the maximum number of temporary rooms.');
    }
    const cooldown = Math.max(0, Number(tvConfig.cooldownSeconds) || 0) * 1000;
    const last = lastCreated.get(guild.id + ':' + member.id) || 0;
    if (Date.now() - last < cooldown) {
      const remaining = Math.ceil((cooldown - (Date.now() - last)) / 1000);
      return notifyUser(member, 'Wait ' + remaining + ' seconds before creating another temporary room.');
    }
    lastCreated.set(guild.id + ':' + member.id, Date.now());
    await createTempChannels(guild, member, tvConfig);
  } catch (error) {
    console.error('tempVoice: room creation failed:', error);
    await notifyUser(member, 'I could not create your room: ' + error.message + ' Ask an admin to run /tempvoice setup again if the category or hub was deleted.');
  } finally {
    creating.delete(lockKey);
  }
}

async function scheduleEmptyTimeout(guild, channelId) {
  if (pendingDeletes.has(channelId)) clearTimeout(pendingDeletes.get(channelId));
  const config = await getTempVoiceConfig(guild.id);
  const delay = Math.max(0, Number(config.emptyTimeoutSeconds) || 0) * 1000;
  const timer = setTimeout(async () => {
    pendingDeletes.delete(channelId);
    try {
      const voice = guild.channels.cache.get(channelId);
      if (voice && voice.members.size === 0) await cleanupChannel(guild, channelId);
    } catch (error) {
      console.error('tempVoice: empty room cleanup failed:', error);
    }
  }, delay);
  pendingDeletes.set(channelId, timer);
}

function clearScheduledDelete(channelId) {
  if (pendingDeletes.has(channelId)) clearTimeout(pendingDeletes.get(channelId));
  pendingDeletes.delete(channelId);
}

async function cleanupChannel(guild, channelId, deleteVoice = true) {
  clearScheduledDelete(channelId);
  const entry = activeChannels.get(channelId) || await TempChannel.findOne({ voiceChannelId: channelId }).lean().catch(() => null);
  if (entry?.textChannelId) {
    const oldTextChannel = guild.channels.cache.get(entry.textChannelId);
    if (oldTextChannel?.deletable) await oldTextChannel.delete('Temporary voice room closed').catch(() => {});
  }
  activeChannels.delete(channelId);
  await TempChannel.deleteOne({ voiceChannelId: channelId }).catch(err => console.error('tempVoice: record cleanup failed:', err));
  if (deleteVoice) {
    const voice = guild.channels.cache.get(channelId);
    if (voice?.deletable) await voice.delete('Temporary voice room is empty').catch(err => console.error('tempVoice: channel cleanup failed:', err));
  }
}

async function synchronizeMembers(guild, voice, entry) {
  const now = Date.now();
  const oldMembers = new Map(entry.members.map(item => [item.userId, item.joinedAt.getTime()]));
  entry.members = [...voice.members.values()]
    .filter(member => !member.user.bot)
    .map(member => ({ userId: member.id, joinedAt: new Date(oldMembers.get(member.id) || now) }));
  if (!voice.members.has(entry.ownerId) && entry.members.length) {
    // Persisted join timestamps make the earliest remaining member the successor.
    entry.members.sort((a, b) => a.joinedAt - b.joinedAt);
    const newOwner = guild.members.cache.get(entry.members[0].userId);
    if (newOwner) await transferOwner(guild, voice, entry, newOwner);
  }
  await saveEntry(entry);
}

async function handleVoiceStateUpdate(oldState, newState) {
  const guild = newState.guild || oldState?.guild;
  if (!guild) return;
  const tvConfig = await getTempVoiceConfig(guild.id);
  const oldId = oldState?.channelId;
  const newId = newState?.channelId;
  const userId = newState.id || oldState.id;
  const member = newState.member || oldState.member || await guild.members.fetch(userId).catch(() => null);
  if (!member || member.user.bot) return;

  if (oldId && oldId !== newId) {
    const entry = await getEntry(oldId);
    const voice = guild.channels.cache.get(oldId);
    if (entry && voice) {
      entry.members = entry.members.filter(item => item.userId !== userId);
      if (entry.ownerId === userId && voice.members.size) await synchronizeMembers(guild, voice, entry);
      else await saveEntry(entry);
      if (voice.members.size === 0) await scheduleEmptyTimeout(guild, oldId);
      else await refreshPanel(guild, entry).catch(err => console.error('tempVoice: panel refresh failed:', err));
    }
  }

  if (newId && newId !== oldId) {
    const entry = await getEntry(newId);
    if (entry) {
      clearScheduledDelete(newId);
      if ((entry.bannedUserIds || []).includes(userId) || (entry.blacklistUserIds || []).includes(userId)) {
        await member.voice.disconnect('You are blocked from this temporary voice room.').catch(err => console.error('tempVoice: blocked member disconnect failed:', err));
        return;
      }
      if (!entry.members.some(item => item.userId === userId)) entry.members.push({ userId, joinedAt: new Date() });
      if ((entry.trustedUserIds || []).includes(userId) && !(entry.coOwnerIds || []).includes(userId)) {
        await guild.channels.cache.get(newId).permissionOverwrites.edit(userId, OWNER_PERMISSIONS);
        entry.coOwnerIds.push(userId);
      }
      await saveEntry(entry);
      await refreshPanel(guild, entry).catch(err => console.error('tempVoice: panel refresh failed:', err));
    }
  }

  if (tvConfig.enabled && tvConfig.triggerChannelId && newId === tvConfig.triggerChannelId) {
    await createForMember(guild, member, tvConfig);
  }
}

async function handleChannelDelete(channel) {
  if (!channel?.guild) return;
  if (activeChannels.has(channel.id) || await TempChannel.exists({ voiceChannelId: channel.id })) {
    await cleanupChannel(channel.guild, channel.id, false);
  }
  const config = await getTempVoiceConfig(channel.guild.id);
  if (channel.id === config.triggerChannelId) {
    await updateGuildConfig(channel.guild.id, { 'tempVoice.enabled': false, 'tempVoice.triggerChannelId': '' });
  } else if (channel.id === config.categoryId) {
    console.warn('Temporary voice category was deleted in guild ' + channel.guild.id + '. Re-run /tempvoice setup with a valid category.');
  }
}

async function restoreActiveChannels(client) {
  const docs = await TempChannel.find({}).lean();
  const tracked = new Set();
  for (const doc of docs) {
    const guild = client.guilds.cache.get(doc.guildId);
    const voice = guild?.channels.cache.get(doc.voiceChannelId);
    if (!guild || !voice || voice.type !== ChannelType.GuildVoice) {
      const oldText = guild?.channels.cache.get(doc.textChannelId);
      if (oldText?.deletable) await oldText.delete('Removing stale temp voice channel').catch(() => {});
      await TempChannel.deleteOne({ voiceChannelId: doc.voiceChannelId }).catch(() => {});
      continue;
    }
    if (voice.members.size === 0) {
      await cleanupChannel(guild, voice.id);
      continue;
    }
    const entry = entryFrom(doc);
    activeChannels.set(voice.id, entry);
    tracked.add(voice.id);
    await synchronizeMembers(guild, voice, entry);
    const panel = entry.panelMessageId ? await voice.messages.fetch(entry.panelMessageId).catch(() => null) : null;
    if (!panel) {
      const oldText = guild.channels.cache.get(entry.textChannelId);
      const oldPanel = oldText && entry.panelMessageId
        ? await oldText.messages.fetch(entry.panelMessageId).catch(() => null)
        : null;
      if (oldPanel) await oldPanel.delete().catch(() => {});
      await postPanel(voice, entry).catch(err => console.error('tempVoice: could not restore panel:', err));
    }
  }

  for (const guild of client.guilds.cache.values()) {
    const tvConfig = await getTempVoiceConfig(guild.id);
    const botId = client.user.id;
    for (const voice of guild.channels.cache.values()) {
      if (voice.type !== ChannelType.GuildVoice || !tvConfig.categoryId || voice.parentId !== tvConfig.categoryId || tracked.has(voice.id)) continue;
      const botOverwrite = voice.permissionOverwrites.cache.get(botId);
      // Created rooms always carry both bot access and an owner ManageChannels overwrite.
      const ownerOverwrite = voice.permissionOverwrites.cache.find(overwrite =>
        overwrite.type === 1 && overwrite.id !== botId && overwrite.allow.has(PermissionFlagsBits.ManageChannels)
      );
      if (!botOverwrite || !ownerOverwrite) continue;
      if (voice.members.size === 0) {
        await voice.delete('Removing empty orphaned temporary room').catch(err => console.error('tempVoice: orphan cleanup failed:', err));
      } else {
        const entry = {
          guildId: guild.id, voiceChannelId: voice.id, textChannelId: null,
          ownerId: ownerOverwrite.id, panelMessageId: null, locked: false,
          hidden: false, members: [], bannedUserIds: [], coOwnerIds: [],
          whitelistUserIds: [], blacklistUserIds: [], trustedUserIds: [], createdAt: Date.now(),
        };
        activeChannels.set(voice.id, entry);
        await synchronizeMembers(guild, voice, entry);
        await postPanel(voice, entry).catch(err => console.error('tempVoice: orphan panel restore failed:', err));
      }
    }
  }
  console.log('Temporary voice channel reconciliation complete.');
}

function buttonModal(id, title, label, value = '', maxLength = 100) {
  const modal = new ModalBuilder().setCustomId(id).setTitle(title);
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('value').setLabel(label).setStyle(TextInputStyle.Short)
      .setValue(String(value)).setMaxLength(maxLength).setRequired(true),
  ));
  return modal;
}

function selectReply(id, placeholder, role = false) {
  const select = role
    ? new RoleSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder).setMinValues(1).setMaxValues(1)
    : new UserSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder).setMinValues(1).setMaxValues(1);
  return { components: [new ActionRowBuilder().addComponents(select)], ephemeral: true };
}

async function handleControlInteraction(interaction, entry, voice) {
  const isClaim = interaction.isButton() && interaction.customId === 'tv_claim';
  if (!isOwnerOrStaff(interaction.user.id, interaction.member, entry) && !isClaim) {
    return interaction.reply({ content: 'Only the room owner or a server admin can use these controls.', ephemeral: true });
  }
  if (!voice) return interaction.reply({ content: 'This temporary room no longer exists.', ephemeral: true });

  if (interaction.isUserSelectMenu() || interaction.isRoleSelectMenu()) {
    const targetId = interaction.values[0];
    const member = interaction.isUserSelectMenu()
      ? (interaction.guild.members.cache.get(targetId) || await interaction.guild.members.fetch(targetId).catch(() => null))
      : null;
    if (interaction.customId === 'tv_transfer') {
      if (!member) return interaction.reply({ content: 'Member not found.', ephemeral: true });
      await transferOwner(interaction.guild, voice, entry, member);
      return interaction.reply({ content: 'Room ownership transferred.', ephemeral: true });
    }
    if (interaction.customId === 'tv_claim') {
      await takeOwnership(interaction.guild, voice, entry, interaction.member, isStaff(interaction.member));
      return interaction.reply({ content: 'You are now the room owner.', ephemeral: true });
    }
    if (interaction.customId === 'tv_permit_role') {
      await setAccess(voice, entry, interaction.guild.roles.cache.get(targetId), { allow: true });
      return interaction.reply({ content: 'Role access granted.', ephemeral: true });
    }
    if (!member) return interaction.reply({ content: 'Member not found.', ephemeral: true });
    if (interaction.customId === 'tv_permit_user') {
      await setAccess(voice, entry, member, { allow: true });
      return interaction.reply({ content: 'Member access granted.', ephemeral: true });
    }
    if (interaction.customId === 'tv_mute' || interaction.customId === 'tv_unmute') {
      if (member.voice.channelId !== voice.id) return interaction.reply({ content: 'That member is not in this room.', ephemeral: true });
      await member.voice.setMute(interaction.customId === 'tv_mute', 'Room owner moderation');
      return interaction.reply({ content: interaction.customId === 'tv_mute' ? 'Member muted.' : 'Member unmuted.', ephemeral: true });
    }
    if (interaction.customId === 'tv_kick' || interaction.customId === 'tv_ban') {
      if (member.voice.channelId === voice.id) await member.voice.disconnect('Room owner action');
      if (interaction.customId === 'tv_ban') {
        await voice.permissionOverwrites.edit(member.id, { Connect: false });
        if (!entry.bannedUserIds.includes(member.id)) entry.bannedUserIds.push(member.id);
        await saveEntry(entry);
      }
      return interaction.reply({ content: interaction.customId === 'tv_ban' ? 'Member removed and banned from this room.' : 'Member removed from this room.', ephemeral: true });
    }
    if (interaction.customId === 'tv_unban') {
      await voice.permissionOverwrites.edit(member.id, { Connect: null });
      entry.bannedUserIds = entry.bannedUserIds.filter(id => id !== member.id);
      await saveEntry(entry);
      return interaction.reply({ content: 'Member unbanned.', ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    const id = interaction.customId;
    if (id === 'tv_rename') return interaction.showModal(buttonModal('tv_modal_rename', 'Rename room', 'New room name', voice.name));
    if (id === 'tv_limit') return interaction.showModal(buttonModal('tv_modal_limit', 'Set user limit', '0 means unlimited', voice.userLimit, 2));
    if (id === 'tv_bitrate') return interaction.showModal(buttonModal('tv_modal_bitrate', 'Set bitrate', 'Bitrate in kbps', Math.round(voice.bitrate / 1000), 3));
    if (id === 'tv_region') return interaction.showModal(buttonModal('tv_modal_region', 'Set region', 'Region name or auto', voice.rtcRegion || 'auto', 30));
    if (id === 'tv_transfer' || id === 'tv_kick' || id === 'tv_ban' || id === 'tv_unban' || id === 'tv_permit_user' || id === 'tv_mute' || id === 'tv_unmute') {
      const labels = { tv_transfer: 'Select new owner', tv_kick: 'Select member to kick', tv_ban: 'Select member to ban', tv_unban: 'Select member to unban', tv_permit_user: 'Select member to permit', tv_mute: 'Select member to mute', tv_unmute: 'Select member to unmute' };
      return interaction.reply(selectReply(id, labels[id]));
    }
    if (id === 'tv_permit_role') return interaction.reply(selectReply(id, 'Select role to permit', true));
    if (id === 'tv_claim') {
      await takeOwnership(interaction.guild, voice, entry, interaction.member, isStaff(interaction.member));
      return interaction.reply({ content: 'You are now the room owner.', ephemeral: true });
    }
    if (id === 'tv_lock' || id === 'tv_unlock') {
      entry.locked = id === 'tv_lock';
      await voice.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: entry.locked ? false : null });
      await saveEntry(entry);
      return interaction.update(makePanel(voice, entry, (await getGuildConfig(entry.guildId)).embedColor));
    }
    if (id === 'tv_hide' || id === 'tv_unhide') {
      entry.hidden = id === 'tv_hide';
      await voice.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: entry.hidden ? false : null });
      await saveEntry(entry);
      return interaction.update(makePanel(voice, entry, (await getGuildConfig(entry.guildId)).embedColor));
    }
    if (id === 'tv_save') {
      await savePreferences(interaction.guild, interaction.user, voice, entry);
      return interaction.reply({ content: 'Your room preferences were saved for next time.', ephemeral: true });
    }
    if (id === 'tv_reset') {
      await TempVoicePreference.deleteOne({ guildId: interaction.guild.id, userId: interaction.user.id });
      return interaction.reply({ content: 'Your saved room preferences were cleared.', ephemeral: true });
    }
    if (id === 'tv_refresh') return interaction.update(makePanel(voice, entry, (await getGuildConfig(entry.guildId)).embedColor));
  }

  if (interaction.isModalSubmit()) {
    const value = interaction.fields.getTextInputValue('value').trim();
    if (interaction.customId === 'tv_modal_rename') {
      if (!value) return interaction.reply({ content: 'Room name cannot be empty.', ephemeral: true });
      await renameRoom(interaction.guild, voice, entry, value);
    } else if (interaction.customId === 'tv_modal_limit') {
      const limit = Number(value);
      if (!Number.isInteger(limit) || limit < 0 || limit > 99) return interaction.reply({ content: 'Use a whole number between 0 and 99.', ephemeral: true });
      await voice.setUserLimit(limit);
    } else if (interaction.customId === 'tv_modal_bitrate') {
      const kbps = Number(value);
      if (!Number.isInteger(kbps) || kbps < 8 || kbps > 384) return interaction.reply({ content: 'Use a bitrate from 8 to 384 kbps.', ephemeral: true });
      await voice.setBitrate(Math.min(kbps * 1000, interaction.guild.maximumBitrate || 96000));
    } else if (interaction.customId === 'tv_modal_region') {
      await voice.setRTCRegion(value.toLowerCase() === 'auto' ? null : value.toLowerCase());
    }
    await refreshPanel(interaction.guild, entry);
    return interaction.reply({ content: 'Room updated.', ephemeral: true });
  }
}

async function handleInteraction(interaction) {
  try {
    const entry = await getEntry(interaction.channelId);
    if (!entry) return interaction.reply({ content: 'This is not an active temporary voice room.', ephemeral: true });
    return await handleControlInteraction(interaction, entry, interaction.guild.channels.cache.get(entry.voiceChannelId));
  } catch (error) {
    console.error('tempVoice: control interaction failed:', error);
    const content = error.message || 'The control failed. Check the bot permissions.';
    if (interaction.replied || interaction.deferred) return interaction.followUp({ content, ephemeral: true }).catch(() => {});
    return interaction.reply({ content, ephemeral: true }).catch(() => {});
  }
}

async function savePreferences(guild, user, voice, entry) {
  await TempVoicePreference.updateOne(
    { guildId: guild.id, userId: user.id },
    { $set: { preferredName: voice.name, userLimit: voice.userLimit, locked: entry.locked } },
    { upsert: true },
  );
}

async function handleVoiceCommand(interaction) {
  const entry = await getEntry(interaction.channelId);
  if (!entry) return interaction.reply({ content: 'Run this command in your temporary voice channel chat.', ephemeral: true });
  const voice = interaction.guild.channels.cache.get(entry.voiceChannelId);
  const command = interaction.options.getSubcommand();
  if (!isOwnerOrStaff(interaction.user.id, interaction.member, entry) && command !== 'claim') {
    return interaction.reply({ content: 'Only the room owner or a server admin can use these controls.', ephemeral: true });
  }

  try {
    const member = interaction.options.getMember('member');
    const role = interaction.options.getRole('role');
    if (command === 'rename') await renameRoom(interaction.guild, voice, entry, interaction.options.getString('name'));
    else if (command === 'limit') {
      const limit = interaction.options.getInteger('value');
      if (limit < 0 || limit > 99) throw new Error('Use a user limit from 0 to 99.');
      await voice.setUserLimit(limit);
    } else if (command === 'lock' || command === 'unlock') {
      entry.locked = command === 'lock';
      await voice.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: entry.locked ? false : null });
      await saveEntry(entry);
    } else if (command === 'hide' || command === 'unhide') {
      entry.hidden = command === 'hide';
      await voice.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: entry.hidden ? false : null });
      await saveEntry(entry);
    } else if (command === 'kick' || command === 'ban') {
      if (member.voice.channelId === voice.id) await member.voice.disconnect('Room owner action');
      if (command === 'ban') {
        await voice.permissionOverwrites.edit(member.id, { Connect: false });
        if (!entry.bannedUserIds.includes(member.id)) entry.bannedUserIds.push(member.id);
        await saveEntry(entry);
      }
    } else if (command === 'mute' || command === 'unmute') {
      if (member.voice.channelId !== voice.id) throw new Error('That member is not in this room.');
      await member.voice.setMute(command === 'mute', 'Room owner moderation');
    } else if (command === 'unban') {
      await voice.permissionOverwrites.edit(member.id, { Connect: null });
      entry.bannedUserIds = entry.bannedUserIds.filter(id => id !== member.id);
      await saveEntry(entry);
    } else if (command === 'permit-user') await setAccess(voice, entry, member, { allow: true });
    else if (command === 'permit-role') await setAccess(voice, entry, role, { allow: true });
    else if (command === 'transfer') await transferOwner(interaction.guild, voice, entry, member);
    else if (command === 'claim') await takeOwnership(interaction.guild, voice, entry, interaction.member, isStaff(interaction.member));
    else if (command === 'bitrate') {
      const kbps = interaction.options.getInteger('value');
      await voice.setBitrate(Math.min(kbps * 1000, interaction.guild.maximumBitrate || 96000));
    } else if (command === 'region') {
      const region = interaction.options.getString('value');
      await voice.setRTCRegion(region === 'auto' ? null : region);
    } else if (command === 'save') await savePreferences(interaction.guild, interaction.user, voice, entry);
    else if (command === 'reset') {
      await TempVoicePreference.deleteOne({ guildId: interaction.guild.id, userId: interaction.user.id });
    }
    await refreshPanel(interaction.guild, entry);
    return interaction.reply({ content: 'Room updated.', ephemeral: true });
  } catch (error) {
    console.error('tempVoice: /voice command failed:', error);
    return interaction.reply({ content: error.message || 'The command failed. Check bot permissions.', ephemeral: true });
  }
}

async function handleMessage(message) {
  const content = message.content.trim();
  const prefixes = [...new Set(['.v', String(botConfig.prefix || '!') + 'v'])];
  const usedPrefix = prefixes.find(prefix => content.toLowerCase() === prefix.toLowerCase() ||
    content.toLowerCase().startsWith(prefix.toLowerCase() + ' '));
  if (!usedPrefix) return false;
  const entry = await getEntry(message.channel.id);
  if (!entry) return false;
  const [action = '', ...parts] = content.slice(usedPrefix.length).trim().split(/\s+/);
  const command = action.toLowerCase();
  const subcommand = (parts[0] || '').toLowerCase();
  const value = parts.join(' ').trim();
  const isClaim = command === 'claim';
  if (!isOwnerOrStaff(message.author.id, message.member, entry) && !isClaim) {
    await message.reply('Only the room owner or a server admin can use these controls.');
    return true;
  }
  const voice = message.guild.channels.cache.get(entry.voiceChannelId);
  if (!voice) {
    await message.reply('The temporary voice room no longer exists.');
    return true;
  }
  const targetId = message.mentions.users.first()?.id || value.match(/\d{17,20}/)?.[0];
  const target = targetId && (message.guild.members.cache.get(targetId) || await message.guild.members.fetch(targetId).catch(() => null));
  try {
    if (command === 'help') {
      return message.reply('Room commands: `' + usedPrefix + ' name <text>`, `lock`, `unlock`, `hide`, `show`, `limit <n>`, `permit @member`, `reject @member`, `claim`, `transfer @member`, `add_owner @member`, `wl add @member`, `wlpermit`, `bl add @member`, `trust @member`, `info`, `leaderboard`.');
    }
    if (command === 'claim') {
      await takeOwnership(message.guild, voice, entry, message.member, isStaff(message.member));
    } else if (command === 'name' || command === 'rename') {
      if (!value) throw new Error('Usage: `' + usedPrefix + ' name <new name>`.');
      await renameRoom(message.guild, voice, entry, value);
    } else if (command === 'lock' || command === 'unlock') {
      entry.locked = command === 'lock';
      await voice.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: entry.locked ? false : null });
      await saveEntry(entry);
    } else if (command === 'hide' || command === 'show' || command === 'unhide') {
      entry.hidden = command === 'hide';
      await voice.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: entry.hidden ? false : null });
      await saveEntry(entry);
    } else if (command === 'limit') {
      const limit = Number(parts[0]);
      if (!Number.isInteger(limit) || limit < 0 || limit > 99) throw new Error('Usage: `' + usedPrefix + ' limit <0-99>`.');
      await voice.setUserLimit(limit);
    } else if (command === 'permit' || command === 'allow') {
      if (!target) throw new Error('Usage: `' + usedPrefix + ' permit @member`.');
      await setAccess(voice, entry, target, { allow: true });
      entry.whitelistUserIds = [...new Set([...(entry.whitelistUserIds || []), target.id])];
      await saveEntry(entry);
    } else if (command === 'reject') {
      if (!target) throw new Error('Usage: `' + usedPrefix + ' reject @member`.');
      if (target.id === entry.ownerId) throw new Error('You cannot reject the room owner.');
      await voice.permissionOverwrites.edit(target.id, { Connect: false });
      entry.bannedUserIds = [...new Set([...(entry.bannedUserIds || []), target.id])];
      entry.blacklistUserIds = [...new Set([...(entry.blacklistUserIds || []), target.id])];
      await saveEntry(entry);
      if (target.voice.channelId === voice.id) await target.voice.disconnect('Room owner action');
    } else if (command === 'transfer') {
      if (!target) throw new Error('Usage: `' + usedPrefix + ' transfer @member`.');
      await transferOwner(message.guild, voice, entry, target);
    } else if (command === 'add_owner' || command === 'add-owner') {
      if (!target || target.user.bot) throw new Error('Usage: `' + usedPrefix + ' add_owner @member`.');
      if (!voice.members.has(target.id)) throw new Error('The co-owner must be in this room.');
      await voice.permissionOverwrites.edit(target.id, OWNER_PERMISSIONS);
      entry.coOwnerIds = [...new Set([...(entry.coOwnerIds || []), target.id])];
      await saveEntry(entry);
    } else if (command === 'wl' && subcommand === 'add') {
      if (!target) throw new Error('Usage: `' + usedPrefix + ' wl add @member`.');
      await setAccess(voice, entry, target, { allow: true });
      entry.whitelistUserIds = [...new Set([...(entry.whitelistUserIds || []), target.id])];
      await saveEntry(entry);
    } else if (command === 'wlpermit') {
      for (const id of entry.whitelistUserIds || []) {
        const whitelisted = message.guild.members.cache.get(id) || await message.guild.members.fetch(id).catch(() => null);
        if (whitelisted) await setAccess(voice, entry, whitelisted, { allow: true });
      }
    } else if (command === 'bl' && subcommand === 'add') {
      if (!target) throw new Error('Usage: `' + usedPrefix + ' bl add @member`.');
      if (target.id === entry.ownerId) throw new Error('You cannot blacklist the room owner.');
      await voice.permissionOverwrites.edit(target.id, { Connect: false });
      entry.blacklistUserIds = [...new Set([...(entry.blacklistUserIds || []), target.id])];
      entry.bannedUserIds = [...new Set([...(entry.bannedUserIds || []), target.id])];
      await saveEntry(entry);
      if (target.voice.channelId === voice.id) await target.voice.disconnect('Room owner action');
    } else if (command === 'trust') {
      if (!target || target.user.bot) throw new Error('Usage: `' + usedPrefix + ' trust @member`.');
      entry.trustedUserIds = [...new Set([...(entry.trustedUserIds || []), target.id])];
      if (voice.members.has(target.id)) {
        await voice.permissionOverwrites.edit(target.id, OWNER_PERMISSIONS);
        entry.coOwnerIds = [...new Set([...(entry.coOwnerIds || []), target.id])];
      }
      await saveEntry(entry);
    } else if (command === 'info') {
      return message.reply('Room: **' + voice.name + '** · Owner: <@' + entry.ownerId + '> · Members: **' + voice.members.size + '** · Limit: **' + (voice.userLimit || 'Unlimited') + '** · ' + (entry.locked ? 'Locked' : 'Open') + (entry.hidden ? ' · Hidden' : ''));
    } else if (command === 'leaderboard') {
      const leaders = [...entry.members].sort((a, b) => a.joinedAt - b.joinedAt).slice(0, 10);
      return message.reply('Room presence leaderboard:\n' + (leaders.length ? leaders.map((item, index) => (index + 1) + '. <@' + item.userId + '>').join('\n') : 'No tracked members yet.'));
    } else {
      return message.reply('Unknown room command. Use `' + usedPrefix + ' help` to see available commands.');
    }
    await refreshPanel(message.guild, entry);
    await message.reply('Temporary voice room updated.');
  } catch (error) {
    await message.reply(error.message || 'The command failed. Check bot permissions.');
  }
  return true;
}

module.exports = {
  activeChannels,
  pendingDeletes,
  getTempVoiceConfig,
  ensureTriggerPermissions,
  createTempChannels,
  cleanupChannel,
  handleVoiceStateUpdate,
  handleChannelDelete,
  restoreActiveChannels,
  handleInteraction,
  handleVoiceCommand,
  handleMessage,
  saveEntry,
  buildWelcomeEmbed,
  scheduleEmptyTimeout,
};
