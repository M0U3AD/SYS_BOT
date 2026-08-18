const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  type: { type: String, enum: ['youtube', 'twitch', 'reddit', 'gamenews'], required: true },
  source: { type: String, required: true },
  feedUrl: { type: String, default: '' },
  postChannelId: { type: String, required: true },
  lastChecked: { type: Date, default: Date.now },
  lastPostId: { type: String, default: '' },
}, { timestamps: true });

notificationSchema.index({ guildId: 1, type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
