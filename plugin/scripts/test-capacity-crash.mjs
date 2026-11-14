#!/usr/bin/env node
// Port of the reviewer's adversarial-crash.py plus crash boundaries around the durable barrier.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { withAppendLock } from '../runtime/build/fsx.mjs';
const script = fileURLToPath(new URL('./codex-worker.mjs', import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const live = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
let passed = 0, failed = 0;
for (const boundary of ['reviewer-write', 'before-runner', 'after-runner', 'after-commit', 'runner-death', 'dead-monitor', 'stale-monitor', 'after-watch-spawn']) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'capacity-crash-'));
  const wd = path.join(tmp, '.pandacorp/run/codex-workers/w1');
  let providerPids = [], runnerPid;
  try {
    await fs.mkdir(wd, {recursive:true});
    const fake = path.join(tmp, 'fake.mjs'), pre = path.join(tmp, 'crash.mjs'), capture = path.join(tmp, 'capture.jsonl');
    await fs.writeFile(fake, '#!/usr/bin/env node\nimport fs from "node:fs";fs.appendFileSync(process.env.CAPTURE,JSON.stringify({pid:process.pid,args:process.argv.slice(2)})+"\\n");setTimeout(()=>{},20000);\n', {mode:0o755});
    await fs.writeFile(pre, `import fs from 'node:fs';import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
const write=fs.writeFileSync, rename=fs.renameSync, spawn=cp.spawn;
fs.writeFileSync=function(p,data,...rest){if(${JSON.stringify(boundary)}==='reviewer-write' && String(p).endsWith('state.json') && String(data).includes('resumeSequence'))process.exit(77);return write.call(this,p,data,...rest)};
cp.spawn=function(...args){if(${JSON.stringify(boundary)}==='before-runner' && args[1]?.includes('continue-provider'))process.exit(77);const r=spawn.apply(this,args);if(${JSON.stringify(boundary)}==='after-watch-spawn' && args[1]?.includes('watch'))process.exit(77);return r};
fs.renameSync=function(a,b){if(String(b)===${JSON.stringify(path.join(wd,'state.json'))}) {if(${JSON.stringify(boundary)}==='after-runner')process.exit(77);const r=rename.call(this,a,b);if(${JSON.stringify(boundary)}==='after-commit')process.exit(77);return r;}return rename.call(this,a,b);};syncBuiltinESMExports();\n`);
    await fs.writeFile(path.join(wd,'state.json'),JSON.stringify({pid:99999999,cwd:tmp,tool:'codex',model:'gpt-6.1-sol',effort:'low',direct:true,sessionId:'thread-1',access:'sandbox',...(['after-commit','dead-monitor','stale-monitor','after-watch-spawn'].includes(boundary)?{watchdog:{'start-hang-s':2,'stall-s':2,'cap-s':2}}:{})}));
    await fs.writeFile(path.join(wd,'exit'),'1'); await fs.writeFile(path.join(wd,'result.line'),'old limit');
    const env = {...process.env, PANDACORP_CODEX_BIN:fake,CAPTURE:capture,CODEX_HOME:path.join(tmp,'codex'),PANDACORP_CAPACITY_DIR:path.join(tmp,'capacity')};
    const args = [script,'resume','--project',tmp,'--id','w1','--resume-sequence','1'];
    const first = spawnSync(process.execPath,['--import',pre,...args],{env,encoding:'utf8',timeout:15000});
    assert.equal(first.status,['reviewer-write','runner-death','dead-monitor','stale-monitor'].includes(boundary)?0:77,first.stderr);
    const committed=JSON.parse(await fs.readFile(path.join(wd,'state.json'),'utf8'));
    // Two reclaimers compete after the launcher died. At most one runner/provider is adopted.
    const results = await Promise.all([1,2].map(() => new Promise(resolve => {
      const child=spawn(process.execPath,args,{env,stdio:['ignore','pipe','pipe']});let err='';child.stderr.on('data',x=>err+=x);child.once('exit',code=>resolve({code,err}));
    })));
    for (const r of results) assert.equal(r.code,0,r.err);
    for(let i=0;i<100;i++){if(await fs.stat(capture).catch(()=>null))break;await sleep(20);}
    await sleep(100);
    const rows=(await fs.readFile(capture,'utf8')).trim().split('\n').map(JSON.parse);
    providerPids=rows.map(r=>r.pid);runnerPid=JSON.parse(await fs.readFile(path.join(wd,'state.json'),'utf8')).pid;
    assert.equal(rows.length,1,'exactly one provider continuation');assert.equal(providerPids.filter(live).length,1);
    assert.ok(live(runnerPid),'runner remains alive until provider exit');
    const readArgs=[script,'read','--project',tmp,'--id','w1'];
    assert.match(spawnSync(process.execPath,readArgs,{env,encoding:'utf8'}).stdout,/CODEX-RUNNING/);
    if(boundary==='runner-death') {
      process.kill(runnerPid,'SIGKILL');await sleep(100);
      const next=spawnSync(process.execPath,[...args.slice(0,-1),'2'],{env,encoding:'utf8'});
      assert.match(next.stdout,/still-running/,'orphaned provider group must block another sequence');
      assert.match(spawnSync(process.execPath,readArgs,{env,encoding:'utf8'}).stdout,/CODEX-RUNNING/,'read cannot seal a live orphan as failed');
    }

    assert.ok(rows.every(r=>r.args.includes('thread-1')),'original provider session preserved');
    const repeat=spawnSync(process.execPath,args,{env,encoding:'utf8',timeout:10000});assert.equal(repeat.status,0,repeat.stderr);
    assert.equal((await fs.readFile(capture,'utf8')).trim().split('\n').length,1,'completed-call idempotence');
    if(boundary==='stale-monitor') {
      const current=JSON.parse(await fs.readFile(path.join(wd,'state.json'),'utf8'));
      const later={...current,resumeSequence:2};
      await withAppendLock(path.join(wd,'resume'),fs,async()=>fs.writeFile(path.join(wd,'state.json'),JSON.stringify(later)));
      // A delayed monitor candidate for seq1 must not adopt seq2, even with the same PID/start time.
      const stale=spawnSync(process.execPath,[script,'watch','--project',tmp,'--id','w1','--worker-pid',String(current.pid),'--resume-sequence','1','--worker-started-at',current.startedAt,'--cap-s','0.1'],{env,encoding:'utf8',timeout:5000});
      assert.equal(stale.status,0,stale.stderr);
      await sleep(Math.max(0,Date.parse(current.startedAt)+2200-Date.now()));
      assert.equal(providerPids.filter(live).length,1,'old monitor cannot kill a later sequence');
      assert.equal(await fs.stat(path.join(wd,'watchdog.json')).catch(()=>null),null,'old monitor cannot write later watchdog marker');
      assert.equal(await fs.stat(path.join(wd,'exit')).catch(()=>null),null,'old monitor cannot write later terminal exit');
    }
    if(['after-commit','dead-monitor','after-watch-spawn'].includes(boundary)) {
      if(boundary==='dead-monitor') {
        const owner=JSON.parse(await fs.readFile(path.join(wd,'continuations/1/watchdog-owner.json'),'utf8'));
        const current=JSON.parse(await fs.readFile(path.join(wd,'state.json'),'utf8'));
        process.kill(owner.pid,'SIGKILL');
        await sleep(Math.max(0,Date.parse(current.startedAt)+2200-Date.now()));
        const repaired=spawnSync(process.execPath,args,{env,encoding:'utf8',timeout:10000});assert.equal(repaired.status,0,repaired.stderr);
      }
      for(let i=0;i<(boundary==='dead-monitor'?30:100);i++){if(await fs.stat(path.join(wd,'watchdog.json')).catch(()=>null))break;await sleep(50);}
      const stopped=JSON.parse(await fs.readFile(path.join(wd,'watchdog.json'),'utf8'));
      assert.ok(['cap','start-hang'].includes(stopped.kind),'recovered watchdog enforces saved timeout');
      for(let i=0;i<40 && providerPids.some(live);i++)await sleep(50);
      assert.equal(providerPids.filter(live).length,0,'silent continuation cannot survive its saved deadline');
      assert.equal(JSON.parse(await fs.readFile(path.join(wd,'state.json'),'utf8')).startedAt,committed.startedAt,'retry never restarts the deadline');
      assert.equal((await fs.readFile(capture,'utf8')).trim().split('\n').length,1,'timeout recovery never duplicates the provider');
    }

    passed++;console.log(`PASS crash ${boundary}: single provider/session, idempotent recovery${['after-commit','dead-monitor','after-watch-spawn'].includes(boundary)?', saved timeout enforced':boundary==='stale-monitor'?', stale monitor fenced':''}`);
  } catch(e) {failed++;console.error(`FAIL crash ${boundary}: ${e.stack}`);}
  finally {
    try { runnerPid ??= JSON.parse(await fs.readFile(path.join(wd,'continuations/1/runner.json'),'utf8')).pid; } catch {}
    try { providerPids.push(...(await fs.readFile(path.join(tmp,'capture.jsonl'),'utf8')).trim().split('\n').map(x=>JSON.parse(x).pid)); } catch {}
    for(const pid of providerPids) try {process.kill(pid,'SIGTERM');} catch {}
    if(runnerPid) try {process.kill(-runnerPid,'SIGTERM');} catch {}
    await sleep(100);
    await fs.rm(tmp,{recursive:true,force:true});
  }
}
console.log(`RESULT ${passed} passed, ${failed} failed`);process.exitCode=failed?1:0;
