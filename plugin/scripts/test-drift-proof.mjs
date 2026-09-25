#!/usr/bin/env node
// test-drift-proof.mjs — BL-0178: the differential pre-existence proof and the drift-card writer
// (plugin/scripts/drift-proof.mjs), exercised against a REAL temporary git repository.
//
// The engine never parses a reviewer's word for "this drift pre-dates the cycle": it spawns a MECH
// agent that runs `drift-proof.mjs prove`, which checks the reviewer's probe out at the gate's pin
// AND at the pin's own `last_green_sha` in throwaway detached worktrees and runs it there. These tests
// prove the git/worktree mechanics for real (nested project prefix like Mission Control, cleanup,
// base-validity guard, ownership extraction) with a FAKE vitest runner that reads assertions out of
// the probe file itself — so each probe's pass/fail at each sha is a function of the checked-out tree,
// exactly like a real test.
//
// Exit 0 green / 1 red. Output ends in `RESULT: N passed, M failed`.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(HERE, 'drift-proof.mjs')

let passed = 0
let failed = 0
const check = (cond, msg) => { if (cond) { passed++; console.log(`PASS  ${msg}`) } else { failed++; console.log(`FAIL  ${msg}`) } }

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const write = (file, text) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, text) }

// A fake `vitest` with the exact CLI surface drift-proof.mjs drives: `run <file> --reporter=json
// --outputFile=<out>`. The probe file's own comments are its assertions, resolved against the tree the
// probe was copied into (cwd):
//   // IMPORT <relpath>           — a missing file is a module-load error (no assertions run at all)
//   // ASSERT <relpath> <text>    — passes iff the file's trimmed content equals <text>
//   // FLAKY <counterfile>        — alternates pass/fail on every invocation (a disagreeing re-run)
const FAKE_VITEST = `
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
const argv = process.argv.slice(2)
const file = argv[1]
const out = argv.find((a) => a.startsWith('--outputFile=')).slice('--outputFile='.length)
const lines = readFileSync(file, 'utf8').split('\\n')
const result = (assertions, loadError) => ({
  numTotalTests: assertions.length, numPassedTests: assertions.filter((a) => a.status === 'passed').length,
  numFailedTests: assertions.filter((a) => a.status === 'failed').length,
  testResults: [{ name: path.resolve(file), status: loadError || assertions.some((a) => a.status === 'failed') ? 'failed' : 'passed', message: loadError || '', assertionResults: assertions }],
})
for (const l of lines) {
  const m = l.match(/^\\/\\/ IMPORT (\\S+)/)
  if (m && !existsSync(m[1])) { writeFileSync(out, JSON.stringify(result([], 'Failed to load url ' + m[1]))); process.exit(1) }
}
const assertions = []
for (const l of lines) {
  const a = l.match(/^\\/\\/ ASSERT (\\S+) (.+)$/)
  if (a) { const actual = existsSync(a[1]) ? readFileSync(a[1], 'utf8').trim() : null; assertions.push({ title: a[1], status: actual === a[2].trim() ? 'passed' : 'failed', failureMessages: actual === a[2].trim() ? [] : ['expected ' + a[2] + ' got ' + actual] }) }
  const f = l.match(/^\\/\\/ FLAKY (\\S+)/)
  if (f) { const n = existsSync(f[1]) ? Number(readFileSync(f[1], 'utf8')) : 0; writeFileSync(f[1], String(n + 1)); assertions.push({ title: 'flaky', status: n % 2 === 0 ? 'passed' : 'failed', failureMessages: [] }) }
}
writeFileSync(out, JSON.stringify(result(assertions, '')))
process.exit(assertions.some((a) => a.status === 'failed') ? 1 : 0)
`

