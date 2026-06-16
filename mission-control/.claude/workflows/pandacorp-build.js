export const meta = {
  name: 'pandacorp-build',
  description: 'Pandacorp build engine: waves of work orders (build → review → verify) with the factory subagents, fail-closed gates and one commit per safe point. Resumable and app-agnostic — it works over the work-order queue and the project verify.sh, not over anything hardcoded in the product.',
  phases: [
    { title: 'Plan' },
    { title: 'Build' },
    { title: 'Review' },
    { title: 'Verify' },
  ],
}

// ── Input (all optional) ─────────────────────────────────────────────────────
//   args.mode: 'pro' | 'balanced' | 'powerful' | 'deep'  (default: balanced)
//   args.workOrders: specific ids to build (default: all pending)
const MODE = (args && args.mode) || 'balanced'
const ONLY = (args && args.workOrders) || null

// Concurrency and models per mode (DR-014). The REAL concurrency is capped by the
// runtime (min(16, cores-2)); `wave` controls how many independent work orders we
// run per wave, `split` whether it splits into backend/frontend/test or a single
// implementer runs, and `deepReview` runs the reviewer's 3 lenses in parallel.
const PROFILES = {
  pro:      { wave: 2, worker: 'sonnet', judge: 'sonnet', split: false, deepReview: false },
  balanced: { wave: 4, worker: 'sonnet', judge: 'opus',   split: true,  deepReview: false },
  powerful: { wave: 8, worker: 'sonnet', judge: 'opus',   split: false, deepReview: false },
  deep:     { wave: 6, worker: 'opus',   judge: 'opus',   split: true,  deepReview: true  },
}
const P = PROFILES[MODE] || PROFILES.balanced
log(`Mode ${MODE} · wave ≤${P.wave} · workers ${P.worker} · judge ${P.judge}`)

// Each subagent leaves a trace for Party: a fire-and-forget append to
// ~/.claude/dashboard-events.ndjson (non-blocking, no Claude call). The "done"
// state is emitted by the factory's SubagentStop hook when the subagent finishes.
const EMIT = (role, wo) =>
  `Before you start, record your activity for Party (one append, fire-and-forget):\n` +
  `  printf '{"event":"AgentWorking","at":"%s","project":"%s","data":{"role":"${role}","wo":"${wo}"}}\\n' "$(date -u +%FT%TZ)" "$(basename "$PWD")" >> ~/.claude/dashboard-events.ndjson\n`

// ── Schemas ───────────────────────────────────────────────────────────────────
const PLAN_SCHEMA = {
  type: 'object',
  required: ['stack', 'hasFrontend', 'workOrders'],
  properties: {
    stack: { type: 'string', description: 'A (web) | B/C (API) | D (scraper/data)' },
    hasFrontend: { type: 'boolean', description: 'true only if the stack is web (A)' },
    trivial: { type: 'boolean', description: 'a single module, no clear back/front split' },
    workOrders: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'summary', 'deps'],
        properties: {
          id: { type: 'string' },
          summary: { type: 'string' },
          deps: { type: 'array', items: { type: 'string' }, description: 'ids that must be green first (may live in another FRD)' },
          frd: { type: 'string', description: 'the FRD folder this WO lives under, e.g. frd-03-<slug>' },
        },
      },
    },
  },
}
const STAGE_SCHEMA = {
  type: 'object',
  required: ['ok'],
  properties: { ok: { type: 'boolean' }, notes: { type: 'string' } },
}
const VERIFY_SCHEMA = {
  type: 'object',
  required: ['green'],
  properties: {
    green: { type: 'boolean' },
    sha: { type: 'string', description: 'safe-point commit sha if green' },
    failure: { type: 'string' },
  },
}

