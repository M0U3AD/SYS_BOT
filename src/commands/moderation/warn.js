const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const Warning = require('../../database/models/Warning');
const Log = require('../../database/models/Log');
const { getGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'warn',
  description: 'Warn a member, view warnings, or clear warnings',
  usage: '!warn <@user> [reason] | !warn list <@user> | !warn clear <@user>',
  slash: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Warn a member')
      .addUserOption(opt => opt.setName('user').setDescription('User to warn').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason')))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('View warnings for a user')
      .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('clear')
      .setDescription('Clear warnings for a user')
      .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(message, args) {
    if (!message.member.permissions.has('ModerateMembers')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Moderate Members permission.')] });
    }

    if (args[0] === 'list') {
      const member = message.mentions.members.first();
      if (!member) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!warn list <@user>`')] });
      const warns = await Warning.getWarnings(message.guild.id, member.id);
      if (warns.length === 0) {
        return message.reply({ embeds: [infoEmbed('Warnings', `**${member.user.tag}** has no warnings.`)] });
      }
      const list = warns.map((w, i) => `**${i + 1}.** ${w.reason} — by <@${w.moderatorId}> on ${new Date(w.date).toLocaleDateString()}`).join('\n');
      return message.reply({ embeds: [infoEmbed(`Warnings for ${member.user.tag}`, `${warns.length} warning(s)\n\n${list}`)] });
    }

    if (args[0] === 'clear') {
      const member = message.mentions.members.first();
      if (!member) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!warn clear <@user>`')] });
      const count = await Warning.clearWarnings(message.guild.id, member.id);
      return message.reply({ embeds: [successEmbed('Warnings Cleared', `Cleared **${count}** warning(s) for **${member.user.tag}**.`)] });
    }

    const member = message.mentions.members.first();
    if (!member) return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Please mention a user to warn.\n`!warn <@user> [reason]`')] });
    const reason = args.slice(1).join(' ') || 'No reason provided';
    await Warning.addWarning(message.guild.id, member.id, message.author.id, reason);
    const total = (await Warning.getWarnings(message.guild.id, member.id)).length;

    message.reply({ embeds: [successEmbed('Member Warned', `**${member.user.tag}** has been warned.\n**Reason:** ${reason}\n**Total Warnings:** ${total}`)] });
    await Log.addLog(message.guild.id, 'mod', 'warn', message.author.id, member.id, reason);

    const config = await getGuildConfig(message.guild.id);
    if (config.logging.modLogChannelId) {
      const ch = message.guild.channels.cache.get(config.logging.modLogChannelId);
      if (ch) ch.send({ embeds: [successEmbed('Member Warned', `**User:** ${member.user.tag}\n**Moderator:** ${message.author.tag}\n**Reason:** ${reason}\n**Total:** ${total}`)] });
    }

    if (config.moderation.warnAutoMute > 0 && total >= config.moderation.warnAutoMute) {
      await member.timeout(10 * 60 * 1000, 'Auto-mute: warning threshold reached');
      message.channel.send({ embeds: [infoEmbed('Auto-Mute', `**${member.user.tag}** has been auto-muted for reaching ${total} warnings.`)] });
    }
    if (config.moderation.warnAutoBan > 0 && total >= config.moderation.warnAutoBan) {
      await member.ban({ reason: 'Auto-ban: warning threshold reached' });
      message.channel.send({ embeds: [infoEmbed('Auto-Ban', `**${member.user.tag}** has been auto-banned for reaching ${total} warnings.`)] });
    }
  },
  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');

    if (sub === 'list') {
      const warns = await Warning.getWarnings(interaction.guild.id, user.id);
      if (warns.length === 0) {
        return interaction.reply({ embeds: [infoEmbed('Warnings', `**${user.tag}** has no warnings.`)], ephemeral: true });
      }
      const list = warns.map((w, i) => `**${i + 1}.** ${w.reason} — by <@${w.moderatorId}> on ${new Date(w.date).toLocaleDateString()}`).join('\n');
      return interaction.reply({ embeds: [infoEmbed(`Warnings for ${user.tag}`, `${warns.length} warning(s)\n\n${list}`)], ephemeral: true });
    }

    if (sub === 'clear') {
      const count = await Warning.clearWarnings(interaction.guild.id, user.id);
      return interaction.reply({ embeds: [successEmbed('Warnings Cleared', `Cleared **${count}** warning(s) for **${user.tag}**.")] });
    }

    const reason = interaction.options.getString('reason') || 'No reason provided';
    await Warning.addWarning(interaction.guild.id, user.id, interaction.user.id, reason);
    const total = (await Warning.getWarnings(interaction.guild.id, user.id)).length;
    interaction.reply({ embeds: [successEmbed('Member Warned', `**${user.tag}** has been warned.\n**Reason:** ${reason}\n**Total Warnings:** ${total}`)] });
    await Log.addLog(interaction.guild.id, 'mod', 'warn', interaction.user.id, user.id, reason);

    const config = await getGuildConfig(interaction.guild.id);
    if (config.logging.modLogChannelId) {
      const ch = interaction.guild.channels.cache.get(config.logging.modLogChannelId);
      if (ch) ch.send({ embeds: [successEmbed('Member Warned', `**User:** ${user.tag}\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}\n**Total:** ${total}`)] });
    }
  },
};
