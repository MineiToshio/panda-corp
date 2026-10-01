#!/usr/bin/env node
import { execFile } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, realpath, rename, rm, rmdir, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const resolver = path.join(path.dirname(new URL(import.meta.url).pathname), "resolve-build-run-id.mjs");
const scripts = path.dirname(resolver);
const leaseCli = path.join(scripts, "pandacorp-build-state.mjs");
const claudeLauncherPath = path.join(scripts, "launch-implement.sh");
let passed = 0;
const ok = (condition, name) => { if (!condition) throw new Error(name); passed++; console.log(`PASS  ${name}`); };
const fixture = async ({ runtime = "claude", runId = "logical-build-1", phase = "implementation", running = "false", lease = false } = {}) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pandacorp-run-id-"));
  await mkdir(path.join(root, ".pandacorp/run"), { recursive: true });
  await writeFile(path.join(root, ".pandacorp/status.yaml"), `phase: ${phase}\nrunning: ${running}\nbuild_runtime: ${runtime}\nbuild_run_id: ${runId}\n`);
  if (lease) { await mkdir(path.join(root, ".pandacorp/run/build.lease")); await writeFile(path.join(root, ".pandacorp/run/build.lease/lease.json"), "{}\n"); }
  return root;
};
const cleanup = async (root, lease = false) => { if (lease) { await unlink(path.join(root, ".pandacorp/run/build.lease/lease.json")); await rmdir(path.join(root, ".pandacorp/run/build.lease")); } await unlink(path.join(root, ".pandacorp/status.yaml")); await rmdir(path.join(root, ".pandacorp/run")); await rmdir(path.join(root, ".pandacorp")); await rmdir(root); };
const resolve = async (root, runtime, mode = "auto", newId = "generated-new") => JSON.parse((await exec("node", [resolver, "--project", root, "--runtime", runtime, "--mode", mode, "--new-id", newId])).stdout);
const workflowInvocation = (stdout) => {
  const line = stdout.split("\n").find((item) => item.trim().startsWith("Workflow("));
  if (!line) throw new Error(`launcher did not print Workflow invocation:\n${stdout}`);
  return JSON.parse(line.trim().replace(/^Workflow\(/, "").replace(/\)$/, ""));
};
const workflowArgs = (stdout) => workflowInvocation(stdout).args;
const releaseLauncherLease = async (root, stdout) => {
  const args = workflowArgs(stdout);
  await exec("node", [leaseCli, "release", "--project", root, "--token", args.leaseToken, "--epoch", String(args.leaseEpoch)]);
};

for (const [prior, target] of [["claude", "codex"], ["codex", "claude"]]) {
  const root = await fixture({ runtime: prior }); const result = await resolve(root, target);
  ok(result.continuation && result.run_id === "logical-build-1", `${prior}→${target} auto-reuses the canonical logical run at a released implementation safe point`); await cleanup(root);
}
{
  const root = await fixture({ runtime: "codex" }); const result = await resolve(root, "codex");
  ok(!result.continuation && result.run_id === "generated-new", "same-runtime launch defaults to a new governed run"); await cleanup(root);
}
{
  const root = await fixture({ runtime: "claude", phase: "release" }); const result = await resolve(root, "codex");
  ok(!result.continuation, "a terminal release phase never auto-continues an old run"); await cleanup(root);
}
{
  const root = await fixture({ runtime: "claude" }); const result = await resolve(root, "codex", "new");
  ok(!result.continuation && result.reason === "explicit-new-run", "explicit new-run intent prevents accidental ledger inheritance"); await cleanup(root);
}
{
  const root = await fixture({ runtime: "claude", running: "true", lease: true }); const result = await resolve(root, "codex");
  ok(!result.continuation, "an active lease is never classified as a cold continuation"); await cleanup(root, true);
}
{
  const root = await fixture({ runtime: "claude" }); let rejected = false;
  try { await resolve(root, "codex", "foreign-run"); } catch (error) { rejected = error.code === 3; }
  ok(rejected, "an explicit foreign continuation id fails closed"); await cleanup(root);
}

