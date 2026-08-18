const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed, modEmbed, dashboardEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');

const setups = new Map();

function buildPanelEmbed(guild, data) {
  const pairs = data.pairs || [];
  const channel = data.channelId ? '<#' + data.channelId + '>' : 'Not set';
  const title = data.title || 'Select Your Roles';

  let pairsList = 'No role pairs added yet.';
  if (pairs.length > 0) {
    pairsList = pairs.map(function(p, i) {
      return '**' + (i + 1) + '.** ' + p.emoji + ' \u2192 ' + p.role;
    }).join('\n');
  }

  return dashboardEmbed(
    emojis.role + ' Reaction Role Setup',
    '',
    [
      { name: emojis.tag + ' Title', value: title, inline: true },
      { name: emojis.channel + ' Channel', value: channel, inline: true },
      { name: emojis.chart + ' Pairs', value: '' + pairs.length, inline: true },
      { name: emojis.list + ' Role Pairs', value: pairsList, inline: false },
    ],
    { color: COLORS.blurple }
  );
}

function buildPanelButtons(hasPairs, hasChannel) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rr_add_pair')
      .setLabel('Add Role Pair')
      .setStyle(ButtonStyle.Success)
      .setEmoji(emojis.add),
    new ButtonBuilder()
      .setCustomId('rr_remove_pair')
      .setLabel('Remove Pair')
      .setStyle(ButtonStyle.Danger)
      .setEmoji(emojis.remove)
      .setDisabled(!hasPairs),
    new ButtonBuilder()
      .setCustomId('rr_set_channel')
      .setLabel('Set Channel')
      .setStyle(ButtonStyle.Primary)
      .setEmoji(emojis.channel)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rr_preview')
      .setLabel('Preview')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(emojis.preview)
      .setDisabled(!hasPairs),
    new ButtonBuilder()
      .setCustomId('rr_send')
      .setLabel('Send Reaction Role')
      .setStyle(ButtonStyle.Success)
      .setEmoji(emojis.send)
      .setDisabled(!hasPairs || !hasChannel),
    new ButtonBuilder()
      .setCustomId('rr_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(emojis.cross)
  );

  return [row1, row2];
}

function buildPreviewEmbed(data) {
  const pairs = data.pairs || [];
  const description = pairs.map(function(p) {
    return p.emoji + ' \u2192 ' + p.role;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(COLORS.blurple)
    .setTitle(data.title || 'Select Your Roles')
    .setDescription(description + '\n\nClick a button below to get/remove a role.')
    .setTimestamp()
    .setFooter({ text: 'SYS-F1ex \u2022 Reaction Roles' });
}

function buildPreviewButtons(data) {
  const pairs = data.pairs || [];
  if (pairs.length === 0) return [];

  const rows = [];
  let currentRow = new ActionRowBuilder();

  pairs.forEach(function(p, i) {
    if (i > 0 && i % 5 === 0) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }

    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId('rr_toggle_' + i)
        .setLabel(p.roleName || p.role)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(p.emoji)
    );
  });

  rows.push(currentRow);
  return rows;
}

