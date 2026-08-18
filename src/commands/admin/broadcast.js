const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');
const { getGuildConfig } = require('../../database/utils/GuildConfig');

module.exports = {
  name: 'broadcast',
  description: 'Send a DM broadcast to all server members',
  usage: '!broadcast <message>',
  slash: new SlashCommandBuilder()
    .setName('broadcast')
    .setDescription('Send a DM broadcast to all server members')
    .addStringOption(opt => opt.setName('message').setDescription('Message to send').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply({ embeds: [errorEmbed('Access Denied', 'You need the `Administrator` permission.')] });
    }

    const text = args.join(' ');
    if (!text) {
      return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!broadcast <message>`')] });
    }

    const confirmEmbed = new EmbedBuilder()
      .setColor(COLORS.warning)
      .setTitle(emojis.warning + ' Broadcast Confirmation')
      .setDescription(
        'You are about to send a DM to **all members** of this server.\n\n' +
        '**Message:**\n' + text.substring(0, 1000) + (text.length > 1000 ? '...' : '') + '\n\n' +
        '**Note:** This will send to all members who have DMs enabled. Rate limits may slow delivery.'
      )
      .setTimestamp()
      .setFooter({ text: 'SYS-F1ex \u2022 Confirmation Required' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('broadcast_confirm_' + message.author.id)
        .setLabel('Send Broadcast')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis.send),
      new ButtonBuilder()
        .setCustomId('broadcast_cancel_' + message.author.id)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.cross)
    );

    const msg = await message.reply({ embeds: [confirmEmbed], components: [row] });

    const collector = msg.createMessageComponentCollector({ time: 30000 });
    collector.on('collect', async (i) => {
      if (i.user.id !== message.author.id) {
        return i.reply({ content: 'This is not for you.', ephemeral: true });
      }

      if (i.customId === 'broadcast_cancel_' + message.author.id) {
        collector.stop('cancelled');
        return i.update({ embeds: [errorEmbed('Broadcast Cancelled', 'Action was cancelled.')], components: [] });
      }

      if (i.customId === 'broadcast_confirm_' + message.author.id) {
        collector.stop('confirmed');

        await i.update({
          embeds: [infoEmbed('Broadcasting...', emojis.dots + ' Sending DMs to all members. This may take a while.')],
          components: []
        });

        const config = await getGuildConfig(message.guild.id);
        const embed = new EmbedBuilder()
          .setColor(config.embedColor || COLORS.blurple)
          .setTitle(emojis.inbox + ' Server Broadcast')
          .setDescription(text)
          .setThumbnail(message.guild.iconURL({ dynamic: true }))
          .setFooter({ text: 'From: ' + message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) })
          .setTimestamp();

        const members = await message.guild.members.fetch();
        let sent = 0;
        let failed = 0;
        let skipped = 0;

        const dmPromises = [];
        for (const [, member] of members) {
          if (member.user.bot) {
            skipped++;
            continue;
          }
          if (!member.dmChannel) {
            try {
              await member.createDM();
            } catch {
              failed++;
              continue;
            }
          }
          dmPromises.push(
            member.send({ embeds: [embed] }).then(() => {
              sent++;
            }).catch(() => {
              failed++;
            })
          );
        }

        await Promise.allSettled(dmPromises);

        const resultEmbed = modEmbed(emojis.outbox, 'Broadcast Complete', [
          { name: emojis.check + ' Sent', value: '' + sent, inline: true },
          { name: emojis.cross + ' Failed', value: '' + failed, inline: true },
          { name: emojis.info + ' Skipped (bots)', value: '' + skipped, inline: true },
        ], { color: COLORS.success });

        await i.editReply({ embeds: [resultEmbed] });
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'confirmed' || reason === 'cancelled') return;
      try {
        await msg.edit({ embeds: [errorEmbed('Timed Out', 'Confirmation expired. Broadcast was not sent.')], components: [] });
      } catch {}
    });
  },

  async slashExecute(interaction, client) {
    const text = interaction.options.getString('message');

    const confirmEmbed = new EmbedBuilder()
      .setColor(COLORS.warning)
      .setTitle(emojis.warning + ' Broadcast Confirmation')
      .setDescription(
        'You are about to send a DM to **all members** of this server.\n\n' +
        '**Message:**\n' + text.substring(0, 1000) + (text.length > 1000 ? '...' : '') + '\n\n' +
        '**Note:** This will send to all members who have DMs enabled. Rate limits may slow delivery.'
      )
      .setTimestamp()
      .setFooter({ text: 'SYS-F1ex \u2022 Confirmation Required' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('broadcast_confirm_' + interaction.user.id)
        .setLabel('Send Broadcast')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis.send),
      new ButtonBuilder()
        .setCustomId('broadcast_cancel_' + interaction.user.id)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.cross)
    );

    await interaction.reply({ embeds: [confirmEmbed], components: [row] });
    const msg = await interaction.fetchReply();

    const collector = msg.createMessageComponentCollector({ time: 30000 });
    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'This is not for you.', ephemeral: true });
      }

      if (i.customId === 'broadcast_cancel_' + interaction.user.id) {
        collector.stop('cancelled');
        return i.update({ embeds: [errorEmbed('Broadcast Cancelled', 'Action was cancelled.')], components: [] });
      }

      if (i.customId === 'broadcast_confirm_' + interaction.user.id) {
        collector.stop('confirmed');

        await i.update({
          embeds: [infoEmbed('Broadcasting...', emojis.dots + ' Sending DMs to all members. This may take a while.')],
          components: []
        });

        const config = await getGuildConfig(interaction.guild.id);
        const embed = new EmbedBuilder()
          .setColor(config.embedColor || COLORS.blurple)
          .setTitle(emojis.inbox + ' Server Broadcast')
          .setDescription(text)
          .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
          .setFooter({ text: 'From: ' + interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) })
          .setTimestamp();

        const members = await interaction.guild.members.fetch();
        let sent = 0;
        let failed = 0;
        let skipped = 0;

        const dmPromises = [];
        for (const [, member] of members) {
          if (member.user.bot) {
            skipped++;
            continue;
          }
          dmPromises.push(
            member.send({ embeds: [embed] }).then(() => {
              sent++;
            }).catch(() => {
              failed++;
            })
          );
        }

        await Promise.allSettled(dmPromises);

        const resultEmbed = modEmbed(emojis.outbox, 'Broadcast Complete', [
          { name: emojis.check + ' Sent', value: '' + sent, inline: true },
          { name: emojis.cross + ' Failed', value: '' + failed, inline: true },
          { name: emojis.info + ' Skipped (bots)', value: '' + skipped, inline: true },
        ], { color: COLORS.success });

        await i.editReply({ embeds: [resultEmbed] });
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'confirmed' || reason === 'cancelled') return;
      try {
        await msg.edit({ embeds: [errorEmbed('Timed Out', 'Confirmation expired. Broadcast was not sent.')], components: [] });
      } catch {}
    });
  },
};
