#!/usr/bin/env node
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,copyFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve,join,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import * as policy from '../templates/shared/.pandacorp/test-gate-policy.mjs';
const root=resolve(import.meta.dirname,'../..'),project=join(root,'mission-control');
const scratch=mkdtempSync(join(tmpdir(),'p43-corpus-'));after(()=>rmSync(scratch,{recursive:true,force:true}));
const excerpt=JSON.parse(readFileSync(new URL('./fixtures/p43-test-identities.json',import.meta.url)));
function counts(suites){const tests=suites.flatMap(s=>s.assertionResults);return {numTotalTests:tests.length,numPassedTests:tests.filter(t=>t.status==='passed').length,numFailedTests:tests.filter(t=>t.status==='failed').length,numPendingTests:tests.filter(t=>t.status==='skipped').length,numTodoTests:tests.filter(t=>t.status==='todo').length,testResults:suites};}
function modulesFor(report,project){return report.testResults.map((s,si)=>({moduleId:isAbsolute(s.name)?s.name:join(project,s.name),task:{tasks:s.assertionResults.map((t,ti)=>{
 const task={id:`${si}-${ti}`,type:'test',name:t.title,mode:t.status==='todo'?'todo':t.status==='skipped'?'skip':'run',result:t.status==='todo'?undefined:{state:({passed:'pass',failed:'fail',skipped:'skip'})[t.status]},location:t.location};
 let current=task;
 for(let i=(t.ancestorTitles??[]).length-1;i>=0;i--){const suite={type:'suite',name:t.ancestorTitles[i],tasks:[current]};current.suite=suite;current=suite;}
 return current;
 })}}));}
