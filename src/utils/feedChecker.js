const RssParser = require('rss-parser');
const { EmbedBuilder } = require('discord.js');
const Notification = require('../database/models/Notification');

const parser = new RssParser();

async function checkFeeds(client) {
  const feeds = await Notification.find({});
  for (const feed of feeds) {
    try {
      let items = [];

      if (feed.type === 'youtube') {
        const url = feed.feedUrl || `https://www.youtube.com/feeds/videos.xml?channel_id=${feed.source}`;
        const parsed = await parser.parseURL(url);
        items = parsed.items.slice(0, 3);
      } else if (feed.type === 'reddit') {
        const url = `https://www.reddit.com/r/${feed.source}/new/.rss?limit=5`;
        const parsed = await parser.parseURL(url);
        items = parsed.items.slice(0, 3);
      } else if (feed.type === 'gamenews' && feed.feedUrl) {
        const parsed = await parser.parseURL(feed.feedUrl);
        items = parsed.items.slice(0, 3);
      } else if (feed.type === 'twitch') {
        continue;
      }

      if (items.length === 0) continue;

      const newestId = items[0].link || items[0].guid;
      if (newestId === feed.lastPostId) continue;

      const channel = client.channels.cache.get(feed.postChannelId);
      if (!channel) continue;

      for (const item of items.slice(0, 2)) {
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(item.title || 'New Post')
          .setDescription((item.contentSnippet || item.content || '').substring(0, 500))
          .setURL(item.link || '')
          .setTimestamp(item.pubDate ? new Date(item.pubDate) : new Date())
          .setFooter({ text: `${feed.type.toUpperCase()} • ${feed.source}` });

        await channel.send({ embeds: [embed] }).catch(() => {});
      }

      feed.lastPostId = newestId;
      feed.lastChecked = new Date();
      await feed.save();
    } catch (err) {
      console.error(`Feed check error [${feed.type}/${feed.source}]:`, err.message);
    }
  }
}

function startFeedChecker(client) {
  setInterval(() => checkFeeds(client), 5 * 60 * 1000);
  console.log('Feed checker started (5 min interval).');
}

module.exports = { checkFeeds, startFeedChecker };
