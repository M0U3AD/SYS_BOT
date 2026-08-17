const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_FILE = path.join(__dirname, 'store.json');

class ProductStore {
  constructor() {
    this.products = [];
    this.redemptions = [];
    this._load();
  }

  _load() {
    try {
      const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      this.products = data.products || [];
      this.redemptions = data.redemptions || [];
    } catch {
      this.products = [];
      this.redemptions = [];
    }
  }

  _save() {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ products: this.products, redemptions: this.redemptions }, null, 2));
  }

  _generateKey() {
    return 'SB-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  addProduct({ name, description, details, addedBy }) {
    const product = {
      id: crypto.randomUUID(),
      name,
      description: description || '',
      details: details || '',
      key: this._generateKey(),
      addedBy,
      createdAt: Date.now(),
    };
    this.products.push(product);
    this._save();
    return product;
  }

  getProduct(key) {
    return this.products.find(p => p.key.toUpperCase() === key.toUpperCase());
  }

  getProductById(id) {
    return this.products.find(p => p.id === id);
  }

  getAllProducts() {
    return [...this.products];
  }

  deleteProduct(id) {
    const idx = this.products.findIndex(p => p.id === id);
    if (idx === -1) return null;
    const [removed] = this.products.splice(idx, 1);
    this._save();
    return removed;
  }

  redeem(key, userId, username) {
    const product = this.getProduct(key);
    if (!product) return { success: false, error: 'Invalid key' };

    const alreadyRedeemed = this.redemptions.find(
      r => r.key.toUpperCase() === key.toUpperCase()
    );
    if (alreadyRedeemed) return { success: false, error: 'This key has already been redeemed' };

    this.redemptions.push({
      key: key.toUpperCase(),
      userId,
      username,
      productId: product.id,
      productName: product.name,
      redeemedAt: Date.now(),
    });
    this._save();

    return { success: true, product };
  }

  getRedemptions(productId) {
    if (productId) return this.redemptions.filter(r => r.productId === productId);
    return [...this.redemptions];
  }

  getRedemptionCount(productId) {
    return this.redemptions.filter(r => r.productId === productId).length;
  }

  regenerateKey(productId) {
    const product = this.getProductById(productId);
    if (!product) return null;
    product.key = this._generateKey();
    this._save();
    return product;
  }
}

module.exports = new ProductStore();
