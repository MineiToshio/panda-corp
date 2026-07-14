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
// BL-0067 source guard: the protected gate-worktree may contain the only crash evidence.
// The engine must never prescribe a destructive cleanup of that path.
if (/worktree remove\s+--force[^\n]*gate-worktree|rm\s+-rf[^\n]*gate-worktree/.test(source)) {
  console.error('FATAL: destructive gate-worktree cleanup returned to the engine source.')
  process.exit(1)
}
if (/baseline PRE-CHECK[\s\S]*?test -f[\s\S]*?run\/stop/.test(source) || !/inspect-stop --project/.test(source)) {
  console.error('FATAL: owner-stop detection is not bound to the deterministic Node receipt.')
  process.exit(1)
}
if (/Safe-point check[\s\S]*?(?:test\s+-f|\[\s+-[ef])[^\n]*run\/stop/.test(source) ||
    !/Safe-point check[\s\S]*?INSPECT_STOP/.test(source)) {
  console.error('FATAL: recurring safe-point stop detection is not exclusively bound to the fenced receipt.')
  process.exit(1)
}
if (!/close-preloop --project/.test(source) || !/agentType: 'pandacorp:devops'/.test(source) || /ensureStopped\(reason\)[\s\S]{0,900}agentType: 'pandacorp:implementer'/.test(source)) {
  console.error('FATAL: ensureStopped regained a broad implementer or lost its bounded close command.')
  process.exit(1)
}
if (/CLAUDE_PLUGIN_ROOT[^\n]*pandacorp-build-state/.test(source)) {
  console.error('FATAL: engine state commands regained an ambient CLAUDE_PLUGIN_ROOT dependency.')
  process.exit(1)
}
for (const command of ['sync-rollups', 'renew', 'inspect-stop', 'close-preloop', 'quiesce', 'finalize-release']) {
  if (!new RegExp(`STATE_CLI_COMMAND[^\\n]*${command}|${command}[^\\n]*STATE_CLI_COMMAND`).test(source)) {
    console.error(`FATAL: ${command} is not bound to the explicit stateCli capability.`)
    process.exit(1)
  }
}
// The only ESM syntax in the file is the meta export; neutralize it so the
// source is a valid function body. (We transform our in-memory copy — the
// engine file on disk is never touched.)
source = source.replace(/^export\s+const\s+meta/m, 'const meta')
// The args-guard scenario deliberately passes undefined. Neutralize only the lease receipt guard in
// this in-memory harness; production keeps it fail-closed and every behavioral fixture otherwise gets
// a fake receipt below.
source = source.replace("if (!LEASE_TOKEN || !LEASE_EPOCH) throw new Error('FATAL: atomic lease token/epoch missing — launch only through launch-implement.sh')", '')
if (/^\s*(export|import)\b/m.test(source)) {
  console.error('FATAL: engine still contains ESM syntax after the meta transform — update the harness loader.')
  process.exit(1)
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const engine = new AsyncFunction('agent', 'log', 'budget', 'args', 'phase', 'parallel', source)

// ── Default (schema-conformant) responses by label — the happy path ─────────
const validTraceability = ['requirement', 'acceptance-criterion', 'invariant', 'edge-case', 'limit', 'error', 'exclusion'].map((contractClass) => ({ contract: `${contractClass} fixture`, contractClass, status: ['edge-case', 'limit'].includes(contractClass) ? 'pass' : 'not-applicable', tests: ['edge-case', 'limit'].includes(contractClass) ? [`tests/${contractClass}.test.ts`] : [] }))
function defaultResponse(label) {
  // WS-D/D10: the baseline is now a two-step (cheap MECH pre-check → judge baseline). The default pre-check
  // ESCALATES so the judge baseline still runs and greens — the closest analogue of the old single spawn.
  if (label === 'baseline-precheck') return { escalate: true }          // PRECHECK_SCHEMA
  if (label === 'baseline') return { green: true }                      // VERIFY_SCHEMA
  if (label === 'plan') return { frds: [] }                             // PLAN_SCHEMA (empty → early exit)
  if (label === 'sync-rollups') return { corrected: 0 }
  if (label === 'safe-point') return { stop: false, stop_receipt: { status_exists: true, stop: false, method: 'node-lstat' }, ready: [], unblocked: [] } // SAFE_POINT_SCHEMA
  if (label === 'foundation-gate') return { complete: true }            // FOUNDATION_SCHEMA
  if (label === 'visual-qa') return { done: true }
  if (label.startsWith('dispatch:')) return {}
  if (label === 'gate-worktree') return { ok: true, created: true }         // C2: worktree prepared OK (happy path)
  if (label.startsWith('pin:')) return { sha: 'pinsha0' }                    // C2: the freeze sha
  if (label.startsWith('apply-gate:')) return { done: true }                // C2: serialized main-tree apply of a PASS
  if (label.startsWith('persist-block:')) return { done: true }             // C2: main-tree persist of a review-only gate block
  if (label.startsWith('commit:')) return { committed: 1 }
  if (/^(build|test|be|fe|selftest):/.test(label)) return { green: true } // VERIFY_SCHEMA
  if (label.startsWith('gate:')) return { green: true, traceability: validTraceability } // FRD_GATE_SCHEMA
  if (label.startsWith('diagnose:')) return { classification: 'point', repeatsPrior: false, recommendation: 'patch', confidence: 'medium' } // DIAGNOSE_SCHEMA (A2) — benign default (only the recovery-ladder scenarios reach it)
  if (label.startsWith('block-needs-owner:')) return { green: false, blocked_reason: 'needs-owner' } // A3 early-block spawn (REPAIR_SCHEMA)
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
      // G-package additive extension — scripted REJECTION: `throws` makes the agent stub REJECT (a
      // terminal API/tool error the engine's error boundaries must catch). No existing scenario sets
      // `throws`, so behavior is unchanged. (Scripted NULLs already work: `response: null` is returned
      // as-is here — matched before defaultResponse — so a scenario can simulate a dead/garbled agent.)
      if (r.throws !== undefined) throw (r.throws instanceof Error ? r.throws : new Error(String(r.throws)))
      const answer = typeof r.response === 'function' ? r.response(call) : r.response
      // Existing scenarios focus on queue/rethink behavior. Give their object verdicts the valid fenced
      // receipt the real CLI would return; null/explicit malformed receipts remain untouched for BL-0073.
      if (call.label === 'safe-point' && answer && typeof answer === 'object' && !('stop_receipt' in answer)) {
        return { ...answer, stop_receipt: { status_exists: true, stop: false, method: 'node-lstat' } }
      }
      return call.label.startsWith('gate:') && answer && typeof answer === 'object' && !answer.__splitFailed && !('traceability' in answer) ? { ...answer, traceability: validTraceability } : answer
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
  let engineArgs = scenario.args
  if (typeof engineArgs === 'string') {
    try { engineArgs = JSON.stringify({ stateCli: '/installed plugin/scripts/pandacorp-build-state.mjs', leaseToken: 'test-lease-token', leaseEpoch: 1, ...JSON.parse(engineArgs) }) } catch {}
  } else if (engineArgs && typeof engineArgs === 'object') engineArgs = { stateCli: '/installed plugin/scripts/pandacorp-build-state.mjs', leaseToken: 'test-lease-token', leaseEpoch: 1, ...engineArgs }
  try {
    result = await engine(agentStub, (l) => logs.push(String(l)), budget, engineArgs, (t) => phases.push(t), parallelStub)
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
  name: '1a. capability guard — missing stateCli fails before the first agent spawn',
  args: undefined,
  assert(t, run) {
    t.ok(Boolean(run.error) && /stateCli/.test(String(run.error)), 'missing stateCli throws a named fatal error')
    t.ok(run.calls.length === 0, 'missing stateCli spawns no agent')
  },
})
SCENARIOS.push({
  name: '11c. baseline repair excludes the controller-owned active status projection',
  args: { mode: 'pro' },
  responses: [{ label: 'baseline-precheck', response: { escalate: true, dirty: true } }, { label: 'baseline', response: { green: true } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const baseline = byLabel(run, 'baseline')[0]
    t.ok(baseline && /controller-owned[^\n]*\.pandacorp\/status\.yaml/i.test(baseline.prompt), 'repair prompt identifies status as controller-owned')
    t.ok(baseline && /NEVER checkout or restore[^\n]*\.pandacorp\/status\.yaml/i.test(baseline.prompt), 'repair prompt explicitly excludes status from restore')
    t.ok(baseline && /except \.pandacorp\/status\.yaml/.test(baseline.prompt), 'surgical tracked-file restore carries the exclusion')
  },
})
SCENARIOS.push({
  name: '1aa. capability guard — relative stateCli fails before the first agent spawn',
  args: { stateCli: 'scripts/pandacorp-build-state.mjs' },
  assert(t, run) {
    t.ok(Boolean(run.error) && /stateCli/.test(String(run.error)), 'relative stateCli throws a named fatal error')
    t.ok(run.calls.length === 0, 'relative stateCli spawns no agent')
  },
})
SCENARIOS.push({
  name: '11b. absent deterministic stop receipt reaches the planner despite hostile shell aliases',
  args: { mode: 'pro' },
  responses: [{ label: 'baseline-precheck', response: { green: true } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const precheck = byLabel(run, 'baseline-precheck')[0]
    t.ok(precheck && /inspect-stop --project/.test(precheck.prompt), 'precheck invokes the deterministic Node inspection')
    t.ok(precheck && /node '\/installed plugin\/scripts\/pandacorp-build-state\.mjs' inspect-stop/.test(precheck.prompt), 'state CLI paths containing spaces are shell-quoted exactly')
    t.ok(precheck && !/`test -f/.test(precheck.prompt), 'precheck does not use ambient shell test')
    t.ok(byLabel(run, 'plan').length === 1, 'an absent stop continues to planning')
    t.ok(!(run.result && run.result.note === 'owner stop signal'), 'absence was not fabricated into a stop')
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
    t.ok(/inspect-stop --project/.test(p) && /stop_receipt/.test(p), 'the recurring safe point executes and returns the fenced inspect-stop receipt')
    t.ok(!/`test\s+-f|`\[\s+-[ef]/.test(p), 'a successful ambient test alias cannot participate in stop truth')
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
    { label: 'safe-point', response: { stop: true, stop_receipt: { status_exists: true, stop: false, method: 'node-lstat' }, ready: [], unblocked: [] }, times: 1 },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(run.result && run.result.stopReason === 'rethink', `stopReason is 'rethink' (got ${run.result && run.result.stopReason})`)
    t.ok(byLabel(run, /^(dispatch|build|gate):/).length === 0, 'nothing was built or gated after the rethink stop')
    t.ok(hasLog(run, /señal fenced de stop\/rethink/), 'the stop is logged with its fenced/rethink reason')
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
    t.ok(byLabel(run, /^hardening:/).length === 0 && byLabel(run, 'close-out').length === 0, 'targeted FRD completion never widens into global hardening/release')
    t.ok(byLabel(run, 'notify-end').length === 1 && /Set \.pandacorp\/status\.yaml running: false/.test(byLabel(run, 'notify-end')[0].prompt), 'targeted FRD completion quiesces as a partial run')
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
    t.ok(byLabel(run, /^hardening:/).length === 0 && byLabel(run, 'close-out').length === 0, 'targeted change completion never widens into global hardening/release')
    t.ok(byLabel(run, 'notify-end').length === 1, 'targeted change completion follows the scoped terminal close')
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
    t.ok(byLabel(run, 'hardening:security-audit').length === 1 && byLabel(run, 'hardening:security-fix').length === 1 && byLabel(run, 'hardening:telemetry').length === 1, 'bare completion retains exactly one global hardening pass')
    t.ok(byLabel(run, 'close-out').length === 1 && byLabel(run, 'notify-end').length === 0, 'bare completion alone owns release close-out')
  },
})
SCENARIOS.push({
  name: '10d. already-verified targeted scope closes without global hardening',
  args: { mode: 'pro', frds: ['frd-10-done'] },
  plan: mkPlan([]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(run.result && run.result.note === 'all verified', 'already-verified target returns the bounded no-work result')
    t.ok(byLabel(run, /^hardening:/).length === 0 && byLabel(run, 'close-out').length === 0, 'already-verified targeted scope never dispatches global hardening/release')
    const stopped = byLabel(run, 'ensure-stopped')
    t.ok(stopped.length === 1 && /close-preloop --project/.test(stopped[0].prompt), 'already-verified target performs the fenced pre-loop close')
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

// ═════════════════════════════════════════════════════════════════════════════
// PACKAGE G — adversarial-audit coverage gaps (locked in BEFORE a deep scheduler change)
// Each scenario names the behavior it locks. KNOWN-GAP findings (current behavior that
// differs from the audit's stated intent) are marked `// KNOWN-GAP:` and called out in
// the run report. New agentStub capability used: scripted REJECTION (`throws`) + scripted
// NULL (`response: null`) — both additive; the 31 scenarios above are untouched.
// ═════════════════════════════════════════════════════════════════════════════

// ── G1. Builder agent REJECTION mid-wave — the loop error boundary (WS-D/D2) ──────────────────────
// One buildWO's builder throws a terminal error. buildWO has no try/catch, so parallel() rejects; the
// while-loop's error boundary catches it, spawns a MECH `ensure-stopped-crash` (running:false, never
// touching phase), then RETHROWS — the harness must observe BOTH the rejection AND the crash-stop spawn.
SCENARIOS.push({
  name: 'G1. builder REJECTION mid-wave — error boundary spawns ensure-stopped-crash then rethrows',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g1-crash',
    deps: [],
    workOrders: [mkWo('wo-g1-001', 'PLANNED', { frd: 'frd-g1-crash', artifacts: ['src/g1/**'] })],
  }]),
  responses: [
    { label: 'build:wo-g1-001', throws: 'terminal API error mid-wave' },
  ],
  assert(t, run) {
    t.ok(Boolean(run.error), 'the builder rejection propagated out of the engine (the crash is NOT swallowed)')
    t.ok(run.error && /terminal API error mid-wave/.test(String(run.error.message || run.error)), 'the observed error is the builder rejection')
    const crash = byLabel(run, 'ensure-stopped-crash')
    t.ok(crash.length === 1, `exactly one ensure-stopped-crash MECH spawn ran (got ${crash.length})`)
    t.ok(crash[0] && /running:false|running: false/.test(crash[0].prompt), 'the crash-stop spawn ensures running:false')
    t.ok(crash[0] && /NEVER set phase: release/.test(crash[0].prompt), 'the crash-stop spawn NEVER touches phase (nothing is verified on a crash)')
    t.ok(crash[0] && crash[0].opts.model === 'haiku', 'the crash-stop spawn runs on the cheap MECH tier')
    t.ok(hasLog(run, /FATAL: the build scheduler loop threw/), 'the fatal loop-throw is logged loudly')
    t.ok(byLabel(run, 'ensure-stopped').length === 0, 'the post-loop fail-safe never runs (we rethrow before it — the crash path owns the shutdown)')
  },
})

// ── G2. Gate agent returns NULL — treated as an unspecific failure, never a pass ──────────────────
// A null/garbled frdGate result must NOT read as green. gateAndConverge falls through to attemptRepair
// (green default) → re-gate (null again) → blocks 'error'. Never a pass, never a crash.
SCENARIOS.push({
  name: 'G2. gate NULL verdict — routed to attemptRepair/block (never a pass), no crash',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g2-nullgate',
    deps: [],
    workOrders: [mkWo('wo-g2-001', 'PLANNED', { frd: 'frd-g2-nullgate', artifacts: ['src/g2/**'] })],
  }]),
  responses: [
    { label: 'gate:frd-g2-nullgate', response: null },   // scripted NULL — a dead/garbled gate agent
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error} (a null gate must be handled, not crash)`)
    t.ok(byLabel(run, 'gate:frd-g2-nullgate').length === 2, 'the null gate was re-gated once after repair (both returned null)')
    t.ok(byLabel(run, /^repair:frd-g2-nullgate$/).length === 1, 'a null gate routes to attemptRepair (unspecific failure), never silently green')
    t.ok(!(run.result && run.result.builtFrds.includes('frd-g2-nullgate')), 'the FRD is NEVER treated as a pass on a null verdict')
    t.ok(run.result && run.result.blockedReasons && run.result.blockedReasons['frd-g2-nullgate'] === 'error', `the FRD blocks 'error' (unspecific) — got ${run.result && run.result.blockedReasons && run.result.blockedReasons['frd-g2-nullgate']}`)
  },
})

SCENARIOS.push({
  name: 'G2b. whole-FRD oracle — green numbered ACs cannot waive a failed unsafe-integer edge',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g2b-edge',
    deps: [],
    workOrders: [mkWo('wo-g2b-001', 'PLANNED', { frd: 'frd-g2b-edge', artifacts: ['src/g2b/**'] })],
  }]),
  responses: [{
    label: 'gate:frd-g2b-edge',
    response: {
      green: true,
      traceability: validTraceability.map((entry) => entry.contractClass === 'edge-case'
        ? { ...entry, contract: 'unsafe integers must be rejected', status: 'fail', tests: [] }
        : entry),
    },
  }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'gate:frd-g2b-edge').length >= 1, 'the reviewer gate ran')
    t.ok(!(run.result && run.result.builtFrds.includes('frd-g2b-edge')), 'the FRD is never VERIFIED from a green waiver')
    t.ok(run.result && run.result.blockedReasons && run.result.blockedReasons['frd-g2b-edge'] === 'error', 'the contradictory verdict fails closed')
  },
})

// ── G3. safe-point receipt is invalid — fail closed ───────────────────────────────────────────────
SCENARIOS.push({
  name: 'G3. malformed safe-point receipt — aborts rather than guessing stop:false',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g3-nullsafe',
    deps: [],
    workOrders: [mkWo('wo-g3-001', 'PLANNED', { frd: 'frd-g3-nullsafe', artifacts: ['src/g3/**'] })],
  }]),
  responses: [
    { label: 'safe-point', response: null },   // scripted NULL — a dead safe-point agent
  ],
  assert(t, run) {
    t.ok(Boolean(run.error) && /fenced stop receipt/.test(String(run.error)), `malformed receipt fails closed: ${run.error}`)
    t.ok(byLabel(run, 'safe-point').length >= 1, 'the safe point was invoked (and returned null)')
    t.ok(byLabel(run, /^process-change:/).length === 0, 'a null safe-point drains nothing (no ready items)')
    t.ok(byLabel(run, /^(dispatch|build|gate):/).length === 0, 'no work runs after an invalid receipt')
  },
})

SCENARIOS.push({
  name: 'G3b. real owner stop receipt — halts at recurring safe point',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-g3-stop', deps: [], workOrders: [mkWo('wo-g3-stop', 'PLANNED', { frd: 'frd-g3-stop', artifacts: ['src/g3/**'] })] }]),
  responses: [{ label: 'safe-point', response: { stop: false, stop_receipt: { status_exists: true, stop: true, method: 'node-lstat' }, ready: [], unblocked: [] }, times: 1 }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(run.result && run.result.stopReason === 'rethink', 'the fenced real-stop receipt halts the run')
    t.ok(byLabel(run, /^(dispatch|build|gate):/).length === 0, 'nothing runs after the owner stop')
  },
})

SCENARIOS.push({
  name: 'G3c. failed recurring inspect-stop command — aborts before dispatch',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-g3-failed', deps: [], workOrders: [mkWo('wo-g3-failed', 'PLANNED', { frd: 'frd-g3-failed', artifacts: ['src/g3/**'] })] }]),
  responses: [{ label: 'safe-point', throws: 'inspect-stop fence rejected' }],
  assert(t, run) {
    t.ok(Boolean(run.error) && /inspect-stop fence rejected/.test(String(run.error)), `command failure propagates: ${run.error}`)
    t.ok(byLabel(run, /^(dispatch|build|gate):/).length === 0, 'no work runs after inspect-stop fails')
  },
})

// ── G4. ensureStopped on PRE-LOOP early returns (WS-D/D3) ──────────────────────────────────────────
// Every pre-loop bail must still write running:false via ensureStopped (else Mission Control shows a
// phantom running build). Two branches:
SCENARIOS.push({
  name: 'G4a. ensureStopped — a red judge baseline returns clean (running:false) before the loop',
  args: { mode: 'pro' },
  // no plan — the run bails at the baseline, before planning
  responses: [
    { label: 'baseline', response: { green: false, failure: 'simulated unrepairable baseline' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'ensure-stopped').length === 1, 'ensureStopped ran on the baseline-red early return (running:false guaranteed)')
    t.ok(byLabel(run, 'plan').length === 0, 'it bailed BEFORE the planner (the baseline gate is pre-plan)')
    t.ok(run.result && run.result.note === 'baseline red (needs manual fix)', `the return note names the baseline red (got ${run.result && run.result.note})`)
    t.ok(run.result && run.result.blockedReasons && run.result.blockedReasons.baseline === 'error', 'baseline is blocked error')
  },
})
SCENARIOS.push({
  name: 'G4b. ensureStopped — a targeted build with unsatisfied cross-FRD deps returns clean, no build spawns',
  args: { mode: 'pro', frds: ['frd-g4b-deps'] },
  // custom plan: the requested FRD has a dep that is NOT verified → unsatisfiedDeps populated
  plan: {
    stack: 'B', hasFrontend: false,
    unsatisfiedDeps: [{ frd: 'frd-g4b-deps', dep: 'frd-g4b-prereq' }],
    frds: [{
      frd: 'frd-g4b-deps', deps: ['frd-g4b-prereq'],
      workOrders: [mkWo('wo-g4b-001', 'PLANNED', { frd: 'frd-g4b-deps', artifacts: ['src/g4b/**'] })],
    }],
  },
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'ensure-stopped').length === 1, 'ensureStopped ran on the unsatisfied-deps early return (running:false guaranteed)')
    t.ok(byLabel(run, /^(dispatch|build):/).length === 0, 'NO wave was dispatched — a targeted build refuses to start with unverified deps')
    t.ok(byLabel(run, /^gate:/).length === 0, 'no gate ran')
    t.ok(run.result && run.result.blockedReasons && run.result.blockedReasons['frd-g4b-deps'] === 'needs-owner', 'the requested FRD is blocked needs-owner (the owner must build the dep first)')
    t.ok(run.result && /deps sin verificar/.test(run.result.note || ''), 'the return note explains the unverified deps')
  },
})

// ── G5. Foundation subsystem (hasFrontend:true, DR-057/DR-065/WS-D/D5) ────────────────────────────
// (a) foundation-first wave ordering: a foundation WO builds ALONE, before any surface fans out, and the
// completeness gate runs between the foundation build and the surface build.
SCENARIOS.push({
  name: 'G5a. foundation-first — the foundation WO builds before any surface; the completeness gate gates the fan-out',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g5a-found',
    deps: [],
    workOrders: [
      mkWo('wo-g5a-found', 'PLANNED', { frd: 'frd-g5a-found', artifacts: ['src/components/core/**'], foundation: true }),
      mkWo('wo-g5a-surf', 'PLANNED', { frd: 'frd-g5a-found', artifacts: ['src/surface/**'] }),
    ],
  }], { hasFrontend: true }),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const waves = run.logs.filter((l) => l.startsWith('⚒ wave:'))
    t.ok(waves[0] && waves[0].includes('wo-g5a-found') && !waves[0].includes('wo-g5a-surf'),
      `the FIRST wave is foundation-only (wo-g5a-found, not the surface) — got: ${waves[0]}`)
    const bf = byLabel(run, 'build:wo-g5a-found')[0]
    const bs = byLabel(run, 'build:wo-g5a-surf')[0]
    const fg = byLabel(run, 'foundation-gate')[0]
    t.ok(bf && bs && bf.index < bs.index, 'the foundation WO built before the surface WO')
    t.ok(byLabel(run, 'foundation-gate').length === 1, 'the foundation-completeness gate ran once (before surfaces fan out)')
    t.ok(fg && bf && bs && bf.index < fg.index && fg.index < bs.index, 'the completeness gate runs AFTER the foundation build and BEFORE the surface build')
    t.ok(run.result && run.result.builtFrds.includes('frd-g5a-found'), 'the FRD verifies once both build')
  },
})
// (b) foundationCompletenessGate returning NULL is counted on foundationGateNulls (a SEPARATE counter from
// foundationRepairs). C2 KNOWN-GAP fix (G5b pre-task): the escalation now uses `>` not `>=`, so the engine
// TOLERATES FOUNDATION_GATE_NULL_CAP (2) transient nulls (retried) and escalates on the NEXT one — proving
// RECOVERY: null, null, then an ok verdict → the surfaces PROCEED (foundationRepairs untouched throughout,
// the counter separation invariant). Before the fix the 2nd null escalated fail-closed and held the surface.
SCENARIOS.push({
  name: 'G5b. foundation-gate NULL x2 then ok — tolerate 2 transient nulls, RECOVER on the ok verdict (surfaces proceed; 0 repairs)',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g5b-nullgate',
    deps: [],
    workOrders: [mkWo('wo-g5b-surf', 'PLANNED', { frd: 'frd-g5b-nullgate', artifacts: ['src/surface/**'] })],
  }], { hasFrontend: true }),
  responses: [
    { label: 'foundation-gate', response: null, times: 2 },   // two transient dead-gate verdicts, then the default { complete: true } greens
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error} (a dead foundation gate must not crash)`)
    t.ok(byLabel(run, 'foundation-gate').length === 3, `the two nulls were tolerated + retried, then the ok verdict greened (3 calls, FOUNDATION_GATE_NULL_CAP=2 with the C2 \`>\` fix) — got ${byLabel(run, 'foundation-gate').length}`)
    t.ok(byLabel(run, /^foundation-repair:/).length === 0, 'INVARIANT: the dead gates consumed foundationGateNulls, NOT foundationRepairs (0 repair spawns) — the counters are separate (WS-D/D5)')
    t.ok(byLabel(run, 'build:wo-g5b-surf').length === 1, 'RECOVERY: the surface IS built — two transient nulls tolerated, the third (ok) verdict lets the surface fan out (G5b pre-task)')
    t.ok(run.result && run.result.builtFrds.includes('frd-g5b-nullgate'), 'the surface FRD verifies (recovered from the transient dead gates)')
    t.ok(!hasLog(run, /escalating to the owner \(fail-closed\)/), 'the run did NOT escalate — two nulls are tolerated, not fatal (the C2 `>` fix)')
    t.ok(hasLog(run, /NOT treating as complete; re-running/), 'each transient null was retried, not treated as complete (fail-closed retry)')
  },
})
// (c) a REAL missingFoundation verdict (complete:false + missing[]) routes to repairFoundation and DOES
// consume foundationRepairs; after the repair the re-check greens and the surface proceeds.
SCENARIOS.push({
  name: 'G5c. missingFoundation verdict — routes to repairFoundation (consumes foundationRepairs), surface then proceeds',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g5c-missing',
    deps: [],
    workOrders: [mkWo('wo-g5c-surf', 'PLANNED', { frd: 'frd-g5c-missing', artifacts: ['src/surface/**'] })],
  }], { hasFrontend: true }),
  responses: [
    { label: 'foundation-gate', times: 1, response: { complete: false, missing: [{ name: 'Room', referencedBy: ['frd-g5c-missing'], suggestedPath: 'src/components/core/Room.tsx' }] } },
    // the next foundation-gate call (after the repair) greens via the default { complete: true }
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'foundation-repair:1').length === 1, 'a REAL missingFoundation verdict spends a foundationRepair (foundation-repair:1)')
    t.ok(byLabel(run, 'foundation-gate').length === 2, 'the gate ran twice — incomplete, then complete after the repair')
    t.ok(byLabel(run, 'build:wo-g5c-surf').length === 1, 'the surface builds after the foundation is repaired complete')
    t.ok(run.result && run.result.builtFrds.includes('frd-g5c-missing'), 'the surface FRD verifies')
    t.ok(hasLog(run, /Foundation auto-repair 1 done/), 'the auto-repair completion is logged')
  },
})

