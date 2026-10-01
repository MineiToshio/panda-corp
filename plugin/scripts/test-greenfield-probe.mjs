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
import { decideGreenfield } from './greenfield-probe.mjs'

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

// A real git repository with the project NESTED under proj/ (the Mission Control shape): `commits` is a list of
// { files: { rel: content }, message } applied in order, so a work order's history is real git history.
function mkGitProject(commits) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'greenfield-probe-git-'))
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`) }
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 't@example.com')
  git('config', 'user.name', 'T')
  git('config', 'commit.gpgsign', 'false')
  for (const { files, message } of commits) {
    for (const [rel, content] of Object.entries(files)) {
      const p = path.join(root, 'proj', rel)
      mkdirSync(path.dirname(p), { recursive: true })
      writeFileSync(p, content)
    }
    git('add', '-A')
    git('commit', '-q', '-m', message)
  }
  return { root, dir: path.join(root, 'proj') }
}
const WO_A = 'docs/frds/frd-01-a/work-orders/wo-01-001-x.md'
const WO_B = 'docs/frds/frd-01-a/work-orders/wo-01-002-y.md'
const FRESH = 'phase: implementation\nlast_green_sha: ""\n'

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
  ['adopted-brownfield-is-not-greenfield: adopt leaves last_green_sha empty and its WOs PLANNED, but it was never red by construction', () => {
    const { root, dir } = mkGitProject([{ message: 'chore: adopt', files: { '.pandacorp/status.yaml': 'phase: implementation\ncreated_via: adopt\nlast_green_sha: ""\n', [WO_A]: woMd('WO-01-001', 'PLANNED'), [WO_B]: woMd('WO-01-002', 'PLANNED') } }])
    const r = run(dir)
    ok(r.sealed && r.parsed && r.parsed.adopted === true && r.parsed.everBuilt === false, `the facts say adopted, never built (got ${r.line})`)
    ok(r.parsed && r.parsed.greenfield === false && /adopt/.test(r.parsed.reason || ''), `the sealed verdict is NOT greenfield and names the adoption (got ${r.parsed && r.parsed.reason})`)
    ok(decideGreenfield(r.parsed, { allowDispatched: true }).greenfield === false, 'the fast lane reads the same verdict (one definition)')
    rmSync(root, { recursive: true, force: true })
  }],
  ['a work order that was EVER IN_REVIEW in git history is not greenfield, even demoted back to PLANNED', () => {
    const { root, dir } = mkGitProject([
      { message: 'docs: architecture', files: { '.pandacorp/status.yaml': FRESH, [WO_A]: woMd('WO-01-001', 'PLANNED'), [WO_B]: woMd('WO-01-002', 'PLANNED') } },
      { message: 'feat: WO-01-001', files: { [WO_A]: woMd('WO-01-001', 'IN_REVIEW'), 'src/a.ts': 'export const a = 1\n' } },
      { message: 'chore: demote', files: { [WO_A]: woMd('WO-01-001', 'PLANNED') } },
    ])
    const r = run(dir)
    ok(r.sealed && r.parsed && r.parsed.everBuilt === true && r.parsed.byStatus.PLANNED === 2, `the history shows a built WO while every WO reads PLANNED now (got ${r.line})`)
    ok(r.parsed && r.parsed.greenfield === false && decideGreenfield(r.parsed, { allowDispatched: true }).greenfield === false, 'neither lane reads it as greenfield')
    rmSync(root, { recursive: true, force: true })
  }],
  ['a prose mention of VERIFIED in a work order body is not history of a build', () => {
    const { root, dir } = mkGitProject([
      { message: 'docs: architecture', files: { '.pandacorp/status.yaml': FRESH, [WO_A]: woMd('WO-01-001', 'PLANNED'), [WO_B]: woMd('WO-01-002', 'DRAFT') } },
    ])
    const r = run(dir)
    ok(r.sealed && r.parsed && r.parsed.everBuilt === false && r.parsed.adopted === false, `the body's 'implementation_status: VERIFIED (prose…)' line is not a frontmatter state (got ${r.line})`)
    ok(r.parsed && r.parsed.greenfield === true, `a freshly architected project is greenfield (got ${r.parsed && r.parsed.reason})`)
    rmSync(root, { recursive: true, force: true })
  }],
  ['a committed dispatch stamp (IN_PROGRESS) is greenfield for the fast lane only; the classic verdict keeps it unbuilt-but-not-greenfield', () => {
    const { root, dir } = mkGitProject([
      { message: 'docs: architecture', files: { '.pandacorp/status.yaml': FRESH, [WO_A]: woMd('WO-01-001', 'PLANNED'), [WO_B]: woMd('WO-01-002', 'PLANNED') } },
      { message: 'chore(build): dispatch', files: { [WO_A]: woMd('WO-01-001', 'IN_PROGRESS') } },
    ])
    const r = run(dir)
    ok(r.parsed && r.parsed.greenfield === false, 'the sealed (classic) verdict: IN_PROGRESS is not greenfield')
    ok(decideGreenfield(r.parsed, { allowDispatched: true }).greenfield === true, 'the fast lane (its precheck already restored any uncommitted work) reads a dispatch-only project as greenfield')
    rmSync(root, { recursive: true, force: true })
  }],
  ['no git history to read fails safe: not greenfield', () => {
    const dir = mkProject({ statusYaml: FRESH, wos: { 'frd-01-a/work-orders/wo-01-001-x.md': woMd('WO-01-001', 'PLANNED') } })
    const r = run(dir)
    ok(r.sealed && r.parsed && r.parsed.everBuilt === null && r.parsed.greenfield === false, `an unreadable history proves nothing (got ${r.line})`)
    rmSync(dir, { recursive: true, force: true })
  }],
  ['decideGreenfield refuses incomplete facts', () => {
    const base = { ok: true, probe: 'greenfield', lastGreenSha: '', workOrders: 2, byStatus: { PLANNED: 2 }, missing: 0, adopted: false, everBuilt: false }
    ok(decideGreenfield(base).greenfield === true, 'complete greenfield facts → greenfield')
    for (const [what, patch] of [['adopted unknown', { adopted: undefined }], ['history unknown', { everBuilt: undefined }], ['a set pin', { lastGreenSha: 'abc' }], ['a missing status', { missing: 1, byStatus: { PLANNED: 1 } }], ['no work orders', { workOrders: 0, byStatus: {} }], ['a refusal', { ok: false }], ['BLOCKED', { byStatus: { PLANNED: 1, BLOCKED: 1 } }]]) {
      ok(decideGreenfield({ ...base, ...patch }).greenfield === false, `${what} → not greenfield`)
    }
  }],
]

for (const [name, fn] of cases) { console.log(name); fn() }
console.log(`RESULT: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
