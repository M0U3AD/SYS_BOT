const locales = {
  en: require('./locales/en'),
  es: require('./locales/es'),
};

const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
};

function t(lang, key, ...args) {
  const language = lang || 'en';
  const strings = locales[language] || locales.en;
  let value = strings[key];
  if (typeof value === 'function') {
    return value(...args);
  }
  if (typeof value === 'string' && args.length > 0) {
    let argIndex = 0;
    value = value.replace(/\{([^}]+)\}/g, function(match, name) {
      const arg = args[argIndex];
      argIndex++;
      if (arg === undefined) return match;
      return String(arg);
    });
  }
  return value || key;
}

async function getT(guildId) {
  const { getGuildConfig } = require('../database/utils/GuildConfig');
  const config = await getGuildConfig(guildId);
  const lang = config.language || 'en';
  return (key, ...args) => t(lang, key, ...args);
}

function getLangName(code) {
  return LANGUAGE_NAMES[code] || code;
}

function getSupportedLanguages() {
  return Object.keys(locales);
}

module.exports = { t, getT, getLangName, getSupportedLanguages, locales, LANGUAGE_NAMES };
