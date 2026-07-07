#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// test-pandacorp-build.mjs — the FIRST automated test harness for the Pandacorp
// build engine (plugin/templates/shared/.claude/engines/pandacorp-build.js).
//
// HOW THE SIMULATION WORKS
// ────────────────────────
// The engine is a Claude Dynamic Workflows script: plain JS executed with
// INJECTED globals. It declares NONE of them — inventory (verified by grep +
// execution): `agent`, `log`, `budget`, `args`, `phase`, `parallel`.
// ALL of its real-world I/O (file reads/writes, git, verify.sh) is delegated
// to subagents through `agent(prompt, opts)`. That means the whole engine is
// deterministically simulable in memory:
//
//   1. fs.readFileSync the engine source; strip the single ESM `export` so it
//      is a plain script body (`export const meta` → `const meta`). The file
//      itself is NEVER modified.
//   2. Wrap it in an AsyncFunction('agent','log','budget','args','phase',
//      'parallel', source) — top-level `await`/`return` are legal in an async
//      function body, and the engine's own `agent = wrapper(agent)` rebinding
//      (BL-0022) works because `agent` is a parameter.
//   3. Run it once per scenario with FRESH stubs:
//        • `agent`  — records every call {index, label, prompt, opts} in order
//          and answers with a schema-conformant scripted response, matched by
//          opts.label (exact / prefix / RegExp). Unmatched labels get a safe
//          generic `{}` AND are recorded in `unmatched` so scenarios stay
//          honest (a scenario silently relying on a garbage response is a bug).
//        • `log`    — records lines. `phase` — records phase titles.
//        • `budget` — {total, spent(), remaining()} configurable per scenario.
//        • `parallel(fns)` — Promise.all(fns.map(f => f())), like the runtime.
//   4. Assertions run over the recorded agent-call sequence, the captured
//      logs, and the engine's return value.
//
// ADDING A SCENARIO
// ─────────────────
// Push an object into SCENARIOS:
//   {
//     name: 'my scenario',
//     args: { mode: 'pro', ... },            // what the launcher would pass
//     plan: mkPlan([...]),                    // shorthand: scripts label 'plan'
//     responses: [                            // scripted agent responses,
//       { label: 'close-out', response: { done: false } },       // exact label
//       { prefix: 'gate:',    response: { green: true } },       // label prefix
//       { label: /^build:/,   response: (call) => ({ green: true }) }, // fn ok
//       { label: 'safe-point', response: { stop: true }, times: 1 },  // limited
//     ],
//     assert: (t, run) => { ... }             // t.ok(cond, msg); run = {calls,
//                                             // logs, phases, result, error,
//                                             // unmatched}
//   }
// Response shapes must conform to the engine's own *_SCHEMA consts
// (PLAN_SCHEMA, VERIFY_SCHEMA, FRD_GATE_SCHEMA, STOP_SCHEMA, SAFE_POINT_SCHEMA,
// REPAIR_SCHEMA, FOUNDATION_SCHEMA, PROCESS_CHANGE_SCHEMA). The default
// responses below (defaultResponse) encode the "everything greens" happy path;
// a scenario only scripts the deviations it is about.
//
// Exit 0 green / 1 red. Output ends in `RESULT: N passed, M failed`.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENGINE_PATH = path.resolve(__dirname, '../templates/shared/.claude/engines/pandacorp-build.js')

let source = readFileSync(ENGINE_PATH, 'utf8')
// The only ESM syntax in the file is the meta export; neutralize it so the
// source is a valid function body. (We transform our in-memory copy — the
// engine file on disk is never touched.)
source = source.replace(/^export\s+const\s+meta/m, 'const meta')
if (/^\s*(export|import)\b/m.test(source)) {
  console.error('FATAL: engine still contains ESM syntax after the meta transform — update the harness loader.')
  process.exit(1)
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const engine = new AsyncFunction('agent', 'log', 'budget', 'args', 'phase', 'parallel', source)

// ── Default (schema-conformant) responses by label — the happy path ─────────
function defaultResponse(label) {
  // WS-D/D10: the baseline is now a two-step (cheap MECH pre-check → judge baseline). The default pre-check
  // ESCALATES so the judge baseline still runs and greens — the closest analogue of the old single spawn.
  if (label === 'baseline-precheck') return { escalate: true }          // PRECHECK_SCHEMA
  if (label === 'baseline') return { green: true }                      // VERIFY_SCHEMA
  if (label === 'plan') return { frds: [] }                             // PLAN_SCHEMA (empty → early exit)
  if (label === 'sync-rollups') return { corrected: 0 }
  if (label === 'safe-point') return { stop: false, ready: [], unblocked: [] } // SAFE_POINT_SCHEMA
  if (label === 'foundation-gate') return { complete: true }            // FOUNDATION_SCHEMA
  if (label === 'visual-qa') return { done: true }
  if (label.startsWith('dispatch:')) return {}
  if (label.startsWith('commit:')) return { committed: 1 }
  if (/^(build|test|be|fe|selftest):/.test(label)) return { green: true } // VERIFY_SCHEMA
  if (label.startsWith('gate:')) return { green: true }                 // FRD_GATE_SCHEMA
  if (label.startsWith('diagnose:')) return { classification: 'point', repeatsPrior: false, recommendation: 'patch', confidence: 'medium' } // DIAGNOSE_SCHEMA (A2) — benign default (only the recovery-ladder scenarios reach it)
  if (label.startsWith('block-needs-owner:')) return { green: false, blocked_reason: 'needs-owner' } // A3 early-block spawn (REPAIR_SCHEMA)
  if (/^(repair|patch|gate-test-repair|verify-patch|revert|foundation-repair):/.test(label)) return { green: true } // REPAIR_SCHEMA
  if (/^(process-change|plan-drained):/.test(label)) return { done: true, affectedFrds: [], frds: [] }
  if (/^(hardening:security-audit|hardening:security-fix|hardening:telemetry|close-out|close-needs-hardening|notify-end|ensure-stopped|archive-changes)$/.test(label)) return { done: true } // STOP_SCHEMA
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
    const call = { index: calls.length, label: opts.label || '', prompt: String(prompt), opts }
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

  const budget = scenario.budget || { total: 0, spent: () => 0, remaining: () => Infinity }
  const parallelStub = (fns) => Promise.all(fns.map((f) => f()))
  let result, error
  try {
    result = await engine(agentStub, (l) => logs.push(String(l)), budget, scenario.args, (t) => phases.push(t), parallelStub)
  } catch (e) {
    error = e
  }
  return { calls, logs, phases, unmatched, result, error }
}

// ── Plan builders ────────────────────────────────────────────────────────────
// mkWo('wo-01-001', 'PLANNED', { artifacts: ['src/a/**'], deps: [] })
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
// mkPlan([{ frd: 'frd-01-a', workOrders: [...] }], { hasFrontend: false })
const mkPlan = (frds, opts = {}) => ({
  stack: opts.stack || 'B',
  hasFrontend: Boolean(opts.hasFrontend),
  unsatisfiedDeps: [],
  frds,
})

// ── Tiny assertion collector ─────────────────────────────────────────────────
class T {
  constructor(name) { this.name = name; this.failures = []; this.count = 0 }
  ok(cond, msg) { this.count++; if (!cond) this.failures.push(msg) }
}
const hasLog = (run, re) => run.logs.some((l) => re.test(l))
const callsWith = (run, pred) => run.calls.filter(pred)
const byLabel = (run, re) => run.calls.filter((c) => (re instanceof RegExp ? re.test(c.label) : c.label === re))

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────
const SCENARIOS = []

// ── 1. BL-0024 / DR-072 R2 args guard (the RED→GREEN test the BL spec asks for) ──
SCENARIOS.push({
  name: '1a. args guard — args undefined fires the loud DROPPED/UNBOUNDED warning',
  args: undefined,
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const warn = run.logs.find((l) => l.includes('⚠⚠'))
    t.ok(Boolean(warn), 'a ⚠⚠ warning log line fires when args is undefined')
    t.ok(warn && warn.includes('undefined'), 'the warning names the undefined case')
    t.ok(warn && /DR-072 R2/.test(warn) && /BL-0024/.test(warn), 'the warning cites DR-072 R2 / BL-0024')
    t.ok(warn && /UNBOUNDED/.test(warn), 'the warning says the run is UNBOUNDED')
    t.ok(warn && /Supervisor/.test(warn), 'the warning addresses the supervisor (verify + TaskStop)')
  },
})
SCENARIOS.push({
  // Proposal 31 T0: scriptPath launches deliver args as a JSON STRING; the engine now
  // NORMALIZES it (JSON.parse shim) instead of warning-and-running-unbounded. A parseable
  // string must behave exactly like the object case.
  name: '1b. args guard — a parseable JSON-STRING args is normalized, no warning, run stays bounded',
  args: '{"mode":"pro","maxAgents":10}',
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(!run.logs.some((l) => l.includes('⚠⚠')), 'no ⚠⚠ warning — the string was parsed into a proper object')
    t.ok(!run.logs.some((l) => /UNBOUNDED/.test(l)), 'run is NOT unbounded — maxAgents came through the parse')
  },
})
SCENARIOS.push({
  name: '1d. args guard — an UNPARSEABLE string fails LOUD (never runs misconfigured)',
  args: '{not json',
  assert(t, run) {
    t.ok(Boolean(run.error), 'engine throws on an unparseable args string')
    t.ok(run.logs.some((l) => /FATAL/.test(l) && /unparseable/.test(l)), 'a FATAL log names the unparseable-args cause')
  },
})
SCENARIOS.push({
  name: '1c. args guard — a proper object fires NO warning',
  args: { mode: 'pro' },
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(!run.logs.some((l) => l.includes('⚠⚠')), 'no ⚠⚠ warning when args is a proper object')
    t.ok(!run.logs.some((l) => /DR-072 R2/.test(l)), 'no DR-072 R2 mention when args is a proper object')
  },
})

