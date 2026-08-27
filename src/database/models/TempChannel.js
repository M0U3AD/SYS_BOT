const mongoose = require('mongoose');

const tempChannelSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  voiceChannelId: { type: String, required: true, unique: true },
  textChannelId: { type: String, default: null },
  ownerId: { type: String, required: true },
  locked: { type: Boolean, default: false },
  panelMessageId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

tempChannelSchema.index({ guildId: 1, ownerId: 1 });

module.exports = mongoose.model('TempChannel', tempChannelSchema);