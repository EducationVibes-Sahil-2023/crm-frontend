// Runtime behaviour of the super-admin console preference store.
//
// The admin console holds only a super-admin JWT — never a workspace token — so
// it cannot reach `app_store`. This module is how its state (sidebar rail, menu
// layout, notification read marker) lives in the database instead of the
// browser. As with the dbStore suite, no localStorage exists in this
// environment, so a hidden fallback would throw rather than pass silently.

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buildModules } from "./build-modules.mjs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

let prefs;
let superStub;
let server;
let moduleUrl;
let instance = 0;

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
  };
  globalThis.window = win;
  globalThis.document = {
    visibilityState: "visible",
    addEventListener: win.addEventListener,
    removeEventListener: win.removeEventListener,
  };
  globalThis.Event = class Event { constructor(type) { this.type = type; } };
}

/** Fake /api/super-admin/prefs, mirroring the controller's merge semantics. */
function installFakeServer() {
  const state = { stored: {}, requests: [], offline: false, unauthorized: false };

  globalThis.fetch = async (url, opts = {}) => {
    state.requests.push({ url: String(url), method: opts.method ?? "GET" });
    if (state.offline) throw new Error("network down");
    if (state.unauthorized) return { ok: false, status: 401, json: async () => ({}) };

    if (opts.method === "POST") {
      // Partial merge; a null value deletes the key (matches SuperAdmin::savePrefs).
      for (const [k, v] of Object.entries(JSON.parse(opts.body))) {
        if (v === null) delete state.stored[k];
        else state.stored[k] = v;
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, prefs: state.stored }) };
    }
    return { ok: true, status: 200, json: async () => ({ prefs: { ...state.stored } }) };
  };

  return state;
}

const flushWrites = () => new Promise((r) => setTimeout(r, 600));

before(async () => {
  const out = buildModules();
  installFakeDom();
  server = installFakeServer();
  moduleUrl = pathToFileURL(join(out, "lib/superAdminPrefs.js")).href;
  superStub = await import(pathToFileURL(join(out, "lib/superAdmin.js")).href);
});

beforeEach(async () => {
  if (prefs) prefs.resetSuperAdminPrefs();
  instance += 1;
  prefs = await import(`${moduleUrl}?instance=${instance}`);

  server.stored = {};
  server.requests.length = 0;
  server.offline = false;
  server.unauthorized = false;
  superStub.__setToken("super-token");
});

describe("console preferences come from the database", () => {
  test("hydrate loads stored preferences from the API", async () => {
    server.stored = { admin_sidebar_collapsed: true, nexus_admin_notif_seen_v1: 42 };

    await prefs.hydrateSuperAdminPrefs(true);

    assert.equal(prefs.prefGet("admin_sidebar_collapsed", false), true);
    assert.equal(prefs.prefGet("nexus_admin_notif_seen_v1", 0), 42);
    assert.equal(prefs.isPrefsReady(), true);
  });

  test("an unknown preference returns the caller's default", async () => {
    await prefs.hydrateSuperAdminPrefs(true);
    assert.equal(prefs.prefGet("never_set", "fallback"), "fallback");
  });

  test("nothing is requested when the owner is not signed in", async () => {
    superStub.__setToken(null);
    await prefs.hydrateSuperAdminPrefs(true);
    assert.equal(server.requests.length, 0, "no token means no call");
    assert.equal(prefs.isPrefsReady(), false);
  });
});

describe("console preferences are written to the database", () => {
  test("prefSet persists to the API", async () => {
    await prefs.hydrateSuperAdminPrefs(true);
    prefs.prefSet("admin_sidebar_collapsed", true);
    await flushWrites();

    assert.equal(server.stored.admin_sidebar_collapsed, true);
    assert.equal(server.requests.filter((r) => r.method === "POST").length, 1);
  });

  test("the new value reads back immediately", async () => {
    await prefs.hydrateSuperAdminPrefs(true);
    prefs.prefSet("admin_sidebar_collapsed", true);
    assert.equal(prefs.prefGet("admin_sidebar_collapsed", false), true);
  });

  test("a nested menu config round-trips through the API intact", async () => {
    const menu = { side: "right", items: [{ key: "clients", hidden: false }] };
    await prefs.hydrateSuperAdminPrefs(true);
    prefs.prefSet("admin_menu_v1", menu);
    await flushWrites();

    prefs.resetSuperAdminPrefs();
    await prefs.hydrateSuperAdminPrefs(true);
    assert.deepEqual(prefs.prefGet("admin_menu_v1", null), menu);
  });

  test("saving one preference does not clobber another", async () => {
    server.stored = { nexus_admin_notif_seen_v1: 99 };
    await prefs.hydrateSuperAdminPrefs(true);

    prefs.prefSet("admin_sidebar_collapsed", true);
    await flushWrites();

    assert.equal(server.stored.nexus_admin_notif_seen_v1, 99, "the untouched key survives");
    assert.equal(server.stored.admin_sidebar_collapsed, true);
  });

  test("resetting the menu clears the stored key", async () => {
    server.stored = { admin_menu_v1: { side: "right" } };
    await prefs.hydrateSuperAdminPrefs(true);

    prefs.prefSet("admin_menu_v1", null);   // what resetAdminMenu() does
    await flushWrites();

    assert.equal("admin_menu_v1" in server.stored, false, "the key must be removed server-side");
  });

  test("a change notifies subscribers", async () => {
    await prefs.hydrateSuperAdminPrefs(true);
    let fired = 0;
    window.addEventListener(prefs.SA_PREFS_EVENT, () => { fired += 1; });
    prefs.prefSet("admin_sidebar_collapsed", true);
    assert.equal(fired, 1);
  });
});

describe("live sync and teardown", () => {
  test("a change made in another session is picked up by a poll", async () => {
    await prefs.hydrateSuperAdminPrefs(true);
    assert.equal(prefs.prefGet("admin_sidebar_collapsed", false), false);

    server.stored.admin_sidebar_collapsed = true;   // another browser saved it
    await prefs.syncSuperAdminPrefs();

    assert.equal(prefs.prefGet("admin_sidebar_collapsed", false), true);
  });

  test("a poll does not overwrite a preference still being saved", async () => {
    server.stored = { admin_sidebar_collapsed: false };
    await prefs.hydrateSuperAdminPrefs(true);

    prefs.prefSet("admin_sidebar_collapsed", true);   // debounced, in flight
    await prefs.syncSuperAdminPrefs();                // server still says false

    assert.equal(
      prefs.prefGet("admin_sidebar_collapsed", false),
      true,
      "the pending local change must win",
    );
  });

  test("an offline backend leaves defaults in place instead of throwing", async () => {
    server.offline = true;
    await prefs.hydrateSuperAdminPrefs(true);
    assert.equal(prefs.isPrefsReady(), true, "the console must still render");
    assert.equal(prefs.prefGet("admin_sidebar_collapsed", false), false);
  });

  test("sign-out clears the cache so the next owner loads their own", async () => {
    server.stored = { admin_sidebar_collapsed: true };
    await prefs.hydrateSuperAdminPrefs(true);
    assert.equal(prefs.prefGet("admin_sidebar_collapsed", false), true);

    prefs.resetSuperAdminPrefs();

    assert.equal(prefs.prefGet("admin_sidebar_collapsed", false), false);
    assert.equal(prefs.isPrefsReady(), false, "the next session must re-read");
  });
});