function mkRepo() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'drift-proof-'))
  const repo = path.join(root, 'repo')
  const app = path.join(repo, 'app')   // NESTED project, like mission-control inside the factory repo
  mkdirSync(app, { recursive: true })
  git(repo, 'init', '-q')
  git(repo, 'config', 'user.email', 't@example.com')
  git(repo, 'config', 'user.name', 't')
  write(path.join(app, '.gitignore'), '.pandacorp/run/\n.pandacorp/inbox/\n')
  write(path.join(app, 'docs/frds/frd-01-demo/work-orders/wo-01-001-a.md'), '---\nid: WO-01-001\nimplementation_status: PLANNED\nsource_requirements: [REQ-01-002]\n---\n# WO\nMentions AC-01-009.4 in passing (NOT owned).\n')
  write(path.join(app, 'docs/frds/frd-01-demo/work-orders/wo-01-002-b.md'), '---\nid: WO-01-002\nimplementation_status: PLANNED\n---\n# WO without source_requirements, IDs touched: REQ-01-005\n')
  write(path.join(app, 'src/lib/value.txt'), 'legacy-bad\n')   // legacy drift: wrong since forever
  write(path.join(app, 'src/lib/helper.txt'), 'ok\n')          // shared helper, fine at base
  write(path.join(app, '.pandacorp/status.yaml'), 'phase: implementation\nlast_green_sha: none\n')
  git(repo, 'add', '-A'); git(repo, 'commit', '-qm', 'base')
  const base = git(repo, 'rev-parse', 'HEAD')
  // The cycle: the reviewed WO lands IN_REVIEW, the shared helper regresses, a brand-new file appears,
  // and status.yaml at the pin records `base` as its last green (what the gate's --since used).
  write(path.join(app, 'docs/frds/frd-01-demo/work-orders/wo-01-001-a.md'), '---\nid: WO-01-001\nimplementation_status: IN_REVIEW\nsource_requirements: [REQ-01-002]\n---\n# WO\nMentions AC-01-009.4 in passing (NOT owned).\n')
  write(path.join(app, 'docs/frds/frd-01-demo/work-orders/wo-01-002-b.md'), '---\nid: WO-01-002\nimplementation_status: IN_REVIEW\n---\n# WO without source_requirements, IDs touched: REQ-01-005\n')
  write(path.join(app, 'src/lib/helper.txt'), 'broken\n')
  write(path.join(app, 'src/lib/new.txt'), 'new\n')
  write(path.join(app, '.pandacorp/status.yaml'), `phase: implementation\nlast_green_sha: ${base}\n`)
  git(repo, 'add', '-A'); git(repo, 'commit', '-qm', 'cycle')
  const pin = git(repo, 'rev-parse', 'HEAD')
  const fake = path.join(root, 'fake-vitest.mjs')
  writeFileSync(fake, FAKE_VITEST)
  return { root, repo, app, base, pin, fake }
}

const run = (args, env = {}) => {
  const out = execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
  return { out, json: JSON.parse(out.trim().split('\n').pop()) }
}

