const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const productStore = require('../data/productStore');
const store = require('../data/store');

function getBearerUser(req) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) return null;

  const [payload, signature, extra] = authorization.slice(7).split('.');
  if (!payload || !signature || extra !== undefined) return null;

  const secret = process.env.OAUTH_SIGNING_SECRET ||
    process.env.DISCORD_CLIENT_SECRET ||
    process.env.OAUTH_CLIENT_SECRET ||
    'fallback-dev-secret';
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).user || null;
  } catch {
    return null;
  }
}

function storeAuth(req, res, next) {
  if (req.session?.user) {
    req.dashboardUser = req.session.user;
    return next();
  }
  if (req.session?.adminAuth) return next();

  const user = getBearerUser(req);
  if (user) {
    req.dashboardUser = user;
    return next();
  }
  return res.status(401).json({ error: 'Dashboard login required' });
}

router.get('/', storeAuth, async (req, res) => {
  const records = await productStore.getAllProducts();
  const products = await Promise.all(records.map(async (product) => ({
    ...product,
    redemptionCount: await productStore.getRedemptionCount(product.id),
  })));
  res.json({ products });
});

router.post('/', storeAuth, async (req, res) => {
  const { name, description, details } = req.body;
  if (!name) return res.status(400).json({ error: 'Product name is required' });

  const product = await productStore.addProduct({
    name,
    description: description || '',
    details: details || '',
    addedBy: req.dashboardUser?.username || 'Dashboard',
  });

  store.addLog('Product Added', `Product "${product.name}" added via dashboard`, 'system');
  res.json(product);
});

router.patch('/:id', storeAuth, async (req, res) => {
  const product = await productStore.updateProduct(req.params.id, req.body);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  store.addLog('Product Updated', `Product "${product.name}" updated via dashboard`, 'system');
  res.json(product);
});

router.delete('/:id', storeAuth, async (req, res) => {
  const removed = await productStore.deleteProduct(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Product not found' });

  store.addLog('Product Deleted', `Product "${removed.name}" deleted via dashboard`, 'system');
  res.json({ ok: true, product: removed });
});

router.post('/:id/regenerate', storeAuth, async (req, res) => {
  const product = await productStore.regenerateKey(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  store.addLog('Key Regenerated', `Key regenerated for "${product.name}"`, 'system');
  res.json(product);
});

router.get('/:id/redemptions', storeAuth, async (req, res) => {
  const redemptions = await productStore.getRedemptions(req.params.id);
  res.json({ redemptions });
});

module.exports = router;