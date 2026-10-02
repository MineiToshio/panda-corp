// build-mech-lane-next.mjs — proposal 40 §3 Phase B (Lever 2): the engine's two lane ops that are not a landing.
//   lane-next   [--frd f]… [--build wo]… [--wait-verified f]… [--lanes N] [--mode M] [--resume]
//               ONE scheduling round of the engine: the state refreshed from git, then (with --resume, once per run)
//               every live lane chain of an earlier run re-dispatched on its own lane (its committed WOs kept, DR-086),
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

import { existsSync } from 'node:fs'
import path from 'node:path'
import { InputError, Refusal, findWo, frontmatterStatus, blobAt, gitIn, isOnMain, projectCtx, unique } from './build-mech-lib.mjs'
import { classifyFrdRanges, commitUsable, injectionHits, readFrds, readReport } from './build-mech-fast.mjs'
import { LIVE, activeBarrier, bootstrapLane, checkLaneFlags, dispatchChain, ensureWorktree, freePort, laneEnv, lanesDir, planChains, portBusy, readState, refreshFromMain, resyncNeeds, runAsync, scopeOf, withState, woGraph } from './build-mech-lanes.mjs'

const MAX_GREENS = 20
const chainView = (c) => ({ chain: c.id, frd: c.frd, wos: c.wos, lane: c.lane, downstream: c.downstream, status: c.status, fixes: c.fixes || 0 })

/** `lane-next` — see the header. */
export async function laneNextOp(o) {
  checkLaneFlags(o)
  const ctx = projectCtx(o.project)
  if (!isOnMain(ctx, o.mainBranch)) throw new Refusal('not-on-main', `lane-next runs in the primary checkout on ${o.mainBranch}`)
  // The state BEFORE the graph: a chain read as built (in flight) can never be re-dispatched from a graph read before its
  // landing fast-forwarded main.
  let graph = null
  const before = await withState(ctx, o, async (s) => { graph = woGraph(ctx); refreshFromMain(s, graph.nodes, ctx); return JSON.parse(JSON.stringify(s)) })
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
      status: 'next', k: after.k, kReason: after.kReason, width: plan.width, dispatched, failed,
      barrier: barrier ? chainView(barrier) : null, landingsPaused: Boolean(barrier),
      landQueue: after.landQueue.map((id) => chainView(state.chains[id])), needsFix: live.filter((c) => c.status === 'needs-fix').map(chainView),
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

export const NEXT_OPS = { 'lane-next': laneNextOp, 'lane-usable': laneUsableOp }
