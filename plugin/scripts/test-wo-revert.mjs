#!/usr/bin/env node
// test-wo-revert.mjs — BL-0212: git-fixture tests of wo-revert.mjs, the deterministic discard of a rejected
// work order's OWN commits. Every scenario builds a real repository with the project NESTED under `proj/`
// (the Mission Control shape, BL-0202), replays the engine's commit sequence (build commit that flips the
// work order to IN_REVIEW, sibling landings, the last_green_sha publication, the reopen/block flip) and runs
// the real script. The oracle is the resulting tree and HEAD, never the script's own receipt alone.
//
// The scenario that motivated BL-0212 is asserted TWICE: the legacy `git checkout <last_green_sha> -- <files>`
// is shown to be a no-op on the fixture (the defect, reproduced), and the script is shown to discard the code.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifySealedLine } from './drift-seal.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(__dirname, 'wo-revert.mjs')

let passed = 0
let failed = 0
const ok = (cond, msg) => { if (cond) { passed++; console.log(`  ✓ ${msg}`) } else { failed++; console.log(`  ✗ ${msg}`) } }

const LINES = (n, tag = 'l') => Array.from({ length: n }, (_, i) => `${tag}${i + 1}`)
const WO_A = 'docs/frds/frd-01-alpha/work-orders/wo-01-001-alpha.md'
const WO_A2 = 'docs/frds/frd-01-alpha/work-orders/wo-01-002-alpha-two.md'
const WO_B = 'docs/frds/frd-02-beta/work-orders/wo-02-001-beta.md'
const woMd = (id, status) => `---\nid: ${id}\ntype: work-order\nimplementation_status: ${status}\nreopen_count: 0\n---\n# ${id}\n\n## Status Note\nimplementation_status: prose mention, not the field\n`

