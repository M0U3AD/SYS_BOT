const mongoose = require('mongoose');

const storeProductSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  details: { type: String, default: '' },
  key: { type: String, required: true, unique: true },
  addedBy: { type: String, default: 'Dashboard' },
  createdAt: { type: Number, default: Date.now },
});

module.exports = mongoose.model('StoreProduct', storeProductSchema);