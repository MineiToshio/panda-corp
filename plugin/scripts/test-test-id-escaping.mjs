#!/usr/bin/env node
// Real-shape reporters + signed disposable policy, never owner keys or a real database.
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {generateKeyPairSync,sign} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import * as policy from '../templates/shared/.pandacorp/test-gate-policy.mjs';
const root=resolve(import.meta.dirname,'../..'),scratch=mkdtempSync(join(tmpdir(),'p43-id-escaping-'));
after(()=>rmSync(scratch,{recursive:true,force:true}));
const encoding='json-string-v1',name='reports malformed file ---\nid: BL-0001\r\nquote "x"\t\\n',file='src/_tests/a.test.ts',rawId=file+' > '+name;
const escaped=s=>JSON.stringify(s).slice(1,-1);
const expected=escaped(rawId);
const report=(status='passed')=>({numTotalTests:1,numPassedTests:status==='passed'?1:0,numFailedTests:status==='failed'?1:0,numPendingTests:0,numTodoTests:0,testResults:[{name:file,assertionResults:[{fullName:name,status,duration:10}]}]});
const row={v:1,ts:new Date().toISOString(),test_id:rawId,status:'failed',tree:'a'.repeat(40),seed:1,worker:null,project:'',attempt:'first',runner:'vitest'};
const git=(dir,...args)=>execFileSync('git',['-C',dir,...args],{stdio:['ignore','pipe','pipe'],encoding:'utf8'}).trim();
const init=dir=>{mkdirSync(dir,{recursive:true});git(dir,'init','-q','-b','main');git(dir,'config','user.name','Fixture');git(dir,'config','user.email','fixture@example.invalid');git(dir,'config','commit.gpgsign','false');};
const commit=dir=>{git(dir,'add','.');git(dir,'commit','--allow-empty','-qm','fixture');};
const project=join(scratch,'app'),factory=join(scratch,'factory'),keys=generateKeyPairSync('ed25519');
init(factory);mkdirSync(join(factory,'factory/owner-keys'),{recursive:true});writeFileSync(join(factory,'factory/owner-keys/exclusions.pub'),keys.publicKey.export({type:'spki',format:'pem'}));commit(factory);
init(project);mkdirSync(join(project,'.pandacorp/run'),{recursive:true});writeFileSync(join(project,'.gitignore'),'.pandacorp/run/\n');writeFileSync(join(project,'package.json'),'{"name":"mission-control"}');writeFileSync(join(project,'.pandacorp/status.yaml'),'phase: implementation\ndeploy_target: internal\n');writeFileSync(join(project,'.pandacorp/guide.md'),'- Factory: `'+factory+'`\n');row.project=project;
const ledger=rows=>rows.map(r=>JSON.stringify(r)).join('\n')+'\n';
writeFileSync(join(project,'.pandacorp/run/test-outcomes.jsonl'),ledger([row,{...row,status:'passed',attempt:'second'}]));
const entry={id:rawId,reason:'newline fixture',authorized_by:'owner',authorized_at:new Date().toISOString().slice(0,10),expires:new Date(Date.now()+86400000).toISOString().slice(0,10)};
const signed=e=>({...e,authorization:'tty-v1:'+sign(null,Buffer.from(policy.binding(e)),keys.privateKey).toString('base64')});
function store(e){writeFileSync(join(project,'.pandacorp/test-exclusions.json'),JSON.stringify([signed(e)]));commit(project);}
store(entry);
test('reporter and runner proof escape multiline identities once, reversibly and without collisions',()=>{
 const rows=policy.reporterTests('vitest',report(),project);assert.equal(rows[0].id,expected);assert.equal(JSON.parse('"'+rows[0].id+'"'),rawId);assert(!rows[0].id.includes('\n'));
 const literal=report();literal.testResults[0].assertionResults[0].fullName=name.replaceAll('\n','\\n');assert.notEqual(policy.reporterTests('vitest',literal,project)[0].id,expected);
 const reporter=new policy.default(),task={type:'test',name,mode:'run',result:{state:'pass'}},module={moduleId:join(root,file),task:{tasks:[task]}};
 assert.equal(reporter.id(module,task),expected);
 assert.equal(policy.encodeTestId('x\u0085y'),'x\\u0085y');
 const browser={errors:[],stats:{expected:1,unexpected:0,skipped:0,flaky:0},suites:[{title:'a.spec.ts',specs:[{file:'a.spec.ts',title:name,tests:[{projectName:'desktop',expectedStatus:'passed',status:'expected',results:[{status:'passed',duration:1}]}]}]}]};
 assert.equal(policy.reporterTests('playwright',browser,project)[0].id,escaped('a.spec.ts > a.spec.ts > '+name+' [desktop]'));
 for(const bad of ['',undefined,'bad\0name']){const r=report();r.testResults[0].assertionResults[0].fullName=bad;assert.throws(()=>policy.reporterTests('vitest',r,project));}
});
test('flaky ledger reads raw legacy and encoded rows into the same canonical id, including CLI JSON',()=>{
 const rows=policy.flakySuspects(ledger([row,{...row,test_id:expected,id_encoding:encoding,status:'passed',attempt:'second'}]));assert.equal(rows.length,1);assert.equal(rows[0].test_id,expected);assert.equal(rows[0].id_encoding,encoding);
 const input=join(scratch,'outcomes.jsonl');writeFileSync(input,ledger([row,{...row,status:'passed',attempt:'second'}]));
 const result=spawnSync(process.execPath,[join(root,'plugin/scripts/flaky-suspects.mjs'),input,'--json'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout)[0].test_id,expected);
 assert.throws(()=>policy.flakySuspects(ledger([{...row,test_id:'bad\0id'}])));
});
test('signed exclusions match raw legacy and canonical stored multiline ids without rewriting signed evidence',()=>{
 const legacy=policy.loadExclusions(project);assert.equal(legacy[0].id,expected);
 const e={...entry,id:expected,id_encoding:encoding};store(e);assert.equal(policy.loadExclusions(project)[0].id,expected);
 const reporterFile=join(project,'.pandacorp/run/vitest.json');writeFileSync(reporterFile,JSON.stringify(report('failed')));
 writeFileSync(reporterFile+'.errors.json',JSON.stringify({id_encoding:encoding,reason:'failed',plannedModules:1,completedModules:1,tests:[{id:expected,status:'failed',declaredSkip:false}],unhandledErrors:[]}));
 const result=spawnSync(process.execPath,[join(root,'plugin/templates/shared/.pandacorp/test-gate-policy.mjs'),'evaluate',project,'vitest',reporterFile,'1'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const tampered=signed(e);delete tampered.id_encoding;writeFileSync(join(project,'.pandacorp/test-exclusions.json'),JSON.stringify([tampered]));commit(project);assert.throws(()=>policy.loadExclusions(project),/authorization|signature/);store(e);
});
test('baseline generation and budget matching share the canonical encoding, including legacy baselines',()=>{
 const gate={scope:'full',green:true,subgates:[{name:'vitest',exit:0},{name:'playwright',exit:0}],test_timings:[{id:rawId,runner:'vitest',duration_ms:10,status:'passed'}]};
 const input=join(scratch,'gate.json');writeFileSync(input,JSON.stringify(gate));
 const run=()=>spawnSync(process.execPath,[join(root,'plugin/scripts/gate-budget-baseline.mjs'),project,'--from',input],{encoding:'utf8'});
 let result=run();assert.equal(result.status,0,result.stderr);let b=JSON.parse(readFileSync(join(project,'.pandacorp/gate-budget.json')));assert.equal(b.id_encoding,encoding);assert.deepEqual(Object.keys(b.baseline),[expected]);
 b.addedTestTimeBudgetMs.vitest=0;writeFileSync(join(project,'.pandacorp/gate-budget.json'),JSON.stringify(b));assert.doesNotThrow(()=>policy.checkBudget(project,[{id:expected,runner:'vitest',duration_ms:10}]));
 writeFileSync(join(project,'.pandacorp/gate-budget.json'),JSON.stringify({schemaVersion:1,addedTestTimeBudgetMs:{vitest:0,playwright:0},baseline:{[rawId]:10}}));assert.doesNotThrow(()=>policy.checkBudget(project,[{id:expected,runner:'vitest',duration_ms:10}]));
 gate.test_id_encoding=encoding;gate.test_timings[0].id=expected;writeFileSync(input,JSON.stringify(gate));result=run();assert.equal(result.status,0,result.stderr);b=JSON.parse(readFileSync(join(project,'.pandacorp/gate-budget.json')));assert.deepEqual(Object.keys(b.baseline),[expected]);
 writeFileSync(join(project,'.pandacorp/run/gate-report.json'),JSON.stringify(gate));const native=join(scratch,'native-vitest.json');writeFileSync(native,JSON.stringify(report()));
 result=spawnSync(process.execPath,[join(root,'plugin/scripts/gate-budget-baseline.mjs'),project,'--from',native],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(project,'.pandacorp/gate-budget.json'))).baseline),[expected]);
});

