// -----------------------------------------------------------------------------
// Texts the integration sends to Gladys outside the widget (src/widgets.js):
// connection status, errors, the "Test the connection" report, the command
// messages, the scan in progress and the sentence of the scene action. Four
// languages, the four of the Gladys interface; German says "du", Spanish
// "usted". test/i18n.test.js checks every table.
// -----------------------------------------------------------------------------

import { ERROR_KINDS } from './romm/client.js';

export const pick = (text, language) => text?.[language] ?? text?.en ?? '';

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
  de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

export const CONNECTION_TEXT = {
  noServer: {
    en: 'Enter the address of your RomM server in the configuration.',
    fr: "Saisissez l'adresse de votre serveur RomM dans la configuration.",
    de: 'Gib die Adresse deines RomM-Servers in der Konfiguration ein.',
    es: 'Introduzca la dirección de su servidor RomM en la configuración.',
  },
  invalid: {
    en: 'The address of the RomM server is not valid (e.g. http://192.168.1.2:8080).',
    fr: "L'adresse du serveur RomM n'est pas valide (ex. http://192.168.1.2:8080).",
    de: 'Die Adresse des RomM-Servers ist ungültig (z. B. http://192.168.1.2:8080).',
    es: 'La dirección del servidor RomM no es válida (p. ej. http://192.168.1.2:8080).',
  },
  noCredentials: {
    en: 'Enter a RomM client API token, or a username and password, in the configuration.',
    fr: "Saisissez un jeton d'API client RomM, ou un identifiant et un mot de passe, dans la configuration.",
    de: 'Gib ein Client-API-Token von RomM oder Benutzername und Passwort in der Konfiguration ein.',
    es: 'Introduzca un token de API de cliente de RomM, o un usuario y una contraseña, en la configuración.',
  },
};

// One explanation per error kind (src/romm/client.js).
export const ERROR_TEXT = {
  [ERROR_KINDS.UNREACHABLE]: {
    en: 'RomM does not answer: check the address and the port (8080).',
    fr: "RomM ne répond pas : vérifiez l'adresse et le port (8080).",
    de: 'RomM antwortet nicht: Prüfe die Adresse und den Port (8080).',
    es: 'RomM no responde: compruebe la dirección y el puerto (8080).',
  },
  [ERROR_KINDS.TLS]: {
    en: 'Certificate refused: use the http:// address on your network.',
    fr: 'Certificat refusé : utilisez l’adresse en http:// de votre réseau.',
    de: 'Zertifikat abgelehnt: Verwende die http://-Adresse in deinem Netzwerk.',
    es: 'Certificado rechazado: use la dirección http:// de su red.',
  },
  [ERROR_KINDS.AUTH]: {
    en: 'RomM refused the sign-in: check the client API token, or the username and password.',
    fr: "RomM a refusé la connexion : vérifiez le jeton d'API client, ou l'identifiant et le mot de passe.",
    de: 'RomM hat die Anmeldung abgelehnt: Prüfe das Client-API-Token oder Benutzername und Passwort.',
    es: 'RomM ha rechazado el acceso: compruebe el token de API de cliente, o el usuario y la contraseña.',
  },
  [ERROR_KINDS.FORBIDDEN]: {
    en: 'This account cannot read the games: give the token the scopes "View ROMs" and "View platforms".',
    fr: 'Ce compte ne peut pas lire les jeux : donnez au jeton les droits « View ROMs » et « View platforms ».',
    de: 'Dieses Konto kann die Spiele nicht lesen: Gib dem Token die Rechte „View ROMs“ und „View platforms“.',
    es: 'Esta cuenta no puede leer los juegos: dé al token los permisos «View ROMs» y «View platforms».',
  },
  [ERROR_KINDS.NOT_ADMIN]: {
    en: 'A scan needs an admin account, or a token with the scope "Run tasks".',
    fr: 'Un scan demande un compte administrateur, ou un jeton avec le droit « Run tasks ».',
    de: 'Ein Scan braucht ein Admin-Konto oder ein Token mit dem Recht „Run tasks“.',
    es: 'Un escaneo requiere una cuenta de administrador, o un token con el permiso «Run tasks».',
  },
  [ERROR_KINDS.NOT_ROMM]: {
    en: 'No RomM at this address (port 8080 by default).',
    fr: 'Aucun RomM à cette adresse (port 8080 par défaut).',
    de: 'Kein RomM unter dieser Adresse (standardmäßig Port 8080).',
    es: 'No hay ningún RomM en esta dirección (puerto 8080 por defecto).',
  },
  [ERROR_KINDS.SCAN_UNSUPPORTED]: {
    en: 'Starting a scan from Gladys needs RomM 5.4 or later.',
    fr: 'Lancer un scan depuis Gladys demande RomM 5.4 ou plus récent.',
    de: 'Einen Scan aus Gladys zu starten braucht RomM 5.4 oder neuer.',
    es: 'Iniciar un escaneo desde Gladys requiere RomM 5.4 o posterior.',
  },
  [ERROR_KINDS.SCAN_RUNNING]: {
    en: 'A scan is already running in RomM.',
    fr: 'Un scan est déjà en cours dans RomM.',
    de: 'In RomM läuft bereits ein Scan.',
    es: 'Ya hay un escaneo en curso en RomM.',
  },
  [ERROR_KINDS.REDIRECT]: {
    en: 'The address redirects (a login page?): enter the direct address of RomM.',
    fr: "L'adresse redirige (page de connexion ?) : saisissez l'adresse directe de RomM.",
    de: 'Die Adresse leitet um (Anmeldeseite?): Gib die direkte Adresse von RomM ein.',
    es: 'La dirección redirige (¿página de acceso?): introduzca la dirección directa de RomM.',
  },
  [ERROR_KINDS.HTTP]: {
    en: 'Unexpected answer from RomM, see the logs of the integration.',
    fr: "Réponse inattendue de RomM, voir les logs de l'intégration.",
    de: 'Unerwartete Antwort von RomM, sieh in den Protokollen der Integration nach.',
    es: 'Respuesta inesperada de RomM, consulte los registros de la integración.',
  },
};

