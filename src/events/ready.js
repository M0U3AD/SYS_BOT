const { checkGiveaways } = require('../utils/giveawayManager');
const { registerSlashCommands } = require('../utils/slashCommandHandler');
const tempVoice = require('../utils/tempVoice');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('!help | SYS-F1ex', { type: 3 });
    setInterval(() => checkGiveaways(client), 30000);
    await tempVoice.restoreActiveChannels(client);
    await registerSlashCommands(client);
  },
};
