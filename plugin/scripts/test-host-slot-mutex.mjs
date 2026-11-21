// P43 independent-review regression: an ABA reclaimer must not move a live holder.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { acquireHostSlot } from '../runtime/build/admission/hostSlots.mjs';
const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'p43-slot-mutex-'));
const factory = fileURLToPath(new URL('../../', import.meta.url));
try {
  const host = path.join(dir, 'host'), root = path.join(host, 'h-slots'), slot = path.join(root, 'slot-0');
  fs.mkdirSync(slot, { recursive: true });
  fs.writeFileSync(path.join(slot, 'owner.json'), JSON.stringify({ pid: 2147483647, token: 'dead' }));
  let raced = false, replacement = null, third = null;
  const intercepted = { ...fs, renameSync(from, to) {
    if (from === slot && !raced) {
      raced = true;
      replacement = acquireHostSlot({ host, max: 1, kind: 'g2', project: dir, mutexTimeoutMs: 0 });
      const result = fs.renameSync(from, to);
      third = acquireHostSlot({ host, max: 1, kind: 'g2', project: dir, mutexTimeoutMs: 0 });
      return result;
    }
    return fs.renameSync(from, to);
  } };
  const handle = acquireHostSlot({ host, max: 1, kind: 'g2', project: dir, fs: intercepted });
  assert.equal(replacement, null, 'a contender entered admission while the reclaimer was inspecting/renaming');
  assert.equal(third, null, 'a third holder entered the detached-name window');
  assert.ok(handle, 'the serialized reclaimer must take the only slot');
  assert.equal(JSON.parse(fs.readFileSync(path.join(slot, 'owner.json'))).token, handle.token);
  assert.equal(handle.release(), true);
  console.log('PASS original Node ABA interleaving is serialized');

  // A Node critical section must exclude BOTH shipped shell reclaimers as well.
  const { withHostSlotMutex } = await import('../runtime/build/admission/hostSlotMutex.mjs');
  withHostSlotMutex(root, () => {
    const script = `import pathlib, subprocess, sys
queue=pathlib.Path(sys.argv[1]).read_text().split("<<'SLOTPY'\\n",1)[1].split('\\nSLOTPY',1)[0]
verify=pathlib.Path(sys.argv[2]).read_text().split("<<'SLOTPY'\\n",1)[1].split('\\nSLOTPY',1)[0]
q=subprocess.run(['python3','-c',queue,'acquire',sys.argv[3],'1',str(__import__('os').getpid()),sys.argv[4]],capture_output=True,text=True)
v=subprocess.run(['python3','-c',verify,'acquire',str(__import__('os').getpid()),''],capture_output=True,text=True)
assert q.returncode==75, (q.returncode,q.stdout,q.stderr)
assert v.returncode==16, (v.returncode,v.stdout,v.stderr)
`;
    const result = spawnSync('python3', ['-c', script, path.join(factory,'plugin/templates/shared/.pandacorp/merge-queue.sh'), path.join(factory,'plugin/templates/stack-a-nextjs/verify.sh'), root, dir], {
      encoding: 'utf8', env: { ...process.env, PANDACORP_HOST_DIR: host, PANDACORP_HOST_MUTEX_WAIT_S: '0', PANDACORP_HOST_SLOT_WAIT_S: '0' }, timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(slot), false, 'shell bypassed the Node mutex');
  });
  console.log('PASS shared Node/queue/verify mutex excludes all three admissions');

  const lock = path.join(root, '.admission.lock');
  fs.mkdirSync(lock);
  fs.writeFileSync(path.join(lock, 'owner-2147483647-dead.json'), '{}');
  const reclaimed = acquireHostSlot({ host, max: 1, kind: 'g2', project: dir });
  assert.ok(reclaimed, 'dead mutex owner was not reclaimed');
  reclaimed.release();
  assert.equal(fs.existsSync(lock), false);
  console.log('PASS dead mutex reclaim and release');

  // Real processes exercise the shared guard in both directions, not just a Node mock.
  const worker = path.join(dir, 'worker.mjs');
  fs.writeFileSync(worker, `import fs from 'node:fs'; import assert from 'node:assert/strict';
import {acquireHostSlot} from ${JSON.stringify(new URL('../runtime/build/admission/hostSlots.mjs', import.meta.url).href)};
const host=process.argv[2];
for(let i=0;i<5;i++){
 let h;const end=Date.now()+10000;
 while(!(h=acquireHostSlot({host,max:1,kind:'g2',project:host}))){if(Date.now()>end)throw Error('admission timeout');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);}
 assert.equal(fs.readdirSync(host+'/h-slots').filter(n=>n.startsWith('slot-')).length,1);
 Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);
 assert.equal(h.release(),true);
}`);
  const python = String.raw`
import json, os, pathlib, signal, subprocess, sys, time
factory, host, worker, mode = sys.argv[1:]
root = pathlib.Path(host) / 'h-slots'
env = dict(os.environ, PANDACORP_HOST_DIR=host, PANDACORP_HOST_SLOT_TOKEN='', PANDACORP_HOST_SLOT_WAIT_S='5')
if mode == 'all':
    processes = [subprocess.Popen(['node', worker, host], env=env, start_new_session=True)]
    processes += [subprocess.Popen([sys.executable, __file__, factory, host, worker, m], env=env, start_new_session=True) for m in ['queue','verify']]
    try:
        for p in processes: assert p.wait(timeout=12) == 0
    finally:
        for p in processes:
            if p.poll() is None: os.killpg(p.pid, signal.SIGKILL); p.wait()
else:
    file = 'plugin/templates/shared/.pandacorp/merge-queue.sh' if mode=='queue' else 'plugin/templates/stack-a-nextjs/verify.sh'
    code = (pathlib.Path(factory)/file).read_text().split("<<'SLOTPY'\n",1)[1].split('\nSLOTPY',1)[0]
    if mode=='verify': code = 'import os; os.cpu_count=lambda:1\n'+code
    def invoke(action, owned=''):
        args = [action, str(root) if action=='acquire' else owned.rsplit('|',1)[0], '1' if action=='acquire' else owned.rsplit('|',1)[1], str(os.getpid()), host] if mode=='queue' else [action,str(os.getpid()),owned]
        return subprocess.run([sys.executable,'-c',code,*args],env=env,capture_output=True,text=True)
    for _ in range(5):
        end=time.monotonic()+10
        while True:
            r=invoke('acquire')
            if r.returncode==0: break
            assert r.returncode in (75,16), r.stderr
            assert time.monotonic()<end, r.stderr
            time.sleep(.01)
        owned=r.stdout.strip()
        assert '|' in owned, owned
        assert len(list(root.glob('slot-*')))==1
        time.sleep(.01)
        r=invoke('release',owned)
        assert r.returncode==0, r.stderr
`;
  const stress = path.join(dir,'stress.py'); fs.writeFileSync(stress,python);
  const ran = spawnSync('python3',[stress,factory,host,worker,'all'],{encoding:'utf8',timeout:15000});
  assert.equal(ran.status,0,ran.stderr || ran.stdout);
  assert.equal(fs.readdirSync(root).some(n=>n.startsWith('slot-')),false,'stress leaked an occupied slot');
  console.log('PASS real concurrent Node/queue/verify cap=1 acquisitions and releases');
  console.log('RESULT: 4 passed, 0 failed');

} finally { fs.rmSync(dir, { recursive: true, force: true }); }
