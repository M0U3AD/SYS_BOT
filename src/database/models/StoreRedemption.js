const mongoose = require('mongoose');

const storeRedemptionSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  redeemedAt: { type: Number, default: Date.now },
});

module.exports = mongoose.model('StoreRedemption', storeRedemptionSchema);