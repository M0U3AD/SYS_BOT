const crypto = require('crypto');

const SIGNING_SECRET = process.env.OAUTH_SIGNING_SECRET || process.env.DISCORD_CLIENT_SECRET || process.env.OAUTH_CLIENT_SECRET || process.env.CLIENT_SECRET || '';

function bearerSession(req) {
  const authorization = req.headers.authorization || '';
  const cookie = (req.headers.cookie || '').match(/(?:^|;\s*)sb_session=([^;]+)/)?.[1];
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : cookie;
  if (!token || !SIGNING_SECRET) return null;

  const [data, signature] = token.split('.');
  if (!data || !signature) return null;

  const expected = crypto.createHmac('sha256', SIGNING_SECRET).update(data).digest();
  const received = Buffer.from(signature, 'base64url');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!payload.user?.id || !Array.isArray(payload.guilds)) return null;
    if (payload.iat && Date.now() - payload.iat > 7 * 24 * 60 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }

  const payload = bearerSession(req);
  if (payload) {
    req.session.user = payload.user;
    req.session.guilds = payload.guilds;
    req.session.admin = payload.admin === true;
    return next();
  }

  return res.status(401).json({ error: 'Not authenticated' });
}

function ownerMiddleware(req, res, next) {
  const config = require('../../../config.json');
  if (req.session && req.session.user && config.ownerIds.includes(req.session.user.id)) {
    return next();
  }
  return res.status(403).json({ error: 'Not authorized' });
}

module.exports = { authMiddleware, ownerMiddleware };