async function startSetup(source, client) {
  const guild = source.guild;
  const userId = source.member ? source.member.id : source.user.id;
  const config = await getGuildConfig(guild.id);

  const data = { pairs: [], channelId: null, title: 'Select Your Roles', guildId: guild.id };
  setups.set(userId, data);

  const embed = buildPanelEmbed(guild, data);
  const buttons = buildPanelButtons(false, false);

  let response;
  if (source.replied || source.deferred) {
    response = await source.editReply({ embeds: [embed], components: buttons });
  } else {
    response = await source.reply({ embeds: [embed], components: buttons });
  }

  const collector = response.createMessageComponentCollector({ time: 300000 });

  collector.on('collect', async function(i) {
    if (i.user.id !== userId) {
      return i.reply({ content: 'This setup is not for you.', ephemeral: true });
    }

    const currentData = setups.get(userId);
    if (!currentData) {
      collector.stop('expired');
      return i.reply({ content: 'Setup has expired.', ephemeral: true });
    }

    if (i.customId === 'rr_add_pair') {
      const modal = new ModalBuilder()
        .setCustomId('rr_modal_add')
        .setTitle('Add Role Pair');

      const roleInput = new TextInputBuilder()
        .setCustomId('rr_role_input')
        .setLabel('Role (mention or ID)')
        .setPlaceholder('Example: @Moderator or 1234567890123456789')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const emojiInput = new TextInputBuilder()
        .setCustomId('rr_emoji_input')
        .setLabel('Emoji (unicode or custom emoji ID)')
        .setPlaceholder('Example: 🔴 or :moderator: or <a:star:123>')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(roleInput),
        new ActionRowBuilder().addComponents(emojiInput)
      );

      await i.showModal(modal);

      try {
        const modalInteraction = await i.awaitModalSubmit({ time: 60000, filter: function(mi) { return mi.user.id === userId; } });

        const roleText = modalInteraction.fields.getTextInputValue('rr_role_input').trim();
        const emojiText = modalInteraction.fields.getTextInputValue('rr_emoji_input').trim();

        let roleId = null;
        let roleName = roleText;
        const roleMentionMatch = roleText.match(/^<@&(\d+)>$/);
        const directIdMatch = roleText.match(/^\d+$/);
        const mentionMatch = roleText.match(/^@(.+)$/);

        if (roleMentionMatch) {
          roleId = roleMentionMatch[1];
        } else if (directIdMatch) {
          roleId = directIdMatch[0];
        } else if (mentionMatch) {
          const found = guild.roles.cache.find(function(r) { return r.name.toLowerCase() === mentionMatch[1].toLowerCase(); });
          if (found) { roleId = found.id; roleName = found.name; }
        } else {
          const found = guild.roles.cache.find(function(r) { return r.name.toLowerCase() === roleText.toLowerCase(); });
          if (found) { roleId = found.id; roleName = found.name; }
        }

        if (!roleId) {
          return modalInteraction.reply({ embeds: [errorEmbed('Role Not Found', 'Could not find a role matching **' + roleText + '**.')], ephemeral: true });
        }

        const role = guild.roles.cache.get(roleId);
        if (role && role.position >= guild.members.me.roles.highest.position) {
          return modalInteraction.reply({ embeds: [errorEmbed('Role Too High', 'I cannot assign this role. It is equal to or higher than my highest role.')], ephemeral: true });
        }

        const emojiRegex = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F]{1,10}$|^<a?:\w+:\d+>$/u;
        if (!emojiRegex.test(emojiText)) {
          return modalInteraction.reply({ embeds: [errorEmbed('Invalid Emoji', 'Please provide a valid Unicode emoji or custom emoji (e.g. :emoji_name: or <a:name:id>).')], ephemeral: true });
        }

        const duplicate = currentData.pairs.find(function(p) { return p.emoji === emojiText || p.roleId === roleId; });
        if (duplicate) {
          return modalInteraction.reply({ embeds: [errorEmbed('Duplicate', 'This emoji or role is already in the list.')], ephemeral: true });
        }

        currentData.pairs.push({ roleId: roleId, roleName: roleName, role: '<@&' + roleId + '>', emoji: emojiText });
        setups.set(userId, currentData);

        const updatedEmbed = buildPanelEmbed(guild, currentData);
        const updatedButtons = buildPanelButtons(currentData.pairs.length > 0, !!currentData.channelId);
        await modalInteraction.update({ embeds: [updatedEmbed], components: updatedButtons });
      } catch (err) {
        console.error('Modal error:', err);
      }
      return;
    }

    if (i.customId === 'rr_remove_pair') {
      if (currentData.pairs.length === 0) {
        return i.reply({ embeds: [errorEmbed('Empty', 'No pairs to remove.')], ephemeral: true });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('rr_select_remove')
        .setPlaceholder('Select a pair to remove')
        .setMinValues(1)
        .setMaxValues(currentData.pairs.length);

      currentData.pairs.forEach(function(p, idx) {
        selectMenu.addOptions({
          label: p.roleName || p.role,
          description: p.emoji + ' \u2192 Role',
          value: '' + idx,
          emoji: undefined
        });
      });

      const selectRow = new ActionRowBuilder().addComponents(selectMenu);
      return i.reply({ content: '**Select pairs to remove:**', components: [selectRow], ephemeral: true });
    }

    if (i.customId === 'rr_select_remove') {
      const indices = i.values.map(Number).sort(function(a, b) { return b - a; });
      indices.forEach(function(idx) { currentData.pairs.splice(idx, 1); });
      setups.set(userId, currentData);

      const updatedEmbed = buildPanelEmbed(guild, currentData);
      const updatedButtons = buildPanelButtons(currentData.pairs.length > 0, !!currentData.channelId);
      await i.update({ embeds: [updatedEmbed], components: updatedButtons });
      return;
    }

    if (i.customId === 'rr_set_channel') {
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('rr_channel_select')
        .setPlaceholder('Select a channel for reaction roles')
        .setChannelTypes(ChannelType.GuildText);

      const channelRow = new ActionRowBuilder().addComponents(channelSelect);
      return i.reply({ content: '**Select the channel to send the reaction role message in:**', components: [channelRow], ephemeral: true });
    }

    if (i.customId === 'rr_channel_select') {
      currentData.channelId = i.values[0];
      setups.set(userId, currentData);

      const updatedEmbed = buildPanelEmbed(guild, currentData);
      const updatedButtons = buildPanelButtons(currentData.pairs.length > 0, !!currentData.channelId);
      await i.update({ embeds: [updatedEmbed], components: updatedButtons });
      return;
    }

    if (i.customId === 'rr_preview') {
      const previewEmbed = buildPreviewEmbed(currentData);
      const previewButtons = buildPreviewButtons(currentData);
      return i.reply({ embeds: [previewEmbed], components: previewButtons, ephemeral: true });
    }

    if (i.customId === 'rr_send') {
      if (currentData.pairs.length === 0) {
        return i.reply({ embeds: [errorEmbed('No Pairs', 'Add at least one role pair before sending.')], ephemeral: true });
      }
      if (!currentData.channelId) {
        return i.reply({ embeds: [errorEmbed('No Channel', 'Set a channel before sending.')], ephemeral: true });
      }

      const targetChannel = guild.channels.cache.get(currentData.channelId);
      if (!targetChannel) {
        return i.reply({ embeds: [errorEmbed('Channel Not Found', 'The selected channel no longer exists.')], ephemeral: true });
      }

      const rrEmbed = buildPreviewEmbed(currentData);
      const rrButtons = buildPreviewButtons(currentData);

      try {
        const sentMsg = await targetChannel.send({ embeds: [rrEmbed], components: rrButtons });

        const config = await getGuildConfig(guild.id);
        if (!config.reactionRoles) config.reactionRoles = [];
        config.reactionRoles.push({
          messageId: sentMsg.id,
          channelId: targetChannel.id,
          title: currentData.title,
          roles: currentData.pairs.map(function(p) {
            return { roleId: p.roleId, emoji: p.emoji, roleName: p.roleName };
          }),
        });
        await updateGuildConfig(guild.id, { reactionRoles: config.reactionRoles });

        setups.delete(userId);
        collector.stop('sent');

        return i.update({
          embeds: [successEmbed('Reaction Role Sent', emojis.check + ' Sent to ' + targetChannel.toString() + ' with **' + currentData.pairs.length + '** role pair(s).')],
          components: []
        });
      } catch (err) {
        return i.reply({ embeds: [errorEmbed('Send Failed', 'Could not send the message: ' + err.message)], ephemeral: true });
      }
    }

    if (i.customId === 'rr_cancel') {
      setups.delete(userId);
      collector.stop('cancelled');
      return i.update({ embeds: [errorEmbed('Setup Cancelled', 'Reaction role setup has been cancelled.')], components: [] });
    }
  });

  collector.on('end', function(collected, reason) {
    if (reason === 'sent' || reason === 'cancelled') return;
    setups.delete(userId);
    try {
      response.edit({ embeds: [errorEmbed('Timed Out', 'Setup expired after 5 minutes. Run the command again.')], components: [] }).catch(function() {});
    } catch {}
  });
}

