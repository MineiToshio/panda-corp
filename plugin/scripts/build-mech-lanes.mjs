// build-mech-lanes.mjs — proposal 40 §3 Phase B (Lever 2): the lane pool and the chain planner of pandacorp-build-mech.mjs.
// The engine only orchestrates; every lane decision that a script can make is made here, deterministically:
//   lane-pool     --size K                      create/reuse K detached worktrees under .pandacorp/run/lanes/lane-<n>
//                                               (more when a live chain of an earlier run sits on a higher lane), each
//                                               bootstrapped (worktree-bootstrap.sh) on its OWN port. The bootstrap
//                                               runs OUTSIDE lanes.lock (it takes minutes): a lane is `booting` until
//                                               it is done, `broken` when it failed, and only a ready lane is free.
//   lane-plan     [--frd f]… [--build wo]… [--wait-verified f]… [--lanes N] [--mode M]   the ready set recomputed
//                                               from the WO DAG (dependsOn, DR-087) on main: chains of ≤ 3 WOs of one
//                                               FRD in dependency order, barriers, K (the run's ceiling kRun and this
//                                               round's K, re-decided at every round), the landing queue, the
//                                               parked/blocked sets. `--build` limits what may be dispatched to the
//                                               engine's own schedule; `--wait-verified f` makes f's IN_REVIEW work
//                                               orders satisfy only f's own WOs (a floor FRD's dependents wait for its
//                                               VERIFIED). Read-only.
//   lane-dispatch --chain c --wo a [--wo b…] (--lane n | --barrier)   [in build-mech-lane-next.mjs]   a lane chain: salvage the lane's dirt, reset it
//                                               to main's HEAD on `lane/<c>` (a re-dispatch of the SAME chain keeps
//                                               its committed WOs, DR-086; a fresh reuse of `lane/<c>`, e.g. a retried
//                                               park, first keeps its unlanded tip under refs/lane-parked/<c>/), refuse
//                                               a lane dir that is not its own worktree, resync when the lockfile, prisma/** or the
//                                               migrations moved since the lane's last base, give it a free port, and
//                                               hand back its env (PANDACORP_LANE forces Playwright reuseExistingServer
//                                               false, so a lane never tests a sibling's server). A barrier chain
//                                               (prisma/**, migrations, package.json, a lockfile) builds on MAIN:
//                                               only recorded here, and lane landings pause until it commits.
//   lane-mark     --chain c --as built|parked [--why text]   a built chain joins the landing queue (one commit per
//                                               WO checked); a parked one blocks only its DAG descendants.
// Every bootstrap (pool, resync, snapshot, bisect) records the files it wrote as the worktree's bootstrap-owned set
// (bench FM-6: a TRACKED launch.json rewritten with the lane's ports): hidden from the lane's dirt, set aside around every
// checkout/rebase, never landed — see recordOwned / withOwnedAside below.
// land-chain and lane-bisect live in build-mech-lane-land.mjs; lane-next and lane-usable (the engine's scheduling round
// and the snapshot USABLE check) in build-mech-lane-next.mjs. Lane state is gitignored run state
// (.pandacorp/run/lanes/state.json, under its own lanes.lock); git stays the truth: a chain whose WOs are committed on
// main is landed whatever the state file says.

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { InputError, Refusal, acquireLock, gitIn, projectCtx, readOwned, releaseLock, unique, writeOwned } from './build-mech-lib.mjs'
import { fmList, normWoId, readFrds } from './build-mech-fast.mjs'

/** Lane caps per run mode (proposal 40 §9): pro never lanes, balanced 2, powerful/deep 4. */
export const MODE_CAPS = Object.freeze({ pro: 1, balanced: 2, powerful: 4, deep: 4 })
/**
 * K without --lanes: 1, so a plain build is today's sequential build. Proposal 40 §7 row 5 / §9: lanes ship behind
 * `--lanes N` (auto 1) until the FM-5 medium bench meets the §6.2 thresholds; only then may this become 2.
 */
export const DEFAULT_LANES = 1
export const CHAIN_MAX = 3
/**
 * Auto K = 1 when the work off the critical path is below this many work orders: the pool bootstrap (~2.5 min) and a
 * landing cost about one work order's build, so a DAG that can run fewer than two WOs beside its longest path gains
 * nothing from a second lane (proposal 40 §3 B.7, "gain below the bootstrap"). Judged on the REMAINING DAG at every
 * round: once a pool of ≥ 2 lanes exists its bootstrap is paid, only a landing is left, so one WO beside the path
 * (MIN_LANE_GAIN_BOOTED) still earns a lane.
 */
