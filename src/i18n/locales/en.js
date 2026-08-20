const en = {
  // Bot
  BOT_NAME: 'SYS-F1ex',
  FOOTER: 'SYS-F1ex',

  // Moderation
  MOD_ACCESS_DENIED: 'You need the `{perm}` permission.',
  MOD_SELF_ACTION: 'You cannot perform this action on yourself.',
  MOD_CONFIRM_TITLE: '{action} Confirmation',
  MOD_CONFIRM_TEXT: 'Are you sure you want to proceed?',
  MOD_CONFIRM_BTN: 'Confirm {action}',
  MOD_CANCEL_BTN: 'Cancel',
  MOD_CANCELLED: 'Action was cancelled.',
  MOD_TIMED_OUT: 'Confirmation expired. Action was not executed.',

  MOD_BAN_TITLE: 'Member Banned',
  MOD_BAN_CONFIRM: (user, reason, mod) =>
    '**Target:** ' + user + '\n**Reason:** ' + reason + '\n**Moderator:** ' + mod,
  MOD_BAN_SUCCESS: (user, reason) =>
    '**' + user + '** has been banned.\n**Reason:** ' + reason,
  MOD_BAN_LOG: (user, mod, reason) =>
    '**Target:** ' + user + '\n**Moderator:** ' + mod + '\n**Reason:** ' + reason,
  MOD_BAN_CANNOT: 'I cannot ban this user. Their role may be higher than mine.',
  MOD_BAN_NOT_FOUND: 'User is not in this server.',

  MOD_KICK_TITLE: 'Member Kicked',
  MOD_KICK_CONFIRM: (user, reason, mod) =>
    '**Target:** ' + user + '\n**Reason:** ' + reason + '\n**Moderator:** ' + mod,
  MOD_KICK_SUCCESS: (user, reason) =>
    '**' + user + '** has been kicked.\n**Reason:** ' + reason,
  MOD_KICK_LOG: (user, mod, reason) =>
    '**Target:** ' + user + '\n**Moderator:** ' + mod + '\n**Reason:** ' + reason,
  MOD_KICK_CANNOT: 'I cannot kick this user.',
  MOD_KICK_NOT_FOUND: 'User is not in this server.',

  MOD_MUTE_TITLE: 'Member Muted',
  MOD_MUTE_CONFIRM: (user, duration, reason, mod) =>
    '**Target:** ' + user + '\n**Duration:** ' + duration + '\n**Reason:** ' + reason + '\n**Moderator:** ' + mod,
  MOD_MUTE_SUCCESS: (user, duration, reason) =>
    '**' + user + '** muted for **' + duration + '**.\n**Reason:** ' + reason,
  MOD_MUTE_LOG: (user, mod, duration, reason) =>
    '**Target:** ' + user + '\n**Moderator:** ' + mod + '\n**Duration:** ' + duration + '\n**Reason:** ' + reason,
  MOD_MUTE_CANNOT: 'I cannot mute this user.',
  MOD_MUTE_NOT_FOUND: 'User is not in this server.',
  MOD_MUTE_INVALID_DURATION: 'Duration must be between **1** and **40320** minutes (28 days).',

  MOD_UNMUTE_TITLE: 'Member Unmuted',
  MOD_UNMUTE_CONFIRM: (user, mod) =>
    '**Target:** ' + user + '\n**Moderator:** ' + mod,
  MOD_UNMUTE_SUCCESS: (user) => '**' + user + '** has been unmuted.',
  MOD_UNMUTE_LOG: (user, mod) =>
    '**Target:** ' + user + '\n**Moderator:** ' + mod,
  MOD_UNMUTE_NOT_MUTED: 'This user is not currently muted.',
  MOD_UNMUTE_NOT_FOUND: 'User is not in this server.',

  MOD_WARN_TITLE: 'Member Warned',
  MOD_WARN_CONFIRM: (user, reason, mod) =>
    '**Target:** ' + user + '\n**Reason:** ' + reason + '\n**Moderator:** ' + mod,
  MOD_WARN_SUCCESS: (user, reason, total) =>
    '**' + user + '** warned.\n**Reason:** ' + reason + '\n**Total Warnings:** ' + total,
  MOD_WARN_LOG: (user, mod, reason, total) =>
    '**Target:** ' + user + '\n**Moderator:** ' + mod + '\n**Reason:** ' + reason + '\n**Total:** ' + total,
  MOD_WARN_LIST_TITLE: (user) => 'Warnings for ' + user,
  MOD_WARN_LIST_ENTRY: (i, reason, mod, date) =>
    '**' + i + '.** ' + reason + ' — <@' + mod + '> • ' + date,
  MOD_WARN_NO_WARNINGS: (user) => user + ' has a clean record.',
  MOD_WARN_CLEAR_SUCCESS: (count, user) =>
    'Cleared **' + count + '** warning(s) for **' + user + '**.',
  MOD_WARN_AUTO_MUTE: (user, total) =>
    user + ' has been auto-muted for reaching ' + total + ' warnings.',
  MOD_WARN_AUTO_BAN: (user, total) =>
    user + ' has been auto-banned for reaching ' + total + ' warnings.',

  MOD_PURGE_TITLE: 'Messages Purged',
  MOD_PURGE_CONFIRM: (channel, amount, mod) =>
    '**Channel:** ' + channel + '\n**Amount:** ' + amount + ' message(s)\n**Moderator:** ' + mod,
  MOD_PURGE_SUCCESS: (count) => 'Deleted **' + count + '** messages.',

  MOD_AUTOMOD_TITLE: 'AutoMod Configuration',
  MOD_AUTOMOD_ENABLED: 'Auto-moderation is now **active**.',
  MOD_AUTOMOD_DISABLED: 'Auto-moderation has been **disabled**.',
  MOD_AUTOMOD_UPDATED: 'Settings have been saved.',
  MOD_AUTOMOD_WORD_UPDATED: (word, action) =>
    '**' + word + '** has been ' + action + ' the blocked words list.',
  MOD_AUTOMOD_WORD_DUPLICATE: 'Word is already in the list.',
  MOD_AUTOMOD_INVALID_USAGE: '`!automod word <add|remove> <word>`',
  MOD_AUTOMOD_STATUS: (enabled) => enabled ? 'Enabled' : 'Disabled',
  MOD_AUTOMOD_ON: (val) => val ? 'On' : 'Off',

  // Setup
  SETUP_TITLE: 'SYS-F1ex Setup',
  SETUP_DESCRIPTION: 'Select a feature below to configure:',
  SETUP_MODERATION: 'Moderation',
  SETUP_LOGGING: 'Logging',
  SETUP_WELCOME: 'Welcome',
  SETUP_TICKETS: 'Tickets',
  SETUP_XP: 'XP/Levels',
  SETUP_ECONOMY: 'Economy',
  SETUP_GIVEAWAYS: 'Giveaways',
  SETUP_NOTIFICATIONS: 'Notifications',
  SETUP_LANGUAGE: 'Language',
  SETUP_REACTIONROLES: 'Reaction Roles',
  SETUP_STATUS: (feature, enabled) => feature + ': ' + (enabled ? '✅' : '❌'),

  // Setup Panels
  SETUP_MOD_TITLE: '🛡️ Moderation Setup',
  SETUP_MOD_DESC: 'Configure auto-moderation and punishment settings.',
  SETUP_LOG_TITLE: '📋 Logging Setup',
  SETUP_LOG_DESC: 'Configure where log events are sent.',
  SETUP_WELCOME_TITLE: '👋 Welcome/Goodbye Setup',
  SETUP_WELCOME_DESC: 'Configure welcome and goodbye messages.',
  SETUP_TICKET_TITLE: '🎫 Ticket Setup',
  SETUP_TICKET_DESC: 'Configure the ticket system.',
  SETUP_XP_TITLE: '⭐ XP/Levels Setup',
  SETUP_XP_DESC: 'Configure the XP and leveling system.',
  SETUP_ECONOMY_TITLE: '💰 Economy Setup',
  SETUP_ECONOMY_DESC: 'Configure the economy system.',
  SETUP_GIVEAWAY_TITLE: '🎉 Giveaway Setup',
  SETUP_GIVEAWAY_DESC: 'Configure the giveaway system.',
  SETUP_NOTIFY_TITLE: '🔔 Notifications Setup',
  SETUP_NOTIFY_DESC: 'Configure RSS feed notifications.',
  SETUP_LANG_TITLE: '🌐 Language Setup',
  SETUP_LANG_DESC: 'Change the bot language for this server.',

  // Feature toggle
  FEATURE_ENABLED: 'Enabled',
  FEATURE_DISABLED: 'Disabled',
  FEATURE_TOGGLE: (name, state) => name + ' is now **' + state + '**.',
  FEATURE_ON: 'On',
  FEATURE_OFF: 'Off',

  // Buttons
  BTN_ENABLE: 'Enable',
  BTN_DISABLE: 'Disable',
  BTN_CONFIGURE: 'Configure',
  BTN_BACK: 'Back',
  BTN_DONE: 'Done',
  BTN_ON: '🟢 ON',
  BTN_OFF: '🔴 OFF',

  // Reaction Roles
  RR_SETUP_TITLE: '🎭 Reaction Role Setup',
  RR_SETUP_DESC: 'Use the buttons below to configure reaction roles.',
  RR_ADD_PAIR: 'Add Role Pair',
  RR_REMOVE_PAIR: 'Remove Pair',
  RR_SET_CHANNEL: 'Set Channel',
  RR_PREVIEW: 'Preview',
  RR_SEND: 'Send Reaction Role',
  RR_CANCEL: 'Cancel',
  RR_NO_PAIRS: 'No role pairs added yet.',
  RR_CHANNEL_NOT_SET: 'Not set',
  RR_PAIRS: 'Role Pairs',
  RR_TITLE_LABEL: 'Title',
  RR_CHANNEL_LABEL: 'Channel',
  RR_PAIRS_COUNT: (n) => '' + n,
  RR_MODAL_TITLE: 'Add Role Pair',
  RR_MODAL_ROLE: 'Role (mention or ID)',
  RR_MODAL_ROLE_PLACEHOLDER: '@Moderator or 1234567890123456789',
  RR_MODAL_EMOJI: 'Emoji (unicode or custom)',
  RR_MODAL_EMOJI_PLACEHOLDER: '🔴 or :moderator: or <a:star:123>',
  RR_ROLE_NOT_FOUND: (text) => 'Could not find a role matching **' + text + '**.',
  RR_ROLE_TOO_HIGH: 'I cannot assign this role. It is equal to or higher than my highest role.',
  RR_INVALID_EMOJI: 'Please provide a valid Unicode emoji or custom emoji.',
  RR_DUPLICATE: 'This emoji or role is already in the list.',
  RR_SENT: (channel, count) =>
    'Sent to ' + channel + ' with **' + count + '** role pair(s).',
  RR_DELETED: 'Reaction role message has been deleted.',
  RR_SELECT_REMOVE: 'Select pairs to remove:',
  RR_SELECT_CHANNEL: 'Select the channel to send the reaction role message in:',
  RR_EXPIRED: 'This interaction has expired. Run the setup again.',
  RR_NOT_FOUND: 'No reaction role found with that message ID.',

  // Welcome
  WELCOME_TITLE: 'Welcome',
  WELCOME_DESC: (user, server, count) =>
    'Welcome to **' + server + '**, ' + user + '! You are member #' + count + '.',
  GOODBYE_TITLE: 'Goodbye',
  GOODBYE_DESC: (user, server) => user + ' has left **' + server + '**.',

  // Verification
  VERIFY_TITLE: 'Verification Required',
  VERIFY_DESC: 'Click the button below to verify.',
  VERIFY_SUCCESS: 'You have been verified! Welcome to the server.',
  VERIFY_FAILED: 'Failed to verify. Contact a mod.',

  // Tickets
  TICKET_TITLE: '🎫 Support Ticket',
  TICKET_DESC: (user) => 'Welcome ' + user + '! Describe your issue and a staff member will assist you.',
  TICKET_CLOSED: '🔒 Ticket closed. Deleting in 5s.',
  TICKET_CLAIMED: (user) => '🙋 Ticket claimed by ' + user,

  // Engagement
  LEVELUP_TITLE: '⭐ Level Up!',
  LEVELUP_DESC: (user, level) => '**' + user + '** reached **level ' + level + '**!',
  DAILY_CLAIMED: (amount) => 'You received **' + amount + '**!',
  DAILY_NEXT: (time) => 'You can claim again in **' + time + '**.',
  SHOP_EMPTY: 'The shop is empty.',
  SHOP_ITEM: (name, price, desc) => '**' + name + '** — ' + price + '\n' + desc,
  SHOP_PURCHASED: (name, price) => 'You bought **' + name + '** for ' + price + '!',
  SHOP_INSUFFICIENT: (price) => 'Need **' + price + '**.',
  SHOP_ADDED: (name, price) => '**' + name + '** — ' + price,
  SHOP_REMOVED: (name) => '**' + name + '** removed.',
  GIVEAWAY_TITLE: '🎉 Giveaway!',
  GIVEAWAY_ENDED: '🎉 Giveaway Ended',
  POLL_TITLE: '📊 Poll',

  // Errors
  ERR_PERMISSION: 'You do not have permission to use this command.',
  ERR_DISABLED: 'This feature is not enabled.',
  ERR_NOT_FOUND: 'Not found.',
  ERR_INVALID_USAGE: 'Invalid usage.',
  ERR_CHANNEL_NOT_FOUND: 'Channel not found.',
  ERR_ROLE_NOT_FOUND: 'Role not found.',
  ERR_SELF_ACTION: 'You cannot perform this action on yourself.',

  // Language
  LANG_CHANGED: (lang) => 'Language set to **' + lang + '**.',
  LANG_SUPPORTED: (list) => 'Supported languages: ' + list,
};

module.exports = en;
