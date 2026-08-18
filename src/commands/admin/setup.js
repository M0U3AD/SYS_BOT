const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');

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
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Manage Server permission.')] });
    }

    const config = await getGuildConfig(message.guild.id);

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('SYS-F1ex Setup Wizard')
      .setDescription('Select a category below to configure:')
      .addFields(
        { name: '🛡️ Moderation', value: `AutoMod: ${config.moderation.automod.enabled ? '✅' : '❌'}`, inline: true },
        { name: '📋 Logging', value: `Mod: ${config.logging.modLogChannelId ? '✅' : '❌'} | Member: ${config.logging.memberLogChannelId ? '✅' : '❌'}\nMessage: ${config.logging.messageLogChannelId ? '✅' : '❌'} | Server: ${config.logging.serverLogChannelId ? '✅' : '❌'}`, inline: true },
        { name: '👋 Welcome', value: `Welcome: ${config.welcome.enabled ? '✅' : '❌'} | Goodbye: ${config.goodbye.enabled ? '✅' : '❌'}`, inline: true },
        { name: '🎫 Tickets', value: `Enabled: ${config.tickets.enabled ? '✅' : '❌'}`, inline: true },
        { name: '⭐ XP/Levels', value: `Enabled: ${config.xp.enabled ? '✅' : '❌'}`, inline: true },
        { name: '💰 Economy', value: `Enabled: ${config.economy.enabled ? '✅' : '❌'} | Currency: ${config.economy.currencyName}`, inline: true },
        { name: '🎉 Giveaways', value: `Enabled: ${config.giveaways.enabled ? '✅' : '❌'}`, inline: true },
        { name: '🔔 Notifications', value: `YT: ${config.notifications.youtube?.length || 0} | TW: ${config.notifications.twitch?.length || 0} | Reddit: ${config.notifications.reddit?.length || 0}`, inline: true },
        { name: '🌐 Language', value: config.language || 'en', inline: true }
      )
      .setFooter({ text: 'Use !setup <category> to configure each section' })
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },
  async slashExecute(interaction, client) {
    const config = await getGuildConfig(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('SYS-F1ex Setup')
      .setDescription('Select a feature to configure:')
      .addFields(
        { name: '🛡️ Moderation', value: `AutoMod: ${config.moderation.automod.enabled ? 'On' : 'Off'}`, inline: true },
        { name: '📋 Logging', value: `${[config.logging.modLogChannelId, config.logging.memberLogChannelId, config.logging.messageLogChannelId, config.logging.serverLogChannelId].filter(Boolean).length}/4 channels set`, inline: true },
        { name: '👋 Welcome', value: `Welcome: ${config.welcome.enabled ? 'On' : 'Off'}`, inline: true },
        { name: '🎫 Tickets', value: config.tickets.enabled ? 'On' : 'Off', inline: true },
        { name: '⭐ XP/Levels', value: config.xp.enabled ? 'On' : 'Off', inline: true },
        { name: '💰 Economy', value: `${config.economy.enabled ? 'On' : 'Off'} (${config.economy.currencyName})`, inline: true },
        { name: '🎉 Giveaways', value: config.giveaways.enabled ? 'On' : 'Off', inline: true },
        { name: '🌐 Language', value: config.language || 'en', inline: true }
      )
      .setFooter({ text: 'Use slash commands to configure each feature' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
