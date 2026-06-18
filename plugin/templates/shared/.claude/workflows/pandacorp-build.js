export const meta = {
  name: 'pandacorp-build',
  description: 'Pandacorp build engine v2 (DR-050): builds FRD by FRD using each blueprint\'s Build Plan, with state in the work-order frontmatter (implementation_status). ONE review/test gate per FRD (not per work order), hand-offs, fail-closed gates, one commit per safe point. Runs to COMPLETION by default; stops ONLY by health or budget — nothing left to build, a budget ceiling, too many blocks in a row, or work that needs the owner. It TRIES TO REPAIR before giving up; an unrecoverable stop BLOCKS with a reason (needs-owner | external | error) instead of dying. Resumable: it reads the frontmatter and NEVER rebuilds a VERIFIED work order.',
  phases: [
    { title: 'Baseline' },
    { title: 'Plan' },
    { title: 'Build' },
    { title: 'Review' },
  ],
}

// ── Input (all optional) ─────────────────────────────────────────────────────
//   args.mode:    'pro' | 'balanced' | 'powerful' | 'deep'  (default: powerful)
//   args.frds:    specific FRD folders to limit to           (default: all pending)
//   args.maxFrds:  OPT-IN cap on FRDs PROCESSED per run (built + blocked + REOPENED) — for
//     SUPERVISED TEST runs. A reopen COUNTS toward the cap, so chained reopens can't slip
//     past it (the 2026-06-16 overnight test caught that exact bug). For overnight runs
//     prefer args.maxAgents (a reliable spend brake) over a feature count.
//   args.maxAgents: hard cap on subagents spawned this run — THE reliable overnight guardrail
//     (each implementer/reviewer ≈ work ≈ tokens), counted INSIDE the engine; survives a dead
//     supervisor and does NOT depend on budget.spent. null = off.
//   args.maxSpend: output-token ceiling via budget.spent() — UNRELIABLE alone (under-counts
//     subagent work; unenforced if the supervisor dies). Secondary ceiling. null = off.
//     (DR-050, owner decision: run to completion, stop by health/budget, not by feature count.)
const MODE = (args && args.mode) || 'powerful'
const ONLY = (args && args.frds) || null
const MAX_FRDS = (args && args.maxFrds) || Infinity   // counts features PROCESSED (built+blocked+reopened); no cap unless set
const LOW_BUDGET = (args && args.lowBudget) || 80000  // margin to leave when budget.total IS set (a +Nk turn directive)
const MAX_SPEND = (args && args.maxSpend) || null      // output-token ceiling via budget.spent() — UNRELIABLE alone (under-counts subagent work; unenforced if the supervisor dies). Secondary.
const MAX_AGENTS = (args && args.maxAgents) || null     // hard cap on subagents spawned this run — the RELIABLE spend brake (each implementer/reviewer ≈ work ≈ tokens), counted INSIDE the engine, independent of budget.spent AND of the supervisor surviving. THE real guardrail.
const MAX_CONSECUTIVE_BLOCKS = (args && args.maxConsecutiveBlocks) || 3   // health breaker: N non-external blocks in a row → stop (something is systemically wrong)
let agentSpawned = 0   // running count of subagents spawned (the maxAgents brake)

// Concurrency/models per mode (DR-014). `wave` = work orders built in parallel within
// an FRD. `split` runs test→backend→frontend; otherwise one full-stack implementer
// builds the coarse slice end-to-end (faster).
const PROFILES = {
  pro:      { wave: 2, worker: 'sonnet', judge: 'sonnet', split: false },
  balanced: { wave: 4, worker: 'sonnet', judge: 'opus',   split: false },
  powerful: { wave: 8, worker: 'sonnet', judge: 'opus',   split: false },
  deep:     { wave: 6, worker: 'opus',   judge: 'opus',   split: true  },
}
const P = PROFILES[MODE] || PROFILES.balanced
log(`Mode ${MODE} · wave ≤${P.wave} · maxFrds ${MAX_FRDS === Infinity ? 'sin tope (corre hasta terminar)' : MAX_FRDS} · workers ${P.worker} · judge ${P.judge}`)

