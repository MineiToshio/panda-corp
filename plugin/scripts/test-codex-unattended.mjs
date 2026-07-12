#!/usr/bin/env node
import { spawn } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const executor = path.join(root, "plugin/runtime/codex/executor.mjs");
const supervisor = path.join(root, "plugin/runtime/codex/supervisor.mjs");
const preflight = path.join(root, "plugin/scripts/preflight-codex-unattended.mjs");
const run = (cmd, args, cwd, env = {}) => new Promise((resolve) => { const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] }); let out = "", err = ""; child.stdout.on("data", (d) => out += d); child.stderr.on("data", (d) => err += d); child.on("close", (code, signal) => resolve({ code, signal, out, err })); });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const exists = (file) => readFile(file).then(() => true).catch(() => false);
const read = (file) => readFile(file, "utf8");
const must = (condition, message) => { if (!condition) throw new Error(message); };
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (error) { console.error(`FAIL  ${name}: ${error.stack || error}`); failed++; } };
const projects = [];

async function fixture({ rethink = false } = {}) {
  const project = await mkdtemp(path.join(os.tmpdir(), "pc-r11-")); projects.push(project);
  await mkdir(path.join(project, ".pandacorp/run"), { recursive: true });
  await mkdir(path.join(project, ".pandacorp/inbox"), { recursive: true });
  await mkdir(path.join(project, ".pandacorp/comms"), { recursive: true });
  await mkdir(path.join(project, "docs/frds/frd-01-r11/work-orders"), { recursive: true });
  await mkdir(path.join(project, "docs/analytics"), { recursive: true });
  await mkdir(path.join(project, "docs/reviews"), { recursive: true });
  await mkdir(path.join(project, ".codex/rules"), { recursive: true });
  await writeFile(path.join(project, ".gitignore"), ".pandacorp/run/\n.pandacorp/inbox/\n.pandacorp/comms/\n");
  const overlay = (await read(path.join(root, "plugin/templates/OVERLAY_VERSION"))).trim();
  await writeFile(path.join(project, ".pandacorp/status.yaml"), `phase: implementation\noverlay_version: ${overlay}\nrunning: false\nrethink_pending: ${rethink}\n`);
  await writeFile(path.join(project, ".pandacorp/verify.sh"), "#!/bin/sh\nexit 0\n"); await chmod(path.join(project, ".pandacorp/verify.sh"), 0o755);
  await copyFile(path.join(root, "plugin/templates/shared/.codex/config.toml"), path.join(project, ".codex/config.toml"));
  await copyFile(path.join(root, "plugin/templates/shared/.codex/rules/pandacorp.rules"), path.join(project, ".codex/rules/pandacorp.rules"));
  await writeFile(path.join(project, "docs/frds/frd-01-r11/frd.md"), "---\nimplementation_status: PLANNED\n---\n");
  await writeFile(path.join(project, "docs/frds/frd-01-r11/blueprint.md"), "---\nimplementation_status: PLANNED\n---\n\n## Build Plan\n\n| WO | Depends on | Artifacts | Foundation | Parallel with |\n|---|---|---|---|---|\n| WO-R11 | — | `feature.txt` | false | — |\n");
  await writeFile(path.join(project, "docs/frds/frd-01-r11/work-orders/wo-r11.md"), "---\nid: WO-R11\nimplementation_status: PLANNED\ndependsOn: []\n---\n");
  await writeFile(path.join(project, "docs/analytics/events.md"), "# Events\n");
  const worker = path.join(project, "fake-codex.mjs");
  await writeFile(worker, `#!/usr/bin/env node
import{appendFileSync,writeFileSync}from'node:fs';
const a=process.argv.slice(2),o=a[a.indexOf('--output-last-message')+1],prompt=a[a.length-1],scenario=process.env.R11_SCENARIO||'hang';appendFileSync('.pandacorp/run/dispatches.log',prompt.includes('Implement exactly')?'implement\\n':'other\\n');
if(['uncertain','usage-limit','network','rate-limit','auth-expired','approval-denied'].includes(scenario)){const diagnostic={uncertain:'PRIVATE_TOKEN=must-never-persist opaque provider failure','usage-limit':'usage limit reached; purchase more credits',network:'network connection reset','rate-limit':'HTTP 429 rate limit','auth-expired':'authentication failed: expired token','approval-denied':'approval denied by policy'}[scenario];console.error(diagnostic);writeFileSync('uncertain-output.txt',scenario+'\\n');process.exit({uncertain:7,'usage-limit':27,network:28,'rate-limit':29,'auth-expired':30,'approval-denied':31}[scenario])}
if(scenario==='hang')await new Promise(()=>setInterval(()=>{},1000));
writeFileSync(o,JSON.stringify({done:true,verdict:'green',summary:'fixture',findings:[]}));
`); await chmod(worker, 0o755);
  for (const args of [["init", "-q"], ["config", "user.email", "r11@example.invalid"], ["config", "user.name", "R11 fixture"], ["add", "-A"], ["commit", "-qm", "test: seed R11 fixture"]]) { const result = await run("git", args, project); must(result.code === 0, result.err); }
  return { project, worker };
}

