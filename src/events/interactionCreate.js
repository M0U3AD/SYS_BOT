const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.slashCommands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.slashExecute(interaction, client);
    } catch (error) {
      console.error(`Slash command error [${interaction.commandName}]:`, error);
      const reply = {
        embeds: [errorEmbed('Error', 'An error occurred while executing this command.')],
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  },
};