// ── 2. Budget brake — MAX_AGENTS, COST-weighted ─────────────────────────────
// 2a: mode 'pro' (worker=sonnet COST 1; judge=opus COST 3, DR-015 — the judge is ALWAYS a
// different model from the worker, even in pro; solo build). Pre-loop spawns (WS-D/D10 adds the MECH
// baseline pre-check): baseline-precheck(MECH,1) + baseline(judge,3) + plan(judge,3) + sync-rollups(MECH,1)
// = 8. maxAgents=14 → iteration 1 passes the brake (8<14), safe-point(+1)=9. The count cap P.wave=2 admits
// at most two WOs; the COST-aware picker (WS-A/D2) confirms it: remainingAgents=14-9=5, each sonnet WO costs
// COST(sonnet)+1=2 plus the shared dispatch(1) — wo-1 (cost 1+2=3) and wo-2 (5) fit; wo-3 is deferred (count
// cap). Wave=[wo-1,wo-2]. dispatch(+1)=10, builds wo-1+wo-2 (+2)=12, commits (+2)=14. Iteration 2 top:
// 14 ≥ 14 → STOP, exactly at the cap (no overshoot). wo-3/wo-4 must never be dispatched. (Before the D2 fix
// the width was counted raw, so an opus wave overshot the cap ~4× — see 2c.)
SCENARIOS.push({
  name: '2a. maxAgents brake — cost-aware wave stops dispatching once the cap is reached',
  args: { mode: 'pro', maxAgents: 14 },
  plan: mkPlan([{
    frd: 'frd-01-alpha',
    deps: [],
    workOrders: [
      mkWo('wo-01-001', 'PLANNED', { frd: 'frd-01-alpha', artifacts: ['src/a/**'] }),
      mkWo('wo-01-002', 'PLANNED', { frd: 'frd-01-alpha', artifacts: ['src/b/**'] }),
      mkWo('wo-01-003', 'PLANNED', { frd: 'frd-01-alpha', artifacts: ['src/c/**'] }),
      mkWo('wo-01-004', 'PLANNED', { frd: 'frd-01-alpha', artifacts: ['src/d/**'] }),
    ],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(run.result && run.result.stopReason === 'agents', `stopReason is 'agents' (got ${run.result && run.result.stopReason})`)
    t.ok(hasLog(run, /Agent ceiling reached \(14 ≥ maxAgents 14\)/), 'the brake logs "Agent ceiling reached (14 ≥ maxAgents 14)" — exactly at the cap, no overshoot')
    const built = byLabel(run, /^build:/).map((c) => c.label)
    t.ok(built.length === 2 && built.includes('build:wo-01-001') && built.includes('build:wo-01-002'),
      `only the first cost-budgeted wave (wo-01-001, wo-01-002) was built — got [${built.join(', ')}]`)
    t.ok(byLabel(run, 'build:wo-01-003').length === 0 && byLabel(run, 'build:wo-01-004').length === 0,
      'wo-01-003/wo-01-004 were never dispatched after the cap')
    t.ok(byLabel(run, /^gate:/).length === 0, 'no FRD gate ran (the FRD still had unbuilt WOs)')
    const end = byLabel(run, 'notify-end')[0]
    t.ok(end && /techo de agentes/.test(end.prompt), 'the end-of-run report tells the owner the stop was the agent ceiling')
  },
})
// 2b: COST-weighting proof. mode 'balanced' (judge=opus, COST 3). Pre-loop (WS-D/D10 adds the MECH
// baseline pre-check): baseline-precheck(MECH,1) + baseline(3) + plan(3) + sync(1) = 8. With maxAgents=8 the
// brake trips at the FIRST loop boundary — BEFORE any safe-point/dispatch/build. If spawns were
// counted raw (1 each) the counter would read 4 and the wave would launch.
SCENARIOS.push({
  name: '2b. maxAgents brake is COST-weighted (opus=3) — trips on the token-proxy, not the raw agent count',
  args: { mode: 'balanced', maxAgents: 8 },
  plan: mkPlan([{
    frd: 'frd-01-alpha',
    deps: [],
    workOrders: [mkWo('wo-01-001', 'PLANNED', { frd: 'frd-01-alpha', artifacts: ['src/a/**'] })],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(run.result && run.result.stopReason === 'agents', `stopReason is 'agents' (got ${run.result && run.result.stopReason})`)
    t.ok(hasLog(run, /Agent ceiling reached \(8 ≥ maxAgents 8\)/),
      'counter reads exactly 8 = precheck 1 + COST(opus baseline 3) + COST(opus plan 3) + sync 1 — the opus weighting is live')
    t.ok(byLabel(run, 'safe-point').length === 0, 'brake trips BEFORE the first safe point')
    t.ok(byLabel(run, /^(dispatch|build):/).length === 0, 'no wave was dispatched at all')
  },
})
// 2c: WS-A/D2 — an OPUS-escalated wave must NOT overshoot maxAgents by counting WOs raw. mode 'pro'
// (worker=sonnet floor, judge=opus per DR-015), all WOs difficulty:high → escalate to opus
// (woWaveCost = COST(opus)+1 = 4). Pre-loop: baseline(judge opus,3)+plan(judge opus,3)+sync(1)=7.
// safe-point→8. remainingAgents=10-8=2; the cost-aware picker admits wo-1 (dispatch 1 + 4 = 5, the
// ≥1 progress guarantee) but wo-2 would breach the budget → wave width = 1. BEFORE the fix the width
// was counted raw (min(P.wave 2, …)=2), so TWO opus WOs launched and the wave overshot the cap.
SCENARIOS.push({
  name: '2c. maxAgents brake is COST-aware for the WAVE WIDTH (opus wave does not overshoot) — WS-A/D2',
  args: { mode: 'pro', maxAgents: 10 },
  plan: mkPlan([{
    frd: 'frd-01-alpha',
    deps: [],
    workOrders: [
      mkWo('wo-01-001', 'PLANNED', { frd: 'frd-01-alpha', artifacts: ['src/a/**'], difficulty: 'high' }),
      mkWo('wo-01-002', 'PLANNED', { frd: 'frd-01-alpha', artifacts: ['src/b/**'], difficulty: 'high' }),
      mkWo('wo-01-003', 'PLANNED', { frd: 'frd-01-alpha', artifacts: ['src/c/**'], difficulty: 'high' }),
    ],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const waves = run.logs.filter((l) => l.startsWith('⚒ wave:'))
    t.ok(waves.length >= 1, 'at least one wave ran')
    t.ok(waves[0] && waves[0].includes('wo-01-001') && !waves[0].includes('wo-01-002'),
      `the first opus wave is cost-limited to ONE WO (would be two if width were counted raw) — got: ${waves[0]}`)
    t.ok(waves.every((w) => !(w.includes('wo-01-001') && w.includes('wo-01-002')) && !(w.includes('wo-01-002') && w.includes('wo-01-003'))),
      'no wave ever co-schedules two opus WOs (each opus wave stays within the cost budget)')
    t.ok(hasLog(run, /⤴ opus: wo-01-001 \(difficulty=high\)/), 'the WO escalated to opus a-priori (difficulty=high, DR-073)')
    t.ok(run.result && run.result.stopReason === 'agents', `the run still stops at the agent ceiling (got ${run.result && run.result.stopReason})`)
  },
})

// ── 3. DR-086 resume — VERIFIED (and IN_REVIEW) work is never rebuilt ────────
SCENARIOS.push({
  name: '3. DR-086 resume — VERIFIED never rebuilt; IN_REVIEW goes straight to the gate',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-02-resume',
    deps: [],
    workOrders: [
      mkWo('wo-02-001', 'VERIFIED', { frd: 'frd-02-resume', artifacts: ['src/one/**'] }),
      mkWo('wo-02-002', 'IN_REVIEW', { frd: 'frd-02-resume', artifacts: ['src/two/**'] }),
      mkWo('wo-02-003', 'PLANNED', { frd: 'frd-02-resume', artifacts: ['src/three/**'], deps: ['wo-02-002'] }),
    ],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^(build|test|be|fe|selftest):wo-02-001$/).length === 0, 'no builder agent for the VERIFIED wo-02-001')
    t.ok(byLabel(run, /^(build|test|be|fe|selftest):wo-02-002$/).length === 0, 'no builder agent for the IN_REVIEW wo-02-002 (committed by a prior run)')
    t.ok(byLabel(run, 'build:wo-02-003').length === 1, 'the PLANNED wo-02-003 IS built (its dep on the IN_REVIEW WO counts as satisfied)')
    const dispatches = byLabel(run, /^dispatch:/)
    t.ok(dispatches.every((c) => !c.prompt.includes('wo-02-001') && !c.prompt.includes('wo-02-002')),
      'no IN_PROGRESS dispatch stamp ever names wo-02-001/wo-02-002')
    const gates = byLabel(run, 'gate:frd-02-resume')
    t.ok(gates.length === 1, `exactly one FRD gate ran (got ${gates.length})`)
    t.ok(gates[0] && /THIS cycle: wo-02-002, wo-02-003/.test(gates[0].prompt),
      'the gate reviews exactly the IN_REVIEW + newly-built WOs (wo-02-002, wo-02-003)')
    t.ok(gates[0] && !/wo-02-001/.test(gates[0].prompt), 'the gate prompt never names the VERIFIED wo-02-001 as a review target')
    t.ok(run.result && run.result.builtFrds.includes('frd-02-resume'), 'the FRD verifies')
    t.ok(hasLog(run, /frd-02-resume: 1 to build · 1 already in review/), 'the schedule log reports 1 to build + 1 already in review')
  },
})

// ── 4. DR-060 collision handling — artifact disjointness is ENGINE JS ────────
// Disjointness lives in the engine itself (globToRe/globsOverlap/artifactsOverlap/
// pickDisjointWave, ~lines 688-713, consulted at the wave pick ~line 968) — not
// delegated to a prompt. Two same-wave-ready WOs with overlapping artifact globs
// must be serialized into different waves.
SCENARIOS.push({
  name: '4a. DR-060 — overlapping artifacts are never co-scheduled in one wave',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-03-collide',
    deps: [],
    workOrders: [
      mkWo('wo-03-001', 'PLANNED', { frd: 'frd-03-collide', artifacts: ['src/banner/**'] }),
      mkWo('wo-03-002', 'PLANNED', { frd: 'frd-03-collide', artifacts: ['src/banner/index.ts'] }), // overlaps wo-03-001
      mkWo('wo-03-003', 'PLANNED', { frd: 'frd-03-collide', artifacts: ['src/footer/**'] }),        // disjoint
    ],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const waves = run.logs.filter((l) => l.startsWith('⚒ wave:'))
    t.ok(waves.length >= 2, `the 3 WOs took ≥2 waves because of the overlap (got ${waves.length}: ${waves.join(' | ')})`)
    t.ok(!waves.some((l) => l.includes('wo-03-001') && l.includes('wo-03-002')),
      'wo-03-001 and wo-03-002 (overlapping globs src/banner/** vs src/banner/index.ts) never share a wave')
    t.ok(waves[0] && waves[0].includes('wo-03-001') && waves[0].includes('wo-03-003'),
      'the first wave pairs the two DISJOINT WOs instead (wo-03-001 + wo-03-003)')
    t.ok(byLabel(run, /^build:/).length === 3, 'all 3 WOs still get built (serialized, not dropped)')
    t.ok(run.result && run.result.builtFrds.includes('frd-03-collide'), 'the FRD verifies at the end')
  },
})
SCENARIOS.push({
  name: '4b. DR-060 fail-safe — a WO with UNDECLARED artifacts cannot be proven disjoint → serialized',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-04-undeclared',
    deps: [],
    workOrders: [
      mkWo('wo-04-001', 'PLANNED', { frd: 'frd-04-undeclared', artifacts: ['src/a/**'] }),
      mkWo('wo-04-002', 'PLANNED', { frd: 'frd-04-undeclared' }), // NO artifacts declared
    ],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(hasLog(run, /declare no artifacts — serializing/), 'the fail-safe logs the undeclared-artifacts serialization loudly')
    const waves = run.logs.filter((l) => l.startsWith('⚒ wave:'))
    t.ok(!waves.some((l) => l.includes('wo-04-001') && l.includes('wo-04-002')),
      'the undeclared-artifacts WO never shares a wave with anything')
    t.ok(byLabel(run, /^build:/).length === 2, 'both WOs still built, one wave each')
  },
})

// ── 5. Fail-safe close never touches phase (BL-0012) ─────────────────────────
SCENARIOS.push({
  name: '5. fail-safe close — done:false close-out triggers ensure-stopped, which forbids touching phase',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-05-close',
    deps: [],
    workOrders: [mkWo('wo-05-001', 'PLANNED', { frd: 'frd-05-close', artifacts: ['src/x/**'] })],
  }]),
  responses: [
    { label: 'close-out', response: { done: false, failure: 'simulated close-out agent death' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'hardening:security-audit').length === 1 && byLabel(run, 'hardening:security-fix').length === 1 && byLabel(run, 'hardening:telemetry').length === 1,
      'the all-done path ran the audit-then-fix security split + telemetry before close-out (RFC-30 N4)')
    const failsafe = byLabel(run, 'ensure-stopped')
    t.ok(failsafe.length === 1, 'the fail-safe close fired after the close-out returned done:false')
    t.ok(failsafe[0] && /Do NOT touch `phase`/.test(failsafe[0].prompt), 'the fail-safe prompt forbids touching `phase`')
    t.ok(failsafe[0] && /NEVER set phase: release here/.test(failsafe[0].prompt), 'the fail-safe prompt forbids phase: release explicitly (BL-0012)')
    t.ok(failsafe[0] && /running:false|running: false/.test(failsafe[0].prompt), 'the fail-safe only ensures running:false')
    // Whole-run sweep: NO prompt may instruct setting phase: release without the
    // hardening-evidence assertion. Only the hardening-gated close-out may do it.
    // Affirmative form (as written in the engine): "set .pandacorp/status.yaml phase: release".
    const releasers = callsWith(run, (c) => /set \.pandacorp\/status\.yaml phase: release/.test(c.prompt))
    for (const c of callsWith(run, (c2) => /phase: release/.test(c2.prompt))) {
      const affirmative = /set \.pandacorp\/status\.yaml phase: release/.test(c.prompt)
      const negatedOnly = /NEVER set phase: release|do NOT set phase: release|KEEP phase: implementation|must NOT be declared released/.test(c.prompt)
      t.ok(affirmative ? /hardening evidence EXISTS/.test(c.prompt) : negatedOnly,
        `prompt '${c.label}' mentions phase: release — must either carry the hardening-evidence assertion or be a negation`)
    }
    t.ok(releasers.length === 1 && releasers[0].label === 'close-out', 'only the close-out agent is ever instructed to set phase: release')
    const closeout = byLabel(run, 'close-out')[0]
    t.ok(closeout && /assert the hardening evidence EXISTS/.test(closeout.prompt),
      'the close-out prompt gates phase: release on the hardening evidence (security report + telemetry verification)')
  },
})

