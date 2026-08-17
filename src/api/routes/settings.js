const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const store = require('../data/store');

router.get('/', authMiddleware, (req, res) => {
  res.json(store.getConfig());
});

router.put('/', authMiddleware, (req, res) => {
  const allowed = ['prefix', 'embedColor', 'modLogChannelId', 'muteRoleId', 'welcomeChannelId'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  const config = store.updateConfig(updates);
  store.addLog('Settings Updated', 'Global settings updated from dashboard', 'system');
  res.json(config);
});

module.exports = router;
