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
// WP-03: ensureStopped's agentType is now MECH_AGENT('pandacorp:devops') — 'pandacorp:mech' (the narrower
// Bash+Read runner, MECH_LEAN default) or the literal 'pandacorp:devops' fallback (args.mechLean:false) are
// BOTH acceptable narrow types; only a regression to the broad 'pandacorp:implementer' fails this guard.
if (!/close-preloop --project/.test(source) || !/agentType: (MECH_AGENT\('pandacorp:devops'\)|'pandacorp:devops')/.test(source) || /ensureStopped\(reason\)[\s\S]{0,900}agentType: 'pandacorp:implementer'/.test(source)) {
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
  if (label === 'plan-post-drain') return { frds: [] }                  // PLAN_SCHEMA (BL-0129 re-plan after a pre-loop drain)
  if (label === 'sync-rollups') return { corrected: 0 }
  if (label === 'safe-point') return { stop: false, stop_receipt: { status_exists: true, stop: false, method: 'node-lstat' }, ready: [], unblocked: [] } // SAFE_POINT_SCHEMA
  if (label === 'renew-lease') return { stop: false }         // REV-5: minimal renewal-only spawn on a throttled safe-point boundary (RENEW_LEASE_SCHEMA)
  if (label === 'safe-point-pre-loop') return { stop: false, stop_receipt: { status_exists: true, stop: false, method: 'node-lstat' }, ready: [], unblocked: [] } // SAFE_POINT_SCHEMA (BL-0129 pre-loop drain)
  if (label === 'foundation-gate') return { complete: true }            // FOUNDATION_SCHEMA
  if (label === 'visual-qa') return { done: true }
  if (label.startsWith('dispatch:')) return {}
  if (label === 'gate-worktree') return { ok: true, created: true }         // C2: worktree prepared OK (happy path)
  if (label.startsWith('pin:')) return { sha: 'pinsha0' }                    // C2: the freeze sha
  if (label.startsWith('apply-gate:')) return { done: true }                // C2: serialized main-tree apply of a PASS
  if (label.startsWith('persist-block:')) return { done: true }             // C2: main-tree persist of a review-only gate block
  if (label.startsWith('commit:')) return { committed: 1, sha: 'defaultcommitsha' }   // WP-03 fusion (ii): the real mech commit writer always reports its own sha
  if (/^(build|test|be|fe|selftest):/.test(label)) return { green: true } // VERIFY_SCHEMA
  if (label.startsWith('gate:')) return { green: true, traceability: validTraceability } // FRD_GATE_SCHEMA
  if (label.startsWith('diagnose:')) return { classification: 'point', repeatsPrior: false, recommendation: 'patch', confidence: 'medium' } // DIAGNOSE_SCHEMA (A2) — benign default (only the recovery-ladder scenarios reach it)
  if (label.startsWith('block-needs-owner:')) return { green: false, blocked_reason: 'needs-owner' } // A3 early-block spawn (REPAIR_SCHEMA)
  if (label.startsWith('block-repair-budget:')) return { green: false, blocked_reason: 'needs-owner' } // WP-08 cost-brake honest exit (REPAIR_SCHEMA)
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
      if ((call.label === 'safe-point' || call.label === 'safe-point-pre-loop') && answer && typeof answer === 'object' && !('stop_receipt' in answer)) {
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
// baseline pre-check): baseline-precheck(MECH,1) + baseline(judge,3) + plan(judge,3) = 7 — WP-03 fusion
// (i), MECH_LEAN default: the old standalone sync-rollups(MECH,1) spawn is GONE here, folded into the
// first wave's dispatch below (same total dispatch spawn count, no extra agentSpawned++). maxAgents=13 →
// iteration 1 passes the brake (7<13), safe-point(+1)=8. The count cap P.wave=2 admits at most two WOs;
// the COST-aware picker (WS-A/D2) confirms it: remainingAgents=13-8=5, each sonnet WO costs
// COST(sonnet)+1=2 plus the shared dispatch(1) — wo-1 (cost 1+2=3) and wo-2 (5) fit; wo-3 is deferred (count
// cap). Wave=[wo-1,wo-2]. dispatch(+1)=9, builds wo-1+wo-2 (+2)=11, commits (+2)=13. Iteration 2 top:
// 13 ≥ 13 → STOP, exactly at the cap (no overshoot). wo-3/wo-4 must never be dispatched. (Before the D2 fix
// the width was counted raw, so an opus wave overshot the cap ~4× — see 2c.)
SCENARIOS.push({
  name: '2a. maxAgents brake — cost-aware wave stops dispatching once the cap is reached',
  args: { mode: 'pro', maxAgents: 13 },
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
    t.ok(hasLog(run, /Agent ceiling reached \(13 ≥ maxAgents 13\)/), 'the brake logs "Agent ceiling reached (13 ≥ maxAgents 13)" — exactly at the cap, no overshoot')
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
// baseline pre-check): baseline-precheck(MECH,1) + baseline(3) + plan(3) = 7 — WP-03 fusion (i),
// MECH_LEAN default: sync-rollups no longer spawns standalone here (folded into the first dispatch, which
// never runs in this scenario). With maxAgents=7 the brake trips at the FIRST loop boundary — BEFORE any
// safe-point/dispatch/build. If spawns were counted raw (1 each) the counter would read 3 and the wave
// would launch.
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
      'counter reads exactly 7 = precheck 1 + COST(opus baseline 3) + COST(opus plan 3) — the opus weighting is live')
    t.ok(byLabel(run, 'safe-point').length === 0, 'brake trips BEFORE the first safe point')
    t.ok(byLabel(run, /^(dispatch|build):/).length === 0, 'no wave was dispatched at all')
  },
})
// 2c: WS-A/D2 — an OPUS-escalated wave must NOT overshoot maxAgents by counting WOs raw. mode 'pro'
// (worker=sonnet floor, judge=opus per DR-015), all WOs difficulty:high → escalate to opus
// (woWaveCost = COST(opus)+1 = 4). Pre-loop: baseline(judge opus,3)+plan(judge opus,3)=6 — WP-03 fusion
// (i), MECH_LEAN default: no standalone sync-rollups spawn here (folded into the first dispatch).
// safe-point→7. remainingAgents=10-7=3; the cost-aware picker admits wo-1 (dispatch 1 + 4 = 5, the
// ≥1 progress guarantee) but wo-2 would need cumulative cost 9 either way → wave width = 1 regardless
// of the exact remaining budget. BEFORE the WS-A/D2 fix the width was counted raw (min(P.wave 2, …)=2),
// so TWO opus WOs launched and the wave overshot the cap.
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
    t.ok(c && /KEEP it implementation/.test(c.prompt), 'the close keeps phase: implementation (BL-0012 fail-closed — no release without hardening evidence)')
    // WP-02: running:false is no longer a hand-written "Set .pandacorp/status.yaml running: false" line —
    // it is achieved through the fenced RELEASE_LEASE two-phase protocol (quiesce -> commit -> finalize-release),
    // folded into this SAME closing agent's own prompt as its terminal step.
    t.ok(c && /quiesce/.test(c.prompt) && /finalize-release/.test(c.prompt), 'the close releases the run through the fenced two-phase lease protocol (running:false via quiesce), not a hand-written running:false')
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
    // WP-02: archive-changes is no longer a separate spawn — its DR-069 §7 sweep is folded into
    // whichever closing agent actually fires (a targeted change build never reaches allDone, so that's
    // notify-end here; a bare/whole-project run would fold it into close-out or close-needs-hardening).
    const arch = byLabel(run, /^(close-out|close-needs-hardening|notify-end)$/)[0]
    t.ok(arch, 'the archive sweep ran folded into the closing agent (this run verified an FRD)')
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
    // WP-02: notify-end no longer hand-writes "running: false" — it closes through the fenced
    // RELEASE_LEASE two-phase protocol (quiesce -> commit -> finalize-release) folded into its own prompt.
    t.ok(byLabel(run, 'notify-end').length === 1 && /quiesce/.test(byLabel(run, 'notify-end')[0].prompt) && /finalize-release/.test(byLabel(run, 'notify-end')[0].prompt), 'targeted FRD completion quiesces as a partial run')
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
      mkWo('wo-g5a-surf', 'PLANNED', { frd: 'frd-g5a-found', artifacts: ['src/app/surface/**'] }),
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
    workOrders: [mkWo('wo-g5b-surf', 'PLANNED', { frd: 'frd-g5b-nullgate', artifacts: ['src/app/surface/**'] })],
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
    workOrders: [mkWo('wo-g5c-surf', 'PLANNED', { frd: 'frd-g5c-missing', artifacts: ['src/app/surface/**'] })],
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


// ── G12. BL-0051 deadlocked-contract — a REOPENED FRD whose WO derogates a contract a BLESSED reviewer
// test still asserts, with the re-blessing WO `dependsOn` the derogating one (LESSON-0104). The engine
// used to stop (blockedReasons error/needs-owner) and wait for a human to hand-edit the blessed test —
// exactly the DR-080-sensitive action the automation is supposed to own. Now the deadlock is BROKEN by
// the independent gate-test-repair reviewer re-blessing the derogated contract; the implementer still
// never touches that test. Only a re-bless that does NOT hold falls back to the needs-owner block.
SCENARIOS.push({
  name: 'G12a. deadlocked-contract — diagnosis routes to the gate-test RE-BLESS lane and the FRD verifies (no block, no manual unblock)',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g9-deadlock',
    deps: [],
    workOrders: [
      mkWo('wo-g9-005', 'PLANNED', { frd: 'frd-g9-deadlock', artifacts: ['src/g9/split/**'] }),                             // derogates the blessed contract
      mkWo('wo-g9-006', 'PLANNED', { frd: 'frd-g9-deadlock', artifacts: ['src/g9/read/**'], deps: ['wo-g9-005'] }),         // recomposes + would re-bless — scheduling-locked behind wo-g9-005
    ],
  }]),
  responses: [
    { label: 'gate:frd-g9-deadlock', times: 1, response: { green: false, reopen: ['wo-g9-005'], findings: [{ wo: 'wo-g9-005', finding: 'aggregateChain.reviewer.test.ts:42 expects phaseTransitions NOT to be called for a fresh portada — the pre-split contract', failingTest: 'src/lib/achievements/read-model/_tests/aggregateChain.reviewer.test.ts', files: ['src/g9/split/portada.ts'] }] } },
    { label: 'patch:frd-g9-deadlock', response: { green: false, cause: 'code', failure: 'no correct implementation satisfies the blessed assertion after the split' } },
    { label: 'diagnose:frd-g9-deadlock', response: { classification: 'deadlocked-contract', repeatsPrior: false, recommendation: 'block-needs-owner', confidence: 'high', seam: { files: ['src/lib/achievements/read-model/_tests/aggregateChain.reviewer.test.ts'], symbol: 'aggregateChain', why: 'the blessed test asserts the pre-split contract that sibling wo-g9-006 intentionally derogates', cleanlySeparable: false } } },
    // gate-test-repair + verify-patch green via the defaults (REPAIR_SCHEMA → { green: true })
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'diagnose:frd-g9-deadlock').length === 1, 'the A3 diagnosis ran and classified the deadlock')
    t.ok(byLabel(run, 'gate-test-repair:frd-g9-deadlock').length === 1, 'the engine routed to the INDEPENDENT gate-test repair (re-bless), not to a block')
    t.ok(byLabel(run, 'block-needs-owner:frd-g9-deadlock').length === 0, 'NO early needs-owner block — the deadlock is broken autonomously (BL-0051)')
    t.ok(byLabel(run, 'verify-patch:frd-g9-deadlock').length === 1, 'an independent verifier re-ran the gate (constitution rule 4)')
    t.ok(run.result && run.result.builtFrds.includes('frd-g9-deadlock'), 'the FRD VERIFIES — no manual intervention, no error/needs-owner block')
    t.ok(run.result && !(run.result.blockedFrds || []).includes('frd-g9-deadlock'), 'the FRD is not blocked')
    t.ok(hasLog(run, /deadlocked-contract/ ) && hasLog(run, /BL-0051/), 'the deadlock-break route is logged, citing BL-0051')
    const repair = byLabel(run, 'gate-test-repair:frd-g9-deadlock')[0]
    t.ok(repair && /derogat/i.test(repair.prompt), 'the repair prompt frames the test as asserting a DEROGATED contract, not an internally inconsistent one')
    t.ok(repair && /wo-g9-005/.test(repair.prompt), 'the repair prompt names the reviewed work order(s) whose change derogated the contract')
  },
})

// (b) the re-bless must not become a rubber stamp: if the reviewer UPHOLDS the blessed test (the
// derogation claim is wrong), the engine still falls back to the needs-owner block — fail-closed.
SCENARIOS.push({
  name: 'G12b. deadlocked-contract — an UPHELD blessed test still falls back to the needs-owner block (fail-closed)',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g9b-upheld',
    deps: [],
    workOrders: [mkWo('wo-g9b-001', 'PLANNED', { frd: 'frd-g9b-upheld', artifacts: ['src/g9b/**'] })],
  }]),
  responses: [
    { label: 'gate:frd-g9b-upheld', response: { green: false, reopen: ['wo-g9b-001'], findings: [{ wo: 'wo-g9b-001', finding: 'x at src/g9b/a.ts:3', files: ['src/g9b/a.ts'] }] } },
    { label: 'patch:frd-g9b-upheld', response: { green: false, cause: 'code', failure: 'still red' } },
    { label: 'diagnose:frd-g9b-upheld', response: { classification: 'deadlocked-contract', repeatsPrior: false, recommendation: 'block-needs-owner', confidence: 'high', seam: { files: ['e2e/blessed.spec.ts'], why: 'claims a sibling derogates it', cleanlySeparable: false } } },
    { label: 'gate-test-repair:frd-g9b-upheld', response: { green: false, cause: 'code', failure: 'test upheld: the derogation is not declared in any work order' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'gate-test-repair:frd-g9b-upheld').length === 1, 'the re-bless lane was attempted first')
    t.ok(byLabel(run, 'verify-patch:frd-g9b-upheld').length === 0, 'no independent verification runs when the re-bless was refused')
    t.ok(byLabel(run, 'block-needs-owner:frd-g9b-upheld').length === 1, 'an upheld blessed test still reaches the needs-owner block — fail-closed, never a rubber stamp')
    t.ok(run.result && (run.result.blockedFrds || []).includes('frd-g9b-upheld'), 'the FRD is blocked when the deadlock claim does not hold')
  },
})

