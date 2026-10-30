// -----------------------------------------------------------------------------
// RomM client (REST API under /api/, port 8080 by default).
//
// Two ways to sign in, both checked on a real RomM 5.4.1:
//   - a client API token (Profile → Client API tokens in RomM, `rmm_…`), sent
//     as `Authorization: Bearer <token>`, limited to the scopes chosen when it
//     was created;
//   - the username and password of a RomM user, sent as HTTP Basic.
// Never in the URL, never in the logs.
//
// A reading is five small GETs, one at a time: the heartbeat (version, no sign-in), the
// statistics, the ten newest games (by id), the count of games without
// metadata, and the task list (scans). The task list needs the `tasks.run`
// scope (an admin): refused, the reading goes on without the scans.
//
// Paths and fields checked on a real RomM 5.4.1 (test/fixtures/romm/ are its
// answers, trimmed).
// -----------------------------------------------------------------------------

import { httpRequest } from './http.js';

export const ERROR_KINDS = Object.freeze({
  UNREACHABLE: 'unreachable', // no answer: down, wrong address, firewall
  TLS: 'tls', // the certificate does not verify
  AUTH: 'auth', // credentials missing or refused (401)
  FORBIDDEN: 'forbidden', // signed in, but the games cannot be read (scope)
  NOT_ADMIN: 'not_admin', // signed in, but no right to run tasks (scan)
  NOT_ROMM: 'not_romm', // something answers, not this API
  SCAN_UNSUPPORTED: 'scan_unsupported', // RomM before 5.4: no scan through the API
  SCAN_RUNNING: 'scan_running', // a scan is already in progress (409)
  REDIRECT: 'redirect', // the address redirects (HTTP to HTTPS, a login page)
  HTTP: 'http', // any other HTTP error
});

// Scan types offered (ScanType of RomM): permanent once published.
export const SCAN_TYPES = Object.freeze(['quick', 'unmatched', 'complete']);

// Task states of RomM (RQ JobStatus).
export const RUNNING_STATES = new Set(['queued', 'started', 'deferred', 'scheduled', 'created']);

export const LATEST_SIZE = 10;

export class RommError extends Error {
  /**
   * @param {string} kind one of ERROR_KINDS
   * @param {string} message English, for the logs (never contains a secret)
   * @param {object} [extra] { status }
   */
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'RommError';
    this.kind = kind;
    Object.assign(this, extra);
  }
}

const TLS_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

const int = (value) => (Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0);
const str = (value) => (typeof value === 'string' ? value : '');

// The light form of a game list: no index of letters, of ids or of filters.
const LIST = 'with_char_index=false&with_filter_values=false&with_rom_id_index=false';

/** A game of the library (GET /api/roms), reduced to what is used. */
export function parseRom(raw) {
  return {
    id: Number.isInteger(raw?.id) ? raw.id : null,
    name: str(raw?.name) || str(raw?.fs_name_no_tags) || str(raw?.fs_name),
    file: str(raw?.fs_name),
    platform:
      str(raw?.platform_custom_name) || str(raw?.platform_display_name) || str(raw?.platform_slug),
    platformSlug: str(raw?.platform_slug),
    size: int(raw?.fs_size_bytes),
    identified: raw?.is_identified === true,
    // RomM is still fetching its metadata: its name may change.
    identifying: raw?.is_identifying === true,
    // Milliseconds.
    created: Number.isFinite(Date.parse(raw?.created_at)) ? Date.parse(raw.created_at) : null,
  };
}

/** A task of RomM (GET /api/tasks/status, GET /api/tasks/{id}). */
export function parseTask(raw) {
  const stats = raw?.meta?.scan_stats ?? null;
  const time = (value) => (Number.isFinite(Date.parse(value)) ? Date.parse(value) : null);
  return {
    id: str(raw?.task_id),
    name: str(raw?.task_name),
    type: str(raw?.task_type),
    status: str(raw?.status),
    started: time(raw?.started_at),
    ended: time(raw?.ended_at),
    stats: stats
      ? {
          totalPlatforms: int(stats.total_platforms),
          totalRoms: int(stats.total_roms),
          scannedPlatforms: int(stats.scanned_platforms),
          scannedRoms: int(stats.scanned_roms),
          newRoms: int(stats.new_roms),
          identifiedRoms: int(stats.identified_roms),
          newPlatforms: int(stats.new_platforms),
        }
      : null,
  };
}

