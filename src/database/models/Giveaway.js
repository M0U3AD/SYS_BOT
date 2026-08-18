const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true, unique: true },
  prize: { type: String, required: true },
  hostId: { type: String, required: true },
  winnerCount: { type: Number, default: 1 },
  entries: [{ type: String }],
  ended: { type: Boolean, default: false },
  winners: [{ type: String }],
  endsAt: { type: Date, required: true },
}, { timestamps: true });

giveawaySchema.index({ guildId: 1, ended: 1 });

module.exports = mongoose.model('Giveaway', giveawaySchema);
