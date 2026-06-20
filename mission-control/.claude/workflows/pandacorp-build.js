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
const FOUNDATION_REPAIR_CAP = (args && args.foundationRepairCap) || 2   // DR-065: bounded auto-repair of an incomplete foundation — after N failed auto-repairs of the SAME class, escalate to the owner instead of looping/burning budget
let agentSpawned = 0   // running count of subagents spawned (the maxAgents brake)
let foundationRepairs = 0   // DR-065: how many foundation auto-repairs we've spent this run (capped by FOUNDATION_REPAIR_CAP)

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
// OBSERVABILITY FIDELITY (DR-066): each AgentWorking append is the PRODUCER's positive heartbeat to
// the event stream — so "sin señal" (no events) genuinely means hung, not idle. It fires at each agent
// START; the supervisor's TIME-driven tick (implement skill) emits the between-agents heartbeat and
// advances supervisor_heartbeat. The status-file freshness stamp (last_event_at) is advanced by the
// safe-point agents below (sync-rollups + the FRD gate), never left frozen while the build advances.
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
                artifacts: { type: 'array', items: { type: 'string' }, description: 'globs of files/dirs this WO writes (from its `artifacts:` frontmatter) — the engine serializes wave-parallel WOs whose artifacts overlap, so they never collide (DR-060)' },
                foundation: { type: 'boolean', description: 'true if this WO builds the shared design-system primitives / component inventory the other WOs reuse — the engine builds it FIRST, alone, before the rest fan out (DR-057)' },
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
// DR-065: a `missingFoundation` list flags the HIGH-CONFIDENCE, BOUNDED auto-repair class — "a
// surface failed because a shared primitive it needs isn't in the foundation". When present, the
// engine auto-resolves (add the primitive to the foundation, rebuild, retry) instead of escalating.
const MISSING_FOUNDATION = { type: 'array', items: { type: 'string' }, description: 'names of shared design-system primitives the surface needed but that are NOT in the built foundation (e.g. Room, AgentSprite). Set this when the failure is "a needed primitive is missing from the foundation" — the engine auto-repairs the foundation (DR-065), it does NOT escalate.' }
const FRD_GATE_SCHEMA = {
  type: 'object', required: ['green'],
  properties: { green: { type: 'boolean' }, reopen: { type: 'array', items: { type: 'string' } }, missingFoundation: MISSING_FOUNDATION, blocked_reason: BLOCK_REASON, failure: { type: 'string' } },
}
const REPAIR_SCHEMA = {
  type: 'object', required: ['green'],
  properties: { green: { type: 'boolean' }, missingFoundation: MISSING_FOUNDATION, blocked_reason: BLOCK_REASON, failure: { type: 'string' } },
}
// DR-057 (extended) foundation-completeness gate: the foundation = the UNION of EVERY shared
// primitive any UI surface's mock/fdd references; it must be COMPLETE + green BEFORE surfaces fan out.
const FOUNDATION_SCHEMA = {
  type: 'object', required: ['complete'],
  properties: {
    complete: { type: 'boolean' },
    missing: { type: 'array', items: {
      type: 'object', required: ['name'],
      properties: { name: { type: 'string' }, referencedBy: { type: 'array', items: { type: 'string' } }, suggestedPath: { type: 'string' }, note: { type: 'string' } },
    } },
  },
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
  - **FOUNDATION (DR-057, web only): read docs/design/components.md** (the shared-component inventory) and skim every FRD's \`mocks/\`/\`fdd.md\` to grasp the COMPLETE set of shared primitives the surfaces reference. The foundation work orders must build the UNION of those primitives — not a hand-picked subset (the gap that shipped flat Party surfaces: Room/AgentSprite/etc. were never in the foundation). Mark \`foundation: true\` on EVERY WO that builds a shared primitive the inventory lists, so the engine builds them all before surfaces fan out.
  Return the FRDs that still have non-VERIFIED work orders, **in cross-FRD dependency order** (from the Build Plans). For each FRD: its \`frd\` folder, its \`deps\` (FRD folders that must be VERIFIED first), and its \`workOrders\` (each with id, frontmatter \`status\`, intra-FRD \`deps\`, one-line \`summary\`, **its \`artifacts\` = the file/dir globs it writes, COPIED FROM the WO's \`artifacts:\` frontmatter — REQUIRED so the engine keeps parallel WOs disjoint (DR-060); if a WO has none in frontmatter, infer the files it will write from its title/summary**, and **\`foundation: true\` if this WO builds a shared design-system primitive / the inventory the other WOs reuse — DR-057, it must build before they fan out**) **in the Build Plan's order**.${ONLY ? ' Limit to these FRD folders: ' + ONLY.join(', ') + '.' : ''}
  hasFrontend=true only if the stack is web (A).`,
  { label: 'plan', phase: 'Plan', schema: PLAN_SCHEMA, model: P.judge, agentType: 'pandacorp:architect' },
)
if (!plan || !plan.frds || plan.frds.length === 0) {
  log('Nothing to build: every FRD is VERIFIED.')
  return { mode: MODE, builtFrds: [], blockedFrds: [], note: 'all verified' }
}
log(`${plan.frds.length} FRDs with pending work · stack ${plan.stack}${plan.hasFrontend ? ' (web)' : ''}`)

