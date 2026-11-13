#!/usr/bin/env node
import test from 'node:test';
import { MANAGED_OVERLAY_FILES } from './stage-managed-overlay.mjs';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const factoryIgnore = readFileSync(new URL('../../.gitignore', import.meta.url), 'utf8');
const projectIgnore = readFileSync(new URL('../../mission-control/.gitignore', import.meta.url), 'utf8');
const stageScript = fileURLToPath(new URL('./stage-managed-overlay.mjs', import.meta.url));
const managed = MANAGED_OVERLAY_FILES;
const privatePaths = ['run/build/state.json', 'comms/progress.md', 'inbox/decisions.md', 'accounts/services.yaml',
  'stats.json', 'stats-aggregate.json', 'navigation-identity.json', 'hooks/pre-push', 'credentials.env', 'unknown.sh'];
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' };
for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[k];
function fixture(t, nested) {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'nested-overlay-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const repo = path.join(temp, 'factory'); mkdirSync(repo);
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { env, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  const project = nested ? path.join(repo, 'mission-control') : repo;
  const put = (file, value = 'fixture\n') => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, value); };
  put(path.join(repo, '.gitignore'), nested ? factoryIgnore : '.pandacorp/comms/\n.pandacorp/inbox/\n.pandacorp/run/\n.pandacorp/accounts/\n');
  if (nested) put(path.join(project, '.gitignore'), projectIgnore);
  for (const file of [...managed, ...privatePaths]) put(path.join(project, '.pandacorp', file));
  if (nested) put(path.join(repo, '.pandacorp/run/session.json'));
  git('add', '.gitignore', ...(nested ? ['mission-control/.gitignore'] : [])); git('commit', '-qm', 'initial');
  const stage = (...args) => spawnSync(process.execPath, [stageScript, '--project', project, ...args], { env, encoding: 'utf8' });
  return { repo, project, temp, git, stage };
}

test('factory exceptions expose only named managed files; upgrade stages them and clone/worktree retain them', t => {
  const f = fixture(t, true);
  const prefix = 'mission-control/.pandacorp/';
  for (const file of managed) {
    assert.equal(spawnSync('git', ['-C', f.repo, 'check-ignore', '-q', prefix + file], { env }).status, 1, file);
  }
  for (const file of [...privatePaths.map(p => prefix + p), '.pandacorp/run/session.json', 'other/.pandacorp/verify.sh']) {
    assert.equal(spawnSync('git', ['-C', f.repo, 'check-ignore', '-q', file], { env }).status, 0, file);
  }
  assert.equal(f.stage('--dry-run').status, 0);
  assert.equal(f.git('diff', '--cached', '--name-only'), '');
  const result = f.stage(); assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(f.git('diff', '--cached', '--name-only').split('\n').sort(), managed.map(p => prefix + p).sort());
  f.git('commit', '-qm', 'upgrade');
  const clone = path.join(f.temp, 'clone');
  execFileSync('git', ['clone', '-q', '--local', f.repo, clone], { env });
  const worktree = path.join(f.temp, 'worktree'); f.git('worktree', 'add', '-qb', 'fixture', worktree);
  for (const checkout of [clone, worktree]) {
    for (const file of managed) assert.equal(existsSync(path.join(checkout, prefix, file)), true, file);
    for (const file of privatePaths) assert.equal(existsSync(path.join(checkout, prefix, file)), false, file);
  }
  assert.equal(f.stage().status, 0);
  assert.equal(f.git('diff', '--cached', '--name-only'), '');
});

test('standalone upgrade stages only the same allowlist without changing ignore rules', t => {
  const f = fixture(t, false); const before = readFileSync(path.join(f.repo, '.gitignore'), 'utf8');
  const result = f.stage(); assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(f.git('diff', '--cached', '--name-only').split('\n').sort(), managed.map(p => '.pandacorp/' + p).sort());
  assert.equal(readFileSync(path.join(f.repo, '.gitignore'), 'utf8'), before);
  assert.equal(spawnSync('git', ['-C', f.repo, 'check-ignore', '-q', '.pandacorp/comms/progress.md'], { env }).status, 0);
});

test('nested upgrades explicitly stage managed files even below an inherited broad ignore', t => {
  const f = fixture(t, true); writeFileSync(path.join(f.repo, '.gitignore'), '.pandacorp/\n');
  assert.equal(f.stage().status, 0);
  assert.deepEqual(f.git('diff', '--cached', '--name-only').split('\n').sort(), managed.map(p => 'mission-control/.pandacorp/' + p).sort());
});

test('staging refuses symlink machinery instead of exposing private targets', t => {
  const f = fixture(t, true); const file = path.join(f.project, '.pandacorp/guide.md');
  rmSync(file); symlinkSync('accounts/services.yaml', file);
  assert.notEqual(f.stage().status, 0);
  assert.equal(f.git('diff', '--cached', '--name-only'), '');
});


test('combined factory and project ignores expose only the project-root env example', t => {
  const f = fixture(t, true);
  writeFileSync(path.join(f.project, '.env.example'), 'PUBLIC_EXAMPLE=fixture\n');
  writeFileSync(path.join(f.project, '.pandacorp/.env.example'), 'PRIVATE_EXAMPLE=fixture\n');
  f.git('add', '-A');
  assert.deepEqual(f.git('diff', '--cached', '--name-only').split('\n').sort(), [
    'mission-control/.env.example', ...managed.map(p => 'mission-control/.pandacorp/' + p),
  ].sort(), 'ordinary staging must exclude overlay .env.example even with the child negation');
});

test('combined ignore rules reject private descendants of directories named like every allowed source file', t => {
  const f = fixture(t, true);
  for (const file of managed) {
    const name = path.join(f.project, '.pandacorp', file);
    rmSync(name);
    mkdirSync(path.join(name, 'accounts'), { recursive: true });
    writeFileSync(path.join(name, 'accounts/private.key'), 'fake-fixture-key\n');
    writeFileSync(path.join(name, '.env.example'), 'PRIVATE_EXAMPLE=fixture\n');
  }
  f.git('add', '-A');
  assert.equal(f.git('diff', '--cached', '--name-only'), '', 'allowlisted filenames must not open directories');
});
