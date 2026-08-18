const { checkGiveaways } = require('../../utils/giveawayManager');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    setInterval(() => checkGiveaways(client), 30000);
  },
};
