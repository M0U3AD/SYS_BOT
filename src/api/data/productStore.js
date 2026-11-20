const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Product = require('../../database/models/StoreProduct');
const Redemption = require('../../database/models/StoreRedemption');

const STORE_FILE = path.join(__dirname, 'store.json');

function generateKey() {
  return 'SB-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function migrateLegacyFile() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  for (const product of data.products || []) {
    if (!product.id || !product.key || !product.name) continue;
    await Product.updateOne({ id: product.id }, {
      $setOnInsert: {
        id: product.id,
        name: product.name,
        description: product.description || '',
        details: product.details || '',
        key: product.key.toUpperCase(),
        addedBy: product.addedBy || 'Dashboard',
        createdAt: product.createdAt || Date.now(),
      },
    }, { upsert: true });
  }

  for (const redemption of data.redemptions || []) {
    if (!redemption.key || !redemption.productId) continue;
    await Redemption.updateOne({ key: redemption.key.toUpperCase() }, {
      $setOnInsert: {
        key: redemption.key.toUpperCase(),
        userId: redemption.userId || 'unknown',
        username: redemption.username || 'unknown',
        productId: redemption.productId,
        productName: redemption.productName || 'Product',
        redeemedAt: redemption.redeemedAt || Date.now(),
      },
    }, { upsert: true });
  }
}

async function addProduct({ name, description, details, addedBy }) {
  return Product.create({
    id: crypto.randomUUID(),
    name: name.trim(),
    description: description || '',
    details: details || '',
    key: generateKey(),
    addedBy: addedBy || 'Dashboard',
  });
}

async function getProduct(key) {
  return Product.findOne({ key: key.toUpperCase() }).lean();
}

async function getProductById(id) {
  return Product.findOne({ id }).lean();
}

async function getAllProducts() {
  return Product.find().sort({ createdAt: -1 }).lean();
}

async function updateProduct(id, updates) {
  const changes = {};
  if (typeof updates.name === 'string' && updates.name.trim()) changes.name = updates.name.trim();
  if (typeof updates.description === 'string') changes.description = updates.description;
  if (typeof updates.details === 'string') changes.details = updates.details;
  return Product.findOneAndUpdate({ id }, { $set: changes }, { new: true, runValidators: true }).lean();
}

async function deleteProduct(id) {
  return Product.findOneAndDelete({ id }).lean();
}

async function redeem(key, userId, username) {
  const normalizedKey = key.toUpperCase();
  const product = await Product.findOne({ key: normalizedKey }).lean();
  if (!product) return { success: false, error: 'Invalid key' };

  try {
    await Redemption.create({
      key: normalizedKey,
      userId,
      username,
      productId: product.id,
      productName: product.name,
    });
    return { success: true, product };
  } catch (error) {
    if (error.code === 11000) return { success: false, error: 'This key has already been redeemed' };
    throw error;
  }
}

async function getRedemptions(productId) {
  return Redemption.find(productId ? { productId } : {}).sort({ redeemedAt: -1 }).lean();
}

async function getRedemptionCount(productId) {
  return Redemption.countDocuments({ productId });
}

async function regenerateKey(id) {
  return Product.findOneAndUpdate({ id }, { $set: { key: generateKey() } }, { new: true }).lean();
}

module.exports = {
  migrateLegacyFile,
  addProduct,
  getProduct,
  getProductById,
  getAllProducts,
  updateProduct,
  deleteProduct,
  redeem,
  getRedemptions,
  getRedemptionCount,
  regenerateKey,
};