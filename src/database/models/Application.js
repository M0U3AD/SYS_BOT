const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'denied'], default: 'pending' },
  answers: [{ type: String }],
  reviewMessageId: { type: String, default: '' },
}, { timestamps: true });

applicationSchema.index({ guildId: 1, userId: 1, status: 1 });

module.exports = mongoose.model('Application', applicationSchema);
