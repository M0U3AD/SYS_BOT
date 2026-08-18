const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed, dashboardEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const { getGuildConfig } = require('../../database/utils/GuildConfig');

function buildMainPanel(config) {
  var fields = [
    { name: emojis.shield + ' Moderation', value: config.moderation.automod.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
    { name: emojis.globe + ' Welcome', value: config.welcome.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
    { name: emojis.ticket + ' Tickets', value: config.tickets.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
    { name: emojis.star + ' XP/Levels', value: config.xp.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
    { name: emojis.coin + ' Economy', value: config.economy.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
    { name: emojis.giveaway + ' Giveaways', value: config.giveaways.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
    { name: emojis.notify + ' Notifications', value: 'YT: ' + (config.notifications.youtube ? config.notifications.youtube.length : 0) + ' | TW: ' + (config.notifications.twitch ? config.notifications.twitch.length : 0) + ' | RD: ' + (config.notifications.reddit ? config.notifications.reddit.length : 0), inline: true },
    { name: emojis.globe + ' Language', value: (config.language || 'en').toUpperCase(), inline: true },
    { name: emojis.eye + ' Verification', value: config.verification.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
  ];

  return new EmbedBuilder()
    .setColor(COLORS.blurple)
    .setTitle(emojis.gear + ' SYS-F1ex Setup')
    .setDescription('Click a button below to configure each feature:')
    .addFields(fields)
    .setTimestamp()
    .setFooter({ text: 'SYS-F1ex \u2022 Dashboard' });
}

function buildMainButtons() {
  var row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_panel_moderation').setLabel('Moderation').setStyle(ButtonStyle.Primary).setEmoji(emojis.shield),
    new ButtonBuilder().setCustomId('setup_panel_welcome').setLabel('Welcome').setStyle(ButtonStyle.Primary).setEmoji(emojis.globe),
    new ButtonBuilder().setCustomId('setup_panel_tickets').setLabel('Tickets').setStyle(ButtonStyle.Primary).setEmoji(emojis.ticket),
    new ButtonBuilder().setCustomId('setup_panel_xp').setLabel('XP/Levels').setStyle(ButtonStyle.Primary).setEmoji(emojis.star),
    new ButtonBuilder().setCustomId('setup_panel_economy').setLabel('Economy').setStyle(ButtonStyle.Primary).setEmoji(emojis.coin),
  );
  var row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_panel_giveaways').setLabel('Giveaways').setStyle(ButtonStyle.Secondary).setEmoji(emojis.giveaway),
    new ButtonBuilder().setCustomId('setup_panel_notifications').setLabel('Notifications').setStyle(ButtonStyle.Secondary).setEmoji(emojis.notify),
    new ButtonBuilder().setCustomId('setup_panel_verification').setLabel('Verification').setStyle(ButtonStyle.Secondary).setEmoji(emojis.eye),
  );

  return [row1, row2];
}

function buildFeaturePanel(feature, config) {
  var panels = {
    'moderation': {
      title: emojis.shield + ' Moderation Setup',
      desc: 'Configure auto-moderation and punishment settings.',
      fields: [
        { name: 'AutoMod', value: config.moderation.automod.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'Anti-Spam', value: config.moderation.automod.antiSpam ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'Anti-Link', value: config.moderation.automod.antiLink ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'Anti-Invite', value: config.moderation.automod.antiInvite ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'Bad Words', value: (config.moderation.automod.badWords ? config.moderation.automod.badWords.length : 0) + ' word(s)', inline: true },
        { name: 'Max Mentions', value: '' + (config.moderation.automod.maxMentions || 5), inline: true },
        { name: 'Warn Auto-Mute', value: config.moderation.warnAutoMute > 0 ? 'After ' + config.moderation.warnAutoMute + ' warns' : 'Disabled', inline: true },
        { name: 'Warn Auto-Ban', value: config.moderation.warnAutoBan > 0 ? 'After ' + config.moderation.warnAutoBan + ' warns' : 'Disabled', inline: true },
      ],
      toggleId: 'setup_toggle_automod',
      isOn: config.moderation.automod.enabled,
    },
    'welcome': {
      title: emojis.globe + ' Welcome/Goodbye Setup',
      desc: 'Configure welcome and goodbye messages.',
      fields: [
        { name: 'Welcome', value: config.welcome.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'Goodbye', value: config.goodbye.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'Welcome Channel', value: config.welcome.channelId ? '<#' + config.welcome.channelId + '>' : 'Not set', inline: true },
        { name: 'Goodbye Channel', value: config.goodbye.channelId ? '<#' + config.goodbye.channelId + '>' : 'Not set', inline: true },
        { name: 'Welcome Message', value: (config.welcome.message || '').substring(0, 100) || 'Default', inline: false },
      ],
      toggleId: 'setup_toggle_welcome',
      isOn: config.welcome.enabled,
    },
    'tickets': {
      title: emojis.ticket + ' Ticket Setup',
      desc: 'Configure the ticket system.',
      fields: [
        { name: 'Enabled', value: config.tickets.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'Support Role', value: config.tickets.supportRoleId ? '<@&' + config.tickets.supportRoleId + '>' : 'Not set', inline: true },
        { name: 'Transcript Channel', value: config.tickets.transcriptChannelId ? '<#' + config.tickets.transcriptChannelId + '>' : 'Not set', inline: true },
      ],
      toggleId: 'setup_toggle_tickets',
      isOn: config.tickets.enabled,
    },
    'xp': {
      title: emojis.star + ' XP/Levels Setup',
      desc: 'Configure the XP and leveling system.',
      fields: [
        { name: 'Enabled', value: config.xp.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'XP Per Message', value: '' + config.xp.xpPerMessage, inline: true },
        { name: 'Cooldown', value: config.xp.cooldown + 's', inline: true },
        { name: 'Level Up Channel', value: config.xp.levelUpChannelId ? '<#' + config.xp.levelUpChannelId + '>' : 'Current channel', inline: true },
      ],
      toggleId: 'setup_toggle_xp',
      isOn: config.xp.enabled,
    },
    'economy': {
      title: emojis.coin + ' Economy Setup',
      desc: 'Configure the economy system.',
      fields: [
        { name: 'Enabled', value: config.economy.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'Currency', value: config.economy.currencyEmoji + ' ' + config.economy.currencyName, inline: true },
        { name: 'Daily Amount', value: '' + config.economy.dailyAmount, inline: true },
        { name: 'Starting Balance', value: '' + config.economy.startingBalance, inline: true },
        { name: 'Shop Items', value: (config.economy.shop ? config.economy.shop.length : 0) + ' item(s)', inline: true },
      ],
      toggleId: 'setup_toggle_economy',
      isOn: config.economy.enabled,
    },
    'giveaways': {
      title: emojis.giveaway + ' Giveaway Setup',
      desc: 'Configure the giveaway system.',
      fields: [
        { name: 'Enabled', value: config.giveaways.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'Channel', value: config.giveaways.channelId ? '<#' + config.giveaways.channelId + '>' : 'Not set', inline: true },
      ],
      toggleId: 'setup_toggle_giveaways',
      isOn: config.giveaways.enabled,
    },
    'notifications': {
      title: emojis.notify + ' Notifications Setup',
      desc: 'RSS feed notifications. Use slash commands to add feeds.',
      fields: [
        { name: 'YouTube', value: (config.notifications.youtube ? config.notifications.youtube.length : 0) + ' feed(s)', inline: true },
        { name: 'Twitch', value: (config.notifications.twitch ? config.notifications.twitch.length : 0) + ' feed(s)', inline: true },
        { name: 'Reddit', value: (config.notifications.reddit ? config.notifications.reddit.length : 0) + ' feed(s)', inline: true },
        { name: 'Game News', value: (config.notifications.gameNews ? config.notifications.gameNews.length : 0) + ' feed(s)', inline: true },
      ],
      toggleId: null,
      isOn: false,
    },
    'verification': {
      title: emojis.eye + ' Verification Setup',
      desc: 'Configure the verification system.',
      fields: [
        { name: 'Enabled', value: config.verification.enabled ? '🟢 ON' : '🔴 OFF', inline: true },
        { name: 'Channel', value: config.verification.channelId ? '<#' + config.verification.channelId + '>' : 'Not set', inline: true },
        { name: 'Verified Role', value: config.verification.roleId ? '<@&' + config.verification.roleId + '>' : 'Not set', inline: true },
        { name: 'Mode', value: config.verification.mode || 'button', inline: true },
      ],
      toggleId: 'setup_toggle_verification',
      isOn: config.verification.enabled,
    },
  };

  var panel = panels[feature];
  if (!panel) return null;

  var embed = new EmbedBuilder()
    .setColor(COLORS.blurple)
    .setTitle(panel.title)
    .setDescription(panel.desc)
    .addFields(panel.fields)
    .setTimestamp()
    .setFooter({ text: 'SYS-F1ex \u2022 Click toggle to enable/disable' });

  var components = [];

  if (panel.toggleId) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(panel.toggleId)
          .setLabel(panel.isOn ? 'Disable' : 'Enable')
          .setStyle(panel.isOn ? ButtonStyle.Danger : ButtonStyle.Success)
          .setEmoji(panel.isOn ? emojis.cross : emojis.check),
        new ButtonBuilder()
          .setCustomId('setup_back')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis.arrow_left)
      )
    );
  } else {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('setup_back')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis.arrow_left)
      )
    );
  }

  return { embed: embed, components: components };
}

