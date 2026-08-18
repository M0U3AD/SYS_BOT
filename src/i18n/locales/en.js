const en = {
  // Moderation
  MOD_BAN_TITLE: 'Member Banned',
  MOD_BAN_DESC: (user, reason) => `**${user}** has been banned.\n**Reason:** ${reason}`,
  MOD_KICK_TITLE: 'Member Kicked',
  MOD_KICK_DESC: (user, reason) => `**${user}** has been kicked.\n**Reason:** ${reason}`,
  MOD_MUTE_TITLE: 'Member Muted',
  MOD_MUTE_DESC: (user, mins, reason) => `**${user}** muted for **${mins}** min(s).\n**Reason:** ${reason}`,
  MOD_UNMUTE_TITLE: 'Member Unmuted',
  MOD_UNMUTE_DESC: (user) => `**${user}** has been unmuted.`,
  MOD_WARN_TITLE: 'Member Warned',
  MOD_WARN_DESC: (user, reason, total) => `**${user}** warned.\n**Reason:** ${reason}\n**Total:** ${total}`,
  MOD_PURGE_TITLE: 'Messages Purged',
  MOD_PURGE_DESC: (count) => `Deleted **${count}** messages.`,

  // Community
  WELCOME_TITLE: 'Welcome',
  WELCOME_DESC: (user, server, count) => `Welcome to **${server}**, ${user}! You are member #${count}.`,
  GOODBYE_TITLE: 'Goodbye',
  GOODBYE_DESC: (user, server) => `${user} has left **${server}**.`,
  VERIFY_TITLE: 'Verification Required',
  VERIFY_DESC: 'Click the button below to verify.',

  // Tickets
  TICKET_TITLE: 'Support Ticket',
  TICKET_DESC: (user) => `Welcome ${user}! Describe your issue.`,
  TICKET_CLOSED: 'Ticket closed.',

  // Engagement
  LEVELUP_TITLE: 'Level Up!',
  LEVELUP_DESC: (user, level) => `**${user}** reached **level ${level}**!`,
  DAILY_CLAIMED: (amount) => `You received **${amount}**!`,
  SHOP_EMPTY: 'The shop is empty.',
  GIVEAWAY_TITLE: '🎉 Giveaway!',
  GIVEAWAY_ENDED: '🎉 Giveaway Ended',
  POLL_TITLE: '📊 Poll',

  // Configuration
  SETUP_TITLE: 'SYS-F1ex Setup',
  CONFIG_UPDATED: 'Configuration updated.',
  LANG_CHANGED: (lang) => `Language set to **${lang}**.`,

  // Errors
  ERR_PERMISSION: 'You do not have permission to use this command.',
  ERR_DISABLED: 'This feature is not enabled.',
  ERR_NOT_FOUND: 'Not found.',
  ERR_INVALID_USAGE: 'Invalid usage.',
};

module.exports = en;