export const MIN_LANE_GAIN = 2
export const MIN_LANE_GAIN_BOOTED = 1
/** A chain touching any of these builds on main and pauses lane landings until it commits (§3 B.2). */
export const BARRIER_PATHS = Object.freeze([
  /(^|\/)prisma\//, /\.(sql|prisma)$/i, /(^|\/)migrations?\//, /(^|\/)drizzle\//,
  /(^|\/)package\.json$/, /(^|\/)(pnpm-lock\.yaml|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|bun\.lockb?)$/,
])
export const LIVE = new Set(['dispatched', 'built', 'needs-fix'])
const DONE_STATUSES = new Set(['IN_REVIEW', 'VERIFIED'])
const isBarrierPath = (p) => BARRIER_PATHS.some((re) => re.test(String(p).replace(/^\.\//, '')))

// ── state ──────────────────────────────────────────────────────────────────────────────────────
export const lanesDir = (ctx) => path.join(ctx.project, '.pandacorp', 'run', 'lanes')
const stateFile = (ctx) => path.join(lanesDir(ctx), 'state.json')
/** The lane state; absent → empty. An unreadable file fails loud (DR-078): it is never silently an empty pool. */
export function readState(ctx) {
  const file = stateFile(ctx)
  if (!existsSync(file)) return { version: 1, pool: [], chains: {} }
  let s = null
  try { s = JSON.parse(readFileSync(file, 'utf8')) } catch { s = null }
  if (!s || s.version !== 1 || !Array.isArray(s.pool) || !s.chains || typeof s.chains !== 'object') throw new InputError(`${file} is not a lane state (version 1): refusing to guess the pool`)
  return s
}
function writeState(ctx, s) {
  mkdirSync(lanesDir(ctx), { recursive: true })
  const tmp = `${stateFile(ctx)}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(s, null, 1)}\n`)
  renameSync(tmp, stateFile(ctx))
}
// acquireLock waits synchronously: two read-modify-writes of ONE process (lane-next's parallel dispatches) must queue
// here first, or the second would block the event loop the first needs to finish.
let stateQueue = Promise.resolve()
/** Read-modify-write the state under lanes.lock; `fn` may be async and returns the op's result. Never nest it. */
export function withState(ctx, o, fn) {
  const run = stateQueue.then(async () => {
    const lock = acquireLock(ctx, { waitMs: o.lockWaitMs, op: o.op, name: 'lanes.lock' })
    try {
      const s = readState(ctx)
      const out = await fn(s)
      writeState(ctx, s)
      return out
    } finally { releaseLock(lock) }
  })
  stateQueue = run.catch(() => {})
  return run
}

// ── the WO DAG on main ─────────────────────────────────────────────────────────────────────────
/**
 * Every work order as a DAG node read from main's working tree: id, FRD, plan order, status, deps, barrier flag.
 * A cycle among work orders is refused (the WO graph is acyclic by contract; the FRD graph may not be).
 * @returns {{ nodes: Map<string, object>, frdOrder: string[] }}
 */
export function woGraph(ctx) {
  const nodes = new Map()
  const frds = readFrds(ctx)
  frds.forEach((f, fi) => f.wos.forEach((w, wi) => {
    const id = normWoId(w.id)
    const row = f.plan && f.plan.get(id)
    const artifacts = fmList(w.text, 'artifacts')
    nodes.set(id, { id, frd: f.frd, frdIndex: fi, order: row ? row.order : wi, status: w.status, deps: w.deps, artifacts, barrier: artifacts.some(isBarrierPath), rel: w.rel })
  }))
  const state = new Map()
  const visit = (id, trail) => {
    if (state.get(id) === 2 || !nodes.has(id)) return
    if (state.get(id) === 1) throw new Refusal('wo-cycle', `the work-order graph has a cycle: ${[...trail.slice(trail.indexOf(id)), id].join(' → ')}`)
    state.set(id, 1)
    for (const d of nodes.get(id).deps) visit(d, [...trail, id])
    state.set(id, 2)
  }
  for (const id of nodes.keys()) visit(id, [])
  return { nodes, frdOrder: frds.map((f) => f.frd) }
}
/** Longest descendant path (in nodes) below each work order: the landing and dispatch priority. */
export function downstreamOf(nodes) {
  const children = new Map([...nodes.keys()].map((id) => [id, []]))
  for (const n of nodes.values()) for (const d of n.deps) if (children.has(d)) children.get(d).push(n.id)
  const memo = new Map()
  const depth = (id) => {
    if (memo.has(id)) return memo.get(id)
    const v = Math.max(0, ...children.get(id).map((c) => 1 + depth(c)))
    memo.set(id, v)
    return v
  }
  return { depth, children }
}
const descendants = (children, roots) => {
  const out = new Set()
  const stack = [...roots]
  while (stack.length) for (const c of children.get(stack.pop()) || []) if (!out.has(c)) { out.add(c); stack.push(c) }
  return out
}

/** The newest commit on main's HEAD history that builds or fixes one of `wos` (commit-wo's subjects), or null. */
export function lastWoCommit(ctx, wos) {
  const r = ctx.g.run(['log', '-n', '500', '--format=%H%x09%s', 'HEAD'])
  if (!r.ok) return null
  const re = new RegExp(`^(feat|fix)\\([^)]*\\): (fixup )?(${wos.map((w) => w.replace(/[^A-Za-z0-9-]/g, '')).join('|')})\\b`, 'i')
  const hit = r.out.split('\n').find((l) => re.test(l.split('\t')[1] || ''))
  return hit ? hit.split('\t')[0] : null
}
/**
 * Bring the state in line with git: a live chain whose work orders are all committed on main is landed. With `ctx`,
 * a chain landed by its commits on main (a barrier, or a landing killed between the ff and the state write) also gets
 * its landed range (base → its newest WO commit), so a bisect can test it like any landed chain.
 */
export function refreshFromMain(state, nodes, ctx = null) {
  const landedNow = []
  for (const c of Object.values(state.chains)) {
    if (!LIVE.has(c.status)) continue
    if (c.wos.every((id) => nodes.has(id) && DONE_STATUSES.has(nodes.get(id).status))) {
      Object.assign(c, { status: 'landed', landedBy: c.barrier ? 'main-commit' : 'git' })
      const tip = ctx && !c.landedSha ? lastWoCommit(ctx, c.wos) : null
      if (tip) Object.assign(c, { landedSha: tip, landedBase: c.base, landedAt: new Date().toISOString() })
      landedNow.push(c.id)
    }
  }
  for (const l of state.pool) if (l.chain && state.chains[l.chain] && !LIVE.has(state.chains[l.chain].status)) l.chain = null
  return landedNow
}
/** The live barrier chain (dispatched on main, not yet committed there), or null. */
export const activeBarrier = (state) => Object.values(state.chains).find((c) => c.barrier && LIVE.has(c.status)) || null

/**
 * The ready set and its chains (proposal 40 §3 B.1): a WO is ready when it is pending, in scope, not in a live or
 * parked chain, not below a parked/BLOCKED WO, and every dependency is done (IN_REVIEW in scope, else VERIFIED). A
 * chain starts at a ready WO (longest downstream first) and grows with same-FRD WOs that depend on it and whose other
 * deps are done, up to CHAIN_MAX; a barrier WO is always a chain of its own.
 */
export function planChains(graph, state, { scope = [], lanes, mode, build = [], waitVerified = [] }) {
  const { nodes } = graph
  const { depth, children } = downstreamOf(nodes)
  const inScope = (n) => !scope.length || scope.includes(n.frd)
  const buildIds = new Set(build.map(normWoId))
  const buildable = (n) => !buildIds.size || buildIds.has(n.id)
  const live = Object.values(state.chains).filter((c) => LIVE.has(c.status))
  const inFlight = new Set(live.flatMap((c) => c.wos))
  const parkedChains = Object.values(state.chains).filter((c) => c.status === 'parked')
  const roots = unique([...parkedChains.flatMap((c) => c.wos), ...[...nodes.values()].filter((n) => n.status === 'BLOCKED').map((n) => n.id)])
  const blocked = new Set([...roots, ...descendants(children, roots)])
  // A dependency is done when VERIFIED, or IN_REVIEW in scope; an FRD the engine waits to see VERIFIED (floor, or a red
  // USABLE) satisfies only its own work orders while IN_REVIEW.
  const done = (id, of = null) => { const n = nodes.get(id); return Boolean(n) && (n.status === 'VERIFIED' || (n.status === 'IN_REVIEW' && inScope(n) && (!of || n.frd === of.frd || !waitVerified.includes(n.frd)))) }
  const pending = (n) => !DONE_STATUSES.has(n.status) && n.status !== 'BLOCKED'
  const unsatisfiedDeps = []
  const ready = [...nodes.values()].filter((n) => {
    if (!pending(n) || !inScope(n) || !buildable(n) || inFlight.has(n.id) || blocked.has(n.id)) return false
    const missing = n.deps.filter((d) => !done(d, n))
    for (const d of missing) if (!nodes.has(d) || !inScope(nodes.get(d))) unsatisfiedDeps.push({ wo: n.id, dep: d })
    return !missing.length
  })
  const prio = (a, b) => depth(b.id) - depth(a.id) || a.frdIndex - b.frdIndex || a.order - b.order
  ready.sort(prio)
  const claimed = new Set()
  const chains = []
  for (const head of ready) {
    if (claimed.has(head.id)) continue
    const chain = [head]
    claimed.add(head.id)
    // A chain grows only along a LINEAR segment: when its tail opens exactly one WO (same FRD, not a barrier). Two or
    // more WOs opened at once are siblings that can build in parallel next round, never serialized into one chain.
    while (!head.barrier && chain.length < CHAIN_MAX) {
      const ids = new Set(chain.map((n) => n.id))
      const opened = [...nodes.values()].filter((n) => pending(n) && inScope(n) && buildable(n) && !claimed.has(n.id) && !inFlight.has(n.id) && !blocked.has(n.id)
        && n.deps.some((d) => ids.has(d)) && n.deps.every((d) => ids.has(d) || done(d, n)))
      const next = opened.length === 1 ? opened[0] : null
      if (!next || next.frd !== head.frd || next.barrier) break
      chain.push(next)
      claimed.add(next.id)
    }
    chains.push({ id: chainIdOf(chain.map((n) => n.id)), frd: head.frd, wos: chain.map((n) => n.id), barrier: head.barrier, downstream: Math.max(...chain.map((n) => depth(n.id))) })
  }
  const cap = MODE_CAPS[mode] ?? MODE_CAPS.powerful
  const requested = lanes ?? DEFAULT_LANES
  // The work beside the longest path of the REMAINING DAG: what a second lane could build in parallel at all.
  const todo = new Set([...nodes.values()].filter((n) => pending(n) && inScope(n) && buildable(n) && !blocked.has(n.id)).map((n) => n.id))
  const plen = new Map()
  const pathLen = (id) => { if (!plen.has(id)) plen.set(id, 1 + Math.max(0, ...nodes.get(id).deps.filter((d) => todo.has(d)).map(pathLen))); return plen.get(id) }
  const offPath = todo.size - Math.max(0, ...[...todo].map(pathLen))
  // kRun: the run's lane ceiling from here on (the pool's size). offPath 0 = narrow throughout (Mirsky: no two
  // remaining WOs are ever independent).
  let kRun = Math.max(1, Math.min(requested, cap))
  let kRunReason = lanes !== undefined ? 'requested' : 'default'
  if (requested > cap) kRunReason = `mode-cap-${mode || 'powerful'}`
  const gain = state.pool.filter((l) => !l.broken).length >= 2 ? MIN_LANE_GAIN_BOOTED : MIN_LANE_GAIN
  if (kRun > 1 && offPath === 0) { kRun = 1; kRunReason = 'narrow-dag' } else if (kRun > 1 && offPath < gain) { kRun = 1; kRunReason = 'gain-below-bootstrap' }
  // k: THIS round's K = min(kRun, the ready width now: ready chains + chains in flight), never decided once per run.
  const width = chains.length + live.length
  let k = kRun
  let kReason = kRunReason
  if (kRun > 1 && width <= 1) { k = 1; kReason = 'narrow-step' } else if (kRun > 1 && kRun > width) { k = width; kReason = 'ready-width' }
  const barrier = activeBarrier(state)
  const freeLanes = state.pool.filter((l) => !l.chain && !l.booting && !l.broken).map((l) => l.lane)
  const laneChains = chains.filter((c) => !c.barrier)
  const dispatchBarrier = barrier ? null : (chains.find((c) => c.barrier) || {}).id || null
  const place = placeChains(laneChains, { laned: lanes !== undefined && Math.min(requested, cap) >= 2, k, freeLanes, live, mainFree: !barrier && !dispatchBarrier })
  const landQueue = live.filter((c) => c.status === 'built').sort((a, b) => b.downstream - a.downstream || String(a.builtAt).localeCompare(String(b.builtAt))).map((c) => c.id)
  const blockedFrds = unique([...blocked].map((id) => nodes.get(id)?.frd).filter(Boolean)).sort()
  return {
    k, kRequested: requested, kCap: cap, kReason, kRun, kRunReason, width, offPath, chains,
    pool: { size: state.pool.length, free: freeLanes.length, booting: state.pool.filter((l) => l.booting).length, broken: state.pool.filter((l) => l.broken).length },
    dispatch: { lanes: place.lanes.map((c, i) => ({ chain: c.id, lane: freeLanes[i] })), barrier: dispatchBarrier, main: place.main ? place.main.id : null, mainWhy: place.mainWhy },
    barrierActive: barrier ? barrier.id : null, landingsPaused: Boolean(barrier), landQueue,
    inFlight: live.map((c) => c.id), parked: parkedChains.map((c) => c.id), blockedWos: [...blocked].sort(), blockedFrds, unsatisfiedDeps,
    remaining: [...nodes.values()].filter((n) => pending(n) && inScope(n)).length,
  }
}
/** Does a live chain hold one of the round's K slots? A lane chain, or a non-schema chain building on main. */
const occupiesSlot = (c) => !c.barrier || (c.onMain && c.onMain !== 'schema')
/**
 * Where this round's ready lane chains go (longest downstream first). Without a lane request (`laned` false: a manual
 * lane-next) every free lane takes one. In a laned run the round's K bounds the chains in flight (lanes plus a
 * non-schema chain on main): a narrow round (K = 1) builds on main (no lane, no landing), a wider one fills the free
 * lanes and, when none is free (the pool still booting), main takes one if no barrier holds it.
 * @returns {{ lanes: object[], main: object|null, mainWhy: 'narrow-step'|'no-free-lane'|null }}
 */
function placeChains(ready, { laned, k, freeLanes, live, mainFree }) {
  if (!laned) return { lanes: ready.slice(0, freeLanes.length), main: null, mainWhy: null }
  let slots = Math.max(0, k - live.filter(occupiesSlot).length)
  const out = { lanes: [], main: null, mainWhy: null }
  for (const c of ready) {
    if (slots <= 0) break
    if (mainFree && !out.main && (k === 1 || out.lanes.length >= freeLanes.length)) Object.assign(out, { main: c, mainWhy: k === 1 ? 'narrow-step' : 'no-free-lane' })
    else if (out.lanes.length < freeLanes.length) out.lanes.push(c)
    else break
    slots--
  }
  return out
}
/** A chain's id: its first work order, lower case (`c-wo-01-001`); the lane branch is `lane/<id>`. */
export const chainIdOf = (wos) => `c-${String(wos[0]).toLowerCase()}`

// ── ports ──────────────────────────────────────────────────────────────────────────────────────
const LANE_PORT_SPAN = 100
const portBase = () => Number(process.env.PANDACORP_LANE_PORT_BASE) || 4100
/** Is something answering on, or bound to, 127.0.0.1:port? Either way a lane must not use it. */
export async function portBusy(port) {
  const answers = await new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' })
    const done = (v) => { s.destroy(); resolve(v) }
    s.setTimeout(300, () => done(false))
    s.once('connect', () => done(true))
    s.once('error', () => done(false))
  })
  if (answers) return true
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(true))
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(false)))
  })
}
/** The first port from base + offset (wrapping in the span) that no sibling holds and nothing answers on. */
export async function freePort(taken, offset = 0) {
  const base = portBase()
  for (let i = 0; i < LANE_PORT_SPAN; i++) {
    const p = base + ((offset + i) % LANE_PORT_SPAN)
    if (!taken.has(p) && !(await portBusy(p))) return p
  }
  throw new Refusal('no-free-port', `no free lane port in ${base}..${base + LANE_PORT_SPAN - 1}`)
}
/** The lane's port: its current one while free and not a sibling's, else the first free one from base + lane - 1. */
export async function lanePort(state, lane, current) {
  const taken = new Set(state.pool.filter((l) => l.lane !== lane && l.port).map((l) => l.port))
  if (current && !taken.has(current) && !(await portBusy(current))) return current
  return freePort(taken, lane - 1)
}
/** The env a lane's builder, self-verify and e2e run with (written to the lane's .pandacorp/run/lane.env too). */
export const laneEnv = (lane, port) => ({ PANDACORP_LANE: typeof lane === 'number' ? `lane-${lane}` : String(lane), PORT: String(port), PANDACORP_E2E_PORT: String(port) })

