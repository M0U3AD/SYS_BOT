const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { t, getLangName, getSupportedLanguages } = require('../../i18n');

const SUPPORTED = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh'];

module.exports = {
  name: 'language',
  description: 'Change the bot language for this server',
  usage: '!language <en|es|fr|de|pt|ja|ko|zh>',
  slash: new SlashCommandBuilder()
    .setName('language')
    .setDescription('Change bot language')
    .addStringOption(opt => opt.setName('language').setDescription('Language code').setRequired(true)
      .addChoices(
        { name: 'English', value: 'en' },
        { name: 'Spanish', value: 'es' },
        { name: 'French', value: 'fr' },
        { name: 'German', value: 'de' },
        { name: 'Portuguese', value: 'pt' },
        { name: 'Japanese', value: 'ja' },
        { name: 'Korean', value: 'ko' },
        { name: 'Chinese', value: 'zh' }
      ))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(message, args) {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'Need Manage Server.')] });
    }
    const lang = args[0];
    if (!lang || !SUPPORTED.includes(lang)) {
      return message.reply({ embeds: [errorEmbed('Invalid Language', t('en', 'LANG_SUPPORTED', SUPPORTED.join(', ')))] });
    }
    await updateGuildConfig(message.guild.id, { language: lang });
    return message.reply({ embeds: [successEmbed('Language Changed', t(lang, 'LANG_CHANGED', getLangName(lang)))] });
  },
  async slashExecute(interaction, client) {
    const lang = interaction.options.getString('language');
    if (!SUPPORTED.includes(lang)) {
      const current = (await getGuildConfig(interaction.guild.id)).language || 'en';
      return interaction.reply({ embeds: [errorEmbed('Invalid Language', t(current, 'LANG_SUPPORTED', SUPPORTED.join(', ')))], ephemeral: true });
    }
    await updateGuildConfig(interaction.guild.id, { language: lang });
    return interaction.reply({ embeds: [successEmbed('Language Changed', t(lang, 'LANG_CHANGED', getLangName(lang)))] });
  },
};
