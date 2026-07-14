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
const repo = path.resolve(path.dirname(resolver), "../..");
const [preflight, skill] = await Promise.all([readFile(path.join(repo, "plugin/scripts/preflight-implement.sh"), "utf8"), readFile(path.join(repo, "plugin/skills/implement/SKILL.md"), "utf8")]);
ok(preflight.includes("resolve-build-run-id.mjs") && preflight.includes("--target-runtime"), "preflight reports the shared automatic run-intent classification");
ok(skill.includes("--target-runtime claude --run-mode auto") && skill.includes("owner never copies or chooses that ID"), "implement skill makes automatic continuation the owner-free default");
console.log(`RESULT: ${passed} passed, 0 failed`);
