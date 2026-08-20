const es = {
  BOT_NAME: 'SYS-F1ex',
  FOOTER: 'SYS-F1ex',

  MOD_ACCESS_DENIED: 'Necesitas el permiso `{perm}`.',
  MOD_SELF_ACTION: 'No puedes realizar esta acción en ti mismo.',
  MOD_CONFIRM_TITLE: 'Confirmación de {action}',
  MOD_CONFIRM_TEXT: '¿Estás seguro de que deseas continuar?',
  MOD_CONFIRM_BTN: 'Confirmar {action}',
  MOD_CANCEL_BTN: 'Cancelar',
  MOD_CANCELLED: 'Acción cancelada.',
  MOD_TIMED_OUT: 'Confirmación expirada. La acción no se ejecutó.',

  MOD_BAN_TITLE: 'Miembro Baneado',
  MOD_BAN_CONFIRM: (user, reason, mod) =>
    '**Objetivo:** ' + user + '\n**Razón:** ' + reason + '\n**Moderador:** ' + mod,
  MOD_BAN_SUCCESS: (user, reason) =>
    '**' + user + '** ha sido baneado.\n**Razón:** ' + reason,
  MOD_BAN_LOG: (user, mod, reason) =>
    '**Objetivo:** ' + user + '\n**Moderador:** ' + mod + '\n**Razón:** ' + reason,
  MOD_BAN_CANNOT: 'No puedo banear a este usuario. Su rol puede ser superior al mío.',
  MOD_BAN_NOT_FOUND: 'El usuario no está en este servidor.',

  MOD_KICK_TITLE: 'Miembro Expulsado',
  MOD_KICK_CONFIRM: (user, reason, mod) =>
    '**Objetivo:** ' + user + '\n**Razón:** ' + reason + '\n**Moderador:** ' + mod,
  MOD_KICK_SUCCESS: (user, reason) =>
    '**' + user + '** ha sido expulsado.\n**Razón:** ' + reason,
  MOD_KICK_LOG: (user, mod, reason) =>
    '**Objetivo:** ' + user + '\n**Moderador:** ' + mod + '\n**Razón:** ' + reason,
  MOD_KICK_CANNOT: 'No puedo expulsar a este usuario.',
  MOD_KICK_NOT_FOUND: 'El usuario no está en este servidor.',

  MOD_MUTE_TITLE: 'Miembro Silenciado',
  MOD_MUTE_CONFIRM: (user, duration, reason, mod) =>
    '**Objetivo:** ' + user + '\n**Duración:** ' + duration + '\n**Razón:** ' + reason + '\n**Moderador:** ' + mod,
  MOD_MUTE_SUCCESS: (user, duration, reason) =>
    '**' + user + '** silenciado por **' + duration + '**.\n**Razón:** ' + reason,
  MOD_MUTE_LOG: (user, mod, duration, reason) =>
    '**Objetivo:** ' + user + '\n**Moderador:** ' + mod + '\n**Duración:** ' + duration + '\n**Razón:** ' + reason,
  MOD_MUTE_CANNOT: 'No puedo silenciar a este usuario.',
  MOD_MUTE_NOT_FOUND: 'El usuario no está en este servidor.',
  MOD_MUTE_INVALID_DURATION: 'La duración debe ser entre **1** y **40320** minutos (28 días).',

  MOD_UNMUTE_TITLE: 'Miembro Desilenciado',
  MOD_UNMUTE_CONFIRM: (user, mod) =>
    '**Objetivo:** ' + user + '\n**Moderador:** ' + mod,
  MOD_UNMUTE_SUCCESS: (user) => '**' + user + '** ha sido desilenciado.',
  MOD_UNMUTE_LOG: (user, mod) =>
    '**Objetivo:** ' + user + '\n**Moderador:** ' + mod,
  MOD_UNMUTE_NOT_MUTED: 'Este usuario no está silenciado actualmente.',
  MOD_UNMUTE_NOT_FOUND: 'El usuario no está en este servidor.',

  MOD_WARN_TITLE: 'Miembro Advertido',
  MOD_WARN_CONFIRM: (user, reason, mod) =>
    '**Objetivo:** ' + user + '\n**Razón:** ' + reason + '\n**Moderador:** ' + mod,
  MOD_WARN_SUCCESS: (user, reason, total) =>
    '**' + user + '** advertido.\n**Razón:** ' + reason + '\n**Total Advertencias:** ' + total,
  MOD_WARN_LOG: (user, mod, reason, total) =>
    '**Objetivo:** ' + user + '\n**Moderador:** ' + mod + '\n**Razón:** ' + reason + '\n**Total:** ' + total,
  MOD_WARN_LIST_TITLE: (user) => 'Advertencias de ' + user,
  MOD_WARN_LIST_ENTRY: (i, reason, mod, date) =>
    '**' + i + '.** ' + reason + ' — <@' + mod + '> • ' + date,
  MOD_WARN_NO_WARNINGS: (user) => user + ' no tiene advertencias.',
  MOD_WARN_CLEAR_SUCCESS: (count, user) =>
    'Se limpiaron **' + count + '** advertencia(s) para **' + user + '**.',
  MOD_WARN_AUTO_MUTE: (user, total) =>
    user + ' ha sido silenciado automáticamente por alcanzar ' + total + ' advertencias.',
  MOD_WARN_AUTO_BAN: (user, total) =>
    user + ' ha sido baneado automáticamente por alcanzar ' + total + ' advertencias.',

  MOD_PURGE_TITLE: 'Mensajes Eliminados',
  MOD_PURGE_CONFIRM: (channel, amount, mod) =>
    '**Canal:** ' + channel + '\n**Cantidad:** ' + amount + ' mensaje(s)\n**Moderador:** ' + mod,
  MOD_PURGE_SUCCESS: (count) => 'Se eliminaron **' + count + '** mensajes.',

  MOD_AUTOMOD_TITLE: 'Configuración de AutoMod',
  MOD_AUTOMOD_ENABLED: 'La auto-moderación está ahora **activa**.',
  MOD_AUTOMOD_DISABLED: 'La auto-moderación ha sido **desactivada**.',
  MOD_AUTOMOD_UPDATED: 'Configuración guardada.',
  MOD_AUTOMOD_WORD_UPDATED: (word, action) =>
    '**' + word + '** ha sido ' + action + ' la lista de palabras bloqueadas.',
  MOD_AUTOMOD_WORD_DUPLICATE: 'La palabra ya está en la lista.',
  MOD_AUTOMOD_INVALID_USAGE: '`!automod word <add|remove> <word>`',
  MOD_AUTOMOD_STATUS: (enabled) => enabled ? 'Activado' : 'Desactivado',
  MOD_AUTOMOD_ON: (val) => val ? 'Sí' : 'No',

  SETUP_TITLE: 'SYS-F1ex Configuración',
  SETUP_DESCRIPTION: 'Selecciona una función para configurar:',
  SETUP_MODERATION: 'Moderación',
  SETUP_LOGGING: 'Registro',
  SETUP_WELCOME: 'Bienvenida',
  SETUP_TICKETS: 'Tickets',
  SETUP_XP: 'XP/Niveles',
  SETUP_ECONOMY: 'Economía',
  SETUP_GIVEAWAYS: 'Sorteos',
  SETUP_NOTIFICATIONS: 'Notificaciones',
  SETUP_LANGUAGE: 'Idioma',
  SETUP_REACTIONROLES: 'Roles de Reacción',
  SETUP_STATUS: (feature, enabled) => feature + ': ' + (enabled ? '✅' : '❌'),

  SETUP_MOD_TITLE: '🛡️ Configuración de Moderación',
  SETUP_MOD_DESC: 'Configura la auto-moderación y castigos.',
  SETUP_LOG_TITLE: '📋 Configuración de Registro',
  SETUP_LOG_DESC: 'Configura dónde se envían los registros.',
  SETUP_WELCOME_TITLE: '👋 Configuración de Bienvenida',
  SETUP_WELCOME_DESC: 'Configura los mensajes de bienvenida y despedida.',
  SETUP_TICKET_TITLE: '🎫 Configuración de Tickets',
  SETUP_TICKET_DESC: 'Configura el sistema de tickets.',
  SETUP_XP_TITLE: '⭐ Configuración de XP/Niveles',
  SETUP_XP_DESC: 'Configura el sistema de XP y niveles.',
  SETUP_ECONOMY_TITLE: '💰 Configuración de Economía',
  SETUP_ECONOMY_DESC: 'Configura el sistema de economía.',
  SETUP_GIVEAWAY_TITLE: '🎉 Configuración de Sorteos',
  SETUP_GIVEAWAY_DESC: 'Configura el sistema de sorteos.',
  SETUP_NOTIFY_TITLE: '🔔 Configuración de Notificaciones',
  SETUP_NOTIFY_DESC: 'Configura las notificaciones RSS.',
  SETUP_LANG_TITLE: '🌐 Configuración de Idioma',
  SETUP_LANG_DESC: 'Cambia el idioma del bot para este servidor.',

  FEATURE_ENABLED: 'Activado',
  FEATURE_DISABLED: 'Desactivado',
  FEATURE_TOGGLE: (name, state) => name + ' ahora está **' + state + '**.',
  FEATURE_ON: 'Activado',
  FEATURE_OFF: 'Desactivado',

  BTN_ENABLE: 'Activar',
  BTN_DISABLE: 'Desactivar',
  BTN_CONFIGURE: 'Configurar',
  BTN_BACK: 'Volver',
  BTN_DONE: 'Listo',
  BTN_ON: '🟢 SÍ',
  BTN_OFF: '🔴 NO',

  RR_SETUP_TITLE: '🎭 Configuración de Roles de Reacción',
  RR_SETUP_DESC: 'Usa los botones para configurar los roles de reacción.',
  RR_ADD_PAIR: 'Agregar Par',
  RR_REMOVE_PAIR: 'Quitar Par',
  RR_SET_CHANNEL: 'Canal',
  RR_PREVIEW: 'Vista Previa',
  RR_SEND: 'Enviar Rol de Reacción',
  RR_CANCEL: 'Cancelar',
  RR_NO_PAIRS: 'Aún no hay pares de roles.',
  RR_CHANNEL_NOT_SET: 'No configurado',
  RR_PAIRS: 'Pares de Roles',
  RR_TITLE_LABEL: 'Título',
  RR_CHANNEL_LABEL: 'Canal',
  RR_PAIRS_COUNT: (n) => '' + n,
  RR_MODAL_TITLE: 'Agregar Par de Rol',
  RR_MODAL_ROLE: 'Rol (mención o ID)',
  RR_MODAL_ROLE_PLACEHOLDER: '@Moderador o 1234567890123456789',
  RR_MODAL_EMOJI: 'Emoji (unicode o custom)',
  RR_MODAL_EMOJI_PLACEHOLDER: '🔴 o :moderator: o <a:star:123>',
  RR_ROLE_NOT_FOUND: (text) => 'No se encontró un rol que coincida con **' + text + '**.',
  RR_ROLE_TOO_HIGH: 'No puedo asignar este rol. Es igual o superior a mi rol más alto.',
  RR_INVALID_EMOJI: 'Proporcione un emoji Unicode o custom válido.',
  RR_DUPLICATE: 'Este emoji o rol ya está en la lista.',
  RR_SENT: (channel, count) =>
    'Enviado a ' + channel + ' con **' + count + '** par(es) de rol.',
  RR_DELETED: 'Mensaje de rol de reacción eliminado.',
  RR_SELECT_REMOVE: 'Selecciona los pares a quitar:',
  RR_SELECT_CHANNEL: 'Selecciona el canal para enviar el mensaje:',
  RR_EXPIRED: 'Esta interacción expiró. Ejecuta la configuración de nuevo.',
  RR_NOT_FOUND: 'No se encontró un rol de reacción con ese ID de mensaje.',

  WELCOME_TITLE: 'Bienvenido',
  WELCOME_DESC: (user, server, count) =>
    'Bienvenido a **' + server + '**, ' + user + '! Eres el miembro #' + count + '.',
  GOODBYE_TITLE: 'Adiós',
  GOODBYE_DESC: (user, server) => user + ' ha salido de **' + server + '**.',

  VERIFY_TITLE: 'Verificación Requerida',
  VERIFY_DESC: 'Haz clic en el botón para verificar.',
  VERIFY_SUCCESS: '¡Has sido verificado! Bienvenido al servidor.',
  VERIFY_FAILED: 'Error al verificar. Contacta a un moderador.',

  TICKET_TITLE: '🎫 Ticket de Soporte',
  TICKET_DESC: (user) => '¡Bienvenido ' + user + '! Describe tu problema y un miembro del personal te ayudará.',
  TICKET_CLOSED: '🔒 Ticket cerrado. Eliminando en 5s.',
  TICKET_CLAIMED: (user) => '🙋 Ticket reclamado por ' + user,

  LEVELUP_TITLE: '⭐ ¡Subiste de Nivel!',
  LEVELUP_DESC: (user, level) => '**' + user + '** alcanzó el **nivel ' + level + '**!',
  DAILY_CLAIMED: (amount) => '¡Recibiste **' + amount + '**!',
  DAILY_NEXT: (time) => 'Puedes reclamar de nuevo en **' + time + '**.',
  SHOP_EMPTY: 'La tienda está vacía.',
  SHOP_ITEM: (name, price, desc) => '**' + name + '** — ' + price + '\n' + desc,
  SHOP_PURCHASED: (name, price) => '¡Compraste **' + name + '** por ' + price + '!',
  SHOP_INSUFFICIENT: (price) => 'Necesitas **' + price + '**.',
  SHOP_ADDED: (name, price) => '**' + name + '** — ' + price,
  SHOP_REMOVED: (name) => '**' + name + '** eliminado.',
  GIVEAWAY_TITLE: '🎉 ¡Sorteo!',
  GIVEAWAY_ENDED: '🎉 Sorteo Finalizado',
  POLL_TITLE: '📊 Encuesta',

  ERR_PERMISSION: 'No tienes permiso para usar este comando.',
  ERR_DISABLED: 'Esta función no está habilitada.',
  ERR_NOT_FOUND: 'No encontrado.',
  ERR_INVALID_USAGE: 'Uso inválido.',
  ERR_CHANNEL_NOT_FOUND: 'Canal no encontrado.',
  ERR_ROLE_NOT_FOUND: 'Rol no encontrado.',
  ERR_SELF_ACTION: 'No puedes realizar esta acción en ti mismo.',

  LANG_CHANGED: (lang) => 'Idioma configurado a **' + lang + '**.',
  LANG_SUPPORTED: (list) => 'Idiomas soportados: ' + list,
};

module.exports = es;
