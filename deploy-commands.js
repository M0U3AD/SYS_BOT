require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const commandFolders = ['moderation', 'utility', 'admin', 'store', 'community', 'support', 'engagement'];

async function main() {
  if (!process.env.TOKEN || !process.env.CLIENT_ID) {
    throw new Error('Set TOKEN and CLIENT_ID in .env before deploying commands.');
  }

  const commands = [];
  for (const folder of commandFolders) {
    const folderPath = path.join(__dirname, 'src', 'commands', folder);
    if (!fs.existsSync(folderPath)) continue;
    for (const file of fs.readdirSync(folderPath).filter(name => name.endsWith('.js'))) {
      const command = require(path.join(folderPath, file));
      if (command.slash) commands.push(command.slash.toJSON());
    }
  }

  await new REST({ version: '10' }).setToken(process.env.TOKEN).put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands },
  );
  console.log('Deployed ' + commands.length + ' slash commands.');
}

main().catch(error => {
  console.error('Slash command deployment failed:', error);
  process.exitCode = 1;
});
