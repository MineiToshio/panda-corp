import assert from 'node:assert/strict';
import { decide } from '../runtime/capacity.mjs';
import { continuationDecision } from '../runtime/capacity/scheduler.mjs';
import { builderCell, reviewCell } from '../runtime/build/routing.mjs';
const now='2026-11-14T16:00:00Z';
const reading=(tool,pct)=>({schema:1,tool,state:'known',observedAt:now,windows:(tool==='claude'?['five_hour','weekly']:['weekly']).map(id=>({id,scope:'all',applicability:'required',percentUsed:pct,resetsAt:'2026-11-15T16:00:00Z'}))});
const readings=(c=20,x=20)=>({claude:reading('claude',c),codex:reading('codex',x)});
const run=(task,rs=readings())=>decide({task:{id:'probe',type:'review',risk:'normal',...task},readings:rs,now});
let failures=0, passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){failures++;console.log('FAIL '+name+': '+e.message)}}
test('F1 Claude critical author must receive a strictly higher Codex reviewer',()=>{
 const d=run({risk:'critical',implementerCell:{tool:'claude',model:'opus',effort:'high'}});
 console.log('observed F1',JSON.stringify(d.pin)); assert.equal(d.effort,'xhigh');
});
test('F2 missing-author normal review must retain nominal successor on reduction',()=>{
 const d=run({complexity:'normal'},readings(100,95.5));
 console.log('observed F2',JSON.stringify({action:d.action,pin:d.pin,reason:d.reason})); assert.equal(d.action,'wait');
});
test('F2 missing-author pin must not equal nominal normal implementer',()=>{
 assert.throws(()=>run({complexity:'normal',pin:{tool:'codex',model:'sol',effort:'medium'}}),/floor/);
});
test('F3 legacy suspended review below minimum must not resume',()=>{
 const unit={id:'old-review',kind:'review',zone:'none',worker:{runtime:'codex',model:'sol',effort:'low'},suspension:{at:'2026-11-14T14:00:00Z',resetAt:'2026-11-14T15:00:00Z',resumeAt:'2026-11-14T15:00:00Z',reason:'usage_limit'}};
 const d=continuationDecision(unit,readings(),Date.parse(now));
 console.log('observed F3',JSON.stringify({ready:d.ready,pin:d.decision?.pin}));assert.equal(d.ready,false);
});
test('control risk always raises explicit trivial complexity',()=>{
 assert.equal(run({type:'implement',risk:'critical',complexity:'trivial'}).model,'astra');
});
test('control recorded normal author cannot receive identical reviewer',()=>{
 const author={tool:'codex',model:'sol',effort:'medium'};
 assert.equal(run({implementerCell:author}).effort,'high');
 assert.throws(()=>run({implementerCell:author,pin:author}),/floor/);
});


