// DR-166 / INFRA-11: the advisory CI free-quota checker that /pandacorp:upgrade runs instead of
// overwriting a project-owned ci.yml.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { adviseProject, analyzeWorkflow, parseTriggers } from './check-ci-quota.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const templatePath = join(here, '..', 'templates', 'stack-a-nextjs', '.github', 'workflows', 'ci.yml');
const template = readFileSync(templatePath, 'utf8');
const rules = (findings) => findings.map((f) => f.rule).sort();

// 1. The factory template itself is compliant: zero findings.
assert.deepEqual(analyzeWorkflow(template, 'ci.yml'), []);

// 2. The pre-DR-166 shape: every branch, full suite + audit on push, no concurrency, no timeouts.
const legacy = `name: CI
on:
  push:
    branches: ['**']
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec vitest run
      - run: pnpm exec playwright test
  audit:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - run: pnpm audit --audit-level=high
`;
const found = analyzeWorkflow(legacy, 'ci.yml');
assert.deepEqual(rules(found), ['U1', 'U2', 'U2', 'U2', 'U3', 'U4']);
assert.ok(found.some((f) => /wildcard/.test(f.message)));

// 3. Inline trigger list and a bare push are read; a job restricted to dispatch is not "on push".
assert.deepEqual(Object.keys(parseTriggers('on: [push, pull_request]\njobs: {}\n')), ['push', 'pull_request']);
const gated = `on:
  push:
    branches: [main]
    paths-ignore:
      - "**/*.md"
  workflow_dispatch:
concurrency:
  group: ci-\${{ github.ref }}
  cancel-in-progress: true
jobs:
  full:
    if: github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - run: bash .pandacorp/verify.sh
  fast:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - run: bash .pandacorp/verify.sh --light
`;
assert.deepEqual(analyzeWorkflow(gated).map((f) => f.rule), ['U4'], 'only the slow timeout on the fast job');

// 4. Sub-hourly crons are flagged (U5); hourly and daily are not.
const crons = `on:
  schedule:
    - cron: "*/15 * * * *"
    - cron: "17 * * * *"
    - cron: "17 6 * * 1"
jobs:
  ping:
    runs-on: ubuntu-latest
    timeout-minutes: 2
    steps:
      - run: echo ok
`;
assert.deepEqual(analyzeWorkflow(crons).map((f) => f.rule), ['U5']);

// 5. No `on:` block is reported as unreadable, never as compliant.
assert.equal(analyzeWorkflow('jobs:\n  a:\n    runs-on: x\n')[0].rule, 'unreadable');

// 6. Project advice: missing / identical / customized, and the CLI never edits or fails.
const root = mkdtempSync(join(tmpdir(), 'ci-quota-'));
try {
  assert.equal(adviseProject(root, templatePath).ci, 'missing');
  const wf = join(root, '.github', 'workflows');
  mkdirSync(wf, { recursive: true });
  writeFileSync(join(wf, 'ci.yml'), template);
  assert.deepEqual(adviseProject(root, templatePath), { ci: 'identical', findings: [] });
  writeFileSync(join(wf, 'ci.yml'), legacy);
  writeFileSync(join(wf, 'probe.yml'), crons);
  const advice = adviseProject(root, templatePath);
  assert.equal(advice.ci, 'customized');
  assert.ok(advice.findings.some((f) => f.file === '.github/workflows/probe.yml' && f.rule === 'U5'));
  const cli = spawnSync(process.execPath, [join(here, 'check-ci-quota.mjs'), root], { encoding: 'utf8' });
  assert.equal(cli.status, 0);
  assert.match(cli.stdout, /project-owned and differs from the template: not overwritten/);
  assert.equal(readFileSync(join(wf, 'ci.yml'), 'utf8'), legacy, 'the checker never edits the workflow');
  const bad = spawnSync(process.execPath, [join(here, 'check-ci-quota.mjs')], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log('test-check-ci-quota: ok');
