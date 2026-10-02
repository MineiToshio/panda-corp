#!/usr/bin/env node
// test-build-mech.mjs — proposal 39 §2 C1/C2: git-fixture tests of pandacorp-build-mech.mjs, the deterministic
// replacement for the build engine's MECH prompts (commit-wo, park-wo, precheck, dispatch, safe-point, reuse-check,
// gate-prepare, gate-release). Every scenario builds a real repository with the project NESTED under `proj/` (the
// Mission Control shape, BL-0202) and runs the real script. The oracle is the resulting tree, index and HEAD — never
// the script's own receipt alone — and every receipt must carry a valid integrity seal (drift-seal.mjs).

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { acquire, currentLease } from '../runtime/build-state.mjs'
import { verifySealedLine } from './drift-seal.mjs'
import { projectCtx, sealReportProvenance } from './build-mech-lib.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(__dirname, 'pandacorp-build-mech.mjs')
const CLASSIFIER = path.join(__dirname, 'classify-change.mjs')

let passed = 0
let failed = 0
const ok = (cond, msg) => { if (cond) { passed++; console.log(`  ✓ ${msg}`) } else { failed++; console.log(`  ✗ ${msg}`) } }

const WO_A = 'docs/frds/frd-01-alpha/work-orders/wo-01-001-alpha.md'
const WO_B = 'docs/frds/frd-01-alpha/work-orders/wo-01-002-beta.md'
const WO_C = 'docs/frds/frd-02-gamma/work-orders/wo-02-001-gamma.md'
const woMd = (id, status, { acs = [], extraFm = '' } = {}) => `---\nid: ${id}\ntype: work-order\nslug: ${id.toLowerCase()}\nimplementation_status: ${status}\nreopen_count: 0\n${extraFm}---\n# ${id}\n\n## Acceptance criteria\n${acs.map((a) => `- **${a}** — something observable.\n`).join('')}\n## Status Note\nimplementation_status: prose mention, not the field. Mentions AC-99-999.9 in passing.\n`
const WO_A_TEXT = (status) => woMd('WO-01-001', status, { acs: ['AC-01-001.1', 'AC-01-001.2'] })
const FAKE_VITEST = '#!/bin/sh\nprintf \'%s\\n\' "$*" >> "$FAKE_VITEST_LOG"\nexit ${FAKE_VITEST_EXIT:-0}\n'

function mkRepo() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'build-mech-'))
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'build-mech-scratch-'))
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`)
    return r.stdout.trim()
  }
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 't@example.com')
  git('config', 'user.name', 'T')
  git('config', 'commit.gpgsign', 'false')
  const proj = path.join(root, 'proj')
  const abs = (rel) => path.join(proj, rel)
  const write = (rel, content) => { mkdirSync(path.dirname(abs(rel)), { recursive: true }); writeFileSync(abs(rel), content) }
  const read = (rel) => (existsSync(abs(rel)) ? readFileSync(abs(rel), 'utf8') : null)
  writeFileSync(path.join(root, 'factory.txt'), 'factory root file\n')
  write('.gitignore', 'node_modules/\n.pandacorp/run/\n')
  write('.pandacorp/status.yaml', 'phase: implementation\n')
  write('.pandacorp/track.jsonl', '{"kind":"start"}\n')
  write('.pandacorp/worktree-bootstrap.sh', '#!/bin/sh\nmkdir -p .pandacorp/run && echo "port=${PANDACORP_E2E_PORT:-none}" > .pandacorp/run/bootstrapped\n')
  write(WO_A, WO_A_TEXT('IN_PROGRESS'))
  write(WO_B, woMd('WO-01-002', 'PLANNED', { acs: ['AC-01-002.1'] }))
  write(WO_C, woMd('WO-02-001', 'PLANNED', { acs: ['AC-02-001.1'] }))
  write('src/existing.ts', 'export const existing = 1\n')
  git('add', '-A')
  git('commit', '-q', '-m', 'chore: init project')
  const head = () => git('rev-parse', 'HEAD')
  const subject = () => git('log', '-1', '--format=%s')
  const body = () => git('log', '-1', '--format=%B')
  const filesAt = (rev = 'HEAD') => git('show', '--name-only', '--format=', rev).split('\n').filter(Boolean)
  const status = () => git('status', '--porcelain', '--untracked-files=all')
  const staged = () => git('diff', '--cached', '--name-only')
  const atHead = (rel) => { const r = spawnSync('git', ['show', `HEAD:proj/${rel}`], { cwd: root, encoding: 'utf8' }); return r.status === 0 ? r.stdout : null }
  const vitestLog = path.join(scratch, 'vitest.log')
  const events = path.join(scratch, 'events.ndjson')
  const installVitest = () => { write('node_modules/.bin/vitest', FAKE_VITEST); chmodSync(abs('node_modules/.bin/vitest'), 0o755) }
  const hook = (body) => { const h = path.join(root, '.git', 'hooks', 'pre-commit'); writeFileSync(h, `#!/bin/sh\n${body}\n`); chmodSync(h, 0o755) }
  const run = (op, args = [], env = {}) => {
    const evArgs = ['commit-wo', 'precheck', 'verify', 'fast-start', 'close', 'security-scope', 'telemetry-scope', 'certify-state'].includes(op) && !args.includes('--events') ? ['--events', events] : []   // never the real ~/.claude stream
    const r = spawnSync(process.execPath, [SCRIPT, op, '--project', proj, ...args, ...evArgs], { cwd: root, encoding: 'utf8', env: { ...process.env, FAKE_VITEST_LOG: vitestLog, ...env } })
    const lines = (r.stdout || '').trim().split('\n')
    const line = lines.pop() || ''
    let receipt = null
    try { receipt = JSON.parse(line) } catch { receipt = null }
    return { code: r.status, line, lines: lines.length + 1, receipt, sealed: verifySealedLine(line).ok, stderr: r.stderr }
  }
  const vitestCalls = () => (existsSync(vitestLog) ? readFileSync(vitestLog, 'utf8').trim().split('\n').filter(Boolean) : [])
  return { root, proj, abs, git, write, read, head, subject, body, filesAt, status, staged, atHead, installVitest, hook, run, vitestCalls, events, cleanup: () => { rmSync(root, { recursive: true, force: true }); rmSync(scratch, { recursive: true, force: true }) } }
}
const TEST_BOTH = "import { it } from 'vitest'\nit('AC-01-001.1 alpha', () => {})\nit('AC-01-001.2 alpha two', () => {})\n"
const buildAlpha = (r, testBody = TEST_BOTH) => { r.write('src/alpha.ts', 'export const alpha = 1\n'); r.write('src/_tests/alpha.test.ts', testBody) }
const ALPHA_FILES = ['--wo', 'WO-01-001', '--files', 'src/alpha.ts,src/_tests/alpha.test.ts']

// ── commit-wo: happy path ────────────────────────────────────────────────────────────────────────
console.log('commit-wo: one WO, one commit, stamp + code + journals, clean tree')
{
  const r = mkRepo()
  try {
    const before = r.head()
    buildAlpha(r)
    r.write('.pandacorp/track.jsonl', '{"kind":"start"}\n{"kind":"wo_start","wo":"WO-01-001"}\n')
    r.write('.pandacorp/status.yaml', 'phase: implementation\nrunning: true\n')   // the lease projection's own dirt
    writeFileSync(path.join(r.root, 'factory.txt'), 'another session edits the factory\n')   // outside the project
    const c = r.run('commit-wo', ALPHA_FILES)
    ok(c.code === 0 && c.receipt && c.receipt.status === 'committed', `exit 0 and status committed (got ${c.code} ${c.receipt && c.receipt.status} ${c.receipt && c.receipt.reason})`)
    ok(c.sealed && c.lines === 1, 'stdout is exactly ONE sealed JSON line')
    ok(r.head() !== before && c.receipt.sha && r.head().startsWith(c.receipt.sha), 'HEAD moved to the reported sha')
    ok(/^feat\(frd-01-alpha\): WO-01-001\b/.test(r.subject()), `the commit names the WO with the FRD scope (${r.subject()})`)
    const files = r.filesAt()
    ok(['proj/src/alpha.ts', 'proj/src/_tests/alpha.test.ts', `proj/${WO_A}`, 'proj/.pandacorp/track.jsonl'].every((f) => files.includes(f)) && files.length === 4, `the commit holds exactly code + test + WO markdown + journal (${files.join(', ')})`)
    ok(/implementation_status: IN_REVIEW/.test(r.atHead(WO_A)) && /implementation_status: prose mention/.test(r.atHead(WO_A)), 'the WO is IN_REVIEW at HEAD; the body prose mention is untouched')
    ok(r.status().split('\n').filter(Boolean).every((l) => l.endsWith('proj/.pandacorp/status.yaml') || l.endsWith('factory.txt')), 'only the lease projection and the out-of-project file stay dirty')
    ok(!existsSync(r.abs('.pandacorp/run/main-writer.lock')), 'the main-writer lock is released')
    ok(c.receipt.tests && c.receipt.tests.ran === false && /vitest/.test(c.receipt.tests.reason), 'no vitest in the project → related tests skipped WITH a recorded reason')
    ok(c.receipt.acs && c.receipt.acs.cited.length === 2, 'both ACs are reported cited')
    const track = r.atHead('.pandacorp/track.jsonl').trim().split('\n').map((l) => JSON.parse(l))
    ok(track.length === 3 && track[2].kind === 'wo_end' && track[2].wo === 'WO-01-001' && track[2].frd === 'frd-01-alpha' && track[2].state === 'in_review', 'the durable wo_end timeline line is committed with the WO')
    const evs = existsSync(r.events) ? readFileSync(r.events, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []
    ok(evs.length === 1 && evs[0].event === 'wo_commit' && evs[0].wo === 'WO-01-001' && evs[0].state === 'IN_REVIEW' && evs[0].project === 'proj', 'the Party wo_commit event is appended after the commit')
    const again = r.run('commit-wo', ALPHA_FILES)
    ok(again.code === 0 && again.receipt.status === 'nothing' && r.head().startsWith(c.receipt.sha), 'a re-run on a committed WO with a clean tree is an idempotent no-op')
  } finally { r.cleanup() }
}

console.log('commit-wo: related unit tests only (vitest related --run)')
{
  const r = mkRepo()
  try {
    r.installVitest()
    buildAlpha(r)
    const c = r.run('commit-wo', ALPHA_FILES)
    const calls = r.vitestCalls()
    ok(c.code === 0 && c.receipt.tests.ran === true, 'vitest present → the related tests ran and passed')
    ok(calls.length === 1 && /^related --run\b/.test(calls[0]) && calls[0].includes('src/alpha.ts') && calls[0].includes('src/_tests/alpha.test.ts') && !calls[0].includes('.md') && !calls[0].includes('.jsonl'), `only the staged code files are passed (${calls[0]})`)
  } finally { r.cleanup() }
  const red = mkRepo()
  try {
    red.installVitest()
    buildAlpha(red)
    const before = red.head()
    const c = red.run('commit-wo', ALPHA_FILES, { FAKE_VITEST_EXIT: '1' })
    ok(c.code === 4 && c.receipt.status === 'tests-red', 'a red related test refuses (exit 4, tests-red)')
    ok(red.head() === before && /implementation_status: IN_PROGRESS/.test(red.read(WO_A)) && red.staged() === '', 'nothing committed, nothing stamped, nothing staged')
    ok(red.read('src/alpha.ts') === 'export const alpha = 1\n', 'the builder\'s files are left in place for the repair')
  } finally { red.cleanup() }
}

// ── commit-wo: refusals ──────────────────────────────────────────────────────────────────────────
console.log('commit-wo: undeclared paths, --extra with a reason, foreign WO frontmatter')
{
  const r = mkRepo()
  try {
    buildAlpha(r)
    r.write('src/other.ts', 'export const other = 2\n')
    const before = r.head()
    const c = r.run('commit-wo', ALPHA_FILES)
    ok(c.code === 4 && c.receipt.status === 'undeclared' && c.receipt.paths.includes('src/other.ts'), 'an undeclared modified path refuses and is named')
    ok(r.head() === before && /IN_PROGRESS/.test(r.read(WO_A)), 'the refusal changes nothing')
    const noReason = r.run('commit-wo', [...ALPHA_FILES, '--extra', 'src/other.ts'])
    ok(noReason.code === 2 && noReason.receipt.ok === false, '--extra without --reason is an input error (exit 2)')
    const withExtra = r.run('commit-wo', [...ALPHA_FILES, '--extra', 'src/other.ts', '--reason', 'shared helper the WO needed'])
    ok(withExtra.code === 0 && r.filesAt().includes('proj/src/other.ts'), '--extra with a reason commits the extra path')
    ok(/Extra-Path: src\/other\.ts \(shared helper the WO needed\)/.test(r.body()), 'the extra is listed in a commit trailer with its reason')
  } finally { r.cleanup() }
  const f = mkRepo()
  try {
    buildAlpha(f)
    f.write(WO_B, woMd('WO-01-002', 'IN_PROGRESS', { acs: ['AC-01-002.1'] }))
    const before = f.head()
    const c = f.run('commit-wo', [...ALPHA_FILES, '--extra', WO_B, '--reason', 'try to sneak it in'])
    ok(c.code === 4 && c.receipt.status === 'foreign-wo' && c.receipt.paths.includes(WO_B), 'another WO\'s changed frontmatter refuses, even when passed as --extra')
    ok(f.head() === before, 'nothing was committed')
  } finally { f.cleanup() }
}

console.log('commit-wo: schema/migration paths only on main')
{
  const r = mkRepo()
  try {
    r.git('checkout', '-q', '-b', 'build/frd-01-alpha')
    buildAlpha(r)
    r.write('src/db/migrations/0001_init.sql', 'create table t (id int);\n')
    const c = r.run('commit-wo', ['--wo', 'WO-01-001', '--files', 'src/alpha.ts,src/_tests/alpha.test.ts,src/db/migrations/0001_init.sql'])
    ok(c.code === 4 && c.receipt.status === 'schema-off-main' && c.receipt.paths.includes('src/db/migrations/0001_init.sql'), 'a migration path off main refuses')
    r.git('checkout', '-q', 'main')
    const onMain = r.run('commit-wo', ['--wo', 'WO-01-001', '--files', 'src/alpha.ts,src/_tests/alpha.test.ts,src/db/migrations/0001_init.sql'])
    ok(onMain.code === 0 && r.filesAt().includes('proj/src/db/migrations/0001_init.sql'), 'the same migration commits on main')
  } finally { r.cleanup() }
  // The schema patterns are the classifier's own S5 path patterns, copied (the classifier runs on import): drift guard.
  const mech = readFileSync(SCRIPT, 'utf8')
  const classifier = readFileSync(CLASSIFIER, 'utf8')
  const block = /const SCHEMA_PATHS = \[([\s\S]*?)\n\]/.exec(mech)
  const regexes = block ? block[1].split('\n').map((l) => l.trim().replace(/,$/, '')).filter((l) => l.startsWith('/')) : []
  ok(regexes.length >= 4 && regexes.every((re) => classifier.includes(`${re},`)), `every SCHEMA_PATHS regex is verbatim in classify-change.mjs S5 (${regexes.length})`)
}

console.log('commit-wo: AC-citation floor')
{
  const r = mkRepo()
  try {
    buildAlpha(r, "it('AC-01-001.10 is not AC one', () => {})\nit('AC-01-001.2', () => {})\n")
    const before = r.head()
    const c = r.run('commit-wo', ALPHA_FILES)
    ok(c.code === 4 && c.receipt.status === 'ac-uncited' && c.receipt.uncited.length === 1 && c.receipt.uncited[0] === 'AC-01-001.1', 'an AC no test cites refuses (and AC-01-001.10 does not cite AC-01-001.1)')
    ok(r.head() === before && /IN_PROGRESS/.test(r.read(WO_A)), 'nothing committed or stamped')
    r.write('e2e/alpha.spec.ts', "test('AC-01-001.1 end to end', () => {})\n")
    const cited = r.run('commit-wo', [...ALPHA_FILES, '--extra', 'e2e/alpha.spec.ts', '--reason', 'e2e spec'])
    ok(cited.code === 0, 'a citation in any test file (an e2e spec included) satisfies the floor')
  } finally { r.cleanup() }
  const n = mkRepo()
  try {
    n.write(WO_A, woMd('WO-01-001', 'IN_PROGRESS', { acs: ['AC-01-001.1'], extraFm: 'tests: none\n' }))
    n.git('commit', '-q', '-am', 'chore: tests none without reason')
    n.write('src/alpha.ts', 'export const alpha = 1\n')
    const noReason = n.run('commit-wo', ['--wo', 'WO-01-001', '--files', 'src/alpha.ts'])
    ok(noReason.code === 4 && noReason.receipt.status === 'tests-none-without-reason', '`tests: none` without a reason refuses')
    n.write(WO_A, woMd('WO-01-001', 'IN_PROGRESS', { acs: ['AC-01-001.1'], extraFm: 'tests: none\ntests_reason: pure config wiring, covered by the FRD e2e\n' }))
    const withReason = n.run('commit-wo', ['--wo', 'WO-01-001', '--files', 'src/alpha.ts'])
    ok(withReason.code === 0 && withReason.receipt.acs.skipped === true && /config wiring/.test(withReason.receipt.acs.reason), '`tests: none` with a reason skips the citation floor and records why')
  } finally { n.cleanup() }
}

// ── commit-wo: the main-writer lock ──────────────────────────────────────────────────────────────
console.log('commit-wo: main-writer lock (busy → refuse, stale → reclaim)')
{
  const r = mkRepo()
  try {
    buildAlpha(r)
    const lock = r.abs('.pandacorp/run/main-writer.lock')
    mkdirSync(lock, { recursive: true })
    writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ owner: 'other', pid: 1, op: 'commit-wo', at: new Date().toISOString() }))
    const before = r.head()
    const busy = r.run('commit-wo', [...ALPHA_FILES, '--lock-wait-ms', '0'])
    ok(busy.code === 4 && busy.receipt.status === 'lock-busy' && r.head() === before && existsSync(lock), 'a fresh lock held by another writer refuses (lock-busy) and is left in place')
    writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ owner: 'other', pid: 1, op: 'commit-wo', at: new Date(Date.now() - 11 * 60 * 1000).toISOString() }))
    const old = new Date(Date.now() - 11 * 60 * 1000)
    utimesSync(lock, old, old)
    const stale = r.run('commit-wo', [...ALPHA_FILES, '--lock-wait-ms', '0'])
    ok(stale.code === 0 && stale.receipt.status === 'committed' && stale.receipt.lock && stale.receipt.lock.reclaimed === true, 'a lock older than 10 min is reclaimed and the commit proceeds')
    ok(!existsSync(lock) && !readdirSync(path.dirname(lock)).some((n) => n.startsWith('main-writer.lock')), 'the reclaimed lock and its tombstone are gone')
  } finally { r.cleanup() }
}

// ── commit-wo: failure restores the stamp; the clean-tree assertion ─────────────────────────────
console.log('commit-wo: a failed commit restores the stamp; a dirty tree after the commit is undone')
{
  const r = mkRepo()
  try {
    buildAlpha(r)
    const before = r.head()
    const original = r.read(WO_A)
    r.hook('echo "hook says no" >&2; exit 1')
    const c = r.run('commit-wo', ALPHA_FILES)
    ok(c.code !== 0 && c.receipt.status === 'commit-failed', `a failing commit exits non-zero (commit-failed, got ${c.code})`)
    ok(r.head() === before && r.read(WO_A) === original && r.staged() === '', 'HEAD unchanged, the WO markdown is byte-identical to before the stamp, nothing staged')
    ok(r.read('.pandacorp/track.jsonl') === '{"kind":"start"}\n' && !existsSync(r.events), 'the timeline line is withdrawn and no wo_commit event is emitted')
    ok(r.read('src/alpha.ts') === 'export const alpha = 1\n', 'the builder\'s files survive the failure')
  } finally { r.cleanup() }
  const d = mkRepo()
  try {
    buildAlpha(d)
    const before = d.head()
    const original = d.read(WO_A)
    d.hook(`echo stray > "${d.abs('stray.txt')}"`)
    const c = d.run('commit-wo', ALPHA_FILES)
    ok(c.code === 4 && c.receipt.status === 'dirty-after-commit' && c.receipt.paths.includes('stray.txt'), 'a tree left dirty after the commit refuses and names the dirt')
    ok(d.head() === before && d.read(WO_A) === original && d.staged() === '', 'the commit is undone and the stamp restored (no IN_REVIEW without a clean commit)')
  } finally { d.cleanup() }
}

