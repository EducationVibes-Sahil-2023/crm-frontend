// Storage-architecture guard rails.
//
// These tests read the source tree and fail if browser storage creeps back into
// a data path. They are deliberately static: the guarantee we care about is
// "no module reads or writes app data outside the database", and that is a
// property of the code, not of any one runtime scenario. A runtime test could
// only ever prove it for the paths it happened to exercise.
//
// Run: node --test tests/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = join(ROOT, "src");

/** Every .ts/.tsx file under src/, as repo-relative POSIX paths. */
function sourceFiles(dir = SRC, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const FILES = sourceFiles().map((f) => ({
  path: relative(SRC, f).split(sep).join("/"),
  text: readFileSync(f, "utf8"),
}));

/** Lines that actually execute, i.e. not `//` comments. */
function codeLines(text) {
  return text
    .split("\n")
    .map((line, i) => ({ n: i + 1, line }))
    .filter(({ line }) => !line.trim().startsWith("//") && !line.trim().startsWith("*"));
}

function hits(pattern) {
  const found = [];
  for (const { path, text } of FILES) {
    for (const { n, line } of codeLines(text)) {
      if (pattern.test(line)) found.push(`${path}:${n}  ${line.trim()}`);
    }
  }
  return found;
}

// The ONLY files allowed to touch localStorage, and why. The session token is
// what authenticates every request to the database, so it cannot itself be
// stored there — this is a hard technical constraint, not a leftover.
const SESSION_ONLY = new Set([
  "lib/auth.ts",          // nexus_token / nexus_user — the workspace session
  "lib/superAdmin.ts",    // super_admin_jwt / session — the platform-owner session
  "lib/activity.ts",      // reads the nexus_user cache (auth<->activity import cycle)
]);

describe("no browser storage in data paths", () => {
  test("localStorage appears only in the session-credential files", () => {
    const offenders = hits(/\blocalStorage\b/)
      .filter((h) => !SESSION_ONLY.has(h.split(":")[0]));

    assert.deepEqual(
      offenders,
      [],
      `localStorage found outside the allow-list:\n${offenders.join("\n")}`,
    );
  });

  test("the allow-listed files only store session credentials, nothing else", () => {
    const allowedKeys = /nexus_token|nexus_user|super_admin_jwt|super_admin_session_v1|TOKEN_KEY|USER_KEY|JWT_KEY|\bKEY\b/;
    const bad = [];
    for (const file of SESSION_ONLY) {
      const entry = FILES.find((f) => f.path === file);
      assert.ok(entry, `allow-listed file ${file} no longer exists — update the list`);
      for (const { n, line } of codeLines(entry.text)) {
        if (/\blocalStorage\.(get|set|remove)Item\(/.test(line) && !allowedKeys.test(line)) {
          bad.push(`${file}:${n}  ${line.trim()}`);
        }
      }
    }
    assert.deepEqual(bad, [], `Non-session data in localStorage:\n${bad.join("\n")}`);
  });

  test("sessionStorage is never used", () => {
    assert.deepEqual(hits(/\bsessionStorage\b/), []);
  });

  test("no client-side database (IndexedDB / WebSQL / local DB wrappers)", () => {
    assert.deepEqual(hits(/\bindexedDB\b|\bopenDatabase\(|\blocalforage\b|\bnew Dexie\b|\bPouchDB\b/), []);
  });

  test("no document.cookie writes smuggling data past the checks above", () => {
    assert.deepEqual(hits(/document\.cookie\s*=/), []);
  });
});

describe("live-refresh wiring", () => {
  // Before the migration these modules listened for the cross-tab `storage`
  // event. Nothing writes those keys any more, so such a listener can never
  // fire — the module would silently have no live-refresh path at all.
  test('no module still listens for the dead "storage" event, except the session store', () => {
    const offenders = hits(/addEventListener\(\s*["']storage["']/)
      .filter((h) => !h.startsWith("lib/superAdmin.ts"));

    assert.deepEqual(
      offenders,
      [],
      `Dead cross-tab listener (localStorage no longer holds this data):\n${offenders.join("\n")}`,
    );
  });

  test("every module that reads the store also subscribes to its changes", () => {
    // If a file calls dbGet() inside a React component/hook it needs STORE_EVENT
    // (or a module-level subscribe helper) or it will render stale data forever.
    const missing = [];
    for (const { path, text } of FILES) {
      const usesStore = /\bdbGet\s*</.test(text) || /\bdbGet\s*\(/.test(text);
      const isComponent = /useState|useEffect/.test(text);
      if (!usesStore || !isComponent) continue;
      const subscribes =
        text.includes("STORE_EVENT") ||
        /subscribe[A-Z]\w*\(/.test(text) ||
        text.includes("hydrate");
      if (!subscribes) missing.push(path);
    }
    assert.deepEqual(
      missing,
      [],
      `Reads the store but never re-reads on change:\n${missing.join("\n")}`,
    );
  });
});

describe("legacy local-first code is gone", () => {
  test("freshStart.ts (the localStorage seed-blanking shim) is deleted", () => {
    assert.equal(
      existsSync(join(SRC, "lib/freshStart.ts")),
      false,
      "freshStart.ts blanked localStorage keys; it has no purpose once data is in the DB",
    );
  });

  test("nothing imports freshStart", () => {
    assert.deepEqual(hits(/freshStart/), []);
  });

  test("no hardcoded demo tenant seed rows", () => {
    // loadTenants()/DEFAULT_TENANTS served five fake companies out of
    // localStorage; the real list comes from GET /api/tenants.
    assert.deepEqual(hits(/DEFAULT_TENANTS|loadTenants|saveTenants/), []);
  });

  test("the trial signup keeps no client-side record", () => {
    // The prospect is persisted by captureLead() -> leads table instead.
    assert.deepEqual(hits(/loadTrial|startTrial\(|consumePrefillEmail/), []);
  });
});

describe("migrated modules read from the database", () => {
  const EXPECTED = {
    "lib/mobile.ts": "dbStore",            // app-lock / security settings
    "lib/notify.ts": "dbStore",            // notification channel prefs
    "lib/pushConfig.ts": "dbStore",        // web-push configuration
    "lib/setup.ts": "dbStore",             // lookup lists fallback tier
    "lib/leadStore.ts": "dbStore",         // blob-migration guard flag
    "lib/vendors.ts": "dbStore",
    "lib/activity.ts": "dbStore",
    "lib/adminMenu.ts": "superAdminPrefs", // console-scoped: no workspace token
  };

  for (const [file, store] of Object.entries(EXPECTED)) {
    test(`${file} persists through ${store}`, () => {
      const entry = FILES.find((f) => f.path === file);
      assert.ok(entry, `${file} not found`);
      assert.match(
        entry.text,
        new RegExp(`from "@/lib/${store}"`),
        `${file} should import its persistence from @/lib/${store}`,
      );
    });
  }

  test("the admin console never reaches for the workspace store", () => {
    // AdminChrome and the admin menu run with only a super-admin JWT; app_store
    // is unreachable from there, so using dbStore would silently no-op.
    for (const file of ["lib/adminMenu.ts", "app/admin/(panel)/AdminChrome.tsx"]) {
      const entry = FILES.find((f) => f.path === file);
      assert.ok(entry, `${file} not found`);
      assert.doesNotMatch(
        entry.text,
        /from "@\/lib\/dbStore"/,
        `${file} must use superAdminPrefs, not dbStore`,
      );
    }
  });
});
