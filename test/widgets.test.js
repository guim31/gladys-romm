// -----------------------------------------------------------------------------
// The `library` widget: content valid for the core (budget, vocabulary), in
// every language, during a scan, its settings, its button and its messages.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { CONFIG, FakeRomm, createWorld, defaultRomm } from './helpers/world.js';
import { gameItem } from '../src/widgets.js';

async function world(t, options) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

const get = async (w, language = 'en', settings = {}) => {
  const ack = await w.fake.widgetGet('library', { settings, language });
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(validateWidgetContent(ack.data.content), [], JSON.stringify(ack.data));
  return ack.data.content;
};

test('the widget shows the figures, the scan and the latest games, in every language', async (t) => {
  const w = await world(t);
  for (let i = 0; i < 12; i += 1) {
    w.romm.add(`${'x'.repeat(70)} ${i}`, 'gba');
  }
  w.romm.scanTask({ status: 'started', stats: { scanned_roms: 120, total_roms: 450 } });
  await w.hub.pollAll();
  const scans = {
    en: '120/450 games',
    fr: '120/450 jeux',
    de: '120/450 Spiele',
    es: '120/450 juegos',
  };
  for (const language of ['en', 'fr', 'de', 'es']) {
    const content = await get(w, language);
    const { components } = content;
    assert.equal(content.ttl_seconds, 30, 'short while a scan runs');
    assert.ok(components.length <= 8);
    assert.ok(components.filter((c) => c.type === 'text').length <= 2);
    assert.deepEqual(
      components.filter((c) => c.type === 'value').map((c) => c.value),
      [15, 3, 14],
      'games, platforms, without metadata',
    );
    assert.equal(components.find((c) => c.type === 'status').items[0].value, scans[language]);
    const list = components.find((c) => c.type === 'card-list');
    assert.equal(list.items.length, 5, 'five by default');
    assert.equal(list.items[0].title.length, 60);
    assert.equal(list.items[0].subtitle, 'Game Boy Advance');
    assert.ok(list.items[0].date);
    assert.deepEqual(
      components.filter((c) => c.type === 'button').map((b) => b.action.key),
      ['scan'],
    );
  }
});

test('the settings: eight games, no tiles, no button', async (t) => {
  const w = await world(t);
  for (let i = 0; i < 12; i += 1) {
    w.romm.add(`Game ${i}`, 'nes');
  }
  await w.hub.pollAll();
  const { components, ttl_seconds: ttl } = await get(w, 'en', {
    count: '8',
    show_figures: false,
    show_scan_button: false,
  });
  assert.equal(ttl, 300);
  assert.deepEqual(
    components.map((c) => c.type),
    ['card-list'],
  );
  assert.equal(components[0].items.length, 8);
  const odd = await get(w, 'en', { count: '99' });
  assert.equal(odd.components.find((c) => c.type === 'card-list').items.length, 5);
});

test('the button starts a quick scan; a refusal is explained', async (t) => {
  const w = await world(t, { config: { ...CONFIG, language: 'fr' } });
  let ack = await w.fake.widgetAction('library', 'scan', {}, { settings: {} });
  assert.equal(ack.success, true, ack.error);
  assert.equal(w.romm.lastScan, 'quick');
  ack = await w.fake.widgetAction('library', 'scan', {}, { settings: {} });
  assert.equal(ack.success, false);
  assert.match(ack.error, /déjà en cours/);
});

test('no game yet: a sentence instead of the list', async (t) => {
  const w = await world(t, { romm: new FakeRomm() });
  const { components } = await get(w);
  assert.ok(components.some((c) => c.type === 'text' && /No game/.test(c.text)));
});

test('no server, no credentials, or a server down: a message instead of figures', async (t) => {
  const none = await world(t, { config: {} });
  assert.match((await get(none)).components[0].text, /address of your RomM/);
  const romm = defaultRomm();
  romm.online = false;
  const down = await world(t, { romm });
  const { components } = await get(down, 'fr');
  assert.equal(components[0].items[0].value, 'Hors ligne');
  assert.match(components[1].text, /ne répond pas/);
});

test('a row without a date or a platform stays valid', () => {
  assert.deepEqual(gameItem({ name: 'Solo', platform: '', created: null }), { title: 'Solo' });
});
