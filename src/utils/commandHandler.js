const { Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

function loadCommands(client) {
  client.commands = new Collection();

  const folders = [
    path.join(__dirname, '..', 'commands', 'moderation'),
    path.join(__dirname, '..', 'commands', 'utility'),
  ];

  for (const folder of folders) {
    if (!fs.existsSync(folder)) continue;
    const files = fs.readdirSync(folder).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const command = require(path.join(folder, file));
      if (command.name) {
        client.commands.set(command.name, command);
      }
    }
  }

  console.log(`Loaded ${client.commands.size} commands.`);
}

module.exports = { loadCommands };