// Party telemetry. `ctx` enriches the event so the Party views can be faithful to the run
// WITHOUT inventing anything: frd (which feature), phase ('build'|'review'), activity (the
// sub-step — for the deep relay: 'test'|'backend'|'frontend'|'selftest'; else 'implement'),
// and the run mode. All fields are OPTIONAL and additive — older consumers reading {role,wo}
// are unaffected (backward-compatible). See prototype/party-redesign-spec.md §7.
const EMIT = (role, wo, ctx = {}) =>
  `Before you start, record your activity for Party (one append, fire-and-forget):\n` +
  `  printf '{"event":"AgentWorking","at":"%s","project":"%s","data":{"role":"${role}","wo":"${wo}","frd":"${ctx.frd || ''}","phase":"${ctx.phase || 'build'}","activity":"${ctx.activity || ''}","mode":"${MODE}"}}\\n' "$(date -u +%FT%TZ)" "$(basename "$PWD")" >> ~/.claude/dashboard-events.ndjson\n`

// Owner notification — macOS desktop only (osascript). Fire-and-forget; never blocks the
// build. (Phone push, when Remote Control is on, is sent by the supervising agent via
// PushNotification — see the implement skill. No third-party push app: owner decision 2026-06-16.)
const NOTIFY = (msg, sound) =>
  ` Notify the owner (run via Bash, fire-and-forget): ` +
  `osascript -e 'display notification "${msg}" with title "Pandacorp build" sound name "${sound || 'Basso'}"' 2>/dev/null || true.`

