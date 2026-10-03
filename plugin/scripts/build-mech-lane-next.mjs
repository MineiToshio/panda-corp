// build-mech-lane-next.mjs — proposal 40 §3 Phase B (Lever 2): the engine's two lane ops that are not a landing.
//   lane-next   [--frd f]… [--build wo]… [--wait-verified f]… [--lanes N] [--mode M] [--resume]
//               ONE scheduling round of the engine: the state refreshed from git, then (with --resume, once per run)
//               every live lane chain of an earlier run re-dispatched on its own lane (its committed WOs kept, DR-086)
//               and every chain an earlier run parked retired (a park holds for one run; the chain is retried fresh),
//               the ready barrier dispatched to main (landings pause), every free ready lane given the next chain
//               (longest downstream path first; the resyncs run in parallel). The receipt is the engine's whole view:
//               what it must build now (`dispatched`, `barrier`), land (`landQueue`, `needsFix`), and what waits
//               (`parked`, `blockedFrds`: only the DAG descendants of a parked chain), plus K and the pool's health.
//   lane-usable --frd f --wo …  [--floor] [--sha <pin>]
//               USABLE for a lane-built FRD (§3 B.6): one full verify.sh on the PINNED SHA (HEAD at the start) in the
//               snapshot worktree, so landings go on meanwhile. The floor and the injection scan read the FRD's OWN
//               commits (its chains are interleaved with others on main). Green and not floor → the committed
//               build_usable line (DR-115: one writer). Red → the class and the bisect candidates: the chains landed
//               since the last green pin (`own` when they are all this FRD's, else `cross`), at most 3, newest last.
//               It never reverts.
//   lane-dispatch --chain c --wo …  (--lane n | --barrier)   one chain by hand (lane-next dispatches through the same
//               dispatchChain): see build-mech-lanes.mjs's header.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { InputError, Refusal, blobAt, dirtyEntries, findWo, frontmatterStatus, gitIn, isOnMain, projectCtx, salvageAndReset, unique, utcStamp } from './build-mech-lib.mjs'
import { classifyFrdRanges, commitUsable, injectionHits, normWoId, readFrds, readReport } from './build-mech-fast.mjs'
import { LIVE, activeBarrier, assertOwnWorktree, bootstrapLane, chainDownstream, chainIdOf, checkLaneFlags, ensureWorktree, freePort, laneCommits, laneEnv, lanePort, lanesDir, planChains, portBusy, readState, realOr, refreshFromMain, resyncLane, resyncNeeds, runAsync, scopeOf, withState, woGraph } from './build-mech-lanes.mjs'

const MAX_GREENS = 20

// ── dispatch (one chain) ───────────────────────────────────────────────────────────────────────
/** The registered worktrees that have `branch` checked out (real paths). */
function worktreesOn(ctx, branch) {
  const out = []
  let at = null
  for (const l of ctx.g.must(['worktree', 'list', '--porcelain']).split('\n')) {
    if (l.startsWith('worktree ')) at = realOr(l.slice(9))
    else if (l === `branch refs/heads/${branch}` && at) out.push(at)
  }
  return out
}
/**
 * Make `lane/<c>` safe to reset for a FRESH dispatch (a retried park reuses its chain id): a free pool lane still
 * holding the branch lets go of it; a live lane or a worktree outside the pool holding it is a refusal (nothing
 * touched). Commits on the old tip that main does not have are kept under refs/lane-parked/<c>/<stamp> first (DR-086:
 * committed work is never thrown away by a reset). Returns the archive, or null when there was nothing to keep.
 */
