#!/usr/bin/env node
// ADM contract: adaptive readings, bounded private samples, host learning and one record per run.
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createFixture, testEnv } from './fixtures/build-v2/make-fixture.mjs';
import * as admission from '../runtime/build/admission.mjs';
import { buildPaths } from '../runtime/build/paths.mjs';
import { newState, newUnit, writeState } from '../runtime/build/state.mjs';
import { appendEvent } from '../runtime/build/journal.mjs';
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log(`PASS ${name}`); } catch (e) { failed++; console.error(`FAIL ${name}: ${e.stack}`); } };
const dir = await fs.mkdtemp(path.join(process.env.PANDACORP_TEST_TMP || os.tmpdir(), 'adm-perf-'));
const env = testEnv(dir);
const deps = { env };
const file = path.join(dir, 'admission.json');
let ms = Date.parse(env.PANDACORP_NOW);
const ctx = { file, now: () => ms };
const sig = (over = {}) => ({ L: 2, swapouts: 100, swap_used_mb: 8000, A_gib: 2, ...over });
await test('ladder starts at 5; stable swap use and low RAM do not veto builders', () => {
  const d = admission.decide({ signals: sig(), live: { B: 4, H: 0 }, readyWidth: 4 });
  assert.equal(d.techo, 5); assert.equal(d.grant, 'B');
});
await test('two growing swapout deltas lower exactly one step and reset the trend', () => {
  admission.recordReading(sig(), ctx); ms += 1000;
  admission.recordReading(sig({ swapouts: 101 }), ctx); ms += 1000;
  const d = admission.recordReading(sig({ swapouts: 102 }), ctx);
  assert.equal(d.step, 3); assert.equal(d.history.length, 0);
  ms += 1000; assert.equal(admission.recordReading(sig({ swapouts: 102 }), ctx).step, 3);
});
await test('512 MB growth lowers once; critical pressure goes straight to 1 and keeps 1+1 possible', () => {
  ms += 1000; assert.equal(admission.recordReading(sig({ swapouts: 102, swap_used_mb: 8512 }), ctx).step, 2);
  ms += 1000; assert.equal(admission.recordReading(sig({ L: 4 }), ctx).step, 1);
  assert.equal(admission.decide({ signals: sig({ L: 4 }), step: 1, live: { B: 0, H: 0 }, readyWidth: 1 }).grant, 'B');
  assert.equal(admission.decide({ signals: sig({ L: 4 }), step: 1, live: { B: 1, H: 0 }, readyWidth: 0, heavyQueued: 1 }).grant, 'H');
});
await test('upshift needs 3 stable readings and 120 seconds; cannot reach 8 without journal evidence', async () => {
  await fs.rm(file); ms += 1000;
  admission.initializeAdmission({ step: 3, allow8: false }, ctx);
  admission.recordReading(sig(), ctx); ms += 60_000;
  assert.equal(admission.recordReading(sig(), ctx).step, 3); ms += 60_000;
  assert.equal(admission.recordReading(sig(), ctx).step, 5);
  for (let i = 0; i < 4; i++) { ms += 60_000; assert.equal(admission.recordReading(sig(), ctx).step, 5); }
});
let perf;
await test('cumulative RAM decline prevents step up; journal permission lets a recovered run reach 8', async () => {
  const other = { file: path.join(dir, 'cooldown.json'), now: () => ms };
  admission.initializeAdmission({ step: 3, allow8: true }, other);
  admission.recordReading(sig({ A_gib: 6 }), other); ms += 60_000;
  admission.recordReading(sig({ A_gib: 5 }), other); ms += 60_000;
  assert.equal(admission.recordReading(sig({ A_gib: 4.4 }), other).step, 3);
  for (let i = 0; i < 4; i++) { ms += 60_000; admission.recordReading(sig({ A_gib: 7 }), other); }
  assert.equal(admission.readAdaptive(other).step, 5);
  for (let i = 0; i < 3; i++) { ms += 60_000; admission.recordReading(sig({ A_gib: 7 }), other); }
  assert.equal(admission.readAdaptive(other).step, 8);
});
await test('perf module loads', async () => { perf = await import('../runtime/build/perf.mjs'); });
await test('disk reads project statfs; 16.5 GiB admits, below refuses, existing worktree bypasses floor', () => {
  assert.equal(admission.diskDecision({ project: dir, freeGib: 16.5 }).ok, true);
  assert.equal(admission.diskDecision({ project: dir, freeGib: 16.49 }).motivo_limite, 'disco');
  assert.equal(admission.diskDecision({ project: dir, freeGib: 0, needsWorktree: false }).ok, true);
  const calls = [];
  assert.equal(admission.diskDecision({ project: dir }, { env: {}, fs: { statfsSync: (p) => { calls.push(p); return { bavail: 17, bsize: 1024 ** 3 }; } } }).ok, true);
  assert.deepEqual(calls, [dir]);
});
await test('journal default start, median of last five, and evidence for step 8', async () => {
  assert.deepEqual(await perf.startRecommendation(deps), { step: 5, allow8: false });
  const p = buildPaths(dir, deps); await fs.mkdir(path.dirname(p.perfJournalFile), { recursive: true });
  const records = [1, 1, 2, 3, 5, 8].map((n) => ({ recommended_start: n, sustained_step: n, scale_events: [] }));
  await fs.writeFile(p.perfJournalFile, records.map(JSON.stringify).join('\n') + '\n');
  assert.deepEqual(await perf.startRecommendation(deps), { step: 3, allow8: true });
  records.at(-2).scale_events = [{ from: 5, to: 3, reason: 'swapouts' }];
  await fs.writeFile(p.perfJournalFile, records.slice(0, -1).map(JSON.stringify).join('\n') + '\n');
  assert.equal((await perf.startRecommendation(deps)).allow8, false);
  await fs.rm(p.perfJournalFile);
});
await test('record aggregates durations, RAM, swap, scaling, bounded points and basename; concurrent close is idempotent', async () => {
  const fx = await createFixture('basic', { dir: path.join(dir, 'project') });
  try {
    const project = fx.root, p = buildPaths(project, deps), start = Date.parse(env.PANDACORP_NOW);
    const state = newState({ run_id: 'perf-test', epoch: 1, coordinator: 'claude-session', label: 'claude', size: 'feature', status: 'finished', scope: { card: null, frds: [], wos: [], out_of_scope: [] }, integration: { branch: 'lane/perf-test/integration', worktree: p.integrationWorktree, base_sha: fx.sha }, units: [newUnit({ id: 'u-one', kind: 'build', state: 'landed' })] });
    await writeState(project, state, deps);
    await appendEvent(p.journalFile, { run_id: state.run_id, epoch: 1, type: 'run_started', data: {}, at: new Date(start).toISOString() });
    await appendEvent(p.journalFile, { run_id: state.run_id, epoch: 1, type: 'unit_dispatched', data: { unit: 'u-one', cell: { runtime: 'claude', model: 'sonnet', effort: 'high' } }, at: new Date(start + 1000).toISOString() });
    await appendEvent(p.journalFile, { run_id: state.run_id, epoch: 1, type: 'report_received', data: { unit: 'u-one' }, at: new Date(start + 11_000).toISOString() });
    for (let i = 0; i < 215; i++) await perf.recordSample({ project, state, reading: { step: i < 10 ? 5 : 3, motivo: 'techo', scale_event: i === 10 ? { from: 5, to: 3, reason: 'swapouts', at: new Date(start + i * 1000).toISOString() } : null }, signals: sig({ A_gib: i === 0 ? 1 : 4, swap_used_mb: 8000 + i }), diskFreeGib: 22 }, { ...deps, clock: () => new Date(start + i * 1000), env: { ...env, PANDACORP_NOW: '' } });
    const oldSamples = (await fs.readFile(p.perfSamplesFile, 'utf8')).trim().split('\n').map(JSON.parse);
    await fs.writeFile(p.perfSamplesFile, Array.from({ length: perf.SAMPLE_LIMIT }, () => JSON.stringify(oldSamples.at(-1))).join('\n') + '\n');
    await perf.recordSample({ project, state, reading: { step: 3, motivo: 'techo' }, signals: sig({ A_gib: 4, swap_used_mb: 8214 }), diskFreeGib: 22 }, { ...deps, env: { ...env, PANDACORP_NOW: new Date(start + 215_000).toISOString() } });
    assert.equal((await fs.readFile(p.perfSamplesFile, 'utf8')).trim().split('\n').length, perf.SAMPLE_LIMIT);
    const results = await Promise.all([perf.finishPerformance({ project, state }, deps), perf.finishPerformance({ project, state }, deps)]);
    assert(results.every((r) => r.ok), JSON.stringify(results));
    const lines = (await fs.readFile(p.perfJournalFile, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(lines.length, 1); const r = lines[0];
    assert.equal(r.project, path.basename(project)); assert(!JSON.stringify(r).includes(dir));
    assert(r.workers_over_time.length <= 200); assert.equal(r.start_step, 5); assert.equal(r.sustained_step, 3);
    assert.equal(r.units_by_kind.build.p50_s, 10); assert.equal(r.units_by_kind.build.p90_s, 10);
    assert.deepEqual(r.ram_gib, { min: 1, max: 4 }); assert.deepEqual(r.swap_mb, { start: 8000, peak: 8214, end: 8214 });
    assert.equal(r.scale_events.length, 1); assert.equal(r.disk_free_gib.start, 22);
  } finally { await fx.cleanup(); }
});
await test('short runs cannot certify sustained 5; engine-failure record tolerates a broken execution journal with a warning', async () => {
  const project = path.join(dir, 'broken-run'); await fs.mkdir(project);
  const p = buildPaths(project, deps);
  const state = { run_id: 'broken-test', status: 'stopped', status_reason: 'engine_failure', units: [], jobs: [] };
  await perf.recordSample({ project, state, reading: { step: 5, motivo: 'techo' }, signals: sig(), diskFreeGib: 30 }, deps);
  await fs.writeFile(p.journalFile, 'broken journal\n');
  const r = await perf.finishPerformance({ project, state }, deps);
  assert.equal(r.ok, true); assert.equal(r.record.outcome, 'engine_failure');
  assert.equal(r.record.sustained_step, null); assert.equal(r.warnings.length, 1);
});
await fs.rm(dir, { recursive: true, force: true });
console.log(`RESULT ${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0;
