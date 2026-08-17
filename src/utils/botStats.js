const store = require('../api/data/store');

function setupCommandTracking(client) {
  client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    const config = require('../../config.json');
    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (client.commands.has(commandName)) {
      store.trackCommand(commandName);

      store.addLog(
        'Command Used',
        `!${commandName} by ${message.author.tag} in ${message.guild?.name || 'DM'}`,
        'command'
      );
    }
  });

  client.on('guildCreate', (guild) => {
    store.addLog('Joined Server', `Bot added to ${guild.name} (${guild.memberCount} members)`, 'system');
  });

  client.on('guildDelete', (guild) => {
    store.addLog('Left Server', `Bot removed from ${guild.name}`, 'system');
  });

  client.on('guildMemberAdd', (member) => {
    store.addLog('Member Joined', `${member.user.tag} joined ${member.guild.name}`, 'member');
  });

  client.on('guildMemberRemove', (member) => {
    store.addLog('Member Left', `${member.user.tag} left ${member.guild.name}`, 'member');
  });
}

module.exports = { setupCommandTracking };
