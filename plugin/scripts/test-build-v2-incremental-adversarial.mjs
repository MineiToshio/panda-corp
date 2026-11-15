#!/usr/bin/env node
// Independent owner-contract tests: UI provenance, specialist order and bounded WO planning edits.
import assert from 'node:assert/strict';
import { changePreparationUnits, existingWoAmendmentProblem } from '../runtime/build/incremental.mjs';
import { plan } from '../runtime/build/planner.mjs';
let passed = 0;
let failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); } };
const input = (design = null, extra = {}) => ({ scope: { card: 'change', wos: ['wo-01'], frds: [], out_of_scope: [] }, wos: [{ id: 'wo-01', frd: 'frd-01', status: 'PLANNED', artifacts: ['src/widget.tsx'], source_change: ['change'], dependsOn: [], ...extra }], units: [], design });
const opts = { cellOf: () => ({ runtime: 'codex', model: 'gpt-6.1-sol', effort: 'high' }) };
test('agreed conversation source skips designer, retaining specialist order', () => {
  const card = { ui: true, design_source: 'agreed', design_refs: ['owner message: add the agreed compact modal'] };
  assert.deepEqual(changePreparationUnits(card, 'change').map(u => u.role), ['product-manager', 'architect']);
  assert.equal(plan(input(card), opts).units.some(u => u.role === 'designer'), false);
});
test('missing UI provenance is detected from WO despite non-UI card', () => {
  const result = plan(input({ ui: false, design_source: 'not-applicable' }), opts);
  const designer = result.units.find(u => u.role === 'designer');
  assert.ok(designer);
  assert.ok(result.units.find(u => u.kind === 'build').depends_on.includes(designer.id));
  assert.equal(result.deadlock, null);
});
test('pending card serializes PM, designer, architect', () => {
  const units = changePreparationUnits({ ui: true, design_source: 'pending' }, 'change');
  assert.deepEqual(units.map(u => u.role), ['product-manager', 'designer', 'architect']);
  assert.deepEqual(units[1].depends_on, [units[0].id]);
  assert.deepEqual(units[2].depends_on, [units[1].id]);
});
test('independent backend work runs while missing UI design is prepared', () => {
  const data = input();
  data.scope.wos.push('wo-02');
  data.wos.push({ id: 'wo-02', frd: 'frd-02', status: 'PLANNED', artifacts: ['src/api.ts'], source_change: ['change'], dependsOn: [] });
  const result = plan(data, opts);
  const designer = result.units.find(u => u.role === 'designer');
  assert.ok(result.rounds[0].includes(designer.id));
  assert.ok(result.rounds[0].includes('u-build-wo-02'));
  assert.ok(!result.rounds[0].includes('u-build-wo-01'));
});
test('agreed label without evidence cannot bypass lightweight design', () => {
  assert.ok(plan(input({ ui: true, design_source: 'agreed', design_refs: [] }), opts).units.some(u => u.role === 'designer'));
});
test('architect may amend pending WOs before builder claims are created', () => {
  const data = input(null, { artifacts: ['src/api.ts'] });
  data.units = changePreparationUnits({ ui: false }, 'change');
  const result = plan(data, opts);
  assert.ok(!result.units.some(u => result.now.includes(u.id) && ['build', 'patch'].includes(u.kind)), 'planning must not claim a WO while its architect can still amend frontmatter');
});
const wo = (status, more = '') => `---\nid: wo-01\nstatus: ACTIVE\nimplementation_status: ${status}\nsource_change: [previous${status === 'PLANNED' ? ', change' : ''}]\nreopen_count: ${status === 'PLANNED' ? 1 : 0}\n${more}---\n## Status Note\nReopen for change: new acceptance criterion.\n`;
const args = { unit: { kind: 'docs', role: 'architect' }, card: 'change', before: wo('VERIFIED'), after: wo('PLANNED') };
test('card architect may reopen a verified WO with preserved provenance', () => assert.equal(existingWoAmendmentProblem(args), null));
test('builder cannot masquerade as planning amendment', () => assert.ok(existingWoAmendmentProblem({ ...args, unit: { kind: 'build', role: 'architect' } })));
test('architect cannot alter WO identity', () => assert.ok(existingWoAmendmentProblem({ ...args, after: wo('PLANNED').replace('id: wo-01', 'id: wo-02') })));
test('architect cannot drop prior card provenance', () => assert.ok(existingWoAmendmentProblem({ ...args, after: wo('PLANNED').replace('[previous, change]', '[change]') })));
test('architect cannot reopen already claimed WO', () => assert.ok(existingWoAmendmentProblem({ ...args, claimed: true })));
test('architect cannot invent reopening count', () => assert.ok(existingWoAmendmentProblem({ ...args, after: wo('PLANNED').replace('reopen_count: 1', 'reopen_count: 0') })));
test('architect cannot activate a draft WO through amendment', () => assert.ok(existingWoAmendmentProblem({ ...args, before: wo('VERIFIED').replace('status: ACTIVE', 'status: DRAFT') })));
console.log(`${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
