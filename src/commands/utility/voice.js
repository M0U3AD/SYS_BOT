const { SlashCommandBuilder } = require('discord.js');
const tempVoice = require('../../utils/tempVoiceManager');

const memberCommand = (name, description) => sub => sub
  .setName(name)
  .setDescription(description)
  .addUserOption(option => option.setName('member').setDescription('Server member').setRequired(true));

const slash = new SlashCommandBuilder()
  .setName('voice')
  .setDescription('Manage your temporary voice room')
  .addSubcommand(sub => sub.setName('rename').setDescription('Rename this room')
    .addStringOption(option => option.setName('name').setDescription('New room name').setMaxLength(100).setRequired(true)))
  .addSubcommand(sub => sub.setName('limit').setDescription('Set the room user limit (0 is unlimited)')
    .addIntegerOption(option => option.setName('value').setDescription('0-99').setMinValue(0).setMaxValue(99).setRequired(true)))
  .addSubcommand(sub => sub.setName('lock').setDescription('Prevent new members from connecting'))
  .addSubcommand(sub => sub.setName('unlock').setDescription('Allow members to connect'))
  .addSubcommand(sub => sub.setName('hide').setDescription('Hide this room from everyone else'))
  .addSubcommand(sub => sub.setName('unhide').setDescription('Show this room to everyone'))
  .addSubcommand(memberCommand('kick', 'Remove a member from this room'))
  .addSubcommand(memberCommand('ban', 'Remove and block a member from this room'))
  .addSubcommand(memberCommand('unban', 'Allow a previously blocked member'))
  .addSubcommand(memberCommand('mute', 'Server-mute a member in this room'))
  .addSubcommand(memberCommand('unmute', 'Remove a server mute in this room'))
  .addSubcommand(memberCommand('permit-user', 'Allow a member into this room'))
  .addSubcommand(sub => sub.setName('permit-role').setDescription('Allow a role into this room')
    .addRoleOption(option => option.setName('role').setDescription('Role to permit').setRequired(true)))
  .addSubcommand(memberCommand('transfer', 'Transfer room ownership'))
  .addSubcommand(sub => sub.setName('claim').setDescription('Claim an unowned room you are in'))
  .addSubcommand(sub => sub.setName('bitrate').setDescription('Set room bitrate in kbps')
    .addIntegerOption(option => option.setName('value').setDescription('8-384 kbps').setMinValue(8).setMaxValue(384).setRequired(true)))
  .addSubcommand(sub => sub.setName('region').setDescription('Set voice region, or use auto')
    .addStringOption(option => option.setName('value').setDescription('Region ID or auto').setRequired(true)))
  .addSubcommand(sub => sub.setName('save').setDescription('Save your room name, limit, and lock preference'))
  .addSubcommand(sub => sub.setName('reset').setDescription('Clear your saved room preferences'));

module.exports = {
  name: 'voice',
  description: 'Manage your temporary voice room',
  slash,
  async execute(message) {
    return message.reply('Use the `/voice` slash command from your temporary voice channel chat.');
  },
  async slashExecute(interaction) {
    return tempVoice.handleVoiceCommand(interaction);
  },
};