await test("offline preflight is fail-closed and leaves the disposable fixture untouched", async () => {
  const fx = await fixture({ rethink: true }); const before = (await run("git", ["status", "--porcelain"], fx.project)).out;
  const result = await run("node", [preflight, fx.project, "--offline"], fx.project); must(result.code === 0, `${result.out}\n${result.err}`);
  const report = JSON.parse(result.out); must(report.verdict === "GO" && report.evidence_class === "OFFLINE_ACCELERATED" && report.checks.every((item) => item.status === "PASS"), result.out);
  must((await run("git", ["status", "--porcelain"], fx.project)).out === before, "preflight changed the fixture");
});

await test("preflight rejects dirty baselines and protected-state symlinks", async () => {
  const dirty = await fixture(); await writeFile(path.join(dirty.project, "owner-edit.txt"), "do not launch\n");
  const dirtyResult = await run("node", [preflight, dirty.project, "--offline"], dirty.project); must(dirtyResult.code === 3 && /clean-baseline/.test(dirtyResult.out), dirtyResult.out);
  const linked = await fixture(); const status = path.join(linked.project, ".pandacorp/status.yaml"); await rm(status); await symlink(path.join(linked.project, ".gitignore"), status);
  const linkedResult = await run("node", [preflight, linked.project, "--offline"], linked.project); must(linkedResult.code === 3 && /status-state/.test(linkedResult.out), linkedResult.out);
});

await test("preflight rejects drifted project enforcement and permits only the exact stale run", async () => {
  const drifted = await fixture(); await writeFile(path.join(drifted.project, ".codex/config.toml"), "sandbox_mode = \"danger-full-access\"\n");
  const driftedResult = await run("node", [preflight, drifted.project, "--offline"], drifted.project); must(driftedResult.code === 3 && /codex-config-projection/.test(driftedResult.out), driftedResult.out);
  const fx = await fixture(); const leaseDir = path.join(fx.project, ".pandacorp/run/build.lease"); await mkdir(leaseDir);
  await writeFile(path.join(leaseDir, "lease.json"), JSON.stringify({ version: 1, runtime: "codex", run_id: "resume-exact", token_hash: "x", epoch: 1, acquired_at: "2000-01-01T00:00:00.000Z", renewed_at: "2000-01-01T00:00:00.000Z", ttl_seconds: 3 }));
  await writeFile(path.join(fx.project, ".pandacorp/status.yaml"), `phase: implementation\noverlay_version: ${(await read(path.join(root, "plugin/templates/OVERLAY_VERSION"))).trim()}\nrunning: true\nsupervisor_heartbeat: 2000-01-01T00:00:00.000Z\n`);
  const wrong = await run("bash", [path.join(root, "plugin/scripts/preflight-implement.sh"), fx.project, "--continue-runtime", "codex", "--continue-run-id", "foreign"], fx.project); must(wrong.code !== 0 && /STALE ATOMIC LEASE/.test(wrong.out), wrong.out);
  const exact = await run("bash", [path.join(root, "plugin/scripts/preflight-implement.sh"), fx.project, "--continue-runtime", "codex", "--continue-run-id", "resume-exact"], fx.project); must(exact.code === 0 && /fenced reclaim permitted/.test(exact.out), exact.out);
});

