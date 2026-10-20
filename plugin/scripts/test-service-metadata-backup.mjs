#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, unlinkSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tmp = mkdtempSync(path.join(os.tmpdir(), 'pandacorp-metadata-backup-'));
try {
  const repo = path.join(tmp, 'factory-fixture');
  const vault = path.join(tmp, 'pandacorp-vault');
  mkdirSync(path.join(repo, 'factory'), { recursive: true });
  mkdirSync(path.join(repo, '.pandacorp/accounts'), { recursive: true });
  mkdirSync(path.join(vault, 'services'), { recursive: true });
  const registry = '{"schema_version":1,"accounts":[]}\n';
  const associations = '{"schema_version":1,"services":[]}\n';
  const source = path.join(vault, 'services/accounts.yaml');
  writeFileSync(source, registry, { mode: 0o600 });
  writeFileSync(path.join(vault, 'services/provider-secret.txt'), 'must-not-copy');
  writeFileSync(path.join(repo, '.pandacorp/accounts/services.yaml'), associations);
  writeFileSync(path.join(repo, '.pandacorp/accounts/local-secret.txt'), 'must-not-copy');
  const script = fileURLToPath(new URL('./backup-pandacorp-state.sh', import.meta.url));
  const run = () => execFileSync('bash', [script, repo], { encoding: 'utf8' });
  assert.match(run(), /Pandacorp backup: \d+ files/);
  const snapshots = path.join(vault, 'backups/factory-fixture');
  const day = readdirSync(snapshots)[0];
  const dest = path.join(snapshots, day);
  const backed = path.join(dest, 'vault-services/accounts.yaml');
  assert.equal(readFileSync(backed, 'utf8'), registry);
  assert.equal(statSync(backed).mode & 0o777, 0o600);
  assert.equal(statSync(path.dirname(backed)).mode & 0o777, 0o700);
  assert.deepEqual(readdirSync(path.dirname(backed)), ['accounts.yaml']);
  assert.equal(readFileSync(path.join(dest, '.pandacorp/accounts/services.yaml'), 'utf8'), associations);
  assert.deepEqual(readdirSync(path.join(dest, '.pandacorp/accounts')), ['services.yaml']);
  unlinkSync(source);
  run();
  assert.equal(readFileSync(backed, 'utf8'), registry, 'snapshot must survive source deletion within day');
  writeFileSync(source, readFileSync(backed), { mode: 0o600 });
  assert.deepEqual(JSON.parse(readFileSync(source, 'utf8')), JSON.parse(registry), 'restore reviewed snapshot to canonical path');
  console.log('PASS: registry + project metadata included, adjacent secrets excluded, private snapshot permissions, additive retention and restore');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
