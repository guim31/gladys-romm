// -----------------------------------------------------------------------------
// An in-memory RomM behind the `request` seam of the client
// (src/romm/http.js). Its answers have the shape of a real RomM 5.4.1
// (test/fixtures/romm/, recorded from it and trimmed): test/client.test.js
// reads both. Platforms and games, scans that run and finish, a client API
// token or a username and password (FastAPI answers), an account that may not
// run tasks, a server that does not answer.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/romm/${name}.json`, import.meta.url), 'utf8'));

export const TOKEN = 'rmm_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
export const USERNAME = 'gladys';
export const PASSWORD = 'correct horse';

const json = (status, body) => ({
  status,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const PLATFORM_NAMES = {
  nes: 'Nintendo Entertainment System',
  snes: 'Super Nintendo Entertainment System',
  gba: 'Game Boy Advance',
  md: 'Sega Mega Drive/Genesis',
};

export class FakeRomm {
  /**
   * @param {object} [options]
   * @param {boolean} [options.admin] false: the tasks answer 403
   * @param {string} [options.version]
   */
  constructor({ admin = true, version = '5.4.1' } = {}) {
    this.admin = admin;
    this.version = version;
    this.online = true;
    this.platforms = new Map(); // slug -> { id, name }
    this.roms = []; // oldest first
    this.tasks = []; // newest first
    this.requests = [];
    this.nextId = 1;
    this.nextTask = 1;
    this.clock = Date.parse('2026-10-30T12:00:00Z');
  }

  platform(slug) {
    if (!this.platforms.has(slug)) {
      this.platforms.set(slug, {
        id: this.platforms.size + 1,
        name: PLATFORM_NAMES[slug] ?? slug,
      });
    }
    return this.platforms.get(slug);
  }

  /** A game added to the library now. Returns its id. */
  add(name, slug, { identified = false, identifying = false, size = 131_072, at } = {}) {
    const platform = this.platform(slug);
    const id = this.nextId++;
    const created = at ?? (this.now ? this.now() : (this.clock += 60_000));
    this.roms.push({
      id,
      name,
      slug,
      platformId: platform.id,
      identified,
      identifying,
      size,
      created,
    });
    return id;
  }

  /** A scan task (newest first in the task list). Returns its id. */
  scanTask({ status = 'started', name = 'Quick Scan', stats = {}, started, ended } = {}) {
    const template = fixture('task-scan-finished');
    const id = `00000000-0000-4000-8000-${String(this.nextTask++).padStart(12, '0')}`;
    const now = this.now ? this.now() : this.clock;
    const task = {
      ...template,
      task_name: name,
      task_id: id,
      status,
      started_at: new Date(started ?? now - 120_000).toISOString(),
      ended_at:
        status === 'finished' || status === 'failed' ? new Date(ended ?? now).toISOString() : null,
      meta: { scan_stats: { ...template.meta.scan_stats, ...stats } },
    };
    this.tasks.unshift(task);
    return id;
  }

  finish(id, stats = {}) {
    const task = this.tasks.find((item) => item.task_id === id);
    task.status = 'finished';
    task.ended_at = new Date(this.now ? this.now() : this.clock).toISOString();
    Object.assign(task.meta.scan_stats, stats);
  }

  romJson(rom) {
    const template = fixture('roms').items[0];
    const platform = this.platforms.get(rom.slug);
    return {
      ...template,
      id: rom.id,
      platform_id: platform.id,
      platform_slug: rom.slug,
      platform_fs_slug: rom.slug,
      platform_display_name: platform.name,
      fs_name: `${rom.name}.${rom.slug}`,
      fs_name_no_tags: rom.name,
      fs_extension: rom.slug,
      fs_size_bytes: rom.size,
      name: rom.name,
      is_identifying: rom.identifying,
      is_identified: rom.identified,
      is_unidentified: !rom.identified,
      created_at: new Date(rom.created).toISOString().replace(/\.\d+Z$/, '+00:00'),
    };
  }

  authorized(headers) {
    const auth = headers.authorization ?? '';
    const basic = `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')}`;
    return auth === `Bearer ${TOKEN}` || auth === basic;
  }

  /** The `request` seam of the client. */
  handle(url, { method = 'GET', headers = {}, body } = {}) {
    const target = new URL(url);
    const path = target.pathname;
    const query = target.searchParams;
    this.requests.push({ method, path: `${path}${target.search}`, body, headers });
    if (!path.startsWith('/api/')) {
      return { status: 200, headers: { 'content-type': 'text/html' }, body: '<!doctype html>' };
    }
    if (path === '/api/heartbeat') {
      return json(200, {
        ...fixture('heartbeat'),
        SYSTEM: { ...fixture('heartbeat').SYSTEM, VERSION: this.version },
      });
    }
    if (!this.authorized(headers)) {
      return json(401, { detail: 'Not authenticated' });
    }
    if (path === '/api/stats') {
      return json(200, {
        ...fixture('stats'),
        PLATFORMS: new Set(this.roms.map((rom) => rom.slug)).size,
        ROMS: this.roms.length,
        TOTAL_FILESIZE_BYTES: this.roms.reduce((sum, rom) => sum + rom.size, 0),
      });
    }
    if (path === '/api/roms' && method === 'GET') {
      let items = [...this.roms];
      if (query.get('matched') === 'false') {
        items = items.filter((rom) => !rom.identified);
      }
      if (query.get('order_by') === 'id' && query.get('order_dir') === 'desc') {
        items.reverse();
      }
      const limit = Number(query.get('limit') ?? 50);
      return json(200, {
        items: items.slice(0, limit).map((rom) => this.romJson(rom)),
        total: items.length,
        limit,
        offset: 0,
        char_index: {},
        rom_id_index: [],
        filter_values: {},
      });
    }
    if (path.startsWith('/api/tasks') && !this.admin) {
      return json(403, { detail: 'Forbidden' });
    }
    if (path === '/api/tasks/status') {
      return json(200, this.tasks);
    }
    if (path === '/api/tasks/scan' && method === 'POST') {
      if (this.version.startsWith('5.3')) {
        return json(405, { detail: 'Method Not Allowed' });
      }
      if (this.tasks.some((task) => ['queued', 'started'].includes(task.status))) {
        return json(409, { detail: 'Quick Scan is already running' });
      }
      const type = JSON.parse(body ?? '{}').type ?? 'quick';
      this.lastScan = type;
      const name = `${type[0].toUpperCase()}${type.slice(1)} Scan`;
      const id = this.scanTask({ status: 'queued', name });
      const { task_id: taskId, created_at: createdAt, enqueued_at: enqueuedAt } = this.tasks[0];
      return json(200, {
        task_key: null,
        task_name: name,
        task_id: taskId ?? id,
        status: 'queued',
        created_at: createdAt,
        enqueued_at: enqueuedAt,
      });
    }
    return json(404, { detail: 'Not Found' });
  }
}

/** A fake network: `request(url, options)` reaches the RomM at its base URL. */
export function createNetwork(servers) {
  const request = async (url, options) => {
    for (const [base, server] of Object.entries(servers)) {
      if (url.startsWith(base)) {
        if (!server.online) {
          const error = new Error('connect ECONNREFUSED');
          error.code = 'ECONNREFUSED';
          throw error;
        }
        return server.handle(url, options);
      }
    }
    const error = new Error('getaddrinfo ENOTFOUND');
    error.code = 'ENOTFOUND';
    throw error;
  };
  return { request };
}
