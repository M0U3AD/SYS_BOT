const express = require('express');
const router = express.Router();
const productStore = require('../data/productStore');
const store = require('../data/store');

function storeAuth(req, res, next) {
  if (req.session && (req.session.user || req.session.adminAuth)) return next();
  return res.status(401).json({ error: 'Dashboard login required' });
}

router.get('/', storeAuth, (req, res) => {
  const products = productStore.getAllProducts().map(p => ({
    ...p,
    redemptionCount: productStore.getRedemptionCount(p.id),
  }));
  res.json({ products });
});

router.post('/', storeAuth, (req, res) => {
  const { name, description, details } = req.body;
  if (!name) return res.status(400).json({ error: 'Product name is required' });

  const product = productStore.addProduct({
    name,
    description: description || '',
    details: details || '',
    addedBy: req.session.user?.username || 'Dashboard',
  });

  store.addLog('Product Added', `Product "${product.name}" added via dashboard`, 'system');
  res.json(product);
});

router.patch('/:id', storeAuth, (req, res) => {
  const product = productStore.updateProduct(req.params.id, req.body);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  store.addLog('Product Updated', `Product "${product.name}" updated via dashboard`, 'system');
  res.json(product);
});

router.delete('/:id', storeAuth, (req, res) => {
  const removed = productStore.deleteProduct(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Product not found' });

  store.addLog('Product Deleted', `Product "${removed.name}" deleted via dashboard`, 'system');
  res.json({ ok: true, product: removed });
});

router.post('/:id/regenerate', storeAuth, (req, res) => {
  const product = productStore.regenerateKey(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  store.addLog('Key Regenerated', `Key regenerated for "${product.name}"`, 'system');
  res.json(product);
});

router.get('/:id/redemptions', storeAuth, (req, res) => {
  const redemptions = productStore.getRedemptions(req.params.id);
  res.json({ redemptions });
});

module.exports = router;
