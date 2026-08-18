const mongoose = require('mongoose');

let connected = false;

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    connected = true;
    console.log('Connected to MongoDB.');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
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