// ── prove: the four differential shapes + ownership + evidence + cleanup, on a nested project ──
{
  const r = mkRepo()
  const probes = path.join(r.app, '.pandacorp/run/drift-probes/frd-01-demo')
  write(path.join(probes, 'ac-01-009-4.drift-probe.ts'), '// ASSERT src/lib/value.txt good\n')             // red at pin AND base → pre-existing
  write(path.join(probes, 'ac-01-003-1.drift-probe.ts'), '// ASSERT src/lib/helper.txt ok\n')               // green at base, red at pin → regression
  write(path.join(probes, 'ac-01-007-1.drift-probe.ts'), '// ASSERT src/lib/value.txt legacy-bad\n')        // green at pin → the reviewer was wrong
  write(path.join(probes, 'ac-01-008-1.drift-probe.ts'), '// IMPORT src/lib/new.txt\n// ASSERT src/lib/new.txt nope\n') // loads only at pin
  write(path.join(probes, 'ac-01-006-1.drift-probe.ts'), `// FLAKY ${path.join(r.root, 'flaky-counter')}\n`)
  const probeArgs = ['ac-01-009-4', 'ac-01-003-1', 'ac-01-007-1', 'ac-01-008-1', 'ac-01-006-1', 'ac-01-099-9']
    .flatMap((n) => ['--probe', `.pandacorp/run/drift-probes/frd-01-demo/${n}.drift-probe.ts`])
  const { json } = run(['prove', '--project', r.app, '--frd', 'frd-01-demo', '--source', r.app, '--pin', r.pin.slice(0, 8),
    '--wo', 'docs/frds/frd-01-demo/work-orders/wo-01-001-a.md', '--wo', 'docs/frds/frd-01-demo/work-orders/wo-01-002-b.md', ...probeArgs],
  { PANDACORP_DRIFT_VITEST: `node ${r.fake}` })
  check(json.ok === true, 'prove: returns ok:true on a well-formed request')
  check(json.pin === r.pin && json.base === r.base, 'prove: resolves the full pin and reads base = last_green_sha AS RECORDED AT THE PIN (not the live tree)')
  check(json.baseValid === true, 'prove: base precedes the cycle (every reviewed WO is not yet IN_REVIEW/VERIFIED there) → baseValid')
  const o1 = json.owned['docs/frds/frd-01-demo/work-orders/wo-01-001-a.md']
  const o2 = json.owned['docs/frds/frd-01-demo/work-orders/wo-01-002-b.md']
  check(o1 && JSON.stringify(o1.sourceRequirements) === '["REQ-01-002"]', 'prove: ownership = the WO frontmatter source_requirements, read at the pin')
  check(o1 && o1.ids.includes('AC-01-009.4'), 'prove: the raw id sweep of the WO body is reported too (the engine decides which to use)')
  check(o2 && o2.sourceRequirements === null && o2.ids.includes('REQ-01-005'), 'prove: a WO without source_requirements reports null + the body ids (engine falls back, fail-closed)')
  const byName = (n) => json.probes.find((p) => p.path.includes(n))
  const states = (runs) => runs.map((x) => (!x.parsed || x.suiteErrors > 0 || x.total === 0 ? 'load' : x.failed > 0 ? 'fail' : 'pass')).join(',')
  check(states(byName('ac-01-009-4').head) === 'fail,fail' && states(byName('ac-01-009-4').base) === 'fail,fail', 'prove: legacy drift fails at the pin AND at base (pre-existing shape)')
  check(states(byName('ac-01-003-1').head) === 'fail,fail' && states(byName('ac-01-003-1').base) === 'pass,pass', 'prove: shared-helper regression fails at the pin, passes at base (T1 shape)')
  check(states(byName('ac-01-007-1').head) === 'pass,pass', 'prove: a probe that passes at the pin is reported as such (reviewer was wrong)')
  check(states(byName('ac-01-008-1').head) === 'fail,fail' && states(byName('ac-01-008-1').base) === 'load,load', 'prove: a probe importing a file the cycle introduced is a LOAD error at base, never an assertion failure (T3 shape)')
  const flaky = byName('ac-01-006-1')
  check(flaky && new Set(states(flaky.head).split(',')).size === 2, 'prove: two runs of a flaky probe disagree and both are reported (T7 shape)')
  check(byName('ac-01-099-9') && byName('ac-01-099-9').missing === true, 'prove: a probe the reviewer never wrote is reported missing, not silently dropped')
  const stored = path.join(r.app, '.pandacorp/run/gate-evidence/frd-01-demo/drift/ac-01-009-4.drift-probe.ts')
  check(existsSync(stored) && readFileSync(stored, 'utf8').includes('ASSERT src/lib/value.txt good'), 'prove: the probe is preserved as evidence under .pandacorp/run/gate-evidence/<frd>/drift/')
  check(byName('ac-01-009-4').stored === '.pandacorp/run/gate-evidence/frd-01-demo/drift/ac-01-009-4.drift-probe.ts', 'prove: reports the project-relative stored evidence path')
  const wts = git(r.repo, 'worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree '))
  check(wts.length === 1, `prove: every temporary worktree is removed afterwards (got ${wts.length})`)
  const tmpRoot = path.join(r.app, '.pandacorp/run/drift-proof')
  check(!existsSync(tmpRoot) || readdirSync(tmpRoot).length === 0, 'prove: the temporary checkout directory is cleaned up')
  check(git(r.repo, 'status', '--porcelain') === '', 'prove: the main tree is left clean (all writes are gitignored run-state)')
  check(!existsSync(path.join(r.app, 'src/__drift_probe__')), 'prove: the probe is never copied into the MAIN tree\'s collected tests')
  rmSync(r.root, { recursive: true, force: true })
}

