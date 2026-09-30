#!/usr/bin/env node
// audit-last-green.mjs — BL-0190: post-run audit that every `last_green_sha` publication certifies
// ONLY commits of FRDs the gate had already VERIFIED.
//
// Why it exists (red-team X5, proposal 38): the BL-0066 two-commit protocol publishes `last_green_sha`
// = A (the snapshot the gate certified). The scheduler also lands other commits on main between
// landings — build waves of FRDs that are still IN_REVIEW, a safe-point drain, in-run retry rebuilds —
// so a later publication can "certify" (be an ancestor-or-equal of the pin over) commits whose FRD no
// gate has judged. `verify.sh --since <pin>` proves the combination is green, not that it was reviewed.
//
// The audit reconstructs the evidence from two independent logs and never rewrites history:
//   - git: every commit that CHANGED `last_green_sha` in the project's status.yaml is a publication;
//     the commits it certifies are `git log <prevPin>..<pin>` restricted to the project.
//   - the build timeline (`.pandacorp/track.jsonl`): per FRD, `frd_end` = verified, any `wo_*` event or
//     a non-pass `review_end` = unverified work exists again. An FRD is VERIFIED at the publication's
//     commit time iff its latest event at/before that time is `frd_end`.
// Timestamps of the landing itself (frd_end vs the publication commit) differ by up to ~1 min, so the FRD
// state is read at the publication time plus a small grace (--grace-seconds, default 90).
// A certified commit is classified from its subject (frd-NN / WO-NN-MMM) or, failing that, the work-order files
// it touches (frd.md/blueprint.md are rollup surfaces a gate rewrites across sibling FRDs, so they attribute nothing); a commit that touches only docs/, .pandacorp/ or markdown is metadata and never a violation.
// A code commit with no attributable FRD is reported as `unattributed` (visible, not a violation).
//
// Exit: 0 clean · 1 at least one violation · 2 the inputs cannot be interpreted (malformed track line,
// unreadable status.yaml, pin that is not a commit) — it never reports a quiet success on a source it
// could not read (DR-078).
//
// Usage: node audit-last-green.mjs [--project <dir>] [--track <file>] [--ref <git-ref>]
//                                  [--from <sha|ISO>] [--last <N>] [--grace-seconds <S>] [--record] [--json]

