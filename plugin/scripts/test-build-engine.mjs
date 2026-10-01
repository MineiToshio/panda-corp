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
// Focus: ONLY_SCENARIO=<name prefix> runs the matching scenarios only; SHOW_CALLS=1 prints each run's spawn labels in order.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sealLine } from './drift-seal.mjs'

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
// proposal 39 C1 (mechScript): a MECH op answers with its sealed line; the classic shape keeps reading the other keys.
const mechLine = (op, body = {}) => sealLine({ version: 1, op, ok: true, ...body })
const FAST_BUILT_IDS = (prompt) => [...String(prompt).matchAll(/### WORK ORDER (\S+)/g)].map((m) => m[1])
const commitLine = (wo, sha = 'c0ffee000000') => mechLine('commit-wo', { status: 'committed', wo, sha })
const parkLine = (wo) => mechLine('park-wo', { status: 'parked', wo, parked: [] })
function defaultResponse(label, call = {}) {
  if (label === 'mech-plan') return null   // a fast-lane scenario gets its plan line from runEngine (scenario.plan)
  if (/^fast-(build|retry):/.test(label)) return { wos: FAST_BUILT_IDS(call.prompt).map((id) => ({ id, line: commitLine(id) })) }
  if (label.startsWith('verify:')) return { line: mechLine('verify', { status: 'green', frd: label.slice(7), green: true, usable: true, floor: false, sha: 'feed00000001', scope: 'full' }) }
  if (label.startsWith('fix:')) return { done: true }
  if (/^hardening:security-(audit-early|delta)$/.test(label)) return { done: true, findings: [] }
  if (label.startsWith('block-usable:')) return { green: false, blocked_reason: 'needs-owner' }
  if (label.startsWith('stale-pin:')) return { count: 0 }   // D1 stale-pin guard: main gained no code commit since the gate's pin
  if (label === 'safe-point-probe') return { line: mechLine('safe-point', { status: 'quiet', stop: false, stop_receipt: { status_exists: true, stop: false, method: 'node-lstat' }, rethink_pending: false, renewed: true, ready: [], unreadable: [], blockedNeedsOwner: [], answeredDecisions: 0, work: false }) }
  if (label === 'mech-precheck') return { line: mechLine('precheck', { status: 'ok', onMain: true, reverts: [], refused: [], salvaged: [], demoted: [], keptInReview: [] }) }
  if (label.startsWith('park:')) return { line: mechLine('park-wo', { status: 'parked', parked: [] }) }
  if (label.startsWith('infra-pause:')) return { done: true }
  if (label === 'build-paused') return { done: true }
  if (label === 'baseline-precheck') return { escalate: true }
  if (label === 'baseline') return { green: true }                       // VERIFY_SCHEMA
  if (label === 'plan') return { frds: [] }                             // PLAN_SCHEMA (empty → early exit)
  if (label === 'sync-rollups') return { corrected: 0 }
  if (label === 'safe-point') return { stop: false, stop_receipt: { status_exists: true, stop: false, method: 'node-lstat' }, ready: [], unblocked: [] } // SAFE_POINT_SCHEMA
  if (label === 'foundation-gate') return { complete: true }            // FOUNDATION_SCHEMA
  if (label === 'visual-qa') return { done: true }
  if (label.startsWith('dispatch:')) return { line: mechLine('dispatch', { status: 'stamped', stamped: [], committed: 'd15pa7c', base: 'd15pa7cbase0' }) }
  if (label.startsWith('floor:')) return { line: mechLine('classify-frd', { status: 'classified', frds: [...String(call.prompt).matchAll(/--frd '([^']+)'/g)].map((m) => ({ frd: m[1], floor: false })) }) }
  if (/^gate-worktree(:\d+)?$/.test(label)) return { ok: true, created: true, line: mechLine('gate-prepare', { created: true, sha: 'pinsha0' }) }   // D1: bare (serial) or pooled 'gate-worktree:<slot>' (parallelGates, now the v9.116.0 default)
  if (label.startsWith('pin:')) return { sha: 'pinsha0' }
  if (label.startsWith('apply-gate:')) return { done: true }
  if (label.startsWith('persist-block:')) return { done: true }
  if (label.startsWith('gate-release:')) return { salvaged: [], remaining: [], line: mechLine('gate-release', { salvaged: [], remaining: [] }) }   // BL-0182: the C2 gate-worktree release (salvage + exact clean) — a clean tree, nothing left behind
  if (label.startsWith('commit:')) return { committed: 1, line: mechLine('commit-wo', { status: 'committed', sha: 'c0ffee000000' }) }
  if (/^(build|test|be|fe|selftest):/.test(label)) return { green: true } // VERIFY_SCHEMA
  if (label.startsWith('find:')) return { findings: [] }                 // FINDER_SCHEMA — nothing found
  if (label.startsWith('verify-finding:')) return { refuted: true, reason: 'default refuted' } // VERIFY_FINDING_SCHEMA
  if (label.startsWith('gate:')) return { green: true, traceability: validTraceability } // FRD_GATE_SCHEMA
  if (/^(repair|patch|gate-test-repair|verify-patch|revert|foundation-repair):/.test(label)) return { green: true } // REPAIR_SCHEMA
  if (/^(process-change|plan-drained):/.test(label)) return { done: true, affectedFrds: [], frds: [] }
  if (label === 'ensure-stopped') return { done: true, allowed_paths: ['.pandacorp/status.yaml'], lease_released: true }
  if (label === 'close-out-verify-reuse-check') return { canReuse: false, reason: 'no-report', line: mechLine('reuse-check', { canReuse: false, reason: 'no-report' }) } // BL-0147: safe default — the full rerun happens exactly as pre-BL-0147 unless a scenario scripts a fresh full-green report
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
  if (scenario.plan && scenario.args && scenario.args.lane === 'fast' && !scenario.noPlanLine) responses.push({ label: 'mech-plan', response: { line: mechLine('plan', { status: 'planned', unsatisfiedDeps: [], ...scenario.plan }) } })

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
      const answer = await (typeof r.response === 'function' ? r.response(call) : r.response)
      return call.label.startsWith('gate:') && answer && typeof answer === 'object' && !answer.__splitFailed && !('traceability' in answer) ? { ...answer, traceability: validTraceability } : answer
    }
    const def = defaultResponse(call.label, call)
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
// 9.118.1 hotfix: a haiku pre-check returns sentinel STRINGS for absent optional fields (bench-medium C-1)
// ─────────────────────────────────────────────────────────────────────────────
const leasedStatusPrecheck = (extra) => ({ stop: false, green: false, escalate: true, dirty: true, dirtyPaths: ['.pandacorp/status.yaml'], leaseValid: true, projectPrefix: '', ...extra })
const preLoopSafePoint = { label: 'safe-point-pre-loop', response: { stop: false, stop_receipt: { status_exists: true, stop: false, method: 'node-lstat' }, ready: [], unblocked: [] } }
const takesFastPath = (t, run) => {
  t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
  t.ok(hasLog(run, /fast path BL-0124/), 'the BL-0124 fast path was taken')
  t.ok(byLabel(run, /^baseline$/).length === 0, 'NO judge baseline spawned')
  t.ok(byLabel(run, /^plan$/).length === 1, 'the build proceeded to planning')
  t.ok(!(run.result && run.result.note === 'baseline red (needs manual fix)'), 'the run did not stop baseline red')
}
SCENARIOS.push({
  name: '9.118.1-a. the exact bench-medium C-1 pre-check (failure:"null", projectPrefix:\'""\') takes the BL-0124 fast path',
  args: { mode: 'powerful' },
  responses: [preLoopSafePoint, { label: 'baseline-precheck', response: leasedStatusPrecheck({ projectPrefix: '""', failure: 'null' }) }],
  assert: takesFastPath,
})
for (const sentinel of ['undefined', '', 'none', ' None ', 'NULL']) {
  SCENARIOS.push({
    name: `9.118.1-b. sentinel failure ${JSON.stringify(sentinel)} is no failure: the BL-0124 fast path is taken`,
    args: { mode: 'powerful' },
    responses: [preLoopSafePoint, { label: 'baseline-precheck', response: leasedStatusPrecheck({ failure: sentinel }) }],
    assert: takesFastPath,
  })
}
SCENARIOS.push({
  name: '9.118.1-c. a real BL-0022 failure still stops the run baseline red',
  args: { mode: 'powerful' },
  responses: [{ label: 'baseline-precheck', response: { green: false, failure: 'BL-0022: deterministic project/lease inspection failed' } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, /^baseline$/).length === 0, 'NO judge baseline spawned (the pre-check failure is carried)')
    t.ok(hasLog(run, /Baseline red and auto-repair failed: BL-0022/), 'the BL-0022 failure is logged')
    t.ok(run.result && run.result.note === 'baseline red (needs manual fix)', 'the run stopped baseline red')
  },
})
SCENARIOS.push({
  name: '9.118.1-d. a quoted-empty projectPrefix \'""\' is no prefix: a flat status.yaml path still matches',
  args: { mode: 'powerful' },
  responses: [preLoopSafePoint, { label: 'baseline-precheck', response: leasedStatusPrecheck({ projectPrefix: '""', dirtyPaths: ['.pandacorp/status.yaml'], outsideDirtyPaths: [] }) }],
  assert: takesFastPath,
})

// ─────────────────────────────────────────────────────────────────────────────
// 9.118.2 hotfix (bench-medium C-1, plugin 9.118.1): a MECH result wrapped in one string field, and the
// greenfield baseline deadlock
// ─────────────────────────────────────────────────────────────────────────────
// The exact C-1 shape: the real pre-check object JSON-encoded inside a single `parameter` string.
const wrappedPrecheck = (key) => ({ [key]: '{\n  "escalate": true, "dirty": true, "dirtyPaths": [".pandacorp/status.yaml"], "outsideDirtyPaths": [], "leaseValid": true, "projectPrefix": "", "stop": false, "green": false\n}' })
for (const key of ['parameter', 'input', 'result', 'output', 'json']) {
  SCENARIOS.push({
    name: `9.118.2-a. precheck-wrapped-in-${key}-is-unwrapped: the BL-0124 fast path is taken, no judge baseline`,
    args: { mode: 'powerful' },
    responses: [preLoopSafePoint, { label: 'baseline-precheck', response: wrappedPrecheck(key) }],
    assert: takesFastPath,
  })
}
SCENARIOS.push({
  name: '9.118.2-a2. a wrapped string that is not a JSON object is left as it is (no fast path, judge baseline)',
  args: { mode: 'powerful' },
  responses: [preLoopSafePoint, { label: 'baseline-precheck', response: { parameter: 'escalate: true' } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, /^baseline$/).length === 1, 'the judge baseline ran (nothing usable to unwrap)')
  },
})
// The greenfield probe line, sealed exactly as greenfield-probe.mjs prints it.
const greenfieldLine = (facts) => sealLine({ ok: true, probe: 'greenfield', ...facts })
const redTreePrecheck = (probe) => ({ escalate: true, dirty: true, dirtyPaths: ['.pandacorp/status.yaml', 'package.json'], outsideDirtyPaths: [], leaseValid: true, projectPrefix: '', greenfieldProbe: probe })
const proceedsWithJudgeBaseline = (t, run) => {
  t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
  t.ok(byLabel(run, /^baseline$/).length === 1, 'the judge baseline ran (behavior unchanged)')
  t.ok(!hasLog(run, /greenfield/i), 'no greenfield log')
}
SCENARIOS.push({
  name: '9.118.2-b. greenfield-skips-baseline: last_green empty + every WO PLANNED/DRAFT + red tree → plan, no judge baseline',
  args: { mode: 'powerful' },
  responses: [preLoopSafePoint, { label: 'baseline-precheck', response: redTreePrecheck(greenfieldLine({ lastGreenSha: '', workOrders: 10, byStatus: { PLANNED: 9, DRAFT: 1 }, missing: 0 })) }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, /^baseline$/).length === 0, 'NO judge baseline spawned')
    t.ok(hasLog(run, /greenfield/i), 'the greenfield decision is logged')
    const plan = byLabel(run, /^plan$/)
    t.ok(plan.length === 1, 'the build proceeded to planning')
    t.ok(plan[0] && /"event":"baseline_greenfield"/.test(plan[0].prompt) && /"kind":"baseline_greenfield"/.test(plan[0].prompt), 'the planner emits the baseline_greenfield dashboard + track event')
    t.ok(!(run.result && run.result.note === 'baseline red (needs manual fix)'), 'the run did not stop baseline red')
  },
})
SCENARIOS.push({
  name: '9.118.2-b2. the greenfield probe arrives wrapped in `parameter` together with the whole pre-check: still greenfield',
  args: { mode: 'powerful' },
  responses: [preLoopSafePoint, { label: 'baseline-precheck', response: { parameter: JSON.stringify(redTreePrecheck(greenfieldLine({ lastGreenSha: '', workOrders: 3, byStatus: { PLANNED: 3 }, missing: 0 }))) } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, /^baseline$/).length === 0, 'NO judge baseline spawned')
    t.ok(byLabel(run, /^plan$/).length === 1, 'the build proceeded to planning')
  },
})
for (const [slug, byStatus] of [['in-progress', { PLANNED: 9, IN_PROGRESS: 1 }], ['in-review', { PLANNED: 9, IN_REVIEW: 1 }], ['verified', { PLANNED: 9, VERIFIED: 1 }], ['blocked', { PLANNED: 9, BLOCKED: 1 }]]) {
  SCENARIOS.push({
    name: `9.118.2-c. not-greenfield-when-any-wo-built (${slug}): the judge baseline runs, unchanged`,
    args: { mode: 'powerful' },
    responses: [preLoopSafePoint, { label: 'baseline-precheck', response: redTreePrecheck(greenfieldLine({ lastGreenSha: '', workOrders: 10, byStatus, missing: 0 })) }],
    assert: proceedsWithJudgeBaseline,
  })
}
SCENARIOS.push({
  name: '9.118.2-d. not-greenfield-when-last-green-set: the judge baseline runs, unchanged',
  args: { mode: 'powerful' },
  responses: [preLoopSafePoint, { label: 'baseline-precheck', response: redTreePrecheck(greenfieldLine({ lastGreenSha: 'abc1234', workOrders: 10, byStatus: { PLANNED: 10 }, missing: 0 })) }],
  assert: proceedsWithJudgeBaseline,
})
for (const [slug, probe] of [
  ['a WO without implementation_status', greenfieldLine({ lastGreenSha: '', workOrders: 10, byStatus: { PLANNED: 9 }, missing: 1 })],
  ['no work orders at all', greenfieldLine({ lastGreenSha: '', workOrders: 0, byStatus: {}, missing: 0 })],
  ['a broken seal', greenfieldLine({ lastGreenSha: '', workOrders: 10, byStatus: { PLANNED: 10 }, missing: 0 }).replace('"workOrders":10', '"workOrders":11')],
  ['an unsealed line', JSON.stringify({ ok: true, probe: 'greenfield', lastGreenSha: '', workOrders: 10, byStatus: { PLANNED: 10 }, missing: 0 })],
  ['a probe refusal', sealLine({ ok: false, probe: 'greenfield', error: 'status.yaml not found' })],
]) {
  SCENARIOS.push({
    name: `9.118.2-e. not-greenfield on ${slug}: fail-safe to the judge baseline`,
    args: { mode: 'powerful' },
    responses: [preLoopSafePoint, { label: 'baseline-precheck', response: redTreePrecheck(probe) }],
    assert: proceedsWithJudgeBaseline,
  })
}
SCENARIOS.push({
  name: '9.118.2-f. args.strictBaseline keeps the judge baseline even on a greenfield project',
  args: { mode: 'powerful', strictBaseline: true },
  responses: [preLoopSafePoint, { label: 'baseline-precheck', response: redTreePrecheck(greenfieldLine({ lastGreenSha: '', workOrders: 10, byStatus: { PLANNED: 10 }, missing: 0 })) }],
  assert: proceedsWithJudgeBaseline,
})
SCENARIOS.push({
  name: '9.118.2-g. the pre-check prompt runs the greenfield probe from the installed scripts dir',
  args: { mode: 'powerful' },
  responses: [preLoopSafePoint],
  assert(t, run) {
    const pre = byLabel(run, 'baseline-precheck')[0]
    t.ok(pre && /greenfield-probe\.mjs'/.test(pre.prompt) && /installed plugin\/scripts\/greenfield-probe\.mjs/.test(pre.prompt), 'the probe command is named from the stateCli dir')
    t.ok(pre && /greenfieldProbe/.test(pre.prompt), 'the pre-check is asked to return greenfieldProbe')
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// Proposal 39 stage 2 — engine safety: the `infra` failure class (C7), stamp-anchored resume, mechScript (C1)
// ─────────────────────────────────────────────────────────────────────────────
const MECH_SCRIPT_RE = /pandacorp-build-mech\.mjs' (\S+) --project/
const literalOp = (call) => (MECH_SCRIPT_RE.exec(call.prompt) || [])[1] || null
const isLiteral = (call) => Boolean(literalOp(call)) && /return its last line/i.test(call.prompt)
const indexOf = (run, re) => run.calls.findIndex((c) => re.test(c.label))
const SAFETY = { mechScript: true, infraGuard: true }   // stage 2's contracts, reachable alone in the classic wave lane
const infraPlan = (frd, ids, status = 'PLANNED') => mkPlan([{ frd, deps: [], workOrders: ids.map((id, i) => mkWo(id, status, { frd, artifacts: [`src/${frd}/${i}/**`] })) }])
const throwing = (message) => () => { throw new Error(message) }
const noRepairPath = (t, run) => {
  t.ok(byLabel(run, /^(repair|patch|diagnose|revert|foundation-repair):/).length === 0, `no repair/patch/diagnose/revert spawn (got ${byLabel(run, /^(repair|patch|diagnose|revert|foundation-repair):/).map((c) => c.label).join(', ') || 'none'})`)
  t.ok(byLabel(run, /^wo-revert/).length === 0, 'no wo-revert spawn')
  t.ok(run.result && Array.isArray(run.result.blockedFrds) && run.result.blockedFrds.length === 0, `nothing is BLOCKED (got ${run.result && JSON.stringify(run.result.blockedFrds)})`)
}

SCENARIOS.push({
  name: 'P39-a. infra-throw-is-not-a-repair — a builder whose agent() throws is infra: one pause + one retry, never attemptRepair, never BLOCKED, never wo-revert',
  args: { mode: 'balanced', ...SAFETY },
  plan: infraPlan('frd-i1', ['wo-i1-001', 'wo-i1-002']),
  responses: [{ label: 'build:wo-i1-001', times: 1, response: throwing('socket hang up') }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, 'build:wo-i1-001').length === 2, `the builder is retried exactly once (got ${byLabel(run, 'build:wo-i1-001').length} spawns)`)
    const pause = indexOf(run, /^infra-pause:build:wo-i1-001$/)
    t.ok(pause >= 0 && pause < run.calls.map((c) => c.label).lastIndexOf('build:wo-i1-001'), 'an infra pause runs BEFORE the retry')
    t.ok(pause >= 0 && /sleep 60/.test(run.calls[pause].prompt), 'the pause is a literal `sleep 60` op (the Workflow runtime has no sleep)')
    noRepairPath(t, run)
    t.ok(hasLog(run, /infra/i) && hasLog(run, /not a work-order failure/i), 'the infra class is logged as not a WO failure')
    t.ok(run.result && run.result.stopReason !== 'paused-infra' && run.result.builtFrds.includes('frd-i1'), 'a single recovered infra failure does not stop the run: the FRD verifies')
  },
})

SCENARIOS.push({
  name: 'P39-a2. infra-null-twice-halts — a builder that returns no output twice (infra, then infra again) halts the run instead of repairing it',
  args: { mode: 'balanced', ...SAFETY },
  plan: infraPlan('frd-i2', ['wo-i2-001']),
  responses: [{ label: 'build:wo-i2-001', response: null }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, 'build:wo-i2-001').length === 2 && byLabel(run, /^infra-pause:/).length === 1, 'one pause, one retry, then the second infra halts')
    noRepairPath(t, run)
    t.ok(run.result && run.result.stopReason === 'paused-infra', `stopReason is paused-infra (got ${run.result && run.result.stopReason})`)
    t.ok(byLabel(run, 'park:wo-i2-001').length === 1 && isLiteral(byLabel(run, 'park:wo-i2-001')[0]) && literalOp(byLabel(run, 'park:wo-i2-001')[0]) === 'park-wo', 'the unlanded WO is parked through the literal park-wo op')
  },
})