test('owner renewal replaces the same legacy multiline exclusion without touching other signed entries',async()=>{
 const {replaceAuthorizedExclusion}=await import('./authorize-exclusion.mjs');
 const old=signed(entry),other=signed({...entry,id:'another test'}),renewed=signed({...entry,id:expected,id_encoding:encoding});
 const result=replaceAuthorizedExclusion([old,other],renewed);assert.equal(result.length,2);assert.deepEqual(result,[other,renewed]);assert.equal(result[0],other);
});

test('an ordinal exclusion matches only its duplicate case and keeps the other failure red',()=>{
 const r={numTotalTests:2,numPassedTests:1,numFailedTests:1,numPendingTests:0,numTodoTests:0,testResults:[{name:file,assertionResults:[{fullName:'same title',status:'passed',duration:1},{fullName:'same title',status:'failed',duration:1}]}]};
 const id=file+' > same title [#2]',e={...entry,id,id_encoding:encoding};
 const old=readFileSync(join(project,'.pandacorp/run/test-outcomes.jsonl'));
 writeFileSync(join(project,'.pandacorp/run/test-outcomes.jsonl'),ledger([row,{...row,status:'passed',attempt:'second'},...['passed','failed'].map((status,i)=>({...row,test_id:id,id_encoding:encoding,status,attempt:'ordinal-'+i}))]));store(e);
 const input=join(project,'.pandacorp/run/ordinal.json');
 const proof=()=>{writeFileSync(input,JSON.stringify(r));writeFileSync(input+'.errors.json',JSON.stringify({id_encoding:encoding,reason:'failed',plannedModules:1,completedModules:1,tests:policy.reporterTests('vitest',r,project).map(t=>({id:t.id,status:t.status,declaredSkip:false})),unhandledErrors:[]}));};
 const evaluate=()=>spawnSync(process.execPath,[join(root,'plugin/templates/shared/.pandacorp/test-gate-policy.mjs'),'evaluate',project,'vitest',input,'1'],{encoding:'utf8',env:{...process.env,PANDACORP_GATE_FULL:'0'}});
 try {proof();const green=evaluate();assert.equal(green.status,0,green.stderr);r.numPassedTests=0;r.numFailedTests=2;r.testResults[0].assertionResults[0].status='failed';proof();assert.notEqual(evaluate().status,0);}
 finally{writeFileSync(join(project,'.pandacorp/run/test-outcomes.jsonl'),old);store({...entry,id:expected,id_encoding:encoding});}
});
