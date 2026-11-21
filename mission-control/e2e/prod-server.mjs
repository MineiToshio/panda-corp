#!/usr/bin/env node
// DR-158: one production artifact for all browser projects, with the same fixture env at build/start.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const action = process.argv[2];
if (action !== "build" && action !== "start")
  throw new Error("usage: prod-server.mjs build | start <port> [--slot <index>]");
const port = process.argv[3];
if (
  action === "start" &&
  (!port || !/^\d+$/.test(port) || Number(port) > 65535 || Number(port) < 1)
)
  throw new Error("start requires a valid port");
const slot = action === "start" && process.argv.length > 4 ? process.argv[5] : undefined;
if (
  action === "start" &&
  process.argv.length > 4 &&
  (process.argv[4] !== "--slot" ||
    process.argv.length !== 6 ||
    !/^\d+$/.test(slot ?? "") ||
    !Number.isSafeInteger(Number(slot)))
)
  throw new Error("Invalid slot index");
const slotRoot = slot === undefined ? undefined : path.resolve("test-results/e2e-slots", slot);
function rejectSymlinks(file) {
  let current = path.resolve(file);
  const root = process.cwd();
  while (current !== root) {
    // lstat also catches dangling links; existsSync would silently skip those inputs.
    try {
      if (fs.lstatSync(current).isSymbolicLink())
        throw new Error(`Fixture slots cannot contain symbolic links: ${current}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) throw new Error("Fixture path escapes project");
    current = parent;
  }
}
if (slotRoot) {
  // Copy the working tree, including new fixtures, but never ignored run residue or empty dirs.
  // Copies stay inside the repository so ancestor-based Git readers retain their repository.
  const files = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "e2e/fixtures"],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);
  rejectSymlinks(slotRoot);
  for (const file of files) rejectSymlinks(file);
  fs.rmSync(slotRoot, { recursive: true, force: true });
  for (const file of files) {
    if (!fs.existsSync(file)) continue; // A working-tree deletion is also part of the fixture input.
    if (!fs.lstatSync(file).isFile()) throw new Error(`Fixture is not a regular file: ${file}`);
    const target = path.join(slotRoot, path.relative("e2e", file));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file, target);
  }
}
const envFile = path.resolve("e2e/server-env.json");
const fixtureEnv = fs.existsSync(envFile) ? JSON.parse(fs.readFileSync(envFile, "utf8")) : {};
for (const [key, raw] of Object.entries(fixtureEnv)) {
  const value = key === "PORT" ? String(raw) : raw;
  if (typeof value !== "string") throw new Error(`Invalid server environment: ${key}`);
  if (slotRoot && value.startsWith("./e2e/")) {
    if (!value.startsWith("./e2e/fixtures/") || value.split("/").includes(".."))
      throw new Error(`Slot environment must point inside fixtures: ${key}`);
    fixtureEnv[key] = path.join(slotRoot, value.slice("./e2e/".length));
  } else fixtureEnv[key] = value.startsWith(".") ? path.resolve(value) : value;
}
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
