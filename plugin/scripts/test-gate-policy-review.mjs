#!/usr/bin/env node
// Regressions from the independent phase-3 review, using only disposable repositories.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import * as policy from '../templates/shared/.pandacorp/test-gate-policy.mjs';
const scratch = mkdtempSync(join(tmpdir(),'p43-review-'));
after(()=>rmSync(scratch,{recursive:true,force:true}));
const root = resolve(import.meta.dirname,'../..');
const git = (dir,...args)=>execFileSync('git',['-C',dir,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const init = dir=>{mkdirSync(dir,{recursive:true});git(dir,'init','-q','-b','main');git(dir,'config','user.name','Fixture');git(dir,'config','user.email','fixture@example.invalid');git(dir,'config','commit.gpgsign','false');};
const commit = dir=>{git(dir,'add','.');git(dir,'commit','--allow-empty','-qm','fixture');};
const keys=generateKeyPairSync('ed25519'), rogue=generateKeyPairSync('ed25519');
const factory=join(scratch,'factory'), project=join(scratch,'project');
init(factory);mkdirSync(join(factory,'factory/owner-keys'),{recursive:true});
writeFileSync(join(factory,'factory/owner-keys/exclusions.pub'),keys.publicKey.export({type:'spki',format:'pem'}));commit(factory);
init(project);mkdirSync(join(project,'.pandacorp/run'),{recursive:true});
writeFileSync(join(project,'.gitignore'),'.pandacorp/run/\n');
writeFileSync(join(project,'package.json'),' {"name":"mission-control"}');
writeFileSync(join(project,'.pandacorp/status.yaml'),'phase: release\ndeploy_target: internal\n');
writeFileSync(join(project,'.pandacorp/guide.md'),'- Factory: `'+factory+'`\n');
const id='a.spec.ts > a.spec.ts > broken [desktop]';
const entry={id,reason:'fixture',authorized_by:'owner',authorized_at:new Date().toISOString().slice(0,10),expires:new Date(Date.now()+86400000).toISOString().slice(0,10)};
const signed = key=>({...entry,authorization:'tty-v1:'+sign(null,Buffer.from(policy.binding(entry)),key.privateKey).toString('base64')});
function setPolicy(key,dir=project){writeFileSync(join(dir,'.pandacorp/test-exclusions.json'),JSON.stringify([signed(key)]));writeFileSync(join(dir,'.pandacorp/exclusion-owner.pub'),key.publicKey.export({type:'spki',format:'pem'}));commit(dir);}
setPolicy(keys);
writeFileSync(join(project,'.pandacorp/run/test-outcomes.jsonl'),['passed','failed'].map((status,i)=>JSON.stringify({v:1,project,runner:'playwright',tree:'a'.repeat(40),test_id:id,status,seed:1,worker:0,attempt:String(i),ts:new Date().toISOString()})).join('\n')+'\n');
const browser = ()=>({errors:[],stats:{expected:0,unexpected:1,skipped:0,flaky:0},suites:[{title:'a.spec.ts',specs:[{file:'a.spec.ts',title:'broken',tests:[{projectName:'desktop',expectedStatus:'passed',status:'unexpected',results:[{status:'failed',duration:1,retry:0}]}]}]}]});
const evaluate = report=>{const file=join(project,'.pandacorp/run/browser.json');writeFileSync(file,JSON.stringify(report));return spawnSync(process.execPath,[join(root,'plugin/templates/shared/.pandacorp/test-gate-policy.mjs'),'evaluate',project,'playwright',file,'1'],{encoding:'utf8'});};
test('1: a committed branch key cannot authorize its own exclusions',()=>{setPolicy(rogue);try{assert.throws(()=>policy.loadExclusions(project),/pinned|factory|signature|authorization/i);}finally{setPolicy(keys);}});
test('1: factory working-tree key replacement has no effect on committed main pin',()=>{writeFileSync(join(factory,'factory/owner-keys/exclusions.pub'),rogue.publicKey.export({type:'spki',format:'pem'}));try{assert.equal(policy.loadExclusions(project).length,1);}finally{git(factory,'restore','.');}});
test('1: a changed branch guide cannot redirect trust to an attacker factory',()=>{const branch=join(scratch,'branch');git(project,'worktree','add','-qb','evaluated',branch);const attacker=join(scratch,'attacker');init(attacker);mkdirSync(join(attacker,'factory/owner-keys'),{recursive:true});writeFileSync(join(attacker,'factory/owner-keys/exclusions.pub'),rogue.publicKey.export({type:'spki',format:'pem'}));commit(attacker);writeFileSync(join(branch,'.pandacorp/guide.md'),'- Factory: `'+attacker+'`\n');setPolicy(rogue,branch);try{assert.throws(()=>policy.loadExclusions(branch),/pinned|factory|signature|authorization/i);}finally{git(project,'worktree','remove',branch);}});
test('1: Git environment redirects cannot replace the trusted main key',()=>{
 const expected=policy.ownerPublicKey(project).fingerprint;
 const old=Object.fromEntries(['GIT_DIR','GIT_WORK_TREE','GIT_NAMESPACE','GIT_CONFIG_COUNT','GIT_CONFIG_KEY_0','GIT_CONFIG_VALUE_0'].map(k=>[k,process.env[k]]));
 Object.assign(process.env,{GIT_DIR:join(scratch,'attacker/.git'),GIT_WORK_TREE:join(scratch,'attacker'),GIT_NAMESPACE:'rogue',GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'core.worktree',GIT_CONFIG_VALUE_0:join(scratch,'attacker')});
 try{assert.equal(policy.ownerPublicKey(project).fingerprint,expected);}finally{for(const [key,value] of Object.entries(old))if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
test('1: signing is macOS-only, uses the Keychain and rejects a different stored key',async()=>{
 const source=readFileSync(join(root,'plugin/scripts/authorize-exclusion.mjs'),'utf8');assert.match(source,/export function signWithKeychain/);assert.doesNotMatch(source,/exclusion-owner-key\.pem/);
 const auth=await import('./authorize-exclusion.mjs');const calls=[];
 const runSecurity=args=>{calls.push(args);return Buffer.from(keys.privateKey.export({type:'pkcs8',format:'pem'})).toString('base64');};
 const pinned=keys.publicKey.export({type:'spki',format:'pem'});
 assert.throws(()=>auth.signWithKeychain(entry,pinned,{platform:'linux',runSecurity}),/macOS/);assert.equal(calls.length,0);
 assert.match(auth.signWithKeychain(entry,pinned,{platform:'darwin',runSecurity}),/^tty-v1:/);assert(calls[0].includes('find-generic-password'));assert(calls[0].includes('-w'));
 assert.throws(()=>auth.signWithKeychain(entry,pinned,{platform:'darwin',runSecurity:()=>Buffer.from(rogue.privateKey.export({type:'pkcs8',format:'pem'})).toString('base64')}),/pinned|factory/i);
 assert.throws(()=>auth.signWithKeychain(entry,pinned,{platform:'darwin',runSecurity:()=>{throw Error('denied');}}),/Keychain/);
 assert.match(source,/'-T',\s*''/);
 const bootstrap=join(scratch,'bootstrap');init(bootstrap);commit(bootstrap);const writes=[];
 auth.bootstrapOwnerKey(bootstrap,{platform:'darwin',runSecurity:args=>{writes.push(args);return '';}});
 assert.equal(writes[0][0],'add-generic-password');assert.equal(writes[0][writes[0].indexOf('-T')+1],'');assert(!writes[0].includes('-A'));assert(!writes[0].includes('-U'));
 assert.match(readFileSync(join(bootstrap,'factory/owner-keys/exclusions.pub'),'utf8'),/BEGIN PUBLIC KEY/);
 assert.throws(()=>auth.bootstrapOwnerKey(bootstrap,{platform:'darwin',runSecurity:()=>{throw Error('must not replace');}}),/already exists/);
});
test('2: an empty results array cannot silently remove an undeclared test',()=>{const r=browser();r.suites[0].specs.push({file:'a.spec.ts',title:'not run',tests:[{projectName:'desktop',expectedStatus:'passed',status:'skipped',results:[]}]});r.stats.skipped++;assert.notEqual(evaluate(r).status,0);});
for(const [name,edit] of [
 ['suite without inventory',r=>r.suites.push({title:'lost.spec.ts'})],
 ['undefined test title',r=>delete r.suites[0].specs[0].title],
 ['undefined test file',r=>delete r.suites[0].specs[0].file],
 ['undefined project identity',r=>delete r.suites[0].specs[0].tests[0].projectName],
 ['empty tests collection',r=>r.suites[0].specs[0].tests=[]],
 ['summary count mismatch',r=>r.stats.unexpected=9],
 ['duplicate identity',r=>r.suites[0].specs.push(structuredClone(r.suites[0].specs[0]))],
]) test('2: reject '+name,()=>{const r=browser();edit(r);assert.throws(()=>policy.reporterTests('playwright',r,project));});
test('2: Vitest total inventory must agree and identities cannot be undefined',()=>{const r={numTotalTests:2,numPassedTests:1,numFailedTests:0,numPendingTests:0,numTodoTests:0,testResults:[{name:'a.test.ts',assertionResults:[{fullName:'one',status:'passed',duration:1}]}]};assert.throws(()=>policy.reporterTests('vitest',r,project));r.numTotalTests=1;delete r.testResults[0].assertionResults[0].fullName;assert.throws(()=>policy.reporterTests('vitest',r,project));});
test('3: an intentionally skipped browser test does not veto another valid exclusion',()=>{const r=browser();r.suites[0].specs.push({file:'a.spec.ts',title:'declared skip',tests:[{projectName:'desktop',expectedStatus:'skipped',status:'skipped',results:[{status:'skipped',duration:0,retry:0}]}]});r.stats.skipped++;const result=evaluate(r);assert.equal(result.status,0,result.stderr);});
test('3: Vitest declared skip passes while an unexecuted task is rejected by runner proof',()=>{
 const file='src/_tests/a.test.ts', testId=file+' > group broken';
 const e={...entry,id:testId};e.authorization='tty-v1:'+sign(null,Buffer.from(policy.binding(e)),keys.privateKey).toString('base64');
 writeFileSync(join(project,'.pandacorp/test-exclusions.json'),JSON.stringify([e]));commit(project);
 appendFileSync(join(project,'.pandacorp/run/test-outcomes.jsonl'),['passed','failed'].map((status,i)=>JSON.stringify({v:1,project,runner:'vitest',tree:'a'.repeat(40),test_id:testId,status,seed:1,worker:0,attempt:String(i),ts:new Date().toISOString()})).join('\n')+'\n');
 const r={numTotalTests:2,numPassedTests:0,numFailedTests:1,numPendingTests:1,numTodoTests:0,testResults:[{name:file,assertionResults:[{fullName:'group broken',status:'failed',duration:1},{fullName:'group later',status:'skipped',duration:0}]}]};
 const path=join(project,'.pandacorp/run/vitest-review.json');writeFileSync(path,JSON.stringify(r));
 const suite={type:'suite',name:'group',tasks:[]};
 const broken={type:'test',name:'broken',mode:'run',result:{state:'fail'},suite};
 const later={type:'test',name:'later',mode:'skip',suite};suite.tasks=[broken,later];
 const module={moduleId:join(root,file),task:{tasks:[suite]}};
 const old=process.env.PANDACORP_VITEST_ERRORS_FILE;process.env.PANDACORP_VITEST_ERRORS_FILE=path+'.errors.json';
 const runProof=()=>{const reporter=new policy.default();reporter.onTestRunStart([{}]);reporter.onTestModuleCollected(module);reporter.onTestRunEnd([module],[],'failed');};
 const run=()=>spawnSync(process.execPath,[join(root,'plugin/templates/shared/.pandacorp/test-gate-policy.mjs'),'evaluate',project,'vitest',path,'1'],{encoding:'utf8'});
 try {
   runProof();const allowed=run();assert.equal(allowed.status,0,allowed.stderr);
   later.mode='run';runProof();assert.notEqual(run().status,0);
   later.result={state:'skip',note:'cancelled'};runProof();assert.notEqual(run().status,0);
   later.result={state:'skip',pending:true};runProof();assert.equal(run().status,0);
   delete later.result;
   later.mode='skip';runProof();const proof=JSON.parse(readFileSync(path+'.errors.json'));proof.reason='interrupted';writeFileSync(path+'.errors.json',JSON.stringify(proof));assert.notEqual(run().status,0);
 } finally {if(old===undefined)delete process.env.PANDACORP_VITEST_ERRORS_FILE;else process.env.PANDACORP_VITEST_ERRORS_FILE=old;setPolicy(keys);}
});
test('3: interrupted result remains red',()=>{const r=browser();r.suites[0].specs[0].tests[0].results[0].status='interrupted';assert.notEqual(evaluate(r).status,0);});
test('4: valid legacy stage budget captures timings before schema 1 is enforced',()=>{writeFileSync(join(project,'.pandacorp/gate-budget.json'),'{"stages":{"vitest":55000,"playwright":432000},"margin":0.25}');try{assert.doesNotThrow(()=>policy.checkBudget(project,[{id:'new',runner:'vitest',duration_ms:50000}]));}finally{rmSync(join(project,'.pandacorp/gate-budget.json'));}});
test('5: owner prohibition is in the actual managed upgrade projection',()=>{const template=readFileSync(join(root,'plugin/templates/shared/AGENTS.md.tpl'),'utf8');const managed=template.split('<!-- pandacorp:managed:start -->')[1].split('<!-- pandacorp:managed:end -->')[0];assert.match(managed,/replace the owner public key/);});

// Re-review P2: the real gate's passWithNoTests command must agree with policy evaluation.
test('partial no-related-tests: empty and populated exclusion policies allow a coherent green scoped run',()=>{
 for (const dir of ['bin','src','e2e']) mkdirSync(join(project,dir),{recursive:true});
 writeFileSync(join(project,'src/no-related.ts'),'export const value = 1;\n');
 for (const name of ['smoke','visual','responsive','shell','headers']) writeFileSync(join(project,'e2e',name+'.spec.ts'),'');
 writeFileSync(join(project,'playwright.config.ts'),'');
 for (const name of ['green-stamp.sh','test-gate-policy.mjs']) writeFileSync(join(project,'.pandacorp',name),readFileSync(join(root,'plugin/templates/shared/.pandacorp',name)));
 writeFileSync(join(project,'.pandacorp/verify.sh'),readFileSync(join(root,'plugin/templates/stack-a-nextjs/verify.sh')));
 writeFileSync(join(project,'bin/pnpm'),`#!/usr/bin/env node
const fs=require('fs'),args=process.argv.slice(2);
if(args[0]==='vitest'){
 const file=args.find(a=>a.startsWith('--outputFile='))?.slice(13);
 if(file){
  fs.writeFileSync(file,JSON.stringify({success:true,numTotalTestSuites:0,numPassedTestSuites:0,numFailedTestSuites:0,numPendingTestSuites:0,numTotalTests:0,numPassedTests:0,numFailedTests:0,numPendingTests:0,numTodoTests:0,testResults:[]}));
  fs.writeFileSync(process.env.PANDACORP_VITEST_ERRORS_FILE,JSON.stringify({reason:'passed',plannedModules:0,completedModules:0,tests:[],unhandledErrors:[]}));
 }
}else if(args[0]==='exec' && args[1]==='playwright'){
 fs.writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE,JSON.stringify({errors:[],stats:{expected:1,unexpected:0,skipped:0,flaky:0},suites:[{title:'smoke.spec.ts',specs:[{file:'smoke.spec.ts',title:'renders',tests:[{projectName:'desktop',expectedStatus:'passed',status:'expected',results:[{status:'passed',duration:1}]}]}]}]}));
}
`);chmodSync(join(project,'bin/pnpm'),0o755);
 const run=args=>spawnSync('bash',['.pandacorp/verify.sh',...args],{cwd:project,env:{...process.env,PATH:join(project,'bin')+':'+process.env.PATH,PANDACORP_HOST_DIR:join(scratch,'host')},encoding:'utf8'});
 for(const populated of [false,true]){
  if(populated)setPolicy(keys);else{writeFileSync(join(project,'.pandacorp/test-exclusions.json'),'[]');commit(project);}
  const result=run(['--files','src/no-related.ts']);assert.equal(result.status,0,result.stdout+result.stderr);
  const report=JSON.parse(readFileSync(join(project,'.pandacorp/run/gate-report.json')));
  assert.equal(report.scope,'partial');assert.equal(report.green,true);assert.equal(report.subgates.find(g=>g.name==='vitest').exit,0);
  assert(!existsSync(join(project,'.pandacorp/run/green-stamp')));
 }
 const explicit=run(['--only=vitest','--tests=src/not-found.test.ts']);assert.equal(explicit.status,0,explicit.stdout+explicit.stderr);
 for(const args of [['--only=vitest'],[]]){
  const result=run(args);assert.notEqual(result.status,0,'zero inventory must fail without passWithNoTests authorization: '+args);
  const report=JSON.parse(readFileSync(join(project,'.pandacorp/run/gate-report.json')));assert.equal(report.green,false);assert.equal(report.scope,args.length?'partial':'full');assert(!existsSync(join(project,'.pandacorp/run/green-stamp')));
 }
});
test('partial empty inventory: red exits, incoherent summaries and interrupted proofs remain red',()=>{
 const file=join(project,'.pandacorp/run/empty.json');
 const base={success:true,numTotalTestSuites:0,numPassedTestSuites:0,numFailedTestSuites:0,numPendingTestSuites:0,numTotalTests:0,numPassedTests:0,numFailedTests:0,numPendingTests:0,numTodoTests:0,testResults:[]};
 const proof={reason:'passed',plannedModules:0,completedModules:0,tests:[],unhandledErrors:[]};
 const run=(report,sidecar,rc='0',full='0',flag='--allow-empty-partial')=>{
  writeFileSync(file,JSON.stringify(report));writeFileSync(file+'.errors.json',JSON.stringify(sidecar));
  return spawnSync(process.execPath,[join(project,'.pandacorp/test-gate-policy.mjs'),'evaluate',project,'vitest',file,rc,flag],{env:{...process.env,PANDACORP_GATE_FULL:full},encoding:'utf8'});
 };
 assert.equal(run(base,proof).status,0);
 for(const [r,p,rc,full,flag] of [[base,proof,'1','0','--allow-empty-partial'],[{...base,success:false},proof,'0','0','--allow-empty-partial'],[{...base,numTotalTests:1},proof,'0','0','--allow-empty-partial'],[{...base,numTotalTestSuites:1},proof,'0','0','--allow-empty-partial'],[{...base,numFailedTestSuites:1},proof,'0','0','--allow-empty-partial'],[base,{...proof,reason:'interrupted'},'0','0','--allow-empty-partial'],[base,proof,'0','1','--allow-empty-partial'],[base,proof,'0','0','']]) assert.notEqual(run(r,p,rc,full,flag).status,0);
 assert.throws(()=>policy.reporterTests('vitest',base,project),/empty/);
});