// ── G6. Gate-test-defective route (BL-0001) — repair the TEST, never revert a correct build ────────
// A localized reject → patch → the patch concludes the reviewer's OWN adversarial test is defective
// (cause:'gate-test-defective'). The engine routes to repairGateTest → verifyPatched → VERIFIED, and
// NEVER reverts the (correct) build.
SCENARIOS.push({
  name: 'G6. gate-test-defective — patch flags a defective reviewer test → repairGateTest → verify → VERIFIED, no revert',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g6-gtd',
    deps: [],
    workOrders: [mkWo('wo-g6-001', 'PLANNED', { frd: 'frd-g6-gtd', artifacts: ['src/g6/**'] })],
  }]),
  responses: [
    { label: 'gate:frd-g6-gtd', times: 1, response: { green: false, reopen: ['wo-g6-001'], findings: [{ wo: 'wo-g6-001', finding: 'nav hidden on desktop at src/g6/nav.tsx:10', failingTest: 'nav.spec.ts', files: ['src/g6/nav.tsx'] }] } },
    { label: 'patch:frd-g6-gtd', response: { green: false, cause: 'gate-test-defective', defectiveTests: [{ path: 'e2e/nav.spec.ts', why: 'asserts desktop-only nav visibility but the Playwright config runs desktop+mobile and forces no viewport' }] } },
    // gate-test-repair + verify-patch green via defaults (REPAIR_SCHEMA → { green: true })
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'patch:frd-g6-gtd').length === 1, 'patch-1 ran once (no patch-2 — the give-up was gate-test-defective, not code)')
    t.ok(byLabel(run, 'gate-test-repair:frd-g6-gtd').length === 1, 'the engine routed to repairGateTest (fix the TEST, BL-0001)')
    t.ok(byLabel(run, 'verify-patch:frd-g6-gtd').length === 1, 'an independent verifier re-ran the gate (constitution rule 4)')
    t.ok(byLabel(run, /^revert:/).length === 0, 'NO revert — a correct build is never discarded over a defective gate test')
    t.ok(byLabel(run, /^diagnose:/).length === 0, 'no A3 diagnosis (the patch classified gate-test-defective directly, not code)')
    t.ok(run.result && run.result.builtFrds.includes('frd-g6-gtd'), 'the FRD verifies via the gate-test repair path')
    t.ok(hasLog(run, /repairing the TEST, not rebuilding \(BL-0001\)/), 'the gate-test-repair route is logged')
  },
})

