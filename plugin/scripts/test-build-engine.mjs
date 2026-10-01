#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// test-build-engine.mjs — offline harness for the SPLIT FRD review gate
// (proposal 31 T1.2) added to
// plugin/runtime/engine/pandacorp-build.src.js (the source of the generated deployable engine).
//
// WHY A SECOND HARNESS
// ────────────────────
// The engine is a Claude Dynamic Workflows script: plain JS run with INJECTED
// globals, declaring none of them. So the whole thing is deterministically
// simulable in memory — no Claude, no filesystem, no git. This harness loads
// the engine source, strips the single ESM `export` from its `meta` decl, wraps
// the body in `new AsyncFunction('args','budget','agent','parallel','pipeline',
// 'log','phase','workflow', body)` (the exact global set + order the runtime
// injects), and runs it with STUB globals. The engine file on disk is NEVER
// modified.
//
// The stubs:
//   • agent(prompt, opts) — records {label, model, agentType, prompt} into a
//     spawn log and returns a canned object selected by opts.label (exact /
//     prefix / RegExp). An unmatched label falls to a schema-conformant default
//     (the happy path) AND is recorded so a scenario can't silently rely on a
//     garbage response.
//   • parallel(thunks) = Promise.all(thunks.map(t => t().catch(() => null))) —
//     matches the engine's fail-safe contract (a dead finder/verifier → null).
//   • budget = { total: null, spent: () => 0, remaining: () => Infinity }.
//   • log / phase — collect strings.
//   • pipeline / workflow — unused by the engine; stubbed as no-ops.
//
// Each scenario's canned Plan presents ONE FRD whose work orders are all
// IN_REVIEW, so the engine skips the build and walks straight to the FRD gate.
// The post-gate canned responses walk it to its normal "nothing left" exit.
//
// THREE SCENARIOS (contract, proposal 31 T1.2):
//   1. mode powerful (reviewSplit on): 4 finder lenses fan out; 2 corrections
//      found, 1 refuted → exactly 1 reaches the closer; exactly one closer with
//      model === P.judge (opus).
//   2. mode balanced (reviewSplit off): NO finder lenses — one serial gate spawn.
//   3. maxAgents nearly exhausted in powerful: fall back to the serial gate +
//      the explanatory log line.
//
// Exit 0 green / non-zero on any assertion failure. One PASS line per scenario.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// BL-0204: the readable SOURCE (the deployable artifact is generated from it; PANDACORP_ENGINE_RUN=artifact
// executes the generated file instead — see test-engine-artifact.mjs).
const ENGINE_PATH = process.env.PANDACORP_ENGINE_RUN === 'artifact'
  ? path.resolve(__dirname, '../templates/shared/.claude/engines/pandacorp-build.js')
  : path.resolve(__dirname, '../runtime/engine/pandacorp-build.src.js')