await test("executor renews the fenced heartbeat at no slower than TTL/3 and kills its worker tree on stop", async () => {
  const fx = await fixture(); const leaseFile = path.join(fx.project, ".pandacorp/run/build.lease/lease.json");
  const child = spawn("node", [executor, "--project", fx.project, "--run-id", "r11-heartbeat", "--max-spend", "4", "--max-duration", "30"], { cwd: fx.project, env: { ...process.env, PANDACORP_CODEX_BIN: fx.worker, R11_SCENARIO: "hang", PANDACORP_LEASE_TTL_SECONDS: "3", PANDACORP_LEASE_RENEW_MS: "500" }, stdio: ["ignore", "pipe", "pipe"] });
  let first; for (let i = 0; i < 100; i++) { if (await exists(leaseFile)) { first = JSON.parse(await read(leaseFile)); break; } await sleep(20); } must(first, "lease was not acquired");
  let renewed; for (let i = 0; i < 100; i++) { const body = await read(leaseFile).catch(() => null); if (body) { const value = JSON.parse(body); if (value.renewed_at !== first.renewed_at) { renewed = value; break; } } await sleep(20); } must(renewed, "heartbeat did not renew");
  must(Date.parse(renewed.renewed_at) - Date.parse(first.renewed_at) <= 1000, `renewal exceeded TTL/3: ${JSON.stringify({ first, renewed })}`);
  child.kill("SIGTERM"); const code = await new Promise((resolve) => child.on("close", resolve)); must(code === 26, `stop exit ${code}`); must(!await exists(leaseFile), "lease survived process-tree quiescence");
});

await test("uncertain result survives restart and never duplicates the durable dispatch", async () => {
  const fx = await fixture(); const args = [executor, "--project", fx.project, "--run-id", "r11-uncertain", "--max-spend", "4", "--max-duration", "30"];
  const first = await run("node", args, fx.project, { PANDACORP_CODEX_BIN: fx.worker, R11_SCENARIO: "uncertain" }); must(first.code === 25, `first exit ${first.code}: ${first.err}`);
  const second = await run("node", args, fx.project, { PANDACORP_CODEX_BIN: fx.worker, R11_SCENARIO: "success" }); must(second.code === 25 || second.code === 20, `restart exit ${second.code}: ${second.err}`);
  const dispatches = (await read(path.join(fx.project, ".pandacorp/run/dispatches.log"))).trim().split("\n"); must(dispatches.length === 1, `dispatch duplicated: ${dispatches}`);
  const decisions = await read(path.join(fx.project, ".pandacorp/inbox/decisions.md")); must(/without a trustworthy terminal result/.test(decisions), decisions);
  const persisted = `${await read(path.join(fx.project, ".pandacorp/run/codex-checkpoint.json"))}\n${await read(path.join(fx.project, ".pandacorp/run/codex-executor.jsonl"))}\n${decisions}`;
  must(/"error_class": "unknown"|"error_class":"unknown"|provider class: unknown/.test(persisted), persisted);
  must(!persisted.includes("PRIVATE_TOKEN") && !persisted.includes("must-never-persist"), "raw provider diagnostic leaked into durable state");
});

