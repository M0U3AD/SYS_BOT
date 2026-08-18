const mongoose = require('mongoose');

const leaderboardSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  game: { type: String, required: true },
  score: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  stats: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

leaderboardSchema.index({ guildId: 1, game: 1, score: -1 });
leaderboardSchema.index({ guildId: 1, userId: 1, game: 1 }, { unique: true });

leaderboardSchema.statics.getLeaderboard = async function (guildId, game, limit = 10) {
  return this.find({ guildId, game }).sort({ score: -1 }).limit(limit);
};

leaderboardSchema.statics.getUserRank = async function (guildId, game, userId) {
  const user = await this.findOne({ guildId, game, userId });
  if (!user) return null;
  const rank = await this.countDocuments({ guildId, game, score: { $gt: user.score } }) + 1;
  return { ...user.toObject(), rank };
};

module.exports = mongoose.model('Leaderboard', leaderboardSchema);