// ── Schemas ───────────────────────────────────────────────────────────────────
const VERIFY_SCHEMA = {
  type: 'object', required: ['green'],
  properties: { green: { type: 'boolean' }, sha: { type: 'string' }, failure: { type: 'string' } },
}
const PLAN_SCHEMA = {
  type: 'object', required: ['frds'],
  properties: {
    stack: { type: 'string', description: 'A (web) | B/C (API) | D (scraper/data)' },
    hasFrontend: { type: 'boolean' },
    frds: {
      type: 'array',
      items: {
        type: 'object', required: ['frd', 'workOrders'],
        properties: {
          frd: { type: 'string', description: 'the FRD folder, e.g. frd-03-<slug>' },
          deps: { type: 'array', items: { type: 'string' }, description: 'FRD folders that must be VERIFIED first' },
          workOrders: {
            type: 'array',
            items: {
              type: 'object', required: ['id', 'status'],
              properties: {
                id: { type: 'string' },
                status: { type: 'string', description: 'implementation_status from the WO frontmatter' },
                deps: { type: 'array', items: { type: 'string' }, description: 'intra-FRD WO ids that must be built first' },
                summary: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
}
// A reason accompanies every block so Mission Control and the owner know what to do.
const BLOCK_REASON = { type: 'string', enum: ['needs-owner', 'external', 'error'] }
const FRD_GATE_SCHEMA = {
  type: 'object', required: ['green'],
  properties: { green: { type: 'boolean' }, reopen: { type: 'array', items: { type: 'string' } }, blocked_reason: BLOCK_REASON, failure: { type: 'string' } },
}
const REPAIR_SCHEMA = {
  type: 'object', required: ['green'],
  properties: { green: { type: 'boolean' }, blocked_reason: BLOCK_REASON, failure: { type: 'string' } },
}

// ── Baseline self-heal (deadlock breaker) ─────────────────────────────────────
phase('Baseline')
const baseline = await agent(
  `You are the Pandacorp baseline-repair engineer. FIRST: if \`git rev-parse --short HEAD\` equals \`last_green_sha\` in .pandacorp/status.yaml, the tree is already known-green → return { green: true } immediately and do NOT run verify.sh (skip the cold-start cost). Otherwise run \`bash .pandacorp/verify.sh\`:
  - GREEN → return { green: true }, change nothing.
  - RED → fix the PRODUCTION code (never weaken/skip tests) until it passes end-to-end, commit (Conventional Commits with scope), return { green: true }.
  If you genuinely can't, return { green: false, failure } describing what remains.${NOTIFY('Baseline roto y no se pudo reparar — necesita tu intervencion')}`,
  { label: 'baseline', phase: 'Baseline', model: P.judge, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA },
)
if (!baseline || baseline.green !== true) {
  log(`Baseline red and auto-repair failed${baseline?.failure ? ': ' + baseline.failure : ''} — stopping for the owner.`)
  return { mode: MODE, builtFrds: [], blockedFrds: ['baseline'], blockedReasons: { baseline: 'error' }, note: 'baseline red (needs manual fix)' }
}
log('Baseline green — planning by FRD.')

// ── Plan: read FRDs, their Build Plans and the frontmatter state (no inferred "done") ──
phase('Plan')
const plan = await agent(
  `You are the Pandacorp build planner. Read state WITHOUT modifying anything:
  - WALK every FRD module docs/frds/*/. For each, read frd.md and blueprint.md's **Build Plan** (WO order, intra-FRD deps, parallelism, cross-FRD deps) in full, and the **frontmatter ONLY** of every work-orders/wo-*.md (the \`implementation_status\`, \`id\`, deps, title — NOT the full WO body; the implementer reads the body when it builds its own WO, so planning stays fast and cheap).
  - For each work order, the **frontmatter \`implementation_status\` is the source of truth**: PLANNED/IN_PROGRESS = pending; IN_REVIEW = built, awaiting its FRD gate; VERIFIED = done (NEVER rebuild); BLOCKED = skip.
  - docs/product/architecture.md → the platform stack.
  Return the FRDs that still have non-VERIFIED work orders, **in cross-FRD dependency order** (from the Build Plans). For each FRD: its \`frd\` folder, its \`deps\` (FRD folders that must be VERIFIED first), and its \`workOrders\` (each with id, frontmatter \`status\`, intra-FRD \`deps\`, one-line \`summary\`) **in the Build Plan's order**.${ONLY ? ' Limit to these FRD folders: ' + ONLY.join(', ') + '.' : ''}
  hasFrontend=true only if the stack is web (A).`,
  { label: 'plan', phase: 'Plan', schema: PLAN_SCHEMA, model: P.judge, agentType: 'pandacorp:architect' },
)
if (!plan || !plan.frds || plan.frds.length === 0) {
  log('Nothing to build: every FRD is VERIFIED.')
  return { mode: MODE, builtFrds: [], blockedFrds: [], note: 'all verified' }
}
log(`${plan.frds.length} FRDs with pending work · stack ${plan.stack}${plan.hasFrontend ? ' (web)' : ''}`)

// Sync DERIVED rollups (DR-050): an FRD/blueprint implementation_status is DERIVED from its work
// orders (THE source of truth). Correct any drift from a crash mid-build, an interrupted run or a
// manual edit BEFORE building, so the document never lies about progress. One cheap pass, frontmatter only.
agentSpawned++
await agent(`Sync DERIVED rollup state, frontmatter ONLY — NEVER change a work order's state (work orders are the source of truth; you only recompute the FRD/blueprint that rolls up from them). For EVERY docs/frds/*/ folder: read \`implementation_status\` of all its work-orders/wo-*.md and compute the FRD rollup — **VERIFIED** iff ALL are VERIFIED; else **BLOCKED** if any is BLOCKED; else **PLANNED** if any is PLANNED; else **IN_PROGRESS** if any is IN_PROGRESS; else **IN_REVIEW**. Write it into that FRD's frd.md AND blueprint.md \`implementation_status\` ONLY if it differs from the computed value. Refresh .pandacorp/status.yaml per-status work-order counts. Commit only if something changed (Conventional Commits, scope). Return { corrected: <count> }.`,
  { label: 'sync-rollups', phase: 'Plan', model: P.worker, agentType: 'pandacorp:implementer' })

// ── Build ONE work order: implement → fast self-test → IN_REVIEW + hand-off ──
async function buildWO(wo, frd) {
  agentSpawned += (P.split && plan.hasFrontend) ? 4 : 2   // build agent(s) + self-test
  if (P.split && plan.hasFrontend) {
    await agent(`${EMIT('test-writer', wo.id, { frd, activity: 'test' })}Write the acceptance tests (RED) for work order ${wo.id} from the EARS criteria of FRD ${frd}: ${wo.summary || ''}. No production code.`,
      { label: `test:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:test-writer' })
    await agent(`${EMIT('backend-dev', wo.id, { frd, activity: 'backend' })}Implement the backend of ${wo.id} (TDD until green): ${wo.summary || ''}. Publish the API contract in docs/api.md.`,
      { label: `be:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:backend-dev' })
    await agent(`${EMIT('frontend-dev', wo.id, { frd, activity: 'frontend' })}Implement the UI of ${wo.id} using ONLY design tokens and the docs/api.md contract: ${wo.summary || ''}.`,
      { label: `fe:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:frontend-dev' })
  } else {
    await agent(`${EMIT('implementer', wo.id, { frd, activity: 'implement' })}First set ${wo.id}'s frontmatter \`implementation_status: IN_PROGRESS\`. Then fully implement it with TDD (RED→GREEN→refactor), anchored in the EARS criteria of FRD ${frd} and in bugs from .pandacorp/comms/progress.md: ${wo.summary || ''}. This is a COARSE slice (a whole view/capability) — build it end-to-end.`,
      { label: `build:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:implementer' })
  }
  // Fast SELECTIVE self-test (NOT the whole suite) → IN_REVIEW + hand-off.
  const v = await agent(`${EMIT('implementer', wo.id, { frd, activity: 'selftest' })}Fast self-test for work order ${wo.id}: run \`pnpm biome check .\`, \`pnpm tsc --noEmit\`, and \`pnpm vitest run\` limited to THIS work order's own test files (not the whole suite). If green: commit (Conventional Commits with scope; if git reports an index.lock from a parallel sibling, wait briefly and retry the commit), set the WO's frontmatter **\`implementation_status: IN_REVIEW\`**, and fill its **\`## Status Note\`** hand-off (what it built, interfaces/contracts exposed with signatures, integration seams, which test files cover it). Return green=true. If red, return green=false with the reason and do NOT commit. Never commit mid-work-order.`,
    { label: `selftest:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA })
  return Boolean(v && v.green === true)
}

// ── FRD gate: ONE review + integration test over the whole feature ──
async function frdGate(frd, reviewIds) {
  agentSpawned++
  return await agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'gate' })}FRD review + integration gate for ${frd}. Review the work orders built/changed THIS cycle: ${reviewIds.join(', ')} (all IN_REVIEW). This FRD MAY already have OTHER work orders VERIFIED from a previous run — treat those as a stable foundation: exercise them in integration, but do NOT re-review them and NEVER change their state.
  1) Review the changed work orders with your 3 lenses (correctness/security/quality) and write adversarial tests the implementers did not see (anchored in EARS + real bugs), exercising them TOGETHER with the rest of the feature (real integration, not isolated).
  2) Run the FOCUSED gate \`bash .pandacorp/verify.sh --since <last_green_sha>\` (read last_green_sha from .pandacorp/status.yaml) — biome + tsc run globally, but only the TESTS affected since the last green (fast and scales; the full suite runs once at close-out). It must pass clean.
  If everything passes: set the reviewed work orders (${reviewIds.join(', ')}) to **\`implementation_status: VERIFIED\`**, then **recompute the FRD's frd.md + blueprint.md \`implementation_status\` rollup from ALL its work orders** and persist it (VERIFIED iff all are; else BLOCKED if any blocked; else PLANNED if any planned; else IN_PROGRESS if any in progress; else IN_REVIEW) — the FRD status is DERIVED, never left stale; update .pandacorp/status.yaml (per-status counts + last_green_sha + safe_to_test:true), and commit. Return { green: true }.
  If a SPECIFIC reviewed work order is wrong, set ONLY those (from the reviewed set) back to \`implementation_status: PLANNED\` (leave the rest IN_REVIEW; never touch an already-VERIFIED one), do not commit broken code, and return { green: false, reopen: [those ids], failure } — the engine retries them on the next run, not in a loop.
  If it's broken and you can't pinpoint specific WOs, return { green: false, failure, blocked_reason } (classify: 'needs-owner' if a human must act, 'external' if it's a transient outside failure, else 'error').${NOTIFY('FRD ' + frd + ' no paso la revision — necesita tu atencion')}`,
    { label: `gate:${frd}`, phase: 'Review', model: P.judge, agentType: 'pandacorp:reviewer', schema: FRD_GATE_SCHEMA })
}

// ── Repair pass: TRY TO FIX before giving up (owner's rule, DR-050) ────────────
// The build resolves problems itself and only stops when it genuinely can't — then it
// BLOCKS with a reason instead of dying. Run by a strong model (it's hard diagnosis).
async function attemptRepair(frd, context) {
  agentSpawned++
  return await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'repair' })}The build of FRD ${frd} hit a problem: ${context}. You are the repair engineer — TRY TO FIX it before we give up.
  1) Diagnose the root cause: read the failing output, the work orders, and .pandacorp/comms/progress.md.
  2) If it is within your reach (code / test / local config): fix the PRODUCTION code (never weaken or skip tests) until \`bash .pandacorp/verify.sh\` is green for this feature; set the affected work orders' frontmatter back to \`implementation_status: IN_REVIEW\`; commit (Conventional Commits with scope); return { green: true }.
  3) If you CANNOT fix it, classify WHY, set the affected work orders' frontmatter to \`implementation_status: BLOCKED\` + \`blocked_reason: <reason>\`, mirror it in .pandacorp/status.yaml, leave HEAD at last_green_sha (commit nothing broken), and return { green: false, blocked_reason, failure }:
     - 'needs-owner' → it needs a HUMAN action/decision the agent can't take: a missing env var or secret, an external account/service to set up, a product decision. ALSO append it to .pandacorp/inbox/decisions.md (what's blocked, the options, your recommendation).
     - 'external' → a transient OUTSIDE failure (no internet, an upstream 5xx) — worth a retry on a later run, not our bug.
     - 'error' → a technical failure you could not resolve.`,
    { label: `repair:${frd}`, phase: 'Review', model: P.judge, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}

// ── Per-FRD loop ──────────────────────────────────────────────────────────────
const builtFrds = []
const blockedFrds = []
const reopenedFrds = []
const blockedReasons = {}
let consecutiveBlocks = 0   // health breaker: non-external blocks in a row
let stopReason = null       // 'budget' | 'blocks' | 'maxFrds' (null = ran to completion)

function blockFrd(frd, reason) {
  reason = reason || 'error'
  blockedFrds.push(frd)
  blockedReasons[frd] = reason
  if (reason !== 'external') consecutiveBlocks++   // external = not our bug; don't trip the breaker
}

for (const f of plan.frds) {
  if (f.deps && f.deps.some((d) => blockedFrds.includes(d))) { log(`⊘ ${f.frd} skipped (depends on a blocked FRD)`); blockFrd(f.frd, 'needs-owner'); continue }
  if (budget.total && budget.remaining() < LOW_BUDGET) { stopReason = 'budget'; log('Circuit breaker: budget ceiling reached — stopping at a safe point'); break }
  if (MAX_AGENTS && agentSpawned >= MAX_AGENTS) { stopReason = 'agents'; log(`Agent ceiling reached (${agentSpawned} ≥ maxAgents ${MAX_AGENTS}) — stopping at a safe point`); break }
  if (MAX_SPEND && budget.spent() >= MAX_SPEND) { stopReason = 'budget'; log(`Spend ceiling reached (${Math.round(budget.spent() / 1000)}k ≥ maxSpend ${Math.round(MAX_SPEND / 1000)}k) — stopping at a safe point`); break }
  if ((builtFrds.length + blockedFrds.length + reopenedFrds.length) >= MAX_FRDS) { stopReason = 'maxFrds'; log(`Reached the test cap maxFrds=${MAX_FRDS} (built+blocked+reopened) — stopping at a safe point`); break }

  phase('Build')
  const pending = f.workOrders.filter((w) => w.status !== 'VERIFIED' && w.status !== 'BLOCKED')
  const reviewIds = pending.map((w) => w.id)   // all non-VERIFIED/non-BLOCKED reach the gate; already-VERIFIED WOs are a stable foundation, never re-touched
  const toBuild = pending.filter((w) => w.status !== 'IN_REVIEW')   // IN_REVIEW = already built (self-test green) by a prior interrupted run → straight to the gate, don't rebuild
  log(`▶ ${f.frd}: ${toBuild.length} to build${pending.length - toBuild.length ? ` · ${pending.length - toBuild.length} already in review` : ''}`)
  const doneIds = new Set(f.workOrders.filter((w) => w.status === 'VERIFIED' || w.status === 'IN_REVIEW').map((w) => w.id))
  const queue = new Map(toBuild.map((w) => [w.id, w]))
  let frdFailed = false
  // Build in waves honoring the Build Plan's intra-FRD dependencies.
  while (queue.size > 0) {
    const ready = [...queue.values()].filter((w) => (w.deps || []).every((d) => doneIds.has(d) || !queue.has(d)))
    if (ready.length === 0) { log(`⚠ ${f.frd}: ${queue.size} work orders with unresolved/circular deps`); frdFailed = true; break }
    const wave = ready.slice(0, P.wave)
    const results = await parallel(wave.map((w) => () => buildWO(w, f.frd)))
    for (let i = 0; i < wave.length; i++) { queue.delete(wave[i].id); if (results[i]) doneIds.add(wave[i].id); else frdFailed = true }
    if (frdFailed) break
  }

  // A work order failed its self-test → TRY TO REPAIR before blocking (owner's rule).
  if (frdFailed) {
    log(`! ${f.frd}: a work order failed — attempting repair before giving up`)
    const fix = await attemptRepair(f.frd, 'a work order failed its self-test during the build wave')
    if (!fix || fix.green !== true) {
      const reason = (fix && fix.blocked_reason) || 'error'
      log(`⊘ ${f.frd}: could not repair (${reason}) — BLOCKED, continuing with independent FRDs`)
      blockFrd(f.frd, reason)
      if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) { stopReason = 'blocks'; break }
      continue
    }
    log(`✓ ${f.frd}: repaired — proceeding to the gate`)
  }

  phase('Review')
  let gate = await frdGate(f.frd, reviewIds)
  if (gate && gate.green === true) { log(`✓ ${f.frd} VERIFIED`); builtFrds.push(f.frd); consecutiveBlocks = 0; continue }
  if (gate && gate.reopen && gate.reopen.length) { log(`↻ ${f.frd}: ${gate.reopen.length} WO reopened (PLANNED) — next run rebuilds only those`); reopenedFrds.push(f.frd); continue }  // reopen is deferred work, not progress — leave the health breaker untouched

  // Gate failed with no specific reopen → TRY TO REPAIR, then re-gate ONCE (fail-closed).
  log(`! ${f.frd} gate failed${gate?.failure ? ': ' + gate.failure : ''} — attempting repair`)
  const fix = await attemptRepair(f.frd, 'the FRD review/integration gate failed: ' + (gate?.failure || 'unknown'))
  if (fix && fix.green === true) {
    gate = await frdGate(f.frd, reviewIds)
    if (gate && gate.green === true) { log(`✓ ${f.frd} VERIFIED (after repair)`); builtFrds.push(f.frd); consecutiveBlocks = 0; continue }
  }
  const reason = (fix && fix.blocked_reason) || (gate && gate.blocked_reason) || 'error'
  log(`⊘ ${f.frd}: BLOCKED (${reason})`)
  blockFrd(f.frd, reason)
  if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) { stopReason = 'blocks'; break }
}

// ── Close-out + ALWAYS notify the owner how this run ended ────────────────────
phase('Review')
const STOP_SCHEMA = { type: 'object', required: ['done'], properties: { done: { type: 'boolean' } } }
const needsOwner = blockedFrds.filter((x) => blockedReasons[x] === 'needs-owner')
const allDone = !stopReason && blockedFrds.length === 0 && reopenedFrds.length === 0 && builtFrds.length === plan.frds.length
let closed
if (allDone) {
  closed = await agent(`All FRDs are VERIFIED. Run the full suite + e2e of the critical flows and kill the test dev servers with TaskStop. If green, set .pandacorp/status.yaml phase: release and running: false. Return done:true once status.yaml is written.${NOTIFY('Build COMPLETO: todos los FRDs verificados', 'Glass')}`,
    { label: 'close-out', phase: 'Review', model: P.judge, agentType: 'pandacorp:reviewer', schema: STOP_SCHEMA })
  log('Run ended: all FRDs verified.')
} else {
  const blk = blockedFrds.map((x) => `${x}(${blockedReasons[x]})`).slice(0, 8).join(', ') || 'ninguno'
  const why = stopReason === 'agents' ? ' Paro por techo de agentes (maxAgents).'
    : stopReason === 'budget' ? ' Paro por techo de presupuesto.'
    : stopReason === 'blocks' ? ' Paro: demasiados FRDs bloqueados seguidos (algo sistemico va mal).'
    : stopReason === 'maxFrds' ? ' Paro por el tope de prueba (maxFrds).' : ''
  const ownerMsg = needsOwner.length
    ? `Termine lo que se podia. ${needsOwner.length} FRD(s) te esperan a ti: ${needsOwner.slice(0, 6).join(', ')}`
    : `Tramo: ${builtFrds.length} FRDs ok, ${blockedFrds.length} bloqueados, ${reopenedFrds.length} a reintentar`
  closed = await agent(`The build run ended.${why} Verified this run: ${builtFrds.length}. Reopened (retry next run): ${reopenedFrds.length}. Blocked: ${blockedFrds.length} (${blk}). Of those, NEEDS-OWNER (a human must act): ${needsOwner.join(', ') || 'none'}. FIRST run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since) to confirm this pass left no global regression — note the result. Then write a short Spanish summary to .pandacorp/comms/progress.md (what advanced, what's blocked and the reason, the full-suite result, and exactly what needs the owner's action/decision for the needs-owner ones). Set .pandacorp/status.yaml running: false. Return done:true once status.yaml is written.${NOTIFY(ownerMsg)}`,
    { label: 'notify-end', phase: 'Review', model: P.worker, agentType: 'pandacorp:implementer', schema: STOP_SCHEMA })
  log(`Run ended: ${builtFrds.length} verified, ${reopenedFrds.length} reopened, ${blockedFrds.length} blocked${stopReason ? ' · stop=' + stopReason : ''}.`)
}
// Fail-safe: never leave Mission Control showing a phantom running build.
if (!closed || closed.done !== true) {
  await agent(`Fail-safe close: ensure .pandacorp/status.yaml has running:false written (and phase:release if every FRD is VERIFIED). Confirm done:true.`,
    { label: 'ensure-stopped', phase: 'Review', model: P.worker, agentType: 'pandacorp:implementer', schema: STOP_SCHEMA })
}

return { mode: MODE, builtFrds, blockedFrds, reopenedFrds, blockedReasons, stopReason }
