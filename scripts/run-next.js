// Launches `next <dev|start>` on the PORT from .env.local (falling back to the
// PORT env var, then 3000). Next's CLI resolves its port before it loads
// .env.local, so we read the file here and pass --port explicitly.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function portFromEnvFile() {
  for (const name of [".env.local", ".env"]) {
    try {
      const txt = fs.readFileSync(path.join(__dirname, "..", name), "utf8");
      const m = txt.match(/^\s*PORT\s*=\s*"?(\d+)"?/m);
      if (m) return m[1];
    } catch {
      /* file may not exist — try the next one */
    }
  }
  return null;
}

const port = process.env.PORT || portFromEnvFile() || "3000";
const sub = process.argv[2] || "dev";
const rest = process.argv.slice(3);
// Run Next's JS CLI directly with `node` — avoids the Windows .cmd spawn (EINVAL)
// and needs no shell, so it works the same on every platform.
const nextCli = path.join(__dirname, "..", "node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [nextCli, sub, "--port", port, ...rest], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
