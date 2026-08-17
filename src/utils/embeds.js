const { EmbedBuilder } = require('discord.js');
const config = require('../../config.json');

function successEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(config.embedColor)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function errorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor('#ED4245')
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function infoEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(config.embedColor)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

module.exports = { successEmbed, errorEmbed, infoEmbed };
