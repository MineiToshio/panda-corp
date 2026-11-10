// Contract tests for templates/shared/.pandacorp/change-reconcile.mjs (DR-147, BL-0307): the change queue
// must equal reality whatever door the work came through, and nothing closes on weak evidence.
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';

const script = resolve(dirname(fileURLToPath(import.meta.url)), '../templates/shared/.pandacorp/change-reconcile.mjs');
const CARD_DATE = '2026-11-01';

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_DATE: process.env.FAKE_DATE, GIT_COMMITTER_DATE: process.env.FAKE_DATE } });
}
function commit(root, message, date = '2026-11-02T10:00:00Z') {
  process.env.FAKE_DATE = date;
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--allow-empty', '-m', message);
  delete process.env.FAKE_DATE;
}
function write(root, rel, body) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), body);
}
const card = (slug, { status = 'ready', frd = '', extra = '' } = {}) =>
  write(globalThis.__root, `.pandacorp/inbox/changes/${slug}.md`, `---\ntype: change\nclass: standard\nstatus: ${status}\ndate: "${CARD_DATE}"\nfrd: ${frd}\n${extra}---\n\n# ${slug}\n\nCuerpo en español.\n`);
const wo = (frd, id, status, extra = '') =>
  write(globalThis.__root, `docs/frds/${frd}/work-orders/wo-${id}.md`, `---\nid: WO-${id}\nimplementation_status: ${status}\n${extra}---\n# WO\n`);

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'change-reconcile-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.invalid');
  git(root, 'config', 'user.name', 'test');
  write(root, '.gitignore', '.pandacorp/inbox/\n');
  write(root, '.pandacorp/status.yaml', 'running: false\n');
  write(root, 'docs/decision-log.md', '# Decision log\n');
  write(root, 'docs/frds/frd-01-old/frd.md', '# FRD-01\n');
  commit(root, 'chore: init', '2026-10-01T10:00:00Z');
  mkdirSync(join(root, '.pandacorp/inbox/changes/done'), { recursive: true });
  write(root, '.pandacorp/inbox/changes/README.md', '| Card | Estado |\n|---|---|\n| [a](a.md) | change | standard | ready |\n');
  globalThis.__root = root;
  return root;
}
function run(root, ...args) {
  const r = spawnSync('node', [script, ...args], { cwd: root, encoding: 'utf8' });
  assert.ifError(r.error);
  return r;
}
function report(root, ...args) {
  const r = run(root, '--json', ...args);
  assert.equal(r.status, 0, r.stderr);
  return Object.fromEntries(JSON.parse(r.stdout).cards.map((c) => [c.slug, c]));
}
const active = (root, slug) => join(root, `.pandacorp/inbox/changes/${slug}.md`);
const archived = (root, slug) => join(root, `.pandacorp/inbox/changes/done/${slug}.md`);

test('report mode never writes', (t) => {
  const root = fixture(t);
  card('a');
  commit(root, 'feat: x\n\nChange: a');
  const before = readFileSync(active(root, 'a'), 'utf8');
  assert.equal(report(root).a.verdict, 'done');
  assert.equal(readFileSync(active(root, 'a'), 'utf8'), before);
});

test('T1: a Change trailer on main closes the card (direct chat work) and moves it, never deletes', (t) => {
  const root = fixture(t);
  card('a');
  commit(root, 'feat(x): direct fix\n\nChange: a\nCo-Authored-By: Someone <x@example.invalid>');
  const sha = git(root, 'rev-parse', '--short', 'HEAD').trim();
  assert.equal(report(root, '--apply').a.action, 'archived');
  assert.equal(existsSync(active(root, 'a')), false);
  const body = readFileSync(archived(root, 'a'), 'utf8');
  assert.match(body, /^status: done$/m);
  assert.match(body, new RegExp(`^shipped_sha: "${sha}"$`, 'm'));
  assert.match(body, /^closed_by: "change-reconcile"$/m);
  assert.match(body, /Cuerpo en español\./);
  assert.match(readFileSync(join(root, '.pandacorp/inbox/changes/README.md'), 'utf8'), /\(done\/a\.md\) \| change \| standard \| done \|/);
});