console.log('commit-wo: --fixup of an earlier own-FRD WO, input errors')
{
  const r = mkRepo()
  try {
    buildAlpha(r)
    ok(r.run('commit-wo', ALPHA_FILES).code === 0, 'WO-01-001 committed first')
    r.write('src/alpha.ts', 'export const alpha = 2\n')
    const fx = r.run('commit-wo', ['--fixup', 'WO-01-001', '--for', 'WO-01-002', '--files', 'src/alpha.ts'])
    ok(fx.code === 0 && /^fix\(frd-01-alpha\): fixup WO-01-001\b/.test(r.subject()), `a fixup is its own commit naming the fixed WO (${r.subject()})`)
    ok(!r.filesAt().includes(`proj/${WO_A}`), 'the fixup does not touch the fixed WO\'s frontmatter')
    r.write('src/alpha.ts', 'export const alpha = 3\n')
    const cross = r.run('commit-wo', ['--fixup', 'WO-01-001', '--for', 'WO-02-001', '--files', 'src/alpha.ts'])
    ok(cross.code === 4 && cross.receipt.status === 'fixup-cross-frd', 'a fixup across FRDs refuses')
    const notCommitted = r.run('commit-wo', ['--fixup', 'WO-01-002', '--files', 'src/alpha.ts'])
    ok(notCommitted.code === 4 && notCommitted.receipt.status === 'fixup-target-uncommitted', 'a fixup of a WO that never reached IN_REVIEW refuses')
    const unknown = r.run('commit-wo', ['--wo', 'WO-09-999', '--files', 'src/alpha.ts'])
    ok(unknown.code === 2 && unknown.receipt.ok === false && unknown.sealed, 'an unknown WO is an input error (exit 2), still one sealed line')
    const usage = r.run('commit-wo', ['--files', 'src/alpha.ts'])
    ok(usage.code === 2, 'no --wo / --fixup is an input error')
  } finally { r.cleanup() }
}

// ── park-wo ──────────────────────────────────────────────────────────────────────────────────────
console.log('park-wo: a failed WO\'s dirty paths move to salvage and are reset')
{
  const r = mkRepo()
  try {
    r.write('src/existing.ts', 'export const existing = "broken"\n')
    r.write('src/half.ts', 'export const half = \n')
    r.write(WO_A, `${WO_A_TEXT('IN_PROGRESS')}\nbuilder notes: failed on X\n`)
    r.write('.pandacorp/track.jsonl', '{"kind":"start"}\n{"kind":"wo_start","wo":"WO-01-001"}\n')
    writeFileSync(path.join(r.root, 'factory.txt'), 'another session\n')
    const before = r.head()
    const p = r.run('park-wo', ['--wo', 'WO-01-001'])
    ok(p.code === 0 && p.sealed && p.receipt.status === 'parked', 'park-wo exits 0 with one sealed line')
    const parked = (p.receipt.parked || []).map((x) => x.path).sort()
    ok(JSON.stringify(parked) === JSON.stringify([WO_A, 'src/existing.ts', 'src/half.ts'].sort()), `the WO's dirty paths are parked (${parked.join(', ')})`)
    const dir = path.join(r.proj, p.receipt.dir || 'none')
    ok(p.receipt.dir && p.receipt.dir.startsWith('.pandacorp/run/salvage/WO-01-001/') && readFileSync(path.join(dir, 'src/half.ts'), 'utf8') === 'export const half = \n' && /failed on X/.test(readFileSync(path.join(dir, WO_A), 'utf8')), 'the salvage copies hold the parked content')
    ok(r.read('src/existing.ts') === 'export const existing = 1\n' && r.read('src/half.ts') === null && r.read(WO_A) === WO_A_TEXT('IN_PROGRESS'), 'the parked paths are reset to HEAD (untracked ones removed)')
    ok(/\{"kind":"wo_start"/.test(r.read('.pandacorp/track.jsonl')) && readFileSync(path.join(r.root, 'factory.txt'), 'utf8') === 'another session\n', 'the append-only journal and out-of-project dirt are kept')
    ok(r.head() === before, 'park-wo never commits')
  } finally { r.cleanup() }
  const s = mkRepo()
  try {
    s.write('src/existing.ts', 'export const existing = "owner"\n')
    s.write('src/half.ts', 'x\n')
    const p = s.run('park-wo', ['--wo', 'WO-01-001', '--files', 'src/half.ts'])
    ok(p.code === 0 && p.receipt.parked.map((x) => x.path).join() === 'src/half.ts' && p.receipt.kept.includes('src/existing.ts') && s.read('src/existing.ts') === 'export const existing = "owner"\n', 'with --files only the declared paths are parked; the rest is reported kept, untouched')
  } finally { s.cleanup() }
}

// The verifier's case: on the sequential fast lane a builder's UNDECLARED edit for a work order it then parks must
// not survive the park — it would ride the next work order's commit (--extra, a blended commit wo-revert misattributes)
// or keep the FRD's verify refused on a dirty tree forever. `--all-undeclared` (fast lane only) salvages every dirty
// path created since the FRD's dispatch; dirt that was already there at the dispatch (an owner's) is never touched.
console.log('park-wo --all-undeclared: every undeclared path since the FRD\'s dispatch is salvaged; earlier dirt is kept')
{
  const r = mkRepo()
  try {
    r.write('src/existing.ts', 'export const existing = "owner, before the dispatch"\n')
    const d = r.run('dispatch', ['--wo', 'WO-01-002', '--commit'])
    ok(d.code === 0 && d.receipt.status === 'stamped', 'the FRD is dispatched (committed stamp)')
    r.write('src/beta.ts', 'export const beta = \n')            // declared by WO-01-002
    r.write('src/stray.ts', 'export const stray = 1\n')          // undeclared: the builder's stray edit
    r.write('src/lib/helper.ts', 'export const helper = 1\n')    // undeclared, nested
    const p = r.run('park-wo', ['--wo', 'WO-01-002', '--files', 'src/beta.ts', '--all-undeclared'])
    const parked = (p.receipt && p.receipt.parked || []).map((x) => x.path).sort()
    ok(p.code === 0 && p.sealed && JSON.stringify(parked) === JSON.stringify(['src/beta.ts', 'src/lib/helper.ts', 'src/stray.ts']), `the declared AND every undeclared path since the dispatch are parked (got ${p.code} ${parked.join(', ')} ${p.receipt && (p.receipt.reason || p.receipt.error)})`)
    ok(r.read('src/stray.ts') === null && r.read('src/lib/helper.ts') === null && r.read('src/beta.ts') === null, 'they are gone from the tree (salvaged, never lost)')
    ok(r.read('src/existing.ts') === 'export const existing = "owner, before the dispatch"\n' && (p.receipt.kept || []).includes('src/existing.ts'), 'dirt that was there before the dispatch is kept, untouched, and reported')
    ok(p.receipt.allUndeclared === 'applied', `the receipt says the dispatch snapshot was applied (got ${p.receipt.allUndeclared})`)
  } finally { r.cleanup() }
}
console.log('park-wo leftovers: without a dispatch snapshot the undeclared path stays, and no later commit may claim it with --extra')
{
  const r = mkRepo()
  try {
    r.installVitest()
    r.write('src/beta.ts', 'export const beta = \n')
    r.write('src/stray.ts', 'export const stray = 1\n')
    const p = r.run('park-wo', ['--wo', 'WO-01-002', '--files', 'src/beta.ts', '--all-undeclared'])
    ok(p.code === 0 && p.receipt.allUndeclared === 'no-dispatch-snapshot' && r.read('src/stray.ts') !== null && (p.receipt.left || []).includes('src/stray.ts'), `no snapshot: declared paths only, the leftover is reported (got ${p.code} ${p.receipt && p.receipt.allUndeclared} ${JSON.stringify(p.receipt && p.receipt.left)})`)
    buildAlpha(r)
    const before = r.head()
    const c = r.run('commit-wo', [...ALPHA_FILES, '--extra', 'src/stray.ts', '--reason', 'shared helper'])
    ok(c.code === 4 && c.receipt.status === 'parked-leftover' && /WO-01-002/.test(c.receipt.reason || '') && r.head() === before, `commit-wo refuses --extra for a parked work order's leftover (got ${c.code} ${c.receipt && c.receipt.status})`)
    ok(/IN_PROGRESS/.test(r.read(WO_A)) && r.read('src/stray.ts') === 'export const stray = 1\n', 'nothing was stamped, committed or touched')
    const ok2 = r.run('commit-wo', [...ALPHA_FILES, '--extra', 'src/stray.ts', '--reason', 'x', '--extra', 'src/other.ts', '--reason', 'y'])
    ok(ok2.code === 4 && ok2.receipt.status === 'parked-leftover', 'still refused next to another --extra')
    r.run('park-wo', ['--wo', 'WO-01-002', '--all-undeclared'])
    ok(r.read('src/stray.ts') === null, 'without --files the parked WO\'s every dirty path goes (the leftover is salvaged)')
    buildAlpha(r)   // that park took the unbuilt WO-01-001's files too (no snapshot): rebuild them
    const c2 = r.run('commit-wo', ALPHA_FILES)
    ok(c2.code === 0 && c2.receipt.status === 'committed' && !r.filesAt().includes('proj/src/stray.ts'), 'the next work order then commits without it')
  } finally { r.cleanup() }
}

// A path dirty at the dispatch is the owner's only while it still holds what it held then: the dispatch snapshot records a
// content hash per pre-dispatch dirty path, and park-wo --all-undeclared keeps exactly the unchanged ones. A declared
// path the builder changed is always salvaged (the salvage copy keeps it), even when it was dirty at the dispatch.
console.log('park-wo --all-undeclared: pre-dispatch dirt is kept only while its content is unchanged since the dispatch')
{
  const r = mkRepo()
  try {
    r.write('src/beta.ts', 'export const beta = "owner draft"\n')                 // declared by WO-01-002, dirty before the dispatch
    r.write('src/existing.ts', 'export const existing = "owner"\n')               // undeclared, dirty before the dispatch
    r.write('src/notes.ts', 'export const notes = "owner"\n')                     // undeclared, dirty before the dispatch
    r.write('src/plan.ts', 'export const plan = "owner"\n')                       // declared, dirty before, never touched after
    const d = r.run('dispatch', ['--wo', 'WO-01-002', '--commit'])
    ok(d.code === 0 && d.receipt.status === 'stamped', 'dispatched over pre-existing dirt')
    r.write('src/beta.ts', 'export const beta = "builder, broken"\n')            // the builder changed the declared path
    r.write('src/existing.ts', 'export const existing = "builder"\n')             // and an undeclared pre-dirty path
    const p = r.run('park-wo', ['--wo', 'WO-01-002', '--files', 'src/beta.ts,src/plan.ts', '--all-undeclared'])
    const parked = (p.receipt && p.receipt.parked || []).map((x) => x.path).sort()
    ok(p.code === 0 && p.receipt.allUndeclared === 'applied' && JSON.stringify(parked) === JSON.stringify(['src/beta.ts', 'src/existing.ts']), `the two paths the builder changed since the dispatch are parked, declared or not (got ${parked.join(', ')} ${p.receipt && (p.receipt.reason || p.receipt.error || '')})`)
    const dir = path.join(r.proj, p.receipt.dir || 'none')
    ok(existsSync(path.join(dir, 'src/beta.ts')) && readFileSync(path.join(dir, 'src/beta.ts'), 'utf8') === 'export const beta = "builder, broken"\n', 'the salvage copy holds the builder\'s content of the declared path')
    ok(r.read('src/notes.ts') === 'export const notes = "owner"\n' && r.read('src/plan.ts') === 'export const plan = "owner"\n' && (p.receipt.kept || []).includes('src/notes.ts') && (p.receipt.kept || []).includes('src/plan.ts'), 'the unchanged pre-dispatch dirt is kept, untouched, declared or not')
  } finally { r.cleanup() }
}

// A parked work order's leftover never rides a later commit: whether a later work order names it in --files (a glob or
// a directory) or in --extra, commit-wo refuses it while it still holds the parked content. The records are run state:
// the precheck and every dispatch clear them, so they never outlive the run that parked.
console.log('commit-wo: a parked leftover still holding its parked content is refused through --files too; records clear at precheck and dispatch')
{
  const leftover = () => {
    const r = mkRepo()
    r.installVitest()
    r.write('src/stray.ts', 'export const stray = 1\n')
    const p = r.run('park-wo', ['--wo', 'WO-01-002', '--files', 'src/beta.ts', '--all-undeclared'])
    if (!(p.code === 0 && (p.receipt.left || []).includes('src/stray.ts'))) throw new Error(`fixture: no leftover (${p.line})`)
    buildAlpha(r)
    return r
  }
  const r = leftover()
  try {
    const before = r.head()
    const c = r.run('commit-wo', ['--wo', 'WO-01-001', '--files', 'src/**'])
    ok(c.code === 4 && c.receipt.status === 'parked-leftover' && (c.receipt.paths || []).includes('src/stray.ts') && r.head() === before, `a --files glob covering the leftover is refused (got ${c.code} ${c.receipt && c.receipt.status})`)
    const dirForm = r.run('commit-wo', ['--wo', 'WO-01-001', '--files', 'src'])
    ok(dirForm.code === 4 && dirForm.receipt.status === 'parked-leftover', 'a --files directory covering the leftover is refused')
    ok(/IN_PROGRESS/.test(r.read(WO_A)) && r.read('src/stray.ts') === 'export const stray = 1\n', 'nothing was stamped, committed or touched')
    r.write('src/stray.ts', 'export const stray = 2 // this work order now owns its change\n')
    const changed = r.run('commit-wo', ['--wo', 'WO-01-001', '--files', 'src/**'])
    ok(changed.code === 0 && changed.receipt.status === 'committed' && r.filesAt().includes('proj/src/stray.ts'), `a leftover that no longer holds the parked content is this build's edit: it commits (got ${changed.code} ${changed.receipt && (changed.receipt.status + ' ' + (changed.receipt.reason || ''))})`)
  } finally { r.cleanup() }
  const pc = leftover()
  try {
    const parkedDir = path.join(pc.proj, '.pandacorp', 'run', 'parked')
    ok(existsSync(parkedDir) && readdirSync(parkedDir).length === 1, 'the park left one record')
    const pre = pc.run('precheck')
    ok(pre.code === 0 && (!existsSync(parkedDir) || readdirSync(parkedDir).length === 0), `the precheck clears the parked records (got ${existsSync(parkedDir) ? readdirSync(parkedDir).join(',') : 'none'})`)
    const c = pc.run('commit-wo', [...ALPHA_FILES, '--extra', 'src/stray.ts', '--reason', 'shared helper'])
    ok(c.code === 0 && c.receipt.status === 'committed', `after the precheck no record refuses it (got ${c.code} ${c.receipt && c.receipt.status})`)
  } finally { pc.cleanup() }
  const dc = leftover()
  try {
    const parkedDir = path.join(dc.proj, '.pandacorp', 'run', 'parked')
    const d = dc.run('dispatch', ['--wo', 'WO-02-001'])
    ok(d.code === 0 && (!existsSync(parkedDir) || readdirSync(parkedDir).length === 0), 'a dispatch clears the parked records')
  } finally { dc.cleanup() }
  // The classic waves never record leftovers: a parallel sibling's files are dirty at the same time and are its own.
  const cl = mkRepo()
  try {
    cl.installVitest()
    cl.write('src/beta.ts', 'export const beta = \n')
    buildAlpha(cl)
    const p = cl.run('park-wo', ['--wo', 'WO-01-002', '--files', 'src/beta.ts'])
    ok(p.code === 0 && !existsSync(path.join(cl.proj, '.pandacorp', 'run', 'parked')), 'a classic park (no --all-undeclared) records no leftover')
    const c = cl.run('commit-wo', ALPHA_FILES)
    ok(c.code === 0 && c.receipt.status === 'committed', `the sibling commits its own files (got ${c.code} ${c.receipt && c.receipt.status})`)
  } finally { cl.cleanup() }
}

// ── precheck ─────────────────────────────────────────────────────────────────────────────────────
console.log('precheck: pending reverts recovered, engine-owned dirt salvaged, the journals committed, owner dirt untouched')
{
  const r = mkRepo()
  try {
    // An interrupted discard: WO-01-001 built (IN_REVIEW + code), then flipped back to PLANNED; the apply never ran.
    r.write('src/alpha.ts', 'export const alpha = "rejected"\n')
    r.write(WO_A, WO_A_TEXT('IN_REVIEW'))
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'feat(frd-01-alpha): WO-01-001 alpha')
    r.write(WO_A, WO_A_TEXT('PLANNED'))
    r.git('commit', '-q', '-am', 'chore(frd-01-alpha): reopen WO-01-001')
    r.write('.pandacorp/run/wo-revert/pending-frd-01-alpha.json', `${JSON.stringify({ version: 1, frd: 'frd-01-alpha', wos: ['WO-01-001'], expectStatus: 'PLANNED', seam: [], head: 'x', at: new Date().toISOString() })}\n`)
    // A crash residue: dirty WO frontmatter (engine-owned) + a paused run's journal lines, next to owner edits.
    r.write(WO_B, woMd('WO-01-002', 'IN_REVIEW', { acs: ['AC-01-002.1'] }))
    r.write('.pandacorp/track.jsonl', '{"kind":"start"}\n{"kind":"build_paused","reason":"limit"}\n')
    r.write('.pandacorp/build-journal.jsonl', '{"kind":"attempt","wo":"WO-01-002"}\n')
    r.write('src/owner.ts', 'owner work in progress\n')
    r.write('.pandacorp/status.yaml', 'phase: implementation\nrunning: true\n')
    const p = r.run('precheck', ['--events', r.events])
    ok(p.code === 0 && p.sealed && p.receipt.onMain === true, 'precheck exits 0 with one sealed line, on main')
    ok(p.receipt.reverts.length === 1 && p.receipt.reverts[0].frd === 'frd-01-alpha' && p.receipt.reverts[0].recovery === 'recovered' && r.read('src/alpha.ts') === null, 'the interrupted discard is finished first (wo-revert recover)')
    const salvaged = p.receipt.salvaged.map((x) => x.path).sort()
    ok(JSON.stringify(salvaged) === JSON.stringify([WO_B]), `only the engine-owned WO frontmatter is salvaged, never a journal (${salvaged.join(', ')})`)
    ok(/build_paused/.test(r.atHead('.pandacorp/track.jsonl') || '') && /"attempt"/.test(r.atHead('.pandacorp/build-journal.jsonl') || '') && p.receipt.journalsCommit && r.git('log', '--format=%s', '-20').split('\n').some((x) => /journals/.test(x)), `the append-only journals are committed (the build_paused line survives into the timeline), never reset (got ${p.receipt.journalsCommit})`)
    ok(!r.status().split('\n').some((l) => /\.pandacorp\/(track|build-journal)\.jsonl$/.test(l)), 'no journal is left dirty')
    ok(r.read(WO_B) === woMd('WO-01-002', 'PLANNED', { acs: ['AC-01-002.1'] }) && /IN_REVIEW/.test(readFileSync(path.join(r.proj, p.receipt.salvageDir, WO_B), 'utf8')), 'the WO frontmatter is reset to HEAD and its dirty copy kept in salvage')
    ok(r.read('src/owner.ts') === 'owner work in progress\n' && /running: true/.test(r.read('.pandacorp/status.yaml')) && p.receipt.ownerDirt.includes('src/owner.ts'), 'owner dirt and the lease projection are never touched (owner dirt reported)')
  } finally { r.cleanup() }
  const b = mkRepo()
  try {
    b.git('checkout', '-q', '-b', 'build/x')
    b.write(WO_B, woMd('WO-01-002', 'IN_REVIEW'))
    b.write('.pandacorp/track.jsonl', '{"kind":"start"}\n{"kind":"build_paused"}\n')
    const head = b.head()
    const p = b.run('precheck', ['--events', b.events])
    ok(p.code === 0 && p.receipt.onMain === false && p.receipt.salvaged.length === 0 && /IN_REVIEW/.test(b.read(WO_B)), 'off main: nothing is salvaged or reset')
    ok(b.head() === head && /build_paused/.test(b.read('.pandacorp/track.jsonl')) && !p.receipt.journalsCommit, 'off main: the journals are neither committed nor reset')
  } finally { b.cleanup() }
}

