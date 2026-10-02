// build-mech-lib.mjs — shared, deterministic helpers of pandacorp-build-mech.mjs (proposal 39 §2 C1/C2): the git
// view of ONE project (nested or flat, BL-0202), the main-writer lock, work-order frontmatter, and salvage-then-reset.
// No CLI here; every function either returns a value or throws a typed error the CLI turns into one sealed line.

import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { sealLine, verifySealedLine } from './drift-seal.mjs'

export const REFUSED_EXIT = 4
export const INPUT_EXIT = 2
/** A main-writer lock older than this is a crashed writer's residue (proposal 39 §2 C2). */
export const LOCK_STALE_MS = 10 * 60 * 1000
/**
 * Append-only journals every commit sweeps in (shared, never a WO's own artifact). Concurrent writers append to them
 * at any time (a gate in a parallel slot writes its review lines to the MAIN tree), so a journal line is never dirt
 * that refuses an op, and no op ever rewrites a journal wholesale: it appends, commits, or withdraws its OWN line.
 */
export const JOURNALS = Object.freeze(['.pandacorp/track.jsonl', '.pandacorp/build-journal.jsonl'])
/** The work-order frontmatter keys only the engine writes (stamps, the reopen counter, the block reason). */
export const ENGINE_FM_KEYS = Object.freeze(['implementation_status', 'reopen_count', 'blocked_reason'])
/** The lease projection: written by the fenced state CLI while a run holds the lease, committed by that writer only. */
export const PROJECTION = '.pandacorp/status.yaml'
/** Where `dispatch` records an FRD's dispatch snapshot (its base, the dirt then present and its hashes): gitignored run state. */
export const dispatchSnapshotFile = (ctx, frd) => path.join(ctx.project, '.pandacorp', 'run', 'dispatch', `${frd}.json`)
export const WO_FILE_RE = /^docs\/frds\/[^/]+\/work-orders\/(?!README\.md$)[^/]+\.md$/i

/** An input the script cannot act on: exit 2, never a quiet success. */
export class InputError extends Error {}
/** A deliberate refusal (exit 4): `status` is the machine reason, `extra` lands in the receipt. */
export class Refusal extends Error {
  constructor(status, reason, extra = {}) { super(reason); this.status = status; this.extra = extra }
}

export const unique = (xs) => [...new Set(xs)]
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/** git runner bound to a cwd: `run` never throws, `must` throws an InputError on a non-zero exit. */
export function gitIn(cwd) {
  const run = (args, opts = {}) => {
    const r = spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: opts.env || process.env })
    return { ok: r.status === 0, status: r.status, out: r.stdout || '', err: String(r.stderr || '').trim() }
  }
  const must = (args, opts) => {
    const r = run(args, opts)
    if (!r.ok) throw new InputError(`git ${args.join(' ')} failed: ${r.err || 'no output'}`)
    return r.out
  }
  return { run, must }
}

/**
 * The git view of one project directory.
 * @param {string} project the project dir (may be nested in a larger repository)
 * @returns {{ project: string, g: object, top: string, prefix: string, branch: string|null, linked: boolean }}
 */
export function projectCtx(project) {
  if (!existsSync(project)) throw new InputError(`project dir does not exist: ${project}`)
  const g = gitIn(project)
  const top = g.must(['rev-parse', '--show-toplevel']).trim()
  const prefix = g.must(['rev-parse', '--show-prefix']).trim()
  const b = g.run(['symbolic-ref', '-q', '--short', 'HEAD'])
  // A linked worktree's git dir is `<common>/worktrees/<name>`; both absolute and realpath'd (a TMPDIR symlink).
  const [gitDir, common] = g.must(['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir']).trim().split('\n').map((d) => realpathSync(d.trim()))
  return { project, g, top, prefix, branch: b.ok ? b.out.trim() : null, linked: gitDir !== common }
}

/** True on the project's main branch in the primary checkout (never a linked worktree, never a detached HEAD). */
export const isOnMain = (ctx, mainBranch) => ctx.branch === mainBranch && !ctx.linked

/**
 * Every uncommitted path of THIS project (BL-0202: `-- .`, prefix stripped), untracked files listed one by one,
 * the gitignored-anyway `.pandacorp/run/` excluded.
 * @returns {Array<{ code: string, path: string }>} `code` is the porcelain XY pair
 */
