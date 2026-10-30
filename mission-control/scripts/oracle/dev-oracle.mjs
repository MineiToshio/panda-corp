import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { oracleEnv } from "../../src/lib/config/oracleEnv.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = oracleEnv(root);
const required = [
  env.PANDACORP_FACTORY_ROOT,
  env.HOME,
  env.PANDACORP_EVENTS_FILE,
  env.PANDACORP_ACCOUNTS_FILE,
  env.MC_GIT_FIXTURE,
];
if (!required.every(existsSync)) {
  console.error(
    "Oracle fixtures missing. Run: node docs/design/prototype/scripts/make-fixtures.mjs",
  );
  process.exitCode = 1;
} else {
  const child = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "dev",
      "--hostname",
      "127.0.0.1",
      ...process.argv.slice(2),
    ],
    { cwd: root, env: { ...process.env, ...env }, stdio: "inherit" },
  );
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("error", () => {
    console.error("Unable to start oracle server");
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}
