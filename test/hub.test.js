// -----------------------------------------------------------------------------
// The hub against the fake RomM: what each reading publishes, the scene events
// (once, and never for what was there before), a restart, the container's own
// timer, the scan, the scene actions and "Test the connection".
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import {
  BASIC_CONFIG,
  CONFIG,
  FakeRomm,
  PASSWORD,
  USERNAME,
  createClock,
  createWorld,
  defaultRomm,
  serverDevice,
  serverFeature,
} from './helpers/world.js';

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

const events = (w, key) => w.fake.sceneEvents.filter((event) => event.key === key);
const state = (w, key) => w.fake.lastState(serverFeature(w.gladys, key));

test('the first reading publishes the figures and announces nothing', async (t) => {
  const w = await world(t);
  assert.deepEqual(w.fake.sceneEvents, []);
  assert.equal(state(w, 'online'), 1);
  assert.equal(state(w, 'platforms'), 3);
  assert.equal(state(w, 'games'), 3);
  assert.equal(state(w, 'library_size'), 0);
  assert.equal(state(w, 'unidentified'), 2);
  assert.equal(state(w, 'last_game'), 'Test Cart (Super Nintendo Entertainment System)');
  assert.deepEqual(
    w.hub.recent().map((rom) => rom.name),
    ['Test Cart', 'Another World Homebrew', 'Alter Ego'],
  );
  assert.deepEqual(w.fake.connectionStatus, { connected: true });
  assert.deepEqual(w.fake.transports, [
    { device_external_id: serverDevice(w.gladys), transport: DEVICE_TRANSPORTS.LOCAL },
  ]);
  const device = w.fake.discoveredDevices[0];
  assert.equal(device.name, 'RomM 192.0.2.30:8080');
  assert.equal(device.should_poll, false);
  const auth = w.romm.requests.find((r) => r.path === '/api/stats').headers.authorization;
  assert.match(auth, /^Bearer rmm_/);
  assert.equal(
    w.romm.requests.find((r) => r.path === '/api/heartbeat').headers.authorization,
    undefined,
    'the heartbeat is read without credentials',
  );
});

test('a username and password sign in with HTTP Basic', async (t) => {
  const w = await world(t, { config: BASIC_CONFIG });
  const auth = w.romm.requests.find((r) => r.path === '/api/stats').headers.authorization;
  assert.equal(auth, `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')}`);
  assert.deepEqual(w.fake.connectionStatus, { connected: true });
});

test('a new game fires game_added once, with its details', async (t) => {
  const w = await world(t);
  w.clock.advance(60_000);
  w.romm.add('Micro Mages', 'nes', { identified: true });
  await w.hub.pollAll();
  await w.hub.pollAll();
  const fired = events(w, 'game_added');
  assert.equal(fired.length, 1);
  assert.deepEqual(fired[0].data, {
    name: 'Micro Mages',
    platform: 'Nintendo Entertainment System',
    file: 'Micro Mages.nes',
    url: 'http://192.0.2.30:8080/rom/4',
    games: 4,
  });
  assert.equal(state(w, 'games'), 4);
  assert.equal(state(w, 'last_game'), 'Micro Mages (Nintendo Entertainment System)');
});

test('several games at once are announced oldest first', async (t) => {
  const w = await world(t);
  for (const name of ['One', 'Two', 'Three']) {
    w.romm.add(name, 'gba');
  }
  await w.hub.pollAll();
  assert.deepEqual(
    events(w, 'game_added').map((event) => event.data.name),
    ['One', 'Two', 'Three'],
  );
});

test('a game RomM is still identifying waits for its final name (30 minutes at most)', async (t) => {
  const w = await world(t);
  const id = w.romm.add('alter_ego_v1', 'nes', { identifying: true });
  w.romm.add('Stuck', 'snes', { identifying: true });
  await w.hub.pollAll();
  assert.deepEqual(events(w, 'game_added'), []);
  const rom = w.romm.roms.find((item) => item.id === id);
  Object.assign(rom, { name: 'Alter Ego (2021)', identifying: false, identified: true });
  await w.hub.pollAll();
  assert.deepEqual(
    events(w, 'game_added').map((event) => event.data.name),
    ['Alter Ego (2021)'],
  );
  w.clock.advance(30 * 60_000);
  await w.hub.pollAll();
  assert.deepEqual(
    events(w, 'game_added').map((event) => event.data.name),
    ['Alter Ego (2021)', 'Stuck'],
  );
});

