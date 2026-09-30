#!/usr/bin/env node
// test-audit-last-green.mjs — BL-0190: the post-run `last_green_sha` publication audit
// (plugin/scripts/audit-last-green.mjs), exercised against REAL temporary git repositories.
//
// Three kinds of evidence:
//   1. REAL fixture — the canary F1 run (fixtures/audit-last-green/): its real track.jsonl and the real
//      commit sequence (subjects, committer dates, changed paths, publication pins) of the project's
//      first-parent chain, replayed into a temp repo with the same `mission-control/` nesting. The audit
//      must reproduce the finding made against the archived branch: the FIRST publication certified three
//      sibling-FRD build commits that no gate had verified yet; the three later publications are clean.
//   2. Synthetic scenarios — the exact X5 shapes (a sibling's build commit under a later PASS, the flag-off
//      C2 wave overlapping a gate, an FRD re-opened after its verification) and the clean shape.
//   3. MALFORMED inputs that must fail LOUD (DR-078): a garbage track line, an empty timeline, an
//      unparseable timestamp, a pin that is not a commit, no publication at all. Exit 2, never a quiet 0.
//
// Exit 0 green / 1 red. Output ends in `RESULT: N passed, M failed`.

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyCommit, frdStateAt, parseTrack } from './audit-last-green.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(HERE, 'audit-last-green.mjs')
const FIXTURES = path.join(HERE, 'fixtures', 'audit-last-green')
const PREFIX = 'mission-control/'
const STATUS = '.pandacorp/status.yaml'

let passed = 0
let failed = 0
const check = (cond, msg) => { if (cond) { passed++; console.log(`PASS  ${msg}`) } else { failed++; console.log(`FAIL  ${msg}`) } }

const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' }
const git = (cwd, env, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', env: { ...GIT_ENV, ...env } })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`)
  return r.stdout.trim()
}
const write = (file, text) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, text) }

const tmpRoots = []
const newTmp = () => { const d = mkdtempSync(path.join(os.tmpdir(), 'audit-last-green-')); tmpRoots.push(d); return d }

/**
 * Replays commit specs into a fresh repo nested under `mission-control/`. A spec is
 * `{ id, at, subject, files: [project-relative paths], pin?: <spec id|null> }`: status.yaml is written
 * iff the spec lists it, carrying the pin line for `pin` (mapped to the replayed sha) — exactly the state
 * the real commit left. A `base` commit (id `baseId`) precedes everything so a pin can name it.
 */
function replay(specs, baseId = 'base') {
  const repo = newTmp()
  git(repo, {}, 'init', '-q', '-b', 'main')
  const ids = new Map()
  const commit = (spec) => {
    for (const f of spec.files) {
      if (f === STATUS) {
        const pinSha = spec.pin ? ids.get(spec.pin) : null
        write(path.join(repo, PREFIX, STATUS), `phase: implementation\n${pinSha ? `last_green_sha: "${pinSha}"\n` : ''}# ${spec.id}\n`)
      } else write(path.join(repo, PREFIX, f), `${spec.id}\n${spec.subject}\n`)
    }
    if (spec.files.length === 0) write(path.join(repo, PREFIX, '.pandacorp', '_replay', spec.id), `${spec.id}\n`)
    git(repo, {}, 'add', '-A')
    const env = { GIT_AUTHOR_DATE: spec.at, GIT_COMMITTER_DATE: spec.at }
    git(repo, env, 'commit', '-q', '--allow-empty', '-m', spec.subject)
    ids.set(spec.id, git(repo, {}, 'rev-parse', 'HEAD'))
  }
  commit({ id: baseId, at: '2026-09-03T00:00:00-05:00', subject: 'chore: base', files: ['src/base.ts'] })
  specs.forEach(commit)
  return { repo, ids, project: path.join(repo, 'mission-control') }
}

const run = (args) => {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', timeout: 120_000 })
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' }
}
const audit = (project, trackFile, extra = []) => run(['--project', project, '--track', trackFile, ...extra])
const track = (lines) => { const f = path.join(newTmp(), 'track.jsonl'); writeFileSync(f, `${lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n')}\n`); return f }

const T = (hh, mm, ss = 0) => `2026-09-25T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}Z`
const pub = (id, at, pin) => ({ id, at, subject: 'chore(build): publish last green snapshot', files: [STATUS], pin })
const code = (id, at, subject, files = ['src/x.ts']) => ({ id, at, subject, files })