// (c) DR-080 contract: the gate-test repair prompt must keep the derogation judgment routed to the
// INDEPENDENT reviewer and must still forbid the implementer/patcher from touching a blessed test.
SCENARIOS.push({
  name: 'G12c. gate-test repair prompt carries the derogated-contract judgment WITHOUT relaxing DR-080',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g9c-prompt',
    deps: [],
    workOrders: [mkWo('wo-g9c-001', 'PLANNED', { frd: 'frd-g9c-prompt', artifacts: ['src/g9c/**'] })],
  }]),
  responses: [
    { label: 'gate:frd-g9c-prompt', times: 1, response: { green: false, reopen: ['wo-g9c-001'], findings: [{ wo: 'wo-g9c-001', finding: 'y at src/g9c/a.ts:1', files: ['src/g9c/a.ts'] }] } },
    { label: 'patch:frd-g9c-prompt', response: { green: false, cause: 'gate-test-defective', defectiveTests: [{ path: 'e2e/blessed.spec.ts', why: 'asserts the pre-split contract' }] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const repair = byLabel(run, 'gate-test-repair:frd-g9c-prompt')[0]
    t.ok(repair, 'the gate-test repair ran')
    t.ok(repair && /DEROGATED CONTRACT/.test(repair.prompt), 'the prompt offers the THIRD judgment: the contract was intentionally derogated (BL-0051)')
    t.ok(repair && /dependsOn/.test(repair.prompt), 'the prompt tells the reviewer to check the sibling work orders / dependsOn graph for the declared derogation')
    t.ok(repair && /DR-080/.test(repair.prompt), 'the prompt still cites DR-080 — only the independent reviewer may touch a blessed test')
    t.ok(repair && /patcher may not touch them/.test(repair.prompt), 'the implementer/patcher prohibition survives (the rule is routed, never relaxed)')
  },
})

// ── WP-04 / BL-0124: the baseline PRE-CHECK's dirtiness predicate must exclude a lone controller-owned
// status.yaml write under a valid lease, so it stops forcing a whole judge-baseline/verify.sh cycle just
// to reprove a clean tree clean. The exclusion is decided by the ENGINE from the pre-check's structured
// dirtyPaths/leaseValid signal (never from the pre-check's own free-form escalate/green wording), and is
// narrow: exactly one dirty path, exactly `.pandacorp/status.yaml`, unless args.strictBaseline opts out.
SCENARIOS.push({
  name: 'WP04a. BL-0124 — the ONLY dirty path is the leased status.yaml under a valid fence: fast path, NO judge-baseline spawn',
  args: { mode: 'pro' },
  responses: [{ label: 'baseline-precheck', response: { green: true, dirty: true, dirtyPaths: ['.pandacorp/status.yaml'], leaseValid: true } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'baseline').length === 0, 'the judge baseline (full verify.sh cycle) never spawns for a lone leased status.yaml diff')
    t.ok(byLabel(run, 'baseline-precheck').length === 1, 'the cheap pre-check still ran exactly once')
    t.ok(byLabel(run, 'plan').length === 1, 'the run continues past baseline into planning (green, not blocked)')
  },
})
SCENARIOS.push({
  name: 'WP04b. BL-0124 control — a dirty tracked file OTHER than status.yaml still escalates to the judge baseline (narrow exclusion, not a blanket pass)',
  args: { mode: 'pro' },
  responses: [{ label: 'baseline-precheck', response: { escalate: true, dirty: true, dirtyPaths: ['.pandacorp/status.yaml', 'src/x.ts'], leaseValid: true } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'baseline').length === 1, 'ANY other dirty path alongside status.yaml still dispatches the full judge-baseline/verify.sh cycle')
  },
})
SCENARIOS.push({
  name: 'WP04c. args.strictBaseline escape hatch — a lone leased status.yaml diff still escalates when strict mode is requested',
  args: { mode: 'pro', strictBaseline: true },
  responses: [{ label: 'baseline-precheck', response: { escalate: true, dirty: true, dirtyPaths: ['.pandacorp/status.yaml'], leaseValid: true } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'baseline').length === 1, 'strictBaseline restores the pre-WP-04 behavior: even the narrow leased-status case escalates')
    const precheck = byLabel(run, 'baseline-precheck')[0]
    t.ok(precheck && /args\.strictBaseline/.test(precheck.prompt), 'the pre-check prompt reflects that this run launched with args.strictBaseline')
  },
})

// WP-09: the wave log names WHY each non-elected candidate was deferred. Five WOs in one FRD, mode
// 'pro' (P.wave = 2): wo-002 overlaps wo-001's artifacts (deps satisfied but loses the disjoint pick),
// wo-003 depends on wo-001 (not yet done — deps pending), wo-004 is disjoint and fills the 2nd wave
// slot, and wo-005 is disjoint too but never reached because the wave is already at its P.wave=2 cap.
SCENARIOS.push({
  name: 'WP-09. wave log names the deferral reason for each non-elected candidate WO',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-w9-wave-log',
    deps: [],
    workOrders: [
      mkWo('wo-w9-001', 'PLANNED', { frd: 'frd-w9-wave-log', artifacts: ['src/w9/a/**'] }),
      mkWo('wo-w9-002', 'PLANNED', { frd: 'frd-w9-wave-log', artifacts: ['src/w9/a/**'] }),
      mkWo('wo-w9-003', 'PLANNED', { frd: 'frd-w9-wave-log', artifacts: ['src/w9/b/**'], deps: ['wo-w9-001'] }),
      mkWo('wo-w9-004', 'PLANNED', { frd: 'frd-w9-wave-log', artifacts: ['src/w9/c/**'] }),
      mkWo('wo-w9-005', 'PLANNED', { frd: 'frd-w9-wave-log', artifacts: ['src/w9/d/**'] }),
    ],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(hasLog(run, /⚒ wave: 2 WO\(s\).*wo-w9-001.*wo-w9-004/), 'the wave picks the two disjoint, dep-satisfied WOs up to the P.wave=2 cap')
    t.ok(hasLog(run, /↻ deferred:.*wo-w9-002\(artifacts:wo-w9-001\)/), 'wo-002 is deferred as an artifacts overlap against the WO that won the pick')
    t.ok(hasLog(run, /↻ deferred:.*wo-w9-003\(deps:wo-w9-001\)/), 'wo-003 is deferred with its unmet dep named')
    t.ok(hasLog(run, /↻ deferred:.*wo-w9-005\(blocked:wave-cap\)/), 'wo-005 is disjoint from the picked wave but deferred as blocked (the P.wave cap, not an overlap)')
  },
})

// ── WP-11. safe-point cadence in a TARGETED run is throttled (1×/run + 1×/3 checkpoints), a BARE run
// is UNCHANGED (every wantSafePoint boundary still fires, as C1c always did). All three scenarios use
// the SAME 2-wave shape — one FRD, two WOs where the second `deps` on the first, forcing two sequential
// wave dispatches under `pro` (wave width 2, which would otherwise co-schedule both in ONE wave). This
// shape produces exactly 3 wantSafePoint checkpoints in total, VERIFIED against the unmodified engine
// (a single-WO/single-wave bare run alone already produces 2, not 1): the two wave boundaries, PLUS one
// unconditional idle-sweep checkpoint after the FRD's only gate settles (C2's bounded idle-wait sweep,
// `nothingInFlight && gateQueue.length === 0` — pre-existing, untouched by WP-11, present in bare mode
// too). So "2 waves" is 3 checkpoints, not 2 — the counts below are the real, engine-verified numbers,
// not a naive one-per-wave guess (CONV-13: asserted from an in-session run, not assumed).
const wp11Plan = (frd) => mkPlan([{
  frd,
  deps: [],
  workOrders: [
    mkWo(`wo-${frd}-001`, 'PLANNED', { frd, artifacts: [`src/${frd}/a/**`] }),
    mkWo(`wo-${frd}-002`, 'PLANNED', { frd, artifacts: [`src/${frd}/b/**`], deps: [`wo-${frd}-001`] }),
  ],
}])
SCENARIOS.push({
  name: 'WP-11a. TARGETED 2-wave run — safe-point throttled to exactly 1 real spawn (first checkpoint only)',
  args: { mode: 'pro', frds: ['frd-wp11a'] },
  plan: wp11Plan('frd-wp11a'),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const builds = byLabel(run, /^build:/)
    t.ok(builds.length === 2, `both WOs still build across their two waves (got ${builds.length})`)
    const sp = byLabel(run, 'safe-point')
    t.ok(sp.length === 1, `exactly one safe-point spawn on a targeted run (got ${sp.length})`)
    t.ok(sp[0] && sp[0].index < builds[0].index, 'the one safe point that DID run happened before the first wave (owner signals still checked at least once)')
    t.ok(hasLog(run, /safe point #2 saltado/) && hasLog(run, /safe point #3 saltado/), 'the 2nd and 3rd checkpoints are logged as skipped (throttled), not silently dropped')
    t.ok(hasLog(run, /1×\/corrida \+ 1×\/3/), 'the skip log names the WP-11 throttle policy')
  },
})
SCENARIOS.push({
  name: 'WP-11b. bare 2-wave run — safe-point cadence UNCHANGED (fires at all 3 checkpoints, C1c untouched)',
  args: { mode: 'pro' },   // no change, no frds → TARGETED === false, the queue-drain run
  plan: wp11Plan('frd-wp11b'),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const builds = byLabel(run, /^build:/)
    t.ok(builds.length === 2, `both WOs still build across their two waves (got ${builds.length})`)
    const sp = byLabel(run, 'safe-point')
    t.ok(sp.length === 3, `a bare run keeps the ORIGINAL per-checkpoint cadence — 2 wave boundaries + 1 post-gate idle sweep (got ${sp.length})`)
    t.ok(!run.logs.some((l) => /saltado/.test(l)), 'no safe point is ever throttled on a bare run (the drain must never be skipped)')
  },
})
SCENARIOS.push({
  name: 'WP-11c. args.safePointEveryWave:true escape hatch — restores the unthrottled cadence on a TARGETED run too',
  args: { mode: 'pro', frds: ['frd-wp11c'], safePointEveryWave: true },
  plan: wp11Plan('frd-wp11c'),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const builds = byLabel(run, /^build:/)
    t.ok(builds.length === 2, `both WOs still build across their two waves (got ${builds.length})`)
    const sp = byLabel(run, 'safe-point')
    t.ok(sp.length === 3, `the escape hatch matches the bare-run cadence exactly — all 3 checkpoints fire (got ${sp.length})`)
    t.ok(!run.logs.some((l) => /saltado/.test(l)), 'the escape hatch never throttles a checkpoint')
    t.ok(sp[0] && /TARGETED BUILD/.test(sp[0].prompt), 'the run is still genuinely targeted (the safe-point prompt still refuses to drain the queue) — only the CADENCE is restored, not the DR-069 scope guard')
  },
})

// ── G13. WP-01: skip the foundation-gate + visual-qa passes on a run that touches no UI ────────────
// (proposal 37 / FRD-24 measurement: 179s foundation-gate + 761s visual-qa — 24% of wall-clock — on a
// build whose artifacts were only src/lib/** + scripts/**. Both passes exist to protect a UI surface
// (DR-057 foundation completeness, DR-072 visual fidelity); they are pointless when nothing ready/built
// this run declares a UI-touching artifact. artifactsTouchUi fails CLOSED on undeclared/empty artifacts
// (mirrors artifactsOverlap's undeclared-artifacts rule) so this is never a silent skip on missing data.)
// (a) lib-only artifacts on a hasFrontend:true plan → BOTH passes skipped; the omission is logged AND
// carried as a UiPassSkipped dashboard event on the next agent that runs (dispatch: / the closing agent
// — WP-02 folds the visual-qa skip note into whichever of close-out/close-needs-hardening/notify-end fires).
SCENARIOS.push({
  name: 'G13a. WP-01 — lib-only artifacts (hasFrontend:true, no foundation WO) skip foundation-gate AND visual-qa, with the omission logged + a UiPassSkipped event',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g13a-lib',
    deps: [],
    workOrders: [
      mkWo('wo-g13a-001', 'PLANNED', { frd: 'frd-g13a-lib', artifacts: ['src/lib/**'] }),
      mkWo('wo-g13a-002', 'PLANNED', { frd: 'frd-g13a-lib', artifacts: ['scripts/**'] }),
    ],
  }], { hasFrontend: true }),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'foundation-gate').length === 0, 'foundation-gate did NOT run — no ready WO declares a UI artifact')
    t.ok(byLabel(run, 'visual-qa').length === 0, 'visual-qa did NOT run — no built WO declares a UI artifact')
    t.ok(hasLog(run, /foundation-gate omitido/), 'the foundation-gate omission is logged, explicitly (not a silent skip)')
    t.ok(hasLog(run, /visual-qa omitido/), 'the visual-qa omission is logged, explicitly (not a silent skip)')
    const dispatch = byLabel(run, /^dispatch:/)[0]
    t.ok(dispatch && /"event":"UiPassSkipped"/.test(dispatch.prompt) && /"pass":"foundation-gate"/.test(dispatch.prompt), 'the dispatch prompt carries the UiPassSkipped(foundation-gate) dashboard event')
    // WP-02: the visual-qa skip note is folded into whichever closing agent fires (no separate
    // archive-changes spawn anymore) — resolved right before that agent, per the lean close-out shape.
    const closing = byLabel(run, /^(close-out|close-needs-hardening|notify-end)$/)[0]
    t.ok(closing && /"event":"UiPassSkipped"/.test(closing.prompt) && /"pass":"visual-qa"/.test(closing.prompt), 'the closing agent prompt carries the UiPassSkipped(visual-qa) dashboard event')
    t.ok(run.result && run.result.builtFrds.includes('frd-g13a-lib'), 'the FRD still verifies normally — only the two UI-gated passes are skipped')
  },
})
// (b) fail-closed: a WO with EXPLICIT empty artifacts (`artifacts: []`, undeclared/unprovable) can't be
// proven UI-free → both passes run (same fail-safe posture as artifactsOverlap's undeclared-artifacts rule).
SCENARIOS.push({
  name: 'G13b. WP-01 fail-closed — a WO with undeclared (empty) artifacts is NOT provably UI-free, so both passes run',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g13b-undeclared',
    deps: [],
    workOrders: [mkWo('wo-g13b-001', 'PLANNED', { frd: 'frd-g13b-undeclared', artifacts: [] })],
  }], { hasFrontend: true }),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'foundation-gate').length === 1, 'foundation-gate RAN — undeclared artifacts are fail-closed, never treated as UI-free')
    t.ok(byLabel(run, 'visual-qa').length === 1, 'visual-qa RAN — undeclared artifacts are fail-closed, never treated as UI-free')
    t.ok(!hasLog(run, /foundation-gate omitido/), 'no omission logged — the gate genuinely ran')
    t.ok(!hasLog(run, /visual-qa omitido/), 'no omission logged — the pass genuinely ran')
  },
})
// (c) a real UI artifact (.tsx) among the ready/built WOs → both passes run.
SCENARIOS.push({
  name: 'G13c. WP-01 — a .tsx artifact among the ready/built WOs runs both foundation-gate and visual-qa',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g13c-tsx',
    deps: [],
    workOrders: [mkWo('wo-g13c-001', 'PLANNED', { frd: 'frd-g13c-tsx', artifacts: ['src/app/dashboard/Panel.tsx'] })],
  }], { hasFrontend: true }),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'foundation-gate').length === 1, 'foundation-gate RAN — a .tsx artifact is a real UI surface')
    t.ok(byLabel(run, 'visual-qa').length === 1, 'visual-qa RAN — a .tsx artifact is a real UI surface')
  },
})
// (d) the escape hatch: args.forceUiPasses:true always runs both passes, even over lib-only artifacts.
SCENARIOS.push({
  name: 'G13d. WP-01 — args.forceUiPasses:true bypasses the heuristic; both passes run over lib-only artifacts',
  args: { mode: 'pro', forceUiPasses: true },
  plan: mkPlan([{
    frd: 'frd-g13d-force',
    deps: [],
    workOrders: [mkWo('wo-g13d-001', 'PLANNED', { frd: 'frd-g13d-force', artifacts: ['src/lib/**'] })],
  }], { hasFrontend: true }),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'foundation-gate').length === 1, 'forceUiPasses:true — foundation-gate ran despite lib-only artifacts')
    t.ok(byLabel(run, 'visual-qa').length === 1, 'forceUiPasses:true — visual-qa ran despite lib-only artifacts')
    t.ok(!hasLog(run, /foundation-gate omitido/), 'no omission logged — forceUiPasses bypassed the skip, not merely silenced its log')
    t.ok(!hasLog(run, /visual-qa omitido/), 'no omission logged — forceUiPasses bypassed the skip, not merely silenced its log')
  },
})

