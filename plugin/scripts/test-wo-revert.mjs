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

// ── red-team (2026-09-30): the hostile shapes of a real history ──────────────────────────────────
console.log('(g) the WO RENAMED a pre-existing file → the old name comes back, not only the new one goes (nested and flat)')
for (const sub of ['proj', '']) {
  const r = mkRepo(sub)
  const at = (rel) => (sub ? `${sub}/${rel}` : rel)
  try {
    r.git('mv', at('src/existing.ts'), at('src/renamed.ts'))
    r.write(WO_A, woMd('WO-01-001', 'IN_REVIEW')); r.git('add', '--', at(WO_A))
    r.git('commit', '-q', '-m', 'feat(frd-01-alpha): WO-01-001 rename existing')
    r.commit('chore(frd-01-alpha): reopen WO-01-001', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    const res = r.run('apply', ...args(r, '--wo', 'WO-01-001', '--require-status', 'PLANNED', '--expect-change'))
    ok(res.code === 0 && res.receipt.status === 'reverted', `${sub || 'flat'}: reverted (got ${res.line.slice(0, 160)})`)
    ok(r.read('src/existing.ts') === 'export const existing = 1\n', `${sub || 'flat'}: the renamed-away pre-existing file is restored (a rename-blind log lost it)`)
    ok(r.read('src/renamed.ts') === null && r.status() === '', `${sub || 'flat'}: the new name is gone, tree clean`)
  } finally { r.cleanup() }
}

console.log('(h) a MIXED commit (the WO and another FRD\'s WO built in one commit) → refused, the verified sibling\'s code survives')
{
  const r = mkRepo()
  try {
    r.commit('feat: build wave WO-01-001 + WO-02-001', { 'src/alpha.ts': 'a\n', 'src/beta.ts': 'b\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW'), [WO_B]: woMd('WO-02-001', 'IN_REVIEW') })
    const pin = r.commit('test(frd-02-beta): verify WO-02-001', { [WO_B]: woMd('WO-02-001', 'VERIFIED') })
    r.publish(pin)
    r.commit('chore(frd-01-alpha): reopen WO-01-001', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    const before = r.head()
    const res = r.run('apply', ...args(r, '--wo', 'WO-01-001', '--require-status', 'PLANNED', '--expect-change'))
    ok(res.code === 4 && res.receipt.status === 'refused' && /mixed commit/.test(res.receipt.reason) && /wo-02-001/.test(res.receipt.reason), `refused as a mixed commit naming the other WO (got ${res.line.slice(0, 220)})`)
    ok(r.head() === before && r.read('src/beta.ts') === 'b\n' && r.read('src/alpha.ts') === 'a\n', 'nothing reverted: the VERIFIED beta.ts is intact')
    ok(r.events().some((e) => e.event === 'RevertRefused' && e.status === 'refused'), 'RevertRefused event')
    // A multi-WO flip that carries no code (the joint reopen) is NOT mixed.
    const r2 = mkRepo()
    try {
      r2.commit('feat(frd-01-alpha): WO-01-001 alpha', { 'src/alpha.ts': 'a\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
      r2.commit('feat(frd-01-alpha): WO-01-002 alpha two', { 'src/alpha2.ts': 'b\n', [WO_A2]: woMd('WO-01-002', 'IN_REVIEW') })
      r2.commit('chore(frd-01-alpha): reopen WO-01-001, WO-01-002', { [WO_A]: woMd('WO-01-001', 'PLANNED'), [WO_A2]: woMd('WO-01-002', 'PLANNED') })
      const one = r2.run('apply', ...args(r2, '--wo', 'WO-01-001', '--require-status', 'PLANNED'))
      ok(one.code === 0 && one.receipt.status === 'reverted' && r2.read('src/alpha.ts') === null && r2.read('src/alpha2.ts') === 'b\n', `a frontmatter-only joint flip is not mixed (got ${one.line.slice(0, 160)})`)
    } finally { r2.cleanup() }
  } finally { r.cleanup() }
}

console.log('(i) an anonymous FRD-level repair a later PASS of the SAME FRD certified is the sibling\'s work, never the reopened WO\'s')
{
  const r = mkRepo()
  try {
    r.commit('feat(frd-01-alpha): WO-01-001 alpha', { 'src/alpha.ts': 'a\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    r.commit('chore(frd-01-alpha): block WO-01-001', { [WO_A]: woMd('WO-01-001', 'BLOCKED') })
    r.commit('revert(frd-01-alpha): discard the rejected work of WO-01-001 (BL-0212)', { 'src/alpha.ts': null })
    r.commit('feat(frd-01-alpha): WO-01-002 alpha two', { 'src/alpha2.ts': 'two\n', [WO_A2]: woMd('WO-01-002', 'IN_REVIEW') })
    r.commit('fix(frd-01-alpha): repair self-test', { 'src/alpha2.ts': 'two fixed\n' })   // the pre-BL-0212 prompt: no WO named
    const pin = r.commit('test(frd-01-alpha): gate PASS', { [WO_A2]: woMd('WO-01-002', 'VERIFIED') })
    r.publish(pin)
    r.commit('chore(frd-01-alpha): owner unblocks WO-01-001', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    r.commit('feat(frd-01-alpha): WO-01-001 alpha retry', { 'src/alpha.ts': 'a2\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    r.commit('fix(frd-01-alpha): patch gate findings', { 'src/alpha.ts': 'a2 patched\n' })   // uncertified: still the attempt's
    r.commit('chore(frd-01-alpha): reopen WO-01-001', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    const res = r.run('apply', ...args(r, '--wo', 'WO-01-001', '--require-status', 'PLANNED', '--expect-change'))
    ok(res.code === 0 && res.receipt.status === 'reverted', `reverted (got ${res.line.slice(0, 200)})`)
    ok(r.read('src/alpha2.ts') === 'two fixed\n', 'the certified repair of the VERIFIED sibling WO-01-002 survives')
    ok(r.read('src/alpha.ts') === null, 'the reopened WO\'s build and its uncertified patch are discarded')
  } finally { r.cleanup() }
}

console.log('(j) the reopen judge MOVED a preserved test out of the tree (DR-107) → not a dirty refusal')
{
  const r = mkRepo()
  try {
    r.commit('feat(frd-01-alpha): WO-01-001 alpha', { 'src/alpha.ts': 'a\n', 'src/_tests/alpha.test.ts': 't\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    r.publish(r.head())
    r.commit('chore(frd-01-alpha): reopen WO-01-001', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    r.remove('src/_tests/alpha.test.ts')   // moved to the gitignored .pandacorp/run/preserved-tests/, the flip committed alone
    const res = r.run('apply', ...args(r, '--wo', 'WO-01-001', '--require-status', 'PLANNED', '--expect-change'))
    ok(res.code === 0 && res.receipt.status === 'reverted', `a target already in its reverted state is not dirty (got ${res.line.slice(0, 200)})`)
    ok(r.read('src/alpha.ts') === null && r.status() === '' && r.git('ls-tree', '-r', '--name-only', 'HEAD', '--', 'proj/src/_tests') === '', 'code discarded, the moved test\'s deletion committed, tree clean')
    // Any OTHER uncommitted content on a target is still a refusal.
    const r2 = mkRepo()
    try {
      r2.commit('feat(frd-01-alpha): WO-01-001 alpha', { 'src/alpha.ts': 'a\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
      r2.commit('chore(frd-01-alpha): reopen WO-01-001', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
      r2.write('src/alpha.ts', 'someone else\'s edit\n')
      const d = r2.run('apply', ...args(r2, '--wo', 'WO-01-001'))
      ok(d.code === 4 && d.receipt.status === 'dirty' && r2.read('src/alpha.ts') === 'someone else\'s edit\n', 'a divergent uncommitted edit still refuses and survives')
    } finally { r2.cleanup() }
  } finally { r.cleanup() }
}

console.log('(k) a path git would C-quote (a double quote in the name) is still attributed and reverted')
{
  const r = mkRepo()
  try {
    r.commit('feat(frd-01-alpha): WO-01-001 alpha', { 'src/say "hi".ts': 'q\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    r.commit('chore(frd-01-alpha): reopen WO-01-001', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    const res = r.run('apply', ...args(r, '--wo', 'WO-01-001', '--require-status', 'PLANNED', '--expect-change'))
    ok(res.code === 0 && res.receipt.status === 'reverted' && r.read('src/say "hi".ts') === null && r.status() === '', `quoted path reverted (got ${res.line.slice(0, 200)})`)
  } finally { r.cleanup() }
}

console.log('(l) the pin restore never wipes another FRD\'s IN_REVIEW commit made after the pin on the same shared file')
{
  const r = mkRepo()
  try {
    const base = LINES(40)
    r.publish(r.head())
    r.commit('feat(frd-02-beta): WO-02-001 beta', { 'src/shared.txt': edit(base, 35, 'l36 beta'), [WO_B]: woMd('WO-02-001', 'IN_REVIEW') })
    const afterB = edit(base, 35, 'l36 beta').split('\n').slice(0, -1)
    r.commit('feat(frd-01-alpha): WO-01-001 alpha', { 'src/shared.txt': edit(afterB, 2, 'l3 alpha'), 'src/alpha.ts': 'a\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    r.commit('chore(frd-01-alpha): reopen WO-01-001', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    const res = r.run('apply', ...args(r, '--wo', 'WO-01-001', '--require-status', 'PLANNED', '--expect-change'))
    ok(res.code === 0 && res.receipt.status === 'reverted', `reverted (got ${res.line.slice(0, 160)})`)
    ok(r.read('src/shared.txt') === edit(base, 35, 'l36 beta'), 'beta\'s IN_REVIEW edit after the pin survives; only alpha\'s line is undone')
    const f = Object.fromEntries((res.receipt.files || []).map((x) => [x.path, x.via]))
    ok(f['src/shared.txt'] === 'revert' && f['src/alpha.ts'] === 'pin', `a file another commit touched since the pin takes the revert path; one only the attempt touched keeps the pin restore (got ${JSON.stringify(f)})`)
  } finally { r.cleanup() }
}

// ── (m…q) BL-0215: a run cut between the state flip and the discard ─────────────────────────────────
// The engine records the INTENT (plan --record-intent) before the flip; the marker survives a cut and `recover` finishes
// the discard at the next run start — only for work orders still in the recorded status, with the recorded seam.
const MARKER = '.pandacorp/run/wo-revert/pending-frd-01-alpha.json'
const planIntent = (r, status, ...more) => r.run('plan', ...args(r, '--wo', 'WO-01-001', '--record-intent', status, ...more))
const recoverRun = (r) => r.run('recover', ...args(r))

console.log('(m) cut between the PLANNED flip and the apply → recover discards the rejected code; idempotent')
{
  const r = mkRepo()
  try {
    r.commit('feat(frd-01-alpha): WO-01-001 alpha widget', { 'src/alpha.ts': 'export const alpha = "rejected"\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    const pin = r.commit('feat(frd-02-beta): WO-02-001 beta widget', { 'src/beta.ts': 'export const beta = 1\n', [WO_B]: woMd('WO-02-001', 'IN_REVIEW') })
    r.publish(pin)
    const plan = planIntent(r, 'PLANNED')
    ok(plan.code === 0 && plan.receipt.status === 'reverted' && r.read(MARKER) !== null, 'plan --record-intent writes the pending marker when there is an attempt to discard')
    ok(r.git('status', '--porcelain', '--', 'proj/src', 'proj/docs').trim() === '', 'recording the intent touches no tracked code')
    r.commit('chore(frd-01-alpha): reopen WO-01-001 (gate reject)', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    // …the run is cut here: no apply. The next run starts:
    const before = r.head()
    const rec = recoverRun(r)
    ok(rec.code === 0 && rec.receipt && rec.receipt.status === 'reverted' && rec.receipt.recovery === 'recovered' && rec.receipt.changed === true && typeof rec.receipt.committed === 'string', `recover discards the rejected code (got ${rec.line.slice(0, 220)})`)
    ok(verifySealedLine(rec.line).ok, 'the recover receipt carries a valid integrity seal')
    ok(r.read('src/alpha.ts') === null && r.read('src/beta.ts') === 'export const beta = 1\n', 'the rejected file is gone, the sibling FRD\'s file is untouched')
    ok(r.head() !== before && /WO-01-001/.test(r.git('log', '-1', '--format=%s')) && /BL-0215/.test(r.git('log', '-1', '--format=%s')), 'one commit naming the work order and saying it is a recovery')
    ok(r.read(MARKER) === null, 'the marker is consumed')
    ok(r.events().some((e) => e.event === 'RevertRecovered' && (e.wos || []).includes('WO-01-001')), 'a RevertRecovered event is emitted (the recovery is never silent)')
    const again = recoverRun(r)
    ok(again.code === 0 && again.receipt.status === 'nothing' && again.receipt.recovery === 'none' && r.head() !== before && r.git('rev-list', '--count', `${before}..HEAD`) === '1', 'a second recover finds nothing and commits nothing')
    const late = r.run('apply', ...args(r, '--wo', 'WO-01-001'))
    ok(late.code === 0 && late.receipt.status === 'nothing', 'a plain apply afterwards finds the attempt already undone')
  } finally { r.cleanup() }
}

console.log('(n) cut BEFORE the flip (the work order is still IN_REVIEW) → the marker is stale, nothing is discarded')
{
  const r = mkRepo()
  try {
    r.commit('feat(frd-01-alpha): WO-01-001 alpha widget', { 'src/alpha.ts': 'export const alpha = "built"\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    planIntent(r, 'PLANNED')
    const before = r.head()
    const rec = recoverRun(r)
    ok(rec.code === 0 && rec.receipt.recovery === 'stale' && rec.receipt.changed === false && r.head() === before && r.read('src/alpha.ts') !== null, `a work order still IN_REVIEW is never discarded (got ${rec.line.slice(0, 200)})`)
    ok(r.read(MARKER) === null, 'the stale marker is consumed')
  } finally { r.cleanup() }
}

console.log('(o) the owner moved the BLOCKED work order on (unblocked → PLANNED, code kept on purpose) → stale, never discarded')
{
  const r = mkRepo()
  try {
    r.commit('feat(frd-01-alpha): WO-01-001 alpha widget', { 'src/alpha.ts': 'export const alpha = "kept by the owner"\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    planIntent(r, 'BLOCKED')
    r.commit('chore(frd-01-alpha): block WO-01-001 needs-owner', { [WO_A]: woMd('WO-01-001', 'BLOCKED') })
    r.commit('chore(frd-01-alpha): owner decision — keep the code, fix forward', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    const before = r.head()
    const rec = recoverRun(r)
    ok(rec.code === 0 && rec.receipt.recovery === 'stale' && r.head() === before && r.read('src/alpha.ts') !== null, `code the owner chose to keep survives (got ${rec.line.slice(0, 200)})`)
  } finally { r.cleanup() }
}

console.log('(p) a PARTIAL (seam) discard that was cut is recovered with the SAME seam, not the whole attempt')
{
  const r = mkRepo()
  try {
    r.commit('feat(frd-01-alpha): WO-01-001 alpha widget', { 'src/alpha.ts': 'export const alpha = "bad seam"\n', 'src/alphaGood.ts': 'export const good = 1\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    planIntent(r, 'PLANNED', '--seam', 'src/alpha.ts')
    r.commit('chore(frd-01-alpha): reopen WO-01-001 (seam)', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    const rec = recoverRun(r)
    ok(rec.code === 0 && rec.receipt.recovery === 'recovered', `recovered (got ${rec.line.slice(0, 200)})`)
    ok(r.read('src/alpha.ts') === null && r.read('src/alphaGood.ts') === 'export const good = 1\n', 'only the seam file is discarded; the good work the diagnosis preserved stays')
  } finally { r.cleanup() }
}

console.log('(q) the normal two-step discard consumes the marker; a refusal is reported once; nothing to revert records no intent')
{
  const r = mkRepo()
  try {
    r.commit('feat(frd-01-alpha): WO-01-001 alpha widget', { 'src/alpha.ts': 'export const alpha = "rejected"\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    planIntent(r, 'PLANNED')
    r.commit('chore(frd-01-alpha): reopen WO-01-001', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
    r.run('apply', ...args(r, '--wo', 'WO-01-001', '--require-status', 'PLANNED', '--expect-change'))
    ok(r.read(MARKER) === null && recoverRun(r).receipt.recovery === 'none', 'an apply consumes the marker: the next run start has nothing to recover')
    const empty = mkRepo()
    try {
      const n = planIntent(empty, 'PLANNED')
      ok(n.code === 0 && n.receipt.status === 'nothing' && empty.read(MARKER) === null, 'no attempt to discard → no intent recorded')
    } finally { empty.cleanup() }
    // A conflict at recovery time refuses (exit 4), consumes the marker and discards nothing.
    const c = mkRepo()
    try {
      c.commit('feat(frd-01-alpha): WO-01-001 alpha widget', { 'src/messages.json': '{\n  "title": "T",\n  "alpha": "A"\n}\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
      planIntent(c, 'PLANNED')
      c.commit('chore(frd-01-alpha): reopen WO-01-001', { [WO_A]: woMd('WO-01-001', 'PLANNED') })
      c.commit('feat(frd-02-beta): WO-02-001 edits the same lines', { 'src/messages.json': '{\n  "title": "T",\n  "alpha": "B"\n}\n' })
      const before = c.head()
      const rec = recoverRun(c)
      ok(rec.code === 4 && rec.receipt.status === 'conflict' && rec.receipt.recovery === 'refused' && c.head() === before, `a conflicting recovery refuses and writes nothing (got ${rec.line.slice(0, 200)})`)
      ok(c.read(MARKER) === null && c.events().some((e) => e.event === 'RevertRefused'), 'the refusal is reported once (marker consumed, RevertRefused event)')
    } finally { c.cleanup() }
    // An unreadable marker is dropped loudly, never guessed at.
    const m = mkRepo()
    try {
      m.write(MARKER, '{not json')
      const rec = recoverRun(m)
      ok(rec.code === 0 && rec.receipt.recovery === 'dropped' && m.read(MARKER) === null && m.events().some((e) => e.event === 'RevertIntentDropped'), 'an unreadable marker is dropped with an event, never acted on')
    } finally { m.cleanup() }
    ok(planIntent(r, 'OOPS').code === 2, 'an unknown --record-intent status is an input error')
  } finally { r.cleanup() }
}

// ── (r) proposal 39 C6: a USABLE FRD's landed code is never discarded automatically, whatever lane asks ─────────
// Run 1 (fast lane, reviewBudget defer) committed every work order IN_REVIEW and a build_usable line; run 2 is the
// classic lane, which has no precheck of its own: the script itself derives USABLE from the committed line and refuses.
console.log('(r) a durably USABLE FRD (committed build_usable line) → plan and apply refuse, nothing is discarded')
{
  const usableFixture = () => {
    const r = mkRepo()
    r.commit('chore(build): dispatch WO-01-001, WO-01-002 (IN_PROGRESS)', { [WO_A]: woMd('WO-01-001', 'IN_PROGRESS'), [WO_A2]: woMd('WO-01-002', 'IN_PROGRESS') })
    r.commit('feat(frd-01-alpha): WO-01-001 alpha', { 'src/alpha.ts': 'export const alpha = 1\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
    const built = r.commit('feat(frd-01-alpha): WO-01-002 alpha two', { 'src/alpha2.ts': 'export const alpha2 = 1\n', [WO_A2]: woMd('WO-01-002', 'IN_REVIEW') })
    r.commit('chore(build): frd-01-alpha usable', { '.pandacorp/track.jsonl': `${JSON.stringify({ kind: 'build_usable', frd: 'frd-01-alpha', sha: built.slice(0, 12), at: '2026-10-01T00:00:00Z' })}\n` })
    return { r, built }
  }
  {
    const { r, built } = usableFixture()
    try {
      const before = r.head()
      const plan = r.run('plan', ...args(r, '--wo', 'WO-01-001', '--record-intent', 'PLANNED'))
      ok(plan.code === 4 && plan.receipt && plan.receipt.status === 'usable' && plan.receipt.changed === false && verifySealedLine(plan.line).ok, `plan refuses a USABLE FRD (exit 4, status usable; got ${plan.code} ${plan.line.slice(0, 200)})`)
      ok(new RegExp(built.slice(0, 12)).test(plan.receipt.reason || '') && /owner/i.test(plan.receipt.reason || ''), 'the reason names the certified sha and the owner\'s call')
      ok(r.read('.pandacorp/run/wo-revert/pending-frd-01-alpha.json') === null, 'no discard intent is recorded for it')
      ok(r.events().some((e) => e.event === 'RevertRefused' && e.status === 'usable'), 'a RevertRefused event names the reason')
      r.commit('chore(frd-01-alpha): repair gave up, WO-01-001 BLOCKED', { [WO_A]: woMd('WO-01-001', 'BLOCKED') })
      const apply = r.run('apply', ...args(r, '--wo', 'WO-01-001', '--only-status', 'BLOCKED'))
      ok(apply.code === 4 && apply.receipt.status === 'usable' && r.read('src/alpha.ts') === 'export const alpha = 1\n', `apply (the repair path's discard) refuses too and the code stays (got ${apply.line.slice(0, 160)})`)
      ok(r.status() === '' && r.git('log', '-1', '--format=%s') === 'chore(frd-01-alpha): repair gave up, WO-01-001 BLOCKED' && r.head() !== before, 'nothing was written or committed by the refusals')
    } finally { r.cleanup() }
  }
  {
    // A rebuild stamped after the certified sha is not USABLE any more: the discard of THAT attempt proceeds as before.
    const { r } = usableFixture()
    try {
      r.commit('chore(build): dispatch WO-01-001 (IN_PROGRESS)', { [WO_A]: woMd('WO-01-001', 'IN_PROGRESS') })
      r.commit('feat(frd-01-alpha): WO-01-001 alpha rebuilt', { 'src/alpha.ts': 'export const alpha = "rebuilt"\n', [WO_A]: woMd('WO-01-001', 'IN_REVIEW') })
      const plan = r.run('plan', ...args(r, '--wo', 'WO-01-001'))
      ok(plan.code === 0 && plan.receipt.status === 'reverted', `a rebuild stamped after the build_usable sha is discardable (got ${plan.line.slice(0, 160)})`)
    } finally { r.cleanup() }
  }
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
