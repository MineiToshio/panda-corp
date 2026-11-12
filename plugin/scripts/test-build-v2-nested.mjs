#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createFixture } from './fixtures/build-v2/make-fixture.mjs';
import { fileBacklogNote } from '../runtime/build/failure/engineBacklog.mjs';
import { writeInbox } from '../runtime/build/doubts/integrationLog.mjs';
import { markInboxAnswered } from '../runtime/build/answers/io.mjs';

const entry = '## Pregunta\n- **Id:** `d-1`\n- **Estado:** PENDIENTE\n\n';
async function fixture(options, fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'n17-'));
  try {
    const fx = await createFixture(options, { dir });
    const factory = path.join(dir, 'factory');
    await mkdir(path.join(factory, 'factory/backlog'), { recursive: true });
    const deps = { env: fx.env(), factoryRoot: factory };
    await fn(fx, deps);
  } finally { await rm(dir, { recursive: true, force: true }); }
}
const failure = { runId: 'run-n17', cmd: 'next', message: 'test fault' };
for (const nested of [true, false]) {
  test(nested ? 'nested failure stays in the project' : 'factory repo failure stays in the project', () => fixture({ nested }, async (fx, deps) => {
    if (!nested) deps.factoryRoot = fx.repoRoot;
    const before = fx.git('status', '--porcelain');
    const note = await fileBacklogNote({ project: fx.root, failure, deps });
    assert.equal(note.file, path.join(fx.root, '.pandacorp/run/build/handback/engine-backlog-run-n17.md'));
    assert.match(await readFile(note.file, 'utf8'), /test fault/);
    assert.equal(note.draft, true);
    assert.equal(fx.git('status', '--porcelain'), before);
    if (nested) assert.deepEqual(await readdir(path.join(deps.factoryRoot, 'factory/backlog')), []);
  }));
}
test('standalone failures retain the numbered factory backlog', () => fixture('basic', async (fx, deps) => {
  const note = await fileBacklogNote({ project: fx.root, failure, deps });
  assert.equal(note.id, 'BL-0001');
  assert.match(note.file, /factory\/backlog\/BL-0001/);
}));
test('tracked local draft is refused before writing', () => fixture({ nested: true }, async (fx, deps) => {
  const rel = '.pandacorp/run/build/handback/engine-backlog-run-n17.md';
  await mkdir(path.dirname(path.join(fx.root, rel)), { recursive: true });
  await writeFile(path.join(fx.root, rel), 'preserve');
  fx.git('add', '-f', '--', rel);
  await assert.rejects(() => fileBacklogNote({ project: fx.root, failure, deps }), { code: 'INVALID_PATH' });
  assert.equal(await readFile(path.join(fx.root, rel), 'utf8'), 'preserve');
}));
for (const nested of [false, true]) test(`tracked inbox mirrors and answers both copies (nested=${nested})`, () => fixture({ nested, trackedDecisions: true }, async (fx, deps) => {
  const wt = path.join(fx.dir, 'integration');
  fx.git('worktree', 'add', '-b', 'integration', wt, 'main');
  const integration = nested ? path.join(wt, 'nested') : wt;
  const rel = '.pandacorp/inbox/decisions.md';
  const mainBefore = await readFile(path.join(fx.root, rel), 'utf8');
  await writeInbox(fx.root, integration, entry, deps);
  const mirror = path.join(fx.root, '.pandacorp/inbox/decisions.pending.md');
  assert.match(await readFile(mirror, 'utf8'), /`d-1`/);
  assert.equal(await readFile(path.join(fx.root, rel), 'utf8'), mainBefore);
  await markInboxAnswered(fx.root, integration, { id: 'd-1', value: 'yes', date: '2026-11-12' }, deps);
  for (const file of [mirror, path.join(integration, rel)]) assert.match(await readFile(file, 'utf8'), /RESUELTO/);
  assert.equal(await readFile(path.join(fx.root, rel), 'utf8'), mainBefore);
}));
test('untracked inbox stays in the main checkout without a mirror', () => fixture('basic', async (fx, deps) => {
  await writeInbox(fx.root, null, entry, deps);
  assert.match(await readFile(path.join(fx.root, '.pandacorp/inbox/decisions.md'), 'utf8'), /`d-1`/);
  await assert.rejects(readFile(path.join(fx.root, '.pandacorp/inbox/decisions.pending.md')), { code: 'ENOENT' });
}));
test('tracked mirror is refused before either inbox is written', () => fixture('tracked-decisions', async (fx, deps) => {
  const mirror = '.pandacorp/inbox/decisions.pending.md';
  await writeFile(path.join(fx.root, mirror), 'preserve'); fx.git('add', '-f', '--', mirror);
  const integration = path.join(fx.dir, 'integration'); fx.git('worktree', 'add', '-b', 'integration', integration, 'main');
  const before = await readFile(path.join(integration, '.pandacorp/inbox/decisions.md'), 'utf8');
  await assert.rejects(() => writeInbox(fx.root, integration, entry, deps), { code: 'INVALID_PATH' });
  assert.equal(await readFile(path.join(integration, '.pandacorp/inbox/decisions.md'), 'utf8'), before);
}));

test('PATCH2: nested failure draft appears in the summary and Spanish handback; performance closes outside the mutex', () => fixture({ nested: true }, async (fx, deps) => {
  const { acquire, currentLease } = await import('../runtime/build-state.mjs');
  const { newState, writeState } = await import('../runtime/build/state.mjs');
  const { buildPaths } = await import('../runtime/build/paths.mjs');
  const { handleEngineFailure } = await import('../runtime/build/failure/engineFailure.mjs');
  const { readSummary, renderReportEs } = await import('../runtime/build/summary.mjs');
  const lease = await acquire(fx.root, { runtime: 'claude', runId: 'run-n17', projectStatus: false });
  const p = buildPaths(fx.root, deps);
  await writeState(fx.root, newState({ run_id: 'run-n17', epoch: lease.epoch, coordinator: 'claude-session', label: 'claude', size: 'feature', scope: { card: null, frds: [], wos: [], out_of_scope: [] }, integration: { branch: p.integrationBranch('run-n17'), worktree: p.integrationWorktree, base_sha: fx.sha } }), deps);
  let perfCalled = false;
  const result = await handleEngineFailure({ project: fx.root, epoch: lease.epoch, error: new Error('nested fault') }, { ...deps,
    finishPerformance: async ({ state, outcome }) => {
      assert.equal(await currentLease(fx.root), null, 'performance runs after releasing the lease');
      assert.equal(state.status, 'stopped'); assert.equal(outcome, 'engine_failure'); perfCalled = true;
      return { ok: true };
    },
  });
  assert(perfCalled, 'performance journal finalized');
  assert.equal(result.bl.draft, true);
  assert.match(await readFile(p.engineHandbackFile, 'utf8'), /borrador local/);
  assert.doesNotMatch(await readFile(p.engineHandbackFile, 'utf8'), /backlog de la fábrica:/);
  const summary = await readSummary(fx.root, deps);
  assert(summary.need_from_owner.some((line) => line.includes(result.bl.file)), 'summary names the local draft');
  assert(renderReportEs(summary).includes(result.bl.file), 'Spanish report names the local draft');
  assert.deepEqual(await readdir(path.join(deps.factoryRoot, 'factory/backlog')), []);
}));