// ── worktrees ──────────────────────────────────────────────────────────────────────────────────
export const realOr = (p) => { try { return realpathSync(p) } catch { const up = path.dirname(p); return up === p ? p : path.join(realOr(up), path.basename(p)) } }
export const registered = (ctx) => ctx.g.must(['worktree', 'list', '--porcelain']).split('\n').filter((l) => l.startsWith('worktree ')).map((l) => realOr(l.slice(9)))
/** Run a command async (bounded); resolves { ok, code, tail }. */
export function runAsync(cmd, args, { cwd, env, timeoutMs }) {
  return new Promise((resolve) => {
    let out = ''
    const p = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
    const timer = setTimeout(() => p.kill('SIGKILL'), timeoutMs)
    const add = (b) => { out = `${out}${b}`.slice(-8000) }
    p.stdout.on('data', add)
    p.stderr.on('data', add)
    p.once('error', (e) => { clearTimeout(timer); resolve({ ok: false, code: null, tail: e.message }) })
    p.once('close', (code, signal) => { clearTimeout(timer); resolve({ ok: code === 0, code, signal, tail: out.trim().split('\n').slice(-12).join('\n') }) })
  })
}
const BOOTSTRAP_MS = 20 * 60 * 1000
// ── bootstrap-owned files (bench FM-6) ─────────────────────────────────────────────────────────
// worktree-bootstrap.sh (and a project's own worktree-setup.sh hook) rewrite files a project may TRACK: launch.json
// with the lane's ports, e2e/server-env.json's PORT; and write untracked ones (.env.local). In a lane they are the lane's
// own config. The set is never guessed: bootstrapLane observes what the real script changed (new, or a different
// mtime/size/content than before it ran) and records it in the worktree's own git dir; a tracked one also gets
// `skip-worktree` (hidden from `status`, refused by a plain `git add`, skipped by `commit -a`), the precedent the
// bootstrap itself set for server-env.json. skip-worktree alone breaks every checkout/rebase that crosses a change to
// such a file on main ("not uptodate. Cannot merge"), so the git ops that move a lane's tree run inside withOwnedAside.
/** Every path `git status` reports in the worktree (root-relative, untracked one by one). */
const statusPaths = (g) => g.must(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames']).split('\0').filter(Boolean).map((e) => e.slice(3))
/** Every skip-worktree path of the worktree's index. */
const skipWorktreePaths = (g) => g.must(['ls-files', '-v', '-z']).split('\0').filter((e) => /^[Ss] /.test(e)).map((e) => e.slice(2))
/** A file's identity for "did the bootstrap write it": mtime, size and content hash ('absent' when gone). */
function fileSig(wt, rel) {
  try {
    const abs = path.join(wt, rel)
    const st = lstatSync(abs)
    return `${st.mtimeMs}:${st.size}:${st.isFile() ? createHash('sha256').update(readFileSync(abs)).digest('hex') : st.mode}`
  } catch { return 'absent' }
}
/** The previously recorded owned set, [] when there is none or it cannot be read (it is re-derived right after). */
const priorOwned = (g) => { try { return readOwned(g) || [] } catch { return [] } }
/** Run `fn` (the bootstrap) and record what it wrote as the worktree's bootstrap-owned files. */
async function recordOwned(wt, fn) {
  const g = gitIn(wt)
  const prior = priorOwned(g).map((e) => e.path)
  const before = new Map(unique([...statusPaths(g), ...skipWorktreePaths(g), ...prior]).map((p) => [p, fileSig(wt, p)]))
  const out = await fn()
  const priorSet = new Set(prior)
  // Owned: dirty or hidden now AND written by this run (or by an earlier recorded run); dirt that was there before and
  // that the script left alone stays dirt.
  const owned = unique([...statusPaths(g), ...skipWorktreePaths(g)]).filter((p) => priorSet.has(p) || !before.has(p) || before.get(p) !== fileSig(wt, p)).sort()
  const tracked = new Set(owned.length ? g.must(['--literal-pathspecs', 'ls-files', '-z', '--', ...owned]).split('\0').filter(Boolean) : [])
  const hide = owned.filter((p) => tracked.has(p))
  if (hide.length) g.must(['update-index', '--skip-worktree', '--', ...hide])
  writeOwned(g, owned.map((p) => ({ path: p, tracked: tracked.has(p) })))
  return out
}
/**
 * Run the sync `fn` (a checkout, reset, rebase or clean of the lane's tree) with every bootstrap-owned file set aside:
 * its bytes kept, skip-worktree cleared, the file back at HEAD (or removed when HEAD has none); then put back and
 * re-hidden, whatever `fn` did. A bootstrap rewrite never takes part in a lane's git ops, so it never lands.
 */
export function withOwnedAside(wt, fn) {
  const g = gitIn(wt)
  const saved = []
  for (const e of readOwned(g) || []) {
    const abs = path.join(wt, e.path)
    let st = null
    try { st = lstatSync(abs) } catch { st = null }
    if (!st || !st.isFile()) continue
    saved.push({ path: e.path, bytes: readFileSync(abs), mode: st.mode })
    g.run(['update-index', '--no-skip-worktree', '--', e.path])
    if (g.run(['cat-file', '-e', `HEAD:${e.path}`]).ok) g.must(['--literal-pathspecs', 'checkout', 'HEAD', '--', e.path])
    else rmSync(abs, { force: true })
  }
  try { return fn() } finally {
    for (const x of saved) {
      const abs = path.join(wt, x.path)
      mkdirSync(path.dirname(abs), { recursive: true })
      writeFileSync(abs, x.bytes)
      chmodSync(abs, x.mode & 0o7777)
      if (g.run(['--literal-pathspecs', 'ls-files', '--error-unmatch', '--', x.path]).ok) g.run(['update-index', '--skip-worktree', '--', x.path])
    }
  }
}
/**
 * The bootstrap-owned tracked files a lane's commits `base..tip` carry with the lane's own bootstrap bytes: a rewrite
 * that was committed (forced past skip-worktree, or before it existed). Never landed on main.
 */
export function ownedLeaks(wt, base, tip) {
  const g = gitIn(wt)
  const owned = (readOwned(g) || []).filter((e) => e.tracked).map((e) => e.path)
  if (!owned.length) return []
  const changed = g.must(['--literal-pathspecs', 'diff', '--name-only', base, tip, '--', ...owned]).split('\n').filter(Boolean)
  return changed.filter((p) => {
    const blob = g.run(['cat-file', 'blob', `${tip}:${p}`])
    let bytes = null
    try { bytes = readFileSync(path.join(wt, p), 'utf8') } catch { bytes = null }
    return blob.ok && bytes !== null && blob.out === bytes
  })
}
/**
 * Bootstrap a lane (or snapshot) worktree on its port and write its lane.env, recording what they wrote as the
 * worktree's bootstrap-owned files; null on success, else the failure.
 */
export async function bootstrapLane(ctx, wt, lane, port) {
  const env = laneEnv(lane, port)
  const dir = path.join(wt, ctx.prefix)
  const r = await recordOwned(wt, async () => {
    const run = await runAsync('bash', ['.pandacorp/worktree-bootstrap.sh'], { cwd: dir, env, timeoutMs: BOOTSTRAP_MS })
    mkdirSync(path.join(dir, '.pandacorp', 'run'), { recursive: true })
    writeFileSync(path.join(dir, '.pandacorp', 'run', 'lane.env'), Object.entries(env).map(([k, v]) => `export ${k}=${v}\n`).join(''))
    return run
  })
  return r.ok ? null : `worktree-bootstrap.sh exited ${r.code}${r.signal ? ` (${r.signal})` : ''}: ${r.tail.split('\n').slice(-3).join(' | ')}`
}
/**
 * Refuse a lane directory that is not its OWN git worktree. Lanes live inside main's tree, so a lane dir whose `.git`
 * file is gone (or never was) resolves to MAIN's checkout: a `checkout -f`/`clean` there would reset main.
 */
export function assertOwnWorktree(wt) {
  const top = gitIn(wt).run(['rev-parse', '--show-toplevel'])
  if (!top.ok || realOr(top.out.trim()) !== realOr(wt)) throw new Refusal('lane-orphan', `${wt} is not its own git worktree (git resolves it to ${top.ok ? top.out.trim() : 'nothing'}): evidence preserved, nothing touched`)
}
const INSTALL_RE = /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|bun\.lockb?)$/
const PRISMA_RE = /(^|\/)prisma\/|\.prisma$/i
const DB_RE = /(^|\/)(prisma|migrations?|drizzle)\/|\.sql$/i
/** What moved between a lane's previous base and the new one that needs a resync (install, prisma generate, DB). */
export function resyncNeeds(ctx, from, to) {
  if (!from || from === to) return { install: false, prisma: false, db: false, changed: [] }
  const r = ctx.g.run(['diff', '--name-only', '--relative', from, to, '--', '.'])
  const changed = r.ok ? r.out.split('\n').filter(Boolean) : null
  if (!changed) return { install: true, prisma: true, db: true, changed: ['<unknown: the previous base is unreachable>'] }
  return { install: changed.some((p) => INSTALL_RE.test(p)), prisma: changed.some((p) => PRISMA_RE.test(p)), db: changed.some((p) => DB_RE.test(p)), changed: changed.filter((p) => INSTALL_RE.test(p) || PRISMA_RE.test(p) || DB_RE.test(p)) }
}
/**
 * Resync a lane (or snapshot) worktree to what moved: the bootstrap (the one writer of its install, DB hook and pinned
 * e2e port) when the install or the DB moved or `rebootstrap`, then `prisma generate` when the schema moved.
 * @returns {Promise<{ ran: string[], failure: string|null }>}
 */