export class RommClient {
  /**
   * @param {object} options
   * @param {string} options.url base URL, with the base path if any
   * @param {string} [options.token] client API token (preferred)
   * @param {string} [options.username]
   * @param {string} [options.password]
   * @param {Function} [options.request] HTTP seam (src/romm/http.js)
   */
  constructor({ url, token, username, password, request = httpRequest }) {
    this.url = url;
    this.authorization = token
      ? `Bearer ${token}`
      : `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
    this.request = request;
  }

  /** One call to the API; resolves with the parsed JSON. */
  async call(path, { method = 'GET', body, auth = true } = {}) {
    let answer;
    try {
      answer = await this.request(`${this.url}${path}`, {
        method,
        headers: auth ? { authorization: this.authorization } : {},
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      if (TLS_CODES.has(err.code)) {
        throw new RommError(ERROR_KINDS.TLS, `Certificate refused (${err.code})`);
      }
      throw new RommError(ERROR_KINDS.UNREACHABLE, err.code ? `${err.code}` : err.message);
    }
    const { status, headers = {}, body: text } = answer;
    const json = /json/i.test(headers['content-type'] ?? '') ? safeJson(text) : undefined;
    const route = path.split('?')[0];
    if (status === 401) {
      throw new RommError(ERROR_KINDS.AUTH, `Sign-in refused (${str(json?.detail) || status})`, {
        status,
      });
    }
    if (status === 403) {
      throw new RommError(ERROR_KINDS.FORBIDDEN, `${route}: forbidden for this account`, {
        status,
      });
    }
    if (status >= 300 && status < 400) {
      throw new RommError(ERROR_KINDS.REDIRECT, `Redirected (HTTP ${status})`, { status });
    }
    if ((status === 404 || status === 405) && json === undefined) {
      throw new RommError(ERROR_KINDS.NOT_ROMM, `${route}: not found`, { status });
    }
    if (status < 200 || status >= 300) {
      const detail = str(json?.detail);
      throw new RommError(
        ERROR_KINDS.HTTP,
        `${route} answered HTTP ${status}${detail ? ` (${detail.slice(0, 200)})` : ''}`,
        { status },
      );
    }
    if (json === undefined) {
      throw new RommError(ERROR_KINDS.NOT_ROMM, `${route}: not a JSON answer`, { status });
    }
    return json;
  }

  /** `{ version }` from the heartbeat (no sign-in needed). */
  async heartbeat() {
    const answer = await this.call('/api/heartbeat', { auth: false });
    if (!answer?.SYSTEM || typeof answer.SYSTEM !== 'object') {
      throw new RommError(ERROR_KINDS.NOT_ROMM, '/api/heartbeat: not a RomM heartbeat');
    }
    return { version: str(answer.SYSTEM.VERSION) || null };
  }

  /**
   * The figures of the library, the newest games and the scans: one reading.
   * Throws AUTH or FORBIDDEN when the games cannot be read.
   */
  async read() {
    const { version } = await this.heartbeat();
    // One request at a time: RomM 5.4.1 writes `last_used_at` of a client token
    // on every request, and concurrent ones collide in MariaDB (HTTP 500,
    // "Record has changed since last read in table 'client_tokens'").
    const stats = await this.call('/api/stats');
    const latest = await this.call(
      `/api/roms?order_by=id&order_dir=desc&limit=${LATEST_SIZE}&${LIST}`,
    );
    const unidentified = await this.call(`/api/roms?matched=false&limit=1&${LIST}`);
    const tasks = await this.tasks();
    return {
      version,
      platforms: int(stats?.PLATFORMS),
      games: int(stats?.ROMS),
      size: int(stats?.TOTAL_FILESIZE_BYTES),
      unidentified: int(unidentified?.total),
      latest: (Array.isArray(latest?.items) ? latest.items : [])
        .map(parseRom)
        .filter((rom) => rom.id !== null),
      // null: the account cannot read the tasks (not an admin).
      scans: tasks === null ? null : tasks.filter((task) => task.type === 'scan' && task.id),
    };
  }

  /** The tasks of RomM, newest first; null when the account may not see them. */
  async tasks() {
    try {
      const answer = await this.call('/api/tasks/status');
      return Array.isArray(answer) ? answer.map(parseTask) : [];
    } catch (err) {
      if (err.kind === ERROR_KINDS.FORBIDDEN) {
        return null;
      }
      throw err;
    }
  }

  /** Start a scan of the whole library (SCAN_TYPES); resolves with the task. */
  async scan(type = 'quick') {
    try {
      const answer = await this.call('/api/tasks/scan', { method: 'POST', body: { type } });
      return parseTask(answer);
    } catch (err) {
      if (err.kind === ERROR_KINDS.FORBIDDEN) {
        throw new RommError(ERROR_KINDS.NOT_ADMIN, 'Scan refused: not an admin', {
          status: err.status,
        });
      }
      if (err.kind === ERROR_KINDS.HTTP && err.status === 409) {
        throw new RommError(ERROR_KINDS.SCAN_RUNNING, 'A scan is already running', {
          status: err.status,
        });
      }
      // Before 5.4.0 (POST /api/tasks/scan), RomM scanned only through its web socket.
      if (
        err.kind === ERROR_KINDS.NOT_ROMM ||
        (err.kind === ERROR_KINDS.HTTP && [404, 405].includes(err.status))
      ) {
        throw new RommError(ERROR_KINDS.SCAN_UNSUPPORTED, 'This RomM cannot scan through the API', {
          status: err.status,
        });
      }
      throw err;
    }
  }

  /** The page of a game in the web interface, for the scene events. */
  romUrl(id) {
    return `${this.url}/rom/${encodeURIComponent(id)}`;
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