// Design fidelity (DR-054/056): the engine PASSES the design references into the build prompt.
// It used to pass only a one-line summary, so the implementer NEVER saw the design — the root cause
// of a build diverging from an approved prototype. For a web build, inject the binding visual refs
// + the in-loop fidelity check into every UI work order's prompt (the agent reads the files itself).
const designRef = (frd) => plan.hasFrontend
  ? ` VISUAL FIDELITY (DR-054/056, web — do NOT skip): OPEN this work order's \`## Visual reference\`, then read \`docs/frds/${frd}/fdd.md\` + its \`mocks/\` (the BINDING screen mock — view the screenshot AND the mock's source) and \`docs/design/design-tokens.json\` + root \`DESIGN.md\`. Your job is to TRANSLATE that one screen's mock into the project's components on the frozen tokens — reproduce its layout, structure, spacing, components and density; do NOT approximate, invent, or restyle. THEN run the IN-LOOP fidelity check BEFORE marking IN_REVIEW: render the route (preview/Playwright), screenshot it, place it next to the mock, fix the divergences — repeat up to 3 cycles. A screen that does not visually match its mock is NOT done (the FRD gate's visual layer will reject it).`
  : ''

// Reuse & coherence (DR-057): parallel agents reinvent slightly-different versions of the same
// component when they can't see what already exists (the two-near-identical-banners bug). Inject the
// component-inventory "check before you create" directive so each agent reuses the shared primitives.
const reuseRef = (frd) => plan.hasFrontend
  ? ` REUSE & COHERENCE (DR-057): before creating ANY UI component, READ the component inventory \`docs/design/components.md\` (if it doesn't exist yet you're early in the build — create it and list your component as the first row) and scan \`src/components/core\` + \`src/components/modules\`. REUSE an existing component if one fits; ADAPT/extend it (add a prop/variant) if it is close — do NOT fork a near-duplicate for a small difference; CREATE a new shared component only if none fits, and when you do, APPEND it to \`docs/design/components.md\` so the next agent reuses it. A component that re-implements an existing pattern (a second banner/card/modal) is a defect the gate rejects.`
  : ''

// Sync DERIVED rollups (DR-050): an FRD/blueprint implementation_status is DERIVED from its work
// orders (THE source of truth). Correct any drift from a crash mid-build, an interrupted run or a
// manual edit BEFORE building, so the document never lies about progress. One cheap pass, frontmatter only.
agentSpawned++
await agent(`Sync DERIVED rollup state, frontmatter ONLY — NEVER change a work order's state (work orders are the source of truth; you only recompute the FRD/blueprint that rolls up from them). For EVERY docs/frds/*/ folder: read \`implementation_status\` of all its work-orders/wo-*.md and compute the FRD rollup — **VERIFIED** iff ALL are VERIFIED; else **BLOCKED** if any is BLOCKED; else **PLANNED** if any is PLANNED; else **IN_PROGRESS** if any is IN_PROGRESS; else **IN_REVIEW**. Write it into that FRD's frd.md AND blueprint.md \`implementation_status\` ONLY if it differs from the computed value. Refresh .pandacorp/status.yaml per-status work-order counts AND advance \`last_event_at\` + \`updated_at\` to now (ISO 8601, the DR-066 producer freshness stamp — a monitor reads liveness as running AND fresh, so this timestamp must never be left frozen while the build advances). Commit only if something changed (Conventional Commits, scope). Return { corrected: <count> }.`,
  { label: 'sync-rollups', phase: 'Plan', model: P.worker, agentType: 'pandacorp:implementer' })

