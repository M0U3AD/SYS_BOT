const { getGuildConfig } = require('../database/utils/GuildConfig');

const activeChannels = new Map();

async function getTempVoiceConfig(guildId) {
  const config = await getGuildConfig(guildId);
  return config.tempVoice || {};
}

async function createTempChannels(guild, member, tvConfig) {
  const category = guild.channels.cache.get(tvConfig.categoryId) || null;
  const user = member.user;

  const vcName = String(tvConfig.channelNameTemplate || '{user}\'s Channel')
    .replace('{user}', user.username)
    .slice(0, 100) || user.username + ' Channel';

  const voiceOverwrites = [
    { id: guild.id, deny: ['ViewChannel'] },
    { id: member.id, allow: ['ViewChannel', 'Connect', 'Speak', 'Stream', 'UseVAD'], deny: ['MuteMembers'] },
  ];
  for (const rid of tvConfig.modRoleIds || []) {
    const role = guild.roles.cache.get(rid);
    if (role) {
      voiceOverwrites.push({ id: rid, allow: ['ViewChannel', 'Connect', 'MoveMembers', 'ManageChannels'] });
    }
  }

  const voice = await guild.channels.create({
    name: vcName,
    type: 2,
    parent: category ? category.id : undefined,
    permissionOverwrites: voiceOverwrites,
  });

  try {
    await member.voice.setChannel(voice);
  } catch (e) {
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
      type: 0,
      parent: category ? category.id : undefined,
      permissionOverwrites: modOverwrites,
    });

    await text.send({ content: '🛡️ **Moderation channel** for `' + vcName + '` · Owner: ' + user }).catch(() => {});
  }

  activeChannels.set(voice.id, {
    textChannelId: text ? text.id : null,
    ownerId: member.id,
    guildId: guild.id,
    createdAt: Date.now(),
  });

  return { voice, text };
}

async function cleanupChannel(guild, voiceChannelId) {
  const entry = activeChannels.get(voiceChannelId);
  if (!entry) return;

  const textChannel = guild.channels.cache.get(entry.textChannelId);
  if (textChannel && textChannel.deletable) {
    await textChannel.delete('Temporary voice channel closed').catch(() => {});
  }
  const voice = guild.channels.cache.get(voiceChannelId);
  if (voice && voice.deletable) {
    await voice.delete('Temporary voice channel closed').catch(() => {});
  }

  activeChannels.delete(voiceChannelId);
}

async function handleVoiceStateUpdate(oldState, newState) {
  const guild = newState.guild;
  if (!guild) return;
  if (!newState || !oldState) return;

  const tvConfig = await getTempVoiceConfig(guild.id);
  if (!tvConfig.enabled || !tvConfig.triggerChannelId) return;

  if (newState.channelId === tvConfig.triggerChannelId) {
    let member = newState.member;
    if (!member) {
      try {
        member = await guild.members.fetch(newState.id).catch(() => null);
      } catch (e) {
        member = null;
      }
    }
    if (!member || !member.user || member.user.bot) return;

    for (const entry of activeChannels.values()) {
      if (entry.ownerId === member.id && entry.guildId === guild.id) return;
    }

    try {
      await createTempChannels(guild, member, tvConfig);
    } catch (err) {
      console.error('tempVoice: failed to create channels:', err);
    }
    return;
  }

  if (oldState.channelId && activeChannels.has(oldState.channelId)) {
    setTimeout(async () => {
      const vc = guild.channels.cache.get(oldState.channelId);
      if (vc && vc.members.size === 0) {
        await cleanupChannel(guild, vc.id);
      }
    }, 2000);
  }
}

async function handleChannelDelete(channel) {
  if (!channel || !channel.guild) return;

  if (channel.type === 2) {
    if (activeChannels.has(channel.id)) {
      await cleanupChannel(channel.guild, channel.id);
    }
    return;
  }

  for (const [voiceId, entry] of activeChannels) {
    if (entry.textChannelId === channel.id) {
      activeChannels.delete(voiceId);
    }
  }
}

module.exports = {
  activeChannels,
  getTempVoiceConfig,
  handleVoiceStateUpdate,
  handleChannelDelete,
  createTempChannels,
};