module.exports = {
  name: 'reactionrole',
  description: 'Create reaction role messages with interactive setup',
  usage: '!reactionrole setup | !reactionrole list | !reactionrole delete <messageId>',
  slash: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Manage reaction roles')
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Interactive reaction role setup'))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List all reaction role messages'))
    .addSubcommand(sub => sub
      .setName('delete')
      .setDescription('Delete a reaction role message')
      .addStringOption(opt => opt.setName('message_id').setDescription('Message ID').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(message, args) {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ embeds: [errorEmbed('Access Denied', 'You need the `Manage Server` permission.')] });
    }

    if (args[0] === 'list') {
      const config = await getGuildConfig(message.guild.id);
      const rrs = config.reactionRoles || [];
      if (rrs.length === 0) {
        return message.reply({ embeds: [infoEmbed('Reaction Roles', emojis.list + ' No reaction role messages configured.\nUse `!reactionrole setup` to create one.')] });
      }

      const list = rrs.map(function(rr, i) {
        const channel = rr.channelId ? '<#' + rr.channelId + '>' : 'Unknown';
        const roleCount = rr.roles ? rr.roles.length : 0;
        return '**' + (i + 1) + '.** ' + (rr.title || 'Untitled') + ' \u2022 ' + channel + ' \u2022 ' + roleCount + ' role(s) \u2022 `' + rr.messageId + '`';
      }).join('\n');

      const embed = modEmbed(emojis.list, 'Reaction Roles', [
        { name: emojis.chart + ' Total', value: '' + rrs.length, inline: true },
        { name: '\u200b', value: list, inline: false },
      ], { color: COLORS.blurple });

      return message.reply({ embeds: [embed] });
    }

    if (args[0] === 'delete') {
      if (!args[1]) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!reactionrole delete <messageId>`')] });

      const config = await getGuildConfig(message.guild.id);
      const found = (config.reactionRoles || []).find(function(rr) { return rr.messageId === args[1]; });
      if (!found) {
        return message.reply({ embeds: [errorEmbed('Not Found', 'No reaction role found with that message ID.')] });
      }

      try {
        const ch = message.guild.channels.cache.get(found.channelId);
        if (ch) {
          const msg = await ch.messages.fetch(args[1]);
          if (msg) await msg.delete().catch(function() {});
        }
      } catch {}

      const filtered = (config.reactionRoles || []).filter(function(rr) { return rr.messageId !== args[1]; });
      await updateGuildConfig(message.guild.id, { reactionRoles: filtered });
      return message.reply({ embeds: [successEmbed('Deleted', emojis.trash + ' Reaction role message has been deleted.')] });
    }

    if (args[0] === 'setup' || !args[0]) {
      return startSetup(message, null);
    }

    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!reactionrole setup|list|delete`')] });
  },

  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      await interaction.deferReply({ ephemeral: true });
      return startSetup(interaction, client);
    }

    if (sub === 'list') {
      const config = await getGuildConfig(interaction.guild.id);
      const rrs = config.reactionRoles || [];
      if (rrs.length === 0) {
        return interaction.reply({ embeds: [infoEmbed('Reaction Roles', emojis.list + ' No reaction role messages configured.\nUse `/reactionrole setup` to create one.')], ephemeral: true });
      }

      const list = rrs.map(function(rr, i) {
        const channel = rr.channelId ? '<#' + rr.channelId + '>' : 'Unknown';
        const roleCount = rr.roles ? rr.roles.length : 0;
        return '**' + (i + 1) + '.** ' + (rr.title || 'Untitled') + ' \u2022 ' + channel + ' \u2022 ' + roleCount + ' role(s) \u2022 `' + rr.messageId + '`';
      }).join('\n');

      const embed = modEmbed(emojis.list, 'Reaction Roles', [
        { name: emojis.chart + ' Total', value: '' + rrs.length, inline: true },
        { name: '\u200b', value: list, inline: false },
      ], { color: COLORS.blurple });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'delete') {
      const msgId = interaction.options.getString('message_id');
      const config = await getGuildConfig(interaction.guild.id);
      const found = (config.reactionRoles || []).find(function(rr) { return rr.messageId === msgId; });
      if (!found) {
        return interaction.reply({ embeds: [errorEmbed('Not Found', 'No reaction role found with that message ID.')], ephemeral: true });
      }

      try {
        const ch = interaction.guild.channels.cache.get(found.channelId);
        if (ch) {
          const msg = await ch.messages.fetch(msgId);
          if (msg) await msg.delete().catch(function() {});
        }
      } catch {}

      const filtered = (config.reactionRoles || []).filter(function(rr) { return rr.messageId !== msgId; });
      await updateGuildConfig(interaction.guild.id, { reactionRoles: filtered });
      return interaction.reply({ embeds: [successEmbed('Deleted', emojis.trash + ' Reaction role message has been deleted.')] });
    }
  },
};