import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_LAST = 10
// The publication commit (B) lands seconds BEFORE or AFTER the `frd_end` line the same landing stamps
// (measured on the canary E2/F1/F2 archives: -8 s to +61 s), so a verification within this grace of the
// publication is the SAME landing, not a later one.
const DEFAULT_GRACE_MS = 90_000
const PIN_RE = /^last_green_sha:\s*["']?([0-9a-f]{7,40})["']?\s*(?:#.*)?$/m
const FRD_KEY_RE = /\bfrd-(\d+)/gi
const WO_KEY_RE = /\bWO-(\d+)-\d+/gi
const WO_PATH_RE = /^docs\/frds\/frd-(\d+)[^/]*\/work-orders\//i
const METADATA_RE = /^(docs\/|\.pandacorp\/|\.claude\/|[^/]+\.md$)/
const VERIFIED_KIND = 'frd_end'
const DIRTY_KINDS = new Set(['wo_start', 'wo_end', 'wo_review', 'wo_done', 'wo_reopen', 'wo_blocked'])

/** An input the audit cannot interpret — mapped to exit 2, never to a silent empty result. */
export class AuditInputError extends Error {}

const frdKey = (n) => `frd-${String(n).padStart(2, '0')}`

/**
 * Parses a build timeline into per-FRD ordered events. Fails loud on a line that is not JSON, or an
 * FRD-scoped event without a parseable `at` (ISO strings are compared through Date.parse — fractional
 * seconds and offsets differ between emitters, so never lexicographically).
 * @param {string} text track.jsonl contents
 * @returns {Map<string, Array<{ms:number, kind:string, verdict:string|null, idx:number}>>}
 */
export function parseTrack(text) {
  const byFrd = new Map()
  const lines = String(text).split('\n')
  let relevant = 0
  lines.forEach((raw, i) => {
    if (!raw.trim()) return
    let obj
    try { obj = JSON.parse(raw) } catch { throw new AuditInputError(`track line ${i + 1} is not valid JSON`) }
    if (!obj || typeof obj !== 'object' || typeof obj.kind !== 'string') throw new AuditInputError(`track line ${i + 1} has no string "kind"`)
    if (typeof obj.frd !== 'string') return
    const m = obj.frd.match(/^frd-(\d+)/i)
    if (!m) return
    if (obj.kind !== VERIFIED_KIND && obj.kind !== 'review_end' && !DIRTY_KINDS.has(obj.kind)) return
    const ms = Date.parse(obj.at)
    if (!Number.isFinite(ms)) throw new AuditInputError(`track line ${i + 1} (${obj.kind} ${obj.frd}) has an unparseable "at"`)
    const key = frdKey(m[1])
    if (!byFrd.has(key)) byFrd.set(key, [])
    byFrd.get(key).push({ ms, kind: obj.kind, verdict: typeof obj.verdict === 'string' ? obj.verdict : null, idx: i })
    relevant++
  })
  if (relevant === 0) throw new AuditInputError('track has no FRD lifecycle events — nothing to audit against')
  for (const events of byFrd.values()) events.sort((a, b) => a.ms - b.ms || a.idx - b.idx)
  return byFrd
}

/**
 * Whether an FRD is VERIFIED at time `atMs`: its latest lifecycle event at/before that time is `frd_end`.
 * An FRD with no event at all is unverified (fail-closed).
 * @returns {{verified:boolean, last:string, laterVerifiedMs:number|null}} `laterVerifiedMs` = the next `frd_end` after `atMs`
 */
export function frdStateAt(byFrd, key, atMs) {
  let last = null
  for (const ev of byFrd.get(key) || []) {
    if (ev.ms > atMs) break
    if (ev.kind === VERIFIED_KIND) last = { kind: 'verified', ev }
    else if (ev.kind === 'review_end') { if (ev.verdict !== 'pass') last = { kind: ev.kind, ev } }
    else last = { kind: ev.kind, ev }
  }
  const next = (byFrd.get(key) || []).find((ev) => ev.kind === VERIFIED_KIND && ev.ms > atMs)
  const laterVerifiedMs = next ? next.ms : null
  if (!last) return { verified: false, last: 'no lifecycle event yet', laterVerifiedMs }
  const stamp = new Date(last.ev.ms).toISOString()
  return { verified: last.kind === 'verified', last: `${last.ev.kind}${last.ev.verdict ? `:${last.ev.verdict}` : ''} @ ${stamp}`, laterVerifiedMs }
}

/**
 * Classifies one certified commit. `files` are project-relative.
 * @returns {{kind:'metadata'|'frd'|'unattributed', frds:string[]}}
 */
export function classifyCommit({ subject, files }) {
  if (files.length > 0 && files.every((f) => METADATA_RE.test(f))) return { kind: 'metadata', frds: [] }
  const frds = new Set()
  for (const m of subject.matchAll(FRD_KEY_RE)) frds.add(frdKey(m[1]))
  for (const m of subject.matchAll(WO_KEY_RE)) frds.add(frdKey(m[1]))
  if (frds.size === 0) for (const f of files) { const m = f.match(WO_PATH_RE); if (m) frds.add(frdKey(m[1])) }
  return frds.size ? { kind: 'frd', frds: [...frds].sort() } : { kind: 'unattributed', frds: [] }
}

const gitRun = (cwd, args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  return { ok: r.status === 0, out: r.stdout || '', err: (r.stderr || '').trim() }
}
const gitOrThrow = (cwd, args) => {
  const r = gitRun(cwd, args)
  if (!r.ok) throw new AuditInputError(`git ${args.join(' ')} failed: ${r.err || 'no output'}`)
  return r.out
}

/**
 * Lists every publication on `ref`'s first-parent chain, oldest first: a commit that changed the
 * `last_green_sha` value in the project's status.yaml. `prev` is the value at the parent, or — when the
 * parent carried none (a run reset it) — the most recent pin published earlier.
 */
export function listPublications(repo, ref, statusRel) {
  const log = gitOrThrow(repo, ['log', '--first-parent', '--reverse', '-G', 'last_green_sha', '--format=%H%x09%cI', ref, '--', statusRel])
  const pubs = []
  let lastKnown = null
  for (const row of log.split('\n').filter(Boolean)) {
    const [sha, iso] = row.split('\t')
    const at = gitRun(repo, ['show', `${sha}:${statusRel}`])
    const before = gitRun(repo, ['show', `${sha}^:${statusRel}`])
    const pin = at.ok ? (at.out.match(PIN_RE) || [])[1] || null : null
    const parentPin = before.ok ? (before.out.match(PIN_RE) || [])[1] || null : null
    if (pin && pin !== parentPin) pubs.push({ sha, atMs: Date.parse(iso), pin, prev: parentPin || lastKnown })
    if (pin) lastKnown = pin
  }
  return pubs
}

/** Commits a publication certifies: the project's non-merge commits in `prev..pin`, with project-relative files. */
function certifiedCommits(repo, prefix, prev, pin) {
  const out = gitOrThrow(repo, ['log', '--no-merges', '--name-only', '--format=%x1e%H%x1f%cI%x1f%s', pin, `^${prev}`, '--', prefix || '.'])
  return out.split('\x1e').filter((r) => r.trim()).map((rec) => {
    const [head, ...rest] = rec.split('\n')
    const [sha, iso, subject] = head.split('\x1f')
    const files = rest.filter(Boolean).map((f) => (prefix && f.startsWith(prefix) ? f.slice(prefix.length) : f))
    return { sha, atMs: Date.parse(iso), subject: subject || '', files }
  })
}

/**
 * Audits the selected publications against the track.
 * @returns {{publications:object[], violations:object[], unattributed:object[], notes:string[]}}
 */
export function auditPublications({ repo, prefix, pubs, byFrd, graceMs = DEFAULT_GRACE_MS }) {
  const publications = []
  const violations = []
  const unattributed = []
  const notes = []
  for (const pub of pubs) {
    const short = pub.sha.slice(0, 8)
    if (!pub.prev) { notes.push(`${short}: first publication on the chain — no previous pin to bound the range, not audited`); continue }
    if (!gitRun(repo, ['cat-file', '-e', `${pub.pin}^{commit}`]).ok) throw new AuditInputError(`publication ${short} pins ${pub.pin}, which is not a commit in this repository`)
    if (!gitRun(repo, ['cat-file', '-e', `${pub.prev}^{commit}`]).ok) throw new AuditInputError(`publication ${short} follows pin ${pub.prev}, which is not a commit in this repository`)
    if (!gitRun(repo, ['merge-base', '--is-ancestor', pub.prev, pub.pin]).ok) notes.push(`${short}: previous pin ${pub.prev.slice(0, 8)} is not an ancestor of ${pub.pin.slice(0, 8)} — range is the symmetric difference`)
    const commits = certifiedCommits(repo, prefix, pub.prev, pub.pin)
    let checked = 0
    for (const c of commits) {
      const cls = classifyCommit(c)
      if (cls.kind === 'metadata') continue
      if (cls.kind === 'unattributed') { unattributed.push({ publication: short, commit: c.sha.slice(0, 8), subject: c.subject }); continue }
      checked++
      for (const frd of cls.frds) {
        const st = frdStateAt(byFrd, frd, pub.atMs + graceMs)
        if (st.verified) continue
        const windowMin = st.laterVerifiedMs ? Math.round((st.laterVerifiedMs - pub.atMs) / 60000) : null
        const later = windowMin === null ? 'and never verified in this timeline' : `verified ${windowMin} min after the publication`
        violations.push({ publication: short, pin: pub.pin.slice(0, 8), commit: c.sha.slice(0, 8), subject: c.subject, frd, windowMin, reason: `${frd} was not VERIFIED at the publication (${st.last}; ${later})` })
      }
    }
    publications.push({ publication: short, pin: pub.pin.slice(0, 8), prev: pub.prev.slice(0, 8), at: new Date(pub.atMs).toISOString(), certifiedCommits: commits.length, frdCommitsChecked: checked })
  }
  return { publications, violations, unattributed, notes }
}

function parseArgs(argv) {
  const opts = { project: process.cwd(), last: DEFAULT_LAST, ref: 'HEAD', record: false, json: false, graceMs: DEFAULT_GRACE_MS }
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    if (key === '--record') { opts.record = true; continue }
    if (key === '--json') { opts.json = true; continue }
    const value = argv[i + 1]
    if (!key.startsWith('--') || value === undefined) throw new AuditInputError(`bad argument ${JSON.stringify(key)}`)
    i++
    if (key === '--project') opts.project = path.resolve(value)
    else if (key === '--track') opts.track = path.resolve(value)
    else if (key === '--ref') opts.ref = value
    else if (key === '--from') opts.from = value
    else if (key === '--last') { opts.last = Number(value); if (!Number.isInteger(opts.last) || opts.last < 1) throw new AuditInputError('--last must be a positive integer') }
    else if (key === '--grace-seconds') { const g = Number(value); if (!Number.isFinite(g) || g < 0) throw new AuditInputError('--grace-seconds must be >= 0'); opts.graceMs = g * 1000 }
    else throw new AuditInputError(`unknown option ${key}`)
  }
  return opts
}

