#!/usr/bin/env node
// DR-158: one production artifact for all browser projects, with the same fixture env at build/start.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const action = process.argv[2];
if (action !== "build" && action !== "start")
  throw new Error("usage: prod-server.mjs build | start <port>");
const envFile = path.resolve("e2e/server-env.json");
const fixtureEnv = fs.existsSync(envFile) ? JSON.parse(fs.readFileSync(envFile, "utf8")) : {};
for (const [key, value] of Object.entries(fixtureEnv)) {
  if (typeof value !== "string") throw new Error(`Invalid server environment: ${key}`);
  fixtureEnv[key] = value.startsWith(".") ? path.resolve(value) : value;
}
const port = process.argv[3];
if (
  action === "start" &&
  (!port || !/^\d+$/.test(port) || Number(port) > 65535 || Number(port) < 1)
)
  throw new Error("start requires a valid port");
const child = spawn(
  process.execPath,
  [
    path.resolve("node_modules/next/dist/bin/next"),
    action,
    ...(action === "start" ? ["--hostname", "127.0.0.1", "--port", port] : []),
  ],
  {
    stdio: "inherit",
    env: { ...process.env, ...fixtureEnv, NODE_ENV: "production" },
  },
);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
