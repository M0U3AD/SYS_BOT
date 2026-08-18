const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed, modEmbed, dashboardEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');

var setups = new Map();

function getSetupData(userId) {
  return setups.get(userId) || null;
}

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
    '',
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

  var row2 = new ActionRowBuilder().addComponents(
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
  var pairs = data.pairs || [];
  var description = pairs.map(function(p) {
    return p.emoji + ' \u2192 <@&' + p.roleId + '>';
  }).join('\n');

  return new EmbedBuilder()
    .setColor(COLORS.blurple)
    .setTitle(data.title || 'Select Your Roles')
    .setDescription(description + '\n\nClick a button below to get/remove a role.')
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
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(p.emoji)
    );
  });

  rows.push(currentRow);
  return rows;
}

async function startSetup(source, client) {
  var guild = source.guild;
  var userId = source.member ? source.member.id : source.user.id;

  var data = { pairs: [], channelId: null, title: 'Select Your Roles', guildId: guild.id };
  setups.set(userId, data);

  var embed = buildPanelEmbed(guild, data);
  var buttons = buildPanelButtons(false, false);

  if (source.replied || source.deferred) {
    var msg = await source.editReply({ embeds: [embed], components: buttons });
  } else {
    var msg = await source.reply({ embeds: [embed], components: buttons });
  }

  var collector = msg.createMessageComponentCollector({ time: 300000 });

  collector.on('collect', async function(i) {
    if (i.user.id !== userId) {
      return i.reply({ content: 'This setup is not for you.', ephemeral: true });
    }

    var currentData = setups.get(userId);
    if (!currentData) {
      collector.stop('expired');
      return i.reply({ content: 'Setup expired.', ephemeral: true });
    }

    if (i.customId === 'rr_add_pair') {
      var modal = new ModalBuilder()
        .setCustomId('rr_modal_add')
        .setTitle('Add Role Pair');

      var roleInput = new TextInputBuilder()
        .setCustomId('rr_role_input')
        .setLabel('Role (mention or ID)')
        .setPlaceholder('@Moderator or 1234567890123456789')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      var emojiInput = new TextInputBuilder()
        .setCustomId('rr_emoji_input')
        .setLabel('Emoji (unicode or custom)')
        .setPlaceholder('🔴 or :moderator: or <a:star:123>')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(roleInput),
        new ActionRowBuilder().addComponents(emojiInput)
      );

      await i.showModal(modal);

      try {
        var modalInteraction = await i.awaitModalSubmit({ time: 60000, filter: function(mi) { return mi.user.id === userId; } });

        var roleText = modalInteraction.fields.getTextInputValue('rr_role_input').trim();
        var emojiText = modalInteraction.fields.getTextInputValue('rr_emoji_input').trim();

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
          var found = guild.roles.cache.find(function(r) { return r.name.toLowerCase() === cleanText.toLowerCase(); });
          if (found) { roleId = found.id; roleName = found.name; }
        }

        if (!roleId) {
          return modalInteraction.reply({ embeds: [errorEmbed('Role Not Found', 'Could not find a role matching **' + roleText + '**.')], ephemeral: true });
        }

        var role = guild.roles.cache.get(roleId);
        if (role && guild.members.me && role.position >= guild.members.me.roles.highest.position) {
          return modalInteraction.reply({ embeds: [errorEmbed('Role Too High', 'I cannot assign this role.')], ephemeral: true });
        }

        var duplicate = currentData.pairs.find(function(p) { return p.emoji === emojiText || p.roleId === roleId; });
        if (duplicate) {
          return modalInteraction.reply({ embeds: [errorEmbed('Duplicate', 'This emoji or role is already in the list.')], ephemeral: true });
        }

        currentData.pairs.push({ roleId: roleId, roleName: roleName, emoji: emojiText });
        setups.set(userId, currentData);

        var updatedEmbed = buildPanelEmbed(guild, currentData);
        var updatedButtons = buildPanelButtons(currentData.pairs.length > 0, !!currentData.channelId);
        await modalInteraction.update({ embeds: [updatedEmbed], components: updatedButtons });
      } catch (err) {
        console.error('Modal error:', err.message);
      }
      return;
    }

    if (i.customId === 'rr_remove_pair') {
      if (currentData.pairs.length === 0) {
        return i.reply({ embeds: [errorEmbed('Empty', 'No pairs to remove.')], ephemeral: true });
      }

      var selectMenu = new StringSelectMenuBuilder()
        .setCustomId('rr_select_remove')
        .setPlaceholder('Select a pair to remove')
        .setMinValues(1)
        .setMaxValues(currentData.pairs.length);

      currentData.pairs.forEach(function(p, idx) {
        selectMenu.addOptions({
          label: p.roleName || ('Role ' + (idx + 1)),
          description: p.emoji + ' \u2192 Role',
          value: '' + idx,
        });
      });

      var selectRow = new ActionRowBuilder().addComponents(selectMenu);
      return i.reply({ content: '**Select pairs to remove:**', components: [selectRow], ephemeral: true });
    }

    if (i.customId === 'rr_set_channel') {
      var channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('rr_channel_select')
        .setPlaceholder('Select a channel for reaction roles')
        .setChannelTypes(ChannelType.GuildText);

      var channelRow = new ActionRowBuilder().addComponents(channelSelect);
      return i.reply({ content: '**Select the channel:**', components: [channelRow], ephemeral: true });
    }

    if (i.customId === 'rr_send') {
      if (currentData.pairs.length === 0) {
        return i.reply({ embeds: [errorEmbed('No Pairs', 'Add at least one role pair.')], ephemeral: true });
      }
      if (!currentData.channelId) {
        return i.reply({ embeds: [errorEmbed('No Channel', 'Set a channel first.')], ephemeral: true });
      }

      var targetChannel = guild.channels.cache.get(currentData.channelId);
      if (!targetChannel) {
        return i.reply({ embeds: [errorEmbed('Channel Not Found', 'Channel no longer exists.')], ephemeral: true });
      }

      var rrEmbed = buildPreviewEmbed(currentData);
      var rrButtons = buildPreviewButtons(currentData);

      try {
        var sentMsg = await targetChannel.send({ embeds: [rrEmbed], components: rrButtons });

        var config = await getGuildConfig(guild.id);
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
        return i.reply({ embeds: [errorEmbed('Send Failed', err.message)], ephemeral: true });
      }
    }

    if (i.customId === 'rr_cancel') {
      setups.delete(userId);
      collector.stop('cancelled');
      return i.update({ embeds: [errorEmbed('Setup Cancelled', 'Reaction role setup cancelled.')], components: [] });
    }
  });

  collector.on('end', function(collected, reason) {
    if (reason === 'sent' || reason === 'cancelled') return;
    setups.delete(userId);
    try {
      msg.edit({ embeds: [errorEmbed('Timed Out', 'Setup expired after 5 minutes.')], components: [] }).catch(function() {});
    } catch (e) {}
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
      var config = await getGuildConfig(message.guild.id);
      var rrs = config.reactionRoles || [];
      if (rrs.length === 0) {
        return message.reply({ embeds: [infoEmbed('Reaction Roles', emojis.list + ' No reaction role messages configured.\nUse `!reactionrole setup` to create one.')] });
      }

      var list = rrs.map(function(rr, i) {
        var channel = rr.channelId ? '<#' + rr.channelId + '>' : 'Unknown';
        var roleCount = rr.roles ? rr.roles.length : 0;
        return '**' + (i + 1) + '.** ' + (rr.title || 'Untitled') + ' \u2022 ' + channel + ' \u2022 ' + roleCount + ' role(s) \u2022 `' + rr.messageId + '`';
      }).join('\n');

      var embed = modEmbed(emojis.list, 'Reaction Roles', [
        { name: emojis.chart + ' Total', value: '' + rrs.length, inline: true },
        { name: '\u200b', value: list, inline: false },
      ], { color: COLORS.blurple });

      return message.reply({ embeds: [embed] });
    }

    if (args[0] === 'delete') {
      if (!args[1]) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!reactionrole delete <messageId>`')] });

      var config = await getGuildConfig(message.guild.id);
      var found = (config.reactionRoles || []).find(function(rr) { return rr.messageId === args[1]; });
      if (!found) {
        return message.reply({ embeds: [errorEmbed('Not Found', 'No reaction role found with that message ID.')] });
      }

      try {
        var ch = message.guild.channels.cache.get(found.channelId);
        if (ch) {
          var msg = await ch.messages.fetch(args[1]);
          if (msg) await msg.delete().catch(function() {});
        }
      } catch (e) {}

      var filtered = (config.reactionRoles || []).filter(function(rr) { return rr.messageId !== args[1]; });
      await updateGuildConfig(message.guild.id, { reactionRoles: filtered });
      return message.reply({ embeds: [successEmbed('Deleted', emojis.trash + ' Reaction role message deleted.')] });
    }

    if (args[0] === 'setup' || !args[0]) {
      return startSetup(message, null);
    }

    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!reactionrole setup|list|delete`')] });
  },

  async slashExecute(interaction, client) {
    var sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      await interaction.deferReply({ ephemeral: true });
      return startSetup(interaction, client);
    }

    if (sub === 'list') {
      var config = await getGuildConfig(interaction.guild.id);
      var rrs = config.reactionRoles || [];
      if (rrs.length === 0) {
        return interaction.reply({ embeds: [infoEmbed('Reaction Roles', emojis.list + ' No reaction role messages configured.\nUse `/reactionrole setup` to create one.')], ephemeral: true });
      }

      var list = rrs.map(function(rr, i) {
        var channel = rr.channelId ? '<#' + rr.channelId + '>' : 'Unknown';
        var roleCount = rr.roles ? rr.roles.length : 0;
        return '**' + (i + 1) + '.** ' + (rr.title || 'Untitled') + ' \u2022 ' + channel + ' \u2022 ' + roleCount + ' role(s) \u2022 `' + rr.messageId + '`';
      }).join('\n');

      var embed = modEmbed(emojis.list, 'Reaction Roles', [
        { name: emojis.chart + ' Total', value: '' + rrs.length, inline: true },
        { name: '\u200b', value: list, inline: false },
      ], { color: COLORS.blurple });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'delete') {
      var msgId = interaction.options.getString('message_id');
      var config = await getGuildConfig(interaction.guild.id);
      var found = (config.reactionRoles || []).find(function(rr) { return rr.messageId === msgId; });
      if (!found) {
        return interaction.reply({ embeds: [errorEmbed('Not Found', 'No reaction role found with that message ID.')], ephemeral: true });
      }

      try {
        var ch = interaction.guild.channels.cache.get(found.channelId);
        if (ch) {
          var msg = await ch.messages.fetch(msgId);
          if (msg) await msg.delete().catch(function() {});
        }
      } catch (e) {}

      var filtered = (config.reactionRoles || []).filter(function(rr) { return rr.messageId !== msgId; });
      await updateGuildConfig(interaction.guild.id, { reactionRoles: filtered });
      return interaction.reply({ embeds: [successEmbed('Deleted', emojis.trash + ' Reaction role message deleted.')] });
    }
  },
};
