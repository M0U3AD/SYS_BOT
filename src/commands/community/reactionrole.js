const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed, modEmbed, dashboardEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');
const { initSetup } = require('../../events/interactionCreate');

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

async function startSetup(source, client) {
  var guild = source.guild;
  var userId = source.member ? source.member.id : source.user.id;

  var embed = buildPanelEmbed(guild, { pairs: [], channelId: null, title: 'Select Your Roles' });
  var buttons = buildPanelButtons(false, false);

  var msg;
  if (source.replied || source.deferred) {
    await source.editReply({ embeds: [embed], components: buttons });
    msg = await source.fetchReply();
  } else {
    msg = await source.reply({ embeds: [embed], components: buttons });
  }

  var data = { pairs: [], channelId: null, title: 'Select Your Roles', guildId: guild.id, panelMessage: msg, panelMsgId: msg.id, panelChannelId: msg.channelId };
  initSetup(userId, data);
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