// Messages of the commands (widget button, scene action).
export const ACTION_TEXT = {
  scanStarted: {
    en: 'Scan of the RomM library started.',
    fr: 'Scan de la bibliothèque RomM lancé.',
    de: 'Scan der RomM-Bibliothek gestartet.',
    es: 'Escaneo de la biblioteca de RomM iniciado.',
  },
};

// The scan in progress (widget): "Scan: 120/450 games".
export const SCAN_TEXT = {
  en: { label: 'Scan', progress: (done, total) => `${done}/${total} games`, waiting: 'Queued' },
  fr: { label: 'Scan', progress: (done, total) => `${done}/${total} jeux`, waiting: 'En attente' },
  de: { label: 'Scan', progress: (done, total) => `${done}/${total} Spiele`, waiting: 'Wartet' },
  es: {
    label: 'Escaneo',
    progress: (done, total) => `${done}/${total} juegos`,
    waiting: 'En cola',
  },
};

const decimal = (value) => String(value).replace('.', ',');

// The "Test the connection" report.
export const REPORT_TEXT = {
  en: {
    ok: (version) => (version ? `OK, RomM ${version}` : 'OK, RomM'),
    games: (count, gb) => `${count} game(s) (${gb} GB)`,
    platforms: (count) => `${count} platform(s)`,
    unidentified: (count) => `${count} without metadata`,
    noTasks: 'scans not visible (not an admin)',
  },
  fr: {
    ok: (version) => (version ? `OK, RomM ${version}` : 'OK, RomM'),
    games: (count, gb) => `${count} jeu(x) (${decimal(gb)} Go)`,
    platforms: (count) => `${count} plateforme(s)`,
    unidentified: (count) => `${count} sans métadonnées`,
    noTasks: 'scans non visibles (pas administrateur)',
  },
  de: {
    ok: (version) => (version ? `OK, RomM ${version}` : 'OK, RomM'),
    games: (count, gb) => `${count} Spiel(e) (${decimal(gb)} GB)`,
    platforms: (count) => `${count} Plattform(en)`,
    unidentified: (count) => `${count} ohne Metadaten`,
    noTasks: 'Scans nicht sichtbar (kein Admin)',
  },
  es: {
    ok: (version) => (version ? `OK, RomM ${version}` : 'OK, RomM'),
    games: (count, gb) => `${count} juego(s) (${decimal(gb)} GB)`,
    platforms: (count) => `${count} plataforma(s)`,
    unidentified: (count) => `${count} sin metadatos`,
    noTasks: 'escaneos no visibles (no es administrador)',
  },
};

// The sentence of the "Read the latest games" scene action.
export const SUMMARY_TEXT = {
  en: {
    colon: ': ',
    games: (count, platforms) =>
      `${count} game${count === 1 ? '' : 's'} on ${platforms} platform${platforms === 1 ? '' : 's'}`,
    latest: 'latest added',
    game: (name, platform) => `${name} (${platform})`,
    none: 'no game yet',
    down: 'RomM does not answer.',
  },
  fr: {
    colon: ' : ',
    games: (count, platforms) =>
      `${count} jeu${count > 1 ? 'x' : ''} sur ${platforms} plateforme${platforms > 1 ? 's' : ''}`,
    latest: 'derniers ajouts',
    game: (name, platform) => `${name} (${platform})`,
    none: 'aucun jeu pour le moment',
    down: 'RomM ne répond pas.',
  },
  de: {
    colon: ': ',
    games: (count, platforms) =>
      `${count} Spiel${count === 1 ? '' : 'e'} auf ${platforms} Plattform${platforms === 1 ? '' : 'en'}`,
    latest: 'zuletzt hinzugefügt',
    game: (name, platform) => `${name} (${platform})`,
    none: 'noch kein Spiel',
    down: 'RomM antwortet nicht.',
  },
  es: {
    colon: ': ',
    games: (count, platforms) =>
      `${count} juego${count === 1 ? '' : 's'} en ${platforms} plataforma${platforms === 1 ? '' : 's'}`,
    latest: 'últimos añadidos',
    game: (name, platform) => `${name} (${platform})`,
    none: 'todavía ningún juego',
    down: 'RomM no responde.',
  },
};
