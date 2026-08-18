const { startFeedChecker } = require('../utils/feedChecker');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('!help | SYS-F1ex', { type: 3 });
    startFeedChecker(client);
  },
};
