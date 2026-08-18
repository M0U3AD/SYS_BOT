const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  type: { type: String, enum: ['mod', 'member', 'message', 'server', 'system'], required: true },
  action: { type: String, required: true },
  actorId: { type: String, default: '' },
  targetId: { type: String, default: '' },
  details: { type: String, default: '' },
  channelId: { type: String, default: '' },
  messageId: { type: String, default: '' },
}, { timestamps: true });

logSchema.index({ guildId: 1, type: 1, createdAt: -1 });

logSchema.statics.addLog = async function (guildId, type, action, actorId, targetId, details, channelId, messageId) {
  return this.create({ guildId, type, action, actorId, targetId, details, channelId, messageId });
};

logSchema.statics.getLogs = async function (guildId, type, limit = 50) {
  const query = { guildId };
  if (type) query.type = type;
  return this.find(query).sort({ createdAt: -1 }).limit(limit);
};

module.exports = mongoose.model('Log', logSchema);
