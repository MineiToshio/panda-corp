#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// test-pandacorp-build.mjs — the FIRST automated test harness for the Pandacorp
// build engine (plugin/templates/shared/.claude/workflows/pandacorp-build.js).
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
const ENGINE_PATH = path.resolve(__dirname, '../templates/shared/.claude/workflows/pandacorp-build.js')

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
  if (/^(repair|patch|gate-test-repair|verify-patch|revert|foundation-repair):/.test(label)) return { green: true } // REPAIR_SCHEMA
  if (/^(process-change|plan-drained):/.test(label)) return { done: true, affectedFrds: [], frds: [] }
  if (/^(hardening:security|hardening:telemetry|close-out|close-needs-hardening|notify-end|ensure-stopped|archive-changes)$/.test(label)) return { done: true } // STOP_SCHEMA
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
  name: '1b. args guard — args as a JSON STRING fires the string warning',
  args: '{"mode":"pro","maxAgents":10}',
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const warn = run.logs.find((l) => l.includes('⚠⚠'))
    t.ok(Boolean(warn), 'a ⚠⚠ warning log line fires when args is a string')
    t.ok(warn && /NOT an object/.test(warn), 'the warning says args is NOT an object')
    t.ok(warn && /string/.test(warn), 'the warning names the actual typeof (string)')
    t.ok(warn && /UNBOUNDED/.test(warn), 'the warning says the run is UNBOUNDED')
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
// 2a: mode 'pro' (judge=sonnet, COST 1 each). Pre-loop spawns: baseline(1) +
// plan(1) + sync-rollups(1) = 3. maxAgents=6 → iteration 1 passes the brake
// (3<6), safe-point(+1)=4, waveMax=min(2, 6-4)=2 → dispatch(+1)=5, builds
// wo-1+wo-2 (+2)=7, commits (+2)=9. Iteration 2 top: 9 ≥ 6 → STOP. wo-3/wo-4
// must never be dispatched.
SCENARIOS.push({
  name: '2a. maxAgents brake — stops dispatching new waves once the cap is reached',
  args: { mode: 'pro', maxAgents: 6 },
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
    t.ok(hasLog(run, /Agent ceiling reached \(\d+ ≥ maxAgents 6\)/), 'the brake logs "Agent ceiling reached (N ≥ maxAgents 6)"')
    const built = byLabel(run, /^build:/).map((c) => c.label)
    t.ok(built.length === 2 && built.includes('build:wo-01-001') && built.includes('build:wo-01-002'),
      `only the first wave (wo-01-001, wo-01-002) was built — got [${built.join(', ')}]`)
    t.ok(byLabel(run, 'build:wo-01-003').length === 0 && byLabel(run, 'build:wo-01-004').length === 0,
      'wo-01-003/wo-01-004 were never dispatched after the cap')
    t.ok(byLabel(run, /^gate:/).length === 0, 'no FRD gate ran (the FRD still had unbuilt WOs)')
    const end = byLabel(run, 'notify-end')[0]
    t.ok(end && /techo de agentes/.test(end.prompt), 'the end-of-run report tells the owner the stop was the agent ceiling')
  },
})
// 2b: COST-weighting proof. mode 'balanced' (judge=opus, COST 3). Pre-loop:
// baseline(3) + plan(3) + sync(1) = 7. With maxAgents=7 the brake trips at the
// FIRST loop boundary — BEFORE any safe-point/dispatch/build. If spawns were
// counted raw (1 each) the counter would read 3 and the wave would launch.
SCENARIOS.push({
  name: '2b. maxAgents brake is COST-weighted (opus=3) — trips on the token-proxy, not the raw agent count',
  args: { mode: 'balanced', maxAgents: 7 },
  plan: mkPlan([{
    frd: 'frd-01-alpha',
    deps: [],
    workOrders: [mkWo('wo-01-001', 'PLANNED', { frd: 'frd-01-alpha', artifacts: ['src/a/**'] })],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(run.result && run.result.stopReason === 'agents', `stopReason is 'agents' (got ${run.result && run.result.stopReason})`)
    t.ok(hasLog(run, /Agent ceiling reached \(7 ≥ maxAgents 7\)/),
      'counter reads exactly 7 = COST(opus baseline 3) + COST(opus plan 3) + sync 1 — the opus weighting is live')
    t.ok(byLabel(run, 'safe-point').length === 0, 'brake trips BEFORE the first safe point')
    t.ok(byLabel(run, /^(dispatch|build):/).length === 0, 'no wave was dispatched at all')
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
    t.ok(byLabel(run, 'hardening:security').length === 1 && byLabel(run, 'hardening:telemetry').length === 1,
      'the all-done path ran both DR-085 hardening steps before close-out')
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

// ── 6. safePoint cadence — the DR-069 sweep runs at every wave/gate boundary ──
SCENARIOS.push({
  name: '6a. safe-point cadence — the DR-069 sweep runs at each boundary, before every FRD gate',
  args: { mode: 'pro' },
  plan: mkPlan([
    { frd: 'frd-06-one', deps: [], workOrders: [mkWo('wo-06-101', 'PLANNED', { frd: 'frd-06-one', artifacts: ['src/one/**'] })] },
    { frd: 'frd-06-two', deps: [], workOrders: [mkWo('wo-06-201', 'PLANNED', { frd: 'frd-06-two', artifacts: ['src/two/**'] })] },
  ]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const sp = byLabel(run, 'safe-point')
    const gates = byLabel(run, /^gate:/)
    t.ok(gates.length === 2, `both FRD gates ran (got ${gates.length})`)
    t.ok(sp.length >= 3, `the safe point ran at every boundary — ≥3 times in a 1-wave + 2-gate run (got ${sp.length})`)
    // Order: a fresh safe-point call precedes EACH gate (gates run one per loop
    // iteration, and each iteration opens with the safe point).
    let prevGate = -1
    for (const g of gates) {
      t.ok(sp.some((s) => s.index > prevGate && s.index < g.index),
        `a safe-point call runs between the previous boundary and gate '${g.label}'`)
      prevGate = g.index
    }
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
