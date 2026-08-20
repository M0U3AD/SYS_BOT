const express = require('express');
const router = express.Router();
const store = require('../data/store');

module.exports = function (client) {
  router.get('/stats', (req, res) => {
    res.json(store.getStats(client));
  });

  router.get('/logs', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json(store.getLogs(limit));
  });

  router.get('/commands', (req, res) => {
    const commands = client.commands.map(cmd => ({
      name: cmd.name,
      description: cmd.description || '',
      usage: cmd.usage || cmd.name,
      category: cmd.category || getCommandCategory(cmd.name),
      permissions: cmd.permissions || [],
    }));
    res.json({
      prefix: store.getConfig().prefix,
      commands,
      stats: store.getCommandStats(),
    });
  });

  router.get('/command-stats', (req, res) => {
    res.json(store.getCommandStats());
  });

  return router;
};

function getCommandCategory(name) {
  const moderation = ['kick', 'ban', 'mute', 'unmute', 'warn', 'purge'];
  const storeCmds = ['addproduct', 'products', 'deleteproduct', 'redeem', 'regenerate'];
  const admin = ['say', 'announce', 'dm', 'tempvoice', 'separator', 'roles'];
  if (moderation.includes(name)) return 'Moderation';
  if (storeCmds.includes(name)) return 'Store';
  if (admin.includes(name)) return 'Admin';
  return 'Utility';
}
