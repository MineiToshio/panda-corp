#!/usr/bin/env node
// Run the real template sentinel callbacks without a browser. Broken applicability must go RED.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const root = new URL('../templates/stack-a-nextjs/e2e/', import.meta.url);
const cases = [
  ['smoke', 'BLESSED'], ['visual', 'VISUAL_BLESSED'], ['responsive', 'BLESSED'],
  ['page-errors', 'SURFACES'], ['shell', 'NAV_DESTINATIONS'], ['tokens', 'BLESSED'],
];
let ran = 0;
for (const [name, collection] of cases) {
  const source = readFileSync(new URL(`${name}.spec.ts`, root), 'utf8');
  const body = source.match(/test\("[^"]*harness present", \(\) => \{([\s\S]*?)\n\}\);/)?.[1];
  assert.ok(body, `${name}: sentinel callback exists`);
  const skipped = Symbol('skip');
  function run(values) {
    const context = {
      ...values,
      test: { skip(condition, reason) { if (condition) { assert.ok(reason.length > 0); throw skipped; } } },
      expect(value) { return { toBeGreaterThan(limit) { assert.ok(value > limit); } }; },
    };
    try { vm.runInNewContext(body, context); return 'pass'; }
    catch (e) { if (e === skipped) return 'skip'; throw e; }
  }
  const values = { [collection]: [{}], SURFACES: [{}], HAS_SHELL: true, GATE_PROD: true };
  assert.equal(run(values), 'pass');
  const empty = { ...values, [collection]: [], ...(name === 'shell' ? { HAS_SHELL: false } : {}) };
  if (name === 'page-errors') {
    assert.equal(run(empty), 'skip', 'production server without UI is not applicable');
    assert.equal(run({ ...values, GATE_PROD: false }), 'skip');
    assert.equal(run({ ...empty, GATE_PROD: false }), 'skip');
  } else assert.equal(run(empty), 'skip');
  if (name === 'shell') assert.throws(() => run({ ...values, SURFACES: [] }));
  ran++;
}
const shell = readFileSync(new URL('shell.spec.ts', root), 'utf8');
assert.match(shell, /test\.skip\(true, "No NAV_DESTINATIONS:/);
console.log(`OK: ${ran} real sentinel callbacks: applicable/non-applicable/empty-contract cases; explicit no-shell skip`);
