const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  moderatorId: { type: String, required: true },
  reason: { type: String, default: 'No reason provided' },
  date: { type: Date, default: Date.now },
});

warningSchema.index({ guildId: 1, userId: 1 });

warningSchema.statics.addWarning = async function (guildId, userId, moderatorId, reason) {
  return this.create({ guildId, userId, moderatorId, reason });
};

warningSchema.statics.getWarnings = async function (guildId, userId) {
  return this.find({ guildId, userId }).sort({ date: -1 });
};

warningSchema.statics.clearWarnings = async function (guildId, userId) {
  const result = await this.deleteMany({ guildId, userId });
  return result.deletedCount;
};

module.exports = mongoose.model('Warning', warningSchema);
