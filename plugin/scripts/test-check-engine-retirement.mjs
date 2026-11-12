#!/usr/bin/env node
import assert from 'node:assert/strict';
import { auditRetirement, resolvedImports } from './check-engine-retirement.mjs';
let passed = 0;
const retired = ['.claude/engines/' + 'pandacorp-build' + '.js', '.claude/workflows/' + 'pandacorp-build' + '.js'];
const manifest = 'plugin/templates/retired-files.json';
const deleted = new Set(['plugin/skills/' + 'change/SKILL.md', 'plugin/agents/' + 'mech.md', 'plugin/runtime/old.mjs']);
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };
const audit = pairs => auditRetirement({ files: new Map([[manifest, JSON.stringify(retired)], ...pairs]), deleted });
test('mandatory retirement manifest passes while its raw evidence survives', () => {
  const result = audit([]); assert.equal(result.ok, true); assert.equal(result.raw.length, 1);
});
test('missing and modified manifest fail closed', () => {
  assert.equal(audit([[manifest, '[]']]).ok, false);
  assert.equal(auditRetirement({ files: new Map(), deleted }).ok, false);
});
test('remaining skills and unrelated agent with the same basename pass', () => {
  assert.equal(audit([['plugin/skills/design/SKILL.md', 'Read plugin/skills/design/SKILL.md and plugin/agents/other/mech.md.']]).ok, true);
});
for (const source of ["import x from './old.mjs';", "export { x } from './old.mjs';", "import('./old.mjs');", "require('./old.mjs');", "import './old.mjs';", "import './old';"]) {
  test('resolved deleted import fails: ' + source, () => {
    assert.equal(resolvedImports('plugin/runtime/current.mjs', source, deleted).length, 1);
    assert.equal(audit([['plugin/runtime/current.mjs', source]]).ok, false);
  });
}
test('same-basename relative import to a surviving directory passes', () => {
  assert.deepEqual(resolvedImports('plugin/runtime/other/current.mjs', "import './old.mjs'", deleted), []);
});
const importFixture = specifier => ['import', JSON.stringify(specifier)].join(' ');
test('SKILL.md and mech.md imports use the importing directory, including normalized traversal', () => {
  assert.deepEqual(resolvedImports('plugin/skills/design/helper.mjs', importFixture('./SKILL.md'), deleted), []);
  assert.equal(resolvedImports('plugin/skills/design/helper.mjs', importFixture('../change/SKILL.md'), deleted).length, 1);
  assert.deepEqual(resolvedImports('plugin/other/helper.mjs', importFixture('./mech.md'), deleted), []);
  assert.equal(resolvedImports('plugin/other/helper.mjs', importFixture('../agents/./mech.md'), deleted).length, 1);
});
test('document and shell references to complete deleted paths fail', () => {
  assert.equal(audit([['plugin/docs/current.md', 'Run node plugin/runtime/old.mjs']]).ok, false);
  assert.equal(audit([['plugin/runtime/run.sh', 'node old.mjs']]).ok, false);
});
test('exceptions cannot hide live imports, and historical fixture exemption is path-exact', () => {
  const source = 'Dynamic' + ' Workflows';
  assert.equal(audit([['plugin/scripts/fixtures/audit-last-green/f1-commits.json', source]]).ok, true);
  assert.equal(audit([['plugin/scripts/fixtures/other.json', source]]).ok, false);
  assert.equal(audit([['plugin/docs/decision-log.mjs', "import '../runtime/old.mjs'"]]).ok, false);
});
console.log(`RESULT ${passed} passed, 0 failed`);
