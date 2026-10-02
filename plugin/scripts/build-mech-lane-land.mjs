// build-mech-lane-land.mjs — proposal 40 §3 Phase B (Lever 2): landing a built lane chain on main, and the bisect of a
// red USABLE over the chains that landed since the last green pin.
//   land-chain  [--chain c]   one chain at a time (lane-landing.lock), the queue's head when --chain is absent (longest
//               downstream path first, then FIFO). Refused while a barrier chain builds on main (landings pause).
//               1. rebase lane/<c> onto main's HEAD keeping ONE commit per WO (DR-097: `--empty=keep`, never a squash,
//                  the count and order checked after) — the append-only journals merge by `merge=union` (an attributes
//                  file passed by config, nothing committed), `messages/*.json` by a 3-way key union (the same key given
//                  two different values is red);
//               2. tsc, biome and `vitest related` on the chain's files, in the lane;
//               3. under the main-writer lock: sweep the journals' pending lines, then `merge --ff-only` (main moved by
//                  journal lines only → rebase again without re-checking; anything else → re-check), then ONE track.jsonl
//                  `lane_land` line re-keying each WO id to its landed SHA (revert targeting stays per WO, DR-073/117).
//               A conflict or a red check gets one rebase-fix (needs-rebase-fix), then the chain parks; either way the
//               main tree is untouched.
//   lane-bisect --candidate c [--candidate c…] [--sha <red pin>]   1-3 landed chains: verify.sh in parallel snapshot
//               worktrees at the base before the first and at each chain's landed tip; the culprit is the first red
//               tip after a green point ('pre-existing' when the base is already red, 'not-reproduced' when none is).
//               It never reverts: the engine hands the culprit to the fix-forward patch ladder.

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { InputError, JOURNALS, Refusal, acquireLock, commitJournals, dirtyEntries, gitIn, isOnMain, projectCtx, releaseLock } from './build-mech-lib.mjs'
import { activeBarrier, bootstrapLane, commitShape, ensureWorktree, freePort, laneCommits, laneEnv, lanesDir, planChains, readState, refreshFromMain, runAsync, withState, woGraph } from './build-mech-lanes.mjs'

const TRACK = JOURNALS[0]
const MESSAGES_RE = /(^|\/)messages\/[^/]+\.json$/
const BIOME_RE = /\.([cm]?[jt]sx?|jsonc?|css)$/
const CODE_RE = /\.[cm]?[jt]sx?$/
/** One rebase-fix per chain, then it parks (proposal 40 §3 B.5). */
export const MAX_REBASE_FIXES = 1
const MAX_MAIN_RETRIES = 3

