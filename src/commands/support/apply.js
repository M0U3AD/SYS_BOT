const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');
const Application = require('../../database/models/Application');

module.exports = {
  name: 'apply',
  description: 'Staff application system',
  usage: '!apply setup | !apply',
  slash: new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Staff applications')
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Configure application form')
      .addChannelOption(opt => opt.setName('review_channel').setDescription('Channel to review applications').setRequired(true))
      .addStringOption(opt => opt.setName('questions').setDescription('Questions separated by semicolons (;)').setRequired(true)))
    .addSubcommand(sub => sub.setName('submit').setDescription('Submit an application'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(message, args) {
    if (args[0] === 'setup') {
      if (!message.member.permissions.has('ManageGuild')) {
        return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need Manage Server.')] });
      }
      const ch = message.mentions.channels.first();
      const questionsRaw = args.slice(2).join(' ');
      if (!ch || !questionsRaw) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!apply setup <#channel> <questions; separated; by; semicolons>`')] });
      const questions = questionsRaw.split(';').map(q => q.trim()).filter(Boolean);
      if (questions.length < 1) return message.reply({ embeds: [errorEmbed('Invalid', 'Provide at least one question.')] });

      await updateGuildConfig(message.guild.id, {
        'applications.enabled': true,
        'applications.questions': questions,
        'applications.reviewChannelId': ch.id,
      });
      return message.reply({ embeds: [successEmbed('Applications Configured', `**${questions.length}** questions. Review channel: ${ch}`)] });
    }

    if (!args[0] || args[0] === '') {
      const config = await getGuildConfig(message.guild.id);
      if (!config.applications.enabled) {
        return message.reply({ embeds: [errorEmbed('Not Active', 'Applications are not configured for this server.')] });
      }

      const existing = await Application.findOne({ guildId: message.guild.id, userId: message.author.id, status: 'pending' });
      if (existing) {
        return message.reply({ embeds: [errorEmbed('Pending', 'You already have a pending application.')] });
      }

      const questions = config.applications.questions;
      const answers = [];

      for (let i = 0; i < questions.length; i++) {
        const filter = m => m.author.id === message.author.id && m.channel.id === message.channel.id;
        await message.reply({ embeds: [infoEmbed(`Question ${i + 1}/${questions.length}`, questions[i])] });
        const collected = await message.channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] }).catch(() => null);
        if (!collected) return message.reply({ embeds: [errorEmbed('Timed Out', 'Application cancelled.')] });
        answers.push(collected.first().content);
        await collected.first().delete().catch(() => {});
      }

      const app = await Application.create({
        guildId: message.guild.id,
        userId: message.author.id,
        answers,
      });

      const reviewCh = message.guild.channels.cache.get(config.applications.reviewChannelId);
      if (reviewCh) {
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`Application from ${message.author.tag}`)
          .setDescription(questions.map((q, i) => `**Q:** ${q}\n**A:** ${answers[i]}`).join('\n\n'))
          .setFooter({ text: `ID: ${app._id}` })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`app_accept_${app._id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`app_deny_${app._id}`).setLabel('Deny').setStyle(ButtonStyle.Danger)
        );

        await reviewCh.send({ embeds: [embed], components: [row] });
      }

      return message.reply({ embeds: [successEmbed('Application Submitted', 'Your application has been submitted for review.')] });
    }
  },
  async slashExecute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      if (!interaction.member.permissions.has('ManageGuild')) {
        return interaction.reply({ embeds: [errorEmbed('Permission Denied', 'Need Manage Server.')], ephemeral: true });
      }
      const ch = interaction.options.getChannel('review_channel');
      const questionsRaw = interaction.options.getString('questions');
      const questions = questionsRaw.split(';').map(q => q.trim()).filter(Boolean);

      await updateGuildConfig(interaction.guild.id, {
        'applications.enabled': true,
        'applications.questions': questions,
        'applications.reviewChannelId': ch.id,
      });
      return interaction.reply({ embeds: [successEmbed('Configured', `${questions.length} questions. Review: ${ch}`)] });
    }

    if (sub === 'submit') {
      const config = await getGuildConfig(interaction.guild.id);
      if (!config.applications.enabled) {
        return interaction.reply({ embeds: [errorEmbed('Not Active', 'Applications not configured.')], ephemeral: true });
      }

      const existing = await Application.findOne({ guildId: interaction.guild.id, userId: interaction.user.id, status: 'pending' });
      if (existing) return interaction.reply({ embeds: [errorEmbed('Pending', 'You have a pending application.')], ephemeral: true });

      const answers = [];
      for (const q of config.applications.questions) {
        answers.push(`(Answer via DM or channel - question: ${q})`);
      }

      const app = await Application.create({
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        answers,
      });

      return interaction.reply({ embeds: [successEmbed('Submitted', 'Your application has been submitted.')], ephemeral: true });
    }
  },
};