// ── prove: base-validity guard — a base that already contains the reviewed WO's IN_REVIEW commit ──
{
  const r = mkRepo()
  // A sibling FRD's apply advanced last_green to the CYCLE commit itself: status.yaml at the new pin
  // records the pin's parent-with-IN_REVIEW as green. The differential would compare the cycle to
  // itself — the script must say so.
  write(path.join(r.app, '.pandacorp/status.yaml'), `phase: implementation\nlast_green_sha: ${r.pin}\n`)
  git(r.repo, 'add', '-A'); git(r.repo, 'commit', '-qm', 'sibling apply advanced last green')
  const pin2 = git(r.repo, 'rev-parse', 'HEAD')
  write(path.join(r.app, '.pandacorp/run/drift-probes/frd-01-demo/ac-01-009-4.drift-probe.ts'), '// ASSERT src/lib/value.txt good\n')
  const { json } = run(['prove', '--project', r.app, '--frd', 'frd-01-demo', '--source', r.app, '--pin', pin2,
    '--wo', 'docs/frds/frd-01-demo/work-orders/wo-01-001-a.md', '--probe', '.pandacorp/run/drift-probes/frd-01-demo/ac-01-009-4.drift-probe.ts'],
  { PANDACORP_DRIFT_VITEST: `node ${r.fake}` })
  check(json.ok === true && json.baseValid === false && /IN_REVIEW/.test(json.baseReason || ''), 'prove: base that already holds a reviewed WO as IN_REVIEW is flagged baseValid:false (the differential would be meaningless)')
  check(json.probes[0].base.length === 0, 'prove: no base runs are spent once the base is known invalid')
  rmSync(r.root, { recursive: true, force: true })
}

// ── prove: fail-closed input validation (paths reach a shell/git — nothing unvetted passes) ──
{
  const r = mkRepo()
  const { json } = run(['prove', '--project', r.app, '--frd', 'frd-01-demo', '--source', r.app, '--pin', 'HEAD',
    '--wo', 'docs/frds/frd-01-demo/work-orders/wo-01-001-a.md', '--probe', '../../etc/passwd'])
  check(json.ok === false && /probe/.test(json.error), 'prove: a probe path outside .pandacorp/run/drift-probes/<frd>/*.drift-probe.ts is refused (ok:false)')
  const bad = run(['prove', '--project', r.app, '--frd', 'frd-01-demo;rm', '--source', r.app, '--pin', 'HEAD'])
  check(bad.json.ok === false, 'prove: a malformed frd name is refused (ok:false)')
  rmSync(r.root, { recursive: true, force: true })
}