function freeBranchForReset(ctx, s, wt, branch, head) {
  const tip = ctx.g.run(['rev-parse', '--verify', '-q', `refs/heads/${branch}`])
  if (!tip.ok) return null
  for (const h of worktreesOn(ctx, branch).filter((p) => p !== realOr(wt))) {
    const holder = s.pool.find((l) => realOr(l.path) === h)
    if (!holder || holder.chain) throw new Refusal('branch-in-use', `${branch} is checked out in ${h}${holder ? ` (lane ${holder.lane}, live chain ${holder.chain})` : ', outside the lane pool'}: nothing touched`, { branch, worktree: h })
    assertOwnWorktree(holder.path)
    gitIn(holder.path).must(['checkout', '-q', '--detach'])
  }
  const sha = tip.out.trim()
  if (ctx.g.run(['merge-base', '--is-ancestor', sha, head]).ok) return null
  const ref = `refs/lane-parked/${branch.slice('lane/'.length)}/${utcStamp()}-${sha.slice(0, 12)}`
  ctx.g.must(['update-ref', ref, sha])
  return { ref, sha: sha.slice(0, 12) }
}
/** `lane-dispatch --chain c --wo …  (--lane n | --barrier)`. */
export async function laneDispatchOp(o) {
  if (!o.wos.length) throw new InputError('lane-dispatch needs the chain\'s --wo ids in dependency order')
  if (Boolean(o.barrier) === (o.lane !== undefined)) throw new InputError('lane-dispatch needs exactly one of --lane <n> or --barrier')
  const ctx = projectCtx(o.project)
  return dispatchChain(ctx, o, woGraph(ctx), { chain: o.chain, wos: o.wos, lane: o.lane, barrier: o.barrier })
}
/**
 * Dispatch one chain: a barrier is only recorded (it builds on main); a lane chain is claimed under lanes.lock (the
 * lane's dirt salvaged, the lane reset to main's HEAD on `lane/<c>`, or back on its own branch for a re-dispatch of the
 * same chain, DR-086), resynced OUTSIDE the lock (bootstrap and `prisma generate` take minutes), then recorded. A failed
 * resync marks the lane `broken` and releases the chain (its WOs are ready again for a healthy lane).
 */
export async function dispatchChain(ctx, o, graph, req) {
  const wos = req.wos.map(normWoId)
  const unknown = wos.filter((id) => !graph.nodes.has(id))
  if (unknown.length) throw new InputError(`unknown work order(s): ${unknown.join(', ')}`)
  const id = req.chain || chainIdOf(wos)
  const barrierWos = wos.filter((w) => graph.nodes.get(w).barrier)
  if (barrierWos.length && !req.barrier) throw new Refusal('barrier-off-main', `${barrierWos.join(', ')} touch a schema, migration, package.json or lockfile path: that chain builds on main (--barrier), never in a lane`, { wos: barrierWos })
  const head = ctx.g.must(['rev-parse', 'HEAD']).trim()
  const record = (s, extra) => { const prior = s.chains[id]; s.chains[id] = { id, frd: graph.nodes.get(wos[0]).frd, wos, barrier: Boolean(req.barrier), status: 'dispatched', downstream: chainDownstream(graph, wos), dispatchedAt: new Date().toISOString(), fixes: prior && (req.barrier || extra.resumed) ? prior.fixes || 0 : 0, ...extra } }
  const claim = await withState(ctx, o, async (s) => {
    refreshFromMain(s, graph.nodes, ctx)
    const prior = s.chains[id]
    const busy = Object.values(s.chains).find((c) => c.id !== id && LIVE.has(c.status) && c.wos.some((w) => wos.includes(w)))
    if (busy) throw new Refusal('wo-in-flight', `${busy.wos.filter((w) => wos.includes(w)).join(', ')} already in the live chain ${busy.id}`)
    if (req.barrier) {
      const other = activeBarrier(s)
      if (other && other.id !== id) throw new Refusal('barrier-active', `the barrier chain ${other.id} is still building on main: one barrier at a time`)
      record(s, { lane: null, base: head })
      return { done: { code: 0, body: { status: 'dispatched', chain: id, barrier: true, where: 'main', wos, landingsPaused: true } } }
    }
    const entry = s.pool.find((l) => l.lane === req.lane)
    if (!entry) throw new Refusal('no-such-lane', `lane ${req.lane} is not in the pool (run lane-pool first)`)
    if (entry.chain && entry.chain !== id) throw new Refusal('lane-busy', `lane ${req.lane} holds the live chain ${entry.chain}`)
    if (entry.booting || entry.broken) throw new Refusal('lane-unready', `lane ${req.lane} is ${entry.booting ? 'still booting' : `broken (${entry.broken})`}`)
    const wt = entry.path
    if (!existsSync(wt)) throw new Refusal('lane-missing', `lane ${req.lane}'s worktree ${wt} is gone: recreate the pool`)
    assertOwnWorktree(wt)
    const lctx = projectCtx(path.join(wt, ctx.prefix))
    const branch = `lane/${id}`
    const resumed = Boolean(prior && LIVE.has(prior.status) && prior.lane === req.lane && lctx.g.run(['rev-parse', '--verify', '-q', branch]).ok)
    const archived = resumed ? null : freeBranchForReset(ctx, s, wt, branch, head)
    // The lane's dirt is a previous builder's evidence: salvaged into the MAIN project's run dir before any reset.
    const dirt = dirtyEntries(lctx)
    const salvageDir = path.join(ctx.project, '.pandacorp', 'run', 'salvage', `lane-${req.lane}`, utcStamp())
    const salvaged = dirt.length ? salvageAndReset(lctx, dirt, salvageDir) : []
    const wg = gitIn(wt)
    const co = wg.run(resumed ? ['checkout', '-q', '-f', branch] : ['checkout', '-q', '-f', '-B', branch, head])
    if (!co.ok) throw new Refusal('lane-checkout-failed', `lane ${req.lane}: git checkout ${branch} failed: ${co.err.split('\n').slice(-2).join(' | ')}`, { archived })
    lctx.g.must(['clean', '-fdq', '--', '.'])
    const base = resumed ? prior.base : head
    const tip = wg.must(['rev-parse', 'HEAD']).trim()
    const port = await lanePort(s, req.lane, entry.port)
    const prevPort = entry.port
    Object.assign(entry, { port, chain: id })
    record(s, { lane: req.lane, base, resumed })
    return { wt, wg, lctx, branch, resumed, base, tip, port, prevPort, archived, needs: resyncNeeds(ctx, entry.base, tip), salvaged: salvaged.length ? { dir: salvageDir, paths: salvaged } : null }
  })
  if (claim.done) return claim.done
  const { wt, wg, lctx, needs, port } = claim
  const { ran, failure } = await resyncLane(ctx, wt, req.lane, port, needs, port !== claim.prevPort || !portPinned(lctx, port))
  const out = await withState(ctx, o, async (s) => {
    const entry = s.pool.find((l) => l.lane === req.lane)
    if (failure) {
      Object.assign(entry, { chain: null, broken: failure })
      delete s.chains[id]
      wg.run(['checkout', '-q', '--detach'])
      return null
    }
    entry.base = claim.tip
    const committed = claim.resumed ? laneCommits(wg, claim.base, 'HEAD').filter((c) => c.wo).map((c) => c.wo) : []
    return { code: 0, body: { status: 'dispatched', chain: id, frd: s.chains[id].frd, wos, lane: req.lane, branch: claim.branch, path: lctx.project, base: claim.base.slice(0, 12), resumed: claim.resumed, committed, downstream: s.chains[id].downstream, env: laneEnv(req.lane, port), resync: { ...needs, ran }, salvaged: claim.salvaged, ...(claim.archived ? { archived: claim.archived } : {}) } }
  })
  if (!out) throw new Refusal('resync-failed', failure, { chain: id, lane: req.lane })
  return out
}
/** Does the lane's e2e config already serve on its port (server-env.json PORT and the lane.env)? */
function portPinned(lctx, port) {
  const env = path.join(lctx.project, '.pandacorp', 'run', 'lane.env')
  if (!existsSync(env) || !readFileSync(env, 'utf8').includes(`PORT=${port}\n`)) return false
  const file = path.join(lctx.project, 'e2e', 'server-env.json')
  if (!existsSync(file)) return true
  try { return String(JSON.parse(readFileSync(file, 'utf8')).PORT) === String(port) } catch { return false }
}

