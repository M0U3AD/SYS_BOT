require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { loadCommands } = require('./src/utils/commandHandler');
const { loadEvents } = require('./src/utils/eventHandler');
const { setupCommandTracking } = require('./src/utils/botStats');
const createServer = require('./src/api/server');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel],
});

loadCommands(client);
loadEvents(client);
setupCommandTracking(client);
createServer(client);

client.login(process.env.TOKEN);