export async function resyncLane(ctx, wt, lane, port, needs, rebootstrap = false) {
  const proj = path.join(wt, ctx.prefix)
  const ran = []
  if (rebootstrap || needs.install || needs.db) {
    const failure = await bootstrapLane(ctx, wt, lane, port)
    if (failure) return { ran, failure }
    ran.push('bootstrap')
  }
  const prisma = path.join(proj, 'node_modules', '.bin', 'prisma')
  if (needs.prisma && existsSync(prisma)) {
    const r = await runAsync(prisma, ['generate'], { cwd: proj, env: laneEnv(lane, port), timeoutMs: 5 * 60 * 1000 })
    if (!r.ok) return { ran, failure: `prisma generate failed: ${r.tail.split('\n').slice(-3).join(' | ')}` }
    ran.push('prisma-generate')
  }
  return { ran, failure: null }
}
/** Create (or reuse) a detached worktree at `wt` on `sha`. Returns { created } or throws a Refusal. */
export function ensureWorktree(ctx, wt, sha) {
  const isReg = registered(ctx).includes(realOr(wt))
  if (existsSync(wt) && isReg) { assertOwnWorktree(wt); return { created: false } }
  if (existsSync(wt)) throw new Refusal('lane-orphan', `${wt} exists but is not a registered worktree: evidence preserved, nothing touched`)
  if (isReg) ctx.g.must(['worktree', 'prune', '--expire=now'])
  const add = ctx.g.run(['worktree', 'add', '-q', '--detach', wt, sha])
  if (!add.ok) throw new Refusal('worktree-add-failed', `git worktree add ${wt} failed: ${add.err}`)
  return { created: true }
}

