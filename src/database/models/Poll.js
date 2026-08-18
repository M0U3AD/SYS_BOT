const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true, unique: true },
  question: { type: String, required: true },
  options: [{ type: String }],
  votes: {
    type: Map,
    of: String,
    default: {},
  },
  authorId: { type: String, required: true },
  ended: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Poll', pollSchema);
