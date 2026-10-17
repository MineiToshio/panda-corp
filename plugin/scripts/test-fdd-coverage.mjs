#!/usr/bin/env node
// test-fdd-coverage.mjs — the FDD <-> oracle coverage check (DR-130, BL-0239), run as a real process against static
// fixtures: fixtures/fdd-coverage/base (two UI FRDs with shard mocks, a copy file, a prototype and an oracle table)
// plus one overlay. `funko-like` reproduces funko-tracker FRD-06 (2026-10-17): an FDD that specifies an operator
// console the prototype never drew, pictureless GAP rows, an override of the prototype and a plan for undrawn UI. It
// must go RED on every check. `synced` is the same project with an FDD and a plan that name only captured UI: GREEN.
// Run: node plugin/scripts/test-fdd-coverage.mjs

import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.join(__dirname, 'fixtures/fdd-coverage')
const CHECK = path.resolve(__dirname, '../skills/design/scripts/check-fdd-coverage.mjs')
const { mockStates } = await import(CHECK)

let pass = 0
let fail = 0
const ok = (cond, msg) => { if (cond) { pass++; console.log(`  ✓ ${msg}`) } else { fail++; console.log(`  ✗ ${msg}`) } }
const tmpDirs = []

function mkProject(overlay) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'fdd-coverage-'))
  tmpDirs.push(dir)
  cpSync(path.join(FIXTURES, 'base'), dir, { recursive: true })
  if (overlay) cpSync(path.join(FIXTURES, overlay), dir, { recursive: true })
  return dir
}
const run = (cwd, ...args) => {
  const r = spawnSync(process.execPath, [CHECK, ...args], { cwd, encoding: 'utf8' })
  return { status: r.status, out: r.stdout, err: r.stderr }
}
const block = (out, label) => {
  const lines = out.split('\n')
  const i = lines.findIndex((l) => l.includes(label))
  if (i < 0) return ''
  const end = lines.findIndex((l, j) => j > i && !l.startsWith('          '))
  return lines.slice(i, end < 0 ? undefined : end).join('\n')
}

console.log('mock text extraction: what a captured state draws')
{
  const html = `<section class="mock-screen" id="a"><h2 class="mock-title">Title Chrome</h2><p>Drawn &amp; shown</p><p hidden>Hidden text</p>
<div data-demo-only><b>Demo text</b></div><input placeholder="Buscar piezas"><script>var s = "Script text";</script><svg><title>Svg text</title></svg>
<div class="mock-overlay"><p class="mock-note">Overlay</p><dialog open><button aria-label="Cerrar diálogo">x</button></dialog></div></section>
<section class="mock-screen" id="b"><p>Second state</p></section>`
  const states = mockStates(html, 'file')
  ok([...states.keys()].join() === 'a,b', 'one state per mock-screen section, keyed by its id')
  const a = states.get('a')
  ok(a.includes('drawn&shown') && a.includes('buscarpiezas') && a.includes('cerrardiálogo'), 'visible text, placeholder and aria-label count (entities decoded)')
  ok(!/chrome|overlay|hiddentext|demotext|scripttext|svgtext/.test(a), 'shard chrome, hidden, demo-only, script and svg content do not count')
  ok(states.get('b') === 'secondstate', 'text is attributed to its own section')
  const plain = mockStates('<main><h1>Home</h1></main>', 'home')
  ok([...plain.keys()].join() === 'home' && plain.get('home') === 'home', 'a hand-drawn mock without sections is one state named by its file stem')
}

