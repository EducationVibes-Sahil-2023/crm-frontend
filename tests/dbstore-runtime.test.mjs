// Runtime behaviour of the workspace store — the module every migrated screen
// now reads its data through.
//
// These exercise the REAL src/lib/dbStore.ts (compiled by build-modules.mjs),
// with a fake backend and a fake DOM. The point is to prove the module gets its
// data from the API and nothing else: there is deliberately NO localStorage in
// this environment, so any hidden fallback to browser storage would throw.

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buildModules } from "./build-modules.mjs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

let db;      // the module under test
let authStub;
let server;  // fake backend state

/** Minimal window/document so the module's browser guards are satisfied. */
function installFakeDom() {
  const listeners = new Map();
  const win = {
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener: (type, fn) => listeners.get(type)?.delete(fn),
    dispatchEvent: (evt) => {
      for (const fn of listeners.get(evt.type) ?? []) fn(evt);
      return true;
    },
    __listeners: listeners,
  };
  globalThis.window = win;
  globalThis.document = {
    visibilityState: "visible",
    addEventListener: win.addEventListener,
    removeEventListener: win.removeEventListener,
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type) { this.type = type; }
  };
  globalThis.Event = class Event {
    constructor(type) { this.type = type; }
  };
  // NOTE: no localStorage / sessionStorage is defined. If dbStore ever reaches
  // for browser storage, these tests crash with a ReferenceError — by design.
  return win;
}

/** A fake `app_store` backend: rows keyed by store_key, each with a version. */
function installFakeServer() {
  const state = {
    rows: new Map(),          // key -> { value, version }
    clock: 1000,              // fake monotonic "updated_at"
    requests: [],             // every request, for assertions
    failNext: 0,              // force N failures (circuit-breaker tests)
    offline: false,
  };

  const stamp = () => `2026-09-01 00:00:${String(state.clock).slice(-2)}`;

  globalThis.fetch = async (url, opts = {}) => {
    state.requests.push({ url: String(url), method: opts.method ?? "GET" });
    if (state.offline) throw new Error("network down");
    if (state.failNext > 0) {
      state.failNext -= 1;
      return { ok: false, status: 500, json: async () => ({}) };
    }

    const u = new URL(String(url), "http://test.local");
    const put = /\/store\/([^/]+)$/.exec(u.pathname);

    if (opts.method === "PUT" && put) {
      state.clock += 1;
      state.rows.set(decodeURIComponent(put[1]), {
        value: JSON.parse(opts.body).data,
        version: stamp(),
      });
      return { ok: true, status: 200, json: async () => ({ saved: true }) };
    }

    // GET /store  (optionally ?since=)
    const since = u.searchParams.get("since");
    const data = {};
    let version = null;
    for (const [k, row] of state.rows) {
      if (!since || row.version >= since) data[k] = row.value;
      if (version === null || row.version > version) version = row.version;
    }
    return { ok: true, status: 200, json: async () => ({ data, version }) };
  };

  return state;
}

/** dbSet debounces writes by 400ms; wait past that. */
const flushWrites = () => new Promise((r) => setTimeout(r, 600));

let moduleUrl;
let instance = 0;

before(async () => {
  const out = buildModules();
  installFakeDom();
  server = installFakeServer();
  moduleUrl = pathToFileURL(join(out, "lib/dbStore.js")).href;
  authStub = await import(pathToFileURL(join(out, "lib/auth.js")).href);
});

beforeEach(async () => {
  // A FRESH module instance per test. dbStore's circuit breaker is deliberately
  // module-global with a 30s cooldown that resetStore() does not clear (that is
  // correct for the app), so a re-import is the only way to isolate tests from
  // each other. The auth stub stays shared — dbStore imports it without the
  // cache-busting query, so it resolves to the same instance.
  // Tear the previous instance down first: a re-import gives fresh module state
  // but does NOT cancel debounce timers the old instance already scheduled, and
  // those would fire against the shared fake server mid-test.
  if (db) db.resetStore();

  instance += 1;
  db = await import(`${moduleUrl}?instance=${instance}`);

  server.rows.clear();
  server.requests.length = 0;
  server.failNext = 0;
  server.offline = false;
  server.clock = 1000;
  authStub.__setToken("test-token");
});

