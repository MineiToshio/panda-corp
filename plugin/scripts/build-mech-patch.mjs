// build-mech-patch.mjs — proposal 40 §2 (rows Patch, verify-patch + certify): the patch ladder's independent check and
// its stamp, as scripts. Bench evidence: the verify-patch agent wrote nothing in 4 of 4 runs and the certify agent only
// wrote work-order and status files, so neither judged anything a script cannot decide.
//
//   verify --patch  --frd <folder> --wo <id>… --test <sha256>:<repo-root path>… [--dir <evidence dir>]
//                   the post-patch check. The reviewer-test hash is MANDATORY and checked FIRST (DR-080: a patch may not
//                   edit the tests that judge it; a changed or missing one is red, its original restored from --dir);
//                   then the reviewer's RED-proven tests run by path (vitest; a Playwright spec under e2e/); then the
//                   full verify.sh. It writes and commits nothing: the stamp is certify-state's.
//   certify-state   --frd <folder> --wo <id>… --token T --epoch E [--test <sha256>:<path>]… [--drift <id>]…
//                   the stamp of an accepted check, under the lease fence and the main-writer lock: each work order
//                   VERIFIED with reopen_count 0 (build-state's transition, which re-derives the rollups and the
//                   status.yaml counts), the frd.md `drift:` replica, the verifier's journal resolution and the timeline
//                   lines, then the BL-0066 two commits: the snapshot (A, the reviewer's tests included), then the
//                   last_green_sha pointer (B) naming A. Any failure before (A) restores every file it wrote.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { stampLastGreen, transitionWorkOrder } from '../runtime/build-state.mjs'
import { InputError, JOURNALS, PROJECTION, Refusal, acquireLock, blobAt, dirtyEntries, findWo, fmGet, frontmatterStatus, projectCtx, releaseLock, sealReportProvenance, unique, withdrawLine } from './build-mech-lib.mjs'
import { readReport } from './build-mech-fast.mjs'

const [TRACK, JOURNAL] = JOURNALS
const PLAYWRIGHT_RE = /(^|\/)e2e\/.+\.spec\.[cm]?[jt]sx?$/
const FENCE_CODES = new Set(['FENCE', 'QUIESCED', 'CONTENDED', 'INVALID_STATE', 'INVALID_PATH', 'EVIDENCE'])
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---/

