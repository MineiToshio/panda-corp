#!/usr/bin/env node
// test-evidence-seals.mjs — BL-0214: the two deterministic scripts that keep model relays of machine output honest.
//
//   seal-report.mjs     seals the digested evidence collector's gate-report.json (and re-reads the stored copy)
//   finder-snippets.mjs checks the drift finder's `implemented` citations against the committed tree at the pin
//
// The snippet checker runs against a REAL temporary git repository with a NESTED project (like Mission Control
// inside the factory repo) and, in particular, the canary-F2 shape: a snippet that exists on the main checkout
// but not at the pin.
//
// Exit 0 green / 1 red. Output ends in `RESULT: N passed, M failed`.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifySealedLine } from './drift-seal.mjs'
import { classifyRow, fnv1a, projectRelative } from './finder-snippets.mjs'
import { sealGateReport } from './seal-report.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SEAL = path.join(HERE, 'seal-report.mjs')
const SNIPPETS = path.join(HERE, 'finder-snippets.mjs')

let passed = 0
let failed = 0
const check = (cond, msg) => { if (cond) { passed++; console.log(`PASS  ${msg}`) } else { failed++; console.log(`FAIL  ${msg}`) } }
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const write = (file, text) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, text) }
const runLine = (script, ...args) => execFileSync('node', [script, ...args], { encoding: 'utf8' }).trim().split('\n').pop()
const run = (script, ...args) => JSON.parse(runLine(script, ...args))

const tmp = mkdtempSync(path.join(os.tmpdir(), 'evidence-seals-'))

// ── seal-report.mjs ──────────────────────────────────────────────────────────────────────────────────────────
const REPORT = { at: '2026-09-30T10:00:00Z', scope: 'since', green: false, subgates: [{ name: 'tsc', exit: 0 }, { name: 'vitest', exit: 1, failures: [{ file: 'src/a.test.ts', title: 'renders the título' }, { file: 'src/b.test.ts', title: 'handles empty' }] }] }
const ID = ['--frd', 'frd-01-demo', '--pin', 'abc1234']
const reportFile = path.join(tmp, 'gate-report.json')
write(reportFile, `${JSON.stringify(REPORT, null, 2)}\n`)
{
  const line = runLine(SEAL, 'seal', '--file', reportFile, ...ID)
  const parsed = JSON.parse(line)
  check(verifySealedLine(line).ok, 'seal: the printed line carries a seal that verifies')
  check(parsed.ok === true && parsed.version === 2 && parsed.kind === 'gate-report', 'seal: the envelope announces version 2 and kind gate-report')
  check(JSON.stringify(parsed.report) === JSON.stringify(REPORT), 'seal: the report inside the envelope is the file, unaltered')
  check(!line.includes('\n') && /^[\x20-\x7e]*$/.test(line), 'seal: ONE line, ASCII only (the non-ASCII title is escaped, still plain JSON)')
  check(Object.keys(parsed).at(-1) === 'sum', 'seal: `sum` is the LAST key')
  check(parsed.frd === 'frd-01-demo' && parsed.pin === 'abc1234', 'seal: the FRD and the pin ride inside the sealed envelope')
  const wrongFrd = run(SEAL, 'seal', '--file', reportFile, '--frd', 'frd 01;x', '--pin', 'abc1234')
  check(wrongFrd.ok === false && /plain identifiers/.test(wrongFrd.error), 'seal: a malformed --frd is a refusal (it is interpolated into a shell command by the engine)')

  const dropped = line.replace(/\{"file":"src\/b\.test\.ts","title":"handles empty"\}/, '').replace(',]', ']')
  check(dropped !== line && !verifySealedLine(dropped).ok, 'an altered copy that LOST a failures[] row is caught (the canonical BL-0214 relay loss, still valid JSON)')
  const flipped = line.replace('"name":"vitest","exit":1', '"name":"vitest","exit":0')
  check(flipped !== line && !verifySealedLine(flipped).ok, 'an altered copy that flipped a sub-gate exit is caught')
  check(!verifySealedLine(JSON.stringify(REPORT)).ok, 'an unsealed copy of the bare report is refused')
}
{
  const stored = path.join(tmp, 'run', 'gate-report.sealed.json')
  const first = runLine(SEAL, 'seal', '--file', reportFile, ...ID, '--out', stored)
  check(readFileSync(stored, 'utf8').trim() === first, 'seal --out: the stored file is exactly the printed line')
  check(runLine(SEAL, 'reread', '--file', stored) === first, 'reread: prints the stored line, byte for byte')
  write(stored, `${first.replace('"exit":1', '"exit":0')}\n`)
  const bad = run(SEAL, 'reread', '--file', stored)
  check(bad.ok === false && /corrupt/.test(bad.error), 'reread: a corrupt stored line is refused, never re-printed')
  check(run(SEAL, 'reread', '--file', path.join(tmp, 'nope.json')).ok === false, 'reread: a missing file is refused')
  write(path.join(tmp, 'bad.json'), '{not json')
  const refused = run(SEAL, 'seal', '--file', path.join(tmp, 'bad.json'), ...ID)
  check(refused.ok === false && /not valid JSON/.test(refused.error) && !('sum' in refused), 'seal: an unparseable report is a refusal line, not a sealed one')
  write(path.join(tmp, 'arr.json'), '[1,2]')
  check(run(SEAL, 'seal', '--file', path.join(tmp, 'arr.json'), ...ID).ok === false, 'seal: a JSON array is not a gate report')
  check(verifySealedLine(sealGateReport(JSON.stringify(REPORT), { frd: 'frd-01-demo', pin: 'abc1234' })).ok, 'sealGateReport (the library entry point) seals like the CLI')
  // Red-team 2026-09-30: a seal that REFUSES (verify.sh timed out, the report is missing) must not leave an earlier gate's
  // sealed copy of the same FRD at the same pin at --out — the identity check cannot tell it apart, so a re-read would serve it.
  const earlier = runLine(SEAL, 'seal', '--file', reportFile, ...ID, '--out', stored)
  check(existsSync(stored) && verifySealedLine(earlier).ok, 'setup: an earlier gate stored a valid sealed report')
  const timedOut = run(SEAL, 'seal', '--file', path.join(tmp, 'missing-gate-report.json'), ...ID, '--out', stored)
  check(timedOut.ok === false && /no file/.test(timedOut.error), 'seal: a missing report is a refusal')
  check(!existsSync(stored), 'seal --out: the refusal REMOVED the earlier stored copy, so a re-read can never serve it')
  check(run(SEAL, 'reread', '--file', stored).ok === false, 'reread after a refused seal: nothing to serve (refused, never the earlier report)')
}

