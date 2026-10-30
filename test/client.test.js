// -----------------------------------------------------------------------------
// The client against the answers recorded from a real RomM 5.4.1
// (test/fixtures/romm/): one reading, the error kinds (the real FastAPI
// bodies), the scan and its refusals, the parsing of games and tasks.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ERROR_KINDS, RommClient, parseRom, parseTask } from '../src/romm/client.js';
import { fixture } from './helpers/fakeRomm.js';

const json = (status, body) => ({
  status,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const LIST = 'with_char_index=false&with_filter_values=false&with_rom_id_index=false';

/** A RomM answering the recorded fixtures. */
function recorded(overrides = {}) {
  const routes = {
    '/api/heartbeat': fixture('heartbeat'),
    '/api/stats': fixture('stats'),
    [`/api/roms?order_by=id&order_dir=desc&limit=10&${LIST}`]: fixture('roms'),
    [`/api/roms?matched=false&limit=1&${LIST}`]: { ...fixture('roms'), items: [] },
    '/api/tasks/status': [fixture('task-scan-started')],
    '/api/tasks/scan': fixture('task-scan-queued'),
    ...overrides,
  };
  const calls = [];
  const request = async (url, options) => {
    const { pathname, search } = new URL(url);
    calls.push({ path: `${pathname}${search}`, ...options });
    const answer = routes[`${pathname}${search}`];
    if (answer === undefined) {
      return json(404, { detail: 'Not Found' });
    }
    return typeof answer === 'function' ? answer() : json(200, answer);
  };
  request.calls = calls;
  return request;
}

const client = (request, auth = { token: 'rmm_x' }) =>
  new RommClient({ url: 'http://192.0.2.30:8080', request, ...auth });

test('one reading of the recorded answers', async () => {
  const reading = await client(recorded()).read();
  assert.equal(reading.version, '5.4.1');
  assert.equal(reading.platforms, 3);
  assert.equal(reading.games, 3);
  assert.equal(reading.size, 393_216);
  assert.equal(reading.unidentified, 3);
  assert.deepEqual(
    reading.latest.map((rom) => [rom.id, rom.name, rom.platform]),
    [
      [3, 'Test Cart', 'Super Nintendo Entertainment System'],
      [2, 'Alter Ego', 'Nintendo Entertainment System'],
      [1, 'Another World Homebrew', 'Game Boy Advance'],
    ],
  );
  assert.equal(reading.latest[0].created, Date.parse('2026-10-30T12:07:08Z'));
  assert.equal(reading.scans.length, 1);
  assert.deepEqual(reading.scans[0].stats, {
    totalPlatforms: 3,
    totalRoms: 3,
    scannedPlatforms: 0,
    scannedRoms: 0,
    newRoms: 0,
    identifiedRoms: 0,
    newPlatforms: 0,
  });
});

test('the requests go one at a time (concurrent ones collide in RomM with a token)', async () => {
  let running = 0;
  let most = 0;
  const inner = recorded();
  const request = async (url, options) => {
    running += 1;
    most = Math.max(most, running);
    await new Promise((resolve) => setImmediate(resolve));
    try {
      return await inner(url, options);
    } finally {
      running -= 1;
    }
  };
  await client(request).read();
  assert.equal(most, 1);
});

test('the token goes in a Bearer header, a password in Basic, never in the URL', async () => {
  const request = recorded();
  await client(request).read();
  await client(request, { username: 'admin', password: 'p:ss' }).read();
  const signed = request.calls.filter((call) => call.path === '/api/stats');
  assert.equal(signed[0].headers.authorization, 'Bearer rmm_x');
  assert.equal(
    signed[1].headers.authorization,
    `Basic ${Buffer.from('admin:p:ss').toString('base64')}`,
  );
  assert.ok(request.calls.every((call) => !/rmm_x|p:ss/.test(call.path)));
});

test('the error kinds, from the real answers', async () => {
  const kind = async (overrides) => {
    try {
      await client(recorded(overrides)).read();
      return 'none';
    } catch (err) {
      return err.kind;
    }
  };
  const stats = (answer) => ({ '/api/stats': () => answer });
  assert.equal(await kind(stats(json(401, { detail: 'Not authenticated' }))), ERROR_KINDS.AUTH);
  assert.equal(await kind(stats(json(403, { detail: 'Forbidden' }))), ERROR_KINDS.FORBIDDEN);
  const page = { status: 200, headers: { 'content-type': 'text/html' }, body: '<!doctype html>' };
  assert.equal(await kind({ '/api/heartbeat': () => page }), ERROR_KINDS.NOT_ROMM);
  assert.equal(
    await kind({ '/api/heartbeat': () => json(200, { status: 'ok' }) }),
    ERROR_KINDS.NOT_ROMM,
  );
  assert.equal(
    await kind({ '/api/heartbeat': () => ({ status: 404, headers: {}, body: 'Not Found' }) }),
    ERROR_KINDS.NOT_ROMM,
  );
  assert.equal(await kind(stats({ status: 302, headers: {}, body: '' })), ERROR_KINDS.REDIRECT);
  assert.equal(await kind(stats(json(500, { detail: 'boom' }))), ERROR_KINDS.HTTP);
  const refused = async () => {
    const error = new Error('connect ECONNREFUSED');
    error.code = 'ECONNREFUSED';
    throw error;
  };
  assert.equal(await kind({ '/api/heartbeat': refused }), ERROR_KINDS.UNREACHABLE);
  const tls = async () => {
    const error = new Error('self-signed');
    error.code = 'DEPTH_ZERO_SELF_SIGNED_CERT';
    throw error;
  };
  assert.equal(await kind({ '/api/heartbeat': tls }), ERROR_KINDS.TLS);
  // The tasks refused (not an admin): the reading goes on, without scans.
  const reading = await client(
    recorded({ '/api/tasks/status': () => json(403, { detail: 'Forbidden' }) }),
  ).read();
  assert.equal(reading.scans, null);
  assert.equal(reading.games, 3);
});

test('the scan: queued, or refused for a reason the user can act on', async () => {
  const request = recorded();
  const task = await client(request).scan('unmatched');
  assert.equal(task.status, 'queued');
  assert.equal(task.name, 'Quick Scan');
  const sent = request.calls.find((call) => call.path === '/api/tasks/scan');
  assert.equal(sent.method, 'POST');
  assert.deepEqual(JSON.parse(sent.body), { type: 'unmatched' });
  const kind = async (answer) => {
    try {
      await client(recorded({ '/api/tasks/scan': () => answer })).scan();
      return 'none';
    } catch (err) {
      return err.kind;
    }
  };
  // The real answers of RomM 5.4.1.
  assert.equal(
    await kind(json(409, { detail: 'Complete Scan is already running' })),
    ERROR_KINDS.SCAN_RUNNING,
  );
  assert.equal(await kind(json(403, { detail: 'Forbidden' })), ERROR_KINDS.NOT_ADMIN);
  assert.equal(
    await kind(json(405, { detail: 'Method Not Allowed' })),
    ERROR_KINDS.SCAN_UNSUPPORTED,
  );
  assert.equal(await kind(json(404, { detail: 'Not Found' })), ERROR_KINDS.SCAN_UNSUPPORTED);
});

test('a finished scan and its figures', () => {
  const task = parseTask(fixture('task-scan-finished'));
  assert.equal(task.status, 'finished');
  assert.equal(task.type, 'scan');
  assert.equal(task.stats.newRoms, 2);
  assert.equal(task.stats.scannedRoms, 2);
  assert.equal(task.ended - task.started, 10_847);
  assert.equal(parseTask(fixture('task-scan-queued')).stats, null);
});

test('a game without its optional fields', () => {
  assert.deepEqual(parseRom({ id: 7, fs_name: 'game.zip' }), {
    id: 7,
    name: 'game.zip',
    file: 'game.zip',
    platform: '',
    platformSlug: '',
    size: 0,
    identified: false,
    identifying: false,
    created: null,
  });
  assert.equal(
    parseRom({ id: 8, name: 'X', platform_custom_name: 'My NES', platform_display_name: 'NES' })
      .platform,
    'My NES',
  );
});