SCENARIOS.push({
  name: 'P39-b. infra-429-halts-cleanly — a 429/usage-limit signature halts at once: no pause, no new dispatch, a build_paused event (dashboard + track.jsonl), stopReason paused-infra + a resume hint, no close-out',
  args: { mode: 'pro', ...SAFETY },
  plan: infraPlan('frd-q', ['wo-q-001', 'wo-q-002', 'wo-q-003']),
  responses: [{ label: 'build:wo-q-001', response: throwing('API Error: 429 {"type":"error","error":{"type":"rate_limit_error","message":"usage limit reached"}}') }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, 'build:wo-q-001').length === 1 && byLabel(run, /^infra-pause:/).length === 0, 'a limit signature is never retried and never paused-and-retried')
    t.ok(byLabel(run, 'build:wo-q-003').length === 0, 'no new dispatch after the halt (wo-q-003 never builds)')
    t.ok(byLabel(run, /^dispatch:/).length === 1, 'exactly one wave was dispatched')
    noRepairPath(t, run)
    t.ok(byLabel(run, /^gate[:-]/).length === 0 || byLabel(run, /^gate:/).length === 0, 'no FRD gate is launched after the halt')
    t.ok(byLabel(run, /^(notify-end|close-out|close-needs-hardening|hardening:|visual-qa|ensure-stopped)/).length === 0, `no close-out/hardening spawn (got ${byLabel(run, /^(notify-end|close-out|close-needs-hardening|hardening:|visual-qa|ensure-stopped)/).map((c) => c.label).join(', ') || 'none'})`)
    const paused = byLabel(run, 'build-paused')
    t.ok(paused.length === 1, `exactly one build-paused spawn (got ${paused.length})`)
    t.ok(paused[0] && /"event":"build_paused"/.test(paused[0].prompt) && /dashboard-events\.ndjson/.test(paused[0].prompt), 'the build_paused dashboard event is in its prompt')
    t.ok(paused[0] && /"kind":"build_paused"/.test(paused[0].prompt) && /track\.jsonl/.test(paused[0].prompt), 'the build_paused track.jsonl line is in its prompt')
    t.ok(paused[0] && /finalize-release/.test(paused[0].prompt), 'the paused close releases the lease (running:false)')
    t.ok(run.result && run.result.stopReason === 'paused-infra', `stopReason is paused-infra (got ${run.result && run.result.stopReason})`)
    t.ok(run.result && typeof run.result.resumeHint === 'string' && /resume|relaunch/i.test(run.result.resumeHint), `the result carries a resume hint (got ${run.result && run.result.resumeHint})`)
    t.ok(run.result && run.result.paused && run.result.paused.kind === 'limit' && run.result.paused.label === 'build:wo-q-001', `the result names the limit and the call that hit it (got ${run.result && JSON.stringify(run.result.paused)})`)
    t.ok(hasLog(run, /paused-infra|build paused/i), 'the halt is logged')
  },
})

