const fs = require('fs');
const path = require('path');

const warnings = new Map();

const WARNINGS_FILE = path.join(__dirname, '..', '..', 'warnings.json');

function loadWarnings() {
  if (fs.existsSync(WARNINGS_FILE)) {
    const data = JSON.parse(fs.readFileSync(WARNINGS_FILE, 'utf8'));
    for (const [key, value] of Object.entries(data)) {
      warnings.set(key, value);
    }
  }
}

function saveWarnings() {
  const obj = Object.fromEntries(warnings);
  fs.writeFileSync(WARNINGS_FILE, JSON.stringify(obj, null, 2));
}

function addWarning(guildId, userId, reason, moderator) {
  const key = `${guildId}-${userId}`;
  if (!warnings.has(key)) warnings.set(key, []);
  warnings.get(key).push({
    reason,
    moderator,
    date: new Date().toISOString(),
  });
  saveWarnings();
  return warnings.get(key).length;
}

function getWarnings(guildId, userId) {
  const key = `${guildId}-${userId}`;
  return warnings.get(key) || [];
}

function clearWarnings(guildId, userId) {
  const key = `${guildId}-${userId}`;
  const count = warnings.has(key) ? warnings.get(key).length : 0;
  warnings.delete(key);
  saveWarnings();
  return count;
}

loadWarnings();

module.exports = { addWarning, getWarnings, clearWarnings };
