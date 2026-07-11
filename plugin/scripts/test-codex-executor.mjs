#!/usr/bin/env node
import { chmod, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const executor = path.join(root, "plugin/runtime/codex/executor.mjs");
const supervisor = path.join(root, "plugin/runtime/codex/supervisor.mjs");
const run = (cmd, args, cwd, env = {}) => new Promise((resolve) => { const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] }); let out = "", err = ""; child.stdout.on("data", (d) => out += d); child.stderr.on("data", (d) => err += d); child.on("close", (code, signal) => resolve({ code, signal, out, err })); });
const ok = (condition, message) => { if (!condition) throw new Error(message); };
const read = (file) => readFile(file, "utf8");
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`PASS  ${name}`); passed++; } catch (error) { console.error(`FAIL  ${name}: ${error.stack || error}`); failed++; } };

async function fixture({ planDeps = "—", frontmatterDeps = "[]", rethink = false } = {}) {
  const project = await mkdtemp(path.join(os.tmpdir(), "pc-codex-exec-"));
  await mkdir(path.join(project, ".pandacorp/run"), { recursive: true }); await mkdir(path.join(project, ".pandacorp/inbox"), { recursive: true }); await mkdir(path.join(project, ".pandacorp/comms"), { recursive: true });
  await mkdir(path.join(project, "docs/frds/frd-01-a/work-orders"), { recursive: true }); await mkdir(path.join(project, "docs/analytics"), { recursive: true }); await mkdir(path.join(project, "docs/reviews"), { recursive: true });
  await writeFile(path.join(project, ".gitignore"), ".pandacorp/run/\n.pandacorp/inbox/\n.pandacorp/comms/\n");
  await writeFile(path.join(project, ".pandacorp/status.yaml"), `phase: implementation\nrunning: false\nrethink_pending: ${rethink}\n`);
  await writeFile(path.join(project, ".pandacorp/verify.sh"), "#!/bin/sh\n[ ! -f .verify-red ]\n"); await chmod(path.join(project, ".pandacorp/verify.sh"), 0o755);
  await writeFile(path.join(project, "docs/frds/frd-01-a/frd.md"), "---\nimplementation_status: PLANNED\n---\n");
  await writeFile(path.join(project, "docs/frds/frd-01-a/blueprint.md"), `---\nimplementation_status: PLANNED\n---\n\n## Build Plan\n\n| WO | Depends on | Artifacts | Foundation | Parallel with |\n|---|---|---|---|---|\n| WO-01 | ${planDeps} | \`feature.txt\` | false | — |\n`);
  await writeFile(path.join(project, "docs/frds/frd-01-a/work-orders/wo-01.md"), `---\nid: WO-01\nimplementation_status: PLANNED\ndependsOn: ${frontmatterDeps}\n---\n`);
  await writeFile(path.join(project, "docs/analytics/events.md"), "# Events\n");
  const fake = path.join(project, "fake-codex.mjs");
  await writeFile(fake, `#!/usr/bin/env node
import{writeFileSync,mkdirSync,appendFileSync,readFileSync}from'node:fs';import{join}from'node:path';import{spawn}from'node:child_process';
const a=process.argv.slice(2),o=a[a.indexOf('--output-last-message')+1],prompt=a[a.length-1],scenario=process.env.FAKE_SCENARIO||'success';
const label=prompt.includes('Integrate queued change')?'process-change':prompt.includes('Implement exactly')?'implement':prompt.includes('Independently review')?'review':prompt.includes('Repair only')?'repair':prompt.includes('READ-ONLY independent final audit')?'hardening-audit':prompt.includes('separate hardening implementer')?'hardening-fix':'other';appendFileSync('.pandacorp/run/fake-calls.log',label+'\\n');
if(prompt.includes('preserved RED baseline'))appendFileSync('.pandacorp/run/preserved-consumed','1\\n');
if(scenario==='hang-tree'&&prompt.includes('Implement exactly')){spawn('sh',['-c','sleep 2; echo late > late-write'],{stdio:'ignore'});await new Promise(()=>{})}
if(scenario==='uncertain'&&prompt.includes('Implement exactly')){writeFileSync('feature.txt','uncertain\\n');process.exit(7)}
let verdict='green',summary='mock';
if(prompt.includes('Integrate queued change')){if(scenario==='planner-writes')writeFileSync('illegal-planner-write.txt','forbidden\\n');const bug=prompt.includes('canonical bug contract'),blueprint=readFileSync('docs/frds/frd-01-a/blueprint.md','utf8'),wo1=readFileSync('docs/frds/frd-01-a/work-orders/wo-01.md','utf8');let mutations;if(bug){mutations=[{target:'docs/frds/frd-01-a/work-orders/wo-01.md',content:wo1+'\\n## Regression\\n- queued bug regression\\n'}]}else{const next=blueprint.includes('WO-02')?blueprint:blueprint.replace(/(\\| WO-01[^\\n]*\\n)/,'$1| WO-02 | WO-01 | change.txt | false | — |\\n');mutations=[{target:'docs/frds/frd-01-a/blueprint.md',content:next},{target:'docs/frds/frd-01-a/work-orders/wo-02.md',content:'---\\nid: WO-02\\nimplementation_status: PLANNED\\ndependsOn: [WO-01]\\n---\\n\\n## Summary\\nQueued feature\\n'}]}writeFileSync(o,JSON.stringify({done:true,verdict:'green',summary:'planned',findings:[],change_kind:bug?'bug':'feature',affected_frds:['frd-01-a'],mutations,reopen_work_orders:[]}));process.exit(0)}
if(prompt.includes('Implement exactly')){writeFileSync('feature.txt','ok\\n');if(scenario==='needs-owner'){verdict='needs-owner';summary='owner secret required'}}
if(prompt.includes('Independently review')&&scenario==='red-review'){mkdirSync('src/__tests__',{recursive:true});writeFileSync('src/__tests__/adversarial.test.js','// preserved red evidence\\n');verdict='red';summary='adversarial failure'}
if(prompt.includes('Repair only')&&scenario==='red-review'){verdict='red';summary='repair did not converge'}
if(prompt.includes('READ-ONLY independent final audit')&&scenario==='audit-writes')writeFileSync('audit-write.txt','forbidden\\n');
if(prompt.includes('separate hardening implementer')&&scenario!=='missing-hardening'){const d=new Date().toISOString().slice(0,10);mkdirSync('docs/reviews',{recursive:true});writeFileSync(join('docs/reviews','security-'+d+'.md'),'# Security\\n');appendFileSync('docs/analytics/events.md','\\n## Verification\\n- green\\n')}
if(prompt.includes('separate hardening implementer')&&scenario==='missing-hardening')writeFileSync('broken-hardening.txt','must rollback\\n');
writeFileSync(o,JSON.stringify({done:true,verdict,summary,findings:[]}));process.exit(0);
`); await chmod(fake, 0o755);
  await run("git", ["init", "-q"], project); await run("git", ["config", "user.email", "test@example.com"], project); await run("git", ["config", "user.name", "Test"], project); await run("git", ["add", "-A"], project); await run("git", ["commit", "-qm", "fixture"], project);
  return { project, fake };
}
const execute = ({ project, fake }, scenario = "success", extra = [], env = {}) => run("node", [executor, "--project", project, "--run-id", "mock-run", "--max-spend", "40", "--max-duration", "120", ...extra], project, { PANDACORP_CODEX_BIN: fake, PANDACORP_CODEX_EVENTS_FILE: path.join(project, ".pandacorp/run/test-events.ndjson"), FAKE_SCENARIO: scenario, ...env });
const checkpoint = (project) => read(path.join(project, ".pandacorp/run/codex-checkpoint.json")).then(JSON.parse);
const addChange=async(fx,slug,type="feature")=>{await mkdir(path.join(fx.project,".pandacorp/inbox/changes"),{recursive:true});await writeFile(path.join(fx.project,`.pandacorp/inbox/changes/${slug}.md`),`---\ntype: ${type}\nclass: standard\nstatus: ready\n---\n\nCambio ${slug}\n`);};

