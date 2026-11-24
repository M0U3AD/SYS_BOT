const { checkGiveaways } = require('../utils/giveawayManager');
const { registerSlashCommands } = require('../utils/slashCommandHandler');
const tempVoice = require('../utils/tempVoiceManager');
const voiceXp = require('../utils/voiceXp');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('!help | SYS-F1ex', { type: 3 });
    setInterval(() => checkGiveaways(client), 30000);
    voiceXp.start(client);
    try {
      await tempVoice.restoreActiveChannels(client);
    } catch (error) {
      console.error('Temporary voice recovery failed:', error);
    }
    await registerSlashCommands(client);
  },
};