// ── ops ────────────────────────────────────────────────────────────────────────────────────────
/**
 * `lane-pool --size K`: K lane worktrees (more when a live chain of an earlier run holds a higher lane), each
 * bootstrapped on its own port. Worktrees and ports are claimed under lanes.lock; the bootstrap (minutes) runs outside
 * it, in parallel, with each lane `booting` meanwhile (never free), then `broken` with its failure or ready.
 */
export async function lanePoolOp(o) {
  if (!Number.isInteger(o.size) || o.size < 1) throw new InputError('lane-pool needs --size <K ≥ 1>')
  const ctx = projectCtx(o.project)
  const head = ctx.g.must(['rev-parse', 'HEAD']).trim()
  const lanes = await withState(ctx, o, async (s) => {
    const size = Math.max(o.size, ...Object.values(s.chains).filter((c) => LIVE.has(c.status) && c.lane).map((c) => c.lane))
    const out = []
    for (let n = 1; n <= size; n++) {
      const wt = path.join(lanesDir(ctx), `lane-${n}`)
      const { created } = ensureWorktree(ctx, wt, head)
      let entry = s.pool.find((l) => l.lane === n)
      if (!entry) { entry = { lane: n, path: wt, port: null, base: head, chain: null }; s.pool.push(entry) }
      entry.port = await lanePort(s, n, entry.port)
      Object.assign(entry, { booting: true, broken: null })
      out.push({ lane: n, wt, port: entry.port, created })
    }
    s.pool.sort((a, b) => a.lane - b.lane)
    return out
  })
  const failures = await Promise.all(lanes.map((l) => bootstrapLane(ctx, l.wt, l.lane, l.port)))
  return withState(ctx, o, async (s) => {
    lanes.forEach((l, i) => { const e = s.pool.find((x) => x.lane === l.lane); if (e) Object.assign(e, { booting: false, broken: failures[i] || null }) })
    const failed = lanes.map((l, i) => (failures[i] ? { lane: l.lane, failure: failures[i] } : null)).filter(Boolean)
    const pool = s.pool.map((l) => ({ lane: l.lane, path: l.path, port: l.port, chain: l.chain, broken: l.broken || null, env: laneEnv(l.lane, l.port) }))
    if (failed.length === lanes.length) return { code: 4, body: { status: 'bootstrap-failed', failures: failed, pool } }
    return { code: 0, body: { status: 'ready', pool, failures: failed, created: lanes.filter((x) => x.created).map((x) => x.lane) } }
  })
}

