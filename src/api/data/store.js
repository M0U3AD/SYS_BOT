const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname);

class Store {
  constructor() {
    this.stats = {
      commandsToday: 0,
      commandHistory: {},
      startTime: Date.now(),
    };
    this.logs = [];
    this.config = this._load('config.json', {
      prefix: '!',
      embedColor: '#5865F2',
      modLogChannelId: '',
      muteRoleId: '',
      welcomeChannelId: '',
    });
    this._loadStats();
    this._loadLogs();

    setInterval(() => this._saveStats(), 30000);
    setInterval(() => this._saveLogs(), 30000);
  }

  _load(file, fallback) {
    const p = path.join(DATA_DIR, file);
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      return fallback;
    }
  }

  _save(file, data) {
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
  }

  _loadStats() {
    const saved = this._load('stats.json', null);
    if (saved) {
      const today = new Date().toDateString();
      if (saved.date === today) {
        this.stats.commandsToday = saved.commandsToday || 0;
        this.stats.commandHistory = saved.commandHistory || {};
      }
    }
  }

  _saveStats() {
    this._save('stats.json', {
      date: new Date().toDateString(),
      commandsToday: this.stats.commandsToday,
      commandHistory: this.stats.commandHistory,
    });
  }

  _loadLogs() {
    this.logs = this._load('logs.json', []);
  }

  _saveLogs() {
    this._save('logs.json', this.logs.slice(-200));
  }

  trackCommand(commandName) {
    this.stats.commandsToday++;
    this.stats.commandHistory[commandName] = (this.stats.commandHistory[commandName] || 0) + 1;
  }

  addLog(event, detail, type = 'system') {
    this.logs.unshift({
      event,
      detail,
      type,
      timestamp: Date.now(),
    });
    if (this.logs.length > 200) this.logs = this.logs.slice(0, 200);
  }

  getStats(client) {
    const totalUsers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
    const uptimeMs = Date.now() - this.stats.startTime;
    const days = Math.floor(uptimeMs / 86400000);
    const hours = Math.floor((uptimeMs % 86400000) / 3600000);
    const minutes = Math.floor((uptimeMs % 3600000) / 60000);
    const uptime = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    return {
      servers: client.guilds.cache.size,
      users: totalUsers,
      commandsToday: this.stats.commandsToday,
      uptime,
      ping: client.ws.ping,
      botTag: client.user.tag,
      botId: client.user.id,
      botAvatar: client.user.displayAvatarURL({ dynamic: true }),
    };
  }

  getLogs(limit = 50) {
    return this.logs.slice(0, limit);
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(updates) {
    Object.assign(this.config, updates);
    this._save('config.json', this.config);
    return this.config;
  }

  getCommandStats() {
    return Object.entries(this.stats.commandHistory)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }
}

module.exports = new Store();