SCENARIOS.push({
  name: 'P39-b2. infra-limit-before-the-loop — a limit at the baseline pre-check pauses the run (no pre-loop failure, no ensure-stopped crash path)',
  args: { mode: 'balanced', ...SAFETY },
  plan: infraPlan('frd-p', ['wo-p-001']),
  responses: [{ label: 'baseline-precheck', response: throwing('Overloaded') }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(run.result && run.result.stopReason === 'paused-infra' && byLabel(run, 'build-paused').length === 1, 'paused-infra with its paused close')
    t.ok(byLabel(run, /^(build|dispatch):/).length === 0 && byLabel(run, 'ensure-stopped').length === 0, 'nothing built, and the pre-loop failure path never ran')
  },
})

SCENARIOS.push({
  name: 'P39-b3. infra-limit-in-the-close-out — a limit during hardening pauses the run instead of closing it',
  args: { mode: 'balanced', ...SAFETY },
  plan: infraPlan('frd-h', ['wo-h-001']),
  responses: [{ label: 'hardening:security-audit', response: throwing('API Error: 429 Too Many Requests') }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(run.result && run.result.stopReason === 'paused-infra' && byLabel(run, 'build-paused').length === 1, 'paused-infra with its paused close')
    t.ok(byLabel(run, /^(hardening:security-fix|hardening:telemetry|close-out|notify-end|ensure-stopped)$/).length === 0, 'no further close-out spawn after the limit')
    t.ok(run.result.builtFrds.includes('frd-h'), 'the FRD verified before the limit stays verified')
  },
})

