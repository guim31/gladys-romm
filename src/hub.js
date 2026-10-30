// -----------------------------------------------------------------------------
// The hub: reads RomM on a timer of the container (the interval chosen in the
// configuration), publishes the states of the server device when they change,
// fires the scene events, and runs the scan (widget button, scene action), the
// widget and "Test the connection".
//
// Each reading is five small GETs of the REST API (src/romm/client.js): the
// heartbeat, the statistics, the ten newest games, the count of games without
// metadata and the task list.
//
// Gladys never polls this device (should_poll: false): the scene events must
// fire even when the device was not added, and a device created without
// should_poll is never polled by Gladys 5.2 anyway.
//
// Scene events:
//   - game_added: a game never seen before is among the ten newest ones (by
//     id), and RomM has finished fetching its metadata (or gave up 30 minutes
//     ago), so the name announced is the final one;
//   - scan_finished: a scan of RomM (from Gladys, the web interface or the
//     schedule) is finished. RomM keeps finished tasks 24 h: any interval
//     offered sees them. Needs an account that can read the tasks (admin).
// What was seen is kept under /data, so a restart announces nothing twice; the
// first reading of a new server announces nothing.
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS, createLogger } from '@gladysassistant/integration-sdk';
import { ERROR_KINDS, RUNNING_STATES, RommClient, SCAN_TYPES } from './romm/client.js';
import { FEATURE_KEYS, buildServer, featureValues, serverIds, toGigabytes } from './devices.js';
import {
  ACTION_TEXT,
  CONNECTION_TEXT,
  ERROR_TEXT,
  REPORT_TEXT,
  SCAN_TEXT,
  SUMMARY_TEXT,
  pick,
} from './texts.js';

const logger = createLogger({ name: 'romm-hub' });

export const WIDGET_KEY = 'library';

// Scene trigger keys (manifest `scene_triggers`): permanent once published.
export const TRIGGERS = Object.freeze({
  GAME_ADDED: 'game_added',
  SCAN_FINISHED: 'scan_finished',
});

export const HUB_TIMINGS = {
  // Republish an unchanged value this often (Gladys flags a value older than 48 h).
  heartbeatMs: 12 * 60 * 60_000,
  // A game still "identifying" after this long is announced with its file name.
  identifyingMs: 30 * 60_000,
};

// Game ids announced, and scan task ids seen, remembered.
const KNOWN_SIZE = 500;
const SCANS_SIZE = 100;

const ints = (list) => (Array.isArray(list) ? list.filter((id) => Number.isInteger(id)) : []);
const strings = (list) => (Array.isArray(list) ? list.filter((id) => typeof id === 'string') : []);

export class CommandError extends Error {}