// ── precheck: stamp-anchored resume demotion (proposal 39 §2 C7) ────────────────────────────────
console.log('precheck: an IN_REVIEW counts only with a flip commit after its last IN_PROGRESS stamp commit')
{
  const r = mkRepo()
  try {
    // WO-01-001: dispatched (IN_PROGRESS in the init commit = its stamp), then its own commit flips it IN_REVIEW → kept.
    r.write('src/alpha.ts', 'export const alpha = 1\n')
    r.write(WO_A, WO_A_TEXT('IN_REVIEW'))
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'feat(frd-01-alpha): WO-01-001 alpha')
    // WO-02-001: a classic history, no IN_PROGRESS stamp ever committed, the flip committed → kept (no stamp, no window).
    r.write('src/gamma.ts', 'export const gamma = 1\n')
    r.write(WO_C, woMd('WO-02-001', 'IN_REVIEW', { acs: ['AC-02-001.1'] }))
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'feat(frd-02-gamma): WO-02-001 gamma')
    // WO-01-002: its IN_REVIEW reached HEAD only through a merge of a flip that predates its last stamp (not after it).
    r.git('checkout', '-q', '-b', 'side')
    r.write('src/beta.ts', 'export const beta = 1\n')
    r.write(WO_B, woMd('WO-01-002', 'IN_REVIEW', { acs: ['AC-01-002.1'] }))
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'feat(frd-01-alpha): WO-01-002 beta')
    r.git('checkout', '-q', 'main')
    const d = r.run('dispatch', ['--wo', 'WO-01-002', '--commit'])
    ok(d.code === 0 && d.receipt.committed, 'fixture: WO-01-002 IN_PROGRESS stamp committed on main')
    r.git('merge', '-q', '--no-ff', '--no-edit', '-X', 'theirs', 'side')
    ok(/implementation_status: IN_REVIEW/.test(r.atHead(WO_B)), 'fixture: HEAD reads WO-01-002 IN_REVIEW')
    const before = r.head()
    const p = r.run('precheck', ['--events', r.events])
    ok(p.code === 0 && p.sealed, `precheck exits 0 with one sealed line (got ${p.code} ${p.line.slice(0, 160)})`)
    const demoted = (p.receipt.demoted || []).map((x) => x.wo)
    ok(JSON.stringify(demoted) === JSON.stringify(['WO-01-002']), `only the unstamped IN_REVIEW is demoted (got ${JSON.stringify(demoted)})`)
    ok(JSON.stringify([...(p.receipt.keptInReview || [])].sort()) === JSON.stringify(['WO-01-001', 'WO-02-001']), `the stamped and the classic IN_REVIEW are kept (got ${JSON.stringify(p.receipt.keptInReview)})`)
    ok(/^implementation_status: PLANNED$/m.test(r.atHead(WO_B)) && r.head() !== before && /WO-01-002/.test(r.subject()) && /demote/i.test(r.subject()), `the demotion to PLANNED is ONE commit naming the WO (${r.subject()})`)
    ok(r.filesAt().join() === `proj/${WO_B}`, `the demotion commit holds exactly that WO file (${r.filesAt().join(', ')})`)
    ok(r.read('src/beta.ts') === 'export const beta = 1\n', 'the demoted WO\'s code is not touched (it is rebuilt over, never discarded here)')
    ok(/implementation_status: IN_REVIEW/.test(r.atHead(WO_A)) && /implementation_status: IN_REVIEW/.test(r.atHead(WO_C)), 'the kept WOs stay IN_REVIEW at HEAD')
    ok(r.status().split('\n').filter(Boolean).length === 0, 'the tree is clean after the demotion')
    const headAfter = r.head()
    const again = r.run('precheck', ['--events', r.events])
    ok(again.code === 0 && (again.receipt.demoted || []).length === 0 && r.head() === headAfter, 'a second precheck demotes nothing and commits nothing (idempotent)')
  } finally { r.cleanup() }
  // A builder stamped IN_REVIEW but its commit never ran (a crash, an infra halt): HEAD holds only the stamp.
  const u = mkRepo()
  try {
    u.run('dispatch', ['--wo', 'WO-01-002', '--commit'])
    u.write('src/beta.ts', 'export const beta = "uncommitted"\n')
    u.write(WO_B, woMd('WO-01-002', 'IN_REVIEW', { acs: ['AC-01-002.1'] }))
    const p = u.run('precheck', ['--events', u.events])
    const d = (p.receipt.demoted || []).find((x) => x.wo === 'WO-01-002')
    ok(p.code === 0 && d && d.why === 'uncommitted-flip' && d.to === 'IN_PROGRESS', `an uncommitted IN_REVIEW flip is reported demoted to its HEAD state (got ${JSON.stringify(p.receipt.demoted)})`)
    ok(/^implementation_status: IN_PROGRESS$/m.test(u.read(WO_B)), 'the WO file is back at its committed IN_PROGRESS stamp (pending → rebuilt)')
  } finally { u.cleanup() }
  // Off main nothing is written: the demotion is reported, never applied.
  const o = mkRepo()
  try {
    o.git('checkout', '-q', '-b', 'side')
    o.write(WO_B, woMd('WO-01-002', 'IN_REVIEW'))
    o.git('commit', '-q', '-am', 'flip on side')
    o.git('checkout', '-q', 'main')
    o.run('dispatch', ['--wo', 'WO-01-002', '--commit'])
    o.git('merge', '-q', '--no-ff', '--no-edit', '-X', 'theirs', 'side')
    o.git('checkout', '-q', '-b', 'build/x')
    const before = o.head()
    const p = o.run('precheck', ['--events', o.events])
    const d = (p.receipt.demoted || []).find((x) => x.wo === 'WO-01-002')
    ok(p.code === 0 && d && d.applied === false && o.head() === before && /IN_REVIEW/.test(o.read(WO_B)), 'off main the demotion is reported (applied:false) and nothing is written')
  } finally { o.cleanup() }
}

// A freshly architected project has verify.sh red BY CONSTRUCTION (knip flags the deps the WOs will import, vitest finds
// no tests): the precheck says so deterministically, from status.yaml and the work-order frontmatter, never model prose.
console.log('precheck: greenfield = no last_green_sha and every work order PLANNED/DRAFT or only dispatched (none built, none BLOCKED)')
{
  const fresh = (statusYaml, statuses) => {
    const r = mkRepo()
    r.write('.pandacorp/status.yaml', statusYaml)
    r.write(WO_A, woMd('WO-01-001', statuses[0]))
    r.write(WO_B, woMd('WO-01-002', statuses[1]))
    r.write(WO_C, woMd('WO-02-001', statuses[2]))
    r.git('add', '-A')
    r.git('commit', '-q', '-m', 'docs: architecture')
    return r
  }
  const gf = (r) => { const p = r.run('precheck'); return { p, g: p.receipt && p.receipt.greenfield } }
  const cases = [
    ['no last_green_sha, every WO PLANNED', 'phase: implementation\n', ['PLANNED', 'PLANNED', 'PLANNED'], true],
    ['an empty last_green_sha, PLANNED + DRAFT', 'phase: implementation\nlast_green_sha: ""\n', ['PLANNED', 'DRAFT', 'PLANNED'], true],
    ['last_green_sha: null', 'phase: implementation\nlast_green_sha: null # never published\n', ['PLANNED', 'PLANNED', 'PLANNED'], true],
    ['a published last_green_sha', 'phase: implementation\nlast_green_sha: 0123456789abcdef0123456789abcdef01234567\n', ['PLANNED', 'PLANNED', 'PLANNED'], false],
    ['an unreadable last_green_sha value', 'phase: implementation\nlast_green_sha: TBD\n', ['PLANNED', 'PLANNED', 'PLANNED'], false],
    ['one WO already IN_REVIEW', 'phase: implementation\n', ['PLANNED', 'IN_REVIEW', 'PLANNED'], false],
    // A fast run paused before its first commit-wo left only committed dispatch stamps: still nothing built.
    ['a committed dispatch stamp (IN_PROGRESS), nothing committed IN_REVIEW', 'phase: implementation\n', ['IN_PROGRESS', 'IN_PROGRESS', 'PLANNED'], true],
    ['IN_PROGRESS next to a WO already IN_REVIEW', 'phase: implementation\n', ['IN_PROGRESS', 'IN_REVIEW', 'PLANNED'], false],
    ['one WO VERIFIED', 'phase: implementation\n', ['VERIFIED', 'PLANNED', 'PLANNED'], false],
    ['one WO BLOCKED', 'phase: implementation\n', ['PLANNED', 'PLANNED', 'BLOCKED'], false],
    // adopted-brownfield-is-not-greenfield: /pandacorp:adopt writes `created_via: adopt` and leaves last_green_sha empty
    // and the reconstructed WOs PLANNED, but its code exists: its verify.sh is not red by construction.
    ['adopted-brownfield-is-not-greenfield (created_via: adopt, every WO PLANNED)', 'phase: implementation\ncreated_via: adopt\nlast_green_sha: ""\n', ['PLANNED', 'PLANNED', 'PLANNED'], false],
  ]
  for (const [what, yaml, statuses, want] of cases) {
    const r = fresh(yaml, statuses)
    try {
      const { p, g } = gf(r)
      ok(p.code === 0 && p.sealed && g && g.greenfield === want && typeof g.reason === 'string' && g.reason.length > 0, `${what} → greenfield ${want} (got ${JSON.stringify(g)})`)
    } finally { r.cleanup() }
  }
  // A WO committed IN_REVIEW once and demoted back to PLANNED (a resume demotion) left its code: never greenfield again.
  const once = fresh('phase: implementation\n', ['PLANNED', 'PLANNED', 'PLANNED'])
  try {
    once.write(WO_B, woMd('WO-01-002', 'IN_REVIEW'))
    once.write('src/beta.ts', 'export const beta = 1\n')
    once.git('add', '-A')
    once.git('commit', '-q', '-m', 'feat: WO-01-002')
    once.write(WO_B, woMd('WO-01-002', 'PLANNED'))
    once.git('commit', '-q', '-am', 'chore(build): demote WO-01-002')
    const { g } = gf(once)
    ok(g && g.greenfield === false && /git history/.test(g.reason || ''), `a WO EVER IN_REVIEW in the history is not greenfield, even demoted (got ${JSON.stringify(g)})`)
  } finally { once.cleanup() }
  const empty = mkRepo()
  try {
    empty.git('rm', '-q', '-r', '--', 'proj/docs')
    empty.git('commit', '-q', '-m', 'chore: no work orders')
    const { g } = gf(empty)
    ok(g && g.greenfield === false, `no work order at all is not greenfield (nothing to build) (got ${JSON.stringify(g)})`)
  } finally { empty.cleanup() }
}

// ── dispatch ─────────────────────────────────────────────────────────────────────────────────────
console.log('dispatch: the IN_PROGRESS stamp, frontmatter only, optionally committed')
{
  const r = mkRepo()
  try {
    const before = r.head()
    const d = r.run('dispatch', ['--wo', 'WO-01-002'])
    ok(d.code === 0 && d.sealed && d.receipt.stamped.includes('WO-01-002') && /^implementation_status: IN_PROGRESS$/m.test(r.read(WO_B)) && /implementation_status: prose mention/.test(r.read(WO_B)) && r.head() === before, 'stamps the frontmatter only, no commit by default')
    const c = r.run('dispatch', ['--wo', 'WO-02-001', '--commit'])
    ok(c.code === 0 && c.receipt.committed && /WO-02-001/.test(r.subject()) && r.filesAt().join() === `proj/${WO_C}`, '--commit makes one stamp commit of exactly that WO file')
    ok(c.receipt.base && r.git('rev-parse', `${c.receipt.committed}^`).startsWith(c.receipt.base), 'the receipt names the base: HEAD before the stamp commit (the landed-diff anchor, proposal 39 C3)')
    r.git('checkout', '-q', '--', `proj/${WO_B}`)
    r.write(WO_B, woMd('WO-01-002', 'VERIFIED'))
    r.git('commit', '-q', '-am', 'verified')
    const v = r.run('dispatch', ['--wo', 'WO-01-002'])
    ok(v.code === 4 && v.receipt.status === 'refused' && /VERIFIED/.test(r.read(WO_B)), 'a VERIFIED WO is never re-dispatched')
  } finally { r.cleanup() }
}

// ── safe-point probe ─────────────────────────────────────────────────────────────────────────────
console.log('safe-point: the probe decides whether the LLM drain is needed')
{
  const r = mkRepo()
  try {
    const quiet = r.run('safe-point')
    ok(quiet.code === 0 && quiet.sealed && quiet.receipt.work === false && quiet.receipt.stop === false && quiet.receipt.stop_receipt.method === 'node-lstat' && quiet.receipt.stop_receipt.status_exists === true, 'nothing queued → work:false with a valid stop receipt')
    r.write('.pandacorp/inbox/changes/b-standard.md', '---\ntype: change\nclass: standard\nstatus: ready\ndate: 2026-09-01\n---\nbody\n')
    r.write('.pandacorp/inbox/changes/a-expedite.md', '---\ntype: bug\nclass: expedite\nstatus: ready\ndate: 2026-09-20\n---\nbody\n')
    r.write('.pandacorp/inbox/changes/c-draft.md', '---\ntype: change\nclass: standard\nstatus: draft\ndate: 2026-08-01\n---\n')
    r.write('.pandacorp/inbox/changes/done/old.md', '---\nstatus: ready\n---\n')
    const q = r.run('safe-point')
    ok(q.receipt.work === true && JSON.stringify(q.receipt.ready) === JSON.stringify(['a-expedite', 'b-standard']), `ready changes, expedite first, done/ ignored (${q.receipt.ready})`)
    const t = r.run('safe-point', ['--targeted'])
    ok(t.receipt.work === false && t.receipt.ready.length === 0, 'a targeted run never drains the queue')
    rmSync(r.abs('.pandacorp/inbox/changes'), { recursive: true })
    r.write(WO_B, woMd('WO-01-002', 'BLOCKED', { extraFm: 'blocked_reason: needs-owner\n' }))
    const unanswered = r.run('safe-point')
    ok(unanswered.receipt.work === false && unanswered.receipt.blockedNeedsOwner.length === 1, 'a needs-owner block with no answered decision is no work')
    r.write('.pandacorp/inbox/decisions.md', '# Decisiones\n\n## 2026-09-30 — Algo\n- **Estado:** RESUELTO: usar A (2026-10-01)\n')
    const answered = r.run('safe-point')
    ok(answered.receipt.work === true && answered.receipt.answeredDecisions === 1, 'an answered decision over a needs-owner block → work:true')
    r.write('.pandacorp/run/stop', '')
    const stop = r.run('safe-point')
    ok(stop.receipt.stop === true && stop.receipt.stop_receipt.stop === true, 'the owner stop file is reported through the lstat receipt')
    rmSync(r.abs('.pandacorp/run/stop'))
    r.write('.pandacorp/status.yaml', 'phase: implementation\nrethink_pending: true\n')
    ok(r.run('safe-point').receipt.stop === true, 'rethink_pending → stop')
  } finally { r.cleanup() }
  const f = mkRepo()
  try {
    const lease = await acquire(f.proj, { runtime: 'claude', runId: 'mech-test', ttlSeconds: 60 })
    const fenced = f.run('safe-point', ['--token', lease.token, '--epoch', String(lease.epoch)])
    ok(fenced.code === 0 && fenced.receipt.renewed === true && fenced.receipt.stop === false, 'with the lease token the probe renews the lease (fenced)')
    const foreign = f.run('safe-point', ['--token', 'not-the-token', '--epoch', String(lease.epoch)])
    ok(foreign.receipt.stop === true && foreign.receipt.renewed === false && /fence/i.test(foreign.receipt.reason), 'a stale or foreign fence → stop:true, nothing else read')
  } finally { f.cleanup() }
}

// ── reuse-check ──────────────────────────────────────────────────────────────────────────────────
console.log('reuse-check: a fresh, full, green report of HEAD over a clean tree is reusable; nothing else is')
{
  const r = mkRepo()
  try {
    const report = (over) => r.write('.pandacorp/run/gate-report.json', JSON.stringify({ scope: 'full', green: true, sha: r.git('rev-parse', 'HEAD'), at: new Date().toISOString(), ...over }))
    ok(r.run('reuse-check').receipt.reason === 'no-report', 'no report → no-report')
    report({})
    sealReportProvenance(projectCtx(r.proj), 'verify')   // proposal 40: only a script-written report is reusable
    const yes = r.run('reuse-check')
    ok(yes.code === 0 && yes.sealed && yes.receipt.canReuse === true && yes.receipt.reason === 'reused', 'full + green + HEAD + clean + fresh + script-written → reused')
    report({ scope: 'since' }); ok(r.run('reuse-check').receipt.reason === 'scope-not-eligible', 'since scope never counts')
    report({ green: false }); ok(r.run('reuse-check').receipt.reason === 'not-green', 'red never counts')
    report({ sha: 'deadbeef' }); ok(r.run('reuse-check').receipt.reason === 'sha-mismatch', 'another sha never counts')
    report({ at: new Date(Date.now() - 3600 * 1000).toISOString() }); ok(r.run('reuse-check').receipt.reason === 'stale-report', 'an old report never counts')
    report({}); r.write('src/existing.ts', 'dirty\n'); ok(r.run('reuse-check').receipt.reason === 'dirty-tree', 'a dirty tree never counts')
  } finally { r.cleanup() }
}

// proposal 40 §2 (Self-verify / scripted verify): a report the builder wrote (it ran verify.sh by hand) is never reused;
// only the report the scripted verify wrote, its content hash intact, of exactly HEAD.
console.log('reuse-check-rejects-builder-written-report: only the script-written report, hash intact, is reusable')
{
  const r = mkRepo()
  try {
    const headSha = r.git('rev-parse', 'HEAD')
    const report = (over) => r.write('.pandacorp/run/gate-report.json', JSON.stringify({ scope: 'full', green: true, sha: headSha, at: new Date().toISOString(), ...over }))
    report({})
    const builder = r.run('reuse-check')
    ok(builder.receipt.canReuse === false && builder.receipt.reason === 'not-script-written', `a full green report of HEAD with no script provenance (the builder ran verify.sh) → not-script-written (got ${builder.receipt.reason})`)
    sealReportProvenance(projectCtx(r.proj), 'verify')
    ok(r.run('reuse-check').receipt.reason === 'reused', 'the same report sealed by the scripted verify → reused')
    report({ by: 'the builder, by hand' })
    const rewritten = r.run('reuse-check')
    ok(rewritten.receipt.canReuse === false && rewritten.receipt.reason === 'report-hash-mismatch', `a report rewritten after the seal (same verdict, new bytes) → report-hash-mismatch (got ${rewritten.receipt.reason})`)
    sealReportProvenance(projectCtx(r.proj), 'verify')
    const prov = r.abs('.pandacorp/run/gate-report.provenance.json')
    writeFileSync(prov, readFileSync(prov, 'utf8').replace('"writer":"verify"', '"writer":"builder"'))
    ok(r.run('reuse-check').receipt.reason === 'not-script-written', 'a provenance line whose seal no longer holds → not-script-written')
  } finally { r.cleanup() }
}

