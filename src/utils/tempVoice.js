const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { getGuildConfig } = require('../database/utils/GuildConfig');

const activeChannels = new Map();

async function getTempVoiceConfig(guildId) {
  const config = await getGuildConfig(guildId);
  return config.tempVoice || {};
}

function buildPanel(voice, entry, color) {
  const embed = new EmbedBuilder()
    .setColor(color || '#5865F2')
    .setTitle('🎛️ Voice Channel Control Panel')
    .setDescription('You are the **owner** of this room. Use the buttons below to manage it.')
    .addFields(
      { name: '👑 Owner', value: '<@' + entry.ownerId + '>', inline: true },
      { name: '🔒 Access', value: entry.locked ? '🔒 Locked' : '🌐 Public', inline: true },
      { name: '👥 User Limit', value: voice && voice.userLimit ? String(voice.userLimit) : 'Unlimited', inline: true },
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(entry.locked ? 'tv_unlock' : 'tv_lock')
      .setLabel(entry.locked ? 'Unlock' : 'Lock')
      .setEmoji(entry.locked ? '🔓' : '🔒')
      .setStyle(entry.locked ? ButtonStyle.Success : ButtonStyle.Secondary),
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
      .setCustomId('tv_delete')
      .setLabel('Delete')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row] };
}

async function sendControlPanel(textChannel, voice, entry, member, color) {
  const msg = await textChannel
    .send({ content: '<@' + member.id + '>', ...buildPanel(voice, entry, color) })
    .catch(() => null);
  if (msg) entry.panelMessageId = msg.id;
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
    { id: member.id, allow: ['ViewChannel', 'Connect', 'Speak', 'Stream', 'UseVAD', 'ManageChannels', 'MoveMembers'] },
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
  }

  const entry = {
    voiceChannelId: voice.id,
    textChannelId: text ? text.id : null,
    ownerId: member.id,
    guildId: guild.id,
    createdAt: Date.now(),
    locked: false,
    panelMessageId: null,
  };
  activeChannels.set(voice.id, entry);

  if (text) {
    const config = await getGuildConfig(guild.id);
    await text.send({
      content: '🛡️ **Moderation channel** for `' + vcName + '` · Owner: ' + user,
    }).catch(() => {});
    await sendControlPanel(text, voice, entry, member, config.embedColor);
  }

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

async function handleInteraction(interaction) {
  const entry = [...activeChannels.values()].find(e => e.textChannelId === interaction.channel.id);
  if (!entry) {
    return interaction.reply({ content: 'This control panel is no longer active.', ephemeral: true });
  }

  const isOwner = interaction.user.id === entry.ownerId;
  const isStaff = interaction.member.permissions.has('ManageGuild') || interaction.member.permissions.has('ManageChannels');
  if (!isOwner && !isStaff) {
    return interaction.reply({ content: 'Only the channel owner can use this panel.', ephemeral: true });
  }

  const guild = interaction.guild;
  const voice = guild.channels.cache.get(entry.voiceChannelId);

  if (interaction.isButton()) {
    if (interaction.customId === 'tv_lock' || interaction.customId === 'tv_unlock') {
      if (!voice) return interaction.reply({ content: 'Voice channel not found.', ephemeral: true });
      const locking = interaction.customId === 'tv_lock';
      await voice.permissionOverwrites.edit(guild.id, { Connect: locking ? false : null }).catch(() => {});
      entry.locked = locking;
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

    if (interaction.customId === 'tv_delete') {
      await interaction.reply({ content: '🗑️ Deleting your channel...', ephemeral: true });
      await cleanupChannel(guild, entry.voiceChannelId);
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
  handleInteraction,
  createTempChannels,
};
