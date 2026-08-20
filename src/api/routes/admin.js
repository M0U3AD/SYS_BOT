const express = require('express');
const router = express.Router();
const { adminMiddleware } = require('../middleware/adminAuth');
const store = require('../data/store');

const OWNER_IDS = require('../../../config.json').ownerIds || [];
const ADMIN_IDS = require('../../../config.json').adminIds || [];
const ALLOWED_IDS = [...new Set([...OWNER_IDS, ...ADMIN_IDS])];

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function guildSummary(guild) {
  return {
    id: guild.id,
    name: guild.name,
    icon: guild.iconURL({ size: 128 }) || null,
    ownerId: guild.ownerId,
    memberCount: guild.memberCount,
    channelCount: guild.channels.cache.size,
    roleCount: guild.roles.cache.size,
    emojiCount: guild.emojis.cache.size,
    boostLevel: guild.premiumTier,
    boosterCount: guild.premiumSubscriptionCount,
    createdAt: guild.createdTimestamp,
    ownerTag: guild.members.cache.get(guild.ownerId)?.user?.tag || null,
  };
}

module.exports = function (client) {
  router.post('/login', (req, res) => {
    const expected = process.env.ADMIN_CODE;
    if (!expected) {
      return res.status(403).json({ error: 'Admin panel is not configured (ADMIN_CODE missing)' });
    }

    const { code } = req.body || {};
    const supplied = typeof code === 'string' ? code : '';
    const match = expected.length > 0 && supplied === expected;
    if (!match) {
      return res.status(401).json({ error: 'Invalid admin code' });
    }

    if (req.session && req.session.user && (ALLOWED_IDS.length > 0) && !ALLOWED_IDS.includes(req.session.user.id)) {
      return res.status(403).json({ error: 'Your Discord account is not authorized for the admin panel' });
    }

    req.session.adminAuth = true;
    res.json({ ok: true });
  });

  router.post('/logout', (req, res) => {
    if (req.session) req.session.adminAuth = false;
    res.json({ ok: true });
  });

  router.get('/status', adminMiddleware, (req, res) => {
    res.json({
      ok: true,
      user: req.session.user ? { id: req.session.user.id, tag: req.session.user.username } : null,
      authorizedIds: ALLOWED_IDS,
    });
  });

  router.get('/info', adminMiddleware, (req, res) => {
    const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
    const totalChannels = client.guilds.cache.reduce((acc, g) => acc + g.channels.cache.size, 0);
    const totalRoles = client.guilds.cache.reduce((acc, g) => acc + g.roles.cache.size, 0);
    const guilds = client.guilds.cache.map(guildSummary);

    res.json({
      bot: {
        tag: client.user.tag,
        id: client.user.id,
        avatar: client.user.displayAvatarURL({ size: 128 }),
        ping: client.ws.ping,
        uptime: formatUptime(client.uptime || 0),
        startedAt: (client.readyAt || new Date()).toISOString(),
      },
      totals: {
        servers: client.guilds.cache.size,
        members: totalMembers,
        channels: totalChannels,
        roles: totalRoles,
        commandsLoaded: client.commands.size,
      },
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      discordJsVersion: require('discord.js/package.json').version,
      botVersion: require('../../../package.json').version,
      guilds,
      stats: store.getStats(client),
    });
  });

  router.get('/guild/:id', adminMiddleware, (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Bot is not in this server' });

    res.json({
      ...guildSummary(guild),
      ownerTag: guild.members.cache.get(guild.ownerId)?.user?.tag || null,
      channels: guild.channels.cache.map(c => ({ id: c.id, name: c.name, type: c.type })),
      roles: guild.roles.cache
        .map(r => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position, hoist: r.hoist }))
        .sort((a, b) => b.position - a.position),
      emojis: guild.emojis.cache.map(e => ({ id: e.id, name: e.name, animated: e.animated })),
      icon: guild.iconURL({ size: 256 }) || null,
    });
  });

  return router;
};