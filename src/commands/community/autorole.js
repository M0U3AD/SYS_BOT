const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'autorole',
  description: 'Manage auto-assigned roles on member join',
  usage: '!autorole add <@role> | !autorole remove <@role> | !autorole list',
  slash: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Manage auto-roles')
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add a role to auto-assign')
      .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove an auto-role')
      .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List auto-roles'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(message, args) {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Manage Server permission.')] });
    }
    const config = await getGuildConfig(message.guild.id);

    if (args[0] === 'add') {
      const role = message.mentions.roles.first();
      if (!role) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!autorole add <@role>`')] });
      const current = config.autoRoles || [];
      if (current.includes(role.id)) return message.reply({ embeds: [errorEmbed('Already Added', 'This role is already an auto-role.')] });
      current.push(role.id);
      await updateGuildConfig(message.guild.id, { autoRoles: current });
      return message.reply({ embeds: [successEmbed('Auto-Role Added', `${role} will now be assigned to new members.`)] });
    }

    if (args[0] === 'remove') {
      const role = message.mentions.roles.first();
      if (!role) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!autorole remove <@role>`')] });
      const current = (config.autoRoles || []).filter(id => id !== role.id);
      await updateGuildConfig(message.guild.id, { autoRoles: current });
      return message.reply({ embeds: [successEmbed('Auto-Role Removed', `${role} will no longer be auto-assigned.`)] });
    }

    if (args[0] === 'list') {
      const roles = (config.autoRoles || [])
        .map(id => message.guild.roles.cache.get(id))
        .filter(Boolean)
        .map(r => r.toString())
        .join(', ') || 'None';
      return message.reply({ embeds: [infoEmbed('Auto-Roles', roles)] });
    }

    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!autorole add|remove|list`')] });
  },
  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const config = await getGuildConfig(interaction.guild.id);

    if (sub === 'add') {
      const role = interaction.options.getRole('role');
      const current = config.autoRoles || [];
      if (current.includes(role.id)) return interaction.reply({ embeds: [errorEmbed('Already Added', 'This role is already an auto-role.')], ephemeral: true });
      current.push(role.id);
      await updateGuildConfig(interaction.guild.id, { autoRoles: current });
      return interaction.reply({ embeds: [successEmbed('Auto-Role Added', `${role} will now be assigned to new members.`)] });
    }

    if (sub === 'remove') {
      const role = interaction.options.getRole('role');
      const current = (config.autoRoles || []).filter(id => id !== role.id);
      await updateGuildConfig(interaction.guild.id, { autoRoles: current });
      return interaction.reply({ embeds: [successEmbed('Auto-Role Removed', `${role} will no longer be auto-assigned.`)] });
    }

    if (sub === 'list') {
      const roles = (config.autoRoles || [])
        .map(id => interaction.guild.roles.cache.get(id))
        .filter(Boolean)
        .map(r => r.toString())
        .join(', ') || 'None';
      return interaction.reply({ embeds: [infoEmbed('Auto-Roles', roles)], ephemeral: true });
    }
  },
};
