#!/usr/bin/env node
// wo-revert.mjs — BL-0212: discard a rejected work order's OWN commits, deterministically, never by a model.
//
// Why it exists. Every discard of rejected code used to restore the work order's files "to last_green_sha".
// But a publication is the whole main tree (build-orchestration.md, "What `last_green_sha` certifies"): with
// parallel gates, build waves between landings and every carry-over work order, the pin already CONTAINS
// IN_REVIEW work of FRDs whose gate has not landed. For such a work order its files at the pin ARE its rejected
// build, so the restore changed nothing, silently — the retry rebuilt on top of the rejected code and a BLOCKED
// work order's broken code stayed on main (the pollution DR-070 exists to prevent).
//
// What it does. For the given work orders it finds the commits of their CURRENT attempt from git history (never
// from a model): the first commit that flipped each work order's frontmatter to IN_REVIEW since it was last
// VERIFIED opens the window; inside it, a commit belongs to the attempt when it touches the work order's own
// file or names it in its subject (and touches no other work order's file — a sibling's build that only mentions
// it as a dependency is not its work), or when it is an FRD-level commit of this FRD only (a patch, a repair) that
// no later PASS landing of this FRD certified (then it is the verified sibling's work, kept).
// Then, per file those commits touched (never `.pandacorp/**`, never `docs/frds/**` — frontmatter, rollups and
// status belong to the engine's own commits):
//   - the file's first touch by the attempt is NOT in a valid pin and no other commit touched it since the pin →
//     restore it to the pin (the pre-BL-0212 behaviour: the pin cannot hold any of this attempt's work on that
//     file; a later commit of another work order on it would be wiped, so that case takes the revert path);
//   - otherwise → revert the attempt's commits on that file: no other commit touched it since → restore the
//     content before the attempt's first touch; another commit did (a shared file) → a sequential 3-way reverse
//     merge (`git merge-file`), newest first, which keeps the other commit's edit.
// Any conflict, an uncommitted change on a target path (unless the file on disk already is what the revert commits),
// a mixed commit (it flips a selected work order AND another one, with code: its files cannot be attributed), or a
// work order in the wrong state refuses the WHOLE plan: nothing is written (never a partial revert), exit 4, and a
// RevertRefused event is appended.
//
// Modes: `plan` computes and prints; `apply` writes, stages and commits exactly the changed paths (one commit
// naming the FRD and the work orders, so the next revert attributes it too); `replay` re-prints a stored line;
// `recover` finishes a discard an interrupted run left behind (BL-0215, below).
// Output: ONE sealed JSON line (drift-seal.mjs) — the engine reads it through a model and verifies the seal.
// Exit: 0 reverted/nothing · 4 refused (conflict | dirty | refused) · 2 unusable input or a git failure.
//
// Interrupted discards (BL-0215). The engine discards in two steps — the state flip commit (PLANNED / BLOCKED), then
// `apply` — and a run cut between them (the supervisor's external brake, a crash) leaves the flipped work order over
// its rejected code. Git alone cannot tell that state from a deliberate one (an owner-unblocked work order, a repair
// that kept its code), so the engine records the INTENT first: `plan --record-intent <S>` writes
// `.pandacorp/run/wo-revert/pending-<frd>.json` (gitignored runtime state: the work orders, the status the flip will
// leave them in, the seam) when there is an attempt to discard; every `apply` — whatever its outcome — consumes it.
// A marker still present at the next run start is therefore exactly an interrupted discard: `recover` re-runs the
// discard for the marker's work orders that are STILL in the recorded status (same seam, same attribution), commits
// it, and clears the marker. A work order in any other status was moved on by someone else: nothing is discarded.
// Idempotent: a second `recover` (or an `apply` after one) finds no marker / nothing left to undo.
//
// Usage: wo-revert.mjs plan|apply --project <dir> --frd <frd-folder> --wo <id> [--wo <id>…] [--seam <path>…]
//          [--require-status <S> | --only-status <S>] [--expect-change] [--record-intent PLANNED|BLOCKED]
//          [--pin <sha>] [--project-name <n>] [--out <file>] [--events <file>]
//        wo-revert.mjs recover --project <dir> --frd <frd-folder> [--project-name <n>] [--out <file>] [--events <file>]
//        wo-revert.mjs replay --project <dir> --file <out>

import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sealLine } from './drift-seal.mjs'

