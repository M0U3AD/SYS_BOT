const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed, COLORS } = require('../../utils/embeds');
const emojis = require('../../utils/emojis');

function parseMember(mention, guild) {
  const id = String(mention || '').replace(/[<@!>]/g, '');
  return id ? (guild.members.cache.get(id) || null) : null;
}

function parseRole(mention, guild) {
  const id = String(mention || '').replace(/[<@&>]/g, '');
  return id ? (guild.roles.cache.get(id) || null) : null;
}

function progressText(label, done, failed, total, dots) {
  return label + ' — **' + done + '/' + total + '** updated' + (failed ? ' · **' + failed + '** failed' : '') + ' ' + dots;
}

async function confirmAction(target, label, description) {
  return new Promise(resolve => {
    const confirmId = 'roles_confirm_' + Date.now().toString(36);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(confirmId).setLabel('Confirm').setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId('roles_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌')
    );

    const done = (embed, components) => {
      target.reply({ embeds: [embed], components }).then(msg => {
        const collector = msg.createMessageComponentCollector({
          filter: i => i.user.id === (target.user ? target.user.id : target.author.id),
          time: 60000,
        });
        collector.on('collect', async i => {
          if (i.customId === 'roles_cancel') {
            collector.stop();
            await i.update({ embeds: [errorEmbed('Action Cancelled', 'Bulk role update was cancelled.')], components: [] }).catch(() => {});
            return resolve(false);
          }
          await i.update({ embeds: [infoEmbed('Updating', 'Applying role changes...')], components: [] }).catch(() => {});
          collector.stop();
          return resolve(true);
        });
        collector.on('end', async col => {
          if (!col.size && msg.editable) {
            await msg.edit({ embeds: [errorEmbed('Timed Out', 'Confirmation expired. Bulk role update was not run.')], components: [] }).catch(() => {});
            return resolve(false);
          }
        });
      });
    };

    done(require('../../utils/embeds').confirmEmbed(emojis.warning, 'Bulk Role Update', label + '\n\n' + description), [row]);
  });
}

function summarizeResult(action, role, applied, failed) {
  const verb = action === 'add' ? 'added' : 'removed';
  let desc = 'Role <@&' + role.id + '> (' + role.name + ') successfully ' + verb + ' for **' + applied + '** member' + (applied === 1 ? '' : 's') + '.';
  if (failed > 0) desc += '\n**' + failed + '** member' + (failed === 1 ? '' : 's') + ' could not be updated (missing permissions or role position).';
  return desc;
}