await test("provider failures are classified sanitizably and still fail safe without blind retries", async () => {
  const expected = { "usage-limit": "usage_limit", network: "network", "rate-limit": "rate_limit", "auth-expired": "auth", "approval-denied": "approval" };
  for (const scenario of Object.keys(expected)) {
    const fx = await fixture(); const args = [executor, "--project", fx.project, "--run-id", `r11-${scenario}`, "--max-spend", "4", "--max-duration", "30"];
    const first = await run("node", args, fx.project, { PANDACORP_CODEX_BIN: fx.worker, R11_SCENARIO: scenario }); must(first.code === 25, `${scenario} exit ${first.code}: ${first.err}`);
    const checkpoint = JSON.parse(await read(path.join(fx.project, ".pandacorp/run/codex-checkpoint.json"))); must(checkpoint.uncertain?.error_class === expected[scenario], `${scenario} class: ${JSON.stringify(checkpoint)}`);
    const journal = await read(path.join(fx.project, ".pandacorp/run/codex-executor.jsonl")); must(journal.includes(`"error_class":"${expected[scenario]}"`), `${scenario} journal class absent`);
    const second = await run("node", args, fx.project, { PANDACORP_CODEX_BIN: fx.worker, R11_SCENARIO: "success" }); must(new Set([20, 25]).has(second.code), `${scenario} restart ${second.code}`);
    const dispatches = (await read(path.join(fx.project, ".pandacorp/run/dispatches.log"))).trim().split("\n"); must(dispatches.length === 1, `${scenario} duplicated ${dispatches}`);
  }
});

await test("live preflight rejects missing credentials and network independently", async () => {
  const fx = await fixture({ rethink: true }); const bin = await mkdtemp(path.join(os.tmpdir(), "pc-r11-preflight-bin-")); projects.push(bin);
  await writeFile(path.join(bin, "codex-fail-auth"), "#!/bin/sh\n[ \"${1:-}\" = login ] && exit 4\necho codex-cli-test\n");
  await writeFile(path.join(bin, "codex-ok"), "#!/bin/sh\n[ \"${1:-}\" = login ] && echo logged-in || echo codex-cli-test\n");
  await writeFile(path.join(bin, "curl"), "#!/bin/sh\nexit 6\n");
  for (const file of ["codex-fail-auth", "codex-ok", "curl"]) await chmod(path.join(bin, file), 0o755);
  const auth = await run("node", [preflight, fx.project], fx.project, { PANDACORP_CODEX_BIN: path.join(bin, "codex-fail-auth"), PATH: `${bin}:${process.env.PATH}` }); must(auth.code === 3 && /"id": "credentials"[\s\S]*?"status": "FAIL"/.test(auth.out), auth.out);
  const network = await run("node", [preflight, fx.project], fx.project, { PANDACORP_CODEX_BIN: path.join(bin, "codex-ok"), PATH: `${bin}:${process.env.PATH}` }); must(network.code === 3 && /"id": "network"[\s\S]*?"status": "FAIL"/.test(network.out), network.out);
});

await test("supervisor restart uses bounded backoff and terminates on durable owner state", async () => {
  const fx = await fixture(); const stub = path.join(fx.project, "restart-stub.mjs");
  await writeFile(stub, `import{appendFileSync,readFileSync,writeFileSync}from'node:fs';const a=process.argv,p=a[a.indexOf('--project')+1],r=a[a.indexOf('--run-id')+1],f=p+'/.pandacorp/run/restart-count';let n=0;try{n=readFileSync(f,'utf8').trim().split('\\n').filter(Boolean).length}catch{}appendFileSync(f,'1\\n');if(n===0)process.exit(2);writeFileSync(p+'/.pandacorp/run/codex-checkpoint.json',JSON.stringify({run_id:r,terminal_reason:'needs-owner'}));process.exit(20);`);
  const result = await run("node", [supervisor, "--project", fx.project, "--run-id", "r11-restart", "--max-spend", "1", "--max-duration", "30", "--max-retries", "0", "--max-blocks", "1"], fx.project, { PANDACORP_EXECUTOR_PATH: stub, PANDACORP_SUPERVISOR_RESTART_WAIT_MS: "10", PANDACORP_SUPERVISOR_MAX_CRASHES: "3" });
  must(result.code === 0, result.err); const count = (await read(path.join(fx.project, ".pandacorp/run/restart-count"))).trim().split("\n").length; must(count === 2, `worker starts ${count}`);
  const journal = await read(path.join(fx.project, ".pandacorp/run/codex-supervisor.jsonl")); must(/restart_wait/.test(journal) && /supervisor_terminal/.test(journal) && /needs-owner/.test(journal), journal);
});

