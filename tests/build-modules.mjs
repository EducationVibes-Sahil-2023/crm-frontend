// Compiles the storage modules under test to plain JS so node:test can import
// them. We test the REAL source rather than a hand-written copy, so the tests
// fail if dbStore's behaviour changes.
//
// tsc leaves the "@/lib/x" path alias in the emitted output (it rewrites types,
// not module specifiers), so we rewrite those to relative paths afterwards.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const OUT = join(ROOT, "tests", ".compiled");

const OUTPUTS = ["lib/dbStore.js", "lib/superAdminPrefs.js", "lib/auth.js", "lib/superAdmin.js"];
const SOURCES = ["src/lib/dbStore.ts", "src/lib/superAdminPrefs.ts"];

/** True when every output exists and is newer than every source. */
function upToDate() {
  if (!OUTPUTS.every((f) => existsSync(join(OUT, f)))) return false;
  const newestSource = Math.max(...SOURCES.map((f) => statSync(join(ROOT, f)).mtimeMs));
  const oldestOutput = Math.min(...OUTPUTS.map((f) => statSync(join(OUT, f)).mtimeMs));
  return oldestOutput > newestSource;
}

export function buildModules() {
  // Test files run in parallel processes and each calls this. Rebuilding
  // unconditionally would let one process wipe the directory while another is
  // importing from it, so skip the work when the output is already current.
  if (upToDate()) return OUT;

  if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  // Invoke the TypeScript compiler through node directly — spawning the npx
  // shim needs a shell on Windows and fails with EINVAL otherwise.
  try {
    execFileSync(
      process.execPath,
      [
        join(ROOT, "node_modules", "typescript", "bin", "tsc"),
        "src/lib/dbStore.ts",
        "src/lib/superAdminPrefs.ts",
        "--outDir", "tests/.compiled",
        "--module", "esnext",
        "--target", "es2022",
        "--moduleResolution", "bundler",
        "--skipLibCheck",
        "--rootDir", "src",
      ],
      { cwd: ROOT, stdio: "pipe" },
    );
  } catch (err) {
    // tsc exits non-zero because it cannot resolve the "@/lib/*" alias without
    // the project tsconfig — but it still emits the JS, and we swap those
    // imports for test doubles below. Any OTHER failure is real.
    const out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    const onlyAliasErrors = out
      .split("\n")
      .filter((l) => l.includes("error TS"))
      .every((l) => l.includes("TS2307") && l.includes("@/lib/"));
    if (!onlyAliasErrors) throw new Error(`tsc failed:\n${out}`);
  }

  for (const f of ["lib/dbStore.js", "lib/superAdminPrefs.js"]) {
    if (!existsSync(join(OUT, f))) throw new Error(`tsc did not emit ${f}`);
  }

  // "@/lib/auth" -> "./auth.js" etc., and add the .js extensions ESM needs.
  for (const file of ["lib/dbStore.js", "lib/superAdminPrefs.js"]) {
    const path = join(OUT, file);
    let text = readFileSync(path, "utf8");
    text = text.replace(/from ["']@\/lib\/([^"']+)["']/g, 'from "./$1.js"');
    writeFileSync(path, text);
  }

  // dbStore imports getToken from auth, and superAdminPrefs imports
  // getSuperAdminToken. Both read localStorage, which is exactly what must not
  // exist here — so provide test doubles the specs can drive directly.
  writeFileSync(
    join(OUT, "lib/auth.js"),
    `export let __token = "test-token";
export function __setToken(t) { __token = t; }
export function getToken() { return __token; }
`,
  );
  writeFileSync(
    join(OUT, "lib/superAdmin.js"),
    `export let __token = "super-token";
export function __setToken(t) { __token = t; }
export function getSuperAdminToken() { return __token; }
`,
  );

  return OUT;
}

// Run directly (`node tests/build-modules.mjs`) to prebuild before the suite.
// Comparing against pathToFileURL keeps this working on Windows, where
// process.argv[1] is a backslash path that never equals a file:// URL.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log("compiled to", buildModules());
}