// ── G14. WP-02: lean close-out — visual-qa fired as a promise (overlaps hardening), archive-changes
// + release-lease folded into the surviving closing agent (proposal 37 / FRD-24 measurement: visual-qa
// 761s + archive-changes 34s + notify-end 186s + release-lease 24s, all fully serial in the close-out
// region). Default (args.leanCloseOut !== false); `false` reverts to the pre-WP-02 fully-serial shape.
// (a) a UI-touching artifact (.tsx) → visual-qa is REGISTERED (the call recorded) before the closing
// agent's call is registered, and — because the engine awaits the visual-qa promise before ever calling
// the closing agent — that ordering in the stub's recorded call list is proof the closing agent's
// dispatch happened after visual-qa resolved, not merely after it was fired.
SCENARIOS.push({
  name: 'G14a. WP-02 — visual-qa is spawned (registered) before the closing agent, and only after it resolves does the closing agent fire',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g14a-ui',
    deps: [],
    workOrders: [mkWo('wo-g14a-001', 'PLANNED', { frd: 'frd-g14a-ui', artifacts: ['src/app/dashboard/Panel.tsx'] })],
  }], { hasFrontend: true }),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const vq = byLabel(run, 'visual-qa')
    t.ok(vq.length === 1, 'visual-qa ran (a .tsx artifact is a real UI surface)')
    const closing = byLabel(run, /^(close-out|close-needs-hardening|notify-end)$/)
    t.ok(closing.length === 1, 'exactly one closing agent ran')
    t.ok(vq[0].index < closing[0].index, 'visual-qa was REGISTERED (spawned) strictly before the closing agent — the engine fires it as a promise ahead of everything else in the close-out region')
    // the closing agent's own commit/write steps causally happen after visual-qa's promise settles
    // (the engine code path awaits it before ever constructing the closing agent's call) — the fixed
    // call ORDER above is exactly that causal guarantee made observable in the stub.
  },
})
// (b) a lib-only run (no UI artifact — visual-qa itself does not run) → the close-out region collapses
// from 3 serial spawns (archive-changes, notify-end/close-out, release-lease) to exactly ONE closing
// spawn, whose prompt carries the FULL verify.sh (no --since), RELEASE_LEASE, and BUILD_COMPLETE — in
// that relative order (RELEASE_LEASE is always the LAST thing the closing agent is told to do).
SCENARIOS.push({
  name: 'G14b. WP-02 — archive-changes + release-lease fold into ONE closing spawn (3 -> 1), carrying full verify.sh / RELEASE_LEASE / BUILD_COMPLETE in order',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g14b-lib',
    deps: [],
    workOrders: [mkWo('wo-g14b-001', 'PLANNED', { frd: 'frd-g14b-lib', artifacts: ['src/lib/**'] })],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'archive-changes').length === 0, 'archive-changes no longer spawns as its own agent — folded into the closing prompt')
    t.ok(byLabel(run, 'release-lease').length === 0, 'release-lease no longer spawns as its own agent — folded into the closing prompt')
    const closing = byLabel(run, /^(close-out|close-needs-hardening|notify-end)$/)
    t.ok(closing.length === 1, 'the close-out region collapsed to exactly ONE closing spawn (was 3 serial spawns pre-WP-02)')
    const prompt = closing[0].prompt
    const iVerify = prompt.indexOf('complete suite, NO --since')
    const iBuildComplete = prompt.indexOf('"event":"BuildComplete"')
    const iReleaseLease = prompt.indexOf('fenced TWO-PHASE protocol')
    t.ok(iVerify !== -1, 'the closing prompt runs the FULL verify.sh (no --since — the whole-repo counterweight, untouched)')
    t.ok(iBuildComplete !== -1, 'the closing prompt carries the BuildComplete terminal-verdict event')
    t.ok(iReleaseLease !== -1, 'the closing prompt carries the RELEASE_LEASE two-phase protocol')
    t.ok(iVerify < iBuildComplete && iBuildComplete < iReleaseLease, 'verify.sh precedes BuildComplete precedes RELEASE_LEASE — the terminal lease release is always the LAST instruction, after everything else has finished')
    t.ok(/quiesce/.test(prompt) && /finalize-release/.test(prompt), 'the RELEASE_LEASE two-phase (quiesce -> commit -> finalize-release) is literally present')
    // the archive-changes sweep's own protocol text is folded in verbatim (durable, cross-run archival)
    t.ok(/verify-then-archive/.test(prompt) && /affected_frds/.test(prompt), 'the archive-changes DR-069 §7 sweep text is folded into the SAME closing prompt')
  },
})
// (c) the visual-qa agent dies (returns null, e.g. a terminal API error after retries) → the closing
// agent STILL runs (never blocked on visual-qa) and the degradation is explicit, never silent.
SCENARIOS.push({
  name: 'G14c. WP-02 — a null visual-qa result degrades honestly; the closing agent still runs and says so',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g14c-null',
    deps: [],
    workOrders: [mkWo('wo-g14c-001', 'PLANNED', { frd: 'frd-g14c-null', artifacts: ['src/app/Widget.tsx'] })],
  }], { hasFrontend: true }),
  responses: [
    { label: 'visual-qa', response: null },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'visual-qa').length === 1, 'visual-qa was attempted')
    const closing = byLabel(run, /^(close-out|close-needs-hardening|notify-end)$/)
    t.ok(closing.length === 1, 'the closing agent still ran despite the dead visual-qa agent (nothing depends on its result)')
    t.ok(hasLog(run, /visual-qa agent returned no confirmed result/i), 'the degradation is logged explicitly, never silent')
    t.ok(/VISUAL QA DEGRADED/.test(closing[0].prompt), 'the closing prompt carries an explicit degraded-result note (never silence)')
    t.ok(run.result && run.result.builtFrds.includes('frd-g14c-null'), 'the FRD still verified normally — only the advisory visual-qa pass degraded')
  },
})
// (d) escape hatch: args.leanCloseOut:false reverts to the pre-WP-02 shape — visual-qa awaited fully in
// series, then archive-changes, then the closing agent, then release-lease: back to 3 close-out spawns.
SCENARIOS.push({
  name: 'G14d. WP-02 — args.leanCloseOut:false reverts to the legacy fully-serial close-out (3 spawns)',
  args: { mode: 'pro', leanCloseOut: false },
  plan: mkPlan([{
    frd: 'frd-g14d-legacy',
    deps: [],
    workOrders: [mkWo('wo-g14d-001', 'PLANNED', { frd: 'frd-g14d-legacy', artifacts: ['src/lib/**'] })],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'archive-changes').length === 1, 'legacy shape — archive-changes spawns as its own agent again')
    const closing = byLabel(run, /^(close-out|close-needs-hardening|notify-end)$/)
    t.ok(closing.length === 1, 'exactly one closing agent ran')
    t.ok(byLabel(run, 'release-lease').length === 1, 'legacy shape — release-lease spawns as its own terminal agent again')
    // the legacy closing prompt never carries the fenced lease protocol itself — that stays the separate
    // release-lease agent's job, exactly as before WP-02.
    t.ok(!/fenced TWO-PHASE protocol/.test(closing[0].prompt), 'the legacy closing prompt does NOT itself carry RELEASE_LEASE — that is release-lease\'s separate job')
    t.ok(/running: false/.test(closing[0].prompt), 'the legacy closing prompt hand-writes running: false, exactly as before WP-02')
    const archive = byLabel(run, 'archive-changes')[0]
    const closeCall = closing[0]
    const release = byLabel(run, 'release-lease')[0]
    t.ok(archive.index < closeCall.index && closeCall.index < release.index, 'the legacy shape runs the three close-out spawns in the original serial order: archive-changes -> closing agent -> release-lease')
  },
})

// ═════════════════════════════════════════════════════════════════════════════
// REV-* — ADVERSARIAL REVIEW SCENARIOS (speed sprint A/B, DR-015 independent reviewer)
// Written by the reviewer, NOT by the implementers of WP-01/02/04/09/11. Each one probes a
// boundary the sprint's own TDD did not: a mixed artifact list, a REJECTED (not merely null)
// promise, a dirty-path list the engine must refuse to narrow, a deeper safe-point cadence,
// the lease-renewal side effect the throttle silently also throttles, and the overlap the
// WP-02 comment claims. A RED here is a finding, not a flaky test.
// ═════════════════════════════════════════════════════════════════════════════

// ── REV-1. WP-01 heuristic, MIXED artifact list: a WO whose artifacts are mostly backend
// (src/lib/**, scripts/**) but include ONE stylesheet is a UI-touching WO. artifactsTouchUi is an
// ANY-match, so a single `.css` among lib globs must be enough to keep both UI-gated passes.
SCENARIOS.push({
  name: 'REV-1. WP-01 mixed artifacts — one .css among lib/script globs still runs foundation-gate AND visual-qa',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-rev1-mixed',
    deps: [],
    workOrders: [
      mkWo('wo-rev1-001', 'PLANNED', { frd: 'frd-rev1-mixed', artifacts: ['src/lib/parse.ts', 'scripts/build.mjs', 'src/theme/palette.css'] }),
    ],
  }], { hasFrontend: true }),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'foundation-gate').length === 1, 'foundation-gate RAN — a .css artifact makes the WO UI-touching even among lib/script globs')
    t.ok(byLabel(run, 'visual-qa').length === 1, 'visual-qa RAN — same ANY-match rule at the end-of-build pass')
    t.ok(!hasLog(run, /omitido/), 'neither UI pass was logged as omitted')
  },
})

// ── REV-2. WP-02 honest degradation, the case the sprint did NOT cover: visual-qa does not merely
// return null — its agent() promise REJECTS (a terminal tool/API error surfaces as a throw, which the
// harness models with `throws`). The close-out region must survive it exactly as it survives a null:
// the closing agent still runs and the terminal RELEASE_LEASE is never lost. Today the engine awaits
// the promise bare (engine :2226), so the rejection escapes the whole close-out.
SCENARIOS.push({
  name: 'REV-2. WP-02 — a REJECTED visual-qa promise must still reach the closing agent and the terminal lease release',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-rev2-throw',
    deps: [],
    workOrders: [mkWo('wo-rev2-001', 'PLANNED', { frd: 'frd-rev2-throw', artifacts: ['src/app/Widget.tsx'] })],
  }], { hasFrontend: true }),
  responses: [
    { label: 'visual-qa', throws: new Error('terminal API error after retries') },
  ],
  assert(t, run) {
    t.ok(!run.error, `the rejected visual-qa promise must NOT escape the close-out region (engine threw: ${run.error})`)
    t.ok(byLabel(run, 'visual-qa').length === 1, 'visual-qa was attempted')
    const closing = byLabel(run, /^(close-out|close-needs-hardening|notify-end)$/)
    t.ok(closing.length === 1, 'a closing agent still ran despite the rejected visual-qa promise')
    const leaseReleased = run.calls.some((c) => /finalize-release/.test(c.prompt))
    t.ok(leaseReleased, 'the terminal two-phase lease release (quiesce -> commit -> finalize-release) still reaches some agent — running:false is never stranded')
  },
})

// ── REV-3. WP-04 / BL-0124 — the exclusion must never widen. Four probes the sprint did not run.
SCENARIOS.push({
  name: 'REV-3a. WP-04 — status.yaml PLUS a second gitignored-looking path (.pandacorp/run/x) still escalates',
  args: { mode: 'pro' },
  responses: [{ label: 'baseline-precheck', response: { escalate: true, dirty: true, dirtyPaths: ['.pandacorp/status.yaml', '.pandacorp/run/x'], leaseValid: true } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'baseline').length === 1, 'two dirty paths — even when the second one only LOOKS like runtime scratch — still run the full judge baseline')
    t.ok(!hasLog(run, /BL-0124/), 'the BL-0124 fast-path log never fires for a multi-path dirty tree')
  },
})
SCENARIOS.push({
  name: 'REV-3b. WP-04 — a lone status.yaml diff WITHOUT leaseValid:true escalates (the fence is not optional)',
  args: { mode: 'pro' },
  responses: [{ label: 'baseline-precheck', response: { escalate: true, dirty: true, dirtyPaths: ['.pandacorp/status.yaml'] } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'baseline').length === 1, 'an unproven lease fence never buys the fast path')
  },
})
SCENARIOS.push({
  name: 'REV-3c. WP-04 — a dirtyPath carrying git-porcelain XY status characters does NOT match the exclusion',
  args: { mode: 'pro' },
  responses: [{ label: 'baseline-precheck', response: { escalate: true, dirty: true, dirtyPaths: [' M .pandacorp/status.yaml'], leaseValid: true } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'baseline').length === 1, 'a mis-shaped dirtyPaths entry fails SAFE (escalates) instead of being fuzzily matched')
  },
})
SCENARIOS.push({
  name: 'REV-3d. WP-04 — a BL-0022 root-guard failure outranks the BL-0124 fast path (red stays red)',
  args: { mode: 'pro' },
  responses: [{ label: 'baseline-precheck', response: { green: false, failure: 'BL-0022 root guard: project root is not a git repo', dirtyPaths: ['.pandacorp/status.yaml'], leaseValid: true } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'baseline').length === 0, 'no judge baseline is dispatched on a root-guard failure')
    t.ok(byLabel(run, 'plan').length === 0, 'the run never proceeds to planning on a root-guard failure')
    t.ok(run.result && run.result.note === 'baseline red (needs manual fix)', 'the run stops on the baseline-red path, NOT on the BL-0124 green fast path')
  },
})

