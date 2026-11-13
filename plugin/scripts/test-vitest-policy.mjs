import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pandacorpVitest } from '../templates/stack-a-nextjs/vitest-policy.ts';

test('Node by default, isolated; leaves runner worker/seed/order defaults untouched', () => {
  const prior = process.env.PANDACORP_VITEST_MAX_WORKERS;
  delete process.env.PANDACORP_VITEST_MAX_WORKERS;
  try {
    const policy = pandacorpVitest().test;
    assert.equal(policy.environment, 'node');
    assert.equal(policy.isolate, true);
    assert.equal('maxWorkers' in policy, false);
    assert.equal('sequence' in policy, false);
    assert.equal(policy.projects.length, 1);
    assert.deepEqual(policy.include, []);
    assert.deepEqual(policy.projects[0].test.exclude, ['**/node_modules/**', '**/.git/**']);
    assert.deepEqual(policy.projects[0].test.setupFiles, []);
  } finally { if (prior !== undefined) process.env.PANDACORP_VITEST_MAX_WORKERS = prior; }
});
test('DOM globs partition discovery; DOM setup never runs in Node; global setup stays root-owned', () => {
  const policy = pandacorpVitest({ test: { exclude: ['e2e/**'], setupFiles: ['common.ts'] } }, { dom: ['**/*.test.tsx', 'src/dom.test.ts'], domSetupFiles: ['jest-dom.ts'] }).test;
  const [node, dom] = policy.projects;
  assert.deepEqual(node.test.exclude, ['e2e/**', '**/*.test.tsx', 'src/dom.test.ts']);
  assert.deepEqual(node.test.setupFiles, ['common.ts']);
  assert.deepEqual(dom.test.include, ['**/*.test.tsx', 'src/dom.test.ts']);
  assert.deepEqual(dom.test.setupFiles, ['common.ts', 'jest-dom.ts']);
  assert.equal(dom.test.environment, 'jsdom');
  for (const p of policy.projects) {
    assert.equal(p.extends, undefined);
    assert.equal(p.test.isolate, true);
    assert.deepEqual(p.test.globalSetup, []);
  }
});
test('worker override preserves project default when unset, validates integer and overflow', () => {
  const prior = process.env.PANDACORP_VITEST_MAX_WORKERS;
  try {
    delete process.env.PANDACORP_VITEST_MAX_WORKERS;
    assert.equal(pandacorpVitest({}, { defaultMaxWorkers: 5 }).test.maxWorkers, 5);
    const retained = pandacorpVitest({ test: { maxWorkers: 8 } });
    assert.equal(retained.test.maxWorkers, 8);
    assert.ok(retained.test.projects.every(p => p.test.maxWorkers === undefined));
    process.env.PANDACORP_VITEST_MAX_WORKERS = '3';
    const override = pandacorpVitest({ test: { maxWorkers: 8 } }, { dom: ['dom.test.ts'] });
    assert.equal(override.test.maxWorkers, 3);
    assert.ok(override.test.projects.every(p => p.test.maxWorkers === undefined));
    assert.throws(() => pandacorpVitest({ test: { projects: [] } }), /Migrate existing/);
    assert.equal(pandacorpVitest({}, { defaultMaxWorkers: 5 }).test.maxWorkers, 3);
    for (const invalid of ['', '0', '-1', '1.5', '50%', 'wat', '999999999999999999999']) {
      process.env.PANDACORP_VITEST_MAX_WORKERS = invalid;
      assert.throws(() => pandacorpVitest(), /positive/);
    }
  } finally {
    if (prior === undefined) delete process.env.PANDACORP_VITEST_MAX_WORKERS;
    else process.env.PANDACORP_VITEST_MAX_WORKERS = prior;
  }
});

test('real Vitest runner keeps both cases, DOM-only jest-dom and one root global setup', async () => {
  const { spawnSync } = await import('node:child_process');
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { fileURLToPath } = await import('node:url');
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const deps = process.env.PANDACORP_TEMPLATE_DEPS_DIR ?? path.join(root, 'mission-control');
  const fixture = fs.mkdtempSync(path.join(tmpdir(), 'vitest-policy-'));
  try {
    fs.mkdirSync(path.join(fixture, 'node_modules'));
    for (const pkg of ['vitest', '@testing-library', 'jsdom']) {
      fs.symlinkSync(path.join(deps, 'node_modules', pkg), path.join(fixture, 'node_modules', pkg), 'dir');
    }
    fs.mkdirSync(path.join(fixture, 'node_modules/fake'));
    fs.writeFileSync(path.join(fixture, 'node_modules/fake/vendor.test.ts'), `throw new Error('dependency test discovered');`);
    fs.copyFileSync(new URL('../templates/stack-a-nextjs/vitest-policy.ts', import.meta.url), path.join(fixture, 'vitest-policy.ts'));
    fs.writeFileSync(path.join(fixture, 'package.json'), '{"type":"module"}\n');
    fs.writeFileSync(path.join(fixture, 'vitest.config.ts'), `import { defineConfig } from 'vitest/config';
import { pandacorpVitest } from './vitest-policy';
export default defineConfig(pandacorpVitest({ test: { include: ['**/*.test.ts'], globalSetup: ['./global.ts'] } }, {dom:['dom.test.ts'], domSetupFiles:['./dom-setup.ts']}));`);
    fs.writeFileSync(path.join(fixture, 'global.ts'), `import { appendFileSync } from 'node:fs'; export default () => { appendFileSync('global-count', 'once\\n'); };`);
    fs.writeFileSync(path.join(fixture, 'dom-setup.ts'), `import '@testing-library/jest-dom/vitest'; if(typeof window === 'undefined') throw new Error('DOM setup leaked into Node');`);
    // A local dependency with a poison test catches loss of Vitest's native exclusions.
    // Keep it beside (not inside) the symlinked real dependencies.
    fs.mkdirSync(path.join(fixture, '.git'), { recursive: true });
    fs.writeFileSync(path.join(fixture, '.git/poison.test.ts'), `throw new Error('git test discovered');`);
    fs.writeFileSync(path.join(fixture, 'node.test.ts'), `import { test, expect } from 'vitest'; test('node-only', () => { expect(typeof window).toBe('undefined'); expect(() => expect(null).toBeInTheDocument()).toThrow(/Invalid Chai property/); });`);
    fs.writeFileSync(path.join(fixture, 'dom.test.ts'), `import { test, expect } from 'vitest'; test('dom-only', () => { document.body.innerHTML='<p>Hello</p>'; expect(document.querySelector('p')).toBeInTheDocument(); });`);
    const run = spawnSync(path.join(deps, 'node_modules/.bin/vitest'), ['run', '--reporter=json', '--sequence.shuffle', '--sequence.seed=159'], {
      cwd: fixture, encoding: 'utf8', env: { ...process.env, PANDACORP_VITEST_MAX_WORKERS: '2' }, timeout: 60000,
    });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const result = JSON.parse(run.stdout);
    assert.equal(result.numTotalTests, 2);
    assert.equal(result.numPassedTests, 2);
    assert.equal(result.testResults.length, 2);
    assert.equal(new Set(result.testResults.map(r => r.name)).size, 2);
    assert.equal(fs.readFileSync(path.join(fixture, 'global-count'), 'utf8'), 'once\n');
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
});
