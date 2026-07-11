#!/usr/bin/env node
import { spawn } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const launcher = path.join(root, "plugin/scripts/launch-codex-implement.sh");
const collector = path.join(root, "plugin/scripts/collect-codex-unattended-evidence.mjs");
const run = (cmd, args, cwd, env = {}) => new Promise((resolve) => { const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] }); let out = "", err = ""; child.stdout.on("data", (d) => out += d); child.stderr.on("data", (d) => err += d); child.on("close", (code) => resolve({ code, out, err })); });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const project = await mkdtemp(path.join(os.tmpdir(), "pc-r11-live-short-"));
const overlay = (await readFile(path.join(root, "plugin/templates/OVERLAY_VERSION"), "utf8")).trim();
let keep = process.argv.includes("--keep");
try {
  await mkdir(path.join(project, ".pandacorp/run"), { recursive: true }); await mkdir(path.join(project, ".pandacorp/inbox"), { recursive: true }); await mkdir(path.join(project, ".pandacorp/comms"), { recursive: true });
  await mkdir(path.join(project, ".codex/rules"), { recursive: true }); await copyFile(path.join(root, "plugin/templates/shared/.codex/config.toml"), path.join(project, ".codex/config.toml")); await copyFile(path.join(root, "plugin/templates/shared/.codex/rules/pandacorp.rules"), path.join(project, ".codex/rules/pandacorp.rules"));
  await mkdir(path.join(project, "docs/frds/frd-01-canary/work-orders"), { recursive: true }); await mkdir(path.join(project, "docs/analytics"), { recursive: true }); await mkdir(path.join(project, "docs/reviews"), { recursive: true });
  await writeFile(path.join(project, ".gitignore"), ".pandacorp/run/\n.pandacorp/inbox/\n.pandacorp/comms/\n");
  await writeFile(path.join(project, "AGENTS.md"), "# Disposable Pandacorp R11 canary\n\nThis is a synthetic disposable project. Follow the controller prompt exactly. Do not access paths outside this checkout.\n");
  await writeFile(path.join(project, ".pandacorp/status.yaml"), `phase: implementation\noverlay_version: ${overlay}\nrunning: false\nrethink_pending: false\n`);
  await writeFile(path.join(project, ".pandacorp/verify.sh"), "#!/bin/sh\nset -eu\ntest -f canary.txt\ntest -f docs/analytics/events.md\ngrep -q '^## Verification$' docs/analytics/events.md\n"); await chmod(path.join(project, ".pandacorp/verify.sh"), 0o755);
  const fm = "---\nstatus: ACTIVE\nimplementation_status: VERIFIED\n---\n";
  await writeFile(path.join(project, "docs/frds/frd-01-canary/frd.md"), `${fm}\n# R11 live short canary\n`);
  await writeFile(path.join(project, "docs/frds/frd-01-canary/blueprint.md"), `${fm}\n# Blueprint\n\n## Build Plan\n\n| WO | Depends on | Artifacts | Foundation | Parallel with |\n|---|---|---|---|---|\n| WO-CANARY | — | \`canary.txt\` | false | — |\n`);
  await writeFile(path.join(project, "docs/frds/frd-01-canary/work-orders/wo-canary.md"), `${fm.replace("---\n", "---\nid: WO-CANARY\ndependsOn: []\n")}\n# Already verified canary work order\n`);
  await writeFile(path.join(project, "canary.txt"), "Synthetic verified artifact.\n");
  await writeFile(path.join(project, "docs/analytics/events.md"), "# Synthetic event plan\n\nNo production data or credentials are used.\n\n## Verification\n\n- The disposable verifier asserts the synthetic artifact and this exact evidence heading.\n");
  const day = new Date().toISOString().slice(0, 10); await writeFile(path.join(project, `docs/reviews/security-${day}.md`), "# Synthetic security review\n\nDisposable fixture only: no network service, dependency, secret, user input, production data, deployment or external side effect exists.\n");
  for (const args of [["init", "-q"], ["config", "user.email", "r11-live@example.invalid"], ["config", "user.name", "R11 live canary"], ["add", "-A"], ["commit", "-qm", "test: seed disposable live canary"]]) { const result = await run("git", args, project); if (result.code) throw new Error(result.err); }
  const launched = await run("bash", [launcher, project, "4", "900", "0", "1"], project); if (launched.code) throw new Error(`launcher failed\n${launched.out}\n${launched.err}`);
  process.stdout.write(launched.out); const receipt = JSON.parse(await readFile(path.join(project, ".pandacorp/run/codex-launch.json"), "utf8"));
  let terminal = null; for (let i = 0; i < 180; i++) { try { const cp = JSON.parse(await readFile(path.join(project, ".pandacorp/run/codex-checkpoint.json"), "utf8")); if (cp.terminal_reason) { terminal = cp; break; } } catch {} await sleep(5000); }
  if (!terminal) { try { process.kill(receipt.pid, "SIGTERM"); } catch {} throw new Error("live canary timed out without terminal checkpoint"); }
  for (let i = 0; i < 30; i++) { try { process.kill(receipt.pid, 0); await sleep(1000); } catch { break; } }
  const collected = await run("node", [collector, project], project); process.stdout.write(collected.out); if (collected.code) { keep = true; throw new Error(`collector rejected canary\n${collected.err}`); }
  const evidence = JSON.parse(collected.out); if (evidence.evidence_class !== "LIVE_SHORT" || evidence.verdict !== "GO") { keep = true; throw new Error(`unexpected live verdict ${collected.out}`); }
  process.stdout.write(`${JSON.stringify({ verdict: "LIVE_SHORT_GO", disposable_project: project, kept: keep }, null, 2)}\n`);
} catch (error) {
  keep = true; console.error(error.stack || error); console.error(`Disposable evidence retained at ${project}`); process.exitCode = 1;
} finally { if (!keep) await rm(project, { recursive: true, force: true }); }
