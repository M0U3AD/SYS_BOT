const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'reactionrole',
  description: 'Create reaction role messages',
  usage: '!reactionrole create | !reactionrole delete <messageId> | !reactionrole list',
  slash: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Manage reaction roles')
    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('Create a reaction role embed (interactive)')
      .addStringOption(opt => opt.setName('title').setDescription('Embed title').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('delete')
      .setDescription('Delete a reaction role message')
      .addStringOption(opt => opt.setName('message_id').setDescription('Message ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List all reaction role messages'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(message, args) {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Manage Server permission.')] });
    }

    if (args[0] === 'list') {
      const config = await getGuildConfig(message.guild.id);
      const rrs = config.reactionRoles || [];
      if (rrs.length === 0) return message.reply({ embeds: [infoEmbed('Reaction Roles', 'None configured.')] });
      const list = rrs.map(rr => `**Message:** ${rr.messageId} — **Roles:** ${rr.roles.map(r => r.emoji).join(', ')}`).join('\n');
      return message.reply({ embeds: [infoEmbed('Reaction Roles', list)] });
    }

    if (args[0] === 'delete') {
      if (!args[1]) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!reactionrole delete <messageId>`')] });
      const config = await getGuildConfig(message.guild.id);
      const filtered = (config.reactionRoles || []).filter(rr => rr.messageId !== args[1]);
      await updateGuildConfig(message.guild.id, { reactionRoles: filtered });
      return message.reply({ embeds: [successEmbed('Deleted', 'Reaction role removed from config.')] });
    }

    if (args[0] === 'create') {
      const title = args.slice(1).join(' ') || 'Select Your Roles';
      const cfg = await getGuildConfig(message.guild.id);
      const embed = new EmbedBuilder()
        .setColor(cfg.embedColor)
        .setTitle(title)
        .setDescription('React with the corresponding emoji to get/remove a role.\n\n*Use `!reactionrole add <emoji> <@role>` to add pairs, then recreate.*')
        .setTimestamp();
      await message.channel.send({ embeds: [embed] });
      return message.reply({ embeds: [successEmbed('Created', 'Reaction role embed sent. Configure pairs with `!reactionrole add`.')] });
    }

    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!reactionrole create|delete|list`')] });
  },
  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const title = interaction.options.getString('title');
      const embed = new EmbedBuilder()
        .setColor(interaction.guild.me?.displayHexColor || '#5865F2')
        .setTitle(title)
        .setDescription('React with the corresponding emoji to get/remove a role.')
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'list') {
      const config = await getGuildConfig(interaction.guild.id);
      const rrs = config.reactionRoles || [];
      if (rrs.length === 0) return interaction.reply({ embeds: [infoEmbed('Reaction Roles', 'None configured.')], ephemeral: true });
      const list = rrs.map(rr => `**${rr.messageId}** — ${rr.roles.map(r => r.emoji).join(', ')}`).join('\n');
      return interaction.reply({ embeds: [infoEmbed('Reaction Roles', list)], ephemeral: true });
    }

    if (sub === 'delete') {
      const msgId = interaction.options.getString('message_id');
      const config = await getGuildConfig(interaction.guild.id);
      const filtered = (config.reactionRoles || []).filter(rr => rr.messageId !== msgId);
      await updateGuildConfig(interaction.guild.id, { reactionRoles: filtered });
      return interaction.reply({ embeds: [successEmbed('Deleted', 'Removed from config.')] });
    }
  },
};