/** A chain as the engine needs it: its lane's project dir and env too, so a resumed chain can be fixed or rebuilt. */
const chainView = (ctx, state, c) => {
  const l = c.lane ? state.pool.find((x) => x.lane === c.lane) : null
  return { chain: c.id, frd: c.frd, wos: c.wos, lane: c.lane, downstream: c.downstream, status: c.status, fixes: c.fixes || 0, base: String(c.base || '').slice(0, 12), ...(l ? { path: path.join(l.path, ctx.prefix), env: laneEnv(l.lane, l.port) } : {}) }
}

/** `lane-next` — see the header. */
export async function laneNextOp(o) {
  checkLaneFlags(o)
  const ctx = projectCtx(o.project)
  if (!isOnMain(ctx, o.mainBranch)) throw new Refusal('not-on-main', `lane-next runs in the primary checkout on ${o.mainBranch}`)
  // The state BEFORE the graph: a chain read as built (in flight) can never be re-dispatched from a graph read before its
  // landing fast-forwarded main.
  let graph = null
  const retired = []
  const before = await withState(ctx, o, async (s) => {
    graph = woGraph(ctx)
    refreshFromMain(s, graph.nodes, ctx)
    // A park holds for the run that parked it: the next run (its --resume round) tries the chain again from scratch.
    if (o.resume) for (const c of Object.values(s.chains)) if (c.status === 'parked') { Object.assign(c, { status: 'retired', retiredAt: new Date().toISOString() }); retired.push(c.id) }
    return JSON.parse(JSON.stringify(s))
  })
  const failed = []
  const tryDispatch = async (req) => {
    try { return (await dispatchChain(ctx, o, graph, req)).body } catch (e) {
      if (!(e instanceof Refusal)) throw e
      failed.push({ chain: req.chain, lane: req.lane ?? null, status: e.status, reason: e.message })
      return null
    }
  }
  const resumed = o.resume ? Object.values(before.chains).filter((c) => c.status === 'dispatched' && !c.barrier && c.lane) : []
  const plan = planChains(graph, before, scopeOf(o))
  const barrierChain = plan.dispatch.barrier ? plan.chains.find((c) => c.id === plan.dispatch.barrier) : null
  if (barrierChain) await tryDispatch({ chain: barrierChain.id, wos: barrierChain.wos, barrier: true })
  const reqs = [...resumed.map((c) => ({ chain: c.id, wos: c.wos, lane: c.lane })), ...plan.dispatch.lanes.map((d) => { const c = plan.chains.find((x) => x.id === d.chain); return { chain: c.id, wos: c.wos, lane: d.lane } })]
  const dispatched = (await Promise.all(reqs.map(tryDispatch))).filter(Boolean)
  const state = readState(ctx)
  const after = planChains(graph, state, scopeOf(o))
  const barrier = activeBarrier(state)
  const live = Object.values(state.chains)
  return {
    code: 0,
    body: {
      status: 'next', k: after.k, kReason: after.kReason, width: plan.width, dispatched, failed, retired,
      barrier: barrier ? chainView(ctx, state, barrier) : null, landingsPaused: Boolean(barrier),
      landQueue: after.landQueue.map((id) => chainView(ctx, state, state.chains[id])), needsFix: live.filter((c) => c.status === 'needs-fix').map((c) => chainView(ctx, state, c)),
      inFlight: live.filter((c) => LIVE.has(c.status)).map((c) => c.id), parked: after.parked, blockedFrds: after.blockedFrds, blockedWos: after.blockedWos,
      landedFrds: unique(live.filter((c) => c.status === 'landed').map((c) => c.frd)).sort(), pool: after.pool, remaining: after.remaining,
    },
  }
}