// ── 6. safePoint cadence (C1c) — the DR-069 sweep runs BEFORE every WAVE, and is SKIPPED on pure
// gate-drain iterations (a wave is the safe point; the initial owner-signal check already ran in the
// baseline pre-check). ADJUSTED for C1c: the old expectation (a safe point before EVERY gate) is exactly
// the per-gate spawn C1c removes — the sweep now precedes the wave dispatch, not each gate drain.
SCENARIOS.push({
  name: '6a. safe-point cadence (C1c) — the DR-069 sweep runs before every WAVE, skipped on pure gate-drain iterations',
  args: { mode: 'pro' },
  plan: mkPlan([
    { frd: 'frd-06-one', deps: [], workOrders: [mkWo('wo-06-101', 'PLANNED', { frd: 'frd-06-one', artifacts: ['src/one/**'] })] },
    { frd: 'frd-06-two', deps: [], workOrders: [mkWo('wo-06-201', 'PLANNED', { frd: 'frd-06-two', artifacts: ['src/two/**'] })] },
  ]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const sp = byLabel(run, 'safe-point')
    const gates = byLabel(run, /^gate:/)
    const builds = byLabel(run, /^(dispatch|build):/)
    t.ok(gates.length === 2, `both FRD gates ran (got ${gates.length})`)
    t.ok(sp.length >= 1, `the safe point still runs (before the wave) — got ${sp.length}`)
    // C1c: a safe point runs BEFORE the first wave dispatch (owner signals checked before every wave).
    t.ok(builds.length > 0 && sp.some((s) => s.index < builds[0].index),
      'a safe-point call runs before the first wave dispatch (owner signals checked before every wave)')
    // C1c: the two FRD gates drain in consecutive gate-only iterations — NO safe point runs between them
    // (that per-gate spawn is exactly what C1c removes; the sweep is a wave-boundary sweep now).
    t.ok(!sp.some((s) => s.index > gates[0].index && s.index < gates[1].index),
      'no safe point runs between the two consecutive gate drains (C1c — skipped on pure gate-drain iterations)')
    const p = sp[0].prompt
    t.ok(/rethink_pending/.test(p), 'the safe point checks rethink_pending')
    t.ok(/inbox\/changes/.test(p), 'the safe point drains the inbox/changes queue')
    t.ok(/decisions\.md/.test(p), 'the safe point checks answered decisions')
    t.ok(/BLOCKED.*needs-owner/s.test(p), 'the safe point unblocks needs-owner WOs whose decisions were answered')
  },
})
SCENARIOS.push({
  name: '6b. safe-point rethink stop — rethink_pending stops the run at the boundary',
  args: { mode: 'pro' },
  plan: mkPlan([
    { frd: 'frd-06-one', deps: [], workOrders: [mkWo('wo-06-101', 'PLANNED', { frd: 'frd-06-one', artifacts: ['src/one/**'] })] },
  ]),
  responses: [
    { label: 'safe-point', response: { stop: true }, times: 1 },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(run.result && run.result.stopReason === 'rethink', `stopReason is 'rethink' (got ${run.result && run.result.stopReason})`)
    t.ok(byLabel(run, /^(dispatch|build|gate):/).length === 0, 'nothing was built or gated after the rethink stop')
    t.ok(hasLog(run, /rethink_pending/), 'the stop is logged with its reason')
    t.ok(byLabel(run, 'notify-end').length === 1, 'the run still closes out (notify-end) so status.yaml gets running:false')
  },
})