function classProof(report,project,file){const reporter=new policy.default();reporter.project=project;const modules=modulesFor(report,project);const old=process.env.PANDACORP_VITEST_ERRORS_FILE;process.env.PANDACORP_VITEST_ERRORS_FILE=file;try{reporter.onTestRunStart(modules);for(const m of modules)reporter.onTestModuleCollected(m);reporter.onTestRunEnd(modules,[],'passed');}finally{if(old===undefined)delete process.env.PANDACORP_VITEST_ERRORS_FILE;else process.env.PANDACORP_VITEST_ERRORS_FILE=old;}return JSON.parse(readFileSync(file));}
test('real excerpt: multiline, duplicate it.each and empty leaf with a nonempty ancestor all have unique ids',()=>{
 const r=counts(excerpt.testResults),rows=policy.reporterTests('vitest',r,project);assert.equal(rows.length,13);assert.equal(new Set(rows.map(t=>t.id)).size,rows.length);
 const duplicate=rows.filter(t=>t.id.includes('renders structured work-order reasons in Spanish'));assert.equal(duplicate.length,2);assert(duplicate[0].id.endsWith(' [#1]'));assert(duplicate[1].id.endsWith(' [#2]'));
});
test('class reporter uses the same inventory ids and accepts the exact real leaf/suite names',()=>{
 const r=counts(excerpt.testResults),proof=classProof(r,project,join(scratch,'proof.json'));
 const expected=policy.reporterTests('vitest',r,project).map(t=>t.id);assert.deepEqual(proof.tests.map(t=>t.id),expected);assert.equal(new Set(expected).size,13);
 for(const name of ['',undefined,'bad\0name']){const reporter=new policy.default(),task={type:'test',name,mode:'run'},module={moduleId:join(project,'x.test.ts'),task:{tasks:[task]}};assert.throws(()=>reporter.id(module,task));}
});
test('ordinals use location before reporter order, tolerate identical locations and reserve literal suffix titles',()=>{
 const r=counts([{name:'a.test.ts',assertionResults:[{fullName:'same',title:'same',ancestorTitles:[],status:'passed',duration:1,location:{line:20,column:2}},{fullName:'same',title:'same',ancestorTitles:[],status:'passed',duration:2,location:{line:10,column:2}},{fullName:'same [#2]',title:'same [#2]',ancestorTitles:[],status:'passed',duration:3}]}]);
 const rows=policy.reporterTests('vitest',r,project);assert.equal(new Set(rows.map(t=>t.id)).size,3);assert(rows[1].id.endsWith(' [#1]'));assert.equal(rows[2].id,'a.test.ts > same [#2]');assert(rows[0].id.endsWith(' [#2] [#2]'));
 r.testResults[0].assertionResults[0].location={line:10,column:2};const equal=policy.reporterTests('vitest',r,project);assert(equal[0].id.endsWith(' [#1]'));
 const proof=classProof(r,project,join(scratch,'locations.json'));assert.deepEqual(proof.tests.map(t=>t.id),equal.map(t=>t.id));
});
test('Playwright duplicate titles also share declaration ordinals and control escaping',()=>{
 const r={errors:[],stats:{expected:2,unexpected:0,skipped:0,flaky:0},suites:[{title:'file\nname',specs:[{file:'a.spec.ts',title:'same\ntitle',line:10,column:1,tests:[{projectName:'desktop',expectedStatus:'passed',status:'expected',results:[{status:'passed',duration:1}]}]},{file:'a.spec.ts',title:'same\ntitle',line:20,column:1,tests:[{projectName:'desktop',expectedStatus:'passed',status:'expected',results:[{status:'passed',duration:1}]}]}]}]};
 const rows=policy.reporterTests('playwright',r,project);assert.equal(new Set(rows.map(t=>t.id)).size,2);assert(rows[0].id.endsWith(' [#1]'));assert(rows[1].id.endsWith(' [#2]'));assert(rows.every(t=>!t.id.includes('\n')));
});
// Optional mandatory coordinator replay: no product tests/DB/build, only the supplied JSON.
if(process.env.P43_REAL_CORPUS)test('mandatory 5547-test real corpus: policy, class inventory and baseline replay accept all unique ids',()=>{
 const source=process.env.P43_REAL_CORPUS,r=JSON.parse(readFileSync(source)),rows=policy.reporterTests('vitest',r,project);
 assert.equal(r.numTotalTests,5547);assert.equal(rows.length,5547);assert.equal(new Set(rows.map(t=>t.id)).size,5547);
 const work=join(scratch,'replay');mkdirSync(join(work,'.pandacorp/run'),{recursive:true});const input=join(work,'native.json');copyFileSync(source,input);
 // Preserve all real test data; only relocate absolute file paths to the disposable root.
 const portable={...r,testResults:r.testResults.map(s=>({...s,name:join(work,s.name.slice(project.length+1))}))};writeFileSync(input,JSON.stringify(portable));
 const proof=classProof(r,project,input+'.errors.json');assert.deepEqual(proof.tests.map(t=>t.id),rows.map(t=>t.id));
 // Synthetic full-report envelope only for this data replay, never a gate/stamp/owner baseline.
 const envelope={scope:'full',green:true,subgates:[{name:'vitest',exit:0},{name:'playwright',exit:0}],test_id_encoding:policy.TEST_ID_ENCODING,test_timings:rows};
 writeFileSync(join(work,'.pandacorp/run/gate-report.json'),JSON.stringify(envelope));
 const baseline=spawnSync(process.execPath,[join(root,'plugin/scripts/gate-budget-baseline.mjs'),work,'--from',input],{encoding:'utf8'});assert.equal(baseline.status,0,baseline.stderr);
 const b=JSON.parse(readFileSync(join(work,'.pandacorp/gate-budget.json')));assert.equal(Object.keys(b.baseline).length,5547);policy.checkBudget(work,rows);
 const result=spawnSync(process.execPath,[join(root,'plugin/templates/shared/.pandacorp/test-gate-policy.mjs'),'evaluate',work,'vitest',input,'0'],{env:{...process.env,PANDACORP_GATE_FULL:'1'},encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 console.log('REAL CORPUS: 5547 inventory / 5547 unique ids / policy + class + baseline accepted / 0 errors');
});
