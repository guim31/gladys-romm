// -----------------------------------------------------------------------------
// The Gladys device of a RomM server (`server:main`): online, platforms,
// games, size of the library, games without metadata, and the last game added
// (text).
//
// Feature category/type couples come from the core table (see
// test/gladys-rules.test.js). should_poll: false: the hub reads RomM on its
// own timer (src/hub.js), at the interval chosen in the configuration.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { hostOf } from './config.js';

export const DEVICE_TYPE = 'server';
export const SERVER_ID = 'main';
export const URL_PARAM = 'ROMM_URL';

// Suffixes of the feature external ids: permanent once published.
export const FEATURE_KEYS = Object.freeze({
  ONLINE: 'online',
  PLATFORMS: 'platforms',
  GAMES: 'games',
  LIBRARY_SIZE: 'library_size',
  UNIDENTIFIED: 'unidentified',
  LAST_GAME: 'last_game',
});

const K = FEATURE_KEYS;

// Feature names per language (Gladys does not tell a device integration the
// user's language). Frozen at creation in Gladys.
export const NAMES = {
  en: {
    [K.ONLINE]: 'Online',
    [K.PLATFORMS]: 'Platforms',
    [K.GAMES]: 'Games',
    [K.LIBRARY_SIZE]: 'Library size',
    [K.UNIDENTIFIED]: 'Games without metadata',
    [K.LAST_GAME]: 'Last game added',
  },
  fr: {
    [K.ONLINE]: 'En ligne',
    [K.PLATFORMS]: 'Plateformes',
    [K.GAMES]: 'Jeux',
    [K.LIBRARY_SIZE]: 'Taille de la bibliothèque',
    [K.UNIDENTIFIED]: 'Jeux sans métadonnées',
    [K.LAST_GAME]: 'Dernier jeu ajouté',
  },
  de: {
    [K.ONLINE]: 'Online',
    [K.PLATFORMS]: 'Plattformen',
    [K.GAMES]: 'Spiele',
    [K.LIBRARY_SIZE]: 'Größe der Bibliothek',
    [K.UNIDENTIFIED]: 'Spiele ohne Metadaten',
    [K.LAST_GAME]: 'Zuletzt hinzugefügtes Spiel',
  },
  es: {
    [K.ONLINE]: 'En línea',
    [K.PLATFORMS]: 'Plataformas',
    [K.GAMES]: 'Juegos',
    [K.LIBRARY_SIZE]: 'Tamaño de la biblioteca',
    [K.UNIDENTIFIED]: 'Juegos sin metadatos',
    [K.LAST_GAME]: 'Último juego añadido',
  },
};

// Display bounds (the core never applies them on write).
const COUNTER_MAX = 10_000_000;
const SIZE_MAX_GB = 1_000_000;

const sensor = (category, type, extra = {}) => ({
  category,
  type,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  ...extra,
});

const DEFINITIONS = {
  online: sensor(DEVICE_FEATURE_CATEGORIES.INPUT, DEVICE_FEATURE_TYPES.SENSOR.BINARY, {
    min: 0,
    max: 1,
  }),
  counter: sensor(DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR, DEVICE_FEATURE_TYPES.SENSOR.INTEGER, {
    min: 0,
    max: COUNTER_MAX,
  }),
  size: sensor(DEVICE_FEATURE_CATEGORIES.DATA, DEVICE_FEATURE_TYPES.DATA.SIZE, {
    unit: DEVICE_FEATURE_UNITS.GIGABYTE,
    min: 0,
    max: SIZE_MAX_GB,
  }),
  text: sensor(DEVICE_FEATURE_CATEGORIES.TEXT, DEVICE_FEATURE_TYPES.TEXT.TEXT, {
    keep_history: false,
    min: 0,
    max: 0,
  }),
};

// Order = display order in Gladys. `value` reads the snapshot of the hub.
const FEATURES = [
  { key: K.ONLINE, definition: 'online', value: (s) => bit(s.reachable) },
  { key: K.PLATFORMS, definition: 'counter', value: (s) => s.platforms },
  { key: K.GAMES, definition: 'counter', value: (s) => s.games },
  { key: K.LIBRARY_SIZE, definition: 'size', value: (s) => s.sizeGb },
  { key: K.UNIDENTIFIED, definition: 'counter', value: (s) => s.unidentified },
  { key: K.LAST_GAME, definition: 'text', value: (s) => s.lastGame || null },
];

function bit(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return value ? 1 : 0;
}

/** Bytes to gigabytes (10^9), two decimals. */
export const toGigabytes = (bytes) => Math.round(bytes / 1e7) / 100;

export const serverIds = (gladys) => gladys.externalIds(DEVICE_TYPE, SERVER_ID);

/** The server device. */
export function buildServer(gladys, config) {
  const ids = serverIds(gladys);
  const names = NAMES[config.language] ?? NAMES.en;
  return {
    name: `RomM ${hostOf(config.url)}`.slice(0, 60),
    external_id: ids.device,
    should_poll: false,
    params: [{ name: URL_PARAM, value: config.url }],
    features: FEATURES.map(({ key, definition }) => ({
      ...DEFINITIONS[definition],
      name: names[key],
      external_id: ids.feature(key),
    })),
  };
}

/**
 * The value of every feature (null: nothing to publish).
 * @returns {Array<{ key: string, externalId: string, value: number|string|null, text: boolean }>}
 */
export function featureValues(ids, snapshot) {
  return FEATURES.map(({ key, definition, value }) => {
    const read = value(snapshot);
    return {
      key,
      externalId: ids.feature(key),
      value: read === undefined ? null : read,
      text: definition === 'text',
    };
  });
}