SCENARIOS.push({
  name: 'P39-c. infra-in-flight-results-accepted — after a halt, in-flight builders land: a green one is committed, a failed one and the infra one are parked (never repaired), an in-flight gate is never landed',
  args: { mode: 'balanced', ...SAFETY },
  plan: mkPlan([
    { frd: 'frd-g', deps: [], workOrders: [mkWo('wo-g-001', 'IN_REVIEW', { frd: 'frd-g', artifacts: ['src/g/**'] })] },
    { frd: 'frd-c', deps: [], workOrders: [
      mkWo('wo-c-001', 'PLANNED', { frd: 'frd-c', artifacts: ['src/c/1/**'] }),
      mkWo('wo-c-002', 'PLANNED', { frd: 'frd-c', artifacts: ['src/c/2/**'] }),
      mkWo('wo-c-003', 'PLANNED', { frd: 'frd-c', artifacts: ['src/c/3/**'] }),
    ] },
  ]),
  responses: [
    { label: 'build:wo-c-001', response: throwing('Claude AI usage limit reached|1759363200') },
    { label: 'build:wo-c-003', response: { green: false, failure: 'self-test red' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, 'commit:wo-c-002').length === 1, 'the in-flight green builder is accepted: its commit runs after the halt')
    t.ok(byLabel(run, 'park:wo-c-001').length === 1 && byLabel(run, 'park:wo-c-003').length === 1 && byLabel(run, 'park:wo-c-002').length === 0, `the infra WO and the failed WO are parked, the committed one is not (got ${byLabel(run, /^park:/).map((c) => c.label).join(', ')})`)
    noRepairPath(t, run)
    t.ok(byLabel(run, /^apply-gate:/).length === 0 && !(run.result.builtFrds || []).includes('frd-g'), 'an in-flight gate verdict is never landed after the halt (it re-gates on resume)')
    t.ok(run.result && run.result.stopReason === 'paused-infra', `stopReason is paused-infra (got ${run.result && run.result.stopReason})`)
    t.ok(run.result && run.result.paused && JSON.stringify([...run.result.paused.parked].sort()) === JSON.stringify(['wo-c-001', 'wo-c-003']), `the result lists the parked WOs (got ${run.result && run.result.paused && JSON.stringify(run.result.paused.parked)})`)
  },
})

// The answer-text limit check reads only the provider's own envelopes: product prose about quotas is a verdict, not infra.
SCENARIOS.push({
  name: 'P39-i. infra-guard-ignores-product-prose — a builder verdict that talks about a product\'s usage limit is a work-order failure (repaired), never paused-infra',
  args: { mode: 'balanced', ...SAFETY },
  plan: infraPlan('frd-qp', ['wo-qp-001']),
  responses: [
    { label: 'build:wo-qp-001', times: 1, response: { green: false, failure: 'AC-03: the usage limit exceeded banner is missing; the "usage limit reached" toast and the "your limit will reset at midnight" copy are absent' } },
    { label: 'wo-revert-plan:frd-qp', response: { output: sealLine({ ok: true, version: 1, frd: 'frd-qp', mode: 'plan', status: 'nothing', changed: false, wos: [], files: [] }) } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(run.result && run.result.stopReason !== 'paused-infra' && byLabel(run, 'build-paused').length === 0, `not paused-infra (got ${run.result && run.result.stopReason})`)
    t.ok(byLabel(run, 'repair:frd-qp').length === 1, 'the failed verdict goes to the bounded repair')
    t.ok(!hasLog(run, /INFRA HALT/), 'no infra halt is logged')
  },
})
SCENARIOS.push({
  name: 'P39-i2. infra-guard-reads-provider-envelopes — a verdict carrying the provider\'s own limit envelope still halts',
  args: { mode: 'balanced', ...SAFETY },
  plan: infraPlan('frd-qe', ['wo-qe-001']),
  responses: [{ label: 'build:wo-qe-001', response: { green: false, failure: 'API Error: 529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}' } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(run.result && run.result.stopReason === 'paused-infra' && byLabel(run, 'build-paused').length === 1, `paused-infra (got ${run.result && run.result.stopReason})`)
    noRepairPath(t, run)
  },
})
SCENARIOS.push({
  name: 'P39-i3. infra-guard-bare-limit-reply-halts — a bare-text answer that IS the runtime\'s limit reply halts the run',
  args: { mode: 'balanced', ...SAFETY },
  plan: infraPlan('frd-qb', ['wo-qb-001']),
  responses: [{ label: 'build:wo-qb-001', response: "You've hit your limit · resets 3pm (Europe/Madrid)" }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(run.result && run.result.stopReason === 'paused-infra', `paused-infra (got ${run.result && run.result.stopReason})`)
    noRepairPath(t, run)
  },
})
SCENARIOS.push({
  name: 'P39-i4. infra-guard-epoch-limit-reply-halts — the runtime\'s "Claude AI usage limit reached|<epoch>" reply halts the run',
  args: { mode: 'balanced', ...SAFETY },
  plan: infraPlan('frd-qc', ['wo-qc-001']),
  responses: [{ label: 'build:wo-qc-001', response: 'Claude AI usage limit reached|1759363200' }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(run.result && run.result.stopReason === 'paused-infra', `paused-infra (got ${run.result && run.result.stopReason})`)
    noRepairPath(t, run)
  },
})

// C1: under mechScript the safe point is the scripted probe first; the LLM drain (judgment) runs only when it finds work.
const probeLine = (body) => ({ line: mechLine('safe-point', { status: 'quiet', stop: false, stop_receipt: { status_exists: true, stop: false, method: 'node-lstat' }, rethink_pending: false, renewed: true, ready: [], unreadable: [], blockedNeedsOwner: [], answeredDecisions: 0, work: false, ...body }) })
SCENARIOS.push({
  name: 'P39-j. safe-point-probe-quiet — under mechScript the literal, fenced safe-point probe runs and a quiet probe spawns no LLM safe point',
  args: { mode: 'balanced', ...SAFETY },
  plan: infraPlan('frd-sp', ['wo-sp-001']),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    const probes = byLabel(run, 'safe-point-probe')
    t.ok(probes.length >= 1 && probes.every((c) => isLiteral(c) && literalOp(c) === 'safe-point' && /--token 'test-lease-token' --epoch '1'/.test(c.prompt) && !/--targeted/.test(c.prompt)), `every safe point is the literal fenced probe (got ${probes.map((c) => literalOp(c)).join(', ') || 'no probe'})`)
    t.ok(byLabel(run, 'safe-point').length === 0, `a quiet probe spawns no LLM safe point (got ${byLabel(run, 'safe-point').length})`)
    t.ok(run.result && run.result.builtFrds.includes('frd-sp'), 'the FRD verifies')
  },
})
SCENARIOS.push({
  name: 'P39-j2. safe-point-probe-work — a probe that finds work (a ready change, an answered decision) spawns the LLM drain right after it',
  args: { mode: 'balanced', ...SAFETY },
  plan: infraPlan('frd-sw', ['wo-sw-001']),
  responses: [{ label: 'safe-point-probe', times: 1, response: probeLine({ status: 'work', work: true, ready: ['change-a'] }) }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    const probe = indexOf(run, /^safe-point-probe$/)
    const sp = indexOf(run, /^safe-point$/)
    t.ok(probe >= 0 && sp === probe + 1, `the LLM safe point follows the probe that found work (probe ${probe}, safe-point ${sp})`)
    t.ok(byLabel(run, 'safe-point').length === 1, 'only that boundary runs the LLM drain')
    t.ok(hasLog(run, /probe.*work/i), 'the probe verdict is logged')
  },
})
SCENARIOS.push({
  name: 'P39-j3. safe-point-probe-stop — a probe stop (owner stop file, rethink, a failed lease renewal) stops the run with no LLM safe point',
  args: { mode: 'balanced', ...SAFETY },
  plan: infraPlan('frd-ss', ['wo-ss-001']),
  responses: [{ label: 'safe-point-probe', response: probeLine({ status: 'stop', stop: true, stop_receipt: { status_exists: true, stop: true, method: 'node-lstat' } }) }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(run.result && run.result.stopReason === 'rethink', `stopReason rethink (got ${run.result && run.result.stopReason})`)
    t.ok(byLabel(run, 'safe-point').length === 0 && byLabel(run, /^build:/).length === 0, 'no LLM safe point, nothing built')
  },
})
SCENARIOS.push({
  name: 'P39-j4. safe-point-probe-unverifiable — a probe line that fails its seal falls back to the full LLM safe point (fail-safe)',
  args: { mode: 'balanced', ...SAFETY },
  plan: infraPlan('frd-su', ['wo-su-001']),
  responses: [{ label: 'safe-point-probe', times: 1, response: { line: probeLine({}).line.replace('"quiet"', '"QUIET"') } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(indexOf(run, /^safe-point$/) === indexOf(run, /^safe-point-probe$/) + 1, 'the full safe point runs right after the unverifiable probe')
    t.ok(hasLog(run, /probe.*(seal|unverifiable)/i), 'the fallback is logged')
    t.ok(run.result && run.result.builtFrds.includes('frd-su'), 'the FRD verifies')
  },
})
SCENARIOS.push({
  name: 'P39-j5. safe-point-probe-targeted — a targeted run passes --targeted (the probe lists no ready change); the classic lane never probes',
  args: { mode: 'balanced', ...SAFETY, frds: ['frd-st'], safePointEveryWave: true },
  plan: infraPlan('frd-st', ['wo-st-001']),
  next: () => ({ args: { mode: 'balanced' }, plan: infraPlan('frd-sc', ['wo-sc-001']) }),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    const probes = byLabel(run, 'safe-point-probe')
    t.ok(probes.length >= 1 && probes.every((c) => /--targeted/.test(c.prompt)), 'the targeted probe carries --targeted')
    t.ok(run.next && byLabel(run.next, 'safe-point-probe').length === 0 && byLabel(run.next, 'safe-point').length >= 1, 'classic (no mechScript): the LLM safe point exactly as before, no probe')
  },
})

const precheckLine = (body) => ({ line: mechLine('precheck', { status: 'ok', onMain: true, reverts: [], refused: [], salvaged: [], demoted: [], keptInReview: [], ...body }) })
SCENARIOS.push({
  name: 'P39-d. resume-demotes-unstamped-in-review — the mech precheck runs (literally) before the planner reads anything; a demoted WO is logged and rebuilt',
  args: { mode: 'balanced', ...SAFETY },
  plan: infraPlan('frd-r', ['wo-r-001']),
  responses: [{ label: 'mech-precheck', response: precheckLine({ demoted: [{ wo: 'wo-r-001', rel: 'docs/frds/frd-r/work-orders/wo-r-001.md', from: 'IN_REVIEW', to: 'PLANNED', why: 'no-flip-after-stamp', applied: true, committed: true }], demotionCommit: 'abc123456789' }) }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    const pre = indexOf(run, /^mech-precheck$/)
    t.ok(pre >= 0 && pre < indexOf(run, /^plan$/), 'the mech precheck runs before the planner')
    t.ok(pre >= 0 && isLiteral(run.calls[pre]) && literalOp(run.calls[pre]) === 'precheck', 'the precheck prompt is the literal precheck op')
    t.ok(hasLog(run, /wo-r-001/) && hasLog(run, /demot/i), 'the demotion is logged with the WO id')
    t.ok(byLabel(run, 'build:wo-r-001').length === 1, 'the demoted WO is rebuilt')
  },
})

SCENARIOS.push({
  name: 'P39-e. resume-keeps-committed-in-review — a WO the precheck keeps IN_REVIEW is never rebuilt: it goes straight to its gate',
  args: { mode: 'balanced', ...SAFETY },
  plan: infraPlan('frd-k', ['wo-k-001'], 'IN_REVIEW'),
  responses: [{ label: 'mech-precheck', response: precheckLine({ keptInReview: ['wo-k-001'] }) }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, /^build:/).length === 0, 'no builder spawns (the committed IN_REVIEW is kept)')
    t.ok(byLabel(run, /^gate:frd-k$/).length === 1 && run.result.builtFrds.includes('frd-k'), 'the FRD is gated and verifies')
  },
})

