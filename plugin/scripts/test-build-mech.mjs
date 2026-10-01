#!/usr/bin/env node
// test-build-mech.mjs — proposal 39 §2 C1/C2: git-fixture tests of pandacorp-build-mech.mjs, the deterministic
// replacement for the build engine's MECH prompts (commit-wo, park-wo, precheck, dispatch, safe-point, reuse-check,
// gate-prepare, gate-release). Every scenario builds a real repository with the project NESTED under `proj/` (the
// Mission Control shape, BL-0202) and runs the real script. The oracle is the resulting tree, index and HEAD — never
// the script's own receipt alone — and every receipt must carry a valid integrity seal (drift-seal.mjs).

import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { acquire } from '../runtime/build-state.mjs'
import { verifySealedLine } from './drift-seal.mjs'

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
    const evArgs = ['commit-wo', 'precheck', 'verify'].includes(op) && !args.includes('--events') ? ['--events', events] : []   // never the real ~/.claude stream
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

// ── precheck ─────────────────────────────────────────────────────────────────────────────────────
console.log('precheck: pending reverts recovered, engine-owned dirt salvaged, owner dirt untouched')
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
    // A crash residue: dirty WO frontmatter + journal (engine-owned) next to owner edits.
    r.write(WO_B, woMd('WO-01-002', 'IN_REVIEW', { acs: ['AC-01-002.1'] }))
    r.write('.pandacorp/track.jsonl', '{"kind":"start"}\n{"kind":"crash"}\n')
    r.write('src/owner.ts', 'owner work in progress\n')
    r.write('.pandacorp/status.yaml', 'phase: implementation\nrunning: true\n')
    const p = r.run('precheck', ['--events', r.events])
    ok(p.code === 0 && p.sealed && p.receipt.onMain === true, 'precheck exits 0 with one sealed line, on main')
    ok(p.receipt.reverts.length === 1 && p.receipt.reverts[0].frd === 'frd-01-alpha' && p.receipt.reverts[0].recovery === 'recovered' && r.read('src/alpha.ts') === null, 'the interrupted discard is finished first (wo-revert recover)')
    const salvaged = p.receipt.salvaged.map((x) => x.path).sort()
    ok(JSON.stringify(salvaged) === JSON.stringify(['.pandacorp/track.jsonl', WO_B].sort()), `engine-owned dirt is salvaged (${salvaged.join(', ')})`)
    ok(r.read(WO_B) === woMd('WO-01-002', 'PLANNED', { acs: ['AC-01-002.1'] }) && /IN_REVIEW/.test(readFileSync(path.join(r.proj, p.receipt.salvageDir, WO_B), 'utf8')), 'the WO frontmatter is reset to HEAD and its dirty copy kept in salvage')
    ok(r.read('src/owner.ts') === 'owner work in progress\n' && /running: true/.test(r.read('.pandacorp/status.yaml')) && p.receipt.ownerDirt.includes('src/owner.ts'), 'owner dirt and the lease projection are never touched (owner dirt reported)')
  } finally { r.cleanup() }
  const b = mkRepo()
  try {
    b.git('checkout', '-q', '-b', 'build/x')
    b.write(WO_B, woMd('WO-01-002', 'IN_REVIEW'))
    const p = b.run('precheck', ['--events', b.events])
    ok(p.code === 0 && p.receipt.onMain === false && p.receipt.salvaged.length === 0 && /IN_REVIEW/.test(b.read(WO_B)), 'off main: nothing is salvaged or reset')
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
    const yes = r.run('reuse-check')
    ok(yes.code === 0 && yes.sealed && yes.receipt.canReuse === true && yes.receipt.reason === 'reused', 'full + green + HEAD + clean + fresh → reused')
    report({ scope: 'since' }); ok(r.run('reuse-check').receipt.reason === 'scope-not-eligible', 'since scope never counts')
    report({ green: false }); ok(r.run('reuse-check').receipt.reason === 'not-green', 'red never counts')
    report({ sha: 'deadbeef' }); ok(r.run('reuse-check').receipt.reason === 'sha-mismatch', 'another sha never counts')
    report({ at: new Date(Date.now() - 3600 * 1000).toISOString() }); ok(r.run('reuse-check').receipt.reason === 'stale-report', 'an old report never counts')
    report({}); r.write('src/existing.ts', 'dirty\n'); ok(r.run('reuse-check').receipt.reason === 'dirty-tree', 'a dirty tree never counts')
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


// ── plan / classify-frd / verify: the fast lane's deterministic plan, floor and USABLE check (proposal 39 C3/C4/C6) ──
const FRD_A = 'docs/frds/frd-01-alpha'
const FRD_C = 'docs/frds/frd-02-gamma'
const frdMd = (id, extra = '', body = '') => `---\nid: ${id}\ntype: frd\nimplementation_status: PLANNED\n${extra}---\n# ${id}\n\n## Acceptance criteria\n- **AC-01-001.1** WHEN the list loads, the system SHALL show the cards.\n- **AC-01-001.2** WHEN the list is empty, the system SHALL show the empty state.\n- **AC-01-002.1** The system SHALL sort the cards by date.\n- **AC-02-001.1** The system SHALL show the gamma panel.\n${body}`
const blueprint = (rows) => `---\nid: BP\n---\n# Blueprint\n\n## 7. Build Plan\n\n| WO | Depends on | Artifacts (globs) |\n|---|---|---|\n${rows.map(([id, deps]) => `| ${id} | ${deps} | x |`).join('\n')}\n\n- **Order:** as the table says.\n\n## 8. Risks\n`
const fmA = 'title: Alpha cards\ndifficulty: high\nartifacts: [src/alpha.ts, "src/_tests/**"]\ndependsOn: []\nsource_requirements: []\n'
const fmB = (deps = '[WO-01-001]') => `title: Beta sort\nartifacts: [src/beta.ts]\ndependsOn: ${deps}\n`
const fmC = (art = 'src/app/api/gamma/**') => `title: Gamma panel\nartifacts: [${art}]\ndependsOn: [WO-01-002]\n`
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

console.log('plan --classify / classify-frd: the deterministic floor, written to the FRD frontmatter, monotone')
{
  const r = mkRepo()
  try {
    planFixture(r)
    const head = r.head()
    const p = r.run('plan', ['--classify'])
    ok(p.code === 0 && p.receipt.status === 'planned', `plan --classify runs (got ${p.receipt && p.receipt.status} ${p.receipt && p.receipt.reason})`)
    ok(byFrd(p)['frd-01-alpha'].floor === false && byFrd(p)['frd-02-gamma'].floor === true, 'a plain FRD is not floor; an FRD declaring app/api is floor')
    ok((byFrd(p)['frd-02-gamma'].floorHits || []).some((h) => /app\/api/.test(h)), 'the floor hit is named')
    ok(r.head() !== head && /floor/.test(r.subject()) && r.filesAt().sort().join() === [`proj/${FRD_A}/frd.md`, `proj/${FRD_C}/frd.md`].join(), 'one commit writes floor: into exactly the two frd.md')
    ok(/^floor: false$/m.test(r.atHead(`${FRD_A}/frd.md`)) && /^floor: true$/m.test(r.atHead(`${FRD_C}/frd.md`)), 'the frontmatter carries floor: false / floor: true')
    const h2 = r.head()
    r.run('plan', ['--classify'])
    ok(r.head() === h2, 'an unchanged classification commits nothing')
    r.write(WO_C, woMd('WO-02-001', 'PLANNED', { acs: ['AC-02-001.1'], extraFm: fmC('src/gamma.ts') }))
    r.git('commit', '-q', '-am', 'gamma moves out of app/api')
    const m = r.run('classify-frd', ['--frd', 'frd-02-gamma'])
    ok(m.code === 0 && m.sealed && m.receipt.frds[0].floor === true && /^floor: true$/m.test(r.read(`${FRD_C}/frd.md`)), 'floor is monotone: a later non-floor verdict never lowers it')
    r.write(`${FRD_A}/frd.md`, frdMd('FRD-01', 'floor: false\n', '- The system SHALL check the password before showing private cards.\n'))
    r.git('commit', '-q', '-am', 'alpha spec mentions credentials')
    const t = r.run('classify-frd', ['--frd', 'frd-01-alpha'])
    ok(t.receipt.frds[0].floor === true && t.receipt.frds[0].changed === true, 'the FRD text alone can raise the floor (S5 content via --text)')
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
  const VERIFY_SH = ({ green = true, sha = '$(git rev-parse HEAD)' } = {}) => `#!/bin/sh\nmkdir -p .pandacorp/run && echo ran >> .pandacorp/run/verify-ran\nprintf '{"at":"2026-10-01T00:00:00Z","scope":"full","green":${green},"sha":"%s","subgates":[{"name":"biome","exit":0,"failures":[]},{"name":"tsc","exit":${green ? 0 : 2},"failures":[${green ? '' : '"src/a.ts: TS2345"'}]}]}\\n' "${sha}" > .pandacorp/run/gate-report.json\nexit ${green ? 0 : 1}\n`
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
      r.write('src/app/api/alpha/route.ts', 'export async function GET() { return new Response("ok") }\n')
      r.git('add', '-A'); r.git('commit', '-q', '-m', 'feat: WO-01-001 route')
      const v = r.run('verify', args(base))
      ok(v.receipt.status === 'green' && v.receipt.floor === true && v.receipt.usable === false && /^floor: true$/m.test(r.atHead(`${FRD_A}/frd.md`)), 'a landed floor path makes it floor: green but NOT usable')
      const track = r.atHead('.pandacorp/track.jsonl')
      ok(!/build_usable/.test(track), 'no build_usable for a floor FRD')
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

console.log(`\nRESULT: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