// ── 1. REAL fixture: canary F1 ───────────────────────────────────────────────────────────────────
{
  const manifest = JSON.parse(readFileSync(path.join(FIXTURES, 'f1-commits.json'), 'utf8'))
  const { project } = replay(manifest, 'd9addc89')
  const f1Track = path.join(FIXTURES, 'f1-track.jsonl')
  const r = audit(project, f1Track, ['--from', '2026-09-25'])
  check(r.code === 1, `F1 real: exit 1 — the first publication certified unverified sibling commits (got ${r.code})`)
  check(/4 publication\(s\) audited, 3 violation\(s\)/.test(r.out), 'F1 real: 4 publications audited, exactly 3 violations')
  check(/VIOLATION d858cf8d: \S+ "feat\(frd-05-work-orders\): WO-05-007/.test(r.out) || /VIOLATION \S+: \S+ "feat\(frd-05-work-orders\): WO-05-007/.test(r.out), 'F1 real: the frd-05 WO-05-007 build commit is flagged')
  check(/"feat\(changes\): add relative date formatting for changes card" — frd-04 was not VERIFIED/.test(r.out), 'F1 real: the frd-04 WO-04-008 commit (path-attributed via its work-order file) is flagged')
  check(/"feat\(frd-02\): WO-02-014 .* frd-02 was not VERIFIED/.test(r.out), 'F1 real: the frd-02 WO-02-014 build commit is flagged')
  check(/verified \d+ min after the publication/.test(r.out), 'F1 real: each violation reports when the FRD was finally verified (transient window)')
  check(!/VIOLATION \S+: \S+ "(fix|test)\(.*(portfolio|frd-02-ideas-board)/.test(r.out), 'F1 real: the gate\'s own patch/test commits landed by the passing lane are NOT flagged')
  const later = audit(project, f1Track, ['--from', '2026-09-26T04:47:01Z'])
  check(later.code === 0 && /3 publication\(s\) audited, 0 violation\(s\)/.test(later.out), 'F1 real: the three later publications (pins f6ebface, a9f54cd9, ed2bbf72) are clean, exit 0')
  const strict = audit(project, f1Track, ['--from', '2026-09-26T04:47:01Z', '--grace-seconds', '0'])
  check(strict.code === 0, 'F1 real: the same three later publications are clean with --grace-seconds 0 (F1 stamped frd_end BEFORE each publication)')
  const json = JSON.parse(audit(project, f1Track, ['--from', '2026-09-25', '--json']).out)
  check(json.violations.length === 3 && json.publications.length === 4 && Array.isArray(json.unattributed), 'F1 real: --json carries publications/violations/unattributed')
}

// ── 2. Synthetic X5 / C2 shapes ──────────────────────────────────────────────────────────────────
const TRACK_HEAD = [
  { kind: 'wo_start', frd: 'frd-01-alpha', wo: 'WO-01-001', at: T(9, 0) },
  { kind: 'wo_end', frd: 'frd-01-alpha', wo: 'WO-01-001', state: 'in_review', at: T(9, 10) },
  { kind: 'wo_start', frd: 'frd-02-beta', wo: 'WO-02-001', at: T(9, 12) },
  { kind: 'wo_end', frd: 'frd-02-beta', wo: 'WO-02-001', state: 'in_review', at: T(9, 20) },
]
{
  // X5: FRD-01 passes and publishes; FRD-02's build commit (IN_REVIEW, ungated) sits inside the range.
  const { project } = replay([
    pub('p0', T(8, 0), 'base'),
    code('c1', T(9, 10), 'feat(frd-01-alpha): add alpha (WO-01-001)'),
    code('c2', T(9, 20), 'feat(frd-02-beta): add beta (WO-02-001)'),
    code('c3', T(9, 40), 'fix(frd-01-alpha): gate patch'),
    pub('p1', T(9, 41), 'c3'),
  ])
  const tf = track([...TRACK_HEAD, { kind: 'review_end', frd: 'frd-01-alpha', verdict: 'pass', at: T(9, 41) }, { kind: 'frd_end', frd: 'frd-01-alpha', at: T(9, 41) }])
  const r = audit(project, tf)
  check(r.code === 1 && /VIOLATION \S+: \S+ "feat\(frd-02-beta\)/.test(r.out) && /frd-02 was not VERIFIED/.test(r.out), 'X5: a PASS landing after an unverified sibling\'s build commit reports exactly that violation')
  check((r.out.match(/VIOLATION/g) || []).length === 1, 'X5: only the sibling commit is flagged — FRD-01\'s own commits (verified) are not')
  check(/never verified in this timeline/.test(r.out), 'X5: a sibling never verified in the timeline says so')
  const rec = audit(project, tf, ['--record'])
  const lines = readFileSync(tf, 'utf8').trim().split('\n')
  const last = JSON.parse(lines[lines.length - 1])
  check(rec.code === 1 && last.kind === 'last_green_audit' && last.violations === 1 && last.violationDetail.length === 1, 'record: --record appends one last_green_audit line with the violation count')
  check(parseTrack(readFileSync(tf, 'utf8')).size === 2, 'record: the audit line is ignored by the timeline reader (no frd), the file stays parseable')
}
{
  // Clean: every FRD in the range was verified before the publication that certifies it.
  const { project } = replay([
    pub('p0', T(8, 0), 'base'),
    code('c1', T(9, 10), 'feat(frd-01-alpha): add alpha (WO-01-001)'),
    code('c2', T(9, 20), 'feat(frd-02-beta): add beta (WO-02-001)'),
    pub('p1', T(10, 0), 'c2'),
    { id: 'm1', at: T(10, 5), subject: 'docs(frd-03-gamma): plan gamma', files: ['docs/frds/frd-03-gamma/frd.md'] },
    code('c4', T(10, 6), 'chore(mission-control): upgrade overlay', ['src/overlay.ts']),
    pub('p2', T(10, 7), 'c4'),
  ])
  const tf = track([...TRACK_HEAD,
    { kind: 'review_end', frd: 'frd-01-alpha', verdict: 'pass', at: T(9, 50) }, { kind: 'frd_end', frd: 'frd-01-alpha', at: T(9, 50) },
    { kind: 'review_end', frd: 'frd-02-beta', verdict: 'pass', at: T(9, 58) }, { kind: 'frd_end', frd: 'frd-02-beta', at: T(9, 58) }])
  const r = audit(project, tf, ['--last', '2'])
  check(r.code === 0 && /0 violation\(s\)/.test(r.out), 'clean: only verified-FRD (and metadata) commits between publications → exit 0')
  check(/unattributed p2|unattributed \S+: \S+ "chore\(mission-control\): upgrade overlay"/.test(r.out), 'clean: an unattributable code commit is listed as unattributed, not a violation')
}
{
  // C2 (flag off): FRD-A's gate is running while FRD-B's build wave lands; A's PASS publishes over B.
  const { project } = replay([
    pub('p0', T(8, 0), 'base'),
    code('a1', T(9, 10), 'feat(frd-01-alpha): add alpha (WO-01-001)'),
    code('b1', T(9, 25), 'feat(frd-02-beta): wave commit landing during the frd-01 gate (WO-02-002)'),
    pub('p1', T(9, 40), 'b1'),
  ])
  const tf = track([...TRACK_HEAD, { kind: 'review_start', frd: 'frd-01-alpha', at: T(9, 15) }, { kind: 'wo_end', frd: 'frd-02-beta', wo: 'WO-02-002', state: 'in_review', at: T(9, 25) }, { kind: 'review_end', frd: 'frd-01-alpha', verdict: 'pass', at: T(9, 40) }, { kind: 'frd_end', frd: 'frd-01-alpha', at: T(9, 40) }])
  const r = audit(project, tf)
  check(r.code === 1 && /"feat\(frd-02-beta\): wave commit/.test(r.out), 'C2 flag-off shape: a build wave landing during another FRD\'s gate is flagged when that PASS publishes over it')
}
{
  // An FRD verified earlier but re-opened (a new WO started) is unverified again at a later publication.
  const { project } = replay([
    pub('p0', T(8, 0), 'base'),
    code('c1', T(9, 10), 'feat(frd-01-alpha): reopened follow-up (WO-01-002)'),
    pub('p1', T(9, 30), 'c1'),
  ])
  const tf = track([...TRACK_HEAD, { kind: 'frd_end', frd: 'frd-01-alpha', at: T(9, 0) }, { kind: 'wo_start', frd: 'frd-01-alpha', wo: 'WO-01-002', at: T(9, 5) }, { kind: 'wo_end', frd: 'frd-01-alpha', wo: 'WO-01-002', state: 'in_review', at: T(9, 10) }])
  const r = audit(project, tf)
  check(r.code === 1 && /frd-01 was not VERIFIED at the publication \(wo_end/.test(r.out), 're-open: an FRD with new work after its frd_end counts as unverified')
}
{
  // Grace: the frd_end line is stamped a few seconds AFTER the publication commit (measured on E2).
  const { project } = replay([pub('p0', T(8, 0), 'base'), code('c1', T(9, 10), 'feat(frd-01-alpha): add alpha (WO-01-001)'), pub('p1', T(9, 30, 0), 'c1')])
  const tf = track([...TRACK_HEAD.slice(0, 2), { kind: 'frd_end', frd: 'frd-01-alpha', at: T(9, 30, 8) }])
  check(audit(project, tf).code === 0, 'grace: a frd_end stamped 8 s after the publication is the same landing → clean')
  check(audit(project, tf, ['--grace-seconds', '0']).code === 1, 'grace: with --grace-seconds 0 the same history is a violation')
}

// ── 3. Units: parsing, time ordering, classification ─────────────────────────────────────────────
{
  const byFrd = parseTrack([
    JSON.stringify({ kind: 'wo_start', frd: 'frd-07-x', at: '2026-09-01T10:00:42.920Z' }),
    JSON.stringify({ kind: 'frd_end', frd: 'frd-07-x', at: '2026-09-01T10:00:42Z' }),
  ].join('\n'))
  check(frdStateAt(byFrd, 'frd-07', Date.parse('2026-09-01T10:01:00Z')).verified === false, 'time: "…42.920Z" is AFTER "…42Z" (Date.parse, never lexicographic) → the FRD is unverified again')
  check(frdStateAt(byFrd, 'frd-09', 0).verified === false, 'time: an FRD with no event is unverified (fail-closed)')
  check(classifyCommit({ subject: 'feat(x): y', files: ['docs/frds/frd-02-a/work-orders/wo-02-001-z.md', 'src/a.ts'] }).frds[0] === 'frd-02', 'classify: a work-order file attributes the FRD')
  check(classifyCommit({ subject: 'fix: x', files: ['docs/frds/frd-02-a/frd.md', 'docs/frds/frd-03-b/blueprint.md', 'src/a.ts'] }).kind === 'unattributed', 'classify: frd.md/blueprint.md rollup edits attribute nothing')
  check(classifyCommit({ subject: 'docs(frd-02): note', files: ['docs/decision-log.md', '.pandacorp/track.jsonl'] }).kind === 'metadata', 'classify: docs/.pandacorp-only commits are metadata')
}

// ── 4. MALFORMED inputs fail LOUD (DR-078) ───────────────────────────────────────────────────────
{
  const { project } = replay([pub('p0', T(8, 0), 'base'), code('c1', T(9, 10), 'feat(frd-01-alpha): add (WO-01-001)'), pub('p1', T(9, 30), 'c1')])
  const good = track([...TRACK_HEAD])
  const bad = (name, tf, re, extra = [], proj = project) => {
    const r = audit(proj, tf, extra)
    check(r.code === 2 && re.test(r.err) && r.out === '', `malformed: ${name} → exit 2 with an explanation, no report on stdout`)
  }
  bad('a garbage track line', track([...TRACK_HEAD, 'this is not json {']), /track line 5 is not valid JSON/)
  bad('a timeline with no FRD lifecycle events', track([{ kind: 'usage_summary', at: T(9, 0), calls_total: 1 }]), /no FRD lifecycle events/)
  bad('an FRD event with an unparseable "at"', track([{ kind: 'wo_end', frd: 'frd-01-alpha', wo: 'WO-01-001', at: 'yesterday-ish' }]), /unparseable "at"/)
  bad('a track line without a "kind"', track([{ frd: 'frd-01-alpha', at: T(9, 0) }]), /no string "kind"/)
  bad('a missing track file', path.join(newTmp(), 'nope.jsonl'), /track file not found/)
  bad('a bad option', good, /bad argument|unknown option/, ['--bogus', '1'])
  const empty = replay([code('c1', T(9, 10), 'feat(frd-01-alpha): add (WO-01-001)')])
  bad('a status.yaml history with no publication at all', good, /no last_green_sha publication found/, [], empty.project)
  const orphan = newTmp()
  git(orphan, {}, 'init', '-q', '-b', 'main')
  write(path.join(orphan, PREFIX, STATUS), 'phase: x\nlast_green_sha: "a1b2c3d4"\n')
  git(orphan, {}, 'add', '-A'); git(orphan, {}, 'commit', '-q', '-m', 'first'); write(path.join(orphan, PREFIX, STATUS), 'phase: x\nlast_green_sha: "deadbeef"\n')
  git(orphan, {}, 'add', '-A'); git(orphan, {}, 'commit', '-q', '-m', 'second pin')
  bad('a pin that is not a commit in the repository', good, /is not a commit/, [], path.join(orphan, 'mission-control'))
}

for (const d of tmpRoots) rmSync(d, { recursive: true, force: true })
console.log(`\nRESULT: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