await test("success E2E uses precise staging, ignores runtime artifacts and reaches release", async () => {
  const fx = await fixture(); const result = await execute(fx); ok(result.code === 0, result.err); const status = await read(path.join(fx.project, ".pandacorp/status.yaml")); ok(/phase: ["']?release/.test(status) && /running: false/.test(status), status); const wo = await read(path.join(fx.project, "docs/frds/frd-01-a/work-orders/wo-01.md")); ok(/VERIFIED/.test(wo), wo); const cp = await checkpoint(fx.project); ok(cp.terminal_reason === "complete" && cp.implementation_commits["frd-01-a"].length === 1, JSON.stringify(cp)); const trackedRun = await run("git", ["ls-files", ".pandacorp/run"], fx.project); ok(!trackedRun.out.trim(), "runtime files were staged");
});

await test("Build Plan/frontmatter dependency drift fails before any Codex dispatch", async () => {
  const fx = await fixture({ planDeps: "WO-99", frontmatterDeps: "[]" }); const result = await execute(fx); ok(result.code === 2, `exit ${result.code}`); const cp = await checkpoint(fx.project); ok(cp.terminal_reason === "error" && /dependency drift/.test(cp.error), JSON.stringify(cp)); const calls = await read(path.join(fx.project, ".pandacorp/run/fake-calls.log")).catch(() => ""); ok(!calls, `unexpected dispatch: ${calls}`);
});

await test("cold restart with orphan IN_PROGRESS stops for owner before any replacement dispatch", async () => {
  const fx = await fixture();
  const wo = path.join(fx.project, "docs/frds/frd-01-a/work-orders/wo-01.md");
  await writeFile(wo, (await read(wo)).replace("implementation_status: PLANNED", "implementation_status: IN_PROGRESS"));
  await run("git", ["add", wo], fx.project);
  await run("git", ["commit", "-m", "test: seed orphan in-progress work order"], fx.project);
  const result = await execute(fx);
  ok(result.code === 20, `exit ${result.code}: ${result.err}`);
  const calls = await read(path.join(fx.project, ".pandacorp/run/fake-calls.log")).catch(() => "");
  ok(!calls.trim(), `replacement dispatch launched: ${calls}`);
  const decisions = await read(path.join(fx.project, ".pandacorp/inbox/decisions.md"));
  ok(/IN_PROGRESS without an inflight dispatch/.test(decisions), decisions);
});

await test("uncertain dispatch is never retried and persists an owner decision", async () => {
  const fx = await fixture(); const result = await execute(fx, "uncertain"); ok(result.code === 25, `exit ${result.code}`); const calls = await read(path.join(fx.project, ".pandacorp/run/fake-calls.log")); ok(calls.trim().split("\n").filter(Boolean).length === 1, calls); const cp = await checkpoint(fx.project); ok(cp.terminal_reason === "uncertain" && cp.uncertain.id.startsWith("implement-"), JSON.stringify(cp)); const decisions = await read(path.join(fx.project, ".pandacorp/inbox/decisions.md")); ok(/without a trustworthy terminal result/.test(decisions), decisions);
});

await test("needs-owner blocks the WO, persists the decision and quiesces before review", async () => {
  const fx = await fixture(); const result = await execute(fx, "needs-owner"); ok(result.code === 20, `exit ${result.code}`); const wo = await read(path.join(fx.project, "docs/frds/frd-01-a/work-orders/wo-01.md")); ok(/BLOCKED/.test(wo) && /needs-owner/.test(wo), wo); const calls = await read(path.join(fx.project, ".pandacorp/run/fake-calls.log")); ok(calls.trim() === "implement", calls); const decisions = await read(path.join(fx.project, ".pandacorp/inbox/decisions.md")); ok(/owner secret required/.test(decisions), decisions);
});

await test("red gates converge through bounded passes, preserve reviewer tests, then stop safely", async () => {
  const fx = await fixture(); const result = await execute(fx, "red-review", ["--max-retries", "1"]); ok(result.code === 20, `exit ${result.code}`); const preservedRoot = path.join(fx.project, ".pandacorp/run/preserved-tests/frd-01-a"); const attempts = await readdir(preservedRoot); ok(attempts.length >= 2, `preserved attempts ${attempts}`); const consumed = await read(path.join(fx.project, ".pandacorp/run/preserved-consumed")); ok(consumed.trim().split("\n").length >= 2, "preserved RED baseline was not injected into later pass"); const cp = await checkpoint(fx.project); ok(cp.attempts["frd-01-a"] === 2 && cp.terminal_reason === "needs-owner", JSON.stringify(cp));
});

await test("rethink safe point dispatches nothing and returns a distinct terminal reason", async () => {
  const fx = await fixture({ rethink: true }); const result = await execute(fx); ok(result.code === 22, `exit ${result.code}`); const cp = await checkpoint(fx.project); ok(cp.terminal_reason === "rethink", JSON.stringify(cp)); const calls = await read(path.join(fx.project, ".pandacorp/run/fake-calls.log")).catch(() => ""); ok(!calls, calls);
});

await test("durable spend brake stops before the over-cap dispatch", async () => {
  const fx = await fixture(); const result = await run("node", [executor, "--project", fx.project, "--run-id", "mock-run", "--max-spend", "1", "--max-duration", "120"], fx.project, { PANDACORP_CODEX_BIN: fx.fake, PANDACORP_CODEX_EVENTS_FILE: path.join(fx.project, ".pandacorp/run/test-events.ndjson"), FAKE_SCENARIO: "success" }); ok(result.code === 21, `exit ${result.code}`); const calls = await read(path.join(fx.project, ".pandacorp/run/fake-calls.log")); ok(calls.trim() === "implement", calls); ok((await checkpoint(fx.project)).terminal_reason === "budget", "budget terminal missing");
});

await test("controller refuses release when hardening evidence is absent despite model green", async () => {
  const fx = await fixture(); const result = await execute(fx, "missing-hardening"); ok(result.code === 20, `exit ${result.code}`); const status = await read(path.join(fx.project, ".pandacorp/status.yaml")); ok(/phase: implementation/.test(status), status); const decisions = await read(path.join(fx.project, ".pandacorp/inbox/decisions.md")); ok(/hardening/i.test(decisions), decisions); ok(!await read(path.join(fx.project, "broken-hardening.txt")).then(()=>true).catch(()=>false), "red hardening candidate survived rollback"); const dirty = await run("git", ["status", "--porcelain"], fx.project); ok(!dirty.out.split("\n").some((line)=>line && !line.includes(".pandacorp/inbox") && !line.includes(".pandacorp/comms")), dirty.out);
});

await test("read-only hardening auditor is independent; any write is rolled back before quiescence", async () => {
  const fx = await fixture(); const result = await execute(fx, "audit-writes"); ok(result.code === 20, `exit ${result.code}`); ok(!await read(path.join(fx.project, "audit-write.txt")).then(()=>true).catch(()=>false), "auditor write survived"); const calls = await read(path.join(fx.project, ".pandacorp/run/fake-calls.log")); ok(/hardening-audit/.test(calls) && !/hardening-fix/.test(calls), calls);
});

await test("signal quiesces the entire active Codex process group before releasing the lease", async () => {
  const fx = await fixture(); const child = spawn("node", [executor, "--project", fx.project, "--run-id", "signal-run", "--max-spend", "12", "--max-duration", "120"], { cwd: fx.project, env: { ...process.env, PANDACORP_CODEX_BIN: fx.fake, PANDACORP_CODEX_EVENTS_FILE: path.join(fx.project, ".pandacorp/run/test-events.ndjson"), FAKE_SCENARIO: "hang-tree" }, stdio: ["ignore", "pipe", "pipe"] });
  for (let i=0;i<100;i++){const calls=await read(path.join(fx.project,".pandacorp/run/fake-calls.log")).catch(()=>"");if(/implement/.test(calls))break;await new Promise(r=>setTimeout(r,20));}
  child.kill("SIGTERM"); const closed = await new Promise((resolve)=>child.on("close",(code)=>resolve(code))); ok(closed === 26, `signal exit ${closed}`); await new Promise(r=>setTimeout(r,2300)); const journal=await read(path.join(fx.project,".pandacorp/run/codex-executor.jsonl")).catch(()=>"");ok(!await read(path.join(fx.project,"late-write")).then(()=>true).catch(()=>false), `grandchild wrote after lease release\n${journal}`); const cp=await checkpoint(fx.project);ok(cp.terminal_reason==="stopped",JSON.stringify(cp));ok(!await read(path.join(fx.project,".pandacorp/run/build.lease/lease.json")).then(()=>true).catch(()=>false),"lease remained held");
});

await test("signal after dispatch_finished never races staging against terminal lease finalization", async () => {
  const fx=await fixture();const child=spawn("node",[executor,"--project",fx.project,"--run-id","signal-race","--max-spend","12","--max-duration","120"],{cwd:fx.project,env:{...process.env,PANDACORP_CODEX_BIN:fx.fake,PANDACORP_CODEX_EVENTS_FILE:path.join(fx.project,".pandacorp/run/test-events.ndjson"),FAKE_SCENARIO:"success",PANDACORP_TEST_AFTER_DISPATCH_BARRIER:"1"},stdio:["ignore","pipe","pipe"]});
  let reached=false;for(let i=0;i<250;i++){reached=await read(path.join(fx.project,".pandacorp/run/after-dispatch.barrier")).then(Boolean).catch(()=>false);if(reached){ok(child.kill("SIGTERM"),"signal delivery failed");break}await new Promise(r=>setTimeout(r,10));}ok(reached,"dispatch barrier was never reached");
  const closed=await new Promise(resolve=>child.on("close",code=>resolve(code)));ok(closed===26,`race exit ${closed}`);const cp=await checkpoint(fx.project);ok(cp.terminal_reason==="stopped",JSON.stringify(cp));const status=await read(path.join(fx.project,".pandacorp/status.yaml"));ok(/running: false/.test(status),status);ok(!await read(path.join(fx.project,".pandacorp/run/build.lease/lease.json")).then(()=>true).catch(()=>false),"lease remained held");const staged=await run("git",["diff","--cached","--name-only"],fx.project);ok(!staged.out.trim(),`staged residue: ${staged.out}`);
});

await test("bare run drains every ready feature/bug and archives only after VERIFIED",async()=>{const fx=await fixture();await addChange(fx,"feature-one","feature");await addChange(fx,"bug-two","bug");const result=await execute(fx);ok(result.code===0,result.err);const calls=await read(path.join(fx.project,".pandacorp/run/fake-calls.log"));ok(calls.split("\n").filter(x=>x==="process-change").length===2,calls);for(const slug of ["feature-one","bug-two"]){const done=await read(path.join(fx.project,`.pandacorp/inbox/changes/done/${slug}.md`));ok(/status: done/.test(done)&&/shipped_sha:/.test(done),done);} });

await test("targeted change drains only its exact card",async()=>{const fx=await fixture();await addChange(fx,"chosen");await addChange(fx,"other");const result=await execute(fx,"success",["--change","chosen"]);ok(result.code===0,result.err);ok(/status: done/.test(await read(path.join(fx.project,".pandacorp/inbox/changes/done/chosen.md"))),"chosen not done");ok(/status: ready/.test(await read(path.join(fx.project,".pandacorp/inbox/changes/other.md"))),"other was drained");});

await test("targeted FRD run drains no ready cards",async()=>{const fx=await fixture();await addChange(fx,"waiting");const result=await execute(fx,"success",["--frds","frd-01-a"]);ok(result.code===0,result.err);ok(/status: ready/.test(await read(path.join(fx.project,".pandacorp/inbox/changes/waiting.md"))),"targeted FRD drained queue");const calls=await read(path.join(fx.project,".pandacorp/run/fake-calls.log"));ok(!/process-change/.test(calls),calls);});

await test("blocked affected FRD resets building card to ready",async()=>{const fx=await fixture();await addChange(fx,"blocked");const result=await execute(fx,"red-review",["--change","blocked","--max-retries","0"]);ok(result.code===20,`exit ${result.code}`);const card=await read(path.join(fx.project,".pandacorp/inbox/changes/blocked.md"));ok(/status: ready/.test(card)&&/note:/.test(card),card);});

await test("controller crash after durable plan resumes without re-dispatching planner",async()=>{const fx=await fixture();await addChange(fx,"resume");const first=await execute(fx,"success",["--change","resume"],{PANDACORP_TEST_CRASH_BEFORE_CHANGE_APPLY:"1"});ok(first.code===2,`first ${first.code}`);const second=await execute(fx,"success",["--change","resume"]);ok(second.code===0,second.err);const calls=await read(path.join(fx.project,".pandacorp/run/fake-calls.log"));ok(calls.split("\n").filter(x=>x==="process-change").length===1,calls);ok(/status: done/.test(await read(path.join(fx.project,".pandacorp/inbox/changes/done/resume.md"))),"resume not archived");
});

await test("executor resumes every partial apply boundary and commits the canonical plan exactly once",async()=>{for(const boundary of ["prepared","mutation:0","mutation:1","card"]){const fx=await fixture();await addChange(fx,`resume-${boundary.replace(/[^a-z0-9]+/g,"-")}`);const slug=`resume-${boundary.replace(/[^a-z0-9]+/g,"-")}`;const first=await execute(fx,"success",["--change",slug],{PANDACORP_TEST_CHANGE_FAULT_AFTER:boundary});ok(first.code===2,`${boundary} first ${first.code}`);const second=await execute(fx,"success",["--change",slug]);ok(second.code===0,`${boundary}: ${second.err}`);const calls=await read(path.join(fx.project,".pandacorp/run/fake-calls.log"));ok(calls.split("\n").filter(x=>x==="process-change").length===1,`${boundary}: ${calls}`);ok(/status: done/.test(await read(path.join(fx.project,`.pandacorp/inbox/changes/done/${slug}.md`))),`${boundary} not archived`);const log=await run("git",["log","--format=%s"],fx.project);ok(log.out.split("\n").filter(x=>x===`docs(change): integrate ${slug}`).length===1,`${boundary}: integration commit count\n${log.out}`);}});

await test("change planner is proposal-only and any direct write fails ownership",async()=>{const fx=await fixture();await addChange(fx,"planner");const result=await execute(fx,"planner-writes",["--change","planner"]);ok(result.code===2,`exit ${result.code}`);const cp=await checkpoint(fx.project);ok(cp.terminal_reason==="error"&&/planner wrote files directly/.test(cp.error),JSON.stringify(cp));ok(/status: ready/.test(await read(path.join(fx.project,".pandacorp/inbox/changes/planner.md"))),"planner claimed card");});

await test("executor rejects symlink change card and changes root before dispatch",async()=>{
  {const fx=await fixture();await addChange(fx,"linked");const card=path.join(fx.project,".pandacorp/inbox/changes/linked.md"),outside=path.join(fx.project,"outside-card.md");await writeFile(outside,"---\nstatus: ready\n---\n");await rm(card);await symlink(outside,card);const result=await execute(fx,"success",["--change","linked"]);ok(result.code===2,`card exit ${result.code}`);ok(!await read(path.join(fx.project,".pandacorp/run/fake-calls.log")).then(Boolean).catch(()=>false),"card escape dispatched");ok(!/building/.test(await read(outside)),"outside card mutated");}
  {const fx=await fixture();await addChange(fx,"rooted");const root=path.join(fx.project,".pandacorp/inbox/changes"),outside=path.join(fx.project,"outside-changes");await rename(root,outside);await symlink(outside,root);const result=await execute(fx);ok(result.code===2,`root exit ${result.code}`);ok(!await read(path.join(fx.project,".pandacorp/run/fake-calls.log")).then(Boolean).catch(()=>false),"root escape dispatched");}
});

await test("executor rejects symlink FRD and work-orders parents before dispatch",async()=>{
  for(const which of ["frd","work-orders"]){const fx=await fixture();const target=which==="frd"?path.join(fx.project,"docs/frds/frd-01-a"):path.join(fx.project,"docs/frds/frd-01-a/work-orders"),outside=path.join(fx.project,`outside-${which}`);await rename(target,outside);await symlink(outside,target);const result=await execute(fx);ok(result.code===2,`${which} exit ${result.code}`);ok(!await read(path.join(fx.project,".pandacorp/run/fake-calls.log")).then(Boolean).catch(()=>false),`${which} escape dispatched`);}
});

await test("executor never overwrites an existing done-card target",async()=>{const fx=await fixture();await addChange(fx,"collision");const done=path.join(fx.project,".pandacorp/inbox/changes/done");await mkdir(done);await writeFile(path.join(done,"collision.md"),"foreign owner data\n");const result=await execute(fx,"success",["--change","collision"]);ok(result.code===2,`exit ${result.code}`);ok((await read(path.join(done,"collision.md")))==="foreign owner data\n","existing done card overwritten");});

await test("supervisor trusts durable terminal reason and does not restart needs-owner", async () => {
  const fx = await fixture(); const stub = path.join(fx.project, "stub-executor.mjs"); await writeFile(stub, `import{writeFileSync,appendFileSync}from'node:fs';const a=process.argv,project=a[a.indexOf('--project')+1],run=a[a.indexOf('--run-id')+1];writeFileSync(project+'/.pandacorp/run/codex-checkpoint.json',JSON.stringify({run_id:run,terminal_reason:'needs-owner'}));appendFileSync(project+'/.pandacorp/run/stub-count','1\\n');process.exit(20);`); const result = await run("node", [supervisor, "--project", fx.project, "--run-id", "supervised", "--max-spend", "1", "--max-duration", "30", "--max-retries", "0", "--max-blocks", "1"], fx.project, { PANDACORP_EXECUTOR_PATH: stub, PANDACORP_SUPERVISOR_RESTART_WAIT_MS: "1" }); ok(result.code === 0, result.err); const count = await read(path.join(fx.project, ".pandacorp/run/stub-count")); ok(count.trim() === "1", count); const journal = await read(path.join(fx.project, ".pandacorp/run/codex-supervisor.jsonl")); ok(/"terminal_reason":"needs-owner"/.test(journal) && /supervisor_terminal/.test(journal), journal);
});

console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
