#!/usr/bin/env node
// test-codex-worker-direct.mjs — the v2 `--direct` mode of plugin/scripts/codex-worker.mjs (build plan row B08,
// design D6, amendment A16, CLI doc section 2.2 / 2.7 / 5), against the FAKE `codex` binary of the engine fixtures
// (PANDACORP_CODEX_BIN). Never a real codex, never the real home. Exit 0 green / 1 red; ends in `RESULT: N passed, M failed`.
//
// ASSUMED INTERFACE (derived from the contracts only; the implementation was NOT read):
//  - Invocation (A16): node codex-worker.mjs run --direct --project <P> --id <worker id> --prompt-file <abs>
//      --codex-model <slug> --output-schema <abs> --dir <unit worktree> --access sandbox [--max <seconds>]   (no --sum)
//    and `read --project <P> --id <id>`, `stop --project <P> --all` (v1 verbs, layout unchanged).
//  - Worker dir: <P>/.pandacorp/run/codex-workers/<id>/ holding state.json{pid}, exit (numeric), last.md (final message).
//  - Result: ONE stdout line {"r":"<payload JSON>","sum":"<fnv1a32 hex of r>"} (same seal as v1 and the fake worker);
//    payload {status:"done", ok:true, answer:<parsed final message>} on success (answer may alternatively be carried as
//    `text` containing the message), {status:"done", ok:false, kind, detail} on a Codex failure, {status:"error", kind, detail}
//    for argument errors. The process exit code of codex-worker.mjs is 0 for all of these (the sealed result decides).
//  - Usage limit and rate limit both classify as kind "limit"; the detail names which one (usage / rate, 429).
//  - Codex argv: `exec ... -m <slug> ... -s workspace-write|danger-full-access ... --output-schema <file> ... -o <file> -`
//    (--access sandbox = workspace-write, the v1 default; --access full = danger-full-access; prompt on stdin).
//  - `run` waits up to --max seconds, then prints `CODEX-RUNNING <id> ...` and leaves Codex alive; `stop --all` kills it.
//  - Rerun with the same id returns the stored result without starting Codex again (v1 behavior, layout unchanged).
//  - Events: one worker_started and one worker_stopped to PANDACORP_EVENTS_FILE (v1 behavior), data.id = worker id.
//  - The cwd given to Codex (--dir) is not observable through the fixture fake (it logs only argv and stdin): not asserted.
//  - Watchdogs (start-hang 120 s, stall 20 min, cap 120 min) have no test hook in the docs: not exercised; the hang case
//    only pins the documented `--max` wait.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, "codex-worker.mjs");
let passed = 0;
let failed = 0;
const ok = (cond, msg) => { if (cond) { passed++; console.log(`PASS  ${msg}`); } else { failed++; console.log(`FAIL  ${msg}`); } };
const test = async (name, fn) => { try { await fn(); } catch (e) { failed++; console.log(`FAIL  ${name}: threw ${e && e.message ? e.message : e}`); } };

const fnv = (text) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

const scratchBase = process.env.PANDACORP_TEST_SCRATCH || os.tmpdir();
const tmp = mkdtempSync(path.join(scratchBase, "codex-worker-direct-"));
const project = path.join(tmp, "project");
const worktree = path.join(project, ".pandacorp/run/build/wt/u-test-1");
mkdirSync(worktree, { recursive: true });
const logOf = (id) => path.join(tmp, `codex-calls-${id}.ndjson`);
const eventsFile = path.join(tmp, "events.ndjson");
const workersDir = path.join(project, ".pandacorp/run/codex-workers");
const dirOf = (id) => path.join(workersDir, id);

// Hermetic environment: every hook points inside tmp; the fake codex is the fixtures' own binary.
const FAKE_CODEX_BIN = path.join(HERE, "fixtures/build-v2/fake-codex.mjs");
const baseEnv = {
  PATH: process.env.PATH, HOME: path.join(tmp, "home"), CODEX_HOME: path.join(tmp, "codex-home"), PANDACORP_HOST_DIR: path.join(tmp, "host"),
  PANDACORP_EVENTS_FILE: eventsFile, PANDACORP_CODEX_EVENTS_FILE: path.join(tmp, "codex-events.ndjson"), PANDACORP_NOW: "2026-11-11T12:00:00.000Z",
  PANDACORP_NOTIFY: "off", PANDACORP_CODEX_BIN: FAKE_CODEX_BIN, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1",
};

