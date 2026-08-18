const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const Member = require('../../database/models/Member');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'shop',
  description: 'View the shop or buy items',
  usage: '!shop | !shop buy <item> | !shop add <name> <price> <desc> | !shop remove <name>',
  slash: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Server shop')
    .addSubcommand(sub => sub.setName('list').setDescription('View the shop'))
    .addSubcommand(sub => sub
      .setName('buy')
      .setDescription('Buy an item')
      .addStringOption(opt => opt.setName('item').setDescription('Item name').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add item to shop (admin)')
      .addStringOption(opt => opt.setName('name').setDescription('Name').setRequired(true))
      .addIntegerOption(opt => opt.setName('price').setDescription('Price').setRequired(true))
      .addStringOption(opt => opt.setName('description').setDescription('Description'))
      .addRoleOption(opt => opt.setName('role').setDescription('Role granted on purchase'))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove item (admin)')
      .addStringOption(opt => opt.setName('name').setDescription('Item name').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)),
  async execute(message, args) {
    const config = await getGuildConfig(message.guild.id);
    if (!config.economy.enabled) return message.reply({ embeds: [errorEmbed('Disabled', 'Economy is not enabled.')] });

    if (args[0] === 'add') {
      if (!message.member.permissions.has('ManageGuild')) return message.reply({ embeds: [errorEmbed('Permission Denied', 'Need Manage Server.')] });
      const name = args[1];
      const price = parseInt(args[2]);
      const desc = args.slice(3).join(' ') || 'No description';
      if (!name || isNaN(price)) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!shop add <name> <price> [description]`')] });
      const shop = config.economy.shop || [];
      if (shop.find(i => i.name.toLowerCase() === name.toLowerCase())) {
        return message.reply({ embeds: [errorEmbed('Duplicate', 'Item already exists.')] });
      }
      shop.push({ name, price, description: desc, role: '' });
      await updateGuildConfig(message.guild.id, { 'economy.shop': shop });
      return message.reply({ embeds: [successEmbed('Item Added', `**${name}** — ${config.economy.currencyEmoji} ${price.toLocaleString()}`)] });
    }

    if (args[0] === 'remove') {
      if (!message.member.permissions.has('ManageGuild')) return message.reply({ embeds: [errorEmbed('Permission Denied', 'Need Manage Server.')] });
      const name = args[1];
      if (!name) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!shop remove <name>`')] });
      const shop = (config.economy.shop || []).filter(i => i.name.toLowerCase() !== name.toLowerCase());
      await updateGuildConfig(message.guild.id, { 'economy.shop': shop });
      return message.reply({ embeds: [successEmbed('Removed', `**${name}** removed from shop.`)] });
    }

    if (args[0] === 'buy') {
      const name = args.slice(1).join(' ');
      if (!name) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!shop buy <item>`')] });
      const item = (config.economy.shop || []).find(i => i.name.toLowerCase() === name.toLowerCase());
      if (!item) return message.reply({ embeds: [errorEmbed('Not Found', 'Item not in shop.')] });
      const member = await Member.getMember(message.guild.id, message.author.id);
      if (member.balance < item.price) return message.reply({ embeds: [errorEmbed('Insufficient Funds', `Need ${config.economy.currencyEmoji} ${item.price.toLocaleString()}.`)] });
      member.balance -= item.price;
      await member.save();
      if (item.role) {
        const role = message.guild.roles.cache.get(item.role);
        if (role) await message.member.roles.add(role).catch(() => {});
      }
      return message.reply({ embeds: [successEmbed('Purchased', `You bought **${item.name}** for ${config.economy.currencyEmoji} ${item.price.toLocaleString()}!`)] });
    }

    const shop = config.economy.shop || [];
    if (shop.length === 0) return message.reply({ embeds: [infoEmbed('Shop', 'The shop is empty.')] });
    const list = shop.map(i => `**${i.name}** — ${config.economy.currencyEmoji} ${i.price.toLocaleString()}\n${i.description}`).join('\n\n');
    message.reply({ embeds: [infoEmbed('Server Shop', list)] });
  },
  async slashExecute(interaction, client) {
    const config = await getGuildConfig(interaction.guild.id);
    if (!config.economy.enabled) return interaction.reply({ embeds: [errorEmbed('Disabled', 'Economy not enabled.')], ephemeral: true });
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const shop = config.economy.shop || [];
      if (shop.length === 0) return interaction.reply({ embeds: [infoEmbed('Shop', 'Empty.')], ephemeral: true });
      const list = shop.map(i => `**${i.name}** — ${config.economy.currencyEmoji} ${i.price.toLocaleString()}\n${i.description}`).join('\n\n');
      return interaction.reply({ embeds: [infoEmbed('Shop', list)] });
    }

    if (sub === 'buy') {
      const name = interaction.options.getString('item');
      const item = (config.economy.shop || []).find(i => i.name.toLowerCase() === name.toLowerCase());
      if (!item) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Item not in shop.')], ephemeral: true });
      const member = await Member.getMember(interaction.guild.id, interaction.user.id);
      if (member.balance < item.price) return interaction.reply({ embeds: [errorEmbed('Insufficient Funds', `Need ${item.price.toLocaleString()}.`)], ephemeral: true });
      member.balance -= item.price;
      await member.save();
      if (item.role) {
        const role = interaction.guild.roles.cache.get(item.role);
        if (role) await interaction.member.roles.add(role).catch(() => {});
      }
      return interaction.reply({ embeds: [successEmbed('Purchased', `**${item.name}** for ${config.economy.currencyEmoji} ${item.price.toLocaleString()}!`)] });
    }

    if (sub === 'add') {
      if (!interaction.member.permissions.has('ManageGuild')) return interaction.reply({ embeds: [errorEmbed('Denied', 'Need Manage Server.')], ephemeral: true });
      const name = interaction.options.getString('name');
      const price = interaction.options.getInteger('price');
      const desc = interaction.options.getString('description') || 'No description';
      const role = interaction.options.getRole('role');
      const shop = config.economy.shop || [];
      shop.push({ name, price, description: desc, role: role?.id || '' });
      await updateGuildConfig(interaction.guild.id, { 'economy.shop': shop });
      return interaction.reply({ embeds: [successEmbed('Added', `**${name}** — ${price}`)] });
    }

    if (sub === 'remove') {
      if (!interaction.member.permissions.has('ManageGuild')) return interaction.reply({ embeds: [errorEmbed('Denied', 'Need Manage Server.')], ephemeral: true });
      const name = interaction.options.getString('name');
      const shop = (config.economy.shop || []).filter(i => i.name.toLowerCase() !== name.toLowerCase());
      await updateGuildConfig(interaction.guild.id, { 'economy.shop': shop });
      return interaction.reply({ embeds: [successEmbed('Removed', `**${name}** removed.`)] });
    }
  },
};
