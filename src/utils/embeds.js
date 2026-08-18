const { EmbedBuilder } = require('discord.js');
const config = require('../../config.json');
const emojis = require('./emojis');

const COLORS = {
  primary: '#5865F2',
  success: '#57F287',
  error: '#ED4245',
  warning: '#FEE75C',
  info: '#5865F2',
  dark: '#2C2F33',
  blurple: '#5865F2',
  gold: '#F1C40F',
  white: '#FFFFFF',
};

const FOOTER_TEXT = 'SYS-F1ex';
const THUMBNAIL_URL = 'https://i.imgur.com/4M34Mi2.png';

function successEmbed(title, description, opts = {}) {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(emojis.check + ' ' + title)
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: FOOTER_TEXT, iconURL: opts.footerIcon || undefined });
}

function errorEmbed(title, description, opts = {}) {
  return new EmbedBuilder()
    .setColor(COLORS.error)
    .setTitle(emojis.cross + ' ' + title)
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: FOOTER_TEXT, iconURL: opts.footerIcon || undefined });
}

function infoEmbed(title, description, opts = {}) {
  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(emojis.info + ' ' + title)
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: FOOTER_TEXT, iconURL: opts.footerIcon || undefined });
}

function warningEmbed(title, description, opts = {}) {
  return new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle(emojis.warning + ' ' + title)
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: FOOTER_TEXT, iconURL: opts.footerIcon || undefined });
}

function modEmbed(emoji, title, fields, opts = {}) {
  const embed = new EmbedBuilder()
    .setColor(opts.color || COLORS.dark)
    .setTitle(emoji + ' ' + title)
    .setTimestamp()
    .setFooter({ text: FOOTER_TEXT + ' • Moderation', iconURL: opts.footerIcon || undefined });

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  if (opts.description) embed.setDescription(opts.description);
  if (opts.thumbnail) embed.setThumbnail(opts.thumbnail);
  if (opts.image) embed.setImage(opts.image);

  return embed;
}

function confirmEmbed(emoji, title, description, opts = {}) {
  return new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle(emoji + ' ' + title)
    .setDescription(description)
    .addFields(
      { name: '\u200b', value: 'Are you sure you want to proceed?', inline: false }
    )
    .setTimestamp()
    .setFooter({ text: FOOTER_TEXT + ' • Confirmation Required', iconURL: opts.footerIcon || undefined });
}

function dashboardEmbed(title, description, fields = [], opts = {}) {
  const embed = new EmbedBuilder()
    .setColor(opts.color || COLORS.blurple)
    .setTitle(emojis.gear + ' ' + title)
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: FOOTER_TEXT + ' • Dashboard', iconURL: opts.footerIcon || undefined });

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
}

module.exports = {
  successEmbed,
  errorEmbed,
  infoEmbed,
  warningEmbed,
  modEmbed,
  confirmEmbed,
  dashboardEmbed,
  COLORS,
  FOOTER_TEXT,
  THUMBNAIL_URL,
};
