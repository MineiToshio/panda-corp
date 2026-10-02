// build-mech-lanes.mjs — proposal 40 §3 Phase B (Lever 2): the lane pool and the chain planner of pandacorp-build-mech.mjs.
// The engine only orchestrates; every lane decision that a script can make is made here, deterministically:
//   lane-pool     --size K                      create/reuse K detached worktrees under .pandacorp/run/lanes/lane-<n>,
//                                               each bootstrapped (worktree-bootstrap.sh) on its OWN port
//   lane-plan     [--frd f]… [--lanes N] [--mode M]   the ready set recomputed from the WO DAG (dependsOn, DR-087) on
//                                               main: chains of ≤ 3 WOs of one FRD in dependency order, barriers, K,
//                                               the landing queue, the parked/blocked sets. Read-only.
//   lane-dispatch --chain c --wo a [--wo b…] (--lane n | --barrier)   a lane chain: salvage the lane's dirt, reset it
//                                               to main's HEAD on `lane/<c>` (a re-dispatch of the SAME chain keeps
//                                               its committed WOs, DR-086), resync when the lockfile, prisma/** or the
//                                               migrations moved since the lane's last base, give it a free port, and
//                                               hand back its env (PANDACORP_LANE forces Playwright reuseExistingServer
//                                               false, so a lane never tests a sibling's server). A barrier chain
//                                               (prisma/**, migrations, package.json, a lockfile) builds on MAIN:
//                                               only recorded here, and lane landings pause until it commits.
//   lane-mark     --chain c --as built|parked [--why text]   a built chain joins the landing queue (one commit per
//                                               WO checked); a parked one blocks only its DAG descendants.
// land-chain and lane-bisect live in build-mech-lane-land.mjs. Lane state is gitignored run state
// (.pandacorp/run/lanes/state.json, under its own lanes.lock); git stays the truth: a chain whose WOs are committed on
// main is landed whatever the state file says.

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { InputError, Refusal, acquireLock, dirtyEntries, gitIn, projectCtx, releaseLock, salvageAndReset, unique, utcStamp } from './build-mech-lib.mjs'
import { fmList, normWoId, readFrds } from './build-mech-fast.mjs'