function mkRepo(sub = 'proj') {
  const root = mkdtempSync(path.join(os.tmpdir(), 'wo-revert-'))
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`)
    return r.stdout.trim()
  }
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 't@example.com')
  git('config', 'user.name', 'T')
  git('config', 'commit.gpgsign', 'false')
  const proj = sub ? path.join(root, sub) : root
  const rp = (rel) => (sub ? `${sub}/${rel}` : rel)
  mkdirSync(proj, { recursive: true })
  writeFileSync(path.join(root, 'factory.txt'), 'factory root file\n')
  git('add', 'factory.txt')
  const eventsFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'wo-revert-events-')), 'events.ndjson')
  const write = (rel, content) => { const p = path.join(proj, rel); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, content) }
  const remove = (rel) => { rmSync(path.join(proj, rel), { force: true }) }
  const read = (rel) => (existsSync(path.join(proj, rel)) ? readFileSync(path.join(proj, rel), 'utf8') : null)
  // One engine commit: `files` maps project-relative path → content (null deletes it).
  const commit = (subject, files) => {
    for (const [rel, content] of Object.entries(files)) {
      if (content === null) { remove(rel); git('rm', '-q', '--cached', '--ignore-unmatch', '--', rp(rel)) } else { write(rel, content); git('add', '--', rp(rel)) }
    }
    git('commit', '-q', '--allow-empty', '-m', subject)
    return git('rev-parse', 'HEAD')
  }
  const head = () => git('rev-parse', 'HEAD')
  const publish = (sha) => commit('chore(build): publish last green snapshot', { '.pandacorp/status.yaml': `phase: implementation\nlast_green_sha: ${sha}\nsafe_to_test: true\n` })
  const run = (...args) => {
    const r = spawnSync(process.execPath, [SCRIPT, ...args, '--events', eventsFile], { cwd: root, encoding: 'utf8' })
    const line = (r.stdout || '').trim().split('\n').pop() || ''
    let receipt = null
    try { receipt = JSON.parse(line) } catch { receipt = null }
    return { code: r.status, line, receipt, stderr: r.stderr }
  }
  const events = () => (existsSync(eventsFile) ? readFileSync(eventsFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [])
  const status = () => git('status', '--porcelain')
  // Base tree: two work orders PLANNED, a shared 40-line file, a shared JSON messages file, a pre-existing module.
  commit('chore: init project', {
    '.pandacorp/status.yaml': 'phase: implementation\n',
    [WO_A]: woMd('WO-01-001', 'PLANNED'),
    [WO_A2]: woMd('WO-01-002', 'PLANNED'),
    [WO_B]: woMd('WO-02-001', 'PLANNED'),
    'src/shared.txt': `${LINES(40).join('\n')}\n`,
    'src/messages.json': '{\n  "title": "T"\n}\n',
    'src/existing.ts': 'export const existing = 1\n',
  })
  return { root, proj, git, write, remove, read, commit, head, publish, run, events, status, cleanup: () => { rmSync(root, { recursive: true, force: true }); rmSync(path.dirname(eventsFile), { recursive: true, force: true }) } }
}
const edit = (lines, idx, value) => { const c = [...lines]; c[idx] = value; return `${c.join('\n')}\n` }
const args = (r, ...more) => ['--project', r.proj, '--frd', 'frd-01-alpha', ...more]

// ── (a) the BL-0212 defect: a carry-over WO the pin already contains, reopened ─────────────────────
console.log('(a) carry-over WO inside the pin, reopened → its own commits are reverted')
{
  const r = mkRepo()
  try {
    const base = LINES(40)
    const pre = r.head()
    r.commit('feat(frd-01-alpha): WO-01-001 alpha widget', { 'src/alpha.ts': 'export const alpha = "rejected"\n', 'src/existing.ts': 'export const existing = 2 // alpha\n', 'src/shared.txt': edit(base, 2, 'l3 alpha'), [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    r.commit('feat(frd-02-beta): WO-02-001 beta widget', { 'src/beta.ts': 'export const beta = 1\n', [WO_B]: woMd('WO-02-001', 'IN_REVIEW') })
    const pin = r.commit('test(frd-02-beta): verify WO-02-001 (gate PASS)', { [WO_B]: woMd('WO-02-001', 'VERIFIED') })
    r.publish(pin)
    r.commit('chore(frd-01-alpha): reopen WO-01-001 (gate reject)', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    // The defect, reproduced: the legacy restore to the pin changes nothing (its files AT the pin are the rejected build).
    r.git('checkout', pin, '--', 'proj/src/alpha.ts', 'proj/src/existing.ts')
    ok(r.status() === '', 'legacy `git checkout <last_green_sha> -- <its files>` is a silent no-op on this fixture (the BL-0212 defect)')
    ok(r.read('src/alpha.ts') !== null, 'legacy: the rejected alpha.ts is still on main')
    const before = r.head()
    const plan = r.run('plan', ...args(r, '--wo', 'WO-01-001', '--require-status', 'PLANNED', '--expect-change'))
    ok(plan.code === 0 && plan.receipt && plan.receipt.status === 'reverted' && plan.receipt.changed === true, `plan: status reverted, changed (got ${plan.line.slice(0, 160)})`)
    ok(r.head() === before && r.status() === '', 'plan touches nothing')
    ok(verifySealedLine(plan.line).ok, 'the receipt line carries a valid drift-seal integrity seal')
    const res = r.run('apply', ...args(r, '--wo', 'WO-01-001', '--require-status', 'PLANNED', '--expect-change'))
    ok(res.code === 0 && res.receipt && res.receipt.status === 'reverted' && res.receipt.changed === true && typeof res.receipt.committed === 'string', `apply: reverted and committed (got ${res.line.slice(0, 200)})`)
    ok(r.read('src/alpha.ts') === null, 'the file the WO created is gone')
    ok(r.read('src/existing.ts') === 'export const existing = 1\n', 'the file the WO modified is back to its pre-WO content')
    ok(r.read('src/shared.txt') === `${base.join('\n')}\n`, 'the WO\'s edit of the shared file is undone')
    ok(r.read('src/beta.ts') === 'export const beta = 1\n', 'the VERIFIED sibling FRD\'s file is untouched')
    ok(r.read(WO_A).includes('implementation_status: PLANNED') && r.read(WO_B).includes('implementation_status: VERIFIED'), 'work-order frontmatter is never touched by the revert')
    ok(r.read('.pandacorp/status.yaml').includes(`last_green_sha: ${pin}`), 'status.yaml (controller-owned) is never touched')
    ok(r.status() === '', 'the revert is committed, the tree is clean')
    const subject = r.git('log', '-1', '--format=%s')
    ok(/WO-01-001/.test(subject) && /frd-01-alpha/.test(subject), `the revert commit names the FRD and the work order (${subject})`)
    ok(r.git('diff', '--name-only', 'HEAD~1', 'HEAD').split('\n').every((p) => p.startsWith('proj/src/')), 'the revert commit touches only the WO\'s code paths')
    ok(r.git('diff', '--name-only', pre, 'HEAD', '--', 'proj/src').split('\n').filter(Boolean).join(',') === 'proj/src/beta.ts', 'net effect since before the WO: only the verified sibling\'s code remains')
    // Idempotent: a second revert of the same WO finds its net effect already undone.
    const again = r.run('apply', ...args(r, '--wo', 'WO-01-001', '--expect-change'))
    ok(again.code === 0 && again.receipt.status === 'nothing' && again.receipt.changed === false && again.receipt.committed === null, 'a second revert changes nothing and commits nothing')
    ok(r.events().some((e) => e.event === 'RevertNoop' && (e.wos || []).includes('WO-01-001')), 'the no-op of an expected change is announced loudly (RevertNoop event)')
  } finally { r.cleanup() }
}

// ── (b) the same WO BLOCKED (DR-070) — main does not keep the rejected code ──────────────────────
console.log('(b) DR-070 block of a WO the pin contains → its code leaves main')
{
  const r = mkRepo()
  try {
    r.commit('feat(frd-01-alpha): WO-01-001 alpha widget', { 'src/alpha.ts': 'export const alpha = "broken"\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    r.commit('feat(frd-02-beta): WO-02-001 beta widget', { 'src/beta.ts': 'export const beta = 1\n', [WO_B]: woMd('WO-02-001', 'IN_REVIEW') })
    const pin = r.commit('test(frd-02-beta): verify WO-02-001', { [WO_B]: woMd('WO-02-001', 'VERIFIED') })
    r.publish(pin)
    // A requireStatus BLOCKED run BEFORE the flip refuses and touches nothing (the flip must land first, WS-D/D12).
    const early = r.run('apply', ...args(r, '--wo', 'WO-01-001', '--require-status', 'BLOCKED'))
    ok(early.code === 4 && early.receipt.status === 'refused' && r.read('src/alpha.ts') !== null, 'require-status refuses while the WO is still IN_REVIEW, and touches nothing')
    r.commit('chore(frd-01-alpha): block WO-01-001 needs-owner', { [WO_A]: woMd('WO-01-001', 'BLOCKED') })
    const res = r.run('apply', ...args(r, '--wo', 'WO-01-001', '--require-status', 'BLOCKED', '--expect-change'))
    ok(res.code === 0 && res.receipt.status === 'reverted', `apply reverted (got ${res.line.slice(0, 160)})`)
    ok(r.read('src/alpha.ts') === null && r.git('ls-tree', '-r', '--name-only', 'HEAD', '--', 'proj/src/alpha.ts') === '', 'the blocked WO\'s broken file is gone from main (HEAD tree)')
    ok(r.read('src/beta.ts') !== null, 'the verified sibling is untouched')
    // only-status filters instead of refusing (the attemptRepair path: revert only the WOs the repair BLOCKED).
    const r2 = mkRepo()
    try {
      r2.commit('feat(frd-01-alpha): WO-01-001 alpha', { 'src/alpha.ts': 'a\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
      r2.commit('feat(frd-01-alpha): WO-01-002 alpha two', { 'src/alpha2.ts': 'b\n', [WO_A2]: woMd('WO-01-002', 'IN_REVIEW') })
      r2.commit('chore(frd-01-alpha): block WO-01-002', { [WO_A2]: woMd('WO-01-002', 'BLOCKED') })
      const f = r2.run('apply', ...args(r2, '--wo', 'WO-01-001', '--wo', 'WO-01-002', '--only-status', 'BLOCKED'))
      ok(f.code === 0 && f.receipt.status === 'reverted', 'only-status: reverts the BLOCKED one')
      ok(r2.read('src/alpha2.ts') === null && r2.read('src/alpha.ts') === 'a\n', 'only-status: the BLOCKED WO\'s code is discarded, the IN_REVIEW one is kept')
    } finally { r2.cleanup() }
  } finally { r.cleanup() }
}

// ── (c) a shared file with a LATER verified edit (no overlap) → the verified edit survives ─────────
console.log('(c) shared file, later VERIFIED sibling edit that does not overlap → preserved')
{
  const r = mkRepo()
  try {
    const base = LINES(40)
    r.commit('feat(frd-01-alpha): WO-01-001 alpha', { 'src/shared.txt': edit(base, 2, 'l3 alpha'), 'src/alpha.ts': 'x\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    const afterA = edit(base, 2, 'l3 alpha').split('\n').slice(0, -1)
    r.commit('feat(frd-02-beta): WO-02-001 beta', { 'src/shared.txt': edit(afterA, 35, 'l36 beta'), [WO_B]: woMd('WO-02-001', 'IN_REVIEW') })
    const pin = r.commit('test(frd-02-beta): verify WO-02-001', { [WO_B]: woMd('WO-02-001', 'VERIFIED') })
    r.publish(pin)
    r.commit('chore(frd-01-alpha): reopen WO-01-001', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    const res = r.run('apply', ...args(r, '--wo', 'WO-01-001', '--require-status', 'PLANNED', '--expect-change'))
    ok(res.code === 0 && res.receipt.status === 'reverted', `reverted (got ${res.line.slice(0, 160)})`)
    ok(r.read('src/shared.txt') === edit(base, 35, 'l36 beta'), 'shared.txt keeps the verified beta edit and loses only the alpha edit')
    ok((res.receipt.files || []).some((f) => f.path === 'src/shared.txt' && f.action === 'merge'), 'the shared file is reported as a 3-way merge, not a restore')
  } finally { r.cleanup() }
}

// ── (d) a revert conflict → nothing is reverted, loud refusal ────────────────────────────────────
console.log('(d) conflicting revert → refused, no partial revert, RevertRefused event')
{
  const r = mkRepo()
  try {
    r.commit('feat(frd-01-alpha): WO-01-001 alpha', { 'src/messages.json': '{\n  "title": "T",\n  "alpha": "A"\n}\n', 'src/alpha.ts': 'x\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    r.commit('feat(frd-02-beta): WO-02-001 beta', { 'src/messages.json': '{\n  "title": "T",\n  "alpha": "A",\n  "beta": "B"\n}\n', [WO_B]: woMd('WO-02-001', 'IN_REVIEW') })
    const pin = r.commit('test(frd-02-beta): verify WO-02-001', { [WO_B]: woMd('WO-02-001', 'VERIFIED') })
    r.publish(pin)
    r.commit('chore(frd-01-alpha): reopen WO-01-001', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    const before = r.head()
    const res = r.run('apply', ...args(r, '--wo', 'WO-01-001', '--require-status', 'PLANNED', '--expect-change'))
    ok(res.code === 4 && res.receipt && res.receipt.status === 'conflict', `refused as a conflict (got ${res.line.slice(0, 200)})`)
    ok((res.receipt.conflicts || []).includes('src/messages.json'), 'the receipt names the conflicting file')
    ok(r.head() === before && r.status() === '', 'NOTHING was reverted — not even the conflict-free alpha.ts (no partial revert)')
    ok(r.read('src/alpha.ts') === 'x\n', 'the non-conflicting file is untouched too')
    ok(r.events().some((e) => e.event === 'RevertRefused' && e.status === 'conflict'), 'a RevertRefused event is emitted')
    const plan = r.run('plan', ...args(r, '--wo', 'WO-01-001'))
    ok(plan.code === 4 && plan.receipt.status === 'conflict', 'plan predicts the same refusal')
  } finally { r.cleanup() }
}

// ── (e) the pin does NOT contain the WO → today's behaviour (restore to the pin) ──────────────────
console.log('(e) pin without the WO → files restored to the pin, exactly as before')
{
  const r = mkRepo()
  try {
    const pin = r.head()
    r.publish(pin)
    r.commit('feat(frd-02-beta): WO-02-001 beta (in review)', { 'src/shared.txt': edit(LINES(40), 20, 'l21 beta-unverified'), [WO_B]: woMd('WO-02-001', 'IN_REVIEW') })
    r.commit('feat(frd-01-alpha): WO-01-001 alpha', { 'src/alpha.ts': 'x\n', 'src/existing.ts': 'export const existing = 9\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    r.commit('chore(frd-01-alpha): reopen WO-01-001', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    const res = r.run('apply', ...args(r, '--wo', 'WO-01-001', '--require-status', 'PLANNED', '--expect-change'))
    ok(res.code === 0 && res.receipt.status === 'reverted', `reverted (got ${res.line.slice(0, 160)})`)
    ok((res.receipt.files || []).every((f) => f.via === 'pin'), 'every file goes through the legacy pin restore')
    ok(r.read('src/alpha.ts') === null && r.read('src/existing.ts') === 'export const existing = 1\n', 'the WO\'s files equal their content at the pin')
    ok(r.read('src/shared.txt') === edit(LINES(40), 20, 'l21 beta-unverified'), 'a file the WO never touched is left alone')
  } finally { r.cleanup() }
}

// ── (f) the WO's whole cycle: FRD-level patch commit + a prior seam revert + the rebuild ──────────
console.log('(f) the whole cycle — patch commit, seam revert, rebuild — is undone as one')
{
  const r = mkRepo()
  try {
    r.commit('feat(frd-01-alpha): WO-01-001 alpha', { 'src/alpha.ts': 'v1\n', 'src/seam.ts': 's1\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    r.commit('feat(frd-02-beta): WO-02-001 beta', { 'src/beta.ts': 'b\n', [WO_B]: woMd('WO-02-001', 'IN_REVIEW') })
    const pin = r.commit('test(frd-02-beta): verify WO-02-001', { [WO_B]: woMd('WO-02-001', 'VERIFIED') })
    r.publish(pin)
    r.commit('fix(frd-01-alpha): patch gate findings', { 'src/alpha.ts': 'v1 patched\n', 'src/helper.ts': 'h\n' })
    // A sibling build that merely MENTIONS the WO id (a dependency) must never be attributed to it.
    r.commit('feat(frd-02-beta): WO-02-002 depends on WO-01-001', { 'src/beta2.ts': 'b2\n', 'docs/frds/frd-02-beta/work-orders/wo-02-002-beta-two.md': woMd('WO-02-002', 'IN_REVIEW') })
    r.commit('chore(frd-01-alpha): reopen WO-01-001 (seam)', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    const seam = r.run('apply', ...args(r, '--wo', 'WO-01-001', '--seam', 'src/seam.ts', '--require-status', 'PLANNED', '--expect-change'))
    ok(seam.code === 0 && seam.receipt.status === 'reverted', `seam revert ran (got ${seam.line.slice(0, 160)})`)
    ok(r.read('src/seam.ts') === null && r.read('src/alpha.ts') === 'v1 patched\n', 'the seam revert discards ONLY the seam file')
    r.commit('feat(frd-01-alpha): WO-01-001 alpha retry', { 'src/seam.ts': 's2\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    r.commit('chore(frd-01-alpha): reopen WO-01-001', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    const full = r.run('apply', ...args(r, '--wo', 'WO-01-001', '--require-status', 'PLANNED', '--expect-change'))
    ok(full.code === 0 && full.receipt.status === 'reverted', `full revert ran (got ${full.line.slice(0, 200)})`)
    ok(r.read('src/alpha.ts') === null && r.read('src/seam.ts') === null && r.read('src/helper.ts') === null, 'build, FRD-level patch and rebuild are all undone')
    ok(r.read('src/beta.ts') === 'b\n' && r.read('src/beta2.ts') === 'b2\n', 'sibling code (incl. the build that only mentions the WO id) is untouched')
  } finally { r.cleanup() }
}

// ── a FLAT project (empty prefix): the same discard, every path at the repository root ───────────
console.log('flat project (repository root)')
{
  const r = mkRepo('')
  try {
    r.commit('feat(frd-01-alpha): WO-01-001 alpha', { 'src/alpha.ts': 'x\n', 'src/existing.ts': 'export const existing = 5\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    r.commit('feat(frd-02-beta): WO-02-001 beta', { 'src/beta.ts': 'b\n', [WO_B]: woMd('WO-02-001', 'IN_REVIEW') })
    const pin = r.commit('test(frd-02-beta): verify WO-02-001', { [WO_B]: woMd('WO-02-001', 'VERIFIED') })
    r.publish(pin)
    r.commit('chore(frd-01-alpha): reopen WO-01-001', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    const res = r.run('apply', ...args(r, '--wo', 'WO-01-001', '--require-status', 'PLANNED', '--expect-change'))
    ok(res.code === 0 && res.receipt.status === 'reverted', `flat: reverted (got ${res.line.slice(0, 160)})`)
    ok(r.read('src/alpha.ts') === null && r.read('src/existing.ts') === 'export const existing = 1\n' && r.read('src/beta.ts') === 'b\n', 'flat: the WO\'s code is discarded, the sibling\'s kept')
    ok(r.read('factory.txt') === 'factory root file\n' && r.status() === '', 'flat: nothing else touched, tree clean')
  } finally { r.cleanup() }
}

// ── fail-closed inputs ────────────────────────────────────────────────────────────────────────────
console.log('fail-closed inputs')
{
  const r = mkRepo()
  try {
    r.commit('feat(frd-01-alpha): WO-01-001 alpha', { 'src/alpha.ts': 'x\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    r.commit('chore(frd-01-alpha): reopen WO-01-001', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    r.write('src/alpha.ts', 'uncommitted edit\n')
    const dirty = r.run('apply', ...args(r, '--wo', 'WO-01-001'))
    ok(dirty.code === 4 && dirty.receipt.status === 'dirty' && r.read('src/alpha.ts') === 'uncommitted edit\n', 'an uncommitted change on a target path refuses and is left intact')
    r.git('checkout', '--', 'proj/src/alpha.ts')
    const unknown = r.run('apply', ...args(r, '--wo', 'WO-09-999'))
    ok(unknown.code === 2 && unknown.receipt && unknown.receipt.ok === false, 'an unknown work order is an input error (exit 2), never a quiet success')
    const noWo = r.run('apply', ...args(r))
    ok(noWo.code === 2, 'no --wo at all is an input error')
    const nothing = mkRepo()
    try {
      const n = nothing.run('apply', ...args(nothing, '--wo', 'WO-01-001'))
      ok(n.code === 0 && n.receipt.status === 'nothing' && n.receipt.changed === false, 'a WO that never reached IN_REVIEW has nothing to revert')
      ok(!nothing.events().some((e) => e.event === 'RevertNoop'), 'without --expect-change a no-op is not an alarm')
    } finally { nothing.cleanup() }
    // --out stores the sealed line; replay prints it back verbatim.
    const out = '.pandacorp/run/wo-revert/frd-01-alpha-1.json'
    const p = r.run('plan', ...args(r, '--wo', 'WO-01-001', '--out', out))
    const rpl = r.run('replay', '--project', r.proj, '--file', out)
    ok(rpl.code === 0 && rpl.line === p.line, 'replay prints the stored sealed line verbatim')
  } finally { r.cleanup() }
}

console.log(`\nRESULT: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