test('a trailer on an unmerged branch does not count', (t) => {
  const root = fixture(t);
  card('a');
  git(root, 'checkout', '-q', '-b', 'feat/a');
  commit(root, 'feat: wip\n\nChange: a');
  git(root, 'checkout', '-q', 'main');
  assert.equal(report(root).a.verdict, 'pending');
});

test('T2: Supersedes-Change marks the card discarded in place (owner decision)', (t) => {
  const root = fixture(t);
  card('a');
  commit(root, 'docs(decision-log): owner replaces the photo rule\n\nSupersedes-Change: a');
  assert.equal(report(root, '--apply').a.action, 'discarded');
  const body = readFileSync(active(root, 'a'), 'utf8');
  assert.match(body, /^status: discarded$/m);
  assert.match(body, /^status_before_discard: ready$/m);
  assert.match(body, /^superseded_by: "/m);
});

test('T3: WOs declaring source_change close the card only when ALL of them are VERIFIED', (t) => {
  const root = fixture(t);
  card('a', { frd: 'frd-02-new' });
  write(root, 'docs/frds/frd-02-new/frd.md', '# FRD-02\n');
  wo('frd-02-new', '02-001', 'VERIFIED', 'source_change: a\n');
  wo('frd-02-new', '02-002', 'IN_REVIEW', 'source_change: [a]\n');
  commit(root, 'docs: plan');
  assert.notEqual(report(root).a.verdict, 'done');
  wo('frd-02-new', '02-002', 'VERIFIED', 'source_change: [a]\n');
  commit(root, 'docs: verify');
  assert.equal(report(root, '--apply').a.action, 'archived');
});

test('W2: FRD planned after the card and fully VERIFIED flags, never closes (launch-plan path)', (t) => {
  const root = fixture(t);
  card('a', { frd: 'frd-02-new' });
  write(root, 'docs/frds/frd-02-new/frd.md', '# FRD-02\n');
  wo('frd-02-new', '02-001', 'VERIFIED');
  commit(root, 'feat: launch package');
  const row = report(root, '--apply').a;
  assert.equal(row.verdict, 'suspect');
  assert.equal(row.action, 'flagged');
  const body = readFileSync(active(root, 'a'), 'utf8');
  assert.match(body, /^status: ready$/m);
  assert.match(body, /^stale_suspect: ".*VERIFIED.*"$/m);
});

test('a card on an FRD verified BEFORE the card was filed is a normal pending change', (t) => {
  const root = fixture(t);
  wo('frd-01-old', '01-001', 'VERIFIED');
  commit(root, 'feat: old feature', '2026-10-05T10:00:00Z');
  card('a', { frd: 'frd-01-old' });
  assert.equal(report(root).a.verdict, 'pending');
});

test('H1: the FRD contract changing after the card is only a hint (card stays ready)', (t) => {
  const root = fixture(t);
  card('a', { frd: '["frd-01-old"]' });
  write(root, 'docs/frds/frd-01-old/frd.md', '# FRD-01 changed\n');
  commit(root, 'docs: contract moved');
  const row = report(root, '--apply').a;
  assert.equal(row.verdict, 'hint');
  const body = readFileSync(active(root, 'a'), 'utf8');
  assert.match(body, /^status: ready$/m);
  assert.match(body, /^stale_hint: /m);
  assert.doesNotMatch(body, /^stale_suspect:/m);
});

test('a hint can be dismissed too', (t) => {
  const root = fixture(t);
  card('a', { frd: 'frd-01-old' });
  write(root, 'docs/frds/frd-01-old/frd.md', '# FRD-01 changed\n');
  commit(root, 'docs: contract moved');
  run(root, '--apply');
  assert.equal(run(root, '--dismiss', 'a').status, 0);
  assert.equal(report(root, '--apply').a.verdict, 'pending');
  assert.doesNotMatch(readFileSync(active(root, 'a'), 'utf8'), /^stale_hint:/m);
});

test('W1: the slug named in a commit message or the decision log flags', (t) => {
  const root = fixture(t);
  card('a-card');
  card('b-card');
  commit(root, 'feat: implements a-card for the owner');
  write(root, 'docs/decision-log.md', '# Decision log\n\n2026-11-03: b-card is no longer wanted.\n');
  commit(root, 'docs: decision');
  const rows = report(root);
  assert.equal(rows['a-card'].verdict, 'suspect');
  assert.equal(rows['b-card'].verdict, 'suspect');
});

test('slug matching is whole-token (a card named "a" is not matched by "a-card")', (t) => {
  const root = fixture(t);
  card('export');
  commit(root, 'feat: export-sheet tweaks');
  assert.equal(report(root).export.verdict, 'pending');
});

test('dismissal sticks until the evidence changes', (t) => {
  const root = fixture(t);
  card('a');
  commit(root, 'docs: mention a in passing');
  run(root, '--apply');
  assert.equal(run(root, '--dismiss', 'a').status, 0);
  assert.equal(report(root, '--apply').a.verdict, 'pending');
  assert.doesNotMatch(readFileSync(active(root, 'a'), 'utf8'), /^stale_suspect:/m);
  write(root, 'docs/decision-log.md', '# Decision log\n\na was replaced.\n');
  commit(root, 'docs: new evidence');
  assert.equal(report(root).a.verdict, 'suspect');
});

test('owner confirm-done and supersede, with mandatory reasons', (t) => {
  const root = fixture(t);
  card('a');
  card('b');
  assert.equal(run(root, '--confirm-done', 'a').status, 2);
  assert.equal(run(root, '--confirm-done', 'a', '--evidence', 'shipped in 2dd09318').status, 0);
  assert.match(readFileSync(archived(root, 'a'), 'utf8'), /^closed_by: "owner"$/m);
  assert.equal(run(root, '--supersede', 'b', '--reason', 'decision 2026-11-06').status, 0);
  assert.match(readFileSync(active(root, 'b'), 'utf8'), /^status: discarded$/m);
});

test('building/closing cards are left to the engine and sync', (t) => {
  const root = fixture(t);
  card('a', { status: 'building' });
  card('b', { status: 'closing' });
  commit(root, 'feat: x\n\nChange: a\nChange: b');
  const rows = report(root, '--apply');
  assert.equal(rows.a.verdict, 'owned');
  assert.equal(rows.b.verdict, 'owned');
  assert.ok(existsSync(active(root, 'a')) && existsSync(active(root, 'b')));
});

test('writes are refused while a build is live, unless the engine calls with --in-build', (t) => {
  const root = fixture(t);
  card('a');
  commit(root, 'feat: x\n\nChange: a');
  write(root, '.pandacorp/status.yaml', `running: true\nsupervisor_heartbeat: "${new Date().toISOString()}"\n`);
  assert.equal(run(root, '--apply').status, 3);
  assert.ok(existsSync(active(root, 'a')));
  assert.equal(run(root, '--apply', '--in-build').status, 0);
  assert.ok(existsSync(archived(root, 'a')));
});

test('a stale lock (old heartbeat) does not block', (t) => {
  const root = fixture(t);
  card('a');
  commit(root, 'feat: x\n\nChange: a');
  write(root, '.pandacorp/status.yaml', 'running: true\nsupervisor_heartbeat: "2026-01-01T00:00:00Z"\n');
  assert.equal(run(root, '--apply').status, 0);
});

test('an archive collision is reported, never overwrites, others proceed', (t) => {
  const root = fixture(t);
  card('a');
  card('b');
  write(root, '.pandacorp/inbox/changes/done/a.md', 'existing\n');
  commit(root, 'feat: x\n\nChange: a\nChange: b');
  const r = run(root, '--apply', '--json');
  assert.equal(r.status, 4);
  assert.equal(readFileSync(archived(root, 'a'), 'utf8'), 'existing\n');
  assert.ok(existsSync(active(root, 'a')));
  assert.ok(existsSync(archived(root, 'b')));
});

test('apply is idempotent and clears a vanished flag', (t) => {
  const root = fixture(t);
  card('a', { extra: 'stale_suspect: "old"\nstale_fingerprint: "x"\n' });
  run(root, '--apply');
  const once = readFileSync(active(root, 'a'), 'utf8');
  assert.doesNotMatch(once, /^stale_/m);
  run(root, '--apply');
  assert.equal(readFileSync(active(root, 'a'), 'utf8'), once);
});