// ── 7. WS-A/D3 — a WO whose dep is BLOCKED must NOT build (fail-closed) ───────
// wo-07-001 is BLOCKED; wo-07-002 depends on it. A BLOCKED WO is neither in doneIds nor globalQueue,
// so the ready filter's `!globalQueue.has(d)` clause used to read it as SATISFIED and build wo-07-002
// against a blocked dependency (fail-OPEN). With blockedIds the dep fails CLOSED: wo-07-002 never
// builds and its FRD blocks needs-owner (the owner must clear the block).
SCENARIOS.push({
  name: '7. blocked-dependency fail-closed — a WO whose dep is BLOCKED is never built (WS-A/D3)',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-07-blockdep',
    deps: [],
    workOrders: [
      mkWo('wo-07-001', 'BLOCKED', { frd: 'frd-07-blockdep', artifacts: ['src/blk/**'] }),
      mkWo('wo-07-002', 'PLANNED', { frd: 'frd-07-blockdep', artifacts: ['src/dep/**'], deps: ['wo-07-001'] }),
    ],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'build:wo-07-002').length === 0, 'wo-07-002 was NEVER built (its dependency wo-07-001 is BLOCKED) — the fail-open would have built it')
    t.ok(run.result && run.result.blockedFrds.includes('frd-07-blockdep'), 'the FRD is blocked, not built')
    t.ok(run.result && run.result.blockedReasons['frd-07-blockdep'] === 'needs-owner', `blocked as needs-owner (the owner must clear the block) — got ${run.result && run.result.blockedReasons['frd-07-blockdep']}`)
    t.ok(!run.result || !run.result.builtFrds.includes('frd-07-blockdep'), 'the FRD is not in builtFrds')
    t.ok(hasLog(run, /a dependency is BLOCKED/), 'the stop is logged as a blocked dependency, not a generic circular-dep error')
  },
})