// ── G7. Split-gate internals (proposal 31 T1.2) — reviewSplit ON via a prior-reopened WO ───────────
// (a) all four finder lenses die (null) → __splitFailed sentinel → the caller falls back to the SERIAL
// gate (the gate is NEVER skipped, contract 4). No crash.
SCENARIOS.push({
  name: 'G7a. split-gate — all 4 finders die (null) → __splitFailed sentinel → serial gate fallback, no crash',
  args: { mode: 'powerful' },
  plan: mkPlan([{
    frd: 'frd-g7a-splitfail',
    deps: [],
    workOrders: [mkWo('wo-g7a-001', 'PLANNED', { frd: 'frd-g7a-splitfail', artifacts: ['src/g7a/**'], reopen_count: 1 })], // reopen_count≥1 → SPLIT on the first gate this run (C1a)
  }]),
  responses: [
    { label: /^find:/, response: null },   // every finder lens dies
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error} (dead finders must degrade, not crash)`)
    t.ok(byLabel(run, /^find:/).length === 4, `the 4 split finder lenses spawned (got ${byLabel(run, /^find:/).length})`)
    t.ok(byLabel(run, 'gate:frd-g7a-splitfail').length === 1, 'the SERIAL gate fallback ran (label gate:<frd>) — the gate is never skipped')
    t.ok(byLabel(run, /^verify-finding:/).length === 0, 'no adversarial verifiers (the split produced no corrections — it fell back)')
    t.ok(hasLog(run, /all four finder lenses died — falling back to the serial/), 'the fail-safe fallback is logged (contract 4)')
    t.ok(run.result && run.result.builtFrds.includes('frd-g7a-splitfail'), 'the FRD still verifies via the serial fallback gate')
  },
})
// (b) skeptic cap: > VERIFY_CAP (8) surviving corrections → only VERIFY_CAP verify-finding spawns; the
// overflow passes through UNVERIFIED (labeled), never silently dropped.
SCENARIOS.push({
  name: 'G7b. split-gate skeptic cap — 10 corrections → exactly VERIFY_CAP (8) verify-finding spawns, 2 overflow labeled',
  args: { mode: 'powerful' },
  plan: mkPlan([{
    frd: 'frd-g7b-cap',
    deps: [],
    workOrders: [mkWo('wo-g7b-001', 'PLANNED', { frd: 'frd-g7b-cap', artifacts: ['src/g7b/**'], reopen_count: 1 })], // SPLIT on the first gate
  }]),
  responses: [
    // the correctness lens reports 10 UNIQUE corrections (distinct file+claim → no dedup collapse)
    { label: 'find:correctness:frd-g7b-cap', response: { findings: Array.from({ length: 10 }, (_, i) => ({ file: `src/g7b/f${i}.ts:1`, claim: `defect number ${i}`, severity: 'correction', evidence: `observed ${i}` })) } },
    { label: /^find:/, response: { findings: [] } },   // the other three lenses are clean (live, empty)
    { label: /^verify-finding:/, response: { refuted: true } },   // skeptics refute so the closer greens
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^find:/).length === 4, 'all 4 finder lenses spawned')
    t.ok(byLabel(run, /^verify-finding:/).length === 8, `exactly VERIFY_CAP=8 adversarial verifiers spawned despite 10 corrections (got ${byLabel(run, /^verify-finding:/).length})`)
    t.ok(hasLog(run, /2 correction\(s\) exceed the verify cap of 8 — passing them through UNVERIFIED/), 'the 2 overflow corrections are passed through UNVERIFIED (labeled), never silently dropped')
    t.ok(byLabel(run, 'gate:frd-g7b-cap').length === 1, 'the split CLOSE stage ran once')
    t.ok(run.result && run.result.builtFrds.includes('frd-g7b-cap'), 'the FRD verifies through the split gate')
  },
})

// ── G8. maxAgents bounded overshoot + budgeted in-run retry (WS-A/D2, WS-D/D6) ────────────────────
// (a) a wave near the agent ceiling admits EXACTLY ONE WO (the pickDisjointWave ≥1 progress guarantee —
// a lone WO is admitted even when its cost exceeds the remaining budget), then the loop stops cleanly at
// the next boundary. (The audit called this the "budget" stop; the engine's stopReason for the maxAgents
// ceiling is 'agents' — same brake, that field name.) maxAgents=11, mode pro: pre-loop 8 + safe-point 9 →
// remainingAgents 2; wo1 admitted (progress guarantee), wo2 deferred (cost 5 > 2); after wo1
// dispatch+build+commit agentSpawned=12 ≥ 11 → stop.
SCENARIOS.push({
  name: 'G8a. bounded overshoot — a near-ceiling wave admits exactly ONE WO (progress guarantee), then stops',
  args: { mode: 'pro', maxAgents: 11 },
  plan: mkPlan([{
    frd: 'frd-g8a-cap',
    deps: [],
    workOrders: [
      mkWo('wo-g8a-001', 'PLANNED', { frd: 'frd-g8a-cap', artifacts: ['src/g8a/one/**'] }),
      mkWo('wo-g8a-002', 'PLANNED', { frd: 'frd-g8a-cap', artifacts: ['src/g8a/two/**'] }), // DISJOINT from 001 → only the cost budget can defer it
    ],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const waves = run.logs.filter((l) => l.startsWith('⚒ wave:'))
    t.ok(waves.length === 1 && /^⚒ wave: 1 WO\(s\)/.test(waves[0]), `exactly ONE wave of ONE WO ran — the progress guarantee admits one even below the cost budget (got: ${waves.join(' | ')})`)
    t.ok(byLabel(run, /^build:/).length === 1 && byLabel(run, 'build:wo-g8a-001').length === 1, 'only wo-g8a-001 built (admitted by the ≥1 guarantee)')
    t.ok(byLabel(run, 'build:wo-g8a-002').length === 0, 'wo-g8a-002 was deferred by the cost budget (disjoint artifacts — not an overlap serialization)')
    t.ok(run.result && run.result.stopReason === 'agents', `the run stops at the agent ceiling (got ${run.result && run.result.stopReason})`)
    t.ok(hasLog(run, /Agent ceiling reached/), 'the ceiling stop is logged')
  },
})
// (b) a reopen whose in-run retry cost does NOT fit the remaining maxAgents budget DEFERS (WS-D/D6): no
// retry rebuild spawns, the FRD lands in reopenedFrds (rebuilds next pass). C2: the budget is +2 vs the
// pre-C2 topology (maxAgents 25→27) for the two new mechanical spawns on the path to the reopen — the pin
// (post-wave HEAD freeze) and the gate-worktree probe — so the ladder still runs capHit-false up to
// revertAndReopen (agentSpawned 26) and the reopened WO rebuilds on OPUS (cost 4) with remaining 1 →
// budgetedRetry empty → the WS-D/D6 budget-deferral (distinct from the capHit honest-degrade).
SCENARIOS.push({
  name: 'G8b. budgeted in-run retry — a reopen that does not fit the remaining budget defers (no retry build), FRD reopened',
  args: { mode: 'pro', maxAgents: 27 },
  plan: mkPlan([{
    frd: 'frd-g8b-defer',
    deps: [],
    workOrders: [mkWo('wo-g8b-001', 'PLANNED', { frd: 'frd-g8b-defer', artifacts: ['src/g8b/**'] })],
  }]),
  responses: [
    { label: 'gate:frd-g8b-defer', response: { green: false, reopen: ['wo-g8b-001'], findings: [{ wo: 'wo-g8b-001', finding: 'x at src/g8b/a.ts:3', files: ['src/g8b/a.ts'] }] } },
    { label: 'patch:frd-g8b-defer', response: { green: false, cause: 'code', failure: 'still red' } },
    { label: 'diagnose:frd-g8b-defer', response: { classification: 'point', repeatsPrior: true, recommendation: 'full-revert', confidence: 'low', seam: null } }, // point+repeats+not-separable → full revert + inRunRetry
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'diagnose:frd-g8b-defer').length === 1, 'the A3 diagnosis ran (capHit was FALSE — this is the budget-trim path, NOT the ceiling honest-degrade)')
    t.ok(byLabel(run, 'revert:frd-g8b-defer').length === 1, 'a full revert ran before the in-run retry')
    t.ok(byLabel(run, 'build:wo-g8b-001').length === 1, 'NO retry rebuild — only the original build ran (the opus retry did not fit the remaining budget)')
    t.ok(run.result && run.result.reopenedFrds.includes('frd-g8b-defer'), 'the FRD lands in reopenedFrds (rebuilds next pass)')
    t.ok(hasLog(run, /in-run retry deferred/), 'the WS-D/D6 budget-deferral is logged')
  },
})

// ── G9. Premature-release guard (WS-D/D4a) — a drained change into an ALREADY-PLANNED FRD defers ──
// A BARE build drains a ready change whose affected FRD is already in the plan (existing-folder branch):
// its new WOs build on a LATER run, so deferredWork=true. That suppresses allDone even though every
// planned FRD verified — NO hardening/close-out; notify-end runs instead (the run is NOT declared released).
SCENARIOS.push({
  name: 'G9. premature-release guard — a drained change into an already-planned FRD sets deferredWork, suppressing release',
  args: { mode: 'pro' },   // bare build (no change/frds) → TARGETED false → the queue drains
  plan: mkPlan([{
    frd: 'frd-g9-defer',
    deps: [],
    workOrders: [mkWo('wo-g9-001', 'PLANNED', { frd: 'frd-g9-defer', artifacts: ['src/g9/**'] })],
  }]),
  responses: [
    { label: 'safe-point', times: 1, response: { stop: false, ready: ['chg-into-planned'], unblocked: [] } },
    { label: 'process-change:chg-into-planned', response: { done: true, affectedFrds: ['frd-g9-defer'], changeFile: 'chg-into-planned.md' } }, // affected FRD is ALREADY planned → existing branch
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(run.result && run.result.builtFrds.includes('frd-g9-defer'), 'every planned FRD did verify this run')
    t.ok(byLabel(run, 'hardening:security-audit').length === 0, 'NO hardening ran — deferredWork suppresses the all-done release path')
    t.ok(byLabel(run, 'close-out').length === 0, 'the release close-out (the only phase: release writer) did NOT run')
    t.ok(byLabel(run, 'notify-end').length === 1, 'the partial-close notify-end ran instead (running:false, phase stays implementation)')
    t.ok(hasLog(run, /no se declara release esta corrida/), 'the deferred-work suppression is logged (WS-D/D4a)')
  },
})

// ── G10. Health breaker (MAX_CONSECUTIVE_BLOCKS=3) — 3 non-external blocks trip it; external does not ──
// (a) three FRDs blocking needs-owner in a row → consecutiveBlocks reaches 3 → stopReason 'blocks', loop exits.
SCENARIOS.push({
  name: 'G10a. health breaker — 3 consecutive non-external blocks → stopReason blocks, loop exits',
  args: { mode: 'pro' },
  plan: mkPlan([
    { frd: 'frd-g10-1', deps: [], workOrders: [mkWo('wo-g10-101', 'PLANNED', { frd: 'frd-g10-1', artifacts: ['src/g10a/one/**'] })] },
    { frd: 'frd-g10-2', deps: [], workOrders: [mkWo('wo-g10-201', 'PLANNED', { frd: 'frd-g10-2', artifacts: ['src/g10a/two/**'] })] },
    { frd: 'frd-g10-3', deps: [], workOrders: [mkWo('wo-g10-301', 'PLANNED', { frd: 'frd-g10-3', artifacts: ['src/g10a/three/**'] })] },
  ]),
  responses: [
    { label: /^gate:frd-g10-\d$/, response: { green: false, blocked_reason: 'needs-owner', failure: 'owner must act' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(run.result && run.result.stopReason === 'blocks', `the health breaker tripped — stopReason 'blocks' (got ${run.result && run.result.stopReason})`)
    t.ok(run.result && run.result.blockedFrds.length === 3, `all three FRDs blocked (got ${run.result && run.result.blockedFrds.length})`)
    t.ok(run.result && ['frd-g10-1', 'frd-g10-2', 'frd-g10-3'].every((f) => run.result.blockedReasons[f] === 'needs-owner'), 'all three blocked needs-owner (non-external → they count toward the breaker)')
    t.ok(byLabel(run, /^repair:/).length === 0, 'a gate that classifies a block (needs-owner) is NOT sent to a wasteful repair pass (DR-072 C1)')
  },
})
// (b) same three FRDs but ONE blocks 'external' — external NEVER increments consecutiveBlocks, so the
// breaker (which needs 3) does NOT trip; the run ends by exhausting the queue, not by the breaker.
SCENARIOS.push({
  name: 'G10b. health breaker — an external block does NOT count; 2 non-external + 1 external never trips the breaker',
  args: { mode: 'pro' },
  plan: mkPlan([
    { frd: 'frd-g10b-1', deps: [], workOrders: [mkWo('wo-g10b-101', 'PLANNED', { frd: 'frd-g10b-1', artifacts: ['src/g10b/one/**'] })] },
    { frd: 'frd-g10b-2', deps: [], workOrders: [mkWo('wo-g10b-201', 'PLANNED', { frd: 'frd-g10b-2', artifacts: ['src/g10b/two/**'] })] },
    { frd: 'frd-g10b-3', deps: [], workOrders: [mkWo('wo-g10b-301', 'PLANNED', { frd: 'frd-g10b-3', artifacts: ['src/g10b/three/**'] })] },
  ]),
  responses: [
    { label: 'gate:frd-g10b-1', response: { green: false, blocked_reason: 'needs-owner', failure: 'x' } },
    { label: 'gate:frd-g10b-2', response: { green: false, blocked_reason: 'external', failure: 'upstream 5xx' } },
    { label: 'gate:frd-g10b-3', response: { green: false, blocked_reason: 'needs-owner', failure: 'x' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(!(run.result && run.result.stopReason === 'blocks'), `the breaker did NOT trip — an external block never increments the counter (stopReason ${run.result && run.result.stopReason})`)
    t.ok(run.result && run.result.blockedFrds.length === 3, 'all three FRDs still blocked (the run ran to queue exhaustion, not a breaker stop)')
    t.ok(run.result && run.result.blockedReasons['frd-g10b-2'] === 'external', 'the middle FRD blocked external')
    t.ok(run.result && run.result.blockedReasons['frd-g10b-1'] === 'needs-owner' && run.result.blockedReasons['frd-g10b-3'] === 'needs-owner', 'the other two blocked needs-owner (only 2 non-external — below the breaker threshold of 3)')
  },
})

// ── G11. BuildComplete / GateVerdict emission presence — cheap prompt-content assertions ───────────
// (a) the gate prompt carries the GateVerdict printf on EVERY exit branch (pass/reopen/blocked/fail);
// the close-out carries BuildComplete + the on-disk VERIFIED assert + the dated+fresh security-report assert.
SCENARIOS.push({
  name: 'G11a. emission presence — gate has GateVerdict on every exit; close-out has BuildComplete + disk/hardening asserts',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g11a-emit',
    deps: [],
    workOrders: [mkWo('wo-g11a-001', 'PLANNED', { frd: 'frd-g11a-emit', artifacts: ['src/g11a/**'] })],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-g11a-emit')[0]
    t.ok(gate, 'the gate ran')
    t.ok(gate && /"event":"GateVerdict"/.test(gate.prompt), 'the gate prompt carries the GateVerdict printf')
    // C2: the review-only gate is the sole emitter of the REJECT verdicts (reopen/blocked/fail — worktree-safe
    // absolute-path appends); the PASS verdict + achievement moved to the serialized apply-gate step on main.
    t.ok(gate && /verdict":"reopen"/.test(gate.prompt) && /verdict":"blocked"/.test(gate.prompt) && /verdict":"fail"/.test(gate.prompt),
      'the GateVerdict event is emitted on every REJECT exit branch (reopen/blocked/fail) from the review-only gate')
    t.ok(gate && !/verdict":"pass"/.test(gate.prompt), 'C2: the PASS GateVerdict is NOT in the gate prompt — it moved to apply-gate (the main-tree writer)')
    const apply = byLabel(run, 'apply-gate:frd-g11a-emit')[0]
    t.ok(apply, 'the serialized apply-gate ran (a PASS was persisted on main)')
    t.ok(apply && /"event":"GateVerdict"/.test(apply.prompt) && /verdict":"pass"/.test(apply.prompt), 'C2: apply-gate emits the PASS GateVerdict (event count identical to pre-C2: exactly one pass)')
    t.ok(apply && /"event":"achievement"/.test(apply.prompt), 'C2: apply-gate emits the per-WO achievement (moved from the gate pass path — it is the agent that stamps VERIFIED)')
    const close = byLabel(run, 'close-out')[0]
    t.ok(close, 'the release close-out ran (all-done + hardened)')
    t.ok(close && /"event":"BuildComplete"/.test(close.prompt), 'the close-out carries the BuildComplete terminal-verdict printf')
    t.ok(close && /the disk is the oracle/.test(close.prompt) && /rollup .?implementation_status.? is VERIFIED/.test(close.prompt), 'the close-out asserts every frd.md rollup is VERIFIED ON DISK before release (WS-D/D4b)')
    t.ok(close && /security-<TODAY>\.md/.test(close.prompt) && /mtime is NEWER than/.test(close.prompt), 'the close-out asserts the dated security report exists AND is FRESH (mtime > run_started_at, WS-D/D4c)')
  },
})
// (b) the revert prompt carries the live wo_reopen dashboard event. Reached via a capHit legacy revert
// (maxAgents=16 in pro: the ladder honest-degrades past the diagnosis straight to revert).
SCENARIOS.push({
  name: 'G11b. emission presence — the revert prompt carries the wo_reopen dashboard event',
  args: { mode: 'pro', maxAgents: 16 },
  plan: mkPlan([{
    frd: 'frd-g11b-revert',
    deps: [],
    workOrders: [mkWo('wo-g11b-001', 'PLANNED', { frd: 'frd-g11b-revert', artifacts: ['src/g11b/**'] })],
  }]),
  responses: [
    { label: 'gate:frd-g11b-revert', times: 1, response: { green: false, reopen: ['wo-g11b-001'], findings: [{ wo: 'wo-g11b-001', finding: 'y', files: ['src/g11b/a.ts'] }] } },
    { label: 'patch:frd-g11b-revert', response: { green: false, cause: 'code', failure: 'still red' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const revert = byLabel(run, 'revert:frd-g11b-revert')[0]
    t.ok(revert, 'the legacy revert path ran (capHit honest-degrade, no diagnosis)')
    t.ok(byLabel(run, /^diagnose:/).length === 0, 'the ceiling honest-degrade skipped the A3 diagnosis')
    t.ok(revert && /"event":"wo_reopen"/.test(revert.prompt), 'the revert prompt carries the live Party wo_reopen dashboard event')
    t.ok(revert && /dashboard-events\.ndjson/.test(revert.prompt), 'the wo_reopen event is appended to the dashboard stream')
    t.ok(revert && /"kind":"wo_reopen"/.test(revert.prompt), 'the revert also appends the durable track.jsonl wo_reopen line')
  },
})

// ═════════════════════════════════════════════════════════════════════════════
// PACKAGE C2 — CONCURRENT FRD GATES IN A PINNED WORKTREE (the big structural speed lever)
// Gates run as BACKGROUND promises in a frozen worktree WHILE the loop keeps dispatching build waves; a
// PASS applies via a serialized apply-gate on main; a REJECT quiesces and runs the legacy ladder on main;
// a worktree-creation failure falls back to the legacy synchronous gate for the whole run.
// ═════════════════════════════════════════════════════════════════════════════

// ── C2-i. A gate runs WHILE the next wave builds (the core interleave) ─────────────────────────────
// frd-A (1 WO) completes in wave 1 and its gate launches in the background; frd-B's 2nd WO (deps the 1st)
// builds in wave 2 WHILE frd-A's gate is in flight. Observable by spawn order: build:wo-ib2 (wave N+1)
// appears BETWEEN gate:frd-i-a (start) and apply-gate:frd-i-a (the serialized main-tree apply).
SCENARIOS.push({
  name: 'C2-i. concurrent gate — a gate runs while the NEXT wave builds (build of wave N+1 lands between gate start and apply)',
  args: { mode: 'pro' },
  plan: mkPlan([
    { frd: 'frd-i-a', deps: [], workOrders: [mkWo('wo-ia1', 'PLANNED', { frd: 'frd-i-a', artifacts: ['src/ia/**'] })] },
    { frd: 'frd-i-b', deps: [], workOrders: [
      mkWo('wo-ib1', 'PLANNED', { frd: 'frd-i-b', artifacts: ['src/ib1/**'] }),
      mkWo('wo-ib2', 'PLANNED', { frd: 'frd-i-b', artifacts: ['src/ib2/**'], deps: ['wo-ib1'] }),
    ] },
  ]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gateA = byLabel(run, 'gate:frd-i-a')[0]
    const applyA = byLabel(run, 'apply-gate:frd-i-a')[0]
    const buildB2 = byLabel(run, 'build:wo-ib2')[0]
    const dispB = byLabel(run, /^dispatch:frd-i-b/)[0]
    t.ok(gateA, 'frd-i-a gated (in the worktree)')
    t.ok(applyA, 'frd-i-a applied on main (serialized apply-gate)')
    t.ok(buildB2 && dispB, 'wo-ib2 (wave N+1) dispatched + built')
    // INTERLEAVE: after the wave-2 dispatch (frd-i-b), BOTH frd-i-a's gate AND wave N+1's build run, and
    // frd-i-a's gate applies only AFTER — build and review overlap (the gate did not block the next wave).
    // (gate vs build spawn order within the window is a microtask-depth artifact; the overlap is the point.)
    t.ok(gateA && buildB2 && applyA && dispB
      && gateA.index > dispB.index && buildB2.index > dispB.index
      && gateA.index < applyA.index && buildB2.index < applyA.index,
      `INTERLEAVE: after dispatch:frd-i-b (@${dispB && dispB.index}), gate:frd-i-a (@${gateA && gateA.index}) AND build:wo-ib2 (@${buildB2 && buildB2.index}) both run before apply-gate:frd-i-a (@${applyA && applyA.index}) — build and review OVERLAP`)
    t.ok(gateA && /GATE WORKTREE/.test(gateA.prompt), 'the concurrent gate runs from the pinned gate worktree (cd preamble)')
    const wt = byLabel(run, 'gate-worktree')[0]
    t.ok(wt, 'the persistent gate worktree was prepared (probed at the first gate)')
    t.ok(wt && /worktree list --porcelain/.test(wt.prompt) && /status --porcelain/.test(wt.prompt), 'a preexisting worktree is reused only when its exact path is registered and clean')
    t.ok(wt && /DO NOT delete, reset, clean, prune, recreate, or force-remove/.test(wt.prompt), 'the probe preserves crash evidence on every unsafe reuse')
    t.ok(run.result && run.result.builtFrds.includes('frd-i-a') && run.result.builtFrds.includes('frd-i-b'), 'both FRDs verified')
  },
})

// ── C2-ii. PASS → serialized apply-gate ports test files + advances last_green ─────────────────────
SCENARIOS.push({
  name: 'C2-ii. PASS verdict — apply-gate ports the reviewer test files from the worktree, stamps VERIFIED, advances last_green',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-ii', deps: [],
    workOrders: [mkWo('wo-ii-001', 'PLANNED', { frd: 'frd-ii', artifacts: ['src/ii/**'] })],
  }]),
  responses: [
    { label: 'gate:frd-ii', response: { green: true, testFiles: ['e2e/frd-ii.spec.ts', 'src/ii/__tests__/a.test.ts'] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const apply = byLabel(run, 'apply-gate:frd-ii')[0]
    t.ok(apply, 'the serialized apply-gate ran')
    t.ok(apply && apply.opts.model === 'haiku', 'apply-gate runs on the cheap MECH tier (the trust boundary was the gate; this only persists)')
    t.ok(apply && /gate-worktree/.test(apply.prompt) && /e2e\/frd-ii\.spec\.ts/.test(apply.prompt), 'apply-gate PORTS the reviewer test files from the gate worktree onto main')
    t.ok(apply && /implementation_status: VERIFIED/.test(apply.prompt), 'apply-gate stamps the reviewed WOs VERIFIED on main')
    t.ok(apply && /last_green_sha/.test(apply.prompt) && /TWO commits/.test(apply.prompt)
      && /merge-base --is-ancestor/.test(apply.prompt) && /NEVER amend/.test(apply.prompt)
      && !/git commit --amend/.test(apply.prompt),
    'apply-gate publishes last_green through a verified-snapshot commit followed by an ancestor-pointer commit')
    t.ok(apply && /"event":"GateVerdict"/.test(apply.prompt) && /verdict":"pass"/.test(apply.prompt), 'apply-gate emits the single PASS GateVerdict')
    t.ok(run.result && run.result.builtFrds.includes('frd-ii'), 'the FRD verifies via the concurrent gate + serialized apply')
  },
})

// ── C2-iii. REJECT → quiesce → the legacy convergence ladder runs ON MAIN, unchanged ──────────────
// A localized reject: the gate (in the worktree) reopens; the loop QUIESCES and runs the DR-073 patch
// ladder on the MAIN tree (no worktree preamble on the patch/verify spawns), byte-for-byte the pre-C2 path.
SCENARIOS.push({
  name: 'C2-iii. REJECT verdict — quiesce, then the legacy patch/verify convergence ladder runs on MAIN (not the worktree)',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-iii', deps: [],
    workOrders: [mkWo('wo-iii-001', 'PLANNED', { frd: 'frd-iii', artifacts: ['src/iii/**'] })],
  }]),
  responses: [
    { label: 'gate:frd-iii', times: 1, response: { green: false, reopen: ['wo-iii-001'], findings: [{ wo: 'wo-iii-001', finding: 'off-by-one at src/iii/a.ts:4', failingTest: 'a.spec.ts', files: ['src/iii/a.ts'] }] } },
    // patch greens → independent verify → VERIFIED (the pre-C2 happy convergence)
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-iii')[0]
    t.ok(gate && /GATE WORKTREE/.test(gate.prompt), 'the gate ran in the pinned worktree')
    const patch = byLabel(run, 'patch:frd-iii')[0]
    t.ok(patch, 'the DR-073 patch ladder ran after the reject (convergence)')
    t.ok(patch && !/GATE WORKTREE/.test(patch.prompt), 'the convergence patch runs on the MAIN tree — NOT the worktree (quiesced main)')
    t.ok(byLabel(run, 'verify-patch:frd-iii').length === 1, 'the independent post-patch verifier ran (constitution rule 4) — the ladder is unchanged')
    t.ok(byLabel(run, /^apply-gate:/).length === 0, 'no apply-gate on the reject path (the patch-then-verify path stamps VERIFIED itself, as pre-C2)')
    t.ok(run.result && run.result.builtFrds.includes('frd-iii'), 'the FRD converges to VERIFIED via the on-main ladder')
  },
})

// ── C2-iv. Worktree-creation FAILURE → legacy synchronous gate fallback for the whole run ──────────
SCENARIOS.push({
  name: 'C2-iv. worktree creation fails — the whole run falls back to the LEGACY synchronous gate path (on main)',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-iv', deps: [],
    workOrders: [mkWo('wo-iv-001', 'PLANNED', { frd: 'frd-iv', artifacts: ['src/iv/**'] })],
  }]),
  responses: [
    { label: 'gate-worktree', response: { ok: false, failure: 'repo state does not support a worktree here' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error} (a worktree failure must degrade, not crash)`)
    t.ok(byLabel(run, 'gate-worktree').length === 1, 'the worktree was probed once (and failed) — not retried per gate')
    const precheck = byLabel(run, 'baseline-precheck')[0]
    const wt = byLabel(run, 'gate-worktree')[0]
    t.ok(precheck && /preserve gate-worktree crash evidence/.test(precheck.prompt), 'baseline preserves a dirty/orphaned gate worktree instead of cleaning it')
    t.ok(wt && /dirty, orphaned, unregistered, or ambiguous/.test(wt.prompt) && /evidence preserved/.test(wt.prompt), 'dirty/orphaned reuse returns a preserved-evidence failure')
    t.ok(hasLog(run, /legacy synchronous gate path/i), 'the fallback to the legacy synchronous gate path is logged loudly')
    const gate = byLabel(run, 'gate:frd-iv')[0]
    t.ok(gate, 'the gate STILL ran (never skipped — it just runs synchronously)')
    t.ok(gate && !/GATE WORKTREE/.test(gate.prompt), 'the legacy gate runs on the MAIN tree (no worktree preamble)')
    t.ok(byLabel(run, 'apply-gate:frd-iv').length === 1, 'a PASS still applies via the serialized apply-gate (sourceDir null — tests already on main)')
    t.ok(run.result && run.result.builtFrds.includes('frd-iv'), 'the FRD verifies via the legacy synchronous gate')
  },
})