const [claudeLauncher, codexLauncher] = await Promise.all([exec("bash", ["-n", claudeLauncherPath]), exec("bash", ["-n", path.join(scripts, "launch-codex-implement.sh")])]);
ok(claudeLauncher.stderr === "" && codexLauncher.stderr === "", "both runtime launchers remain syntactically valid");
{
  const root = await fixture({ phase: "architecture", running: "false" });
  const active = JSON.parse((await exec("node", [leaseCli, "acquire", "--project", root, "--runtime", "codex", "--run-id", "active-owner", "--ttl", "600"])).stdout);
  const before = await readFile(path.join(root, ".pandacorp/status.yaml"), "utf8");
  let rejected = false;
  try { await exec("bash", [claudeLauncherPath, root, "powerful", "5"]); } catch (error) { rejected = error.code === 2; }
  const status = await readFile(path.join(root, ".pandacorp/status.yaml"), "utf8");
  ok(rejected && status === before && /^phase:\s*["']?implementation["']?$/m.test(status), "contended Claude launch is a strict no-op on the active owner's projection");
  await exec("node", [leaseCli, "release", "--project", root, "--token", active.token, "--epoch", String(active.epoch)]);
  await rm(root, { recursive: true });
}
{
  const root = await fixture({ phase: "architecture", running: "false" });
  let rejected = false;
  try { await exec("bash", [claudeLauncherPath, root, "powerful", "5"], { env: { ...process.env, PANDACORP_TEST_FAIL_PHASE_WRITE: "1" } }); } catch (error) { rejected = error.code === 2; }
  const status = await readFile(path.join(root, ".pandacorp/status.yaml"), "utf8");
  let leaseExists = true; try { await access(path.join(root, ".pandacorp/run/build.lease/lease.json")); } catch { leaseExists = false; }
  ok(rejected && /^phase: architecture$/m.test(status) && !leaseExists && /^running: false$/m.test(status), "phase-write failure releases ownership without advancing phase");
  await rm(root, { recursive: true });
}
{
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "balanced", "5", "new"]);
  const args = workflowArgs(launched.stdout);
  ok(args.mode === "balanced" && args.maxAgents === 5 && path.isAbsolute(args.stateCli) && !args.frds && !args.change && !args.maxFrds && !args.maxSpend, "historical four positional launcher arguments remain backward compatible and inject the absolute state CLI");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "pro", "8", "auto", "--frds", "frd-a,docs/frds/frd-b/frd.md", "--max-frds", "1", "--max-spend", "4000"]);
  const args = workflowArgs(launched.stdout);
  ok(JSON.stringify(args.frds) === JSON.stringify(["frd-a", "docs/frds/frd-b/frd.md"]) && args.maxFrds === 1 && args.maxSpend === 4000, "launcher prints an exact JSON Workflow scope and supervised ceilings");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  // D1/BL-0186: the opt-in parallel FRD gates reach the engine args through the launcher (never a hand edit)
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "40", "auto", "--parallel-gates", "--gate-slots", "2"]);
  const args = workflowArgs(launched.stdout);
  ok(args.parallelGates === true && args.gateSlots === 2, "launcher passes --parallel-gates/--gate-slots as args.parallelGates:true + args.gateSlots:2");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  // WP-06/BL-0187: gateEvidence reaches the engine through the launcher too (canary E: parallel gates + digested)
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "40", "auto", "--parallel-gates", "--gate-slots", "2", "--gate-evidence", "digested"]);
  const args = workflowArgs(launched.stdout);
  ok(args.parallelGates === true && args.gateSlots === 2 && args.gateEvidence === "digested", "launcher passes --gate-evidence digested as args.gateEvidence:'digested' alongside the parallel-gates args");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "pro", "8", "new"]);
  const args = workflowArgs(launched.stdout);
  ok(!("parallelGates" in args) && !("gateSlots" in args) && !("gateEvidence" in args) && !("gateContextScope" in args) && !("driftFinder" in args) && !("gateInventoryCache" in args), "without --parallel-gates/--no-parallel-gates/--gate-evidence/--gate-context-scope/--drift-finder/--gate-inventory-cache the launcher adds none of those keys — the engine's own default (parallelGates now true, v9.116.0) governs, never a launcher-forced value");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  // --no-parallel-gates is the v9.116.0 opt-out: the launcher must be able to turn the new default OFF explicitly.
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "40", "auto", "--no-parallel-gates"]);
  const args = workflowArgs(launched.stdout);
  ok(args.parallelGates === false, "launcher passes --no-parallel-gates as args.parallelGates:false");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  // BL-0188/0203/0189 (canary F1/F2): the gate-cost levers reach the engine through the launcher, never a hand edit
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "60", "auto", "--parallel-gates", "--gate-slots", "2", "--gate-evidence", "explore", "--gate-context-scope", "--drift-finder", "off", "--gate-inventory-cache"]);
  const args = workflowArgs(launched.stdout);
  ok(args.gateEvidence === "explore" && args.gateContextScope === true && args.driftFinder === false && args.gateInventoryCache === true && args.parallelGates === true && args.gateSlots === 2, "launcher passes --gate-context-scope/--drift-finder off/--gate-inventory-cache as gateContextScope:true, driftFinder:false, gateInventoryCache:true");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "60", "auto", "--gate-evidence", "digested", "--drift-finder", "on"]);
  const args = workflowArgs(launched.stdout);
  ok(args.gateEvidence === "digested" && args.driftFinder === true && !("gateContextScope" in args) && !("gateInventoryCache" in args), "launcher passes --drift-finder on as driftFinder:true (a boolean, never the string) and sets no other lever key");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
