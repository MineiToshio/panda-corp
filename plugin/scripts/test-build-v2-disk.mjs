#!/usr/bin/env node
// DENG: disk lifecycle acceptance uses real isolated git repositories, never the user's homes.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, access, readFile } from 'node:fs/promises';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { createFixture, git, testEnv } from './fixtures/build-v2/make-fixture.mjs';
import * as dirApi from '../runtime/build/lifecycle/buildDir.mjs';
const { gcWorktrees } = dirApi;
import { prepareUnitWorktree, restoreUnitWorktree } from '../runtime/build/units/worktrees.mjs';
import * as worktreeApi from '../runtime/build/integrate/worktrees.mjs';
const { createIntegrationWorktree, cleanupRunWorktrees, removeWorktree } = worktreeApi;
import { buildPaths } from '../runtime/build/paths.mjs';
import { newState, newUnit, writeState } from '../runtime/build/state.mjs';
import { handleEngineFailure } from '../runtime/build/failure/engineFailure.mjs';
import * as buildState from '../runtime/build-state.mjs';
import { finishRun, stopRun } from '../runtime/build/lifecycle/terminate.mjs';
const root = await mkdtemp(path.join(os.tmpdir(), 'deng-disk-'));
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}: ${error.stack}`); } };
const exists = file => access(file).then(() => true, () => false);
const setup = async name => {
  const dir = path.join(root, name); const fx = await createFixture('basic', { dir });
  const deps = { env: testEnv(dir), bootstrap: false };
  const p = buildPaths(fx.root, deps);
  await mkdir(p.build, { recursive: true });
  await createIntegrationWorktree({ project: fx.root, runId: 'r-disk' }, deps);
  await writeFile(p.stateFile, JSON.stringify({ run_id: 'r-disk', status: 'stopped', units: [], jobs: [] }));
  return { fx, deps, p };
};
const stateOf = (c, fields = {}) => newState({ run_id: 'r-disk', epoch: 1, coordinator: 'claude-session', label: 'claude', size: 'feature', scope: { card: null, frds: [], wos: [], out_of_scope: [] }, integration: { branch: c.p.integrationBranch('r-disk'), worktree: c.p.integrationWorktree, base_sha: c.fx.sha }, ...fields });
const refsOf = c => git(c.fx.root, ['for-each-ref', '--format=%(refname)', 'refs/heads/']);
const seedExtra = async c => {
  const wt = await prepareUnitWorktree({ project: c.fx.root, runId: 'r-disk', unit: 'u-done' }, c.deps);
  const assume = c.p.assumeWorktree('q1');
  git(c.fx.root, ['worktree', 'add', '-b', c.p.assumeBranch('r-disk', 'q1'), assume, c.p.integrationBranch('r-disk')]);
  const g2 = path.join(c.p.build, 'g2', `frd-01-alpha-${c.fx.sha}`);
  await mkdir(path.dirname(g2), { recursive: true }); git(c.fx.root, ['worktree', 'add', '--detach', g2, c.fx.sha]);
  const manifests = path.join(c.fx.root, '.pandacorp/run/worktrees'); await mkdir(manifests, { recursive: true });
  await writeFile(path.join(manifests, 'unit.json'), JSON.stringify({ path: wt.worktree }));
  return { wt, assume, g2, manifest: path.join(manifests, 'unit.json') };
};
try {
  await test('DFIX retry never removes a foreign run at the previous attempt path', async () => {
    const c = await setup('foreign-retry');
    const one = await prepareUnitWorktree({ project: c.fx.root, runId: 'r-disk', unit: 'u-retry' }, c.deps);
    git(one.worktree, ['switch', '-c', 'lane/foreign/u-retry']);
    await prepareUnitWorktree({ project: c.fx.root, runId: 'r-disk', unit: 'u-retry', attempt: 2 }, c.deps);
    assert.equal(await exists(one.worktree), true);
  });
  await test('DFIX close refuses detached foreign commits and exact-path mismatches', async () => {
    const c = await setup('foreign-close');
    const detached = c.p.unitWorktree('u-detached');
    git(c.fx.root, ['worktree', 'add', '--detach', detached, 'HEAD']);
    await writeFile(path.join(detached, 'foreign.txt'), 'unique foreign work');
    git(detached, ['add', 'foreign.txt']); git(detached, ['commit', '-m', 'foreign detached work']);
    const sha = git(detached, ['rev-parse', 'HEAD']);
    const wrong = c.p.unitWorktree('u-wrong');
    git(c.fx.root, ['worktree', 'add', '-b', 'lane/r-disk/u-other', wrong, 'HEAD']);
    const result = await cleanupRunWorktrees({ project: c.fx.root, state: stateOf(c, { status: 'stopped' }) }, c.deps);
    assert.equal(await exists(detached), true, JSON.stringify(result));
    assert.equal(git(detached, ['rev-parse', 'HEAD']), sha);
    assert.equal(await exists(wrong), true, JSON.stringify(result));
  });
  await test('DFIX gc keeps foreign-run and detached refusals across both passes', async () => {
    const c = await setup('foreign-gc');
    const wt = c.p.unitWorktree('u-foreign');
    git(c.fx.root, ['worktree', 'add', '-b', 'lane/foreign/u-foreign', wt, 'HEAD']);
    const detached = c.p.unitWorktree('u-detached'); git(c.fx.root, ['worktree', 'add', '--detach', detached, 'HEAD']);
    await writeState(c.fx.root, stateOf(c, { status: 'finished' }), c.deps);
    for (let i = 0; i < 2; i++) {
      const result = await gcWorktrees({ project: c.fx.root }, c.deps);
      assert.equal(await exists(wt), true, JSON.stringify(result));
      assert.equal(await exists(detached), true, JSON.stringify(result));
      assert.ok(result.kept.some(k => k.path === wt));
    }
  });
  await test('DFIX stopped running/admitted native units without a PID stay protected', async () => {
    for (const status of ['running', 'admitted']) {
      const c = await setup(`native-${status}`);
      const wt = await prepareUnitWorktree({ project: c.fx.root, runId: 'r-disk', unit: 'u-native' }, c.deps);
      const unit = newUnit({ id: 'u-native', kind: 'build', state: status, worktree: wt.worktree, worker: { runtime: 'claude', via: 'session', pid: null } });
      const result = await cleanupRunWorktrees({ project: c.fx.root, state: stateOf(c, { status: 'stopped', units: [unit] }) }, c.deps);
      assert.equal(await exists(wt.worktree), true, JSON.stringify(result));
    }
  });
  await test('DFIX gc excludes acquire for the entire removal, then releases its reservation', async () => {
    const c = await setup('lease-race');
    await writeState(c.fx.root, stateOf(c, { status: 'finished' }), c.deps);
    let attempted = false, acquired = null;
    const { defaultExec } = await import('../runtime/build/fsx.mjs');
    try {
      await gcWorktrees({ project: c.fx.root }, { ...c.deps, exec: async (cmd, args, opts) => {
        if (!attempted && cmd === 'git' && args[0] === 'worktree' && args[1] === 'list') {
          attempted = true;
          try { acquired = await buildState.acquire(c.fx.root, { runtime: 'codex', runId: 'other', projectStatus: false }); }
          catch (e) { assert.equal(e.code, 'CONTENDED'); }
        }
        return defaultExec(cmd, args, opts);
      } });
      assert.equal(attempted, true);
      assert.equal(acquired, null, 'acquire must not enter while gc removes worktrees');
    } finally { if (acquired) await buildState.release(c.fx.root, acquired.token, acquired.epoch); }
    const after = await buildState.acquire(c.fx.root, { runtime: 'codex', runId: 'after', projectStatus: false });
    await buildState.release(c.fx.root, after.token, after.epoch);
  });
  await test('FIX2 terminal reservation rereads both run id and epoch after acquisition', async () => {
    const { withRunCleanup } = await import('../runtime/build/lifecycle/cleanup.mjs');
    for (const changed of [{ epoch: 2 }, { run_id: 'replacement' }]) {
      const c = await setup('state-changed-' + Object.keys(changed)[0]);
      const prior = stateOf(c, { status: 'finished' });
      await writeState(c.fx.root, { ...prior, ...changed }, c.deps);
      let entered = false;
      await assert.rejects(withRunCleanup({ project: c.fx.root, state: prior }, () => { entered = true; }, c.deps), { code: 'CONTENDED' });
      assert.equal(entered, false);
      assert.equal(await exists(c.p.integrationWorktree), true);
    }
  });
  await test('FIX2 active snapshot cleanup requires its current epoch and preserves integration', async () => {
    const { removeAllG2Snapshots } = await import('../runtime/build/next/g2.mjs');
    const c = await setup('active-snapshots');
    const lease = await buildState.acquire(c.fx.root, { runtime: 'claude', runId: 'r-disk', projectStatus: false });
    await writeState(c.fx.root, stateOf(c, { epoch: lease.epoch }), c.deps);
    try {
      await assert.rejects(removeAllG2Snapshots({ project: c.fx.root }, c.deps), { code: 'FENCE' });
      await assert.rejects(removeAllG2Snapshots({ project: c.fx.root, epoch: lease.epoch + 1 }, c.deps), { code: 'FENCE' });
      await removeAllG2Snapshots({ project: c.fx.root, epoch: lease.epoch }, c.deps);
      assert.equal(await exists(c.p.integrationWorktree), true);
    } finally { await buildState.release(c.fx.root, lease.token, lease.epoch); }
    await assert.rejects(removeAllG2Snapshots({ project: c.fx.root }, c.deps), { code: 'FENCE' });
  });
  for (const terminal of ['finish', 'stop', 'failure']) {
    for (const winsFirst of [false, true]) {
      await test(`FIX2 ${terminal}: ${winsFirst ? 'prior acquire preserves copies and state' : 'acquire is excluded throughout terminal cleanup'}`, async () => {
        const c = await setup(`terminal-${terminal}-${winsFirst}`);
        const original = await buildState.acquire(c.fx.root, { runtime: 'claude', runId: 'r-disk', projectStatus: false });
        await writeState(c.fx.root, stateOf(c, { epoch: original.epoch }), c.deps);
        let acquired = null, attempted = false, before = null;
        const { defaultExec } = await import('../runtime/build/fsx.mjs');
        const acquire = async () => {
          attempted = true;
          try { acquired = await buildState.acquire(c.fx.root, { runtime: 'codex', runId: 'r-disk', projectStatus: false }); }
          catch (e) { assert.equal(e.code, 'CONTENDED'); }
        };
        const deps = { ...c.deps,
          buildState: { ...buildState, finalizeRelease: async (...args) => {
            await buildState.finalizeRelease(...args);
            if (winsFirst) {
              await acquire();
              await writeState(c.fx.root, stateOf(c, { epoch: acquired.epoch }), c.deps);
              before = await readFile(c.p.stateFile, 'utf8');
            }
          } },
          exec: async (cmd, args, opts) => {
            if (!winsFirst && !attempted && cmd === 'git' && args[0] === 'worktree' && args[1] === 'list') await acquire();
            return defaultExec(cmd, args, opts);
          },
        };
        try {
          const action = () => terminal === 'finish' ? finishRun({ project: c.fx.root, epoch: original.epoch }, deps)
            : terminal === 'stop' ? stopRun({ project: c.fx.root, epoch: original.epoch }, deps)
              : handleEngineFailure({ project: c.fx.root, epoch: original.epoch, error: new Error('fixture fault') }, deps);
          if (winsFirst && terminal !== 'failure') await assert.rejects(action, { code: 'CONTENDED' });
          else {
            const result = await action();
            if (winsFirst) assert.ok(result.warnings.some(w => w.includes('cleanup')));
          }
          assert.equal(attempted, true);
          if (winsFirst) {
            assert.ok(acquired);
            assert.equal(await exists(c.p.integrationWorktree), true);
            assert.equal(await readFile(c.p.stateFile, 'utf8'), before);
          } else assert.equal(acquired, null, 'acquire entered the terminal reservation');
        } finally {
          if (acquired) await buildState.release(c.fx.root, acquired.token, acquired.epoch);
          const held = await buildState.currentLease(c.fx.root);
          if (held?.epoch === original.epoch) await buildState.release(c.fx.root, original.token, original.epoch);
        }
      });
    }
  }
  await test('landing removes finished unit and assume trees but keeps refs and integration', async () => {
    const c = await setup('landing'); const { wt, assume, manifest } = await seedExtra(c); const refs = refsOf(c);
    const state = stateOf(c, { units: [newUnit({ id: 'u-done', kind: 'build', state: 'landed', worktree: wt.worktree })] });
    const clean = await cleanupRunWorktrees({ project: c.fx.root, state, mode: 'landed' }, c.deps);
    assert.equal(clean.kept.length, 0, JSON.stringify(clean)); assert.equal(await exists(wt.worktree), false); assert.equal(await exists(assume), false);
    assert.equal(await exists(c.p.integrationWorktree), true); assert.equal(await exists(manifest), false); assert.equal(refsOf(c), refs);
  });
  await test('finish removes integration unit assume and G2, keeps all branches', async () => {
    const c = await setup('finish'); const { wt } = await seedExtra(c); const refs = refsOf(c);
    await writeState(c.fx.root, stateOf(c, { units: [newUnit({ id: 'u-done', kind: 'build', state: 'landed', worktree: wt.worktree })] }), c.deps);
    await finishRun({ project: c.fx.root, epoch: 1 }, c.deps);
    assert.equal(git(c.fx.root, ['worktree', 'list', '--porcelain']).includes('/.pandacorp/run/'), false); assert.equal(refsOf(c), refs);
    await finishRun({ project: c.fx.root, epoch: 1 }, c.deps);
  });
  await test('waiting_gate finish keeps only integration without .next, branches intact', async () => {
    const c = await setup('waiting'); await seedExtra(c); const refs = refsOf(c);
    await writeFile(path.join(c.fx.root, '.git/info/exclude'), '.next/\n');
    await mkdir(path.join(c.p.integrationWorktree, '.next'), { recursive: true }); await writeFile(path.join(c.p.integrationWorktree, '.next/cache'), 'cache');
    await writeState(c.fx.root, stateOf(c, { units: [newUnit({ id: 'u-gate', kind: 'build', state: 'waiting_gate', waiting_gate: 'production' })] }), c.deps);
    assert.equal((await finishRun({ project: c.fx.root, epoch: 1 }, c.deps)).waiting_gate, true);
    const trees = git(c.fx.root, ['worktree', 'list', '--porcelain']).split('\n').filter(l => l.startsWith('worktree ') && l.includes('/.pandacorp/run/'));
    assert.deepEqual(trees, [`worktree ${c.p.integrationWorktree}`]); assert.equal(await exists(path.join(c.p.integrationWorktree, '.next')), false); assert.equal(refsOf(c), refs);
  });
  await test('stop removes dead checkouts and resume recreates branches with existing reset semantics', async () => {
    const c = await setup('resume'); const wt = await prepareUnitWorktree({ project: c.fx.root, runId: 'r-disk', unit: 'u-resume' }, c.deps);
    await writeFile(path.join(wt.worktree, 'src/alpha/list.ts'), '// unreported engine commit\n'); git(wt.worktree, ['add', 'src/alpha/list.ts']); git(wt.worktree, ['commit', '-m', 'unreported unit output']);
    const unit = newUnit({ id: 'u-resume', kind: 'build', state: 'running', worktree: wt.worktree, branch: wt.branch, worker: { runtime: 'claude', model: 'sonnet', effort: 'high', via: 'session', pid: 99999999, worker_id: null } });
    await writeState(c.fx.root, stateOf(c, { status: 'stopped', units: [unit] }), c.deps); const refs = refsOf(c);
    await stopRun({ project: c.fx.root }, c.deps);
    assert.equal(await exists(wt.worktree), false); assert.equal(await exists(c.p.integrationWorktree), false); assert.equal(refsOf(c), refs);
    const restored = await restoreUnitWorktree({ project: c.fx.root, runId: 'r-disk', unit }, c.deps);
    assert.equal(restored.reset, true); assert.equal(restored.discarded_commits, 1);
    await createIntegrationWorktree({ project: c.fx.root, runId: 'r-disk' }, c.deps);
    assert.equal(git(wt.worktree, ['rev-parse', 'HEAD']), c.fx.sha); assert.equal(refsOf(c), refs);
  });
  await test('engine failure removes clean unit and integration checkouts after lease release', async () => {
    const c = await setup('engine-failure'); const { wt } = await seedExtra(c); const refs = refsOf(c);
    const lease = await buildState.acquire(c.fx.root, { runtime: 'claude', runId: 'r-disk', ttlSeconds: 1800, projectStatus: false });
    await writeState(c.fx.root, stateOf(c, { epoch: lease.epoch, units: [newUnit({ id: 'u-done', kind: 'build', state: 'queued', worktree: wt.worktree })] }), c.deps);
    const result = await handleEngineFailure({ project: c.fx.root, epoch: lease.epoch, cmd: 'next', error: new Error('fixture engine fault') }, c.deps);
    assert.equal(result.released, true); assert.equal(git(c.fx.root, ['worktree', 'list', '--porcelain']).includes('/.pandacorp/run/'), false); assert.equal(refsOf(c), refs);
  });
  await test('attempt n+1 removes a clean previous directory and keeps its branch; dirty previous stays', async () => {
    const c = await setup('attempt'); const one = await prepareUnitWorktree({ project: c.fx.root, runId: 'r-disk', unit: 'u-retry' }, c.deps);
    const two = await prepareUnitWorktree({ project: c.fx.root, runId: 'r-disk', unit: 'u-retry', attempt: 2 }, c.deps);
    assert.equal(await exists(one.worktree), false); assert.ok(refsOf(c).includes(one.branch));
    await writeFile(path.join(two.worktree, 'src/alpha/list.ts'), '// unfinished work\n');
    await prepareUnitWorktree({ project: c.fx.root, runId: 'r-disk', unit: 'u-retry', attempt: 3 }, c.deps);
    assert.equal(await exists(two.worktree), true); assert.ok((await readFile(path.join(two.worktree, 'src/alpha/list.ts'), 'utf8')).includes('unfinished work'));
  });
  await test('shared predicate protects dirty, locked, running-unit and live-cwd trees', async () => {
    const c = await setup('safety'); const wt = await prepareUnitWorktree({ project: c.fx.root, runId: 'r-disk', unit: 'u-safe' }, c.deps);
    await writeFile(path.join(wt.worktree, 'src/alpha/list.ts'), '// dirty\n');
    assert.equal((await removeWorktree({ project: c.fx.root, worktree: wt.worktree }, c.deps)).removed, false);
    git(wt.worktree, ['restore', 'src/alpha/list.ts']); git(c.fx.root, ['worktree', 'lock', wt.worktree]);
    assert.equal((await removeWorktree({ project: c.fx.root, worktree: wt.worktree }, c.deps)).reason, 'locked'); git(c.fx.root, ['worktree', 'unlock', wt.worktree]);
    const state = stateOf(c, { units: [newUnit({ id: 'u-safe', kind: 'build', state: 'running', worktree: wt.worktree })] });
    assert.equal((await removeWorktree({ project: c.fx.root, worktree: wt.worktree, state }, c.deps)).reason, 'running-unit');
    const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { cwd: wt.worktree, stdio: 'ignore' });
    await once(child, 'spawn');
    try { assert.equal((await removeWorktree({ project: c.fx.root, worktree: wt.worktree }, c.deps)).reason, 'in-use'); }
    finally { child.kill('SIGTERM'); await once(child, 'exit'); }
    assert.equal((await removeWorktree({ project: c.fx.root, worktree: wt.worktree }, c.deps)).removed, true);
  });
  await test('sparse omitted files are safe to reclaim, hidden tracked edits are retained', async () => {
    const c = await setup('sparse-clean'); const record = newUnit({ id: 'u-sparse', kind: 'tests', wos: ['WO-01-001'] });
    await writeFile(c.p.stateFile, JSON.stringify({ run_id: 'r-disk', units: [record] }));
    const wt = await prepareUnitWorktree({ project: c.fx.root, runId: 'r-disk', unit: record.id }, c.deps);
    assert.equal(wt.sparse.enabled, true); assert.equal((await removeWorktree({ project: c.fx.root, worktree: wt.worktree }, c.deps)).removed, true);
    const hidden = await prepareUnitWorktree({ project: c.fx.root, runId: 'r-disk', unit: 'u-hidden' }, c.deps);
    git(hidden.worktree, ['update-index', '--assume-unchanged', 'src/alpha/list.ts']); await writeFile(path.join(hidden.worktree, 'src/alpha/list.ts'), '// hidden work\n');
    assert.equal((await removeWorktree({ project: c.fx.root, worktree: hidden.worktree }, c.deps)).reason, 'masked-tracked-change');
  });
  await test('unit bootstrap disk refusal is retried on the same branch without losing work', async () => {
    const c = await setup('bootstrap-retry');
    await writeFile(path.join(c.p.integrationWorktree, '.pandacorp/worktree-bootstrap.sh'), 'if [ "${DENG_DISK_OK-}" != 1 ]; then exit 4; fi\nexit 0\n');
    git(c.p.integrationWorktree, ['add', '.pandacorp/worktree-bootstrap.sh']); git(c.p.integrationWorktree, ['commit', '-m', 'disk bootstrap fixture']);
    const first = await prepareUnitWorktree({ project: c.fx.root, runId: 'r-disk', unit: 'u-disk' }, { ...c.deps, bootstrap: true });
    assert.equal(first.bootstrap.exit, 4);
    const second = await prepareUnitWorktree({ project: c.fx.root, runId: 'r-disk', unit: 'u-disk' }, { ...c.deps, bootstrap: true, env: { ...c.deps.env, DENG_DISK_OK: '1' } });
    assert.equal(second.bootstrap.exit, 0); assert.equal(second.branch, first.branch);
  });
  await test('G2 shell preserves bootstrap disk refusal separately from a code exit 4', async () => {
    const c = await setup('g2-bootstrap'); const { G2_SCRIPT, G2_DISK_EXIT } = await import('../runtime/build/next/constants.mjs');
    const script = path.join(c.p.integrationWorktree, '.pandacorp/worktree-bootstrap.sh');
    await writeFile(script, 'exit 4\n');
    const disk = spawnSync('bash', ['-c', G2_SCRIPT, 'g2-test', c.fx.sha], { cwd: c.p.integrationWorktree, env: c.deps.env }); assert.equal(disk.status, G2_DISK_EXIT);
    await writeFile(script, 'exit 0\n'); await writeFile(path.join(c.p.integrationWorktree, '.pandacorp/verify.sh'), 'exit 4\n');
    const code = spawnSync('bash', ['-c', G2_SCRIPT, 'g2-test', c.fx.sha], { cwd: c.p.integrationWorktree, env: c.deps.env }); assert.equal(code.status, 4);
  });
  await test('gc refuses any held lease before scanning', async () => {
    await assert.rejects(gcWorktrees({ project: root }, { buildState: { currentLease: async () => ({ epoch: 1 }) } }), { code: 'CONTENDED' });
  });
  await test('finished fixture gc leaves no run worktree, keeps all branches and is idempotent', async () => {
    const { fx, deps, p } = await setup('gc');
    await prepareUnitWorktree({ project: fx.root, runId: 'r-disk', unit: 'u-done' }, deps);
    await writeFile(p.stateFile, JSON.stringify({ run_id: 'r-disk', status: 'finished', units: [], jobs: [] }));
    const refs = git(fx.root, ['for-each-ref', '--format=%(refname)', 'refs/heads/']);
    const first = await gcWorktrees({ project: fx.root }, deps);
    assert.equal(first.failed.length, 0);
    assert.equal(first.kept.length, 0, JSON.stringify(first.kept));
    assert.equal(git(fx.root, ['worktree', 'list', '--porcelain']).includes('/.pandacorp/run/'), false);
    assert.equal(git(fx.root, ['for-each-ref', '--format=%(refname)', 'refs/heads/']), refs);
    assert.equal((await gcWorktrees({ project: fx.root }, deps)).removed.length, 0);
  });
  await test('unit cone checkout keeps source and context, omits other FRD, full fallback on red light', async () => {
    const { fx, deps, p } = await setup('sparse');
    const record = { id: 'u-build', kind: 'build', wos: ['WO-01-001'], attempt: 1 };
    await writeFile(p.stateFile, JSON.stringify({ run_id: 'r-disk', units: [record] }));
    const wt = await prepareUnitWorktree({ project: fx.root, runId: 'r-disk', unit: record.id }, deps);
    assert.equal(wt.sparse.enabled, true);
    assert.equal(await exists(path.join(wt.root, 'src/beta/view.ts')), true);
    assert.equal(await exists(path.join(wt.root, 'docs/frds/frd-01-alpha/frd.md')), true);
    assert.equal(await exists(path.join(wt.root, 'docs/frds/frd-02-beta/frd.md')), false);
    assert.equal(await exists(path.join(p.integrationWorktree, 'docs/frds/frd-02-beta/frd.md')), true);
    const { sparseUnitDocs } = await import('../runtime/build/units/worktrees.mjs');
    const fallback = await sparseUnitDocs({ project: fx.root, root: wt.root, worktree: wt.worktree, unit: record }, { ...deps, exec: async (cmd, args, opts) => {
      if (cmd === 'bash') return { code: 1, stdout: '', stderr: 'light failed' };
      const { defaultExec } = await import('../runtime/build/fsx.mjs'); return defaultExec(cmd, args, opts);
    } });
    assert.equal(fallback.enabled, false);
    assert.equal(await exists(path.join(wt.root, 'docs/frds/frd-02-beta/frd.md')), true);
    assert.equal(await exists(path.join(p.integrationWorktree, 'docs/frds/frd-02-beta/frd.md')), true);
  });
} finally { await rm(root, { recursive: true, force: true }); }
console.log(`RESULT ${passed} passed, ${failed} failed (test-build-v2-disk)`);
process.exitCode = failed ? 1 : 0;