// ── finder-snippets.mjs: pure classification ─────────────────────────────────────────────────────────────────
const FILE = ['import x from "y"', '', 'export function formatLastSync(d: Date) {', '  return d.toISOString()', '}', '', ...Array.from({ length: 40 }, (_, i) => `const filler${i} = ${i}`), 'export const tail = 1'].join('\n')
{
  check(classifyRow(FILE, { line: 3, snippet: 'export function formatLastSync(d: Date)' }) === 'ok', 'classify: a snippet at the cited line is ok')
  check(classifyRow(FILE, { line: 5, snippet: 'export function   formatLastSync(d: Date) {\n  return d.toISOString()' }) === 'ok', 'classify: whitespace and multi-line snippets are compared collapsed')
  check(classifyRow(FILE, { line: 40, snippet: 'export function formatLastSync(d: Date)' }) === 'moved', 'classify: present in the file but far from the cited line is moved (stale line number only)')
  check(classifyRow(FILE, { line: 3, snippet: 'export function formatLastSyncLegacy()' }) === 'missing', 'classify: absent from the file is missing')
  check(classifyRow(null, { line: 3, snippet: 'export function formatLastSync' }) === 'no-file', 'classify: no file at the pin is no-file')
  check(classifyRow(FILE, { line: 3, snippet: '  { ' }) === 'unverifiable' && classifyRow(FILE, { line: 3, snippet: '' }) === 'unverifiable', 'classify: an empty or tiny snippet proves nothing')
  check(classifyRow(FILE, { snippet: 'export const tail = 1' }) === 'moved', 'classify: no usable line number still finds it in the file')
  check(projectRelative('./src/a.ts:12') === 'src/a.ts' && projectRelative('src/a.ts:12-20') === 'src/a.ts', 'projectRelative strips ./ and a :line / :line-line suffix')
  check(projectRelative('/etc/passwd') === null && projectRelative('../x.ts') === null && projectRelative('a/../../x') === null && projectRelative('') === null, 'projectRelative rejects absolute, parent-escaping and empty paths')
}

