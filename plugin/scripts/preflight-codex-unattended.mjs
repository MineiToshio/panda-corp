#!/usr/bin/env node
import { execFile } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const plugin = path.resolve(here, "..");
const project = path.resolve(process.argv[2] || ".");
const offline = process.argv.includes("--offline");
const checks = [];
const pass = (id, detail) => checks.push({ id, status: "PASS", detail });
const fail = (id, detail) => checks.push({ id, status: "FAIL", detail });
const command = async (file, args = [], options = {}) => {
  try { return { ok: true, ...(await exec(file, args, { timeout: 15000, ...options })) }; }
  catch (error) { return { ok: false, error: `${error.stderr || error.message}`.trim() }; }
};
const realEntry = async (id, target, type) => {
  try {
    const [entry, actual] = await Promise.all([lstat(target), realpath(target)]);
    const expected = path.join(projectReal, path.relative(project, target));
    const rightType = type === "file" ? entry.isFile() : type === "directory" ? entry.isDirectory() : entry.isFile() || entry.isDirectory();
    if (entry.isSymbolicLink() || actual !== expected || !rightType) throw new Error(`must be a real ${type}`);
    pass(id, actual); return true;
  } catch (error) { fail(id, error.message); return false; }
};

const projectReal = await realpath(project).catch(() => null);
const projectEntry = await lstat(project).catch(() => null);
if (!projectReal || !projectEntry?.isDirectory() || projectEntry.isSymbolicLink()) fail("project-root", "project root is missing or symlinked");
else pass("project-root", projectReal);
await realEntry("git-root", path.join(project, ".git"), "file-or-directory");
await realEntry("status-state", path.join(project, ".pandacorp/status.yaml"), "file");
await realEntry("run-state", path.join(project, ".pandacorp/run"), "directory");
await realEntry("verify-gate", path.join(project, ".pandacorp/verify.sh"), "file");
await realEntry("frd-root", path.join(project, "docs/frds"), "directory");
await realEntry("codex-project-config", path.join(project, ".codex/config.toml"), "file");
await realEntry("codex-project-rules", path.join(project, ".codex/rules/pandacorp.rules"), "file");
for (const [id, relative] of [["codex-config-projection", ".codex/config.toml"], ["codex-rules-projection", ".codex/rules/pandacorp.rules"]]) {
  try {
    const [actual, expected] = await Promise.all([
      readFile(path.join(project, relative), "utf8"),
      readFile(path.join(plugin, "templates/shared", relative), "utf8"),
    ]);
    if (actual !== expected) throw new Error(`${relative} drifted from the canonical generated projection`);
    pass(id, `${relative} exactly matches the canonical generated projection`);
  } catch (error) { fail(id, error.message); }
}

for (const [id, binary, args] of [["node", process.execPath, ["--version"]], ["git", "git", ["--version"]], ["codex-cli", process.env.PANDACORP_CODEX_BIN || "codex", ["--version"]]]) {
  const result = await command(binary, args); result.ok ? pass(id, result.stdout.trim()) : fail(id, result.error);
}
const auth = offline ? { ok: true, stdout: "skipped only for deterministic offline harness" } : await command(process.env.PANDACORP_CODEX_BIN || "codex", ["login", "status"]);
auth.ok ? pass("credentials", auth.stdout.trim()) : fail("credentials", auth.error);

if (offline) pass("network", "skipped only for deterministic offline harness");
else {
  const network = await command("curl", ["-sS", "-o", "/dev/null", "--connect-timeout", "5", "--max-time", "10", "https://chatgpt.com/"]);
  network.ok ? pass("network", "HTTPS reachability to the Codex service origin") : fail("network", network.error);
}

if (process.platform === "darwin") {
  const sleep = await command("caffeinate", ["-h"]); sleep.ok ? pass("sleep-prevention", "caffeinate available") : fail("sleep-prevention", sleep.error);
} else if (process.platform === "linux") {
  const sleep = await command("systemd-inhibit", ["--version"]); sleep.ok ? pass("sleep-prevention", "systemd-inhibit available") : fail("sleep-prevention", sleep.error);
} else fail("sleep-prevention", `unsupported unattended host ${process.platform}`);

try {
  const executor = await readFile(path.join(plugin, "runtime/codex/executor.mjs"), "utf8");
  if (!executor.includes('"-s", "workspace-write"') || !executor.includes('"--ignore-user-config"') || /dangerously-bypass-(approvals-and-sandbox|hook-trust)/.test(executor)) throw new Error("executor sandbox/config-isolation contract drifted or contains a bypass");
  pass("sandbox", "workspace-write; project config/rules present; unrelated user MCP config ignored; no dangerous bypass flag");
} catch (error) { fail("sandbox", error.message); }

try {
  const ownership = JSON.parse(await readFile(path.join(plugin, "runtime/capability-ownership.json"), "utf8"));
  for (const id of ["pandacorp-memory-review", "pandacorp-review-launch"]) if (ownership.capabilities?.[id]?.scheduler_owner !== "claude") throw new Error(`${id} is not Claude-owned`);
  pass("routine-ownership", "the two deployed routines remain Claude-only; no Codex schedule is created");
} catch (error) { fail("routine-ownership", error.message); }

const dirty = await command("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: project });
if (!dirty.ok) fail("clean-baseline", dirty.error);
else {
  const unsafe = dirty.stdout.split("\n").filter(Boolean).filter((line) => !line.slice(3).startsWith(".pandacorp/run/"));
  unsafe.length ? fail("clean-baseline", unsafe.join("; ")) : pass("clean-baseline", "only runtime artifacts may be dirty");
}

const report = { schema_version: 1, evidence_class: offline ? "OFFLINE_ACCELERATED" : "LIVE_SHORT_PREFLIGHT", project, checked_at: new Date().toISOString(), checks, verdict: checks.every((item) => item.status === "PASS") ? "GO" : "NO_GO" };
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.verdict !== "GO") process.exitCode = 3;
