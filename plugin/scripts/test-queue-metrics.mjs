import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { queueMetrics } from './queue-metrics.mjs';

const events = [];
function event(attempt, branch, seconds, event, fields = {}, project = '/app') {
  const defaults = {
    start: { head: 'a'.repeat(40), launched: 0, owner_release_ok: 0, pid: 1 },
    gate_start: { load: 1, ncpu: 2 },
    stamp_check: { reason: '' },
    ff: { sha: 'a'.repeat(40) },
  };
  events.push({ v: 1, attempt, branch, project, ts: new Date(seconds * 1000).toISOString(), event, ...defaults[event], ...fields });
}
event('ready', 'a', 0, 'ready');
event('a1', 'a', 10, 'start');
event('a1', 'a', 12, 'gate_start');
event('b1', 'b', 15, 'start');
event('b1', 'b', 16, 'stamp_check', { result: 'match' });
event('a1', 'a', 20, 'end', { exit: 11 });
event('b1', 'b', 35, 'ff', { result: 'ok' });
event('b1', 'b', 36, 'end', { exit: 0 });
event('a2', 'a', 40, 'start');
event('a2', 'a', 50, 'end', { exit: 21 });
event('a3', 'a', 60, 'start');
event('a3', 'a', 70, 'ff', { result: 'ok' });
event('a3', 'a', 90, 'end', { exit: 0 });
// A reused branch starts a new episode; an interrupted attempt stays visible.
event('a4', 'a', 100, 'start');
event('a4', 'a', 110, 'end', { exit: 0 });
event('c1', 'c', 120, 'start');
event('late-ready', 'c', 150, 'ready');
event('c1', 'c', 220, 'end', { exit: 0 });
event('open', 'open', 230, 'start');
event('other', 'a', 240, 'start', {}, '/other');
event('other', 'a', 250, 'end', { exit: 0 }, '/other');
const fixture = events.map(e => JSON.stringify(e)).join('\n') + '\n';
const result = queueMetrics(fixture);
const app = result.projects[0];
assert.deepEqual(app.done_to_main.Q_s, { n: 4, median: 40, p90: 100 });
assert.deepEqual(app.done_to_main.R_s, { n: 4, median: 45, p90: 100 });
assert.deepEqual(app.rounds, { n: 5, median: 1, p90: 3, at_least_3: 1, share_at_least_3: .2 });
assert.deepEqual(app.episodes.map(e => e.rounds), [3, 1, 1, 1, 1]);
assert.deepEqual(app.exits, { 0: 4, 11: 1, 21: 1 });
assert.equal(app.certified_tree_skips, 1);
assert.equal(app.full_gates, 1);
assert.equal(app.episodes.at(-1).Q_s, null);
assert.equal(result.projects[1].done_to_main.Q_s.median, 10);
const start = events.find(e => e.event === 'start');
const overlap = [];
function overlapping(attempt, seconds, name, fields = {}) {
  overlap.push({ ...start, attempt, ts: new Date(seconds * 1000).toISOString(), event: name, ...fields });
}
overlapping('first', 0, 'start');
overlapping('pending', 1, 'start');
overlapping('first', 9, 'ff', { sha: 'b'.repeat(40), result: 'ok' });
overlapping('first', 10, 'end', { exit: 0 });
overlapping('next', 11, 'start');
overlapping('pending', 12, 'ff', { sha: 'b'.repeat(40), result: 'ok' });
overlapping('pending', 13, 'end', { exit: 0 });
overlapping('next-pending', 14, 'start');
overlapping('next', 19, 'ff', { sha: 'c'.repeat(40), result: 'ok' });
overlapping('next', 20, 'end', { exit: 0 });
overlapping('next-pending', 21, 'end', { exit: 0 });
const overlapped = queueMetrics(overlap.map(e => JSON.stringify(e)).join('\n')).projects[0];
assert.deepEqual(overlapped.episodes.map(e => [e.Q_s, e.rounds]), [[9, 2], [8, 2]]);
assert.equal(overlapped.exits[0], 4);
assert.deepEqual(overlapped.episodes.map(e => e.pending_attempts), [[], []]);
const pending = queueMetrics(overlap.slice(0, 5).map(e => JSON.stringify(e)).join('\n')).projects[0];
assert.equal(pending.episodes[0].Q_s, 9);
assert.deepEqual(pending.episodes.map(e => e.pending_attempts), [['pending'], ['next']]);
const malformed = [
  { event: 'gate_strat' },
  { event: 'gate_end', rc: 'oops', duration_s: 1, load: 1, ncpu: 2, report: '' },
  { event: 'gate_end', rc: 0, duration_s: -1, load: 1, ncpu: 2, report: '' },
  { event: 'gate_start', load: -1, ncpu: 2 },
  { event: 'gate_start', load: 1, ncpu: 0 },
  { event: 'lock_acquired', waited_s: 'soon' },
  { event: 'slot_released', slot: 3 },
  { event: 'rebase', result: 'perhaps', head: '', base: '', duration_s: 0 },
  { event: 'stamp_check', result: 'match', reason: null },
  { event: 'order_check', launched: 'yes', order_present: 0 },
  { event: 'push', sha: 'a'.repeat(40), result: 'perhaps' },
  { event: 'reconcile', rc: -1 },
  { event: 'end', exit: '0' },
  { event: 'archive_error', path: '', reason: 'write error' },
  { event: 'start', pid: 0 },
  { event: 'ready', ts: 'yesterday' },
];
for (const invalid of malformed) {
  assert.throws(() => queueMetrics(`${JSON.stringify(start)}\n${JSON.stringify({ ...start, ...invalid })}\n`), /line 2: /);
}
const validFields = {
  lock_wait: { waited_s: 0 },
  lock_acquired: { waited_s: 1.5 },
  slot_acquired: { slot: '/slots/0', waited_s: 0 },
  slot_released: { slot: '/slots/0' },
  rebase: { result: 'ok', head: 'b'.repeat(40), base: 'a'.repeat(40), duration_s: 1 },
  stamp_check: { result: 'miss', reason: 'no stamp' },
  gate_start: { load: 1, ncpu: 2 },
  gate_end: { rc: 0, duration_s: 1, load: 1, ncpu: 2, report: '/reports/a.json' },
  order_check: { launched: 0, order_present: 0 },
  ff: { sha: 'b'.repeat(40), result: 'ok' },
  push: { sha: 'b'.repeat(40), result: 'ok' },
  reconcile: { rc: 3 },
  archive_error: { path: '/reports/a.json', reason: 'existing archive' },
  ready: {},
  end: { exit: 0 },
};
const valid = Object.entries(validFields).map(([name, fields], index) => ({
  ...start, event: name, ts: new Date((index + 20) * 1000).toISOString(), ...fields,
}));
assert.equal(queueMetrics([start, ...valid].map(e => JSON.stringify(e)).join('\n')).projects[0].done_to_main.Q_s.n, 1);
for (const [name, fields] of Object.entries(validFields)) {
  for (const key of Object.keys(fields)) {
    const incomplete = { ...start, event: name, ...fields };
    delete incomplete[key];
    assert.throws(() => queueMetrics([start, incomplete].map(e => JSON.stringify(e)).join('\n')),
      new RegExp(`line 2: invalid ${name}\\.${key}`));
  }
}
assert.throws(() => queueMetrics(fixture + '{broken}\n'), /line 22: /);
assert.throws(() => queueMetrics(fixture + '{}\n'), /line 22: invalid v1/);
assert.throws(() => queueMetrics(fixture + '\n'), /line 22: /);
const dir = mkdtempSync(join(tmpdir(), 'queue-metrics-'));
try {
  const file = join(dir, 'fixture.jsonl');
  writeFileSync(file, fixture);
  const run = spawnSync(process.execPath, [new URL('./queue-metrics.mjs', import.meta.url).pathname, file], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), result);
  assert.match(run.stderr, /Q median\/p90/);
  writeFileSync(file, fixture + '{broken}\n');
  const bad = spawnSync(process.execPath, [new URL('./queue-metrics.mjs', import.meta.url).pathname, file], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /line 22/);
  writeFileSync(file, `${JSON.stringify(start)}\n${JSON.stringify({ ...start, ...malformed[0] })}\n`);
  const invalid = spawnSync(process.execPath, [new URL('./queue-metrics.mjs', import.meta.url).pathname, file], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /line 2/);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log('RESULT: queue metrics fixture, median/p90, rounds, ready, CLI and malformed lines passed');
