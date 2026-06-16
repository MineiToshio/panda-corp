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
  pro:      { wave: 1, worker: 'sonnet', judge: 'sonnet', split: false, deepReview: false },
  balanced: { wave: 3, worker: 'sonnet', judge: 'opus',   split: true,  deepReview: false },
  powerful: { wave: 5, worker: 'sonnet', judge: 'opus',   split: true,  deepReview: false },
  deep:     { wave: 5, worker: 'opus',   judge: 'opus',   split: true,  deepReview: true  },
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
  return await agent(`Safe point for work order ${wo.id}: run .pandacorp/verify.sh clean. If it passes (green), commit the work order (Conventional Commits with scope), mark the WO 'done' with evidence in its feature module docs/frds/${wo.frd || '<frd>'}/work-orders/, and write last_green_sha (the commit sha) and safe_to_test: true in .pandacorp/status.yaml. If it does NOT pass, return green=false with the reason and DO NOT commit anything. Never commit mid-work-order.`,
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
    await agent(`Freeze-on-red for work order ${wo.id}: do NOT commit anything broken. Leave HEAD at last_green_sha, mark work order ${wo.id} as BLOCKED in .pandacorp/status.yaml with the reason, and emit a notification to the owner (PushNotification / Notification hook). Do not touch other work orders.`,
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
}

// ── Close-out ─────────────────────────────────────────────────────────────────
phase('Verify')
if (built.length > 0 && blocked.size === 0) {
  await agent(`All work orders closed green. Run the full suite + e2e of the critical flows and kill the test dev servers with TaskStop. If everything stays green, set .pandacorp/status.yaml phase: release and running: false. Summarize what was built and the evidence.`,
    { label: 'close-out', phase: 'Verify', model: P.judge, agentType: 'pandacorp:reviewer' })
} else if (blocked.size > 0) {
  log(`Build stopped with ${blocked.size} blocked: ${[...blocked].join(', ')}. Check .pandacorp/inbox/decisions.md / .pandacorp/inbox/bugs/ and re-run implement.`)
}

return { mode: MODE, total: plan.workOrders.length, built, blocked: [...blocked] }
