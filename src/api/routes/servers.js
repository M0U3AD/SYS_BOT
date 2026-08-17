const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const store = require('../data/store');

module.exports = function (client) {
  router.get('/', authMiddleware, (req, res) => {
    const userGuilds = req.session.guilds || [];

    const botGuildIds = new Set(client.guilds.cache.map(g => g.id));

    const servers = userGuilds.map(g => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      owner: g.owner,
      permissions: parseInt(g.permissions),
      botJoined: botGuildIds.has(g.id),
      memberCount: client.guilds.cache.get(g.id)?.memberCount || null,
    }));

    const manageable = servers.filter(g => (g.permissions & 0x20) === 0x20);

    res.json({ servers: manageable });
  });

  router.get('/:id/settings', authMiddleware, (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Bot not in this server' });

    const config = store.getConfig();
    res.json({
      guild: {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ dynamic: true }),
        memberCount: guild.memberCount,
        owner: guild.ownerId,
        channels: guild.channels.cache.map(c => ({ id: c.id, name: c.name, type: c.type })),
        roles: guild.roles.cache.map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
      },
      settings: {
        prefix: config.prefix,
        embedColor: config.embedColor,
        modLogChannelId: config.modLogChannelId,
        muteRoleId: config.muteRoleId,
        welcomeChannelId: config.welcomeChannelId,
      },
    });
  });

  router.put('/:id/settings', authMiddleware, (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Bot not in this server' });

    const allowed = ['prefix', 'embedColor', 'modLogChannelId', 'muteRoleId', 'welcomeChannelId'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const config = store.updateConfig(updates);
    store.addLog('Settings Updated', `Settings updated for ${guild.name}`, 'system');
    res.json({ settings: config });
  });

  return router;
};
