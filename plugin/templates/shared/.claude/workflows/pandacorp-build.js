export const meta = {
  name: 'pandacorp-build',
  description: 'Pandacorp build engine v2 (DR-050): builds FRD by FRD using each blueprint\'s Build Plan, with state in the work-order frontmatter (implementation_status), ONE review/test gate per FRD (not per work order), hand-offs, fail-closed gates and one commit per safe point. Resumable by construction — it reads the frontmatter and NEVER rebuilds a VERIFIED work order.',
  phases: [
    { title: 'Baseline' },
    { title: 'Plan' },
    { title: 'Build' },
    { title: 'Review' },
  ],
}

// ── Input (all optional) ─────────────────────────────────────────────────────
//   args.mode: 'pro' | 'balanced' | 'powerful' | 'deep'  (default: balanced)
//   args.frds: specific FRD folders to limit to (default: all with pending work)
const MODE = (args && args.mode) || 'balanced'
const ONLY = (args && args.frds) || null

// Concurrency/models per mode (DR-014). `wave` = work orders built in parallel
// within an FRD. `split` runs test→backend→frontend; otherwise one full-stack
// implementer builds the coarse slice end-to-end (faster).
const PROFILES = {
  pro:      { wave: 2, worker: 'sonnet', judge: 'sonnet', split: false },
  balanced: { wave: 4, worker: 'sonnet', judge: 'opus',   split: false },
  powerful: { wave: 8, worker: 'sonnet', judge: 'opus',   split: false },
  deep:     { wave: 6, worker: 'opus',   judge: 'opus',   split: true  },
}
const P = PROFILES[MODE] || PROFILES.balanced
log(`Mode ${MODE} · wave ≤${P.wave} · workers ${P.worker} · judge ${P.judge}`)

const EMIT = (role, wo) =>
  `Before you start, record your activity for Party (one append, fire-and-forget):\n` +
  `  printf '{"event":"AgentWorking","at":"%s","project":"%s","data":{"role":"${role}","wo":"${wo}"}}\\n' "$(date -u +%FT%TZ)" "$(basename "$PWD")" >> ~/.claude/dashboard-events.ndjson\n`

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
const FRD_GATE_SCHEMA = {
  type: 'object', required: ['green'],
  properties: { green: { type: 'boolean' }, reopen: { type: 'array', items: { type: 'string' } }, failure: { type: 'string' } },
}

// ── Baseline self-heal (deadlock breaker) ─────────────────────────────────────
phase('Baseline')
const baseline = await agent(
  `You are the Pandacorp baseline-repair engineer. Run \`bash .pandacorp/verify.sh\`.
  - GREEN → return { green: true }, change nothing.
  - RED → fix the PRODUCTION code (never weaken/skip tests) until it passes end-to-end, commit (Conventional Commits with scope), return { green: true }.
  If you genuinely can't, NOTIFY THE OWNER (Bash: osascript -e 'display notification "Baseline roto y no se pudo reparar — necesita tu intervención" with title "Pandacorp build" sound name "Basso"' || true) and return { green: false, failure }.`,
  { label: 'baseline', phase: 'Baseline', model: P.judge, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA },
)
if (!baseline || baseline.green !== true) {
  log(`Baseline red and auto-repair failed${baseline?.failure ? ': ' + baseline.failure : ''} — stopping for the owner.`)
  return { mode: MODE, builtFrds: [], blockedFrds: ['baseline'], note: 'baseline red (needs manual fix)' }
}
log('Baseline green — planning by FRD.')

