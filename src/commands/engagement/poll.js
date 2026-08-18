const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const Poll = require('../../database/models/Poll');
const config = require('../../../config.json');

module.exports = {
  name: 'poll',
  description: 'Create a poll',
  usage: '!poll <question> | <option1> | <option2> | ...',
  slash: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll')
    .addStringOption(opt => opt.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption(opt => opt.setName('options').setDescription('Options separated by semicolons (;)')
      .setRequired(true)),
  async execute(message, args) {
    const full = args.join(' ');
    const parts = full.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) {
      return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!poll <question> | <option1> | <option2> ...`')] });
    }
    const question = parts[0];
    const options = parts.slice(1);

    if (options.length > 10) {
      return message.reply({ embeds: [errorEmbed('Too Many Options', 'Maximum 10 options.')] });
    }

    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const desc = options.map((o, i) => `${numberEmojis[i]} ${o}`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(`📊 ${question}`)
      .setDescription(desc)
      .setFooter({ text: `Poll by ${message.author.tag}` })
      .setTimestamp();

    const msg = await message.channel.send({ embeds: [embed] });
    for (let i = 0; i < options.length; i++) {
      await msg.react(numberEmojis[i]);
    }

    await Poll.create({
      guildId: message.guild.id,
      channelId: message.channel.id,
      messageId: msg.id,
      question,
      options,
      authorId: message.author.id,
    });

    message.delete().catch(() => {});
  },
  async slashExecute(interaction, client) {
    const question = interaction.options.getString('question');
    const optionsRaw = interaction.options.getString('options');
    const options = optionsRaw.split(';').map(o => o.trim()).filter(Boolean);

    if (options.length < 2) return interaction.reply({ embeds: [errorEmbed('Invalid', 'Provide at least 2 options separated by `;`.')], ephemeral: true });
    if (options.length > 10) return interaction.reply({ embeds: [errorEmbed('Too Many', 'Max 10 options.')], ephemeral: true });

    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const desc = options.map((o, i) => `${numberEmojis[i]} ${o}`).join('\n');
    const embed = new EmbedBuilder()
      .setColor(interaction.guild.me?.displayHexColor || '#5865F2')
      .setTitle(`📊 ${question}`)
      .setDescription(desc)
      .setFooter({ text: `Poll by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [infoEmbed('Poll Created', 'Poll posted!')] });
    const msg = await interaction.channel.send({ embeds: [embed] });
    for (let i = 0; i < options.length; i++) {
      await msg.react(numberEmojis[i]);
    }

    await Poll.create({
      guildId: interaction.guild.id,
      channelId: interaction.channel.id,
      messageId: msg.id,
      question,
      options,
      authorId: interaction.user.id,
    });
  },
};
