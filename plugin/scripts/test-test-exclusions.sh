#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/queue-test-fixture.sh"
fixture exclusions
cp "$QUEUE_FACTORY/plugin/templates/shared/.pandacorp/test-gate-policy.mjs" "$WT/.pandacorp/"
echo '{"name":"mission-control"}' > "$WT/package.json"
printf 'project: Pandacorp\nphase: release\ndeploy_target: internal\n' > "$WT/.pandacorp/status.yaml"
export POLICY="$QUEUE_FACTORY/plugin/templates/shared/.pandacorp/test-gate-policy.mjs"
node --input-type=module - "$WT" "$APP" <<'JS'
import {writeFileSync,mkdirSync} from 'node:fs';
import {generateKeyPairSync,sign} from 'node:crypto';
import {binding} from './plugin/templates/shared/.pandacorp/test-gate-policy.mjs';
const [wt,rawMain]=process.argv.slice(2), main=rawMain.replace(/\/$/,'');
const entry={id:'src/_tests/a.test.ts > same name',reason:'owner test fixture',authorized_by:'owner',authorized_at:new Date().toISOString().slice(0,10),expires:new Date(Date.now()+86400000).toISOString().slice(0,10)};
const keys=generateKeyPairSync('ed25519');
writeFileSync(wt+'/.pandacorp/exclusion-owner.pub',keys.publicKey.export({type:'spki',format:'pem'}));
writeFileSync(wt+'/.pandacorp/run-fixture-key.pem',keys.privateKey.export({type:'pkcs8',format:'pem'}));
entry.authorization='tty-v1:'+sign(null,Buffer.from(binding(entry)),keys.privateKey).toString('base64');
writeFileSync(wt+'/.pandacorp/test-exclusions.json',JSON.stringify([entry, {...entry,id:'src/_tests/c.test.ts > second',expires:new Date(Date.now()+2*86400000).toISOString().slice(0,10),authorization:'tty-v1:'+sign(null,Buffer.from(binding({...entry,id:'src/_tests/c.test.ts > second',expires:new Date(Date.now()+2*86400000).toISOString().slice(0,10)})),keys.privateKey).toString('base64')}]));
mkdirSync(main+'/.pandacorp/run',{recursive:true});
writeFileSync(main+'/.pandacorp/run/test-outcomes.jsonl',['passed','failed'].flatMap((status,i)=>[entry.id,'src/_tests/c.test.ts > second'].map(test_id=>JSON.stringify({v:1,project:main,tree:'a'.repeat(40),runner:'vitest',test_id,status,seed:1,worker:null,attempt:String(i),ts:new Date().toISOString()}))).join('\n')+'\n');
JS
git -C "$WT" add .; git -C "$WT" commit -qm policy
node --input-type=module - "$WT" "$QUEUE_FACTORY" <<'JS'
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,symlinkSync,unlinkSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {sign} from 'node:crypto';
import {binding,loadExclusions} from './plugin/templates/shared/.pandacorp/test-gate-policy.mjs';
const [wt,factory]=process.argv.slice(2),file=wt+'/.pandacorp/test-exclusions.json';
const original=JSON.parse(readFileSync(file));
const authorize=e=>e.authorization='tty-v1:'+sign(null,Buffer.from(binding(e)),readFileSync(wt+'/.pandacorp/run-fixture-key.pem')).toString('base64');
function commit(){execFileSync('git',['-C',wt,'add','.']);execFileSync('git',['-C',wt,'commit','--allow-empty','-qm','fixture']);}
function reject(edit,pattern){const e=structuredClone(original);edit(e[0]);writeFileSync(file,JSON.stringify(e));commit();assert.throws(()=>loadExclusions(wt),pattern);writeFileSync(file,JSON.stringify(original));commit();}
assert.equal(loadExclusions(wt).length,2);
reject(e=>{e.expires=new Date(Date.parse(e.authorized_at)+15*86400000).toISOString().slice(0,10);authorize(e);},/14 days/);
reject(e=>{e.expires=e.authorized_at;authorize(e);},/expired/);
reject(e=>{e.id='other';authorize(e);},/not a ledger suspect/);
reject(e=>{delete e.authorization;},/authorization/);
reject(e=>{e.authorization='tty-v1:'+binding(e);},/authorization/); // non-interactive public-hash forgery
reject(e=>{e.reason='tamper';},/authorization/);
const status=wt+'/.pandacorp/status.yaml',saved=readFileSync(status,'utf8');
for (const changed of [saved.replace('internal','external'),saved.replace('internal','unknown')]) {writeFileSync(status,changed);commit();assert.throws(()=>loadExclusions(wt),/Mission Control/);}
writeFileSync(status,saved);commit();
writeFileSync(wt+'/package.json','{"name":"another"}');commit();assert.throws(()=>loadExclusions(wt),/Mission Control/);
writeFileSync(wt+'/package.json','{"name":"mission-control"}');commit();
for (const name of ['test-exclusions.json','exclusion-owner.pub']) {
 const path=wt+'/.pandacorp/'+name, bytes=readFileSync(path), target=wt+'/.pandacorp/run/symlink-'+name;
 execFileSync('mkdir',['-p',wt+'/.pandacorp/run']);writeFileSync(target,bytes);unlinkSync(path);symlinkSync(target,path);commit();
 assert.throws(()=>loadExclusions(wt),/regular files/);unlinkSync(path);writeFileSync(path,bytes);commit();
}
const auth=spawnSync('node',[factory+'/plugin/scripts/authorize-exclusion.mjs',original[0].id,'--reason','test'],{cwd:wt,encoding:'utf8',input:'AUTHORIZE\n'});
assert.notEqual(auth.status,0);assert.match(auth.stderr,/interactive TTY/);
const reporter=wt+'/.pandacorp/run/vitest.json';
execFileSync('mkdir',['-p',wt+'/.pandacorp/run']);
const report={testResults:[{name:'src/_tests/a.test.ts',assertionResults:[{fullName:'same name',status:'failed',duration:1}]},{name:'src/_tests/b.test.ts',assertionResults:[{fullName:'same name',status:'passed',duration:1}]}]};
writeFileSync(reporter,JSON.stringify(report));
writeFileSync(reporter+'.errors.json',JSON.stringify({reason:'failed',unhandledErrors:[]}));
const evaluate=()=>spawnSync('node',[wt+'/.pandacorp/test-gate-policy.mjs','evaluate',wt,'vitest',reporter,'1'],{encoding:'utf8'});
assert.equal(evaluate().status,0);
report.testResults[0].message='afterAll exploded';writeFileSync(reporter,JSON.stringify(report));assert.notEqual(evaluate().status,0);
delete report.testResults[0].message;writeFileSync(reporter,JSON.stringify(report));
writeFileSync(reporter+'.errors.json',JSON.stringify({reason:'failed',unhandledErrors:['unhandled rejection']}));assert.notEqual(evaluate().status,0);
writeFileSync(reporter+'.errors.json',JSON.stringify({reason:'failed',unhandledErrors:[]}));
report.testResults[1].assertionResults[0].status='failed';writeFileSync(reporter,JSON.stringify(report));
assert.notEqual(evaluate().status,0); // Identical title in another file is never excluded.
console.log('exclusion validation and exact verdict cases passed');
JS
(cd "$WT" && token=$(bash .pandacorp/green-stamp.sh start) && bash .pandacorp/green-stamp.sh record "$token" && bash .pandacorp/green-stamp.sh check) > "$FX/stamp"
# The stored earliest expiry is bound at record time, not recomputed from current dates.
node - "$WT" <<'JS'
const fs=require('fs'),assert=require('assert/strict'),wt=process.argv[2];
const e=JSON.parse(fs.readFileSync(wt+'/.pandacorp/test-exclusions.json'));
const p=wt+'/.pandacorp/run/green-stamp',stamp=fs.readFileSync(p,'utf8');
assert(stamp.includes('exclusion_expiry='+Date.parse(e[0].expires)/1000+'\n'));
fs.writeFileSync(p,stamp.replace(/^exclusion_expiry=.*$/m,'exclusion_expiry=1'));
JS
if (cd "$WT" && bash .pandacorp/green-stamp.sh check) > "$FX/expiry" 2>&1; then exit 1; fi
grep -q 'exclusion expired' "$FX/expiry"
echo 'RESULT: exclusions cases passed, 0 failed'
