#!/usr/bin/env node
// Independent DR-145 safety probes. Mutations are limited to disposable synthetic repositories.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { create, register, finish } from './session-cleanup.mjs';

const script = fileURLToPath(new URL('./session-cleanup.mjs', import.meta.url));
const env = { ...process.env, GIT_AUTHOR_NAME: 'Safety fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Safety fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
const roots = [];
const git = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
  assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
};
function fixture() {
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'cleanup-review-')));
  roots.push(root);
  const repo = path.join(root, 'repo'), wt = path.join(root, 'original');
  mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  writeFileSync(path.join(repo, 'file.txt'), 'synthetic fixture\n');
  git(repo, 'add', 'file.txt');
  git(repo, 'commit', '-qm', 'Synthetic fixture');
  git(repo, 'worktree', 'add', '-q', '-b', 'fixture/original', wt);
  return { root, repo, wt };
}
let failed = 0;
async function probe(name, fn) {
  try { await fn(); console.log(`PASS ${name}`); }
  catch (e) { failed++; console.error(`FAIL ${name}: ${e.message}`); }
}
async function backlogFixture(implementation, merger) {
  const source = readFileSync(new URL('../../.claude/engines/pandacorp-backlog.js', import.meta.url), 'utf8').replace(/^export\s+const\s+meta/m, 'const meta');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const engine = new AsyncFunction('agent', 'log', 'args', 'phase', 'parallel', source);
  const prompts = [];
  const agent = async (prompt, options) => {
    prompts.push({ prompt, label: options.label });
    if (options.label === 'scan') return { items: [{ id: 'BL-1001', path: '/fixture/BL-1001.md', title: 'Fixture', status: 'open', tier: 'sonnet' }] };
    if (options.label.startsWith('implement:')) return implementation;
    return merger;
  };
  const result = await engine(agent, () => {}, { factoryRoot: '/fixture' }, () => {}, tasks => Promise.all(tasks.map(task => task())));
  return { result, prompts };
}
try {
  await probe('wrapped child can register its session despite session TMPDIR', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    const child = spawnSync(process.execPath, [script, 'register', '--session', session.root, '--worktree', f.wt], {
      cwd: f.repo, env: { ...env, PANDACORP_SESSION_TEMP_BASE: path.dirname(session.root), TMPDIR: path.join(session.root, 'artifacts') }, encoding: 'utf8',
    });
    assert.equal(child.status, 0, child.stderr.trim());
  });
  await probe('failed process inventory refuses automatic removal', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    await register(session.root, f.wt);
    const bin = path.join(f.root, 'bin'); mkdirSync(bin);
    writeFileSync(path.join(bin, 'lsof'), '#!/bin/sh\necho "permission denied" >&2\nexit 1\n', { mode: 0o755 });
    const child = spawnSync(process.execPath, [script, 'finish', '--session', session.root, '--dry-run'], {
      cwd: f.repo, env: { ...env, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8',
    });
    const result = JSON.parse(child.stdout);
    assert.equal(result.removed.length, 0, `unsafe authorization: ${JSON.stringify(result)}`);
    assert.ok(result.kept.some(item => item.path === f.wt));
  });
  await probe('replacement worktree at registered path is foreign', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    await register(session.root, f.wt);
    git(f.repo, 'worktree', 'move', f.wt, path.join(f.root, 'moved-original'));
    git(f.repo, 'worktree', 'add', '-q', '-b', 'fixture/foreign-session', f.wt);
    const result = await finish(session.root, { dryRun: true, self: f.repo });
    assert.equal(result.removed.length, 0, `foreign worktree authorized: ${JSON.stringify(result)}`);
    assert.equal(result.kept.length, 1);
  });
  await probe('bare repository artifact is protected like a repository copy', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    git(f.repo, 'clone', '-q', '--bare', f.repo, path.join(session.root, 'artifacts', 'independent.git'));
    await assert.rejects(() => finish(session.root, { dryRun: true, self: f.repo }), /repository|protected|artifact/i);
  });
  await probe('active process in artifacts prevents deletion', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    const sleeper = spawn('sleep', ['60'], { cwd: path.join(session.root, 'artifacts'), stdio: 'ignore' });
    try {
      await new Promise((resolve, reject) => { sleeper.once('spawn', resolve); sleeper.once('error', reject); });
      const result = await finish(session.root, { dryRun: true, self: f.repo });
      assert.ok(result.kept.some(item => item.path === path.join(session.root, 'artifacts') && item.reason === 'in-use'));
      assert.equal(result.artifactsRemoved, false);
    } finally { sleeper.kill(); }
  });
  await probe('unrecognized ignored private files are retained', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    writeFileSync(path.join(f.repo, '.git', 'info', 'exclude'), '.env.local\n');
    writeFileSync(path.join(f.wt, '.env.local'), 'SYNTHETIC_PRIVATE_VALUE=fixture-only\n');
    await register(session.root, f.wt);
    const result = await finish(session.root, { dryRun: true, self: f.repo });
    assert.equal(result.removed.length, 0, 'private ignored file authorized for deletion');
    assert.ok(result.kept.some(item => item.path === f.wt));
  });
  await probe('wrapped tools can create and finish their own nested session', async () => {
    const f = fixture();
    const source = `const {create,register,finish}=await import(${JSON.stringify(new URL('./session-cleanup.mjs', import.meta.url).href)});const s=await create(process.cwd());await register(s.root,process.argv[1]);await finish(s.root,{self:process.cwd()});`;
    const child = spawnSync(process.execPath, [script, 'run', '--repo', f.repo, '--', process.execPath, '--input-type=module', '-e', source, f.wt], {
      cwd: f.repo, env, encoding: 'utf8',
    });
    assert.equal(child.status, 0, child.stderr.trim());
  });
  await probe('unregistered repository inside an ignored generated cache is protected', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    writeFileSync(path.join(f.repo, '.git', 'info', 'exclude'), 'node_modules/\n');
    mkdirSync(path.join(f.wt, 'node_modules'));
    git(f.repo, 'clone', '-q', f.repo, path.join(f.wt, 'node_modules', 'independent-source'));
    await register(session.root, f.wt);
    let result;
    try { result = await finish(session.root, { dryRun: true, self: f.repo }); }
    catch (e) { assert.match(e.message, /repository|protected|artifact/i); return; }
    assert.equal(result.removed.length, 0, `repository copy authorized: ${JSON.stringify(result)}`);
    assert.ok(result.kept.some(item => item.path === f.wt));
  });
  await probe('backlog cleanup receipt is shell quoted before interpolation', async () => {
    const cleanupSession = "/tmp/pandacorp-session-fixture ' space; $(printf CLEANUP_INJECTION)\nnext";
    const { prompts } = await backlogFixture({ id: 'BL-1001', branch: 'bl/BL-1001', status: 'done', cleanupSession }, { id: 'BL-1001', merged: true, validator: 'green' });
    const merge = prompts.find(item => item.label.startsWith('merge:')).prompt;
    const command = [...merge.matchAll(/`([^`]*finish --session [^`]*)`/g)][0]?.[1];
    assert.ok(command, 'expected cleanup command in merge prompt');
    const argument = command.slice(command.indexOf(' --session ') + ' --session '.length);
    // Execute only printf with the actual rendered argument. No paths or repositories are touched.
    const inert = spawnSync('bash', ['-c', `printf '%s\\0' ${argument}`], { encoding: 'utf8' });
    assert.equal(inert.status, 0, inert.stderr);
    assert.equal(inert.stdout, `${cleanupSession}\0`, 'receipt did not survive as exactly one literal argument');
  });
  await probe('blocked backlog implementation retains its cleanup receipt in report', async () => {
    const cleanupSession = '/tmp/pandacorp-session-partial';
    const { result } = await backlogFixture({ id: 'BL-1001', status: 'blocked', reason: 'fixture blocked', cleanupSession });
    assert.equal(result.blocked[0].cleanupSession, cleanupSession);
  });
  await probe('red backlog merge retains its cleanup receipt in report', async () => {
    const cleanupSession = '/tmp/pandacorp-session-partial';
    const { result } = await backlogFixture({ id: 'BL-1001', branch: 'bl/BL-1001', status: 'done', cleanupSession }, { id: 'BL-1001', merged: false, validator: 'red', reason: 'fixture gate red' });
    assert.equal(result.blocked[0].cleanupSession, cleanupSession);
  });
  await probe('generated output registration refuses escapes, symlinks and Git metadata', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    const outside = path.join(f.root, 'outside.txt'); writeFileSync(outside, 'synthetic outside value');
    symlinkSync(outside, path.join(f.wt, 'generated-link'));
    for (const relative of ['../outside.txt', outside, 'generated-link', '.git', '.pandacorp/run/evidence', 'factory/profile.md']) {
      await assert.rejects(() => register(session.root, f.wt, { generatedFiles: [relative] }), /generated output|non-protected|inside/i);
    }
  });
  await probe('owner edits to tracked skip-worktree generated output prevent removal', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    mkdirSync(path.join(f.wt, '.claude'));
    const launch = path.join(f.wt, '.claude', 'launch.json');
    writeFileSync(launch, '{}');
    git(f.wt, 'add', '.claude/launch.json'); git(f.wt, 'commit', '-qm', 'Synthetic tracked launch fixture');
    git(f.repo, 'merge', '--ff-only', 'fixture/original');
    writeFileSync(launch, '{"autoPort":true}'); git(f.wt, 'update-index', '--skip-worktree', '.claude/launch.json');
    await register(session.root, f.wt, { generatedFiles: ['.claude/launch.json'] });
    const masked = await finish(session.root, { dryRun: true, self: f.repo });
    assert.equal(masked.removed.length, 0, 'producer receipt must not bless a tracked override against HEAD');
    assert.ok(masked.kept.some(item => item.path === f.wt && item.reason === 'masked-tracked-change'));
    writeFileSync(launch, '{"ownerEdit":true}');
    const result = await finish(session.root, { dryRun: true, self: f.repo });
    assert.equal(result.removed.length, 0, `edited tracked output authorized: ${JSON.stringify(result)}`);
    assert.ok(result.kept.some(item => item.path === f.wt));
  });
  await probe('assume-unchanged cannot hide owner edits to an arbitrary tracked file', async () => {
    const f = fixture(), session = await create(f.repo); roots.push(session.root);
    await register(session.root, f.wt);
    git(f.wt, 'update-index', '--assume-unchanged', 'file.txt');
    writeFileSync(path.join(f.wt, 'file.txt'), 'synthetic owner edit hidden from git status\n');
    assert.equal(git(f.wt, 'status', '--porcelain'), '', 'fixture must reproduce a hidden change');
    const result = await finish(session.root, { dryRun: true, self: f.repo });
    assert.equal(result.removed.length, 0, `hidden owner edit authorized: ${JSON.stringify(result)}`);
    assert.ok(result.kept.some(item => item.path === f.wt));
  });
} finally {
  for (const root of roots.reverse()) rmSync(root, { recursive: true, force: true });
}
console.log(`Adversarial probes: ${14 - failed}/14 passed`);
process.exitCode = failed ? 1 : 0;