module.exports = {
  name: 'roles',
  description: 'Add or remove roles from members — single or bulk',
  usage: '!roles add <@user> <@role> | remove <@user> <@role> | add-by-role <@source> <@role> | remove-by-role <@source> <@role> | add-all <@role> | remove-all <@role> | info <@role>',
  slash: new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Manage member roles (single or bulk)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommandGroup(group => group
      .setName('add')
      .setDescription('Add a role')
      .addSubcommand(sub => sub
        .setName('user')
        .setDescription('Add a role to one member')
        .addUserOption(opt => opt.setName('user').setDescription('Member').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true)))
      .addSubcommand(sub => sub
        .setName('by-role')
        .setDescription('Add a role to every member that has another role')
        .addRoleOption(opt => opt.setName('source').setDescription('Source role').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true)))
      .addSubcommand(sub => sub
        .setName('all')
        .setDescription('Add a role to every member in the server')
        .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true))))
    .addSubcommandGroup(group => group
      .setName('remove')
      .setDescription('Remove a role')
      .addSubcommand(sub => sub
        .setName('user')
        .setDescription('Remove a role from one member')
        .addUserOption(opt => opt.setName('user').setDescription('Member').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true)))
      .addSubcommand(sub => sub
        .setName('by-role')
        .setDescription('Remove a role from every member that has another role')
        .addRoleOption(opt => opt.setName('source').setDescription('Source role').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true)))
      .addSubcommand(sub => sub
        .setName('all')
        .setDescription('Remove a role from every member in the server')
        .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))))
    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('Show who has a role and role details')
      .addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true))),

  async execute(message, args) {
    if (!message.member.permissions.has('ManageRoles')) {
      return message.reply({ embeds: [errorEmbed('Access Denied', 'You need the `Manage Roles` permission.')] });
    }

    const sub = (args.shift() || '').toLowerCase();
    const target = message;
    const actorId = message.author.id;

    if (sub === 'add' || sub === 'remove') {
      const member = parseMember(args[0], message.guild);
      const role = parseRole(args[1], message.guild);
      if (!member || !role) {
        return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!roles ' + sub + ' <@user> <@role>`')] });
      }
      try {
        if (sub === 'add') await member.roles.add(role);
        else await member.roles.remove(role);
        return message.reply({
          embeds: [successEmbed((sub === 'add' ? 'Role Added' : 'Role Removed'), '**' + (member.nickname || member.user.username) + '** ' + (sub === 'add' ? 'now has' : 'no longer has') + ' <@&' + role.id + '> (' + role.name + ').')],
        });
      } catch (err) {
        return message.reply({ embeds: [errorEmbed('Failed', 'Could not ' + sub + ' the role: `' + err.message + '`')] });
      }
    }

    if (sub === 'add-by-role' || sub === 'remove-by-role' || sub === 'add-all' || sub === 'remove-all') {
      const action = sub.startsWith('add') ? 'add' : 'remove';
      const targetRole = parseRole(args.pop(), message.guild);
      if (!targetRole) return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Mention a target role: `!roles ' + sub + ' <@role>`')] });

      let members;
      if (sub.endsWith('-all')) {
        members = [...(await message.guild.members.fetch()).values()];
      } else {
        const source = parseRole(args[args.length - 1], message.guild) || parseRole(args[0], message.guild);
        if (!source) return message.reply({ embeds: [errorEmbed('Invalid Usage', 'Mention a source role: `!roles ' + sub + ' <@source> <@role>`')] });
        const all = await message.guild.members.fetch();
        members = all.filter(m => m.roles.cache.has(source.id)).map(m => m);
      }

      if (members.length === 0) {
        return message.reply({ embeds: [infoEmbed('Nothing To Do', 'No members match that selection.')] });
      }
      if (targetRole.id === message.guild.id) {
        return message.reply({ embeds: [errorEmbed('Invalid Role', 'You cannot modify the @everyone role.')] });
      }

      const verb = action === 'add' ? 'Add' : 'Remove';
      const ok = await confirmAction(target, verb + ' <@&' + targetRole.id + '> for **' + members.length + '** members?', 'This will ' + action + ' `' + targetRole.name + '` for every matched member. This cannot be undone quickly.');
      if (!ok) return;

      let done = 0;
      let failed = 0;
      const total = members.length;
      let dots = 0;
      const statusMsg = await message.reply({ embeds: [infoEmbed('Working', progressText(verb + 'ing role', 0, 0, total, '⏳'))] });

      for (const member of members) {
        try {
          if (action === 'add') {
            if (!member.roles.cache.has(targetRole.id)) await member.roles.add(targetRole);
          } else {
            if (member.roles.cache.has(targetRole.id)) await member.roles.remove(targetRole);
          }
          done++;
        } catch (e) {
          failed++;
        }
        if (done % 50 === 0 || done + failed === total) {
          dots = (dots + 1) % 4;
          const loading = ['⏳', '⏳', '⏳', '⏳'];
          await statusMsg.edit({ embeds: [infoEmbed('Working', progressText(verb + 'ing role', done, failed, total, loading[dots]))] }).catch(() => {});
        }
      }

      return statusMsg.edit({
        embeds: [successEmbed((action === 'add' ? 'Role Added' : 'Role Removed') + ' — Bulk Complete', summarizeResult(action, targetRole, done, failed))],
      });
    }

    if (sub === 'info') {
      const role = parseRole(args[0], message.guild);
      if (!role) return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!roles info <@role>`')] });

      const all = await message.guild.members.fetch();
      const holders = all.filter(m => m.roles.cache.has(role.id)).map(m => m);
      const ch = message.guild.channels.cache.filter(c => c.permissionsFor && c.permissionsFor(role).has('ViewChannel'));

      const fields = [
        { name: emojis.role + ' Role', value: role.mention + ' (`' + role.name + '`)', inline: true },
        { name: 'Members', value: '' + holders.length, inline: true },
        { name: 'Color', value: role.hexColor, inline: true },
        { name: 'Position', value: '' + role.position, inline: true },
        { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
        { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
        { name: 'Visible Channels', value: '' + ch.size, inline: true },
        { name: 'Permissions', value: role.permissions.toArray().length + ' permission(s)', inline: true },
        { name: 'Created', value: new Date(role.createdTimestamp).toLocaleDateString(), inline: true },
      ];

      if (holders.length > 0) {
        const list = holders.slice(0, 25).map(m => '**' + m.user.username + '**').join(', ') + (holders.length > 25 ? ' … and ' + (holders.length - 25) + ' more' : '');
        fields.push({ name: emojis.members + ' Holders', value: list.substring(0, 1024) });
      } else {
        fields.push({ name: emojis.members + ' Holders', value: 'No members have this role.' });
      }

      return message.reply({ embeds: [new (require('discord.js').EmbedBuilder)().setColor(role.hexColor || COLORS.primary).setTitle(emojis.role + ' Role Info').addFields(fields).setTimestamp()] });
    }

    return message.reply({ embeds: [errorEmbed('Invalid Usage', '`!roles add|remove|add-by-role|remove-by-role|add-all|remove-all|info`')] });
  },

  async slashExecute(interaction) {
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();

    if (group === 'add' || group === 'remove') {
      if (sub === 'user') {
        const user = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');
        const member = interaction.guild.members.cache.get(user.id);
        if (!member) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Could not find that member.')], ephemeral: true });
        try {
          if (group === 'add') await member.roles.add(role);
          else await member.roles.remove(role);
          return interaction.reply({
            embeds: [successEmbed((group === 'add' ? 'Role Added' : 'Role Removed'), '**' + (member.nickname || user.username) + '** ' + (group === 'add' ? 'now has' : 'no longer has') + ' <@&' + role.id + '> (' + role.name + ').')],
          });
        } catch (err) {
          return interaction.reply({ embeds: [errorEmbed('Failed', 'Could not ' + group + ' the role: `' + err.message + '`')], ephemeral: true });
        }
      }

      const action = group;
      const targetRole = interaction.options.getRole('role');
      let members;
      if (sub === 'all') {
        members = [...(await interaction.guild.members.fetch()).values()];
      } else {
        const source = interaction.options.getRole('source');
        const all = await interaction.guild.members.fetch();
        members = all.filter(m => m.roles.cache.has(source.id)).map(m => m);
      }

      if (members.length === 0) {
        return interaction.reply({ embeds: [infoEmbed('Nothing To Do', 'No members match that selection.')], ephemeral: true });
      }
      if (targetRole.id === interaction.guild.id) {
        return interaction.reply({ embeds: [errorEmbed('Invalid Role', 'You cannot modify the @everyone role.')], ephemeral: true });
      }

      const verb = action === 'add' ? 'Add' : 'Remove';
      const ok = await confirmAction(interaction, verb + ' <@&' + targetRole.id + '> for **' + members.length + '** members?', 'This will ' + action + ' `' + targetRole.name + '` for every matched member. This cannot be undone quickly.');
      if (!ok) return;

      let done = 0;
      let failed = 0;
      const total = members.length;
      const statusMsg = await interaction[interaction.replied ? 'followUp' : 'reply']({ embeds: [infoEmbed('Working', progressText(verb + 'ing role', 0, 0, total, '⏳'))], fetchReply: true }).catch(() => null);

      for (const member of members) {
        try {
          if (action === 'add') {
            if (!member.roles.cache.has(targetRole.id)) await member.roles.add(targetRole);
          } else {
            if (member.roles.cache.has(targetRole.id)) await member.roles.remove(targetRole);
          }
          done++;
        } catch (e) {
          failed++;
        }
        if ((done % 50 === 0 || done + failed === total) && statusMsg) {
          await statusMsg.edit({ embeds: [infoEmbed('Working', progressText(verb + 'ing role', done, failed, total, '⏳'))] }).catch(() => {});
        }
      }

      if (statusMsg) {
        await statusMsg.edit({
          embeds: [successEmbed((action === 'add' ? 'Role Added' : 'Role Removed') + ' — Bulk Complete', summarizeResult(action, targetRole, done, failed))],
        }).catch(() => {});
      } else {
        await interaction.followUp({ embeds: [successEmbed((action === 'add' ? 'Role Added' : 'Role Removed') + ' — Bulk Complete', summarizeResult(action, targetRole, done, failed))] }).catch(() => {});
      }
      return;
    }

    if (sub === 'info') {
      const role = interaction.options.getRole('role');
      const all = await interaction.guild.members.fetch();
      const holders = all.filter(m => m.roles.cache.has(role.id)).map(m => m);
      const fields = [
        { name: emojis.role + ' Role', value: role.mention + ' (`' + role.name + '`)', inline: true },
        { name: 'Members', value: '' + holders.length, inline: true },
        { name: 'Color', value: role.hexColor, inline: true },
        { name: 'Position', value: '' + role.position, inline: true },
        { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
        { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
      ];
      if (holders.length > 0) {
        fields.push({ name: emojis.members + ' Holders', value: holders.slice(0, 25).map(m => '**' + m.user.username + '**').join(', ') + (holders.length > 25 ? ' … +' + (holders.length - 25) : '') });
      } else {
        fields.push({ name: emojis.members + ' Holders', value: 'No members have this role.' });
      }
      return interaction.reply({ embeds: [new (require('discord.js').EmbedBuilder)().setColor(role.hexColor || COLORS.primary).setTitle(emojis.role + ' Role Info').addFields(fields).setTimestamp()], ephemeral: true });
    }
  },
};