// ── gate-prepare / gate-release ──────────────────────────────────────────────────────────────────
console.log('gate-prepare / gate-release: the gate worktree lifecycle, deterministic')
{
  const r = mkRepo()
  try {
    const wt = path.join(r.root, '.wt-gate-1')
    const sha1 = r.head()
    const p1 = r.run('gate-prepare', ['--path', wt, '--sha', sha1, '--port', '3810'])
    ok(p1.code === 0 && p1.sealed && p1.receipt.ok === true && p1.receipt.created === true, 'a missing worktree is created at the sha')
    ok(readFileSync(path.join(wt, 'proj/.pandacorp/run/bootstrapped'), 'utf8').trim() === 'port=3810', 'the bootstrap ran from the PROJECT dir inside the worktree, with the slot port')
    r.write('src/next.ts', 'next\n'); r.git('add', '-A'); r.git('commit', '-q', '-m', 'next')
    const p2 = r.run('gate-prepare', ['--path', wt, '--sha', r.head()])
    ok(p2.receipt.ok === true && p2.receipt.created === false && spawnSync('git', ['rev-parse', 'HEAD'], { cwd: wt, encoding: 'utf8' }).stdout.trim() === r.head(), 'a registered clean worktree is re-pinned to the new sha')
    writeFileSync(path.join(wt, 'proj/src/existing.ts'), 'reviewer edit\n')
    mkdirSync(path.join(wt, 'proj/src/_tests'), { recursive: true })
    writeFileSync(path.join(wt, 'proj/src/_tests/adversarial.test.ts'), 'it("x", () => {})\n')
    writeFileSync(path.join(wt, 'proj/.pandacorp/run/gate-report.json'), '{"green":false}\n')
    const dirty = r.run('gate-prepare', ['--path', wt, '--sha', sha1])
    ok(dirty.code === 4 && dirty.receipt.ok === false && dirty.receipt.dirty.length === 2 && existsSync(path.join(wt, 'proj/src/_tests/adversarial.test.ts')), 'a dirty worktree is refused with its dirt listed, and left untouched')
    const ev = path.join(r.root, 'evidence')
    const rel = r.run('gate-release', ['--path', wt, '--dir', ev])
    ok(rel.code === 0 && rel.sealed && rel.receipt.remaining.length === 0, 'release leaves the worktree clean')
    const byPath = Object.fromEntries((rel.receipt.salvaged || []).map((x) => [x.path, x]))
    ok(byPath['proj/src/_tests/adversarial.test.ts'] && byPath['proj/src/_tests/adversarial.test.ts'].status === 'untracked' && /^[0-9a-f]{64}$/.test(byPath['proj/src/_tests/adversarial.test.ts'].sha256) && byPath['proj/src/existing.ts'].status === 'modified', 'each dirty path is salvaged with its status and sha256 (repo-root paths)')
    ok(readFileSync(path.join(ev, 'proj/src/_tests/adversarial.test.ts'), 'utf8') === 'it("x", () => {})\n' && readFileSync(path.join(ev, 'gate-report.json'), 'utf8') === '{"green":false}\n', 'the evidence dir holds the copies and the gitignored gate report')
    ok(readFileSync(path.join(wt, 'proj/src/existing.ts'), 'utf8') === 'export const existing = 1\n' && !existsSync(path.join(wt, 'proj/src/_tests/adversarial.test.ts')), 'the worktree paths are cleaned exactly')
  } finally { r.cleanup() }
}
// Bench FM-2: a slot registered in git whose directory is gone (`git worktree list` marks it prunable) — the stale
// admin entry is pruned and the slot recreated; a LOCKED missing entry is never pruned (it stays refused).
{
  const r = mkRepo()
  try {
    const wt = path.join(r.root, '.wt-gate-2')
    ok(r.run('gate-prepare', ['--path', wt, '--sha', r.head()]).receipt.ok === true, 'setup: the slot exists')
    rmSync(wt, { recursive: true, force: true })
    ok(/prunable/.test(r.git('worktree', 'list', '--porcelain')), 'setup: git still registers the slot, marked prunable')
    const again = r.run('gate-prepare', ['--path', wt, '--sha', r.head()])
    ok(again.code === 0 && again.sealed && again.receipt.ok === true && again.receipt.created === true && existsSync(path.join(wt, 'proj/.pandacorp/run/bootstrapped')), `a registered-but-missing slot is pruned and recreated (got ${again.code} ${JSON.stringify(again.receipt)})`)
    ok(!/prunable/.test(r.git('worktree', 'list', '--porcelain')), 'no prunable entry remains after the recreate')
    const locked = path.join(r.root, '.wt-gate-3')
    ok(r.run('gate-prepare', ['--path', locked, '--sha', r.head()]).receipt.ok === true, 'setup: a second slot exists')
    r.git('worktree', 'lock', locked)
    rmSync(locked, { recursive: true, force: true })
    const refused = r.run('gate-prepare', ['--path', locked, '--sha', r.head()])
    ok(refused.code === 4 && refused.receipt.ok === false && /missing/.test(refused.receipt.failure) && /locked/.test(r.git('worktree', 'list', '--porcelain')), 'a LOCKED missing slot is never pruned: refused, its entry kept')
    const dirtyWt = path.join(r.root, '.wt-gate-1')
    ok(r.run('gate-prepare', ['--path', dirtyWt, '--sha', r.head()]).receipt.ok === true, 'setup: a third slot exists')
    writeFileSync(path.join(dirtyWt, 'proj/src/stray.ts'), 'evidence\n')
    const dirty = r.run('gate-prepare', ['--path', dirtyWt, '--sha', r.head()])
    ok(dirty.code === 4 && dirty.receipt.dirty.length === 1 && existsSync(path.join(dirtyWt, 'proj/src/stray.ts')), 'the prune path never touches an existing dirty slot (BL-0067 evidence kept)')
  } finally { r.cleanup() }
}


// ── proposal 40 §2 Close-out engine fixes: the gate lands its own reviewer tests and blesses new-route baselines at
// green, with DR-080 provenance; the builder never blesses. gate-release records a manifest (+ a patch per modified
// tracked file) next to the salvaged copies; gate-land puts them on main as ONE commit naming the gate and its pin.
console.log('gate-blesses-new-route-with-provenance: gate-release + gate-land commit the reviewer tests and the new-route bless')
{
  const r = mkRepo()
  try {
    r.write('e2e/routes.ts', 'export const SURFACES = [\n  { id: "home", frd: "frd-01-alpha", path: "/", name: "Home", blessed: false },\n] as const;\n')
    r.write('docs/frds/frd-01-alpha/fdd.md', '---\nid: FDD-01\nprototype_blessed_at: \'\'\n---\n# FDD\n')
    r.write('e2e/visual.spec.ts-snapshots/old-desktop.png', 'OLD-PNG')
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'chore: surfaces')
    const pin = r.head()
    const wt = path.join(r.root, '.wt-gate-land')
    ok(r.run('gate-prepare', ['--path', wt, '--sha', pin]).receipt.ok === true, 'setup: the gate slot at the pin')
    const W = (rel, body) => { mkdirSync(path.dirname(path.join(wt, 'proj', rel)), { recursive: true }); writeFileSync(path.join(wt, 'proj', rel), body) }
    W('src/_tests/alpha.reviewer.test.ts', 'it("AC-01-001.1 reviewer", () => {})\n')
    W('e2e/visual.spec.ts-snapshots/home-desktop.png', 'NEW-PNG')
    W('e2e/visual.spec.ts-snapshots/old-desktop.png', 'CHANGED-OLD-PNG')
    W('e2e/routes.ts', 'export const SURFACES = [\n  { id: "home", frd: "frd-01-alpha", path: "/", name: "Home", blessed: true },\n] as const;\n')
    W('docs/frds/frd-01-alpha/fdd.md', '---\nid: FDD-01\nprototype_blessed_at: \'abc1234\'\n---\n# FDD\n\nBlessed against docs/design/prototype/home.html (Layer-B sign-off).\n')
    W('scratch/notes.txt', 'reviewer scratch\n')
    const ev = path.join(r.root, 'evidence-land')
    const rel = r.run('gate-release', ['--path', wt, '--dir', ev])
    ok(rel.code === 0 && rel.receipt.remaining.length === 0 && existsSync(path.join(ev, 'gate-manifest.json')), 'release cleans the slot and records a manifest next to the copies')
    // main moved since the pin: another FRD appended a surface to routes.ts and the builder has WIP elsewhere.
    r.write('e2e/routes.ts', 'export const SURFACES = [\n  { id: "home", frd: "frd-01-alpha", path: "/", name: "Home", blessed: false },\n  { id: "gamma", frd: "frd-02-gamma", path: "/gamma", name: "Gamma", blessed: false },\n] as const;\n')
    r.git('add', '-A', '--', 'proj'); r.git('commit', '-q', '-m', 'feat: gamma surface')
    r.write('src/gamma-wip.ts', 'export const wip = 1\n')
    const before = r.head()
    const land = r.run('gate-land', ['--dir', ev, '--frd', 'frd-01-alpha', '--pin', pin])
    ok(land.code === 0 && land.sealed && land.receipt.status === 'landed' && r.head() !== before, `gate-land commits on main (got ${land.code} ${JSON.stringify(land.receipt && { s: land.receipt.status, r: land.receipt.reason || land.receipt.error })})`)
    const files = r.filesAt()
    ok(['proj/src/_tests/alpha.reviewer.test.ts', 'proj/e2e/visual.spec.ts-snapshots/home-desktop.png', 'proj/e2e/routes.ts', 'proj/docs/frds/frd-01-alpha/fdd.md'].every((f) => files.includes(f)) && files.length === 4, `ONE commit: the reviewer test, the NEW baseline, the bless flip and its fdd provenance (got ${files.join(', ')})`)
    ok(/blessed: true/.test(r.atHead('e2e/routes.ts')) && /gamma/.test(r.atHead('e2e/routes.ts')), 'the bless is a 3-way patch: main\'s newer surface is kept, the gate\'s flip applied')
    ok(r.atHead('e2e/visual.spec.ts-snapshots/old-desktop.png') === 'OLD-PNG' && land.receipt.refused.some((x) => /old-desktop\.png/.test(x.path) && x.why === 'changed-baseline'), 'a CHANGED existing baseline is never landed (a blessed baseline change is a regression, not a bless)')
    ok(land.receipt.kept.some((x) => /scratch\/notes\.txt/.test(x)) && !files.includes('proj/scratch/notes.txt'), 'gate scratch stays evidence only')
    ok(/\(DR-080\)/.test(r.body()) && new RegExp(`Gate-Pin: ${pin.slice(0, 12)}`).test(r.body()) && /Blessed-By: frd-gate frd-01-alpha/.test(r.body()) && /^test\(frd-01-alpha\):/.test(r.subject()), `the commit carries the DR-080 provenance: the gate, its FRD and pin (got ${JSON.stringify(r.body())})`)
    ok(r.status().split('\n').filter((l) => / proj\//.test(l)).join() === '?? proj/src/gamma-wip.ts', 'the builder\'s WIP on main is untouched and uncommitted')
    const again = r.run('gate-land', ['--dir', ev, '--frd', 'frd-01-alpha', '--pin', pin])
    ok(again.code === 0 && again.receipt.status === 'nothing', 'a second landing of the same evidence is an idempotent no-op')
  } finally { r.cleanup() }
}
console.log('gate-land: a conflicting copy on main refuses before writing anything; no manifest refuses')
{
  const r = mkRepo()
  try {
    const ev = path.join(r.root, 'ev-none')
    const none = r.run('gate-land', ['--dir', ev, '--frd', 'frd-01-alpha'])
    ok(none.code === 4 && none.receipt.status === 'no-manifest', 'no manifest → refused (the engine falls back to the apply agent)')
    const wt = path.join(r.root, '.wt-gate-c')
    r.run('gate-prepare', ['--path', wt, '--sha', r.head()])
    mkdirSync(path.join(wt, 'proj/src/_tests'), { recursive: true })
    writeFileSync(path.join(wt, 'proj/src/_tests/x.reviewer.test.ts'), 'reviewer\n')
    r.run('gate-release', ['--path', wt, '--dir', ev])
    r.write('src/_tests/x.reviewer.test.ts', 'someone else\n')
    const before = r.head()
    const c = r.run('gate-land', ['--dir', ev, '--frd', 'frd-01-alpha'])
    ok(c.code === 4 && c.receipt.status === 'conflict' && r.head() === before && r.read('src/_tests/x.reviewer.test.ts') === 'someone else\n', 'a different file already at the path → conflict, nothing written or committed')
  } finally { r.cleanup() }
}
console.log('commit-wo: the builder never blesses a visual baseline (DR-080)')
{
  const r = mkRepo()
  try {
    buildAlpha(r)
    r.write('e2e/visual.spec.ts-snapshots/home-desktop.png', 'PNG')
    const c = r.run('commit-wo', [...ALPHA_FILES, '--extra', 'e2e/visual.spec.ts-snapshots/home-desktop.png', '--reason', 'the visual gate wrote it'])
    ok(c.code === 4 && c.receipt.status === 'builder-baseline' && /DR-080/.test(c.receipt.reason) && /implementation_status: IN_PROGRESS/.test(r.read(WO_A)), `a baseline PNG in a builder commit is refused, nothing stamped (got ${c.receipt && c.receipt.status})`)
  } finally { r.cleanup() }
}

// ── plan / classify-frd / verify: the fast lane's deterministic plan, floor and USABLE check (proposal 39 C3/C4/C6) ──
const FRD_A = 'docs/frds/frd-01-alpha'
const FRD_C = 'docs/frds/frd-02-gamma'
const frdMd = (id, extra = '', body = '') => `---\nid: ${id}\ntype: frd\nimplementation_status: PLANNED\n${extra}---\n# ${id}\n\n## Acceptance criteria\n- **AC-01-001.1** WHEN the list loads, the system SHALL show the cards.\n- **AC-01-001.2** WHEN the list is empty, the system SHALL show the empty state.\n- **AC-01-002.1** The system SHALL sort the cards by date.\n- **AC-02-001.1** The system SHALL show the gamma panel.\n${body}`
const blueprint = (rows) => `---\nid: BP\n---\n# Blueprint\n\n## 7. Build Plan\n\n| WO | Depends on | Artifacts (globs) |\n|---|---|---|\n${rows.map(([id, deps]) => `| ${id} | ${deps} | x |`).join('\n')}\n\n- **Order:** as the table says.\n\n## 8. Risks\n`
const fmA = 'title: Alpha cards\ndifficulty: high\nartifacts: [src/alpha.ts, "src/_tests/**"]\ndependsOn: []\nsource_requirements: []\n'
const fmB = (deps = '[WO-01-001]') => `title: Beta sort\nartifacts: [src/beta.ts]\ndependsOn: ${deps}\n`
const fmC = (art = 'src/app/api/auth/gamma/**') => `title: Gamma panel\nartifacts: [${art}]\ndependsOn: [WO-01-002]\n`
function planFixture(r, { statusA = 'PLANNED', statusC = 'PLANNED', depsB, artC } = {}) {
  r.write('package.json', '{"name":"proj","dependencies":{"next":"16.0.0","react":"19.0.0"}}\n')
  r.write(`${FRD_A}/frd.md`, frdMd('FRD-01'))
  r.write(`${FRD_A}/blueprint.md`, blueprint([['WO-01-001', 'none'], ['WO-01-002', 'WO-01-001']]))
  r.write(`${FRD_C}/frd.md`, frdMd('FRD-02', 'dependsOn: [FRD-01]\n'))
  r.write(`${FRD_C}/blueprint.md`, blueprint([['WO-02-001', 'WO-01-002']]))
  r.write(WO_A, woMd('WO-01-001', statusA, { acs: ['AC-01-001.1', 'AC-01-001.2'], extraFm: fmA }))
  r.write(WO_B, woMd('WO-01-002', 'PLANNED', { acs: ['AC-01-002.1'], extraFm: fmB(depsB) }))
  r.write(WO_C, woMd('WO-02-001', statusC, { acs: ['AC-02-001.1'], extraFm: fmC(artC) }))
  r.git('add', '-A'); r.git('commit', '-q', '-m', 'docs: plan fixture')
}
const byFrd = (p) => Object.fromEntries(((p.receipt && p.receipt.frds) || []).map((f) => [f.frd, f]))

console.log('plan: the Build Plan order and the frontmatter, read without a plan agent')
{
  const r = mkRepo()
  try {
    planFixture(r)
    const head = r.head()
    const p = r.run('plan')
    ok(p.code === 0 && p.sealed && p.receipt.status === 'planned', `status planned (got ${p.code} ${p.receipt && p.receipt.status} ${p.receipt && p.receipt.reason})`)
    ok(p.receipt.hasFrontend === true, 'a next/react package.json is a web stack (hasFrontend)')
    ok(JSON.stringify(p.receipt.frds.map((f) => f.frd)) === JSON.stringify(['frd-01-alpha', 'frd-02-gamma']), 'FRDs come in dependency order')
    const a = byFrd(p)['frd-01-alpha']
    const c = byFrd(p)['frd-02-gamma']
    ok(c.deps.includes('frd-01-alpha') && a.deps.length === 0, `FRD deps: the frontmatter dependsOn and the cross-FRD WO deps (got ${JSON.stringify(c.deps)})`)
    ok(JSON.stringify(a.workOrders.map((w) => w.id)) === JSON.stringify(['WO-01-001', 'WO-01-002']), 'work orders in Build Plan order')
    const w1 = a.workOrders[0]
    ok(w1.status === 'PLANNED' && w1.path === WO_A && w1.difficulty === 'high' && w1.summary === 'Alpha cards' && JSON.stringify(w1.artifacts) === JSON.stringify(['src/alpha.ts', 'src/_tests/**']) && w1.deps.length === 0, `each WO carries its frontmatter (got ${JSON.stringify(w1)})`)
    ok(JSON.stringify(a.workOrders[1].deps) === JSON.stringify(['WO-01-001']) && JSON.stringify(c.workOrders[0].deps) === JSON.stringify(['WO-01-002']), 'intra- and cross-FRD WO deps')
    ok(/AC-01-001\.1/.test(w1.acText) && /AC-01-001\.2/.test(w1.acText) && !/AC-01-002\.1/.test(w1.acText), 'acText: the frd.md lines of the ACs this WO owns, verbatim, and only those')
    ok(r.head() === head && r.status() === '', 'plan writes nothing')
    const t = r.run('plan', ['--frd', 'frd-02-gamma'])
    ok(t.receipt.status === 'planned' && t.receipt.frds.length === 1 && JSON.stringify(t.receipt.unsatisfiedDeps) === JSON.stringify([{ frd: 'frd-02-gamma', dep: 'frd-01-alpha' }]), `a targeted plan reports an unverified FRD dep (got ${JSON.stringify(t.receipt.unsatisfiedDeps)})`)
    r.write(WO_C, woMd('WO-02-001', 'VERIFIED', { acs: ['AC-02-001.1'], extraFm: fmC() }))
    r.git('commit', '-q', '-am', 'gamma verified')
    ok(JSON.stringify(r.run('plan').receipt.frds.map((f) => f.frd)) === JSON.stringify(['frd-01-alpha']), 'an all-VERIFIED FRD is not planned')
    r.write(WO_B, woMd('WO-01-002', 'PLANNED', { acs: ['AC-01-002.1'], extraFm: fmB('[]') }))
    const d = r.run('plan')
    ok(d.code === 0 && d.receipt.status === 'no-build-plan' && /WO-01-002/.test(d.receipt.reason), `a frontmatter/Build Plan dependency drift falls back to the plan agent (got ${d.receipt.status}: ${d.receipt.reason})`)
    r.write(WO_B, woMd('WO-01-002', 'PLANNED', { acs: ['AC-01-002.1'], extraFm: fmB() }))
    r.write(`${FRD_A}/blueprint.md`, '---\nid: BP\n---\n# Blueprint without a plan\n')
    const n = r.run('plan')
    ok(n.receipt.status === 'no-build-plan' && /frd-01-alpha/.test(n.receipt.reason), 'a blueprint with no Build Plan table falls back to the plan agent')
  } finally { r.cleanup() }
}

console.log('plan: real bench Build Plan tables (columns by header name, cross-FRD rows, `none`) plan with no plan agent')
{
  // Bench FM-1: the medium bench's FRD-01 table carries an `FRD` column before `Depends on` and repeats every FRD's rows
  // (a cross-FRD DAG); the positional parser read `01` as WO-01-001's dependency and the run fell back to the plan agent.
  const FIX = path.join(__dirname, 'fixtures', 'build-plan')
  const fixture = (name) => readFileSync(path.join(FIX, name), 'utf8')
  const woFile = (frd, id, deps) => `docs/frds/${frd}/work-orders/${id.toLowerCase()}-x.md`
  const benchRepo = (frds) => {
    const r = mkRepo()
    for (const rel of [WO_A, WO_B, WO_C]) rmSync(r.abs(rel))
    r.write('package.json', '{"name":"proj","dependencies":{"next":"16.0.0","react":"19.0.0"}}\n')
    for (const { frd, blueprint: bp, wos } of frds) {
      r.write(`docs/frds/${frd}/frd.md`, frdMd(frd.slice(0, 6).toUpperCase()))
      r.write(`docs/frds/${frd}/blueprint.md`, fixture(bp))
      for (const [id, deps] of wos) r.write(woFile(frd, id, deps), woMd(id, 'PLANNED', { extraFm: `title: ${id}\nartifacts: [src/${id.toLowerCase()}.ts]\ndependsOn: ${JSON.stringify(deps)}\n` }))
    }
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'docs: bench plan fixture')
    return r
  }
  const MEDIUM = [
    { frd: 'frd-01-projects', blueprint: 'medium-frd-01-projects.md', wos: [['WO-01-001', []], ['WO-01-002', ['WO-01-001']], ['WO-01-003', ['WO-01-001']], ['WO-01-004', ['WO-01-003']], ['WO-01-005', ['WO-01-001', 'WO-01-002', 'WO-01-004']]] },
    { frd: 'frd-02-tasks', blueprint: 'medium-frd-02-tasks.md', wos: [['WO-02-001', ['WO-01-004']], ['WO-02-002', ['WO-01-001', 'WO-01-002', 'WO-01-004', 'WO-02-001']]] },
    { frd: 'frd-03-search-filters', blueprint: 'medium-frd-03-search-filters.md', wos: [['WO-03-001', ['WO-02-001']], ['WO-03-002', ['WO-02-002', 'WO-03-001']]] },
    { frd: 'frd-04-dashboard', blueprint: 'medium-frd-04-dashboard.md', wos: [['WO-04-001', ['WO-01-001', 'WO-01-002', 'WO-01-003']]] },
  ]
  {
    const r = benchRepo(MEDIUM)
    try {
      const p = r.run('plan', ['--compact'])
      ok(p.code === 0 && p.sealed && p.receipt.status === 'planned', `the medium bench (FRD column, cross-FRD table, \`none\`) plans with no plan agent (got ${p.receipt && p.receipt.status}: ${p.receipt && p.receipt.reason})`)
      const f = byFrd(p)
      ok(f['frd-01-projects'] && JSON.stringify(f['frd-01-projects'].workOrders.map((w) => w.id)) === JSON.stringify(['WO-01-001', 'WO-01-002', 'WO-01-003', 'WO-01-004', 'WO-01-005']), 'FRD-01 in its Build Plan order')
      ok(f['frd-01-projects'] && f['frd-01-projects'].workOrders[0].deps.length === 0, 'WO-01-001 has no dependency (the FRD column `01` is not read as one)')
      ok(JSON.stringify((p.receipt.frds || []).map((x) => x.frd)) === JSON.stringify(['frd-01-projects', 'frd-02-tasks', 'frd-03-search-filters', 'frd-04-dashboard']), `FRDs in dependency order (got ${JSON.stringify((p.receipt.frds || []).map((x) => x.frd))})`)
      const lease = await acquire(r.proj, { runtime: 'claude', runId: 'mech-test', ttlSeconds: 60 })
      const fs = r.run('fast-start', ['--token', lease.token, '--epoch', String(lease.epoch), '--project-name', 'proj'])
      ok(fs.receipt && fs.receipt.status === 'dispatched' && fs.receipt.plan && fs.receipt.plan.status === 'planned' && fs.receipt.dispatch && fs.receipt.dispatch.frd === 'frd-01-projects', `the fused start plans and dispatches FRD-01: no handoff at the plan (got ${fs.receipt && fs.receipt.status} ${fs.receipt && fs.receipt.stage} ${fs.receipt && fs.receipt.plan && fs.receipt.plan.reason})`)
    } finally { r.cleanup() }
  }
  {
    // A real drift in the cross-FRD table is still drift: the FRD's own row disagreeing with its frontmatter.
    const r = benchRepo(MEDIUM)
    try {
      r.write(woFile('frd-01-projects', 'WO-01-004'), woMd('WO-01-004', 'PLANNED', { extraFm: 'title: x\nartifacts: [src/x.ts]\ndependsOn: ["WO-01-002"]\n' }))
      r.git('commit', '-q', '-am', 'drift')
      const d = r.run('plan')
      ok(d.receipt.status === 'no-build-plan' && /WO-01-004 dependency drift/.test(d.receipt.reason), `a real drift of an own row still falls back (got ${d.receipt.status}: ${d.receipt.reason})`)
    } finally { r.cleanup() }
  }
  {
    const r = benchRepo([{ frd: 'frd-01-registration-form', blueprint: 'form-frd-01-registration-form.md', wos: [['WO-01-001', []], ['WO-01-002', []], ['WO-01-003', ['WO-01-001', 'WO-01-002']]] }])
    try {
      const p = r.run('plan', ['--compact'])
      ok(p.code === 0 && p.sealed && p.receipt.status === 'planned' && JSON.stringify((p.receipt.frds || [{ workOrders: [] }])[0].workOrders.map((w) => [w.id, w.deps])) === JSON.stringify([['WO-01-001', []], ['WO-01-002', []], ['WO-01-003', ['WO-01-001', 'WO-01-002']]]), `the small bench (\`## Build Plan\`, WO | Depends on) plans with no plan agent (got ${p.receipt && p.receipt.status}: ${p.receipt && p.receipt.reason})`)
    } finally { r.cleanup() }
  }
  {
    // Header aliases, empty and dash cells, an unpadded id, a backticked id: all name the same plan.
    const r = mkRepo()
    try {
      planFixture(r)
      r.write(`${FRD_A}/blueprint.md`, '---\nid: BP\n---\n# B\n\n## Build Plan\n\n| Foundation | Deps | Work order |\n|---|---|---|\n| true | — | `WO-01-001` |\n| false | wo-1-1 | WO-01-002 |\n\n## Next\n')
      r.git('commit', '-q', '-am', 'aliases')
      const p = r.run('plan')
      ok(p.receipt.status === 'planned' && JSON.stringify((byFrd(p)['frd-01-alpha'] || { workOrders: [] }).workOrders.map((w) => w.id)) === JSON.stringify(['WO-01-001', 'WO-01-002']), `columns found by header alias (Deps, Work order), \`—\` is none, ids normalized (got ${p.receipt.status}: ${p.receipt.reason})`)
      r.write(`${FRD_A}/blueprint.md`, '---\nid: BP\n---\n# B\n\n## Build Plan\n\n| WO | Artifacts |\n|---|---|\n| WO-01-001 | x |\n| WO-01-002 | y |\n\n## Next\n')
      r.git('commit', '-q', '-am', 'no deps column')
      const n = r.run('plan')
      ok(n.receipt.status === 'no-build-plan' && /frd-01-alpha/.test(n.receipt.reason), `a table with no dependency column is no Build Plan (got ${n.receipt.status}: ${n.receipt.reason})`)
    } finally { r.cleanup() }
  }
}

