const { EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  name: 'help',
  description: 'Show all commands or info about a specific command',
  usage: '!help [command]',
  async execute(message, args, client) {
    if (args[0]) {
      const cmd = client.commands.get(args[0]);
      if (!cmd) {
        return message.reply({ embeds: [require('../../utils/embeds').errorEmbed('Unknown Command', `No command found called **${args[0]}**.`)] });
      }
      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(`Command: ${cmd.name}`)
        .setDescription(cmd.description || 'No description')
        .addFields({ name: 'Usage', value: `\`${cmd.usage || cmd.name}\`` })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    const moderation = ['ban', 'kick', 'mute', 'unmute', 'warn', 'purge', 'automod'];
    const community = ['welcome', 'autorole', 'reactionrole', 'verify'];
    const support = ['ticket', 'apply'];
    const gaming = ['stats', 'lfg', 'gameroles', 'leaderboard'];
    const engagement = ['rank', 'levels', 'balance', 'daily', 'pay', 'shop', 'giveaway', 'poll'];
    const notifications = ['youtube', 'twitch', 'reddit', 'gamenews'];
    const admin = ['say', 'announce', 'dm', 'logs', 'setup', 'permissions', 'language'];
    const utility = ['ping', 'serverinfo', 'userinfo', 'avatar', 'help'];
    const store = ['addproduct', 'products', 'deleteproduct', 'redeem', 'regenerate'];

    const categorize = (names) => names
      .filter(n => client.commands.has(n))
      .map(n => client.commands.get(n))
      .map(c => `\`${config.prefix}${c.name}\` — ${c.description}`)
      .join('\n') || 'None';

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('SYS-F1ex — Commands')
      .setDescription(`Use \`${config.prefix}help <command>\` for more info.\nSlash commands (/) are also available for most features.`)
      .addFields(
        { name: '🛡️ Moderation', value: categorize(moderation) },
        { name: '👋 Community', value: categorize(community) },
        { name: '🎫 Support', value: categorize(support) },
        { name: '🎮 Gaming', value: categorize(gaming) },
        { name: '🎉 Engagement', value: categorize(engagement) },
        { name: '🔔 Notifications', value: categorize(notifications) },
        { name: '⚙️ Admin', value: categorize(admin) },
        { name: '📋 Utility', value: categorize(utility) },
        { name: '🛒 Store', value: categorize(store) },
      )
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },
};