// ── Plan: read FRDs, their Build Plans and the frontmatter state (no inferred "done") ──
phase('Plan')
const plan = await agent(
  `You are the Pandacorp build planner. Read state WITHOUT modifying anything:
  - WALK every FRD module docs/frds/*/. For each, read frd.md, blueprint.md (especially its **Build Plan**: WO order, intra-FRD deps, parallelism, cross-FRD deps), and every work-orders/wo-*.md.
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

// ── Build ONE work order: implement → fast self-test → IN_REVIEW + hand-off ──
async function buildWO(wo, frd) {
  if (P.split && plan.hasFrontend) {
    await agent(`${EMIT('test-writer', wo.id)}Write the acceptance tests (RED) for work order ${wo.id} from the EARS criteria of FRD ${frd}: ${wo.summary || ''}. No production code.`,
      { label: `test:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:test-writer' })
    await agent(`${EMIT('backend-dev', wo.id)}Implement the backend of ${wo.id} (TDD until green): ${wo.summary || ''}. Publish the API contract in docs/api.md.`,
      { label: `be:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:backend-dev' })
    await agent(`${EMIT('frontend-dev', wo.id)}Implement the UI of ${wo.id} using ONLY design tokens and the docs/api.md contract: ${wo.summary || ''}.`,
      { label: `fe:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:frontend-dev' })
  } else {
    await agent(`${EMIT('implementer', wo.id)}First set ${wo.id}'s frontmatter \`implementation_status: IN_PROGRESS\`. Then fully implement it with TDD (RED→GREEN→refactor), anchored in the EARS criteria of FRD ${frd} and in bugs from .pandacorp/comms/progress.md: ${wo.summary || ''}. This is a COARSE slice (a whole view/capability) — build it end-to-end.`,
      { label: `build:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:implementer' })
  }
  // Fast SELECTIVE self-test (NOT the whole suite) → IN_REVIEW + hand-off.
  const v = await agent(`Fast self-test for work order ${wo.id}: run \`pnpm biome check .\`, \`pnpm tsc --noEmit\`, and \`pnpm vitest run\` limited to THIS work order's own test files (not the whole suite). If green: commit (Conventional Commits with scope), set the WO's frontmatter **\`implementation_status: IN_REVIEW\`**, and fill its **\`## Status Note\`** hand-off (what it built, interfaces/contracts exposed with signatures, integration seams, which test files cover it). Return green=true. If red, return green=false with the reason and do NOT commit. Never commit mid-work-order.`,
    { label: `selftest:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA })
  return Boolean(v && v.green === true)
}

// ── FRD gate: ONE review + integration test over the whole feature ──
async function frdGate(frd, woIds) {
  return await agent(`${EMIT('reviewer', frd)}FRD review + integration gate for ${frd} (work orders ${woIds.join(', ')}, all IN_REVIEW).
  1) Review the WHOLE feature with your 3 lenses (correctness/security/quality) and write adversarial tests the implementers did not see (anchored in EARS + real bugs), exercising the work orders TOGETHER (real integration, not isolated).
  2) Run the FULL gate \`bash .pandacorp/verify.sh\` clean.
  If everything passes: set EVERY one of this FRD's work orders AND its frd.md + blueprint.md frontmatter to **\`implementation_status: VERIFIED\`**, update .pandacorp/status.yaml (per-status counts + last_green_sha + safe_to_test:true), and commit. Return { green: true }.
  If a specific work order is wrong, return { green: false, reopen: [its ids], failure } (the engine will rebuild only those).
  If it's broken and you can't fix it, NOTIFY THE OWNER (Bash: osascript -e 'display notification "FRD ${frd} no pasó la revisión — necesita tu atención" with title "Pandacorp build" sound name "Basso"' || true) and return { green: false, failure }.`,
    { label: `gate:${frd}`, phase: 'Review', model: P.judge, agentType: 'pandacorp:reviewer', schema: FRD_GATE_SCHEMA })
}

// ── Per-FRD loop ──────────────────────────────────────────────────────────────
const builtFrds = []
const blockedFrds = []
for (const f of plan.frds) {
  if (f.deps && f.deps.some((d) => blockedFrds.includes(d))) { log(`⊘ ${f.frd} skipped (depends on a blocked FRD)`); blockedFrds.push(f.frd); continue }
  if (budget.total && budget.remaining() < 80000) { log('Circuit breaker: low budget, stopping at a safe point'); break }

  phase('Build')
  const pending = f.workOrders.filter((w) => w.status !== 'VERIFIED' && w.status !== 'BLOCKED')
  log(`▶ ${f.frd}: ${pending.length} work orders to build`)
  const doneIds = new Set(f.workOrders.filter((w) => w.status === 'VERIFIED').map((w) => w.id))
  const queue = new Map(pending.map((w) => [w.id, w]))
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
  if (frdFailed) {
    log(`✗ ${f.frd}: a work order failed its self-test — freeze + notify`)
    blockedFrds.push(f.frd)
    await agent(`Freeze ${f.frd}: leave HEAD at last_green_sha, do NOT commit anything broken, mark the failed work order(s) \`implementation_status: BLOCKED\` in their frontmatter + .pandacorp/status.yaml with the reason. NOTIFY THE OWNER (Bash: osascript -e 'display notification "FRD ${f.frd} bloqueado — necesita tu atención" with title "Pandacorp build" sound name "Basso"' || true).`,
      { label: `freeze:${f.frd}`, phase: 'Review', model: P.worker, agentType: 'pandacorp:implementer' })
    continue
  }

  phase('Review')
  const gate = await frdGate(f.frd, f.workOrders.map((w) => w.id))
  if (gate && gate.green === true) { log(`✓ ${f.frd} VERIFIED`); builtFrds.push(f.frd) }
  else { log(`✗ ${f.frd} gate failed${gate?.failure ? ': ' + gate.failure : ''} — freeze-on-red`); blockedFrds.push(f.frd) }
}

// ── Close-out + ALWAYS notify the owner how this run ended ────────────────────
phase('Review')
const allDone = builtFrds.length > 0 && blockedFrds.length === 0
if (allDone) {
  await agent(`All FRDs are VERIFIED. Run the full suite + e2e of the critical flows and kill the test dev servers with TaskStop. If green, set .pandacorp/status.yaml phase: release and running: false. Then NOTIFY THE OWNER (Bash: osascript -e 'display notification "Build COMPLETO: todos los FRDs verificados" with title "Pandacorp build" sound name "Glass"' || true).`,
    { label: 'close-out', phase: 'Review', model: P.judge, agentType: 'pandacorp:reviewer' })
} else {
  const blk = blockedFrds.slice(0, 8).join(', ') || 'ninguno'
  await agent(`The build run ended. Verified this run: ${builtFrds.length} FRD(s). Blocked: ${blockedFrds.length} (${blk}). Write a short Spanish summary to .pandacorp/comms/progress.md (what advanced, what's blocked and why, what needs the owner's decision). Then NOTIFY THE OWNER (Bash: osascript -e 'display notification "Tramo terminado: ${builtFrds.length} FRDs ok · ${blockedFrds.length} bloqueados — revisá" with title "Pandacorp build" sound name "Basso"' || true).`,
    { label: 'notify-end', phase: 'Review', model: P.worker, agentType: 'pandacorp:implementer' })
  log(`Run ended: ${builtFrds.length} FRDs verified, ${blockedFrds.length} blocked.`)
}

return { mode: MODE, builtFrds, blockedFrds }
