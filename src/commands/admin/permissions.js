const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'permissions',
  description: 'Manage command permissions per role',
  usage: '!permissions list | !permissions set <command> <@role> | !permissions reset <command>',
  slash: new SlashCommandBuilder()
    .setName('permissions')
    .setDescription('Manage command permissions')
    .addSubcommand(sub => sub.setName('list').setDescription('List all permission overrides'))
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Set a role requirement for a command')
      .addStringOption(opt => opt.setName('command').setDescription('Command name').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Required role').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('reset')
      .setDescription('Remove permission for a command')
      .addStringOption(opt => opt.setName('command').setDescription('Command name').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(message, args) {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'Need Manage Server.')] });
    }
    const config = await getGuildConfig(message.guild.id);
    const perms = config.permissions || {};

    if (args[0] === 'list') {
      const entries = Object.entries(perms);
      if (entries.length === 0) return message.reply({ embeds: [infoEmbed('Permissions', 'No custom permission overrides. All commands use default Discord permissions.')] });
      const list = entries.map(([cmd, roles]) => `**${cmd}** → ${roles.map(r => `<@&${r}>`).join(', ')}`).join('\n');
      return message.reply({ embeds: [infoEmbed('Command Permissions', list)] });
    }

    if (args[0] === 'set') {
      const cmd = args[1];
      const role = message.mentions.roles.first();
      if (!cmd || !role) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!permissions set <command> <@role>`')] });
      const current = perms[cmd] || [];
      if (!current.includes(role.id)) current.push(role.id);
      await updateGuildConfig(message.guild.id, { [`permissions.${cmd}`]: current });
      return message.reply({ embeds: [successEmbed('Updated', `**${cmd}** now requires ${role}.`)] });
    }

    if (args[0] === 'reset') {
      const cmd = args[1];
      if (!cmd) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!permissions reset <command>`')] });
      delete perms[cmd];
      await updateGuildConfig(message.guild.id, { permissions: perms });
      return message.reply({ embeds: [successEmbed('Reset', `**${cmd}** permissions reset to default.`)] });
    }

    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!permissions list|set|reset`')] });
  },
  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const config = await getGuildConfig(interaction.guild.id);
    const perms = config.permissions || {};

    if (sub === 'list') {
      const entries = Object.entries(perms);
      if (entries.length === 0) return interaction.reply({ embeds: [infoEmbed('Permissions', 'None set.')], ephemeral: true });
      const list = entries.map(([cmd, roles]) => `**${cmd}** → ${roles.map(r => `<@&${r}>`).join(', ')}`).join('\n');
      return interaction.reply({ embeds: [infoEmbed('Permissions', list)], ephemeral: true });
    }

    if (sub === 'set') {
      const cmd = interaction.options.getString('command');
      const role = interaction.options.getRole('role');
      const current = perms[cmd] || [];
      if (!current.includes(role.id)) current.push(role.id);
      await updateGuildConfig(interaction.guild.id, { [`permissions.${cmd}`]: current });
      return interaction.reply({ embeds: [successEmbed('Updated', `**${cmd}** → ${role}`)] });
    }

    if (sub === 'reset') {
      const cmd = interaction.options.getString('command');
      delete perms[cmd];
      await updateGuildConfig(interaction.guild.id, { permissions: perms });
      return interaction.reply({ embeds: [successEmbed('Reset', `**${cmd}** reset.`)] });
    }
  },
};
