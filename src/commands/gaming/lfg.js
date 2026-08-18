const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');

module.exports = {
  name: 'lfg',
  description: 'Looking for group — find teammates',
  usage: '!lfg <game> [description]',
  slash: new SlashCommandBuilder()
    .setName('lfg')
    .setDescription('Find teammates')
    .addStringOption(opt => opt.setName('game').setDescription('Game name').setRequired(true))
    .addStringOption(opt => opt.setName('description').setDescription('Details')),
  async execute(message, args) {
    const game = args[0];
    if (!game) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!lfg <game> [description]`')] });
    const desc = args.slice(1).join(' ') || 'No additional details.';

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(`🎮 Looking for Group — ${game}`)
      .setDescription(`**${message.author.tag}** is looking for teammates!\n\n${desc}`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'Click "Join" to join this LFG' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`lfg_join_${message.author.id}`).setLabel('Join').setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId(`lfg_leave_${message.author.id}`).setLabel('Leave').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`lfg_end_${message.author.id}`).setLabel('End').setStyle(ButtonStyle.Danger).setEmoji('🔒')
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    message.delete().catch(() => {});
  },
  async slashExecute(interaction, client) {
    const game = interaction.options.getString('game');
    const desc = interaction.options.getString('description') || 'No additional details.';

    const embed = new EmbedBuilder()
      .setColor(interaction.guild.me?.displayHexColor || '#5865F2')
      .setTitle(`🎮 Looking for Group — ${game}`)
      .setDescription(`**${interaction.user.tag}** is looking for teammates!\n\n${desc}`)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`lfg_join_${interaction.user.id}`).setLabel('Join').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`lfg_leave_${interaction.user.id}`).setLabel('Leave').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`lfg_end_${interaction.user.id}`).setLabel('End').setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({ embeds: [infoEmbed('LFG Posted', 'Your LFG message has been posted.')] });
    await interaction.channel.send({ embeds: [embed], components: [row] });
  },
};