test('a finished scan fires scan_finished once; the scans already there are not news', async (t) => {
  const w = await world(t);
  const id = w.romm.scanTask({ status: 'started', name: 'Complete Scan' });
  await w.hub.pollAll();
  assert.deepEqual(events(w, 'scan_finished'), []);
  assert.deepEqual(w.hub.currentScan(), { waiting: false, done: 2, total: 3 });
  w.clock.advance(5 * 60_000);
  w.romm.finish(id, { new_roms: 2, identified_roms: 1, scanned_roms: 3 });
  await w.hub.pollAll();
  await w.hub.pollAll();
  const fired = events(w, 'scan_finished');
  assert.equal(fired.length, 1);
  assert.deepEqual(fired[0].data, {
    scan: 'Complete Scan',
    new_games: 2,
    identified_games: 1,
    scanned_games: 3,
    games: 3,
    duration_minutes: 7,
  });
  assert.equal(w.hub.currentScan(), null);
});

test('a failed scan fires nothing', async (t) => {
  const w = await world(t);
  w.romm.scanTask({ status: 'failed' });
  await w.hub.pollAll();
  assert.deepEqual(events(w, 'scan_finished'), []);
});

test('an account that cannot read the tasks: games are read, no scan event', async (t) => {
  const romm = defaultRomm({ admin: false });
  const w = await world(t, { romm });
  assert.deepEqual(w.fake.connectionStatus, { connected: true });
  assert.equal(state(w, 'games'), 3);
  romm.add('New', 'nes');
  await w.hub.pollAll();
  assert.equal(events(w, 'game_added').length, 1);
  const report = await w.hub.testConnection();
  assert.match(report.en, /scans not visible/);
  // The account becomes admin: the scans already finished are not news.
  romm.admin = true;
  await w.hub.pollAll();
  assert.deepEqual(events(w, 'scan_finished'), []);
});

test('a restart announces nothing twice', async (t) => {
  const romm = defaultRomm();
  const clock = createClock();
  const first = await world(t, { romm, clock });
  romm.add('Before restart', 'nes');
  romm.scanTask({ status: 'finished' });
  await first.hub.pollAll();
  assert.equal(events(first, 'game_added').length, 1);
  assert.equal(events(first, 'scan_finished').length, 1);
  await first.app.stop();
  const second = await world(t, { romm, clock, dataDir: first.dataDir });
  await second.hub.pollAll();
  assert.deepEqual(second.fake.sceneEvents, []);
  romm.add('After restart', 'nes');
  await second.hub.pollAll();
  assert.deepEqual(
    events(second, 'game_added').map((event) => event.data.name),
    ['After restart'],
  );
});

test('an empty library: its first game is news', async (t) => {
  const romm = new FakeRomm();
  const w = await world(t, { romm });
  assert.equal(state(w, 'games'), 0);
  assert.equal(state(w, 'last_game'), undefined, 'no empty text published');
  romm.add('First', 'nes');
  await w.hub.pollAll();
  assert.equal(events(w, 'game_added').length, 1);
});

test('a server down: offline, its figures not republished; back: restored', async (t) => {
  const w = await world(t);
  const before = w.fake.states.length;
  w.romm.online = false;
  await w.hub.pollAll();
  assert.equal(state(w, 'online'), 0);
  assert.equal(w.fake.states.length, before + 1, 'only the online feature');
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.match(w.fake.connectionStatus.message.en, /does not answer/);
  assert.equal(typeof w.fake.connectionStatus.message.es, 'string', 'the four languages');
  assert.equal(w.fake.transports.at(-1).transport, DEVICE_TRANSPORTS.UNREACHABLE);
  w.romm.online = true;
  await w.hub.pollAll();
  assert.equal(state(w, 'online'), 1);
  assert.deepEqual(w.fake.connectionStatus, { connected: true });
});