// ── Baseline self-heal (deadlock breaker) ────────────────────────────────────
// verify.sh is GLOBAL, so a single test left red by a PRIOR run — an adversarial
// test the reviewer added after a WO closed/was-blocked, broken code from a WO
// that exhausted its review cycles, a regression — freezes the WHOLE build: every
// new WO fails its own verify gate on someone else's broken test, the ready-queue
// drains, and the run stalls silently (looks like "empty queue"). So before
// planning, if the baseline is already red, repair it instead of trusting the
// 'done' markers blindly. This is what a human otherwise has to do by hand.
phase('Baseline')
const baseline = await agent(
  `You are the Pandacorp baseline-repair engineer. Run \`bash .pandacorp/verify.sh\` from the project root.
  - If it is GREEN (exit 0): change nothing and return { green: true }.
  - If it is RED: the suite is red on a point that is NOT a fresh work order — an adversarial/regression test left failing by a previous run, broken code from a WO that exhausted its review cycles, or a stale committed bug. Get the baseline green before the build can proceed:
    1. Identify EVERY failing test and the production module it exercises.
    2. Fix the PRODUCTION code so the behaviour the test pins is correct. NEVER delete, skip, weaken or rewrite a test to go green — the tests encode the contract. The only exception: a test that is itself provably wrong (contradicts its FRD's EARS criteria); then fix the test and explain in failure.
    3. Re-run \`.pandacorp/verify.sh\` until it passes end-to-end (biome + tsc + full suite).
    4. Commit (Conventional Commits, scope mission-control) and return { green: true, sha }.
  If after a genuine effort the baseline cannot be made green, NOTIFY THE OWNER (run via Bash, fire-and-forget: osascript -e 'display notification "Baseline roto y no se pudo reparar — necesita tu intervención" with title "Pandacorp build" sound name "Basso"' || true) and return { green: false, failure } describing exactly what remains. Do not loop forever.`,
  { label: 'baseline', phase: 'Baseline', model: P.judge, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA },
)
if (!baseline || baseline.green !== true) {
  log(`Baseline red and auto-repair failed${baseline?.failure ? ': ' + baseline.failure : ''} — stopping for the owner.`)
  return { mode: MODE, built: [], blocked: ['baseline'], note: 'baseline red (needs manual fix)' }
}
log('Baseline green — planning the queue.')

// ── Plan: read the queue and the stack (state lives in the project files) ─────
phase('Plan')
const plan = await agent(
  `You are the Pandacorp build planner. Read the project state WITHOUT modifying anything:
  - WALK every FRD module: docs/frds/*/work-orders/README.md (each feature's WO list + intra-feature order + parallelism) and docs/frds/*/work-orders/wo-*.md → the global queue and dependencies. Work orders are PER-FEATURE (under their FRD), not in a single global docs/work-orders/.
  - Each work order's "Dependencies" may reference WOs in OTHER FRDs. Resolve the global execution order by a topological sort over all WOs' dependencies (cross-feature), with the intra-feature order from each feature's work-orders/README.md.
  - .pandacorp/status.yaml → what is already green (do not rebuild it).
  - docs/product/architecture.md → the platform stack; each feature's docs/frds/<frd>/blueprint.md for feature-specific build design.
  Return the PENDING work orders in global dependency order, each with its deps (ids of work orders that must be green first, possibly in another FRD) and its frd (the FRD folder, e.g. frd-03-<slug>).${ONLY ? ' Limit to these ids: ' + ONLY.join(', ') + '.' : ''}
  hasFrontend=true only if the stack is web (A). trivial=true if it is a single module with no back/front split.`,
  { label: 'plan', phase: 'Plan', schema: PLAN_SCHEMA, model: P.judge, agentType: 'pandacorp:architect' }
)

if (!plan || !plan.workOrders || plan.workOrders.length === 0) {
  log('Empty queue: no pending work orders.')
  return { mode: MODE, built: [], blocked: [], note: 'empty queue' }
}
log(`${plan.workOrders.length} pending work orders · stack ${plan.stack}${plan.hasFrontend ? ' (web)' : ''}`)

// ── Per-work-order stages ─────────────────────────────────────────────────────
const done = new Set()      // ids closed green
const blocked = new Set()   // BLOCKED ids (freeze-on-red or dead dependency)
const built = []

