const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  lastXpMessage: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  bank: { type: Number, default: 0 },
  lastDaily: { type: Number, default: 0 },
  totalMessages: { type: Number, default: 0 },
}, { timestamps: true });

memberSchema.index({ guildId: 1, userId: 1 }, { unique: true });

memberSchema.statics.getMember = async function (guildId, userId) {
  let member = await this.findOne({ guildId, userId });
  if (!member) {
    member = await this.create({ guildId, userId });
  }
  return member;
};

module.exports = mongoose.model('Member', memberSchema);