const PROTECTED_RE = /^(\.pandacorp\/|docs\/frds\/)/
const WO_FILE_RE = /^docs\/frds\/[^/]+\/work-orders\/(?!README\.md$)[^/]+\.md$/i
const WO_TOKEN_RE = /\bWO-[0-9A-Za-z]+-\d+\b/gi
const FRD_TOKEN_RE = /\bfrd-(\d+)/gi
const PIN_RE = /^last_green_sha:\s*["']?([0-9a-f]{7,40})["']?\s*(?:#.*)?$/m
const REFUSED_EXIT = 4
const INTENT_STATUSES = new Set(['PLANNED', 'BLOCKED'])
const INPUT_EXIT = 2

/** An input the script cannot act on — exit 2, never a quiet success. */
class InputError extends Error {}

const sameBlob = (a, b) => (a === null || b === null ? a === b : Buffer.compare(a, b) === 0)
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const idRe = (id) => new RegExp(`(?<![0-9A-Za-z])${escapeRe(id)}(?![0-9A-Za-z])`, 'i')

function gitIn(cwd) {
  const run = (args, opts = {}) => {
    const r = spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd, encoding: opts.buffer ? 'buffer' : 'utf8', maxBuffer: 512 * 1024 * 1024, input: opts.input })
    return { ok: r.status === 0, status: r.status, out: r.stdout, err: String(r.stderr || '').trim() }
  }
  const must = (args, opts) => {
    const r = run(args, opts)
    if (!r.ok) throw new InputError(`git ${args.join(' ')} failed: ${r.err || 'no output'}`)
    return r.out
  }
  return { run, must }
}

/** `implementation_status` of a work-order file's FRONTMATTER (the body may mention the field in prose). */
export function frontmatterStatus(text) {
  if (text === null) return 'ABSENT'
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(text))
  if (!m) return 'UNKNOWN'
  const s = /^implementation_status:\s*['"]?([A-Za-z_]+)['"]?\s*(?:#.*)?$/m.exec(m[1])
  return s ? s[1].toUpperCase() : 'UNKNOWN'
}