// ── 8. WS-A (V1b#2) — all FRDs verified but hardening FAILS → NOT released ────
// The branch BL-0012's real incident came through, previously untested: security hardening returns
// done:false, so the run must take close-needs-hardening (KEEP phase: implementation), NOT close-out
// (which is the only path allowed to set phase: release).
SCENARIOS.push({
  name: '8. hardening-failure close — verified but hardening incomplete keeps phase: implementation (BL-0012)',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-08-harden',
    deps: [],
    workOrders: [mkWo('wo-08-001', 'PLANNED', { frd: 'frd-08-harden', artifacts: ['src/h/**'] })],
  }]),
  responses: [
    // RFC-30 N4: the read-only auditor completes (writes the report); the FIX spawn fails to clear a
    // Critical → hardening incomplete, so no release.
    { label: 'hardening:security-fix', response: { done: false, failure: 'simulated Critical finding left open' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(run.result && run.result.builtFrds.includes('frd-08-harden'), 'the FRD did verify (build + gate green)')
    t.ok(byLabel(run, 'hardening:security-audit').length === 1 && byLabel(run, 'hardening:security-fix').length === 1 && byLabel(run, 'hardening:telemetry').length === 1, 'the audit-then-fix security split + telemetry all ran')
    t.ok(byLabel(run, 'close-needs-hardening').length === 1, 'the hardening-failure close ran (close-needs-hardening)')
    t.ok(byLabel(run, 'close-out').length === 0, 'the release close-out (the only phase: release writer) did NOT run')
    const c = byLabel(run, 'close-needs-hardening')[0]
    t.ok(c && /KEEP phase: implementation/.test(c.prompt), 'the close keeps phase: implementation (BL-0012 fail-closed — no release without hardening evidence)')
    t.ok(c && /running: false/.test(c.prompt), 'the close still writes running: false so Mission Control shows no phantom build')
  },
})

