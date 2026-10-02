// build-mech-start.mjs — the fast lane's FUSED start, `pandacorp-build-mech.mjs fast-start` (proposal 39 C1/C4).
//
// Why it exists. Bench F-1 spent 3.5 min of a 16-min build half before its first builder on SIX haiku relay spawns
// (precheck, baseline pre-check, plan, safe-point probe, floor, dispatch), each ~0.1-1.3 min of model time around a
// few seconds of script. This op runs the same steps in ONE process, in the same order, and prints ONE sealed line:
//   BuildLaunch event (B1) → precheck (C7) → the owner stop / rethink probe, lease renewed (fenced) → the baseline
//   verdict → plan --classify --compact (C3/C4) → the drainable-work check → the rollup sync → the first FRD's
//   committed IN_PROGRESS dispatch.
// Only the quiet common case runs through. Every other start stops at its step and hands the rest back to the engine's
// separate steps, which keep their unchanged behaviour (no safety property moves here):
//   owner-dirt  the precheck found owner edits: the engine stops needs-owner before any dispatch;
//   stop        the owner stop file: the engine stops before planning;
//   handoff     `stage` names the step that was not quiet: precheck (refused reverts, off main), rethink (the engine's
//               pre-check consumes it), probe (the lease could not be renewed), baseline (escalate: the judge baseline
//               decides), plan (no usable Build Plan: the plan agent);
//   planned     the plan is in the line but nothing was dispatched: drainable work (the drain may change the plan), no
//               lease token, a first FRD the engine must schedule itself (an upstream in the plan, a BLOCKED, DRAFT or
//               reopened work order), or a sync/dispatch that failed (`syncError`/`dispatch.ok:false`);
//   dispatched  the first FRD's work orders are stamped and committed; the engine builds them without another spawn.
// With `--lane-plan` [--lanes N] (proposal 40 Phase B) the line also carries `lanes`: the lane planner's K over the
// planned scope (k, kReason, width, offPath), so the engine decides its static K with no extra spawn; when K ≥ 2 the
// first FRD is NOT dispatched on main (status `planned`): the lane scheduler dispatches every chain itself.
// The baseline verdict is the engine's own rule, made deterministic: `green` = a clean tree at last_green_sha or on its
// BL-0066 pointer commit; `leased-status-only` = the only dirty path is this run's own status.yaml under a lease this op
// just renewed (BL-0124); `greenfield` = the precheck's decideGreenfield verdict; anything else `escalate`.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { syncRollups } from '../runtime/build-state.mjs'
import { planOp } from './build-mech-fast.mjs'
import { lanePlanOp } from './build-mech-lanes.mjs'
import { PROJECTION, acquireLock, dirtyEntries, projectCtx, releaseLock } from './build-mech-lib.mjs'

const ROLLUP_DOC_RE = /^docs\/frds\/[^/]+\/(frd|blueprint)\.md$/
const BUILDABLE = new Set(['PLANNED', 'IN_PROGRESS'])
const KNOWN = new Set(['PLANNED', 'IN_PROGRESS', 'IN_REVIEW', 'VERIFIED'])

