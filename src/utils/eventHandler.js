const fs = require('fs');
const path = require('path');

function loadEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');
  if (!fs.existsSync(eventsPath)) return;

  let count = 0;

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith('.js')) {
        const event = require(fullPath);
        if (event.name) {
          if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
          } else {
            client.on(event.name, (...args) => event.execute(...args, client));
          }
          count++;
        }
      }
    }
  }

  scanDir(eventsPath);
  console.log(`Loaded ${count} events.`);
}

module.exports = { loadEvents };
