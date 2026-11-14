#!/usr/bin/env node
// Independent-review regressions: real fences/worktrees and fake providers only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createFixture } from './fixtures/build-v2/make-fixture.mjs';
import * as bs from '../runtime/build-state.mjs';
import * as stateApi from '../runtime/build/state.mjs';
import * as admission from '../runtime/build/admission.mjs';
import * as routing from '../runtime/build/routing.mjs';
import { buildPaths } from '../runtime/build/paths.mjs';
import { appendEvent } from '../runtime/build/journal.mjs';
import { harvest } from '../runtime/build/next/harvest.mjs';
import { buildCandidates } from '../runtime/build/next/candidates.mjs';
import { dispatchRound } from '../runtime/build/next/dispatch.mjs';
import { applyTerminal } from '../runtime/build/next/terminal.mjs';
import { next } from '../runtime/build/next.mjs';
import { normalizeClaudeUsage, normalizeCodexRateLimits } from '../runtime/capacity.mjs';
import { wakeCapacity } from '../runtime/capacity/scheduler.mjs';
const NOW = '2026-11-14T12:00:00.000Z', T = Date.parse(NOW), at = seconds => new Date(T + seconds*1000).toISOString();
let passed=0, failed=0;
async function test(name, fn) { try { await fn(); passed++; console.log(`PASS ${name}`); } catch(e) { failed++; console.error(`FAIL ${name}: ${e.stack}`); } }
function readings(now=NOW, codex=20, claude=20, reset=at(3600)) {
 return { claude: normalizeClaudeUsage({status:'ok',observedAt:now,plan:{windows:[{label:'5-hour limit',percentUsed:claude,resetsAt:reset},{label:'Weekly · all models',percentUsed:claude,resetsAt:reset}]}},now),
 codex: normalizeCodexRateLimits({timestamp:now,type:'event_msg',payload:{type:'token_count',rate_limits:{primary:{used_percent:codex,window_minutes:10080,resets_at:Date.parse(reset)/1000},secondary:null}}},now) };
}
async function withRun(fn) {
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'capacity-resume-'));
 const saved={...process.env};
 try {
 const fx=await createFixture('basic',{dir:tmp}); const env=fx.env({PANDACORP_NOW:NOW}); Object.assign(process.env,env);
 const p=buildPaths(fx.root,{env}); await fs.mkdir(p.build,{recursive:true});
 const got=await bs.acquire(fx.root,{runtime:'codex',runId:'capacity-test',coordinator:'session',projectStatus:false});
 await fs.writeFile(p.tokenFile,JSON.stringify(got));
 const wt=path.join(tmp,'unit-tree');fx.git('worktree','add','-b','unit-test',wt);
 await fs.writeFile(path.join(wt,'saved.txt'),'dirty checkpoint\n');
 const worker={runtime:'codex',model:'sol',effort:'low',via:'cli',pid:null,worker_id:'worker-1',session_id:'thread-1'};
 const token=admission.issueToken('u-one','B',{file:p.admissionFile});
 const unit=stateApi.newUnit({id:'u-one',kind:'build',state:'running',worker,token_hash:token.token_hash,worktree:wt,branch:'unit-test'});
 const job={id:'worker-1',kind:'worker',unit:unit.id,frd:null,pid:null,cwd:wt,h_slot:false,started_at:NOW,state:'running',exit:null,worker_id:'worker-1'};
 const state=stateApi.newState({run_id:'capacity-test',epoch:got.epoch,coordinator:'codex-session',label:'codex',size:'touch',scope:{card:null,frds:[],wos:[],out_of_scope:[]},integration:{worktree:fx.root,branch:'main',base_sha:fx.sha},units:[unit],jobs:[job]});
 await stateApi.writeState(fx.root,state,{env});
 await appendEvent(p.journalFile,{run_id:state.run_id,epoch:got.epoch,actor:'cli',type:'run_started',data:{state}}, {env});
 const d={env,buildState:bs,admission,routing,monotonic:()=>0,log:()=>{},isAlive:()=>false,overrides:{},sleep:async()=>{}};
 const run={ref:{project:fx.root,epoch:got.epoch,deps:d},d,paths:p,overrides:{sessionModel:null,k:null}};
 await fn({fx,env,p,got,state,unit,job,run,d,tmp,token});
 } finally { for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];Object.assign(process.env,saved);await fs.rm(tmp,{recursive:true,force:true}); }
}
import { policy } from '../runtime/build/quota.mjs';
import { writeCapacitySnapshot } from '../runtime/capacity.mjs';
import { advance } from '../runtime/build/doubts/advance.mjs';
import { readDoubt, writeDoubt } from '../runtime/build/doubts/records.mjs';
import { checkTriggers } from '../runtime/build/drive/triggers.mjs';
import { takeOver } from '../runtime/build/drive/takeover.mjs';
import { launchWorker, pollWorker } from '../runtime/build/workers.mjs';
async function saveReadings(c, r) { for(const tool of ['claude','codex']) writeCapacitySnapshot(tool,r[tool],{env:c.env}); }
function modelWindow(r) { r.claude.windows.push({id:'weekly',scope:'model:sonnet',applicability:'required',percentUsed:100,resetsAt:at(3600)}); return r; }
await test('H1: next dispatches design when only Opus fits, even if implementation does not',()=>withRun(async c=>{
 const r=modelWindow(readings(NOW,100,0));await saveReadings(c,r);
 const s={...c.state,units:[stateApi.newUnit({id:'u-doc',kind:'docs'})],jobs:[]};await stateApi.writeState(c.fx.root,s,c.d);
 c.d.bootstrap=false;c.d.admission={...admission,readSignals:async()=>null,readDiskFreeGib:()=>100,countHostSlots:()=>({held:0}),decide:()=>({grant:'B'}),recordDiskWait:()=>false};
 c.d.planner={readPlanWorkOrders:async()=>({wos:[],frds:[],frd_acs:{},errors:[]}),plan:async()=>({ready:['u-doc'],round:['u-doc'],units:[],deadlock:null})};
 c.d.units={prepareUnitWorktree:async()=>({worktree:c.tmp,branch:'docs'}),writeUnitBrief:async()=>({brief_path:path.join(c.tmp,'brief.md')})};
 c.d.workers={launchWorker:async()=>({ok:true,workerId:'docs-worker',pid:1,job:{...c.job,id:'docs-worker',unit:'u-doc'}})};
 const out=await next({project:c.fx.root,epoch:c.got.epoch},c.d);
 assert.equal(out.action,'dispatch');assert.equal(out.units[0].model,'opus');assert.ok(await bs.currentLease(c.fx.root));
}));
await test('H1: explicit takeover never waits on a fictitious implementation task',()=>withRun(async c=>{
 await saveReadings(c,modelWindow(readings(NOW,100,0)));const s={...c.state,units:[stateApi.newUnit({id:'u-doc',kind:'docs'})],jobs:[]};await stateApi.writeState(c.fx.root,s,c.d);
 await takeOver({project:c.fx.root,runId:s.run_id,trigger:'a'},c.d);assert.equal((await stateApi.readState(c.fx.root,c.d)).status,'active');
}));
await test('H1 phase3: wake evaluates actual design demand rather than implementation',()=>withRun(async c=>{
 const s={...c.state,units:[stateApi.newUnit({id:'u-doc',kind:'docs'})],jobs:[]};await stateApi.writeState(c.fx.root,s,c.d);
 await applyTerminal(c.run.ref,{action:'waiting',resumeAt:at(300)},c.d);
 c.env.PANDACORP_NOW=at(361);c.d.readCapacity=()=>modelWindow(readings(at(361),100,0,at(9000)));
 const woke=await wakeCapacity({project:c.fx.root,epoch:c.got.epoch,owner:'lead'},c.d);assert.equal(woke.claimed,true);
}));
await test('H2: capacity wait retains pending consult, no budget, no owner or assumption, retries through scheduler',()=>withRun(async c=>{
 await saveReadings(c,readings(NOW,100,100));const s={...c.state,units:[{...c.unit,state:'reported',doubt_id:'d-0001'}],jobs:[]};
 const record={schema:1,id:'d-0001',unit:c.unit.id,opened_at:NOW,question:'Use stable sorting?',options:[{id:'yes',text:'stable sort'},{id:'no',text:'existing sort'}],preferred:'yes',why:'deterministic ties',step:'sources',consults:[],decision:null,assumption:null};
 const events=[];const ctx={project:c.fx.root,runId:s.run_id,paths:c.p,appendEvent:async e=>events.push(e)};
 const out=await advance(ctx,s,record,c.d);assert.equal(out.out.wait.reason,'capacity');assert.equal(out.record.consults.length,0);assert.equal(out.state.doubts_consulted,0);assert.equal(out.record.decision,null);assert.equal(out.record.assumption,null);assert.equal(out.record.capacity_wait.resumeAt,at(3600));
 assert.equal(out.state.units[0].parked,null);assert.ok(!events.some(e=>['autonomous_decision','parked'].includes(e.type)));assert.equal(await fs.stat(path.join(c.fx.root,'.pandacorp/inbox/decisions.md')).catch(()=>null),null);
 await writeDoubt(c.fx.root,out.record,c.d);await stateApi.writeState(c.fx.root,out.state,c.d);
 const blocked=await buildCandidates(c.run,out.state,policy({readings:readings(NOW,100,100),now:T}),{ready:[]},{},[]);assert.deepEqual(blocked.capacityWaits,[at(3600)]);
 await saveReadings(c,readings(NOW,0,0));const ready=await buildCandidates(c.run,blocked.state,policy({readings:readings(NOW,0,0),now:T}),{ready:[]},{},[]);
 assert.equal(ready.list.length,1);assert.equal(ready.list[0].unit.kind,'doubt-consult');assert.equal(ready.state.doubts_consulted,1);assert.equal((await readDoubt(c.fx.root,record.id,c.d)).consults.length,1);
}));
await test('H3: real launch/poll admission wait remains wait without fake usage-limit observation',()=>withRun(async c=>{
 await saveReadings(c,readings(NOW,100,0));await fs.mkdir(c.p.unitDir(c.unit.id),{recursive:true});await fs.writeFile(c.p.briefFile(c.unit.id),'brief');
 delete c.env.PANDACORP_FAKE_WORKER;
 const launched=await launchWorker({project:c.fx.root,runId:c.state.run_id,unit:c.unit.id,cell:c.unit.worker,dir:c.unit.worktree},c.d);
 assert.equal(launched.ok,true);assert.equal(launched.settled.kind,'capacity_wait');
 const result=await pollWorker({project:c.fx.root,workerId:launched.workerId},c.d);assert.equal(result.outcome,'capacity_wait');assert.equal(result.resumeAt,at(3600));assert.equal(result.recorded,undefined);
 assert.equal(await fs.stat(path.join(c.env.PANDACORP_CAPACITY_DIR,'codex-limit.json')).catch(()=>null),null);
 // A coordinator that only sees the persisted receipt during harvest still never fails the unit.
 c.d.workers={pollWorker:async()=>result};c.d.failure={failUnit:async()=>assert.fail('admission wait consumed an execution attempt')};
 await harvest(c.run,c.state,[]);const queued=(await stateApi.readState(c.fx.root,c.d)).units[0];
 assert.equal(queued.state,'queued');assert.equal(queued.attempt,1);assert.equal(queued.token_hash,null);

}));
await test('H3: dispatch requeues prelaunch wait without a job, attempt or quota charge',()=>withRun(async c=>{
 const s={...c.state,units:[stateApi.newUnit({id:'u-review',kind:'audit',zone:'r1'})],jobs:[]};await stateApi.writeState(c.fx.root,s,c.d);
 c.d.admission={...admission,readDiskFreeGib:()=>100,countHostSlots:()=>({held:0}),decide:()=>({grant:'B'}),recordDiskWait:()=>false};
 c.d.units={prepareUnitWorktree:async()=>({worktree:c.tmp,branch:'audit'}),writeUnitBrief:async()=>({brief_path:path.join(c.tmp,'brief.md')})};
 c.d.workers={launchWorker:async()=>({ok:true,workerId:'not-started',pid:null,settled:{kind:'capacity_wait',resumeAt:at(3600)},job:{...c.job,id:'not-started',unit:'u-review'}})};
 const out=await dispatchRound(c.run,s,{list:[{unit:s.units[0],cell:{runtime:'codex',model:'astra',effort:'high'},via:'cli'}]},{k:1},{value:null},{policy:{},out:{claude:{pct:100},codex:{pct:100}}});
 assert.equal(out.units.length,0);assert.equal(out.state.units[0].state,'queued');assert.equal(out.state.units[0].attempt,1);assert.equal(out.state.units[0].token_hash,null);assert.equal(out.state.jobs.length,0);assert.deepEqual(out.capacityWaits,[at(3600)]);
}));
await test('H4: Claude stdout progress and deferred final output survive stream watchdog thresholds',()=>withRun(async c=>{
 const fake=path.join(c.tmp,'fake-provider.mjs');await fs.writeFile(fake,`#!/usr/bin/env node\nimport fs from 'node:fs';fs.readFileSync(0,'utf8');for(let i=0;i<30;i++){console.log('progress');await new Promise(r=>setTimeout(r,100));}console.log(JSON.stringify({result:'done'}));\n`,{mode:0o755});
 const pf=path.join(c.tmp,'prompt.md');await fs.writeFile(pf,'do work');
 const r=spawnSync(process.execPath,[path.resolve('plugin/scripts/codex-worker.mjs'),'run','--direct','--project',c.fx.root,'--dir',c.tmp,'--id','claude-progress','--prompt-file',pf,'--codex-model','sonnet','--capacity-task',JSON.stringify({id:'progress',type:'implement',risk:'normal',pin:{tool:'claude',model:'sonnet',effort:'medium'}}),'--start-hang-s','0.7','--stall-s','0.7','--cap-s','8','--max','8'],{env:{...c.env,PANDACORP_CLAUDE_BIN:fake},encoding:'utf8',timeout:10000});
 const payload=JSON.parse(JSON.parse(r.stdout.trim().split('\n').at(-1)).r);assert.equal(payload.ok,true,JSON.stringify(payload));assert.equal(payload.text,'done');
}));
await test('H5: Claude quota never hands off a live lead; explicit recovery preserves both live executions',()=>withRun(async c=>{
 const worker={runtime:'claude',model:'sonnet',effort:'medium',via:'agent',pid:process.pid,worker_id:null};
 const s={...c.state,units:[{...c.unit,worker},stateApi.newUnit({id:'u-healthy',kind:'build',state:'running',worker,token_hash:'a'.repeat(64),worktree:c.unit.worktree,branch:c.unit.branch})],jobs:[]};await stateApi.writeState(c.fx.root,s,c.d);
 await fs.mkdir(c.p.unitDir(c.unit.id),{recursive:true});await fs.writeFile(c.p.reportFile(c.unit.id),'Claude usage limit reached|1794747600');
 const trigger=await checkTriggers({project:c.fx.root,runId:s.run_id},c.d);assert.equal(trigger.trigger,null);
 const refused=await takeOver({project:c.fx.root,runId:s.run_id,trigger:'b'},c.d);assert.equal(refused.outcome,'retry');assert.equal((await bs.currentLease(c.fx.root)).epoch,c.got.epoch);
 const out=await takeOver({project:c.fx.root,runId:s.run_id,trigger:'a'},c.d);assert.deepEqual(out.requeued,[]);
 const after=await stateApi.readState(c.fx.root,c.d);for(const u of after.units){assert.equal(u.state,'running');assert.deepEqual(u.worker,worker);assert.ok(u.token_hash);}assert.equal(await fs.readFile(path.join(c.unit.worktree,'saved.txt'),'utf8'),'dirty checkpoint\n');
}));
await test('H6: standalone security audit and unknown risk retain critical floor',()=>withRun(async c=>{
 const fake=path.join(c.tmp,'fake-security.mjs');await fs.writeFile(fake,`#!/usr/bin/env node\nimport fs from 'node:fs';const a=process.argv.slice(2);fs.readFileSync(0,'utf8');fs.writeFileSync(a[a.indexOf('-o')+1],'done');\n`,{mode:0o755});
 const pf=path.join(c.tmp,'prompt.md');await fs.writeFile(pf,'audit');
 for(const role of ['pandacorp:security-auditor','']){
 const id=role?'security':'unknown';const args=[path.resolve('plugin/scripts/codex-worker.mjs'),'run','--direct','--project',c.fx.root,'--dir',c.tmp,'--id',id,'--prompt-file',pf,'--codex-model','gpt-6-astra','--effort','high','--max','5',...(role?['--role',role,'--risk','normal']:[])];
 const r=spawnSync(process.execPath,args,{env:{...c.env,PANDACORP_CODEX_BIN:fake},encoding:'utf8',timeout:10000});assert.equal(JSON.parse(JSON.parse(r.stdout.trim()).r).ok,true,r.stdout);
 const state=JSON.parse(await fs.readFile(path.join(c.p.codexWorkerDir(id),'state.json'),'utf8'));assert.deepEqual(state.capacity.pin,{tool:'codex',model:'astra',effort:'high'});
 }
 const bad=spawnSync(process.execPath,[path.resolve('plugin/scripts/codex-worker.mjs'),'run','--direct','--project',c.fx.root,'--dir',c.tmp,'--id','security-low','--prompt-file',pf,'--role','pandacorp:security-auditor','--risk','normal','--codex-model','gpt-6.1-sol','--effort','low'],{env:{...c.env,PANDACORP_CODEX_BIN:fake},encoding:'utf8',timeout:10000});
 assert.equal(JSON.parse(JSON.parse(bad.stdout.trim()).r).kind,'incompatible-cell');
 assert.equal(await fs.stat(path.join(c.p.codexWorkerDir('security-low'),'state.json')).catch(()=>null),null);
}));
await test('H7: canonical non-routing safeguards survive and retired quota mandates are absent',async()=>{
 const doc=(await fs.readFile('factory/standards/build-engine.md','utf8')).replace(/\s+/g,' ');
 for(const text of ['One probe per finding','3 more per FRD','probe_hashes','RED on the new test files by assertion','never `git commit`/`push`/`reset`','floor mutation at G4','hashes those files'])assert.ok(doc.includes(text),`missing ${text}`);
 for(const text of ['≥90 %: `transfer`','Security audit: not run','strongest model not yet consulted'])assert.ok(!doc.includes(text),`retired ${text}`);
});
console.log(`RESULT ${passed} passed, ${failed} failed`);process.exitCode=failed?1:0;
