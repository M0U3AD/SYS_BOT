const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const Giveaway = require('../../database/models/Giveaway');
const { getGuildConfig } = require('../../database/utils/GuildConfig');
const ms = require('ms');

module.exports = {
  name: 'giveaway',
  description: 'Start, end, or reroll a giveaway',
  usage: '!giveaway start <time> <prize> | !giveaway end <messageId> | !giveaway reroll <messageId>',
  slash: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .addSubcommand(sub => sub
      .setName('start')
      .setDescription('Start a giveaway')
      .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 1h, 30m, 7d)').setRequired(true))
      .addStringOption(opt => opt.setName('prize').setDescription('Prize').setRequired(true))
      .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners').setMinValue(1))
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post in')))
    .addSubcommand(sub => sub
      .setName('end')
      .setDescription('End a giveaway early')
      .addStringOption(opt => opt.setName('message_id').setDescription('Message ID').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('reroll')
      .setDescription('Reroll a giveaway')
      .addStringOption(opt => opt.setName('message_id').setDescription('Message ID').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(message, args) {
    const config = await getGuildConfig(message.guild.id);
    if (!config.giveaways.enabled) return message.reply({ embeds: [errorEmbed('Disabled', 'Giveaways are not enabled. Use `/setup` to configure.')] });

    if (args[0] === 'start') {
      const duration = ms(args[1]);
      const prize = args.slice(2).join(' ');
      if (!duration || !prize) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!giveaway start <time> <prize>`')] });

      const endsAt = new Date(Date.now() + duration);
      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle('🎉 Giveaway!')
        .setDescription(`**Prize:** ${prize}\n**Ends:** <t:${Math.floor(endsAt.getTime() / 1000)}:R>\n**Hosted by:** ${message.author}`)
        .setFooter({ text: 'Click the button to enter!' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('giveaway_temp').setLabel('Enter Giveaway').setStyle(ButtonStyle.Primary).setEmoji('🎉')
      );

      const msg = await message.channel.send({ embeds: [embed], components: [row] });
      await msg.react('🎉');

      await Giveaway.create({
        guildId: message.guild.id,
        channelId: message.channel.id,
        messageId: msg.id,
        prize,
        hostId: message.author.id,
        winnerCount: 1,
        endsAt,
      });

      return message.reply({ embeds: [successEmbed('Giveaway Started', `Ends ${endsAt.toLocaleString()}`)] });
    }

    if (args[0] === 'end') {
      if (!args[1]) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!giveaway end <messageId>`')] });
      const { endGiveaway } = require('../../utils/giveawayManager');
      const result = await endGiveaway(args[1], message.client);
      if (!result) return message.reply({ embeds: [errorEmbed('Not Found', 'Giveaway not found or already ended.')] });
      return message.reply({ embeds: [successEmbed('Giveaway Ended', result.winners.length > 0 ? `Winners: ${result.winners.map(id => `<@${id}>`).join(', ')}` : 'No winners.')] });
    }

    if (args[0] === 'reroll') {
      if (!args[1]) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!giveaway reroll <messageId>`')] });
      const giveaway = await Giveaway.findOne({ messageId: args[1], ended: true });
      if (!giveaway) return message.reply({ embeds: [errorEmbed('Not Found', 'Giveaway not found.')] });
      if (giveaway.entries.length === 0) return message.reply({ embeds: [errorEmbed('No Entries', 'No one entered.')] });
      const winner = giveaway.entries[Math.floor(Math.random() * giveaway.entries.length)];
      return message.reply({ embeds: [successEmbed('Rerolled', `New winner: <@${winner}>!`)] });
    }

    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!giveaway start|end|reroll`')] });
  },
  async slashExecute(interaction, client) {
    const config = await getGuildConfig(interaction.guild.id);
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      if (!config.giveaways.enabled) return interaction.reply({ embeds: [errorEmbed('Disabled', 'Not enabled.')], ephemeral: true });
      const duration = ms(interaction.options.getString('duration'));
      const prize = interaction.options.getString('prize');
      const winners = interaction.options.getInteger('winners') || 1;
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      if (!duration) return interaction.reply({ embeds: [errorEmbed('Invalid Duration', 'Use format like `1h`, `30m`, `7d`.')], ephemeral: true });

      const endsAt = new Date(Date.now() + duration);
      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle('🎉 Giveaway!')
        .setDescription(`**Prize:** ${prize}\n**Ends:** <t:${Math.floor(endsAt.getTime() / 1000)}:R>\n**Winners:** ${winners}\n**Hosted by:** ${interaction.user}`)
        .setFooter({ text: 'React 🎉 to enter!' })
        .setTimestamp();

      const msg = await channel.send({ embeds: [embed] });
      await msg.react('🎉');

      await Giveaway.create({
        guildId: interaction.guild.id,
        channelId: channel.id,
        messageId: msg.id,
        prize,
        hostId: interaction.user.id,
        winnerCount: winners,
        endsAt,
      });

      return interaction.reply({ embeds: [successEmbed('Giveaway Started', `Ends ${endsAt.toLocaleString()}`)] });
    }

    if (sub === 'end') {
      const { endGiveaway } = require('../../utils/giveawayManager');
      const result = await endGiveaway(interaction.options.getString('message_id'), client);
      if (!result) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Not found or ended.')], ephemeral: true });
      return interaction.reply({ embeds: [successEmbed('Ended', result.winners.length > 0 ? `${result.winners.map(id => `<@${id}>`).join(', ')}` : 'No winners.')] });
    }

    if (sub === 'reroll') {
      const giveaway = await Giveaway.findOne({ messageId: interaction.options.getString('message_id'), ended: true });
      if (!giveaway) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Not found.')], ephemeral: true });
      if (giveaway.entries.length === 0) return interaction.reply({ embeds: [errorEmbed('No Entries', 'No entries.')], ephemeral: true });
      const winner = giveaway.entries[Math.floor(Math.random() * giveaway.entries.length)];
      return interaction.reply({ embeds: [successEmbed('Rerolled', `<@${winner}>!`)] });
    }
  },
};