describe("reads come from the backend", () => {
  test("hydrate loads every key from the API into the cache", async () => {
    server.rows.set("mod_a", { value: { n: 1 }, version: "2026-09-01 00:00:01" });
    server.rows.set("mod_b", { value: [1, 2, 3], version: "2026-09-01 00:00:01" });

    await db.hydrateStore(true);

    assert.deepEqual(db.dbGet("mod_a", null), { n: 1 });
    assert.deepEqual(db.dbGet("mod_b", null), [1, 2, 3]);
    assert.equal(db.isStoreReady(), true);
  });

  test("an un-hydrated store returns the caller's default, never stale data", () => {
    assert.equal(db.dbGet("never_seen", "fallback"), "fallback");
  });

  test("a key absent from the database returns the default", async () => {
    await db.hydrateStore(true);
    assert.deepEqual(db.dbGet("missing", { empty: true }), { empty: true });
  });

  test("a null stored value falls back to the default rather than yielding null", async () => {
    server.rows.set("nulled", { value: null, version: "2026-09-01 00:00:01" });
    await db.hydrateStore(true);
    assert.equal(db.dbGet("nulled", "default"), "default");
  });

  test("hydrate issues a real HTTP request carrying the bearer token", async () => {
    await db.hydrateStore(true);
    const req = server.requests.find((r) => r.url.includes("/store"));
    assert.ok(req, "expected a request to /api/store");
  });
});

describe("writes go to the database", () => {
  test("dbSet persists to the backend, not just memory", async () => {
    await db.hydrateStore(true);
    db.dbSet("prefs", { theme: "dark" });
    await flushWrites();

    assert.deepEqual(
      server.rows.get("prefs")?.value,
      { theme: "dark" },
      "the value must reach the server",
    );
    const puts = server.requests.filter((r) => r.method === "PUT");
    assert.equal(puts.length, 1);
  });

  test("the value is readable immediately, before the write lands", async () => {
    await db.hydrateStore(true);
    db.dbSet("prefs", { theme: "dark" });
    // Synchronous read-back keeps the UI responsive while the PUT is in flight.
    assert.deepEqual(db.dbGet("prefs", null), { theme: "dark" });
  });

  test("rapid edits to one key collapse into a single request", async () => {
    await db.hydrateStore(true);
    db.dbSet("draft", "a");
    db.dbSet("draft", "ab");
    db.dbSet("draft", "abc");
    await flushWrites();

    const puts = server.requests.filter((r) => r.method === "PUT");
    assert.equal(puts.length, 1, "debounced to one write");
    assert.equal(server.rows.get("draft").value, "abc", "the last value wins");
  });

  test("a saved value survives a fresh hydrate — it really is in the backend", async () => {
    await db.hydrateStore(true);
    db.dbSet("persisted", { saved: true });
    await flushWrites();

    db.resetStore();                 // wipe the in-memory cache entirely
    assert.equal(db.dbGet("persisted", null), null, "cache is empty after reset");

    await db.hydrateStore(true);     // reload from the server alone
    assert.deepEqual(db.dbGet("persisted", null), { saved: true });
  });

  test("a change notifies subscribers so the UI can re-render", async () => {
    await db.hydrateStore(true);
    let fired = 0;
    window.addEventListener(db.STORE_EVENT, () => { fired += 1; });
    db.dbSet("x", 1);
    assert.equal(fired, 1);
  });
});

