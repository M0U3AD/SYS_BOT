require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { connectDatabase } = require('./src/database/connection');
const { loadCommands } = require('./src/utils/commandHandler');
const { loadEvents } = require('./src/utils/eventHandler');
const { setupCommandTracking } = require('./src/utils/botStats');
const createServer = require('./src/api/server');

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

(async () => {
  await connectDatabase();
  loadCommands(client);
  loadEvents(client);
  setupCommandTracking(client);
  createServer(client);
  client.login(process.env.TOKEN);
})();