let source = readFileSync(ENGINE_PATH, 'utf8')
// The only ESM syntax in the file is the meta export; neutralize it so the
// source is a valid function body. (In-memory copy only — the file is untouched.)
source = source.replace(/^export\s+const\s+meta/m, 'const meta')
if (/^\s*(export|import)\b/m.test(source)) {
  console.error('FATAL: engine still contains ESM syntax after the meta transform — update the harness loader.')
  process.exit(1)
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
// Global set + order exactly as the runtime injects them (contract). The engine
// rebinds `agent` internally (BL-0022 wrapper), which works because it is a param.
const engine = new AsyncFunction('args', 'budget', 'agent', 'parallel', 'pipeline', 'log', 'phase', 'workflow', source)

// ── Schema-conformant default responses by label (the happy path) ────────────
// A scenario only scripts the deviations it is about; everything else greens.
const validTraceability = ['requirement', 'acceptance-criterion', 'invariant', 'edge-case', 'limit', 'error', 'exclusion'].map((contractClass) => ({ contract: `${contractClass} fixture`, contractClass, status: ['edge-case', 'limit'].includes(contractClass) ? 'pass' : 'not-applicable', tests: ['edge-case', 'limit'].includes(contractClass) ? [`tests/${contractClass}.test.ts`] : [] }))
function defaultResponse(label) {
  if (label === 'baseline-precheck') return { escalate: true }
  if (label === 'baseline') return { green: true }                       // VERIFY_SCHEMA
  if (label === 'plan') return { frds: [] }                             // PLAN_SCHEMA (empty → early exit)
  if (label === 'sync-rollups') return { corrected: 0 }
  if (label === 'safe-point') return { stop: false, stop_receipt: { status_exists: true, stop: false, method: 'node-lstat' }, ready: [], unblocked: [] } // SAFE_POINT_SCHEMA
  if (label === 'foundation-gate') return { complete: true }            // FOUNDATION_SCHEMA
  if (label === 'visual-qa') return { done: true }
  if (label.startsWith('dispatch:')) return {}
  if (/^gate-worktree(:\d+)?$/.test(label)) return { ok: true, created: true }   // D1: bare (serial) or pooled 'gate-worktree:<slot>' (parallelGates, now the v9.116.0 default)
  if (label.startsWith('pin:')) return { sha: 'pinsha0' }
  if (label.startsWith('apply-gate:')) return { done: true }
  if (label.startsWith('persist-block:')) return { done: true }
  if (label.startsWith('gate-release:')) return { salvaged: [], remaining: [] }   // BL-0182: the C2 gate-worktree release (salvage + exact clean) — a clean tree, nothing left behind
  if (label.startsWith('commit:')) return { committed: 1 }
  if (/^(build|test|be|fe|selftest):/.test(label)) return { green: true } // VERIFY_SCHEMA
  if (label.startsWith('find:')) return { findings: [] }                 // FINDER_SCHEMA — nothing found
  if (label.startsWith('verify-finding:')) return { refuted: true, reason: 'default refuted' } // VERIFY_FINDING_SCHEMA
  if (label.startsWith('gate:')) return { green: true, traceability: validTraceability } // FRD_GATE_SCHEMA
  if (/^(repair|patch|gate-test-repair|verify-patch|revert|foundation-repair):/.test(label)) return { green: true } // REPAIR_SCHEMA
  if (/^(process-change|plan-drained):/.test(label)) return { done: true, affectedFrds: [], frds: [] }
  if (label === 'ensure-stopped') return { done: true, allowed_paths: ['.pandacorp/status.yaml'], lease_released: true }
  if (label === 'close-out-verify-reuse-check') return { canReuse: false, reason: 'no-report' } // BL-0147: safe default — the full rerun happens exactly as pre-BL-0147 unless a scenario scripts a fresh full-green report
  if (/^(hardening:security-audit|hardening:security-fix|hardening:telemetry|close-out|close-needs-hardening|notify-end|ensure-stopped-crash|archive-changes|release-lease)$/.test(label)) return { done: true } // STOP_SCHEMA
  return null // unmatched — recorded loudly
}

// ── Scenario runner ──────────────────────────────────────────────────────────
async function runEngine(scenario) {
  const calls = []
  const logs = []
  const phases = []
  const unmatched = []
  const responses = [...(scenario.responses || [])]
  if (scenario.plan) responses.unshift({ label: 'plan', response: scenario.plan })

  const agentStub = async (prompt, opts = {}) => {
    const call = {
      index: calls.length,
      label: opts.label || '',
      model: opts.model,
      agentType: opts.agentType,
      prompt: String(prompt),
      opts,
    }
    calls.push(call)
    for (const r of responses) {
      if (r.times !== undefined && r.times <= 0) continue
      const m =
        (typeof r.label === 'string' && r.label === call.label) ||
        (r.label instanceof RegExp && r.label.test(call.label)) ||
        (typeof r.prefix === 'string' && call.label.startsWith(r.prefix))
      if (!m) continue
      if (r.times !== undefined) r.times--
      const answer = typeof r.response === 'function' ? r.response(call) : r.response
      return call.label.startsWith('gate:') && answer && typeof answer === 'object' && !answer.__splitFailed && !('traceability' in answer) ? { ...answer, traceability: validTraceability } : answer
    }
    const def = defaultResponse(call.label)
    if (def === null) {
      unmatched.push(call.label || call.prompt.slice(0, 80))
      return {}
    }
    return def
  }

  // parallel: like the runtime — Promise.all with a per-thunk catch so a dead
  // finder/verifier resolves to null (the engine's documented fail-safe input).
  const parallelStub = (thunks) => Promise.all(thunks.map((t) => t().catch(() => null)))
  const budget = scenario.budget || { total: null, spent: () => 0, remaining: () => Infinity }
  const noop = () => {}

  let result, error
  // v9.116.0: the engine's OWN default for args.parallelGates flipped to true (F1/F2 verdict). These 3
  // reviewSplit scenarios predate D1 and are about a different feature entirely (the split FRD gate) — pin
  // them to the pre-D1 legacy topology (no scenario here sets parallelGates itself) so their agent-label
  // assertions stay unrelated to gate-pool mechanics.
  const engineArgs = scenario.args && typeof scenario.args === 'object'
    ? { stateCli: '/installed plugin/scripts/pandacorp-build-state.mjs', leaseToken: 'test-lease-token', leaseEpoch: 1, parallelGates: false, ...scenario.args }
    : scenario.args
  try {
    result = await engine(
      engineArgs,
      budget,
      agentStub,
      parallelStub,
      noop, // pipeline (unused)
      (l) => logs.push(String(l)),
      (t) => phases.push(t),
      noop, // workflow (unused)
    )
  } catch (e) {
    error = e
  }
  return { calls, logs, phases, unmatched, result, error }
}

// ── Plan builders ────────────────────────────────────────────────────────────
const mkWo = (id, status, extra = {}) => ({
  id,
  status,
  path: extra.path || `docs/frds/${extra.frd || 'frd-x'}/work-orders/${id}.md`,
  deps: extra.deps || [],
  artifacts: extra.artifacts,
  summary: extra.summary || `work order ${id}`,
  difficulty: extra.difficulty,
  reopen_count: extra.reopen_count,
  foundation: extra.foundation,
})
const mkPlan = (frds, opts = {}) => ({
  stack: opts.stack || 'B',
  hasFrontend: Boolean(opts.hasFrontend),
  unsatisfiedDeps: [],
  frds,
})

// ── Assertion collector ──────────────────────────────────────────────────────
class T {
  constructor(name) { this.name = name; this.failures = []; this.count = 0 }
  ok(cond, msg) { this.count++; if (!cond) this.failures.push(msg) }
}
const hasLog = (run, re) => run.logs.some((l) => re.test(l))
const byLabel = (run, re) => run.calls.filter((c) => (re instanceof RegExp ? re.test(c.label) : c.label === re))

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────
const SCENARIOS = []

// ── 1. powerful (reviewSplit on): finders fan out; refuted findings die; one closer on the judge ──
// All WOs IN_REVIEW → the FRD goes straight to the gate. The correctness finder reports TWO corrections;
// the two adversarial skeptics refute exactly ONE. So exactly ONE surviving correction reaches the
// closer's prompt (the refuted one must NOT). The closer is the single gate spawn on model P.judge (opus).
//
// C1a SERIAL-FIRST (2026-07-07): frdGate() dispatches to the split ONLY when this is a re-gate
// (frdState.gateAttempts>=1, a same-run signal) OR a reviewed WO's frontmatter already carries
// reopen_count>=1 (a cross-run signal: it failed and was reopened on a PRIOR run). This harness always
// scripts `gate:*` as an immediate `{ green: true }`, so gateAndConverge() never re-gates within the
// run — priorAttempts is always 0 here. To legitimately drive the split machinery (finders → dedup →
// skeptics → close) in a single-call scenario we therefore lean on the OTHER trigger: wo-01-001 is
// seeded with `reopen_count: 1`, i.e. this FRD's re-review already failed once in an earlier run, so
// C1a's serial-first grace period is skipped and THIS run's first (and only) gate for it goes straight
// to the split — exactly the "prior-reopened WO" branch of the rule.
SCENARIOS.push({
  name: '1. powerful reviewSplit — a prior-reopened WO (C1a) sends the FIRST gate straight to split; 4 finder lenses fan out; refuted finding dies; one confirmed reaches the closer (opus)',
  args: { mode: 'powerful' },
  plan: mkPlan([{
    frd: 'frd-01-split',
    deps: [],
    workOrders: [
      mkWo('wo-01-001', 'IN_REVIEW', { frd: 'frd-01-split', artifacts: ['src/a/**'], reopen_count: 1 }),
      mkWo('wo-01-002', 'IN_REVIEW', { frd: 'frd-01-split', artifacts: ['src/b/**'] }),
    ],
  }]),
  responses: [
    // The correctness lens reports two blocking corrections (distinct file+claim keys).
    { label: 'find:correctness:frd-01-split', response: { findings: [
      { file: 'src/a/one.ts:10', claim: 'AC-01-001 not met: missing empty state', severity: 'correction', evidence: 'renders nothing when list is empty' },
      { file: 'src/b/two.ts:22', claim: 'AC-01-002 not met: wrong sort order', severity: 'correction', evidence: 'sorts ascending, AC requires descending' },
    ] } },
    // The other three lenses find nothing (default handles them, but be explicit for clarity).
    { label: 'find:security:frd-01-split', response: { findings: [] } },
    { label: 'find:quality:frd-01-split', response: { findings: [] } },
    { label: 'find:runtime:frd-01-split', response: { findings: [] } },
    // Two skeptics: refute the SECOND correction (sort order), uphold the FIRST (empty state).
    { label: 'verify-finding:frd-01-split', times: 1, response: { refuted: false, reason: 'confirmed: empty state genuinely missing' } },
    { label: 'verify-finding:frd-01-split', times: 1, response: { refuted: true, reason: 'could not reproduce — sort IS descending in the code' } },
    // The closer greens the gate (the FRD verifies).
    { label: 'gate:frd-01-split', response: { green: true } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    const finders = byLabel(run, /^find:/)
    t.ok(finders.length === 4, `exactly 4 finder lenses fanned out (got ${finders.length}: ${finders.map((c) => c.label).join(', ')})`)
    const lensKeys = finders.map((c) => c.label).sort()
    t.ok(
      lensKeys.join(',') === ['find:correctness:frd-01-split', 'find:quality:frd-01-split', 'find:runtime:frd-01-split', 'find:security:frd-01-split'].join(','),
      `the four lenses are correctness/security/quality/runtime — got ${lensKeys.join(', ')}`,
    )
    t.ok(finders.every((c) => c.model === 'sonnet'), 'every finder runs on sonnet')
    t.ok(finders.every((c) => c.agentType === 'pandacorp:reviewer'), 'every finder is a pandacorp:reviewer')
    t.ok(finders.every((c) => /READ-ONLY/.test(c.prompt) && /do NOT fix/i.test(c.prompt)), 'every finder prompt is read-only (no fixes, no test writing)')
    // VERIFY stage: one skeptic per CORRECTION (2), each on sonnet.
    const verifiers = byLabel(run, /^verify-finding:/)
    t.ok(verifiers.length === 2, `exactly 2 adversarial verifiers ran — one per correction (got ${verifiers.length})`)
    t.ok(verifiers.every((c) => c.model === 'sonnet'), 'every verifier runs on sonnet')
    t.ok(verifiers.every((c) => /REFUTE/.test(c.prompt) && /default to refuted/i.test(c.prompt)), 'every verifier prompt is adversarial (default-refuted)')
    // CLOSE stage: exactly one gate spawn, on the judge model (opus), and it names ONLY the surviving finding.
    const gates = byLabel(run, /^gate:/)
    t.ok(gates.length === 1, `exactly one closer/gate spawn (got ${gates.length})`)
    t.ok(gates[0] && gates[0].model === 'opus', `the closer runs on P.judge === opus (got ${gates[0] && gates[0].model})`)
    t.ok(gates[0] && gates[0].agentType === 'pandacorp:reviewer', 'the closer is a pandacorp:reviewer')
    t.ok(gates[0] && /AC-01-001 not met/.test(gates[0].prompt), 'the SURVIVING confirmed correction (empty state) reaches the closer prompt')
    t.ok(gates[0] && !/wrong sort order/.test(gates[0].prompt), 'the REFUTED correction (sort order) does NOT reach the closer prompt (it died)')
    t.ok(gates[0] && /finder sweep/i.test(gates[0].prompt) && /do NOT re-hunt/i.test(gates[0].prompt), 'the closer prompt tells it the sweep already ran (no re-hunt from scratch)')
    // No serial fallback happened, and the FRD verified.
    t.ok(!hasLog(run, /using the serial gate instead/), 'no serial fallback log fired')
    t.ok(hasLog(run, /verify → 1 correction\(s\) survive/), 'the survive count is logged (1 of 2)')
    t.ok(run.result && run.result.builtFrds.includes('frd-01-split'), 'the FRD verified through the split gate')
  },
})

// ── 2. balanced (reviewSplit off): NO finders — a single serial gate spawn, exactly like today ──
SCENARIOS.push({
  name: '2. balanced reviewSplit off — no finder lenses; a single serial gate spawn (unchanged behavior)',
  args: { mode: 'balanced' },
  plan: mkPlan([{
    frd: 'frd-02-serial',
    deps: [],
    workOrders: [
      mkWo('wo-02-001', 'IN_REVIEW', { frd: 'frd-02-serial', artifacts: ['src/c/**'] }),
    ],
  }]),
  responses: [
    { label: 'gate:frd-02-serial', response: { green: true } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, /^find:/).length === 0, 'NO finder lenses spawned (reviewSplit is false on balanced)')
    t.ok(byLabel(run, /^verify-finding:/).length === 0, 'NO adversarial verifiers spawned')
    const gates = byLabel(run, /^gate:/)
    t.ok(gates.length === 1, `exactly one serial gate spawn (got ${gates.length})`)
    t.ok(gates[0] && gates[0].model === 'opus', 'the serial gate runs on P.judge === opus (balanced)')
    t.ok(gates[0] && /THE GATE IS SPLIT \(DR-072\)/.test(gates[0].prompt), 'the serial gate prompt is the original DR-072 split-verdict reviewer')
    t.ok(gates[0] && !/finder sweep/i.test(gates[0].prompt), 'the serial gate prompt does NOT mention a prior finder sweep (it is the standalone reviewer)')
    t.ok(!hasLog(run, /verify → /), 'no split-stage survive log fired')
    t.ok(run.result && run.result.builtFrds.includes('frd-02-serial'), 'the FRD verified through the serial gate')
  },
})

// ── 3. powerful, maxAgents nearly exhausted: fall back to the serial gate + the explanatory log ──
// The split's estimated cost is 4*COST(sonnet) + 8*COST(sonnet) + COST(opus) = 4+8+3 = 15. We choose a
// maxAgents that (a) lets the engine reach the gate but (b) leaves < 15 agents of headroom at the gate,
// so the pre-spawn brake check forces the serial fallback. Pre-gate spawns for an all-IN_REVIEW plan:
// baseline(opus,3) + plan(opus,3) + sync(1) + safe-point(1) = 8. maxAgents=20 → remaining at the gate =
// 20-8 = 12 < 15 → fall back to serial. (The loop-top brake — agentSpawned 8 < 20 — does not trip, so
// the engine genuinely reaches the gate; the fallback is the gate-choice branch, not the global brake.)
//
// C1a SERIAL-FIRST (2026-07-07): the budget-fallback branch this scenario targets (`remaining <
// splitGateEstimatedCost()`) only executes INSIDE `if (useSplit)` — so useSplit must already be true
// before the budget check can even run. As in scenario 1, a first-and-only gate call has priorAttempts
// always 0, so we seed wo-03-001 with `reopen_count: 1` (a prior-run reopen) to satisfy C1a's OTHER
// trigger and reach the split-vs-budget decision at all; the scenario's actual subject — the agent
// budget forcing serial — is unchanged by this.
SCENARIOS.push({
  name: '3. powerful, maxAgents nearly exhausted — a prior-reopened WO (C1a) reaches the split decision, then the budget check falls back to the serial reviewer + logs why',
  args: { mode: 'powerful', maxAgents: 20 },
  plan: mkPlan([{
    frd: 'frd-03-fallback',
    deps: [],
    workOrders: [
      mkWo('wo-03-001', 'IN_REVIEW', { frd: 'frd-03-fallback', artifacts: ['src/d/**'], reopen_count: 1 }),
    ],
  }]),
  responses: [
    { label: 'gate:frd-03-fallback', response: { green: true } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, /^find:/).length === 0, 'NO finder lenses spawned (the split did not fit the agent budget)')
    t.ok(byLabel(run, /^verify-finding:/).length === 0, 'NO adversarial verifiers spawned')
    const gates = byLabel(run, /^gate:/)
    t.ok(gates.length === 1, `exactly one serial gate spawn (the fallback) — got ${gates.length}`)
    t.ok(gates[0] && !/finder sweep/i.test(gates[0].prompt), 'the fallback ran the serial reviewer prompt (no finder sweep)')
    t.ok(hasLog(run, /reviewSplit on but the split's estimated cost .* exceeds the remaining agent budget/), 'the explanatory fallback log line fired (contract 5)')
    t.ok(run.result && run.result.builtFrds.includes('frd-03-fallback'), 'the FRD still verified through the serial fallback gate (the gate is never skipped)')
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// A-1 bench changes (DR-123): maxAgents 'auto', foundation-wave un-deferral, lean security tail
// ─────────────────────────────────────────────────────────────────────────────
const sizeLogs = (run) => run.logs.filter((l) => /maxAgents auto: projected/.test(l))
const capOf = (line) => Number((/→ cap (\d+)/.exec(line) || [])[1])
const threeWoPlan = (frd = 'frd-a1') => mkPlan([{
  frd,
  deps: [],
  workOrders: [
    mkWo('wo-a1-001', 'PLANNED', { frd, artifacts: ['src/lib/a/**'] }),
    mkWo('wo-a1-002', 'PLANNED', { frd, artifacts: ['src/lib/b/**'] }),
    mkWo('wo-a1-003', 'PLANNED', { frd, artifacts: ['src/lib/c/**'] }),
  ],
}])

SCENARIOS.push({
  name: "A1-a. auto-sizes-1frd-3wo — maxAgents:'auto' sizes the cap from the post-plan projection (1 FRD / 3 WOs ≈ 40 units x1.25) and the run never stops on the agent ceiling",
  args: { mode: 'powerful', maxAgents: 'auto' },
  plan: threeWoPlan(),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(hasLog(run, /maxAgents auto \(se dimensiona tras el plan\)/), 'the arg-echo line says auto (not OFF, not a number)')
    const sized = sizeLogs(run)
    t.ok(sized.length === 1, `exactly one sizing log after the plan (got ${sized.length})`)
    const cap = capOf(sized[0] || '')
    t.ok(cap >= 45 && cap <= 65, `the auto cap is in [45, 65] (got ${cap})`)
    t.ok(/projected ~40 cost units \(≈ 20 USD aprox\.\)/.test(sized[0] || ''), `the log carries the projected units and an approximate USD (got ${sized[0]})`)
    t.ok(!hasLog(run, /Agent ceiling reached/), 'no stop=agents: the run never hit the agent ceiling')
    t.ok(byLabel(run, /^build:/).length === 3, 'all three WOs were built')
    t.ok(run.result && run.result.builtFrds.includes('frd-a1'), 'the FRD verified')
  },
})

SCENARIOS.push({
  name: 'A1-b. plan-growth-recomputes — a change drained mid-run that adds an FRD raises the auto cap by the added FRD\'s own projection (never lowers it)',
  args: { mode: 'powerful', maxAgents: 'auto' },
  plan: threeWoPlan(),
  responses: [
    { label: 'safe-point', times: 1, response: { stop: false, stop_receipt: { status_exists: true, stop: false, method: 'node-lstat' }, ready: ['change-grow'], unblocked: [] } },
    { label: 'process-change:change-grow', response: { done: true, affectedFrds: ['frd-a2'] } },
    { label: 'gate-change-wos:frd-a2', response: { results: [{ frd: 'frd-a2', gated: true }] } },
    { label: 'plan-drained:change-grow', response: { frds: [{ frd: 'frd-a2', deps: [], workOrders: [mkWo('wo-a2-001', 'PLANNED', { frd: 'frd-a2', artifacts: ['src/lib/d/**'] }), mkWo('wo-a2-002', 'PLANNED', { frd: 'frd-a2', artifacts: ['src/lib/e/**'] })] }] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    const sized = sizeLogs(run)
    t.ok(sized.length === 2, `the cap is sized twice: after the plan and after the drained FRD (got ${sized.length})`)
    t.ok(capOf(sized[1] || '') > capOf(sized[0] || ''), `the grown plan raised the cap (${capOf(sized[0] || '')} → ${capOf(sized[1] || '')})`)
    t.ok(/for the FRDs just added/.test(sized[1] || ''), 'the second sizing log names that it covers the added FRDs')
    t.ok(!hasLog(run, /Agent ceiling reached/), 'the drained FRD did not re-introduce an agent stop')
    t.ok(byLabel(run, /^build:wo-a2-/).length === 2, 'the drained FRD\'s WOs were built')
  },
})

SCENARIOS.push({
  name: 'A1-c. explicit-below-is-advisory — an explicit numeric maxAgents below the projection is NEVER overridden and NEVER fails fast; it only gets an advisory log',
  args: { mode: 'powerful', maxAgents: 30 },
  plan: threeWoPlan(),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(hasLog(run, /maxAgents 30 ·/), 'the arg-echo line keeps the explicit 30')
    t.ok(hasLog(run, /AgentBudgetAdvisory: explicit maxAgents 30 is below the projected run cost of ~40 units/), 'the advisory names the explicit value and the projection')
    t.ok(sizeLogs(run).length === 0, 'no auto-sizing happened (the explicit value is not overridden)')
    t.ok(!hasLog(run, /agents-preflight/), 'no preflight stop reason exists')
    t.ok(byLabel(run, /^build:/).length >= 1, 'the run started building (no fail-fast)')
  },
})

SCENARIOS.push({
  name: 'A1-d. explicit-above-is-silent — an explicit maxAgents at/above the projection prints no advisory and no auto log',
  args: { mode: 'powerful', maxAgents: 200 },
  plan: threeWoPlan(),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(!hasLog(run, /AgentBudgetAdvisory: explicit maxAgents/) && sizeLogs(run).length === 0, 'no advisory, no auto sizing')
  },
})

SCENARIOS.push({
  name: 'A1-e. omitted-maxAgents-unchanged — an omitted maxAgents stays unbounded and logs no sizing',
  args: { mode: 'powerful' },
  plan: threeWoPlan(),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(hasLog(run, /maxAgents OFF/), 'still the OFF echo')
    t.ok(sizeLogs(run).length === 0 && !hasLog(run, /AgentBudgetAdvisory: explicit/), 'no sizing, no advisory')
  },
})

// ── (e) un-defer dependency-free non-UI WOs from the foundation wave (DR-123, amends DR-057's deferral) ──
const foundationPlan = (second) => mkPlan([{
  frd: 'frd-f1',
  deps: [],
  workOrders: [
    mkWo('wo-f1-001', 'PLANNED', { frd: 'frd-f1', artifacts: ['src/components/ui/button.tsx'], foundation: true }),
    mkWo('wo-f1-002', 'PLANNED', { frd: 'frd-f1', ...second }),
  ],
}], { hasFrontend: true })
const firstWave = (run) => (run.logs.find((l) => /⚒ wave:/.test(l)) || '')
const deferredLine = (run) => (run.logs.find((l) => /↻ deferred:/.test(l)) || '')

SCENARIOS.push({
  name: 'F-a. lib-only-wo-builds-with-foundation — a dependency-free WO with lib-only artifacts joins the foundation wave',
  args: { mode: 'powerful' },
  plan: foundationPlan({ artifacts: ['src/lib/slug/**'] }),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(/wo-f1-001/.test(firstWave(run)) && /wo-f1-002/.test(firstWave(run)), `the first wave holds the foundation WO AND the lib-only WO (got "${firstWave(run)}")`)
    t.ok(!/blocked:foundation-pending/.test(deferredLine(run)), 'nothing is deferred as foundation-pending')
  },
})
for (const [slug, second, why] of [
  ['wo-touching-package-json-still-deferred', { artifacts: ['package.json', 'src/lib/slug/**'] }, 'package.json'],
  ['wo-touching-lockfile-still-deferred', { artifacts: ['pnpm-lock.yaml'] }, 'a lockfile'],
  ['wo-touching-messages-still-deferred', { artifacts: ['messages/en.json'] }, 'messages/**'],
  ['undeclared-still-deferred', { artifacts: undefined }, 'undeclared artifacts'],
  ['ui-wo-still-deferred', { artifacts: ['src/components/forms/Form.tsx'] }, 'UI artifacts'],
  ['wo-with-deps-still-deferred', { artifacts: ['src/lib/slug/**'], deps: ['wo-f1-001'] }, 'a dependency'],
]) {
  SCENARIOS.push({
    name: `F-b. ${slug} — a WO with ${why} keeps the foundation-first deferral`,
    args: { mode: 'powerful' },
    plan: foundationPlan(second),
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
      t.ok(/wo-f1-001/.test(firstWave(run)) && !/wo-f1-002/.test(firstWave(run)), `the first wave is the foundation WO alone (got "${firstWave(run)}")`)
      t.ok(slug === 'wo-with-deps-still-deferred' || /wo-f1-002\(blocked:foundation-pending\)/.test(deferredLine(run)), `the WO is logged as blocked:foundation-pending (got "${deferredLine(run)}")`)
    },
  })
}

// ── (b) lean tail: skip security-fix on an explicit empty findings array; FAIL-CLOSED otherwise ──
const doneFrdPlan = () => mkPlan([{ frd: 'frd-s1', deps: [], workOrders: [mkWo('wo-s1-001', 'IN_REVIEW', { frd: 'frd-s1', artifacts: ['src/lib/s/**'] })] }])
for (const [slug, audit, expectFix] of [
  ['security-fix-skipped-on-empty-findings', { done: true, findings: [] }, false],
  ['security-fix-runs-on-missing-findings', { done: true }, true],
  ['security-fix-runs-on-null-findings', { done: true, findings: null }, true],
  ['security-fix-runs-on-garbled-findings', { done: true, findings: 'none found' }, true],
  ['security-fix-runs-on-nonempty-findings', { done: true, findings: [{ severity: 'high', summary: 'x' }] }, true],
  ['security-fix-runs-when-audit-not-done', { done: false, findings: [] }, true],
]) {
  SCENARIOS.push({
    name: `S. ${slug}`,
    args: { mode: 'balanced' },
    plan: doneFrdPlan(),
    responses: [{ label: 'hardening:security-audit', response: audit }],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
      t.ok(byLabel(run, 'hardening:security-audit').length === 1, 'the opus audit always runs (DR-085 independent evidence)')
      t.ok(byLabel(run, 'hardening:security-fix').length === (expectFix ? 1 : 0), `security-fix ${expectFix ? 'runs' : 'is skipped'} (got ${byLabel(run, 'hardening:security-fix').length})`)
      t.ok(byLabel(run, 'hardening:telemetry').length === 1, 'telemetry still runs (not skipped, not made N/A by the engine)')
      const aud = byLabel(run, 'hardening:security-audit')[0]
      t.ok(aud && /If \(and ONLY if\) your `findings` array is EMPTY, ALSO append the Hardening event/.test(aud.prompt), 'the audit prompt carries the conditional security Hardening event (the fix spawn is not there to emit it)')
      t.ok(hasLog(run, /security-fix not applicable, skipped/) === !expectFix, 'the skip is logged iff it happened')
      if (!expectFix) t.ok(run.result && run.result.hardened !== false, 'hardening still counts as done with the skipped fix')
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────
let passed = 0
let failed = 0
for (const s of SCENARIOS) {
  const run = await runEngine(s)
  const t = new T(s.name)
  try {
    s.assert(t, run)
  } catch (e) {
    t.failures.push(`assertion block threw: ${e && e.stack ? e.stack.split('\n')[0] : e}`)
  }
  if (run.unmatched.length) t.failures.push(`unmatched agent labels: ${[...new Set(run.unmatched)].join(', ')}`)
  if (t.failures.length === 0) {
    passed++
    console.log(`PASS  ${s.name}  (${t.count} assertions)`)
  } else {
    failed++
    console.log(`FAIL  ${s.name}`)
    for (const f of t.failures) console.log(`      ✗ ${f}`)
    if (run.error) console.log(`      engine error: ${run.error.stack || run.error}`)
  }
}
console.log(`RESULT: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
