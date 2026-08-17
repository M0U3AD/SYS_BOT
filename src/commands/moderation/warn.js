const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { addWarning, getWarnings, clearWarnings } = require('../../utils/warnings');

module.exports = {
  name: 'warn',
  description: 'Warn a member, view warnings, or clear warnings',
  usage: '!warn <@user> [reason] | !warn list <@user> | !warn clear <@user>',
  async execute(message, args) {
    if (!message.member.permissions.has('ModerateMembers')) {
      return message.reply({ embeds: [errorEmbed('Permission Denied', 'You need the Moderate Members permission.')] });
    }

    if (args[0] === 'list') {
      const member = message.mentions.members.first();
      if (!member) {
        return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!warn list <@user>`')] });
      }
      const warns = getWarnings(message.guild.id, member.id);
      if (warns.length === 0) {
        return message.reply({ embeds: [infoEmbed('Warnings', `**${member.user.tag}** has no warnings.`)] });
      }
      const list = warns.map((w, i) => `**${i + 1}.** ${w.reason} — by <@${w.moderator}> on ${new Date(w.date).toLocaleDateString()}`).join('\n');
      return message.reply({ embeds: [infoEmbed(`Warnings for ${member.user.tag}`, `${warns.length} warning(s)\n\n${list}`)] });
    }

    if (args[0] === 'clear') {
      const member = message.mentions.members.first();
      if (!member) {
        return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!warn clear <@user>`')] });
      }
      const count = clearWarnings(message.guild.id, member.id);
      return message.reply({ embeds: [successEmbed('Warnings Cleared', `Cleared **${count}** warning(s) for **${member.user.tag}**.`)] });
    }

    const member = message.mentions.members.first();
    if (!member) {
      return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Please mention a user to warn.\n`!warn <@user> [reason]`')] });
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';
    const count = addWarning(message.guild.id, member.id, reason, message.author.id);

    message.reply({ embeds: [successEmbed('Member Warned', `**${member.user.tag}** has been warned.\n**Reason:** ${reason}\n**Total Warnings:** ${count}`)] });
  },
};