test('refused credentials, no credentials, no address: explained in the status', async (t) => {
  const refused = await world(t, { config: { ...CONFIG, token: 'rmm_wrong' } });
  assert.match(refused.fake.connectionStatus.message.en, /refused the sign-in/);
  const none = await world(t, { config: { url: '192.0.2.30', username: 'admin' } });
  assert.match(none.fake.connectionStatus.message.de, /Benutzername und Passwort/);
  assert.deepEqual(none.fake.discoveredDevices, []);
  const empty = await world(t, { config: {} });
  assert.match(empty.fake.connectionStatus.message.fr, /adresse/);
});

test('the device is re-sent on onDeviceCreated, with every state', async (t) => {
  const w = await world(t);
  const before = w.fake.states.length;
  await w.fake.deviceCreated(w.fake.discoveredDevices[0]);
  assert.ok(w.fake.states.length >= before + 6);
  assert.ok(w.fake.widgetRefreshes.includes('library'));
});

test('an unchanged value is republished after 12 hours (heartbeat)', async (t) => {
  const w = await world(t);
  const count = () => w.fake.states.filter((s) => s.device_feature_external_id.endsWith(':games'));
  const before = count().length;
  await w.hub.pollAll();
  assert.equal(count().length, before);
  w.clock.advance(12 * 60 * 60_000);
  await w.hub.pollAll();
  assert.equal(count().length, before + 1);
});

test("the container's own timer reads RomM (no onPoll needed)", async (t) => {
  const w = await world(t, { timers: true });
  w.hub.config.pollIntervalMs = 20;
  w.hub.schedulePoll();
  const reads = () => w.romm.requests.filter((r) => r.path === '/api/stats').length;
  const start = reads();
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.ok(reads() > start, 'the timer read again');
});

test('scan_library starts the scan of the chosen type; refusals are explained', async (t) => {
  const w = await world(t);
  let ack = await w.fake.sceneAction('scan_library', {});
  assert.equal(ack.success, true, ack.error);
  assert.equal(w.romm.lastScan, 'quick');
  ack = await w.fake.sceneAction('scan_library', { type: 'complete' });
  assert.equal(ack.success, false, 'a scan is already running');
  assert.match(ack.error, /already running/);
  w.romm.tasks = [];
  ack = await w.fake.sceneAction('scan_library', { type: 'unmatched' });
  assert.equal(ack.success, true, ack.error);
  assert.equal(w.romm.lastScan, 'unmatched');

  const user = await world(t, { romm: defaultRomm({ admin: false }) });
  ack = await user.fake.sceneAction('scan_library', {});
  assert.match(ack.error, /admin account/);
  const old = await world(t, { romm: defaultRomm({ version: '5.3.2' }) });
  ack = await old.fake.sceneAction('scan_library', {});
  assert.match(ack.error, /RomM 5\.4/);
});

test('read_latest: the sentence and the figures, in the configured language', async (t) => {
  const w = await world(t, { config: { ...CONFIG, language: 'fr' } });
  const ack = await w.fake.sceneAction('read_latest', { count: '1' });
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(ack.data.outputs, {
    summary:
      'RomM : 3 jeux sur 3 plateformes. Derniers ajouts : Test Cart (Super Nintendo Entertainment System).',
    games: 3,
    platforms: 3,
    unidentified: 2,
    last_name: 'Test Cart',
    last_platform: 'Super Nintendo Entertainment System',
  });
  w.romm.online = false;
  const down = await w.fake.sceneAction('read_latest', {});
  assert.equal(down.data.outputs.summary, 'RomM ne répond pas.');
  assert.equal(down.data.outputs.games, 0);
});

test('Test the connection: a report in four languages', async (t) => {
  const w = await world(t);
  const ack = await w.fake.action('test_connection', {});
  assert.equal(ack.success, true, ack.error);
  const report = await w.hub.testConnection();
  assert.equal(report.en, 'OK, RomM 5.4.1, 3 game(s) (0 GB), 3 platform(s), 2 without metadata');
  assert.equal(report.fr, 'OK, RomM 5.4.1, 3 jeu(x) (0 Go), 3 plateforme(s), 2 sans métadonnées');
  w.romm.online = false;
  const down = await w.hub.testConnection();
  assert.match(down.de, /antwortet nicht/);
});
