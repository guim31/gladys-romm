// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `library`.
//
// The use case: what arrived in the game library, at a glance on the wall
// tablet, and a scan started from the sofa after copying games to the NAS.
// Three tiles (games, platforms, games without metadata), the scan in progress
// as a status row, the latest games added as a list (name, platform, date),
// and a "Scan" button (new games only).
//
// Settings: how many games in the list (8 at most, the limit of a list in
// the core), and a switch for the
// tiles and for the button each.
//
// Budget (8 components, 6 tiles, 1 status, 1 focal, 4 buttons, 2 texts):
// three tiles, one status, one list, one button. The figures are sent as
// values, not bound to device features, so the widget works before the
// device is added to Gladys.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { ERROR_KINDS, WIDGET_KEY } from './hub.js';
import { LATEST_SIZE } from './romm/client.js';
import { CONNECTION_TEXT, ERROR_TEXT, SCAN_TEXT, pick } from './texts.js';

// Action key of the button: permanent once published.
export const ACTIONS = Object.freeze({
  SCAN: 'scan',
});

// Widget settings (manifest `widgets[].settings`): permanent once published.
export const LIST_SIZES = ['3', '5', '8'];
export const DEFAULT_LIST_SIZE = '5';

export const TEXT = {
  waiting: {
    en: 'Waiting for the first reading of RomM…',
    fr: 'En attente de la première lecture de RomM…',
    de: 'Warte auf die erste Abfrage von RomM…',
    es: 'Esperando la primera lectura de RomM…',
  },
  none: {
    en: 'No game in the library yet.',
    fr: 'Aucun jeu dans la bibliothèque pour le moment.',
    de: 'Noch kein Spiel in der Bibliothek.',
    es: 'Todavía no hay ningún juego en la biblioteca.',
  },
  games: { en: 'Games', fr: 'Jeux', de: 'Spiele', es: 'Juegos' },
  platforms: { en: 'Platforms', fr: 'Plateformes', de: 'Plattformen', es: 'Plataformas' },
  unidentified: {
    en: 'No metadata',
    fr: 'Sans métadonnées',
    de: 'Ohne Metadaten',
    es: 'Sin metadatos',
  },
  offline: { en: 'Offline', fr: 'Hors ligne', de: 'Offline', es: 'Sin conexión' },
  problem: { en: 'Error', fr: 'Erreur', de: 'Fehler', es: 'Error' },
  scan: { en: 'Scan', fr: 'Scanner', de: 'Scannen', es: 'Escanear' },
};

const t = (text, language) => pick(text, language);
const fit = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

function message(text, language) {
  return {
    ttl_seconds: 300,
    components: [{ type: 'text', variant: 'body', text: fit(t(text, language), 300) }],
  };
}

/** One row of the list: name, platform, date it was added. */
export function gameItem(rom) {
  const item = { title: fit(rom.name || '…', 60) };
  if (rom.platform) {
    item.subtitle = fit(rom.platform, 60);
  }
  const date = rom.created ? new Date(rom.created) : null;
  if (date && Number.isFinite(date.getTime())) {
    item.date = date.toISOString();
  }
  return item;
}

async function get(hub, { settings = {}, language = 'en' } = {}) {
  if (!hub.client) {
    return message(hub.connectionStatus().message ?? CONNECTION_TEXT.noServer, language);
  }
  if (hub.error) {
    const unreachable = hub.error.kind === ERROR_KINDS.UNREACHABLE;
    return {
      ttl_seconds: 120,
      components: [
        {
          type: 'status',
          items: [
            {
              label: 'RomM',
              icon: 'alert-triangle',
              value: fit(t(unreachable ? TEXT.offline : TEXT.problem, language), 40),
              color: WIDGET_COLORS.DANGER,
            },
          ],
        },
        { type: 'text', variant: 'body', text: fit(t(ERROR_TEXT[hub.error.kind], language), 300) },
      ],
    };
  }
  const totals = hub.totals();
  if (!hub.server.reachable || !totals) {
    return message(TEXT.waiting, language);
  }
  const components = [];
  if (settings.show_figures !== false) {
    components.push(
      { type: 'value', value: totals.games, label: t(TEXT.games, language), icon: 'disc' },
      {
        type: 'value',
        value: totals.platforms,
        label: t(TEXT.platforms, language),
        icon: 'monitor',
      },
      {
        type: 'value',
        value: totals.unidentified,
        label: t(TEXT.unidentified, language),
        icon: 'help-circle',
        color: totals.unidentified ? WIDGET_COLORS.WARNING : WIDGET_COLORS.NEUTRAL,
      },
    );
  }
  const scan = hub.scanLine(language);
  if (scan) {
    components.push({
      type: 'status',
      items: [
        {
          label: (SCAN_TEXT[language] ?? SCAN_TEXT.en).label,
          icon: 'refresh-cw',
          value: fit(scan, 40),
          color: WIDGET_COLORS.PRIMARY,
        },
      ],
    });
  }
  const size = Math.min(
    Number(LIST_SIZES.includes(String(settings.count)) ? settings.count : DEFAULT_LIST_SIZE),
    LATEST_SIZE,
  );
  const games = hub.recent().slice(0, size);
  components.push(
    games.length
      ? { type: 'card-list', display: 'list', items: games.map(gameItem) }
      : { type: 'text', variant: 'body', text: t(TEXT.none, language) },
  );
  if (settings.show_scan_button !== false) {
    components.push({
      type: 'button',
      label: t(TEXT.scan, language),
      icon: 'search',
      style: 'secondary',
      action: { key: ACTIONS.SCAN },
    });
  }
  // Short while a scan runs: its progress moves.
  return { ttl_seconds: scan ? 30 : 300, components };
}

async function action(hub, { actionKey, language }) {
  if (actionKey === ACTIONS.SCAN) {
    return hub.scan('quick', language);
  }
  throw new Error(`Unknown action ${actionKey}`);
}

export const WIDGETS = {
  [WIDGET_KEY]: { get, action },
};