console.log('plan --classify / classify-frd: the deterministic floor, written to the FRD frontmatter, monotone')
{
  const r = mkRepo()
  try {
    planFixture(r)
    const head = r.head()
    const p = r.run('plan', ['--classify'])
    ok(p.code === 0 && p.receipt.status === 'planned', `plan --classify runs (got ${p.receipt && p.receipt.status} ${p.receipt && p.receipt.reason})`)
    ok(byFrd(p)['frd-01-alpha'].floor === false && byFrd(p)['frd-02-gamma'].floor === true, 'a plain FRD is not floor; an FRD declaring an app/api/auth route is floor (product floor P1)')
    ok((byFrd(p)['frd-02-gamma'].floorHits || []).some((h) => /^P1: .*api\/auth/.test(h)), `the floor hit is named (got ${JSON.stringify(byFrd(p)['frd-02-gamma'].floorHits)})`)
    ok(r.head() !== head && /floor/.test(r.subject()) && r.filesAt().sort().join() === [`proj/${FRD_A}/frd.md`, `proj/${FRD_C}/frd.md`].join(), 'one commit writes floor: into exactly the two frd.md')
    ok(/^floor: false$/m.test(r.atHead(`${FRD_A}/frd.md`)) && /^floor: true$/m.test(r.atHead(`${FRD_C}/frd.md`)), 'the frontmatter carries floor: false / floor: true')
    const h2 = r.head()
    r.run('plan', ['--classify'])
    ok(r.head() === h2, 'an unchanged classification commits nothing')
    r.write(WO_C, woMd('WO-02-001', 'PLANNED', { acs: ['AC-02-001.1'], extraFm: fmC('src/gamma.ts') }))
    r.git('commit', '-q', '-am', 'gamma moves out of app/api')
    const m = r.run('classify-frd', ['--frd', 'frd-02-gamma'])
    ok(m.code === 0 && m.sealed && m.receipt.frds[0].floor === true && /^floor: true$/m.test(r.read(`${FRD_C}/frd.md`)), 'floor is monotone: a later non-floor verdict never lowers it')
    r.write(`${FRD_A}/frd.md`, frdMd('FRD-01', 'floor: false\n', '- The system SHALL NOT ask for a password; example contact: Ana@Example.COM.\n'))
    r.git('commit', '-q', '-am', 'alpha spec mentions credentials')
    const t = r.run('classify-frd', ['--frd', 'frd-01-alpha'])
    ok(t.receipt.frds[0].floor === false && t.receipt.frds[0].changed === false, 'frd.md prose alone never raises the floor (a spec mentioning a password or an e-mail is not product code — bench F-1)')
    r.write(WO_B, woMd('WO-01-002', 'PLANNED', { acs: ['AC-01-002.1'], extraFm: 'title: Beta sort\nartifacts: [src/app/api/beta/route.ts, next.config.ts, src/test/setup.ts, e2e/beta.spec.ts]\ndependsOn: [WO-01-001]\n' }))
    r.git('commit', '-q', '-am', 'beta declares an ordinary route, framework config and test surfaces')
    const o = r.run('classify-frd', ['--frd', 'frd-01-alpha'])
    ok(o.receipt.frds[0].floor === false, `an ordinary app/api route, next.config.ts, src/test/setup.ts and an e2e spec are not product risk (got ${JSON.stringify(o.receipt.frds[0].floorHits)})`)
    r.write(WO_B, woMd('WO-01-002', 'PLANNED', { acs: ['AC-01-002.1'], extraFm: fmB() }))
    r.git('commit', '-q', '-am', 'beta back')
    const base = r.head()
    r.write('src/lib/auth/session.ts', 'export const s = 1\n')
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'auth helper')
    r.write(`${FRD_A}/frd.md`, frdMd('FRD-01', 'floor: false\n'))
    r.git('commit', '-q', '-am', 'reset alpha floor for the landed case')
    const l = r.run('classify-frd', ['--frd', 'frd-01-alpha', '--range', `${base}..HEAD`])
    ok(l.receipt.frds[0].floor === true && /^floor: true$/m.test(r.atHead(`${FRD_A}/frd.md`)), 'the landed diff (--range) classifies too: an auth path lands → floor')
    const bad = r.run('classify-frd', ['--frd', 'frd-01-alpha', '--range', 'nope..HEAD'])
    ok(bad.receipt.frds && bad.receipt.frds[0].floor === true, 'an unreadable range fails closed to floor')
  } finally { r.cleanup() }
}

console.log('verify: the USABLE check — clean tree, committed WOs, landed floor, verify.sh on the clean landed SHA')
{
  const VERIFY_SH = ({ green = true, sha = '$(git rev-parse HEAD)', rows = '"src/a.ts: TS2345"' } = {}) => `#!/bin/sh\nmkdir -p .pandacorp/run && echo ran >> .pandacorp/run/verify-ran\nprintf '{"at":"2026-10-01T00:00:00Z","scope":"full","green":${green},"sha":"%s","subgates":[{"name":"biome","exit":0,"failures":[]},{"name":"tsc","exit":${green ? 0 : 2},"failures":[${green ? '' : rows}]}]}\\n' "${sha}" > .pandacorp/run/gate-report.json\nexit ${green ? 0 : 1}\n`
  const setup = (opts) => {
    const r = mkRepo()
    planFixture(r)
    r.write('.pandacorp/verify.sh', VERIFY_SH(opts)); chmodSync(r.abs('.pandacorp/verify.sh'), 0o755)
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'chore: the project gate')
    const base = r.head()
    r.write('src/alpha.ts', 'export const alpha = 1\n')
    r.write(WO_A, woMd('WO-01-001', 'IN_REVIEW', { acs: ['AC-01-001.1', 'AC-01-001.2'], extraFm: fmA }))
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'feat: WO-01-001')
    return { r, base }
  }
  const args = (base) => ['--frd', 'frd-01-alpha', '--since', base, '--wo', 'WO-01-001']
  const ran = (r) => existsSync(r.abs('.pandacorp/run/verify-ran'))
  {
    const { r, base } = setup()
    try {
      const v = r.run('verify', args(base))
      ok(v.code === 0 && v.sealed && v.receipt.status === 'green' && v.receipt.green === true && v.receipt.usable === true && v.receipt.floor === false, `green, non-floor → USABLE (got ${v.code} ${JSON.stringify(v.receipt && { s: v.receipt.status, f: v.receipt.floor, u: v.receipt.usable, r: v.receipt.reason })})`)
      ok(ran(r) && v.receipt.scope === 'full', 'verify.sh ran, the report scope is carried')
      ok(/^floor: false$/m.test(r.atHead(`${FRD_A}/frd.md`)), 'the landed classification is written to the frontmatter')
      ok(/usable/.test(r.subject()) && r.filesAt().join() === 'proj/.pandacorp/track.jsonl' && r.git('rev-parse', 'HEAD^').startsWith(v.receipt.sha), 'the build_usable timeline line is committed on its own, right after the verified SHA')
      const track = r.atHead('.pandacorp/track.jsonl').trim().split('\n').map((x) => JSON.parse(x))
      ok(track.some((x) => x.kind === 'build_usable' && x.frd === 'frd-01-alpha' && x.sha === v.receipt.sha), 'track.jsonl: build_usable {frd, sha}')
      const evs = existsSync(r.events) ? readFileSync(r.events, 'utf8').trim().split('\n').map((x) => JSON.parse(x)) : []
      ok(evs.some((x) => x.event === 'build_usable' && x.frd === 'frd-01-alpha' && x.sha === v.receipt.sha), 'the dashboard build_usable event is appended')
      ok(r.status() === '', 'the tree is clean afterwards')
    } finally { r.cleanup() }
  }
  {
    const { r, base } = setup()
    try {
      const v = r.run('verify', [...args(base), '--floor'])
      const reuse = r.run('reuse-check', ['--max-age', '999999999'])
      ok(v.receipt.status === 'green' && existsSync(r.abs('.pandacorp/run/gate-report.provenance.json')) && reuse.receipt.reason === 'reused', `the scripted verify seals the report it ran (provenance), so the close can reuse it at the same HEAD (got ${reuse.receipt.reason})`)
    } finally { r.cleanup() }
  }
  {
    const { r, base } = setup({ green: false })
    try {
      const head = r.head()
      const v = r.run('verify', args(base))
      ok(v.code === 0 && v.receipt.status === 'red' && v.receipt.green === false && v.receipt.usable === false && /tsc/.test(v.receipt.failure) && /TS2345/.test(v.receipt.failure), `red names the first failing sub-gate (got ${v.receipt && v.receipt.failure})`)
      ok(!r.git('log', '--format=%s', `${head}..HEAD`).includes('usable'), 'no usable commit on red')
    } finally { r.cleanup() }
  }
  {
    const { r, base } = setup({ sha: 'deadbeef' })
    try {
      const v = r.run('verify', args(base))
      ok(v.receipt.status === 'red' && v.receipt.usable === false && /stale|sha/i.test(v.receipt.failure), 'a report of another SHA is red (fail-closed)')
    } finally { r.cleanup() }
  }
  {
    const { r, base } = setup()
    try {
      r.write('src/stray.ts', 'export const stray = 1\n')
      const v = r.run('verify', args(base))
      ok(v.code === 4 && v.receipt.status === 'dirty' && v.receipt.paths.includes('src/stray.ts') && !ran(r), 'a dirty tree is refused before verify.sh runs')
      rmSync(r.abs('src/stray.ts'))
      const u = r.run('verify', ['--frd', 'frd-01-alpha', '--since', base, '--wo', 'WO-01-001', '--wo', 'WO-01-002'])
      ok(u.code === 4 && u.receipt.status === 'uncommitted' && /WO-01-002/.test(u.receipt.reason) && !ran(r), 'a WO not IN_REVIEW at HEAD is refused')
    } finally { r.cleanup() }
  }
  {
    const { r, base } = setup()
    try {
      r.write('src/app/api/alpha/route.ts', 'import Stripe from "stripe"\nexport async function POST() { return new Response(String(Stripe)) }\n')
      r.git('add', '-A'); r.git('commit', '-q', '-m', 'feat: WO-01-001 route')
      const v = r.run('verify', args(base))
      ok(v.receipt.status === 'green' && v.receipt.floor === true && v.receipt.usable === false && /^floor: true$/m.test(r.atHead(`${FRD_A}/frd.md`)) && v.receipt.floorHits.some((h) => /^P2: payment SDK/.test(h)), `a landed product-risk import (stripe) makes it floor: green but NOT usable (got ${JSON.stringify(v.receipt.floorHits)})`)
      const track = r.atHead('.pandacorp/track.jsonl')
      ok(!/build_usable/.test(track), 'no build_usable for a floor FRD')
    } finally { r.cleanup() }
  }
  {
    const { r, base } = setup()
    try {
      r.write('e2e/alpha.spec.ts', "import { test } from '@playwright/test'\ntest('a', async ({ page }) => { await page.getByLabel('Email').fill('Maria@Example.COM') })\n")
      r.write('next.config.ts', 'export default { reactStrictMode: true }\n')
      r.write('src/test/setup.ts', "import '@testing-library/jest-dom/vitest'\n")
      r.write('src/app/api/alpha/route.ts', 'export async function GET() { return new Response("ok") }\n')
      r.git('add', '-A'); r.git('commit', '-q', '-m', 'feat: WO-01-001 e2e, config, route')
      const v = r.run('verify', args(base))
      ok(v.receipt.status === 'green' && v.receipt.floor === false && v.receipt.usable === true, `the bench F-1 landed shape (an e2e fixture e-mail, next.config.ts, src/test/setup.ts, an ordinary route) is not floor → USABLE (got ${JSON.stringify(v.receipt && { f: v.receipt.floor, u: v.receipt.usable, h: v.receipt.floorHits })})`)
    } finally { r.cleanup() }
  }
  {
    const { r, base } = setup({ green: false, rows: '{"file":"src/a.ts","line":3,"code":"unused-export","msg":"alpha is never imported"},{"file":"src/b.ts","msg":"unused file"}' })
    try {
      const v = r.run('verify', args(base))
      ok(v.receipt.status === 'red' && v.receipt.failure === 'tsc: src/a.ts:3 unused-export alpha is never imported | src/b.ts unused file', `object failure rows render as text, never [object Object] (got ${v.receipt && v.receipt.failure})`)
    } finally { r.cleanup() }
  }
}