module.exports = {
  name: 'setup',
  description: 'Interactive setup wizard for the bot',
  usage: '!setup',
  slash: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Open the setup wizard')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(message, args) {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ embeds: [errorEmbed('Access Denied', 'You need the `Manage Server` permission.')] });
    }

    var config = await getGuildConfig(message.guild.id);
    var embed = buildMainPanel(config);
    var buttons = buildMainButtons();

    var msg = await message.reply({ embeds: [embed], components: buttons });

    var collector = msg.createMessageComponentCollector({ time: 120000 });
    collector.on('collect', async function(i) {
      if (i.user.id !== message.author.id) {
        return i.reply({ content: 'This setup is not for you.', ephemeral: true });
      }

      if (i.customId === 'setup_back') {
        var cfg = await getGuildConfig(message.guild.id);
        return i.update({ embeds: [buildMainPanel(cfg)], components: buildMainButtons() });
      }

      if (i.customId.startsWith('setup_panel_')) {
        var feature = i.customId.replace('setup_panel_', '');
        var cfg = await getGuildConfig(message.guild.id);
        var panel = buildFeaturePanel(feature, cfg);
        if (!panel) return i.reply({ content: 'Unknown feature.', ephemeral: true });
        return i.update({ embeds: [panel.embed], components: panel.components });
      }

      if (i.customId.startsWith('setup_toggle_')) {
        var feature = i.customId.replace('setup_toggle_', '');
        var { updateGuildConfig } = require('../../database/utils/GuildConfig');
        var cfg = await getGuildConfig(message.guild.id);

        var toggleMap = {
          'automod': 'moderation.automod.enabled',
          'welcome': 'welcome.enabled',
          'goodbye': 'goodbye.enabled',
          'tickets': 'tickets.enabled',
          'xp': 'xp.enabled',
          'economy': 'economy.enabled',
          'giveaways': 'giveaways.enabled',
          'verification': 'verification.enabled',
        };

        var path = toggleMap[feature];
        if (!path) return i.reply({ content: 'Unknown feature.', ephemeral: true });

        var current = cfg;
        var parts = path.split('.');
        for (var idx = 0; idx < parts.length - 1; idx++) {
          current = current[parts[idx]];
        }
        var newVal = !current[parts[parts.length - 1]];

        var update = {};
        update[path] = newVal;
        await updateGuildConfig(message.guild.id, update);

        var refreshed = await getGuildConfig(message.guild.id);
        var panel = buildFeaturePanel(feature, refreshed);
        if (!panel) return i.reply({ content: 'Error.', ephemeral: true });
        return i.update({ embeds: [panel.embed], components: panel.components });
      }
    });

    collector.on('end', function() {
      try {
        msg.edit({ embeds: [errorEmbed('Timed Out', 'Setup wizard expired. Run `!setup` again.')], components: [] }).catch(function() {});
      } catch (e) {}
    });
  },

  async slashExecute(interaction, client) {
    var config = await getGuildConfig(interaction.guild.id);
    var embed = buildMainPanel(config);
    var buttons = buildMainButtons();

    await interaction.reply({ embeds: [embed], components: buttons, ephemeral: true });
    var msg = await interaction.fetchReply();

    var collector = msg.createMessageComponentCollector({ time: 120000 });
    collector.on('collect', async function(i) {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'This setup is not for you.', ephemeral: true });
      }

      if (i.customId === 'setup_back') {
        var cfg = await getGuildConfig(interaction.guild.id);
        return i.update({ embeds: [buildMainPanel(cfg)], components: buildMainButtons() });
      }

      if (i.customId.startsWith('setup_panel_')) {
        var feature = i.customId.replace('setup_panel_', '');
        var cfg = await getGuildConfig(interaction.guild.id);
        var panel = buildFeaturePanel(feature, cfg);
        if (!panel) return i.reply({ content: 'Unknown feature.', ephemeral: true });
        return i.update({ embeds: [panel.embed], components: panel.components });
      }

      if (i.customId.startsWith('setup_toggle_')) {
        var feature = i.customId.replace('setup_toggle_', '');
        var { updateGuildConfig } = require('../../database/utils/GuildConfig');
        var cfg = await getGuildConfig(interaction.guild.id);

        var toggleMap = {
          'automod': 'moderation.automod.enabled',
          'welcome': 'welcome.enabled',
          'goodbye': 'goodbye.enabled',
          'tickets': 'tickets.enabled',
          'xp': 'xp.enabled',
          'economy': 'economy.enabled',
          'giveaways': 'giveaways.enabled',
          'verification': 'verification.enabled',
        };

        var path = toggleMap[feature];
        if (!path) return i.reply({ content: 'Unknown feature.', ephemeral: true });

        var current = cfg;
        var parts = path.split('.');
        for (var idx = 0; idx < parts.length - 1; idx++) {
          current = current[parts[idx]];
        }
        var newVal = !current[parts[parts.length - 1]];

        var update = {};
        update[path] = newVal;
        await updateGuildConfig(interaction.guild.id, update);

        var refreshed = await getGuildConfig(interaction.guild.id);
        var panel = buildFeaturePanel(feature, refreshed);
        if (!panel) return i.reply({ content: 'Error.', ephemeral: true });
        return i.update({ embeds: [panel.embed], components: panel.components });
      }
    });

    collector.on('end', function() {
      try {
        msg.edit({ embeds: [errorEmbed('Timed Out', 'Setup wizard expired. Run `/setup` again.')], components: [] }).catch(function() {});
      } catch (e) {}
    });
  },
};
