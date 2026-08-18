const store = require('../api/data/store');
const { getGuildConfig } = require('../database/utils/GuildConfig');

function setupCommandTracking(client) {
  client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const config = require('../../config.json');
    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (client.commands.has(commandName)) {
      store.trackCommand(commandName);
      store.addLog('Command Used', `!${commandName} by ${message.author.tag} in ${message.guild?.name || 'DM'}`, 'command');
    }
  });

  client.on('guildCreate', (guild) => {
    store.addLog('Joined Server', `Bot added to ${guild.name} (${guild.memberCount} members)`, 'system');
  });

  client.on('guildDelete', (guild) => {
    store.addLog('Left Server', `Bot removed from ${guild.name}`, 'system');
  });
}

module.exports = { setupCommandTracking };
