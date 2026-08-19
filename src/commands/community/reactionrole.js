const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed, modEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');
const { startSetup } = require('../../utils/reactionRoles');

function buildList(config) {
  var rrs = config.reactionRoles || [];
  if (rrs.length === 0) {
    return { empty: true };
  }
  var list = rrs.map(function(rr, i) {
    var channel = rr.channelId ? '<#' + rr.channelId + '>' : 'Unknown';
    var roleCount = rr.roles ? rr.roles.length : 0;
    return '**' + (i + 1) + '.** ' + (rr.title || 'Untitled') + ' \u2022 ' + channel + ' \u2022 ' + roleCount + ' role(s) \u2022 `' + rr.messageId + '`';
  }).join('\n');
  return {
    empty: false,
    embed: modEmbed(emojis.list, 'Reaction Roles', [
      { name: emojis.chart + ' Total', value: '' + rrs.length, inline: true },
      { name: '\u200b', value: list, inline: false },
    ], { color: COLORS.blurple }),
  };
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
      var result = buildList(config);
      if (result.empty) {
        return message.reply({ embeds: [infoEmbed('Reaction Roles', emojis.list + ' No reaction role messages configured.\nUse `!reactionrole setup` to create one.')] });
      }
      return message.reply({ embeds: [result.embed] });
    }

    if (args[0] === 'delete') {
      if (!args[1]) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!reactionrole delete <messageId>`')] });

      var config = await getGuildConfig(message.guild.id);
      var found = (config.reactionRoles || []).find(function(rr) { return rr.messageId === args[1]; });
      if (!found) {
        return message.reply({ embeds: [errorEmbed('Not Found', 'No reaction role found with that message ID.')] });
      }

      try {
        var channel = message.guild.channels.cache.get(found.channelId);
        if (channel) {
          var msg = await channel.messages.fetch(args[1]);
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
      var result = buildList(config);
      if (result.empty) {
        return interaction.reply({ embeds: [infoEmbed('Reaction Roles', emojis.list + ' No reaction role messages configured.\nUse `/reactionrole setup` to create one.')], ephemeral: true });
      }
      return interaction.reply({ embeds: [result.embed], ephemeral: true });
    }

    if (sub === 'delete') {
      var msgId = interaction.options.getString('message_id');
      var config = await getGuildConfig(interaction.guild.id);
      var found = (config.reactionRoles || []).find(function(rr) { return rr.messageId === msgId; });
      if (!found) {
        return interaction.reply({ embeds: [errorEmbed('Not Found', 'No reaction role found with that message ID.')], ephemeral: true });
      }

      try {
        var channel = interaction.guild.channels.cache.get(found.channelId);
        if (channel) {
          var msg = await channel.messages.fetch(msgId);
          if (msg) await msg.delete().catch(function() {});
        }
      } catch (e) {}

      var filtered = (config.reactionRoles || []).filter(function(rr) { return rr.messageId !== msgId; });
      await updateGuildConfig(interaction.guild.id, { reactionRoles: filtered });
      return interaction.reply({ embeds: [successEmbed('Deleted', emojis.trash + ' Reaction role message deleted.')] });
    }
  },
};