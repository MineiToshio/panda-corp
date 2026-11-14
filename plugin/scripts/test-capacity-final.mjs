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
 const d={env,buildState:bs,admission,routing,telemetry:{emitEvent:async()=>{}},monotonic:()=>0,log:()=>{},isAlive:()=>false,overrides:{},sleep:async()=>{}};
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

await test('ADVERSARIAL R1: review alone wakes after its capacity comes back',()=>withRun(async c=>{
 const author={...c.unit,state:'reviewing'};
 const review=stateApi.newUnit({id:'u-review',kind:'review',depends_on:[author.id]});
 const s={...c.state,units:[author,review],jobs:[]};await stateApi.writeState(c.fx.root,s,c.d);
 const candidates=await buildCandidates(c.run,s,policy({readings:readings(NOW,100,100),now:T}),{ready:[]},{},[]);
 assert.equal(candidates.state.units[1].parked,'no_reviewer');
 await applyTerminal(c.run.ref,{action:'waiting',resumeAt:at(3600)},c.d);
 c.env.PANDACORP_NOW=at(3661);c.d.readCapacity=()=>readings(at(3661),100,0,at(9000));
 const result=await wakeCapacity({project:c.fx.root,epoch:c.got.epoch,owner:'drive'},c.d);
 assert.equal(result.claimed,true);
 c.fx.git('branch',c.p.integrationBranch(c.state.run_id));
 const pol=policy({readings:c.d.readCapacity(),now:T+3661000});
 const ready=await buildCandidates(c.run,await stateApi.readState(c.fx.root,c.d),pol,{ready:[]},{},[]);
 assert.equal(ready.list.length,1);assert.equal(ready.list[0].unit.id,'u-review');
 c.d.admission={...admission,readDiskFreeGib:()=>100,countHostSlots:()=>({held:0}),decide:()=>({grant:'B'}),recordDiskWait:()=>false};
 const dispatched=await dispatchRound(c.run,ready.state,ready,{k:1},{value:null},{policy:pol,out:{claude:{pct:0},codex:{pct:0}}});
 assert.equal(dispatched.units[0].unit,'u-review');assert.equal(dispatched.state.units.find(u=>u.id==='u-review').parked,null);
}));
await test('ADVERSARIAL control: identical wait without no_reviewer flag wakes',()=>withRun(async c=>{
 const s={...c.state,units:[{...c.unit,state:'reviewing'},stateApi.newUnit({id:'u-review',kind:'review',depends_on:[c.unit.id]})],jobs:[]};
 await stateApi.writeState(c.fx.root,s,c.d);await applyTerminal(c.run.ref,{action:'waiting',resumeAt:at(3600)},c.d);
 c.env.PANDACORP_NOW=at(3661);c.d.readCapacity=()=>readings(at(3661),0,0,at(9000));
 assert.equal((await wakeCapacity({project:c.fx.root,epoch:c.got.epoch,owner:'drive'},c.d)).claimed,true);
}));
await test('ADVERSARIAL R2: takeover can continue a suspended native agent',()=>withRun(async c=>{
 const s={...c.state,units:[{...c.unit,state:'suspended',worker:{runtime:'claude',model:'sonnet',effort:'medium',via:'agent',pid:null,worker_id:null,session_id:'agent-native'},pin:{tool:'claude',model:'sonnet',effort:'medium'},suspension:{reason:'usage_limit',at:NOW,resetAt:at(300),resumeAt:at(300),sequence:1,readRetries:0,rateAttempts:0}}],jobs:[]};
 await stateApi.writeState(c.fx.root,s,c.d);const transferred=await takeOver({project:c.fx.root,runId:s.run_id,trigger:'c'},c.d);
 c.run.ref.epoch=transferred.epoch;c.env.PANDACORP_NOW=at(361);
 const pol=policy({readings:readings(at(361),20,20,at(9000)),now:T+361000});
 const candidates=await buildCandidates(c.run,await stateApi.readState(c.fx.root,c.d),pol,{ready:[]},{},[]);
 console.log('R2 CANDIDATES',candidates.list.map(c=>({via:c.via,resume:c.resume,cell:c.cell})));
 c.d.admission={...admission,readDiskFreeGib:()=>100,countHostSlots:()=>({held:0}),decide:()=>({grant:'B'}),recordDiskWait:()=>false};
 const dispatched=await dispatchRound(c.run,await stateApi.readState(c.fx.root,c.d),candidates,{k:1},{value:null},{policy:pol,out:{claude:{pct:20},codex:{pct:20}}});
 console.log('R2 REAL DISPATCH',JSON.stringify(dispatched.units));
 const {driveLoop}=await import('../runtime/build/drive/loop.mjs');
 const out=await driveLoop({project:c.fx.root,epoch:transferred.epoch},{...c.d,maxPolls:1,next:async()=>({action:'dispatch',units:dispatched.units}),land:async()=>{},finish:async()=>{},notify:async()=>{},engineFailure:async()=>{}});
 console.log('R2 OBSERVED',JSON.stringify(out));assert.notEqual(out.outcome,'engine_failure');
}));
await test('ADVERSARIAL R2: native security audit cannot be verified without execution',()=>withRun(async c=>{
 const s={...c.state,units:[{...c.unit,kind:'audit',zone:'r1',state:'suspended',worker:{runtime:'claude',model:'opus',effort:'high',via:'agent',pid:null,worker_id:null,session_id:'agent-native'},pin:{tool:'claude',model:'opus',effort:'high'},suspension:{reason:'usage_limit',at:NOW,resetAt:at(300),resumeAt:at(300),sequence:1,readRetries:0,rateAttempts:0}}],jobs:[]};
 await stateApi.writeState(c.fx.root,s,c.d);const transferred=await takeOver({project:c.fx.root,runId:s.run_id,trigger:'c'},c.d);
 c.run.ref.epoch=transferred.epoch;c.env.PANDACORP_NOW=at(361);
 const pol=policy({readings:readings(at(361),20,20,at(9000)),now:T+361000});
 const candidates=await buildCandidates(c.run,await stateApi.readState(c.fx.root,c.d),pol,{ready:[]},{},[]);
 console.log('R2 CANDIDATES',candidates.list.map(c=>({via:c.via,resume:c.resume,cell:c.cell})));
 c.d.admission={...admission,readDiskFreeGib:()=>100,countHostSlots:()=>({held:0}),decide:()=>({grant:'B'}),recordDiskWait:()=>false};
 const dispatched=await dispatchRound(c.run,await stateApi.readState(c.fx.root,c.d),candidates,{k:1},{value:null},{policy:pol,out:{claude:{pct:20},codex:{pct:20}}});
 console.log('R2 REAL DISPATCH',JSON.stringify(dispatched.units));
 const {driveLoop}=await import('../runtime/build/drive/loop.mjs');
 const out=await driveLoop({project:c.fx.root,epoch:transferred.epoch},{...c.d,maxPolls:1,next:async()=>({action:'dispatch',units:dispatched.units}),land:async()=>{},finish:async()=>{},notify:async()=>{},engineFailure:async()=>{}});
 const after=(await stateApi.readState(c.fx.root,c.d)).units[0];console.log('AUDIT HANDOFF OBSERVED',JSON.stringify({outcome:out.outcome,state:after.state,worker:after.worker,token_hash:after.token_hash}));assert.notEqual(after.state,'verified');
}));
await test('ADVERSARIAL: R3 security audit must retain critical floor',()=>withRun(async c=>{
 const file=path.join(c.fx.root,'src/app/api/ping/route.ts');await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'export function GET(){return Response.json({ok:true});}\n');
 c.fx.git('add','src/app/api/ping/route.ts');c.fx.git('commit','-m','feat: ping endpoint');
 const {computeRisk}=await import('../runtime/build/risk.mjs');
 const risk=await computeRisk({root:c.fx.root,range:`${c.fx.sha}..HEAD`});
 const cell=routing.builderCell({id:'audit',kind:'audit',size:'feature',zone:risk.zone},{label:'codex',coordinator:'codex-session',quota:policy({readings:readings(),now:T})});
 console.log('AUDIT OBSERVED',JSON.stringify({risk,cell:{runtime:cell.runtime,model:cell.model,effort:cell.effort}}));assert.ok(risk.audit);assert.equal(cell.model,'astra');assert.equal(cell.effort,'high');
}));
// Beyond the review oracles: retain the capable coordinator through wake, dispatch and real report ingestion.
import { suspendExecution } from '../runtime/build/capacity.mjs';
import { ingestReport } from '../runtime/build/report.mjs';
import { reviewRecord } from '../runtime/build/review.mjs';
import { deferAuditUnit } from '../runtime/build/drive/audit.mjs';
for (const kind of ['build','audit']) await test(`native ${kind}: retained lease -> wake -> same Agent -> real report -> fenced relay`,()=>withRun(async c=>{
 const worker={runtime:'claude',model:kind==='audit'?'opus':'sonnet',effort:kind==='audit'?'high':'medium',via:'agent',pid:null,worker_id:null,session_id:'agent-native'};
 if(kind==='build') {
   await fs.unlink(path.join(c.unit.worktree,'saved.txt'));
   await fs.appendFile(path.join(c.unit.worktree,'src/alpha/list.ts'),'\n// dirty native checkpoint\n');
 }
 const unit={...c.unit,kind,wos:kind==='build'?['WO-01-001']:[],worker};
 await stateApi.writeState(c.fx.root,{...c.state,coordinator:'claude-session',scope:{...c.state.scope,wos:unit.wos},units:[unit],jobs:[]},c.d);
 const receipt=path.join(c.tmp,'limit.json');await fs.writeFile(receipt,JSON.stringify({ok:false,limit:'usage_limit',sessionId:'agent-native',resetsAt:at(300)}));
 await suspendExecution({project:c.fx.root,epoch:c.got.epoch,unit:unit.id,file:receipt},c.d);
 const before=await fs.readFile(c.p.tokenFile,'utf8');
 for(const trigger of ['a','c','direct']) {
   const out=await takeOver({project:c.fx.root,runId:c.state.run_id,trigger},c.d);
   assert.equal(out.outcome,'retry');assert.equal(out.reason,'native_continuation');assert.equal(out.epoch,c.got.epoch);
   assert.equal(await fs.readFile(c.p.tokenFile,'utf8'),before);
 }
 const checkpoint=(await stateApi.readState(c.fx.root,c.d)).units[0];
 await assert.rejects(()=>deferAuditUnit({project:c.fx.root,epoch:c.got.epoch,unit:{unit:unit.id}},c.d),e=>e.code==='AUDIT_EVIDENCE_REQUIRED');
 assert.deepEqual((await stateApi.readState(c.fx.root,c.d)).units[0],checkpoint);
 await applyTerminal(c.run.ref,{action:'waiting',resumeAt:at(300)},c.d);
 c.env.PANDACORP_NOW=at(361);const fresh=readings(at(361),10,10,at(9000));c.d.readCapacity=()=>fresh;
 assert.equal((await wakeCapacity({project:c.fx.root,epoch:c.got.epoch,owner:'lead'},c.d)).claimed,true);
 const pol=policy({readings:fresh,now:T+361000});
 const candidates=await buildCandidates(c.run,await stateApi.readState(c.fx.root,c.d),pol,{ready:[]},{},[]);
 c.d.admission={...admission,readDiskFreeGib:()=>100,countHostSlots:()=>({held:0}),decide:()=>({grant:'B'}),recordDiskWait:()=>false};
 const dispatched=await dispatchRound(c.run,await stateApi.readState(c.fx.root,c.d),candidates,{k:1},{value:null},{policy:pol,out:{claude:{pct:10},codex:{pct:10}}});
 assert.equal(dispatched.units[0].session_id,'agent-native');assert.equal(dispatched.units[0].via,'agent');assert.equal(dispatched.units[0].resume,true);
 const running=(await stateApi.readState(c.fx.root,c.d)).units[0];assert.equal(running.token_hash,unit.token_hash);assert.equal(running.attempt,1);
 if(kind==='audit') {
   const report={schema:1,unit:unit.id,token:c.token.token,reviewer:{runtime:worker.runtime,model:worker.model,effort:worker.effort},verdict:'pass',findings:[],probes:[],traceability:[],doubt:null};
   await assert.rejects(()=>reviewRecord({project:c.fx.root,epoch:c.got.epoch,unit:unit.id,token:c.token.token,report:{...report,token:'bad'}},c.d));
   assert.notEqual((await stateApi.readState(c.fx.root,c.d)).units[0].state,'verified');
   assert.equal((await reviewRecord({project:c.fx.root,epoch:c.got.epoch,unit:unit.id,token:c.token.token,report},c.d)).verdict,'pass');
   assert.equal((await stateApi.readState(c.fx.root,c.d)).units[0].state,'verified');
 } else {
   const file=c.p.reportFile(unit.id);await fs.mkdir(path.dirname(file),{recursive:true});
   await fs.writeFile(file,JSON.stringify({schema:1,unit:unit.id,token:c.token.token,status:'done',summary:'same native execution completed',files:['src/alpha/list.ts'],verification:[],pending:[],doubt:null,diagnosis:null,gate:null,authored_by:{runtime:worker.runtime,model:worker.model,effort:worker.effort}}));
   const out=await ingestReport({project:c.fx.root,epoch:c.got.epoch,unit:unit.id,token:c.token.token,file},c.d);assert.equal(out.outcome,'committed',JSON.stringify(out));
 }
 const relayed=await takeOver({project:c.fx.root,runId:c.state.run_id,trigger:'a'},c.d);assert.equal(relayed.outcome,'loop');assert.equal(relayed.epoch,c.got.epoch+1);
 await assert.rejects(()=>stateApi.readLeaseToken(c.fx.root,c.got.epoch,c.d),e=>e.code==='FENCE');
 await assert.rejects(()=>(kind==='audit'?reviewRecord:ingestReport)({project:c.fx.root,epoch:c.got.epoch,unit:unit.id,token:c.token.token,file:c.p.reportFile(unit.id)},c.d),e=>e.code==='FENCE','obsolete coordinator cannot report');
}));
await test('generator --check detects missing/stale/extra agents without writing',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'capacity-generator-'));
 try {
   for(const dir of ['plugin/scripts','plugin/runtime','plugin/agents'])await fs.mkdir(path.join(tmp,dir),{recursive:true});
   for(const file of ['plugin/scripts/generate-codex-agents.mjs','plugin/runtime/model-tiers.json','plugin/runtime/codex-tier-workers.json'])await fs.copyFile(path.resolve(file),path.join(tmp,file));
   for(const file of await fs.readdir('plugin/agents'))if(file.endsWith('.md'))await fs.copyFile(path.resolve('plugin/agents',file),path.join(tmp,'plugin/agents',file));
   const script=path.join(tmp,'plugin/scripts/generate-codex-agents.mjs'),dir=path.join(tmp,'.codex/agents');
   const run=(...args)=>spawnSync(process.execPath,[script,...args],{encoding:'utf8'});
   assert.equal(run('--check').status,1);assert.equal(await fs.stat(dir).catch(()=>null),null,'check cannot create output directories');
   assert.equal(run().status,0);assert.equal(run('--check').status,0);
   const file=path.join(dir,'reviewer.toml');await fs.appendFile(file,'# stale\n');await fs.writeFile(path.join(dir,'extra.toml'),'extra');
   const before=await fs.stat(file);assert.equal(run('--check').status,1);assert.equal((await fs.stat(file)).mtimeMs,before.mtimeMs);assert.equal(await fs.readFile(path.join(dir,'extra.toml'),'utf8'),'extra');
   await fs.unlink(file);assert.equal(run('--check').status,1);assert.equal(await fs.stat(file).catch(()=>null),null);
 } finally {await fs.rm(tmp,{recursive:true,force:true});}
});
console.log(`RESULT ${passed} passed, ${failed} failed`);process.exitCode=failed?1:0;