/** Lane caps per run mode (proposal 40 §9): pro never lanes, balanced 2, powerful/deep 4. */
export const MODE_CAPS = Object.freeze({ pro: 1, balanced: 2, powerful: 4, deep: 4 })
export const DEFAULT_LANES = 2
export const CHAIN_MAX = 3
/** A chain touching any of these builds on main and pauses lane landings until it commits (§3 B.2). */
export const BARRIER_PATHS = Object.freeze([
  /(^|\/)prisma\//, /\.(sql|prisma)$/i, /(^|\/)migrations?\//, /(^|\/)drizzle\//,
  /(^|\/)package\.json$/, /(^|\/)(pnpm-lock\.yaml|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|bun\.lockb?)$/,
])
const INSTALL_RE = /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|bun\.lockb?)$/
const PRISMA_RE = /(^|\/)prisma\/|\.prisma$/i
const DB_RE = /(^|\/)(prisma|migrations?|drizzle)\/|\.sql$/i
const LIVE = new Set(['dispatched', 'built', 'needs-fix'])
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
/** Read-modify-write the state under lanes.lock; `fn` may be async and returns the op's result. */
export async function withState(ctx, o, fn) {
  const lock = acquireLock(ctx, { waitMs: o.lockWaitMs, op: o.op, name: 'lanes.lock' })
  try {
    const s = readState(ctx)
    const out = await fn(s)
    writeState(ctx, s)
    return out
  } finally { releaseLock(lock) }
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

/** Bring the state in line with git: a live chain whose work orders are all committed on main is landed. */
export function refreshFromMain(state, nodes) {
  const landedNow = []
  for (const c of Object.values(state.chains)) {
    if (!LIVE.has(c.status)) continue
    if (c.wos.every((id) => nodes.has(id) && DONE_STATUSES.has(nodes.get(id).status))) { c.status = 'landed'; c.landedBy = c.barrier ? 'main-commit' : 'git'; landedNow.push(c.id) }
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
export function planChains(graph, state, { scope = [], lanes, mode }) {
  const { nodes } = graph
  const { depth, children } = downstreamOf(nodes)
  const inScope = (n) => !scope.length || scope.includes(n.frd)
  const live = Object.values(state.chains).filter((c) => LIVE.has(c.status))
  const inFlight = new Set(live.flatMap((c) => c.wos))
  const parkedChains = Object.values(state.chains).filter((c) => c.status === 'parked')
  const roots = unique([...parkedChains.flatMap((c) => c.wos), ...[...nodes.values()].filter((n) => n.status === 'BLOCKED').map((n) => n.id)])
  const blocked = new Set([...roots, ...descendants(children, roots)])
  const done = (id) => { const n = nodes.get(id); return Boolean(n) && (n.status === 'VERIFIED' || (n.status === 'IN_REVIEW' && inScope(n))) }
  const pending = (n) => !DONE_STATUSES.has(n.status) && n.status !== 'BLOCKED'
  const unsatisfiedDeps = []
  const ready = [...nodes.values()].filter((n) => {
    if (!pending(n) || !inScope(n) || inFlight.has(n.id) || blocked.has(n.id)) return false
    const missing = n.deps.filter((d) => !done(d))
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
    while (!head.barrier && chain.length < CHAIN_MAX) {
      const ids = new Set(chain.map((n) => n.id))
      const next = [...nodes.values()].filter((n) => n.frd === head.frd && !n.barrier && pending(n) && !claimed.has(n.id) && !inFlight.has(n.id) && !blocked.has(n.id)
        && n.deps.some((d) => ids.has(d)) && n.deps.every((d) => ids.has(d) || done(d))).sort(prio)[0]
      if (!next) break
      chain.push(next)
      claimed.add(next.id)
    }
    chains.push({ id: chainIdOf(chain.map((n) => n.id)), frd: head.frd, wos: chain.map((n) => n.id), barrier: head.barrier, downstream: Math.max(...chain.map((n) => depth(n.id))) })
  }
  const cap = MODE_CAPS[mode] ?? MODE_CAPS.powerful
  const requested = lanes ?? DEFAULT_LANES
  const width = chains.length + live.filter((c) => !c.barrier).length
  let k = Math.max(1, Math.min(requested, cap))
  let kReason = lanes !== undefined ? 'requested' : 'default'
  if (requested > cap) kReason = `mode-cap-${mode || 'powerful'}`
  if (width <= 1 && k > 1) { k = 1; kReason = 'narrow-dag' }
  const barrier = activeBarrier(state)
  const freeLanes = state.pool.filter((l) => !l.chain).map((l) => l.lane)
  const laneChains = chains.filter((c) => !c.barrier)
  const landQueue = live.filter((c) => c.status === 'built').sort((a, b) => b.downstream - a.downstream || String(a.builtAt).localeCompare(String(b.builtAt))).map((c) => c.id)
  const blockedFrds = unique([...blocked].map((id) => nodes.get(id)?.frd).filter(Boolean)).sort()
  return {
    k, kRequested: requested, kCap: cap, kReason, width, chains,
    dispatch: { lanes: laneChains.slice(0, freeLanes.length).map((c, i) => ({ chain: c.id, lane: freeLanes[i] })), barrier: barrier ? null : (chains.find((c) => c.barrier) || {}).id || null },
    barrierActive: barrier ? barrier.id : null, landingsPaused: Boolean(barrier), landQueue,
    inFlight: live.map((c) => c.id), parked: parkedChains.map((c) => c.id), blockedWos: [...blocked].sort(), blockedFrds, unsatisfiedDeps,
    remaining: [...nodes.values()].filter((n) => pending(n) && inScope(n)).length,
  }
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
async function lanePort(state, lane, current) {
  const taken = new Set(state.pool.filter((l) => l.lane !== lane && l.port).map((l) => l.port))
  if (current && !taken.has(current) && !(await portBusy(current))) return current
  return freePort(taken, lane - 1)
}
/** The env a lane's builder, self-verify and e2e run with (written to the lane's .pandacorp/run/lane.env too). */
export const laneEnv = (lane, port) => ({ PANDACORP_LANE: typeof lane === 'number' ? `lane-${lane}` : String(lane), PORT: String(port), PANDACORP_E2E_PORT: String(port) })

// ── worktrees ──────────────────────────────────────────────────────────────────────────────────
const realOr = (p) => { try { return realpathSync(p) } catch { const up = path.dirname(p); return up === p ? p : path.join(realOr(up), path.basename(p)) } }
const registered = (ctx) => ctx.g.must(['worktree', 'list', '--porcelain']).split('\n').filter((l) => l.startsWith('worktree ')).map((l) => realOr(l.slice(9)))
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
/** Bootstrap a lane (or snapshot) worktree on its port and write its lane.env; null on success, else the failure. */
export async function bootstrapLane(ctx, wt, lane, port) {
  const env = laneEnv(lane, port)
  const dir = path.join(wt, ctx.prefix)
  const r = await runAsync('bash', ['.pandacorp/worktree-bootstrap.sh'], { cwd: dir, env, timeoutMs: BOOTSTRAP_MS })
  mkdirSync(path.join(dir, '.pandacorp', 'run'), { recursive: true })
  writeFileSync(path.join(dir, '.pandacorp', 'run', 'lane.env'), Object.entries(env).map(([k, v]) => `export ${k}=${v}\n`).join(''))
  return r.ok ? null : `worktree-bootstrap.sh exited ${r.code}${r.signal ? ` (${r.signal})` : ''}: ${r.tail.split('\n').slice(-3).join(' | ')}`
}
/** Create (or reuse) a detached worktree at `wt` on `sha`. Returns { created } or throws a Refusal. */
export function ensureWorktree(ctx, wt, sha) {
  const isReg = registered(ctx).includes(realOr(wt))
  if (existsSync(wt) && isReg) return { created: false }
  if (existsSync(wt)) throw new Refusal('lane-orphan', `${wt} exists but is not a registered worktree: evidence preserved, nothing touched`)
  if (isReg) ctx.g.must(['worktree', 'prune', '--expire=now'])
  const add = ctx.g.run(['worktree', 'add', '-q', '--detach', wt, sha])
  if (!add.ok) throw new Refusal('worktree-add-failed', `git worktree add ${wt} failed: ${add.err}`)
  return { created: true }
}

// ── ops ────────────────────────────────────────────────────────────────────────────────────────
/** `lane-pool --size K`: K lane worktrees, each bootstrapped on its own port (in parallel). */
export async function lanePoolOp(o) {
  if (!Number.isInteger(o.size) || o.size < 1) throw new InputError('lane-pool needs --size <K ≥ 1>')
  const ctx = projectCtx(o.project)
  const head = ctx.g.must(['rev-parse', 'HEAD']).trim()
  return withState(ctx, o, async (s) => {
    const lanes = []
    for (let n = 1; n <= o.size; n++) {
      const wt = path.join(lanesDir(ctx), `lane-${n}`)
      const { created } = ensureWorktree(ctx, wt, head)
      let entry = s.pool.find((l) => l.lane === n)
      if (!entry) { entry = { lane: n, path: wt, port: null, base: head, chain: null }; s.pool.push(entry) }
      entry.port = await lanePort(s, n, entry.port)
      lanes.push({ entry, wt, created })
    }
    s.pool.sort((a, b) => a.lane - b.lane)
    const failures = (await Promise.all(lanes.map(({ entry, wt }) => bootstrapLane(ctx, wt, entry.lane, entry.port)))).map((f, i) => (f ? { lane: lanes[i].entry.lane, failure: f } : null)).filter(Boolean)
    if (failures.length) return { code: 4, body: { status: 'bootstrap-failed', failures, pool: s.pool } }
    return { code: 0, body: { status: 'ready', pool: s.pool.map((l) => ({ lane: l.lane, path: l.path, port: l.port, chain: l.chain, env: laneEnv(l.lane, l.port) })), created: lanes.filter((x) => x.created).map((x) => x.entry.lane) } }
  })
}

/** `lane-plan`: see planChains. Read-only (the refresh is reported, not written). */
export function lanePlanOp(o) {
  if (o.lanes !== undefined && o.lanes < 1) throw new InputError('--lanes must be ≥ 1')
  if (o.mode && !(o.mode in MODE_CAPS)) throw new InputError(`--mode must be one of ${Object.keys(MODE_CAPS).join('|')}`)
  const ctx = projectCtx(o.project)
  const graph = woGraph(ctx)
  const state = readState(ctx)
  const landedByGit = refreshFromMain(state, graph.nodes)
  return { code: 0, body: { status: 'planned', ...planChains(graph, state, { scope: o.frds, lanes: o.lanes, mode: o.mode }), landedByGit } }
}

/** What moved between a lane's previous base and the new one that needs a resync (install, prisma generate, DB). */
function resyncNeeds(ctx, from, to) {
  if (!from || from === to) return { install: false, prisma: false, db: false, changed: [] }
  const r = ctx.g.run(['diff', '--name-only', '--relative', from, to, '--', '.'])
  const changed = r.ok ? r.out.split('\n').filter(Boolean) : null
  if (!changed) return { install: true, prisma: true, db: true, changed: ['<unknown: the previous base is unreachable>'] }
  return { install: changed.some((p) => INSTALL_RE.test(p)), prisma: changed.some((p) => PRISMA_RE.test(p)), db: changed.some((p) => DB_RE.test(p)), changed: changed.filter((p) => INSTALL_RE.test(p) || PRISMA_RE.test(p) || DB_RE.test(p)) }
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

/** `lane-dispatch --chain c --wo …  (--lane n | --barrier)`. */
export async function laneDispatchOp(o) {
  if (!o.wos.length) throw new InputError('lane-dispatch needs the chain\'s --wo ids in dependency order')
  if (Boolean(o.barrier) === (o.lane !== undefined)) throw new InputError('lane-dispatch needs exactly one of --lane <n> or --barrier')
  const ctx = projectCtx(o.project)
  const graph = woGraph(ctx)
  const wos = o.wos.map(normWoId)
  const unknown = wos.filter((id) => !graph.nodes.has(id))
  if (unknown.length) throw new InputError(`unknown work order(s): ${unknown.join(', ')}`)
  const id = o.chain || chainIdOf(wos)
  const barrierWos = wos.filter((w) => graph.nodes.get(w).barrier)
  if (barrierWos.length && !o.barrier) throw new Refusal('barrier-off-main', `${barrierWos.join(', ')} touch a schema, migration, package.json or lockfile path: that chain builds on main (--barrier), never in a lane`, { wos: barrierWos })
  const head = ctx.g.must(['rev-parse', 'HEAD']).trim()
  return withState(ctx, o, async (s) => {
    refreshFromMain(s, graph.nodes)
    const prior = s.chains[id]
    const busy = Object.values(s.chains).find((c) => c.id !== id && LIVE.has(c.status) && c.wos.some((w) => wos.includes(w)))
    if (busy) throw new Refusal('wo-in-flight', `${busy.wos.filter((w) => wos.includes(w)).join(', ')} already in the live chain ${busy.id}`)
    if (o.barrier) {
      const other = activeBarrier(s)
      if (other && other.id !== id) throw new Refusal('barrier-active', `the barrier chain ${other.id} is still building on main: one barrier at a time`)
      s.chains[id] = { id, frd: graph.nodes.get(wos[0]).frd, wos, lane: null, barrier: true, base: head, status: 'dispatched', fixes: prior ? prior.fixes : 0, downstream: chainDownstream(graph, wos), dispatchedAt: new Date().toISOString() }
      return { code: 0, body: { status: 'dispatched', chain: id, barrier: true, where: 'main', wos, landingsPaused: true } }
    }
    const entry = s.pool.find((l) => l.lane === o.lane)
    if (!entry) throw new Refusal('no-such-lane', `lane ${o.lane} is not in the pool (run lane-pool first)`)
    if (entry.chain && entry.chain !== id) throw new Refusal('lane-busy', `lane ${o.lane} holds the live chain ${entry.chain}`)
    const wt = entry.path
    if (!existsSync(wt)) throw new Refusal('lane-missing', `lane ${o.lane}'s worktree ${wt} is gone: recreate the pool`)
    const lctx = projectCtx(path.join(wt, ctx.prefix))
    const branch = `lane/${id}`
    const resumed = Boolean(prior && LIVE.has(prior.status) && prior.lane === o.lane && lctx.g.run(['rev-parse', '--verify', '-q', branch]).ok)
    // The lane's dirt is a previous builder's evidence: salvaged into the MAIN project's run dir before any reset.
    const dirt = dirtyEntries(lctx)
    const salvageDir = path.join(ctx.project, '.pandacorp', 'run', 'salvage', `lane-${o.lane}`, utcStamp())
    const salvaged = dirt.length ? salvageAndReset(lctx, dirt, salvageDir) : []
    const wg = gitIn(wt)
    wg.must(resumed ? ['checkout', '-q', '-f', branch] : ['checkout', '-q', '-f', '-B', branch, head])
    lctx.g.must(['clean', '-fdq', '--', '.'])
    const base = resumed ? prior.base : head
    const needs = resyncNeeds(ctx, entry.base, wg.must(['rev-parse', 'HEAD']).trim())
    const port = await lanePort(s, o.lane, entry.port)
    const ran = []
    // The bootstrap is the one writer of the lane's install, DB hook and pinned e2e port: re-run only when one moved.
    if (needs.install || needs.db || port !== entry.port || !portPinned(lctx, port)) {
      const f = await bootstrapLane(ctx, wt, o.lane, port)
      if (f) throw new Refusal('resync-failed', f)
      ran.push('bootstrap')
    }
    if (needs.prisma && existsSync(path.join(lctx.project, 'node_modules', '.bin', 'prisma'))) {
      const r = await runAsync(path.join(lctx.project, 'node_modules', '.bin', 'prisma'), ['generate'], { cwd: lctx.project, env: laneEnv(o.lane, port), timeoutMs: 5 * 60 * 1000 })
      if (!r.ok) throw new Refusal('resync-failed', `prisma generate failed: ${r.tail.split('\n').slice(-3).join(' | ')}`)
      ran.push('prisma-generate')
    }
    Object.assign(entry, { port, base: wg.must(['rev-parse', 'HEAD']).trim(), chain: id })
    s.chains[id] = { id, frd: graph.nodes.get(wos[0]).frd, wos, lane: o.lane, barrier: false, base, status: 'dispatched', fixes: prior && resumed ? prior.fixes : 0, downstream: chainDownstream(graph, wos), dispatchedAt: new Date().toISOString() }
    const committed = resumed ? laneCommits(wg, base, 'HEAD').filter((c) => c.wo).map((c) => c.wo) : []
    return { code: 0, body: { status: 'dispatched', chain: id, lane: o.lane, branch, path: lctx.project, base: base.slice(0, 12), resumed, committed, env: laneEnv(o.lane, port), resync: { ...needs, ran }, salvaged: salvaged.length ? { dir: salvageDir, paths: salvaged } : null } }
  })
}
/** Does the lane's e2e config already serve on its port (server-env.json PORT and the lane.env)? */
function portPinned(lctx, port) {
  const env = path.join(lctx.project, '.pandacorp', 'run', 'lane.env')
  if (!existsSync(env) || !readFileSync(env, 'utf8').includes(`PORT=${port}\n`)) return false
  const file = path.join(lctx.project, 'e2e', 'server-env.json')
  if (!existsSync(file)) return true
  try { return String(JSON.parse(readFileSync(file, 'utf8')).PORT) === String(port) } catch { return false }
}
const chainDownstream = (graph, wos) => { const { depth } = downstreamOf(graph.nodes); return Math.max(...wos.map(depth)) }

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

export const LANE_OPS = { 'lane-pool': lanePoolOp, 'lane-plan': lanePlanOp, 'lane-dispatch': laneDispatchOp, 'lane-mark': laneMarkOp }