await test("supervisor circuit breaker stops crash loops", async () => {
  const fx = await fixture(); const stub = path.join(fx.project, "crash-stub.mjs"); await writeFile(stub, `import{appendFileSync}from'node:fs';const a=process.argv,p=a[a.indexOf('--project')+1];appendFileSync(p+'/.pandacorp/run/crash-count','1\\n');process.exit(2);`);
  const result = await run("node", [supervisor, "--project", fx.project, "--run-id", "r11-breaker", "--max-spend", "1", "--max-duration", "30", "--max-retries", "0", "--max-blocks", "1"], fx.project, { PANDACORP_EXECUTOR_PATH: stub, PANDACORP_SUPERVISOR_RESTART_WAIT_MS: "5", PANDACORP_SUPERVISOR_MAX_CRASHES: "3" });
  must(result.code === 2, `breaker exit ${result.code}`); const count = (await read(path.join(fx.project, ".pandacorp/run/crash-count"))).trim().split("\n").length; must(count === 3, `crash count ${count}`);
  must(/supervisor_exhausted/.test(await read(path.join(fx.project, ".pandacorp/run/codex-supervisor.jsonl"))), "breaker event missing");
});

await test("a signal interrupts supervisor backoff without relaunching", async () => {
  const fx = await fixture(); const stub = path.join(fx.project, "signal-backoff-stub.mjs"); await writeFile(stub, `import{appendFileSync}from'node:fs';const a=process.argv,p=a[a.indexOf('--project')+1];appendFileSync(p+'/.pandacorp/run/signal-count','1\\n');process.exit(2);`);
  const child = spawn("node", [supervisor, "--project", fx.project, "--run-id", "r11-signal-backoff", "--max-spend", "1", "--max-duration", "30", "--max-retries", "0", "--max-blocks", "1"], { cwd: fx.project, env: { ...process.env, PANDACORP_EXECUTOR_PATH: stub, PANDACORP_SUPERVISOR_RESTART_WAIT_MS: "60000", PANDACORP_SUPERVISOR_MAX_CRASHES: "3" }, stdio: ["ignore", "pipe", "pipe"] });
  const journal = path.join(fx.project, ".pandacorp/run/codex-supervisor.jsonl"); for (let i=0;i<200 && !/restart_wait/.test(await read(journal).catch(()=>""));i++) await sleep(10);
  const before = Date.now(); child.kill("SIGTERM"); const code = await new Promise((resolve) => child.on("close", resolve)); must(Date.now()-before < 1500, "signal waited for full backoff"); must(code === 0, `signal exit ${code}`);
  const count = (await read(path.join(fx.project, ".pandacorp/run/signal-count"))).trim().split("\n").length; must(count === 1, `worker relaunched after signal: ${count}`);
});

