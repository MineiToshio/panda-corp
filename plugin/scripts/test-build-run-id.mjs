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
  ok(!("parallelGates" in args) && !("gateSlots" in args) && !("gateEvidence" in args) && !("gateContextScope" in args) && !("driftFinder" in args) && !("gateInventoryCache" in args), "without --parallel-gates/--gate-evidence/--gate-context-scope/--drift-finder/--gate-inventory-cache the launcher adds none of those keys (the engine defaults stay)");
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
for (const bad of [["--gate-slots", "2"], ["--parallel-gates", "--gate-slots", "9"], ["--parallel-gates", "--gate-slots", "x"], ["--gate-evidence", "digest"], ["--gate-evidence"], ["--drift-finder"], ["--drift-finder", "yes"], ["--drift-finder", "true"], ["--gate-context-scope", "true"], ["--gate-inventory-cache", "on"]]) {
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
  // Canary E budget: with --parallel-gates, maxAgents below 15 x the FRDs to gate warns before the run starts.
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "40", "auto", "--frds", "frd-02,frd-03,frd-04,frd-05", "--parallel-gates"]);
  ok(/--parallel-gates with maxAgents=40 for 4 FRD\(s\): the recommended floor is 15 x FRDs\s+= 60/.test(launched.stdout), "canary E: --parallel-gates with maxAgents 40 for 4 FRDs warns the floor is 60");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "60", "auto", "--frds", "frd-02,frd-03,frd-04,frd-05", "--parallel-gates"]);
  ok(!/recommended floor is 15 x FRDs/.test(launched.stdout) && !/NOTE: --parallel-gates/.test(launched.stdout), "canary E control: maxAgents 60 for 4 FRDs prints no parallel-gates budget warning");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "40", "auto", "--parallel-gates"]);
  ok(/NOTE: --parallel-gates: size maxAgents to at least 15 x the FRDs this run will gate/.test(launched.stdout), "canary E: an untargeted --parallel-gates run gets the 15-per-FRD sizing note");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
{
  const root = await fixture({ phase: "architecture", running: "false" });
  const launched = await exec("bash", [claudeLauncherPath, root, "powerful", "20", "auto", "--frds", "frd-a"]);
  ok(!/15 x (the )?FRDs/.test(launched.stdout), "canary E control: without --parallel-gates no parallel-gates budget line is printed");
  await releaseLauncherLease(root, launched.stdout); await rm(root, { recursive: true });
}
const repo = path.resolve(path.dirname(resolver), "../..");
const [preflight, skill] = await Promise.all([readFile(path.join(repo, "plugin/scripts/preflight-implement.sh"), "utf8"), readFile(path.join(repo, "plugin/skills/implement/SKILL.md"), "utf8")]);
ok(preflight.includes("resolve-build-run-id.mjs") && preflight.includes("--target-runtime"), "preflight reports the shared automatic run-intent classification");
ok(skill.includes("--target-runtime claude --run-mode auto") && skill.includes("owner never copies or chooses that ID"), "implement skill makes automatic continuation the owner-free default");
console.log(`RESULT: ${passed} passed, 0 failed`);