// ── 9. WS-A/D1 — durable change archival is disk-driven, not in-session ───────
// A targeted change build: processChange must STAMP the change file `status: building` + `affected_frds`
// (so it survives across runs and is not re-drained), the safe-point drain must SKIP `building`, and the
// close-out archive sweep must scan the queue for `building` changes (disk-driven) — never rely on an
// in-session list. This is a STRUCTURAL test (the prompts carry the durable contract; the agents' real
// file effects are stubbed) — full cross-run fidelity needs a live multi-run build.
SCENARIOS.push({
  name: '9. durable change archival — building-stamp + disk-driven sweep, no in-session ledger (WS-A/D1)',
  args: { mode: 'pro', change: 'my-change' },
  plan: mkPlan([{
    frd: 'frd-09-chg',
    deps: [],
    workOrders: [mkWo('wo-09-001', 'PLANNED', { frd: 'frd-09-chg', artifacts: ['src/chg/**'] })],
  }]),
  responses: [
    { label: /^process-change:/, response: { done: true, affectedFrds: ['frd-09-chg'], changeFile: 'my-change.md' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const proc = byLabel(run, /^process-change:/)[0]
    t.ok(proc && /status: building/.test(proc.prompt), 'processChange stamps the change file status: building (durable, not re-drained)')
    t.ok(proc && /affected_frds/.test(proc.prompt), 'processChange records affected_frds on the change file (the durable ledger)')
    const sp = byLabel(run, 'safe-point')[0]
    // This is a TARGETED change build (change: 'my-change') → the safe point no longer scans the queue
    // (DR-069 targeted-build scope, 2026-07-06). The "skip already-in-flight building changes" coverage
    // for a BARE drain now lives in scenario 10c.
    t.ok(sp && /TARGETED BUILD/.test(sp.prompt), 'a targeted change build does NOT scan the queue at the safe point (only its own change is built)')
    const arch = byLabel(run, 'archive-changes')[0]
    t.ok(arch, 'the archive sweep ran at close-out (this run verified an FRD)')
    t.ok(arch && /status.{0,3}is.{0,3}"building"|status\W+building|"building"/.test(arch.prompt), 'the archive sweep scans the queue for building changes (disk-driven)')
    t.ok(arch && /affected_frds/.test(arch.prompt) && /VERIFIED/.test(arch.prompt), 'the sweep archives a change only when all its affected_frds are VERIFIED (read from disk, cross-run)')
    t.ok(run.result && run.result.builtFrds.includes('frd-09-chg'), 'the change FRD built and verified')
  },
})

// ── 10. DR-069 TARGETED-BUILD SCOPE (owner incident 2026-07-06) ──────────────
// A build launched with a specific `change` OR `frds` implements ONLY that target
// and must NOT drain OTHER `ready` changes sitting in the queue. Only a bare
// `/implement` (no change, no frds) drains everything. The JS guard in safePoint()
// is the hard enforcement — proven here by FORCING the safe-point response to leak
// a ready item and asserting it is never processed.
SCENARIOS.push({
  name: '10a. targeted frds build does NOT drain other ready changes (JS guard holds even if a ready item leaks)',
  args: { mode: 'pro', frds: ['frd-10-tgt'] },
  plan: mkPlan([{
    frd: 'frd-10-tgt',
    deps: [],
    workOrders: [mkWo('wo-10-001', 'PLANNED', { frd: 'frd-10-tgt', artifacts: ['src/tgt/**'] })],
  }]),
  responses: [
    // simulate a ready change sitting in the queue — the guard must refuse to drain it
    { label: 'safe-point', response: { stop: false, ready: ['other-queued-change'], unblocked: [] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const sp = byLabel(run, 'safe-point')[0]
    t.ok(sp && /TARGETED BUILD/.test(sp.prompt), 'the safe-point prompt tells the agent this is a TARGETED build (do not scan the queue)')
    t.ok(byLabel(run, /^process-change:/).length === 0, 'NO other queued change is processed (frds build never drains the queue)')
    t.ok(byLabel(run, /^plan-drained:/).length === 0, 'no drained-change re-plan happened')
    t.ok(hasLog(run, /Build dirigido.*NO se drenan/), 'the guard logs that the ready change was intentionally left in the queue')
    t.ok(!hasLog(run, /Drenando \d+ change/), 'the drain path never ran')
    t.ok(run.result && run.result.builtFrds.includes('frd-10-tgt'), 'only the targeted FRD built')
  },
})
SCENARIOS.push({
  name: '10b. targeted change build does NOT drain a DIFFERENT ready change (the exact incident)',
  args: { mode: 'pro', change: 'my-target-change' },
  plan: mkPlan([{
    frd: 'frd-10-chg',
    deps: [],
    workOrders: [mkWo('wo-10-101', 'PLANNED', { frd: 'frd-10-chg', artifacts: ['src/chg/**'] })],
  }]),
  responses: [
    { label: 'process-change:my-target-change', response: { done: true, affectedFrds: ['frd-10-chg'], changeFile: 'my-target-change.md' } },
    // a DIFFERENT change is ready in the queue — must NOT be swept into this targeted run
    { label: 'safe-point', response: { stop: false, ready: ['other-queued-change'], unblocked: [] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const procs = byLabel(run, /^process-change:/)
    t.ok(procs.length === 1, `exactly one change is processed — the target (got ${procs.length})`)
    t.ok(procs[0] && procs[0].label === 'process-change:my-target-change', 'the one processed change is the target')
    t.ok(!procs.some((c) => /other-queued-change/.test(c.label)), 'the DIFFERENT ready change is never processed')
    t.ok(hasLog(run, /Build dirigido.*NO se drenan.*other-queued-change/), 'the guard names the deferred change in the log')
    t.ok(!hasLog(run, /Drenando \d+ change/), 'the drain path never ran')
    t.ok(run.result && run.result.builtFrds.includes('frd-10-chg'), 'only the target change FRD built')
  },
})
SCENARIOS.push({
  name: '10c. bare /implement STILL drains the ready queue (no regression to DR-069)',
  args: { mode: 'pro' }, // no change, no frds → TARGETED === false
  plan: mkPlan([{
    frd: 'frd-10-bare',
    deps: [],
    workOrders: [mkWo('wo-10-201', 'PLANNED', { frd: 'frd-10-bare', artifacts: ['src/bare/**'] })],
  }]),
  responses: [
    { label: 'safe-point', times: 1, response: { stop: false, ready: ['queued-change'], unblocked: [] } },
    { label: 'process-change:queued-change', response: { done: true, affectedFrds: [] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const sp = byLabel(run, 'safe-point')[0]
    t.ok(sp && /List .pandacorp\/inbox\/changes/.test(sp.prompt), 'a bare build uses the normal drain prompt (scans the queue)')
    t.ok(!/TARGETED BUILD/.test(sp.prompt), 'the bare build safe-point prompt is NOT the targeted variant')
    t.ok(/Skip draft\/done\/building/.test(sp.prompt), 'the bare drain skips already-in-flight building changes (WS-A/D1)')
    t.ok(hasLog(run, /Drenando \d+ change/), 'the drain path runs on a bare build')
    t.ok(byLabel(run, 'process-change:queued-change').length === 1, 'the queued change IS processed (drained)')
    t.ok(!hasLog(run, /Build dirigido.*NO se drenan/), 'the targeted-scope guard never fires on a bare build')
    t.ok(run.result && run.result.builtFrds.includes('frd-10-bare'), 'the bare build still builds its own FRD')
  },
})

// ── 11. WS-D/D10 — owner stop signal (.pandacorp/run/stop) exits clean before building ──
SCENARIOS.push({
  name: '11. WS-D/D10 owner stop signal — the pre-check {stop:true} exits clean (no baseline, no plan)',
  args: { mode: 'pro' },
  responses: [{ label: 'baseline-precheck', response: { stop: true } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(run.result && run.result.note === 'owner stop signal', `result note is the owner stop (got ${run.result && run.result.note})`)
    t.ok(byLabel(run, 'baseline').length === 0, 'the judge baseline never ran (the pre-check short-circuited)')
    t.ok(byLabel(run, 'plan').length === 0, 'the planner never ran')
    t.ok(byLabel(run, 'ensure-stopped').length === 1, 'ensureStopped ran (running:false guaranteed even on this early exit)')
    t.ok(hasLog(run, /owner stop signal/), 'the stop is logged')
  },
})

// ── 12. WS-D/D3 — a null/garbled planner verdict fails LOUD (not "all verified") ──
SCENARIOS.push({
  name: '12. WS-D/D3 planner fail-loud — a garbled plan is NOT silently declared all-verified',
  args: { mode: 'pro' },
  responses: [{ label: 'plan', response: {} }],   // no `frds` array → garbled
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(run.result && run.result.note === 'planner failed', `note is 'planner failed' not 'all verified' (got ${run.result && run.result.note})`)
    t.ok(run.result && run.result.blockedReasons && run.result.blockedReasons.plan === 'error', 'the plan is blocked error')
    t.ok(byLabel(run, 'ensure-stopped').length === 1, 'ensureStopped ran (running:false guaranteed)')
    t.ok(byLabel(run, 'sync-rollups').length === 0, 'it bailed before sync-rollups (right after the plan guard)')
    t.ok(hasLog(run, /fail-loud/), 'the fail-loud reason is logged')
  },
})

// ── 13. WS-D/D7 — a WO id reused across two FRDs blocks the second (no silent overwrite) ──
SCENARIOS.push({
  name: '13. WS-D/D7 duplicate WO id across FRDs — the second FRD is blocked, not silently overwritten',
  args: { mode: 'pro' },
  plan: mkPlan([
    { frd: 'frd-13-a', deps: [], workOrders: [mkWo('wo-dup-1', 'PLANNED', { frd: 'frd-13-a', artifacts: ['src/a/**'] })] },
    { frd: 'frd-13-b', deps: [], workOrders: [mkWo('wo-dup-1', 'PLANNED', { frd: 'frd-13-b', artifacts: ['src/b/**'] })] },
  ]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(hasLog(run, /duplicate ids across FRDs/), 'the collision is logged loudly')
    t.ok(run.result && run.result.blockedReasons && run.result.blockedReasons['frd-13-b'] === 'error', `frd-13-b is blocked error (got ${run.result && run.result.blockedReasons && run.result.blockedReasons['frd-13-b']})`)
    t.ok(run.result && run.result.builtFrds.includes('frd-13-a'), 'the FIRST FRD (which owns the id legitimately) still builds')
    t.ok(byLabel(run, 'build:wo-dup-1').length === 1, 'the shared id is only ever built once (the first FRD; the second never dispatched)')
  },
})

// ── 14. WS-D/D13 — a WO-level dependency cycle is caught up front (needs-owner, named) ──
SCENARIOS.push({
  name: '14. WS-D/D13 dependency cycle — a wo-a↔wo-b cycle blocks the FRD needs-owner up front',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-14-cyc',
    deps: [],
    workOrders: [
      mkWo('wo-14-a', 'PLANNED', { frd: 'frd-14-cyc', artifacts: ['src/a/**'], deps: ['wo-14-b'] }),
      mkWo('wo-14-b', 'PLANNED', { frd: 'frd-14-cyc', artifacts: ['src/b/**'], deps: ['wo-14-a'] }),
    ],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(hasLog(run, /Work-order dependency CYCLE detected/), 'the cycle is named in the log (not a late generic stall)')
    t.ok(run.result && run.result.blockedReasons && run.result.blockedReasons['frd-14-cyc'] === 'needs-owner', `the FRD is blocked needs-owner (got ${run.result && run.result.blockedReasons && run.result.blockedReasons['frd-14-cyc']})`)
    t.ok(byLabel(run, /^build:/).length === 0, 'nothing is built (the cycle is refused before any wave)')
    t.ok(run.result && run.result.builtFrds.length === 0, 'no FRD verifies')
  },
})

// ── 15. WS-D/D14 — an answered-decision unblock takes effect THIS run (re-enrolled) ──
SCENARIOS.push({
  name: '15. WS-D/D14 unblock re-enroll — a BLOCKED WO flipped by the safe point builds THIS run',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-15-unb',
    deps: [],
    workOrders: [mkWo('wo-15-blk', 'BLOCKED', { frd: 'frd-15-unb', artifacts: ['src/u/**'] })],
  }]),
  responses: [
    { label: 'safe-point', times: 1, response: { stop: false, ready: [], unblocked: [{ frd: 'frd-15-unb', wo: 'wo-15-blk' }] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(hasLog(run, /re-enrolado ESTA corrida: wo-15-blk/), 'the unblocked WO is re-enrolled into THIS run, not deferred')
    t.ok(byLabel(run, 'build:wo-15-blk').length === 1, 'the unblocked WO builds this run (was BLOCKED, now PLANNED and scheduled)')
    t.ok(run.result && run.result.builtFrds.includes('frd-15-unb'), 'its FRD verifies this run')
  },
})

// ── 16. WS-D/D1 — a green build whose COMMIT fails is not "done" → routed to repair ──
SCENARIOS.push({
  name: '16. WS-D/D1 commit failure — a green-but-uncommitted WO fails its FRD into repair (not doneIds)',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-16-cf',
    deps: [],
    workOrders: [mkWo('wo-16-cf1', 'PLANNED', { frd: 'frd-16-cf', artifacts: ['src/cf/**'] })],
  }]),
  responses: [
    { label: 'commit:wo-16-cf1', response: () => { throw new Error('simulated commit failure') } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error} (a commit failure must NOT reject the wave)`)
    t.ok(hasLog(run, /commit failed for wo-16-cf1/), 'the commit failure is caught + logged (the wave is not rejected)')
    t.ok(byLabel(run, /^repair:/).length === 1, 'the green-but-uncommitted WO routed its FRD into attemptRepair (not silently done)')
  },
})

// ── 17. C1a serial-first — the FIRST gate runs SERIAL even in a reviewSplit mode (powerful) ──────────
// reviewSplit is ON in powerful mode, but C1a makes the FRD's FIRST gate this run run SERIAL (the split
// only kicks in on a re-gate or a WO already reopened on a prior run). Proven by spawn labels: the split
// gate spawns `find:<lens>:<frd>` finders; the serial gate does not. No finders ⇒ the first gate was serial.
SCENARIOS.push({
  name: '17. C1a serial-first — the FIRST gate runs SERIAL even in powerful mode (no split finders)',
  args: { mode: 'powerful' },
  plan: mkPlan([{
    frd: 'frd-17-serial',
    deps: [],
    workOrders: [mkWo('wo-17-001', 'PLANNED', { frd: 'frd-17-serial', artifacts: ['src/s/**'] })],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^find:/).length === 0, 'NO split finder lenses spawned on the first gate (serial-first, C1a)')
    t.ok(byLabel(run, /^verify-finding:/).length === 0, 'no adversarial verifiers spawned (the split gate never ran)')
    const gate = byLabel(run, 'gate:frd-17-serial')
    t.ok(gate.length === 1, `exactly one (serial) gate ran (got ${gate.length})`)
    t.ok(gate[0] && gate[0].opts.effort === 'xhigh', 'the SERIAL gate keeps effort xhigh (C1d — only the split closer drops to high)')
    t.ok(hasLog(run, /first gate attempt this run — running SERIAL/), 'the serial-first choice is logged (C1a)')
    t.ok(run.result && run.result.builtFrds.includes('frd-17-serial'), 'the FRD verifies via the serial gate')
  },
})

// ── 18. C1a split-on-reopen — a WO already reopened on a prior run (reopen_count≥1) takes the SPLIT gate ──
// even on its FIRST gate THIS run. Proven by spawn labels: the 4 finder lenses spawn, and the CLOSE stage
// (label gate:<frd>) drops to effort high (C1d).
SCENARIOS.push({
  name: '18. C1a split-on-reopen — a prior-reopened WO (reopen_count≥1) uses the SPLIT gate (finder lenses spawn)',
  args: { mode: 'powerful' },
  plan: mkPlan([{
    frd: 'frd-18-split',
    deps: [],
    workOrders: [mkWo('wo-18-001', 'PLANNED', { frd: 'frd-18-split', artifacts: ['src/sp/**'], reopen_count: 1 })],
  }]),
  responses: [
    { label: /^find:/, response: { findings: [] } },   // clean finder sweep → no corrections → the closer greens
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const finders = byLabel(run, /^find:/)
    t.ok(finders.length === 4, `the 4 split finder lenses spawned — a reopen_count≥1 WO triggers the split on its first gate this run (got ${finders.length})`)
    t.ok(byLabel(run, 'find:correctness:frd-18-split').length === 1, 'the correctness finder lens spawned (proves the SPLIT path, not serial)')
    const close = byLabel(run, 'gate:frd-18-split')
    t.ok(close.length === 1, 'the split CLOSE stage ran (label gate:<frd>)')
    t.ok(close[0] && close[0].opts.effort === 'high', 'the split closer drops to effort high (C1d — the finders already hunted)')
    t.ok(run.result && run.result.builtFrds.includes('frd-18-split'), 'the FRD verifies through the split gate')
  },
})

// ── 19. A3 recovery ladder — patch-1 code-fail → diagnose(point,fresh) → PATCH-2 diagnosis-guided ────
// The new progressive-learning ladder: a localized reject whose patch-1 fails on real code no longer
// reverts blindly — it DIAGNOSES, and a fresh 'point' diagnosis buys ONE more diagnosis-guided patch
// (patch-2) before any revert. Proven by spawn labels: diagnose spawns once, patch spawns twice, and
// the 2nd patch carries the diagnosis text.
SCENARIOS.push({
  name: '19. A3 recovery — patch-1 code-fail → diagnose(point,fresh) → patch-2 spawns with the diagnosis injected',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-19-recovery',
    deps: [],
    workOrders: [mkWo('wo-19-001', 'PLANNED', { frd: 'frd-19-recovery', artifacts: ['src/r/**'] })],
  }]),
  responses: [
    { label: 'gate:frd-19-recovery', times: 1, response: { green: false, reopen: ['wo-19-001'], findings: [{ wo: 'wo-19-001', finding: 'off-by-one at src/r/a.ts:12', failingTest: 'a.spec.ts', files: ['src/r/a.ts'] }] } },
    { label: 'patch:frd-19-recovery', response: { green: false, cause: 'code', failure: 'still red' } }, // both patch-1 AND patch-2 fail on code
    { label: 'diagnose:frd-19-recovery', response: { classification: 'point', repeatsPrior: false, recommendation: 'patch', confidence: 'medium', seam: { files: ['src/r/a.ts'], symbol: 'foo', why: 'off-by-one', cleanlySeparable: true } } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^diagnose:/).length === 1, `the diagnoser spawned exactly once after patch-1's code-fail (got ${byLabel(run, /^diagnose:/).length})`)
    const patches = byLabel(run, /^patch:/)
    t.ok(patches.length === 2, `patch spawned TWICE — patch-1 + the diagnosis-guided patch-2 (got ${patches.length})`)
    t.ok(patches[1] && /DIAGNOSIS OF WHY PATCH-1 FAILED/.test(patches[1].prompt), 'patch-2 carries the injected diagnosis (A3)')
    t.ok(patches[1] && /SECOND diagnosis-guided attempt/.test(patches[1].prompt), 'patch-2 is labelled the SECOND diagnosis-guided attempt')
    t.ok(byLabel(run, /^block-needs-owner:/).length === 0, 'a fresh point diagnosis does NOT early-block')
    t.ok(hasLog(run, /patch-2 \(2\/2\), diagnosis-guided/), 'the ladder logs the patch-2 step (2/2, PATCH_ATTEMPT_CAP)')
    t.ok(run.result && run.result.builtFrds.includes('frd-19-recovery'), 'the FRD converges (the in-run retry re-gate greens)')
  },
})

// ── 20. A3 recovery — diagnose(point, repeats, cleanly separable) → PARTIAL revert (seam files only) ──
SCENARIOS.push({
  name: '20. A3 recovery — repeats-prior + cleanly-separable → PARTIAL revert restricted to the seam + retry',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-20-seam',
    deps: [],
    workOrders: [mkWo('wo-20-001', 'PLANNED', { frd: 'frd-20-seam', artifacts: ['src/s/**'] })],
  }]),
  responses: [
    { label: 'gate:frd-20-seam', times: 1, response: { green: false, reopen: ['wo-20-001'], findings: [{ wo: 'wo-20-001', finding: 'recurring null-guard at src/s/seam.ts:8', failingTest: 'seam.spec.ts', files: ['src/s/seam.ts'] }] } },
    { label: 'patch:frd-20-seam', response: { green: false, cause: 'code', failure: 'still red' } },
    { label: 'diagnose:frd-20-seam', response: { classification: 'point', repeatsPrior: true, recommendation: 'partial-revert', confidence: 'medium', seam: { files: ['src/s/seam.ts'], symbol: 'guard', why: 'missing null-guard', cleanlySeparable: true } } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^diagnose:/).length === 1, 'the diagnoser spawned once')
    t.ok(byLabel(run, /^patch:/).length === 1, 'NO patch-2 — a repeats-prior diagnosis does not re-patch, it reverts')
    const reverts = byLabel(run, /^revert:/)
    t.ok(reverts.length >= 1, `a revert ran (got ${reverts.length})`)
    t.ok(reverts[0] && /src\/s\/seam\.ts/.test(reverts[0].prompt), 'the revert prompt names the seam file (src/s/seam.ts)')
    t.ok(reverts[0] && /PARTIAL revert/.test(reverts[0].prompt) && /restricted to the diagnosed seam/.test(reverts[0].prompt), 'the revert is a PARTIAL, seam-restricted revert (A3)')
    t.ok(reverts[0] && /the diagnosis proved the fault is confined to the seam/.test(reverts[0].prompt), 'COMMIT 2 discards ONLY the seam files, leaving other touched files in place')
    t.ok(hasLog(run, /PARTIAL revert restricted to the seam/), 'the ladder logs the partial-revert choice')
    t.ok(run.result && run.result.builtFrds.includes('frd-20-seam'), 'the FRD converges after the seam retry')
  },
})