console.log('verify without --since: the landed range is derived (dispatch stamp history, then the dispatch snapshot), fail-closed only when unknowable')
{
  // Bench FM-1: the relay truncated the dispatch line's checksum, the engine lost the base and called verify with no
  // --since, so a green non-floor FRD was classified floor ("the landed range is unknown") and never USABLE.
  const VERIFY_GREEN = '#!/bin/sh\nmkdir -p .pandacorp/run\nprintf \'{"scope":"full","green":true,"sha":"%s","subgates":[]}\\n\' "$(git rev-parse HEAD)" > .pandacorp/run/gate-report.json\n'
  const setup = ({ commitDispatch = true } = {}) => {
    const r = mkRepo()
    planFixture(r)
    r.write('.pandacorp/verify.sh', VERIFY_GREEN); chmodSync(r.abs('.pandacorp/verify.sh'), 0o755)
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'chore: the project gate')
    const base = r.head()
    const d = r.run('dispatch', ['--wo', 'WO-01-001', ...(commitDispatch ? ['--commit'] : [])])
    if (!d.receipt || d.receipt.ok !== true) throw new Error(`fixture dispatch failed: ${d.line}`)
    r.write('src/alpha.ts', 'export const alpha = 1\n')
    r.write(WO_A, woMd('WO-01-001', 'IN_REVIEW', { acs: ['AC-01-001.1', 'AC-01-001.2'], extraFm: fmA }))
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'feat: WO-01-001')
    return { r, base }
  }
  const snapshot = (r) => r.abs('.pandacorp/run/dispatch/frd-01-alpha.json')
  {
    const { r, base } = setup()
    try {
      rmSync(snapshot(r))
      const v = r.run('verify', ['--frd', 'frd-01-alpha', '--wo', 'WO-01-001'])
      ok(v.code === 0 && v.sealed && v.receipt.green === true && v.receipt.floor === false && v.receipt.usable === true, `no --since, no snapshot: the base is the parent of the FRD's committed dispatch stamp → classified, USABLE (got ${JSON.stringify(v.receipt && { f: v.receipt.floor, u: v.receipt.usable, h: v.receipt.floorHits })})`)
      ok(v.receipt.since && base.startsWith(v.receipt.since) && v.receipt.sinceSource === 'dispatch-history', `the receipt names the derived base and its source (got ${v.receipt.since} ${v.receipt.sinceSource})`)
    } finally { r.cleanup() }
  }
  {
    const { r } = setup()
    try {
      rmSync(snapshot(r))
      r.write('src/app/api/alpha/route.ts', 'import Stripe from "stripe"\nexport async function POST() { return new Response(String(Stripe)) }\n')
      r.git('add', '-A'); r.git('commit', '-q', '-m', 'feat: WO-01-001 route')
      const v = r.run('verify', ['--frd', 'frd-01-alpha', '--wo', 'WO-01-001'])
      ok(v.receipt.floor === true && v.receipt.usable === false && v.receipt.floorHits.some((h) => /^P2: payment SDK/.test(h)), `the derived range is really classified: a landed stripe import is floor (got ${JSON.stringify(v.receipt.floorHits)})`)
    } finally { r.cleanup() }
  }
  {
    const { r, base } = setup({ commitDispatch: false })
    try {
      const v = r.run('verify', ['--frd', 'frd-01-alpha', '--wo', 'WO-01-001'])
      ok(v.receipt.floor === false && v.receipt.usable === true && base.startsWith(v.receipt.since) && v.receipt.sinceSource === 'dispatch-snapshot', `no committed stamp: the dispatch snapshot's base is the range (got ${JSON.stringify(v.receipt && { f: v.receipt.floor, s: v.receipt.since, src: v.receipt.sinceSource, h: v.receipt.floorHits })})`)
    } finally { r.cleanup() }
  }
  {
    const { r } = setup({ commitDispatch: false })
    try {
      rmSync(snapshot(r))
      const v = r.run('verify', ['--frd', 'frd-01-alpha', '--wo', 'WO-01-001'])
      ok(v.receipt.green === true && v.receipt.floor === true && v.receipt.usable === false && v.receipt.floorHits.some((h) => /landed range is unknown/.test(h)), `no --since, no stamp, no snapshot: genuinely unknowable → fail-closed floor (got ${JSON.stringify(v.receipt && v.receipt.floorHits)})`)
    } finally { r.cleanup() }
  }
}

console.log('gate-effort-xhigh-on-injection-content: verify scans the landed range with the security delta\'s content triggers (proposal 40 Phase 4)')
{
  const VERIFY_GREEN = '#!/bin/sh\nmkdir -p .pandacorp/run\nprintf \'{"scope":"full","green":true,"sha":"%s","subgates":[]}\\n\' "$(git rev-parse HEAD)" > .pandacorp/run/gate-report.json\n'
  const setup = (files = {}) => {
    const r = mkRepo()
    planFixture(r)
    r.write('.pandacorp/verify.sh', VERIFY_GREEN); chmodSync(r.abs('.pandacorp/verify.sh'), 0o755)
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'chore: the project gate')
    const base = r.head()
    r.write('src/alpha.ts', 'export const alpha = 1\n')
    for (const [p, body] of Object.entries(files)) r.write(p, body)
    r.write(WO_A, woMd('WO-01-001', 'IN_REVIEW', { acs: ['AC-01-001.1', 'AC-01-001.2'], extraFm: fmA }))
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'feat: WO-01-001')
    return { r, base }
  }
  const verify = (r, base) => r.run('verify', ['--frd', 'frd-01-alpha', ...(base ? ['--since', base] : []), '--wo', 'WO-01-001'])
  {
    const { r, base } = setup()
    try {
      const v = verify(r, base)
      ok(v.code === 0 && v.sealed && Array.isArray(v.receipt.injection) && v.receipt.injection.length === 0, `a plain landed range: injection is [] (its gate may run at high) (got ${JSON.stringify(v.receipt && v.receipt.injection)})`)
    } finally { r.cleanup() }
  }
  {
    const { r, base } = setup({
      'src/post.tsx': 'export const Post = ({ html }: { html: string }) => <div dangerouslySetInnerHTML={{ __html: html }} />\n',
      'src/_tests/post.test.tsx': "it('renders', () => { document.body.innerHTML = '<b>x</b>' })\n",
      'src/app/api/post/route.ts': 'export async function GET() { return new Response(null) }\n',
    })
    try {
      const v = verify(r, base)
      const inj = (v.receipt && v.receipt.injection) || []
      ok(inj.some((h) => h.trigger === 'dangerouslySetInnerHTML' && h.kind === 'content' && /src\/post\.tsx/.test(h.detail)), `an added dangerouslySetInnerHTML is an injection hit naming its file (got ${JSON.stringify(inj)})`)
      ok(!inj.some((h) => h.trigger === 'innerHTML'), 'a test surface never counts')
      ok(inj.every((h) => h.kind === 'content'), 'only the CONTENT triggers count (a route is a path trigger: the security delta\'s business, not the gate effort\'s)')
      ok(v.receipt.floor === false && v.receipt.usable === true, 'injection content is not floor: the FRD is still USABLE (only its gate stays at xhigh)')
    } finally { r.cleanup() }
  }
  {
    const { r } = setup()
    try {
      rmSync(r.abs('.pandacorp/run/dispatch/frd-01-alpha.json'), { force: true })
      const v = verify(r, null)
      ok(v.receipt.injection === null, `an unknowable landed range: injection is null (the engine keeps xhigh, fail-closed) (got ${JSON.stringify(v.receipt && v.receipt.injection)})`)
    } finally { r.cleanup() }
  }
}

console.log('precheck: USABLE is derived from the committed build_usable lines, so a later run still never auto-discards it')
{
  const VERIFY_GREEN = '#!/bin/sh\nmkdir -p .pandacorp/run\nprintf \'{"scope":"full","green":true,"sha":"%s","subgates":[]}\\n\' "$(git rev-parse HEAD)" > .pandacorp/run/gate-report.json\n'
  const setup = () => {
    const r = mkRepo()
    planFixture(r)
    r.write('.pandacorp/verify.sh', VERIFY_GREEN); chmodSync(r.abs('.pandacorp/verify.sh'), 0o755)
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'chore: the project gate')
    const base = r.head()
    r.write('src/alpha.ts', 'export const alpha = 1\n')
    r.write(WO_A, woMd('WO-01-001', 'IN_REVIEW', { acs: ['AC-01-001.1', 'AC-01-001.2'], extraFm: fmA }))
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'feat: WO-01-001')
    r.write('src/beta.ts', 'export const beta = 1\n')
    r.write(WO_B, woMd('WO-01-002', 'IN_REVIEW', { acs: ['AC-01-002.1'], extraFm: fmB() }))
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'feat: WO-01-002')
    const v = r.run('verify', ['--frd', 'frd-01-alpha', '--since', base, '--wo', 'WO-01-001', '--wo', 'WO-01-002'])
    return { r, v }
  }
  const usableOf = (p) => (p.receipt && Array.isArray(p.receipt.usable) ? p.receipt.usable : null)
  {
    const { r, v } = setup()
    try {
      ok(v.receipt && v.receipt.usable === true && v.receipt.usableCommit, `fixture: frd-01-alpha certified USABLE and its build_usable line committed (got ${v.receipt && JSON.stringify({ u: v.receipt.usable, c: v.receipt.usableCommit, f: v.receipt.failure })})`)
      const p = r.run('precheck')
      ok(p.code === 0 && p.sealed && JSON.stringify(usableOf(p)) === JSON.stringify([{ frd: 'frd-01-alpha', sha: v.receipt.sha }]), `the next run's precheck reports the FRD USABLE at its certified sha (got ${JSON.stringify(usableOf(p))})`)
      r.write(WO_B, woMd('WO-01-002', 'BLOCKED', { acs: ['AC-01-002.1'], extraFm: `${fmB()}blocked_reason: needs-owner\n` }))
      r.git('commit', '-q', '-am', 'chore: frd-01-alpha usable rejected, needs-owner')
      ok(JSON.stringify(usableOf(r.run('precheck'))) === JSON.stringify([{ frd: 'frd-01-alpha', sha: v.receipt.sha }]), 'a work order held BLOCKED needs-owner keeps its FRD USABLE (the owner decides the discard)')
      r.write(WO_A, woMd('WO-01-001', 'VERIFIED', { acs: ['AC-01-001.1', 'AC-01-001.2'], extraFm: fmA }))
      r.write(WO_B, woMd('WO-01-002', 'VERIFIED', { acs: ['AC-01-002.1'], extraFm: fmB() }))
      r.git('commit', '-q', '-am', 'chore: frd-01-alpha verified')
      ok(JSON.stringify(usableOf(r.run('precheck'))) === '[]', 'an all-VERIFIED FRD is no longer reported (nothing left to discard)')
    } finally { r.cleanup() }
  }
  {
    const { r, v } = setup()
    try {
      r.write(WO_A, woMd('WO-01-001', 'PLANNED', { acs: ['AC-01-001.1', 'AC-01-001.2'], extraFm: fmA }))
      r.write(WO_B, woMd('WO-01-002', 'PLANNED', { acs: ['AC-01-002.1'], extraFm: fmB() }))
      r.git('commit', '-q', '-am', 'chore: the owner approved the discard of frd-01-alpha')
      ok(JSON.stringify(usableOf(r.run('precheck'))) === '[]', `a work order back to PLANNED (an owner-approved discard) ends USABLE: it is rebuilt (sha ${v.receipt.sha})`)
      r.run('dispatch', ['--wo', 'WO-01-001', '--wo', 'WO-01-002', '--commit'])
      r.write(WO_A, woMd('WO-01-001', 'IN_REVIEW', { acs: ['AC-01-001.1', 'AC-01-001.2'], extraFm: fmA }))
      r.write(WO_B, woMd('WO-01-002', 'IN_REVIEW', { acs: ['AC-01-002.1'], extraFm: fmB() }))
      r.git('commit', '-q', '-am', 'feat: WO-01-001 and WO-01-002 rebuilt')
      ok(JSON.stringify(usableOf(r.run('precheck'))) === '[]', 'a rebuild stamped after the certified sha is not USABLE until its own verify certifies it again')
    } finally { r.cleanup() }
  }
  {
    const { r } = setup()
    try {
      r.git('reset', '-q', '--hard', 'HEAD~1')
      ok(JSON.stringify(usableOf(r.run('precheck'))) === '[]', 'no committed build_usable line → nothing is USABLE')
      r.write('.pandacorp/track.jsonl', `${r.read('.pandacorp/track.jsonl')}{"kind":"build_usable","frd":"frd-01-alpha","sha":"0123456789ab","at":"2026-10-01T00:00:00Z"}\n`)
      r.git('commit', '-q', '-am', 'chore: a line naming a sha that is not in the history')
      ok(JSON.stringify(usableOf(r.run('precheck'))) === '[]', 'a build_usable line whose sha is not an ancestor of HEAD is ignored')
    } finally { r.cleanup() }
  }
}

// ── the shared journals are append-only and written by concurrent writers (a gate in a parallel slot, F39-7) ──
const GATE_LINE = '{"kind":"review_start","frd":"frd-02-gamma","at":"2026-10-01T00:00:00Z"}'
const postCommitHook = (r, body) => { const h = path.join(r.root, '.git', 'hooks', 'post-commit'); writeFileSync(h, `#!/bin/sh\n${body}\n`); chmodSync(h, 0o755) }
console.log('commit-wo: a gate journal line landing around the commit never undoes it and is never erased')
{
  const r = mkRepo()
  try {
    buildAlpha(r)
    postCommitHook(r, `printf '%s\\n' '${GATE_LINE}' >> "${r.abs('.pandacorp/track.jsonl')}"`)
    const before = r.head()
    const c = r.run('commit-wo', ALPHA_FILES)
    ok(c.code === 0 && c.receipt.status === 'committed' && r.head() !== before, `a journal line appended right after the commit is tolerated (got ${c.code} ${c.receipt && c.receipt.status} ${c.receipt && c.receipt.reason})`)
    ok(/implementation_status: IN_REVIEW/.test(r.atHead(WO_A)) && r.read('.pandacorp/track.jsonl').includes(GATE_LINE), 'the WO stays committed IN_REVIEW and the gate line is kept for the next committer')
  } finally { r.cleanup() }
  const f = mkRepo()
  try {
    buildAlpha(f)
    f.hook(`printf '%s\\n' '${GATE_LINE}' >> "${f.abs('.pandacorp/track.jsonl')}"; exit 1`)
    const c = f.run('commit-wo', ALPHA_FILES)
    ok(c.code === 4 && c.receipt.status === 'commit-failed', 'fixture: the commit fails')
    ok(f.read('.pandacorp/track.jsonl') === `{"kind":"start"}\n${GATE_LINE}\n`, `the restore withdraws only its own wo_end line, never a concurrent writer's line (got ${JSON.stringify(f.read('.pandacorp/track.jsonl'))})`)
  } finally { f.cleanup() }
  const d = mkRepo()
  try {
    buildAlpha(d)
    d.hook(`printf '%s\\n' '${GATE_LINE}' >> "${d.abs('.pandacorp/track.jsonl')}"; echo stray > "${d.abs('stray.txt')}"`)
    const c = d.run('commit-wo', ALPHA_FILES)
    ok(c.code === 4 && c.receipt.status === 'dirty-after-commit' && JSON.stringify(c.receipt.paths) === JSON.stringify(['stray.txt']), `real dirt after the commit still refuses, naming only the non-journal path (got ${c.receipt && JSON.stringify(c.receipt.paths)})`)
    ok(d.read('.pandacorp/track.jsonl') === `{"kind":"start"}\n${GATE_LINE}\n` && /IN_PROGRESS/.test(d.read(WO_A)), 'the undo keeps the gate line and restores the stamp')
  } finally { d.cleanup() }
}

console.log('commit-wo: Extra-Path trailers name only the extras the commit actually staged')
{
  const r = mkRepo()
  try {
    buildAlpha(r)
    r.write('docs/design/components.md', '# Components\n')
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'docs: inventory')
    buildAlpha(r)
    r.write('src/alpha.ts', 'export const alpha = 2\n')
    const c = r.run('commit-wo', [...ALPHA_FILES, '--extra', 'docs/design/components.md', '--reason', 'DR-057 shared component inventory', '--extra', 'src/helper.ts', '--reason', 'shared helper'])
    ok(c.code === 0 && c.receipt.status === 'committed', `fixture: committed (got ${c.receipt && c.receipt.status} ${c.receipt && c.receipt.reason})`)
    ok(!/Extra-Path/.test(r.body()), `an untouched --extra is not claimed in a trailer (body: ${JSON.stringify(r.body())})`)
    ok(Array.isArray(c.receipt.extras) && c.receipt.extras.length === 0, 'and not reported as staged in the receipt')
    r.write('src/alpha.ts', 'export const alpha = 3\n')
    r.write('docs/design/components.md', '# Components\n- Alpha\n')
    const fx = r.run('commit-wo', ['--fixup', 'WO-01-001', '--files', 'src/alpha.ts', '--extra', 'docs/design/components.md', '--reason', 'DR-057 shared component inventory', '--extra', 'src/helper.ts', '--reason', 'shared helper'])
    ok(fx.code === 0 && /Extra-Path: docs\/design\/components\.md \(DR-057 shared component inventory\)/.test(r.body()) && !/src\/helper\.ts/.test(r.body()), `a touched extra is claimed, the untouched one is not (body: ${JSON.stringify(r.body())})`)
  } finally { r.cleanup() }
}

console.log('precheck: a WO file is reset only when its diff is the engine\'s own frontmatter; owner edits are never reset')
{
  const r = mkRepo()
  try {
    planFixture(r)
    const headB = r.atHead(WO_B)
    const headC = r.atHead(WO_C)
    // WO-01-001: the engine's stamp + reopen_count only → engine-owned, reset.
    r.write(WO_A, r.atHead(WO_A).replace('implementation_status: PLANNED', 'implementation_status: IN_REVIEW').replace('reopen_count: 0', 'reopen_count: 1'))
    // WO-01-002: a crash left IN_REVIEW, and the owner (or iterate) edited the body → only the status line goes back.
    r.write(WO_B, `${headB.replace('implementation_status: PLANNED', 'implementation_status: IN_REVIEW')}\nOwner note: keep the sort stable.\n`)
    // WO-02-001: an owner body edit only → never touched.
    r.write(WO_C, `${headC}\nOwner note: gamma later.\n`)
    const p = r.run('precheck', ['--events', r.events])
    ok(p.code === 0 && p.sealed, `precheck exits 0 (got ${p.code} ${p.line.slice(0, 200)})`)
    ok(r.read(WO_A) === r.atHead(WO_A) && (p.receipt.salvaged || []).some((x) => x.path === WO_A), 'an engine-keys-only diff is salvaged and reset to HEAD')
    ok(r.read(WO_B) === `${headB}\nOwner note: keep the sort stable.\n`, `a mixed diff keeps every owner byte and only restores implementation_status to HEAD (got ${JSON.stringify(r.read(WO_B))})`)
    ok(!(p.receipt.salvaged || []).some((x) => x.path === WO_B) && (p.receipt.statusRestored || []).some((x) => x.path === WO_B && x.from === 'IN_REVIEW' && x.to === 'PLANNED'), `the mixed WO is reported statusRestored, not reset (got ${JSON.stringify(p.receipt.statusRestored)})`)
    ok(existsSync(path.join(r.proj, p.receipt.salvageDir || 'none', WO_B)) && /Owner note/.test(readFileSync(path.join(r.proj, p.receipt.salvageDir, WO_B), 'utf8')), 'the mixed WO\'s full dirty copy is kept in salvage too')
    ok((p.receipt.demoted || []).some((x) => x.wo === 'WO-01-002' && x.why === 'uncommitted-flip') && (p.receipt.demoted || []).some((x) => x.wo === 'WO-01-001' && x.why === 'uncommitted-flip'), `both uncommitted IN_REVIEW flips are demoted (got ${JSON.stringify(p.receipt.demoted)})`)
    ok(r.read(WO_C) === `${headC}\nOwner note: gamma later.\n` && !(p.receipt.salvaged || []).some((x) => x.path === WO_C), 'an owner body edit is never touched')
    ok(p.receipt.ownerDirt.includes(WO_B) && p.receipt.ownerDirt.includes(WO_C) && !p.receipt.ownerDirt.includes(WO_A), `the owner-edited WOs are reported as owner dirt (got ${JSON.stringify(p.receipt.ownerDirt)})`)
  } finally { r.cleanup() }
}