// ── C2-v. Run-end awaits in-flight gates — a gate whose verdict is unharvested when a BRAKE trips is
// still applied post-loop (never dropped). maxAgents is tuned so the agent ceiling trips at the top of the
// iteration AFTER frd-v-a's gate settled (its verdict sits unharvested in gateResults); the post-loop
// settleGates(true)+drainConverge apply it, so builtFrds still contains frd-v-a despite the 'agents' stop.
SCENARIOS.push({
  name: 'C2-v. run-end awaits in-flight gates — a settled-but-unharvested gate is applied post-loop despite the agent-ceiling stop',
  args: { mode: 'pro', maxAgents: 24 },
  plan: mkPlan([
    { frd: 'frd-v-a', deps: [], workOrders: [mkWo('wo-va1', 'PLANNED', { frd: 'frd-v-a', artifacts: ['src/va/**'] })] },
    { frd: 'frd-v-b', deps: [], workOrders: [
      mkWo('wo-vb1', 'PLANNED', { frd: 'frd-v-b', artifacts: ['src/vb1/**'] }),
      mkWo('wo-vb2', 'PLANNED', { frd: 'frd-v-b', artifacts: ['src/vb2/**'], deps: ['wo-vb1'] }),
    ] },
  ]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(run.result && run.result.stopReason === 'agents', `the run stopped at the agent ceiling (got ${run.result && run.result.stopReason})`)
    t.ok(byLabel(run, 'gate:frd-v-a').length === 1, 'frd-v-a gated concurrently (in flight when the ceiling tripped)')
    const applyA = byLabel(run, 'apply-gate:frd-v-a')[0]
    t.ok(applyA, 'the run-end settle applied frd-v-a AFTER the loop broke (the in-flight gate was awaited, not dropped)')
    t.ok(run.result && run.result.builtFrds.includes('frd-v-a'), 'frd-v-a is VERIFIED despite the stop — the post-loop settleGates(true)+drainConverge honoured the in-flight gate')
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
