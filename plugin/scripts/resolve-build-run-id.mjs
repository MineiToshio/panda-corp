#!/usr/bin/env node
/** Resolve a logical build run without making the owner copy technical IDs between runtimes. */
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const value = (name, fallback = "") => { const index = args.indexOf(`--${name}`); return index < 0 ? fallback : args[index + 1] || ""; };
const project = path.resolve(value("project", "."));
const runtime = value("runtime");
const mode = value("mode", "auto");
const newId = value("new-id");
const validId = (input) => /^[A-Za-z0-9._:-]{1,160}$/.test(input);
const scalar = (body, key) => body.match(new RegExp(`^${key}:\\s*(.*)$`, "m"))?.[1]?.trim().replace(/^['"]|['"]$/g, "") || "";
const fail = (message) => { console.error(`ERROR: ${message}`); process.exit(3); };

if (!new Set(["claude", "codex"]).has(runtime) || !validId(newId)) fail("invalid runtime or generated run id");
let status;
try { status = await readFile(path.join(project, ".pandacorp/status.yaml"), "utf8"); } catch { fail("project status is unavailable"); }
const priorId = scalar(status, "build_run_id");
const priorRuntime = scalar(status, "build_runtime");
const phase = scalar(status, "phase");
const running = scalar(status, "running");
const leaseExists = await lstat(path.join(project, ".pandacorp/run/build.lease")).then(() => true).catch((error) => error.code === "ENOENT" ? false : fail("cannot inspect build lease"));

if (mode === "new") {
  console.log(JSON.stringify({ run_id: newId, continuation: false, reason: "explicit-new-run", previous_runtime: priorRuntime || null }));
} else if (mode !== "auto") {
  if (!validId(mode) || mode !== priorId) fail("explicit continuation id does not match canonical build_run_id");
  console.log(JSON.stringify({ run_id: priorId, continuation: true, reason: "explicit-restart-or-continuation", previous_runtime: priorRuntime || null }));
} else if (running === "false" && !leaseExists && phase === "implementation" && validId(priorId) && new Set(["claude", "codex"]).has(priorRuntime) && priorRuntime !== runtime) {
  console.log(JSON.stringify({ run_id: priorId, continuation: true, reason: "automatic-cross-runtime-cold-continuation", previous_runtime: priorRuntime }));
} else {
  console.log(JSON.stringify({ run_id: newId, continuation: false, reason: "automatic-new-run", previous_runtime: priorRuntime || null }));
}
