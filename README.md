# SYS-F1ex Discord bot

## Setup

1. Install Node.js 20 or newer and run `npm install`.
2. Copy `.env.example` to `.env`, then set `TOKEN`, `CLIENT_ID`, and `MONGODB_URI`.
3. Invite the application with the `bot` and `applications.commands` scopes.
4. Grant the bot these server permissions:
   - Manage Channels
   - Move Members
   - View Channels, Connect, Send Messages, and Read Message History
   - Mute Members for the panel's mute and unmute actions
5. Enable the `Guilds` and `Guild Voice States` intents in the Discord Developer Portal. The bot already requests these intents in `index.js`.
6. Run `npm run deploy:commands` to register slash commands, then start with `npm start`. The bot also registers commands when it becomes ready.

The legacy prefix commands use `MESSAGE CONTENT INTENT`; temporary voice creation and `/voice` controls use slash commands and voice state events.

## Temporary voice

An administrator can run `/tempvoice setup` without options to create a category and join-to-create voice channel. Or select an existing hub and optional category. The bot must have Manage Channels and Move Members in the hub. Setup reports missing permissions before enabling the feature.

`/tempvoice config` sets the room name template (`{user}` and `{count}`), default user limit, max rooms per member, creation cooldown, default bitrate, and optional allow/block roles. A nonempty allow-role list restricts room creation to members with one of those roles; block roles always deny creation.

When a member joins the hub, the bot creates a room and posts its control panel in the voice channel chat. The owner can use the panel or `/voice` commands in that channel. Room owners can save their preferred name, user limit, and lock setting with `/voice save`; `/voice reset` clears those preferences. Empty rooms are deleted immediately. If an owner leaves while others remain, ownership moves to the longest-present member; `/voice claim` is available when the owner is absent.

## Recovery and moderation

Temporary rooms and ownership are stored in MongoDB. On startup, the bot removes stale records and empty orphaned rooms, restores active rooms and their panels, and repairs ownership when the saved owner is no longer present. Room controls are restricted to the owner and members with Manage Guild or Manage Channels.

## Manual testing checklist

- Run `/tempvoice setup`, join the hub, and confirm a named room plus panel appear in voice chat.
- Leave the room and confirm it is deleted with its database record.
- Join with a second member, have the owner leave, and confirm ownership transfers; then test `/voice claim` after the owner is absent.
- Test lock/unlock, hide/unhide, rename, user limit, permit, kick, ban/unban, bitrate, and region controls.
- Run `/voice save`, create another room, and confirm the saved name, limit, and lock setting apply; test `/voice reset`.
- Restart the bot with a populated room and confirm the panel and ownership recover; confirm empty orphan rooms are removed.
- Remove Manage Channels or Move Members and confirm `/tempvoice setup` reports the missing permission without enabling a broken hub.