/** `lane-plan`: see planChains. Read-only (the refresh is reported, not written). */
export function lanePlanOp(o) {
  checkLaneFlags(o)
  const ctx = projectCtx(o.project)
  const graph = woGraph(ctx)
  const state = readState(ctx)
  const landedByGit = refreshFromMain(state, graph.nodes, ctx)
  return { code: 0, body: { status: 'planned', ...planChains(graph, state, scopeOf(o)), landedByGit } }
}
/** The planner options of an op's flags (shared by lane-plan, lane-next and fast-start). */
export const scopeOf = (o) => ({ scope: o.frds || [], lanes: o.lanes, mode: o.mode, build: o.builds || [], waitVerified: o.waitVerifieds || [] })
export function checkLaneFlags(o) {
  if (o.lanes !== undefined && o.lanes < 1) throw new InputError('--lanes must be ≥ 1')
  if (o.mode && !(o.mode in MODE_CAPS)) throw new InputError(`--mode must be one of ${Object.keys(MODE_CAPS).join('|')}`)
}

/** The lane's commits over `base`: { sha, subject, wo } (wo: the WO a `feat(...)` commit builds, else null). */
export function laneCommits(g, base, tip) {
  const r = g.run(['log', '--reverse', '--format=%H%x09%s', `${base}..${tip}`])
  if (!r.ok) throw new InputError(`git log ${base}..${tip} failed: ${r.err}`)
  return r.out.split('\n').filter(Boolean).map((l) => {
    const [sha, subject] = l.split('\t')
    const m = /^feat\([^)]*\): (WO-[A-Za-z0-9]+-\d+)\b/.exec(subject)
    return { sha, subject, wo: m ? normWoId(m[1]) : null }
  })
}
/** Every chain WO built by exactly ONE `feat` commit (DR-097): the missing and the duplicated ids. */
export function commitShape(commits, wos) {
  const count = (id) => commits.filter((c) => c.wo === id).length
  return { missing: wos.filter((id) => count(id) === 0), duplicated: wos.filter((id) => count(id) > 1) }
}