// ── 21. A3 recovery — diagnose(architectural, high) → EARLY BLOCK needs-owner (no patch-2, no retry) ──
SCENARIOS.push({
  name: '21. A3 recovery — architectural (confidence high) → early BLOCK needs-owner, no patch-2/retry',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-21-arch',
    deps: [],
    workOrders: [mkWo('wo-21-001', 'PLANNED', { frd: 'frd-21-arch', artifacts: ['src/arch/**'] })],
  }]),
  responses: [
    { label: 'gate:frd-21-arch', times: 1, response: { green: false, reopen: ['wo-21-001'], findings: [{ wo: 'wo-21-001', finding: 'AC unsatisfiable against the blueprint', files: ['src/arch/a.ts', 'src/arch/b.ts', 'src/arch/c.ts', 'src/arch/d.ts'] }] } },
    { label: 'patch:frd-21-arch', response: { green: false, cause: 'code', failure: 'cannot satisfy the AC' } },
    { label: 'diagnose:frd-21-arch', response: { classification: 'architectural', repeatsPrior: true, recommendation: 'block-needs-owner', confidence: 'high', decisionRecord: 'El AC no es satisfacible contra el blueprint — decisión del owner.' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^diagnose:/).length === 1, 'the diagnoser spawned once')
    t.ok(byLabel(run, /^patch:/).length === 1, 'only patch-1 ran — an architectural diagnosis does NOT get a patch-2')
    const block = byLabel(run, /^block-needs-owner:/)
    t.ok(block.length === 1, `the early-block spawn ran exactly once (got ${block.length})`)
    t.ok(block[0] && /inbox\/decisions\.md/.test(block[0].prompt), 'the block appends the decision record to .pandacorp/inbox/decisions.md')
    t.ok(block[0] && /BLOCKED/.test(block[0].prompt) && /needs-owner/.test(block[0].prompt), 'the block sets the WOs BLOCKED needs-owner')
    t.ok(byLabel(run, /^revert:/).length === 0, 'NO standalone revert spawn — the block does its own revert (no wasted reopen)')
    t.ok(byLabel(run, /^build:/).length === 1, 'NO in-run retry rebuild — only the original build ran')
    t.ok(run.result && run.result.blockedReasons && run.result.blockedReasons['frd-21-arch'] === 'needs-owner', `the FRD is blocked needs-owner (got ${run.result && run.result.blockedReasons && run.result.blockedReasons['frd-21-arch']})`)
    t.ok(!run.result || !run.result.builtFrds.includes('frd-21-arch'), 'the FRD is NOT built')
    t.ok(hasLog(run, /early BLOCK needs-owner, NOT burning the remaining reopens/), 'the ladder logs the early-block rationale')
  },
})