/** The FRD's own commits for `wos` on the history of `sha` (commit-wo's `feat(<frd>): WO-…` and `fix(<frd>): fixup WO-…`). */
function frdCommits(ctx, frd, wos, sha) {
  const r = ctx.g.run(['log', '--format=%H%x09%s', sha])
  if (!r.ok) return null
  const ids = wos.map((w) => w.replace(/[^A-Za-z0-9-]/g, '')).join('|')
  const re = new RegExp(`^(feat|fix)\\(${frd.replace(/[^A-Za-z0-9._-]/g, '')}\\): (fixup )?(${ids})\\b`, 'i')
  return r.out.split('\n').filter((l) => re.test(l.split('\t')[1] || '')).map((l) => l.split('\t')[0])
}
const isAncestor = (ctx, a, b) => ctx.g.run(['merge-base', '--is-ancestor', a, b]).ok

/** The chains landed since the last green pin below `sha` (bisect candidates), at most 3, oldest first. */
export function bisectCandidates(ctx, state, sha) {
  const greens = (state.greens || []).filter((g) => isAncestor(ctx, g.sha, sha)).sort((a, b) => String(a.at).localeCompare(String(b.at)))
  const lastGreen = greens.length ? greens[greens.length - 1].sha : null
  return Object.values(state.chains)
    .filter((c) => c.status === 'landed' && c.landedSha && c.landedBase && isAncestor(ctx, c.landedSha, sha) && !(lastGreen && isAncestor(ctx, c.landedSha, lastGreen)))
    .sort((a, b) => String(a.landedAt).localeCompare(String(b.landedAt))).slice(-3)
}