SCENARIOS.push({
  name: 'P39-e2. resume-precheck-unverifiable-stops — a precheck line that fails its seal stops the run before planning (fail-closed)',
  args: { mode: 'balanced', ...SAFETY },
  plan: infraPlan('frd-u', ['wo-u-001']),
  responses: [{ label: 'mech-precheck', response: { line: mechLine('precheck', { status: 'ok' }).replace('"ok"', '"OK"') } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(indexOf(run, /^plan$/) < 0 && byLabel(run, /^build:/).length === 0, 'nothing is planned or built')
    t.ok(byLabel(run, 'ensure-stopped').length === 1, 'the run closes through ensure-stopped')
    t.ok(run.result && /precheck/i.test(run.result.note || ''), `the result names the precheck (got ${run.result && run.result.note})`)
  },
})

SCENARIOS.push({
  name: 'P39-f. mechscript-prompts-are-literal — under mechScript every scripted MECH op is "run exactly <cmd>, return its last line"',
  args: { mode: 'balanced', ...SAFETY },
  plan: infraPlan('frd-m', ['wo-m-001']),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    for (const [re, op] of [[/^mech-precheck$/, 'precheck'], [/^dispatch:/, 'dispatch'], [/^commit:wo-m-001$/, 'commit-wo'], [/^gate-worktree$/, 'gate-prepare'], [/^gate-release:frd-m$/, 'gate-release'], [/^close-out-verify-reuse-check$/, 'reuse-check']]) {
      const calls = byLabel(run, re)
      t.ok(calls.length >= 1 && calls.every((c) => isLiteral(c) && literalOp(c) === op), `${re} runs the literal ${op} op (got ${calls.map((c) => literalOp(c)).join(', ') || 'no spawn'})`)
    }
    const dispatch = byLabel(run, /^dispatch:/)[0]
    t.ok(dispatch && /--commit/.test(dispatch.prompt) && /--wo 'wo-m-001'/.test(dispatch.prompt) && !/perl -0pi/.test(dispatch.prompt), 'dispatch commits the IN_PROGRESS stamp (the C7 anchor) through the script, no perl recipe')
    const commit = byLabel(run, 'commit:wo-m-001')[0]
    t.ok(commit && /--file 'src\/frd-m\/0\/\*\*'/.test(commit.prompt) && !/SOLE git writer/.test(commit.prompt), 'the WO commit is commit-wo with its declared artifacts, not the prose recipe')
    t.ok(run.result && run.result.builtFrds.includes('frd-m'), 'the FRD still verifies')
  },
})

SCENARIOS.push({
  name: 'P39-g. mechscript-opt-in-and-out — classic + mechScript:true is literal; fast + mechScript:false keeps the prose recipes',
  args: { mode: 'balanced', mechScript: true },
  plan: infraPlan('frd-o', ['wo-o-001']),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, /^dispatch:/).every(isLiteral) && byLabel(run, 'commit:wo-o-001').every(isLiteral) && byLabel(run, 'mech-precheck').length === 1, 'classic lane with mechScript:true → literal ops + the precheck')
    t.ok(byLabel(run, /^infra-pause:/).length === 0, 'mechScript alone does not turn the infra guard on')
  },
})
SCENARIOS.push({
  name: 'P39-g2. fast lane with mechScript:false keeps the prose MECH recipes',
  args: { mode: 'balanced', lane: 'fast', mechScript: false },
  plan: infraPlan('frd-o2', ['wo-o2-001']),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, 'mech-precheck').length === 0 && byLabel(run, /^dispatch:/).every((c) => /perl -0pi/.test(c.prompt) && !isLiteral(c)), 'no precheck, the perl dispatch recipe')
  },
})

SCENARIOS.push({
  name: 'P39-h. classic-unchanged — no lane arg: no precheck, prose MECH recipes, and a builder that returns nothing is a WO failure repaired exactly as before (no infra class)',
  args: { mode: 'balanced' },
  plan: infraPlan('frd-cl', ['wo-cl-001']),
  responses: [
    { label: 'build:wo-cl-001', times: 1, response: null },
    // the classic repair path records its discard intent first (BL-0215) — an untouched classic behavior
    { label: 'wo-revert-plan:frd-cl', response: { output: sealLine({ ok: true, version: 1, frd: 'frd-cl', mode: 'plan', status: 'nothing', changed: false, wos: [], files: [] }) } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, 'mech-precheck').length === 0 && byLabel(run, /^(infra-pause|park):/).length === 0 && byLabel(run, 'build-paused').length === 0, 'no precheck, no pause, no park, no paused close')
    t.ok(byLabel(run, /^dispatch:/).every((c) => /perl -0pi/.test(c.prompt) && !isLiteral(c)), 'the dispatch keeps its perl recipe')
    t.ok(byLabel(run, 'build:wo-cl-001').length === 1 && byLabel(run, 'repair:frd-cl').length === 1, 'the null builder is NOT retried: the FRD goes to attemptRepair as before')
    t.ok(run.result && run.result.stopReason !== 'paused-infra' && !('resumeHint' in run.result), 'the result has the classic shape')
    t.ok(!hasLog(run, /lane fast/i), 'no fast-lane log line')
  },
})


// ─────────────────────────────────────────────────────────────────────────────
// Proposal 39 stage 3 — the fast lane (C3 floor, C4 S0 solo FRD builder, C6 USABLE + review, §11 sequential FRDs)
// ─────────────────────────────────────────────────────────────────────────────
const FAST = { lane: 'fast', parallelGates: true }
const fastPlan = (frds) => mkPlan(frds.map(({ frd, ids, deps = [], floor = false, extra = {} }) => ({
  frd, deps, floor,
  workOrders: ids.map((id, i) => ({ ...mkWo(id, 'PLANNED', { frd, artifacts: [`src/${frd}/${i}/**`], ...(extra[id] || {}) }), acText: `- **AC-${id}.1** WHEN ${id} runs, the system SHALL do its thing.` })),
})))
const labelIdx = (run, re) => run.calls.findIndex((c) => re.test(c.label))
const lastIdx = (run, re) => run.calls.map((c) => c.label).reduce((acc, l, i) => (re.test(l) ? i : acc), -1)
const parkedVia = (ids) => ({ wos: ids.map((id) => ({ id, line: parkLine(id) })) })