for (const bad of [["--no-parallel-gates", "--gate-slots", "2"], ["--parallel-gates", "--no-parallel-gates"], ["--no-parallel-gates", "--parallel-gates"], ["--parallel-gates", "--gate-slots", "9"], ["--parallel-gates", "--gate-slots", "x"], ["--gate-evidence", "digest"], ["--gate-evidence"], ["--drift-finder"], ["--drift-finder", "yes"], ["--drift-finder", "true"], ["--gate-context-scope", "true"], ["--gate-inventory-cache", "on"]]) {
  const root = await fixture({ phase: "architecture", running: "false" });
  let rejected = false;
  try { await exec("bash", [claudeLauncherPath, root, "pro", "8", "auto", ...bad]); } catch (error) { rejected = error.code === 3; }
  let leaseExists = true; try { await access(path.join(root, ".pandacorp/run/build.lease/lease.json")); } catch { leaseExists = false; }
  ok(rejected && !leaseExists, `launcher rejects ${bad.join(" ")} before taking the lease`);
  await rm(root, { recursive: true });
}
{
  const root = await fixture({ phase: "architecture", running: "false" });
  let rejected = false;
  try { await exec("bash", [claudeLauncherPath, root, "pro", "8", "auto", "--frds", "frd-a", "--change", "change-a"]); } catch (error) { rejected = error.code === 3; }
  const status = await readFile(path.join(root, ".pandacorp/status.yaml"), "utf8");
  let leaseExists = true; try { await access(path.join(root, ".pandacorp/run/build.lease/lease.json")); } catch { leaseExists = false; }
  ok(rejected && !leaseExists && /^phase: architecture$/m.test(status), "mutually exclusive change/FRD scope fails before lease or phase mutation");
  await rm(root, { recursive: true });
}
{
  const root = await fixture({ phase: "architecture", running: "false" });
  let rejected = false;
  try { await exec("bash", [claudeLauncherPath, root, "pro", "8", "auto", "--frds", "../escape"]); } catch (error) { rejected = error.code === 3; }
  ok(rejected, "launcher rejects path traversal in targeted scope");
  await rm(root, { recursive: true });
}
{
  const original = await fixture({ phase: "architecture", running: "false" });
  const root = `${original}'quoted`;
  await rename(original, root);
  const launched = await exec("bash", [claudeLauncherPath, root, "pro", "2"]);
  const invocation = workflowInvocation(launched.stdout);
  const canonicalRoot = await realpath(root);
  ok(invocation.scriptPath === path.join(canonicalRoot, ".claude/engines/pandacorp-build.js") && invocation.args.projectDir === canonicalRoot && invocation.args.stateCli === await realpath(leaseCli), "launcher JSON-escapes apostrophes and injects the canonical state CLI");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  const root = await fixture({ phase: "architecture", running: "false" });
  let rejected = false;
  try { await exec("bash", [claudeLauncherPath, root, "pro", "2"], { env: { ...process.env, PANDACORP_TEST_FAIL_ARGS_JSON: "1" } }); } catch (error) { rejected = error.code === 3; }
  let leaseExists = true; try { await access(path.join(root, ".pandacorp/run/build.lease/lease.json")); } catch { leaseExists = false; }
  const status = await readFile(path.join(root, ".pandacorp/status.yaml"), "utf8");
  ok(rejected && !leaseExists && /^running: false$/m.test(status), "post-acquire Workflow serialization failure releases the fenced lease");
  await rm(root, { recursive: true });
}
{
  // BL-0173 (canary-d): maxAgents at/below powerful mode's own fixed pre-wave overhead (~8-11 units,
  // process-change+plan+safe-point+foundation-gate, opus-weighted) silently collapses the first wave to
  // exactly 1 WO. launch-implement.sh now warns about it BEFORE the run even starts.
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "8"]);
  ok(/maxAgents=8 is a TOTAL run budget, NOT concurrency/.test(launched.stdout), "BL-0173: powerful mode below the ~15 pre-wave-overhead floor warns that the first wave will likely collapse to 1 WO");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "20"]);
  ok(!/TOTAL run budget, NOT concurrency/.test(launched.stdout), "BL-0173 control: powerful mode at/above the floor prints no agent-budget warning");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "pro", "8"]);
  ok(!/TOTAL run budget, NOT concurrency/.test(launched.stdout), "BL-0173 control: a non-powerful mode never prints the powerful-specific warning, even below 15");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  // v9.116.0 (F1/F2 verdict): parallelGates now defaults ON, so the sizing warning fires on a plain
  // `powerful` targeted run with NO --parallel-gates flag at all — the engine default does the work.
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "40", "auto", "--frds", "frd-02,frd-03,frd-04,frd-05"]);
  ok(/parallel FRD gates \(default on\) with maxAgents=40 for 4 FRD\(s\): the recommended\s+floor is 8 \+ 20 x FRDs\s+= 88/.test(launched.stdout) && /1 FRD \/ 3 WOs \/ one reopen\s+needed ~48 units/.test(launched.stdout), "A-1 formula: a plain targeted powerful run (parallel gates on by default) with maxAgents 40 for 4 FRDs warns the floor is 8 + 20 x 4 = 88 and cites the measured 48-unit case");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  // --no-parallel-gates opts back into the legacy single-gate-worktree topology and silences the sizing warning.
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "40", "auto", "--frds", "frd-02,frd-03,frd-04,frd-05", "--no-parallel-gates"]);
  ok(!/20 x (the )?FRDs/.test(launched.stdout), "--no-parallel-gates suppresses the parallel-gates sizing warning even below the (now moot) floor");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "100", "auto", "--frds", "frd-02,frd-03,frd-04,frd-05", "--parallel-gates"]);
  ok(!/recommended\s+floor is 8/.test(launched.stdout) && !/NOTE: parallel FRD gates/.test(launched.stdout), "canary E control: maxAgents 100 for 4 FRDs prints no parallel-gates budget warning");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "40", "auto"]);
  ok(/NOTE: parallel FRD gates \(default on\): size maxAgents to at least 8 \+ 20 x the FRDs this run will gate/.test(launched.stdout), "A-1 formula: an untargeted plain powerful run (no --parallel-gates flag needed) gets the 8 + 20-per-FRD sizing note");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "40", "auto", "--frds", "frd-a"]);
  ok(!/20 x (the )?FRDs/.test(launched.stdout), "canary E control: at/above the per-FRD floor no parallel-gates budget line is printed");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  // BL-0207 (canary F2): the drift finder is one more sonnet unit per gate link (+ re-gates), so when it is ON the
  // per-FRD floor is 24, not 20 (F2: maxAgents 60, 4 FRDs, digested + finder, spent the whole ceiling as it finished).
  const frds = ["--frds", "frd-02,frd-03,frd-04,frd-05"];
  const warnsAt = async (args, name, expected) => {
    const root = await fixture({ phase: "architecture", running: "false" });
    const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "100", "auto", ...frds, ...args]);
    ok(expected(launched.stdout), name);
    await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
  };
  const finderWarns = (out) => /recommended\s+floor is 8 \+ 24 x FRDs\s+= 104/.test(out) && /drift finder and its snippet check \(BL-0207, BL-0214\)/.test(out);
  await warnsAt(["--gate-evidence", "digested"], "BL-0207: digested (finder on by default) at 100 for 4 FRDs still warns, with the finder-aware floor 104", finderWarns);
  await warnsAt(["--drift-finder", "on"], "BL-0207: an explicit --drift-finder on under the default explore evidence also raises the floor to 104", finderWarns);
  await warnsAt(["--gate-evidence", "explore", "--drift-finder", "off"], "BL-0207 control: explore + finder off at 100 for 4 FRDs prints no sizing warning (100 >= 88)", (out) => !/24 x FRDs|20 x FRDs|drift finder and its snippet check/.test(out));
  await warnsAt(["--gate-evidence", "digested", "--drift-finder", "off"], "BL-0207 control: digested with the finder explicitly off keeps the finder-free floor (100 passes)", (out) => !/recommended\s+floor is/.test(out));
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "40", "auto", "--gate-evidence", "digested"]);
  ok(/size maxAgents to at least 8 \+ 24 x the FRDs this run will gate/.test(launched.stdout), "BL-0207/BL-0214: an untargeted digested run gets the 24-per-FRD sizing note");
  const auto = await fixture({ phase: "architecture", running: "false" });
  const autoLaunched = await exec("bash", [claudeLauncherPath, auto, "powerful", "auto", "auto", "--frds", "frd-02"]);
  const autoInvocation = workflowInvocation(autoLaunched.stdout);
  ok(autoInvocation.args.maxAgents === "auto", "maxAgents:'auto' is accepted by the launcher and reaches the engine args as the literal string");
  ok(/WARNING: maxAgents=auto is a projection-sized convenience, NOT an owner-chosen budget/.test(autoLaunched.stdout), "'auto' does NOT count as an owner-passed budget: the overnight warning still fires");
  ok(!/recommended\s+floor is/.test(autoLaunched.stdout) && !/TOTAL run budget, NOT concurrency/.test(autoLaunched.stdout), "'auto' skips every numeric floor check");
  await releaseLauncherLease(auto, autoLaunched.stdout); await rm(auto, { recursive: true });
  const bad = await fixture({ phase: "architecture", running: "false" });
  let badRejected = false;
  try { await exec("bash", [claudeLauncherPath, bad, "powerful", "autox"]); } catch (error) { badRejected = error.code === 3; }
  ok(badRejected, "a non-integer, non-'auto' maxAgents is still rejected");
  await rm(bad, { recursive: true });
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  // Proposal 39 / DR-124: the fast lane and its review budget reach the engine through the launcher, never a hand edit.
  const launch = async (extra, maxAgents = "60") => {
    const root = await fixture({ phase: "architecture", running: "false" });
    const launched = await exec("bash", [claudeLauncherPath, root, "powerful", maxAgents, "auto", ...extra]);
    await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
    return launched.stdout;
  };
  const fast = workflowArgs(await launch(["--lane", "fast"]));
  ok(fast.lane === "fast" && !("reviewBudget" in fast), "P39 launcher: --lane fast reaches the engine as args.lane:'fast' and sets no reviewBudget key (the engine default 'now' governs)");
  const deferOut = await launch(["--lane", "fast", "--review-budget", "defer"]);
  const deferArgs = workflowArgs(deferOut);
  ok(deferArgs.lane === "fast" && deferArgs.reviewBudget === "defer", "P39 launcher: --review-budget defer reaches the engine as args.reviewBudget:'defer'");
  ok(/lane fast · mechScript on · infraGuard on · reviewBudget defer/.test(deferOut), "P39 launcher: the ARG-ECHO reminder names the engine's lane log line to verify (lane fast · mechScript on · infraGuard on · reviewBudget defer)");
  const nowArgs = workflowArgs(await launch(["--lane", "fast", "--review-budget", "now"]));
  ok(nowArgs.lane === "fast" && nowArgs.reviewBudget === "now", "P39 launcher: an explicit --review-budget now is passed through as the string 'now'");
  const classicOut = await launch(["--lane", "classic"]);
  const classicArgs = workflowArgs(classicOut);
  ok(classicArgs.lane === "classic" && !("reviewBudget" in classicArgs) && !/lane fast · mechScript on/.test(classicOut), "P39 launcher: --lane classic is passed explicitly and prints no fast-lane echo line");
  const bare = workflowArgs(await launch([]));
  ok(!("lane" in bare) && !("reviewBudget" in bare), "P39 launcher: without --lane/--review-budget the launcher adds neither key (the engine's classic default governs)");
  const frds = ["--frds", "frd-02,frd-03,frd-04,frd-05"];
  const deferSized = await launch([...frds, "--lane", "fast", "--review-budget", "defer"], "40");
  ok(!/recommended\s+floor is 8/.test(deferSized) && /review-budget defer launches no FRD gate/.test(deferSized), "P39 launcher: --review-budget defer launches no gate, so the per-FRD gate sizing floor is replaced by a defer note");
  const nowSized = await launch([...frds, "--lane", "fast"], "40");
  ok(/recommended\s+floor is 8 \+ 20 x FRDs\s+= 88/.test(nowSized), "P39 launcher control: the fast lane with the default review budget keeps the per-FRD gate sizing warning");
}
for (const bad of [["--lane"], ["--lane", "turbo"], ["--lane", "Fast"], ["--review-budget"], ["--review-budget", "later"], ["--review-budget", "defer"], ["--lane", "classic", "--review-budget", "defer"], ["--review-budget", "now", "--lane", "classic"], ["--lane", "fast", "--lane", "classic"], ["--lane", "fast", "--review-budget", "now", "--review-budget", "defer"]]) {
  const root = await fixture({ phase: "architecture", running: "false" });
  let rejected = false;
  try { await exec("bash", [claudeLauncherPath, root, "pro", "8", "auto", ...bad]); } catch (error) { rejected = error.code === 3; }
  let leaseExists = true; try { await access(path.join(root, ".pandacorp/run/build.lease/lease.json")); } catch { leaseExists = false; }
  const status = await readFile(path.join(root, ".pandacorp/status.yaml"), "utf8");
  ok(rejected && !leaseExists && /^phase: architecture$/m.test(status), `P39 launcher rejects ${bad.join(" ")} before taking the lease`);
  await rm(root, { recursive: true });
}
const repo = path.resolve(path.dirname(resolver), "../..");
const [preflight, skill] = await Promise.all([readFile(path.join(repo, "plugin/scripts/preflight-implement.sh"), "utf8"), readFile(path.join(repo, "plugin/skills/implement/SKILL.md"), "utf8")]);
ok(preflight.includes("resolve-build-run-id.mjs") && preflight.includes("--target-runtime"), "preflight reports the shared automatic run-intent classification");
ok(skill.includes("--target-runtime claude --run-mode auto") && skill.includes("owner never copies or chooses that ID"), "implement skill makes automatic continuation the owner-free default");
ok(skill.includes("[--lane fast|classic]") && skill.includes("[--review-budget now|defer]") && /USABLE/.test(skill) && /paused-infra/.test(skill) && /review debt/i.test(skill), "P39: the implement skill documents the launcher's --lane/--review-budget flags, USABLE, review debt and the paused-infra resume");
console.log(`RESULT: ${passed} passed, 0 failed`);