for (const tool of ['codex','claude']) for (const complexity of ['trivial','normal','complex']) {
 test(`missing-author ${tool}/${complexity} successor binds pins and scarcity`,()=>{
  const expected={codex:{trivial:['sol','medium'],normal:['sol','high'],complex:['astra','high']},
   claude:{trivial:['opus','low'],normal:['opus','low'],complex:['opus','high']}}[tool][complexity];
  const d=run({complexity,override:tool});assert.deepEqual([d.model,d.effort],expected);
  const author={codex:{trivial:['sol','low'],normal:['sol','medium'],complex:['sol','high']},
   claude:{trivial:['sonnet','medium'],normal:['sonnet','high'],complex:['opus','medium']}}[tool][complexity];
  assert.throws(()=>run({complexity,pin:{tool,model:author[0],effort:author[1]}}),/floor/);
 });
}
test('F1 reverse critical direction also requires xhigh',()=>{
 const d=run({risk:'critical',override:'claude',implementerCell:{tool:'codex',model:'astra',effort:'high'}});
 assert.deepEqual(d.pin,{tool:'claude',model:'opus',effort:'xhigh'});
});
test('common scale never permits cross-tool equality, including intermediate Opus low',()=>{
 const levels=[['luna','low','haiku','low'],['sol','low','sonnet','medium'],['sol','medium','sonnet','high'],
 ['sol','high','opus','medium'],['astra','high','opus','high'],['astra','xhigh','opus','xhigh']];
 for(const [cm,ce,hm,he] of levels) for(const [author,pin] of [
  [{tool:'codex',model:cm,effort:ce},{tool:'claude',model:hm,effort:he}],
  [{tool:'claude',model:hm,effort:he},{tool:'codex',model:cm,effort:ce}]]) assert.throws(()=>run({implementerCell:author,pin}),/floor/);
 assert.deepEqual(run({override:'codex',implementerCell:{tool:'claude',model:'opus',effort:'low'}}).pin,{tool:'codex',model:'sol',effort:'high'});
});
test('F3 429 validates role, zone and actual authors before any continuation',()=>{
 const author={id:'author',kind:'build',state:'reviewing',frd:'f',wos:['wo'],worker:{runtime:'codex',model:'sol',effort:'medium'}};
 for(const kind of ['review','deferred-review','audit']) for(const reason of ['rate_limit','usage_limit']) {
  const u={id:'old',kind,frd:'f',wos:['wo'],zone:'none',worker:{runtime:'codex',model:'sol',effort:'medium'},
   suspension:{at:'2026-11-14T14:00:00Z',resetAt:'2026-11-14T15:00:00Z',resumeAt:'2026-11-14T15:00:00Z',reason}};
  const state={units:[author,u]};const d=continuationDecision(u,readings(),Date.parse(now),state);
  assert.equal(d.ready,false);assert.equal(d.requeue,true);
  if(kind!=='audit') {
   u.worker.effort='high';assert.equal(continuationDecision(u,readings(),Date.parse(now),state).ready,true);
  }
 }
});
import {buildWorkerArgv} from '../runtime/build/workers.mjs';
test('F3 worker adapter preserves full review task and rejects an identical pin',()=>{
 const task={id:'review',type:'review',risk:'normal',complexity:'normal',implementerCell:{tool:'codex',model:'sol',effort:'medium'}};
 const input={project:'/virtual',unit:'review',workerId:'worker',promptFile:'/virtual/brief',dir:'/virtual',task,cell:{runtime:'codex',model:'sol',effort:'medium'}};
 assert.throws(()=>buildWorkerArgv(input),/floor/);
 const args=buildWorkerArgv({...input,cell:{...input.cell,effort:'high'}}).args;
 const carried=JSON.parse(args[args.indexOf('--capacity-task')+1]);assert.equal(carried.type,'review');assert.deepEqual(carried.implementerCell,task.implementerCell);
});
import {readFileSync} from 'node:fs';
import {workOrderComplexity,maxComplexity} from '../runtime/complexity.mjs';
import {readPlanWorkOrders,plan} from '../runtime/build/planner.mjs';
import {capacityTaskForUnit} from '../runtime/build/routing.mjs';
try {
const read= fm=>readPlanWorkOrders('/virtual',{fs:{readdir:async p=>p.endsWith('work-orders')?['wo-01-001.md']:['frd-01-test'],readFile:async p=>p.endsWith('frd.md')?'AC-01-001.1':`---\nid: WO-01-001\nimplementation_status: PLANNED\n${fm}\n---\nAC-01-001.1`}});
const legacy=await read('');assert.equal(legacy.wos[0].complexity,'normal');
const high=await read('difficulty: high');assert.equal(high.wos[0].complexity,'complex');
const invalid=await read('complexity: enormous');assert.equal(invalid.wos.length,0);assert.match(invalid.errors[0].reason,/complexity/);
for(const artifacts of [['src/app/a.ts','src/lib/b.ts','src/components/c.ts'],['src/components/c.ts','src/app/a.ts','src/lib/b.ts','src/lib/b.ts']]) assert.equal(workOrderComplexity({artifacts}),'complex');
assert.equal(maxComplexity(['complex','trivial','normal']),'complex');
const p=plan({wos:high.wos,scope:{frds:['frd-01-test']},label:'codex'});assert.equal(p.units.find(u=>u.kind==='build').complexity,'complex');
const props=JSON.parse(readFileSync(new URL('../runtime/build/schemas/state.schema.json',import.meta.url))).properties.units.items;
assert.ok(!props.required.includes('complexity'));assert.deepEqual(props.properties.complexity.enum,['trivial','normal','complex']);
const u={id:'r',kind:'review',state:'queued',frd:'f',zone:'none',wos:['wo']};
const state={units:[u,{id:'old',kind:'build',state:'verified',frd:'f',wos:['wo'],worker:{runtime:'codex',model:'astra',effort:'high'}},{id:'patch',kind:'patch',state:'reviewing',frd:'f',wos:['wo'],complexity:'trivial',worker:{runtime:'claude',model:'sonnet',effort:'medium'}}]};
assert.deepEqual(capacityTaskForUnit(u,state).implementerCells,[{tool:'claude',model:'sonnet',effort:'medium'}]);
const r=reviewCell({authors:[state.units[2].worker],kind:'frd',zone:'none'});assert.equal(r.used.model,'sol');assert.equal(r.used.effort,'medium');
console.log('PASS: legacy WO, high heuristic, invalid enum, order/duplicates, max chain, planner stamp, optional schema, patch re-review actual author');
passed++;}catch(error){failures++;console.error('FAIL retained P7 controls: '+error.stack);}
test('F2 explicit complex legacy review retains its conservative floor with missing WO/author metadata',()=>{
 const unit={id:'r',kind:'review',complexity:'complex',frd:'f',wos:['wo']};
 const task=capacityTaskForUnit(unit,{units:[unit,{id:'w',kind:'build',state:'reviewing',frd:'f',wos:['wo'],worker:null}]});
 assert.equal(task.complexity,'complex');assert.equal(task.unknownImplementer,true);
 assert.throws(()=>decide({task:{...task,pin:{tool:'codex',model:'sol',effort:'high'}},readings:readings(),now}),/floor/);
});
console.log(`RESULT ${passed} passed, ${failures} failed`);process.exitCode=failures?1:0;