describe("live sync keeps the cache current", () => {
  test("a change made elsewhere is pulled in by a poll", async () => {
    await db.hydrateStore(true);

    // Another device writes directly to the database.
    server.clock += 1;
    server.rows.set("remote", { value: "from another session", version: "2026-09-01 00:00:02" });

    const changed = await db.syncStore();
    assert.equal(changed, true, "sync should report a change");
    assert.equal(db.dbGet("remote", null), "from another session");
  });

  test("a poll with nothing new reports no change and notifies nobody", async () => {
    server.rows.set("a", { value: 1, version: "2026-09-01 00:00:01" });
    await db.hydrateStore(true);

    let fired = 0;
    window.addEventListener(db.STORE_EVENT, () => { fired += 1; });

    const changed = await db.syncStore();
    assert.equal(changed, false, "an unchanged poll must be a no-op");
    assert.equal(fired, 0, "no spurious re-renders");
  });

  test("re-sent identical values do not count as a change", async () => {
    // The server's `since` comparison is inclusive, so each poll re-sends the
    // newest second's keys. The client must discard them silently.
    server.rows.set("a", { value: { deep: [1, 2] }, version: "2026-09-01 00:00:01" });
    await db.hydrateStore(true);

    const changed = await db.syncStore();
    assert.equal(changed, false, "identical payloads must not fire listeners");
  });

  test("a poll never reverts an edit that is still being saved", async () => {
    server.rows.set("field", { value: "server value", version: "2026-09-01 00:00:01" });
    await db.hydrateStore(true);

    db.dbSet("field", "what the user just typed");   // debounced, not yet sent
    await db.syncStore();                            // poll returns the OLD value

    assert.equal(
      db.dbGet("field", null),
      "what the user just typed",
      "an in-flight local edit must win over the stale server copy",
    );

    await flushWrites();
    assert.equal(server.rows.get("field").value, "what the user just typed");
  });

  test("sync is skipped when there is no session token", async () => {
    await db.hydrateStore(true);
    authStub.__setToken(null);
    server.requests.length = 0;

    const changed = await db.syncStore();
    assert.equal(changed, false);
    assert.equal(server.requests.length, 0, "must not call the API unauthenticated");
  });

  test("sync does nothing before the store has hydrated", async () => {
    server.requests.length = 0;
    const changed = await db.syncStore();
    assert.equal(changed, false);
    assert.equal(server.requests.length, 0);
  });
});

describe("resilience", () => {
  test("an offline backend leaves readers on their defaults instead of throwing", async () => {
    server.offline = true;
    await db.hydrateStore(true);
    assert.equal(db.isStoreReady(), true, "the app must still render");
    assert.equal(db.dbGet("anything", "default"), "default");
  });

  test("repeated failures trip the circuit breaker instead of hammering the API", async () => {
    server.failNext = 99;
    for (let i = 0; i < 3; i += 1) await db.hydrateStore(true);

    server.requests.length = 0;
    await db.hydrateStore(true);
    assert.equal(server.requests.length, 0, "circuit open — no further calls");
  });

  test("a failed sync reports no change rather than clearing the cache", async () => {
    server.rows.set("keep", { value: "important", version: "2026-09-01 00:00:01" });
    await db.hydrateStore(true);

    server.offline = true;
    const changed = await db.syncStore();

    assert.equal(changed, false);
    assert.equal(db.dbGet("keep", null), "important", "cached data must survive an outage");
  });
});

describe("sign-out leaves nothing behind", () => {
  test("resetStore clears the cache so the next account cannot read it", async () => {
    server.rows.set("private", { value: "previous user's data", version: "2026-09-01 00:00:01" });
    await db.hydrateStore(true);
    assert.equal(db.dbGet("private", null), "previous user's data");

    db.resetStore();

    assert.equal(db.dbGet("private", null), null, "cache must be empty after sign-out");
    assert.equal(db.isStoreReady(), false, "the next session must re-hydrate");
  });

  test("resetStore stops the polling timer", async () => {
    await db.hydrateStore(true);
    db.startStoreSync();
    db.resetStore();
    // A stopped sync makes no requests even after the interval would have run.
    server.requests.length = 0;
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(server.requests.length, 0);
  });

  test("a pending write is dropped on sign-out rather than leaking to the next session", async () => {
    await db.hydrateStore(true);
    db.dbSet("leaky", "should not be sent");
    db.resetStore();
    await flushWrites();

    assert.equal(
      server.rows.has("leaky"),
      false,
      "the debounced write must be cancelled by sign-out",
    );
  });
});
