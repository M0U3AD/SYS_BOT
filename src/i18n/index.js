const locales = {
  en: require('./locales/en'),
  es: require('./locales/es'),
};

function t(guildLang, key, ...args) {
  const lang = guildLang || 'en';
  const strings = locales[lang] || locales.en;
  const value = strings[key];
  if (typeof value === 'function') {
    return value(...args);
  }
  return value || key;
}

module.exports = { t, locales };