async function build(wo) {
  // Trivial or pro mode: a single full-stack implementer (splitting adds no speed).
  if (plan.trivial || !P.split) {
    await agent(`${EMIT('implementer', wo.id)}Fully implement work order ${wo.id} with TDD (RED→GREEN→refactor), anchored in the EARS criteria of FRD ${wo.frd || ''} and in bugs from .pandacorp/comms/progress.md: ${wo.summary}. Write the critical context to files.`,
      { label: `build:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:implementer', schema: STAGE_SCHEMA })
    return
  }
  // Split stack: test RED → backend (+contract) → frontend (if web).
  await agent(`${EMIT('test-writer', wo.id)}Write the acceptance tests (RED phase) for work order ${wo.id} anchored in the EARS criteria of FRD ${wo.frd || ''}: ${wo.summary}. Do not write production code.`,
    { label: `test:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:test-writer' })
  await agent(`${EMIT('backend-dev', wo.id)}Implement the backend of work order ${wo.id} with TDD until the tests are green: ${wo.summary}. Publish the API contract in docs/api.md.`,
    { label: `be:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:backend-dev' })
  if (plan.hasFrontend) {
    await agent(`${EMIT('frontend-dev', wo.id)}Implement the UI of work order ${wo.id} using ONLY design tokens and consuming the contract in docs/api.md: ${wo.summary}.`,
      { label: `fe:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:frontend-dev' })
  }
}

async function review(wo) {
  // The reviewer uses a different model than the generator (DR-015) and re-verifies itself.
  if (P.deepReview) {
    const lenses = ['correctness', 'security', 'quality']
    const verdicts = await parallel(lenses.map((L) => () =>
      agent(`${EMIT('reviewer', wo.id)}Review work order ${wo.id} through the ${L} lens. Re-run the evidence yourself and write adversarial tests the implementer did not see (anchored in EARS and real bugs). Return ok=false if you find a real defect.`,
        { label: `rev:${wo.id}:${L}`, phase: 'Review', model: P.judge, agentType: 'pandacorp:reviewer', schema: STAGE_SCHEMA })))
    if (verdicts.filter(Boolean).some((v) => v && v.ok === false)) throw new Error('REVIEW_REJECT: lens in red')
    return
  }
  const v = await agent(`${EMIT('reviewer', wo.id)}Review work order ${wo.id} with your 3 lenses (correctness/security/quality). Re-run tests/lint/typecheck yourself (do not trust the self-report) and write adversarial tests the implementer did not see. Return ok=false with the reason if something does not pass.`,
    { label: `rev:${wo.id}`, phase: 'Review', model: P.judge, agentType: 'pandacorp:reviewer', schema: STAGE_SCHEMA })
  if (v && v.ok === false) throw new Error('REVIEW_REJECT: ' + (v.notes || 'reviewer rejected'))
}

async function verifyWO(wo) {
  return await agent(`Safe point for work order ${wo.id} — FAST SELECTIVE verify (NOT the whole suite, for speed): run \`pnpm biome check .\`, \`pnpm tsc --noEmit\`, and \`pnpm vitest run\` LIMITED to the test files this work order touched (pass their paths/patterns to vitest — the WO's own *.test.ts and the modules it directly changed — not the full suite). If all pass (green), commit the work order (Conventional Commits, scope mission-control), mark the WO 'done' with evidence in docs/frds/${wo.frd || '<frd>'}/work-orders/, and write last_green_sha (the commit sha) + safe_to_test:true in .pandacorp/status.yaml. If it does NOT pass, return green=false with the reason and DO NOT commit anything. Never commit mid-work-order. The FULL suite runs once per wave (not per WO), so keep this step scoped and fast.`,
    { label: `verify:${wo.id}`, phase: 'Verify', model: P.worker, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA })
}

// build → review (up to 2 cycles) → verify. Freeze-on-red if verify ends red
// or if review keeps rejecting after 2 cycles.
async function runWO(wo) {
  try {
    let attempt = 0
    while (true) {
      attempt++
      try {
        await build(wo)
        await review(wo)
        break
      } catch (e) {
        const msg = String((e && e.message) || e)
        if (attempt >= 2 || !msg.startsWith('REVIEW_REJECT')) throw e
        log(`↻ ${wo.id}: review rejected (attempt ${attempt}/2), retrying`)
      }
    }
    const v = await verifyWO(wo)
    if (!v || !v.green) throw new Error('VERIFY_RED: ' + ((v && v.failure) || 'verify.sh in red'))
    log(`✓ ${wo.id} green${v.sha ? ' (' + v.sha.slice(0, 8) + ')' : ''}`)
    return v
  } catch (e) {
    log(`✗ ${wo.id} BLOCKED (${String((e && e.message) || e).slice(0, 100)}) — freeze-on-red`)
    await agent(`Freeze-on-red for work order ${wo.id}: do NOT commit anything broken. Leave HEAD at last_green_sha, mark work order ${wo.id} as BLOCKED in .pandacorp/status.yaml with the reason. Then NOTIFY THE OWNER with a macOS desktop notification (run via Bash, fire-and-forget): osascript -e 'display notification "WO ${wo.id} bloqueado — necesita tu atención" with title "Pandacorp build" sound name "Basso"' || true. Do not touch other work orders.`,
      { label: `freeze:${wo.id}`, phase: 'Verify', model: P.worker, agentType: 'pandacorp:implementer' })
    return { green: false }
  }
}

// ── Dependency waves ──────────────────────────────────────────────────────────
// A wave = work orders whose deps are already green. Within a wave they run in
// parallel (in pro, one at a time). Barrier between waves. If a dep ended up
// BLOCKED, its dependents are skipped. Circuit breaker on budget.
const pending = new Map(plan.workOrders.map((w) => [w.id, w]))
while (pending.size > 0) {
  const ready = []
  const dead = []
  for (const wo of pending.values()) {
    if (wo.deps.some((d) => blocked.has(d))) dead.push(wo)
    else if (wo.deps.every((d) => done.has(d) || !pending.has(d))) ready.push(wo)
  }
  for (const wo of dead) { blocked.add(wo.id); pending.delete(wo.id); log(`⊘ ${wo.id} skipped (depends on a blocked one)`) }
  if (ready.length === 0) {
    if (pending.size > 0) log(`⚠ ${pending.size} work orders unresolved (circular or blocked deps)`)
    break
  }
  if (budget.total && budget.remaining() < 60000) { log('Circuit breaker: low budget, stopping at a safe point'); break }

  const wave = ready.slice(0, P.wave)
  const results = P.wave === 1
    ? [await runWO(wave[0])]
    : await parallel(wave.map((wo) => () => runWO(wo)))

  for (let i = 0; i < wave.length; i++) {
    pending.delete(wave[i].id)
    if (results[i] && results[i].green) { done.add(wave[i].id); built.push(wave[i].id) }
    else blocked.add(wave[i].id)
  }

  // Wave barrier — the FULL suite once per wave (per-WO verify was selective for
  // speed). Catches cross-WO regressions cheaply: O(waves), not O(WOs). If red,
  // repair before the next wave; if unrepairable, notify the owner and stop.
  if (built.length > 0) {
    const waveGreen = await agent(`Run the FULL gate \`bash .pandacorp/verify.sh\`. If GREEN, return { green: true }. If RED, a work order from this wave regressed something elsewhere in the suite: fix the PRODUCTION code (never weaken or skip tests) until \`.pandacorp/verify.sh\` passes end-to-end, commit (Conventional Commits, scope mission-control), and return { green: true, sha }. If you genuinely cannot, NOTIFY THE OWNER (Bash, fire-and-forget: osascript -e 'display notification "Build detenido: la suite quedó roja y no se pudo reparar" with title "Pandacorp build" sound name "Basso"' || true) and return { green: false, failure }.`,
      { label: 'wave-verify', phase: 'Verify', model: P.judge, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA })
    if (!waveGreen || waveGreen.green !== true) {
      log(`Wave full-suite verify red${waveGreen?.failure ? ': ' + waveGreen.failure : ''} — stopping for the owner.`)
      break
    }
  }
}

// ── Close-out + ALWAYS notify the owner how this run ended ───────────────────
phase('Verify')
const allDone = built.length > 0 && blocked.size === 0 && pending.size === 0
if (allDone) {
  await agent(`All work orders closed green. Run the full suite + e2e of the critical flows and kill the test dev servers with TaskStop. If everything stays green, set .pandacorp/status.yaml phase: release and running: false. Summarize what was built. Then NOTIFY THE OWNER (Bash, fire-and-forget): osascript -e 'display notification "Build COMPLETO: todos los work orders en verde" with title "Pandacorp build" sound name "Glass"' || true.`,
    { label: 'close-out', phase: 'Verify', model: P.judge, agentType: 'pandacorp:reviewer' })
} else {
  // The run ended without finishing (blocked, circular deps, wave stop or budget).
  // ALWAYS tell the owner so they never have to wonder if something is still running.
  const blkList = [...blocked].slice(0, 8).join(', ') || 'ninguno'
  await agent(`The build run ended WITHOUT finishing. Built this run: ${built.length}. Blocked: ${blocked.size} (${blkList}). Still pending: ${pending.size}. Write a short Spanish summary to .pandacorp/comms/progress.md (what advanced, what is blocked and why, what needs the owner's decision). Then NOTIFY THE OWNER with a macOS desktop notification (Bash, fire-and-forget): osascript -e 'display notification "Tramo terminado: ${built.length} hechos · ${blocked.size} bloqueados · ${pending.size} pendientes — revisá" with title "Pandacorp build" sound name "Basso"' || true.`,
    { label: 'notify-end', phase: 'Verify', model: P.worker, agentType: 'pandacorp:implementer' })
  log(`Run ended: ${built.length} built, ${blocked.size} blocked, ${pending.size} pending.`)
}

return { mode: MODE, total: plan.workOrders.length, built, blocked: [...blocked] }