console.log('verify: the shared journals are not dirt; a gate line before or during verify.sh is committed with build_usable')
{
  const VERIFY_SH = (during = '') => `#!/bin/sh\nmkdir -p .pandacorp/run\n${during}printf '{"scope":"full","green":true,"sha":"%s","subgates":[]}\\n' "$(git rev-parse HEAD)" > .pandacorp/run/gate-report.json\n`
  const setup = (during = '') => {
    const r = mkRepo()
    planFixture(r)
    r.write('.pandacorp/verify.sh', VERIFY_SH(during)); chmodSync(r.abs('.pandacorp/verify.sh'), 0o755)
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'chore: the project gate')
    const base = r.head()
    r.write('src/alpha.ts', 'export const alpha = 1\n')
    r.write(WO_A, woMd('WO-01-001', 'IN_REVIEW', { acs: ['AC-01-001.1', 'AC-01-001.2'], extraFm: fmA }))
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'feat: WO-01-001')
    return { r, base }
  }
  const args = (base) => ['--frd', 'frd-01-alpha', '--since', base, '--wo', 'WO-01-001']
  {
    const { r, base } = setup()
    try {
      r.write('.pandacorp/track.jsonl', `${r.read('.pandacorp/track.jsonl')}${GATE_LINE}\n`)
      r.write('.pandacorp/build-journal.jsonl', '{"kind":"review","frd":"frd-02-gamma"}\n')
      const v = r.run('verify', args(base))
      ok(v.code === 0 && v.receipt.status === 'green' && v.receipt.usable === true && v.receipt.usableCommit, `a gate line before verify is not a dirty tree (got ${v.code} ${v.receipt && v.receipt.status} ${v.receipt && v.receipt.reason})`)
      ok((r.atHead('.pandacorp/track.jsonl') || '').includes(GATE_LINE) && /build_usable/.test(r.atHead('.pandacorp/track.jsonl') || '') && /"review"/.test(r.atHead('.pandacorp/build-journal.jsonl') || ''), 'the usable commit sweeps both journals (the gate lines are kept)')
      ok(r.status() === '', `the tree is clean afterwards (got ${JSON.stringify(r.status())})`)
    } finally { r.cleanup() }
  }
  {
    const { r, base } = setup(`printf '%s\\n' '${GATE_LINE}' >> .pandacorp/track.jsonl\n`)
    try {
      const v = r.run('verify', args(base))
      ok(v.receipt.status === 'green' && v.receipt.usable === true && (r.atHead('.pandacorp/track.jsonl') || '').includes(GATE_LINE), `a gate line written while verify.sh runs is committed with build_usable (got ${v.receipt && v.receipt.status} ${v.receipt && v.receipt.failure})`)
    } finally { r.cleanup() }
  }
  {
    const { r, base } = setup()
    try {
      const head = r.head()
      const v = r.run('verify', [...args(base), '--floor'])
      ok(v.code === 0 && v.receipt.green === true && v.receipt.floor === true && v.receipt.usable === false && !v.receipt.usableCommit, `--floor (the engine's fail-closed verdict) is never USABLE (got ${JSON.stringify(v.receipt && { f: v.receipt.floor, u: v.receipt.usable })})`)
      ok(!/build_usable/.test(r.atHead('.pandacorp/track.jsonl') || '') && !r.git('log', '--format=%s', `${head}..HEAD`).includes('usable') && !(existsSync(r.events) && /build_usable/.test(readFileSync(r.events, 'utf8'))), 'no build_usable line, commit or event')
    } finally { r.cleanup() }
  }
  {
    const { r, base } = setup()
    try {
      const h = path.join(r.root, '.git', 'hooks', 'commit-msg'); writeFileSync(h, '#!/bin/sh\ngrep -q usable "$1" && exit 1\nexit 0\n'); chmodSync(h, 0o755)   // only the build_usable commit fails
      const v = r.run('verify', args(base))
      ok(v.receipt.green === true && v.receipt.usable === false && v.receipt.usableCommit === null && /usable/i.test(v.receipt.usableFailure || ''), `a build_usable line that could not be committed is not USABLE (got ${JSON.stringify(v.receipt && { u: v.receipt.usable, c: v.receipt.usableCommit, f: v.receipt.usableFailure })})`)
      ok(!(existsSync(r.events) && /build_usable/.test(readFileSync(r.events, 'utf8'))) && !/build_usable/.test(r.read('.pandacorp/track.jsonl')), 'no dashboard event, and the uncommitted line is withdrawn')
    } finally { r.cleanup() }
  }
}

// ── fast-start: the fast lane's FUSED start (bench F-1: six relay spawns before the first build) ────────────────────
// precheck → the owner stop / rethink probe (lease renewed) → the scripted baseline verdict → plan --classify --compact
// → the drainable-work check → the rollup sync → the first FRD's committed dispatch, as ONE sealed line. Every step that
// is not the quiet common case stops there and hands the rest back to the engine's separate steps.
const startFixture = (r, { frdAText } = {}) => {
  planFixture(r)
  if (frdAText) { r.write(`${FRD_A}/frd.md`, frdAText); r.git('commit', '-q', '-am', 'docs: spanish ACs') }
}
const startArgs = (lease, extra = []) => ['--token', lease.token, '--epoch', String(lease.epoch), '--launch-event', '--mode', 'balanced', '--max-agents', '40', '--project-name', 'proj', ...extra]
const stampOf = (r, rel) => (/^implementation_status: (\w+)$/m.exec(r.atHead(rel) || '') || [])[1]

