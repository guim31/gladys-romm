import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, parseServerUrl } from '../src/config.js';

test('the address: a bare host gets the port of RomM, a copied URL keeps its base', () => {
  assert.equal(parseServerUrl('192.0.2.30'), 'http://192.0.2.30:8080');
  assert.equal(parseServerUrl(' 192.0.2.30:9000 '), 'http://192.0.2.30:9000');
  assert.equal(parseServerUrl('http://romm.local:8080/'), 'http://romm.local:8080');
  assert.equal(parseServerUrl('https://example.org/romm/'), 'https://example.org/romm');
  assert.equal(parseServerUrl('http://192.0.2.30:8080/rom/42?x=1#top'), 'http://192.0.2.30:8080');
  assert.equal(parseServerUrl('https://example.org/romm/platform/3'), 'https://example.org/romm');
  assert.equal(parseServerUrl('http://192.0.2.30:8080/api/heartbeat'), 'http://192.0.2.30:8080');
  assert.equal(parseServerUrl('http://user:pass@192.0.2.30'), null, 'no credentials in the URL');
  assert.equal(parseServerUrl('ftp://192.0.2.30'), null);
  assert.equal(parseServerUrl(''), null);
  assert.equal(parseServerUrl(42), null);
});

test('normalization: defaults, numbers as strings, unknown values', () => {
  const config = normalizeConfig({});
  assert.equal(config.url, null);
  assert.equal(config.invalidUrl, false);
  assert.equal(config.token, '');
  assert.equal(config.username, '');
  assert.equal(config.password, '');
  assert.equal(config.pollIntervalMs, 120_000);
  assert.equal(config.language, 'fr');
  const typed = normalizeConfig({
    url: 'http://[bad',
    poll_interval: 300,
    language: 'it',
    token: '  rmm_abc  ',
    username: ' admin ',
    password: ' secret ',
  });
  assert.equal(typed.invalidUrl, true);
  assert.equal(typed.pollIntervalMs, 300_000);
  assert.equal(typed.language, 'fr');
  assert.equal(typed.token, 'rmm_abc', 'spaces of a copy are dropped');
  assert.equal(typed.username, 'admin');
  assert.equal(typed.password, ' secret ', 'a password is kept as typed');
  assert.equal(normalizeConfig({ poll_interval: '7' }).pollIntervalMs, 120_000);
});
