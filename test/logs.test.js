// -----------------------------------------------------------------------------
// What the integration writes at the default level (info): the lifecycle
// only (a game added or a scan finished goes to debug, like any reading). A
// normal reading writes nothing, a failure that repeats is logged once, and
// its end once. Never the token nor the password.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASIC_CONFIG, PASSWORD, TOKEN, createWorld, defaultRomm } from './helpers/world.js';

/** Capture the lines of the SDK logger at LOG_LEVEL=info. */
function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  const record =
    (stream) =>
    (...args) =>
      lines.push({
        stream,
        text: args.map((arg) => (arg instanceof Error ? arg.stack : String(arg))).join(' '),
      });
  t.mock.method(console, 'log', record('out'));
  t.mock.method(console, 'error', record('err'));
  return {
    lines,
    clear: () => lines.splice(0),
    texts: () => lines.map((line) => line.text),
  };
}

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

test('a normal reading cycle writes nothing at info', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  assert.ok(
    logs.texts().some((text) => text.includes('connected')),
    'the start is logged',
  );
  logs.clear();
  const id = w.romm.scanTask({ status: 'started' });
  for (let i = 0; i < 5; i += 1) {
    // Games added, a scan running then finished: nothing to tell at info.
    w.romm.add(`Game ${i}`, 'nes');
    w.clock.advance(120_000);
    await w.hub.pollAll();
  }
  w.romm.finish(id);
  await w.hub.pollAll();
  assert.deepEqual(logs.texts(), []);
});

test('a game added or a scan finished is one line at debug', async (t) => {
  const logs = captureLogs(t, 'debug');
  const w = await world(t);
  logs.clear();
  w.romm.add('Fresh one', 'gba');
  w.romm.scanTask({ status: 'finished' });
  await w.hub.pollAll();
  const news = logs.texts().filter((text) => /RomM: (game added|.*Scan finished)/.test(text));
  assert.equal(news.length, 2, logs.texts().join('\n'));
  assert.match(news[0], /\[DEBUG\].*game added "Fresh one" \(Game Boy Advance\)/);
  assert.match(news[1], /\[DEBUG\].*Quick Scan finished/);
});

test('a server that stays down is logged once, and once when it is back', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  logs.clear();
  w.romm.online = false;
  for (let i = 0; i < 6; i += 1) {
    w.clock.advance(60_000);
    await w.hub.pollAll();
  }
  assert.equal(logs.lines.length, 1, logs.texts().join('\n'));
  assert.equal(logs.lines[0].stream, 'err');
  logs.clear();
  w.romm.online = true;
  await w.hub.pollAll();
  await w.hub.pollAll();
  assert.equal(logs.lines.length, 1, logs.texts().join('\n'));
  assert.match(logs.lines[0].text, /connection restored/);
});

test('refused credentials are logged once, never the token nor the password', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t, { config: { ...BASIC_CONFIG, password: 'wrong-password-42' } });
  for (let i = 0; i < 5; i += 1) {
    await w.hub.pollAll();
  }
  const warnings = logs.lines.filter((line) => line.stream === 'err');
  assert.equal(warnings.length, 1, logs.texts().join('\n'));
  assert.match(warnings[0].text, /refused/);
  assert.ok(!logs.texts().join('\n').includes('wrong-password-42'), 'never the password');
});

test('an account that cannot read the tasks is logged once', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t, { romm: defaultRomm({ admin: false }) });
  await w.hub.pollAll();
  await w.hub.pollAll();
  const warnings = logs.lines.filter((line) => /cannot read the tasks/.test(line.text));
  assert.equal(warnings.length, 1, logs.texts().join('\n'));
});

test('a scan started by the user is one line at info', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  logs.clear();
  await w.fake.sceneAction('scan_library', {});
  assert.equal(logs.lines.length, 1, logs.texts().join('\n'));
  assert.match(logs.lines[0].text, /quick scan started/);
});

test('Gladys refusing the states is logged once', async (t) => {
  const logs = captureLogs(t);
  const w = await world(t);
  logs.clear();
  w.gladys.publishStates = async () => {
    throw new Error('HTTP 500');
  };
  for (let i = 0; i < 4; i += 1) {
    w.romm.add(`Game ${i}`, 'nes');
    await w.hub.pollAll();
  }
  assert.equal(logs.lines.length, 1, logs.texts().join('\n'));
  assert.match(logs.lines[0].text, /States refused/);
});

test('LOG_LEVEL=debug shows each reading problem; never the secrets', async (t) => {
  const logs = captureLogs(t, 'debug');
  const w = await world(t);
  const basic = await world(t, { config: BASIC_CONFIG });
  w.romm.online = false;
  basic.romm.online = false;
  await w.hub.pollAll();
  await w.hub.pollAll();
  await basic.hub.pollAll();
  const text = logs.texts().join('\n');
  assert.match(text, /\[DEBUG\].*again/);
  assert.ok(!text.includes(TOKEN) && !text.includes(PASSWORD), 'never a secret');
  assert.ok(!text.includes(Buffer.from(`gladys:${PASSWORD}`).toString('base64')));
});