SCENARIOS.push({
  name: 'F39-1. fast-lane-no-plan-agent — the plan is the scripted Build Plan reader (with the floor classification), never the opus planner',
  args: { mode: 'balanced', ...FAST },
  plan: fastPlan([{ frd: 'frd-n1', ids: ['wo-n1-001', 'wo-n1-002'] }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, 'plan').length === 0, 'no plan agent spawn')
    const mp = byLabel(run, 'mech-plan')
    t.ok(mp.length === 1 && isLiteral(mp[0]) && literalOp(mp[0]) === 'plan' && /--classify/.test(mp[0].prompt), 'one literal `plan --classify` op')
    t.ok(labelIdx(run, /^mech-plan$/) < labelIdx(run, /^dispatch:/), 'the plan is read before the first dispatch')
    t.ok(hasLog(run, /no plan agent/i), 'the log says why no plan agent ran')
    t.ok(run.result && run.result.builtFrds.includes('frd-n1'), 'the FRD verifies')
  },
})
SCENARIOS.push({
  name: 'F39-1b. fast-lane-plan-fallback — a missing/drifted Build Plan falls back to the plan agent (fail-safe, never a guess)',
  args: { mode: 'balanced', ...FAST },
  plan: fastPlan([{ frd: 'frd-n2', ids: ['wo-n2-001'] }]),
  noPlanLine: true,
  responses: [{ label: 'mech-plan', response: { line: mechLine('plan', { status: 'no-build-plan', reason: 'frd-n2: blueprint.md has no Build Plan table' }) } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, 'plan').length === 1 && labelIdx(run, /^mech-plan$/) < labelIdx(run, /^plan$/), 'the plan agent runs after the scripted reader declined')
    t.ok(hasLog(run, /no Build Plan table/), 'the reason is logged')
    t.ok(byLabel(run, /^fast-build:frd-n2$/).length === 1, 'the fast lane still builds it (one FRD builder)')
  },
})

