#!/usr/bin/env node
// DR-076/140 regression: exercise the real template without DB services or Git writes.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const verify = fileURLToPath(new URL('../templates/stack-a-nextjs/verify.sh', import.meta.url));
let passed = 0;
function scenario({ script, args = [], cleanupExit = 0, suiteExit = 0, browserExit = 0 }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'template-database-clean-'));
  try {
    for (const folder of ['bin', 'src/_tests', 'e2e']) mkdirSync(path.join(dir, folder), { recursive: true });
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: script === undefined ? {} : { 'db:test:check-clean': script } }));
    writeFileSync(path.join(dir, 'playwright.config.ts'), '');
    for (const spec of ['smoke', 'visual', 'responsive', 'shell', 'headers']) writeFileSync(path.join(dir, `e2e/${spec}.spec.ts`), '');
    writeFileSync(path.join(dir, 'bin/pnpm'), `#!/bin/bash
printf '%s\\n' "$*" >> calls.log
case "$1" in
  db:test:check-clean) echo 'fixture: residual test database'; exit ${cleanupExit} ;;
  vitest) exit ${suiteExit} ;;
  exec) exit ${browserExit} ;;
  *) exit 0 ;;
esac
`, { mode: 0o755 });
    const result = spawnSync('bash', [verify, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: `${dir}/bin:${process.env.PATH}`, GIT_OPTIONAL_LOCKS: '0' } });
    assert.ifError(result.error);
    const report = JSON.parse(readFileSync(path.join(dir, '.pandacorp/run/gate-report.json'), 'utf8'));
    return { status: result.status, report, calls: readFileSync(path.join(dir, 'calls.log'), 'utf8').trim().split('\n') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
for (const script of [undefined, '', '   ']) {
  const r = scenario({ script });
  assert.equal(r.status, 0);
  assert.equal(r.report.green, true);
  assert.ok(!r.calls.includes('db:test:check-clean'));
  passed++;
}
for (const args of [[], ['--only=vitest'], ['--only=playwright'], ['--light', '--tests=src/_tests/db.test.ts']]) {
  const r = scenario({ script: 'node check-clean.mjs', args });
  assert.equal(r.status, 0);
  assert.equal(r.calls.at(-1), 'db:test:check-clean');
  assert.equal(r.calls.filter(c => c === 'db:test:check-clean').length, 1);
  assert.equal(r.report.subgates.at(-1).name, 'database-clean');
  assert.equal(r.report.subgates.at(-1).exit, 0);
  passed++;
}
{
  const r = scenario({ script: 'node check-clean.mjs', cleanupExit: 7 });
  assert.equal(r.status, 7);
  assert.equal(r.report.green, false);
  assert.equal(r.report.subgates.at(-1).name, 'database-clean');
  assert.equal(r.report.subgates.at(-1).exit, 7);
  assert.ok(r.report.subgates.at(-1).failures.length > 0);
  passed++;
}
for (const args of [['--only=tsc'], ['--light']]) {
  const r = scenario({ script: 'node check-clean.mjs', args, cleanupExit: 7 });
  assert.equal(r.status, 0);
  assert.ok(!r.calls.includes('db:test:check-clean'));
  passed++;
}
// The policy layer must preserve the failing runner's original exit in full and scoped gates.
// This does not change DR-140: a suite red still prevents the DB-clean postcondition.
for (const options of [
  { suiteExit: 9 },
  { args: ['--only=vitest'], suiteExit: 9 },
  { browserExit: 13 },
  { args: ['--only=playwright'], browserExit: 13 },
]) {
  const expected = options.suiteExit || options.browserExit;
  const runner = options.suiteExit ? 'vitest' : 'playwright';
  const r = scenario({ script: 'node check-clean.mjs', ...options });
  assert.equal(r.status, expected);
  assert.equal(r.report.green, false);
  assert.equal(r.report.subgates.find(g => g.name === runner).exit, expected);
  assert.ok(!r.calls.includes('db:test:check-clean'), 'retain the first suite failure');
  passed++;
}
console.log(`RESULT: ${passed} passed, 0 failed`);
