#!/usr/bin/env node
// Phase 3 acceptance: fake workers, real worktrees/fences/journal, no provider/model calls.
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
import { appendEvent, readJournal } from '../runtime/build/journal.mjs';
import { harvest } from '../runtime/build/next/harvest.mjs';
import { buildCandidates } from '../runtime/build/next/candidates.mjs';
import { dispatchRound } from '../runtime/build/next/dispatch.mjs';
import { applyTerminal, chooseTerminal } from '../runtime/build/next/terminal.mjs';
import { next } from '../runtime/build/next.mjs';
import { startResume } from '../runtime/build/lifecycle/resume.mjs';
import { finishRun } from '../runtime/build/lifecycle/terminate.mjs';
import { classifyLimitText } from '../runtime/build/quota.mjs';
import { classifyWorkerPayload, resumeWorker } from '../runtime/build/workers.mjs';
import { park } from '../runtime/build/doubts/effects.mjs';
import { parkOrAssume } from '../runtime/build/park.mjs';
import { assumptionBranches } from '../runtime/build/integrate/assumptions.mjs';
import { mergeAcceptedAssumptions } from '../runtime/build/integrate/assumptions.mjs';
import { git } from './fixtures/build-v2/make-fixture.mjs';
import { suspendExecution } from '../runtime/build/capacity.mjs';
import { normalizeClaudeUsage, normalizeCodexRateLimits } from '../runtime/capacity.mjs';
import { backoffSeconds, continuationDecision, enterCapacityWaiting, wakeCapacity } from '../runtime/capacity/scheduler.mjs';
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
async function limit(c,kind='usage_limit',extra={}) {
 c.d.workers={pollWorker:async()=>({state:'done',outcome:'limit',limit:kind,resetsAt:at(3600),sessionId:'thread-1',...extra})};
 await harvest(c.run,await stateApi.readState(c.fx.root,c.d),[]);
 return (await stateApi.readState(c.fx.root,c.d)).units[0];
}
await test('subscription after editing preserves files, branch, pin, attempt, token and thread through dispatch',()=>withRun(async c=>{
 const u=await limit(c);assert.equal(u.state,'suspended');assert.equal(u.attempt,1);assert.equal(u.branch,c.unit.branch);assert.equal(u.worktree,c.unit.worktree);assert.deepEqual(u.worker,c.unit.worker);assert.equal(u.token_hash,c.unit.token_hash);
 assert.deepEqual(u.pin,{tool:'codex',model:'sol',effort:'low'});
 c.env.PANDACORP_NOW=process.env.PANDACORP_NOW=at(3661);const r=readings(at(3661),5,5,at(9000));
 const pol={readings:r,now:T+3661000,claude_new_units:true,codex_new_units:true};
 let calls=0;c.d.workers.resumeWorker=async input=>{calls++;assert.equal(input.workerId,'worker-1');assert.equal(input.dir,u.worktree);assert.equal(input.sequence,1);return {ok:true,workerId:'worker-1',pid:123,job:{...c.job,pid:123}};};
 const s=await stateApi.readState(c.fx.root,c.d);
 const candidates=await buildCandidates(c.run,s,pol,{ready:[]},{sessionModel:null,k:1},[]);
 assert.equal(candidates.list.length,1);assert.equal(candidates.list[0].resume,true);
 const ad={...admission,readDiskFreeGib:()=>100,countHostSlots:()=>({held:0}),decide:()=>({grant:'B'}),recordDiskWait:()=>false};c.d.admission=ad;
 const out=await dispatchRound(c.run,s,candidates,{k:1},{value:null},{policy:pol,out:{claude:{pct:5},codex:{pct:5}}});
 assert.equal(calls,1);const resumed=out.state.units[0];assert.equal(resumed.state,'running');assert.equal(resumed.attempt,u.attempt);assert.equal(resumed.worktree,u.worktree);assert.equal(resumed.worker.session_id,'thread-1');assert.equal(resumed.worker.worker_id,'worker-1');
 assert.equal(await fs.readFile(path.join(u.worktree,'saved.txt'),'utf8'),'dirty checkpoint\n');
 const replay=stateApi.foldJournal((await readJournal(c.p.journalFile)).events);assert.equal(replay.units[0].worktree,u.worktree);
}));
await test('new independent unit routes to other tool while first is suspended',()=>withRun(async c=>{
 const u=await limit(c);const s=await stateApi.readState(c.fx.root,c.d);s.units.push(stateApi.newUnit({id:'u-two',kind:'build'}));await stateApi.writeState(c.fx.root,s,c.d);
 const r=readings(NOW,100,20);const pol={readings:r,now:T,claude_new_units:true,codex_new_units:false};
 const candidates=await buildCandidates(c.run,s,pol,{ready:['u-two']},{sessionModel:null,k:2},[]);
 assert.equal(candidates.list.length,1);assert.equal(candidates.list[0].unit.id,'u-two');assert.equal(candidates.list[0].cell.runtime,'claude');assert.equal(candidates.state.units[0].worktree,u.worktree);
 c.d.admission={...admission,readDiskFreeGib:()=>100,countHostSlots:()=>({held:0}),decide:()=>({grant:'B'}),recordDiskWait:()=>false};
 c.d.units={prepareUnitWorktree:async()=>({worktree:c.tmp,branch:'unit-two'}),writeUnitBrief:async()=>({brief_path:path.join(c.tmp,'brief.md')})};
 c.d.workers.launchWorker=async()=>({ok:true,workerId:'worker-2',pid:22,job:{...c.job,id:'worker-2',unit:'u-two',worker_id:'worker-2'}});
 const dispatched=await dispatchRound(c.run,s,candidates,{k:2},{value:null},{policy:pol,out:{claude:{pct:20},codex:{pct:100}}});
 assert.equal(dispatched.units[0].runtime,'claude');assert.equal(dispatched.state.units[0].state,'suspended');assert.equal(await fs.readFile(path.join(u.worktree,'saved.txt'),'utf8'),'dirty checkpoint\n');
}));
await test('both exhausted waits at minimum resumeAt without releasing lease',()=>withRun(async c=>{
 await limit(c);const s=await stateApi.readState(c.fx.root,c.d);s.units.push({...s.units[0],id:'u-two',suspension:{...s.units[0].suspension,resumeAt:at(600)}});await stateApi.writeState(c.fx.root,s,c.d);
 c.d.bootstrap=false;c.d.admission={...admission,readSignals:async()=>null,readDiskFreeGib:()=>100};
 c.d.quota={readQuota:async()=>({effective:{claude:{},codex:{}},readings:readings(NOW,100,100)}),policy:()=>({paused:true,claude_new_units:false,codex_new_units:false,resumeAt:at(1200)})};
 const result=await next({project:c.fx.root,epoch:c.got.epoch},c.d);assert.equal(result.action,'waiting');const after=await stateApi.readState(c.fx.root,c.d);
 assert.equal(after.status,'waiting');assert.equal(after.resumeAt,at(600));assert.equal((await bs.currentLease(c.fx.root)).epoch,c.got.epoch);
 await assert.rejects(()=>finishRun({project:c.fx.root,epoch:c.got.epoch},c.d),e=>e.code==='INVALID_STATE');
 assert.equal(chooseTerminal({...after,units:after.units.map(u=>({...u,state:'landed'}))},{pol:{paused:true}}).action,'done','completed work does not wait for another reset');
 const rows=(await fs.readFile(c.p.capacityDecisionsFile,'utf8')).trim().split('\n').map(JSON.parse);assert.ok(rows.some(r=>r.decision.action==='suspended'));assert.ok(rows.some(r=>r.decision.action==='waiting'));
}));
await test('elapsed reset without renewed reading stays waiting, retries 60/120/240/480/900',()=>withRun(async c=>{
 await limit(c);await applyTerminal(c.run.ref,{action:'waiting',resumeAt:at(3600)},c.d);c.d.readCapacity=()=>readings(NOW,100,100);
 let now=3661;
 for (const delay of [60,120,240,480,900,900]) {
 c.env.PANDACORP_NOW=process.env.PANDACORP_NOW=at(now);const out=await wakeCapacity({project:c.fx.root,epoch:c.got.epoch,owner:'drive'},c.d);assert.equal(out.claimed,false);
 assert.equal(Date.parse(out.resumeAt)+60000-(T+now*1000),delay*1000);now+=delay;
 }
 assert.equal((await stateApi.readState(c.fx.root,c.d)).status,'waiting');
}));
await test('drive/lead/manual wake race has exactly one conditional resume, stale generation cannot steal',()=>withRun(async c=>{
 await limit(c);await applyTerminal(c.run.ref,{action:'waiting',resumeAt:at(3600)},c.d);c.env.PANDACORP_NOW=process.env.PANDACORP_NOW=at(3661);c.d.readCapacity=()=>readings(at(3661),5,5,at(9000));
 const results=await Promise.all(['drive','lead','manual'].map(owner=>wakeCapacity({project:c.fx.root,epoch:c.got.epoch,owner,generation:1},c.d)));
 assert.equal(results.filter(x=>x.claimed).length,1);assert.equal((await stateApi.readState(c.fx.root,c.d)).status,'active');
 const late=await startResume({project:c.fx.root,coordinator:'codex',wakeGeneration:0},c.d);assert.equal(late.claimed,false);
 const rows=(await fs.readFile(c.p.capacityDecisionsFile,'utf8')).trim().split('\n').map(JSON.parse);assert.equal(rows.filter(r=>r.decision.action==='resumed').length,1);
}));
await test('429/529 are transient, quota citation is not exhaustion, backoff retains same cell',()=>withRun(async c=>{
 assert.equal(classifyLimitText('The test documents quota behavior'),null);assert.equal(classifyLimitText('HTTP 529 overloaded'),'rate_limit');assert.equal(classifyLimitText('429 too many requests'),'rate_limit');
 assert.equal(classifyWorkerPayload({ok:false,kind:'error',detail:'discuss quota'}).outcome,'failed');
 assert.deepEqual([0,1,2,3,4,5].map(n=>backoffSeconds(n)),[60,120,240,480,900,900]);assert.equal(backoffSeconds(4,12),12);assert.equal(backoffSeconds(0,1200),900);
 assert.equal(classifyWorkerPayload({ok:false,limit:'rate_limit',retryAfter:new Date(T+120000).toUTCString()},{now:T}).retryAfterS,120);
 const u=await limit(c,'rate_limit',{resetsAt:null});assert.equal(u.suspension.resumeAt,at(60));assert.equal(continuationDecision(u,{},T+59000).ready,false);assert.equal(continuationDecision(u,{},T+60000).ready,true);assert.deepEqual(u.worker,c.unit.worker);
 let elapsed=60;
 for (const delay of [120,240,480,900,900]) {
   c.env.PANDACORP_NOW=process.env.PANDACORP_NOW=at(elapsed);
   const state=await stateApi.readState(c.fx.root,c.d);state.units[0].state='running';state.jobs[0].state='running';await stateApi.writeState(c.fx.root,state,c.d);
   const suspended=await limit(c,'rate_limit',{resetsAt:null,retryAfterS:60,retryAfterExplicit:false});
   assert.equal(suspended.suspension.resumeAt,at(elapsed+delay));assert.deepEqual(suspended.worker,c.unit.worker);assert.equal(suspended.attempt,1);elapsed+=delay;
 }
}));
await test('reversible doubt integrates as a registered engine assumption; production remains parked',()=>withRun(async c=>{
 const state={...c.state,units:[{...c.unit,state:'reported'}]};
 const record={schema:1,id:'d-0001',unit:c.unit.id,opened_at:NOW,question:'Use stable sorting?',options:[{id:'yes',text:'Use stable sort'},{id:'no',text:'Use existing sort'}],preferred:'yes',why:'Keeps equal rows deterministic',step:'consult2',consults:[],decision:null,assumption:null};
 const events=[];const ctx={project:c.fx.root,runId:state.run_id,paths:c.p,appendEvent:async e=>events.push(e)};
 assert.equal(parkOrAssume(state,c.unit.id,{reversible:true}).mode,'assume');
 const result=await park(ctx,state,record,{reasons:['no_consensus'],reversible:true},{...c.d,emit:async()=>({ok:true}),notify:async()=>{}});
 assert.equal(result.record.step,'decided');assert.equal(result.state.units[0].parked,null);assert.ok(result.record.assumption.rationale);assert.ok(result.record.assumption.revert);assert.ok(events.some(e=>e.type==='autonomous_decision'));
 const branch=c.p.assumeBranch(state.run_id,record.id);c.fx.git('branch',branch);await fs.mkdir(path.dirname(c.p.doubtFile(record.id)),{recursive:true});await fs.writeFile(c.p.doubtFile(record.id),JSON.stringify(result.record));
 assert.equal((await assumptionBranches({project:c.fx.root,runId:state.run_id,root:c.fx.root},c.d))[0].accepted,true);
 const assumeTree=path.join(c.tmp,'assume-tree');c.fx.git('worktree','add',assumeTree,branch);await fs.writeFile(path.join(assumeTree,'assumed.txt'),'accepted technical assumption');git(assumeTree,['add','assumed.txt']);git(assumeTree,['commit','-m','feat: reversible choice']);
 const merged=await mergeAcceptedAssumptions({state:result.state,runId:state.run_id,integration:state.integration,emit:async()=>{}},{...c.d,project:c.fx.root});assert.equal(merged.merged.length,1);assert.equal(await fs.readFile(path.join(c.fx.root,'assumed.txt'),'utf8'),'accepted technical assumption');
 const protectedResult=await park(ctx,state,{...record,id:'d-0002'},{reasons:['human_gate'],reversible:false},{...c.d,emit:async()=>({ok:true}),notify:async()=>{}});
 assert.equal(protectedResult.state.units[0].state,'parked');assert.equal(protectedResult.record.decision,null);
}));
await test('worker continuation uses exact saved provider session and worktree; repeated sequence is idempotent',()=>withRun(async c=>{
 const script=path.resolve('plugin/scripts/codex-worker.mjs'), fake=path.join(c.tmp,'fake-provider.mjs'), capture=path.join(c.tmp,'argv.json');
 await fs.writeFile(fake,`#!/usr/bin/env node\nimport fs from 'node:fs';fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify({argv:process.argv.slice(2),cwd:process.cwd()})); console.log(JSON.stringify({type:'thread.started',thread_id:'thread-1'}));process.exit(0);\n`,{mode:0o755});
 const wd=c.p.codexWorkerDir('worker-1');await fs.mkdir(wd,{recursive:true});await fs.writeFile(path.join(wd,'state.json'),JSON.stringify({pid:0,cwd:c.unit.worktree,tool:'codex',model:'gpt-6.1-sol',effort:'low',direct:true,sessionId:'thread-1',access:'sandbox'}));await fs.writeFile(path.join(wd,'exit'),'1');await fs.writeFile(path.join(wd,'result.line'),'old limit');
 const env={...c.env,PANDACORP_CODEX_BIN:fake};delete env.PANDACORP_FAKE_WORKER;
 const out=await resumeWorker({project:c.fx.root,workerId:'worker-1',unit:c.unit.id,dir:c.unit.worktree,sequence:1},{env});assert.equal(out.ok,true);
 for(let i=0;i<50;i++){if(await fs.stat(capture).catch(()=>null))break;await new Promise(r=>setTimeout(r,20));}
 const actual=JSON.parse(await fs.readFile(capture,'utf8'));assert.equal(await fs.realpath(actual.cwd),await fs.realpath(c.unit.worktree));assert.ok(actual.argv.includes('thread-1'));assert.equal(actual.argv[1],'resume');assert.ok(actual.argv.includes('gpt-6.1-sol'));
 await fs.writeFile(path.join(wd,'resume.lock'),JSON.stringify({pid:99999999}));
 const again=spawnSync(process.execPath,[script,'resume','--project',c.fx.root,'--id','worker-1','--resume-sequence','1'],{env,encoding:'utf8'});assert.equal(again.status,0);assert.match(again.stdout,/CODEX-RUNNING/);assert.equal(JSON.parse(await fs.readFile(path.join(wd,'state.json'),'utf8')).resumeSequence,1);
}));
await test('native Claude limit receipt preserves Agent id and returns the same native continuation',()=>withRun(async c=>{
 const s=await stateApi.readState(c.fx.root,c.d);s.units[0].worker={runtime:'claude',model:'sonnet',effort:'medium',via:'agent',pid:null,worker_id:null};s.jobs=[];await stateApi.writeState(c.fx.root,s,c.d);
 const file=path.join(c.tmp,'receipt.json');await fs.writeFile(file,JSON.stringify({ok:false,limit:'usage_limit',detail:'provider usage limit reached',sessionId:'agent-123',resetsAt:at(3600)}));
 await suspendExecution({project:c.fx.root,epoch:c.got.epoch,unit:c.unit.id,file},c.d);const u=(await stateApi.readState(c.fx.root,c.d)).units[0];
 assert.equal(u.state,'suspended');assert.equal(u.worker.session_id,'agent-123');assert.equal(u.worktree,c.unit.worktree);assert.equal(u.pin.tool,'claude');
 const decision=continuationDecision(u,readings(at(3661),10,10,at(9000)),T+3661000);assert.equal(decision.ready,true);
 const r=readings(at(3661),10,10,at(9000));r.claude.windows.push({id:'weekly',scope:'model:fable',applicability:'required',percentUsed:99,resetsAt:at(3500)});
 assert.equal(continuationDecision(u,r,T+3661000).ready,true,'an expired unrelated model window cannot block the renewed pin');
}));
await test('dead wake claim is recoverable and a late manual resume cannot steal the winner',()=>withRun(async c=>{
 await limit(c);await applyTerminal(c.run.ref,{action:'waiting',resumeAt:at(3600)},c.d);c.env.PANDACORP_NOW=process.env.PANDACORP_NOW=at(3661);c.d.readCapacity=()=>readings(at(3661),5,5,at(9000));
 const s=await stateApi.readState(c.fx.root,c.d);s.status='resuming';s.wake.claimPid=99999999;s.wake.owner='dead-lead';await stateApi.writeState(c.fx.root,s,c.d);
 const winner=await wakeCapacity({project:c.fx.root,epoch:c.got.epoch,owner:'drive'},c.d);assert.equal(winner.claimed,true);
 const late=await startResume({project:c.fx.root,coordinator:'codex'},c.d);assert.equal(late.claimed,false);assert.equal(late.action,'already_resumed');assert.equal(late.epoch,c.got.epoch);
}));
console.log(`RESULT ${passed} passed, ${failed} failed`);process.exitCode=failed?1:0;