/** Runs the CLI; never blocks the test longer than `timeoutMs` (a wedged implementation is killed and reported). */
function cli(args, extraEnv = {}, timeoutMs = 25000) {
  return new Promise((resolve) => {
    const id = args[args.indexOf("--id") + 1];
    const child = spawn(process.execPath, [CLI, ...args, "--risk", "normal"], { env: { ...baseEnv, PANDACORP_FAKE_CODEX_LOG: logOf(id), ...extraEnv }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    let timedOut = false;
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    // "exit", not "close": a detached Codex child that inherited our pipes must not hold the test.
    child.on("exit", (code) => { clearTimeout(timer); setTimeout(() => resolve({ code, out: out.trim(), err, timedOut }), 50); });
    child.on("error", (e) => { clearTimeout(timer); resolve({ code: -1, out: "", err: String(e), timedOut: false }); });
  });
}
/** Builds a `run --direct` argv; `extra` flags replace the defaults of the same name (first occurrence would win otherwise). */
const directArgs = (id, promptFile, extra = []) => {
  const flags = new Map([["--project", project], ["--id", id], ["--prompt-file", promptFile], ["--codex-model", "gpt-6.1-sol"], ["--dir", worktree], ["--access", "sandbox"], ["--max", "20"]]);
  for (let i = 0; i < extra.length; i += 2) flags.set(extra[i], extra[i + 1]);
  return ["run", "--direct", ...[...flags].flat()];
};
const direct = (id, promptFile, extra = [], env = {}, timeoutMs) => cli(directArgs(id, promptFile, extra), env, timeoutMs);

/** Parses the one sealed line of a stdout; returns {lines, sealed, payload} (payload null when the seal does not verify). */
function seal(out) {
  const lines = out.split("\n").filter((l) => l.trim());
  let sealed = null;
  let payload = null;
  try { sealed = JSON.parse(lines[0] ?? ""); } catch { sealed = null; }
  if (sealed && typeof sealed.r === "string" && typeof sealed.sum === "string" && fnv(sealed.r) === sealed.sum) { try { payload = JSON.parse(sealed.r); } catch { payload = null; } }
  return { lines, sealed, payload };
}
const execCalls = (id) => (existsSync(logOf(id)) ? readFileSync(logOf(id), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((c) => c.argv?.[0] === "exec") : []);
const flag = (argv, name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const events = () => (existsSync(eventsFile) ? readFileSync(eventsFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const promptFileOf = (name, text) => { const f = path.join(tmp, `${name}.prompt.md`); writeFileSync(f, text); return f; };
const schemaFile = path.join(tmp, "report.schema.json");
writeFileSync(schemaFile, `${JSON.stringify({ type: "object", properties: { status: { type: "string" } }, required: ["status"] })}\n`);
const reportFile = path.join(tmp, "final-report.json");
const REPORT = { schema: 1, unit: "u-test-1", status: "done", summary: "direct worker report", files: ["src/a.ts"], pending: [] };
writeFileSync(reportFile, JSON.stringify(REPORT));

console.log("codex-worker --direct");
const tests = [];
if (!existsSync(CLI)) { console.log(`FAIL  codex-worker.mjs missing at ${CLI}`); console.log("RESULT: 0 passed, 1 failed"); process.exit(1); }
if (!existsSync(FAKE_CODEX_BIN)) { console.log(`FAIL  fixture fake codex missing at ${FAKE_CODEX_BIN}`); console.log("RESULT: 0 passed, 1 failed"); process.exit(1); }

// 1. Happy path with the Astra slug: argv, stdin, sealed result, layout, events.
tests.push(test("happy path", async () => {
  const marker = "MARKER-7f3a-implement-the-thing";
  const prompt = `# Brief\n\nUnit u-test-1. ${marker}\nWrite the report to report_path.\n`;
  const pf = promptFileOf("happy", prompt);
  const r = await direct("w-happy", pf, ["--output-schema", schemaFile], { PANDACORP_FAKE_CODEX_REPORT: reportFile }, 30000);
  ok(!r.timedOut && r.code === 0, `run --direct exits 0 (code ${r.code}${r.err ? `, stderr: ${r.err.slice(0, 200)}` : ""})`);
  const calls = execCalls("w-happy");
  ok(calls.length === 1, `exactly one codex exec call (got ${calls.length})`);
  const argv = calls[0]?.argv ?? [];
  ok(flag(argv, "-m") === "gpt-6.1-sol" || flag(argv, "--model") === "gpt-6.1-sol", "codex gets the explicit --codex-model slug via -m");
  ok(flag(argv, "--output-schema") === schemaFile, "--output-schema is passed through to codex exec");
  ok(flag(argv, "-s") === "workspace-write" || flag(argv, "--sandbox") === "workspace-write", "--access sandbox maps to the workspace-write sandbox");
  ok(!argv.includes("danger-full-access"), "sandbox access never uses danger-full-access");
  ok(argv[0] === "exec" && argv.at(-1) === "-", "prompt comes on stdin (argv ends with the `-` placeholder)");
  ok(typeof flag(argv, "-o") === "string" && flag(argv, "-o").length > 0, "codex exec writes its final message with -o <file>");
  ok(calls[0]?.stdin?.includes(marker), "the prompt file text reaches the binary on stdin");
  const s = seal(r.out);
  ok(s.lines.length === 1, `stdout is exactly one line (got ${s.lines.length})`);
  ok(s.sealed && Object.keys(s.sealed).sort().join() === "r,sum", "the line is a JSON object with exactly r and sum");
  ok(s.payload !== null, "the checksum verifies (sum = fnv1a32 of r)");
  ok(s.payload?.status === "done" && s.payload?.ok === true, "payload is status done, ok true");
  const answerOk = (s.payload?.answer && s.payload.answer.summary === REPORT.summary && s.payload.answer.unit === "u-test-1") || (typeof s.payload?.text === "string" && s.payload.text.includes(REPORT.summary));
  ok(answerOk, "payload carries the codex final message (parsed as answer, or as text)");
  const d = dirOf("w-happy");
  ok(existsSync(path.join(d, "state.json")) && Number.isInteger(JSON.parse(readFileSync(path.join(d, "state.json"), "utf8")).pid), "worker dir has state.json with an integer pid under .pandacorp/run/codex-workers/<id>/");
  ok(existsSync(path.join(d, "exit")) && /^\d+\s*$/.test(readFileSync(path.join(d, "exit"), "utf8")), "worker dir has a numeric exit file");
  ok(existsSync(path.join(d, "exit")) && Number(readFileSync(path.join(d, "exit"), "utf8")) === 0, "exit file is 0 for a clean codex run");
  ok(existsSync(path.join(d, "last.md")) && readFileSync(path.join(d, "last.md"), "utf8").includes(REPORT.summary), "last.md holds the codex final message");
  const ev = events().filter((e) => e.data && e.data.id === "w-happy");
  ok(ev.length === 2 && ev[0].event === "worker_started" && ev[1].event === "worker_stopped", `one worker_started and one worker_stopped event (got ${ev.map((e) => e.event).join(",") || "none"})`);
  // read reprints the stored sealed line.
  const rd = await cli(["read", "--project", project, "--id", "w-happy"]);
  ok(rd.out === r.out, "read reprints the identical sealed line");
  // rerun with the same worker id: stored result, no second codex run.
  const again = await direct("w-happy", pf, ["--output-schema", schemaFile], { PANDACORP_FAKE_CODEX_REPORT: reportFile });
  ok(again.out === r.out && execCalls("w-happy").length === 1, "a rerun with the same worker id returns the stored result and starts no second codex");
  ok(events().filter((e) => e.data && e.data.id === "w-happy").length === 2, "the rerun emits no extra worker events");
}));

// 2. No --sum needed, no transcript recovery, a stale prompt.md is not the prompt.
tests.push(test("no --sum and no recovery", async () => {
  mkdirSync(dirOf("w-nosum"), { recursive: true });
  writeFileSync(path.join(dirOf("w-nosum"), "prompt.md"), "STALE prompt.md that must never reach codex\n");
  const pf = promptFileOf("nosum", "FRESH-DIRECT-PROMPT body\n");
  const r = await direct("w-nosum", pf);
  const p = seal(r.out).payload;
  ok(p && p.status === "done" && p.ok === true, "run --direct without --sum succeeds (no checksum guard, no CODEX-PROMPT-MISMATCH)");
  ok(!/CODEX-PROMPT-MISMATCH/.test(r.out), "no prompt mismatch handshake in direct mode");
  const call = execCalls("w-nosum")[0];
  ok(!!call && call.stdin.includes("FRESH-DIRECT-PROMPT") && !call.stdin.includes("STALE prompt.md"), "stdin is the --prompt-file text, not a pre-existing prompt.md");
}));

// 3. Codex model slugs are passed verbatim, including Astra and the other catalog slugs; efforts do not break it.
tests.push(test("model slugs", async () => {
  await Promise.all(["gpt-6-astra", "gpt-6-luna", "gpt-6.1-sol"].map(async (slug) => {
    const id = `w-model-${slug.replace(/[^a-z0-9]/gi, "")}`;
    const r = await direct(id, promptFileOf(id, `slug test ${slug}\n`), ["--codex-model", slug, "--capacity-task", JSON.stringify({id, type: slug.includes("luna") ? "mechanical" : "implement", risk: slug.includes("astra") ? "critical" : "normal"})]);
    const argv = execCalls(id)[0]?.argv ?? [];
    ok(seal(r.out).payload?.ok === true && (flag(argv, "-m") === slug || flag(argv, "--model") === slug), `--codex-model ${slug} is passed to codex exec unchanged`);
  }));
}));

// 4. Access values.
tests.push(test("access modes", async () => {
  await direct("w-full", promptFileOf("full", "full access\n"), ["--access", "full"]);
  let argv = execCalls("w-full")[0]?.argv ?? [];
  ok(flag(argv, "-s") === "danger-full-access" || flag(argv, "--sandbox") === "danger-full-access", "--access full maps to danger-full-access");
  await cli(["run", "--direct", "--project", project, "--id", "w-defaccess", "--prompt-file", promptFileOf("defaccess", "default access\n"), "--codex-model", "gpt-6.1-sol", "--dir", worktree, "--max", "20"]);
  argv = execCalls("w-defaccess")[0]?.argv ?? [];
  ok(flag(argv, "-s") === "workspace-write" || flag(argv, "--sandbox") === "workspace-write", "with no --access the default is the workspace-write sandbox, never full access");
  ok(!argv.includes("danger-full-access"), "default access never escalates to danger-full-access");
}));

// 4b. BL-0313: --writable-dir adds the unit's report dir as a writable root (codex --add-dir), sandbox only, guarded.
tests.push(test("writable report dir", async () => {
  const unitDir = path.join(project, ".pandacorp/run/build/units/u-test-1");
  mkdirSync(unitDir, { recursive: true });
  const addDirs = (argv) => argv.flatMap((a, i) => (a === "--add-dir" ? [argv[i + 1]] : []));
  await direct("w-wdir", promptFileOf("wdir", "write the report\n"), ["--writable-dir", unitDir]);
  let argv = execCalls("w-wdir")[0]?.argv ?? [];
  ok(JSON.stringify(addDirs(argv)) === JSON.stringify([unitDir]), `sandbox access forwards --writable-dir as one --add-dir (got ${JSON.stringify(addDirs(argv))})`);
  ok(flag(argv, "-s") === "workspace-write" && flag(argv, "-C") === worktree, "the workspace stays the worktree under workspace-write");
  await direct("w-wdir-none", promptFileOf("wdirnone", "no extra dir\n"));
  ok(addDirs(execCalls("w-wdir-none")[0]?.argv ?? []).length === 0, "without --writable-dir no --add-dir is passed");
  await direct("w-wdir-full", promptFileOf("wdirfull", "full\n"), ["--access", "full", "--writable-dir", unitDir]);
  ok(addDirs(execCalls("w-wdir-full")[0]?.argv ?? []).length === 0, "full access adds no --add-dir");
  const refused = async (id, dir, why) => {
    const r = await direct(id, promptFileOf(id, "refused\n"), ["--writable-dir", dir]);
    const p = seal(r.out).payload;
    ok(p?.kind === "bad-writable-dir" && execCalls(id).length === 0, `${why} is refused before codex runs (kind ${JSON.stringify(p?.kind)})`);
  };
  await refused("w-wdir-rel", "relative/dir", "a relative --writable-dir");
  await refused("w-wdir-missing", path.join(tmp, "does-not-exist"), "a missing --writable-dir");
  await refused("w-wdir-proj", project, "the project root as --writable-dir");
  await refused("w-wdir-parent", tmp, "a parent of the project as --writable-dir");
  const gitDir = path.join(project, ".git", "hooks");
  mkdirSync(gitDir, { recursive: true });
  await refused("w-wdir-git", gitDir, "a dir inside .git");
}));

// 5. The process exit code of the binary is ignored in favor of the sealed result.
tests.push(test("exit code ignored", async () => {
  const r = await direct("w-fail", promptFileOf("fail", "this run fails\n"), [], { PANDACORP_FAKE_CODEX_MODE: "fail" });
  const s = seal(r.out);
  ok(!r.timedOut && r.code === 0, `codex exiting 2 still makes codex-worker exit 0 (got ${r.code})`);
  ok(s.lines.length === 1 && s.payload !== null, "a failing codex still yields exactly one verifying sealed line");
  ok(s.payload?.ok === false, "the sealed result says ok:false for the failing codex");
  ok(s.payload?.kind !== "limit", `a plain failure is not classified as limit (kind ${JSON.stringify(s.payload?.kind)})`);
  ok(existsSync(path.join(dirOf("w-fail"), "exit")) && /^\d+\s*$/.test(readFileSync(path.join(dirOf("w-fail"), "exit"), "utf8")), "the exit file is still written (numeric)");
  const rd = await cli(["read", "--project", project, "--id", "w-fail"]);
  ok(rd.out === r.out && rd.code === 0, "read of a failed worker returns the same sealed line with exit 0");
}));

// 6. Limit and rate-limit classification.
tests.push(test("limit classification", async () => {
  const lim = await direct("w-limit", promptFileOf("limit", "hit the limit\n"), [], { PANDACORP_FAKE_CODEX_MODE: "limit" });
  const lp = seal(lim.out).payload;
  ok(lim.code === 0 && lp && lp.ok === false && lp.kind === "limit", `usage limit is classified as kind "limit" (got ${JSON.stringify(lp?.kind)})`);
  ok(/usage/i.test(String(lp?.detail ?? "")), "the limit detail names the usage limit");
  const rate = await direct("w-rate", promptFileOf("rate", "rate limited\n"), [], { PANDACORP_FAKE_CODEX_MODE: "rate" });
  const rp = seal(rate.out).payload;
  ok(rate.code === 0 && rp && rp.ok === false && rp.kind === "limit", `rate limit (429) is classified as kind "limit" (got ${JSON.stringify(rp?.kind)})`);
  ok(/rate|429/i.test(String(rp?.detail ?? "")), "the rate-limit detail names the rate limit");
}));

// 7. Argument and id errors are sealed errors, never a crash and never a codex run.
tests.push(test("argument errors", async () => {
  const missing = await direct("w-nofile", path.join(tmp, "does-not-exist.md"));
  const mp = seal(missing.out);
  ok(missing.code === 0 && mp.payload && mp.payload.status === "error", `a missing --prompt-file is a sealed error with exit 0 (got ${missing.out.slice(0, 120)})`);
  const noFlag = await cli(["run", "--direct", "--project", project, "--id", "w-noprompt", "--codex-model", "gpt-6.1-sol", "--dir", worktree, "--access", "sandbox", "--max", "5"]);
  ok(noFlag.code === 0 && seal(noFlag.out).payload?.status === "error", "--direct without --prompt-file is a sealed error with exit 0");
  const badId = await direct("../escape", promptFileOf("badid", "x\n"));
  ok(badId.code === 0 && seal(badId.out).payload?.status === "error", "a worker id with path characters is refused with a sealed error");
  ok(!existsSync(path.join(project, ".pandacorp/run/escape")) && !existsSync(path.join(tmp, "escape")), "the traversal id wrote nothing outside the workers directory");
  ok(["w-nofile", "w-noprompt", "../escape"].every((i) => execCalls(i).length === 0), "no argument error started codex");
  const unknown = await cli(["read", "--project", project, "--id", "w-never-ran"]);
  ok(unknown.code === 0 && seal(unknown.out).payload?.status === "error", "read of an unknown worker is a sealed error with exit 0");
}));

// 8. The v1 relay path is unchanged: without --direct the checksum guard still applies.
tests.push(test("v1 path unchanged", async () => {
  const d = dirOf("w-v1");
  mkdirSync(d, { recursive: true });
  writeFileSync(path.join(d, "prompt.md"), "Original task.\n");
  const r = await cli(["run", "--project", project, "--id", "w-v1", "--sum", fnv("A different task."), "--model", "haiku", "--max", "5"]);
  ok(/^CODEX-PROMPT-MISMATCH /.test(r.out), "without --direct a prompt.md that does not match --sum is still refused");
  ok(execCalls("w-v1").length === 0, "the v1 mismatch refusal starts no codex");
}));

// 9. A hung binary: bounded by the documented --max, then CODEX-RUNNING; stop kills it; the test is never blocked.
tests.push(test("hung binary", async () => {
  const started = Date.now();
  const r = await direct("w-hang", promptFileOf("hang", "this never finishes\n"), ["--max", "2"], { PANDACORP_FAKE_CODEX_MODE: "hang" }, 20000);
  const elapsed = (Date.now() - started) / 1000;
  ok(!r.timedOut, "run --direct with --max 2 returns on its own (not wedged by the hung binary)");
  ok(/^CODEX-RUNNING w-hang\b/.test(r.out), `a worker still running past --max prints CODEX-RUNNING <id> (got ${JSON.stringify(r.out.slice(0, 80))})`);
  ok(elapsed < 15, `the wait is bounded near --max (took ${elapsed.toFixed(1)} s)`);
  ok(r.code === 0, `the bounded wait exits 0 (got ${r.code})`);
  const stateFile = path.join(dirOf("w-hang"), "state.json");
  const pid = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")).pid : null;
  ok(Number.isInteger(pid) && alive(pid), "state.json carries the pid of the still-running worker");
  ok(!existsSync(path.join(dirOf("w-hang"), "exit")), "no exit file while the worker is running");
  const rd = await cli(["read", "--project", project, "--id", "w-hang"]);
  ok(!seal(rd.out).payload || seal(rd.out).payload.ok !== true, "read of a running worker never reports a finished success");
  const stop = await cli(["stop", "--project", project, "--all"]);
  const sp = seal(stop.out).payload;
  ok(stop.code === 0 && Array.isArray(sp?.killed) && sp.killed.includes("w-hang"), "stop --all reports the hung worker as killed");
  let gone = false;
  for (let i = 0; i < 20 && !gone; i++) { gone = !alive(pid); if (!gone) await sleep(150); }
  ok(gone, "the hung worker process is gone after stop");
}));

await Promise.all(tests);

// Cleanup: kill any stray worker still recorded, then remove the scratch tree.
if (existsSync(workersDir)) {
  await cli(["stop", "--project", project, "--all"]);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
