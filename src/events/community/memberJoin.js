const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(member, client) {
    const config = await getGuildConfig(member.guild.id);

    // Auto Roles
    if (config.autoRoles && config.autoRoles.length > 0) {
      for (const roleId of config.autoRoles) {
        const role = member.guild.roles.cache.get(roleId);
        if (role) {
          try { await member.roles.add(role); } catch {}
        }
      }
    }

    // Welcome Message
    if (config.welcome.enabled && config.welcome.channelId) {
      const ch = member.guild.channels.cache.get(config.welcome.channelId);
      if (ch) {
        const msg = config.welcome.message
          .replace(/{user}/g, `<@${member.id}>`)
          .replace(/{server}/g, member.guild.name)
          .replace(/{membercount}/g, member.guild.memberCount);

        if (config.welcome.embedColor) {
          const embed = new EmbedBuilder()
            .setColor(config.welcome.embedColor)
            .setDescription(msg)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();
          ch.send({ embeds: [embed] });
        } else {
          ch.send(msg);
        }
      }
    }

    // Welcome DM
    if (config.welcome.dmMessage) {
      try {
        const dmMsg = config.welcome.dmMessage
          .replace(/{user}/g, member.user.tag)
          .replace(/{server}/g, member.guild.name);
        await member.send(dmMsg);
      } catch {}
    }

    // Verification
    if (config.verification.enabled && config.verification.channelId && config.verification.roleId) {
      const ch = member.guild.channels.cache.get(config.verification.channelId);
      if (ch) {
        const embed = new EmbedBuilder()
          .setColor(config.embedColor)
          .setTitle('Verification Required')
          .setDescription('Click the button below to verify and gain access to the server.')
          .setTimestamp();

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`verify_${member.id}`)
            .setLabel('Verify')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
        );

        ch.send({ content: `<@${member.id}>`, embeds: [embed], components: [row] });
      }
    }
  },
};