// ── REV-4/5. WP-11 — a DEEPER targeted run (6 chained WOs => 7 wantSafePoint checkpoints) proves the
// 1 + every-3rd cadence lands on checkpoints 1, 4 and 7 exactly; and (REV-5) that the throttle ALSO
// throttles the engine's ONLY lease-renewal site (RENEW_LEASE is embedded in the safe-point prompt and
// appears nowhere else in the engine — grep-verified), which the WP-11 rationale never accounts for.
const revChain = (frd, n) => mkPlan([{
  frd,
  deps: [],
  workOrders: Array.from({ length: n }, (_, i) =>
    mkWo(`wo-${frd}-${String(i + 1).padStart(3, '0')}`, 'PLANNED', {
      frd,
      artifacts: [`src/${frd}/s${i + 1}/**`],
      deps: i === 0 ? [] : [`wo-${frd}-${String(i).padStart(3, '0')}`],
    })),
}])
SCENARIOS.push({
  name: 'REV-4. WP-11 — a targeted run with 7 safe-point checkpoints fires them at 1, 4 and 7 (and skips 2,3,5,6)',
  args: { mode: 'pro', frds: ['frd-rev4'] },
  plan: revChain('frd-rev4', 6),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const skipped = run.logs.filter((l) => /safe point #\d+ saltado/.test(l)).map((l) => Number(/safe point #(\d+)/.exec(l)[1]))
    const sp = byLabel(run, 'safe-point')
    t.ok(sp.length + skipped.length === 7, `the shape produces 7 safe-point checkpoints (ran ${sp.length} + skipped ${skipped.length})`)
    t.ok(sp.length === 3, `exactly 3 safe points actually run under the 1 + every-3rd throttle (got ${sp.length})`)
    t.ok(JSON.stringify(skipped) === JSON.stringify([2, 3, 5, 6]), `the skipped checkpoints are exactly 2,3,5,6 — i.e. the run ones are 1,4,7 (skipped: ${JSON.stringify(skipped)})`)
  },
})
SCENARIOS.push({
  name: 'REV-5. WP-11 — every safe-point checkpoint must still RENEW the lease (RENEW_LEASE is the engine\'s only renewal site)',
  args: { mode: 'pro', frds: ['frd-rev5'] },
  plan: revChain('frd-rev5', 6),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const skipped = run.logs.filter((l) => /safe point #\d+ saltado/.test(l)).length
    const checkpoints = byLabel(run, 'safe-point').length + skipped
    const renewals = run.calls.filter((c) => /renew --project/.test(c.prompt)).length
    t.ok(checkpoints === 7, `sanity: the shape produced the expected 7 checkpoints (got ${checkpoints})`)
    t.ok(renewals >= checkpoints, `the atomic lease is renewed at EVERY checkpoint boundary, not only at the un-throttled ones — the lease TTL is 600s and this is the engine's only renewal site (renewals=${renewals}, checkpoints=${checkpoints})`)
  },
})

// ── REV-6. WP-02 claim check. The engine comment (:2187-2190) states visual-qa's wall-clock "overlaps"
// the hardening chain. It does not: the await sits at :2226, ABOVE the `allDone` block that calls
// runHardeningChain(). This scenario pins the ACTUAL (and, for the single-git-writer discipline, the
// SAFE) behaviour — visual-qa is fully settled before the first hardening spawn — so the comment's
// claim is measurably false and the sprint's headline wall-clock win is not realized here.
globalThis.__revVqSettled = false
globalThis.__revSecSawSettledVq = null
SCENARIOS.push({
  name: 'REV-6. WP-02 — visual-qa is fully RESOLVED before the hardening chain starts (no real overlap; the engine comment overstates it)',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-rev6-ui',
    deps: [],
    workOrders: [mkWo('wo-rev6-001', 'PLANNED', { frd: 'frd-rev6-ui', artifacts: ['src/app/Panel.tsx'] })],
  }], { hasFrontend: true }),
  responses: [
    // a visual-qa that takes real (async) time to settle: if the engine genuinely overlapped it with the
    // hardening chain, `visualQaSettled` would still be false when the first hardening agent is spawned.
    { label: 'visual-qa', response: async () => { await new Promise((r) => setTimeout(r, 25)); globalThis.__revVqSettled = true; return { done: true } } },
    { label: 'hardening:security-audit', response: () => { globalThis.__revSecSawSettledVq = globalThis.__revVqSettled === true; return { done: true } } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'visual-qa').length === 1, 'visual-qa ran')
    t.ok(byLabel(run, 'hardening:security-audit').length === 1, 'the hardening chain ran (bare, all-verified run reaches allDone)')
    t.ok(globalThis.__revSecSawSettledVq === true, 'visual-qa had ALREADY settled when the hardening chain started — the passes are serial, not overlapped (keeps a single git writer, but the WP-02 comment claims otherwise)')
  },
})

// ── REV-7. WP-01 heuristic gap: artifact paths that are unambiguously UI but match none of
// UI_ARTIFACT_RE's alternatives (engine :1337) — the Tailwind config that owns every token, and a
// public/ image the routes render. Both currently read as "no UI artifacts" and silently skip the
// DR-057 foundation gate and the DR-072 visual-QA pass.
SCENARIOS.push({
  name: 'REV-7. WP-01 — tailwind.config.ts + public/*.svg are UI artifacts and must NOT skip the UI-gated passes',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-rev7-gap',
    deps: [],
    workOrders: [mkWo('wo-rev7-001', 'PLANNED', { frd: 'frd-rev7-gap', artifacts: ['tailwind.config.ts', 'public/hero.svg'] })],
  }], { hasFrontend: true }),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'foundation-gate').length === 1, 'foundation-gate must run — tailwind.config.ts owns the design tokens the DR-057 foundation check exists for')
    t.ok(byLabel(run, 'visual-qa').length === 1, 'visual-qa must run — a Tailwind config + a rendered public/ asset are exactly the fidelity surface DR-072 protects')
  },
})

// ── REV-D6. WP-01/WP-02 fail-closed empty-builtWos guard. builtWos is derived at both close-out sites
// as `builtFrds.flatMap((frd) => (frdState.get(frd) || {}).f?.workOrders || [])` — a frdState MISS for
// every built FRD is not reachable through a normal simulated run (frdState.set happens synchronously
// for every plan.frds entry before anything can build, so nothing ever reaches builtFrds without an
// entry), so this is unit-tested directly against the REAL production text: extract UI_ARTIFACT_RE,
// artifactsTouchUi and uiPassesRequired verbatim from the engine source (never re-implemented here) and
// exercise uiPassesRequired([]) — the shape an empty/miss builtWos list takes at either call site.
function loadUiPassesRequired(forceUiPasses) {
  const extractConst = (name) => {
    const m = source.match(new RegExp(`const ${name} = [^\\n]*\\n`))
    if (!m) throw new Error(`REV-D6 harness: could not find 'const ${name}' in the engine source — update the extraction`)
    return m[0]
  }
  const body = `const FORCE_UI_PASSES = forceUiPasses;\n${extractConst('UI_ARTIFACT_RE')}${extractConst('artifactsTouchUi')}${extractConst('uiPassesRequired')}return uiPassesRequired;`
  return new Function('forceUiPasses', body)(forceUiPasses)
}
SCENARIOS.push({
  name: 'REV-D6. WP-01/WP-02 — an EMPTY builtWos (frdState miss OR a genuinely zero-WO FRD) fails CLOSED, never silently reads as "no UI"',
  args: { mode: 'pro' },
  assert(t) {
    const uiPassesRequired = loadUiPassesRequired(false)
    t.ok(uiPassesRequired([]) === true, 'an EMPTY builtWos list forces the UI-gated passes to run (fail-closed on an unreadable/miss state, not a silent skip)')
    t.ok(uiPassesRequired([{ artifacts: ['src/lib/parse.ts'] }]) === false, 'a REAL non-empty, non-UI builtWos list still correctly skips — the fix does not relax the existing per-WO heuristic (REV-1/G13a unaffected)')
    t.ok(uiPassesRequired([{ artifacts: ['src/app/Page.tsx'] }]) === true, 'a REAL UI-touching builtWos list still correctly forces the passes (G13c unaffected)')
    const forced = loadUiPassesRequired(true)
    t.ok(forced([{ artifacts: ['src/lib/parse.ts'] }]) === true, 'args.forceUiPasses still forces the passes regardless of builtWos content (G13d unaffected)')
  },
})

// ── E2. BL-0129 — a bare run's empty-plan exit drains the DR-069 ready-changes queue ──────────────
// Before this fix, a bare `/implement` (no args.frds/args.change) whose planner found plan.frds.length
// === 0 (every FRD VERIFIED) exited via ensureStopped('nothing to build') BEFORE the main loop ever
// ran — the only safePoint() call lived INSIDE that loop, so a genuinely `ready` change sitting in
// .pandacorp/inbox/changes/ was silently never drained. drainReadyQueuePreLoop() (next to safePoint())
// now runs once on that path; a TARGETED run keeps the drain forbidden (unchanged, DR-069).
SCENARIOS.push({
  name: 'E2a. bare run, empty plan, empty queue — one pre-loop safe-point, then a clean "nothing to build" exit',
  args: { mode: 'pro' }, // no change, no frds → TARGETED === false
  plan: mkPlan([]),
  responses: [
    { label: 'safe-point-pre-loop', response: { stop: false, ready: [], unblocked: [] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const sp = byLabel(run, 'safe-point-pre-loop')
    t.ok(sp.length === 1, `exactly one pre-loop safe-point spawn (got ${sp.length})`)
    t.ok(sp[0] && /List \.pandacorp\/inbox\/changes/.test(sp[0].prompt), 'the pre-loop safe-point scans the ready-changes queue (DR-069)')
    t.ok(byLabel(run, /^process-change:/).length === 0, 'nothing to drain — no change is processed')
    t.ok(byLabel(run, 'plan-post-drain').length === 0, 'no re-plan happens when the queue was already empty')
    t.ok(byLabel(run, /^build:/).length === 0, 'no build: spawn — there is genuinely nothing to build')
    const stopped = byLabel(run, 'ensure-stopped')
    t.ok(stopped.length === 1 && /--reason "nothing to build"/.test(stopped[0].prompt), 'the engine still performs the fenced pre-loop close with reason "nothing to build"')
    t.ok(hasLog(run, /cola vacía/), 'the engine logs an explicit "cola vacía" line — the queue WAS checked, not skipped')
    t.ok(run.result && run.result.note === 'all verified', 'the bounded no-work result is returned')
  },
})
SCENARIOS.push({
  name: 'E2b. bare run, empty plan, a ready change IS queued — drains it, re-plans, and builds the new work',
  args: { mode: 'pro' }, // no change, no frds → TARGETED === false
  plan: mkPlan([]), // the FIRST planner call finds nothing (every existing FRD VERIFIED)
  responses: [
    { label: 'safe-point-pre-loop', response: { stop: false, ready: ['queued-change-e2b'], unblocked: [] } },
    { label: 'process-change:queued-change-e2b', response: { done: true, affectedFrds: ['frd-e2b-drain'], changeFile: 'queued-change-e2b.md' } },
    { label: 'plan-post-drain', response: mkPlan([{
      frd: 'frd-e2b-drain',
      deps: [],
      workOrders: [mkWo('wo-e2b-001', 'PLANNED', { frd: 'frd-e2b-drain', artifacts: ['src/e2b/**'] })],
    }]) },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'safe-point-pre-loop').length === 1, 'the pre-loop safe-point ran exactly once')
    const proc = byLabel(run, /^process-change:/)
    t.ok(proc.length === 1 && proc[0].label === 'process-change:queued-change-e2b', 'the ready change was drained via the existing processChange() path')
    t.ok(byLabel(run, 'plan-post-drain').length === 1, 'the planner re-ran once, picking up the FRD the drain just created/updated')
    t.ok(hasLog(run, /Cola de changes drenada antes del plan vacío/), 'the engine logs that it drained the queue before re-planning')
    const built = byLabel(run, /^build:/)
    t.ok(built.length >= 1 && built.some((c) => c.label === 'build:wo-e2b-001'), `the drained work order actually built (got [${built.map((c) => c.label).join(', ')}])`)
    t.ok(run.result && run.result.builtFrds && run.result.builtFrds.includes('frd-e2b-drain'), 'the FRD created by the drained change built and verified this run')
    t.ok(run.result && run.result.note !== 'all verified', 'the run no longer reports the false "all verified" — it did real work')
  },
})
SCENARIOS.push({
  name: 'E2c. targeted run, empty plan — the pre-loop drain never runs (DR-069 targeted scope holds)',
  args: { mode: 'pro', frds: ['frd-e2c-done'] }, // TARGETED === true
  plan: mkPlan([]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'safe-point-pre-loop').length === 0, 'ZERO pre-loop safe-point spawns on a targeted run — the drain is forbidden, unchanged')
    t.ok(byLabel(run, /^process-change:/).length === 0, 'nothing is drained')
    t.ok(run.result && run.result.note === 'all verified', 'the already-verified targeted scope returns the bounded no-work result, exactly as before this fix')
    const stopped = byLabel(run, 'ensure-stopped')
    t.ok(stopped.length === 1 && /--reason "nothing to build"/.test(stopped[0].prompt), 'the fenced pre-loop close still runs with reason "nothing to build"')
  },
})
SCENARIOS.push({
  name: 'E2d. bare run, empty plan, args.drainOnEmptyPlan:false — the escape hatch restores the pre-fix behavior',
  args: { mode: 'pro', drainOnEmptyPlan: false }, // bare (no change, no frds) but the drain is explicitly disabled
  plan: mkPlan([]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'safe-point-pre-loop').length === 0, 'ZERO pre-loop safe-point spawns — the escape hatch skips the drain even though the run is bare')
    t.ok(byLabel(run, /^process-change:/).length === 0, 'nothing is drained')
    t.ok(run.result && run.result.note === 'all verified', 'behaves exactly like a pre-BL-0129 bare run with an empty plan')
    const stopped = byLabel(run, 'ensure-stopped')
    t.ok(stopped.length === 1 && /--reason "nothing to build"/.test(stopped[0].prompt), 'the fenced pre-loop close still runs with reason "nothing to build"')
  },
})