function selectPublications(pubs, opts, repo) {
  if (!opts.from) return pubs.slice(-opts.last)
  if (/^\d{4}-\d{2}-\d{2}/.test(opts.from)) {
    const fromMs = Date.parse(opts.from)
    if (!Number.isFinite(fromMs)) throw new AuditInputError(`--from ${opts.from} is not a parseable date`)
    return pubs.filter((p) => p.atMs >= fromMs)
  }
  const from = gitOrThrow(repo, ['rev-parse', '--verify', `${opts.from}^{commit}`]).trim()
  return pubs.filter((p) => p.sha === from || gitRun(repo, ['merge-base', '--is-ancestor', from, p.sha]).ok)
}

function render(result, asJson) {
  if (asJson) return `${JSON.stringify(result)}\n`
  const lines = [`audit-last-green: ${result.publications.length} publication(s) audited, ${result.violations.length} violation(s), ${result.unattributed.length} unattributed code commit(s)`]
  for (const p of result.publications) lines.push(`  ${p.publication} pin ${p.pin} (since ${p.prev}) @ ${p.at}: ${p.certifiedCommits} commit(s), ${p.frdCommitsChecked} FRD commit(s) checked`)
  for (const n of result.notes) lines.push(`  note: ${n}`)
  for (const v of result.violations) lines.push(`  VIOLATION ${v.publication}: ${v.commit} "${v.subject}" — ${v.reason}`)
  for (const u of result.unattributed) lines.push(`  unattributed ${u.publication}: ${u.commit} "${u.subject}"`)
  return `${lines.join('\n')}\n`
}