export function dirtyEntries(ctx) {
  const raw = ctx.g.must(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames', '--', '.'])
  return raw.split('\0').filter(Boolean).map((e) => ({ code: e.slice(0, 2), path: e.slice(3) }))
    .map((e) => ({ ...e, path: ctx.prefix && e.path.startsWith(ctx.prefix) ? e.path.slice(ctx.prefix.length) : e.path }))
    .filter((e) => !e.path.startsWith('.pandacorp/run/'))
}

/** The content of a project-relative path at a revision, null when absent. */
export function blobAt(ctx, rev, rel) {
  const r = ctx.g.run(['cat-file', 'blob', `${rev}:${ctx.prefix}${rel}`])
  return r.ok ? r.out : null
}

// ── work-order frontmatter ─────────────────────────────────────────────────────────────────────
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---/
/** A frontmatter scalar (quotes stripped, a trailing comment dropped), '' when absent. */
export function fmGet(text, key) {
  const m = FM_RE.exec(String(text || ''))
  if (!m) return ''
  const v = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(m[1])
  return v ? v[1].replace(/\s+#.*$/, '').trim().replace(/^['"]|['"]$/g, '') : ''
}
/** `implementation_status` of the FRONTMATTER (a body prose mention never counts). */
export function frontmatterStatus(text) {
  if (text === null || text === undefined) return 'ABSENT'
  if (!FM_RE.test(String(text))) return 'UNKNOWN'
  return (fmGet(text, 'implementation_status') || 'UNKNOWN').toUpperCase()
}
/** Rewrites only the frontmatter's `implementation_status:` line (the dispatch perl stamp, D6, in JS). */
export function setFrontmatterStatus(text, status) {
  const m = FM_RE.exec(text)
  if (!m || !/^implementation_status:/m.test(m[1])) throw new InputError('work order has no frontmatter implementation_status field')
  const fm = m[1].replace(/^implementation_status:[^\n]*/m, `implementation_status: ${status}`)
  return `${text.slice(0, m.index)}---\n${fm}\n---${text.slice(m.index + m[0].length)}`
}

/** The frontmatter as key → its line(s) (a YAML continuation line stays with its key), plus the body after it. */
function fmEntries(text) {
  const m = FM_RE.exec(String(text))
  if (!m) return null
  const entries = new Map()
  let key = ''
  for (const line of m[1].split('\n')) {
    const k = /^([A-Za-z_][\w-]*):/.exec(line)
    if (k) { key = k[1]; entries.set(key, line) } else entries.set(key, `${entries.has(key) ? `${entries.get(key)}\n` : ''}${line}`)
  }
  return { entries, body: String(text).slice(m.index + m[0].length) }
}
/**
 * Is the only difference between two versions of a work order the engine's own frontmatter keys (ENGINE_FM_KEYS)?
 * Anything else (the body, the Status Note, another key) may be an owner's or iterate's edit, never reset.
 * @param {string|null} headText the work order at HEAD
 * @param {string|null} workText the work order in the working tree
 * @returns {boolean}
 */
export function engineOnlyDiff(headText, workText) {
  if (headText === null || headText === undefined || workText === null || workText === undefined) return false
  const a = fmEntries(headText)
  const b = fmEntries(workText)
  if (!a || !b || a.body !== b.body) return false
  return [...new Set([...a.entries.keys(), ...b.entries.keys()])].every((k) => a.entries.get(k) === b.entries.get(k) || ENGINE_FM_KEYS.includes(k))
}

/**
 * Resolve a work-order id to its file: exactly one `docs/frds/<frd>/work-orders/<id>[-slug].md`.
 * @returns {{ id: string, frd: string, rel: string }}
 */
export function findWo(ctx, id) {
  if (!id || !/^WO-[0-9A-Za-z]+-\d+$/i.test(id)) throw new InputError(`not a work-order id: ${JSON.stringify(id)}`)
  const base = path.join(ctx.project, 'docs', 'frds')
  const want = id.toLowerCase()
  const hits = []
  for (const frd of existsSync(base) ? readdirSync(base) : []) {
    const dir = path.join(base, frd, 'work-orders')
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue
    for (const f of readdirSync(dir)) {
      const l = f.toLowerCase()
      if (l === `${want}.md` || (l.startsWith(`${want}-`) && l.endsWith('.md'))) hits.push({ id, frd, rel: `docs/frds/${frd}/work-orders/${f}` })
    }
  }
  if (hits.length !== 1) throw new InputError(`work order ${id}: ${hits.length ? 'more than one' : 'no'} work-order file under docs/frds/*/work-orders/`)
  return hits[0]
}

const AC_ID_RE = /\bAC-\d+-\d+\.\d+(?![0-9])/g
/** The AC ids a work order owns: its "Acceptance criteria" section, else its body before the Status Note. */
export function woAcIds(text) {
  const body = String(text).replace(/^---\r?\n[\s\S]*?\r?\n---/, '')
  const sec = /^##[^\n]*acceptance criteria[^\n]*$/im.exec(body)
  let scope = body
  if (sec) { const rest = body.slice(sec.index + sec[0].length); const end = rest.search(/^##\s/m); scope = end < 0 ? rest : rest.slice(0, end) } else { const sn = body.search(/^##\s+Status Note/im); if (sn >= 0) scope = body.slice(0, sn) }
  return unique(scope.match(AC_ID_RE) || [])
}
/** A work order's id: its frontmatter `id:`, else the `wo-NN-MMM` prefix of its file name. */
export const woIdOf = (rel, text) => fmGet(text, 'id') || (/^(wo-[0-9a-z]+-\d+)/i.exec(path.basename(rel)) || [])[1]?.toUpperCase() || path.basename(rel, '.md')

/**
 * Proposal 39 §2 C7, the stamp-commit window: does HEAD hold a commit that flips this work order to IN_REVIEW
 * AFTER its last IN_PROGRESS stamp commit? History rules (`--no-merges`, ancestry decides, never timestamps, like wo-revert.mjs; plus
 * `--full-history`, so a merge that kept one side's blob cannot prune the other side's stamp out of the walk): a stamp is a commit whose blob reads IN_PROGRESS and whose parent's does not; a flip, the same
 * for IN_REVIEW. With no stamp at all (a classic history, where the dispatch stamp was never committed) any flip
 * counts. A flip that only reached HEAD through a merge of a branch older than the stamp does not.
 * @returns {{ qualifies: boolean, flip: string|null, stamps: string[] }}
 */
export function inReviewWindow(ctx, rel) {
  const shas = ctx.g.must(['rev-list', '--full-history', '--no-merges', 'HEAD', '--', rel]).split('\n').filter(Boolean)
  const at = (rev) => frontmatterStatus(blobAt(ctx, rev, rel))
  const parentAt = (sha) => { const p = ctx.g.run(['rev-parse', '--verify', '-q', `${sha}^`]); return p.ok ? at(p.out.trim()) : 'ABSENT' }
  const stamps = []
  const flips = []
  for (const sha of shas) {
    const now = at(sha)
    if (now !== 'IN_PROGRESS' && now !== 'IN_REVIEW') continue
    if (parentAt(sha) === now) continue
    ;(now === 'IN_PROGRESS' ? stamps : flips).push(sha)
  }
  const after = (a, b) => a !== b && ctx.g.run(['merge-base', '--is-ancestor', a, b]).ok
  const latest = stamps.filter((s) => !stamps.some((o) => after(s, o)))
  const flip = flips.find((f) => latest.every((s) => after(s, f))) || null
  return { qualifies: Boolean(flip), flip, stamps: latest }
}

// ── declared paths ─────────────────────────────────────────────────────────────────────────────
// `**` is swapped for placeholders BEFORE the single `*` rule runs, so its own `.*` is never rewritten to `.[^/]*`.
const globRe = (g) => new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '\u0000').replace(/\*\*/g, '\u0001').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\u0000/g, '(?:.*/)?').replace(/\u0001/g, '.*')}$`)
/** Does a project-relative path fall under one declared entry (exact file, a directory, or a glob)? */
export function matchesDeclared(declared, p) {
  return declared.some((raw) => {
    const d = raw.replace(/^\.\//, '').replace(/\/+$/, '')
    if (!d) return false
    if (/[*?]/.test(d)) return globRe(d).test(p)
    return p === d || p.startsWith(`${d}/`)
  })
}

// ── the main-writer lock ───────────────────────────────────────────────────────────────────────
const lockAgeMs = (dir) => {
  try {
    const at = Date.parse(JSON.parse(readFileSync(path.join(dir, 'owner.json'), 'utf8')).at)
    if (Number.isFinite(at)) return Date.now() - at
  } catch { /* no readable owner yet: fall back to the directory's own age */ }
  try { return Date.now() - statSync(dir).mtimeMs } catch { return 0 }
}
/**
 * Take `.pandacorp/run/main-writer.lock` (mkdir lock). A lock older than LOCK_STALE_MS is reclaimed; a fresh one is
 * waited on for `waitMs`, then refused (`lock-busy`) — never silently skipped.
 * @returns {{ dir: string, owner: string, reclaimed: boolean }}
 */
export function acquireLock(ctx, { waitMs, op }) {
  const dir = path.join(ctx.project, '.pandacorp', 'run', 'main-writer.lock')
  mkdirSync(path.dirname(dir), { recursive: true })
  const owner = `${process.pid}-${randomBytes(8).toString('hex')}`
  const deadline = Date.now() + waitMs
  let reclaimed = false
  for (;;) {
    try {
      mkdirSync(dir)
      writeFileSync(path.join(dir, 'owner.json'), JSON.stringify({ owner, op, pid: process.pid, at: new Date().toISOString() }))
      return { dir, owner, reclaimed }
    } catch (e) { if (e.code !== 'EEXIST') throw e }
    const age = lockAgeMs(dir)
    if (age > LOCK_STALE_MS) {
      const tomb = `${dir}.stale-${owner}`
      try { renameSync(dir, tomb); rmSync(tomb, { recursive: true, force: true }); reclaimed = true } catch (e) { if (!['ENOENT', 'EEXIST', 'ENOTEMPTY'].includes(e.code)) throw e }
      continue
    }
    if (Date.now() >= deadline) throw new Refusal('lock-busy', `the main-writer lock is held (age ${Math.round(age / 1000)}s, stale after ${LOCK_STALE_MS / 60000} min): another writer is on main`)
    sleepSync(200)
  }
}
/** Release a lock this process holds (a reclaimed-by-someone-else lock is left alone). */
export function releaseLock(lock) {
  if (!lock) return
  try {
    const cur = JSON.parse(readFileSync(path.join(lock.dir, 'owner.json'), 'utf8'))
    if (cur.owner === lock.owner) rmSync(lock.dir, { recursive: true, force: true })
  } catch { /* already gone */ }
}

// ── the shared journals ────────────────────────────────────────────────────────────────────────
/**
 * Withdraw the LAST copy of one line this process appended, keeping every other writer's line (never a wholesale
 * rewrite from a snapshot, which would erase a concurrent writer's lines). A file this process created and that is
 * empty again is removed.
 * @param {string} abs the journal's absolute path
 * @param {string} line the exact line (no newline) this process appended
 * @param {boolean} existedBefore whether the file existed before the append
 */
export function withdrawLine(abs, line, existedBefore) {
  if (!existsSync(abs)) return
  const text = readFileSync(abs, 'utf8')
  const at = text.lastIndexOf(`${line}\n`)
  if (at < 0) return
  const rest = text.slice(0, at) + text.slice(at + line.length + 1)
  if (!rest && !existedBefore) rmSync(abs, { force: true }); else writeFileSync(abs, rest)
}
/**
 * Commit whatever the journals hold right now, as their own commit (the "next committer stages it" rule, done by an
 * op that would otherwise leave them dirty). A failed commit unstages them and leaves the lines in place.
 * @returns {{ sha: string|null, paths: string[], error?: string }}
 */
export function commitJournals(ctx, message) {
  const paths = dirtyEntries(ctx).filter((e) => JOURNALS.includes(e.path)).map((e) => e.path)
  if (!paths.length) return { sha: null, paths }
  const add = ctx.g.run(['--literal-pathspecs', 'add', '--', ...paths])
  const c = add.ok ? ctx.g.run(['--literal-pathspecs', 'commit', '-q', '-m', message, '--', ...paths]) : add
  if (!c.ok) { ctx.g.run(['--literal-pathspecs', 'reset', '-q', '--', ...paths]); return { sha: null, paths, error: c.err || 'no output' } }
  return { sha: ctx.g.must(['rev-parse', 'HEAD']).trim().slice(0, 12), paths }
}

// ── salvage then reset ─────────────────────────────────────────────────────────────────────────
export const utcStamp = () => new Date().toISOString().replace(/[:.]/g, '-')
const labelOf = (code) => (code === '??' ? 'untracked' : code.includes('D') ? 'deleted' : 'modified')
/**
 * Copy each dirty entry into `dir` (project-relative layout), THEN reset it to HEAD (untracked → removed).
 * A path whose copy fails is never reset: the copy is the only evidence left.
 * @returns {Array<{ path: string, status: string }>}
 */
export function salvageAndReset(ctx, entries, dir) {
  const out = []
  for (const e of entries) {
    const abs = path.join(ctx.project, e.path)
    let st = null
    try { st = lstatSync(abs) } catch { st = null }
    if (st && st.isFile()) { mkdirSync(path.dirname(path.join(dir, e.path)), { recursive: true }); copyFileSync(abs, path.join(dir, e.path)) }
    if (ctx.g.run(['cat-file', '-e', `HEAD:${ctx.prefix}${e.path}`]).ok) ctx.g.must(['--literal-pathspecs', 'checkout', 'HEAD', '--', e.path])
    else { ctx.g.run(['--literal-pathspecs', 'rm', '-q', '--cached', '--ignore-unmatch', '--', e.path]); rmSync(abs, { force: true }) }
    out.push({ path: e.path, status: labelOf(e.code) })
  }
  return out
}

// ── gate-report provenance (proposal 40 §2: reuse only a script-written report) ─────────────────
/** The whole-project report verify.sh writes, and the seal the scripted ops write next to it. */
export const REPORT_REL = '.pandacorp/run/gate-report.json'
export const PROVENANCE_REL = '.pandacorp/run/gate-report.provenance.json'
const sha256Of = (buf) => createHash('sha256').update(buf).digest('hex')
/**
 * Seal the report a SCRIPTED op just ran (the `verify` USABLE check, the scripted `close`): its content hash, its sha
 * and verdict, the writer. A builder that runs verify.sh by hand rewrites the report and leaves this seal stale, so the
 * close never reuses a report no script produced. The seal detects a rewrite, it is not a security primitive.
 * @param {object} ctx the projectCtx
 * @param {string} writer the op that ran verify.sh
 * @returns {boolean} false when there is no readable report to seal
 */
export function sealReportProvenance(ctx, writer) {
  let bytes
  try { bytes = readFileSync(path.join(ctx.project, REPORT_REL)) } catch { return false }
  let rep = null
  try { rep = JSON.parse(bytes.toString('utf8')) } catch { return false }
  writeFileSync(path.join(ctx.project, PROVENANCE_REL), `${sealLine({ version: 1, op: 'report-provenance', writer, sha: String(rep.sha || ''), scope: String(rep.scope || ''), green: rep.green === true, reportSha256: sha256Of(bytes) })}\n`)
  return true
}
/**
 * Was the report on disk written by a scripted op, byte for byte?
 * @returns {{ ok: boolean, reason: 'script-written'|'not-script-written'|'report-hash-mismatch', writer?: string }}
 */
export function reportProvenance(ctx) {
  let line = ''
  try { line = readFileSync(path.join(ctx.project, PROVENANCE_REL), 'utf8').trim() } catch { return { ok: false, reason: 'not-script-written' } }
  if (!verifySealedLine(line).ok) return { ok: false, reason: 'not-script-written' }
  let prov = null
  try { prov = JSON.parse(line) } catch { return { ok: false, reason: 'not-script-written' } }
  if (!prov || prov.op !== 'report-provenance' || !prov.writer) return { ok: false, reason: 'not-script-written' }
  let bytes
  try { bytes = readFileSync(path.join(ctx.project, REPORT_REL)) } catch { return { ok: false, reason: 'not-script-written' } }
  return sha256Of(bytes) === prov.reportSha256 ? { ok: true, reason: 'script-written', writer: prov.writer } : { ok: false, reason: 'report-hash-mismatch', writer: prov.writer }
}