console.log('funko-like: an FDD that specifies UI the oracle never captured is RED on every check')
{
  const r = run(mkProject('funko-like'), '--plan')
  ok(r.status === 1 && /^NOT COVERED: \d+ failing$/m.test(r.out) && r.err === '', `exit 1, NOT COVERED, no stderr (got ${r.status} ${r.err.slice(0, 120)})`)
  const rows = block(r.out, 'frd-06-operator: every FDD screen and state row cites a captured oracle state')
  ok(rows.startsWith('FAIL'), 'the screen/state rows check fails')
  ok(/"S1": cites no captured state$/m.test(rows), 'a row pointing at the mock file but not at a state id fails')
  ok(/"S3": cites no captured state \(a GAP with no capture/.test(rows) && /"G2": cites no captured state \(a GAP with no capture/.test(rows), 'pictureless GAP rows fail with the GAP hint')
  ok(/"Partial run \(default\)": cites no captured state/.test(rows), 'a prototype-state row without its oracle id fails')
  const copy = block(r.out, 'frd-06-operator: every UI string the FDD names is drawn in its captured states')
  ok(copy.startsWith('FAIL'), 'the named-copy check fails')
  ok(/`ops\.backfill\.new` "Nueva carga" \(not in the prototype at all/.test(copy), '"Nueva carga" is in the copy file only: not drawn (a script string or the shard title does not count)')
  ok(/`ops\.run\.select\.label` "Ver ejecución"/.test(copy), '"Ver ejecución" inside a demo-only block is not drawn')
  ok(/`ops\.candidate\.back` "Volver a la cola"/.test(copy), '"Volver a la cola" on a hidden element is not drawn')
  ok(/`ops\.delta\.configure` "Configurar"/.test(copy), '"Configurar" inside an svg title is not drawn')
  ok(/`ops\.queue\.more` "Ver más candidatos" \(in the prototype but in no captured state/.test(copy), 'a string only in the prototype source gets the "add a configured state" hint')
  ok(/`common\.cancel` "Cancelar" \(captured only in frd-01-catalog/.test(copy), 'a string captured only in another FRD fails when the line does not name that FRD')
  ok(!/ops\.title|ops\.run\.resume|ops\.queue\.count/.test(copy), 'drawn strings pass (entity-decoded H1, the button, an ICU plural by its literal fragment)')
  const override = block(r.out, 'frd-06-operator: the FDD does not overrule the prototype')
  ok(override.startsWith('FAIL') && /is a demonstration, not the initial state/.test(override), 'the override sentence fails')
  ok(/^OK\s+frd-06-operator: every FDD screen and state row cites an oracle-states\.json entry/m.test(r.out), 'no cited state, so nothing is missing from the oracle table (the rows check carries the failure)')
  const plan = block(r.out, 'frd-06-operator: blueprint and work orders plan only UI its captured states draw')
  ok(plan.startsWith('FAIL') && /blueprint\.md line \d+ `ops\.backfill\.new`/.test(plan) && /work-orders\/WO-06-001\.md line \d+ `ops\.run\.select\.label` "Ver ejecución"/.test(plan), '--plan fails the blueprint and the work order that plan undrawn UI')
  ok(!/README\.md/.test(plan) && !/ops\.run\.resume/.test(plan), 'the work-orders index is skipped and drawn copy in the plan passes')
  ok(/^OK\s+frd-01-catalog: every UI string/m.test(r.out) && !/frd-02-api/.test(r.out), 'a synced FRD passes; a non-UI FRD is not checked')
  const json = JSON.parse(run(mkProject('funko-like'), '--json').out)
  ok(json.ok === false && json.checks.some((c) => c.status === 'FAIL' && c.details.length), '--json reports ok false with details')
}

console.log('synced: an FDD and a plan that name only captured UI are GREEN')
{
  const r = run(mkProject('synced'), '--plan')
  ok(r.status === 0 && /^COVERED$/m.test(r.out), `exit 0 and COVERED (got ${r.status}: ${r.out.split('\n').filter((l) => /^FAIL/.test(l) || l.startsWith('          ')).join(' | ')})`)
  ok(!/^FAIL/m.test(r.out), 'no FAIL line')
  ok(/^OK\s+frd-06-operator: every FDD screen and state row cites an oracle-states\.json entry/m.test(r.out), 'every row cites the oracle table entry')
  ok(/^OK\s+frd-06-operator: blueprint and work orders plan only UI/m.test(r.out), '--plan passes')
}

console.log('scoping and fail-closed edges')
{
  const only = run(mkProject('funko-like'), '--frd', 'frd-01')
  ok(only.status === 0 && !/frd-06/.test(only.out), '--frd limits the check to one FRD')
  const noCopy = mkProject('synced')
  rmSync(path.join(noCopy, 'docs/design/microcopy.es.json'))
  const r = run(noCopy)
  ok(r.status === 1 && /^FAIL\s+machine-readable copy file/m.test(r.out), 'a UI project without a keyed copy file is RED, not silently skipped')
  const noMocks = mkProject('synced')
  rmSync(path.join(noMocks, 'docs/frds/frd-06-operator/mocks'), { recursive: true })
  ok(/^FAIL\s+frd-06-operator: FDD <-> oracle coverage[\s\S]*no captured state in mocks/m.test(run(noMocks).out), 'an FDD with no captured state at all is RED')
  const empty = mkdtempSync(path.join(os.tmpdir(), 'fdd-coverage-empty-'))
  tmpDirs.push(empty)
  const e = run(empty)
  ok(e.status === 0 && /COVERED \(no UI FRD\)/.test(e.out), 'a project with no UI FRD has nothing to cover')
}

for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true })
console.log(`\npassed: ${pass}   failed: ${fail}`)
process.exit(fail ? 1 : 0)
