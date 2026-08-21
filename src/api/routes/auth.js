const express = require('express');
const router = express.Router();

const DISCORD_API = 'https://discord.com/api';
const SCOPES = 'identify guilds';

// Public URL of the dashboard frontend (must match the OAuth redirect
// registered in the Discord Developer Portal, without a trailing slash).
const PUBLIC_URL = (process.env.FRONTEND_URL || process.env.DASHBOARD_URL || '').replace(/\/+$/, '');

// The dashboard uses its own Discord application (separate from the bot).
// OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET fall back to CLIENT_ID / CLIENT_SECRET.
const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID || process.env.CLIENT_ID;
const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || process.env.CLIENT_SECRET;

function callbackUrl() {
  return `${PUBLIC_URL}/api/auth/callback`;
}

router.get('/login', (req, res) => {
  if (!PUBLIC_URL) {
    return res.status(500).json({ error: 'FRONTEND_URL is not configured on the server' });
  }
  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: callbackUrl(),
    response_type: 'code',
    scope: SCOPES,
    integration_type: '0',
  });
  res.json({ url: `https://discord.com/oauth2/authorize?${params}` });
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  if (!PUBLIC_URL) {
    return res.status(500).json({ error: 'FRONTEND_URL is not configured on the server' });
  }

  try {
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl(),
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error('Discord token exchange failed:', tokenData.error);
      return res.status(400).json({ error: tokenData.error });
    }

    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();

    const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const guilds = await guildsRes.json();

    req.session.user = user;
    req.session.guilds = guilds;
    req.session.accessToken = tokenData.access_token;

    res.redirect(PUBLIC_URL || '/');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.json({ user: null, guilds: null });
  res.json({ user: req.session.user, guilds: req.session.guilds });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

module.exports = router;
