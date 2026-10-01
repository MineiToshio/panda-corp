// build-mech-lib.mjs — shared, deterministic helpers of pandacorp-build-mech.mjs (proposal 39 §2 C1/C2): the git
// view of ONE project (nested or flat, BL-0202), the main-writer lock, work-order frontmatter, and salvage-then-reset.
// No CLI here; every function either returns a value or throws a typed error the CLI turns into one sealed line.

import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export const REFUSED_EXIT = 4
export const INPUT_EXIT = 2
/** A main-writer lock older than this is a crashed writer's residue (proposal 39 §2 C2). */
export const LOCK_STALE_MS = 10 * 60 * 1000
/** Append-only journals every commit sweeps in (shared, never a WO's own artifact). */
export const JOURNALS = Object.freeze(['.pandacorp/track.jsonl', '.pandacorp/build-journal.jsonl'])
/** The lease projection: written by the fenced state CLI while a run holds the lease, committed by that writer only. */
export const PROJECTION = '.pandacorp/status.yaml'
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

// ── declared paths ─────────────────────────────────────────────────────────────────────────────
const globRe = (g) => new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '\u0000').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\u0000/g, '(?:.*/)?')}$`)
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
