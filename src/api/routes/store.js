const express = require('express');
const router = express.Router();
const productStore = require('../data/productStore');
const store = require('../data/store');

async function getBearerUser(req) {
  const authorization = req.headers.authorization || '';
  const cookie = req.headers.cookie || '';
  const dashboardUrl = (process.env.FRONTEND_URL || process.env.DASHBOARD_URL || '').replace(/\/+$/, '');
  if ((!authorization.startsWith('Bearer ') && !cookie) || !dashboardUrl) return null;

  const authHeaders = authorization.startsWith('Bearer ')
    ? { Authorization: authorization }
    : { Cookie: cookie };
  const response = await fetch(`${dashboardUrl}/api/auth/me`, {
    headers: authHeaders,
    cache: 'no-store',
  });
  if (!response.ok) return null;

  const payload = await response.json();
  return payload?.user?.id ? payload.user : null;
}

async function storeAuth(req, res, next) {
  if (req.session?.user) {
    req.dashboardUser = req.session.user;
    return next();
  }
  if (req.session?.adminAuth) return next();

  try {
    const user = await getBearerUser(req);
    if (user) {
      req.dashboardUser = user;
      return next();
    }
  } catch {
    return res.status(503).json({ error: 'Unable to validate dashboard login' });
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