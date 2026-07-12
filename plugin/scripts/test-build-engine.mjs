#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// test-build-engine.mjs — offline harness for the SPLIT FRD review gate
// (proposal 31 T1.2) added to
// plugin/templates/shared/.claude/engines/pandacorp-build.js.
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
const ENGINE_PATH = path.resolve(__dirname, '../templates/shared/.claude/engines/pandacorp-build.js')

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
function defaultResponse(label) {
  if (label === 'baseline-precheck') return { escalate: true }
  if (label === 'baseline') return { green: true }                       // VERIFY_SCHEMA
  if (label === 'plan') return { frds: [] }                             // PLAN_SCHEMA (empty → early exit)
  if (label === 'sync-rollups') return { corrected: 0 }
  if (label === 'safe-point') return { stop: false, ready: [], unblocked: [] } // SAFE_POINT_SCHEMA
  if (label === 'foundation-gate') return { complete: true }            // FOUNDATION_SCHEMA
  if (label === 'visual-qa') return { done: true }
  if (label.startsWith('dispatch:')) return {}
  if (label === 'gate-worktree') return { ok: true, created: true }
  if (label.startsWith('pin:')) return { sha: 'pinsha0' }
  if (label.startsWith('apply-gate:')) return { done: true }
  if (label.startsWith('persist-block:')) return { done: true }
  if (label.startsWith('commit:')) return { committed: 1 }
  if (/^(build|test|be|fe|selftest):/.test(label)) return { green: true } // VERIFY_SCHEMA
  if (label.startsWith('find:')) return { findings: [] }                 // FINDER_SCHEMA — nothing found
  if (label.startsWith('verify-finding:')) return { refuted: true, reason: 'default refuted' } // VERIFY_FINDING_SCHEMA
  if (label.startsWith('gate:')) return { green: true }                 // FRD_GATE_SCHEMA
  if (/^(repair|patch|gate-test-repair|verify-patch|revert|foundation-repair):/.test(label)) return { green: true } // REPAIR_SCHEMA
  if (/^(process-change|plan-drained):/.test(label)) return { done: true, affectedFrds: [], frds: [] }
  if (label === 'ensure-stopped') return { done: true, allowed_paths: ['.pandacorp/status.yaml'], lease_released: true }
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
      return typeof r.response === 'function' ? r.response(call) : r.response
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
  const engineArgs = scenario.args && typeof scenario.args === 'object'
    ? { leaseToken: 'test-lease-token', leaseEpoch: 1, ...scenario.args }
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