console.log('fast-start: the quiet common case — one sealed line through the first FRD\'s committed dispatch')
{
  const r = mkRepo()
  try {
    // bench F-1: the AC text was Spanish; the relay decoded its ó escapes and the plan line failed its seal.
    startFixture(r, { frdAText: frdMd('FRD-01').replace('show the cards.', 'mostrar las tarjetas válidas (teléfono, año).') })
    const lease = await acquire(r.proj, { runtime: 'claude', runId: 'mech-test', ttlSeconds: 60 })
    const before = r.head()
    const s = r.run('fast-start', startArgs(lease))
    const b = s.receipt || {}
    ok(s.code === 0 && s.sealed && s.lines === 1 && b.ok === true && b.status === 'dispatched', `exit 0, ONE sealed line, status dispatched (got ${s.code} ${b.status} ${b.stage || ''} ${b.reason || b.error || ''})`)
    ok(b.precheck && b.precheck.ok === true && b.precheck.op === undefined && Array.isArray(b.precheck.ownerDirt) && b.precheck.greenfield && b.precheck.greenfield.greenfield === true, 'the precheck body rides inside, ok:true, with its greenfield verdict')
    ok(b.probe && b.probe.ok === true && b.probe.renewed === true && b.probe.work === false && b.probe.stop_receipt && b.probe.stop_receipt.method === 'node-lstat', 'the probe renewed the lease (fenced) and found nothing to drain')
    ok(b.baseline === 'leased-status-only', `the lease's own status.yaml write is the only dirt → baseline leased-status-only (BL-0124), no judge (got ${b.baseline})`)
    ok(b.plan && b.plan.ok === true && b.plan.status === 'planned' && JSON.stringify(b.plan.frds.map((f) => f.frd)) === JSON.stringify(['frd-01-alpha', 'frd-02-gamma']), 'the scripted Build Plan order rides inside')
    ok(!/\\u[0-9a-f]{4}/i.test(s.line) && !/[^\x20-\x7e]/.test(s.line), 'the line holds NO \\uXXXX escape and no non-ASCII byte: a relay has nothing to decode (bench F-1)')
    const w1 = b.plan.frds[0].workOrders[0]
    ok(w1.acText === undefined && w1.acFile === '.pandacorp/run/context/WO-01-001.md', `compact plan: the AC text is a context file, not line content (got ${JSON.stringify({ acText: w1.acText, acFile: w1.acFile })})`)
    ok(/mostrar las tarjetas válidas \(teléfono, año\)/.test(r.read(w1.acFile) || '') && /AC-01-001\.2/.test(r.read(w1.acFile) || '') && !/AC-01-002\.1/.test(r.read(w1.acFile) || ''), 'the context file holds this WO\'s frd.md AC lines verbatim (accents kept) and only those')
    ok(b.synced && b.synced.ok === true, `the rollups were synced through the fenced writer (got ${JSON.stringify(b.synced)})`)
    const d = b.dispatch || {}
    ok(d.ok === true && d.frd === 'frd-01-alpha' && JSON.stringify(d.wos) === JSON.stringify(['WO-01-001', 'WO-01-002']) && d.committed && d.base, `the first FRD (no upstream in the plan) is dispatched: its PLANNED WOs, committed (got ${JSON.stringify(d)})`)
    ok(stampOf(r, WO_A) === 'IN_PROGRESS' && stampOf(r, WO_B) === 'IN_PROGRESS' && stampOf(r, WO_C) === 'PLANNED', 'IN_PROGRESS committed for frd-01-alpha only; the dependent FRD is untouched')
    const subjects = r.git('log', '--format=%s', `${before}..HEAD`).split('\n')
    ok(/dispatch WO-01-001, WO-01-002/.test(subjects[0]) && subjects.slice(1).some((x) => /rollup/i.test(x)) && subjects.some((x) => /floor/.test(x)), `order: floor classification, rollup sync, then the dispatch commit (got ${subjects.join(' | ')})`)
    ok(r.git('rev-parse', `${d.committed}^`).startsWith(d.base), 'the dispatch base is HEAD before the stamp commit (the landed-range anchor)')
    const evs = existsSync(r.events) ? readFileSync(r.events, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []
    ok(evs.some((e) => e.event === 'BuildLaunch' && e.mode === 'balanced' && e.maxAgents === 40 && e.targeted === false && e.project === 'proj') && b.launchEvent === true, 'the BuildLaunch event (B1) is appended by the script itself')
    ok(!existsSync(r.abs('.pandacorp/run/main-writer.lock')), 'the main-writer lock is released')
  } finally { r.cleanup() }
}

console.log('fast-start: every unusual start hands back before planning or dispatching')
{
  const r = mkRepo()
  try {
    startFixture(r)
    const lease = await acquire(r.proj, { runtime: 'claude', runId: 'mech-test', ttlSeconds: 60 })
    const head = r.head()
    r.write('src/owner-draft.ts', 'export const draft = 1\n')
    const o = r.run('fast-start', startArgs(lease))
    ok(o.sealed && o.receipt.status === 'owner-dirt' && o.receipt.precheck.ownerDirt.includes('src/owner-draft.ts') && !o.receipt.plan && !o.receipt.dispatch, `owner dirt → status owner-dirt, nothing planned or dispatched (got ${o.receipt.status})`)
    ok(r.head() === head && stampOf(r, WO_A) === 'PLANNED' && r.read('src/owner-draft.ts') !== null, 'nothing committed, the owner edit untouched')
    rmSync(r.abs('src/owner-draft.ts'))
    r.write('.pandacorp/run/stop', '')
    const st = r.run('fast-start', startArgs(lease))
    ok(st.receipt.status === 'stop' && st.receipt.probe.stop_receipt.stop === true && !st.receipt.plan && r.head() === head, `the owner stop file → status stop before the plan (got ${st.receipt.status})`)
    rmSync(r.abs('.pandacorp/run/stop'))
    const sy = r.read('.pandacorp/status.yaml')
    r.write('.pandacorp/status.yaml', `${sy}rethink_pending: true\n`)
    const rt = r.run('fast-start', startArgs(lease))
    ok(rt.receipt.status === 'handoff' && rt.receipt.stage === 'rethink' && !rt.receipt.plan && r.head() === head, `rethink_pending → handoff at rethink (the engine's pre-check consumes it), nothing planned (got ${rt.receipt.status} ${rt.receipt.stage})`)
    r.write('.pandacorp/status.yaml', sy)
    const foreign = r.run('fast-start', ['--token', 'not-the-token', '--epoch', String(lease.epoch)])
    ok(foreign.receipt.status === 'handoff' && foreign.receipt.stage === 'probe' && foreign.receipt.probe.renewed === false && r.head() === head, 'a lease that cannot be renewed → handoff at the probe, nothing planned')
    r.write('.gitignore', 'node_modules/\n.pandacorp/run/\n.pandacorp/inbox/\n')   // the owner inbox is gitignored in a real project
    r.git('commit', '-q', '-am', 'chore: ignore the inbox')
    r.write('.pandacorp/inbox/changes/a-fix.md', '---\ntype: bug\nclass: expedite\nstatus: ready\ndate: 2026-09-20\n---\nbody\n')
    const wk = r.run('fast-start', startArgs(lease))
    ok(wk.receipt.status === 'planned' && wk.receipt.probe.work === true && wk.receipt.plan.status === 'planned' && !wk.receipt.dispatch && !wk.receipt.synced && stampOf(r, WO_A) === 'PLANNED', `a ready change → planned, the probe says work, no sync and no dispatch (the drain may change the plan) (got ${wk.receipt.status})`)
    rmSync(r.abs('.pandacorp/inbox'), { recursive: true })
    const nt = r.run('fast-start')
    ok(nt.receipt.baseline === 'greenfield' && nt.receipt.status === 'planned' && !nt.receipt.synced && !nt.receipt.dispatch && stampOf(r, WO_A) === 'PLANNED', `no lease token: the BL-0124 exclusion is unproven (dirty status.yaml), greenfield decides; nothing synced or dispatched without the fence (got ${nt.receipt.status} ${nt.receipt.stage} ${nt.receipt.baseline})`)
  } finally { r.cleanup() }
}

console.log('fast-start: the scripted baseline verdict — known-green, escalate, greenfield; a declined plan hands back')
{
  const r = mkRepo()
  try {
    startFixture(r)
    const green = r.head()
    r.write('.pandacorp/status.yaml', `phase: implementation\nlast_green_sha: ${green}\n`)
    r.git('commit', '-q', '-am', 'chore: publish last_green_sha')
    const g = r.run('fast-start')
    ok(g.receipt.baseline === 'green' && g.receipt.plan && g.receipt.plan.status === 'planned' && g.receipt.status === 'planned' && !g.receipt.dispatch, `a clean tree on the BL-0066 pointer commit is known-green; without a token nothing is synced or dispatched (got ${g.receipt.baseline} ${g.receipt.status})`)
    r.write('src/later.ts', 'export const later = 1\n')
    r.git('add', '-A'); r.git('commit', '-q', '-m', 'feat: unverified work after the pin')
    const e = r.run('fast-start')
    ok(e.receipt.status === 'handoff' && e.receipt.stage === 'baseline' && e.receipt.baseline === 'escalate' && !e.receipt.plan, `HEAD past the pin, not greenfield → escalate: handoff before the plan (the judge baseline decides) (got ${e.receipt.baseline})`)
  } finally { r.cleanup() }
  const p = mkRepo()
  try {
    startFixture(p)
    p.write(`${FRD_A}/blueprint.md`, '---\nid: BP\n---\n# Blueprint without a plan\n')
    p.git('commit', '-q', '-am', 'docs: no Build Plan')
    const lease = await acquire(p.proj, { runtime: 'claude', runId: 'mech-test', ttlSeconds: 60 })
    const d = p.run('fast-start', startArgs(lease))
    ok(d.receipt.status === 'handoff' && d.receipt.stage === 'plan' && d.receipt.baseline === 'leased-status-only' && d.receipt.plan.status === 'no-build-plan' && !d.receipt.dispatch && stampOf(p, WO_A) === 'PLANNED', `a missing Build Plan → handoff at the plan with its reason (the engine runs the plan agent once) (got ${d.receipt.status} ${d.receipt.stage})`)
  } finally { p.cleanup() }
  const b = mkRepo()
  try {
    startFixture(b)
    b.write(WO_B, woMd('WO-01-002', 'BLOCKED', { acs: ['AC-01-002.1'], extraFm: `${fmB()}blocked_reason: needs-owner\n` }))
    b.git('commit', '-q', '-am', 'blocked beta')
    const lease = await acquire(b.proj, { runtime: 'claude', runId: 'mech-test', ttlSeconds: 60 })
    const x = b.run('fast-start', startArgs(lease))
    ok(x.receipt.status === 'planned' && !x.receipt.dispatch && stampOf(b, WO_A) === 'PLANNED', `a first FRD with a BLOCKED work order is left to the engine's own dispatch (got ${x.receipt.status})`)
  } finally { b.cleanup() }
}

// ── proposal 40 §2: the conditional security delta, the conditional telemetry, the scripted release close ─────────────
console.log('security-scope: the delta audit is conditional on deterministic triggers; quiet → the early report becomes the evidence')
{
  const r = mkRepo()
  try {
    const pin = r.head().slice(0, 12)
    r.write(`.pandacorp/run/security-early/${pin}.md`, '# Early audit\n\nNo Critical/High findings.\n')
    r.write('src/lib/rules.ts', 'export const isValid = (s) => s.length > 0\n')
    r.git('add', '-A', '--', 'proj'); r.git('commit', '-q', '-m', 'feat: pure rules')
    const q = r.run('security-scope', ['--since', pin])
    ok(q.code === 0 && q.sealed && q.receipt.status === 'quiet' && q.receipt.triggered === false, `a pure helper since the pin triggers nothing (got ${JSON.stringify(q.receipt)})`)
    const before = r.head()
    const w = r.run('security-scope', ['--since', pin, '--write-report', '--findings', '0'])
    const day = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
    ok(w.code === 0 && w.receipt.status === 'written' && w.receipt.report === `docs/reviews/security-${day}.md` && r.head() !== before && r.filesAt().includes(`proj/docs/reviews/security-${day}.md`), `quiet + --write-report commits the early audit as docs/reviews/security-<LOCAL date>.md (got ${JSON.stringify(w.receipt)})`)
    ok(/No Critical\/High findings/.test(r.atHead(`docs/reviews/security-${day}.md`)) && /delta audit ran|no delta audit ran/.test(r.atHead(`docs/reviews/security-${day}.md`)), 'the report carries the early audit and says why no delta audit ran')
    r.write('src/app/post/JsonLd.tsx', 'export const J = ({ d }) => <script dangerouslySetInnerHTML={{ __html: d }} />\n')
    r.git('add', '-A', '--', 'proj'); r.git('commit', '-q', '-m', 'feat: json-ld')
    const t = r.run('security-scope', ['--since', pin, '--write-report'])
    ok(t.code === 0 && t.receipt.status === 'triggered' && t.receipt.hits.some((h) => h.trigger === 'dangerouslySetInnerHTML'), 'a landed dangerouslySetInnerHTML triggers the delta audit (nothing written)')
    const bad = r.run('security-scope', ['--since', 'nope'])
    ok(bad.receipt.triggered === true && bad.receipt.hits[0].trigger === 'unreadable', 'an unreadable range is triggered (fail-closed)')
    const r2 = r.run('security-scope', ['--since', r.head().slice(0, 12), '--write-report'])
    ok(r2.code === 4 && r2.receipt.status === 'no-early-report', 'quiet but no early report → refused: the delta audit runs instead')
  } finally { r.cleanup() }
}
console.log('telemetry-plan-without-emitter-fails-loud: telemetry is conditional on an event plan, and a plan nothing emits fails loud')
{
  const r = mkRepo()
  try {
    const a = r.run('telemetry-scope')
    ok(a.code === 0 && a.receipt.status === 'absent' && a.receipt.applicable === false, 'no docs/analytics/events.md → not applicable')
    r.write('docs/analytics/events.md', '# Event plan\n\n## Event catalog\n\n### 1. `page_viewed`\n\n### 2. `contact_form_submitted`\n\n### 3. `contact_mailto_clicked` *(retired)*\n')
    r.git('add', '-A', '--', 'proj'); r.git('commit', '-q', '-m', 'docs: event plan')
    const loud = r.run('telemetry-scope')
    ok(loud.code === 4 && loud.receipt.ok === false && loud.receipt.status === 'no-emitters' && loud.receipt.planned.join() === 'page_viewed,contact_form_submitted', `a plan with no emitter anywhere fails loud, retired events skipped (got ${JSON.stringify(loud.receipt)})`)
    r.write('src/lib/analytics.ts', "export const EVENTS = { pageViewed: 'page_viewed' } as const\n")
    r.write('src/lib/_tests/analytics.test.ts', "capture('contact_form_submitted')\n")
    r.git('add', '-A', '--', 'proj'); r.git('commit', '-q', '-m', 'feat: one emitter')
    const some = r.run('telemetry-scope')
    ok(some.code === 0 && some.receipt.status === 'applicable' && some.receipt.missing.join() === 'contact_form_submitted', 'one emitter → applicable; an event named only in a test is still missing (the agent verifies)')
    const n = mkRepo()
    try {
      n.write('docs/analytics/events.md', '# Event plan\n\nNo analytics: the product brief excludes them.\n')
      n.git('add', '-A', '--', 'proj'); n.git('commit', '-q', '-m', 'docs: empty plan')
      const before = n.head()
      const na = n.run('telemetry-scope', ['--write-na'])
      ok(na.code === 0 && na.receipt.status === 'no-events' && na.receipt.verified === true && n.head() !== before && /^## Verification/m.test(n.atHead('docs/analytics/events.md')), 'a plan with no events records its verification section (not applicable), committed')
    } finally { n.cleanup() }
  } finally { r.cleanup() }
}
console.log('close: the scripted release — asserts, ONE full verify.sh, phase release, the fenced lease release')
{
  const VERIFY = (green = true) => `#!/bin/sh\nmkdir -p .pandacorp/run && echo ran >> .pandacorp/run/verify-ran\nprintf '{"at":"%s","scope":"full","green":${green},"sha":"%s","subgates":[{"name":"vitest","exit":${green ? 0 : 1},"failures":[]}]}\\n' "$(date -u +%FT%TZ)" "$(git rev-parse HEAD)" > .pandacorp/run/gate-report.json\nexit ${green ? 0 : 1}\n`
  const setup = async ({ green = true, verified = true, card = false, report = true } = {}) => {
    const r = mkRepo()
    planFixture(r)
    r.write(`${FRD_A}/frd.md`, frdMd('FRD-01').replace('implementation_status: PLANNED', `implementation_status: ${verified ? 'VERIFIED' : 'IN_REVIEW'}`))
    r.write(`${FRD_C}/frd.md`, frdMd('FRD-02').replace('implementation_status: PLANNED', 'implementation_status: VERIFIED'))
    r.write('.pandacorp/verify.sh', VERIFY(green)); chmodSync(r.abs('.pandacorp/verify.sh'), 0o755)
    r.write('.pandacorp/build-journal.jsonl', '{"wo":"WO-01-002","reopen_count":2,"classification":"point","why":"the sort comparator was inverted twice"}\n')
    r.write('.gitignore', 'node_modules/\n.pandacorp/run/\n.pandacorp/inbox/\n')   // the owner-facing inbox is gitignored in every project
    r.git('add', '-A', '--', 'proj'); r.git('commit', '-q', '-m', 'chore: verified project')
    const lease = await acquire(r.proj, { runtime: 'claude', runId: 'close-test', ttlSeconds: 120 })
    r.git('add', '-A', '--', 'proj'); r.git('commit', '-q', '-m', 'chore: lease projection')
    await new Promise((res) => setTimeout(res, 20))
    if (report) {
      const d = new Date()
      r.write(`docs/reviews/security-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.md`, '# Security\n')
      r.git('add', '-A', '--', 'proj'); r.git('commit', '-q', '-m', 'docs(security): audit report')
    }
    if (card) r.write('.pandacorp/inbox/changes/add-x.md', '---\ntype: feature\nstatus: building\n---\n')
    return { r, args: ['--token', lease.token, '--epoch', String(lease.epoch)] }
  }
  {
    const { r, args } = await setup()
    try {
      const c = r.run('close', args)
      ok(c.code === 0 && c.sealed && c.receipt.status === 'released' && c.receipt.verify === 'ran', `a verified, hardened project releases through ONE full verify.sh (got ${JSON.stringify(c.receipt)})`)
      ok(/^phase:\s*["']?release["']?$/m.test(r.atHead('.pandacorp/status.yaml')) && /running: false/.test(r.atHead('.pandacorp/status.yaml')), 'phase release and running:false are committed')
      ok((await currentLease(r.proj)) === null, 'the lease is finally released (two-phase)')
      ok(r.git('log', '--format=%s', '-3').includes('chore(release): phase release') && r.status().split('\n').filter((l) => / proj\//.test(l)).length === 0, 'the release and quiesce commits leave the project clean')
      const evs = readFileSync(r.events, 'utf8')
      ok(/"event":"BuildComplete"[^\n]*"verdict":"released"/.test(evs) && /"stage":"integration"/.test(evs), 'BuildComplete released + the integration Hardening event')
      ok(/WO-01-002: point|reopened|inverted twice/.test(readFileSync(r.abs('.pandacorp/run/lessons.md'), 'utf8')), 'the journal gold (reopen_count ≥ 2) is distilled to .pandacorp/run/lessons.md')
    } finally { r.cleanup() }
  }
  {
    const { r, args } = await setup({ verified: false })
    try { const c = r.run('close', args); ok(c.code === 4 && c.receipt.status === 'not-verified' && !existsSync(r.abs('.pandacorp/run/verify-ran')), 'an FRD rollup not VERIFIED refuses before verify.sh runs') } finally { r.cleanup() }
  }
  {
    const { r, args } = await setup({ report: false })
    try { const c = r.run('close', args); ok(c.code === 4 && c.receipt.status === 'no-security-evidence', 'no security report → refused') } finally { r.cleanup() }
  }
  {
    const { r, args } = await setup({ card: true })
    try { const c = r.run('close', args); ok(c.code === 4 && c.receipt.status === 'archive-pending' && c.receipt.cards.includes('add-x.md'), 'a change card still building → archive-pending (the archive step runs first)') } finally { r.cleanup() }
  }
  {
    const { r, args } = await setup({ green: false })
    try {
      const c = r.run('close', args)
      ok(c.code === 4 && c.receipt.status === 'red' && /vitest/.test(c.receipt.failure) && !/^phase:\s*["']?release/m.test(r.atHead('.pandacorp/status.yaml')) && (await currentLease(r.proj)) !== null, 'a red full verify.sh never releases: phase unchanged, the lease still held for the fallback close')
    } finally { r.cleanup() }
  }
}

// ── proposal 40 Phase 3 (§2 rows Patch, verify-patch + certify): the patch ladder's scripted verify and stamp ─────────
// After an in-place patch, `verify --patch` checks the reviewer's pinned test hashes FIRST (DR-080: a patch may not edit
// the tests that judge it), then runs those RED-proven tests and the full suite; `certify-state` writes the stamp the
// certify agent used to write (WO VERIFIED, status.yaml, the last-green snapshot), under the lease fence.
const REVIEWER_TEST = 'src/_tests/alpha.reviewer.test.ts'
const REVIEWER_TEST_BODY = "import { it } from 'vitest'\nit('AC-01-001.1 shows the empty state', () => {})\n"
const sha256Of = (text) => createHash('sha256').update(text).digest('hex')
const patchFixture = async (r, { verifyGreen = true, lease = false, reopen = 1 } = {}) => {
  planFixture(r)
  r.write('.pandacorp/verify.sh', `#!/bin/sh\nmkdir -p .pandacorp/run && echo ran >> .pandacorp/run/verify-ran\nprintf '{"at":"2026-10-02T00:00:00Z","scope":"full","green":${verifyGreen},"sha":"%s","subgates":[{"name":"vitest","exit":${verifyGreen ? 0 : 1},"failures":[${verifyGreen ? '' : '"src/alpha.ts: expected 2"'}]}]}\\n' "$(git rev-parse HEAD)" > .pandacorp/run/gate-report.json\nexit ${verifyGreen ? 0 : 1}\n`)
  chmodSync(r.abs('.pandacorp/verify.sh'), 0o755)
  r.write('src/alpha.ts', 'export const alpha = 2\n')
  r.write(WO_A, woMd('WO-01-001', 'IN_REVIEW', { acs: ['AC-01-001.1', 'AC-01-001.2'], extraFm: `${fmA}` }).replace('reopen_count: 0', `reopen_count: ${reopen}`))
  r.git('add', '-A', '--', 'proj'); r.git('commit', '-q', '-m', 'fix(frd-01-alpha): WO-01-001 patch the empty state')
  const held = lease ? await acquire(r.proj, { runtime: 'claude', runId: 'patch-test', ttlSeconds: 120 }) : null
  if (held) { r.git('add', '-A', '--', 'proj'); r.git('commit', '-q', '-m', 'chore: lease projection') }
  // The gate's RED test: salvaged into the evidence dir, then ported onto main UNTRACKED at its repo-root path.
  const ev = path.join(r.proj, '.pandacorp', 'run', 'gate-evidence', 'frd-01-alpha')
  mkdirSync(path.join(ev, 'proj', path.dirname(REVIEWER_TEST)), { recursive: true })
  writeFileSync(path.join(ev, 'proj', REVIEWER_TEST), REVIEWER_TEST_BODY)
  r.write(REVIEWER_TEST, REVIEWER_TEST_BODY)
  r.installVitest()
  return { ev, test: `${sha256Of(REVIEWER_TEST_BODY)}:proj/${REVIEWER_TEST}`, lease: held }
}
console.log('reviewer-test-hash-tamper-red: verify --patch checks the reviewer test hash first, then runs that test and the suite')
{
  const r = mkRepo()
  try {
    const { ev, test } = await patchFixture(r)
    const head = r.head()
    const args = ['--patch', '--frd', 'frd-01-alpha', '--wo', 'WO-01-001', '--test', test, '--dir', ev]
    const g = r.run('verify', args)
    ok(g.code === 0 && g.sealed && g.receipt.status === 'green' && g.receipt.green === true && g.receipt.scope === 'full', `intact hash: green (got ${g.code} ${JSON.stringify(g.receipt && { s: g.receipt.status, f: g.receipt.failure, r: g.receipt.reason })})`)
    const calls = r.vitestCalls()
    ok(calls.length === 1 && calls[0].startsWith('run ') && calls[0].includes(path.join(r.root, 'proj', REVIEWER_TEST)), `the RED-proven reviewer test runs explicitly, by its absolute path (got ${JSON.stringify(calls)})`)
    ok(existsSync(r.abs('.pandacorp/run/verify-ran')), 'then the full verify.sh runs')
    ok(g.receipt.tests && g.receipt.tests.length === 1 && g.receipt.tests[0].ok === true && g.receipt.tests[0].path === `proj/${REVIEWER_TEST}`, 'the receipt names the reviewer test it checked')
    ok(r.head() === head && !/build_usable/.test(r.atHead('.pandacorp/track.jsonl')), 'a patch verify commits nothing (no build_usable line: certification is certify-state\'s)')
    rmSync(r.abs('.pandacorp/run/verify-ran'), { force: true })
    rmSync(path.join(path.dirname(r.events), 'vitest.log'), { force: true })
    r.write(REVIEWER_TEST, "import { it } from 'vitest'\nit.skip('AC-01-001.1 shows the empty state', () => {})\n")
    const t = r.run('verify', args)
    ok(t.code === 0 && t.sealed && t.receipt.status === 'red' && t.receipt.green === false && Array.isArray(t.receipt.breach) && t.receipt.breach.some((b) => b.path === `proj/${REVIEWER_TEST}`) && /DR-080/.test(t.receipt.failure), `a patched reviewer test is RED, a DR-080 breach (got ${JSON.stringify(t.receipt && { s: t.receipt.status, b: t.receipt.breach, f: t.receipt.failure })})`)
    ok(r.vitestCalls().length === 0 && !existsSync(r.abs('.pandacorp/run/verify-ran')), 'the hash is checked FIRST: neither the reviewer test nor verify.sh ran over a tampered test')
    ok(r.read(REVIEWER_TEST) === REVIEWER_TEST_BODY && t.receipt.breach[0].restored === true, 'the reviewer\'s original is restored from the evidence dir')
    rmSync(r.abs(REVIEWER_TEST))
    const m = r.run('verify', args)
    ok(m.receipt.status === 'red' && m.receipt.breach.some((b) => b.observed === null), 'a deleted reviewer test is RED too (coverage is never deleted)')
    const none = r.run('verify', ['--patch', '--frd', 'frd-01-alpha', '--wo', 'WO-01-001'])
    ok(none.code === 2 && /reviewer/i.test(none.receipt.error || none.receipt.reason || ''), `the hash is mandatory: --patch with no --test is unusable input (got ${none.code} ${JSON.stringify(none.receipt)})`)
    r.write('src/stray.ts', 'export const stray = 1\n')
    const d = r.run('verify', args)
    ok(d.code === 4 && d.receipt.status === 'dirty' && d.receipt.paths.includes('src/stray.ts') && !d.receipt.paths.includes(REVIEWER_TEST), 'a stray edit is refused; the ported reviewer test is not dirt')
  } finally { r.cleanup() }
  const red = mkRepo()
  try {
    const { ev, test } = await patchFixture(red)
    const v = red.run('verify', ['--patch', '--frd', 'frd-01-alpha', '--wo', 'WO-01-001', '--test', test, '--dir', ev], { FAKE_VITEST_EXIT: '1' })
    ok(v.receipt.status === 'red' && /alpha\.reviewer\.test\.ts/.test(v.receipt.failure) && !existsSync(red.abs('.pandacorp/run/verify-ran')), `the RED-proven test still failing is red, before the suite (got ${v.receipt && v.receipt.failure})`)
  } finally { red.cleanup() }
  const suite = mkRepo()
  try {
    const { ev, test } = await patchFixture(suite, { verifyGreen: false })
    const v = suite.run('verify', ['--patch', '--frd', 'frd-01-alpha', '--wo', 'WO-01-001', '--test', test, '--dir', ev])
    ok(v.receipt.status === 'red' && /vitest/.test(v.receipt.failure) && existsSync(suite.abs('.pandacorp/run/verify-ran')), 'a red suite is red, naming its sub-gate')
  } finally { suite.cleanup() }
}
console.log('certify-state-writes-wo-and-status: the scripted stamp — WO VERIFIED, rollups, status.yaml and the two-commit last-green snapshot')
{
  const r = mkRepo()
  try {
    const { test, lease } = await patchFixture(r, { lease: true })
    const fence = ['--token', lease.token, '--epoch', String(lease.epoch)]
    const args = ['--frd', 'frd-01-alpha', '--wo', 'WO-01-001', '--test', test, '--drift', 'DRIFT-01-1', ...fence]
    const before = r.head()
    r.write(REVIEWER_TEST, "it.todo('weakened')\n")
    const tam = r.run('certify-state', args)
    ok(tam.code === 4 && tam.receipt.status === 'reviewer-test-changed' && r.head() === before && /implementation_status: IN_REVIEW/.test(r.read(WO_A)), `a reviewer test that changed since the verify is never committed: refused, nothing written (got ${tam.code} ${tam.receipt && tam.receipt.status})`)
    r.write(REVIEWER_TEST, REVIEWER_TEST_BODY)
    const foreign = r.run('certify-state', ['--frd', 'frd-01-alpha', '--wo', 'WO-01-001', '--test', test, '--token', 'not-the-token', '--epoch', String(lease.epoch)])
    ok(foreign.code === 4 && foreign.receipt.status === 'fence' && r.head() === before && /implementation_status: IN_REVIEW/.test(r.read(WO_A)) && r.read(`${FRD_A}/frd.md`) === r.atHead(`${FRD_A}/frd.md`), `a foreign lease fence is refused and leaves nothing behind (got ${foreign.code} ${foreign.receipt && foreign.receipt.status})`)
    const c = r.run('certify-state', args)
    ok(c.code === 0 && c.sealed && c.receipt.status === 'certified', `certified (got ${c.code} ${JSON.stringify(c.receipt && { s: c.receipt.status, r: c.receipt.reason })})`)
    const snap = r.git('rev-parse', 'HEAD^')
    ok(c.receipt.snapshot && snap.startsWith(c.receipt.snapshot) && r.head().startsWith(c.receipt.pointer), 'two commits: the snapshot (A), then the pointer (B)')
    const inA = r.filesAt('HEAD^')
    ok([`proj/${WO_A}`, `proj/${REVIEWER_TEST}`, 'proj/.pandacorp/track.jsonl', 'proj/.pandacorp/build-journal.jsonl', 'proj/.pandacorp/status.yaml', `proj/${FRD_A}/frd.md`].every((f) => inA.includes(f)), `(A) holds the WO stamp, the reviewer's test, the journals, status.yaml and frd.md (got ${inA.join(', ')})`)
    const woA = r.git('show', `HEAD^:proj/${WO_A}`)
    ok(/^implementation_status: VERIFIED$/m.test(woA) && /^reopen_count: 0$/m.test(woA), 'the WO is VERIFIED with reopen_count reset to 0')
    ok(/^drift: \[DRIFT-01-1\]$/m.test(r.atHead(`${FRD_A}/frd.md`)), 'the drift replica is written to frd.md')
    ok(r.filesAt('HEAD').join() === 'proj/.pandacorp/status.yaml' && /publish last green snapshot/.test(r.subject()), '(B) is the metadata-only pointer commit')
    const sy = r.atHead('.pandacorp/status.yaml')
    ok(new RegExp(`^last_green_sha: "?${snap}"?$`, 'm').test(sy) && /^safe_to_test: true$/m.test(sy), `last_green_sha names the snapshot (A), never the pointer (got ${(/^last_green_sha:.*$/m.exec(sy) || [''])[0]})`)
    ok(/^work_orders_verified: 1$/m.test(sy), 'the status.yaml counts are re-derived')
    const track = r.atHead('.pandacorp/track.jsonl').trim().split('\n').map((x) => JSON.parse(x))
    ok(track.some((x) => x.kind === 'review_end' && x.frd === 'frd-01-alpha' && x.verdict === 'pass') && track.some((x) => x.kind === 'frd_end' && x.frd === 'frd-01-alpha'), 'track.jsonl: review_end pass + frd_end')
    const journal = r.atHead('.pandacorp/build-journal.jsonl').trim().split('\n').map((x) => JSON.parse(x))
    ok(journal.some((x) => x.kind === 'resolution' && x.rung === 'verify' && x.role === 'verifier' && x.verdict === 'green' && x.wo === 'WO-01-001' && x.reopen_count === 1), 'the build journal records the verifier\'s green resolution (reopen_count before the reset)')
    ok(r.git('status', '--porcelain', '--', 'proj/docs/frds', `proj/${REVIEWER_TEST}`) === '', 'nothing of the stamp is left uncommitted')
    const evs = readFileSync(r.events, 'utf8').trim().split('\n').map((x) => JSON.parse(x))
    ok(evs.some((x) => x.event === 'GateVerdict' && x.verdict === 'pass' && x.via === 'patch' && x.passed === 1) && evs.some((x) => x.event === 'PatchResult' && x.outcome === 'green') && evs.some((x) => x.event === 'achievement' && x.wo === 'WO-01-001' && x.frd === 'frd-01-alpha'), 'the dashboard gets GateVerdict pass (via patch), PatchResult green and the achievement')
    const again = r.run('certify-state', args)
    ok(again.code === 4 && again.receipt.status === 'not-in-review', 'a WO no longer IN_REVIEW is never stamped twice')
  } finally { r.cleanup() }
}

console.log(`\nRESULT: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
