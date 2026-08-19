const dns = require('dns');
const mongoose = require('mongoose');

let connected = false;

function ensureUsableDns() {
  const servers = dns.getServers();
  const unusable = servers.length === 0 || servers.every((s) => s.startsWith('127.'));
  if (unusable) {
    dns.setServers(['8.8.8.8', '1.1.1.1', ...servers]);
  }
}

function printErrorChain(err) {
  let current = err;
  while (current) {
    console.error('  ->', current.message);
    current = current.cause;
  }
}

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in .env');
    process.exit(1);
  }

  try {
    ensureUsableDns();
    await mongoose.connect(uri);
    connected = true;
    console.log('Connected to MongoDB.');
  } catch (err) {
    console.error('MongoDB connection failed:');
    printErrorChain(err);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    connected = false;
    console.warn('MongoDB disconnected. Attempting reconnect...');
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err.message);
  });
}

function isConnected() {
  return connected;
}

module.exports = { connectDatabase, isConnected };
