const { startFeedChecker } = require('../utils/feedChecker');
const { checkGiveaways } = require('../utils/giveawayManager');
const { registerSlashCommands } = require('../utils/slashCommandHandler');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('!help | SYS-F1ex', { type: 3 });
    startFeedChecker(client);
    setInterval(() => checkGiveaways(client), 30000);
    await registerSlashCommands(client);
  },
};
