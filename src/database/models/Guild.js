const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  prefix: { type: String, default: '!' },
  language: { type: String, default: 'en' },
  embedColor: { type: String, default: '#5865F2' },

  // Logging
  logging: {
    modLogChannelId: { type: String, default: '' },
    memberLogChannelId: { type: String, default: '' },
    messageLogChannelId: { type: String, default: '' },
    serverLogChannelId: { type: String, default: '' },
  },

  // Welcome / Goodbye
  welcome: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: '' },
    message: { type: String, default: 'Welcome to **{server}**, {user}! You are member #{membercount}.' },
    embedColor: { type: String, default: '' },
    dmMessage: { type: String, default: '' },
  },
  goodbye: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: '' },
    message: { type: String, default: '**{user}** has left **{server}**.' },
  },

  // Auto Roles
  autoRoles: { type: [String], default: [] },

  // Reaction Roles
  reactionRoles: [{
    messageId: String,
    channelId: String,
    title: String,
    message: String,
    image: String,
    roles: [{
      emoji: String,
      roleId: String,
      roleName: String,
      label: String,
    }],
  }],

  // Verification
  verification: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: '' },
    roleId: { type: String, default: '' },
    mode: { type: String, enum: ['button', 'captcha'], default: 'button' },
  },

  // Temporary Voice Channels
  tempVoice: {
    enabled: { type: Boolean, default: false },
    triggerChannelId: { type: String, default: '' },
    categoryId: { type: String, default: '' },
    modRoleIds: { type: [String], default: [] },
    createModChannel: { type: Boolean, default: true },
    channelNameTemplate: { type: String, default: '{user}\'s Channel' },
    modChannelName: { type: String, default: 'mod-{user}' },
  },

  // Moderation
  moderation: {
    automod: {
      enabled: { type: Boolean, default: false },
      antiSpam: { type: Boolean, default: false },
      antiLink: { type: Boolean, default: false },
      antiInvite: { type: Boolean, default: false },
      badWords: { type: [String], default: [] },
      maxMentions: { type: Number, default: 5 },
      muteRoleId: { type: String, default: '' },
      logChannelId: { type: String, default: '' },
    },
    warnAutoMute: { type: Number, default: 0 },
    warnAutoBan: { type: Number, default: 0 },
  },

  // Tickets
  tickets: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: '' },
    supportRoleId: { type: String, default: '' },
    transcriptChannelId: { type: String, default: '' },
    categories: [{
      name: String,
      emoji: String,
    }],
  },

  // XP / Levels
  xp: {
    enabled: { type: Boolean, default: false },
    levelUpChannelId: { type: String, default: '' },
    xpPerMessage: { type: Number, default: 15 },
    xpVariance: { type: Number, default: 10 },
    cooldown: { type: Number, default: 60 },
    ignoredChannels: { type: [String], default: [] },
  },

  // Economy
  economy: {
    enabled: { type: Boolean, default: false },
    currencyName: { type: String, default: 'coins' },
    currencyEmoji: { type: String, default: '🪙' },
    dailyAmount: { type: Number, default: 100 },
    startingBalance: { type: Number, default: 0 },
    shop: [{
      name: String,
      price: Number,
      description: String,
      role: String,
    }],
  },

  // Giveaways
  giveaways: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: '' },
    role: { type: String, default: '' },
  },

  // Notifications
  notifications: {
    youtube: [{
      channelUrl: String,
      channelId: String,
      postChannelId: String,
      lastChecked: Date,
    }],
    twitch: [{
      username: String,
      postChannelId: String,
      lastChecked: Date,
    }],
    reddit: [{
      subreddit: String,
      postChannelId: String,
      lastChecked: Date,
    }],
    gameNews: [{
      game: String,
      feedUrl: String,
      postChannelId: String,
      lastChecked: Date,
    }],
  },

  // Permissions
  permissions: {
    type: Map,
    of: [String],
    default: {},
  },

  // Message Separators (media divider posted after each message)
  separators: [{
    channelId: { type: String },
    mediaUrl: { type: String },
  }],

  // Applications
  applications: {
    enabled: { type: Boolean, default: false },
    questions: [String],
    reviewChannelId: { type: String, default: '' },
  },
}, { timestamps: true });

guildSchema.statics.getConfig = async function (guildId) {
  let guild = await this.findOne({ guildId });
  if (!guild) {
    guild = await this.create({ guildId });
  }
  return guild;
};

module.exports = mongoose.model('Guild', guildSchema);