SCENARIOS.push({
  name: 'F39-2. fast-lane-single-frd-usable-then-verified — one sonnet builder, verify on the clean SHA → USABLE (pushed), then the unchanged opus gate → VERIFIED; security starts with the gate',
  args: { mode: 'balanced', ...FAST },
  plan: fastPlan([{ frd: 'frd-u', ids: ['wo-u-001', 'wo-u-002', 'wo-u-003'] }]),
  responses: [{ label: 'verify:frd-u', response: { line: mechLine('verify', { status: 'green', frd: 'frd-u', green: true, usable: true, floor: false, sha: 'abc123def456', scope: 'full' }) } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    const b = byLabel(run, /^fast-build:/)
    t.ok(b.length === 1 && b[0].label === 'fast-build:frd-u' && b[0].model === 'sonnet' && b[0].agentType === 'pandacorp:implementer', `ONE sonnet pandacorp:implementer builder for the FRD (got ${b.map((c) => `${c.label}/${c.model}`).join(', ')})`)
    t.ok(byLabel(run, /^(build|commit|selftest|test|be|fe):/).length === 0, 'no per-WO build or commit spawns')
    const d = byLabel(run, /^dispatch:/)
    t.ok(d.length === 1 && ['wo-u-001', 'wo-u-002', 'wo-u-003'].every((id) => d[0].prompt.includes(`--wo '${id}'`)) && /--commit/.test(d[0].prompt), 'one committed dispatch stamp for every WO of the FRD')
    const v = byLabel(run, 'verify:frd-u')
    t.ok(v.length === 1 && isLiteral(v[0]) && literalOp(v[0]) === 'verify' && /--since 'd15pa7cbase0'/.test(v[0].prompt) && ['wo-u-001', 'wo-u-002', 'wo-u-003'].every((id) => v[0].prompt.includes(`--wo '${id}'`)), 'one literal verify op over the FRD\'s landed range and its WOs')
    t.ok(labelIdx(run, /^fast-build:/) < labelIdx(run, /^verify:/) && labelIdx(run, /^verify:/) < labelIdx(run, /^gate:frd-u$/), 'build → verify → gate')
    t.ok(hasLog(run, /USABLE.*frd-u.*abc123def456/), 'USABLE is logged with the SHA')
    t.ok(run.result && JSON.stringify(run.result.usable) === JSON.stringify([{ frd: 'frd-u', sha: 'abc123def456' }]), `result.usable carries {frd, sha} (got ${run.result && JSON.stringify(run.result.usable)})`)
    t.ok(run.result && /frd-u/.test(run.result.pushHint || '') && /PushNotification/.test(run.result.pushHint || ''), 'the final summary carries the PushNotification hint')
    t.ok(byLabel(run, /^pin:/).length === 0 && byLabel(run, /^gate-worktree:1$/).some((c) => /abc123def456/.test(c.prompt)), 'the gate is pinned at the USABLE SHA without a pin spawn')
    const g = byLabel(run, /^gate:frd-u$/)
    t.ok(g.length === 1 && g[0].model === 'opus' && g[0].agentType === 'pandacorp:reviewer', 'the unchanged opus FRD gate')
    t.ok(run.result.builtFrds.includes('frd-u') && byLabel(run, 'apply-gate:frd-u').length === 1, 'VERIFIED through apply-gate')
    const early = byLabel(run, 'hardening:security-audit-early')
    t.ok(early.length === 1 && early[0].model === 'opus' && early[0].agentType === 'pandacorp:security-auditor' && labelIdx(run, /^hardening:security-audit-early$/) < labelIdx(run, /^apply-gate:/), 'the security audit starts alongside the first gate (opus, read-only auditor)')
    t.ok(byLabel(run, 'hardening:security-audit').length === 0 && byLabel(run, 'hardening:security-delta').length === 1, 'the hardening runs the fail-closed security delta instead of a second full audit')
    t.ok(byLabel(run, 'close-out').length === 1, 'the close-out runs once per build')
  },
})

SCENARIOS.push({
  name: 'F39-3. fast-lane-commit-per-wo-by-builder — the builder commits each WO itself with the literal commit-wo command; the engine trusts only sealed receipts',
  args: { mode: 'balanced', ...FAST },
  plan: fastPlan([{ frd: 'frd-c3', ids: ['wo-c3-001', 'wo-c3-002'], extra: { 'wo-c3-002': { deps: ['wo-c3-001'] } } }]),
  responses: [{ label: 'fast-build:frd-c3', response: { wos: [{ id: 'wo-c3-001', line: commitLine('wo-c3-001') }, { id: 'wo-c3-002', line: commitLine('wo-c3-002').replace('committed', 'COMMITTED') }] } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    const b = byLabel(run, 'fast-build:frd-c3')[0]
    t.ok(b && /pandacorp-build-mech\.mjs' commit-wo --project '\.' --wo 'wo-c3-001' --file 'src\/frd-c3\/0\/\*\*'/.test(b.prompt) && /--wo 'wo-c3-002' --file 'src\/frd-c3\/1\/\*\*'/.test(b.prompt), 'each WO carries its own literal commit-wo command with its declared files')
    t.ok(b && /park-wo --project '\.' --wo 'wo-c3-001'/.test(b.prompt), 'and its park-wo command for a give-up')
    t.ok(b && b.prompt.indexOf('### WORK ORDER wo-c3-001') < b.prompt.indexOf('### WORK ORDER wo-c3-002') && /AC-wo-c3-001\.1/.test(b.prompt), 'the WO briefs are inline, in Build Plan order, with their ACs (LESSON-0147)')
    t.ok(b && /never call git/i.test(b.prompt) && /implementation_status/.test(b.prompt), 'the builder never calls git and never stamps the status itself')
    t.ok(hasLog(run, /wo-c3-002.*(seal|unverified)/i), 'a receipt that fails its seal is not trusted (logged)')
    const r = byLabel(run, /^fast-retry:frd-c3$/)
    t.ok(r.length === 1 && /### WORK ORDER wo-c3-002/.test(r[0].prompt) && !/### WORK ORDER wo-c3-001/.test(r[0].prompt), 'only the unproven WO goes to the retry rung')
    t.ok(byLabel(run, 'park:wo-c3-002').length === 1, 'the unproven WO is parked by the engine before the retry (its files never leak into the next commit)')
    t.ok(run.result.builtFrds.includes('frd-c3'), 'the FRD still verifies')
  },
})

SCENARIOS.push({
  name: 'F39-4. fast-lane-park-on-failure — a WO the builder parks (and its dependent) is rebuilt once on opus; no attemptRepair, no per-WO spawns',
  args: { mode: 'balanced', ...FAST },
  plan: fastPlan([{ frd: 'frd-p4', ids: ['wo-p4-001', 'wo-p4-002', 'wo-p4-003'], extra: { 'wo-p4-003': { deps: ['wo-p4-002'] } } }]),
  responses: [{ label: 'fast-build:frd-p4', response: { wos: [{ id: 'wo-p4-001', line: commitLine('wo-p4-001') }, { id: 'wo-p4-002', line: parkLine('wo-p4-002') }, { id: 'wo-p4-003', line: parkLine('wo-p4-003') }] } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    const r = byLabel(run, /^fast-retry:frd-p4$/)
    t.ok(r.length === 1 && r[0].model === 'opus' && /### WORK ORDER wo-p4-002/.test(r[0].prompt) && /### WORK ORDER wo-p4-003/.test(r[0].prompt) && !/### WORK ORDER wo-p4-001/.test(r[0].prompt), 'one opus retry over the parked WOs only')
    t.ok(byLabel(run, /^park:/).length === 0, 'the builder already parked them: the engine parks nothing twice')
    t.ok(byLabel(run, /^(repair|build):/).length === 0, 'no attemptRepair and no per-WO builder')
    t.ok(labelIdx(run, /^fast-retry:/) < labelIdx(run, /^verify:/), 'verify runs after every WO landed')
    t.ok(run.result.builtFrds.includes('frd-p4'), 'the FRD verifies')
  },
})
SCENARIOS.push({
  name: 'F39-4b. fast-lane-park-twice-goes-to-repair — still parked after the opus retry: the classic bounded repair decides (block, discard: the FRD was never USABLE)',
  args: { mode: 'balanced', ...FAST },
  plan: fastPlan([{ frd: 'frd-p5', ids: ['wo-p5-001'] }]),
  responses: [
    { label: 'fast-build:frd-p5', response: parkedVia(['wo-p5-001']) },
    { label: 'fast-retry:frd-p5', response: parkedVia(['wo-p5-001']) },
    { label: 'repair:frd-p5', response: { green: false, blocked_reason: 'error', failure: 'cannot build it' } },
    { label: 'wo-revert-plan:frd-p5', response: { output: sealLine({ ok: true, version: 1, frd: 'frd-p5', mode: 'plan', status: 'nothing', changed: false, wos: [], files: [] }) } },
    { label: 'wo-revert-apply:frd-p5', response: { output: sealLine({ ok: true, version: 1, frd: 'frd-p5', mode: 'apply', status: 'nothing', changed: false, wos: [], files: [] }) } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, 'repair:frd-p5').length === 1 && byLabel(run, /^verify:/).length === 0, 'the bounded repair runs; nothing is verified')
    t.ok(run.result.blockedFrds.includes('frd-p5') && run.result.blockedReasons['frd-p5'] === 'error', 'BLOCKED with the repair\'s reason')
    t.ok(!(run.result.usable || []).length, 'never USABLE')
  },
})

SCENARIOS.push({
  name: 'F39-5. fast-lane-floor-frd-waits-verified — a floor FRD (plan-time or landed) is never USABLE: no push until its gate VERIFIES it',
  args: { mode: 'balanced', ...FAST },
  plan: fastPlan([{ frd: 'frd-fl', ids: ['wo-fl-001'], floor: true }, { frd: 'frd-lf', ids: ['wo-lf-001'] }]),
  responses: [{ label: 'verify:frd-lf', response: { line: mechLine('verify', { status: 'green', frd: 'frd-lf', green: true, usable: false, floor: true, floorChanged: true, sha: 'f100r0000002', scope: 'full' }) } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(!(run.result.usable || []).length, `no FRD is USABLE (got ${JSON.stringify(run.result.usable)})`)
    t.ok(hasLog(run, /frd-fl.*floor/i) && hasLog(run, /frd-lf.*floor/i), 'both are logged as floor (plan-time and landed)')
    t.ok(!hasLog(run, /USABLE: frd-(fl|lf)/), 'no USABLE line for a floor FRD')
    t.ok(byLabel(run, 'gate:frd-fl').length === 1 && byLabel(run, 'gate:frd-lf').length === 1 && run.result.builtFrds.includes('frd-fl') && run.result.builtFrds.includes('frd-lf'), 'both are gated and VERIFIED')
  },
})

SCENARIOS.push({
  name: 'F39-6. fast-lane-dependent-of-floor-waits — an FRD that depends on a floor FRD builds only after that FRD is VERIFIED',
  args: { mode: 'balanced', ...FAST },
  plan: fastPlan([{ frd: 'frd-a6', ids: ['wo-a6-001'], floor: true }, { frd: 'frd-b6', ids: ['wo-b6-001'], deps: ['frd-a6'] }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    const applyA = labelIdx(run, /^apply-gate:frd-a6$/)
    t.ok(applyA >= 0 && labelIdx(run, /^fast-build:frd-b6$/) > applyA, `frd-b6 builds after frd-a6 is VERIFIED (apply ${applyA}, build ${labelIdx(run, /^fast-build:frd-b6$/)})`)
    t.ok(hasLog(run, /frd-b6.*waits.*frd-a6/), 'the wait is logged')
    t.ok(run.result.builtFrds.includes('frd-a6') && run.result.builtFrds.includes('frd-b6'), 'both verify')
  },
})

SCENARIOS.push({
  name: 'F39-7. fast-lane-gate-overlaps-next-build — FRD A\'s gate reviews in a slot WHILE FRD B (which depends on the USABLE A) builds',
  args: { mode: 'balanced', ...FAST },
  plan: fastPlan([{ frd: 'frd-a7', ids: ['wo-a7-001'] }, { frd: 'frd-b7', ids: ['wo-b7-001'], deps: ['frd-a7'] }]),
  responses: (() => {
    let started
    const bStarted = new Promise((res) => { started = res })
    const state = { overlapped: false }
    return [
      { label: 'gate:frd-a7', response: async () => { state.overlapped = await Promise.race([bStarted.then(() => true), new Promise((res) => setTimeout(() => res(false), 1500))]); return { green: true, overlapped: state.overlapped } } },
      { label: 'fast-build:frd-b7', response: (call) => { started(); return { wos: FAST_BUILT_IDS(call.prompt).map((id) => ({ id, line: commitLine(id) })) } } },
    ]
  })(),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    const slotA = labelIdx(run, /^gate-worktree:1$/)
    const gA = labelIdx(run, /^gate:frd-a7$/)
    const bB = labelIdx(run, /^fast-build:frd-b7$/)
    const applyA = labelIdx(run, /^apply-gate:frd-a7$/)
    t.ok(slotA >= 0 && slotA < labelIdx(run, /^dispatch:frd-b7$/) && bB > slotA && applyA > bB, `A's gate takes its slot before B is dispatched and lands only after B built (slot ${slotA}, build B ${bB}, apply A ${applyA})`)
    t.ok(gA > slotA && gA < labelIdx(run, /^verify:frd-b7$/), 'A\'s reviewer works while B is still building (before B\'s verify)')
    t.ok(hasLog(run, /gate frd-a7 → slot/), 'A\'s gate runs in a parallel gate slot (DR-118)')
    t.ok(run.result.builtFrds.includes('frd-a7') && run.result.builtFrds.includes('frd-b7'), 'both verify')
  },
})

SCENARIOS.push({
  name: 'F39-8. fast-lane-defer-stops-at-usable — reviewBudget defer: build every FRD to USABLE, launch no gate, close without hardening; the review debt is derived, never stored',
  args: { mode: 'balanced', ...FAST, reviewBudget: 'defer' },
  plan: fastPlan([{ frd: 'frd-d1', ids: ['wo-d1-001'] }, { frd: 'frd-d2', ids: ['wo-d2-001'], deps: ['frd-d1'] }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, /^fast-build:/).length === 2 && byLabel(run, /^verify:/).length === 2, 'both FRDs build and verify')
    t.ok(byLabel(run, /^(gate|gate-worktree|apply-gate|find|evidence|hardening):/).length === 0 && byLabel(run, /^(gate-worktree(:\d+)?|close-out)$/).length === 0, 'no gate, no hardening, no close-out review')
    t.ok(byLabel(run, 'notify-end').length === 1, 'the run closes through notify-end (lease released)')
    t.ok(run.result && JSON.stringify((run.result.usable || []).map((u) => u.frd)) === JSON.stringify(['frd-d1', 'frd-d2']), 'both are USABLE')
    t.ok(run.result && JSON.stringify(run.result.reviewDebt) === JSON.stringify(['frd-d1', 'frd-d2']) && run.result.stopReason === 'review-deferred', `the derived review debt + stopReason review-deferred (got ${run.result && JSON.stringify([run.result.reviewDebt, run.result.stopReason])})`)
    const notify = byLabel(run, 'notify-end')[0]
    t.ok(notify && !/review_debt/.test(notify.prompt), 'no stored review_debt field is written (DR-115)')
  },
})

SCENARIOS.push({
  name: 'F39-9. fast-lane-discard-after-usable-is-needs-owner — once USABLE, a gate reject is fix-forward only: a discard becomes needs-owner, nothing is reverted',
  args: { mode: 'balanced', ...FAST },
  plan: fastPlan([{ frd: 'frd-x9', ids: ['wo-x9-001'] }, { frd: 'frd-y9', ids: ['wo-y9-001'], deps: ['frd-x9'] }]),
  responses: [
    { label: 'gate:frd-x9', response: { green: false, reopen: ['wo-x9-001'], findings: [{ wo: 'wo-x9-001', finding: 'AC-x9 not met', failingTest: 't.test.ts', files: ['src/x.ts'] }], failure: 'AC-x9 not met' } },
    { label: 'patch:frd-x9', response: { green: false, failure: 'could not patch' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, 'patch:frd-x9').length === 1, 'fix-forward first: the in-place patch runs (DR-073 ladder unchanged)')
    t.ok(byLabel(run, /^(wo-revert|revert:)/).length === 0, `nothing is reverted (got ${byLabel(run, /^(wo-revert|revert:)/).map((c) => c.label).join(', ') || 'none'})`)
    const b = byLabel(run, 'block-usable:frd-x9')
    t.ok(b.length === 1 && /needs-owner/.test(b[0].prompt) && /frd-y9/.test(b[0].prompt) && /decisions\.md/.test(b[0].prompt), 'a needs-owner decision record names the dependent set (set-wide discard on approval)')
    t.ok(run.result.blockedReasons['frd-x9'] === 'needs-owner', 'BLOCKED needs-owner')
    t.ok(byLabel(run, /^build:wo-x9/).length === 0 && byLabel(run, /^fast-retry:frd-x9/).length === 0, 'no in-run rebuild over the USABLE code')
  },
})

// K8 across runs: USABLE is derived from durable state (the precheck reads the committed build_usable lines), never
// only from this run's memory — a defer, a paused-infra halt or an unlanded gate must not re-open the auto-discard.
const inReviewPlan = (frds) => mkPlan(frds.map(({ frd, ids, deps = [] }) => ({ frd, deps, floor: false, workOrders: ids.map((id, i) => mkWo(id, 'IN_REVIEW', { frd, artifacts: [`src/${frd}/${i}/**`] })) })))
SCENARIOS.push({
  name: 'F39-12. fast-lane-usable-survives-the-run — run 1 defers at USABLE; run 2 (default budget) gates it: the precheck derives USABLE from the committed build_usable line, so a reject is needs-owner and nothing is reverted',
  args: { mode: 'balanced', ...FAST, reviewBudget: 'defer' },
  plan: fastPlan([{ frd: 'frd-x12', ids: ['wo-x12-001'] }, { frd: 'frd-y12', ids: ['wo-y12-001'], deps: ['frd-x12'] }]),
  responses: [{ label: 'verify:frd-x12', response: { line: mechLine('verify', { status: 'green', frd: 'frd-x12', green: true, usable: true, floor: false, sha: 'abc000000012', scope: 'full' }) } }],
  next: (first) => ({
    args: { mode: 'balanced', ...FAST },
    plan: inReviewPlan([{ frd: 'frd-x12', ids: ['wo-x12-001'] }, { frd: 'frd-y12', ids: ['wo-y12-001'], deps: ['frd-x12'] }]),
    responses: [
      { label: 'mech-precheck', response: precheckLine({ keptInReview: ['wo-x12-001', 'wo-y12-001'], usable: (first.result && first.result.usable) || [] }) },
      { label: 'gate:frd-x12', response: { green: false, reopen: ['wo-x12-001'], findings: [{ wo: 'wo-x12-001', finding: 'AC-x12 not met', failingTest: 't.test.ts', files: ['src/x.ts'] }], failure: 'AC-x12 not met' } },
      { label: 'patch:frd-x12', response: { green: false, failure: 'could not patch' } },
    ],
  }),
  assert(t, run) {
    t.ok(!run.error, `run 1 threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(run.result && run.result.stopReason === 'review-deferred' && (run.result.usable || []).some((u) => u.frd === 'frd-x12' && u.sha === 'abc000000012'), `run 1 stops at USABLE (got ${run.result && JSON.stringify([run.result.stopReason, run.result.usable])})`)
    const two = run.next
    t.ok(two && !two.error, `run 2 threw: ${two && two.error && (two.error.stack || two.error)}`)
    t.ok(byLabel(two, /^fast-build:/).length === 0 && byLabel(two, 'gate:frd-x12').length === 1, 'run 2 rebuilds nothing and gates the USABLE FRD')
    t.ok(byLabel(two, 'patch:frd-x12').length === 1, 'fix-forward first: the in-place patch runs')
    t.ok(byLabel(two, /^(wo-revert|revert:)/).length === 0, `nothing is reverted in run 2 (got ${byLabel(two, /^(wo-revert|revert:)/).map((c) => c.label).join(', ') || 'none'})`)
    t.ok(byLabel(two, /^(build|fast-retry):/).length === 0, 'no automatic rebuild over the USABLE code')
    const b = byLabel(two, 'block-usable:frd-x12')
    t.ok(b.length === 1 && /abc000000012/.test(b[0].prompt) && /frd-y12/.test(b[0].prompt), 'the needs-owner record names the certified sha and the dependent set')
    t.ok(two.result && two.result.blockedReasons && two.result.blockedReasons['frd-x12'] === 'needs-owner', `BLOCKED needs-owner (got ${two.result && JSON.stringify(two.result.blockedReasons)})`)
    t.ok(hasLog(two, /frd-x12.*USABLE.*earlier run|USABLE.*earlier run.*frd-x12/), 'run 2 logs the USABLE it derived from the earlier run')
  },
})

SCENARIOS.push({
  name: 'F39-11. fast-lane-builder-hits-the-limit — a usage limit inside the FRD builder pauses the run: its unlanded WOs are parked, nothing is repaired or blocked',
  args: { mode: 'balanced', ...FAST },
  plan: fastPlan([{ frd: 'frd-l', ids: ['wo-l-001', 'wo-l-002'] }]),
  responses: [{ label: 'fast-build:frd-l', response: throwing('API Error: 429 {"type":"error","error":{"type":"rate_limit_error","message":"usage limit reached"}}') }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, 'park:wo-l-001').length === 1 && byLabel(run, 'park:wo-l-002').length === 1, 'both unlanded WOs are parked through the literal park-wo op')
    noRepairPath(t, run)
    t.ok(byLabel(run, /^(verify|fast-retry|fix):/).length === 0 && byLabel(run, 'build-paused').length === 1, 'no verify, no retry, one paused close')
    t.ok(run.result && run.result.stopReason === 'paused-infra', `stopReason paused-infra (got ${run.result && run.result.stopReason})`)
  },
})

SCENARIOS.push({
  name: 'F39-10. classic-unchanged — without lane:fast the plan agent, per-WO builders and commits, and the classic result shape are untouched',
  args: { mode: 'balanced' },
  plan: fastPlan([{ frd: 'frd-cl2', ids: ['wo-cl2-001', 'wo-cl2-002'] }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error && (run.error.stack || run.error)}`)
    t.ok(byLabel(run, 'plan').length === 1 && byLabel(run, 'mech-plan').length === 0, 'the plan agent runs, never the scripted reader')
    t.ok(byLabel(run, /^build:/).length === 2 && byLabel(run, /^commit:/).length === 2, 'per-WO builders and commits')
    t.ok(byLabel(run, /^(fast-build|fast-retry|verify|fix|block-usable):/).length === 0 && byLabel(run, /^hardening:security-(audit-early|delta)$/).length === 0, 'no fast-lane spawn')
    t.ok(byLabel(run, 'hardening:security-audit').length === 1, 'the classic full security audit')
    t.ok(run.result && !('usable' in run.result) && !('reviewDebt' in run.result) && !('pushHint' in run.result), 'the classic result shape')
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────
let passed = 0
let failed = 0
for (const s of SCENARIOS) {
  if (process.env.ONLY_SCENARIO && !s.name.startsWith(process.env.ONLY_SCENARIO)) continue
  const run = await runEngine(s)
  if (s.next) run.next = await runEngine(s.next(run))   // a two-run scenario: the second run starts from the first's durable outcome
  if (process.env.SHOW_CALLS) console.log(run.calls.map((c, i) => `${i}:${c.label}`).join(' '))
  const t = new T(s.name)
  try {
    s.assert(t, run)
  } catch (e) {
    t.failures.push(`assertion block threw: ${e && e.stack ? e.stack.split('\n')[0] : e}`)
  }
  if (run.unmatched.length) t.failures.push(`unmatched agent labels: ${[...new Set(run.unmatched)].join(', ')}`)
  if (run.next && run.next.unmatched.length) t.failures.push(`unmatched agent labels in run 2: ${[...new Set(run.next.unmatched)].join(', ')}`)
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
