// -----------------------------------------------------------------------------
// Scene action handlers (manifest `scene_actions`, Gladys 5.1+).
//
// `scan_library`: start a scan of the RomM library (new games only, games
// without metadata, or the whole library); `scan_finished` fires once it is
// over. Needs RomM 5.4 and an admin account (or a token with "Run tasks").
// `read_latest`: read RomM now and give a sentence for a message or a voice
// announcement (size of the library, latest games added), and the figures
// separately for the conditions of the scene. Read only.
// -----------------------------------------------------------------------------

import { LATEST_SIZE, SCAN_TYPES } from './romm/client.js';

export const DEFAULT_SCAN_TYPE = 'quick';
export const LATEST_COUNTS = ['1', '3', '5', '10'];
export const DEFAULT_LATEST_COUNT = '3';

export const SCENE_ACTIONS = {
  async scan_library(hub, { fields = {} }) {
    const type = SCAN_TYPES.includes(fields.type) ? fields.type : DEFAULT_SCAN_TYPE;
    await hub.scan(type);
    return {};
  },

  async read_latest(hub, { fields = {} }) {
    hub.ensureServer();
    // Read now: the sentence says what is true at the time of the scene.
    await hub.refresh();
    const raw = String(fields.count ?? DEFAULT_LATEST_COUNT);
    const count = Math.min(
      Number(LATEST_COUNTS.includes(raw) ? raw : DEFAULT_LATEST_COUNT),
      LATEST_SIZE,
    );
    const totals = hub.server.reachable ? hub.totals() : null;
    const last = hub.server.reachable ? hub.recent()[0] : null;
    return {
      summary: hub.summary(count),
      games: totals?.games ?? 0,
      platforms: totals?.platforms ?? 0,
      unidentified: totals?.unidentified ?? 0,
      last_name: last?.name ?? '',
      last_platform: last?.platform ?? '',
    };
  },
};
