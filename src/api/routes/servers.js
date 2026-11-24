const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const store = require('../data/store');
const { getGuildConfig, updateGuildConfig } = require('../../database/utils/GuildConfig');

function canManageGuild(req, guildId) {
  if (req.session.admin) return true;
  const userGuild = (req.session.guilds || []).find(guild => guild.id === guildId);
  if (!userGuild) return false;

  const permissions = BigInt(userGuild.permissions || 0);
  return (permissions & 0x20n) === 0x20n || (permissions & 0x8n) === 0x8n;
}

function isTextChannel(channel) {
  return channel && (channel.type === 0 || channel.type === 5);
}

module.exports = function (client) {
  router.get('/', authMiddleware, (req, res) => {
    if (req.session.admin) {
      const servers = client.guilds.cache.map(guild => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        owner: guild.ownerId,
        permissions: '8',
        botJoined: true,
        memberCount: guild.memberCount,
      }));
      return res.json({ servers });
    }

    const userGuilds = req.session.guilds || [];

    const botGuildIds = new Set(client.guilds.cache.map(g => g.id));

    const servers = userGuilds.map(g => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      owner: g.owner,
      permissions: g.permissions,
      botJoined: botGuildIds.has(g.id),
      memberCount: client.guilds.cache.get(g.id)?.memberCount || null,
    }));

    const manageable = servers.filter(g => {
      const permissions = BigInt(g.permissions || 0);
      return (permissions & 0x20n) === 0x20n || (permissions & 0x8n) === 0x8n;
    });

    res.json({ servers: manageable });
  });

  router.get('/:id/settings', authMiddleware, (req, res) => {
    if (!canManageGuild(req, req.params.id)) return res.status(403).json({ error: 'Manage Server permission required' });
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Bot not in this server' });

    getGuildConfig(guild.id).then(config => res.json({
      guild: {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ dynamic: true }),
        memberCount: guild.memberCount,
        owner: guild.ownerId,
        channels: guild.channels.cache.filter(isTextChannel).map(c => ({ id: c.id, name: c.name, type: c.type })),
      },
      settings: {
        welcome: config.welcome,
        automod: config.moderation.automod,
      },
    })).catch(error => {
      console.error('Dashboard settings read failed:', error);
      res.status(500).json({ error: 'Could not load server settings' });
    });
  });

  router.put('/:id/settings', authMiddleware, async (req, res) => {
    if (!canManageGuild(req, req.params.id)) return res.status(403).json({ error: 'Manage Server permission required' });
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Bot not in this server' });

    const updates = {};
    const welcome = req.body.welcome;
    const automod = req.body.automod;

    if (welcome && typeof welcome === 'object') {
      if (typeof welcome.enabled === 'boolean') updates['welcome.enabled'] = welcome.enabled;
      if (typeof welcome.message === 'string' && welcome.message.length <= 2000) updates['welcome.message'] = welcome.message;
      else if (welcome.message !== undefined) return res.status(400).json({ error: 'Welcome message must be 2000 characters or fewer' });

      if (welcome.imageUrl !== undefined) {
        const imageUrl = String(welcome.imageUrl).trim();
        if (imageUrl.length > 2048) return res.status(400).json({ error: 'Image URL is too long' });
        if (imageUrl) {
          try {
            if (new URL(imageUrl).protocol !== 'https:') throw new Error();
          } catch {
            return res.status(400).json({ error: 'Welcome image must use a valid HTTPS URL' });
          }
        }
        updates['welcome.imageUrl'] = imageUrl;
      }

      if (welcome.channelId !== undefined) {
        if (welcome.channelId && !isTextChannel(guild.channels.cache.get(welcome.channelId))) {
          return res.status(400).json({ error: 'Choose a text or announcement channel for welcome messages' });
        }
        updates['welcome.channelId'] = welcome.channelId;
      }
    }

    if (automod && typeof automod === 'object') {
      for (const key of ['enabled', 'antiSpam', 'antiLink', 'antiInvite', 'antiScam', 'antiNudity']) {
        if (typeof automod[key] === 'boolean') updates['moderation.automod.' + key] = automod[key];
      }
      if (automod.maxMentions !== undefined) {
        const maxMentions = Number(automod.maxMentions);
        if (!Number.isInteger(maxMentions) || maxMentions < 1 || maxMentions > 20) {
          return res.status(400).json({ error: 'Max mentions must be between 1 and 20' });
        }
        updates['moderation.automod.maxMentions'] = maxMentions;
      }
      if (automod.badWords !== undefined) {
        if (!Array.isArray(automod.badWords) || automod.badWords.length > 100 || automod.badWords.some(word => typeof word !== 'string' || word.length > 64)) {
          return res.status(400).json({ error: 'Blocked words must be a list of up to 100 words (64 characters each)' });
        }
        updates['moderation.automod.badWords'] = automod.badWords.map(word => word.trim().toLowerCase()).filter(Boolean);
      }
      if (automod.logChannelId !== undefined) {
        if (automod.logChannelId && !isTextChannel(guild.channels.cache.get(automod.logChannelId))) {
          return res.status(400).json({ error: 'Choose a text or announcement channel for automod logs' });
        }
        updates['moderation.automod.logChannelId'] = automod.logChannelId;
      }
    }

    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No supported settings were provided' });

    try {
      const config = await updateGuildConfig(guild.id, updates);
      store.addLog('Settings Updated', `Welcome/automod settings updated for ${guild.name}`, 'system');
      res.json({ settings: { welcome: config.welcome, automod: config.moderation.automod } });
    } catch (error) {
      console.error('Dashboard settings update failed:', error);
      res.status(500).json({ error: 'Could not save server settings' });
    }
  });

  return router;
};
