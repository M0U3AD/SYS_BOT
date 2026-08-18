const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'gameroles',
  description: 'Manage game-specific roles',
  usage: '!gameroles add <game> <@role> | !gameroles remove <game> | !gameroles list',
  slash: new SlashCommandBuilder()
    .setName('gameroles')
    .setDescription('Game roles management')
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add a game role')
      .addStringOption(opt => opt.setName('game').setDescription('Game name').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove a game role')
      .addStringOption(opt => opt.setName('game').setDescription('Game name').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List game roles'))
    .addSubcommand(sub => sub
      .setName('assign')
      .setDescription('Assign yourself a game role')
      .addStringOption(opt => opt.setName('game').setDescription('Game name').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(message, args) {
    if (args[0] === 'list') {
      const config = await getGuildConfig(message.guild.id);
      const gameroles = config.economy.shop?.filter(i => i.role) || [];
      if (gameroles.length === 0) return message.reply({ embeds: [infoEmbed('Game Roles', 'None configured.')] });
      const list = gameroles.map(i => `**${i.name}** — <@&${i.role}>`).join('\n');
      return message.reply({ embeds: [infoEmbed('Game Roles', list)] });
    }

    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'Need Manage Server.')] });
    }

    if (args[0] === 'add') {
      const game = args[1];
      const role = message.mentions.roles.first();
      if (!game || !role) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!gameroles add <game> <@role>`')] });
      const config = await getGuildConfig(message.guild.id);
      const shop = config.economy.shop || [];
      if (shop.find(i => i.name.toLowerCase() === game.toLowerCase())) {
        return message.reply({ embeds: [errorEmbed('Duplicate', 'Game already exists.')] });
      }
      shop.push({ name: game, price: 0, description: `Game role for ${game}`, role: role.id });
      await updateGuildConfig(message.guild.id, { 'economy.shop': shop });
      return message.reply({ embeds: [successEmbed('Added', `${game} → ${role}`)] });
    }

    if (args[0] === 'remove') {
      const game = args[1];
      if (!game) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!gameroles remove <game>`')] });
      const config = await getGuildConfig(message.guild.id);
      const shop = (config.economy.shop || []).filter(i => i.name.toLowerCase() !== game.toLowerCase());
      await updateGuildConfig(message.guild.id, { 'economy.shop': shop });
      return message.reply({ embeds: [successEmbed('Removed', `${game} removed.`)] });
    }

    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!gameroles add|remove|list|assign`')] });
  },
  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const config = await getGuildConfig(interaction.guild.id);
      const gameroles = (config.economy.shop || []).filter(i => i.role);
      if (gameroles.length === 0) return interaction.reply({ embeds: [infoEmbed('Game Roles', 'None.')], ephemeral: true });
      const list = gameroles.map(i => `**${i.name}** — <@&${i.role}>`).join('\n');
      return interaction.reply({ embeds: [infoEmbed('Game Roles', list)] });
    }

    if (sub === 'add') {
      const game = interaction.options.getString('game');
      const role = interaction.options.getRole('role');
      const config = await getGuildConfig(interaction.guild.id);
      const shop = config.economy.shop || [];
      shop.push({ name: game, price: 0, description: `Game: ${game}`, role: role.id });
      await updateGuildConfig(interaction.guild.id, { 'economy.shop': shop });
      return interaction.reply({ embeds: [successEmbed('Added', `${game} → ${role}`)] });
    }

    if (sub === 'remove') {
      const game = interaction.options.getString('game');
      const config = await getGuildConfig(interaction.guild.id);
      const shop = (config.economy.shop || []).filter(i => i.name.toLowerCase() !== game.toLowerCase());
      await updateGuildConfig(interaction.guild.id, { 'economy.shop': shop });
      return interaction.reply({ embeds: [successEmbed('Removed', `${game}`)] });
    }

    if (sub === 'assign') {
      const game = interaction.options.getString('game');
      const config = await getGuildConfig(interaction.guild.id);
      const item = (config.economy.shop || []).find(i => i.name.toLowerCase() === game.toLowerCase() && i.role);
      if (!item) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Game role not found.')], ephemeral: true });
      const role = interaction.guild.roles.cache.get(item.role);
      if (!role) return interaction.reply({ embeds: [errorEmbed('Role Not Found', 'Role missing.')], ephemeral: true });
      await interaction.member.roles.add(role);
      return interaction.reply({ embeds: [successEmbed('Assigned', `${role} added.`)] });
    }
  },
};
