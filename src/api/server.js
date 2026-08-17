const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const botRoutes = require('./routes/bot');
const serversRoutes = require('./routes/servers');
const settingsRoutes = require('./routes/settings');
const storeRoutes = require('./routes/store');

module.exports = function createServer(client) {
  const app = express();

  app.use(cors({
    origin: process.env.DASHBOARD_URL || 'http://localhost:5173',
    credentials: true,
  }));

  app.use(express.json());

  app.use(session({
    secret: process.env.SESSION_SECRET || 'sys-bot-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  }));

  app.use('/api/auth', authRoutes);
  app.use('/api/bot', botRoutes(client));
  app.use('/api/servers', serversRoutes(client));
  app.use('/api/settings', settingsRoutes);
  app.use('/api/store', storeRoutes);

  const dashboardPath = path.join(__dirname, '..', '..', 'dashboard');
  app.use(express.static(dashboardPath));
  app.use((req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(dashboardPath, 'index.html'));
    }
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
  });

  return app;
};
