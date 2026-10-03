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
//               main tree is untouched. The lane's bootstrap-owned files are never its dirt (`lane-dirty` names real
//               work only; `bootstrapOnly: true` when a lane with no owned record could not be re-proven, never counted
//               by the engine), are set aside around the checkout/rebase, and a commit carrying one is `bootstrap-leak`.
//   lane-bisect --candidate c [--candidate c…] [--sha <red pin>] [--frd f]   1-3 landed chains: snapshot worktrees at
//               the base before the first and at each chain's landed tip, bootstrapped side by side, then verify.sh ONE
//               at a time, base first, each holding a host verify slot (bench FM-7); the culprit is the first red tip
//               after a green point ('pre-existing' when the base is already red, 'not-reproduced' when none is).
//               With --frd, a 'pre-existing' verdict also judges that FRD's red recorded at the pin (`preexisting`:
//               unblocks only when every failing test is red at the base too and owned by another FRD).
//               It never reverts: the engine hands the culprit to the fix-forward patch ladder.

import { appendFileSync, copyFileSync, existsSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { InputError, JOURNALS, Refusal, acquireLock, commitJournals, dirtyEntries, gitIn, isOnMain, projectCtx, readOwned, releaseLock, utcStamp } from './build-mech-lib.mjs'
import { activeBarrier, assertOwnWorktree, bootstrapLane, commitShape, ensureWorktree, freePort, laneCommits, laneEnv, lanesDir, ownedLeaks, ownerOf, planChains, readState, refreshFromMain, resyncLane, resyncNeeds, runAsync, withOwnedAside, withState, woGraph } from './build-mech-lanes.mjs'
import { runVerify, withVerifySlot } from './build-mech-verify.mjs'

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
/**
 * The lane's real uncommitted work (dirtyEntries already leaves out the files its bootstrap owns). A lane with NO
 * owned-set record (bootstrapped before it existed) whose dirt is only files a sibling lane's bootstrap owns is
 * re-proven by its own bootstrap first (their bytes copied to the salvage dir before): bootstrap-only dirt never refuses
 * a landing. A failed re-proof refuses with `bootstrapOnly: true` (the lane's bootstrap, not the chain, is at fault).
 */
async function laneDirt(ctx, state, lane, lctx) {
  const dirt = dirtyEntries(lctx)
  if (!dirt.length || readOwned(gitIn(lane.path)) !== null) return dirt
  const known = new Set(state.pool.filter((l) => l.lane !== lane.lane && existsSync(l.path)).flatMap((l) => { try { return (readOwned(gitIn(l.path)) || []).map((e) => e.path) } catch { return [] } }))
  if (!dirt.every((e) => known.has(`${lctx.prefix}${e.path}`))) return dirt
  const salvage = path.join(ctx.project, '.pandacorp', 'run', 'salvage', `lane-${lane.lane}`, `${utcStamp()}-bootstrap-owned`)
  for (const e of dirt) {
    const abs = path.join(lctx.project, e.path)
    let st = null
    try { st = lstatSync(abs) } catch { st = null }
    if (st && st.isFile()) { mkdirSync(path.dirname(path.join(salvage, e.path)), { recursive: true }); copyFileSync(abs, path.join(salvage, e.path)) }
  }
  const failure = await bootstrapLane(ctx, lane.path, lane.lane, lane.port)
  const paths = dirt.map((e) => e.path)
  if (failure) throw new Refusal('lane-dirty', `${lane.lane}'s lane is dirty only with bootstrap-owned files (${paths.join(', ')}) and its bootstrap could not re-prove them: ${failure}`, { paths, bootstrapOnly: true, salvaged: salvage })
  return dirtyEntries(lctx)
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
    assertOwnWorktree(lane.path)
    const lctx = projectCtx(path.join(lane.path, ctx.prefix))
    const lg = gitIn(lane.path)
    const branch = `lane/${id}`
    const dirt = await laneDirt(ctx, state, lane, lctx)
    if (dirt.length) throw new Refusal('lane-dirty', `${id}'s lane has uncommitted work (${dirt.map((e) => e.path).join(', ')}): commit or park it first`, { paths: dirt.map((e) => e.path), bootstrapOnly: false })
    withOwnedAside(lane.path, () => lg.must(['checkout', '-q', branch]))
    const preTip = lg.must(['rev-parse', 'HEAD']).trim()
    let checksBase = null
    let checks = null
    let syncedAt = lane.base
    const resynced = []
    for (let attempt = 0; attempt < MAX_MAIN_RETRIES; attempt++) {
      const onto = ctx.g.must(['rev-parse', 'HEAD']).trim()
      const pre = laneCommits(lg, onto, 'HEAD')
      const shape = commitShape(pre, c.wos)
      if (shape.missing.length || shape.duplicated.length) throw new Refusal('commit-shape', `one commit per work order (DR-097): missing ${shape.missing.join(', ') || 'none'}, duplicated ${shape.duplicated.join(', ') || 'none'}`, shape)
      const rb = withOwnedAside(lane.path, () => rebaseLane(ctx, lane.path, onto))
      if (!rb.ok) return landFailure(ctx, o, graph, id, 'conflict', { conflicts: rb.conflicts })
      const tip = lg.must(['rev-parse', 'HEAD']).trim()
      const post = laneCommits(lg, onto, tip)
      if (post.length !== pre.length || post.some((x, i) => x.subject !== pre[i].subject)) {
        withOwnedAside(lane.path, () => lg.must(['reset', '-q', '--hard', preTip]))
        throw new Refusal('commit-shape', `the rebase changed the chain's commits (${pre.length} → ${post.length}): reset to ${preTip.slice(0, 12)}, nothing landed`)
      }
      // A lane's bootstrap rewrite (its launch.json ports…) is the lane's own config: committed, it would land on main.
      const leaked = ownedLeaks(lane.path, onto, tip)
      if (leaked.length) throw new Refusal('bootstrap-leak', `${id}'s commits carry its lane's bootstrap rewrite of ${leaked.join(', ')}: drop it from the commits (the lane's own config never lands), nothing landed`, { paths: leaked })
      // Rebased onto a dependency barrier (lockfile, prisma, migrations): the lane's install/client must follow, or the
      // checks below go red on stale dependencies, not on the chain. Same resync as a dispatch; a failure lands nothing.
      const needs = resyncNeeds(ctx, syncedAt, onto)
      const sync = await resyncLane(ctx, lane.path, lane.lane, lane.port, needs)
      resynced.push(...sync.ran)
      if (sync.failure) throw new Refusal('resync-failed', `${id}'s lane could not resync to ${onto.slice(0, 12)} (${needs.changed.join(', ')}): ${sync.failure} — nothing landed, the chain stays queued`, { chain: id, lane: lane.lane })
      if (sync.ran.length) {
        syncedAt = onto
        await withState(ctx, o, async (s) => { const e = s.pool.find((l) => l.lane === lane.lane); if (e) e.base = onto })
        checks = null
      }
      if (!checks || !journalsOnly(ctx, checksBase, onto)) {
        checks = await withVerifySlot(ctx, `land-chain:${id}`, () => laneChecks(lctx, onto, tip, o.testTimeoutMs))   // bench FM-7: a host verify slot
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
      return { code: 0, body: { status: 'landed', chain: id, sha: tip.slice(0, 12), base: onto.slice(0, 12), wos: landed.wos, resolved: rb.resolved, checks: checks.steps, rechecked: checksBase === onto, resync: { ran: resynced } } }
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
    withOwnedAside(wt, () => { wg.must(['checkout', '-q', '-f', '--detach', p.sha]); wg.must(['clean', '-fdq']) })
    const port = await freePort(taken, 50 + i)
    taken.add(port)
    prepared.push({ ...p, wt, port })
  }
  const timeoutMs = o.verifyTimeoutMs || 30 * 60 * 1000
  // Bench FM-7: the bootstraps may run side by side, the verifies never do: base first, then each tip, ONE at a time,
  // each holding a host verify slot (three parallel suites starved each other into a wrong 'pre-existing').
  const boots = await Promise.all(prepared.map((p) => bootstrapLane(ctx, p.wt, `bisect-${p.label}`, p.port)))
  const results = []
  if (boots.some(Boolean)) {
    for (const [i, p] of prepared.entries()) results.push({ label: p.label, sha: p.sha.slice(0, 12), green: null, ...(boots[i] ? { failure: boots[i] } : { skipped: 'another point could not bootstrap' }) })
  } else {
    for (const p of prepared) {
      const v = await runVerify(ctx, { cwd: path.join(p.wt, ctx.prefix), env: laneEnv(`bisect-${p.label}`, p.port), timeoutMs, op: `lane-bisect:${p.label}` })
      const tail = String(v.out || '').trim().split('\n').slice(-12).join('\n')
      results.push({ label: p.label, sha: p.sha.slice(0, 12), green: v.code === 0, failing: v.failing, ...(v.flaky ? { flaky: v.flaky } : {}), ...(v.code === 0 ? {} : { exit: v.code, tail }) })
    }
  }
  for (const p of prepared) ctx.g.run(['worktree', 'remove', '--force', p.wt])
  if (results.some((r) => r.green === null)) return { code: 4, body: { status: 'bisect-failed', results } }
  const [base, ...tips] = results
  const culpritAt = tips.findIndex((r) => !r.green)
  const verdict = !base.green ? 'pre-existing' : culpritAt < 0 ? 'not-reproduced' : 'culprit'
  const preexisting = verdict === 'pre-existing' && o.frds.length === 1 ? await judgePreexisting(ctx, o, o.frds[0], points[0].sha, base.failing) : null
  return { code: 0, body: { status: verdict, culprit: verdict === 'culprit' ? tips[culpritAt].label : null, results, ...(preexisting ? { preexisting } : {}) } }
}
/**
 * Bench FM-7: does a base that is already red make THIS FRD's red pre-existing? Only when its red recorded at the pin
 * (lane-usable's `reds`) names test files, every one of them is red at the base too, and each is owned by ANOTHER FRD
 * (its work order's artifacts). The verdict is recorded (state `preexisting`) for `lane-usable --preexisting`.
 */
async function judgePreexisting(ctx, o, frd, baseSha, baseFailing) {
  const pin = o.sha ? ctx.g.run(['rev-parse', '--verify', '-q', `${o.sha}^{commit}`]) : null
  const pinFull = pin && pin.ok ? pin.out.trim() : null
  const graph = woGraph(ctx)
  return withState(ctx, o, async (s) => {
    const red = (s.reds || {})[frd]
    const out = { frd, unblocks: false, why: '', failing: [], newFailures: [], owners: [] }
    if (!pinFull || !red || red.sha !== pinFull) out.why = `no red lane-usable of ${frd} recorded at the pin ${String(o.sha || '(none)').slice(0, 12)}`
    else {
      out.failing = red.failing
      out.newFailures = red.failing.filter((f) => !baseFailing.includes(f))
      out.owners = red.failing.filter((f) => baseFailing.includes(f)).map((f) => ownerOf(graph, f) || { file: f, frd: null, wo: null })
      const mine = out.owners.filter((x) => !x.frd || x.frd === frd)
      out.why = !red.failing.length ? 'the red names no failing test file' : out.newFailures.length ? `not red at the base: ${out.newFailures.join(', ')}` : mine.length ? `not owned by another FRD: ${mine.map((x) => x.file).join(', ')}` : ''
      out.unblocks = !out.why
    }
    if (pinFull) s.preexisting = { ...(s.preexisting || {}), [frd]: { sha: pinFull, base: baseSha, at: new Date().toISOString(), ...out } }
    return out
  })
}

export const LAND_OPS = { 'land-chain': landChainOp, 'lane-bisect': laneBisectOp }
