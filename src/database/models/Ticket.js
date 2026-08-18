const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true, unique: true },
  creatorId: { type: String, required: true },
  category: { type: String, default: 'General' },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  claimedBy: { type: String, default: '' },
  transcript: { type: String, default: '' },
  closedBy: { type: String, default: '' },
  closedAt: { type: Date },
}, { timestamps: true });

ticketSchema.index({ guildId: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);