function lastGreenSha(ctx) {
  const file = path.join(ctx.project, PROJECTION)
  const text = existsSync(file) ? readFileSync(file, 'utf8') : ''
  return (/^last_green_sha:[ \t]*['"]?([0-9a-f]{7,40})['"]?[ \t]*(?:#.*)?$/m.exec(text) || [])[1] || ''
}
/** HEAD is last_green_sha, or its direct child whose only change is status.yaml (the BL-0066 pointer commit). */
function knownGreen(ctx, lg) {
  const full = ctx.g.run(['rev-parse', '--verify', '-q', `${lg}^{commit}`])
  if (!full.ok || !ctx.g.run(['merge-base', '--is-ancestor', lg, 'HEAD']).ok) return false
  const head = ctx.g.must(['rev-parse', 'HEAD']).trim()
  if (head === full.out.trim()) return true
  const parent = ctx.g.run(['rev-parse', 'HEAD^'])
  return parent.ok && parent.out.trim() === full.out.trim() && ctx.g.must(['diff', '--name-only', '--relative', `${lg}..HEAD`]).trim() === PROJECTION
}
function baselineOf(ctx, pre, probe) {
  const dirty = dirtyEntries(ctx).map((e) => e.path)
  const lg = lastGreenSha(ctx)
  if (!dirty.length && lg && knownGreen(ctx, lg)) return 'green'
  if (dirty.length === 1 && dirty[0] === PROJECTION && probe.renewed === true) return 'leased-status-only'
  if (pre.greenfield && pre.greenfield.greenfield === true) return 'greenfield'
  return 'escalate'
}
/**
 * The FRD the engine's fast lane builds first, when the script can tell it without scheduling: the plan's first FRD with
 * no upstream in the plan, every work order in a known state, none BLOCKED, DRAFT or reopened (the engine's recovery and
 * DRAFT refusal own those), every id unique across the plan. Otherwise null: the engine dispatches it itself.
 * @param {object} plan the planned body of planOp
 * @returns {{ frd: string, ids: string[] }|null}
 */
function firstDispatch(plan) {
  const frds = plan.frds || []
  const all = frds.flatMap((f) => f.workOrders.map((w) => w.id))
  if (!frds.length || (plan.unsatisfiedDeps || []).length || new Set(all).size !== all.length) return null
  const f = frds[0]
  if (f.deps.some((d) => frds.some((x) => x.frd === d))) return null
  if (f.workOrders.some((w) => !KNOWN.has(w.status) || w.docStatus === 'DRAFT' || (w.reopen_count || 0) >= 1)) return null
  const ids = f.workOrders.filter((w) => BUILDABLE.has(w.status)).map((w) => w.id)
  return ids.length ? { frd: f.frd, ids } : null
}
/** The rollup sync the engine's first dispatch used to carry (SYNC_ROLLUPS): fenced writer, then ONE commit of what it changed. */
async function syncAndCommit(ctx, o) {
  const r = await syncRollups(o.project, o.token, o.epoch)
  const paths = dirtyEntries(ctx).map((e) => e.path).filter((p) => p === PROJECTION || ROLLUP_DOC_RE.test(p))
  if (!paths.length) return { ok: true, corrected: r.corrected, commit: null }
  const lock = acquireLock(ctx, { waitMs: o.lockWaitMs, op: 'fast-start' })
  try {
    const add = ctx.g.run(['--literal-pathspecs', 'add', '--', ...paths])
    const c = add.ok ? ctx.g.run(['--literal-pathspecs', 'commit', '-q', '-m', 'chore(build): sync the work-order rollups before the first dispatch', '--', ...paths]) : add
    if (!c.ok) { ctx.g.run(['--literal-pathspecs', 'reset', '-q', '--', ...paths]); throw new Error(`the rollup commit failed: ${c.err || 'no output'}`) }
    return { ok: true, corrected: r.corrected, commit: ctx.g.must(['rev-parse', 'HEAD']).trim().slice(0, 12) }
  } finally { releaseLock(lock) }
}

/**
 * The fused start. `ops` are the CLI's own precheck, safePoint, dispatch and emitEvent (one implementation each).
 * @returns {Promise<{ code: number, body: object }>}
 */
export async function fastStartOp(o, ops) {
  if (o.launchEvent) ops.emitEvent(o, { event: 'BuildLaunch', mode: o.mode || '', maxAgents: o.maxAgents || 0, targeted: Boolean(o.targeted) })
  const out = { launchEvent: Boolean(o.launchEvent) }
  const done = (status, extra = {}) => ({ code: 0, body: { status, ...out, ...extra } })
  const pre = ops.precheck(o).body
  out.precheck = { ok: true, ...pre }
  if (pre.ownerDirt.length) return done('owner-dirt')
  if (pre.status !== 'ok' || !pre.onMain) return done('handoff', { stage: 'precheck' })
  const probe = (await ops.safePoint(o)).body
  out.probe = { ok: true, ...probe }
  if (probe.stop_receipt && probe.stop_receipt.stop === true) return done('stop')
  if (probe.stop || (o.token !== undefined && probe.renewed !== true)) return done('handoff', { stage: probe.rethink_pending ? 'rethink' : 'probe' })
  const ctx = projectCtx(o.project)
  out.baseline = baselineOf(ctx, pre, probe)
  if (out.baseline === 'escalate') return done('handoff', { stage: 'baseline' })
  try { out.plan = { ok: true, ...planOp({ ...o, classify: true, compact: true }).body } } catch (e) { out.plan = { ok: false, status: 'error', reason: e.message } }
  if (out.plan.status !== 'planned') return done('handoff', { stage: 'plan' })
  if (o.lanePlan) {
    try { const l = lanePlanOp(o).body; out.lanes = { ok: true, k: l.k, kReason: l.kReason, width: l.width, offPath: l.offPath } } catch (e) { out.lanes = { ok: false, reason: `${e.status || e.name}: ${e.message}` } }
  }
  const first = firstDispatch(out.plan)
  if (probe.work || !first || o.token === undefined || (out.lanes && out.lanes.k >= 2)) return done('planned')
  try { out.synced = await syncAndCommit(ctx, o) } catch (e) { return done('planned', { syncError: `${e.code || e.name}: ${e.message}` }) }
  let d
  try { d = ops.dispatch({ ...o, wos: first.ids, commit: true }) } catch (e) { d = { code: 4, body: { status: e.status || 'error', reason: e.message } } }
  out.dispatch = { ok: d.code === 0, frd: first.frd, wos: first.ids, ...d.body }
  return done(d.code === 0 ? 'dispatched' : 'planned')
}
