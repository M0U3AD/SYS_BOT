const { handleVoiceStateUpdate } = require('../../utils/tempVoice');

module.exports = {
  name: 'voiceStateUpdate',
  once: false,
  async execute(oldState, newState, client) {
    try {
      await handleVoiceStateUpdate(oldState, newState);
    } catch (err) {
      console.error('voiceStateUpdate error:', err);
    }
  },
};