/** The pinned reviewer tests `--test <sha256>:<repo-root path>`; at least one when `required`. */
function pinnedTests(list, required) {
  const out = list.map((x) => {
    const m = /^([0-9a-f]{64}):(.+)$/.exec(String(x))
    if (!m) throw new InputError(`--test must be <sha256>:<repo-root path>, got ${JSON.stringify(x)}`)
    return { sha256: m[1], path: m[2].replace(/^\.\//, '') }
  })
  if (required && !out.length) throw new InputError('verify --patch needs the reviewer\'s RED-proven test hash(es): --test <sha256>:<repo-root path> (DR-080, mandatory)')
  return out
}
const hashOf = (abs) => { try { return lstatSync(abs).isFile() ? createHash('sha256').update(readFileSync(abs)).digest('hex') : null } catch { return null } }
const projRelOf = (ctx, p) => (ctx.prefix && p.startsWith(ctx.prefix) ? p.slice(ctx.prefix.length) : p)

/** Each pinned test whose bytes differ from its pin (or is gone); with `dir`, the original is put back. */
function breachesOf(ctx, pinned, dir) {
  const out = []
  for (const t of pinned) {
    const abs = path.join(ctx.top, t.path)
    const observed = hashOf(abs)
    if (observed === t.sha256) continue
    const src = dir ? path.join(path.resolve(dir), t.path) : null
    const restored = Boolean(src && hashOf(src) === t.sha256)
    if (restored) { mkdirSync(path.dirname(abs), { recursive: true }); copyFileSync(src, abs) }
    out.push({ path: t.path, expected: t.sha256, observed, restored })
  }
  return out
}
/** The tree is clean but for the lease projection, the journals and the ported reviewer tests. */
function assertClean(ctx, pinned) {
  const own = new Set(pinned.map((t) => projRelOf(ctx, t.path)))
  const dirty = dirtyEntries(ctx).filter((e) => e.path !== PROJECTION && !JOURNALS.includes(e.path) && !own.has(e.path)).map((e) => e.path)
  if (dirty.length) throw new Refusal('dirty', `the tree is not clean (${dirty.join(', ')}): a patch is certified only on its committed tree`, { paths: dirty })
}
/** Run the reviewer's tests by absolute path: vitest, or Playwright for an e2e spec. A missing runner certifies nothing. */
function runPinned(ctx, pinned, timeoutMs) {
  const groups = [['vitest', ['run'], pinned.filter((t) => !PLAYWRIGHT_RE.test(t.path))], ['playwright', ['test'], pinned.filter((t) => PLAYWRIGHT_RE.test(t.path))]]
  for (const [bin, verb, tests] of groups.filter((g) => g[2].length)) {
    const exe = path.join(ctx.project, 'node_modules', '.bin', bin)
    if (!existsSync(exe)) throw new Refusal('no-test-runner', `node_modules/.bin/${bin} is absent: the reviewer's tests cannot run, so nothing is certified`)
    const r = spawnSync(exe, [...verb, ...tests.map((t) => path.join(ctx.top, t.path))], { cwd: ctx.project, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 })
    if (r.status !== 0) {
      const tail = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-4).join(' | ')
      return `the reviewer's RED-proven test(s) still fail (${tests.map((t) => t.path).join(', ')}): ${bin} exit ${r.status}${tail ? `: ${tail.slice(0, 400)}` : ''}`
    }
  }
  return ''
}
function assertInReview(ctx, wos) {
  const notIn = wos.filter((w) => frontmatterStatus(blobAt(ctx, 'HEAD', w.rel)) !== 'IN_REVIEW' || frontmatterStatus(readFileSync(path.join(ctx.project, w.rel), 'utf8')) !== 'IN_REVIEW').map((w) => w.id)
  if (notIn.length) throw new Refusal('not-in-review', `${notIn.join(', ')} not committed IN_REVIEW: nothing to certify`, { wos: notIn })
}

/** `verify --patch` — see the header. */
export function patchVerifyOp(o) {
  if (o.frds.length !== 1 || !o.wos.length) throw new InputError('verify --patch needs exactly one --frd <folder> and its --wo <id>(s)')
  const pinned = pinnedTests(o.tests, true)
  const frd = o.frds[0]
  const ctx = projectCtx(o.project)
  assertClean(ctx, pinned)
  const wos = o.wos.map((id) => findWo(ctx, id))
  const notIn = wos.filter((w) => frontmatterStatus(blobAt(ctx, 'HEAD', w.rel)) !== 'IN_REVIEW').map((w) => w.id)
  if (notIn.length) throw new Refusal('uncommitted', `${notIn.join(', ')} not committed IN_REVIEW at HEAD: nothing to verify`, { wos: notIn })
  const headFull = ctx.g.must(['rev-parse', 'HEAD']).trim()
  const sha = headFull.slice(0, 12)
  const breach = breachesOf(ctx, pinned, o.dir)
  const tests = pinned.map((t) => ({ path: t.path, ok: !breach.some((b) => b.path === t.path) }))
  if (breach.length) return { code: 0, body: { status: 'red', frd, green: false, sha, breach, tests, failure: `DR-080: the reviewer's test file(s) were modified or removed after the gate (${breach.map((b) => `${b.path}: ${b.observed ? 'changed' : 'missing'}`).join('; ')}); a patch may not edit the tests that judge it` } }
  const failing = runPinned(ctx, pinned, o.testTimeoutMs)
  if (failing) return { code: 0, body: { status: 'red', frd, green: false, sha, tests, failure: failing } }
  const r = spawnSync('bash', ['.pandacorp/verify.sh'], { cwd: ctx.project, encoding: 'utf8', timeout: o.verifyTimeoutMs || 45 * 60 * 1000, maxBuffer: 256 * 1024 * 1024 })
  const rep = readReport(ctx, r.status, headFull)
  sealReportProvenance(ctx, 'verify')
  const green = rep.green && rep.scope !== 'partial'
  return { code: 0, body: { status: green ? 'green' : 'red', frd, green, sha, scope: rep.scope, tests, failure: green ? '' : (rep.failure || `report scope ${rep.scope}`), exit: r.status } }
}

/** frd.md's `drift:` replica (BL-0178): set to the proven ids, or removed when there are none. */
function withDrift(text, ids) {
  const m = FM_RE.exec(text)
  if (!m) return text
  const without = m[1].split('\n').filter((l) => !/^drift:/.test(l))
  const fm = ids.length ? [...without, `drift: [${ids.join(', ')}]`] : without
  return `${text.slice(0, m.index)}---\n${fm.join('\n')}\n---${text.slice(m.index + m[0].length)}`
}
function emitEvents(o, rows) {
  const file = o.events || path.join(os.homedir(), '.claude', 'dashboard-events.ndjson')
  const at = new Date().toISOString()
  const project = o.projectName || path.basename(o.project)
  try { mkdirSync(path.dirname(file), { recursive: true }); appendFileSync(file, rows.map((f) => `${JSON.stringify({ event: f.event, at, project, ...f })}\n`).join('')) } catch (e) { process.stderr.write(`pandacorp-build-mech: could not append the certify events (${e.message})\n`) }
}
const fenced = async (fn) => {
  try { return await fn() } catch (e) { if (FENCE_CODES.has(e.code)) throw new Refusal(e.code.toLowerCase(), e.message); throw e }
}

/** `certify-state` — see the header. */
export async function certifyStateOp(o) {
  if (!o.token || o.epoch === undefined) throw new InputError('certify-state needs --token and --epoch (the fenced lease)')
  if (o.frds.length !== 1 || !o.wos.length) throw new InputError('certify-state needs exactly one --frd <folder> and its --wo <id>(s)')
  const pinned = pinnedTests(o.tests, false)
  const frd = o.frds[0]
  const ctx = projectCtx(o.project)
  const wos = o.wos.map((id) => findWo(ctx, id))
  assertInReview(ctx, wos)
  assertClean(ctx, pinned)
  const changed = pinned.filter((t) => hashOf(path.join(ctx.top, t.path)) !== t.sha256).map((t) => t.path)
  if (changed.length) throw new Refusal('reviewer-test-changed', `the reviewer's test(s) differ from the verified bytes (${changed.join(', ')}): never committed (DR-080)`, { paths: changed })
  const abs = (rel) => path.join(ctx.project, rel)
  const frdRel = `docs/frds/${frd}/frd.md`
  const owned = unique([...wos.map((w) => w.rel), frdRel, `docs/frds/${frd}/blueprint.md`, PROJECTION])
  const originals = new Map(owned.map((rel) => [rel, existsSync(abs(rel)) ? readFileSync(abs(rel), 'utf8') : null]))
  const appended = []
  const append = (rel, row) => {
    const line = JSON.stringify(row)
    const existed = existsSync(abs(rel))
    appendFileSync(abs(rel), `${line}\n`)
    appended.push([abs(rel), line, existed])
  }
  const lock = acquireLock(ctx, { waitMs: o.lockWaitMs, op: 'certify-state' })
  let snapshot = null
  try {
    const journal = String(originals.get(JOURNAL) ?? (existsSync(abs(JOURNAL)) ? readFileSync(abs(JOURNAL), 'utf8') : ''))
    const prior = journal.split('\n').map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
    const reopen = new Map(wos.map((w) => [w.id, Number(fmGet(originals.get(w.rel), 'reopen_count')) || 0]))
    for (const w of wos) await fenced(() => transitionWorkOrder(ctx.project, o.token, o.epoch, { file: w.rel, to: 'VERIFIED' }))
    if (originals.get(frdRel) !== null) writeFileSync(abs(frdRel), withDrift(readFileSync(abs(frdRel), 'utf8'), o.drifts))
    const at = new Date().toISOString()
    const main = wos[0]
    append(JOURNAL, { at, wo: main.id, frd, attempt: prior.filter((x) => x.wo === main.id && x.kind === 'attempt').length, reopen_count: reopen.get(main.id), rung: 'verify', role: 'verifier', kind: 'resolution', classification: '', seam: null, findingKey: '', tried: 'patched in place, independently verified', verdict: 'green', why: `the reviewer's ${pinned.length} RED test(s) and the full verify.sh green (scripted verify)`, confidence: 'high' })
    append(TRACK, { kind: 'review_end', frd, verdict: 'pass', at })
    append(TRACK, { kind: 'frd_end', frd, at })
    const ours = new Set([...owned, ...JOURNALS])
    const strays = dirtyEntries(ctx).filter((e) => e.path.startsWith('docs/frds/') && !ours.has(e.path)).map((e) => e.path)
    if (strays.length) throw new Refusal('frds-dirty', `the stamp left ${strays.join(', ')} uncommitted: nothing is committed`, { paths: strays })
    const paths = unique([...owned.filter((rel) => existsSync(abs(rel))), ...JOURNALS.filter((rel) => existsSync(abs(rel)))].map((rel) => `${ctx.prefix}${rel}`).concat(pinned.map((t) => t.path)))
    const gTop = (args) => ctx.g.run(['-C', ctx.top, '--literal-pathspecs', ...args])
    const add = gTop(['add', '-f', '--', ...paths])
    const msg = `chore(build): ${frd} verified, patched in place\n\nThe scripted post-patch verify (proposal 40) checked the reviewer's test hashes, ran them and the full verify.sh; certify-state stamps ${wos.map((w) => w.id).join(', ')} VERIFIED.${pinned.length ? `\n\nReviewer-Tests: ${pinned.map((t) => t.path).join(', ')}` : ''}`
    const c = add.ok ? gTop(['commit', '-q', '-m', msg, '--', ...paths]) : add
    if (!c.ok) { gTop(['reset', '-q', '--', ...paths]); throw new Refusal('commit-failed', `the snapshot commit failed: ${(c.err || 'no output').split('\n').slice(-3).join(' | ')}`) }
    snapshot = ctx.g.must(['rev-parse', 'HEAD']).trim()
  } catch (e) {
    if (!snapshot) {
      for (const [rel, text] of originals) if (text !== null) writeFileSync(abs(rel), text)
      for (const [file, line, existed] of appended.reverse()) withdrawLine(file, line, existed)
    }
    releaseLock(lock)
    throw e
  }
  try {
    await fenced(() => stampLastGreen(ctx.project, o.token, o.epoch, snapshot))
    const p = ctx.g.run(['--literal-pathspecs', 'add', '--', PROJECTION])
    const c = p.ok ? ctx.g.run(['--literal-pathspecs', 'commit', '-q', '-m', 'chore(build): publish last green snapshot', '--', PROJECTION]) : p
    if (!c.ok) throw new Refusal('pointer-failed', `the snapshot ${snapshot.slice(0, 12)} is committed but the last_green_sha pointer commit failed: ${c.err || 'no output'}`, { snapshot: snapshot.slice(0, 12) })
  } catch (e) {
    if (e instanceof Refusal) { e.extra = { snapshot: snapshot.slice(0, 12), ...e.extra }; throw e }
    throw e
  } finally { releaseLock(lock) }
  const pointer = ctx.g.must(['rev-parse', 'HEAD']).trim().slice(0, 12)
  emitEvents(o, [
    { event: 'GateVerdict', frd, verdict: 'pass', passed: wos.length, via: 'patch' },
    { event: 'PatchResult', frd, outcome: 'green' },
    ...wos.map((w) => ({ event: 'achievement', workOrder: w.id, wo: w.id, frd })),
  ])
  return { code: 0, body: { status: 'certified', frd, wos: wos.map((w) => w.id), snapshot: snapshot.slice(0, 12), pointer, tests: pinned.map((t) => t.path), drift: o.drifts } }
}
