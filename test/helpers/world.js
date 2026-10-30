// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake RomM on a fake network,
// a temporary /data and a manual clock, with the integration wired on top
// through registerHandlers. No timer runs unless `timers: true`: the tests
// read RomM with `world.hub.pollAll()`.
// -----------------------------------------------------------------------------

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';
import { FakeRomm, PASSWORD, TOKEN, USERNAME, createNetwork } from './fakeRomm.js';

process.env.LOG_LEVEL ??= 'silent';
process.env.TZ = 'Europe/Paris';

export const ROMM_URL = 'http://192.0.2.30:8080';

/** A manual clock, the day of the real captures. */
export function createClock(start = Date.parse('2026-10-30T13:00:00+01:00')) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

export const CONFIG = { url: '192.0.2.30', token: TOKEN, language: 'en' };
export const BASIC_CONFIG = { url: '192.0.2.30', username: USERNAME, password: PASSWORD };

/** A RomM with three homebrew games on three platforms, one identified, one finished scan. */
export function defaultRomm(options) {
  const romm = new FakeRomm(options);
  romm.add('Alter Ego', 'nes', { identified: true });
  romm.add('Another World Homebrew', 'gba');
  romm.add('Test Cart', 'snes');
  romm.scanTask({ status: 'finished', stats: { new_roms: 3, scanned_roms: 3 } });
  return romm;
}

/**
 * @param {object} [options]
 * @param {FakeRomm} [options.romm]
 * @param {object} [options.config] raw integration config
 */
export async function createWorld({
  clock = createClock(),
  romm = defaultRomm(),
  config = CONFIG,
  devices = [],
  connect = true,
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-romm-')),
  timings = {},
  timers = false,
} = {}) {
  romm.now = clock.now;
  const network = createNetwork({ [ROMM_URL]: romm });
  const gladys = createFakeGladys({ config, devices });
  const app = registerHandlers(gladys, {
    store: new Store(dataDir),
    request: network.request,
    timers,
    timings,
    now: clock.now,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
  }
  return { gladys, fake: gladys.fake, network, romm, app, hub: app.hub, clock, dataDir };
}

export const serverDevice = (gladys) => gladys.externalIds('server', 'main').device;
export const serverFeature = (gladys, key) => gladys.externalIds('server', 'main').feature(key);

export { FakeRomm, PASSWORD, TOKEN, USERNAME };
