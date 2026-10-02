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
//                commit the append-only journals' pending lines (never reset them), salvage ENGINE-owned dirt (a WO file
//                whose diff from HEAD is only ENGINE_FM_KEYS) to .pandacorp/run/salvage/ and reset it, put back only the
//                implementation_status of a WO file that also carries an owner edit (every other byte kept, reported as
//                owner dirt), then the C7 stamp-anchored demotion (an IN_REVIEW with no flip commit after its last
//                IN_PROGRESS stamp → PLANNED, one commit). Owner dirt and the lease projection (.pandacorp/status.yaml)
//                are never touched, only reported.
//                Also reports `usable`: the FRDs still USABLE from an earlier run (C6, durableUsable in build-mech-fast.mjs),
//                and `greenfield`: a freshly architected project whose verify.sh is red by construction (greenfieldOf).
//   commit-wo    --wo <id> --files <a,b,…> [--file <p>]… [--extra <p> --reason <r>]… [--ac <AC-id>]…
//                [--fixup <id> [--for <id>]] [--main-branch main] [--lock-wait-ms N] [--test-timeout-ms N]
//                [--events <f>] [--project-name <n>]
//                the ONE commit of a built work order (C2): main-writer lock (10-min stale reclaim) → refuse
//                undeclared or another WO's changed paths → refuse schema/migration paths off main → AC-citation
//                floor → related unit tests only (`vitest related --run`) → stamp IN_REVIEW + the track.jsonl wo_end
//                line → one commit naming the WO (extras in a trailer) → assert the tree clean → the wo_commit event. Any failure after the stamp restores it (and
//                undoes the commit), so an IN_REVIEW never exists without its clean commit. `--fixup <id>` commits a
//                fix to an earlier own-FRD WO as its own commit, no stamp.
//   park-wo      --wo <id> [--files <a,b,…>] [--all-undeclared]   move a failed WO's dirty paths to
//                .pandacorp/run/salvage/<id>/<stamp>/ and reset them, so the next WO never builds on broken files
//                (journals and other WOs' files kept). --all-undeclared (the sequential fast lane only) also salvages
//                every path dirtied since its FRD's dispatch (the dispatch snapshot); dirt that was already there is kept
//                only while its content is unchanged since the dispatch (a content hash per path), so a path the builder
//                changed is always salvaged, declared or not. What it leaves behind is recorded (with its content hash)
//                and commit-wo refuses it, through --files or --extra, while it still holds that content.
//   dispatch     --wo <id>… [--commit]   stamp IN_PROGRESS in the frontmatter (BL-0002); --commit makes it a commit,
//                the anchor of the stamp-commit window (C7). A VERIFIED/BLOCKED work order is refused. Records each
//                FRD's dispatch snapshot (the base, the dirt already present and its content hashes) for park-wo
//                --all-undeclared, and clears the parked records (so does precheck): they never outlive a dispatch.
//   safe-point   [--token T --epoch E] [--targeted]   the probe: renew the lease (fenced), the owner stop receipt
//                (lstat), rethink_pending, ready change cards, needs-owner blocks with an answered decision →
//                `work`. The engine spawns the LLM drain only when `work` is true.
//   reuse-check  [--max-age 900]   BL-0147: may the close-out reuse .pandacorp/run/gate-report.json? Only a report a
//                scripted op sealed (gate-report.provenance.json), its bytes intact (proposal 40).
//   gate-prepare --path <wt> --sha <sha> [--port N]   C2: a frozen detached gate worktree at <sha>, bootstrapped.
//   plan         [--frd <folder>]… [--classify] [--compact]   the fast lane's plan without a plan agent: the blueprints'
//                Build Plan order + work-order frontmatter (C4); a missing/drifted Build Plan → status no-build-plan.
//                --classify also writes the deterministic floor (C3); --compact keeps free text out of the line (the AC
//                lines go to .pandacorp/run/context/<WO>.md). See build-mech-fast.mjs.
//   fast-start   --token T --epoch E [--targeted] [--frd <folder>]… [--launch-event --mode M --max-agents N]
//                the fast lane's FUSED start: BuildLaunch event → precheck → stop/rethink probe → baseline verdict → plan
//                --classify --compact → drainable work → rollup sync → the first FRD's committed dispatch, ONE line;
//                anything but the quiet common case hands back at its step. See build-mech-start.mjs.
//   classify-frd --frd <folder>… [--range <a>..<b>]   the monotone product-risk FRD floor (classify-change.mjs --product-floor), frontmatter `floor:`.
//   verify       --frd <folder> [--since <base>] [--wo <id>]… [--floor]   the USABLE check (C6): clean tree (journals
//                excepted), committed WOs, landed floor over <base>..HEAD (no --since: the base is derived from the
//                dispatch stamp commits, then the dispatch snapshot; unknowable → floor), verify.sh on the clean SHA; green + not
//                floor → build_usable (track.jsonl commit + dashboard); `usable` only once that line is committed.
//   gate-release --path <wt> --dir <evidence-dir>   BL-0182: salvage every dirty path of the gate worktree (+ its
//                gitignored gate report) to <dir>, then clean exactly those paths. Proposal 40: also records
//                <dir>/gate-manifest.json (the pin, each path's status and sha256) and a patch per modified tracked file.
//   gate-land    --dir <evidence-dir> --frd <folder> [--pin <sha>]   proposal 40: the gate's PASS lands its own
//                reviewer tests and its new-route blesses on main as ONE commit with DR-080 provenance (build-mech-land.mjs).

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renew } from '../runtime/build-state.mjs'
import { BASELINE_RE, INPUT_EXIT, InputError, JOURNALS, PROJECTION, REFUSED_EXIT, Refusal, WO_FILE_RE, acquireLock, blobAt, commitJournals, dirtyEntries, dispatchSnapshotFile, engineOnlyDiff, findWo, fmGet, frontmatterStatus, inReviewWindow, isOnMain, matchesDeclared, projectCtx, releaseLock, reportProvenance, salvageAndReset, setFrontmatterStatus, unique, utcStamp, withdrawLine, woAcIds, woIdOf } from './build-mech-lib.mjs'
import { FAST_OPS, durableUsable, greenfieldOf } from './build-mech-fast.mjs'
import { gateLandOp } from './build-mech-land.mjs'
import { fastStartOp } from './build-mech-start.mjs'
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
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ── argument parsing ───────────────────────────────────────────────────────────────────────────
const FLAGS = new Set(['commit', 'targeted', 'classify', 'floor', 'all-undeclared', 'compact', 'launch-event'])
const LISTS = new Set(['file', 'wo', 'ac', 'frd'])
function parseArgs(argv) {
  const op = argv[0]
  const o = { op, files: [], extras: [], wos: [], acs: [], frds: [], mainBranch: 'main', lockWaitMs: 120000, testTimeoutMs: 600000, maxAge: 900 }
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i]
    if (!k.startsWith('--')) throw new InputError(`unexpected argument ${JSON.stringify(k)}`)
    const name = k.slice(2)
    if (FLAGS.has(name)) { o[name.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = true; continue }
    const v = argv[++i]
    if (v === undefined) throw new InputError(`${k} needs a value`)
    if (name === 'files') o.files.push(...v.split(',').map((s) => s.trim()).filter(Boolean))
    else if (name === 'extra') o.extras.push({ path: v.replace(/^\.\//, ''), reason: null })
    else if (name === 'reason') { const last = o.extras[o.extras.length - 1]; if (!last || last.reason !== null) throw new InputError('--reason must follow its --extra'); last.reason = v.trim() }
    else if (LISTS.has(name)) o[name === 'file' ? 'files' : `${name}s`].push(v)
    else if (['lock-wait-ms', 'test-timeout-ms', 'max-age', 'port', 'epoch', 'verify-timeout-ms', 'max-agents'].includes(name)) { const n = Number(v); if (!Number.isInteger(n) || n < 0) throw new InputError(`${k} must be a non-negative integer`); o[name.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = n }
    else if (['project', 'fixup', 'for', 'main-branch', 'events', 'token', 'path', 'sha', 'dir', 'project-name', 'since', 'range', 'mode', 'pin'].includes(name)) o[name.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v
    else throw new InputError(`unknown option ${k}`)
  }
  if (!o.project) throw new InputError('--project is required')
  o.project = path.resolve(o.project)
  if (o.extras.some((x) => !x.reason)) throw new InputError('every --extra needs a --reason (why the WO had to touch an undeclared path)')
  return o
}

// ── dispatch snapshots and park leftovers (gitignored run state) ──────────────────────────────────
const parkedDir = (ctx) => path.join(ctx.project, '.pandacorp', 'run', 'parked')
const parkedFile = (ctx, id) => path.join(parkedDir(ctx), `${id.toUpperCase()}.json`)
/** The parked records are run state of one dispatch: the precheck and every dispatch clear them. */
const clearParked = (ctx) => rmSync(parkedDir(ctx), { recursive: true, force: true })
/** sha256 of a project-relative regular file's bytes; null when it is absent (deleted) or not a regular file. */
function contentHash(ctx, rel) {
  const abs = path.join(ctx.project, rel)
  try { if (!lstatSync(abs).isFile()) return null } catch { return null }
  return createHash('sha256').update(readFileSync(abs)).digest('hex')
}
/** Not this op's own: the lease projection, a journal, or another work order's file. */
const sharedPath = (p, ownRel) => p === PROJECTION || JOURNALS.includes(p) || (WO_FILE_RE.test(p) && p !== ownRel)
/**
 * The dirt already present when an FRD was dispatched, with each path's content hash then: `applied` only when the
 * snapshot exists, parses, carries its hashes and its base is an ancestor of HEAD; otherwise the caller falls back to
 * the declared paths.
 * @returns {{ state: 'applied'|'no-dispatch-snapshot'|'stale-dispatch-snapshot', hashes: Map<string, string|null> }}
 */
function dispatchSnapshot(ctx, frd) {
  let snap = null
  try { snap = JSON.parse(readFileSync(dispatchSnapshotFile(ctx, frd), 'utf8')) } catch { return { state: 'no-dispatch-snapshot', hashes: new Map() } }
  const hashes = snap && snap.hashes && typeof snap.hashes === 'object' && !Array.isArray(snap.hashes) ? snap.hashes : null
  const valid = snap && snap.version === 2 && snap.frd === frd && typeof snap.base === 'string' && Array.isArray(snap.dirt) && hashes && snap.dirt.every((p) => typeof p === 'string' && p in hashes) && ctx.g.run(['merge-base', '--is-ancestor', snap.base, 'HEAD']).ok
  return valid ? { state: 'applied', hashes: new Map(snap.dirt.map((p) => [p, hashes[p]])) } : { state: 'stale-dispatch-snapshot', hashes: new Map() }
}
/** Every path a parked work order (other than `ownId`) left dirty behind it: path → { wo, hash } (hash undefined: unknown). */
function parkLeftovers(ctx, ownId) {
  const dir = parkedDir(ctx)
  const out = new Map()
  for (const f of existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.json')) : []) {
    let rec = null
    try { rec = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) } catch { rec = null }
    if (!rec || typeof rec.wo !== 'string' || !Array.isArray(rec.left) || rec.wo.toUpperCase() === ownId.toUpperCase()) continue
    const hashes = rec.hashes && typeof rec.hashes === 'object' ? rec.hashes : {}
    for (const p of rec.left) if (typeof p === 'string') out.set(p, { wo: rec.wo, hash: p in hashes ? hashes[p] : undefined })
  }
  return out
}

// ── commit-wo ──────────────────────────────────────────────────────────────────────────────────
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
/** The commit message; `extras` are only the --extra paths this commit actually stages (an untouched one is not claimed). */
function commitMessage(wo, woText, o, extras) {
  const subject = o.fixup ? `fix(${wo.frd}): fixup ${wo.id}${o.for ? ` (found while building ${o.for})` : ''}` : `feat(${wo.frd}): ${wo.id} ${fmGet(woText, 'slug') || 'build'}`
  const trailers = extras.map((x) => `Extra-Path: ${x.path} (${x.reason.replace(/\s+/g, ' ')})`)
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
    // A parked work order's leftover is its work, never this one's: staged through --files (a glob, a directory) or
    // --extra it would blend the commit. Refused while it still holds the content it was parked with (unknown → held).
    const dirtySet = new Set(dirty.map((e) => e.path))
    const claimed = [...parkLeftovers(ctx, wo.id)].filter(([p, rec]) => dirtySet.has(p) && matchesDeclared(allowed, p) && (rec.hash === undefined || rec.hash === contentHash(ctx, p)))
    if (claimed.length) throw new Refusal('parked-leftover', `${claimed.map(([p, rec]) => `${p} (left by the parked ${rec.wo})`).join(', ')}: a parked work order's leftover is never committed with another one, through --files or --extra; run that work order's park command (it salvages the leftover), then re-run this commit`, { paths: claimed.map(([p]) => p), wos: unique(claimed.map(([, rec]) => rec.wo)) })
    const undeclared = dirty.filter((e) => !auto(e.path) && !matchesDeclared(allowed, e.path)).map((e) => e.path)
    if (undeclared.length) throw new Refusal('undeclared', `modified path(s) outside the declared files: ${undeclared.join(', ')} — declare them, pass --extra <path> --reason <why>, or park them`, { paths: undeclared })
    // proposal 40 / DR-080: a visual baseline is blessed by the FRD gate at green, never by the code's author.
    const baselines = dirty.filter((e) => BASELINE_RE.test(e.path)).map((e) => e.path)
    if (baselines.length) throw new Refusal('builder-baseline', `visual baseline(s) ${baselines.join(', ')}: a baseline is blessed by the FRD gate at green, never by the builder (DR-080) — delete them; the gate blesses the route`, { paths: baselines })
    const stage = dirty.map((e) => e.path)
    const stagedExtras = o.extras.filter((x) => stage.some((p) => matchesDeclared([x.path], p)))
    const schema = stage.filter((p) => SCHEMA_PATHS.some((re) => re.test(p)))
    if (schema.length && !isOnMain(ctx, o.mainBranch)) throw new Refusal('schema-off-main', `schema/migration path(s) ${schema.join(', ')} may only be committed on ${o.mainBranch} (on ${ctx.branch || 'a detached HEAD'}${ctx.linked ? ', a linked worktree' : ''})`, { paths: schema })
    if (!stage.length && (o.fixup || headStatus === 'IN_REVIEW')) return { code: 0, body: { status: 'nothing', wo: wo.id, reason: o.fixup ? 'nothing to commit' : `${wo.id} is already committed IN_REVIEW and the tree is clean` } }
    const woAbs = path.join(ctx.project, wo.rel)
    const original = readFileSync(woAbs, 'utf8')
    const acs = o.fixup ? { skipped: true, reason: 'fixup: the fixed work order passed its floor at its own commit' } : acCitation(ctx, original, o.acs, stage)
    const tests = relatedTests(ctx, stage.filter((p) => !auto(p)), o.testTimeoutMs)
    if (!tests.ok) throw new Refusal('tests-red', `related unit tests failed (exit ${tests.exit}${tests.signal ? `, ${tests.signal}` : ''}) — nothing was stamped or committed`, { tests })
    const trackAbs = path.join(ctx.project, TRACK)
    const trackExisted = existsSync(trackAbs)
    const woEnd = o.fixup ? null : JSON.stringify({ kind: 'wo_end', frd: wo.frd, wo: wo.id, state: 'in_review', at: new Date().toISOString() })
    if (!o.fixup) {
      if (frontmatterStatus(original) !== 'IN_REVIEW') writeFileSync(woAbs, setFrontmatterStatus(original, 'IN_REVIEW'))
      appendFileSync(trackAbs, `${woEnd}\n`)
    }
    const paths = unique([...stage, ...(o.fixup ? [] : [wo.rel, TRACK])])
    // Only this op's own wo_end line is withdrawn: a gate in a parallel slot may have appended its lines meanwhile.
    const restore = () => {
      ctx.g.run(['--literal-pathspecs', 'reset', '-q', '--', ...paths])
      writeFileSync(woAbs, original)
      if (woEnd) withdrawLine(trackAbs, woEnd, trackExisted)
    }
    const add = ctx.g.run(['--literal-pathspecs', 'add', '-A', '--', ...paths])
    const commit = add.ok ? ctx.g.run(['--literal-pathspecs', 'commit', '-q', '-m', commitMessage(wo, original, o, stagedExtras), '--', ...paths]) : add
    if (!commit.ok) { restore(); throw new Refusal('commit-failed', `the commit failed and the stamp was restored: ${commit.err.split('\n').slice(-3).join(' | ') || 'no output'}`) }
    const sha = ctx.g.must(['rev-parse', 'HEAD']).trim()
    // A journal line appended after the commit is a concurrent writer's (the next committer sweeps it), never dirt.
    const after = dirtyEntries(ctx).filter((e) => e.path !== PROJECTION && !JOURNALS.includes(e.path)).map((e) => e.path)
    if (after.length) {
      ctx.g.must(['reset', '-q', '--soft', headBefore])
      restore()
      throw new Refusal('dirty-after-commit', `the tree was not clean after the commit (${after.join(', ')}) — the commit was undone and the stamp restored`, { paths: after })
    }
    if (!o.fixup) { rmSync(parkedFile(ctx, wo.id), { force: true }); emitEvent(o, { event: 'wo_commit', frd: wo.frd, wo: wo.id, state: 'IN_REVIEW' }) }
    return { code: 0, body: { status: 'committed', wo: wo.id, frd: wo.frd, sha: sha.slice(0, 12), fixup: Boolean(o.fixup), paths, codePaths: paths.filter((p) => !auto(p) && p !== TRACK), extras: stagedExtras, acs, tests, lock: { reclaimed: lock.reclaimed } } }
  } finally { releaseLock(lock) }
}

// ── park-wo ────────────────────────────────────────────────────────────────────────────────────
// --all-undeclared (the sequential fast lane: one builder on main, so every path changed since the dispatch is that
// builder's): salvage everything changed since the FRD's dispatch, declared or not; a path that was dirty at the dispatch
// is kept only while its content hash still equals the snapshot's (an owner's, untouched by the build). Without a usable
// snapshot it falls back to the declared paths and says so. What stays behind (beyond the shared paths) is recorded with
// its content hash, so commit-wo refuses it for another work order. The classic waves (no --all-undeclared) record
// nothing: a parallel sibling's files are dirty at the same time and are its own.
function parkWo(o) {
  if (o.wos.length !== 1) throw new InputError('park-wo needs exactly one --wo <id>')
  const ctx = projectCtx(o.project)
  const wo = findWo(ctx, o.wos[0])
  const lock = acquireLock(ctx, { waitMs: o.lockWaitMs, op: 'park-wo' })
  try {
    const dirty = dirtyEntries(ctx)
    const snap = o.allUndeclared ? dispatchSnapshot(ctx, wo.frd) : null
    const sweep = Boolean(snap && snap.state === 'applied')
    const unchangedSinceDispatch = (p) => snap.hashes.has(p) && snap.hashes.get(p) === contentHash(ctx, p)
    const keep = (e) => sharedPath(e.path, wo.rel) || (sweep ? unchangedSinceDispatch(e.path) : (o.files.length > 0 && e.path !== wo.rel && !matchesDeclared(o.files, e.path)))
    const target = dirty.filter((e) => !keep(e))
    const dir = `.pandacorp/run/salvage/${wo.id}/${utcStamp()}`
    const parked = salvageAndReset(ctx, target, path.join(ctx.project, dir))
    const left = dirty.filter((e) => keep(e) && !sharedPath(e.path, wo.rel)).map((e) => e.path)
    const rec = parkedFile(ctx, wo.id)
    if (o.allUndeclared && left.length) { mkdirSync(path.dirname(rec), { recursive: true }); writeFileSync(rec, `${JSON.stringify({ version: 2, wo: wo.id, frd: wo.frd, left, hashes: Object.fromEntries(left.map((p) => [p, contentHash(ctx, p)])), at: new Date().toISOString() })}\n`) } else rmSync(rec, { force: true })
    return { code: 0, body: { status: parked.length ? 'parked' : 'nothing', wo: wo.id, dir: parked.length ? dir : null, parked, kept: dirty.filter(keep).map((e) => e.path), left, ...(snap ? { allUndeclared: snap.state } : {}) } }
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
/**
 * A dirty work order with an owner edit in it (body, Status Note, another key): keep every byte, salvage a copy, and
 * put only `implementation_status` back to HEAD's value (the engine's stamp; an uncommitted IN_REVIEW must not survive).
 * @returns {{ path: string, from: string, to: string }|null} null when the status already matches HEAD
 */
function restoreStatusOnly(ctx, rel, headText, salvageAbs) {
  const abs = path.join(ctx.project, rel)
  const work = readFileSync(abs, 'utf8')
  mkdirSync(path.dirname(path.join(salvageAbs, rel)), { recursive: true })
  copyFileSync(abs, path.join(salvageAbs, rel))
  const from = frontmatterStatus(work)
  const to = frontmatterStatus(headText)
  if (from === to || ['ABSENT', 'UNKNOWN'].includes(to) || !/^implementation_status:/m.test(((/^---\r?\n([\s\S]*?)\r?\n---/.exec(work)) || [])[1] || '')) return null
  writeFileSync(abs, setFrontmatterStatus(work, to))
  return { path: rel, from, to }
}
function precheck(o) {
  const ctx = projectCtx(o.project)
  const lock = acquireLock(ctx, { waitMs: o.lockWaitMs, op: 'precheck' })
  try {
    const reverts = recoverPendingReverts(o)
    clearParked(ctx)   // a parked record is run state: a new run (or a resume) starts with none
    const onMain = isOnMain(ctx, o.mainBranch)
    // The journals are append-only and durable: their uncommitted lines (a paused run's build_paused, a gate's review
    // lines) are committed, never reset — the "next committer stages them" rule, applied before anything reads state.
    const journals = onMain ? commitJournals(ctx, 'chore(build): commit the pending lines of the journals before the resume\n\nProposal 39 C7: the append-only journals are durable; the resume precheck commits them, never resets them.') : { sha: null, paths: [] }
    const dirty = dirtyEntries(ctx).filter((e) => e.path !== PROJECTION)
    const woDirt = dirty.filter((e) => e.code !== '??' && WO_FILE_RE.test(e.path)).map((e) => {
      const headText = blobAt(ctx, 'HEAD', e.path)
      const abs = path.join(ctx.project, e.path)
      const work = existsSync(abs) ? readFileSync(abs, 'utf8') : null
      return { e, headText, work, engine: engineOnlyDiff(headText, work) }
    })
    const salvageDir = `.pandacorp/run/salvage/precheck/${utcStamp()}`
    const salvageAbs = path.join(ctx.project, salvageDir)
    const engineReset = onMain ? woDirt.filter((x) => x.engine).map((x) => x.e) : []
    const salvaged = salvageAndReset(ctx, engineReset, salvageAbs)
    const mixed = onMain ? woDirt.filter((x) => !x.engine && x.work !== null && x.headText !== null) : []
    const statusRestored = mixed.map((x) => restoreStatusOnly(ctx, x.e.path, x.headText, salvageAbs)).filter(Boolean)
    const demotion = demoteUnstamped(ctx, onMain, [...salvaged, ...statusRestored], salvageDir)
    const refused = reverts.filter((r) => r.exit !== 0).map((r) => r.frd)
    const reset = new Set(salvaged.map((x) => x.path))
    return { code: 0, body: { status: refused.length ? 'attention' : 'ok', head: ctx.g.must(['rev-parse', 'HEAD']).trim().slice(0, 12), branch: ctx.branch, onMain, reverts, refused, journalsCommit: journals.sha, journalsLeft: journals.sha ? [] : dirty.filter((e) => JOURNALS.includes(e.path)).map((e) => e.path), ...(journals.error ? { journalsError: journals.error } : {}), salvaged, statusRestored, salvageDir: salvaged.length || mixed.length ? salvageDir : null, ownerDirt: dirty.filter((e) => !reset.has(e.path) && !JOURNALS.includes(e.path)).map((e) => e.path), ...demotion, usable: durableUsable(ctx), greenfield: greenfieldOf(ctx) } }
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
    const baseFull = ctx.g.must(['rev-parse', 'HEAD']).trim()
    const base = baseFull.slice(0, 12)
    const preDirt = dirtyEntries(ctx).map((e) => e.path).filter((p) => !sharedPath(p, null))
    const hashes = Object.fromEntries(preDirt.map((p) => [p, contentHash(ctx, p)]))
    for (const frd of unique(wos.map((w) => w.frd))) {
      const file = dispatchSnapshotFile(ctx, frd)
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, `${JSON.stringify({ version: 2, frd, base: baseFull, dirt: preDirt, hashes, at: new Date().toISOString() })}\n`)
    }
    clearParked(ctx)
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
    return { code: 0, body: { status: stamped.length ? 'stamped' : 'nothing', stamped: stamped.map((w) => w.id), unchanged: wos.filter((w) => !stamped.includes(w)).map((w) => w.id), committed, base } }
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
  // proposal 40: last, only a report a scripted op wrote (and sealed), its bytes unchanged since — never one the builder
  // produced by running verify.sh by hand (a builder-written report may be green over a tree no script certified).
  const prov = reportProvenance(ctx)
  const reason = fields.reportScope !== 'full' ? 'scope-not-eligible' : !fields.reportGreen ? 'not-green' : !fields.reportSha ? 'sha-missing' : fields.reportSha !== headSha ? 'sha-mismatch' : dirty ? 'dirty-tree' : !(fields.ageSeconds >= 0 && fields.ageSeconds <= o.maxAge) ? 'stale-report' : !prov.ok ? prov.reason : 'reused'
  return { code: 0, body: { ...base, ...fields, provenance: prov.reason, canReuse: reason === 'reused', reason } }
}

// ── gate worktree: prepare / release (C2, BL-0149/0182/0183) ───────────────────────────────────
// A missing path (a pruned-away slot) resolves through its nearest existing ancestor, so /var vs /private/var still match git's list.
const realOr = (p) => { try { return realpathSync(p) } catch { const abs = path.resolve(p); const up = path.dirname(abs); return up === abs ? abs : path.join(realOr(up), path.basename(abs)) } }
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
    // Bench FM-2: an admin entry whose directory is gone (git lists it prunable) blocks `worktree add`. `prune --expire=now`
    // removes ONLY entries whose directory is missing and skips locked ones — no file is touched (BL-0067 holds).
    if (registered) {
      const pr = ctx.g.run(['worktree', 'prune', '--expire=now'])
      if (!pr.ok || registeredWorktrees(ctx).includes(realOr(wt))) return fail(`a worktree is registered at that path but the directory is missing${pr.ok ? ' and the entry is locked (prune kept it)' : ` (git worktree prune failed: ${pr.err})`}; evidence preserved`)
    }
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
  // proposal 40: a modified TRACKED file also keeps its diff against the pin, so gate-land can 3-way it onto a main that
  // moved since (the gate's bless flip in e2e/routes.ts next to a surface another FRD appended meanwhile).
  const pin = (gitIn2(wt, ['rev-parse', 'HEAD']) || [''])[0]
  const patchDir = path.join(dir, '.gate-patches')
  rmSync(patchDir, { recursive: true, force: true })
  for (const e of listZ()) {
    const status = e.code === '??' ? 'untracked' : e.code.includes('D') ? 'deleted' : 'modified'
    const src = path.join(wt, e.path)
    let sha256 = null
    let patch = null
    if (status !== 'deleted') {
      try { mkdirSync(path.dirname(path.join(dir, e.path)), { recursive: true }); copyFileSync(src, path.join(dir, e.path)); sha256 = createHash('sha256').update(readFileSync(path.join(dir, e.path))).digest('hex') } catch (err) { failure = `could not salvage ${e.path}: ${err.message}`; break }
    }
    if (status === 'modified') {
      const d = spawnSync('git', ['-C', wt, '--literal-pathspecs', 'diff', '--binary', 'HEAD', '--', e.path], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      if (d.status !== 0) { failure = `could not record the diff of ${e.path}: ${String(d.stderr).trim()}`; break }
      mkdirSync(patchDir, { recursive: true })
      patch = path.join('.gate-patches', `${salvaged.length}.patch`)
      writeFileSync(path.join(dir, patch), d.stdout)
    }
    const inHead = spawnSync('git', ['-C', wt, 'cat-file', '-e', `HEAD:${e.path}`]).status === 0
    const clean = inHead ? ['--literal-pathspecs', 'checkout', 'HEAD', '--', e.path] : ['--literal-pathspecs', 'rm', '-q', '--cached', '--ignore-unmatch', '--', e.path]
    if (spawnSync('git', ['-C', wt, ...clean]).status !== 0) { failure = `could not clean ${e.path}`; break }
    if (!inHead) rmSync(src, { force: true })
    salvaged.push({ path: e.path, status, sha256, ...(patch ? { patch } : {}) })
  }
  if (!failure) { mkdirSync(dir, { recursive: true }); writeFileSync(path.join(dir, 'gate-manifest.json'), `${JSON.stringify({ version: 1, pin, files: salvaged }, null, 1)}\n`) }
  const report = path.join(wt, ctx.prefix, '.pandacorp', 'run', 'gate-report.json')
  if (!failure && existsSync(report)) { mkdirSync(dir, { recursive: true }); copyFileSync(report, path.join(dir, 'gate-report.json')) }
  const remaining = gitIn2(wt, ['status', '--porcelain=v1', '--untracked-files=all']) || ['<git status failed>']
  return { code: failure || remaining.length ? REFUSED_EXIT : 0, body: { salvaged, remaining, ...(failure ? { failure } : {}) } }
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────────
const OPS = { 'commit-wo': commitWo, 'park-wo': parkWo, precheck, dispatch, 'safe-point': safePoint, 'reuse-check': reuseCheck, 'gate-prepare': gatePrepare, 'gate-release': gateRelease, 'gate-land': gateLandOp, ...FAST_OPS,
  'fast-start': (o) => fastStartOp(o, { precheck, safePoint, dispatch, emitEvent }) }

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
