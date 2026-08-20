const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

const DASH = '─';
const MAX_NAME = 100;

function buildSeparatorName(label, isVoice) {
  const rawLabel = String(label || '').trim();
  const labelPart = isVoice ? rawLabel : rawLabel.replace(/\s+/g, '_');
  if (!labelPart) return null;

  const available = Math.max(3, Math.floor((MAX_NAME - labelPart.length - 2) / 2));
  let name = DASH.repeat(available) + ' ' + labelPart + ' ' + DASH.repeat(available);
  if (name.length > MAX_NAME) name = name.slice(0, MAX_NAME);
  return name;
}

module.exports = {
  name: 'separator',
  description: 'Create decorative separator channels to organize the sidebar',
  usage: '!separator <text|voice> <name>',
  slash: new SlashCommandBuilder()
    .setName('separator')
    .setDescription('Create decorative separator channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(sub => sub
      .setName('text')
      .setDescription('Create a text separator channel')
      .addStringOption(opt => opt.setName('name').setDescription('Section name (e.g. Text Channels)').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('voice')
      .setDescription('Create a voice separator channel (locked so nobody can join)')
      .addStringOption(opt => opt.setName('name').setDescription('Section name (e.g. Voice Channels)').setRequired(true))),

  async execute(message, args) {
    if (!message.member.permissions.has('ManageChannels')) {
      return message.reply({ embeds: [errorEmbed('Access Denied', 'You need the `Manage Channels` permission.')] });
    }

    const type = (args.shift() || '').toLowerCase();
    const label = args.join(' ');

    if (type !== 'text' && type !== 'voice') {
      return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!separator <text|voice> <name>`')] });
    }
    if (!label) {
      return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Provide a name: `!separator <text|voice> <name>`')] });
    }

    const name = buildSeparatorName(label, type === 'voice');
    if (!name) {
      return message.reply({ embeds: [errorEmbed('Invalid Name', 'The separator name could not be generated.')] });
    }

    try {
      const channel = await message.guild.channels.create({
        name,
        type: type === 'voice' ? 2 : 0,
        permissionOverwrites: type === 'voice'
          ? [{ id: message.guild.id, deny: ['Connect'] }]
          : [],
      });
      return message.reply({ embeds: [successEmbed('Separator Created', 'Created `' + type + '` separator: <#' + channel.id + '>')] });
    } catch (err) {
      return message.reply({ embeds: [errorEmbed('Failed', 'Could not create the separator channel: `' + err.message + '`')] });
    }
  },

  async slashExecute(interaction) {
    const sub = interaction.options.getSubcommand();
    const label = interaction.options.getString('name');
    const type = sub;

    const name = buildSeparatorName(label, type === 'voice');
    if (!name) {
      return interaction.reply({ embeds: [errorEmbed('Invalid Name', 'The separator name could not be generated.')], ephemeral: true });
    }

    try {
      const channel = await interaction.guild.channels.create({
        name,
        type: type === 'voice' ? 2 : 0,
        permissionOverwrites: type === 'voice'
          ? [{ id: interaction.guild.id, deny: ['Connect'] }]
          : [],
      });
      return interaction.reply({ embeds: [successEmbed('Separator Created', 'Created `' + type + '` separator: <#' + channel.id + '>')] });
    } catch (err) {
      return interaction.reply({ embeds: [errorEmbed('Failed', 'Could not create the separator channel: `' + err.message + '`')], ephemeral: true });
    }
  },
};