await test("launcher prevents sleep for the whole supervisor and preserves spaced paths in an atomic argv receipt", async () => {
  const fx = await fixture(); const spaced = `${fx.project} with spaces`; await rename(fx.project, spaced); projects[projects.indexOf(fx.project)] = spaced;
  const bin = await mkdtemp(path.join(os.tmpdir(), "pc-r11-fake-bin-")); projects.push(bin); const wrapLog = path.join(spaced, ".pandacorp/run/wrapper.json");
  await writeFile(path.join(bin, "codex"), "#!/bin/sh\ncase \"$1 $2\" in 'login status') echo logged-in;; *) echo codex-cli-test;; esac\n");
  await writeFile(path.join(bin, "curl"), "#!/bin/sh\nexit 0\n");
  await writeFile(path.join(bin, "caffeinate"), "#!/bin/sh\n[ \"${1:-}\" = -h ] && exit 0\nnode -e 'require(\"node:fs\").writeFileSync(process.env.R11_WRAP_LOG,JSON.stringify(process.argv.slice(1)))' -- \"$@\"\nwhile [ $# -gt 0 ]; do [ \"$1\" = -w ] && { shift; target=$1; break; }; shift; done\nwhile kill -0 \"$target\" 2>/dev/null; do sleep 0.05; done\n");
  for (const file of ["codex", "curl", "caffeinate"]) await chmod(path.join(bin, file), 0o755);
  const stub = path.join(bin, "executor-stub.mjs"); await writeFile(stub, `setInterval(()=>{},1000);for(const s of['SIGINT','SIGTERM','SIGHUP'])process.on(s,()=>process.exit(26));`);
  const result = await run("bash", [path.join(root, "plugin/scripts/launch-codex-implement.sh"), spaced, "4", "60", "0", "1", "chosen-change", "frd-01-r11"], spaced, { PATH: `${bin}:${process.env.PATH}`, PANDACORP_CODEX_BIN: path.join(bin, "codex"), PANDACORP_EXECUTOR_PATH: stub, R11_WRAP_LOG: wrapLog });
  must(result.code === 0, `${result.out}\n${result.err}`); const receipt = JSON.parse(await read(path.join(spaced, ".pandacorp/run/codex-launch.json")));
  const canonical = await realpath(spaced); must(Array.isArray(receipt.resume_argv) && receipt.resume_argv[0] === "bash" && receipt.resume_argv[2] === canonical && receipt.resume_argv.at(-2) === receipt.run_id && receipt.resume_argv.at(-1) === "background" && receipt.launch_mode === "background" && !Object.hasOwn(receipt, "resume_command"), JSON.stringify(receipt));
  must(receipt.resume_argv.slice(7,9).join("|") === "chosen-change|frd-01-r11", `targeted scope lost: ${JSON.stringify(receipt.resume_argv)}`);
  must(Array.isArray(receipt.supervisor_argv) && receipt.supervisor_argv.includes("--change") && receipt.supervisor_argv.includes("chosen-change") && receipt.supervisor_argv.includes("--frds") && receipt.supervisor_argv.includes("frd-01-r11"), JSON.stringify(receipt));
  const wrapped = JSON.parse(await read(wrapLog)); must(wrapped.includes("-dimsu") && wrapped.includes("-w") && wrapped.includes(String(receipt.supervisor_pid)), JSON.stringify(wrapped));
  must(receipt.pid === receipt.supervisor_pid && Number.isSafeInteger(receipt.sleep_inhibitor_pid), JSON.stringify(receipt)); process.kill(receipt.supervisor_pid, "SIGTERM");
  for (let i=0;i<750;i++){let supervisor=true,inhibitor=true;try{process.kill(receipt.supervisor_pid,0)}catch{supervisor=false}try{process.kill(receipt.sleep_inhibitor_pid,0)}catch{inhibitor=false}if(!supervisor&&!inhibitor)break;await sleep(20);}
  for (const [label,pid] of [["supervisor",receipt.supervisor_pid],["inhibitor",receipt.sleep_inhibitor_pid]]) { let alive=true; try { process.kill(pid,0); } catch { alive=false; } must(!alive, `${label} ${pid} survived stop`); }
  const status=await read(path.join(spaced,".pandacorp/status.yaml"));must(/running: false/.test(status),status);must(!await exists(path.join(spaced,".pandacorp/run/build.lease/lease.json")),"lease survived launcher stop");
});