export class RommHub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {object} options.store persistence (src/store.js)
   * @param {Function} [options.request] HTTP seam (src/romm/http.js)
   * @param {boolean} [options.timers] periodic timer (off in tests)
   * @param {object} [options.timings] HUB_TIMINGS overrides
   * @param {() => number} [options.now]
   */
  constructor({ gladys, store, request, timers = true, timings, now }) {
    this.gladys = gladys;
    this.store = store;
    this.request = request;
    this.timersEnabled = timers;
    this.timings = { ...HUB_TIMINGS, ...timings };
    this.now = now ?? (() => Date.now());
    this.config = null;
    this.client = null;
    this.signature = null;
    this.server = this.emptyServer();
    this.error = null;
    this.devicesKey = null;
    /** Last value published per feature external id: { value, at }. */
    this.published = new Map();
    this.transport = null;
    this.connection = null;
    this.saved = this.emptySaved(null);
    this.pollTimer = null;
    this.polling = null;
    this.stopped = false;
    /** Problems already logged, by key: repeats go to debug. */
    this.warned = new Set();
  }

  emptyServer() {
    return { reachable: null, version: null, reading: null };
  }

  emptySaved(url) {
    return { url, seeded: false, seedId: 0, known: [], scansSeeded: false, scans: [] };
  }

  // --- Logs ------------------------------------------------------------------

  /** Log a problem once (`level` warn or error), its repeats at debug. */
  problem(key, message, err, level = 'warn') {
    const args = err === undefined ? [message] : [message, err];
    if (this.warned.has(key)) {
      logger.debug(...args);
      return;
    }
    this.warned.add(key);
    logger[level](...args);
  }

  /** The problem `key` is gone: the next occurrence is logged again. */
  resolved(key, message) {
    if (this.warned.delete(key) && message) {
      logger.info(message);
    }
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    const saved = await this.store.load();
    this.saved = {
      url: typeof saved.url === 'string' ? saved.url : null,
      seeded: saved.seeded === true,
      seedId: Number.isInteger(saved.seedId) ? saved.seedId : 0,
      known: ints(saved.known).slice(0, KNOWN_SIZE),
      scansSeeded: saved.scansSeeded === true,
      scans: strings(saved.scans).slice(0, SCANS_SIZE),
    };
    await this.reconfigure(config);
  }

  /** Gladys reconnected (it restarted): send everything again. */
  async resync(config) {
    this.published.clear();
    this.transport = null;
    this.connection = null;
    this.devicesKey = null;
    await this.reconfigure(config);
  }

  async reconfigure(config) {
    this.config = config;
    const signature = JSON.stringify([config.url, config.token, config.username, config.password]);
    if (signature !== this.signature) {
      this.signature = signature;
      const credentials = Boolean(config.token || (config.username && config.password));
      this.client =
        config.url && credentials
          ? new RommClient({
              url: config.url,
              token: config.token,
              username: config.username,
              password: config.password,
              request: this.request,
            })
          : null;
      this.error = null;
      this.server = this.emptyServer();
      if (config.url && this.saved.url !== config.url) {
        // Another server: its games are new, not news.
        this.saved = this.emptySaved(config.url);
        this.store.save(this.saved);
      }
    }
    this.devicesKey = null; // the language may have changed
    try {
      await this.refresh();
    } finally {
      this.schedulePoll();
    }
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.pollTimer);
    await this.store.flush();
  }

  schedulePoll() {
    clearTimeout(this.pollTimer);
    if (!this.timersEnabled || this.stopped || !this.client) {
      return;
    }
    this.pollTimer = setTimeout(async () => {
      try {
        await this.pollAll();
        this.resolved('poll');
      } catch (err) {
        this.problem('poll', 'Poll failed', err, 'error');
      }
      this.schedulePoll();
    }, this.config.pollIntervalMs);
  }

  // --- Devices ---------------------------------------------------------------

  devices() {
    return this.client ? [buildServer(this.gladys, this.config)] : [];
  }

  /** Publish the device when it changed (name, language). */
  async publishDevices({ force = false } = {}) {
    const devices = this.devices();
    const key = JSON.stringify(devices);
    if (!force && key === this.devicesKey) {
      return;
    }
    try {
      // Even an empty list: the Discovery tab then shows no stale device.
      await this.gladys.publishDiscoveredDevices(devices);
      this.devicesKey = key;
      this.resolved('discovery');
    } catch (err) {
      this.problem('discovery', `Devices refused: ${err.message}`);
    }
  }

  /** "Search" in the Discovery tab: read RomM, publish the device again. */
  async rediscover() {
    await this.refresh();
    await this.publishDevices({ force: true });
  }

  /** The user added the device: its states sent before were dropped by Gladys. */
  async onDeviceCreated(device) {
    if (!this.client || device.external_id !== serverIds(this.gladys).device) {
      return;
    }
    await this.publishStates({ force: true });
    this.transport = null;
    await this.publishTransport();
    this.gladys.requestWidgetRefresh(WIDGET_KEY);
  }

  // --- Reading RomM ----------------------------------------------------------

  /** Read RomM and apply what changed. Concurrent calls share the read. */
  pollAll() {
    this.polling ??= this.readAll().finally(() => {
      this.polling = null;
    });
    return this.polling;
  }

  /** A reading that starts after this call (a scene action wants fresh figures). */
  async refresh() {
    if (this.polling) {
      await this.polling.catch(() => {});
    }
    return this.pollAll();
  }

  /** Gladys asks for a refresh (onPoll): read RomM now. */
  async pollDevice(device) {
    if (this.client && device.external_id === serverIds(this.gladys).device) {
      await this.pollAll();
    }
  }

  async readAll() {
    if (!this.client) {
      await this.publishDevices();
      await this.publishConnectionStatus();
      return;
    }
    const client = this.client;
    const before = this.widgetView();
    try {
      const reading = await client.read();
      if (client !== this.client) {
        return; // reconfigured meanwhile
      }
      await this.applyReading(client, reading);
    } catch (err) {
      if (!err.kind) {
        throw err;
      }
      if (client !== this.client) {
        return;
      }
      this.applyFailure(err);
    }
    await this.publishDevices();
    await this.publishStates();
    await this.publishTransport();
    await this.publishConnectionStatus();
    if (this.widgetView() !== before) {
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  }

  async applyReading(client, reading) {
    if (this.error) {
      logger.info(`RomM ${this.config.url}: connection restored`);
    } else if (this.server.reachable === null) {
      logger.info(
        `RomM ${this.config.url}: connected, version ${reading.version ?? 'unknown'}, ${reading.games} game(s)`,
      );
    }
    if (reading.scans === null) {
      this.problem(
        'tasks',
        `RomM ${this.config.url}: this account cannot read the tasks, scan_finished will not fire`,
      );
    } else {
      this.resolved('tasks');
    }
    this.error = null;
    this.server = { reachable: true, version: reading.version, reading };

    const saved = this.saved;
    const now = this.now();
    let added = [];
    let finished = [];

    if (!saved.seeded) {
      // First reading of this server: what is there is not news.
      saved.seeded = true;
      saved.seedId = Math.max(0, ...reading.latest.map((rom) => rom.id));
    } else {
      const known = new Set(saved.known);
      // Newest first in the answer: announced oldest first.
      added = reading.latest
        .filter(
          (rom) =>
            rom.id > saved.seedId &&
            !known.has(rom.id) &&
            (!rom.identifying ||
              (rom.created !== null && now - rom.created >= this.timings.identifyingMs)),
        )
        .reverse();
      saved.known = [...added.map((rom) => rom.id).reverse(), ...saved.known].slice(0, KNOWN_SIZE);
    }

    if (reading.scans !== null) {
      const ended = reading.scans.filter((task) => !RUNNING_STATES.has(task.status));
      if (saved.scansSeeded) {
        const seen = new Set(saved.scans);
        // Newest first in the answer: announced oldest first.
        finished = ended
          .filter((task) => task.status === 'finished' && !seen.has(task.id))
          .reverse();
      }
      saved.scansSeeded = true;
      saved.scans = [...new Set([...ended.map((task) => task.id), ...saved.scans])].slice(
        0,
        SCANS_SIZE,
      );
    }

    // On disk before the events: a crash in between announces nothing twice.
    this.store.save(saved);
    await this.store.flush();
    if (client !== this.client) {
      return;
    }
    for (const rom of added) {
      logger.debug(`RomM: game added "${rom.name}" (${rom.platform})`);
      await this.fire(TRIGGERS.GAME_ADDED, {
        name: rom.name,
        platform: rom.platform,
        file: rom.file,
        url: client.romUrl(rom.id),
        games: reading.games,
      });
    }
    for (const task of finished) {
      logger.debug(`RomM: ${task.name} finished`);
      const stats = task.stats ?? {};
      await this.fire(TRIGGERS.SCAN_FINISHED, {
        scan: task.name,
        new_games: stats.newRoms ?? 0,
        identified_games: stats.identifiedRoms ?? 0,
        scanned_games: stats.scannedRoms ?? 0,
        games: reading.games,
        duration_minutes:
          task.started !== null && task.ended !== null
            ? Math.max(0, Math.round((task.ended - task.started) / 60_000))
            : 0,
      });
    }
  }

  applyFailure(err) {
    const wasError = this.error?.kind;
    this.error = { kind: err.kind, message: err.message };
    this.server = { ...this.server, reachable: false };
    // One warning when the problem starts (or changes), not one per reading.
    if (wasError !== err.kind) {
      logger.warn(`RomM ${this.config.url}: ${err.message}`);
    } else {
      logger.debug(`RomM ${this.config.url}: ${err.message} (again)`);
    }
  }

  async fire(key, data) {
    try {
      await this.gladys.publishSceneEvent(key, data);
      this.resolved('scene-event');
    } catch (err) {
      this.problem('scene-event', `Scene event ${key} refused: ${err.message}`);
    }
  }

  // --- Figures ---------------------------------------------------------------

  /** The figures of the last reading (null before the first one). */
  totals() {
    const reading = this.server.reading;
    if (!reading) {
      return null;
    }
    return {
      platforms: reading.platforms,
      games: reading.games,
      sizeGb: toGigabytes(reading.size),
      unidentified: reading.unidentified,
    };
  }

  /** The newest games, newest first (ten at most). */
  recent() {
    return this.server.reading?.latest ?? [];
  }

  /** The scan RomM runs or waits to run: `{ waiting, done, total }`, null when none. */
  currentScan() {
    const task = (this.server.reading?.scans ?? []).find((item) => RUNNING_STATES.has(item.status));
    if (!task) {
      return null;
    }
    return {
      waiting: task.status !== 'started',
      done: task.stats?.scannedRoms ?? 0,
      total: task.stats?.totalRoms ?? 0,
    };
  }

  /** The scan in progress as a short line in the language; '' when none. */
  scanLine(language = this.config?.language) {
    const scan = this.currentScan();
    if (!scan) {
      return '';
    }
    const text = SCAN_TEXT[language] ?? SCAN_TEXT.en;
    return scan.waiting || scan.total === 0 ? text.waiting : text.progress(scan.done, scan.total);
  }

  /** What the widget shows: a change asks Gladys to reload it. */
  widgetView() {
    return JSON.stringify([
      this.server.reachable,
      this.error?.kind ?? null,
      this.totals(),
      this.currentScan(),
      this.recent().map((rom) => [rom.id, rom.name]),
    ]);
  }

  // --- Publishing to Gladys --------------------------------------------------

  snapshot() {
    if (!this.server.reachable) {
      return { reachable: this.server.reachable };
    }
    const last = this.recent()[0];
    return {
      reachable: true,
      ...this.totals(),
      lastGame: last ? `${last.name} (${last.platform})`.slice(0, 250) : null,
    };
  }

  async publishStates({ force = false } = {}) {
    if (!this.client) {
      return;
    }
    const now = this.now();
    const down = this.server.reachable === false;
    const states = [];
    for (const { key, externalId, value, text } of featureValues(
      serverIds(this.gladys),
      this.snapshot(),
    )) {
      if (value === null) {
        continue;
      }
      const last = this.published.get(externalId);
      // While RomM is down, its last figures are not republished as fresh.
      const stale = down && key !== FEATURE_KEYS.ONLINE;
      const fresh =
        last && last.value === value && (stale || now - last.at < this.timings.heartbeatMs);
      if (!force && fresh) {
        continue;
      }
      states.push(
        text
          ? { device_feature_external_id: externalId, text: String(value) }
          : { device_feature_external_id: externalId, state: value },
      );
    }
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishStates(states);
      for (const state of states) {
        this.published.set(state.device_feature_external_id, {
          value: state.text ?? state.state,
          at: now,
        });
      }
      this.resolved('states');
    } catch (err) {
      this.problem('states', `States refused: ${err.message}`);
    }
  }

  async publishTransport() {
    if (!this.client || this.server.reachable === null) {
      return;
    }
    const value = this.server.reachable ? DEVICE_TRANSPORTS.LOCAL : DEVICE_TRANSPORTS.UNREACHABLE;
    if (this.transport === value) {
      return;
    }
    try {
      await this.gladys.publishTransports([
        { external_id: serverIds(this.gladys).device, transport: value },
      ]);
      this.transport = value;
      this.resolved('transports');
    } catch (err) {
      this.problem('transports', `Transports refused: ${err.message}`);
    }
  }

  /** The status under the integration name. */
  connectionStatus() {
    if (!this.config.url) {
      return {
        connected: false,
        message: this.config.invalidUrl ? CONNECTION_TEXT.invalid : CONNECTION_TEXT.noServer,
      };
    }
    if (!this.client) {
      return { connected: false, message: CONNECTION_TEXT.noCredentials };
    }
    if (this.error) {
      return { connected: false, message: ERROR_TEXT[this.error.kind] };
    }
    return { connected: true };
  }

  async publishConnectionStatus() {
    const status = this.connectionStatus();
    const key = JSON.stringify(status);
    if (key === this.connection) {
      return;
    }
    try {
      await this.gladys.setConnectionStatus(status.connected, status.message);
      this.connection = key;
      this.resolved('connection-status');
    } catch (err) {
      this.problem('connection-status', `Connection status refused: ${err.message}`);
    }
  }

  // --- Commands --------------------------------------------------------------

  ensureServer(language = this.config?.language) {
    if (!this.client) {
      throw new CommandError(pick(this.connectionStatus().message, language));
    }
  }

  /** Start a scan of the whole library (`quick`: new games only). */
  async scan(type = 'quick', language = this.config?.language) {
    this.ensureServer(language);
    const scanType = SCAN_TYPES.includes(type) ? type : 'quick';
    try {
      await this.client.scan(scanType);
    } catch (err) {
      if (!err.kind) {
        throw err;
      }
      throw new CommandError(pick(ERROR_TEXT[err.kind], language));
    }
    logger.info(`RomM: ${scanType} scan started`);
    // In the background: the scan shows in the widget at the next reading.
    this.refresh().catch(() => {});
    return ACTION_TEXT.scanStarted;
  }

  // --- Reports ---------------------------------------------------------------

  /** The sentence of the scene action: the library and the latest games. */
  summary(count = 3) {
    this.ensureServer();
    const text = SUMMARY_TEXT[this.config.language] ?? SUMMARY_TEXT.en;
    if (!this.server.reachable) {
      return text.down;
    }
    const totals = this.totals();
    const latest = this.recent().slice(0, count);
    const games = latest.length
      ? `${text.latest}${text.colon}${latest.map((rom) => text.game(rom.name, rom.platform)).join(', ')}`
      : text.none;
    const sentence = `RomM${text.colon}${text.games(totals.games, totals.platforms)}. ${games[0].toUpperCase()}${games.slice(1)}.`;
    return sentence.length > 1000 ? `${sentence.slice(0, 999)}…` : sentence;
  }

  /** "Test the connection": read RomM now, one report. */
  async testConnection() {
    await this.refresh();
    const message = {};
    for (const [language, text] of Object.entries(REPORT_TEXT)) {
      if (!this.client || this.error) {
        message[language] = pick(this.connectionStatus().message, language);
        continue;
      }
      const totals = this.totals();
      message[language] = [
        text.ok(this.server.version),
        text.games(totals.games, totals.sizeGb),
        text.platforms(totals.platforms),
        text.unidentified(totals.unidentified),
        ...(this.server.reading.scans === null ? [text.noTasks] : []),
      ].join(', ');
    }
    return message;
  }
}

export { ERROR_KINDS };