// ── finder-snippets.mjs: CLI against a real nested git project ───────────────────────────────────────────────
const repo = path.join(tmp, 'repo')
const app = path.join(repo, 'app')
mkdirSync(app, { recursive: true })
git(repo, 'init', '-q')
git(repo, 'config', 'user.email', 't@e.st')
git(repo, 'config', 'user.name', 'T')
write(path.join(app, 'src/lib/format.ts'), FILE)
write(path.join(repo, 'outside.ts'), 'export const outsideTheProject = "only at the repo root"\n')
git(repo, 'add', '-A')
git(repo, 'commit', '-qm', 'pin')
const PIN = git(repo, 'rev-parse', 'HEAD')
// The canary-F2 shape: the main checkout moved on, and a fix exists there that the pin does not contain.
write(path.join(app, 'src/lib/format.ts'), `${FILE}\nexport const formatLastSyncFixed = (d: Date) => d.toLocaleString()\n`)
write(path.join(app, 'src/lib/onlyOnMain.ts'), 'export const brandNewOnMain = true\n')
git(repo, 'add', '-A')
git(repo, 'commit', '-qm', 'main moved on')
write(path.join(app, 'src/lib/format.ts'), `${FILE}\nexport const uncommittedEdit = 1\n`)

const callCheck = (rows, extra = []) => {
  const json = JSON.stringify(rows)
  return run(SNIPPETS, 'check', '--project', app, '--pin', PIN, '--digest', fnv1a(json), '--rows', json, ...extra)
}
{
  const r = callCheck([
    { i: 0, file: 'src/lib/format.ts', line: 3, snippet: 'export function formatLastSync(d: Date)' },
    { i: 1, file: 'src/lib/format.ts', line: 47, snippet: 'const formatLastSyncFixed = (d: Date) => d.toLocaleString()' },
    { i: 2, file: 'src/lib/onlyOnMain.ts', line: 1, snippet: 'export const brandNewOnMain = true' },
    { i: 3, file: './src/lib/format.ts:3', line: 1, snippet: 'import x from "y"' },
    { i: 4, file: 'src/lib/format.ts', line: 1, snippet: 'export const uncommittedEdit = 1' },
    { i: 5, file: '/abs/path/src/lib/format.ts', line: 1, snippet: 'import x from "y"' },
    { i: 6, file: '../outside.ts', line: 1, snippet: 'export const outsideTheProject' },
  ])
  const by = Object.fromEntries((r.results || []).map((x) => [x.i, x.status]))
  check(r.ok === true && r.pin === PIN, 'check: a well-formed call answers ok:true with the pin it read')
  check(by[0] === 'ok', 'check: a citation that holds at the pin is ok')
  check(by[1] === 'missing', 'check: a snippet that exists only on the main checkout (the F2 false-implemented shape) is MISSING at the pin')
  check(by[2] === 'no-file', 'check: a file that only exists on main is no-file at the pin')
  check(by[3] === 'ok', 'check: "./path:line" is normalized before the lookup')
  check(by[4] === 'missing', 'check: an UNCOMMITTED edit does not count — only the committed tree at the pin does')
  check(by[5] === 'no-file' && by[6] === 'no-file', 'check: an absolute or parent-escaping path can never name a file of the pin')
  check(Object.keys(r).at(-1) === 'sum', 'check: the line is sealed (sum last)')
  check(verifySealedLine(JSON.stringify(r)).ok, 'check: the seal verifies')
}
{
  const rows = [{ i: 0, file: 'src/lib/format.ts', line: 3, snippet: 'export function formatLastSync(d: Date)' }]
  const json = JSON.stringify(rows)
  const damaged = run(SNIPPETS, 'check', '--project', app, '--pin', PIN, '--digest', fnv1a(json), '--rows', json.replace('formatLastSync', 'formatLastSynk'))
  check(damaged.ok === false && /did not arrive intact/.test(damaged.error), 'check: rows damaged in the relay (digest mismatch) are refused, never checked')
  check(run(SNIPPETS, 'check', '--project', app, '--pin', 'deadbeef', '--digest', fnv1a(json), '--rows', json).ok === false, 'check: a pin that is not a commit is refused')
  check(run(SNIPPETS, 'check', '--project', app, '--pin', 'HEAD', '--digest', fnv1a(json), '--rows', json).ok === false, 'check: only a hex sha is accepted as the pin')
  check(run(SNIPPETS, 'check', '--project', 'relative/dir', '--pin', PIN, '--digest', fnv1a(json), '--rows', json).ok === false, 'check: --project must be absolute')
  const empty = '[]'
  check(run(SNIPPETS, 'check', '--project', app, '--pin', PIN, '--digest', fnv1a(empty), '--rows', empty).ok === false, 'check: an empty rows array is refused')

}

rmSync(tmp, { recursive: true, force: true })
console.log(`\nRESULT: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