await test("foreground launcher owns the process lifetime and forwards termination", async () => {
  const fx = await fixture(); const bin = await mkdtemp(path.join(os.tmpdir(), "pc-r11-fg-bin-")); projects.push(bin);
  await writeFile(path.join(bin, "codex"), "#!/bin/sh\ncase \"$1 $2\" in 'login status') echo logged-in;; *) echo codex-cli-test;; esac\n");
  await writeFile(path.join(bin, "curl"), "#!/bin/sh\nexit 0\n");
  await writeFile(path.join(bin, "caffeinate"), "#!/bin/sh\n[ \"${1:-}\" = -h ] && exit 0\ntrap 'exit 0' INT TERM HUP\nwhile [ $# -gt 0 ]; do [ \"$1\" = -w ] && { shift; target=$1; break; }; shift; done\nwhile kill -0 \"$target\" 2>/dev/null; do sleep 0.05; done\n");
  for (const file of ["codex", "curl", "caffeinate"]) await chmod(path.join(bin, file), 0o755);
  const stub = path.join(bin, "executor-stub.mjs"); await writeFile(stub, `setInterval(()=>{},1000);for(const s of['SIGINT','SIGTERM','SIGHUP'])process.on(s,()=>process.exit(26));`);
  const child = spawn("bash", [path.join(root, "plugin/scripts/launch-codex-implement.sh"), fx.project, "4", "60", "0", "1", "chosen-change", "frd-foreground", "auto", "foreground"], { cwd: fx.project, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PANDACORP_CODEX_BIN: path.join(bin, "codex"), PANDACORP_EXECUTOR_PATH: stub }, stdio: ["ignore", "pipe", "pipe"] });
  const receiptPath=path.join(fx.project,".pandacorp/run/codex-launch.json"); for(let i=0;i<300&&!await exists(receiptPath);i++) await sleep(10);
  const receipt=JSON.parse(await read(receiptPath)); must(receipt.launch_mode==="foreground"&&receipt.launcher_pid===child.pid&&receipt.resume_argv.at(-1)==="foreground"&&receipt.resume_argv.at(-2)===receipt.run_id,JSON.stringify(receipt));
  for(const pid of [child.pid,receipt.supervisor_pid,receipt.sleep_inhibitor_pid]){let alive=true;try{process.kill(pid,0)}catch{alive=false}must(alive,`foreground process ${pid} was not live`)}
  child.kill("SIGTERM"); await new Promise(resolve=>child.on("close",resolve));
  for(let i=0;i<750;i++){let alive=false;for(const pid of [receipt.supervisor_pid,receipt.sleep_inhibitor_pid])try{process.kill(pid,0);alive=true}catch{}if(!alive)break;await sleep(20)}
  for(const [label,pid] of [["supervisor",receipt.supervisor_pid],["inhibitor",receipt.sleep_inhibitor_pid]]){let alive=true;try{process.kill(pid,0)}catch{alive=false}must(!alive,`foreground ${label} ${pid} survived SIGTERM`)}
});

