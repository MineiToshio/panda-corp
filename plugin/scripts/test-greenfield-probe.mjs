#!/usr/bin/env node
// test-greenfield-probe.mjs — fixture tests of greenfield-probe.mjs, the facts behind the engine's greenfield
// baseline decision (9.118.2). Each case builds a real project tree and runs the real script; the oracle is the
// parsed, seal-verified stdout line.

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifySealedLine } from './drift-seal.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(__dirname, 'greenfield-probe.mjs')

let passed = 0
let failed = 0
const ok = (cond, msg) => { if (cond) { passed++; console.log(`  ✓ ${msg}`) } else { failed++; console.log(`  ✗ ${msg}`) } }

const woMd = (id, status) => `---\nid: ${id}\nstatus: ACTIVE\n${status === null ? '' : `implementation_status: ${status}\n`}---\n# ${id}\n\n## Status Note\nimplementation_status: VERIFIED (prose, not the field)\n`

function mkProject({ statusYaml, wos = {} }) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'greenfield-probe-'))
  if (statusYaml !== undefined) {
    mkdirSync(path.join(dir, '.pandacorp'), { recursive: true })
    writeFileSync(path.join(dir, '.pandacorp', 'status.yaml'), statusYaml)
  }
  for (const [rel, content] of Object.entries(wos)) {
    const p = path.join(dir, 'docs', 'frds', rel)
    mkdirSync(path.dirname(p), { recursive: true })
    writeFileSync(p, content)
  }
  return dir
}

function run(dir) {
  const r = spawnSync(process.execPath, [SCRIPT, '--project', dir], { encoding: 'utf8' })
  const line = r.stdout.trim()
  let parsed = null
  try { parsed = JSON.parse(line) } catch { parsed = null }
  return { status: r.status, line, parsed, sealed: verifySealedLine(line).ok }
}

const cases = [
  ['greenfield: empty last_green_sha, every WO PLANNED/DRAFT', () => {
    const dir = mkProject({
      statusYaml: 'project: bench\nphase: implementation\nlast_green_sha: ""     # written by the gate\nsafe_to_test: false\n',
      wos: {
        'frd-01-a/work-orders/wo-01-001-x.md': woMd('WO-01-001', 'PLANNED'),
        'frd-01-a/work-orders/wo-01-002-y.md': woMd('WO-01-002', 'PLANNED'),
        'frd-02-b/work-orders/wo-02-001-z.md': woMd('WO-02-001', 'DRAFT'),
        'frd-02-b/work-orders/README.md': '# not a work order\n',
      },
    })
    const r = run(dir)
    ok(r.status === 0 && r.sealed, 'exit 0 with a valid seal')
    ok(r.parsed && r.parsed.ok === true && r.parsed.probe === 'greenfield', 'ok:true greenfield line')
    ok(r.parsed && r.parsed.lastGreenSha === '', 'quoted-empty last_green_sha (with a trailing comment) reads as empty')
    ok(r.parsed && r.parsed.workOrders === 3 && r.parsed.missing === 0, 'counts 3 work orders, README ignored')
    ok(r.parsed && r.parsed.byStatus.PLANNED === 2 && r.parsed.byStatus.DRAFT === 1 && !r.parsed.byStatus.VERIFIED, 'byStatus reads the frontmatter field only, never the prose mention')
    rmSync(dir, { recursive: true, force: true })
  }],
  ['a set last_green_sha and a built WO are reported as they are', () => {
    const dir = mkProject({
      statusYaml: "last_green_sha: '5c594bde'\n",
      wos: { 'frd-01-a/work-orders/wo-01-001-x.md': woMd('WO-01-001', 'in_review'), 'frd-01-a/work-orders/wo-01-002-y.md': woMd('WO-01-002', null) },
    })
    const r = run(dir)
    ok(r.parsed && r.parsed.lastGreenSha === '5c594bde', 'single-quoted sha unquoted')
    ok(r.parsed && r.parsed.byStatus.IN_REVIEW === 1, 'status upper-cased')
    ok(r.parsed && r.parsed.missing === 1, 'a WO without implementation_status counts as missing')
    rmSync(dir, { recursive: true, force: true })
  }],
  ['null / ~ / absent last_green_sha are empty', () => {
    for (const yaml of ['last_green_sha: null\n', 'last_green_sha: ~\n', 'last_green_sha:\n', 'phase: x\n', 'nested:\n  last_green_sha: abc\n']) {
      const dir = mkProject({ statusYaml: yaml })
      const r = run(dir)
      ok(r.parsed && r.parsed.ok === true && r.parsed.lastGreenSha === '' && r.parsed.workOrders === 0, `${JSON.stringify(yaml)} → '' and no work orders`)
      rmSync(dir, { recursive: true, force: true })
    }
  }],
  ['no status.yaml fails loud (exit 2, sealed ok:false)', () => {
    const dir = mkProject({})
    const r = run(dir)
    ok(r.status === 2 && r.sealed && r.parsed && r.parsed.ok === false && /not found/.test(r.parsed.error), 'exit 2, ok:false, error names the file')
    rmSync(dir, { recursive: true, force: true })
  }],
]

for (const [name, fn] of cases) { console.log(name); fn() }
console.log(`RESULT: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