/** CLI entry. Returns the process exit code; writes the report to stdout. */
export function main(argv) {
  const opts = parseArgs(argv)
  const repo = gitOrThrow(opts.project, ['rev-parse', '--show-toplevel']).trim()
  const prefix = gitOrThrow(opts.project, ['rev-parse', '--show-prefix']).trim()
  const statusRel = `${prefix}.pandacorp/status.yaml`
  const trackFile = opts.track || path.join(opts.project, '.pandacorp', 'track.jsonl')
  if (!existsSync(trackFile)) throw new AuditInputError(`track file not found: ${trackFile}`)
  const byFrd = parseTrack(readFileSync(trackFile, 'utf8'))
  const all = listPublications(repo, opts.ref, statusRel)
  if (all.length === 0) throw new AuditInputError(`no last_green_sha publication found in ${statusRel} on ${opts.ref}`)
  const pubs = selectPublications(all, opts, repo)
  const result = auditPublications({ repo, prefix, pubs, byFrd, graceMs: opts.graceMs })
  process.stdout.write(render(result, opts.json))
  if (opts.record) {
    const line = { kind: 'last_green_audit', at: new Date().toISOString(), publications: result.publications.length, violations: result.violations.length, unattributed: result.unattributed.length, violationDetail: result.violations.map((v) => `${v.publication}:${v.commit}:${v.frd}`) }
    appendFileSync(trackFile, `${JSON.stringify(line)}\n`)
  }
  return result.violations.length > 0 ? 1 : 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    if (!(e instanceof AuditInputError)) throw e
    process.stderr.write(`audit-last-green: cannot audit — ${e.message}\n`)
    process.exit(2)
  }
}
