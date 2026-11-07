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

  router.get('/members', (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const members = [];

    for (const guild of client.guilds.cache.values()) {
      for (const member of guild.members.cache.values()) {
        members.push({
          id: `${guild.id}:${member.id}`,
          userId: member.id,
          guildId: guild.id,
          guildName: guild.name,
          name: member.user.tag,
          displayName: member.displayName,
          role: member.roles.highest?.name || 'Member',
          status: member.presence?.status || 'offline',
          joined: member.joinedAt?.toISOString() || null,
          messages: null,
          warnings: null,
        });
        if (members.length >= limit) break;
      }
      if (members.length >= limit) break;
    }

    res.json({ members, total: members.length });
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