// ── Build ONE work order: implement → fast self-test → IN_REVIEW + hand-off ──
async function buildWO(wo, frd) {
  agentSpawned += (P.split && plan.hasFrontend) ? 4 : 2   // build agent(s) + self-test
  if (P.split && plan.hasFrontend) {
    await agent(`${EMIT('test-writer', wo.id, { frd, activity: 'test' })}Write the acceptance tests (RED) for work order ${wo.id} from the EARS criteria of FRD ${frd}: ${wo.summary || ''}. No production code.`,
      { label: `test:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:test-writer' })
    await agent(`${EMIT('backend-dev', wo.id, { frd, activity: 'backend' })}First read the \`## Status Note\` of the work orders ${wo.id} depends on (their exposed interfaces). Then implement the backend of ${wo.id} (TDD until green): ${wo.summary || ''}. Publish YOUR API contract at docs/api/${wo.id}.md (your own per-WO file — DR-060: never a shared docs/api.md, which races across parallel WOs). Do NOT call git — you never commit; the engine commits the wave with one serialized writer (Option B).`,
      { label: `be:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:backend-dev' })
    await agent(`${EMIT('frontend-dev', wo.id, { frd, activity: 'frontend' })}Implement the UI of ${wo.id} using ONLY design tokens and the provider WO's contract at docs/api/<the-backend-WO-in-your-Dependencies>.md (DR-060: read that specific per-WO file, never a shared docs/api.md): ${wo.summary || ''}.${designRef(frd)}${reuseRef(frd)} Do NOT call git — you never commit; the engine commits the wave (Option B).`,
      { label: `fe:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:frontend-dev' })
  } else {
    await agent(`${EMIT('implementer', wo.id, { frd, activity: 'implement' })}First set ${wo.id}'s frontmatter \`implementation_status: IN_PROGRESS\`. Then fully implement it with TDD (RED→GREEN→refactor), anchored in the EARS criteria of FRD ${frd} and in bugs from .pandacorp/comms/progress.md: ${wo.summary || ''}. This is a COARSE slice (a whole view/capability) — build it end-to-end. First read the \`## Status Note\` of the work orders ${wo.id} depends on (their exposed interfaces) and integrate against those, not a guess.${designRef(frd)}${reuseRef(frd)} Do NOT call git — you never commit; the engine commits the wave with one serialized writer (Option B, DR-060).`,
      { label: `build:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:implementer' })
  }
  // Fast SELECTIVE self-test (NOT the whole suite) → IN_REVIEW + hand-off.
  const v = await agent(`${EMIT('implementer', wo.id, { frd, activity: 'selftest' })}Fast self-test for work order ${wo.id}: run \`pnpm biome check .\`, \`pnpm tsc --noEmit\`, and \`pnpm vitest run\` limited to THIS work order's own test files (not the whole suite). If green: set the WO's frontmatter **\`implementation_status: IN_REVIEW\`** and fill its **\`## Status Note\`** hand-off (what it built; the interfaces/contracts exposed with signatures; the integration seams; **the implicit DECISIONS & ASSUMPTIONS you made — naming, data shapes, formats, units, error/empty conventions — so the consumer inherits them instead of re-deciding incompatibly**; which test files cover it). **Do NOT call git — you NEVER commit (Option B, DR-060): the engine commits the whole wave with a single serialized writer, so there is no index.lock race.** Return green=true. If red, return green=false with the reason. These are file edits to THIS WO's own files only.`,
    { label: `selftest:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA })
  return Boolean(v && v.green === true)
}

// ── FRD gate: ONE review + integration test over the whole feature ──
async function frdGate(frd, reviewIds) {
  agentSpawned++
  return await agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'gate' })}FRD review + integration gate for ${frd}. Review the work orders built/changed THIS cycle: ${reviewIds.join(', ')} (all IN_REVIEW). This FRD MAY already have OTHER work orders VERIFIED from a previous run — treat those as a stable foundation: exercise them in integration, but do NOT re-review them and NEVER change their state.
  1) Review the changed work orders with your 3 lenses (correctness/security/quality) and write adversarial tests the implementers did not see (anchored in EARS + real bugs), exercising them TOGETHER with the rest of the feature (real integration, not isolated).
  2) Run the FOCUSED gate \`bash .pandacorp/verify.sh --since <last_green_sha>\` (read last_green_sha from .pandacorp/status.yaml) — biome + tsc run globally, but only the TESTS affected since the last green (fast and scales; the full suite runs once at close-out). It must pass clean.
  If everything passes: set the reviewed work orders (${reviewIds.join(', ')}) to **\`implementation_status: VERIFIED\`**, then **recompute the FRD's frd.md + blueprint.md \`implementation_status\` rollup from ALL its work orders** and persist it (VERIFIED iff all are; else BLOCKED if any blocked; else PLANNED if any planned; else IN_PROGRESS if any in progress; else IN_REVIEW) — the FRD status is DERIVED, never left stale; update .pandacorp/status.yaml (per-status counts + last_green_sha + safe_to_test:true + **advance \`last_event_at\` and \`updated_at\` to now, ISO 8601 — the DR-066 producer freshness stamp, so a monitor never reads a frozen heartbeat as live**), and commit. Return { green: true }.
  If a SPECIFIC reviewed work order is wrong, set ONLY those (from the reviewed set) back to \`implementation_status: PLANNED\` (leave the rest IN_REVIEW; never touch an already-VERIFIED one), do not commit broken code, and return { green: false, reopen: [those ids], failure } — the engine retries them on the next run, not in a loop.
  **DR-065 — missing foundation primitive:** if a surface looks FLAT / fails visual fidelity because a SHARED design-system primitive it needs is NOT built (it isn't in src/components nor docs/design/components.md — e.g. the mock shows a Room/AgentSprite/StoneBridge the foundation never built), do NOT block and do NOT just reopen — return { green: false, missingFoundation: [the primitive names], failure }. The engine auto-repairs the foundation (adds the primitive) and rebuilds the surfaces against it — this is exactly the case it can resolve itself, so flag it instead of escalating.
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

// ── Foundation-completeness gate (DR-057 extended) ────────────────────────────
// PREVENT: the foundation = the UNION of EVERY shared primitive any UI surface's mock/fdd
// references. It must be COMPLETE + green BEFORE any surface fans out — otherwise surfaces build
// flat against missing primitives and fail fidelity (the Party regression: Room/AgentSprite/
// StoneBridge/FlowStrip were never in the foundation). Read-only analysis; returns the gaps.
async function foundationCompletenessGate() {
  agentSpawned++
  return await agent(
    `You are the FOUNDATION-COMPLETENESS auditor (DR-057). The foundation = the UNION of EVERY shared design-system primitive that ANY UI surface's mock/fdd references — not a hand-picked subset. READ-ONLY, build nothing.
    1) Enumerate the COMPLETE set: read docs/design/components.md (the living inventory) AND scan every docs/frds/*/mocks/ + fdd.md to list every shared primitive the surfaces depend on (layout shells, Banner/Card/Chip/Modal/Button, and any app-specific shared primitive the mocks show — e.g. Room/AgentSprite/StoneBridge/FlowStrip).
    2) For each, check it EXISTS as a BUILT shared component (scan src/components/core + src/components/modules) AND its foundation work order is VERIFIED/IN_REVIEW (read the WO frontmatter).
    Return { complete: true } if every referenced shared primitive is built; otherwise { complete: false, missing: [{ name, referencedBy: [frd folders], suggestedPath, note }] }. Be precise: only list primitives that surfaces genuinely reference and that are NOT yet built.`,
    { label: 'foundation-gate', phase: 'Plan', model: P.judge, agentType: 'pandacorp:reviewer', schema: FOUNDATION_SCHEMA })
}

// ── Bounded foundation auto-repair (DR-065) ───────────────────────────────────
// CURE: the high-confidence, recoverable, BOUNDED class — "a surface needs a shared primitive that
// isn't in the foundation". The engine auto-resolves (it already knows the fix) instead of stopping
// to ask: reset to the last green, ADD the missing primitive(s) to the foundation on the frozen
// tokens per their mock spec, rebuild + re-verify, commit. Capped by FOUNDATION_REPAIR_CAP; on
// exhaustion it escalates needs-owner. This is the autonomy gap the Party build exposed.
async function repairFoundation(missing, context) {
  foundationRepairs++
  agentSpawned++
  const list = (missing || []).map((m) => `${m.name}${m.referencedBy && m.referencedBy.length ? ' (needed by ' + m.referencedBy.join(', ') + ')' : ''}${m.suggestedPath ? ' → ' + m.suggestedPath : ''}`).join('; ')
  return await agent(
    `${EMIT('implementer', 'foundation', { phase: 'build', activity: 'repair' })}FOUNDATION AUTO-REPAIR (DR-065), attempt ${foundationRepairs}/${FOUNDATION_REPAIR_CAP}. ${context}. The foundation is INCOMPLETE — these shared primitives that surfaces need are NOT built: ${list || '(see the gate output)'}.
    1) Reset to the last green: \`git reset --hard <last_green_sha>\` (read last_green_sha from .pandacorp/status.yaml) so you discard the flat half-built surfaces, NOT the verified foundation.
    2) For EACH missing primitive: build it as a SHARED foundation component on the frozen design tokens, faithful to its mock/fdd spec (read docs/frds/*/mocks + docs/design/design-tokens.json + DESIGN.md); place it under src/components/core or src/components/modules; APPEND a row to docs/design/components.md so surfaces reuse it. TDD; never weaken tests.
    3) Run \`bash .pandacorp/verify.sh\` until green and commit (Conventional Commits, scope). The surfaces that depended on these primitives stay PLANNED so the normal loop rebuilds them next — now against REAL primitives.
    Return { green: true } if the foundation is now complete + green. If you genuinely cannot (low confidence, the gap is really a design/product decision, or it's beyond a primitive add), return { green: false, blocked_reason: 'needs-owner', failure } describing what a human must decide.${NOTIFY('Auto-reparé la fundación (faltaban primitivos) y reconstruyo las superficies')}`,
    { label: `foundation-repair:${foundationRepairs}`, phase: 'Build', model: P.judge, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}

// Run the completeness gate once before surfaces fan out; auto-repair (bounded) until complete or
// escalate. Returns true if the foundation is complete (safe to fan out), false if it needs the owner.
let foundationVerified = false
let foundationEscalated = false   // once the foundation needs the owner, don't re-run the gate for every later surface FRD
async function ensureFoundationComplete() {
  if (foundationVerified || !plan.hasFrontend) return true
  if (foundationEscalated) return false
  while (true) {
    const fc = await foundationCompletenessGate()
    if (!fc || fc.complete === true) { foundationVerified = true; return true }
    log(`⚠ Foundation INCOMPLETE: ${(fc.missing || []).map((m) => m.name).join(', ') || 'unknown primitives'}`)
    if (foundationRepairs >= FOUNDATION_REPAIR_CAP) {
      log(`⊘ Foundation still incomplete after ${foundationRepairs} auto-repair(s) — escalating to the owner`)
      foundationEscalated = true; return false
    }
    const fix = await repairFoundation(fc.missing, 'foundation-completeness gate before fanning out surfaces')
    if (!fix || fix.green !== true) {
      log(`⊘ Foundation auto-repair could not complete (${(fix && fix.blocked_reason) || 'error'}) — escalating to the owner`)
      foundationEscalated = true; return false
    }
    log(`✓ Foundation auto-repair ${foundationRepairs} done — re-checking completeness`)
  }
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

// DR-060: keep wave-parallel work orders DISJOINT. Each WO declares `artifacts` (globs it writes); the
// engine serializes any whose artifacts overlap into different waves, so two agents never race on one
// file (the generalized banner-collision fix). Undeclared artifacts → fall back to prior behavior
// (trust the Build Plan) for back-compat with WOs authored before the field existed.
// Real glob overlap (not a crude prefix match): two globs overlap if one's pattern can match the
// other's concrete representative path (handles `**`, `*`, and extension globs like `Banner.*`).
const globToRe = (g) => new RegExp('^' + String(g)
  .replace(/[.+^${}()|[\]\\]/g, '\\$&')   // escape regex metachars (keep * )
  .replace(/\*\*/g, ' ').replace(/\*/g, '[^/]*').replace(/ /g, '.*') + '$')
const globLiteral = (g) => String(g).replace(/\*\*\/?/g, '').replace(/\*/g, '') || '/'  // representative concrete-ish path
const globsOverlap = (x, y) => {
  if (x === y) return true
  return globToRe(x).test(globLiteral(y)) || globToRe(y).test(globLiteral(x))
}
const artifactsOverlap = (a, b) => {
  const A = a.artifacts || [], B = b.artifacts || []
  if (!A.length || !B.length) return false   // undeclared → can't prove overlap → prior behavior (back-compat)
  return A.some((x) => B.some((y) => globsOverlap(x, y)))
}
const pickDisjointWave = (ready, max) => {
  const picked = []
  for (const w of ready) {
    if (picked.length >= max) break
    if (picked.some((p) => artifactsOverlap(p, w))) continue   // overlaps a picked WO → defer to a later wave
    picked.push(w)
  }
  return picked
}

for (const f of plan.frds) {
  if (f.deps && f.deps.some((d) => blockedFrds.includes(d))) { log(`⊘ ${f.frd} skipped (depends on a blocked FRD)`); blockFrd(f.frd, 'needs-owner'); continue }
  if (budget.total && budget.remaining() < LOW_BUDGET) { stopReason = 'budget'; log('Circuit breaker: budget ceiling reached — stopping at a safe point'); break }
  if (MAX_AGENTS && agentSpawned >= MAX_AGENTS) { stopReason = 'agents'; log(`Agent ceiling reached (${agentSpawned} ≥ maxAgents ${MAX_AGENTS}) — stopping at a safe point`); break }
  if (MAX_SPEND && budget.spent() >= MAX_SPEND) { stopReason = 'budget'; log(`Spend ceiling reached (${Math.round(budget.spent() / 1000)}k ≥ maxSpend ${Math.round(MAX_SPEND / 1000)}k) — stopping at a safe point`); break }
  if ((builtFrds.length + blockedFrds.length + reopenedFrds.length) >= MAX_FRDS) { stopReason = 'maxFrds'; log(`Reached the test cap maxFrds=${MAX_FRDS} (built+blocked+reopened) — stopping at a safe point`); break }

  // DR-057 (extended) PREVENT: before fanning out ANY surface (a non-foundation UI WO), the foundation
  // must be COMPLETE + green. The gate runs once; an incomplete foundation auto-repairs (bounded,
  // DR-065) before surfaces build flat against missing primitives. If it can't, surfaces wait on the owner.
  const hasSurfaceWork = f.workOrders.some((w) => w.status !== 'VERIFIED' && w.status !== 'BLOCKED' && !w.foundation)
  if (plan.hasFrontend && hasSurfaceWork && !foundationVerified) {
    const ok = await ensureFoundationComplete()
    if (!ok) {
      log(`⊘ ${f.frd}: foundation incomplete and it needs the owner — holding surface work`)
      blockFrd(f.frd, 'needs-owner')
      if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) { stopReason = 'blocks'; break }
      continue
    }
  }

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
    // DR-057 foundation-first, ENGINE-ENFORCED (not prose): while any foundation WO is still pending,
    // the wave is foundation-only — the shared primitives/inventory build BEFORE features fan out.
    const foundationReady = ready.filter((w) => w.foundation)
    const wave = pickDisjointWave(foundationReady.length ? foundationReady : ready, P.wave)   // DR-060: never co-schedule WOs whose artifacts overlap
    const results = await parallel(wave.map((w) => () => buildWO(w, f.frd)))
    for (let i = 0; i < wave.length; i++) { queue.delete(wave[i].id); if (results[i]) doneIds.add(wave[i].id); else frdFailed = true }
    // Option B (DR-060): ONE serialized writer commits the wave's GREEN work orders — no per-agent
    // git, so no index.lock race and no merge. WOs are disjoint, so staging each WO's own files is clean.
    const greenWave = wave.filter((_, i) => results[i])
    if (greenWave.length) {
      agentSpawned++
      await agent(`You are the SOLE git writer for this build wave (Option B, DR-060): no other agent touches git, so there is no index.lock contention and no merge. The work below already built green with their frontmatter set to IN_REVIEW + their \`## Status Note\` written (file edits, not committed). Commit each GREEN work order in ITS OWN commit (Conventional Commits, scope), staging ONLY that WO's own files: ${greenWave.map((w) => `${w.id} → \`git add ${(w.artifacts && w.artifacts.length ? w.artifacts.join(' ') : 'the files this WO changed (use git status to see THIS wo\'s disjoint files)')}\` then commit`).join('  ·  ')}. Do NOT touch any other uncommitted changes. If \`git status\` shows changes outside these WOs' files, leave them. Return { committed: <count> }.`,
        { label: `commit:${f.frd}:w`, phase: 'Build', model: P.worker, agentType: 'pandacorp:implementer' })
    }
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

  // DR-065 CURE: the surface failed because a shared primitive it needs isn't in the foundation —
  // a HIGH-CONFIDENCE, BOUNDED class. The engine ALREADY knows the fix, so it auto-resolves instead
  // of stopping to ask (the autonomy gap the Party build exposed): add the primitive(s) to the
  // foundation, then let this FRD's surfaces rebuild against the real primitives next pass.
  if (gate && gate.missingFoundation && gate.missingFoundation.length && foundationRepairs < FOUNDATION_REPAIR_CAP) {
    log(`! ${f.frd}: gate found primitives missing from the foundation (${gate.missingFoundation.join(', ')}) — auto-repairing (DR-065)`)
    const fr = await repairFoundation(gate.missingFoundation.map((n) => ({ name: n, referencedBy: [f.frd] })), `the FRD gate for ${f.frd} found a surface needs a primitive missing from the foundation`)
    if (fr && fr.green === true) {
      foundationVerified = false   // re-confirm completeness before the next surface fans out
      log(`✓ ${f.frd}: foundation repaired — its surfaces rebuild against real primitives next pass`)
      reopenedFrds.push(f.frd); continue   // the repair reset surfaces to the last green (→ PLANNED); next pass rebuilds them
    }
    log(`⊘ ${f.frd}: foundation auto-repair failed — falling through to block`)
  }

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
  closed = await agent(`All FRDs are VERIFIED — now the CROSS-FEATURE INTEGRATION REVIEW (DR-060): the seam check the per-FRD gates CANNOT do (each only sees its own feature). The dominant failure of parallel builds is at the seams BETWEEN features — every component correct in isolation, broken together. Trace the data flow ACROSS feature boundaries and verify every producer/consumer pair actually AGREES: each consumer's expectations vs its provider's \`docs/api/<wo-id>.md\` contract (field names, data shapes, formats, units, status codes, routes), shared types/enums used consistently across features, and NO two features that shipped duplicate or divergent versions of the same component/util (cross-check \`docs/design/components.md\`). THEN run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since — includes the smoke + visual gates) and kill any test dev servers with TaskStop. If a cross-feature seam is wrong, reopen the offending work order (set it \`implementation_status: PLANNED\`) and return done:false with the finding. If everything integrates AND the full suite is green: set .pandacorp/status.yaml phase: release and running: false. Return done:true once status.yaml is written.${NOTIFY('Build COMPLETO: FRDs verificados + integracion cross-feature OK', 'Glass')}`,
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
