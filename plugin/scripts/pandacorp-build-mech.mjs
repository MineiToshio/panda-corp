#!/usr/bin/env node
// pandacorp-build-mech.mjs — proposal 39 §2 C1/C2: the build engine's mechanical steps as deterministic operations.
//
// Why it exists. Every MECH step used to be a haiku agent reading a prose recipe ("stage only this WO's files…",
// "salvage every path git lists, then clean exactly those…") and re-deriving it: ~16 ops ≈ 9 min on the critical
// path of a small build, and a model is not a faithful executor of a git recipe (a blended commit breaks revert
// targeting, BL-0212). Each op here prints ONE sealed JSON line (drift-seal.mjs), so the MECH prompt shrinks to "run
// exactly <cmd>, return its last line" and the engine verifies the seal.
//
// Ops (all take --project <dir>; exit 0 done/nothing · 4 refused · 2 unusable input or a git failure):
//   precheck     [--main-branch main] [--events <f>]   finish interrupted discards (wo-revert recover), then on main
//                salvage ENGINE-owned dirt (WO markdown, the journals) to .pandacorp/run/salvage/ and reset it, then the C7
//                stamp-anchored demotion (an IN_REVIEW with no flip commit after its last IN_PROGRESS stamp → PLANNED,
//                one commit). Owner dirt and the lease projection (.pandacorp/status.yaml) are never touched, only reported.
//   commit-wo    --wo <id> --files <a,b,…> [--file <p>]… [--extra <p> --reason <r>]… [--ac <AC-id>]…
//                [--fixup <id> [--for <id>]] [--main-branch main] [--lock-wait-ms N] [--test-timeout-ms N]
//                [--events <f>] [--project-name <n>]
//                the ONE commit of a built work order (C2): main-writer lock (10-min stale reclaim) → refuse
//                undeclared or another WO's changed paths → refuse schema/migration paths off main → AC-citation
//                floor → related unit tests only (`vitest related --run`) → stamp IN_REVIEW + the track.jsonl wo_end
//                line → one commit naming the WO (extras in a trailer) → assert the tree clean → the wo_commit event. Any failure after the stamp restores it (and
//                undoes the commit), so an IN_REVIEW never exists without its clean commit. `--fixup <id>` commits a
//                fix to an earlier own-FRD WO as its own commit, no stamp.
//   park-wo      --wo <id> [--files <a,b,…>]   move a failed WO's dirty paths to .pandacorp/run/salvage/<id>/<stamp>/
//                and reset them, so the next WO never builds on broken files (journals and other WOs' files kept).
//   dispatch     --wo <id>… [--commit]   stamp IN_PROGRESS in the frontmatter (BL-0002); --commit makes it a commit,
//                the anchor of the stamp-commit window (C7). A VERIFIED/BLOCKED work order is refused.
//   safe-point   [--token T --epoch E] [--targeted]   the probe: renew the lease (fenced), the owner stop receipt
//                (lstat), rethink_pending, ready change cards, needs-owner blocks with an answered decision →
//                `work`. The engine spawns the LLM drain only when `work` is true.
//   reuse-check  [--max-age 900]   BL-0147: may the close-out reuse .pandacorp/run/gate-report.json?
//   gate-prepare --path <wt> --sha <sha> [--port N]   C2: a frozen detached gate worktree at <sha>, bootstrapped.
//   gate-release --path <wt> --dir <evidence-dir>   BL-0182: salvage every dirty path of the gate worktree (+ its
//                gitignored gate report) to <dir>, then clean exactly those paths.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renew } from '../runtime/build-state.mjs'
import { INPUT_EXIT, InputError, JOURNALS, PROJECTION, REFUSED_EXIT, Refusal, WO_FILE_RE, acquireLock, blobAt, dirtyEntries, findWo, fmGet, frontmatterStatus, inReviewWindow, isOnMain, matchesDeclared, projectCtx, releaseLock, salvageAndReset, setFrontmatterStatus, unique, utcStamp, woIdOf } from './build-mech-lib.mjs'
import { sealLine } from './drift-seal.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
// The schema/migration subset of classify-change.mjs's S5 path patterns, verbatim (that script runs on import, so it
// cannot be imported; test-build-mech.mjs fails if a line here stops matching the classifier).
const SCHEMA_PATHS = [
  /(^|\/)prisma\//,
  /\.(sql|prisma)$/i,
  /(^|\/)migrations?\//,
  /(^|\/)drizzle\//,
  /(^|\/)[^/]*(backfill|migrate|migration|reseed|seed-|data-repair)[^/]*\.[jt]sx?$/i,
]
const TEST_FILE_RE = /(^|\/)(_tests|__tests__|tests?|e2e)\/|\.(test|spec)\.[cm]?[jt]sx?$/
const TRACK = JOURNALS[0]
const CODE_FILE_RE = /\.[cm]?[jt]sx?$/
const AC_ID_RE = /\bAC-\d+-\d+\.\d+(?![0-9])/g
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ── argument parsing ───────────────────────────────────────────────────────────────────────────
const FLAGS = new Set(['commit', 'targeted'])
const LISTS = new Set(['file', 'wo', 'ac'])
function parseArgs(argv) {
  const op = argv[0]
  const o = { op, files: [], extras: [], wos: [], acs: [], mainBranch: 'main', lockWaitMs: 120000, testTimeoutMs: 600000, maxAge: 900 }
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i]
    if (!k.startsWith('--')) throw new InputError(`unexpected argument ${JSON.stringify(k)}`)
    const name = k.slice(2)
    if (FLAGS.has(name)) { o[name] = true; continue }
    const v = argv[++i]
    if (v === undefined) throw new InputError(`${k} needs a value`)
    if (name === 'files') o.files.push(...v.split(',').map((s) => s.trim()).filter(Boolean))
    else if (name === 'extra') o.extras.push({ path: v.replace(/^\.\//, ''), reason: null })
    else if (name === 'reason') { const last = o.extras[o.extras.length - 1]; if (!last || last.reason !== null) throw new InputError('--reason must follow its --extra'); last.reason = v.trim() }
    else if (LISTS.has(name)) o[name === 'file' ? 'files' : `${name}s`].push(v)
    else if (['lock-wait-ms', 'test-timeout-ms', 'max-age', 'port', 'epoch'].includes(name)) { const n = Number(v); if (!Number.isInteger(n) || n < 0) throw new InputError(`${k} must be a non-negative integer`); o[name.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = n }
    else if (['project', 'fixup', 'for', 'main-branch', 'events', 'token', 'path', 'sha', 'dir', 'project-name'].includes(name)) o[name.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v
    else throw new InputError(`unknown option ${k}`)
  }
  if (!o.project) throw new InputError('--project is required')
  o.project = path.resolve(o.project)
  if (o.extras.some((x) => !x.reason)) throw new InputError('every --extra needs a --reason (why the WO had to touch an undeclared path)')
  return o
}

// ── commit-wo ──────────────────────────────────────────────────────────────────────────────────
/** The AC ids a work order owns: its "Acceptance criteria" section, else its body before the Status Note. */
function woAcIds(text) {
  const body = String(text).replace(/^---\r?\n[\s\S]*?\r?\n---/, '')
  const sec = /^##[^\n]*acceptance criteria[^\n]*$/im.exec(body)
  let scope = body
  if (sec) { const rest = body.slice(sec.index + sec[0].length); const end = rest.search(/^##\s/m); scope = end < 0 ? rest : rest.slice(0, end) } else { const sn = body.search(/^##\s+Status Note/im); if (sn >= 0) scope = body.slice(0, sn) }
  return unique(scope.match(AC_ID_RE) || [])
}
/** S3 floor: each AC of the WO is cited by at least one test file, unless the WO says `tests: none` with a reason. */
function acCitation(ctx, woText, extraAcs, stagedPaths) {
  if (fmGet(woText, 'tests').toLowerCase() === 'none') {
    const reason = fmGet(woText, 'tests_reason')
    if (!reason) throw new Refusal('tests-none-without-reason', 'the work order says `tests: none` but gives no `tests_reason:` — the AC-citation floor is waived only with a reason')
    return { skipped: true, reason }
  }
  const acs = unique([...woAcIds(woText), ...extraAcs])
  if (!acs.length) return { skipped: false, acs: [], cited: [], note: 'no AC id found in the work order or --ac' }
  const tracked = ctx.g.must(['ls-files', '-z', '--', '.']).split('\0').filter(Boolean)
  const texts = unique([...tracked, ...stagedPaths]).filter((p) => TEST_FILE_RE.test(p)).map((p) => {
    try { return readFileSync(path.join(ctx.project, p), 'utf8') } catch { return '' }
  })
  const cites = (ac) => { const re = new RegExp(`(?<![0-9A-Za-z])${escapeRe(ac)}(?![0-9])`); return texts.some((t) => re.test(t)) }
  const uncited = acs.filter((ac) => !cites(ac))
  if (uncited.length) throw new Refusal('ac-uncited', `no test file cites ${uncited.join(', ')} — each acceptance criterion needs at least one test naming it`, { uncited })
  return { skipped: false, acs, cited: acs }
}
/** Only the unit/component tests related to the staged code (never e2e: that runs once at verify). */
function relatedTests(ctx, paths, timeoutMs) {
  const bin = path.join(ctx.project, 'node_modules', '.bin', 'vitest')
  if (!existsSync(bin)) return { ran: false, ok: true, reason: 'no-vitest: node_modules/.bin/vitest is absent in the project, related tests skipped' }
  const files = paths.filter((p) => CODE_FILE_RE.test(p) && !/^e2e\//.test(p) && existsSync(path.join(ctx.project, p)))
  if (!files.length) return { ran: false, ok: true, reason: 'no-code-files: nothing staged that vitest could relate' }
  const r = spawnSync(bin, ['related', '--run', '--passWithNoTests', ...files], { cwd: ctx.project, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 })
  const tail = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-15).join('\n')
  return { ran: true, ok: r.status === 0, files, exit: r.status, signal: r.signal || null, tail: r.status === 0 ? '' : tail }
}
/** Fire-and-forget dashboard event (the Party panel); a failed append is reported on stderr, never fatal. */
function emitEvent(o, fields) {
  const file = o.events || path.join(os.homedir(), '.claude', 'dashboard-events.ndjson')
  try {
    mkdirSync(path.dirname(file), { recursive: true })
    appendFileSync(file, `${JSON.stringify({ event: fields.event, at: new Date().toISOString(), project: o.projectName || path.basename(o.project), ...fields })}\n`)
  } catch (e) { process.stderr.write(`pandacorp-build-mech: could not append the ${fields.event} event (${e.message})\n`) }
}
function commitMessage(wo, woText, o) {
  const subject = o.fixup ? `fix(${wo.frd}): fixup ${wo.id}${o.for ? ` (found while building ${o.for})` : ''}` : `feat(${wo.frd}): ${wo.id} ${fmGet(woText, 'slug') || 'build'}`
  const trailers = o.extras.map((x) => `Extra-Path: ${x.path} (${x.reason.replace(/\s+/g, ' ')})`)
  return `${subject}\n\n${o.fixup ? `Fix to ${wo.id}'s committed work, its own commit (proposal 39 C2).` : `Work order ${wo.id} committed by commit-wo (proposal 39 C2).`}${trailers.length ? `\n\n${trailers.join('\n')}` : ''}`
}
function commitWo(o) {
  if (o.wos.length + (o.fixup ? 1 : 0) !== 1) throw new InputError('commit-wo needs exactly one of --wo <id> or --fixup <id>')
  const ctx = projectCtx(o.project)
  const wo = findWo(ctx, o.fixup || o.wos[0])
  if (o.fixup && o.for && findWo(ctx, o.for).frd !== wo.frd) throw new Refusal('fixup-cross-frd', `${wo.id} (${wo.frd}) is not in ${o.for}'s FRD: a fixup only repairs an earlier work order of the same FRD`)
  const lock = acquireLock(ctx, { waitMs: o.lockWaitMs, op: 'commit-wo' })
  try {
    const headBefore = ctx.g.must(['rev-parse', 'HEAD']).trim()
    const headStatus = frontmatterStatus(blobAt(ctx, 'HEAD', wo.rel))
    if (o.fixup && !['IN_REVIEW', 'VERIFIED'].includes(headStatus)) throw new Refusal('fixup-target-uncommitted', `${wo.id} is ${headStatus} at HEAD: only a committed work order can take a fixup`)
    if (!o.fixup && ['VERIFIED', 'BLOCKED'].includes(headStatus)) throw new Refusal('wo-state', `${wo.id} is ${headStatus} at HEAD: commit-wo never re-stamps it`)
    const dirty = dirtyEntries(ctx).filter((e) => e.path !== PROJECTION)
    const foreign = dirty.filter((e) => WO_FILE_RE.test(e.path) && e.path !== wo.rel).map((e) => e.path)
    if (foreign.length) throw new Refusal('foreign-wo', `another work order's file changed: ${foreign.join(', ')} — one commit carries one work order's flip`, { paths: foreign })
    const auto = (p) => p === wo.rel || JOURNALS.includes(p)
    const allowed = [...o.files, ...o.extras.map((x) => x.path)]
    const undeclared = dirty.filter((e) => !auto(e.path) && !matchesDeclared(allowed, e.path)).map((e) => e.path)
    if (undeclared.length) throw new Refusal('undeclared', `modified path(s) outside the declared files: ${undeclared.join(', ')} — declare them, pass --extra <path> --reason <why>, or park them`, { paths: undeclared })
    const stage = dirty.map((e) => e.path)
    const schema = stage.filter((p) => SCHEMA_PATHS.some((re) => re.test(p)))
    if (schema.length && !isOnMain(ctx, o.mainBranch)) throw new Refusal('schema-off-main', `schema/migration path(s) ${schema.join(', ')} may only be committed on ${o.mainBranch} (on ${ctx.branch || 'a detached HEAD'}${ctx.linked ? ', a linked worktree' : ''})`, { paths: schema })
    if (!stage.length && (o.fixup || headStatus === 'IN_REVIEW')) return { code: 0, body: { status: 'nothing', wo: wo.id, reason: o.fixup ? 'nothing to commit' : `${wo.id} is already committed IN_REVIEW and the tree is clean` } }
    const woAbs = path.join(ctx.project, wo.rel)
    const original = readFileSync(woAbs, 'utf8')
    const acs = o.fixup ? { skipped: true, reason: 'fixup: the fixed work order passed its floor at its own commit' } : acCitation(ctx, original, o.acs, stage)
    const tests = relatedTests(ctx, stage.filter((p) => !auto(p)), o.testTimeoutMs)
    if (!tests.ok) throw new Refusal('tests-red', `related unit tests failed (exit ${tests.exit}${tests.signal ? `, ${tests.signal}` : ''}) — nothing was stamped or committed`, { tests })
    const trackAbs = path.join(ctx.project, TRACK)
    const trackBefore = existsSync(trackAbs) ? readFileSync(trackAbs) : null
    if (!o.fixup) {
      if (frontmatterStatus(original) !== 'IN_REVIEW') writeFileSync(woAbs, setFrontmatterStatus(original, 'IN_REVIEW'))
      appendFileSync(trackAbs, `${JSON.stringify({ kind: 'wo_end', frd: wo.frd, wo: wo.id, state: 'in_review', at: new Date().toISOString() })}\n`)
    }
    const paths = unique([...stage, ...(o.fixup ? [] : [wo.rel, TRACK])])
    const restore = () => {
      ctx.g.run(['--literal-pathspecs', 'reset', '-q', '--', ...paths])
      writeFileSync(woAbs, original)
      if (trackBefore === null) rmSync(trackAbs, { force: true }); else writeFileSync(trackAbs, trackBefore)
    }
    const add = ctx.g.run(['--literal-pathspecs', 'add', '-A', '--', ...paths])
    const commit = add.ok ? ctx.g.run(['--literal-pathspecs', 'commit', '-q', '-m', commitMessage(wo, original, o), '--', ...paths]) : add
    if (!commit.ok) { restore(); throw new Refusal('commit-failed', `the commit failed and the stamp was restored: ${commit.err.split('\n').slice(-3).join(' | ') || 'no output'}`) }
    const sha = ctx.g.must(['rev-parse', 'HEAD']).trim()
    const after = dirtyEntries(ctx).filter((e) => e.path !== PROJECTION).map((e) => e.path)
    if (after.length) {
      ctx.g.must(['reset', '-q', '--soft', headBefore])
      restore()
      throw new Refusal('dirty-after-commit', `the tree was not clean after the commit (${after.join(', ')}) — the commit was undone and the stamp restored`, { paths: after })
    }
    if (!o.fixup) emitEvent(o, { event: 'wo_commit', frd: wo.frd, wo: wo.id, state: 'IN_REVIEW' })
    return { code: 0, body: { status: 'committed', wo: wo.id, frd: wo.frd, sha: sha.slice(0, 12), fixup: Boolean(o.fixup), paths, codePaths: paths.filter((p) => !auto(p) && p !== TRACK), extras: o.extras, acs, tests, lock: { reclaimed: lock.reclaimed } } }
  } finally { releaseLock(lock) }
}

// ── park-wo ────────────────────────────────────────────────────────────────────────────────────
function parkWo(o) {
  if (o.wos.length !== 1) throw new InputError('park-wo needs exactly one --wo <id>')
  const ctx = projectCtx(o.project)
  const wo = findWo(ctx, o.wos[0])
  const lock = acquireLock(ctx, { waitMs: o.lockWaitMs, op: 'park-wo' })
  try {
    const dirty = dirtyEntries(ctx)
    const keep = (e) => e.path === PROJECTION || JOURNALS.includes(e.path) || (WO_FILE_RE.test(e.path) && e.path !== wo.rel) || (o.files.length > 0 && e.path !== wo.rel && !matchesDeclared(o.files, e.path))
    const target = dirty.filter((e) => !keep(e))
    const dir = `.pandacorp/run/salvage/${wo.id}/${utcStamp()}`
    const parked = salvageAndReset(ctx, target, path.join(ctx.project, dir))
    return { code: 0, body: { status: parked.length ? 'parked' : 'nothing', wo: wo.id, dir: parked.length ? dir : null, parked, kept: dirty.filter(keep).map((e) => e.path) } }
  } finally { releaseLock(lock) }
}

// ── precheck ───────────────────────────────────────────────────────────────────────────────────
function recoverPendingReverts(o) {
  const markers = path.join(o.project, '.pandacorp', 'run', 'wo-revert')
  const frds = (existsSync(markers) ? readdirSync(markers) : []).map((f) => /^pending-(frd-\d+[^/]*)\.json$/i.exec(f)).filter(Boolean).map((m) => m[1]).sort()
  return frds.map((frd) => {
    const args = [path.join(HERE, 'wo-revert.mjs'), 'recover', '--project', o.project, '--frd', frd, ...(o.events ? ['--events', o.events] : []), ...(o.projectName ? ['--project-name', o.projectName] : [])]
    const r = spawnSync(process.execPath, args, { encoding: 'utf8' })
    let receipt = null
    try { receipt = JSON.parse((r.stdout || '').trim().split('\n').pop()) } catch { receipt = null }
    return { frd, exit: r.status, recovery: receipt ? receipt.recovery || null : null, status: receipt ? receipt.status || null : null, committed: receipt ? receipt.committed || null : null, reason: receipt ? receipt.reason || receipt.error || '' : `unreadable wo-revert output: ${String(r.stderr || '').trim().slice(0, 300)}` }
  })
}
/**
 * Proposal 39 §2 C7 — stamp-anchored resume demotion. A work order counts as IN_REVIEW only when HEAD holds a commit
 * flipping it to IN_REVIEW after its last IN_PROGRESS stamp commit (inReviewWindow). Two ways to fail it:
 * - `uncommitted-flip`: the working tree says IN_REVIEW, HEAD does not (a builder stamped, its commit never ran). On
 *   main the salvage step has already reset the file to HEAD (pending → rebuilt); off main it is only reported.
 * - `no-flip-after-stamp`: HEAD says IN_REVIEW but no flip commit follows the last stamp. On main it is set PLANNED
 *   in ONE commit naming the work orders; off main it is only reported. Its code is never touched here.
 * `run_started_at` is never used, so a resume never rebuilds the previous run's committed work.
 */
function demoteUnstamped(ctx, onMain, salvaged, salvageDir) {
  const demoted = []
  const keptInReview = []
  const headStatus = (rel) => frontmatterStatus(blobAt(ctx, 'HEAD', rel))
  for (const s of salvaged.filter((x) => WO_FILE_RE.test(x.path))) {
    let copy = null
    try { copy = readFileSync(path.join(ctx.project, salvageDir, s.path), 'utf8') } catch { copy = null }
    const from = frontmatterStatus(copy)
    const to = headStatus(s.path)
    if (from === 'IN_REVIEW' && to !== 'IN_REVIEW') demoted.push({ wo: woIdOf(s.path, copy), rel: s.path, from, to, why: 'uncommitted-flip', applied: true, committed: false })
  }
  if (!onMain) {
    for (const e of dirtyEntries(ctx).filter((x) => WO_FILE_RE.test(x.path))) {
      const abs = path.join(ctx.project, e.path)
      const text = existsSync(abs) ? readFileSync(abs, 'utf8') : null
      const to = headStatus(e.path)
      if (frontmatterStatus(text) === 'IN_REVIEW' && to !== 'IN_REVIEW') demoted.push({ wo: woIdOf(e.path, text), rel: e.path, from: 'IN_REVIEW', to, why: 'uncommitted-flip', applied: false, committed: false })
    }
  }
  const atHead = ctx.g.must(['ls-tree', '-r', '-z', '--name-only', 'HEAD', '--', 'docs/frds']).split('\0').filter((p) => WO_FILE_RE.test(p))
  const toPlanned = []
  for (const rel of atHead) {
    if (headStatus(rel) !== 'IN_REVIEW') continue
    const id = woIdOf(rel, blobAt(ctx, 'HEAD', rel))
    const w = inReviewWindow(ctx, rel)
    if (w.qualifies) { keptInReview.push(id); continue }
    const entry = { wo: id, rel, from: 'IN_REVIEW', to: 'PLANNED', why: 'no-flip-after-stamp', stamp: w.stamps[0] ? w.stamps[0].slice(0, 12) : null, applied: onMain, committed: false }
    demoted.push(entry)
    if (onMain) toPlanned.push(entry)
  }
  let demotionCommit = null
  if (toPlanned.length) {
    const originals = toPlanned.map((d) => readFileSync(path.join(ctx.project, d.rel), 'utf8'))
    toPlanned.forEach((d, i) => writeFileSync(path.join(ctx.project, d.rel), setFrontmatterStatus(originals[i], 'PLANNED')))
    const paths = toPlanned.map((d) => d.rel)
    const ids = toPlanned.map((d) => d.wo).join(', ')
    const add = ctx.g.run(['--literal-pathspecs', 'add', '--', ...paths])
    const c = add.ok ? ctx.g.run(['--literal-pathspecs', 'commit', '-q', '-m', `chore(build): demote ${ids} to PLANNED (no IN_REVIEW commit after the last IN_PROGRESS stamp)\n\nProposal 39 C7 stamp-anchored resume: the work order is rebuilt.`, '--', ...paths]) : add
    if (!c.ok) {
      ctx.g.run(['--literal-pathspecs', 'reset', '-q', '--', ...paths])
      toPlanned.forEach((d, i) => writeFileSync(path.join(ctx.project, d.rel), originals[i]))
      throw new Refusal('commit-failed', `the demotion commit failed and the work orders were restored: ${c.err || 'no output'}`)
    }
    demotionCommit = ctx.g.must(['rev-parse', 'HEAD']).trim().slice(0, 12)
    toPlanned.forEach((d) => { d.committed = true })
  }
  return { demoted, keptInReview, demotionCommit }
}
function precheck(o) {
  const ctx = projectCtx(o.project)
  const lock = acquireLock(ctx, { waitMs: o.lockWaitMs, op: 'precheck' })
  try {
    const reverts = recoverPendingReverts(o)
    const onMain = isOnMain(ctx, o.mainBranch)
    const dirty = dirtyEntries(ctx).filter((e) => e.path !== PROJECTION)
    const engineOwned = (e) => e.code !== '??' && (WO_FILE_RE.test(e.path) || JOURNALS.includes(e.path))
    const salvageDir = `.pandacorp/run/salvage/precheck/${utcStamp()}`
    const salvaged = onMain ? salvageAndReset(ctx, dirty.filter(engineOwned), path.join(ctx.project, salvageDir)) : []
    const demotion = demoteUnstamped(ctx, onMain, salvaged, salvageDir)
    const refused = reverts.filter((r) => r.exit !== 0).map((r) => r.frd)
    return { code: 0, body: { status: refused.length ? 'attention' : 'ok', head: ctx.g.must(['rev-parse', 'HEAD']).trim().slice(0, 12), branch: ctx.branch, onMain, reverts, refused, salvaged, salvageDir: salvaged.length ? salvageDir : null, ownerDirt: dirty.filter((e) => !engineOwned(e) || !onMain).map((e) => e.path), ...demotion } }
  } finally { releaseLock(lock) }
}

// ── dispatch ───────────────────────────────────────────────────────────────────────────────────
function dispatch(o) {
  if (!o.wos.length) throw new InputError('dispatch needs at least one --wo <id>')
  const ctx = projectCtx(o.project)
  const wos = o.wos.map((id) => findWo(ctx, id))
  const lock = o.commit ? acquireLock(ctx, { waitMs: o.lockWaitMs, op: 'dispatch' }) : null
  try {
    const texts = wos.map((w) => readFileSync(path.join(ctx.project, w.rel), 'utf8'))
    const wrong = wos.filter((w, i) => ['VERIFIED', 'BLOCKED'].includes(frontmatterStatus(texts[i])))
    if (wrong.length) return { code: REFUSED_EXIT, body: { status: 'refused', reason: `${wrong.map((w) => w.id).join(', ')}: a VERIFIED or BLOCKED work order is never dispatched — nothing was stamped` } }
    const stamped = []
    wos.forEach((w, i) => { if (frontmatterStatus(texts[i]) !== 'IN_PROGRESS') { writeFileSync(path.join(ctx.project, w.rel), setFrontmatterStatus(texts[i], 'IN_PROGRESS')); stamped.push(w) } })
    let committed = null
    if (o.commit && stamped.length) {
      const paths = stamped.map((w) => w.rel)
      ctx.g.must(['--literal-pathspecs', 'add', '--', ...paths])
      const c = ctx.g.run(['--literal-pathspecs', 'commit', '-q', '-m', `chore(build): dispatch ${stamped.map((w) => w.id).join(', ')} (IN_PROGRESS)`, '--', ...paths])
      if (!c.ok) { ctx.g.run(['--literal-pathspecs', 'reset', '-q', '--', ...paths]); stamped.forEach((w) => writeFileSync(path.join(ctx.project, w.rel), texts[wos.indexOf(w)])); throw new Refusal('commit-failed', `the dispatch commit failed and the stamps were restored: ${c.err || 'no output'}`) }
      committed = ctx.g.must(['rev-parse', 'HEAD']).trim().slice(0, 12)
    }
    return { code: 0, body: { status: stamped.length ? 'stamped' : 'nothing', stamped: stamped.map((w) => w.id), unchanged: wos.filter((w) => !stamped.includes(w)).map((w) => w.id), committed } }
  } finally { releaseLock(lock) }
}

// ── safe-point probe ───────────────────────────────────────────────────────────────────────────
const regularFile = (p) => { try { const s = lstatSync(p); return !s.isSymbolicLink() && s.isFile() } catch (e) { if (e.code === 'ENOENT') return false; throw e } }
function readyChanges(project) {
  const dir = path.join(project, '.pandacorp', 'inbox', 'changes')
  const ready = []
  const unreadable = []
  for (const f of existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.md')).sort() : []) {
    const text = readFileSync(path.join(dir, f), 'utf8')
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(text)
    const st = fm ? (/^status:[ \t]*([A-Za-z]+)/m.exec(fm[1]) || [])[1] : null
    if (!st) { unreadable.push(f.slice(0, -3)); continue }
    if (st.toLowerCase() !== 'ready') continue
    ready.push({ slug: f.slice(0, -3), expedite: /^class:[ \t]*expedite\b/m.test(fm[1]), date: ((/^date:[ \t]*['"]?([0-9-]+)/m.exec(fm[1]) || [])[1]) || '9999' })
  }
  ready.sort((a, b) => (a.expedite !== b.expedite ? (a.expedite ? -1 : 1) : a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug)))
  return { ready: ready.map((r) => r.slug), unreadable }
}
function blockedNeedsOwner(project) {
  const base = path.join(project, 'docs', 'frds')
  const out = []
  for (const frd of existsSync(base) ? readdirSync(base) : []) {
    const dir = path.join(base, frd, 'work-orders')
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir).filter((n) => WO_FILE_RE.test(`docs/frds/${frd}/work-orders/${n}`))) {
      const t = readFileSync(path.join(dir, f), 'utf8')
      if (frontmatterStatus(t) === 'BLOCKED' && fmGet(t, 'blocked_reason') === 'needs-owner') out.push({ frd, wo: fmGet(t, 'id') || f.replace(/\.md$/, '') })
    }
  }
  return out
}
async function safePoint(o) {
  let renewed = false
  if (o.token !== undefined) {
    try { await renew(o.project, o.token, o.epoch); renewed = true } catch (e) {
      return { code: 0, body: { status: 'stop', stop: true, renewed: false, work: false, reason: `lease renewal failed (${e.code || 'ERROR'}: ${e.message}) — stop, read nothing else` } }
    }
  }
  const statusFile = path.join(o.project, '.pandacorp', 'status.yaml')
  if (!regularFile(statusFile)) throw new InputError(`${statusFile} is missing or not a regular file`)
  const stopReceipt = { status_exists: true, stop: regularFile(path.join(o.project, '.pandacorp', 'run', 'stop')), method: 'node-lstat' }
  const rethink = /^rethink_pending:[ \t]*true\b/m.test(readFileSync(statusFile, 'utf8'))
  const { ready, unreadable } = o.targeted ? { ready: [], unreadable: [] } : readyChanges(o.project)
  const blocked = blockedNeedsOwner(o.project)
  const decisions = path.join(o.project, '.pandacorp', 'inbox', 'decisions.md')
  const answered = existsSync(decisions) ? (readFileSync(decisions, 'utf8').match(/^.*\b(RESUELTO|resolved)\b.*$/gim) || []).length : 0
  const stop = stopReceipt.stop || rethink
  const work = !stop && (ready.length > 0 || unreadable.length > 0 || (blocked.length > 0 && answered > 0))
  return { code: 0, body: { status: stop ? 'stop' : work ? 'work' : 'quiet', stop, stop_receipt: stopReceipt, rethink_pending: rethink, renewed, ready, unreadable, blockedNeedsOwner: blocked, answeredDecisions: answered, work } }
}

// ── reuse-check (BL-0147) ──────────────────────────────────────────────────────────────────────
function reuseCheck(o) {
  const ctx = projectCtx(o.project)
  const headSha = ctx.g.must(['rev-parse', 'HEAD']).trim()
  const dirty = dirtyEntries(ctx).length > 0
  const sy = path.join(o.project, '.pandacorp', 'status.yaml')
  const lastGreenSha = existsSync(sy) ? ((/^last_green_sha:[ \t]*['"]?([0-9a-f]{7,40})/m.exec(readFileSync(sy, 'utf8')) || [])[1] || '') : ''
  const base = { canReuse: false, headSha, dirty, lastGreenSha }
  let report
  try { report = JSON.parse(readFileSync(path.join(o.project, '.pandacorp', 'run', 'gate-report.json'), 'utf8')) } catch { return { code: 0, body: { ...base, reason: 'no-report' } } }
  const at = Date.parse(report && report.at)
  const fields = { reportScope: String(report.scope ?? ''), reportGreen: report.green === true, reportSha: String(report.sha ?? ''), reportSince: String(report.since ?? ''), ageSeconds: Number.isFinite(at) ? Math.floor((Date.now() - at) / 1000) : -1 }
  const reason = fields.reportScope !== 'full' ? 'scope-not-eligible' : !fields.reportGreen ? 'not-green' : !fields.reportSha ? 'sha-missing' : fields.reportSha !== headSha ? 'sha-mismatch' : dirty ? 'dirty-tree' : !(fields.ageSeconds >= 0 && fields.ageSeconds <= o.maxAge) ? 'stale-report' : 'reused'
  return { code: 0, body: { ...base, ...fields, canReuse: reason === 'reused', reason } }
}

// ── gate worktree: prepare / release (C2, BL-0149/0182/0183) ───────────────────────────────────
const realOr = (p) => { try { return realpathSync(p) } catch { return path.resolve(p) } }
function registeredWorktrees(ctx) {
  return ctx.g.must(['worktree', 'list', '--porcelain']).split('\n').filter((l) => l.startsWith('worktree ')).map((l) => realOr(l.slice(9)))
}
function bootstrap(ctx, wt, port) {
  const env = { ...process.env, ...(port !== undefined ? { PANDACORP_E2E_PORT: String(port) } : {}) }
  const r = spawnSync('bash', ['.pandacorp/worktree-bootstrap.sh'], { cwd: path.join(wt, ctx.prefix), env, encoding: 'utf8', timeout: 20 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 })
  return r.status === 0 ? null : `worktree-bootstrap.sh exited ${r.status}${r.signal ? ` (${r.signal})` : ''}: ${`${r.stderr || ''}`.trim().split('\n').slice(-3).join(' | ')}`
}
function gatePrepare(o) {
  if (!o.path || !o.sha) throw new InputError('gate-prepare needs --path <worktree> and --sha <commit>')
  const ctx = projectCtx(o.project)
  const wt = path.resolve(o.path)
  const fail = (failure, dirty = []) => ({ code: REFUSED_EXIT, body: { ok: false, failure, dirty } })
  if (!ctx.g.run(['rev-parse', '--verify', '-q', `${o.sha}^{commit}`]).ok) return fail(`unreachable sha ${o.sha}`)
  const registered = registeredWorktrees(ctx).includes(realOr(wt))
  if (!existsSync(wt)) {
    if (registered) return fail('a worktree is registered at that path but the directory is missing; evidence preserved')
    const add = ctx.g.run(['worktree', 'add', '--detach', wt, o.sha])
    if (!add.ok) return fail(`git worktree add failed: ${add.err}`)
    const b = bootstrap(ctx, wt, o.port)
    return b ? fail(b) : { code: 0, body: { ok: true, created: true, sha: o.sha } }
  }
  const lines = gitIn2(wt, ['status', '--porcelain=v1', '--untracked-files=all'])
  if (!registered || lines === null || lines.length) return fail('gate worktree is dirty, orphaned, unregistered, or ambiguous; evidence preserved', registered && lines ? lines : [])
  const co = spawnSync('git', ['-C', wt, 'checkout', '-q', '--detach', o.sha], { encoding: 'utf8' })
  if (co.status !== 0) return fail(`checkout failed: ${String(co.stderr).trim()}`)
  const b = bootstrap(ctx, wt, o.port)
  return b ? fail(b) : { code: 0, body: { ok: true, created: false, sha: o.sha } }
}
/** `git -C wt <args>` output lines, null when git fails. */
function gitIn2(wt, args) {
  const r = spawnSync('git', ['-C', wt, '-c', 'core.quotepath=off', ...args], { encoding: 'utf8' })
  return r.status === 0 ? r.stdout.split('\n').filter(Boolean) : null
}
function gateRelease(o) {
  if (!o.path || !o.dir) throw new InputError('gate-release needs --path <worktree> and --dir <evidence dir>')
  const ctx = projectCtx(o.project)
  const wt = path.resolve(o.path)
  const dir = path.resolve(o.dir)
  const listZ = () => { const r = spawnSync('git', ['-C', wt, 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames'], { encoding: 'utf8' }); if (r.status !== 0) throw new InputError(`git status in ${wt} failed: ${String(r.stderr).trim()}`); return r.stdout.split('\0').filter(Boolean).map((e) => ({ code: e.slice(0, 2), path: e.slice(3) })) }
  const salvaged = []
  let failure = null
  for (const e of listZ()) {
    const status = e.code === '??' ? 'untracked' : e.code.includes('D') ? 'deleted' : 'modified'
    const src = path.join(wt, e.path)
    let sha256 = null
    if (status !== 'deleted') {
      try { mkdirSync(path.dirname(path.join(dir, e.path)), { recursive: true }); copyFileSync(src, path.join(dir, e.path)); sha256 = createHash('sha256').update(readFileSync(path.join(dir, e.path))).digest('hex') } catch (err) { failure = `could not salvage ${e.path}: ${err.message}`; break }
    }
    const inHead = spawnSync('git', ['-C', wt, 'cat-file', '-e', `HEAD:${e.path}`]).status === 0
    const clean = inHead ? ['--literal-pathspecs', 'checkout', 'HEAD', '--', e.path] : ['--literal-pathspecs', 'rm', '-q', '--cached', '--ignore-unmatch', '--', e.path]
    if (spawnSync('git', ['-C', wt, ...clean]).status !== 0) { failure = `could not clean ${e.path}`; break }
    if (!inHead) rmSync(src, { force: true })
    salvaged.push({ path: e.path, status, sha256 })
  }
  const report = path.join(wt, ctx.prefix, '.pandacorp', 'run', 'gate-report.json')
  if (!failure && existsSync(report)) { mkdirSync(dir, { recursive: true }); copyFileSync(report, path.join(dir, 'gate-report.json')) }
  const remaining = gitIn2(wt, ['status', '--porcelain=v1', '--untracked-files=all']) || ['<git status failed>']
  return { code: failure || remaining.length ? REFUSED_EXIT : 0, body: { salvaged, remaining, ...(failure ? { failure } : {}) } }
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────────
const OPS = { 'commit-wo': commitWo, 'park-wo': parkWo, precheck, dispatch, 'safe-point': safePoint, 'reuse-check': reuseCheck, 'gate-prepare': gatePrepare, 'gate-release': gateRelease }

/** CLI entry: prints ONE sealed JSON line, returns the exit code. */
export async function main(argv) {
  const op = argv[0]
  const emit = (body) => process.stdout.write(`${sealLine({ version: 1, op: op || null, ...body })}\n`)
  try {
    if (!OPS[op]) throw new InputError(`first argument must be one of ${Object.keys(OPS).join('|')}, got ${JSON.stringify(op)}`)
    const { code, body } = await OPS[op](parseArgs(argv))
    emit({ ok: code === 0, ...body })
    return code
  } catch (e) {
    if (e instanceof Refusal) { emit({ ok: false, status: e.status, reason: e.message, ...e.extra }); return REFUSED_EXIT }
    emit({ ok: false, status: 'error', error: e instanceof InputError ? e.message : `${e.code || e.name}: ${e.message}` })
    return INPUT_EXIT
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)))
