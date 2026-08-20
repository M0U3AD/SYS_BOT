const { handleChannelDelete } = require('../utils/tempVoice');

module.exports = {
  name: 'channelDelete',
  once: false,
  async execute(channel, client) {
    try {
      await handleChannelDelete(channel);
    } catch (err) {
      console.error('channelDelete error:', err);
    }
  },
};