// ── 22. A3 honest degrade — at the agent ceiling, patch-1 code-fail does NOT diagnose (legacy revert) ──
// maxAgents=16 (mode pro): the loop-top brake passes at the gate iteration (12<16), but the serial gate
// (+3) and patch-1 (+3, opus) push agentSpawned to 18 ≥ 16, so capHit() is true when the ladder decides.
// The diagnose spawn is skipped (it would cost another COST(judge)); the legacy revert path runs instead.
SCENARIOS.push({
  name: '22. A3 honest degrade — capHit at patch-1 code-fail skips the diagnosis (legacy revert path)',
  args: { mode: 'pro', maxAgents: 16 },
  plan: mkPlan([{
    frd: 'frd-22-cap',
    deps: [],
    workOrders: [mkWo('wo-22-001', 'PLANNED', { frd: 'frd-22-cap', artifacts: ['src/cap/**'] })],
  }]),
  responses: [
    { label: 'gate:frd-22-cap', times: 1, response: { green: false, reopen: ['wo-22-001'], findings: [{ wo: 'wo-22-001', finding: 'x', files: ['src/cap/a.ts'] }] } },
    { label: 'patch:frd-22-cap', response: { green: false, cause: 'code', failure: 'still red' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^diagnose:/).length === 0, 'the diagnoser NEVER spawned — capHit() is true, so the A3 ladder honest-degrades to the legacy revert')
    t.ok(byLabel(run, /^patch:/).length === 1, 'only patch-1 ran (no patch-2 without a diagnosis)')
    t.ok(byLabel(run, /^revert:/).length === 1, 'the legacy revert path ran (revert spawn)')
    t.ok(hasLog(run, /agent ceiling reached — skipping the A3 diagnosis/), 'the honest-degrade reason is logged')
    t.ok(run.result && run.result.stopReason === 'agents', `the run stops at the agent ceiling (got ${run.result && run.result.stopReason})`)
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
  if (run.unmatched.length) {
    console.log(`  [info] ${s.name} — unmatched agent labels (answered {}): ${[...new Set(run.unmatched)].join(', ')}`)
  }
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
