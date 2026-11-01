#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const helper = new URL("./check-build-liveness.sh", import.meta.url).pathname;
const project = await mkdtemp(path.join(os.tmpdir(), "pc-liveness-"));
const state = path.join(project, ".pandacorp");
await mkdir(path.join(state, "run/build.lease"), { recursive: true });
const status = path.join(state, "status.yaml");
const lease = path.join(state, "run/build.lease/lease.json");
const stale = "2000-01-01T00:00:00Z";
await writeFile(status, `running: true\nsupervisor_heartbeat: ${stale}\nlast_event_at: ${stale}\n`);
for (const [name, value, code, verdict] of [
  ["worker running, fresh lease, stale status", JSON.stringify({ renewed_at: new Date().toISOString(), ttl_seconds: 60 }), 1, "RUNNING"],
  ["stale lease and stale status", JSON.stringify({ renewed_at: stale, ttl_seconds: 60 }), 2, "STALE"],
  ["malformed lease blocks mutation", "{broken", 1, "RUNNING"],
  ["invalid lease TTL blocks mutation", JSON.stringify({ renewed_at: stale, ttl_seconds: "60" }), 1, "RUNNING"],
]) {
  await writeFile(lease, value);
  const result = spawnSync("bash", [helper, status], { encoding: "utf8" });
  assert.equal(result.status, code, `${name}: ${result.stderr}`);
  assert.equal(result.stdout.trim(), verdict, name);
  console.log(`PASS ${name}`);
}
await writeFile(status, "running: false\n");
await writeFile(lease, JSON.stringify({ renewed_at: new Date().toISOString(), ttl_seconds: 60 }));
assert.equal(spawnSync("bash", [helper, status]).status, 1, "fresh lease fences stale idle projection too");
console.log("RESULT: 5 passed, 0 failed");