// ── WP-03. Plumbing diet — the 9 class-(a) + 5 class-(b) MECH sites (spike report classification) run
// on the narrow pandacorp:mech agent (Bash+Read, no Write/Edit) at effort:'low' instead of the broad
// pandacorp:implementer/pandacorp:devops at default effort. This package actually CONVERTS 12 of the 15
// spike-classified sites: all 9 class-(a) + 3 of the 5 class-(b) (commit, archive-changes, notify-end).
// TWO class-(b) sites — apply-gate, persist-block — are DELIBERATELY left untouched: both sit inside the
// "reparación" region (~1088-1150 on the pre-WP-03 file) another package in this sprint owns; touching
// them risks exactly the merge collision DR-096 isolation exists to avoid. safe-point (class c, genuine
// judgment — matching the owner's free-form decision answers to blocked work orders) is also untouched,
// as directed. Plus two spawn-count fusions (i: sync-rollups folds into the first wave's dispatch; ii:
// capturePin reuses commitWOGreen's own reported sha instead of spawning its own pin: agent) and one
// prompt fusion (iii: the commit writer's two fire-and-forget printfs run in one bash call).
const siteKeepsOriginalAgentType = (labelAnchor) => {
  const i = source.indexOf(labelAnchor)
  if (i === -1) return false
  const window = source.slice(i, i + 220)
  return /agentType: 'pandacorp:implementer'/.test(window) && !/MECH_AGENT/.test(window)
}
SCENARIOS.push({
  name: 'WP03a. static scan — the 12 WP-03 sites PLUS the 3 integration-time reconciled sites (renew-lease, safe-point-pre-loop, evidence:<frd>) carry agentType:MECH_AGENT(...)+effort:MECH_EFFORT; safe-point/apply-gate/persist-block keep their ORIGINAL agentType',
  args: { mode: 'pro' },
  plan: mkPlan([]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const mechAgentCount = (source.match(/agentType: MECH_AGENT\(/g) || []).length
    const mechEffortCount = (source.match(/effort: MECH_EFFORT/g) || []).length
    // 15 = WP-03's original 12 + 3 reconciled at integration time (integration-speed-sprint-a merge
    // notes): the D-1 fix's 'renew-lease' spawn and the E2/BL-0129 'safe-point-pre-loop' spawn (both
    // merged with wp-03-plumbing-diet, both single mechanical Bash+Read steps with no Write/Edit —
    // unlike in-loop 'safe-point' they never flip BLOCKED→PLANNED frontmatter or commit, so nothing
    // keeps them out of mech), plus WP-06's `evidence:<frd>` collector (merged with wp-06-digested-gate;
    // its own comment already called it "a MECH, effort:'low', zero-judgment agent" but had hardcoded
    // that shape instead of using the WP-03 MECH_AGENT/MECH_EFFORT helpers — reconciled onto them so it
    // also respects args.mechLean:false like every other mech site).
    t.ok(mechAgentCount === 15, `exactly 15 call sites use agentType: MECH_AGENT(...) (got ${mechAgentCount})`)
    t.ok(mechEffortCount === 15, `exactly 15 call sites carry effort: MECH_EFFORT, one per MECH_AGENT(...) site (got ${mechEffortCount})`)
    t.ok(siteKeepsOriginalAgentType("label: 'safe-point'") && !siteKeepsOriginalAgentType("label: 'safe-point-pre-loop'"), 'in-loop safe-point (class c, genuine judgment + frontmatter mutation) keeps its ORIGINAL agentType — never converted; the pre-loop sibling (read-only) is NOT covered by this same anchor')
    t.ok(siteKeepsOriginalAgentType('label: `apply-gate:${frd}`'), 'apply-gate keeps its ORIGINAL agentType — inside the parallel "reparación" region this package does not touch')
    t.ok(siteKeepsOriginalAgentType('label: `persist-block:${frd}`'), 'persist-block keeps its ORIGINAL agentType — inside the parallel "reparación" region this package does not touch')
    t.ok(!siteKeepsOriginalAgentType("label: 'renew-lease'"), 'renew-lease (D-1, reconciled at merge time) now carries MECH_AGENT/MECH_EFFORT like the other mechanical single-command spawns')
    t.ok(!siteKeepsOriginalAgentType("label: 'safe-point-pre-loop'"), 'safe-point-pre-loop (E2/BL-0129, reconciled at merge time) now carries MECH_AGENT/MECH_EFFORT — it is read-only, no Write/Edit needed')
    t.ok(!siteKeepsOriginalAgentType('label: `evidence:${frd}`'), 'evidence:<frd> (WP-06, reconciled at merge time) now carries MECH_AGENT/MECH_EFFORT instead of its own hardcoded pandacorp:implementer/low')
  },
})
// (b)+(a live cross-check of the static scan above) a default (MECH_LEAN) run: dispatch/commit/gate-worktree
// resolve to pandacorp:mech+low; safe-point resolves to its UNCHANGED pandacorp:implementer, no effort
// override; fusion (i) — 0 sync-rollups spawns, folded into the first dispatch's own prompt; fusion (ii) —
// 0 pin: spawns, both WOs committed this wave so capturePin reused commitWOGreen's own reported sha.
SCENARIOS.push({
  name: 'WP03b. default MECH_LEAN run — dispatch/commit/gate-worktree resolve pandacorp:mech+low; safe-point stays pandacorp:implementer (no effort); 0 sync-rollups; 0 pin (wave committed)',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-wp03b-lib',
    deps: [],
    workOrders: [
      mkWo('wo-wp03b-001', 'PLANNED', { frd: 'frd-wp03b-lib', artifacts: ['src/lib/**'] }),
      mkWo('wo-wp03b-002', 'PLANNED', { frd: 'frd-wp03b-lib', artifacts: ['scripts/**'] }),
    ],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const dispatch = byLabel(run, /^dispatch:/)[0]
    t.ok(dispatch && dispatch.opts.agentType === 'pandacorp:mech' && dispatch.opts.effort === 'low', 'dispatch resolves to pandacorp:mech + effort low')
    t.ok(dispatch && /sync-rollups --project/.test(dispatch.prompt), 'fusion (i): the FIRST dispatch prompt carries the sync-rollups command')
    const commits = byLabel(run, /^commit:/)
    t.ok(commits.length === 2 && commits.every((c) => c.opts.agentType === 'pandacorp:mech' && c.opts.effort === 'low'), 'both commit spawns resolve to pandacorp:mech + effort low')
    const gw = byLabel(run, 'gate-worktree')[0]
    t.ok(gw && gw.opts.agentType === 'pandacorp:mech' && gw.opts.effort === 'low', 'gate-worktree resolves to pandacorp:mech + effort low')
    const sp = byLabel(run, 'safe-point')
    t.ok(sp.length >= 1 && sp.every((c) => c.opts.agentType === 'pandacorp:implementer' && c.opts.effort === undefined), 'safe-point (class c) is UNCHANGED — pandacorp:implementer, no effort override')
    t.ok(byLabel(run, 'sync-rollups').length === 0, 'fusion (i): no standalone sync-rollups spawn')
    t.ok(byLabel(run, /^pin:/).length === 0, 'fusion (ii): no pin: spawn — both WOs committed this wave, capturePin reused the cached sha')
  },
})
// (e) escape hatch: args.mechLean:false reverts EVERY converted site's agentType/effort AND both
// spawn-count fusions to the pre-WP-03 shape (isolates a regression to this package).
SCENARIOS.push({
  name: 'WP03c. args.mechLean:false escape hatch — reverts agentTypes/effort AND both spawn-count fusions (sync-rollups + pin) to the pre-WP-03 shape',
  args: { mode: 'pro', mechLean: false },
  plan: mkPlan([{
    frd: 'frd-wp03c-lib',
    deps: [],
    workOrders: [
      mkWo('wo-wp03c-001', 'PLANNED', { frd: 'frd-wp03c-lib', artifacts: ['src/lib/**'] }),
      mkWo('wo-wp03c-002', 'PLANNED', { frd: 'frd-wp03c-lib', artifacts: ['scripts/**'] }),
    ],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const dispatch = byLabel(run, /^dispatch:/)[0]
    t.ok(dispatch && dispatch.opts.agentType === 'pandacorp:implementer' && dispatch.opts.effort === undefined, 'dispatch reverts to pandacorp:implementer, no effort override')
    t.ok(dispatch && !/sync-rollups --project/.test(dispatch.prompt), 'dispatch no longer carries the sync-rollups command — it is its own spawn again')
    const commits = byLabel(run, /^commit:/)
    t.ok(commits.length === 2 && commits.every((c) => c.opts.agentType === 'pandacorp:implementer' && c.opts.effort === undefined), 'commit reverts to pandacorp:implementer, no effort override')
    const gw = byLabel(run, 'gate-worktree')[0]
    t.ok(gw && gw.opts.agentType === 'pandacorp:implementer' && gw.opts.effort === undefined, 'gate-worktree reverts to pandacorp:implementer, no effort override')
    t.ok(byLabel(run, 'sync-rollups').length === 1, 'fusion (i) reverted: the standalone Plan-phase sync-rollups spawn runs again')
    t.ok(byLabel(run, /^pin:/).length === 1, 'fusion (ii) reverted: pin: always spawns its own agent, even though the wave committed')
  },
})
// (c) the commit: prompt still carries the selective-staging + sibling-file-prohibition invariants
// UNCHANGED, plus the fusion (ii)/(iii) additions (sha in the schema/prompt, the two printfs in one bash
// call); the closing prompt still carries RELEASE_LEASE.
SCENARIOS.push({
  name: 'WP03d. commit: prompt keeps its selective-staging + sibling-file-prohibition invariants, plus fusion (ii) sha + fusion (iii) one-heredoc; the closing prompt keeps RELEASE_LEASE',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-wp03d-lib',
    deps: [],
    workOrders: [mkWo('wo-wp03d-001', 'PLANNED', { frd: 'frd-wp03d-lib', artifacts: ['src/lib/**'] })],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const commit = byLabel(run, /^commit:/)[0]
    t.ok(commit && /staging ONLY this work order's own files/.test(commit.prompt), "the commit prompt still stages ONLY this WO's own files")
    t.ok(commit && /Sibling work orders of the same wave may be MID-BUILD — do NOT stage or touch their files/.test(commit.prompt), 'the commit prompt still forbids touching sibling files')
    t.ok(commit && commit.opts.schema && commit.opts.schema.properties && commit.opts.schema.properties.sha, 'fusion (ii): the commit schema now advertises an optional sha field')
    t.ok(commit && /git rev-parse --short HEAD/.test(commit.prompt) && /"committed": 1, "sha":|committed: 1, sha:/.test(commit.prompt.replace(/\\"/g, '"')), 'fusion (ii): the commit prompt asks for the landed sha back')
    t.ok(commit && /SINGLE bash call/.test(commit.prompt) && /wo_commit/.test(commit.prompt) && /wo_end/.test(commit.prompt), 'fusion (iii): the TRACK(wo_end) + wo_commit event printfs are fused into one bash call')
    const closing = byLabel(run, /^(close-out|close-needs-hardening|notify-end)$/)[0]
    t.ok(closing && /fenced TWO-PHASE protocol/.test(closing.prompt), 'the closing prompt still carries the RELEASE_LEASE fenced two-phase protocol')
    const rlIndex = closing.prompt.indexOf('fenced TWO-PHASE protocol')
    t.ok(rlIndex > closing.prompt.length * 0.5, 'RELEASE_LEASE sits in the back half of the closing prompt (near the end, after every other step)')
  },
})
// (f) total spawn count for the G13a fixture (2 disjoint no-UI WOs, mode 'pro', hasFrontend:true, full
// allDone path) drops vs the integration-speed-sprint-a base branch — measured directly by running the
// SAME stub harness shape against both engine sources (git show integration-speed-sprint-a:... vs this
// file): base = 19 total spawns, after WP-03 = 17 (-2: fusion i removes the standalone sync-rollups spawn,
// fusion ii removes the pin: spawn since both WOs committed this wave) — see the session report for the
// side-by-side trace.
SCENARIOS.push({
  name: 'WP03e. G13a fixture — total spawn count drops vs the integration-speed-sprint-a base branch (19 -> 17)',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-g13a-lib',
    deps: [],
    workOrders: [
      mkWo('wo-g13a-001', 'PLANNED', { frd: 'frd-g13a-lib', artifacts: ['src/lib/**'] }),
      mkWo('wo-g13a-002', 'PLANNED', { frd: 'frd-g13a-lib', artifacts: ['scripts/**'] }),
    ],
  }], { hasFrontend: true }),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(run.calls.length === 17, `total spawns for this fixture is 17 (was 19 on integration-speed-sprint-a before WP-03) — got ${run.calls.length}: ${run.calls.map((c) => c.label).join(', ')}`)
    t.ok(byLabel(run, 'sync-rollups').length === 0, 'the removed spawn: standalone sync-rollups (fusion i)')
    t.ok(byLabel(run, /^pin:/).length === 0, 'the removed spawn: pin (fusion ii — the wave committed both WOs)')
  },
})
// fusion (ii) safety net: a same-wave repair (attemptRepair ALWAYS commits on its own, fix or block+revert)
// invalidates the cached sha for EVERY FRD that wave — even one unrelated to the repair — because HEAD
// advanced past the repair's own commit; capturePin must spawn a FRESH pin: rather than trust a sha that
// predates that commit.
SCENARIOS.push({
  name: 'WP03f. fusion (ii) safety — a same-wave repair (even on an unrelated FRD) invalidates the cached sha; pin: still spawns fresh, never stale',
  args: { mode: 'pro' },
  plan: mkPlan([
    { frd: 'frd-wp03f-ok', deps: [], workOrders: [mkWo('wo-wp03f-ok-001', 'PLANNED', { frd: 'frd-wp03f-ok', artifacts: ['src/ok/**'] })] },
    { frd: 'frd-wp03f-bad', deps: [], workOrders: [mkWo('wo-wp03f-bad-001', 'PLANNED', { frd: 'frd-wp03f-bad', artifacts: ['src/bad/**'] })] },
  ]),
  responses: [
    { label: 'build:wo-wp03f-bad-001', response: { green: false } },
    { label: 'repair:frd-wp03f-bad', response: { green: false, blocked_reason: 'error' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'commit:wo-wp03f-ok-001').length === 1, "frd-wp03f-ok's WO committed normally this wave")
    t.ok(byLabel(run, /^repair:/).length === 1, "frd-wp03f-bad's WO failed self-test and triggered the wave-level repair")
    t.ok(byLabel(run, /^pin:/).length === 1, 'pin: STILL spawns for frd-wp03f-ok — the same-wave repair (on a DIFFERENT FRD) invalidates the cached sha (conservative, correct: HEAD advanced past the repair commit)')
  },
})
// legacy close-out (args.leanCloseOut:false) live cross-check: archive-changes/release-lease/notify-end
// still resolve to pandacorp:mech+low under default MECH_LEAN, even though they are the SEPARATE spawns
// WP-02's lean shape normally folds away.
SCENARIOS.push({
  name: 'WP03g. legacy close-out (args.leanCloseOut:false) — archive-changes/notify-end/release-lease resolve pandacorp:mech+low',
  args: { mode: 'pro', leanCloseOut: false },
  plan: mkPlan([
    { frd: 'frd-wp03g-ok', deps: [], workOrders: [mkWo('wo-wp03g-ok-001', 'PLANNED', { frd: 'frd-wp03g-ok', artifacts: ['src/ok/**'] })] },
    { frd: 'frd-wp03g-bad', deps: [], workOrders: [mkWo('wo-wp03g-bad-001', 'PLANNED', { frd: 'frd-wp03g-bad', artifacts: ['src/bad/**'] })] },
  ]),
  responses: [
    { label: 'gate:frd-wp03g-bad', response: { green: false, blocked_reason: 'needs-owner', failure: 'x' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(run.result && run.result.builtFrds.includes('frd-wp03g-ok'), 'frd-wp03g-ok verified normally')
    t.ok(run.result && run.result.blockedFrds.includes('frd-wp03g-bad'), 'frd-wp03g-bad blocked (needs-owner) — so allDone is false, forcing the notify-end branch')
    const archive = byLabel(run, 'archive-changes')[0]
    t.ok(archive && archive.opts.agentType === 'pandacorp:mech' && archive.opts.effort === 'low', 'archive-changes (legacy, its own spawn again) resolves to pandacorp:mech + effort low')
    const notify = byLabel(run, 'notify-end')[0]
    t.ok(notify && notify.opts.agentType === 'pandacorp:mech' && notify.opts.effort === 'low', 'notify-end resolves to pandacorp:mech + effort low')
    const release = byLabel(run, 'release-lease')[0]
    t.ok(release && release.opts.agentType === 'pandacorp:mech' && release.opts.effort === 'low', 'release-lease (legacy, its own terminal spawn again) resolves to pandacorp:mech + effort low')
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// WP06 — DIGESTED GATE EVIDENCE (args.gateEvidence: 'explore' | 'digested')
// The gate is the build's ONE independent oracle, so every assertion below is
// paired: the DEFAULT ('explore', no args) must stay byte-identical to the
// pre-WP-06 contract, and 'digested' may change only the gate's INPUT (the
// evidence it is handed), never its model, its effort, or what it must prove.
// ─────────────────────────────────────────────────────────────────────────────

// Cross-scenario capture: the runner executes SCENARIOS strictly in order, so the
// explore-mode gate opts recorded by WP06a are available to WP06e's A/B assertion.
const wp06GateOpts = {}

const wp06Wo = (id, frd, extra = {}) => ({ ...mkWo(id, 'PLANNED', { frd, artifacts: extra.artifacts || [`src/${id}/**`] }), acText: extra.acText })

// A green report fixture shaped exactly like WP-05's `.pandacorp/run/gate-report.json`.
const wp06GreenReport = JSON.stringify({
  at: '2026-09-22T10:00:00Z', scope: 'since', green: true,
  subgates: [{ name: 'biome', exit: 0, duration_ms: 1200, failures: [] }, { name: 'vitest', exit: 0, duration_ms: 8400, failures: [] }],
})
const wp06RedReport = JSON.stringify({
  at: '2026-09-22T10:00:00Z', scope: 'since', green: false,
  subgates: [{ name: 'tsc', exit: 2, duration_ms: 3100, failures: [
    { file: 'src/wp06d-001/a.ts', line: 42, code: 'TS2345', msg: 'WP06-FAILURE-ONE argument of type string is not assignable' },
    { file: 'src/wp06d-001/b.ts', line: 7, code: 'TS2551', msg: 'WP06-FAILURE-TWO property total does not exist on type Cart' },
  ] }],
})

// ── (a) DEFAULT — no args.gateEvidence: the explore contract is untouched, zero collector spawns ──
SCENARIOS.push({
  name: 'WP06a. DEFAULT (no args.gateEvidence) — the gate keeps the explore contract; ZERO evidence spawns',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-wp06a', deps: [], workOrders: [wp06Wo('wo-wp06a-001', 'frd-wp06a', { acText: 'AC-06-001.1 WHEN the cart is empty THE SYSTEM SHALL show the empty state' })] }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-wp06a')[0]
    t.ok(gate, 'the FRD gate ran')
    if (gate) wp06GateOpts.explore = { model: gate.opts.model, effort: gate.opts.effort }
    t.ok(gate && /Run the FOCUSED gate/.test(gate.prompt), 'explore keeps the literal "Run the FOCUSED gate" order')
    t.ok(gate && !/YOUR EVIDENCE IS ALREADY COLLECTED/.test(gate.prompt), 'explore carries NO digested marker')
    t.ok(gate && !/ATTACHMENT 1\/3/.test(gate.prompt), 'explore carries no evidence attachments')
    t.ok(gate && !/GateEvidenceFallback/.test(gate.prompt), 'explore is not a fallback — no fallback event in the prompt')
    t.ok(byLabel(run, /^evidence:/).length === 0, 'no evidence collector was spawned in the default mode')
    t.ok(run.result && run.result.builtFrds.includes('frd-wp06a'), 'the FRD verified normally')
  },
})

// ── (b) digested — ONE collector, spawned BEFORE the gate, and its output IS the gate's material ──
SCENARIOS.push({
  name: "WP06b. args.gateEvidence:'digested' — one evidence: spawn BEFORE gate:, whose report/diff/AC land in the gate prompt",
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: mkPlan([{ frd: 'frd-wp06b', deps: [], workOrders: [wp06Wo('wo-wp06b-001', 'frd-wp06b', { artifacts: ['src/wp06b/**'], acText: 'AC-06-002.1 WHEN WP06-AC-PROBE THE SYSTEM SHALL render the panel' })] }]),
  responses: [
    { prefix: 'evidence:', response: { report: wp06GreenReport, diffStat: ' src/wp06b/panel.tsx | 12 ++++ WP06-STAT-PROBE', diff: '--- a/src/wp06b/panel.tsx\n+++ b/src/wp06b/panel.tsx\n+// WP06-DIFF-PROBE', truncated: false, ac: 'AC-06-002.1 WHEN WP06-AC-PROBE THE SYSTEM SHALL render the panel' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const evs = byLabel(run, /^evidence:/)
    const gate = byLabel(run, 'gate:frd-wp06b')[0]
    t.ok(evs.length === 1, `exactly ONE evidence collector spawned (got ${evs.length})`)
    t.ok(evs[0] && evs[0].label === 'evidence:frd-wp06b', 'the collector is labelled evidence:<frd>')
    t.ok(gate && evs[0] && evs[0].index < gate.index, `the collector spawns BEFORE the gate (evidence @${evs[0] && evs[0].index}, gate @${gate && gate.index})`)
    t.ok(evs[0] && evs[0].opts.model === 'haiku' && evs[0].opts.effort === 'low', 'the collector runs on the MECH tier at effort low (it judges nothing)')
    t.ok(evs[0] && /GATE WORKTREE/.test(evs[0].prompt), 'the collector runs in the PINNED gate worktree, not the moving main tree')
    t.ok(evs[0] && /--since/.test(evs[0].prompt) && /--report-all/.test(evs[0].prompt), 'the collector runs verify.sh --since <last_green> --report-all')
    t.ok(evs[0] && /src\/wp06b\/\*\*/.test(evs[0].prompt), "the collector is told the reviewed WOs' artifacts, so the diff is scoped to them")
    t.ok(gate && /YOUR EVIDENCE IS ALREADY COLLECTED/.test(gate.prompt), 'the gate prompt carries the digested marker')
    t.ok(gate && !/1\) Review the changed work orders[\s\S]*?2\) Run the FOCUSED gate/.test(gate.prompt), 'the digested gate no longer carries the bare "run the FOCUSED gate" discovery order')
    t.ok(gate && gate.prompt.includes('WP06-STAT-PROBE'), 'the diff STAT is attached to the gate prompt')
    t.ok(gate && gate.prompt.includes('WP06-DIFF-PROBE'), 'the unified diff is attached to the gate prompt')
    t.ok(gate && gate.prompt.includes('WP06-AC-PROBE'), 'the verbatim EARS acceptance criteria are attached to the gate prompt')
    t.ok(gate && gate.prompt.includes('"name":"vitest"'), 'the gate-report.json content is attached verbatim')
    t.ok(gate && /at most 8 additional file reads/.test(gate.prompt), 'the digested gate carries the bounded exploration budget (N=8)')
    t.ok(gate && /Whole-FRD source oracle/.test(gate.prompt), 'WHOLE_FRD_ORACLE survives digested mode')
    t.ok(gate && /adversarial tests/.test(gate.prompt), 'DR-080 adversarial tests are still demanded in digested mode')
    t.ok(gate && /traceability/i.test(gate.prompt), 'the 7-class traceability inventory is still demanded in digested mode')
    t.ok(run.result && run.result.builtFrds.includes('frd-wp06b'), 'the FRD verified through the digested gate')
  },
})

// ── (c) fail-closed: a dead collector degrades to explore, loudly — never a gate without evidence ──
SCENARIOS.push({
  name: 'WP06c. fail-closed — a NULL collector verdict degrades the gate to EXPLORE mode with a GateEvidenceFallback',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: mkPlan([{ frd: 'frd-wp06c', deps: [], workOrders: [wp06Wo('wo-wp06c-001', 'frd-wp06c')] }]),
  responses: [{ prefix: 'evidence:', response: null }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-wp06c')[0]
    t.ok(byLabel(run, /^evidence:/).length === 1, 'the collector was attempted')
    t.ok(gate, 'the gate STILL ran (never skipped for want of evidence)')
    t.ok(gate && /Run the FOCUSED gate/.test(gate.prompt), 'the gate fell back to the explore contract')
    t.ok(gate && !/YOUR EVIDENCE IS ALREADY COLLECTED/.test(gate.prompt), 'no digested marker on the fallback gate')
    t.ok(gate && /GateEvidenceFallback/.test(gate.prompt), 'the gate prompt emits the GateEvidenceFallback event')
    t.ok(hasLog(run, /GateEvidenceFallback/), 'the fallback is logged, never silent')
    t.ok(run.result && run.result.builtFrds.includes('frd-wp06c'), 'the run still converges through the explore gate')
  },
})
SCENARIOS.push({
  name: 'WP06c2. fail-closed — an unparseable report / a non-boolean green also degrade to EXPLORE',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: mkPlan([
    { frd: 'frd-wp06c2a', deps: [], workOrders: [wp06Wo('wo-wp06c2a-001', 'frd-wp06c2a')] },
    { frd: 'frd-wp06c2b', deps: [], workOrders: [wp06Wo('wo-wp06c2b-001', 'frd-wp06c2b')] },
  ]),
  responses: [
    { label: 'evidence:frd-wp06c2a', response: { report: '{not json', diffStat: 's', diff: 'd', truncated: false, ac: 'a' } },
    { label: 'evidence:frd-wp06c2b', response: { report: JSON.stringify({ at: 'x', scope: 'since', green: 'yes', subgates: [] }), diffStat: 's', diff: 'd', truncated: false, ac: 'a' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    for (const frd of ['frd-wp06c2a', 'frd-wp06c2b']) {
      const gate = byLabel(run, `gate:${frd}`)[0]
      t.ok(gate && /Run the FOCUSED gate/.test(gate.prompt), `${frd}: degraded to the explore contract`)
      t.ok(gate && !/YOUR EVIDENCE IS ALREADY COLLECTED/.test(gate.prompt), `${frd}: no digested marker`)
      t.ok(gate && /GateEvidenceFallback/.test(gate.prompt), `${frd}: the fallback event is emitted`)
    }
    t.ok(run.logs.filter((l) => /GateEvidenceFallback/.test(l)).length === 2, 'both malformed packs were logged as fallbacks')
  },
})

// ── (d) a RED report reaches the gate whole — every failure row, not a summary ──
SCENARIOS.push({
  name: 'WP06d. a red report (green:false, 2 failures) reaches the gate prompt with BOTH failures intact',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: mkPlan([{ frd: 'frd-wp06d', deps: [], workOrders: [wp06Wo('wo-wp06d-001', 'frd-wp06d', { artifacts: ['src/wp06d-001/**'] })] }]),
  responses: [
    { prefix: 'evidence:', response: { report: wp06RedReport, diffStat: ' src/wp06d-001/a.ts | 3 +-', diff: '--- a/src/wp06d-001/a.ts', truncated: true, ac: 'AC-06-004.1 WHEN x THE SYSTEM SHALL y' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-wp06d')[0]
    t.ok(gate && /YOUR EVIDENCE IS ALREADY COLLECTED/.test(gate.prompt), 'a red report is still a VALID pack — digested mode holds (green:false is data, not a malformed pack)')
    t.ok(gate && gate.prompt.includes('WP06-FAILURE-ONE'), 'failure #1 reaches the gate prompt')
    t.ok(gate && gate.prompt.includes('WP06-FAILURE-TWO'), 'failure #2 reaches the gate prompt')
    t.ok(gate && gate.prompt.includes('"green":false'), 'the red verdict itself reaches the gate prompt')
    t.ok(gate && /TRUNCATED/.test(gate.prompt), 'a truncated diff is LABELLED as truncated (never passed off as complete)')
  },
})

// ── (e) the trust boundary is untouched: identical model + effort in both modes (DR-015) ──
SCENARIOS.push({
  name: 'WP06e. DR-015 invariant — the gate spawn model AND effort are byte-identical in explore and digested',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: mkPlan([{ frd: 'frd-wp06e', deps: [], workOrders: [wp06Wo('wo-wp06e-001', 'frd-wp06e')] }]),
  responses: [
    { prefix: 'evidence:', response: { report: wp06GreenReport, diffStat: 's', diff: 'd', truncated: false, ac: 'a' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-wp06e')[0]
    t.ok(gate, 'the digested gate ran')
    t.ok(gate && gate.opts.model === 'opus', 'the digested gate still runs on the OPUS judge (DR-015 — never downgraded)')
    t.ok(gate && gate.opts.effort === 'xhigh', "the digested serial gate keeps effort:'xhigh'")
    t.ok(gate && gate.opts.agentType === 'pandacorp:reviewer', 'the digested gate is still the reviewer agent')
    t.ok(wp06GateOpts.explore, 'WP06a captured the explore-mode gate opts (A/B baseline)')
    t.ok(wp06GateOpts.explore && gate && wp06GateOpts.explore.model === gate.opts.model,
      `A/B: model identical in both modes (explore=${wp06GateOpts.explore && wp06GateOpts.explore.model}, digested=${gate && gate.opts.model})`)
    t.ok(wp06GateOpts.explore && gate && wp06GateOpts.explore.effort === gate.opts.effort,
      `A/B: effort identical in both modes (explore=${wp06GateOpts.explore && wp06GateOpts.explore.effort}, digested=${gate && gate.opts.effort})`)
  },
})

// ── (f) the oracle still bites: a digested verdict missing the 7 traceability classes is RED ──
SCENARIOS.push({
  name: 'WP06f. enforceWholeFrdTraceability still REJECTS a green verdict missing the 7 classes in digested mode',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: mkPlan([{ frd: 'frd-wp06f', deps: [], workOrders: [wp06Wo('wo-wp06f-001', 'frd-wp06f')] }]),
  responses: [
    { prefix: 'evidence:', response: { report: wp06GreenReport, diffStat: 's', diff: 'd', truncated: false, ac: 'a' } },
    // a "green" verdict whose inventory covers only 2 of the 7 required contract classes
    { prefix: 'gate:', response: { green: true, traceability: [
      { contract: 'REQ-06-001', contractClass: 'requirement', status: 'pass', tests: ['t.test.ts'] },
      { contract: 'AC-06-001.1', contractClass: 'acceptance-criterion', status: 'pass', tests: ['t.test.ts'] },
    ] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'gate:frd-wp06f').length >= 1, 'the digested gate ran')
    t.ok(byLabel(run, 'apply-gate:frd-wp06f').length === 0, 'NOTHING was stamped VERIFIED on a traceability-deficient verdict')
    t.ok(hasLog(run, /whole-FRD traceability is missing/), 'the engine-side oracle named the traceability deficiency')
    t.ok(run.result && !run.result.builtFrds.includes('frd-wp06f'), 'the FRD did NOT pass')
    t.ok(run.result && run.result.blockedFrds.includes('frd-wp06f'), 'it ended BLOCKED instead (fail-closed)')
  },
})

// ── (g) the SPLIT gate in digested mode: one collection, five readers (4 lenses + the closer) ──
SCENARIOS.push({
  name: 'WP06g. digested SPLIT gate — ONE collector feeds all 4 finder lenses AND the closer; effort still high, judge still opus',
  args: { mode: 'powerful', gateEvidence: 'digested' },
  plan: mkPlan([{
    frd: 'frd-wp06g', deps: [],
    // reopen_count >= 1 → the split engages on the FIRST gate this run (C1a serial-first)
    workOrders: [{ ...mkWo('wo-wp06g-001', 'PLANNED', { frd: 'frd-wp06g', artifacts: ['src/wp06g/**'], reopen_count: 1 }), acText: 'AC-06-007.1 WHEN WP06G-AC THE SYSTEM SHALL hold' }],
  }]),
  responses: [
    { prefix: 'evidence:', response: { report: wp06GreenReport, diffStat: ' src/wp06g/x.ts | 2 +- WP06G-STAT', diff: '+// WP06G-DIFF', truncated: false, ac: 'AC-06-007.1 WHEN WP06G-AC THE SYSTEM SHALL hold' } },
    { label: /^find:/, response: { findings: [] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^evidence:/).length === 1, 'ONE collector for the whole split gate (not one per lens)')
    const finders = byLabel(run, /^find:/)
    t.ok(finders.length === 4, `all 4 finder lenses spawned (got ${finders.length})`)
    t.ok(finders.every((c) => c.prompt.includes('WP06G-DIFF') && c.prompt.includes('WP06G-AC')), 'every finder lens received the same evidence pack')
    t.ok(finders.every((c) => /READ-ONLY/.test(c.prompt) && /do NOT run .verify\.sh./.test(c.prompt)), 'the finders stay read-only and still never run verify.sh')
    const closer = byLabel(run, 'gate:frd-wp06g')[0]
    t.ok(closer && /YOUR EVIDENCE IS ALREADY COLLECTED/.test(closer.prompt), 'the split CLOSE stage carries the digested marker')
    t.ok(closer && closer.prompt.includes('WP06G-STAT'), 'the closer received the diff stat')
    t.ok(closer && closer.opts.model === 'opus', 'the split closer is still the OPUS judge (DR-015)')
    t.ok(closer && closer.opts.effort === 'high', "the split closer keeps its own effort:'high' (C1d) — digested mode changes no effort anywhere")
    t.ok(closer && /Whole-FRD source oracle/.test(closer.prompt), 'WHOLE_FRD_ORACLE survives in the split closer too')
    t.ok(run.result && run.result.builtFrds.includes('frd-wp06g'), 'the FRD verifies through the digested split gate')
  },
})

// ── (h) scope guard: a re-gate on the QUIESCED MAIN tree never carries a (stale-pin) evidence pack ──
SCENARIOS.push({
  name: 'WP06h. scope — a REJECT re-gate on main runs in EXPLORE mode (no stale-pin digest), and collects no second pack',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: mkPlan([{ frd: 'frd-wp06h', deps: [], workOrders: [wp06Wo('wo-wp06h-001', 'frd-wp06h')] }]),
  responses: [
    { prefix: 'evidence:', response: { report: wp06GreenReport, diffStat: 's', diff: 'd', truncated: false, ac: 'a' } },
    // first gate rejects with no reopen list → repair, then ONE re-gate on main (which must be explore)
    { label: 'gate:frd-wp06h', times: 1, response: { green: false, failure: 'integration is red' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gates = byLabel(run, 'gate:frd-wp06h')
    t.ok(gates.length === 2, `the first gate rejected and exactly one re-gate ran (got ${gates.length})`)
    t.ok(gates[0] && /YOUR EVIDENCE IS ALREADY COLLECTED/.test(gates[0].prompt), 'the FIRST (pinned, concurrent) gate was digested')
    t.ok(gates[1] && !/YOUR EVIDENCE IS ALREADY COLLECTED/.test(gates[1].prompt), 'the re-gate on main is EXPLORE — a pack from a superseded pin is never reused')
    t.ok(gates[1] && /Run the FOCUSED gate/.test(gates[1].prompt), 'the re-gate carries the full explore contract')
    t.ok(gates[1] && !/GATE WORKTREE/.test(gates[1].prompt), 'the re-gate runs on the main tree, not the frozen worktree')
    t.ok(byLabel(run, /^evidence:/).length === 1, 'no second collection was paid for the re-gate')
  },
})

// ═════════════════════════════════════════════════════════════════════════════
// WP08 — SCOPED REPAIR LOOP (proposal 37 / FRD-24: one red gate cost 589 s and $4.30, 3.5x what
// building the two work orders cost). Four independent guarantees, each with its own scenario:
//   (1) THE CAGE (unconditional, not behind any flag): a gate-report whose `scope` is "partial" —
//       what verify.sh stamps on every `--only`/`--files` run — can NEVER promote a work order to
//       VERIFIED nor advance last_green_sha. This is the invariant the whole package rests on.
//   (2) deterministic classification of the failing SUB-GATE from the gate report, routing a purely
//       MECHANICAL failure (lint|types|structure|cycles) to a cheap sonnet fixer with a scoped inner
//       loop, while everything else keeps today's opus ladder byte-for-byte.
//   (3) the FINAL certification re-gate inside attemptPatch stays LITERALLY whole-project.
//   (4) a cost brake: repair spend per FRD, weighted by the same COST() the engine already uses,
//       capped at args.repairBudgetFactor x that FRD's measured build spend; exhaustion is an honest
//       needs-owner exit (gate report attached, work preserved), never a silent grind.
// (2) and (4) sit behind `args.scopedRepair` (DEFAULT FALSE — see the engine header for why).
// ═════════════════════════════════════════════════════════════════════════════

// ── (a) THE CAGE — the most important regression test of this package ──────────────────────────
SCENARIOS.push({
  name: 'WP08a1. cage — a gate claiming green with gate-report scope:"partial" never stamps VERIFIED / advances last_green_sha',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-wp08a1-lib',
    deps: [],
    workOrders: [mkWo('wo-wp08a1-001', 'PLANNED', { frd: 'frd-wp08a1-lib', artifacts: ['src/lib/**'] })],
  }]),
  responses: [{ prefix: 'gate:', response: { green: true, report_scope: 'partial' } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^apply-gate:/).length === 0, 'NO apply-gate spawn — apply-gate is the only agent that stamps VERIFIED + advances last_green_sha, and it never runs on a partial report')
    t.ok(!(run.result && run.result.builtFrds.includes('frd-wp08a1-lib')), 'the FRD is NOT counted as built off a scoped gate')
    t.ok(hasLog(run, /partial/i), 'the refusal is logged explicitly (never a silent downgrade)')
  },
})
SCENARIOS.push({
  name: 'WP08a2. cage — the independent post-patch verifier claiming green on a partial report is refused too (it is the OTHER path to VERIFIED)',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-wp08a2-lib',
    deps: [],
    workOrders: [mkWo('wo-wp08a2-001', 'PLANNED', { frd: 'frd-wp08a2-lib', artifacts: ['src/lib/**'] })],
  }]),
  responses: [
    { prefix: 'gate:', response: { green: false, reopen: ['wo-wp08a2-001'], findings: [{ wo: 'wo-wp08a2-001', finding: 'src/lib/a.ts:3 missing guard', files: ['src/lib/a.ts'] }] } },
    { prefix: 'patch:', response: { green: true } },
    { prefix: 'verify-patch:', response: { green: true, report_scope: 'partial' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^verify-patch:/).length >= 1, 'the independent verifier did run')
    t.ok(!(run.result && run.result.builtFrds.includes('frd-wp08a2-lib')), 'a partial-report verification never marks the FRD built')
    t.ok(byLabel(run, /^revert:/).length >= 1, 'the refusal falls through to the normal revert+reopen path — the same place a red verification lands')
    t.ok(hasLog(run, /partial/i), 'the refusal names the partial scope')
  },
})
SCENARIOS.push({
  name: 'WP08a3. cage — an absent report_scope stays BACK-COMPATIBLE (only the literal "partial" is refused)',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-wp08a3-lib',
    deps: [],
    workOrders: [mkWo('wo-wp08a3-001', 'PLANNED', { frd: 'frd-wp08a3-lib', artifacts: ['src/lib/**'] })],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^apply-gate:/).length === 1, 'a green gate with no report_scope field still applies (pre-WP-08 agents keep working)')
    t.ok(run.result && run.result.builtFrds.includes('frd-wp08a3-lib'), 'and the FRD verifies exactly as before')
  },
})
SCENARIOS.push({
  name: 'WP08a4. cage — every certification prompt ASKS for report_scope verbatim (the JS check needs the field to exist)',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-wp08a4-lib',
    deps: [],
    workOrders: [mkWo('wo-wp08a4-001', 'PLANNED', { frd: 'frd-wp08a4-lib', artifacts: ['src/lib/**'] })],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, /^gate:/)[0]
    const apply = byLabel(run, /^apply-gate:/)[0]
    t.ok(gate && /report_scope/.test(gate.prompt), 'the FRD gate prompt asks for report_scope')
    t.ok(gate && /gate-report\.json/.test(gate.prompt), 'and tells it where to read the value from')
    t.ok(apply && /report_scope/.test(apply.prompt), 'the apply-gate prompt asks for report_scope')
  },
})