export const chainDownstream = (graph, wos) => { const { depth } = downstreamOf(graph.nodes); return Math.max(...wos.map(depth)) }

/** `lane-mark --chain c --as built|parked [--why text]`. */
export async function laneMarkOp(o) {
  if (!o.chain || !['built', 'parked'].includes(o.as)) throw new InputError('lane-mark needs --chain <id> and --as built|parked')
  const ctx = projectCtx(o.project)
  const graph = woGraph(ctx)
  return withState(ctx, o, async (s) => {
    const c = s.chains[o.chain]
    if (!c) throw new Refusal('no-such-chain', `no chain ${o.chain} in the lane state`)
    if (!LIVE.has(c.status)) throw new Refusal('chain-not-live', `${o.chain} is ${c.status}`)
    if (o.as === 'built') {
      if (c.barrier) throw new Refusal('barrier-on-main', `${o.chain} is a barrier: it lands by its own commits on main, never through the queue`)
      const lane = s.pool.find((l) => l.lane === c.lane)
      if (!lane) throw new Refusal('no-such-lane', `${o.chain}'s lane ${c.lane} is not in the pool`)
      const shape = commitShape(laneCommits(gitIn(lane.path), c.base, `lane/${c.id}`), c.wos)
      if (shape.missing.length || shape.duplicated.length) throw new Refusal('commit-shape', `one commit per work order (DR-097): missing ${shape.missing.join(', ') || 'none'}, duplicated ${shape.duplicated.join(', ') || 'none'}`, shape)
      Object.assign(c, { status: 'built', builtAt: new Date().toISOString() })
      return { code: 0, body: { status: 'built', chain: c.id } }
    }
    Object.assign(c, { status: 'parked', parkedAt: new Date().toISOString(), why: o.why || null })
    for (const l of s.pool) if (l.chain === c.id) l.chain = null
    const plan = planChains(graph, s, {})
    return { code: 0, body: { status: 'parked', chain: c.id, blockedWos: plan.blockedWos, blockedFrds: plan.blockedFrds } }
  })
}

export const LANE_OPS = { 'lane-pool': lanePoolOp, 'lane-plan': lanePlanOp, 'lane-mark': laneMarkOp }
