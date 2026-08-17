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

    const moderation = client.commands.filter(c =>
      ['kick', 'ban', 'mute', 'unmute', 'warn', 'purge'].includes(c.name)
    );
    const utility = client.commands.filter(c =>
      ['ping', 'serverinfo', 'userinfo', 'avatar', 'help'].includes(c.name)
    );

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('System Bot — Commands')
      .setDescription(`Use \`${config.prefix}help <command>\` for more info on a command.`)
      .addFields(
        {
          name: 'Moderation',
          value: moderation.map(c => `\`${config.prefix}${c.name}\` — ${c.description}`).join('\n') || 'None',
        },
        {
          name: 'Utility',
          value: utility.map(c => `\`${config.prefix}${c.name}\` — ${c.description}`).join('\n') || 'None',
        },
      )
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },
};
