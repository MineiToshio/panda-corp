#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installPrePush } from './install-pre-push.mjs';

const zero = '0'.repeat(40);
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' };
for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'PANDACORP_OWNER_RELEASE_OK']) delete env[k];
function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'nested-pre-push-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { env, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  const put = (file, body = 'fixture\n') => { mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); writeFileSync(path.join(root, file), body); };
  const commit = (file, body) => { put(file, body); git('add', '--', file); git('commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD'); };
  const initial = commit('factory.md');
  const status = (scope, phase = 'release', target = 'external') => put(`${scope}/.pandacorp/status.yaml`, `phase: ${phase}\ndeploy_target: ${target}\n`);
  const line = (sha, old = initial, ref = 'main') => `refs/heads/${ref} ${sha} refs/heads/${ref} ${old}\n`;
  const hook = (input, extra = {}, cwd = root) => spawnSync(path.join(root, '.git/hooks/pre-push'), ['origin', 'unused'], { cwd, env: { ...env, ...extra }, input, encoding: 'utf8' });
  return { root, git, put, commit, initial, status, line, hook };
}

test('standalone project guards default branch and keeps the owner override', t => {
  const f = fixture(t); f.status('.');
  assert.equal(installPrePush({ project: f.root }).code, 0);
  assert.equal(f.hook(f.line(f.initial)).status, 1);
  assert.equal(f.hook(f.line(f.initial), { PANDACORP_OWNER_RELEASE_OK: '1' }).status, 0);
  assert.equal(f.hook(f.line(f.initial, f.initial, 'feature')).status, 0);
});

test('nested project scopes factory pushes, commit history, multi-ref, creation and deletion', t => {
  const f = fixture(t); f.status('mission-control');
  // The factory has runtime state but deliberately no root status.yaml.
  f.put('.pandacorp/run/runtime.json', '{}');
  assert.equal(installPrePush({ project: path.join(f.root, 'mission-control') }).code, 0);
  assert.equal(installPrePush({ project: path.join(f.root, 'mission-control'), check: true }).code, 0);
  const factory = f.commit('factory.md', 'factory-only change');
  assert.equal(f.hook(f.line(factory)).status, 0, 'factory change must not read nested/root state');
  const touching = f.commit('mission-control/app.txt', 'product');
  assert.equal(f.hook(f.line(touching, factory)).status, 1);
  assert.equal(f.hook(f.line(touching, factory), {}, path.join(f.root, 'mission-control')).status, 1);
  assert.equal(f.hook(f.line(factory) + f.line(touching, factory, 'feature')).status, 0, 'other branch must not contaminate main');
  assert.equal(f.hook(f.line(touching, factory, 'feature') + f.line(touching, factory)).status, 1);
  assert.equal(f.hook(f.line(factory, zero)).status, 0, 'creation with only factory history');
  assert.equal(f.hook(f.line(touching, zero)).status, 1, 'creation includes product history');
  assert.equal(f.hook(f.line(zero, touching)).status, 1, 'deleting main containing product is gated');
  assert.equal(f.hook(f.line(zero, factory)).status, 0, 'deleting factory-only history is allowed');
  assert.equal(f.hook(f.line(factory, touching)).status, 1, 'rewind removing product is gated');
  f.git('revert', '--no-edit', touching);
  assert.equal(f.hook(f.line(f.git('rev-parse', 'HEAD'), factory)).status, 1, 'touch and revert still counts');
  f.status('mission-control', 'release', 'internal');
  assert.equal(f.hook(f.line(touching, factory)).status, 0);
  rmSync(path.join(f.root, 'mission-control/.pandacorp/status.yaml'));
  assert.equal(f.hook(f.line(touching, factory)).status, 1, 'missing relevant state fails closed');
  assert.equal(f.hook(f.line(factory)).status, 0, 'missing unrelated state is ignored');
  assert.equal(f.hook(f.line(touching, 'f'.repeat(40))).status, 1, 'unknown remote history fails closed');
});

test('multiple nested scopes retain independent status, chain and idempotent install', t => {
  const f = fixture(t); f.status('mission control'); f.status('second', 'implementation');
  const foreign = path.join(f.root, '.git/hooks/pre-push');
  writeFileSync(foreign, '#!/bin/sh\ncat >"$PWD/chained-input"\nexit 7\n', { mode: 0o755 });
  for (const scope of ['mission control', 'second']) assert.equal(installPrePush({ project: path.join(f.root, scope) }).code, 0);
  const body = readFileSync(foreign, 'utf8');
  assert.equal(installPrePush({ project: path.join(f.root, 'mission control') }).changed, false);
  assert.equal(readFileSync(foreign, 'utf8'), body);
  const sha = f.commit('second/app.txt', 'ok'); const input = f.line(sha);
  assert.equal(f.hook(input).status, 7);
  assert.equal(readFileSync(path.join(f.root, 'chained-input'), 'utf8'), input);
  assert.equal(f.hook(f.line(f.commit('mission control/app.txt', 'launched'), sha)).status, 1);
  f.git('config', 'core.hooksPath', '.githooks');
  assert.equal(installPrePush({ project: path.join(f.root, 'second') }).code, 3);
  assert.equal(installPrePush({ project: path.join(f.root, 'second'), check: true }).code, 3);
});

