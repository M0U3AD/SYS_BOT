const { REST, Routes, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const folders = [
  'moderation',
  'utility',
  'admin',
  'store',
  'community',
  'support',
  'engagement',
  'notifications',
];

async function registerSlashCommands(client) {
  client.slashCommands = new Collection();
  const commands = [];

  for (const folder of folders) {
    const folderPath = path.join(__dirname, '..', 'commands', folder);
    if (!fs.existsSync(folderPath)) continue;

    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const command = require(path.join(folderPath, file));
      if (command.slash) {
        client.slashCommands.set(command.name, command);
        commands.push(command.slash.toJSON());
      }
    }
  }

  if (commands.length === 0) {
    console.log('No slash commands to register.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    console.log(`Registering ${commands.length} slash commands...`);
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log(`Successfully registered ${commands.length} slash commands.`);
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
}

module.exports = { registerSlashCommands };