// ── messages/*.json: the 3-way key union ───────────────────────────────────────────────────────
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const canon = (v) => JSON.stringify(v, (_, x) => (isObj(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x))
const same = (a, b) => canon(a) === canon(b)
/**
 * Merge two edits of a JSON object against their base, key by key: a key one side changed takes that side; a key both
 * changed to the SAME value is fine; both changed to different values is a conflict (its JSON pointer is reported).
 * @returns {{ value: unknown, conflicts: string[] }}
 */
export function mergeJson3(base, ours, theirs) {
  const conflicts = []
  const walk = (b, a, c, ptr) => {
    if (same(a, c)) return a
    if (isObj(a) && isObj(c)) {
      const bo = isObj(b) ? b : {}
      const out = {}
      for (const k of [...new Set([...Object.keys(a), ...Object.keys(c)])]) {
        const v = walk(bo[k], a[k], c[k], `${ptr}/${k.replace(/~/g, '~0').replace(/\//g, '~1')}`)
        if (v !== undefined) out[k] = v
      }
      return out
    }
    if (same(a, b)) return c
    if (same(c, b)) return a
    conflicts.push(ptr || '/')
    return a
  }
  return { value: walk(base, ours, theirs, ''), conflicts }
}
/** Resolve one conflicted messages/*.json in a rebase from its index stages; null when it parsed and merged. */
function resolveMessages(g, wt, file) {
  const stage = (n) => { const r = g.run(['show', `:${n}:${file}`]); return r.ok ? r.out : null }
  const [b, a, c] = [stage(1), stage(2), stage(3)]
  let parsed
  try { parsed = [b === null ? {} : JSON.parse(b), JSON.parse(a), JSON.parse(c)] } catch { return { path: file, why: 'not parseable JSON on one side' } }
  const { value, conflicts } = mergeJson3(...parsed)
  if (conflicts.length) return { path: file, why: 'same key, different values', keys: conflicts }
  const indent = (/\n([ \t]+)"/.exec(a) || [])[1] || 2
  writeFileSync(path.join(wt, file), `${JSON.stringify(value, null, indent)}${a.endsWith('\n') ? '\n' : ''}`)
  return null
}

// ── rebase ─────────────────────────────────────────────────────────────────────────────────────
const UNION_ATTRS = `${JOURNALS.map((j) => `**/${j} merge=union`).join('\n')}\n`
const rebaseActive = (g, wt) => ['rebase-merge', 'rebase-apply'].some((d) => { const r = g.run(['rev-parse', '--git-path', d]); return r.ok && existsSync(path.resolve(wt, r.out.trim())) })
/**
 * Rebase the lane's checked-out branch onto `onto`. Journals union-merge; messages/*.json key-union; any other
 * conflict aborts the rebase (the branch is back where it was) and is returned.
 * @returns {{ ok: boolean, resolved: string[], conflicts: object[] }}
 */
export function rebaseLane(ctx, wt, onto) {
  const attrs = path.join(lanesDir(ctx), 'union.gitattributes')
  mkdirSync(path.dirname(attrs), { recursive: true })
  writeFileSync(attrs, UNION_ATTRS)
  const g = gitIn(wt)
  const env = { ...process.env, GIT_EDITOR: 'true', GIT_SEQUENCE_EDITOR: 'true' }
  const cfg = ['-c', `core.attributesFile=${attrs}`, '-c', 'rebase.autoStash=false', '-c', 'commit.gpgsign=false']
  const resolved = []
  let r = g.run([...cfg, 'rebase', '--empty=keep', onto], { env })
  for (let step = 0; step < 1000 && rebaseActive(g, wt); step++) {
    const conflicted = g.run(['diff', '--name-only', '--diff-filter=U']).out.split('\n').filter(Boolean)
    const unresolved = conflicted.map((f) => (MESSAGES_RE.test(f) ? resolveMessages(g, wt, f) : { path: f, why: 'conflict' })).filter(Boolean)
    if (unresolved.length || !conflicted.length) {
      g.run(['rebase', '--abort'])
      return { ok: false, resolved, conflicts: unresolved.length ? unresolved : [{ path: '<rebase>', why: r.err.split('\n').slice(-2).join(' | ') }] }
    }
    if (conflicted.length) { g.must(['add', '--', ...conflicted]); resolved.push(...conflicted) }
    r = g.run([...cfg, 'rebase', '--continue'], { env })
  }
  if (rebaseActive(g, wt)) { g.run(['rebase', '--abort']); return { ok: false, resolved, conflicts: [{ path: '<rebase>', why: 'the rebase did not converge' }] } }
  return r.ok ? { ok: true, resolved, conflicts: [] } : { ok: false, resolved, conflicts: [{ path: '<rebase>', why: r.err.split('\n').slice(-2).join(' | ') || 'rebase failed' }] }
}

// ── the lane checks ────────────────────────────────────────────────────────────────────────────
/** tsc, biome and `vitest related` over the chain's files in the lane (an absent tool is reported skipped, never green by silence). */
export async function laneChecks(lctx, base, tip, timeoutMs) {
  const files = lctx.g.must(['diff', '--name-only', '--relative', base, tip, '--', '.']).split('\n').filter(Boolean).filter((p) => existsSync(path.join(lctx.project, p)))
  const bin = (n) => path.join(lctx.project, 'node_modules', '.bin', n)
  const step = async (name, args, when) => {
    if (!existsSync(bin(name))) return { name, ran: false, ok: true, reason: `no-${name}: node_modules/.bin/${name} is absent in the lane` }
    if (!when) return { name, ran: false, ok: true, reason: 'no-files' }
    const r = await runAsync(bin(name), args, { cwd: lctx.project, env: {}, timeoutMs })
    return { name, ran: true, ok: r.ok, ...(r.ok ? {} : { exit: r.code, tail: r.tail }) }
  }
  const lint = files.filter((p) => BIOME_RE.test(p))
  const code = files.filter((p) => CODE_RE.test(p) && !/^e2e\//.test(p))
  const steps = await Promise.all([
    step('tsc', ['--noEmit', '-p', '.'], existsSync(path.join(lctx.project, 'tsconfig.json'))),
    step('biome', ['check', ...lint], lint.length > 0),
    step('vitest', ['related', '--run', '--passWithNoTests', ...code], code.length > 0),
  ])
  return { ok: steps.every((s) => s.ok), files, steps }
}
/** Did main move between a and b by the shared journals only (so the chain's checks still hold)? */
function journalsOnly(ctx, a, b) {
  const r = ctx.g.run(['diff', '--name-only', '--relative', a, b, '--', '.'])
  return r.ok && r.out.split('\n').filter(Boolean).every((p) => JOURNALS.includes(p))
}

// ── land-chain ─────────────────────────────────────────────────────────────────────────────────
/** A landing that cannot proceed: one rebase-fix, then park (blocking only the DAG descendants). Main is untouched. */
async function landFailure(ctx, o, graph, id, kind, extra) {
  return withState(ctx, o, async (s) => {
    const c = s.chains[id]
    if (extra.rebasedOnto) c.base = extra.rebasedOnto
    if ((c.fixes || 0) < MAX_REBASE_FIXES) {
      c.fixes = (c.fixes || 0) + 1
      c.status = 'needs-fix'
      return { code: 4, body: { status: 'needs-rebase-fix', chain: id, lane: c.lane, kind, fixes: c.fixes, ...extra } }
    }
    Object.assign(c, { status: 'parked', parkedAt: new Date().toISOString(), why: `${kind} after ${c.fixes} rebase-fix` })
    for (const l of s.pool) if (l.chain === id) l.chain = null
    const plan = planChains(graph, s, {})
    return { code: 4, body: { status: 'parked', chain: id, kind, ...extra, blockedWos: plan.blockedWos, blockedFrds: plan.blockedFrds } }
  })
}
/** `land-chain [--chain c]` — see the header. */
export async function landChainOp(o) {
  const ctx = projectCtx(o.project)
  if (!isOnMain(ctx, o.mainBranch)) throw new Refusal('not-on-main', `land-chain runs in the primary checkout on ${o.mainBranch}`)
  const landing = acquireLock(ctx, { waitMs: o.lockWaitMs, op: 'land-chain', name: 'lane-landing.lock' })
  try {
    const graph = woGraph(ctx)
    const state = readState(ctx)
    refreshFromMain(state, graph.nodes)
    const barrier = activeBarrier(state)
    if (barrier) throw new Refusal('landings-paused', `the barrier chain ${barrier.id} is building on main: lane landings wait until it commits (lane builds continue)`, { barrier: barrier.id })
    const id = o.chain || planChains(graph, state, {}).landQueue[0]
    if (!id) return { code: 0, body: { status: 'nothing', reason: 'no built chain is queued' } }
    const c = state.chains[id]
    if (!c || !['built', 'needs-fix'].includes(c.status)) throw new Refusal('chain-not-built', `${id} is ${c ? c.status : 'unknown'}: only a built chain lands`)
    const lane = state.pool.find((l) => l.lane === c.lane)
    if (!lane || !existsSync(lane.path)) throw new Refusal('lane-missing', `${id}'s lane worktree is gone`)
    const lctx = projectCtx(path.join(lane.path, ctx.prefix))
    const lg = gitIn(lane.path)
    const branch = `lane/${id}`
    const dirt = dirtyEntries(lctx)
    if (dirt.length) throw new Refusal('lane-dirty', `${id}'s lane has uncommitted work (${dirt.map((e) => e.path).join(', ')}): commit or park it first`)
    lg.must(['checkout', '-q', branch])
    const preTip = lg.must(['rev-parse', 'HEAD']).trim()
    let checksBase = null
    let checks = null
    for (let attempt = 0; attempt < MAX_MAIN_RETRIES; attempt++) {
      const onto = ctx.g.must(['rev-parse', 'HEAD']).trim()
      const pre = laneCommits(lg, onto, 'HEAD')
      const shape = commitShape(pre, c.wos)
      if (shape.missing.length || shape.duplicated.length) throw new Refusal('commit-shape', `one commit per work order (DR-097): missing ${shape.missing.join(', ') || 'none'}, duplicated ${shape.duplicated.join(', ') || 'none'}`, shape)
      const rb = rebaseLane(ctx, lane.path, onto)
      if (!rb.ok) return landFailure(ctx, o, graph, id, 'conflict', { conflicts: rb.conflicts })
      const tip = lg.must(['rev-parse', 'HEAD']).trim()
      const post = laneCommits(lg, onto, tip)
      if (post.length !== pre.length || post.some((x, i) => x.subject !== pre[i].subject)) {
        lg.must(['reset', '-q', '--hard', preTip])
        throw new Refusal('commit-shape', `the rebase changed the chain's commits (${pre.length} → ${post.length}): reset to ${preTip.slice(0, 12)}, nothing landed`)
      }
      if (!checks || !journalsOnly(ctx, checksBase, onto)) {
        checks = await laneChecks(lctx, onto, tip, o.testTimeoutMs)
        if (!checks.ok) return landFailure(ctx, o, graph, id, 'checks-red', { checks, rebasedOnto: onto })
        checksBase = onto
      }
      const lock = acquireLock(ctx, { waitMs: o.lockWaitMs, op: 'land-chain' })
      let landed = null
      try {
        const swept = commitJournals(ctx, `chore(build): sweep the journals before landing ${id}`)
        if (swept.error) throw new Refusal('journal-sweep-failed', `the journals could not be committed before the landing: ${swept.error}`)
        if (ctx.g.must(['rev-parse', 'HEAD']).trim() === onto) {
          const ff = ctx.g.run(['merge', '--ff-only', '-q', tip])
          if (!ff.ok) throw new Refusal('ff-failed', `main could not fast-forward to ${tip.slice(0, 12)}: ${ff.err.split('\n').slice(-2).join(' | ')}`)
          const wos = post.filter((x) => x.wo).map((x) => ({ wo: x.wo, sha: x.sha.slice(0, 12) }))
          appendFileSync(path.join(ctx.project, TRACK), `${JSON.stringify({ kind: 'lane_land', chain: id, frd: c.frd, lane: c.lane, base: onto.slice(0, 12), tip: tip.slice(0, 12), wos, at: new Date().toISOString() })}\n`)
          landed = { onto, tip, wos }
        }
      } finally { releaseLock(lock) }
      if (!landed) continue
      lg.run(['checkout', '-q', '--detach', tip])
      lg.run(['branch', '-q', '-d', branch])
      await withState(ctx, o, async (s) => {
        Object.assign(s.chains[id], { status: 'landed', landedSha: tip, landedBase: onto, landedAt: new Date().toISOString() })
        for (const l of s.pool) if (l.chain === id) Object.assign(l, { chain: null, base: tip })
      })
      return { code: 0, body: { status: 'landed', chain: id, sha: tip.slice(0, 12), base: onto.slice(0, 12), wos: landed.wos, resolved: rb.resolved, checks: checks.steps, rechecked: checksBase === onto } }
    }
    throw new Refusal('main-busy', `main kept moving under ${id} (${MAX_MAIN_RETRIES} tries): nothing landed, the chain stays queued`)
  } finally { releaseLock(landing) }
}

// ── lane-bisect ────────────────────────────────────────────────────────────────────────────────
/** `lane-bisect --candidate c… [--sha <red pin>]` — see the header. */
export async function laneBisectOp(o) {
  const ids = o.candidates
  if (ids.length < 1 || ids.length > 3) throw new InputError('lane-bisect needs 1-3 --candidate <chain>')
  const ctx = projectCtx(o.project)
  const state = readState(ctx)
  const cands = ids.map((id) => state.chains[id] || (() => { throw new InputError(`no chain ${id} in the lane state`) })())
  const unlanded = cands.filter((c) => c.status !== 'landed' || !c.landedSha)
  if (unlanded.length) throw new InputError(`not landed through land-chain: ${unlanded.map((c) => c.id).join(', ')}`)
  cands.sort((a, b) => String(a.landedAt).localeCompare(String(b.landedAt)))
  const points = [{ label: 'base', sha: cands[0].landedBase }, ...cands.map((c) => ({ label: c.id, sha: c.landedSha }))]
  if (o.sha) {
    const outside = points.filter((p) => !ctx.g.run(['merge-base', '--is-ancestor', p.sha, o.sha]).ok)
    if (outside.length) throw new InputError(`not in the red pin's history: ${outside.map((p) => p.label).join(', ')}`)
  }
  const taken = new Set(state.pool.map((l) => l.port).filter(Boolean))
  const prepared = []
  for (const [i, p] of points.entries()) {
    const wt = path.join(lanesDir(ctx), `bisect-${i}`)
    ensureWorktree(ctx, wt, p.sha)
    const wg = gitIn(wt)
    wg.must(['checkout', '-q', '-f', '--detach', p.sha])
    wg.must(['clean', '-fdq'])
    const port = await freePort(taken, 50 + i)
    taken.add(port)
    prepared.push({ ...p, wt, port })
  }
  const timeoutMs = o.verifyTimeoutMs || 30 * 60 * 1000
  const results = await Promise.all(prepared.map(async (p) => {
    const boot = await bootstrapLane(ctx, p.wt, `bisect-${p.label}`, p.port)
    if (boot) return { label: p.label, sha: p.sha.slice(0, 12), green: null, failure: boot }
    const r = await runAsync('bash', ['.pandacorp/verify.sh'], { cwd: path.join(p.wt, ctx.prefix), env: laneEnv(`bisect-${p.label}`, p.port), timeoutMs })
    return { label: p.label, sha: p.sha.slice(0, 12), green: r.ok, ...(r.ok ? {} : { exit: r.code, tail: r.tail }) }
  }))
  for (const p of prepared) ctx.g.run(['worktree', 'remove', '--force', p.wt])
  if (results.some((r) => r.green === null)) return { code: 4, body: { status: 'bisect-failed', results } }
  const [base, ...tips] = results
  const culpritAt = tips.findIndex((r) => !r.green)
  const verdict = !base.green ? 'pre-existing' : culpritAt < 0 ? 'not-reproduced' : 'culprit'
  return { code: 0, body: { status: verdict, culprit: verdict === 'culprit' ? tips[culpritAt].label : null, results } }
}

export const LAND_OPS = { 'land-chain': landChainOp, 'lane-bisect': laneBisectOp }
