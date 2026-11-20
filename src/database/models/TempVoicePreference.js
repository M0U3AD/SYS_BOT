const mongoose = require('mongoose');

const preferenceSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  preferredName: { type: String, default: '' },
  userLimit: { type: Number, default: null },
  locked: { type: Boolean, default: false },
}, { timestamps: true });

preferenceSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('TempVoicePreference', preferenceSchema);
