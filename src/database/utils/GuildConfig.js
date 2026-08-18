const Guild = require('../models/Guild');

const configCache = new Map();

async function getGuildConfig(guildId) {
  if (configCache.has(guildId)) {
    const cached = configCache.get(guildId);
    if (Date.now() - cached.timestamp < 60000) return cached.config;
  }
  const config = await Guild.getConfig(guildId);
  configCache.set(guildId, { config, timestamp: Date.now() });
  return config;
}

async function updateGuildConfig(guildId, update) {
  const config = await Guild.findOneAndUpdate(
    { guildId },
    { $set: update },
    { new: true, upsert: true }
  );
  configCache.set(guildId, { config, timestamp: Date.now() });
  return config;
}

async function refreshGuildConfig(guildId) {
  configCache.delete(guildId);
  return getGuildConfig(guildId);
}

function getPrefix(guildId) {
  if (configCache.has(guildId)) {
    return configCache.get(guildId).config.prefix || '!';
  }
  return '!';
}

module.exports = { getGuildConfig, updateGuildConfig, refreshGuildConfig, getPrefix };
