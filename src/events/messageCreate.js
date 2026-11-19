const config = require('../../config.json');
const tempVoice = require('../utils/tempVoice');

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message, client) {
    if (message.author.bot) return;

    if (/^\.v(?:\s|$)/i.test(message.content.trim())) {
      try {
        if (await tempVoice.handleMessage(message)) return;
      } catch (error) {
        console.error('Temp voice text command error:', error);
        await message.reply('The temporary voice command failed. Check the bot permissions and try again.').catch(() => {});
      }
    }

    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
      await command.execute(message, args, client);
    } catch (error) {
      console.error('Command error [' + commandName + ']:', error);
      message.reply('There was an error executing that command.').catch(() => {});
    }
  },
};