test('nested shared hook reads state from the default-branch worktree', t => {
  const f = fixture(t); f.status('mission-control');
  const main = f.commit('mission-control/.pandacorp/status.yaml', 'phase: release\ndeploy_target: external\n');
  const linked = path.join(f.root, 'linked');
  f.git('worktree', 'add', '-qb', 'feature', linked);
  writeFileSync(path.join(linked, 'mission-control/.pandacorp/status.yaml'), 'phase: implementation\n');
  assert.equal(installPrePush({ project: path.join(linked, 'mission-control') }).code, 0);
  assert.equal(f.hook(f.line(main, f.initial), {}, linked).status, 1);
});

test('nested guard runs on real local-remote pushes and supports quoted literal project paths', t => {
  const f = fixture(t);
  const remote = path.join(f.root, 'remote.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote], { env });
  f.git('remote', 'add', 'origin', remote);
  f.git('push', '-q', 'origin', 'main');
  const scope = "project's [literal] $name"; f.status(scope);
  assert.equal(installPrePush({ project: path.join(f.root, scope) }).code, 0);
  assert.equal(installPrePush({ project: path.join(f.root, scope), check: true }).code, 0);
  const factory = f.commit('factory.md', 'factory update');
  f.git('push', '-q', 'origin', 'main');
  const touching = f.commit(`${scope}/app.txt`, 'product update');
  const push = spawnSync('git', ['-C', f.root, 'push', '-q', 'origin', 'main'], { env, encoding: 'utf8' });
  assert.notEqual(push.status, 0, push.stderr);
  assert.match(push.stderr, /PANDACORP_OWNER_RELEASE_OK/);
  assert.equal(f.git('rev-parse', 'refs/remotes/origin/main'), factory);
  assert.equal(f.hook(f.line(touching, factory), { PANDACORP_OWNER_RELEASE_OK: '1' }).status, 0);
});

test('root and nested registrations retain independent state', t => {
  const f = fixture(t); f.status('.', 'implementation'); f.status('mission-control');
  assert.equal(installPrePush({ project: f.root }).code, 0);
  assert.equal(installPrePush({ project: path.join(f.root, 'mission-control') }).code, 0);
  const factory = f.commit('factory.md', 'factory change');
  assert.equal(f.hook(f.line(factory)).status, 0);
  const product = f.commit('mission-control/app.txt', 'product change');
  assert.equal(f.hook(f.line(product, factory)).status, 1);
  f.status('mission-control', 'implementation'); f.status('.');
  assert.equal(f.hook(f.line(factory)).status, 1, 'root guard remains active after nested installation');
});

// Legacy v1 installation marker: it predates explicit pandacorp-projects registration.
const legacyV1 = '#!/bin/sh\n# pandacorp-pre-push v1\nexit 0\n';

test('v1 migration to a nested scope preserves a launched root product guard', t => {
  const f = fixture(t); f.status('.'); f.status('nested', 'implementation');
  writeFileSync(path.join(f.root, '.git/hooks/pre-push'), legacyV1, { mode: 0o755 });
  const sha = f.commit('factory.md', 'root-only change');
  assert.equal(installPrePush({ project: path.join(f.root, 'nested') }).code, 0);
  assert.equal(f.hook(f.line(sha)).status, 1, 'migration must retain root production protection');
  const hook = readFileSync(path.join(f.root, '.git/hooks/pre-push'), 'utf8');
  assert.match(hook, /^# pandacorp-projects \["\.","nested"\]$/m);
  assert.equal(installPrePush({ project: path.join(f.root, 'nested'), check: true }).code, 0);
  assert.equal(installPrePush({ project: path.join(f.root, 'nested') }).changed, false);
  const remote = path.join(f.root, 'remote.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote], { env });
  const push = spawnSync('git', ['-C', f.root, 'push', '-q', remote, 'main'], { env, encoding: 'utf8' });
  assert.notEqual(push.status, 0, 'real root push must be denied without owner authorization');
  assert.match(push.stderr, /PANDACORP_OWNER_RELEASE_OK/);
});

test('v1 migration recognizes a root product in the main worktree when installing from a linked checkout', t => {
  const f = fixture(t); f.status('.'); f.status('nested', 'implementation');
  const main = f.commit('.pandacorp/status.yaml', 'phase: release\ndeploy_target: external\n');
  f.commit('nested/.pandacorp/status.yaml', 'phase: implementation\n');
  const linked = path.join(f.root, 'linked'); f.git('worktree', 'add', '-qb', 'feature', linked);
  rmSync(path.join(linked, '.pandacorp/status.yaml'));
  writeFileSync(path.join(f.root, '.git/hooks/pre-push'), legacyV1, { mode: 0o755 });
  assert.equal(installPrePush({ project: path.join(linked, 'nested') }).code, 0);
  assert.equal(f.hook(f.line(main), {}, linked).status, 1, 'root product in main retains its guard');
});

test('v1 migration does not register factory runtime as a root product', t => {
  const f = fixture(t); f.status('mission-control'); f.put('.pandacorp/run/session.json', '{}');
  writeFileSync(path.join(f.root, '.git/hooks/pre-push'), legacyV1, { mode: 0o755 });
  assert.equal(installPrePush({ project: path.join(f.root, 'mission-control') }).code, 0);
  const hook = readFileSync(path.join(f.root, '.git/hooks/pre-push'), 'utf8');
  assert.match(hook, /^# pandacorp-projects \["mission-control"\]$/m);
  const factory = f.commit('factory.md', 'factory-only change');
  assert.equal(f.hook(f.line(factory)).status, 0);
  const touching = f.commit('mission-control/app.txt', 'product change');
  assert.equal(f.hook(f.line(touching, factory)).status, 1);
});