await test("evidence collector reads the real normalized journal schema and fails closed", async () => {
  const fx = await fixture(); const runDir = path.join(fx.project, ".pandacorp/run"); const runId = "r11-evidence"; const started = "2026-07-11T00:00:00.000Z", terminal = "2026-07-11T00:05:00.000Z";
  await writeFile(path.join(runDir, "codex-launch.json"), JSON.stringify({ run_id: runId, pid: 101, supervisor_pid: 101, sleep_inhibitor_pid: 102, launch_mode: "background", runtime: "codex", started_at: started, resume_argv: ["bash", "/factory/plugin/scripts/launch-codex-implement.sh", fx.project, "4", "300", "2", "3", "", "", runId, "background"], supervisor_argv: ["node", "/factory/plugin/runtime/codex/supervisor.mjs", "--run-id", runId] }));
  await writeFile(path.join(runDir, "codex-checkpoint.json"), JSON.stringify({ run_id: runId, terminal_reason: "complete", terminal_at: terminal }));
  await writeFile(path.join(runDir, "run-ledger.json"), JSON.stringify({ run_id: runId, spend_units: 4, dispatch_count: 2 }));
  await writeFile(path.join(runDir, "codex-supervisor.jsonl"), `${JSON.stringify({ at: terminal, event: "supervisor_terminal", run_id: runId, reason: "complete" })}\n`);
  const ev = (id, semantic_name, data = {}, subject = fx.project) => JSON.stringify({ at: semantic_name === "build.launch" ? started : terminal, runtime: "codex", run_id: runId, event_id: id, event: semantic_name, semantic_name, subject, data });
  await writeFile(path.join(runDir, "codex-executor.jsonl"), `${ev("e1", "build.launch", { lease_ttl_seconds: 600, heartbeat_interval_ms: 120000 })}\n${ev("e2", "agent.working", { dispatch_id: "hardening-audit" }, "hardening-audit")}\n${ev("e3", "agent.working", { dispatch_id: "hardening-fix" }, "hardening-fix")}\n${ev("e4", "build.complete", { reason: "complete" })}\n${ev("e5", "lease.released", { reason: "complete" })}\n`);
  const result = await run("node", [path.join(root, "plugin/scripts/collect-codex-unattended-evidence.mjs"), fx.project], fx.project); must(result.code === 0, `${result.out}\n${result.err}`); const evidence = JSON.parse(result.out);
  must(evidence.evidence_class === "LIVE_SHORT" && evidence.heartbeat_within_ttl_third && evidence.lease_released && evidence.supervisor_terminal, result.out);
  const journal = path.join(runDir, "codex-executor.jsonl"); await writeFile(journal, `${JSON.stringify({ at: started, runtime: "codex", run_id: "foreign", event_id: "foreign", event: "BuildLaunch", semantic_name: "build.launch", data: {} })}\n`);
  const corrupt = await run("node", [path.join(root, "plugin/scripts/collect-codex-unattended-evidence.mjs"), fx.project], fx.project); must(corrupt.code !== 0, "collector accepted foreign/corrupt evidence");
  await writeFile(journal, `${ev("e1", "build.launch", { lease_ttl_seconds: 600, heartbeat_interval_ms: 120000 })}\n${ev("e2", "agent.working", { dispatch_id: "hardening-audit" }, "hardening-audit")}\n${ev("e3", "agent.working", { dispatch_id: "hardening-fix" }, "hardening-fix")}\n${ev("e4", "build.complete", { reason: "complete" })}\n${ev("e5", "lease.released", { reason: "complete" })}\n`);
  await writeFile(path.join(runDir, "run-ledger.json"), JSON.stringify({ run_id: "foreign", spend_units: 4, dispatch_count: 2 }));
  const mixed = await run("node", [path.join(root, "plugin/scripts/collect-codex-unattended-evidence.mjs"), fx.project], fx.project); must(mixed.code !== 0, "collector accepted a foreign ledger");
});

await test("R11 evidence classes cannot promote an accelerated soak to overnight", async () => {
  const contract = await read(path.join(root, "plugin/runtime/codex/R11-CERTIFICATION.md"));
  must(/OFFLINE_ACCELERATED/.test(contract) && /LIVE_SHORT/.test(contract) && /LIVE_OVERNIGHT/.test(contract), "evidence classes missing");
  must(/PENDING/.test(contract) && /several hours/i.test(contract), "overnight gate is not honestly pending");
  const ownership = JSON.parse(await read(path.join(root, "plugin/runtime/capability-ownership.json")));
  must(ownership.capabilities["pandacorp-memory-review"].scheduler_owner === "claude" && ownership.capabilities["pandacorp-review-launch"].scheduler_owner === "claude", "routine ownership drift");
});

for (const project of projects) await rm(project, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