// ── record: MC-compatible draft card, evidence link, idempotency, README row, event ──
{
  const r = mkRepo()
  const events = path.join(r.root, 'events.ndjson')
  write(path.join(r.app, '.pandacorp/inbox/changes/README.md'), '# Cola de cambios\n\n| Card | Tipo | Clase | Estado |\n|---|---|---|---|\n')
  const items = [{ id: 'AC-01-009.4', contract: 'AC-01-009.4 — the value must be good', contractClass: 'acceptance-criterion', direction: 'code', probe: '.pandacorp/run/gate-evidence/frd-01-demo/drift/ac-01-009-4.drift-probe.ts', pin: r.pin, base: r.base },
    { id: 'REQ-01-004', contract: "REQ-01-004 — it's a spec claim", contractClass: 'requirement', direction: 'unknown', probe: '.pandacorp/run/gate-evidence/frd-01-demo/drift/req-01-004.drift-probe.ts', pin: r.pin, base: r.base }]
  const args = ['record', '--project', r.app, '--frd', 'frd-01-demo', '--project-name', 'demo', '--events', events, '--date', '2026-09-25', '--items', JSON.stringify(items)]
  const first = run(args).json
  check(first.ok === true && first.written.length === 2 && first.skipped.length === 0, 'record: writes one card per confirmed drift item')
  const card = path.join(r.app, '.pandacorp/inbox/changes/frd-01-demo-drift-ac-01-009-4.md')
  const body = existsSync(card) ? readFileSync(card, 'utf8') : ''
  const fm = (key) => (body.match(new RegExp(`^${key}:\\s*(.*)$`, 'm')) || [])[1]
  check(fm('type') === 'bug' && fm('status') === 'draft' && fm('frd') === 'frd-01-demo' && fm('class') === 'standard', 'record: frontmatter type bug (direction code) · status draft (never drained) · frd · class')
  check(fm('origin') === 'gate-drift' && fm('drift_key') === 'frd-01-demo::AC-01-009.4', 'record: carries origin + the idempotency key (frd::contract)')
  check(fm('date') === '2026-09-25', 'record: dated')
  check(/^# .+/m.test(body.split('---').slice(2).join('---')), 'record: body has the H1 title Mission Control\'s queue reader requires')
  check(body.includes('.pandacorp/run/gate-evidence/frd-01-demo/drift/ac-01-009-4.drift-probe.ts') && body.includes(r.base.slice(0, 8)), 'record: body links the stored probe and names both shas')
  const specCard = readFileSync(path.join(r.app, '.pandacorp/inbox/changes/frd-01-demo-drift-req-01-004.md'), 'utf8')
  check(/^type: change$/m.test(specCard), 'record: direction spec/unknown → type change (the owner decides the direction)')
  const second = run(args).json
  check(second.ok === true && second.written.length === 0 && second.skipped.length === 2, 'record: idempotent — a re-gate never files the same drift twice (T8)')
  const readme = readFileSync(path.join(r.app, '.pandacorp/inbox/changes/README.md'), 'utf8')
  check((readme.match(/frd-01-demo-drift-ac-01-009-4\.md/g) || []).length === 1, 'record: one README index row per card, never duplicated')
  const ev = readFileSync(events, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  check(ev.length === 2 && ev[0].event === 'GateDriftRecorded' && ev[0].frd === 'frd-01-demo' && ev[0].written === 2 && ev[1].written === 0, 'record: appends one GateDriftRecorded event per call (counts only)')
  const badItems = run(['record', '--project', r.app, '--frd', 'frd-01-demo', '--events', events, '--items', '{not json'])
  check(badItems.json.ok === false, 'record: malformed items fail loud (ok:false), never a silent success')
  rmSync(r.root, { recursive: true, force: true })
}

// ── prove: BL-0187 — --source is the gate worktree ROOT of a NESTED project; the reviewer (cd'd into the
// project directory inside it) wrote its project-relative probe under <source>/<prefix>/ ──
{
  const r = mkRepo()
  write(path.join(r.app, '.pandacorp/run/drift-probes/frd-01-demo/ac-01-009-4.drift-probe.ts'), '// ASSERT src/lib/value.txt good\n')
  const { json } = run(['prove', '--project', r.app, '--frd', 'frd-01-demo', '--source', r.repo, '--pin', r.pin.slice(0, 8),
    '--wo', 'docs/frds/frd-01-demo/work-orders/wo-01-001-a.md', '--probe', '.pandacorp/run/drift-probes/frd-01-demo/ac-01-009-4.drift-probe.ts'],
  { PANDACORP_DRIFT_VITEST: `node ${r.fake}` })
  const p = json.probes && json.probes[0]
  check(json.ok === true && p && p.missing !== true, 'prove (BL-0187): a nested project\'s probe under <worktree-root>/<prefix>/ is FOUND when --source is the worktree root')
  check(p && p.head.length === 2 && p.head.every((x) => x.parsed && x.failed > 0), 'prove (BL-0187): the nested probe actually ran at the pin (fails on its assertion)')
  // the fallback: a probe written at the source root itself (flat layout) is still found
  const flat = path.join(r.repo, '.pandacorp/run/drift-probes/frd-01-demo/ac-01-003-1.drift-probe.ts')
  write(flat, '// ASSERT src/lib/helper.txt ok\n')
  const again = run(['prove', '--project', r.app, '--frd', 'frd-01-demo', '--source', r.repo, '--pin', r.pin.slice(0, 8),
    '--wo', 'docs/frds/frd-01-demo/work-orders/wo-01-001-a.md', '--probe', '.pandacorp/run/drift-probes/frd-01-demo/ac-01-003-1.drift-probe.ts'],
  { PANDACORP_DRIFT_VITEST: `node ${r.fake}` }).json
  check(again.ok === true && again.probes[0] && again.probes[0].missing !== true, 'prove (BL-0187): a probe at <source>/<path> (flat layout) is still found — the fallback is kept')
  rmSync(r.root, { recursive: true, force: true })
}

console.log(`RESULT: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
