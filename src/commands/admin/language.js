const t = require('../i18n');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

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
    const supported = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh'];
    if (!lang || !supported.includes(lang)) {
      return message.reply({ embeds: [errorEmbed('Invalid Language', `Supported: ${supported.join(', ')}`)] });
    }
    await updateGuildConfig(message.guild.id, { language: lang });
    const name = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', ja: 'Japanese', ko: 'Korean', zh: 'Chinese' };
    return message.reply({ embeds: [successEmbed('Language Changed', `Bot language set to **${name[lang]}**.`)] });
  },
  async slashExecute(interaction, client) {
    const lang = interaction.options.getString('language');
    await updateGuildConfig(interaction.guild.id, { language: lang });
    const name = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', ja: 'Japanese', ko: 'Korean', zh: 'Chinese' };
    return interaction.reply({ embeds: [successEmbed('Language Changed', `Set to **${name[lang]}**.`)] });
  },
};
