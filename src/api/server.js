const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const botRoutes = require('./routes/bot');
const serversRoutes = require('./routes/servers');
const settingsRoutes = require('./routes/settings');
const storeRoutes = require('./routes/store');

module.exports = function createServer(client) {
  const app = express();
  const isHttps = (process.env.DASHBOARD_URL || '').startsWith('https://');

  const allowedOrigins = [process.env.DASHBOARD_URL, process.env.FRONTEND_URL].filter(Boolean);

  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }));

  app.use(express.json());

  app.use(session({
    secret: process.env.SESSION_SECRET || 'sys-bot-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: isHttps ? 'none' : 'lax',
      secure: isHttps,
    },
  }));

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes(client));
  app.use('/api/bot', botRoutes(client));
  app.use('/api/servers', serversRoutes(client));
  app.use('/api/settings', settingsRoutes);
  app.use('/api/store', storeRoutes);

  const dashboardPath = path.join(__dirname, '..', '..', 'dashboard');
  app.use(express.static(dashboardPath));

  app.get('/admin', (req, res) => {
    res.sendFile(path.join(dashboardPath, 'admin.html'));
  });

  app.use((req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(dashboardPath, 'index.html'));
    }
  });

  const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API server running on port ${PORT}`);
  });

  return app;
};