/** `lane-usable` — see the header. */
export async function laneUsableOp(o) {
  if (o.frds.length !== 1) throw new InputError('lane-usable needs exactly one --frd <folder>')
  const frd = o.frds[0]
  const ctx = projectCtx(o.project)
  if (!isOnMain(ctx, o.mainBranch)) throw new Refusal('not-on-main', `lane-usable runs in the primary checkout on ${o.mainBranch}`)
  const f = readFrds(ctx).find((x) => x.frd === frd)
  if (!f) throw new InputError(`no FRD folder with work orders named ${frd}`)
  const pinned = ctx.g.run(['rev-parse', '--verify', '-q', `${o.sha || 'HEAD'}^{commit}`])
  if (!pinned.ok) throw new InputError(`not a commit: ${o.sha}`)
  const shaFull = pinned.out.trim()
  const sha = shaFull.slice(0, 12)
  const ids = o.wos.length ? o.wos.map((id) => findWo(ctx, id).id) : f.wos.filter((w) => w.status !== 'VERIFIED').map((w) => w.id)
  const notIn = ids.filter((id) => frontmatterStatus(blobAt(ctx, shaFull, findWo(ctx, id).rel)) !== 'IN_REVIEW')
  if (notIn.length) throw new Refusal('uncommitted', `${notIn.join(', ')} not committed IN_REVIEW at ${sha} — nothing to certify`, { wos: notIn })
  const commits = frdCommits(ctx, frd, ids, shaFull)
  const landed = commits ? classifyFrdRanges(ctx, f, commits.map((c) => `${c}^..${c}`), o.lockWaitMs) : { floor: true, changed: false, floorHits: ['the FRD\'s commits could not be read — fail-closed'] }
  const floor = landed.floor || o.floor === true
  const hits = commits ? commits.map((c) => injectionHits(ctx, `${c}^`, c)) : [null]
  const injection = hits.some((h) => h === null) ? null : hits.flat()
  // The snapshot worktree: one for the pool (disk budget K + gate slots + 1), reset to the pin, resynced only when needed.
  const wt = path.join(lanesDir(ctx), 'snapshot')
  const { created } = ensureWorktree(ctx, wt, shaFull)
  const wg = gitIn(wt)
  wg.must(['checkout', '-q', '-f', '--detach', shaFull])
  wg.must(['clean', '-fdq'])
  const snapProj = path.join(wt, ctx.prefix)
  const prior = readState(ctx).snapshot || {}
  const taken = new Set(readState(ctx).pool.map((l) => l.port).filter(Boolean))
  const port = prior.port && !taken.has(prior.port) && !(await portBusy(prior.port)) ? prior.port : await freePort(taken, 90)
  const needs = resyncNeeds(ctx, prior.base, shaFull)
  if (created || needs.install || needs.db || port !== prior.port || !existsSync(path.join(snapProj, 'node_modules'))) {
    const boot = await bootstrapLane(ctx, wt, 'snapshot', port)
    if (boot) throw new Refusal('snapshot-bootstrap-failed', boot)
  }
  if (needs.prisma && existsSync(path.join(snapProj, 'node_modules', '.bin', 'prisma'))) {
    const r = await runAsync(path.join(snapProj, 'node_modules', '.bin', 'prisma'), ['generate'], { cwd: snapProj, env: laneEnv('snapshot', port), timeoutMs: 5 * 60 * 1000 })
    if (!r.ok) throw new Refusal('snapshot-bootstrap-failed', `prisma generate failed: ${r.tail.split('\n').slice(-3).join(' | ')}`)
  }
  await withState(ctx, o, async (s) => { s.snapshot = { base: shaFull, port } })
  const run = await runAsync('bash', ['.pandacorp/verify.sh'], { cwd: snapProj, env: laneEnv('snapshot', port), timeoutMs: o.verifyTimeoutMs || 45 * 60 * 1000 })
  const rep = readReport(projectCtx(snapProj), run.code, shaFull)
  const green = rep.green && rep.scope !== 'partial'
  const { usableCommit, usableFailure } = green && !floor ? commitUsable(ctx, o, frd, sha) : { usableCommit: null, usableFailure: '' }
  const state = await withState(ctx, o, async (s) => {
    if (green) s.greens = [...(s.greens || []), { sha: shaFull, frd, at: new Date().toISOString() }].slice(-MAX_GREENS)
    return s
  })
  const candidates = green ? [] : bisectCandidates(ctx, state, shaFull)
  const cls = green ? null : candidates.every((c) => c.frd === frd) ? 'own' : 'cross'
  return {
    code: 0,
    body: {
      status: green ? 'green' : 'red', frd, green, usable: Boolean(usableCommit), floor, floorChanged: landed.changed, floorHits: landed.floorHits, injection,
      sha, scope: rep.scope, failure: green ? '' : (rep.failure || `report scope ${rep.scope}`), usableCommit, ...(usableFailure ? { usableFailure } : {}),
      commits: (commits || []).map((c) => c.slice(0, 12)), class: cls, candidates: candidates.map((c) => c.id), snapshot: { path: snapProj, port }, exit: run.code,
    },
  }
}

export const NEXT_OPS = { 'lane-next': laneNextOp, 'lane-usable': laneUsableOp, 'lane-dispatch': laneDispatchOp }