// ── (b/c) DETERMINISTIC CLASSIFICATION — mechanical goes cheap+scoped, everything else unchanged ──
const wp08MechGate = (wo, file) => ({
  green: false,
  reopen: [wo],
  findings: [{ wo, finding: `${file}:12 type error`, files: [file] }],
  gateReport: {
    scope: 'since',
    green: false,
    subgates: [
      { name: 'tsc', exit: 2, failures: [{ file, line: 12, code: 'TS2345', msg: 'Argument of type string is not assignable' }] },
      { name: 'biome', exit: 0, failures: [] },
    ],
  },
})
SCENARIOS.push({
  name: 'WP08b. classification types -> a SONNET/medium fixer with --only=tsc --files=<touched> in its inner loop (not opus xhigh)',
  args: { mode: 'pro', scopedRepair: true },
  plan: mkPlan([{
    frd: 'frd-wp08b-lib',
    deps: [],
    workOrders: [mkWo('wo-wp08b-001', 'PLANNED', { frd: 'frd-wp08b-lib', artifacts: ['src/lib/**'] })],
  }]),
  responses: [
    { prefix: 'gate:', response: wp08MechGate('wo-wp08b-001', 'src/lib/b.ts'), times: 1 },
    { prefix: 'patch:', response: { green: true } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const patch = byLabel(run, /^patch:/)[0]
    t.ok(Boolean(patch), 'a patch was attempted')
    t.ok(patch && patch.opts.model === 'sonnet', `the mechanical fix runs on SONNET (got ${patch && patch.opts.model})`)
    t.ok(patch && patch.opts.effort === 'medium', `at effort medium (got ${patch && patch.opts.effort})`)
    t.ok(patch && /--only=tsc\b/.test(patch.prompt), 'its inner self-repair loop is told to use the scoped gate --only=tsc')
    t.ok(patch && /--files=src\/lib\/b\.ts/.test(patch.prompt), 'scoped to the files the gate report anchored the failures to')
    t.ok(hasLog(run, /mechanical/i), 'the deterministic classification is logged')
  },
})
SCENARIOS.push({
  name: 'WP08c. classification unit-test -> the CURRENT ladder (opus xhigh, no scoped inner loop)',
  args: { mode: 'pro', scopedRepair: true },
  plan: mkPlan([{
    frd: 'frd-wp08c-lib',
    deps: [],
    workOrders: [mkWo('wo-wp08c-001', 'PLANNED', { frd: 'frd-wp08c-lib', artifacts: ['src/lib/**'] })],
  }]),
  responses: [
    {
      prefix: 'gate:',
      response: {
        green: false,
        reopen: ['wo-wp08c-001'],
        findings: [{ wo: 'wo-wp08c-001', finding: 'behavior wrong', files: ['src/lib/c.ts'] }],
        gateReport: { scope: 'since', green: false, subgates: [{ name: 'vitest', exit: 1, failures: [{ file: 'src/lib/_tests/c.test.ts', msg: 'expected 2 got 3' }] }] },
      },
      times: 1,
    },
    { prefix: 'patch:', response: { green: true } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const patch = byLabel(run, /^patch:/)[0]
    t.ok(patch && patch.opts.model === 'opus', `a failing unit test is real-behavior work — stays on OPUS (got ${patch && patch.opts.model})`)
    t.ok(patch && patch.opts.effort === 'xhigh', `at effort xhigh, exactly as today (got ${patch && patch.opts.effort})`)
    t.ok(patch && !/--only=/.test(patch.prompt), 'no scoped inner loop is offered for a non-mechanical failure')
  },
})
SCENARIOS.push({
  name: "WP08g. classification never overrides cause:'gate-test-defective' (LESSON-0002) — a mechanical route still lands on the gate-test repair",
  args: { mode: 'pro', scopedRepair: true },
  plan: mkPlan([{
    frd: 'frd-wp08g-lib',
    deps: [],
    workOrders: [mkWo('wo-wp08g-001', 'PLANNED', { frd: 'frd-wp08g-lib', artifacts: ['src/lib/**'] })],
  }]),
  responses: [
    { prefix: 'gate:', response: wp08MechGate('wo-wp08g-001', 'src/lib/g.ts'), times: 1 },
    { prefix: 'patch:', response: { green: false, cause: 'gate-test-defective', defectiveTests: [{ path: 'e2e/g.spec.ts', why: 'asserts a viewport it never forces' }] } },
    { prefix: 'gate-test-repair:', response: { green: true } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^gate-test-repair:/).length === 1, "the patcher's gate-test-defective verdict still routes to the BL-0001 gate-test repair — the sub-gate classification names the GATE, never the culprit")
    t.ok(byLabel(run, /^diagnose:/).length === 0, 'and never to the code-fault diagnosis ladder')
    t.ok(run.result && run.result.builtFrds.includes('frd-wp08g-lib'), 'the correct build is preserved, not rebuilt')
  },
})

// ── (d) THE FINAL RE-GATE STAYS WHOLE-PROJECT, LITERALLY ───────────────────────────────────────
SCENARIOS.push({
  name: 'WP08d. the certification RE-GATE inside attemptPatch is still whole-project verbatim — no --only, no --files anywhere in it',
  args: { mode: 'pro', scopedRepair: true },
  plan: mkPlan([{
    frd: 'frd-wp08d-lib',
    deps: [],
    workOrders: [mkWo('wo-wp08d-001', 'PLANNED', { frd: 'frd-wp08d-lib', artifacts: ['src/lib/**'] })],
  }]),
  responses: [
    { prefix: 'gate:', response: wp08MechGate('wo-wp08d-001', 'src/lib/d.ts'), times: 1 },
    { prefix: 'patch:', response: { green: true } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const prompt = byLabel(run, /^patch:/)[0].prompt
    const iRegate = prompt.indexOf('THEN RE-GATE')
    const iSelf = prompt.indexOf('SELF-REPAIR BUDGET')
    t.ok(iRegate !== -1 && iSelf !== -1 && iRegate < iSelf, 'the RE-GATE paragraph precedes the (scoped) self-repair paragraph')
    const regate = prompt.slice(iRegate, iSelf)
    t.ok(!/--only/.test(regate), 'the RE-GATE paragraph contains NO --only')
    t.ok(!/--files/.test(regate), 'the RE-GATE paragraph contains NO --files')
    t.ok(/WHOLE-PROJECT `pnpm knip` \+ `pnpm biome check \.` \+ `pnpm tsc --noEmit`/.test(regate), 'it carries the whole-project command trio verbatim')
    t.ok(/a focused gate is NOT enough, red-team-A/.test(regate), 'and the red-team-A rationale that forbids narrowing it')
    t.ok(/dead export/.test(regate), 'including the dead-export-must-not-slip-to-a-sibling-FRD invariant')
  },
})

// ── (e) THE 3x COST BRAKE ──────────────────────────────────────────────────────────────────────
// Arithmetic, all in the engine's own COST() units: mode `pro` builds one work order with one sonnet
// agent + one MECH commit agent => woWaveCost = COST('sonnet') + 1 = 2, so C = 2. With
// repairBudgetFactor 3 the repair budget is 6. patch-1 (opus = 3) fits (spend 3); the A2 diagnosis
// (judge opus = 3) fits exactly (spend 6); the diagnosis-guided patch-2 (opus = 3) would take it to 9
// and is REFUSED. NOTE: today's ladder tops out at three fix agents per FRD gate cycle (patch-1 ->
// diagnose -> patch-2 | gate-test-repair), so "the attempt that would exceed the budget" is the third,
// not a fourth — a fourth is unreachable by construction.
SCENARIOS.push({
  name: 'WP08e. cost brake — the repair agent that would exceed 3x the FRD build spend is NOT spawned; honest needs-owner exit with both DR-099 channels',
  args: { mode: 'pro', scopedRepair: true, repairBudgetFactor: 3 },
  plan: mkPlan([{
    frd: 'frd-wp08e-lib',
    deps: [],
    workOrders: [mkWo('wo-wp08e-001', 'PLANNED', { frd: 'frd-wp08e-lib', artifacts: ['src/lib/**'] })],
  }]),
  responses: [
    { prefix: 'gate:', response: { green: false, reopen: ['wo-wp08e-001'], findings: [{ wo: 'wo-wp08e-001', finding: 'src/lib/e.ts:9 wrong', files: ['src/lib/e.ts'] }] } },
    { prefix: 'patch:', response: { green: false, cause: 'code', failure: 'still red' } },
    { prefix: 'diagnose:', response: { classification: 'point', repeatsPrior: false, recommendation: 'patch', confidence: 'medium' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^patch:/).length === 1, `only patch-1 was spawned — patch-2 did not fit the budget (got ${byLabel(run, /^patch:/).length} patch spawns)`)
    t.ok(byLabel(run, /^diagnose:/).length === 1, 'the diagnosis, which DID fit, still ran (the brake refuses, it does not pre-empt)')
    const block = byLabel(run, /^block-repair-budget:/)[0]
    t.ok(Boolean(block), 'the exhausted budget produced the dedicated honest-exit agent')
    t.ok(block && /needs-owner/.test(block.prompt), 'which files the work order as needs-owner')
    t.ok(block && /gate-report/i.test(block.prompt), 'attaching the gate report so the owner sees the objective evidence')
    t.ok(block && /"event":"GateVerdict"/.test(block.prompt), 'DR-099 channel 1 — the event')
    t.ok(block && /"event":"PushNotification"|NOTIFY|notificacion|notificación/i.test(block.prompt), 'DR-099 channel 2 — the owner-facing message')
    t.ok(block && /PRESERVE/.test(block.prompt), 'the honest exit PRESERVES the work on the branch')
    t.ok(block && !/git reset --hard/.test(block.prompt), 'and never discards it with a hard reset')
    t.ok(run.result && run.result.blockedFrds.includes('frd-wp08e-lib'), 'the FRD lands blocked, not silently reopened')
    t.ok(hasLog(run, /presupuesto de reparaci|repair budget/i), 'the brake logs why it fired')
  },
})
SCENARIOS.push({
  name: 'WP08e2. cost brake — OFF by default (args.scopedRepair unset): the full ladder runs, patch-2 included',
  args: { mode: 'pro', repairBudgetFactor: 3 },
  plan: mkPlan([{
    frd: 'frd-wp08e2-lib',
    deps: [],
    workOrders: [mkWo('wo-wp08e2-001', 'PLANNED', { frd: 'frd-wp08e2-lib', artifacts: ['src/lib/**'] })],
  }]),
  responses: [
    { prefix: 'gate:', response: { green: false, reopen: ['wo-wp08e2-001'], findings: [{ wo: 'wo-wp08e2-001', finding: 'src/lib/e2.ts:9 wrong', files: ['src/lib/e2.ts'] }] } },
    { prefix: 'patch:', response: { green: false, cause: 'code', failure: 'still red' } },
    { prefix: 'diagnose:', response: { classification: 'point', repeatsPrior: false, recommendation: 'patch', confidence: 'medium' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^patch:/).length === 2, `the pre-WP-08 ladder still spends patch-1 AND patch-2 (got ${byLabel(run, /^patch:/).length})`)
    t.ok(byLabel(run, /^block-repair-budget:/).length === 0, 'and never reaches the brake')
  },
})

// ── (f) THE ESCAPE HATCH — args.scopedRepair:false is byte-for-byte today's behaviour ───────────
SCENARIOS.push({
  name: 'WP08f. args.scopedRepair:false — a mechanical gate report changes NOTHING: opus xhigh, no --only, no classification log',
  args: { mode: 'pro', scopedRepair: false },
  plan: mkPlan([{
    frd: 'frd-wp08f-lib',
    deps: [],
    workOrders: [mkWo('wo-wp08f-001', 'PLANNED', { frd: 'frd-wp08f-lib', artifacts: ['src/lib/**'] })],
  }]),
  responses: [
    { prefix: 'gate:', response: wp08MechGate('wo-wp08f-001', 'src/lib/f.ts'), times: 1 },
    { prefix: 'patch:', response: { green: true } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const patch = byLabel(run, /^patch:/)[0]
    t.ok(patch && patch.opts.model === 'opus', 'patch stays on opus')
    t.ok(patch && patch.opts.effort === 'xhigh', 'at effort xhigh')
    t.ok(patch && !/--only=/.test(patch.prompt) && !/--files=/.test(patch.prompt), 'no scoped gate anywhere in the patch prompt')
    t.ok(run.result && run.result.builtFrds.includes('frd-wp08f-lib'), 'and the FRD still converges exactly as today')
  },
})


// ── REV2-6 · E2/BL-0129 · the pre-loop drain's FATAL throw has NO error boundary. safePoint()'s
// identical receipt guard lives INSIDE the scheduler loop's WS-D/D2 try (which guarantees
// running:false before rethrowing); drainReadyQueuePreLoop() runs BEFORE that loop exists, so a
// lease-renewal failure or a garbled fenced receipt escapes the engine with running:true still in
// status.yaml — the phantom-running-build failure WS-D/D2 was written to close.
SCENARIOS.push({
  name: 'REV2-6. pre-loop drain: a garbled stop receipt must not escape with running:true (WS-D/D2 has no pre-loop counterpart)',
  args: { mode: 'pro' },
  plan: { stack: 'B', hasFrontend: false, unsatisfiedDeps: [], frds: [] },
  responses: [
    { label: 'safe-point-pre-loop', response: { stop: false, ready: [], unblocked: [], stop_receipt: { status_exists: true, stop: false, method: 'shell-test' } } },
  ],
  assert(t, run) {
    t.ok(byLabel(run, 'safe-point-pre-loop').length === 1, 'the pre-loop safe point ran')
    t.ok(Boolean(run.error), 'characterisation: the engine THREW on the invalid receipt (fail-closed on the signal itself — correct)')
    const closed = byLabel(run, /^(ensure-stopped|ensure-stopped-crash)$/).length
    t.ok(closed >= 1, 'DEFECT: the throw escaped without any running:false close-out — no pre-loop equivalent of the scheduler loop\'s WS-D/D2 boundary')
  },
})

// ═════════════════════════════════════════════════════════════════════════════
// REV2 — INDEPENDENT REVIEW (DR-015) of the speed sprint's SECOND batch.
// Written by the reviewer, not by any package's implementer. Every scenario
// below targets an invariant the batch's own suites do NOT exercise.
// ═════════════════════════════════════════════════════════════════════════════

const rev2Report = (green) => JSON.stringify({ at: '2026-09-22T00:00:00Z', scope: 'since', green, subgates: [] })

// ── REV2-1 · WP-06 · the digested gate may CERTIFY WITHOUT EVER RUNNING the adversarial tests it wrote.
// In EXPLORE mode step 2 is an ORDER ("Run the FOCUSED gate … It must pass clean"), so the tests the
// reviewer writes in step 1 are necessarily executed before the verdict. In DIGESTED mode the attached
// report was produced by the collector BEFORE those tests existed, and the re-run is written as a
// permission ("You MAY run … once"). DR-080 requires the gate to write adversarial tests; an oracle that
// may never execute them is not an oracle. The digested step MUST carry an execution obligation.
SCENARIOS.push({
  name: 'REV2-1. digested gate: the post-adversarial-test verify.sh re-run must be MANDATORY, not optional (DR-080 — ATTACHMENT 1 predates the tests)',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: mkPlan([{
    frd: 'frd-rev2a',
    deps: [],
    workOrders: [mkWo('wo-rev2a-001', 'PLANNED', { frd: 'frd-rev2a', artifacts: ['src/rev2a/**'] })],
  }]),
  responses: [
    { prefix: 'evidence:', response: { report: rev2Report(true), diffStat: ' src/rev2a/a.ts | 2 +-', diff: '+// rev2a', truncated: false, ac: 'AC-REV2A.1 WHEN x THE SYSTEM SHALL y' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, /^gate:/)[0]
    t.ok(Boolean(gate), 'the gate ran')
    t.ok(gate && /YOUR EVIDENCE IS ALREADY COLLECTED/.test(gate.prompt), 'and it ran in DIGESTED mode')
    // The explore branch's obligation, for contrast: it is an imperative with no opt-out.
    t.ok(gate && /verify\.sh/.test(gate.prompt), 'the digested prompt still names the gate script')
    const mandatory = gate && /(MUST run|must run|Run)\s+[^.]{0,80}verify\.sh[^.]{0,200}after (you )?(writ|add)/i.test(gate.prompt)
    const optionalOnly = gate && /You MAY run `?bash \.pandacorp\/verify\.sh/.test(gate.prompt) && !mandatory
    t.ok(!optionalOnly, 'DEFECT: in digested mode the ONLY execution instruction is permissive ("You MAY run … once"), so a gate can write adversarial tests, never execute them, and certify green off a report collected before they existed')
  },
})

// ── REV2-2 · WP-03 fusion (ii) · a commit that reported `committed: 0` still seeds the pin fast-path.
// commitWOGreen caches `r.sha` on ANY resolved verdict — it never checks `r.committed`. A mech writer
// that found nothing to commit and dutifully returned HEAD's sha therefore becomes the freeze pin for
// the FRD gate, with no `pin:` spawn to re-derive it from git truth.
SCENARIOS.push({
  name: 'REV2-2. capturePin fast-path: a commit verdict with committed:0 must NOT be trusted as the wave pin',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-rev2b',
    deps: [],
    workOrders: [mkWo('wo-rev2b-001', 'PLANNED', { frd: 'frd-rev2b', artifacts: ['src/rev2b/**'] })],
  }]),
  responses: [
    { prefix: 'commit:', response: { committed: 0, sha: 'ghostsha' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gw = byLabel(run, 'gate-worktree')[0]
    t.ok(Boolean(gw), 'the gate worktree was prepared')
    t.ok(gw && /ghostsha/.test(gw.prompt), 'characterisation: the sha from the committed:0 verdict DID become the pin')
    t.ok(byLabel(run, /^pin:/).length === 1, 'DEFECT: no pin: spawn re-derived HEAD — a commit that reported committed:0 seeded the freeze pin from an unverified sha')
  },
})

// ── REV2-3 · WP-08 (d) · with the DEFAULT args (scopedRepair absent) the 3x repair-cost BRAKE is OFF,
// not just the scoping. The brake is the only mechanism that bounds the FRD-24 3.5x blow-up by SPEND;
// gating it behind the same flag as the sonnet fixer means the default configuration still cannot
// refuse to grind. Characterisation test — it documents the coupling, it does not assert a fix.
SCENARIOS.push({
  name: 'REV2-3. default args: the repair ladder runs to the end with NO cost brake — scopedRepair gates the brake as well as the scoping',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-rev2c',
    deps: [],
    workOrders: [mkWo('wo-rev2c-001', 'PLANNED', { frd: 'frd-rev2c', artifacts: ['src/rev2c/**'] })],
  }]),
  responses: [
    { prefix: 'gate:', response: { green: false, reopen: ['wo-rev2c-001'], findings: [{ wo: 'wo-rev2c-001', finding: 'src/rev2c/a.ts:3 wrong', files: ['src/rev2c/a.ts'] }] } },
    { prefix: 'patch:', response: { green: false, cause: 'code', failure: 'still red' } },
    { prefix: 'diagnose:', response: { classification: 'point', repeatsPrior: false, recommendation: 'patch', confidence: 'medium' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^patch:/).length === 2, 'patch-1 AND patch-2 both run on the default configuration')
    t.ok(byLabel(run, /^diagnose:/).length >= 1, 'the opus diagnoser runs between them')
    t.ok(byLabel(run, /^block-repair-budget:/).length === 0, 'and the 3x spend brake NEVER fires by default — it is off with the scoping, so an unflagged run still has no spend ceiling')
  },
})

// ── REV2-4 · E2/BL-0129 · the pre-loop drain must TERMINATE when the drained change produces work the
// re-planner keeps ignoring (a change card whose FRD folder the planner does not return). The fix is
// deliberately a one-shot drain + one re-plan; this proves there is no re-planification loop, that the
// run still exits honestly, and that the drain is not attempted a second time.
SCENARIOS.push({
  name: 'REV2-4. pre-loop drain: a drained change the re-planner keeps ignoring terminates (one drain, one re-plan, honest exit) — no re-planification loop',
  args: { mode: 'pro' },
  plan: { stack: 'B', hasFrontend: false, unsatisfiedDeps: [], frds: [] },
  responses: [
    { label: 'safe-point-pre-loop', response: { stop: false, ready: ['rev2-ghost-change'], unblocked: [] } },
    { prefix: 'process-change:', response: { done: true, affectedFrds: ['frd-rev2-ghost'], frds: [] } },
    { label: 'plan-post-drain', response: { frds: [] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'safe-point-pre-loop').length === 1, 'exactly ONE pre-loop safe point — the drain is never retried')
    t.ok(byLabel(run, 'plan-post-drain').length === 1, 'exactly ONE re-plan — bounded, no loop')
    t.ok(byLabel(run, 'plan').length === 1, 'and the original planner ran exactly once')
    t.ok(byLabel(run, /^process-change:/).length === 1, 'the change was drained exactly once')
    t.ok(run.result && run.result.note === 'all verified', `the run still exits honestly (note: ${run.result && run.result.note})`)
  },
})

// ── REV2-5 · E3/BL-0044 · the new fast-path suite test-check-derived-drift.sh is not registered in
// run-engine-tests.sh's EXPLICIT_SH_SUITES, so the test the package shipped never runs in CI — the
// exact rot LESSON-0151 (quoted in that runner's own header) exists to prevent.
SCENARIOS.push({
  name: 'REV2-5. every test-*.sh suite that exists is registered in run-engine-tests.sh (LESSON-0151: an unregistered suite rots invisibly)',
  args: { mode: 'pro' },
  plan: { stack: 'B', hasFrontend: false, unsatisfiedDeps: [], frds: [] },
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const runner = readFileSync(path.resolve(__dirname, 'run-engine-tests.sh'), 'utf8')
    const m = runner.match(/EXPLICIT_SH_SUITES=\(([^)]*)\)/)
    t.ok(Boolean(m), 'run-engine-tests.sh declares EXPLICIT_SH_SUITES')
    const registered = new Set((m ? m[1] : '').split(/\s+/).filter(Boolean))
    t.ok(registered.has('test-verify-gate-report.sh'), 'test-verify-gate-report.sh is registered')
    t.ok(registered.has('test-verify-before-stop.sh'), 'E3: test-verify-before-stop.sh is registered')
    t.ok(registered.has('test-classify-change.sh'), 'F1: test-classify-change.sh is registered')
    t.ok(registered.has('test-check-derived-drift.sh'), 'DEFECT: E3 shipped test-check-derived-drift.sh but never added it to EXPLICIT_SH_SUITES — the derived-drift fast-path is untested in CI from birth')
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