function parseArgs(argv) {
  const mode = argv[0]
  if (!['plan', 'apply', 'replay', 'recover'].includes(mode)) throw new InputError(`first argument must be plan|apply|replay|recover, got ${JSON.stringify(mode)}`)
  const o = { mode, wos: [], seam: [], expectChange: false }
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--expect-change') { o.expectChange = true; continue }
    const v = argv[i + 1]
    if (!k.startsWith('--') || v === undefined) throw new InputError(`bad argument ${JSON.stringify(k)}`)
    i++
    if (k === '--project') o.project = path.resolve(v)
    else if (k === '--frd') o.frd = v
    else if (k === '--wo') o.wos.push(v)
    else if (k === '--seam') o.seam.push(v.replace(/^\.\//, ''))
    else if (k === '--require-status') o.requireStatus = v.toUpperCase()
    else if (k === '--only-status') o.onlyStatus = v.toUpperCase()
    else if (k === '--record-intent') o.recordIntent = v.toUpperCase()
    else if (k === '--pin') o.pin = v
    else if (k === '--project-name') o.projectName = v
    else if (k === '--out') o.out = v
    else if (k === '--events') o.events = v
    else if (k === '--file') o.file = v
    else throw new InputError(`unknown option ${k}`)
  }
  if (!o.project) throw new InputError('--project is required')
  if (mode === 'replay') { if (!o.file) throw new InputError('replay needs --file'); return o }
  if (!o.frd || !/^frd-\d+/i.test(o.frd) || o.frd.includes('/')) throw new InputError('--frd must be an FRD folder name (frd-NN-…)')
  if (mode !== 'recover' && !o.wos.length) throw new InputError('at least one --wo is required')
  if (o.recordIntent && (mode !== 'plan' || !INTENT_STATUSES.has(o.recordIntent))) throw new InputError('--record-intent PLANNED|BLOCKED is only valid on plan')
  if (o.requireStatus && o.onlyStatus) throw new InputError('--require-status and --only-status are exclusive')
  return o
}

function emit(opts, event, extra) {
  const file = opts.events || path.join(os.homedir(), '.claude', 'dashboard-events.ndjson')
  try {
    mkdirSync(path.dirname(file), { recursive: true })
    appendFileSync(file, `${JSON.stringify({ event, at: new Date().toISOString(), project: opts.projectName || path.basename(opts.project), frd: opts.frd, ...extra })}\n`)
  } catch (e) {
    process.stderr.write(`wo-revert: could not append the ${event} event (${e.message})\n`)
  }
}

/**
 * Computes the revert plan (pure over git state; writes nothing).
 * @returns {object} the receipt body (without seal) plus private `_writes`
 */
export function computePlan(opts) {
  const pgit = gitIn(opts.project)
  const top = pgit.must(['rev-parse', '--show-toplevel']).trim()
  const prefix = pgit.must(['rev-parse', '--show-prefix']).trim()
  const g = gitIn(top)
  const head = g.must(['rev-parse', 'HEAD']).trim()
  const repoPath = (rel) => `${prefix}${rel}`
  const projPath = (rp) => (prefix && rp.startsWith(prefix) ? rp.slice(prefix.length) : rp)
  const blob = (rev, rp) => {
    if (!rev) return null
    const r = g.run(['cat-file', 'blob', `${rev}:${rp}`], { buffer: true })
    return r.ok ? r.out : null
  }
  const parentOf = (sha) => { const r = g.run(['rev-parse', '--verify', '-q', `${sha}^`]); return r.ok ? r.out.trim() : null }
  const isAncestor = (a, b) => g.run(['merge-base', '--is-ancestor', a, b]).ok

  // The pin: explicit, else the working status.yaml (controller-owned, read-only here).
  let pin = opts.pin || null
  if (!pin) {
    const sy = path.join(opts.project, '.pandacorp', 'status.yaml')
    const m = existsSync(sy) ? PIN_RE.exec(readFileSync(sy, 'utf8')) : null
    pin = m ? m[1] : null
  }
  let pinSha = null
  if (pin) { const r = g.run(['rev-parse', '--verify', '-q', `${pin}^{commit}`]); pinSha = r.ok ? r.out.trim() : null }
  const pinValid = Boolean(pinSha) && isAncestor(pinSha, head)

  // Resolve each work order's own file under this FRD.
  const woDir = path.join(opts.project, 'docs', 'frds', opts.frd, 'work-orders')
  const woFiles = existsSync(woDir) ? readdirSync(woDir) : []
  const wos = opts.wos.map((id) => {
    const matches = woFiles.filter((f) => { const l = f.toLowerCase(); const i = id.toLowerCase(); return l === `${i}.md` || l.startsWith(`${i}-`) })
    if (matches.length !== 1) throw new InputError(`work order ${id}: ${matches.length === 0 ? 'no' : 'more than one'} work-order file under docs/frds/${opts.frd}/work-orders/`)
    const md = repoPath(`docs/frds/${opts.frd}/work-orders/${matches[0]}`)
    const text = blob(head, md)
    return { id, md, headStatus: frontmatterStatus(text ? text.toString('utf8') : null) }
  })

  // State gate: strict (--require-status refuses) or filter (--only-status keeps the matching ones).
  const wrongState = opts.requireStatus ? wos.filter((w) => w.headStatus !== opts.requireStatus) : []
  if (wrongState.length) {
    return { status: 'refused', reason: `${wrongState.map((w) => `${w.id} is ${w.headStatus} at HEAD`).join('; ')}, expected ${opts.requireStatus} — the state flip must be committed before its code is discarded; nothing was reverted`, head, pinSha, pinValid, wos: wos.map((w) => ({ id: w.id, status: w.headStatus })), files: [], _writes: [] }
  }
  const selected = opts.onlyStatus ? wos.filter((w) => w.headStatus === opts.onlyStatus) : wos
  const skipped = wos.filter((w) => !selected.includes(w)).map((w) => ({ id: w.id, status: w.headStatus }))

  // The window of each work order's current attempt: its first flip to IN_REVIEW since it was last VERIFIED.
  for (const w of selected) {
    const shas = g.must(['rev-list', '--no-merges', '--topo-order', '--reverse', head, '--', w.md]).split('\n').filter(Boolean)
    let prev = 'ABSENT'
    let start = null
    for (const sha of shas) {
      const b = blob(sha, w.md)
      const st = frontmatterStatus(b ? b.toString('utf8') : null)
      if (st === 'VERIFIED') start = null
      else if (st === 'IN_REVIEW' && prev !== 'IN_REVIEW' && start === null) start = sha
      prev = st
    }
    w.start = start
  }
  const active = selected.filter((w) => w.start)
  const base = { head, pinSha, pinValid, skipped, wos: selected.map((w) => ({ id: w.id, status: w.headStatus, attempt: w.start ? w.start.slice(0, 8) : null })) }
  if (!active.length) return { ...base, status: 'nothing', reason: 'no committed attempt to revert (no flip to IN_REVIEW since the last VERIFIED)', files: [], commits: [], _writes: [] }

  // Earliest window start (linear history in practice; ancestry decides, never timestamps).
  let earliest = active[0].start
  for (const w of active.slice(1)) if (isAncestor(w.start, earliest)) earliest = w.start
  const rangeBase = parentOf(earliest)
  // --no-renames: a rename must list BOTH paths, or reverting it would delete the new name and never restore the
  // old one (a pre-existing file lost). -z: a path git would C-quote (a quote, a backslash) is still matched exactly.
  const logArgs = ['log', '-z', '--no-merges', '--no-renames', '--topo-order', '--reverse', '--name-only', '--format=%x1e%H%x1f%s', rangeBase ? `${rangeBase}..${head}` : head, '--', prefix || '.']
  const range = g.must(logArgs).split('\x1e').filter((r) => r.trim()).map((rec) => {
    const nul = rec.indexOf('\0')
    const [sha, subject] = (nul < 0 ? rec : rec.slice(0, nul)).trim().split('\x1f')
    return { sha, subject: subject || '', files: (nul < 0 ? '' : rec.slice(nul + 1)).replace(/^\n/, '').split('\0').filter(Boolean) }
  })
  const index = new Map(range.map((c, i) => [c.sha, i]))
  const startIdx = new Map(active.map((w) => [w.id, index.get(w.start)]))
  const frdNum = Number(/^frd-(\d+)/i.exec(opts.frd)[1])
  const selectedMd = new Set(active.map((w) => w.md))
  const ownWoDir = repoPath(`docs/frds/${opts.frd}/work-orders/`)
  const isCode = (rp) => (!prefix || rp.startsWith(prefix)) && !PROTECTED_RE.test(projPath(rp))
  // A PASS landing of THIS FRD after a commit certified it: the commit that flipped a sibling work order of this FRD
  // (never a selected one — its own flip would have closed its window) to VERIFIED.
  let lastCertified = -1
  range.forEach((c, i) => {
    if (c.files.some((f) => f.startsWith(ownWoDir) && WO_FILE_RE.test(projPath(f)) && !selectedMd.has(f) && (() => { const b = blob(c.sha, f); return frontmatterStatus(b ? b.toString('utf8') : null) === 'VERIFIED' })())) lastCertified = i
  })
  // A commit belongs to the attempt: it touches a selected work order's own file inside that work order's
  // window; else, touching NO work-order file at all (a sibling's build always touches its own), it names a
  // selected work order inside its window, or it is an FRD-level commit of THIS FRD only whose every named
  // work order is a selected one inside its window (a patch, a repair — never an earlier cycle's stamp) and that
  // no later PASS landing of this FRD certified (an anonymous commit a sibling's gate accepted is that sibling's
  // work — a repair committed without naming its work order, the pre-BL-0212 prompt format).
  const inWindow = (i) => active.filter((w) => i >= startIdx.get(w.id))
  const belongs = (c, i) => {
    const open = inWindow(i)
    if (open.some((w) => c.files.includes(w.md))) return true
    if (c.files.some((f) => WO_FILE_RE.test(projPath(f)))) return false
    if (open.some((w) => idRe(w.id).test(c.subject))) return true
    const frds = new Set([...c.subject.matchAll(FRD_TOKEN_RE)].map((m) => Number(m[1])))
    const woTokens = [...c.subject.matchAll(WO_TOKEN_RE)].map((m) => m[0].toLowerCase())
    return frds.size === 1 && frds.has(frdNum) && woTokens.every((t) => open.some((w) => w.id.toLowerCase() === t)) && i > lastCertified
  }
  const attempt = range.filter((c, i) => belongs(c, i))
  const inAttempt = new Set(attempt.map((c) => c.sha))
  const seam = opts.seam.length ? new Set(opts.seam.map(repoPath)) : null
  const targets = [...new Set(attempt.flatMap((c) => c.files))]
    .filter(isCode)
    .filter((rp) => !seam || seam.has(rp))
    .sort()

  const common = { ...base, commits: attempt.map((c) => c.sha.slice(0, 8)), seamUntouched: seam ? [...seam].filter((rp) => !targets.includes(rp)).map(projPath) : [] }
  // A MIXED commit — one that flips a selected work order's file AND another work order's, and carries code — holds
  // work of both, and nothing in git says which file is whose: reverting it whole would discard the other work
  // order's code (a VERIFIED sibling's included). Refuse the whole plan, never guess.
  const mixed = attempt.filter((c) => c.files.some((f) => selectedMd.has(f)) && c.files.some((f) => WO_FILE_RE.test(projPath(f)) && !selectedMd.has(f)) && c.files.some(isCode))
  if (mixed.length) {
    const others = [...new Set(mixed.flatMap((c) => c.files.filter((f) => WO_FILE_RE.test(projPath(f)) && !selectedMd.has(f)).map((f) => path.basename(f, '.md'))))]
    return { ...common, status: 'refused', reason: `commit(s) ${mixed.map((c) => c.sha.slice(0, 8)).join(', ')} also carry the work of ${others.join(', ')} (a mixed commit): their files cannot be attributed to one work order — nothing was reverted`, mixed: mixed.map((c) => c.sha.slice(0, 8)), files: [], _writes: [] }
  }

  const dirtyOut = targets.length ? g.must(['--literal-pathspecs', 'status', '--porcelain', '-z', '--no-renames', '--untracked-files=all', '--', ...targets]) : ''
  const dirtyRp = dirtyOut.split('\0').filter(Boolean).map((l) => l.slice(3))
  const onDisk = (rp) => { const abs = path.join(top, rp); return existsSync(abs) ? readFileSync(abs) : null }

  const tmp = mkdtempSync(path.join(os.tmpdir(), 'wo-revert-'))
  try {
    // One commit's reverse on one file: base = the file AT the commit, theirs = its parent's (null = absent).
    const merge3 = (ours, baseB, theirs) => {
      if (sameBlob(ours, baseB)) return { ok: true, out: theirs }
      if (sameBlob(ours, theirs) || sameBlob(baseB, theirs)) return { ok: true, out: ours }
      if (ours === null || baseB === null || theirs === null) return { ok: false }
      if (ours.includes(0) || baseB.includes(0) || theirs.includes(0)) return { ok: false }
      const [o, b, t] = ['ours', 'base', 'theirs'].map((n) => path.join(tmp, n))
      writeFileSync(o, ours); writeFileSync(b, baseB); writeFileSync(t, theirs)
      const r = spawnSync('git', ['merge-file', '-p', o, b, t], { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 })
      return r.status === 0 ? { ok: true, out: r.stdout } : { ok: false }
    }
    const files = []
    const conflicts = []
    const writes = []
    for (const rp of targets) {
      const touching = range.filter((c) => c.files.includes(rp))
      const own = touching.filter((c) => inAttempt.has(c.sha))
      const first = own[0].sha
      const current = blob(head, rp)
      let desired
      let via
      let action
      // The pin restore is exact only while the attempt is the ONLY writer of the file since the pin: another commit
      // after it (an IN_REVIEW build of another FRD on a shared file) would be wiped with it — take the revert path.
      const onlyAttemptSincePin = () => g.must(['log', '--no-merges', '--no-renames', '--format=%H', `${pinSha}..${head}`, '--', rp]).split('\n').filter(Boolean).every((sha) => inAttempt.has(sha))
      if (pinValid && !isAncestor(first, pinSha) && onlyAttemptSincePin()) {
        via = 'pin'
        desired = blob(pinSha, rp)
        action = 'restore'
      } else {
        via = 'revert'
        const others = touching.filter((c) => index.get(c.sha) > index.get(first) && !inAttempt.has(c.sha))
        if (!others.length) {
          desired = blob(parentOf(first), rp)
          action = 'restore'
        } else {
          action = 'merge'
          let cur = current
          let clean = true
          for (const c of [...own].reverse()) {
            const m = merge3(cur, blob(c.sha, rp), blob(parentOf(c.sha), rp))
            if (!m.ok) { clean = false; break }
            cur = m.out
          }
          if (!clean) { conflicts.push(projPath(rp)); continue }
          desired = cur
        }
      }
      if (sameBlob(desired, current)) { files.push({ path: projPath(rp), action: 'keep', via }); continue }
      if (desired === null) action = 'delete'
      files.push({ path: projPath(rp), action, via })
      writes.push({ rp, content: desired })
    }
    if (conflicts.length) return { ...common, status: 'conflict', reason: `reverting the attempt would conflict with another commit's edit of: ${conflicts.join(', ')} — nothing was reverted (never a partial revert)`, conflicts, files: [], _writes: [] }
    // An uncommitted change on a target refuses the plan — unless the file on disk already IS the content the revert
    // commits (the reopen judge MOVED a preserved test out of the tree, DR-107: the revert would delete it anyway).
    const written = new Map(writes.map((w) => [w.rp, w.content]))
    const dirty = dirtyRp.filter((rp) => !(written.has(rp) && sameBlob(onDisk(rp), written.get(rp)))).map(projPath)
    if (dirty.length) return { ...common, status: 'dirty', reason: `uncommitted change(s) on target path(s): ${dirty.join(', ')} — nothing was reverted`, dirty, files: [], _writes: [] }
    return { ...common, status: writes.length ? 'reverted' : 'nothing', reason: writes.length ? '' : 'the attempt\'s commits are already undone in the tree', files, _writes: writes, _top: top }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

function applyWrites(opts, plan) {
  const g = gitIn(plan._top)
  const paths = plan._writes.map((w) => w.rp)
  for (const w of plan._writes) {
    const abs = path.join(plan._top, w.rp)
    if (w.content === null) { if (existsSync(abs)) unlinkSync(abs) } else { mkdirSync(path.dirname(abs), { recursive: true }); writeFileSync(abs, w.content) }
  }
  const ids = plan.wos.map((w) => w.id).join(', ')
  const msg = `revert(${opts.frd}): discard the rejected work of ${ids} (${opts.mode === 'recover' ? 'recovered after an interrupted run, BL-0215' : 'BL-0212'})\n\nReverts the attempt's own commits: ${(plan.commits || []).join(' ')}.`
  const add = g.run(['--literal-pathspecs', 'add', '-A', '--', ...paths])
  const commit = add.ok ? g.run(['--literal-pathspecs', 'commit', '-q', '-m', msg, '--', ...paths]) : add
  if (!commit.ok) {
    for (const rp of paths) {
      if (g.run(['cat-file', '-e', `HEAD:${rp}`]).ok) g.run(['--literal-pathspecs', 'checkout', 'HEAD', '--', rp])
      else { g.run(['--literal-pathspecs', 'rm', '-q', '--cached', '--ignore-unmatch', '--', rp]); rmSync(path.join(plan._top, rp), { force: true }) }
    }
    throw new InputError(`the revert commit failed and was rolled back: ${commit.err || 'no output'}`)
  }
  return g.must(['rev-parse', 'HEAD']).trim()
}

function finish(opts, body) {
  const line = sealLine(body)
  if (opts.out) {
    const out = path.isAbsolute(opts.out) ? opts.out : path.join(opts.project, opts.out)
    mkdirSync(path.dirname(out), { recursive: true })
    writeFileSync(out, `${line}\n`)
  }
  process.stdout.write(`${line}\n`)
}

// ── Pending-discard intent (BL-0215): one marker per FRD, gitignored runtime state ──────────────────
const intentFile = (opts) => path.join(opts.project, '.pandacorp', 'run', 'wo-revert', `pending-${opts.frd}.json`)
const clearIntent = (opts) => rmSync(intentFile(opts), { force: true })
function writeIntent(opts, plan) {
  const file = intentFile(opts)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify({ version: 1, frd: opts.frd, wos: opts.wos, expectStatus: opts.recordIntent, seam: opts.seam, head: plan.head.slice(0, 8), at: new Date().toISOString() })}\n`)
}
/** The FRD's marker, `null` when absent, `{ error }` when it cannot be interpreted (never guessed at). */
function readIntent(opts) {
  const file = intentFile(opts)
  if (!existsSync(file)) return null
  try {
    const m = JSON.parse(readFileSync(file, 'utf8'))
    const strings = (a) => Array.isArray(a) && a.every((x) => typeof x === 'string' && x)
    const valid = m && m.version === 1 && m.frd === opts.frd && INTENT_STATUSES.has(m.expectStatus) && strings(m.wos) && m.wos.length > 0 && strings(m.seam)
    return valid ? m : { error: 'unrecognised shape' }
  } catch (e) {
    return { error: e.message }
  }
}

/**
 * `recover`: finish the discard an interrupted run left behind (BL-0215). The marker names the work orders, the status
 * their flip leaves them in and the seam; a work order no longer in that status was moved on by someone else and is
 * never touched. Always consumes the marker (terminal outcome) — a refusal is reported once, never retried forever.
 * @returns {number} the exit code
 */
function recover(opts) {
  const receipt = (over) => ({ ok: true, version: 1, mode: 'recover', frd: opts.frd, status: 'nothing', changed: false, committed: null, recovery: 'none', reason: '', wos: [], files: [], ...over })
  const done = (over) => { finish(opts, receipt(over)); return 0 }
  const marker = readIntent(opts)
  if (!marker) return done({ reason: 'no pending revert intent' })
  const drop = (why) => { clearIntent(opts); emit(opts, 'RevertIntentDropped', { reason: why }); return done({ recovery: 'dropped', reason: `pending revert intent dropped: ${why}` }) }
  if (marker.error) return drop(`unreadable (${marker.error})`)
  let plan
  try {
    plan = computePlan({ ...opts, wos: marker.wos, seam: marker.seam, onlyStatus: marker.expectStatus })
  } catch (e) {
    if (e instanceof InputError && /^work order /.test(e.message)) return drop(e.message)
    throw e
  }
  if (!plan.wos.length) { clearIntent(opts); return done({ recovery: 'stale', reason: `none of ${marker.wos.join(', ')} is still ${marker.expectStatus}: the state moved on after the interrupted discard, nothing to undo`, wos: plan.skipped || [] }) }
  const committed = plan.status === 'reverted' ? applyWrites({ ...opts, mode: 'recover' }, plan) : null
  clearIntent(opts)
  const { _writes, _top, head, ...rest } = plan
  const refused = ['conflict', 'dirty', 'refused'].includes(plan.status)
  if (refused) emit(opts, 'RevertRefused', { status: plan.status, wos: marker.wos, reason: plan.reason })
  else if (committed) emit(opts, 'RevertRecovered', { wos: marker.wos, committed: committed.slice(0, 12), reason: 'a run cut between the state flip and the discard left the rejected code on main (BL-0215)' })
  finish(opts, receipt({ ...rest, head: head ? head.slice(0, 8) : null, pinSha: plan.pinSha ? plan.pinSha.slice(0, 8) : null, changed: Boolean(committed), committed: committed ? committed.slice(0, 12) : null, recovery: committed ? 'recovered' : refused ? 'refused' : 'applied' }))
  return refused ? REFUSED_EXIT : 0
}

/** CLI entry: returns the exit code. */
export function main(argv) {
  let opts = { project: process.cwd() }
  try {
    opts = parseArgs(argv)
    if (opts.mode === 'replay') {
      const file = path.isAbsolute(opts.file) ? opts.file : path.join(opts.project, opts.file)
      if (!existsSync(file)) throw new InputError(`no stored revert receipt at ${opts.file}`)
      process.stdout.write(`${readFileSync(file, 'utf8').trim().split('\n').pop()}\n`)
      return 0
    }
    if (opts.mode === 'recover') return recover(opts)
    const plan = computePlan(opts)
    let committed = null
    if (opts.mode === 'apply' && plan.status === 'reverted') committed = applyWrites(opts, plan)
    // A newer plan supersedes an older intent; an apply, whatever its outcome, is the terminal step of the discard.
    if (opts.mode === 'apply' || opts.recordIntent) clearIntent(opts)
    if (opts.recordIntent && plan.status === 'reverted') writeIntent(opts, plan)
    const { _writes, _top, head, ...rest } = plan
    const body = { ok: true, version: 1, mode: opts.mode, frd: opts.frd, ...rest, head: head ? head.slice(0, 8) : null, pinSha: plan.pinSha ? plan.pinSha.slice(0, 8) : null, changed: plan.status === 'reverted', committed: committed ? committed.slice(0, 12) : null }
    const refused = ['conflict', 'dirty', 'refused'].includes(plan.status)
    if (refused) emit(opts, 'RevertRefused', { status: plan.status, wos: opts.wos, reason: plan.reason })
    else if (opts.mode === 'apply' && opts.expectChange && !body.changed) emit(opts, 'RevertNoop', { wos: opts.wos, reason: plan.reason })
    finish(opts, body)
    return refused ? REFUSED_EXIT : 0
  } catch (e) {
    if (!(e instanceof InputError)) throw e
    finish(opts, { ok: false, version: 1, mode: opts.mode || null, frd: opts.frd || null, error: e.message })
    return INPUT_EXIT
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)))
