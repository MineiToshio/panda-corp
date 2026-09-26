#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// test-pandacorp-build.mjs — the FIRST automated test harness for the Pandacorp
// build engine (source: plugin/runtime/engine/pandacorp-build.src.js).
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
const ENGINE_PATH = path.resolve(__dirname, '../runtime/engine/pandacorp-build.src.js')
// BL-0204: the deployable engine is GENERATED from the source (generate-engine.mjs strips comments to fit
// the Workflow tool's 512 KB script limit). Static source guards and text assertions always read the
// SOURCE; PANDACORP_ENGINE_RUN=artifact makes every scenario EXECUTE the generated artifact instead, so
// test-engine-artifact.mjs can prove the shipped file behaves exactly like the source it came from.
const ARTIFACT_PATH = process.env.PANDACORP_ENGINE_ARTIFACT || path.resolve(__dirname, '../templates/shared/.claude/engines/pandacorp-build.js')
const RUN_ARTIFACT = process.env.PANDACORP_ENGINE_RUN === 'artifact'

let source = readFileSync(ENGINE_PATH, 'utf8')
let runnable = readFileSync(RUN_ARTIFACT ? ARTIFACT_PATH : ENGINE_PATH, 'utf8')
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
// D4b source guard: buildCostByFrd (the repair-budget denominator) must be FROZEN against in-run retry
// rebuilds. A full engine simulation can prove the guard is REACHABLE (FIX2-D4b below), but the ONE
// canAffordRepair check per FRD per run always runs BEFORE that FRD's own retry build (the engine gives
// an FRD at most one in-run retry per run — see inRunRetry/gateConverge), so a black-box run can never
// observe a SECOND, post-retry check to catch a regression that re-inflates the denominator. This static
// guard is the actual regression net for that half of the invariant (the same house style as the other
// source guards above), matching the literal `if (!wo._isRetry) buildCostByFrd.set(...)` in buildWO.
if (!/if \(!wo\._isRetry\)\s*buildCostByFrd\.set\(frd/.test(source)) {
  console.error('FATAL: D4b — buildCostByFrd is no longer frozen against wo._isRetry; an in-run retry rebuild would inflate its own repair-budget ceiling.')
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
runnable = runnable.replace(/^export\s+const\s+meta/m, 'const meta')
// The args-guard scenario deliberately passes undefined. Neutralize only the lease receipt guard in
// this in-memory harness; production keeps it fail-closed and every behavioral fixture otherwise gets
// a fake receipt below.
const LEASE_RECEIPT_GUARD = "if (!LEASE_TOKEN || !LEASE_EPOCH) throw new Error('FATAL: atomic lease token/epoch missing — launch only through launch-implement.sh')"
if (!runnable.includes(LEASE_RECEIPT_GUARD)) {
  console.error(`FATAL: the lease receipt guard the harness neutralizes is absent from the ${RUN_ARTIFACT ? 'artifact' : 'source'} — update the harness loader.`)
  process.exit(1)
}
source = source.replace(LEASE_RECEIPT_GUARD, '')
runnable = runnable.replace(LEASE_RECEIPT_GUARD, '')
if (/^\s*(export|import)\b/m.test(source) || /^\s*(export|import)\b/m.test(runnable)) {
  console.error('FATAL: engine still contains ESM syntax after the meta transform — update the harness loader.')
  process.exit(1)
}
if (RUN_ARTIFACT) console.log(`ENGINE UNDER TEST: generated artifact ${ARTIFACT_PATH}`)

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const engine = new AsyncFunction('agent', 'log', 'budget', 'args', 'phase', 'parallel', runnable)

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
  if (label.startsWith('certify-patch:')) return { done: true }             // BL-0191: serialized stamp of an ACCEPTED post-patch verification
  if (label.startsWith('persist-block:')) return { done: true }             // C2: main-tree persist of a review-only gate block
  if (label.startsWith('gate-release:')) return null                        // BL-0182: answered by releaseDefault(call) — it needs the prompt (see runEngine)
  if (label.startsWith('port-reviewer-tests:') || label.startsWith('reviewer-test-hash:')) return null   // BL-0184: echo EXPECTED — see hashEchoDefault(call)
  if (label.startsWith('commit:')) return { committed: 1, sha: 'defaultcommitsha' }   // WP-03 fusion (ii): the real mech commit writer always reports its own sha
  if (/^(build|test|be|fe|selftest):/.test(label)) return { green: true } // VERIFY_SCHEMA
  if (label.startsWith('find:drift:')) return { contracts: [{ contract: 'REQ-00-001 — fixture contract', contractClass: 'requirement', owner: 'none', status: 'implemented', claim: 'preexisting', evidence: { file: 'src/fixture.ts', line: 1, snippet: 'fixture()' } }], toolCalls: 12, budgetExhausted: false } // BL-0203 DRIFT_FINDER_SCHEMA — a clean whole-FRD pass
  if (label.startsWith('gate:')) return { green: true, traceability: validTraceability } // FRD_GATE_SCHEMA
  if (label.startsWith('diagnose:')) return { classification: 'point', repeatsPrior: false, recommendation: 'patch', confidence: 'medium' } // DIAGNOSE_SCHEMA (A2) — benign default (only the recovery-ladder scenarios reach it)
  if (label.startsWith('block-needs-owner:')) return { green: false, blocked_reason: 'needs-owner' } // A3 early-block spawn (REPAIR_SCHEMA)
  if (label.startsWith('block-repair-budget:')) return { green: false, blocked_reason: 'needs-owner' } // WP-08 cost-brake honest exit (REPAIR_SCHEMA)
  if (/^(repair|patch|gate-test-repair|verify-patch|revert|foundation-repair):/.test(label)) return { green: true } // REPAIR_SCHEMA
  if (/^(process-change|plan-drained):/.test(label)) return { done: true, affectedFrds: [], frds: [] }
  if (label.startsWith('gate-change-wos:')) return { results: label.slice('gate-change-wos:'.length).split('+').filter(Boolean).map((frd) => ({ frd, gated: true })) } // BL-0171: happy-path default — every FRD the change touched passes the DR-100 readiness/grounding/consistency gate
  if (label === 'ensure-stopped') return { done: true, allowed_paths: ['.pandacorp/status.yaml'], lease_released: true }
  if (label === 'close-out-verify-reuse-check') return { canReuse: false, reason: 'no-report' } // BL-0147: safe default — the full rerun happens exactly as pre-BL-0147 unless a scenario scripts a fresh full-green report
  if (/^(hardening:security-audit|hardening:security-fix|hardening:telemetry|close-out|close-needs-hardening|notify-end|ensure-stopped-crash|archive-changes|release-lease)$/.test(label)) return { done: true } // STOP_SCHEMA
  return null // unmatched — recorded loudly
}

// BL-0182/0184 prompt-aware defaults (the happy path): a gate release salvages exactly the test files the
// gate DECLARED (the JSON the engine embeds in the release prompt) and leaves the worktree clean; a port /
// integrity check observes every EXPECTED file intact (echoes the JSON the engine embeds).
function promptAwareDefault(call) {
  if (call.label.startsWith('gate-release:')) {
    const m = call.prompt.match(/declared these test files \(JSON\): (\[[^\]]*\])/)
    const declared = m ? JSON.parse(m[1]) : []
    return { salvaged: declared.map((p) => ({ path: p, status: 'untracked', sha256: `sha-${p}` })), remaining: [] }
  }
  if (call.label.startsWith('port-reviewer-tests:') || call.label.startsWith('reviewer-test-hash:')) {
    const m = call.prompt.match(/EXPECTED \(JSON\): (\[.*?\])\. Return/)
    return { hashes: m ? JSON.parse(m[1]) : [] }
  }
  return null
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
    const def = promptAwareDefault(call) ?? defaultResponse(call.label)
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
  docStatus: extra.docStatus,   // BL-0171: the LITERAL `status:` (DRAFT|ACTIVE) frontmatter field — distinct from `status` above (implementation_status). undefined by default (pre-BL-0171 fixtures, treated as buildable).
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
  constructor(name) { this.name = name; this.failures = []; this.count = 0; this.xfails = [] }
  ok(cond, msg) { this.count++; if (!cond) this.failures.push(msg) }
  // REV3: a KNOWN, filed defect. `cond` states what SHOULD hold. While it does not hold the
  // scenario stays green but prints `~ xfail` (same convention as test-classify-change.sh's
  // REV2-C); the day the defect is fixed it flips to a normal pass and the call should be
  // tightened to `ok`. It never silently asserts the buggy behaviour as correct.
  xfail(cond, msg, ref) { this.count++; if (!cond) this.xfails.push(`${msg} [${ref}]`) }
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
  // D4: repairBrake now defaults ON (see REV2-3/WP08e*) — this scenario tests the A3 diagnosis-guided
  // patch-2 MECHANICS, not the repair-cost brake, so it opts OUT of the brake explicitly to keep
  // exercising the full ladder to convergence undisturbed by a budget it isn't about.
  args: { mode: 'pro', repairBrake: false },
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
// maxAgents=17 (mode pro): the loop-top brake passes at the gate iteration (12<17) and again at the harvest
// after the serial gate (+3) and its BL-0182 worktree release (+1) — 16<17 — but patch-1 (+3, opus) pushes
// agentSpawned to 19 ≥ 17, so capHit() is true when the ladder decides. (It was 16 before BL-0182 added the
// per-gate release spawn; at 16 the ceiling now trips one loop-top EARLIER, with the reject still queued.)
// The diagnose spawn is skipped (it would cost another COST(judge)); the legacy revert path runs instead.
SCENARIOS.push({
  name: '22. A3 honest degrade — capHit at patch-1 code-fail skips the diagnosis (legacy revert path)',
  args: { mode: 'pro', maxAgents: 17 },
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
    // F5/BL-0177: the legacy revert defers wo-22-001's rebuild to a LATER run (WS-D4a) rather than
    // re-queuing it THIS run, so by the time the loop-top brake re-checks the ceiling, every queue
    // (globalQueue/gateQueue/gatesInFlight/gateResults/convergeQueue) is genuinely empty — there is no
    // work this stop actually cut off. Before F5 the engine still reported `stopReason: 'agents'` here
    // (cosmetically wrong: canary D2's "Paro por techo de agentes" narrated an agent-cap stop on a run
    // that had nothing left to do); now it reports null (ran to completion), same as reaching the
    // natural end-of-queue break a few lines later would.
    t.ok(run.result && run.result.stopReason === null, `F5/BL-0177: no work remains when the ceiling is re-checked post-revert, so the run does NOT report an agent-cap stop (got ${run.result && run.result.stopReason})`)
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
    // C2: the review-only gate is the sole emitter of the REJECT verdicts (reopen/blocked — worktree-safe
    // absolute-path appends); the PASS verdict + achievement moved to the serialized apply-gate step on main.
    // F4/BL-0176: the generic "can't pinpoint specific WOs" exit used to hardcode a literal "fail" verdict
    // in BOTH review_end and GateVerdict regardless of the blocked_reason the agent actually chose (canary
    // D2: frd-02 blocked needs-owner but the dashboard showed verdict:"fail" and no frd_end ever closed the
    // review). It now routes through emitGateOutcome(frd,'blocked',…) like every other terminal block, so
    // the prompt carries "blocked" (with frd_end) instead of a mislabeled "fail" — never a bare "fail".
    t.ok(gate && /verdict":"reopen"/.test(gate.prompt) && /verdict":"blocked"/.test(gate.prompt) && /"kind":"frd_end"/.test(gate.prompt),
      'the GateVerdict/review_end/frd_end events are emitted on every REJECT exit branch (reopen/blocked) from the review-only gate')
    t.ok(gate && !/verdict":"fail"/.test(gate.prompt),
      'F4/BL-0176: no exit branch emits a bare "fail" verdict any more — the generic can\'t-pinpoint exit reports "blocked" (with the real blocked_reason) like every other terminal block')
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
    t.ok(byLabel(run, /^apply-gate:/).length === 0, 'no apply-gate on the reject path (the patch ladder stamps through its own certify step, BL-0191)')
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
// still applied post-loop (never dropped). maxAgents is tuned so agentSpawned crosses the ceiling on the
// very apply-gate spawn that also clears every queue (frd-v-b's WOs already built, frd-v-a's gate already
// harvested) — the unconditional post-loop settleGates(true) (line ~3155) is what actually guarantees
// nothing settled-but-unharvested is ever dropped, regardless of why/whether the loop broke. F5/BL-0177
// (2026-09) means this exact tuning no longer produces a 'agents' stopReason (nothing was left to cut off
// when the brake re-checks) — the scenario now asserts the settle-never-drops guarantee directly instead
// of via which label the run happens to report.
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
    // F5/BL-0177: by the iteration the loop-top brake re-checks and finds agentSpawned ≥ maxAgents, the
    // very apply-gate spawn that crossed the ceiling already cleared every queue (frd-v-b's WOs built,
    // frd-v-a's gate harvested+applied) — there is no cut-off work left, so the run now reports null
    // (ran to completion) instead of the old, cosmetically-wrong 'agents' label. This scenario's real
    // point — that a settled gate is never DROPPED by a brake — still holds and is asserted below via
    // apply-gate/builtFrds; it no longer depends on which stopReason the run happens to report.
    t.ok(run.result && run.result.stopReason === null, `F5/BL-0177: no work remains when the ceiling is re-checked (the apply that crossed it also finished the run), so no agent-cap stop is reported (got ${run.result && run.result.stopReason})`)
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
    // 16 = WP-03's original 12 + 3 reconciled at integration time (integration-speed-sprint-a merge
    // notes): the D-1 fix's 'renew-lease' spawn and the E2/BL-0129 'safe-point-pre-loop' spawn (both
    // merged with wp-03-plumbing-diet, both single mechanical Bash+Read steps with no Write/Edit —
    // unlike in-loop 'safe-point' they never flip BLOCKED→PLANNED frontmatter or commit, so nothing
    // keeps them out of mech), plus WP-06's `evidence:<frd>` collector (merged with wp-06-digested-gate;
    // its own comment already called it "a MECH, effort:'low', zero-judgment agent" but had hardcoded
    // that shape instead of using the WP-03 MECH_AGENT/MECH_EFFORT helpers — reconciled onto them so it
    // also respects args.mechLean:false like every other mech site) + 1 more, BL-0147's
    // 'close-out-verify-reuse-check' (a pure read-only git/gate-report check, the same zero-judgment
    // shape as the other mech sites, defined ONCE and called from all 4 close-out/notify-end branches).
    // + 3 (BL-0182/0184): the C2 gate-worktree release (`gate-release:<frd>`), the reject-path port of the
    // reviewer's tests (`port-reviewer-tests:<frd>`) and the DR-080 hash check (`reviewer-test-hash:<frd>`) —
    // all zero-judgment cp/git/shasum runners, the same shape as the gate-worktree probe itself.
    // + 2 (BL-0178): 'drift-proof:<frd>' and 'drift-record:<frd>' — each runs ONE drift-proof.mjs command and
    // returns its stdout verbatim (zero judgment; the ENGINE applies the pre-existing-drift predicate).
    // Integrated total (BL-0182..0184 + BL-0178 merge): 16 + 3 + 2 = 21.
    // + 1 (BL-0189): 'gate-inventory:<frd>' — runs ONE gate-inventory.mjs check and returns its stdout verbatim
    // (zero judgment; the ENGINE parses the cache and compares fingerprints). = 22.
    // + 2 (BL-0186, D1 parallelGates — both spawned ONLY under that flag): 'stale-pin:<frd>' (one `git
    // rev-list --count` at a PASS landing) and 'reverify:<frd>' (port + `verify.sh --since <pin>` + the report
    // verbatim when main advanced) — zero-judgment command runners; the ENGINE reads the count and the
    // report's green/scope. The flag-off engine never reaches either site (spawn sequence unchanged). = 24.
    // + 1 (BL-0186, flag-only too): 'unport-reviewer-tests:<frd>' — a lane landing that did not certify its FRD
    // removes the reviewer's test copies it ported that are still untracked + byte-identical (git ls-files /
    // shasum / clean -f -- <path>), so the next re-verify's vitest --changed never runs them. = 25 (21 + 1
    // gate-cost + 3 D1), recounted from the source below.
    t.ok(mechAgentCount === 25, `exactly 25 call sites use agentType: MECH_AGENT(...) (got ${mechAgentCount})`)
    t.ok(mechEffortCount === 25, `exactly 25 call sites carry effort: MECH_EFFORT, one per MECH_AGENT(...) site (got ${mechEffortCount})`)
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
// side-by-side trace. BL-0147 adds back ONE spawn (+1 = 18): the 'close-out-verify-reuse-check' read-only
// MECH step that runs right before the hardened close-out's full verify.sh, deciding whether a recent
// full-green gate-report can be reused instead of re-running the whole suite. BL-0182 adds ONE more (+1 = 19):
// the 'gate-release:<frd>' MECH step that salvages + cleans the gate worktree after the concurrent gate.
SCENARIOS.push({
  name: 'WP03e. G13a fixture — total spawn count drops vs the integration-speed-sprint-a base branch (19 -> 18, incl. BL-0147s reuse-check; +1 BL-0182 release = 19)',
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
    t.ok(run.calls.length === 19, `total spawns for this fixture is 19 (was 19 on integration-speed-sprint-a before WP-03, 17 after WP-03, +1 for BL-0147's reuse-check, +1 for BL-0182's gate-worktree release) — got ${run.calls.length}: ${run.calls.map((c) => c.label).join(', ')}`)
    t.ok(byLabel(run, 'gate-release:frd-g13a-lib').length === 1, 'the added spawn: exactly one BL-0182 gate-worktree release, right after the concurrent gate')
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
    // BL-0203: digested also spawns the diff-free `find:drift:<frd>` whole-FRD drift finder (default on under
    // digested). It is deliberately NOT one of the four evidence-fed lenses — it never receives the pack — so the
    // four-lens invariants below are asserted over the lenses only (F2a1/F2a2 cover the drift finder).
    const finders = byLabel(run, /^find:(?!drift:)/)
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
  // D4/BL-0138: the 9-unit floor guarantees patch-1→diagnose→patch-2 always fits a 1-WO FRD (that
  // escalator is exactly what BL-0138 protects), so the brake can no longer refuse to spawn patch-2
  // itself — it now refuses the NEXT (pricier) rung, the in-run retry rebuild, once THAT would exceed
  // the floored budget. Retargeted from "patch-2 never spawns" to "the ladder runs its full floored
  // escalator, then the brake still stops it before an unaffordable rebuild" — same honest-exit mechanics.
  name: 'WP08e. cost brake — the in-run retry rebuild that would exceed the floored FRD budget is NOT spawned; honest needs-owner exit with both DR-099 channels',
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
    t.ok(byLabel(run, /^patch:/).length === 2, `FIXED (BL-0138 floor): patch-1 AND patch-2 both fit the floored 9-unit budget (got ${byLabel(run, /^patch:/).length} patch spawns)`)
    t.ok(byLabel(run, /^diagnose:/).length === 1, 'the diagnosis, between them, still ran once')
    const block = byLabel(run, /^block-repair-budget:/)[0]
    t.ok(Boolean(block), 'the exhausted budget (after patch-2 also fails) produced the dedicated honest-exit agent, refusing the in-run-retry rebuild')
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
  // D4/REV2-3: scopedRepair no longer governs the brake (it now only governs the sonnet-fixer scoping) —
  // the brake's OWN escape hatch is args.repairBrake:false. This scenario proves that hatch: with it set,
  // the ladder runs completely unbounded (patch-1, diagnose, patch-2, AND the in-run-retry rebuild) and
  // NEVER reaches the brake, even though repairBudgetFactor is tiny.
  name: 'WP08e2. cost brake — the args.repairBrake:false escape hatch: the full ladder runs unbounded, in-run retry included',
  args: { mode: 'pro', repairBudgetFactor: 3, repairBrake: false },
  plan: mkPlan([{
    frd: 'frd-wp08e2-lib',
    deps: [],
    workOrders: [mkWo('wo-wp08e2-001', 'PLANNED', { frd: 'frd-wp08e2-lib', artifacts: ['src/lib/**'] })],
  }]),
  responses: [
    { prefix: 'gate:', times: 1, response: { green: false, reopen: ['wo-wp08e2-001'], findings: [{ wo: 'wo-wp08e2-001', finding: 'src/lib/e2.ts:9 wrong', files: ['src/lib/e2.ts'] }] } },
    { prefix: 'patch:', response: { green: false, cause: 'code', failure: 'still red' } },
    { prefix: 'diagnose:', response: { classification: 'point', repeatsPrior: false, recommendation: 'patch', confidence: 'medium' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^patch:/).length === 2, `the ladder still spends patch-1 AND patch-2 (got ${byLabel(run, /^patch:/).length})`)
    t.ok(byLabel(run, /^block-repair-budget:/).length === 0, 'and repairBrake:false means it never reaches the brake, even past patch-2 into the in-run retry')
    t.ok(run.result && run.result.builtFrds.includes('frd-wp08e2-lib'), 'the in-run retry rebuild actually ran (unbounded) and the FRD converged')
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
    // FIXED: commitWOGreen now only caches lastCommitSha on Number(r.committed) > 0, so a committed:0
    // verdict leaves it null — capturePin's MECH_LEAN fast path is starved of a preSha and spawns a REAL
    // `pin:` agent to re-derive HEAD from git truth instead of trusting the ghost sha.
    t.ok(gw && !/ghostsha/.test(gw.prompt), 'FIXED: the committed:0 verdict\'s sha never reaches the pin — no ghostsha in the frozen gate worktree')
    t.ok(byLabel(run, /^pin:/).length === 1, 'FIXED: a pin: spawn re-derived HEAD — a commit that reported committed:0 no longer seeds the freeze pin from an unverified sha')
  },
})

// ── REV2-3 · WP-08 (d) · FIXED (D4): with the DEFAULT args (scopedRepair absent) the repair-cost BRAKE
// used to be OFF too, not just the scoping — the brake was the only mechanism bounding the FRD-24 3.5x
// blow-up by SPEND, and gating it behind the same flag as the sonnet fixer meant the default
// configuration could never refuse to grind. Fixed by splitting the levers: args.repairBrake now governs
// the brake alone, defaults TRUE, and is read independently of args.scopedRepair. The 9-unit floor
// (BL-0138, see the brake's own comment) still guarantees the patch-1→diagnose→patch-2 escalator itself
// always fits a small FRD — so on the default config below the brake fires ONE rung later than before
// the floor existed, at the in-run retry, not at patch-2. This is no longer a characterisation test: it
// asserts the fix.
SCENARIOS.push({
  name: 'REV2-3. FIXED: default args now carry a cost brake — repairBrake defaults TRUE, independent of scopedRepair',
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
    t.ok(byLabel(run, /^patch:/).length === 2, 'patch-1 AND patch-2 both run — the 9-unit floor (BL-0138) keeps that escalator intact even on the default config')
    t.ok(byLabel(run, /^diagnose:/).length >= 1, 'the opus diagnoser runs between them')
    t.ok(byLabel(run, /^block-repair-budget:/).length === 1, 'FIXED: the spend brake NOW fires by default, once patch-2 also fails and the in-run retry would exceed the floored budget — repairBrake is independent of scopedRepair and defaults ON (D4)')
    t.ok(run.result && run.result.blockedFrds.includes('frd-rev2c'), 'the FRD lands blocked, not ground down past its budget')
  },
})

// ── FIX2-D4a · D4 · TRUE default config (no repairBrake, no repairBudgetFactor, no scopedRepair at
// all) on a 2-WO FRD: patch-1 (1st repair rung), diagnose (2nd), patch-2 (3rd) all fit the 9-unit-floored
// escalator exactly as REV2-3 proves for one WO — but the 4th rung, the in-run retry, must now rebuild
// BOTH reopened WOs (units=2), which no longer fits. Focuses on what REV2-3 does not check: the FULL
// DR-099 honest-exit mechanics (needs-owner, both notification channels, PRESERVE, no hard reset) fire
// correctly purely from the DEFAULTS — the owner never has to opt into anything to get this safety net.
SCENARIOS.push({
  name: 'FIX2-D4a. true defaults (no repairBrake/repairBudgetFactor set): the 4th repair rung (in-run retry) is refused with a full needs-owner honest exit',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-fix2d4a',
    deps: [],
    workOrders: [
      mkWo('wo-fix2d4a-001', 'PLANNED', { frd: 'frd-fix2d4a', artifacts: ['src/fix2d4a/a/**'] }),
      mkWo('wo-fix2d4a-002', 'PLANNED', { frd: 'frd-fix2d4a', artifacts: ['src/fix2d4a/b/**'] }),
    ],
  }]),
  responses: [
    { prefix: 'gate:', times: 1, response: { green: false, reopen: ['wo-fix2d4a-001', 'wo-fix2d4a-002'], findings: [{ wo: 'wo-fix2d4a-001', finding: 'src/fix2d4a/a/x.ts:5 wrong', files: ['src/fix2d4a/a/x.ts'] }, { wo: 'wo-fix2d4a-002', finding: 'src/fix2d4a/b/y.ts:5 wrong', files: ['src/fix2d4a/b/y.ts'] }] } },
    { prefix: 'patch:', response: { green: false, cause: 'code', failure: 'still red' } },
    { prefix: 'diagnose:', response: { classification: 'point', repeatsPrior: false, recommendation: 'patch', confidence: 'medium' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^patch:/).length === 2, 'rungs 1 and 3 (patch-1, patch-2) both fit the floored budget, exactly as REV2-3')
    t.ok(byLabel(run, /^diagnose:/).length === 1, 'rung 2 (diagnose) ran once, between them')
    const block = byLabel(run, /^block-repair-budget:/)[0]
    t.ok(Boolean(block), 'rung 4 (the in-run retry, now pricing BOTH reopened WOs) is refused — TRUE defaults, no flag opted into')
    t.ok(block && /needs-owner/.test(block.prompt), 'blocked_reason: needs-owner')
    t.ok(block && /"event":"GateVerdict"/.test(block.prompt), 'DR-099 channel 1 — the event')
    t.ok(block && /"event":"PushNotification"|NOTIFY|notificacion|notificación/i.test(block.prompt), 'DR-099 channel 2 — the owner-facing message')
    t.ok(block && /PRESERVE/.test(block.prompt) && !/git reset --hard/.test(block.prompt), 'the work stays on the branch, intact — never a hard reset')
    t.ok(run.result && run.result.blockedFrds.includes('frd-fix2d4a'), 'the FRD lands blocked, not silently ground down further')
  },
})

// ── FIX2-D4b · D4b · the in-run retry's affordability check must price the FULL projected rebuild (BOTH
// reopened WOs, units=2 — see canAffordRepair's `units` param) against the FROZEN first-wave denominator
// (2 WOs × woWaveCost = 4, never re-derived). Companion to the static D4b source guard above (which is
// the actual regression net for the OTHER half of this invariant — the engine gives an FRD at most one
// in-run retry per run, so there is no SECOND, post-retry check a black-box run could compare against;
// see that guard's comment for why). This scenario proves the ONE reachable check computes the correct
// number: with repairBudgetFactor:2 and base=4, budget floors... no — 2×4=8 still floors to 9 (BL-0138),
// and patch-1(3)+diagnose(3)=6 spent leaves exactly 3 units of headroom, too little for a 2-WO retry
// (2×COST(opus)=6) — so the honest exit fires citing BOTH reopened WOs, never a partial silent grind.
SCENARIOS.push({
  name: 'FIX2-D4b. in-run retry affordability prices the FULL multi-WO rebuild against the frozen first-wave denominator',
  args: { mode: 'pro', repairBudgetFactor: 2 },
  plan: mkPlan([{
    frd: 'frd-fix2d4b',
    deps: [],
    workOrders: [
      mkWo('wo-fix2d4b-001', 'PLANNED', { frd: 'frd-fix2d4b', artifacts: ['src/fix2d4b/a/**'] }),
      mkWo('wo-fix2d4b-002', 'PLANNED', { frd: 'frd-fix2d4b', artifacts: ['src/fix2d4b/b/**'] }),
    ],
  }]),
  responses: [
    { prefix: 'gate:', times: 1, response: { green: false, reopen: ['wo-fix2d4b-001', 'wo-fix2d4b-002'], findings: [{ wo: 'wo-fix2d4b-001', finding: 'src/fix2d4b/a/x.ts:1 wrong', files: ['src/fix2d4b/a/x.ts'] }, { wo: 'wo-fix2d4b-002', finding: 'src/fix2d4b/b/y.ts:1 wrong', files: ['src/fix2d4b/b/y.ts'] }] } },
    { prefix: 'patch:', response: { green: false, cause: 'code', failure: 'still red' } },
    { prefix: 'diagnose:', response: { classification: 'point', repeatsPrior: true, recommendation: 'full-revert', confidence: 'medium', seam: { files: ['src/fix2d4b/a/x.ts'], symbol: 'baz', why: 'recurring', cleanlySeparable: false } } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^patch:/).length === 1, 'branch (e) — repeats + NOT cleanly separable — skips patch-2, goes straight to the in-run retry check')
    const block = byLabel(run, /^block-repair-budget:/)[0]
    t.ok(Boolean(block), 'the in-run retry correctly prices BOTH reopened WOs (units=2) against the frozen base=4 budget, exceeds it, and refuses')
    t.ok(block && /wo-fix2d4b-001/.test(block.prompt) && /wo-fix2d4b-002/.test(block.prompt), 'BOTH reopened work orders are named in the honest exit — neither is silently dropped')
    t.ok(run.result && run.result.blockedFrds.includes('frd-fix2d4b'), 'the FRD lands blocked, not partially retried')
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

// ── BQW1. proposal 37 / E-3 — visual-qa defaults to SONNET, not the judge tier (P.judge/opus).
// DR-072 already made visual-qa ADVISORY (a punch-list, never a block) — measured 5.50 $ on opus vs
// ≈2.20 $ on sonnet for the same FRD-24 pass. Escape hatch: args.visualQaModel='opus' restores the
// prior tier; any other/unrecognised value falls back to 'sonnet' with a loud log (fail-closed).
// (a) DEFAULT (no args.visualQaModel) — visual-qa spawns on sonnet.
SCENARIOS.push({
  name: 'BQW1a. E-3 — DEFAULT (no args.visualQaModel): visual-qa spawns on sonnet, not the opus judge tier',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-bqw1a-ui',
    deps: [],
    workOrders: [mkWo('wo-bqw1a-001', 'PLANNED', { frd: 'frd-bqw1a-ui', artifacts: ['src/app/dashboard/Panel.tsx'] })],
  }], { hasFrontend: true }),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const vq = byLabel(run, 'visual-qa')
    t.ok(vq.length === 1, 'visual-qa ran (a .tsx artifact is a real UI surface)')
    t.ok(vq[0] && vq[0].opts.model === 'sonnet', `visual-qa runs on sonnet by default (got ${vq[0] && vq[0].opts.model})`)
    t.ok(vq[0] && vq[0].opts.effort === 'high', `visual-qa keeps effort:high (got ${vq[0] && vq[0].opts.effort})`)
  },
})

// (b) OVERRIDE — args.visualQaModel:'opus' restores the prior tier.
SCENARIOS.push({
  name: "BQW1b. E-3 — args.visualQaModel:'opus' restores the prior (opus) tier",
  args: { mode: 'pro', visualQaModel: 'opus' },
  plan: mkPlan([{
    frd: 'frd-bqw1b-ui',
    deps: [],
    workOrders: [mkWo('wo-bqw1b-001', 'PLANNED', { frd: 'frd-bqw1b-ui', artifacts: ['src/app/dashboard/Panel.tsx'] })],
  }], { hasFrontend: true }),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const vq = byLabel(run, 'visual-qa')
    t.ok(vq.length === 1, 'visual-qa ran')
    t.ok(vq[0] && vq[0].opts.model === 'opus', `visual-qa runs on opus with the escape hatch (got ${vq[0] && vq[0].opts.model})`)
  },
})

// (c) fail-closed — an unrecognised args.visualQaModel value falls back to sonnet, loudly logged.
SCENARIOS.push({
  name: 'BQW1c. E-3 — an unrecognised args.visualQaModel value falls back to sonnet, with a loud log',
  args: { mode: 'pro', visualQaModel: 'haiku' },
  plan: mkPlan([{
    frd: 'frd-bqw1c-ui',
    deps: [],
    workOrders: [mkWo('wo-bqw1c-001', 'PLANNED', { frd: 'frd-bqw1c-ui', artifacts: ['src/app/dashboard/Panel.tsx'] })],
  }], { hasFrontend: true }),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const vq = byLabel(run, 'visual-qa')
    t.ok(vq.length === 1, 'visual-qa ran')
    t.ok(vq[0] && vq[0].opts.model === 'sonnet', `an unrecognised tier falls back to sonnet, never silently honored (got ${vq[0] && vq[0].opts.model})`)
    t.ok(hasLog(run, /visualQaModel='haiku'.*no es 'sonnet' ni 'opus'/), 'the fallback is logged explicitly, never silent')
  },
})

// ── FIX1 · BL-0141 · agentType fallback (a session running an OLDER plugin than the engine version it
// launched — e.g. plugin 9.102.3 resident while the 9.103.0 engine spawns the new `pandacorp:mech` agent)
// + the D7 pre-loop close-out extension. The 2026-09-22 canary A incident: the runtime rejected the FIRST
// spawn (baseline-precheck) with `agent type 'pandacorp:mech' not found`, and the engine died before the
// scheduler loop existed, leaving the atomic lease taken until an owner freed it by hand.
const MECH_NOT_FOUND = () => new Error("agent type 'pandacorp:mech' not found. Available agents: pandacorp:architect, pandacorp:backend-dev, pandacorp:frontend-dev, pandacorp:implementer, pandacorp:reviewer, pandacorp:devops")
const IMPLEMENTER_NOT_FOUND = () => new Error("agent type 'pandacorp:implementer' not found. Available agents: pandacorp:architect, pandacorp:devops")
const ARCHITECT_NOT_FOUND = () => new Error("agent type 'pandacorp:architect' not found. Available agents: pandacorp:mech, pandacorp:implementer, pandacorp:devops")

// (a) the mech-specific path: the FIRST spawn (baseline-precheck, MECH_AGENT-typed) 404s on
// 'pandacorp:mech', the wrapper retries ONCE with 'pandacorp:implementer' and continues — and every LATER
// mech-typed spawn this run (safe-point-pre-loop, ensure-stopped) goes straight to 'pandacorp:implementer'
// without paying another failed spawn. The one-time explanatory log fires exactly once.
SCENARIOS.push({
  name: 'FIX1a. mech agentType 404 on the very first spawn — one retry with implementer, then every later mech spawn uses implementer directly, log fires once',
  args: { mode: 'pro' },
  plan: mkPlan([]),
  responses: [
    { label: 'baseline-precheck', throws: MECH_NOT_FOUND(), times: 1 },
    { label: 'baseline-precheck', response: { green: true }, times: 1 },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const precheckCalls = byLabel(run, 'baseline-precheck')
    t.ok(precheckCalls.length === 2, `baseline-precheck spawned exactly twice — original + one retry (got ${precheckCalls.length})`)
    t.ok(precheckCalls[0] && precheckCalls[0].opts.agentType === 'pandacorp:mech', 'the FIRST attempt requested pandacorp:mech (MECH_LEAN default)')
    t.ok(precheckCalls[1] && precheckCalls[1].opts.agentType === 'pandacorp:implementer', 'the RETRY used the implementer fallback')
    t.ok(/MechFallback/.test(precheckCalls[1] ? precheckCalls[1].prompt : ''), 'the retried prompt carries the one-time MechFallback dashboard event')
    const laterMechSites = byLabel(run, /^(safe-point-pre-loop|ensure-stopped)$/)
    t.ok(laterMechSites.length > 0, 'at least one later mech-typed call site ran this scenario (safe-point-pre-loop / ensure-stopped)')
    t.ok(laterMechSites.every((c) => c.opts.agentType === 'pandacorp:implementer'), 'every LATER mech-typed spawn used implementer directly — no repeat 404')
    t.ok(!laterMechSites.some((c) => c.opts.agentType === 'pandacorp:mech'), 'no later spawn ever requested pandacorp:mech again this run')
    const fallbackLogs = run.logs.filter((l) => /pandacorp:mech no disponible/.test(l))
    t.ok(fallbackLogs.length === 1, `the explanatory log fires exactly ONCE this run (got ${fallbackLogs.length})`)
    t.ok(run.result && run.result.note === 'all verified', 'the run still completes honestly once the fallback takes over')
  },
})

// (b) the generic path: a DIFFERENT pandacorp:* agentType 404s (the planner's 'pandacorp:architect') —
// same one-retry-with-implementer mechanism, logged, but WITHOUT setting the sticky mechUnavailable flag
// (a later genuinely-mech spawn is unaffected and still requests pandacorp:mech normally).
SCENARIOS.push({
  name: 'FIX1b. a non-mech pandacorp:* agentType 404 (planner/pandacorp:architect) also falls back to implementer once, logged — without touching the mech fast-path',
  args: { mode: 'pro' },
  responses: [
    { label: 'plan', throws: ARCHITECT_NOT_FOUND(), times: 1 },
    { label: 'plan', response: mkPlan([]), times: 1 },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const planCalls = byLabel(run, 'plan')
    t.ok(planCalls.length === 2, `plan spawned exactly twice — original + one retry (got ${planCalls.length})`)
    t.ok(planCalls[0] && planCalls[0].opts.agentType === 'pandacorp:architect', 'the FIRST attempt requested pandacorp:architect')
    t.ok(planCalls[1] && planCalls[1].opts.agentType === 'pandacorp:implementer', 'the RETRY used the implementer fallback')
    t.ok(run.logs.some((l) => /pandacorp:architect.*no disponible.*implementer/.test(l)), 'a fallback log names the requested type and the fallback')
    t.ok(!run.logs.some((l) => /pandacorp:mech no disponible/.test(l)), 'the mech-specific one-time message never fires for a non-mech fallback')
    const laterMechSites = byLabel(run, /^(safe-point-pre-loop|ensure-stopped)$/)
    t.ok(laterMechSites.every((c) => c.opts.agentType === 'pandacorp:mech' || c.opts.agentType === 'pandacorp:implementer'), 'later mech-typed sites are unaffected by the non-mech fallback (still request pandacorp:mech normally — MECH_LEAN default)')
    t.ok(laterMechSites.some((c) => c.opts.agentType === 'pandacorp:mech'), 'a later mech-typed spawn still requests pandacorp:mech normally — the generic fallback never set the sticky mechUnavailable flag')
    t.ok(run.result && run.result.note === 'all verified', 'the run still completes honestly once the fallback takes over')
  },
})

// (c) the fallback ALSO fails — never a second retry, the ORIGINAL not-found error propagates, and the D7
// pre-loop boundary still guarantees the lease is released (ensure-stopped spawned) before the error
// escapes the engine.
SCENARIOS.push({
  name: 'FIX1c. the fallback agentType also 404s — no second retry, the ORIGINAL error propagates, and the pre-loop boundary still releases the lease',
  args: { mode: 'pro' },
  responses: [
    { label: 'baseline-precheck', throws: MECH_NOT_FOUND(), times: 1 },
    { label: 'baseline-precheck', throws: IMPLEMENTER_NOT_FOUND(), times: 1 },
  ],
  assert(t, run) {
    t.ok(Boolean(run.error), 'the engine throws — the fallback could not rescue this call')
    t.ok(run.error && /pandacorp:mech' not found/.test(run.error.message), 'the propagated error is the ORIGINAL mech-not-found error, not the retry\'s own failure')
    const precheckCalls = byLabel(run, 'baseline-precheck')
    t.ok(precheckCalls.length === 2, `exactly ONE retry attempt was made — never a second (got ${precheckCalls.length} total spawns)`)
    const stopCalls = byLabel(run, 'ensure-stopped')
    t.ok(stopCalls.length === 1, 'the D7 pre-loop boundary caught the escaping exception and released the lease (ensure-stopped spawned) before rethrowing')
  },
})

// (d) a GENERIC error (not an "agent type '<x>' not found" rejection) is never retried — a transient
// failure of any other shape propagates on the FIRST attempt, and the pre-loop boundary still guarantees
// the lease is released.
SCENARIOS.push({
  name: 'FIX1d. a generic agent() failure (not an unknown-agentType rejection) is never retried, and the pre-loop boundary still releases the lease',
  args: { mode: 'pro' },
  responses: [
    { label: 'baseline-precheck', throws: new Error('ECONNRESET: agent spawn timed out'), times: 1 },
  ],
  assert(t, run) {
    t.ok(Boolean(run.error), 'the engine throws — a generic failure is never silently swallowed')
    t.ok(run.error && /ECONNRESET/.test(run.error.message), 'the propagated error is the untouched original failure')
    const precheckCalls = byLabel(run, 'baseline-precheck')
    t.ok(precheckCalls.length === 1, `a non-"not found" failure is NEVER retried — exactly one attempt (got ${precheckCalls.length})`)
    const stopCalls = byLabel(run, 'ensure-stopped')
    t.ok(stopCalls.length === 1, 'the D7 pre-loop boundary still releases the lease on a generic pre-loop failure')
  },
})

// ── REV3 (independent review of the speed sprint, batch 3 — 2026-09-22) ─────────────────────────
// The FIX1 scenarios above prove the fallback WORKS. These prove the boundary it must NOT cross.
const REVIEWER_NOT_FOUND = () => new Error("agent type 'pandacorp:reviewer' not found. Available agents: pandacorp:architect, pandacorp:implementer, pandacorp:devops")

// REV3-H · DR-015 · the ORACLE must never degrade into the thing it judges.
// The BL-0141 wrapper is generic over every `pandacorp:*` agentType, and its default fallback is
// `pandacorp:implementer`. No reviewer-typed call site declares `fallbackAgentType`, so when
// `pandacorp:reviewer` is the type the runtime does not know (the exact session/plugin skew BL-0141
// was written for), the per-FRD gate — the independent judge whose whole contract is "edits test
// files only, never production code" — is silently re-spawned as the IMPLEMENTER agent, which has
// Write/Edit over production code. The verdict it then returns still promotes work orders to
// VERIFIED. A missing oracle must FAIL the run, never be substituted.
SCENARIOS.push({
  name: 'REV3-H. an unknown pandacorp:reviewer agentType must FAIL the gate, never degrade the judge into pandacorp:implementer (DR-015)',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-rev3h', deps: [], workOrders: [mkWo('wo-rev3h-001', 'PLANNED', { frd: 'frd-rev3h', artifacts: ['src/rev3h/thing.ts'] })] }]),
  responses: [
    { label: /^gate:/, throws: REVIEWER_NOT_FOUND(), times: 1 },
  ],
  assert(t, run) {
    const gateCalls = byLabel(run, /^gate:/)
    const degraded = gateCalls.filter((c) => c.opts.agentType === 'pandacorp:implementer')
    t.ok(gateCalls.length >= 1, 'the per-FRD gate was reached at all')
    t.ok(
      degraded.length === 0,
      `the FRD gate was re-spawned as pandacorp:implementer after the reviewer agentType 404 (${degraded.length} degraded spawn(s)) — the judge became the builder`,
    )
    t.ok(
      !(run.result && run.result.note === 'all verified') || degraded.length === 0,
      'the run still reported a normal verdict while its independent oracle had been substituted',
    )
    // What IS already true and must stay true: the substitution is at least audible in the log.
    t.ok(
      degraded.length === 0 || run.logs.some((l) => /pandacorp:reviewer.*no disponible/.test(l)),
      'a reviewer substitution is at least logged, never completely silent',
    )
  },
})

// REV3-I · the fallback's own failure must not be swallowed.
// `catch { throw e }` in the wrapper discards the FALLBACK's error entirely (no binding, no log),
// so an operator sees only the original not-found and never learns why the rescue failed
// (error-handling.md: never swallow an error).
SCENARIOS.push({
  name: 'REV3-I. when the fallback agentType also fails, its own failure reason is still surfaced somewhere (never silently discarded)',
  args: { mode: 'pro' },
  plan: mkPlan([]),
  responses: [
    { label: 'baseline-precheck', throws: MECH_NOT_FOUND(), times: 1 },
    { label: 'baseline-precheck', throws: new Error('EPIPE: the fallback spawn died for an unrelated reason'), times: 1 },
  ],
  assert(t, run) {
    t.ok(Boolean(run.error), 'the engine throws')
    t.ok(run.error && /pandacorp:mech' not found/.test(run.error.message), 'the ORIGINAL not-found error is what propagates (intended)')
    t.ok(
      run.logs.some((l) => /EPIPE/.test(l)) || (run.error && /EPIPE/.test(String(run.error.message) + String(run.error.cause || ''))),
      "the fallback's own failure reason (EPIPE) is surfaced (logged), never silently discarded",
    )
  },
})

// REV3-J · the visual-qa tier must not leak into any BLOCKING judge.
// E-3 downgraded an ADVISORY pass to sonnet. The per-FRD gate, the close-out and the diagnose pass
// are DR-072 BLOCKING lenses and must stay on the judge tier — a single misplaced VISUAL_QA_MODEL
// would silently cheapen the thing that decides VERIFIED.
SCENARIOS.push({
  name: 'REV3-J. the sonnet visual-qa tier never leaks into a blocking judge (per-FRD gate / close-out / diagnose stay on the judge model)',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-rev3j', deps: [], workOrders: [mkWo('wo-rev3j-001', 'PLANNED', { frd: 'frd-rev3j', artifacts: ['src/rev3j/page.tsx'] })] }]),
  assert(t, run) {
    const blocking = run.calls.filter((c) => /^(gate:|close-out$|diagnose:)/.test(c.label))
    t.ok(blocking.length >= 1, 'at least one blocking judge ran')
    const cheapened = blocking.filter((c) => c.opts.model !== 'opus')
    t.ok(cheapened.length === 0, `every blocking judge stayed on the judge tier (cheapened: ${cheapened.map((c) => `${c.label}=${c.opts.model}`).join(', ')})`)
    const vq = byLabel(run, 'visual-qa')
    t.ok(vq.length === 0 || vq.every((c) => c.opts.model === 'sonnet'), 'visual-qa, the ADVISORY pass, is the only one on sonnet')
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// FIX2 — Canary B defects (BL-0149/BL-0150): the C2 gate worktree wasn't bootstrapped before the
// WP-06 evidence collector ran verify.sh inside it (biome/tsc/knip/madge red on environment noise,
// not real findings — BL-0149), and the collector + the gate probe each requested the SAME pinned
// worktree with no shared mutex, spawning TWO concurrent `gate-worktree` agents (BL-0150).
// ─────────────────────────────────────────────────────────────────────────────

SCENARIOS.push({
  name: 'FIX2a. BL-0149 — the gate-worktree spawn bootstraps the checkout via worktree-bootstrap.sh, not a bare pnpm install',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-fix2a', deps: [], workOrders: [mkWo('wo-fix2a-001', 'PLANNED', { frd: 'frd-fix2a', artifacts: ['src/fix2a/**'] })] }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gw = byLabel(run, 'gate-worktree')[0]
    t.ok(gw, 'a gate-worktree spawn ran')
    t.ok(gw && /worktree-bootstrap\.sh/.test(gw.prompt), 'the gate-worktree prompt runs .pandacorp/worktree-bootstrap.sh (BL-0149) — the same reconstitution every other fresh worktree gets, instead of a bare ad-hoc pnpm install the collector cannot verify actually ran')
  },
})

SCENARIOS.push({
  name: 'FIX2b. BL-0150 — digested mode: exactly ONE gate-worktree spawn per pin even though the evidence collector AND the gate probe both request it',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: mkPlan([{ frd: 'frd-fix2b', deps: [], workOrders: [wp06Wo('wo-fix2b-001', 'frd-fix2b', { artifacts: ['src/fix2b/**'] })] }]),
  responses: [
    { prefix: 'evidence:', response: { report: wp06GreenReport, diffStat: 's', diff: 'd', truncated: false, ac: 'a', report_suspect: false } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'gate-worktree').length === 1, `exactly ONE gate-worktree spawn per pin — the collector and the gate share the same memoized in-flight promise (got ${byLabel(run, 'gate-worktree').length})`)
    t.ok(byLabel(run, /^evidence:/).length === 1, 'the collector still ran exactly once')
    t.ok(run.result && run.result.builtFrds.includes('frd-fix2b'), 'the FRD still verified through the digested gate')
  },
})

SCENARIOS.push({
  name: 'FIX2c. BL-0149 — collector returns report:null reason:"gate-worktree-not-bootstrapped" ⇒ the gate degrades to EXPLORE with GateEvidenceFallback, never a broken report presented as evidence',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: mkPlan([{ frd: 'frd-fix2c', deps: [], workOrders: [wp06Wo('wo-fix2c-001', 'frd-fix2c')] }]),
  responses: [{ prefix: 'evidence:', response: { report: null, reason: 'gate-worktree-not-bootstrapped' } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-fix2c')[0]
    t.ok(byLabel(run, /^evidence:/).length === 1, 'the collector was attempted')
    t.ok(gate, 'the gate STILL ran (never skipped for want of evidence)')
    t.ok(gate && /Run the FOCUSED gate/.test(gate.prompt), 'the gate fell back to the explore contract')
    t.ok(gate && !/YOUR EVIDENCE IS ALREADY COLLECTED/.test(gate.prompt), 'no digested marker on the fallback gate')
    t.ok(gate && /GateEvidenceFallback/.test(gate.prompt), 'the gate prompt emits the GateEvidenceFallback event')
    t.ok(hasLog(run, /gate-worktree-not-bootstrapped/), 'the SPECIFIC reason (not a generic message) is logged, never silent')
    t.ok(run.result && run.result.builtFrds.includes('frd-fix2c'), 'the run still converges through the explore gate')
  },
})

SCENARIOS.push({
  name: 'FIX2d. BL-0149 — collector sets report_suspect:true (≥3 cheap sub-gates red on environment noise) ⇒ the gate degrades to EXPLORE too',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: mkPlan([{ frd: 'frd-fix2d', deps: [], workOrders: [wp06Wo('wo-fix2d-001', 'frd-fix2d')] }]),
  responses: [{ prefix: 'evidence:', response: { report: wp06GreenReport, diffStat: 's', diff: 'd', truncated: false, ac: 'a', report_suspect: true } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-fix2d')[0]
    t.ok(gate && /Run the FOCUSED gate/.test(gate.prompt), 'report_suspect degrades to the explore contract too — a suspect pack is strictly worse than none')
    t.ok(gate && !/YOUR EVIDENCE IS ALREADY COLLECTED/.test(gate.prompt), 'no digested marker on the report_suspect fallback gate')
    t.ok(gate && /GateEvidenceFallback/.test(gate.prompt), 'the fallback event fires')
    t.ok(hasLog(run, /report_suspect/), 'the report_suspect reason is logged, never silent')
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// BL-0157 — the traceability ORACLE must never destroy a real verdict (canary C, wf_1cf782d6-2ed)
// enforceWholeFrdTraceability used to stamp a BRAND-NEW { green:false, failure } object over ANY
// deficient verdict — including an already-red REJECT — silently wiping its reopen/findings. gateConverge
// then read the wiped object as a bare "no specific reopen" failure and fell to the expensive
// attemptRepair; a deficient-but-GREEN re-gate fell all the way to blockFrd(…,'error') with no retry.
// B1 preserves a reject's fields; B2 re-asks a deficient green ONCE before repairing/blocking 'error'.
// The harness only auto-fills `traceability` when the key is ABSENT (see defaultResponse/agentStub
// above) — every fixture below passes an EXPLICIT, incomplete array to exercise the real oracle path.
// ─────────────────────────────────────────────────────────────────────────────
const traceabilityWithout = (skipClass) => ['requirement', 'acceptance-criterion', 'invariant', 'edge-case', 'limit', 'error', 'exclusion']
  .filter((c) => c !== skipClass)
  .map((contractClass) => ({ contract: `${contractClass} fixture`, contractClass, status: ['edge-case', 'limit'].includes(contractClass) ? 'pass' : 'not-applicable', tests: ['edge-case', 'limit'].includes(contractClass) ? [`tests/${contractClass}.test.ts`] : [] }))

SCENARIOS.push({
  name: 'R1 (BL-0157). a REJECT (reopen+findings) with a missing `requirement` traceability entry still takes the DR-073 patch-first path — replica of canary C gate 1',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-r1', deps: [], workOrders: [mkWo('wo-r1-001', 'PLANNED', { frd: 'frd-r1', artifacts: ['src/r1/**'] })] }]),
  responses: [
    { label: 'gate:frd-r1', times: 1, response: {
      green: false,
      reopen: ['wo-r1-001'],
      findings: [{ wo: 'wo-r1-001', finding: 'R1-FINDING readFileSync missing a guard at src/r1/a.ts:12', failingTest: 'src/r1/_tests/a.test.ts > guards a missing file', files: ['src/r1/a.ts'] }],
      failure: 'reject: missing null-guard',
      traceability: traceabilityWithout('requirement'),   // mirrors canary C: every REQ covered only via its AC, never its own `requirement` entry
    } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(hasLog(run, /missing contractClass: requirement/), 'the engine names the missing class in its log')
    const patches = byLabel(run, /^patch:/)
    const repairs = byLabel(run, /^repair:/)
    t.ok(patches.length >= 1, `a traceability-deficient REJECT with reopen+findings still reaches DR-073 patch-first (patches=${patches.length})`)
    t.ok(repairs.length === 0, `it must NEVER fall to the expensive attemptRepair — B1's old bug destroyed reopen/findings and forced exactly this (repairs=${repairs.length})`)
    t.ok(patches[0] && patches[0].prompt.includes('R1-FINDING'), 'the specific finding text reaches the patch prompt — proof reopen/findings survived the oracle (B1)')
  },
})

SCENARIOS.push({
  name: 'R2 (BL-0157). a deficient GREEN re-asks the SAME gate ONCE and converges on the complete re-ask — never attemptRepair',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-r2', deps: [], workOrders: [mkWo('wo-r2-001', 'PLANNED', { frd: 'frd-r2', artifacts: ['src/r2/**'] })] }]),
  responses: [
    { label: 'gate:frd-r2', times: 1, response: { green: true, traceability: traceabilityWithout('requirement') } },
    { label: 'gate:frd-r2', response: { green: true, traceability: validTraceability, testFiles: ['src/r2/_tests/x.test.ts'] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(hasLog(run, /missing contractClass: requirement/), 'the FIRST (deficient) gate call names the missing class')
    const gates = byLabel(run, 'gate:frd-r2')
    t.ok(gates.length === 2, `exactly ONE re-ask, not a loop (gate calls=${gates.length})`)
    t.ok(gates[1] && /RE-ASK/.test(gates[1].prompt) && gates[1].prompt.includes('requirement'), 'the re-ask prompt names the missing class explicitly to the reviewer')
    t.ok(byLabel(run, /^repair:/).length === 0, 'a deficient-but-otherwise-green verdict never reaches attemptRepair')
    t.ok(byLabel(run, /^apply-gate:/).length === 1, 'the FRD converges through apply-gate on the complete re-ask')
    t.ok(run.result && run.result.builtFrds.includes('frd-r2'), 'the FRD verifies')
  },
})

SCENARIOS.push({
  name: 'R3 (BL-0157). two deficient GREENs in a row block needs-owner — never the default \'error\' — and the re-ask never loops',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-r3', deps: [], workOrders: [mkWo('wo-r3-001', 'PLANNED', { frd: 'frd-r3', artifacts: ['src/r3/**'] })] }]),
  responses: [
    { label: 'gate:frd-r3', response: { green: true, traceability: traceabilityWithout('requirement') } },   // same deficient verdict on every call — no `times`
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gates = byLabel(run, 'gate:frd-r3')
    t.ok(gates.length === 2, `exactly ONE re-ask, never a loop (gate calls=${gates.length})`)
    t.ok(byLabel(run, /^apply-gate:/).length === 0, 'WP06f invariant holds here too: a traceability-deficient verdict is never stamped VERIFIED')
    t.ok(byLabel(run, /^repair:/).length === 0, 'still-deficient never falls to attemptRepair — that reads as a CODE failure it never was')
    t.ok(byLabel(run, /^persist-block:/).length === 1, 'the block is persisted on the main tree')
    t.ok(run.result && run.result.blockedFrds.includes('frd-r3'), 'the FRD ends BLOCKED')
    t.ok(run.result && !run.result.builtFrds.includes('frd-r3'), 'never built')
    t.ok(hasLog(run, /STILL incomplete after the re-ask/), 'the log names the terminal state explicitly, never silent')
    t.ok(run.result && run.result.blockedReasons && run.result.blockedReasons['frd-r3'] === 'needs-owner', "blocked as 'needs-owner' — the exact bug this fixes is a default 'error' the code never earned (canary C gate 2)")
  },
})

// ---- BL-0147 ----
// close-out/notify-end no longer ALWAYS re-pays the whole-project verify.sh: right before running it,
// a cheap read-only MECH spawn ('close-out-verify-reuse-check') decides whether a recent FULL, GREEN
// `.pandacorp/run/gate-report.json` already certifies this EXACT commit. Reuse is opt-in and narrow —
// scope:"full" + green:true + sha==HEAD + a clean tree + not older than the ceiling — and ANY doubt
// keeps today's full rerun exactly as before (the WP-08 partial-report cage is never relaxed).

// (a) the canonical GREEN path: full + green + sha matches HEAD + clean tree ⇒ notify-end REUSES the
// report instead of re-running verify.sh, and logs CloseOutVerifyReused so the saving is auditable.
SCENARIOS.push({
  name: 'BL-0147a. notify-end REUSES a fresh full-green gate-report at HEAD — no full verify.sh rerun, CloseOutVerifyReused logged',
  args: { mode: 'balanced', maxAgents: 7 },
  plan: mkPlan([{
    frd: 'frd-bl0147a',
    deps: [],
    workOrders: [mkWo('wo-bl0147a-001', 'PLANNED', { frd: 'frd-bl0147a', artifacts: ['src/a/**'] })],
  }]),
  responses: [
    { label: 'close-out-verify-reuse-check', response: { canReuse: true, reason: 'reused', reportScope: 'full', reportGreen: true, reportSha: 'deadbeef', headSha: 'deadbeef', dirty: false, ageSeconds: 42 } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const check = byLabel(run, 'close-out-verify-reuse-check')
    t.ok(check.length === 1, 'the reuse-check spawns exactly once')
    t.ok(check[0].opts.agentType === 'pandacorp:mech' && check[0].opts.effort === 'low', 'the reuse-check itself runs on the cheap MECH tier (read-only, zero judgment)')
    const end = byLabel(run, 'notify-end')[0]
    t.ok(end, 'notify-end ran')
    t.ok(check[0].index < end.index, 'the reuse-check runs BEFORE the closing agent, so its verdict is available to shape that prompt')
    t.ok(/BL-0147 REUSE/.test(end.prompt) && /do NOT re-run/.test(end.prompt), 'the closing prompt tells the agent to reuse the report instead of re-running verify.sh')
    t.ok(!/FIRST run the FULL `bash \.pandacorp\/verify\.sh`/.test(end.prompt), 'the "run the FULL verify.sh" instruction is REPLACED, not merely supplemented')
    t.ok(/"event":"CloseOutVerifyReused"/.test(end.prompt) && /"sha":"deadbeef"/.test(end.prompt) && /"ageSeconds":42/.test(end.prompt), 'the CloseOutVerifyReused event is emitted carrying the reused sha + age')
  },
})

// (b) a "since"-scoped report (the per-FRD focused gate, never a certification) must NEVER license reuse
// — the WP-08 partial-report cage stays intact, this fix never relaxes it.
SCENARIOS.push({
  name: 'BL-0147b. notify-end does NOT reuse a "since"-scoped report — the WP-08 partial-report cage stays intact',
  args: { mode: 'balanced', maxAgents: 7 },
  plan: mkPlan([{
    frd: 'frd-bl0147b',
    deps: [],
    workOrders: [mkWo('wo-bl0147b-001', 'PLANNED', { frd: 'frd-bl0147b', artifacts: ['src/a/**'] })],
  }]),
  responses: [
    { label: 'close-out-verify-reuse-check', response: { canReuse: false, reason: 'scope-not-full', reportScope: 'since', reportGreen: true, reportSha: 'deadbeef', headSha: 'deadbeef', dirty: false, ageSeconds: 42 } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const end = byLabel(run, 'notify-end')[0]
    t.ok(end, 'notify-end ran')
    t.ok(/FIRST run the FULL `bash \.pandacorp\/verify\.sh`/.test(end.prompt) && /complete suite, NO --since/.test(end.prompt), 'a "since"-scoped report never licenses reuse — the full rerun instruction is untouched')
    t.ok(!/BL-0147 REUSE/.test(end.prompt) && !/"event":"CloseOutVerifyReused"/.test(end.prompt), 'no reuse framing or event when scope is not "full"')
  },
})

// (c) a SHA mismatch (HEAD moved past the report, e.g. a later commit landed) must NEVER license reuse.
SCENARIOS.push({
  name: 'BL-0147c. notify-end does NOT reuse a report whose sha does not match HEAD',
  args: { mode: 'balanced', maxAgents: 7 },
  plan: mkPlan([{
    frd: 'frd-bl0147c',
    deps: [],
    workOrders: [mkWo('wo-bl0147c-001', 'PLANNED', { frd: 'frd-bl0147c', artifacts: ['src/a/**'] })],
  }]),
  responses: [
    { label: 'close-out-verify-reuse-check', response: { canReuse: false, reason: 'sha-mismatch', reportScope: 'full', reportGreen: true, reportSha: 'aaaaaaa', headSha: 'bbbbbbb', dirty: false, ageSeconds: 10 } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const end = byLabel(run, 'notify-end')[0]
    t.ok(end, 'notify-end ran')
    t.ok(/FIRST run the FULL `bash \.pandacorp\/verify\.sh`/.test(end.prompt), 'a sha mismatch (report proves an OLDER commit, not HEAD) never licenses reuse — the full rerun instruction is untouched')
    t.ok(!/BL-0147 REUSE/.test(end.prompt) && !/"event":"CloseOutVerifyReused"/.test(end.prompt), 'no reuse framing or event on a sha mismatch')
  },
})

// (d) a dirty working tree (uncommitted changes since the report ran) must NEVER license reuse — the
// report certified a COMMIT, and an uncommitted diff on top of it was never verified.
SCENARIOS.push({
  name: 'BL-0147d. notify-end does NOT reuse a report over a dirty working tree',
  args: { mode: 'balanced', maxAgents: 7 },
  plan: mkPlan([{
    frd: 'frd-bl0147d',
    deps: [],
    workOrders: [mkWo('wo-bl0147d-001', 'PLANNED', { frd: 'frd-bl0147d', artifacts: ['src/a/**'] })],
  }]),
  responses: [
    { label: 'close-out-verify-reuse-check', response: { canReuse: false, reason: 'dirty-tree', reportScope: 'full', reportGreen: true, reportSha: 'deadbeef', headSha: 'deadbeef', dirty: true, ageSeconds: 10 } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const end = byLabel(run, 'notify-end')[0]
    t.ok(end, 'notify-end ran')
    t.ok(/FIRST run the FULL `bash \.pandacorp\/verify\.sh`/.test(end.prompt), 'a dirty tree (uncommitted diff since the report ran) never licenses reuse — the full rerun instruction is untouched')
    t.ok(!/BL-0147 REUSE/.test(end.prompt) && !/"event":"CloseOutVerifyReused"/.test(end.prompt), 'no reuse framing or event over a dirty tree')
  },
})

// (e) the SAME reuse mechanism also wires into the OTHER full-verify site: the hardened release
// close-out (allDone path), not just notify-end — the fix covers all four call sites, not one.
SCENARIOS.push({
  name: 'BL-0147e. the hardened release close-out ALSO reuses a fresh full-green report — not just notify-end',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-bl0147e-lib',
    deps: [],
    workOrders: [mkWo('wo-bl0147e-001', 'PLANNED', { frd: 'frd-bl0147e-lib', artifacts: ['src/lib/**'] })],
  }]),
  responses: [
    { label: 'close-out-verify-reuse-check', response: { canReuse: true, reason: 'reused', reportScope: 'full', reportGreen: true, reportSha: 'cafef00d', headSha: 'cafef00d', dirty: false, ageSeconds: 120 } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const closing = byLabel(run, 'close-out')[0]
    t.ok(closing, 'close-out ran (allDone + hardened)')
    t.ok(/BL-0147 REUSE/.test(closing.prompt) && /"event":"CloseOutVerifyReused"/.test(closing.prompt), 'the release close-out prompt also reuses the report instead of re-running the full suite')
    t.ok(!/THEN run the FULL `bash \.pandacorp\/verify\.sh`/.test(closing.prompt), 'the THEN-run-full instruction is replaced')
    t.ok(/kill any test dev servers with TaskStop/.test(closing.prompt) && /BL-0012 \+ WS-D\/D4 fail-closed/.test(closing.prompt), 'the surrounding instructions (kill dev servers, the on-disk release assertions) are UNCHANGED — only the verify clause is swapped')
  },
})

// (f) parity check: the LEGACY close-out shape (args.leanCloseOut:false) wires the same reuse check
// into its own notify-end, so the fix is not lean-shape-only.
SCENARIOS.push({
  name: 'BL-0147f. legacy close-out shape (args.leanCloseOut:false) — notify-end also reuses a fresh full-green report',
  args: { mode: 'balanced', maxAgents: 7, leanCloseOut: false },
  plan: mkPlan([{
    frd: 'frd-bl0147f',
    deps: [],
    workOrders: [mkWo('wo-bl0147f-001', 'PLANNED', { frd: 'frd-bl0147f', artifacts: ['src/a/**'] })],
  }]),
  responses: [
    { label: 'close-out-verify-reuse-check', response: { canReuse: true, reason: 'reused', reportScope: 'full', reportGreen: true, reportSha: 'beefcafe', headSha: 'beefcafe', dirty: false, ageSeconds: 5 } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const end = byLabel(run, 'notify-end')[0]
    t.ok(end, 'notify-end ran (legacy shape)')
    t.ok(/BL-0147 REUSE/.test(end.prompt) && /"event":"CloseOutVerifyReused"/.test(end.prompt), 'legacy notify-end also reuses the report')
  },
})

// (g) static safeguard check: the reuse-check prompt itself encodes ALL FOUR conditions (scope:"full",
// green:true, sha==HEAD, clean tree) plus the age ceiling, and the harness's SAFE DEFAULT (no scripted
// response — simulating an agent that returns nothing usable) never reuses, proving fail-closed-by-default.
SCENARIOS.push({
  name: 'BL-0147g. the reuse-check prompt encodes all four safety conditions plus the age ceiling; the unscripted default never reuses',
  args: { mode: 'balanced', maxAgents: 7 },
  plan: mkPlan([{
    frd: 'frd-bl0147g',
    deps: [],
    workOrders: [mkWo('wo-bl0147g-001', 'PLANNED', { frd: 'frd-bl0147g', artifacts: ['src/a/**'] })],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const check = byLabel(run, 'close-out-verify-reuse-check')[0]
    t.ok(check, 'the reuse-check spawns')
    t.ok(/reportScope === "full"/.test(check.prompt), 'requires scope:"full"')
    t.ok(/reportGreen === true/.test(check.prompt), 'requires green:true')
    t.ok(/reportSha === headSha/.test(check.prompt), 'requires the report sha to match HEAD')
    t.ok(/dirty === false/.test(check.prompt), 'requires a clean tree')
    t.ok(/ageSeconds <= 900/.test(check.prompt), 'requires the report to be no older than the 900s ceiling')
    const end = byLabel(run, 'notify-end')[0]
    t.ok(end && /complete suite, NO --since/.test(end.prompt) && !/CloseOutVerifyReused/.test(end.prompt), 'the unscripted (agent-returns-nothing-usable) default never reuses — the full rerun is the fail-safe default')
  },
})

// ---- BL-0179 ----
// canary D's live measurement found BL-0147's reuse-check NEVER fires in a real run. BL-0179 then added a "since"
// arm (a since-scoped report anchored at the current last_green_sha). Canary E2 (finding 7) retired that arm: it
// never fired either, and its premise was false — every landing publishes last_green_sha from a since-scoped
// report, so last_green_sha is never itself full-certified (see the E2-7 scenarios under "E2 findings"). What
// stays from BL-0179: a since report still never licenses reuse, whatever its anchor.

// (c) control: a "since" report whose anchor does NOT match the current last_green_sha (an older
// focused gate, superseded by a later commit) must NEVER license reuse — sibling of BL-0147b, proving
// the new arm is exact-match only, never "any since report".
SCENARIOS.push({
  name: 'BL-0179c. control — a "since" report anchored at a DIFFERENT sha than last_green_sha does NOT reuse',
  args: { mode: 'balanced', maxAgents: 7 },
  plan: mkPlan([{
    frd: 'frd-bl0179c',
    deps: [],
    workOrders: [mkWo('wo-bl0179c-001', 'PLANNED', { frd: 'frd-bl0179c', artifacts: ['src/a/**'] })],
  }]),
  responses: [
    { label: 'close-out-verify-reuse-check', response: { canReuse: false, reason: 'since-mismatch', reportScope: 'since', reportSince: 'aaaa111', lastGreenSha: 'bbbb222', reportGreen: true, reportSha: 'deadbeef', headSha: 'deadbeef', dirty: false, ageSeconds: 30 } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const end = byLabel(run, 'notify-end')[0]
    t.ok(end, 'notify-end ran')
    t.ok(/FIRST run the FULL `bash \.pandacorp\/verify\.sh`/.test(end.prompt) && /complete suite, NO --since/.test(end.prompt), 'a since-report anchored at a stale/different sha never licenses reuse — the full rerun instruction is untouched')
    t.ok(!/BL-0147 REUSE/.test(end.prompt) && !/"event":"CloseOutVerifyReused"/.test(end.prompt), 'no reuse framing or event on a since-anchor mismatch')
  },
})
// ---- BL-0138 ----
// ═════════════════════════════════════════════════════════════════════════════
// BL-0138 — the repair brake gets a REAL-TOKEN second opinion (path 1 of the BL's fix plan), on top
// of the already-shipped 9-unit agent-weight floor (path 2, WP08e/REV2-3/FIX2-D4* above). Verified
// against the Workflow script API before implementing (workflow-authoring skill): agent() returns no
// per-call usage field, so the only live token signal is `budget.spent()` — ONE un-partitioned counter
// for the whole run. That makes a real per-FRD REPAIR cost trustworthy (every repair rung runs on a
// quiesced, one-FRD-at-a-time tree — see chargedRepair's own comment) but makes a real per-FRD BUILD
// cost trustworthy ONLY when that FRD's wave built it alone (the engine's global-wave design otherwise
// builds multiple FRDs concurrently, sharing the same counter). canAffordRepair therefore consults the
// token ceiling with OR semantics: it can only RESCUE a rung the floored agent-weight ceiling would
// have refused, never refuse one agent-weight alone would have allowed — so it narrows BL-0138's false
// early trip without weakening the brake's own runaway-loop guarantee.
//
// DECISION recorded here for the test that proves it (BL-0138-4): `scopedRepair` stays at its EXISTING
// default of `false`. The budget-accuracy bug this item's title names is now fixed twice over (the
// floor, and this real-token layer) — but re-reading the scoped-repair mechanism itself (the
// `scope:"partial"` cage + its `--only`/`--files`-narrowed INTERNAL cycles) turned up a SEPARATE,
// unrelated risk the budget fix does nothing for: those internal cycles re-gate scoped to the sub-gates
// verify.sh's report named, so a misclassified or cross-file regression could churn the internal budget
// against the wrong scope before the (always-unscoped) final certification catches it late. The code's
// own comment already states the real bar for flipping the default — "a tradeoff the owner should opt
// into on LIVE DATA" — and the decision log confirms that data does not exist yet (Canary A and B both
// ran with the default, `scopedRepair` "confirmed still applicable"/"confirmed unused"). Proposed
// activation criterion, mirroring the bar already used for `gateEvidence:'digested'` (BL-0135): a
// dedicated canary run with `{"scopedRepair": true}` explicitly opted in, on a real patch-1→diagnose→
// patch-2(+) escalation, confirming (a) the sub-gate classifier correctly targets the actual failing
// sub-gate, (b) no case where the scoped re-gate missed a regression the final unscoped certification
// then had to catch late, and (c) the mechanical sonnet fixer rarely needs an opus escalation.
// ═════════════════════════════════════════════════════════════════════════════

// A scenario-local mutable token counter, read by the engine's own `budget.spent()`. `charge(n)`
// simulates an agent call's real output-token cost — called INSIDE a scripted `response` function so
// the increment lands before the engine's post-call `budget.spent()` snapshot (chargedRepair brackets
// each repair rung, and the wave barrier bracket, with a before/after read of exactly this counter).
function makeTokenBudget() {
  let spent = 0
  return { budget: { total: 0, spent: () => spent, remaining: () => Infinity }, charge: (n) => { spent += n } }
}

// ── BL-0138-1. RED (without path 1) / GREEN (with it): the real-token ceiling rescues a rung the
// floored agent-weight budget alone refuses — the exact WP08e shape (1-WO FRD, repairBudgetFactor 3,
// patch-1/diagnose/patch-2 fit the 9-unit floor, the in-run retry does not), but this FRD's build was
// measured at 10000 real tokens (a single-FRD wave, so buildTokensReliable is true) and the WHOLE
// repair ladder — including the in-run retry — spends only ~200 tokens, far under 3x10000. Before this
// fix, canAffordRepair had no token signal at all and WP08e's own assertions prove it blocks here; with
// it, the in-run retry is rescued and the FRD converges.
const tb1 = makeTokenBudget()
SCENARIOS.push({
  name: 'BL-0138-1. real-token layer rescues the in-run retry that the floored agent-weight budget alone would refuse (WP08e counterpart, token-generous build)',
  args: { mode: 'pro', scopedRepair: true, repairBudgetFactor: 3 },
  budget: tb1.budget,
  plan: mkPlan([{
    frd: 'frd-bl0138a-lib',
    deps: [],
    workOrders: [mkWo('wo-bl0138a-001', 'PLANNED', { frd: 'frd-bl0138a-lib', artifacts: ['src/lib/**'] })],
  }]),
  responses: [
    { prefix: 'build:', times: 1, response: (call) => { tb1.charge(10000); return { green: true } } },   // the initial build — sets buildTokensByFrd
    { prefix: 'build:', response: (call) => { tb1.charge(50); return { green: true } } },                // the in-run retry's own rebuild
    { prefix: 'gate:', times: 1, response: { green: false, reopen: ['wo-bl0138a-001'], findings: [{ wo: 'wo-bl0138a-001', finding: 'src/lib/a.ts:9 wrong', files: ['src/lib/a.ts'] }] } },
    { prefix: 'patch:', response: (call) => { tb1.charge(50); return { green: false, cause: 'code', failure: 'still red' } } },
    { prefix: 'diagnose:', response: (call) => { tb1.charge(50); return { classification: 'point', repeatsPrior: false, recommendation: 'patch', confidence: 'medium' } } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^patch:/).length === 2, 'patch-1 and patch-2 both ran, same as the floor-only WP08e baseline')
    t.ok(byLabel(run, /^block-repair-budget:/).length === 0, 'RESCUED: the real-token ceiling (3x the measured 10000-token build) easily covers the ~200 tokens the whole ladder spent, so the in-run retry runs instead of an honest exhaustion exit')
    t.ok(run.result && run.result.builtFrds.includes('frd-bl0138a-lib'), 'the FRD converges — the token layer let the in-run retry finish the job that the agent-weight floor alone (WP08e) refuses')
  },
})

// ── BL-0138-2. below the factor: no brake fires — the common case is unaffected by the new layer
// (both signals agree there is room; the token layer is never even consulted since agent-weight alone
// already affords every rung).
const tb2 = makeTokenBudget()
SCENARIOS.push({
  name: 'BL-0138-2. real-token layer adds nothing when agent-weight alone already affords the ladder — patch-1 fixes it clean, no brake anywhere',
  args: { mode: 'pro', repairBudgetFactor: 3 },
  budget: tb2.budget,
  plan: mkPlan([{
    frd: 'frd-bl0138b-lib',
    deps: [],
    workOrders: [mkWo('wo-bl0138b-001', 'PLANNED', { frd: 'frd-bl0138b-lib', artifacts: ['src/lib/**'] })],
  }]),
  responses: [
    { prefix: 'build:', response: (call) => { tb2.charge(5000); return { green: true } } },
    { prefix: 'gate:', times: 1, response: { green: false, reopen: ['wo-bl0138b-001'], findings: [{ wo: 'wo-bl0138b-001', finding: 'src/lib/b.ts:4 wrong', files: ['src/lib/b.ts'] }] } },
    { prefix: 'patch:', response: (call) => { tb2.charge(50); return { green: true } } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^block-repair-budget:/).length === 0, 'no brake — patch-1 alone fixed it')
    t.ok(byLabel(run, /^diagnose:/).length === 0, 'never escalated past patch-1')
    t.ok(run.result && run.result.builtFrds.includes('frd-bl0138b-lib'), 'the FRD converges normally')
  },
})

// ── BL-0138-3. CONTROL — a fixture that should still trip the brake keeps tripping it: when the
// FRD's real build spend is genuinely small (proportionally, not just in agent-weight units) and the
// repair ladder genuinely grinds through it, BOTH the floored agent-weight ceiling AND the real-token
// ceiling say no by the in-run retry — the token layer only narrows the false-early-trip case
// (BL-0138-1), it never removes the brake. Same 1-WO/repairBudgetFactor:3 shape as WP08e, but the
// measured build cost is small (100 tokens) and each repair rung is proportionally expensive (150
// tokens) — repairTokensByFrd exceeds 3x100=300 by the same in-run-retry checkpoint where the floor
// would already refuse, so the honest exit still fires.
const tb3 = makeTokenBudget()
SCENARIOS.push({
  name: 'BL-0138-3. CONTROL — a genuinely expensive repair still trips the brake: the token layer never rescues when real spend does not justify it',
  args: { mode: 'pro', scopedRepair: true, repairBudgetFactor: 3 },
  budget: tb3.budget,
  plan: mkPlan([{
    frd: 'frd-bl0138c-lib',
    deps: [],
    workOrders: [mkWo('wo-bl0138c-001', 'PLANNED', { frd: 'frd-bl0138c-lib', artifacts: ['src/lib/**'] })],
  }]),
  responses: [
    { prefix: 'build:', times: 1, response: (call) => { tb3.charge(100); return { green: true } } },
    { prefix: 'gate:', times: 1, response: { green: false, reopen: ['wo-bl0138c-001'], findings: [{ wo: 'wo-bl0138c-001', finding: 'src/lib/c.ts:9 wrong', files: ['src/lib/c.ts'] }] } },
    { prefix: 'patch:', response: (call) => { tb3.charge(150); return { green: false, cause: 'code', failure: 'still red' } } },
    { prefix: 'diagnose:', response: (call) => { tb3.charge(150); return { classification: 'point', repeatsPrior: false, recommendation: 'patch', confidence: 'medium' } } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^patch:/).length === 2, 'patch-1 and patch-2 still both run — the agent-weight floor still guarantees that escalator (unchanged invariant)')
    const block = byLabel(run, /^block-repair-budget:/)[0]
    t.ok(Boolean(block), 'CONTROL HOLDS: the in-run retry is STILL refused — real spend (450+ tokens against a 300-token ceiling) does not justify a rescue, so the brake fires exactly as it did before this fix')
    t.ok(run.result && run.result.blockedFrds.includes('frd-bl0138c-lib'), 'the FRD lands blocked, same as the pre-existing WP08e/REV2-3 guarantee')
  },
})

// ── BL-0138-4. FALLBACK — a multi-FRD wave makes real per-FRD tokens unmeasurable; the brake falls
// back to agent-weight alone (identical outcome to WP08e) AND logs the fallback explicitly (fail-loud,
// never a silent wrong number). Two independent 1-WO FRDs, disjoint artifacts, mode 'pro' (P.wave=2) —
// both build in ONE wave, so recordWaveBuildTokens marks BOTH unreliable. Only frd-bl0138d-1 is driven
// through the WP08e ladder; frd-bl0138d-2's gate passes untouched (default green).
const tb4 = makeTokenBudget()
SCENARIOS.push({
  name: 'BL-0138-4a. FALLBACK — a multi-FRD wave makes real tokens unusable for repair budgeting; the brake falls back to agent-weight (same outcome as WP08e) and logs the fallback',
  args: { mode: 'pro', scopedRepair: true, repairBudgetFactor: 3 },
  budget: tb4.budget,
  plan: mkPlan([
    { frd: 'frd-bl0138d-1', deps: [], workOrders: [mkWo('wo-bl0138d-1-001', 'PLANNED', { frd: 'frd-bl0138d-1', artifacts: ['src/lib/d1/**'] })] },
    { frd: 'frd-bl0138d-2', deps: [], workOrders: [mkWo('wo-bl0138d-2-001', 'PLANNED', { frd: 'frd-bl0138d-2', artifacts: ['src/lib/d2/**'] })] },
  ]),
  responses: [
    { prefix: 'build:', response: (call) => { tb4.charge(10000); return { green: true } } },   // both FRDs' builds land in the SAME multi-FRD wave
    { prefix: 'gate:frd-bl0138d-1', times: 1, response: { green: false, reopen: ['wo-bl0138d-1-001'], findings: [{ wo: 'wo-bl0138d-1-001', finding: 'src/lib/d1/a.ts:9 wrong', files: ['src/lib/d1/a.ts'] }] } },
    { prefix: 'patch:frd-bl0138d-1', response: { green: false, cause: 'code', failure: 'still red' } },
    { prefix: 'diagnose:frd-bl0138d-1', response: { classification: 'point', repeatsPrior: false, recommendation: 'patch', confidence: 'medium' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^dispatch:/)[0] && /frd-bl0138d-1\+frd-bl0138d-2|frd-bl0138d-2\+frd-bl0138d-1/.test(byLabel(run, /^dispatch:/)[0].label), 'both FRDs really did share ONE wave (P.wave=2 fits both 1-WO FRDs)')
    t.ok(byLabel(run, /^patch:frd-bl0138d-1/).length === 2, 'patch-1 and patch-2 still both run — the agent-weight floor is untouched by the fallback')
    const block = byLabel(run, /^block-repair-budget:frd-bl0138d-1/)[0]
    t.ok(Boolean(block), 'FALLBACK: even though the measured build tokens (10000) would normally give huge token headroom, the multi-FRD wave makes that number untrustworthy, so the brake still fires on agent-weight alone — identical outcome to WP08e')
    t.ok(hasLog(run, /brake on agent-weight, usage unavailable/), 'the fallback is logged explicitly, fail-loud — never a silent wrong number (BL-0138)')
    t.ok(run.result && run.result.builtFrds.includes('frd-bl0138d-2'), 'the sibling FRD in the same wave is unaffected — it converges normally')
  },
})

// ── BL-0138-5. DECISION CHECK — scopedRepair's default is UNCHANGED by this fix. With scopedRepair
// omitted entirely (proving the DEFAULT, not an explicit false — see WP08f for the explicit-false
// case), a mechanical gate report still runs the full opus/xhigh ladder, unscoped — exactly as before.
SCENARIOS.push({
  name: 'BL-0138-5. DECISION — scopedRepair keeps defaulting to false: the budget fix alone does not justify flipping it (see this file\'s BL-0138 header for why + the activation criterion)',
  args: { mode: 'pro' },   // scopedRepair intentionally omitted
  plan: mkPlan([{
    frd: 'frd-bl0138e-lib',
    deps: [],
    workOrders: [mkWo('wo-bl0138e-001', 'PLANNED', { frd: 'frd-bl0138e-lib', artifacts: ['src/lib/**'] })],
  }]),
  responses: [
    { prefix: 'gate:', response: wp08MechGate('wo-bl0138e-001', 'src/lib/e.ts'), times: 1 },
    { prefix: 'patch:', response: { green: true } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const patch = byLabel(run, /^patch:/)[0]
    t.ok(patch && patch.opts.model === 'opus' && patch.opts.effort === 'xhigh', 'still opus/xhigh — the scoped sonnet/medium path never activates on the default')
    t.ok(patch && !/--only=/.test(patch.prompt) && !/--files=/.test(patch.prompt), 'no scoped gate anywhere in the patch prompt — the DEFAULT (not just an explicit false) stays byte-for-byte the unscoped ladder')
    t.ok(run.result && run.result.builtFrds.includes('frd-bl0138e-lib'), 'and the FRD still converges exactly as today')
  },
})

// ---- BL-0159 ----
// canary-c-forensics.md §7 "Hallazgos hermanos": even with BL-0157's oracle fix landed, a gate that
// reaches a terminal BLOCK without `apply-gate` ever running left NO trace (no review_end, no
// GateVerdict, an unclosed review_start) and notify-end's owner-facing progress.md narrated a stale
// "needs your decision" story off gate-1's superseded findings while also under-counting the real
// on-disk work-order total. This closes the residual gap: EVERY terminal gate outcome — pass (already
// covered pre-BL-0159) or ANY block, regardless of which of the several block-exit functions reaches
// it — now emits review_end + GateVerdict through the single `emitGateOutcome` choke point, and
// notify-end always re-syncs the rollup and narrates the LATEST recorded reason/failure, never a
// stale one.
// ─────────────────────────────────────────────────────────────────────────────

// (a) needs-owner block via the B2 traceability re-ask, still deficient after one retry (persistGateBlock,
// canary C gate 2's exact replica, post-BL-0157) — before BL-0159 this call emitted NOTHING.
SCENARIOS.push({
  name: 'BL-0159a. needs-owner block (traceability contract still deficient after the B2 re-ask) emits review_end + frd_end + GateVerdict via persist-block — canary C gate 2 replica, post-BL-0157',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-bl0159a', deps: [], workOrders: [mkWo('wo-bl0159a-001', 'PLANNED', { frd: 'frd-bl0159a', artifacts: ['src/bl0159a/**'] })] }]),
  responses: [
    { label: 'gate:frd-bl0159a', response: { green: true, traceability: traceabilityWithout('requirement') } },   // same deficient verdict on every call — no `times`
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const block = byLabel(run, 'persist-block:frd-bl0159a')[0]
    t.ok(Boolean(block), 'the still-deficient re-ask persists the block')
    t.ok(block && /"kind":"review_end","frd":"frd-bl0159a","verdict":"blocked"/.test(block.prompt), 'BL-0159: persist-block now emits review_end (verdict:blocked) — silent before this fix (canary C gate 2 left an unclosed review_start)')
    t.ok(block && /"kind":"frd_end","frd":"frd-bl0159a"/.test(block.prompt), 'BL-0159: persist-block now emits frd_end')
    t.ok(block && /"event":"GateVerdict"[^`]*"frd":"frd-bl0159a"[^`]*"verdict":"blocked"[^`]*"blocked_reason":"needs-owner"/.test(block.prompt), 'BL-0159: persist-block now emits GateVerdict blocked/needs-owner')
    t.ok(run.result && run.result.blockedReasons['frd-bl0159a'] === 'needs-owner', "blocked needs-owner (never the default 'error')")
    t.ok(run.result && run.result.blockedFailures && /requirement/.test(run.result.blockedFailures['frd-bl0159a'] || ''), 'BL-0159: the concrete failure text (naming the missing class) is threaded into blockedFailures for notify-end to quote verbatim, not just the coarse reason code')
  },
})

// (a2) regression guard — the OTHER persistGateBlock call site (the gate agent's OWN inline
// 'blocked'/'fail' branch already self-emitted) must stay untouched: passing alreadyTracked:true must
// NOT produce a second review_end/GateVerdict in the persist-block prompt.
SCENARIOS.push({
  name: 'BL-0159a2. a gate-self-classified needs-owner block (DR-072 reopen-cap) does NOT duplicate review_end/GateVerdict in persist-block (alreadyTracked:true)',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-bl0159a2', deps: [], workOrders: [mkWo('wo-bl0159a2-001', 'PLANNED', { frd: 'frd-bl0159a2', reopen_count: 3, artifacts: ['src/bl0159a2/**'] })] }]),
  responses: [
    { label: 'gate:frd-bl0159a2', response: { green: false, reopen: [], blocked_reason: 'needs-owner', failure: 'reopened 3x, gate not satisfiable autonomously', traceability: validTraceability } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const block = byLabel(run, 'persist-block:frd-bl0159a2')[0]
    t.ok(Boolean(block), 'the classified block is still persisted on main')
    t.ok(block && !/"event":"GateVerdict"/.test(block.prompt), 'no SECOND GateVerdict — the reviewing gate agent already emitted one inline for this classification')
    t.ok(block && !/"kind":"review_end"/.test(block.prompt), 'no SECOND review_end either')
    t.ok(run.result && run.result.blockedReasons['frd-bl0159a2'] === 'needs-owner', 'still blocked needs-owner')
  },
})

// (b) a generic block (blocked_reason:'error', no traceability defect, no prior classification) reached
// through attemptRepair's own "cannot fix" branch — before BL-0159 this branch emitted NOTHING at all.
SCENARIOS.push({
  name: "BL-0159b. a generic block ('error', via attemptRepair's give-up branch) emits review_end + frd_end + GateVerdict too — never silent",
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-bl0159b', deps: [], workOrders: [mkWo('wo-bl0159b-001', 'PLANNED', { frd: 'frd-bl0159b', artifacts: ['src/bl0159b/**'] })] }]),
  responses: [
    { label: 'gate:frd-bl0159b', response: { green: false, reopen: [], failure: 'mystery failure, no pinpoint', traceability: validTraceability } },
    { label: 'repair:frd-bl0159b', response: { green: false, blocked_reason: 'error', failure: 'could not resolve' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const repair = byLabel(run, 'repair:frd-bl0159b')[0]
    t.ok(Boolean(repair), 'the repair attempt ran')
    t.ok(repair && /"kind":"review_end","frd":"frd-bl0159b","verdict":"blocked"/.test(repair.prompt), 'BL-0159: the repair prompt now carries the review_end printf for its own give-up branch — silent before this fix')
    t.ok(repair && /"kind":"frd_end","frd":"frd-bl0159b"/.test(repair.prompt), 'BL-0159: and frd_end')
    t.ok(repair && /"event":"GateVerdict"[^`]*"frd":"frd-bl0159b"[^`]*"verdict":"blocked"[^`]*"blocked_reason":"%s"/.test(repair.prompt), 'BL-0159: and GateVerdict, with the ACTUAL reason filled in by the agent at runtime (%s — the agent chooses among needs-owner|external|error, unknown at prompt-construction time)')
    t.ok(byLabel(run, /^persist-block:/).length === 0, 'this path never touches persistGateBlock — the repair agent itself is the sole main-tree writer here')
    t.ok(run.result && run.result.blockedFrds.includes('frd-bl0159b'), 'the FRD ends blocked')
    t.ok(run.result && run.result.blockedReasons['frd-bl0159b'] === 'error', "the reason IS 'error' here (that is a legitimate agent classification, not the old silent DEFAULT — the point is it is now TRACED, not that 'error' never happens)")
    t.ok(run.result && run.result.blockedFailures && run.result.blockedFailures['frd-bl0159b'] === 'could not resolve', 'the concrete failure text reaches blockedFailures for notify-end to quote')
  },
})

// (b2) the OTHER attemptRepair call site (a build-wave work-order self-test failure, BEFORE any review
// ever starts) must NOT gain this telemetry — no review_start was ever emitted for it, so a review_end
// here would announce the close of a review that never opened.
SCENARIOS.push({
  name: 'BL-0159b2. a build-wave self-test failure routed through attemptRepair (no review ever started) does NOT emit review_end/frd_end/GateVerdict',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-bl0159b2', deps: [], workOrders: [mkWo('wo-bl0159b2-001', 'PLANNED', { frd: 'frd-bl0159b2', artifacts: ['src/bl0159b2/**'] })] }]),
  responses: [
    { label: 'build:wo-bl0159b2-001', response: { green: false } },
    { label: 'repair:frd-bl0159b2', response: { green: false, blocked_reason: 'error', failure: 'still broken' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const repair = byLabel(run, 'repair:frd-bl0159b2')[0]
    t.ok(Boolean(repair), 'the repair attempt ran (build-wave self-test failure path)')
    t.ok(repair && !/"kind":"review_end"/.test(repair.prompt), 'no review_end — no review_start was ever emitted for a build-wave failure, so there is no review to close')
    t.ok(repair && !/"kind":"frd_end"/.test(repair.prompt), 'no frd_end either')
    t.ok(repair && !/"event":"GateVerdict"/.test(repair.prompt), 'and no GateVerdict — this is a build failure, not a gate verdict')
  },
})

// (c) PASS via apply-gate — after refactoring applyGate/verifyPatched onto the shared emitGateOutcome
// helper, the emission must stay EXACTLY once (no duplicates introduced by the refactor).
SCENARIOS.push({
  name: 'BL-0159c. PASS via apply-gate still emits review_end/frd_end/GateVerdict exactly ONCE after the emitGateOutcome refactor — no duplicates',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-bl0159c', deps: [], workOrders: [mkWo('wo-bl0159c-001', 'PLANNED', { frd: 'frd-bl0159c', artifacts: ['src/bl0159c/**'] })] }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const apply = byLabel(run, 'apply-gate:frd-bl0159c')[0]
    t.ok(Boolean(apply), 'apply-gate ran')
    const reviewEndCount = (apply && (apply.prompt.match(/"kind":"review_end"/g) || [])).length
    const frdEndCount = (apply && (apply.prompt.match(/"kind":"frd_end"/g) || [])).length
    const gateVerdictCount = (apply && (apply.prompt.match(/"event":"GateVerdict"/g) || [])).length
    t.ok(reviewEndCount === 1, `exactly one review_end (got ${reviewEndCount})`)
    t.ok(frdEndCount === 1, `exactly one frd_end (got ${frdEndCount})`)
    t.ok(gateVerdictCount === 1, `exactly one GateVerdict (got ${gateVerdictCount})`)
    t.ok(apply && /verdict":"pass"/.test(apply.prompt), 'the pass verdict text is intact after the refactor onto emitGateOutcome')
    t.ok(run.result && run.result.builtFrds.includes('frd-bl0159c'), 'the FRD verifies')
  },
})

// (d) notify-end: the WO rollup is re-synced from disk (the governed writer, never hand-derived) right
// before the count is reported, and the closing narrative is built from blockedReasons/blockedFailures
// (this run's LATEST state) rather than an earlier attempt's stale findings — canary C's "106/106 with
// 107 real files" + "needs owner decision" (fix already committed, gate 2 was green) symptom.
SCENARIOS.push({
  name: 'BL-0159d. notify-end re-syncs the rollup from disk before reporting the WO count, and narrates the LATEST blocked reason/failure (never a stale one)',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-bl0159d', deps: [], workOrders: [mkWo('wo-bl0159d-001', 'PLANNED', { frd: 'frd-bl0159d', artifacts: ['src/bl0159d/**'] })] }]),
  responses: [
    { label: 'gate:frd-bl0159d', response: { green: false, reopen: [], blocked_reason: 'external', failure: 'upstream flaky', traceability: validTraceability } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const end = byLabel(run, 'notify-end')[0]
    t.ok(Boolean(end), 'notify-end ran')
    const syncIdx = end.prompt.indexOf('sync-rollups --project')
    const buildCompleteIdx = end.prompt.indexOf('"event":"BuildComplete"')
    t.ok(syncIdx >= 0, 'BL-0159: notify-end now re-invokes the governed sync-rollups writer — before this fix it only ever read status.yaml\'s LAST-synced (possibly stale) counters')
    t.ok(buildCompleteIdx > syncIdx, 'the resync happens BEFORE the WO count is reported (BuildComplete/progress.md), never after')
    t.ok(/BL-0159 — narrate the LATEST state only/.test(end.prompt), 'BL-0159: the closing prompt explicitly forbids narrating a superseded earlier gate attempt\'s findings once a later one changed the outcome')
    t.ok(/frd-bl0159d\(external: upstream flaky\)/.test(end.prompt), 'the blocked-FRD summary carries the CONCRETE failure text, not just the reason code — the closing agent no longer has to guess or dig through older transcript context')
  },
})

// ---- BL-0160 ----
// Canary C (wf_1cf782d6-2ed, canary-c-forensics.md §2/§7) reproduced the EXACT BL-0124 symptom on
// plugin 9.104.2 — a full opus judge-baseline spawned solely because the run's OWN lease-owned
// status.yaml write looked dirty — even though BL-0124's engine-side exclusion (leasedStatusOnly,
// this file's WP04 block above) has been live, unmodified, since e52bdfc1/9.103.0. Direct simulation
// of the decision branches (see this item's investigation) proves the engine-side match is correct
// for the REAL production-shaped payload; none of WP04a/b/c actually exercises that exact shape —
// WP04a sets `green: true` (which short-circuits through the FIRST branch, precheck.green===true,
// never reaching the leasedStatusOnly branch at all), so the real trigger path had NO regression
// coverage. These scenarios close that gap and lock in the STEP 3 prompt/schema clarification (the
// dirtyPaths entries must be BARE paths, with git-porcelain's leading XY status code + space
// stripped) that makes a cheap MECH/haiku pre-check agent far less likely to emit the one shape
// (a raw porcelain line) that silently fails the engine's strict-equality match and forces the
// exact avoidable escalation this item traces.
SCENARIOS.push({
  name: 'BL-0160a. Recurrence regression — the REAL production-shaped precheck response (no `green` field, matching STEP 3\'s actual dirty-branch instructions) takes the BL-0124 fast path, no judge-baseline spawn',
  args: { mode: 'pro' },
  responses: [{ label: 'baseline-precheck', response: { escalate: true, dirty: true, dirtyPaths: ['.pandacorp/status.yaml'], leaseValid: true } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'baseline').length === 0, 'no judge-baseline/verify.sh cycle for a lone leased status.yaml diff — even without a `green` field in the response (WP04a never actually proved this: it set green:true, which fires a DIFFERENT branch)')
    t.ok(byLabel(run, 'plan').length === 1, 'the run still proceeds into planning (green fast path taken)')
    t.ok(hasLog(run, /BL-0124/), 'the BL-0124 fast-path log line fires for the real-shaped payload')
  },
})
SCENARIOS.push({
  name: 'BL-0160b. Canary C\'s LITERAL reported shape (`green: false` explicitly set alongside dirty/dirtyPaths/leaseValid, per canary-c-forensics.md §2\'s "green:false") still takes the fast path — green:false alone (no `failure`) never routes into the BL-0022 root-guard branch',
  args: { mode: 'pro' },
  responses: [{ label: 'baseline-precheck', response: { escalate: true, dirty: true, dirtyPaths: ['.pandacorp/status.yaml'], leaseValid: true, green: false } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'baseline').length === 0, 'an explicit green:false with no failure string still takes the BL-0124 fast path, not the judge-baseline')
    t.ok(run.result && run.result.note !== 'baseline red (needs manual fix)', 'the run never reads this as a root-guard failure')
  },
})
SCENARIOS.push({
  name: 'BL-0160c. Control — a dirty path OTHER than the leased status.yaml (real-shaped payload, no `green` field) still escalates to the full judge baseline exactly as today',
  args: { mode: 'pro' },
  responses: [{ label: 'baseline-precheck', response: { escalate: true, dirty: true, dirtyPaths: ['.pandacorp/status.yaml', 'src/lib/x.ts'], leaseValid: true } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'baseline').length === 1, 'genuine WIP alongside the leased status.yaml still forces the full judge-baseline/verify.sh cycle — the exclusion never widens')
  },
})
SCENARIOS.push({
  name: 'BL-0160d. DOC LOCK-IN — the baseline-precheck prompt explicitly instructs stripping git-porcelain\'s XY status code before reporting a dirtyPaths entry (BL-0160 fix: prevents a cheap MECH agent from echoing the raw porcelain line, which would silently fail the engine\'s strict dirtyPaths[0]===".pandacorp/status.yaml" match)',
  args: { mode: 'pro' },
  responses: [{ label: 'baseline-precheck', response: { escalate: true, dirty: true, dirtyPaths: ['.pandacorp/status.yaml'], leaseValid: true } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const precheck = byLabel(run, 'baseline-precheck')[0]
    t.ok(Boolean(precheck), 'the pre-check spawned')
    t.ok(/BARE path/.test(precheck.prompt) && /XY status code/.test(precheck.prompt) && /STRIPPED/.test(precheck.prompt), 'the STEP 3 prompt spells out the bare-path requirement with the XY-status-code example, not just "exactly as printed"')
  },
})

// ---- BL-0171 ----
// Canary D (canary-d-wave-investigation.md, 2026-09-25): processChange() creates/updates FRDs+WOs via
// its own iterate/bug logic, born `status: DRAFT` (the work-order template default) with none of the
// DR-100 readiness/grounding/consistency stamps /pandacorp:architecture's own step 9/9b/9b2 requires — a
// LATER relaunch's preflight (preflight-implement.sh §3/§5) refuses an un-gated DRAFT WO, but the FIRST
// launch (the SAME run that just created them) had no such check and built them straight away. These
// scenarios lock in the fix: a FRESH judge-tier gate (gateChangeWorkOrders) now runs between
// processChange and any scheduling, and the engine itself (enrollFrd) refuses a still-DRAFT WO no matter
// which path let it reach the plan.
SCENARIOS.push({
  name: 'BL-0171a. change gate FAILS — the change-created FRD is left DRAFT, NOT built this run, and the engine reports it needs-owner instead of silently scheduling an ungated WO',
  args: { mode: 'pro', change: 'chg-bl0171' },
  responses: [
    { label: /^process-change:/, response: { done: true, affectedFrds: ['frd-bl0171-gate'], changeFile: 'chg-bl0171.md' } },
    { label: /^gate-change-wos:/, response: { results: [{ frd: 'frd-bl0171-gate', gated: false, failure: 'AC-01-002 sin cobertura de ningún WO' }] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, /^gate-change-wos:/)[0]
    t.ok(Boolean(gate), 'the fresh DR-100 gate agent ran for the change-created FRD')
    t.ok(gate && gate.opts.agentType === 'pandacorp:architect', 'the gate runs as a FRESH architect-tier agent, never processChange\'s own author (self-certification, constitution rule 4)')
    t.ok(hasLog(run, /frd-bl0171-gate.*did NOT pass the DR-100/), 'the engine logs clearly WHICH FRD failed the gate and why it is not building this run')
    t.ok(byLabel(run, 'plan').length === 0, 'the engine never even reaches the planner — an ungated change is never scheduled/built THIS run (the canary-d bug)')
    t.ok(byLabel(run, /^dispatch:/).length === 0, 'no wave ever dispatches the ungated work order')
    t.ok(run.result && run.result.blockedFrds && run.result.blockedFrds.length === 0, 'the pre-loop bail returns the standard "change not processed" shape (WS-D/D3), same contract as any other unprocessable change')
    t.ok(run.result && /no procesada/.test(run.result.note || ''), 'the run honestly reports the change as not processed, not as silently skipped')
  },
})
SCENARIOS.push({
  name: 'BL-0171b. change gate PASSES — a fresh architect-tier DR-100 gate runs (readiness+grounding+consistency), and the gated FRD builds normally this run',
  args: { mode: 'pro', change: 'chg-bl0171-ok' },
  plan: mkPlan([{
    frd: 'frd-bl0171-ok',
    deps: [],
    workOrders: [mkWo('wo-bl0171-ok-001', 'PLANNED', { frd: 'frd-bl0171-ok', artifacts: ['src/bl0171/**'] })],
  }]),
  responses: [
    { label: /^process-change:/, response: { done: true, affectedFrds: ['frd-bl0171-ok'], changeFile: 'chg-bl0171-ok.md' } },
    // gate-change-wos left UNSCRIPTED on purpose — exercises the harness's own happy-path DEFAULT
    // response (gated:true for every FRD named in the label), proving the default matches production's
    // "everything greens" shape and every pre-existing change-drain scenario keeps working unmodified.
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, /^gate-change-wos:/)[0]
    t.ok(Boolean(gate) && gate.label === 'gate-change-wos:frd-bl0171-ok', 'the gate runs, scoped to exactly the FRD folder(s) the change touched')
    t.ok(/READINESS/.test(gate.prompt) && /GROUNDING/.test(gate.prompt) && /CONSISTENCY/.test(gate.prompt), 'the gate prompt asserts all three DR-100 dimensions, mirroring architecture step 9/9b/9b-consistency')
    t.ok(/DRAFT.*ACTIVE/.test(gate.prompt), 'the gate prompt instructs the DRAFT→ACTIVE flip + evidence stamp on a pass, mirroring architecture step 9b2')
    t.ok(byLabel(run, 'plan').length === 1, 'a gated change proceeds into planning/build normally this run')
    t.ok(byLabel(run, /^dispatch:/).length >= 1, 'the now-ACTIVE FRD actually gets dispatched/built this run')
  },
})
SCENARIOS.push({
  name: 'BL-0171c. defense-in-depth — a WO whose plan entry reports docStatus: DRAFT is refused by the engine itself (enrollFrd), even OUTSIDE the change-gate path, and the FRD surfaces as needs-owner instead of vanishing silently',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-bl0171-draft',
    deps: [],
    workOrders: [mkWo('wo-bl0171-draft-001', 'PLANNED', { frd: 'frd-bl0171-draft', artifacts: ['src/bl0171d/**'], docStatus: 'DRAFT' })],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(hasLog(run, /frd-bl0171-draft.*still `status: DRAFT`/), 'the engine logs the refusal clearly, naming the WO and the FRD, and pointing back to /pandacorp:architecture')
    t.ok(byLabel(run, /^dispatch:/).length === 0, 'the DRAFT WO is never dispatched')
    t.ok(byLabel(run, /^(build|selftest):/).length === 0, 'no builder agent ever spawns for an ungated WO')
    t.ok(run.result && run.result.blockedFrds && run.result.blockedFrds.includes('frd-bl0171-draft'), 'the FRD surfaces as blocked (needs-owner) rather than silently reporting "0 to build" with no attribution')
    t.ok(run.result && run.result.blockedReasons && run.result.blockedReasons['frd-bl0171-draft'] === 'needs-owner', 'the block reason is needs-owner (route back to /pandacorp:architecture), never a generic error')
  },
})
SCENARIOS.push({
  name: 'BL-0171d. control — a WO with docStatus: ACTIVE (or no docStatus at all, the pre-BL-0171 legacy shape) builds normally; the defense-in-depth filter never widens beyond a literal DRAFT',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-bl0171-active',
    deps: [],
    workOrders: [
      mkWo('wo-bl0171-active-001', 'PLANNED', { frd: 'frd-bl0171-active', artifacts: ['src/bl0171a/**'], docStatus: 'ACTIVE' }),
      mkWo('wo-bl0171-active-002', 'PLANNED', { frd: 'frd-bl0171-active', artifacts: ['src/bl0171a2/**'] }),   // no docStatus at all — legacy WO
    ],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(!hasLog(run, /still `status: DRAFT`/), 'no refusal fires for an ACTIVE or unset docStatus')
    t.ok(byLabel(run, /^dispatch:/).length >= 1, 'both work orders are dispatched normally')
  },
})

// ---- BL-0172 ----
// Canary D also left docs/frds/*/frd.md and blueprint.md dirty, UNCOMMITTED, after a partial-close run:
// notify-end runs ${SYNC_ROLLUPS} (which rewrites those rollup documents DIRECTLY ON DISK, never through
// git — see syncRollupsUnlocked in plugin/runtime/build-state.mjs) but its only LATER staging
// instruction is ${RELEASE_LEASE}, whose own text is a literal "stage ONLY .pandacorp/status.yaml" —
// silently starving the rollup-doc commit. These scenarios lock in the fix: a dedicated commit
// instruction now sits between sync-rollups and RELEASE_LEASE in both the lean and legacy notify-end
// prompts.
SCENARIOS.push({
  name: 'BL-0172a. notify-end (lean, partial close) commits the rollup docs sync-rollups just rewrote, in their OWN commit, BEFORE RELEASE_LEASE\'s status.yaml-only commit',
  args: { mode: 'pro', maxAgents: 1 },   // forces an immediate agents-ceiling stop → the partial notify-end path, never the full release close-out
  plan: mkPlan([{ frd: 'frd-bl0172', deps: [], workOrders: [mkWo('wo-bl0172-001', 'PLANNED', { frd: 'frd-bl0172', artifacts: ['src/bl0172/**'] })] }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const end = byLabel(run, 'notify-end')[0]
    t.ok(Boolean(end), 'notify-end ran (the partial-close path — maxAgents:1 guarantees stopReason=\'agents\')')
    const syncIdx = end.prompt.indexOf('sync-rollups')
    const commitIdx = end.prompt.indexOf('stage ONLY those rollup documents')
    const releaseLeaseIdx = end.prompt.indexOf('quiesce Claude build lease')
    t.ok(syncIdx >= 0, 'notify-end still runs the governed sync-rollups writer (BL-0159)')
    t.ok(commitIdx >= 0 && commitIdx > syncIdx, 'BL-0172: a dedicated rollup-doc commit instruction now immediately follows the sync-rollups call')
    t.ok(releaseLeaseIdx >= 0 && releaseLeaseIdx > commitIdx, 'the rollup-doc commit happens BEFORE RELEASE_LEASE\'s own status.yaml-only commit — RELEASE_LEASE\'s literal "stage ONLY .pandacorp/status.yaml" can no longer starve it')
    t.ok(/frd\.md or blueprint\.md/.test(end.prompt), 'the new instruction names the exact rollup documents to stage (docs/frds/*/frd.md, blueprint.md)')
  },
})
SCENARIOS.push({
  name: 'BL-0172b. legacy notify-end (args.leanCloseOut:false) partial close ALSO gets the dedicated rollup-doc commit instruction right after sync-rollups',
  args: { mode: 'pro', maxAgents: 1, leanCloseOut: false },
  plan: mkPlan([{ frd: 'frd-bl0172b', deps: [], workOrders: [mkWo('wo-bl0172b-001', 'PLANNED', { frd: 'frd-bl0172b', artifacts: ['src/bl0172b/**'] })] }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const end = byLabel(run, 'notify-end')[0]
    t.ok(Boolean(end), 'legacy notify-end ran')
    const syncIdx = end.prompt.indexOf('sync-rollups')
    const commitIdx = end.prompt.indexOf('stage ONLY those rollup documents')
    t.ok(syncIdx >= 0 && commitIdx >= 0 && commitIdx > syncIdx, 'BL-0172: the legacy notify-end path also stages+commits the rollup docs right after sync-rollups, not left for a later status.yaml-only commit to silently skip')
  },
})

// ---- BL-0173 ----
// Canary D measured maxAgents:8, agentSpawned:11 BEFORE the first wave was even picked (process-change +
// plan + safe-point + foundation-gate overhead, opus-weighted) — remainingAgents collapsed to
// Math.max(1, 8-11)=1, and pickDisjointWave's own anti-deadlock floor admitted exactly 1 of 4 ready,
// disjoint WOs. The deferred-reason label for the other 3 was the SAME generic '(blocked:wave-cap)' a
// real P.wave count-cap or dependency stall would print — indistinguishable without reconstructing the
// cause by hand from the journal. This scenario replicates the report's own PROJECTED next-run shape
// (§3: precheck(1)+plan(3)+safe-point(1)+foundation-gate(3)=8, no process-change) and locks in the fix:
// pickDisjointWave now reports WHY it cut short, and the engine logs it loudly + labels deferred WOs
// accordingly.
SCENARIOS.push({
  name: 'BL-0173. a wave collapsed to 1 WO by pre-wave AGENT-BUDGET overhead is now distinguishable from a real count-cap/dependency cut — replica of the canary-d projected-next-run shape (maxAgents:8, 3 disjoint ready WOs, only 1 fits the remaining budget)',
  args: { mode: 'powerful', maxAgents: 8 },
  plan: mkPlan([
    { frd: 'frd-bl0173-a', deps: [], workOrders: [mkWo('wo-bl0173-a-001', 'PLANNED', { frd: 'frd-bl0173-a', artifacts: ['src/components/bl0173/A.tsx'] })] },
    { frd: 'frd-bl0173-b', deps: [], workOrders: [mkWo('wo-bl0173-b-001', 'PLANNED', { frd: 'frd-bl0173-b', artifacts: ['src/components/bl0173/B.tsx'] })] },
    { frd: 'frd-bl0173-c', deps: [], workOrders: [mkWo('wo-bl0173-c-001', 'PLANNED', { frd: 'frd-bl0173-c', artifacts: ['src/components/bl0173/C.tsx'] })] },
  ], { hasFrontend: true }),
  responses: [
    // BL-0124 fast path (leasedStatusOnly) — no judge-baseline spawn, matching the report's own §3
    // overhead arithmetic exactly (precheck 1 + plan 3 + safe-point 1 + foundation-gate 3 = 8).
    { label: 'baseline-precheck', response: { escalate: true, dirty: true, dirtyPaths: ['.pandacorp/status.yaml'], leaseValid: true } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(hasLog(run, /⚒ wave: 1 WO\(s\)/), 'the wave collapses to exactly 1 of the 3 ready, disjoint WOs — reproducing the canary-d shape')
    t.ok(hasLog(run, /⚠ oleada reducida a 1 WO por presupuesto de agentes agotado/), 'BL-0173: the engine now names the REAL reason — agent-budget exhaustion, never a silent, indistinguishable wave-cap')
    t.ok(hasLog(run, /remainingAgents=1/), 'the warning names the exact remaining-budget figure that forced the collapse')
    t.ok(hasLog(run, /Esto NO es un recorte por dependencias\/artefactos\/tope de conteo/), 'the warning explicitly rules out the other, already-documented cut reasons (deps/artifacts/P.wave)')
    t.ok(hasLog(run, /↻ deferred:.*\(blocked:agent-budget\)/), 'the two deferred-but-ready WOs are labeled agent-budget, not the generic wave-cap label the report found indistinguishable from a real stall')
    t.ok(!hasLog(run, /\(blocked:wave-cap\)/), 'no deferred WO is mislabeled wave-cap when the true cause is the agent budget, not the mode\'s P.wave count-cap')
  },
})
SCENARIOS.push({
  name: 'BL-0173 control. a real P.wave COUNT-cap cut still labels its deferred WOs wave-cap, unchanged (WP-09\'s own scenario, re-asserted here as the sibling-audit control for BL-0173)',
  args: { mode: 'pro' },   // P.wave=2, no maxAgents ceiling — this run's cut can ONLY be the count cap
  plan: mkPlan([{
    frd: 'frd-bl0173-ctrl',
    deps: [],
    workOrders: [
      mkWo('wo-bl0173-ctrl-001', 'PLANNED', { frd: 'frd-bl0173-ctrl', artifacts: ['src/bl0173ctrl/a/**'] }),
      mkWo('wo-bl0173-ctrl-002', 'PLANNED', { frd: 'frd-bl0173-ctrl', artifacts: ['src/bl0173ctrl/b/**'] }),
      mkWo('wo-bl0173-ctrl-003', 'PLANNED', { frd: 'frd-bl0173-ctrl', artifacts: ['src/bl0173ctrl/c/**'] }),
    ],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(hasLog(run, /⚒ wave: 2 WO\(s\)/), 'P.wave=2 caps the wave at 2, not 1 — the agent-budget floor never applies here (no maxAgents)')
    t.ok(hasLog(run, /↻ deferred:.*\(blocked:wave-cap\)/), 'the 3rd disjoint, ready WO is still labeled wave-cap — the count-cap label is UNCHANGED by the BL-0173 fix')
    t.ok(!hasLog(run, /oleada reducida a 1 WO por presupuesto de agentes/), 'the new agent-budget warning never fires for a genuine count-cap cut')
  },
})

// ---- BL-0174..0177 ----
// Speed-sprint close-out (canary D, wf_faf48b18-881, canary-d-frd02-forensics.md /
// canary-d-wave-investigation.md): four engine defects the frd-02 block and the maxAgents overshoot
// exposed, none of which any prior canary or scenario exercised.

// F1/BL-0174 — blockFrd used to keep only the first 200 chars of `failure`. A reviewer's prose that
// opens with praise for what passed ("WO-02-014 ... is CORRECT and must NOT be reverted. [...]") before
// naming the actual blocking cause hundreds of characters later got truncated to JUST the praise —
// progress.md then narrated a false "just needs your OK" story for a FRD that actually needed the owner
// to reconcile two stale acceptance criteria. The fix prefixes the FAILING traceability contract ids
// (when the caller has a `traceability` array in scope) and raises the cap to 400.
const bl0174TraceWithFails = validTraceability.map((e) =>
  ['requirement', 'acceptance-criterion'].includes(e.contractClass)
    ? { ...e, status: 'fail', contract: `${e.contractClass} fixture — real bug` }
    : e)
SCENARIOS.push({
  name: 'BL-0174a. blockFrd prefixes the FAILING traceability contract ids to `failure`, so a reviewer\'s praise-first prose never buries the real blocking cause',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-bl0174a', deps: [], workOrders: [mkWo('wo-bl0174a-001', 'PLANNED', { frd: 'frd-bl0174a', artifacts: ['src/bl0174a/**'] })] }]),
  responses: [
    {
      label: 'gate:frd-bl0174a',
      response: {
        green: false, reopen: [], blocked_reason: 'needs-owner',
        // praise-first, real cause at the very end — replica of canary D2's frd-02 verdict shape.
        failure: 'WO-bl0174a-001 (the only WO reviewed this cycle) is CORRECT and must NOT be reverted. The focused gate is GREEN and the implementation matches every reviewed acceptance criterion for this cycle. REAL CAUSE: AC-99-010.8 was never built in phases.ts.',
        traceability: bl0174TraceWithFails,
      },
    },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const stored = run.result && run.result.blockedFailures && run.result.blockedFailures['frd-bl0174a']
    t.ok(Boolean(stored), 'a failure text was stored')
    t.ok(stored && stored.startsWith('FAIL requirement fixture, acceptance-criterion fixture'), `F1/BL-0174: the stored text OPENS with the failing contract ids, not the reviewer's praise (got: ${JSON.stringify(stored)})`)
    t.ok(stored && /REAL CAUSE: AC-99-010\.8/.test(stored), 'F1/BL-0174: the actual blocking cause survives in the stored text (would have been cut by the old 200-char head-slice)')
    t.ok(stored && stored.length <= 400, 'F1/BL-0174: the stored text respects the new 400-char cap')
  },
})

SCENARIOS.push({
  name: 'BL-0174b. DOC LOCK-IN — the gate prompt\'s generic "can\'t pinpoint specific WOs" exit instructs `failure` to open with the blocking cause, context/praise after',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-bl0174b', deps: [], workOrders: [mkWo('wo-bl0174b-001', 'PLANNED', { frd: 'frd-bl0174b', artifacts: ['src/bl0174b/**'] })] }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-bl0174b')[0]
    t.ok(gate, 'the gate ran')
    t.ok(gate && /MUST open with ONE sentence naming what is RED/.test(gate.prompt), 'F1/BL-0174: the prompt requires `failure` to lead with the cause')
    t.ok(gate && /context or praise .* comes AFTER/.test(gate.prompt), 'F1/BL-0174: the prompt explicitly forbids leading with praise for what passed')
  },
})

// F2/BL-0175 — a reviewer that reaches a BLOCK verdict has usually already written adversarial test
// files into the (review-only) gate worktree; those never get ported (only a PASS does, via applyGate's
// testFiles), so they sit untracked. The next `ensureGateWorktree` reuse probe then sees a dirty tree and
// degrades C2 to the legacy synchronous gate path for the rest of the run (and forever after, since
// BL-0067 forbids deleting crash evidence) — exactly the state canary D2 found MC real's and canary C's
// own gate-worktrees already stuck in. persistGateBlock now salvages+cleans the exact reported paths.
SCENARIOS.push({
  name: 'BL-0175a. persist-block salvages the gate worktree\'s test-file evidence into .pandacorp/run/gate-evidence/ and cleans exactly those paths, so C2 stays reusable after a block',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-bl0175a', deps: [], workOrders: [mkWo('wo-bl0175a-001', 'PLANNED', { frd: 'frd-bl0175a', reopen_count: 3, artifacts: ['src/bl0175a/**'] })] }]),
  responses: [
    { label: 'gate:frd-bl0175a', response: { green: false, reopen: [], blocked_reason: 'needs-owner', failure: 'reopened 3x, gate not satisfiable autonomously', traceability: validTraceability } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const block = byLabel(run, 'persist-block:frd-bl0175a')[0]
    t.ok(Boolean(block), 'the classified block is persisted on main')
    t.ok(block && /gate-evidence\/\$\{frd\}|gate-evidence\/frd-bl0175a|gate-evidence\//.test(block.prompt), 'F2/BL-0175: the persist-block prompt salvages test files into .pandacorp/run/gate-evidence/')
    t.ok(block && /status --porcelain/.test(block.prompt), 'F2/BL-0175: the prompt inspects the gate worktree via git status --porcelain to find exactly what to salvage')
    t.ok(block && /clean -f --/.test(block.prompt), 'F2/BL-0175: the prompt cleans the EXACT reported paths (targeted clean, never a blanket clean/reset)')
    t.ok(block && /NEVER a blanket/.test(block.prompt), 'F2/BL-0175: the prompt explicitly forbids a blanket clean/reset — BL-0067 crash evidence elsewhere in the worktree must survive untouched')
  },
})

// F4/BL-0176 — the generic "can't pinpoint specific WOs" exit hardcoded review_end/GateVerdict to
// verdict:"fail" regardless of the blocked_reason the agent actually chose. Canary D2's frd-02 blocked
// needs-owner but the dashboard/track streams showed verdict:"fail" with no frd_end ever closing the
// review (persistGateBlock's alreadyTracked:true then suppressed a second, correct emission) — the exact
// H4 finding in canary-d-frd02-forensics.md §5. Now routed through emitGateOutcome('blocked', …) with the
// real blocked_reason threaded in as a %s the agent fills at runtime, same contract as the reopen exit's
// reopened-count %s.
SCENARIOS.push({
  name: 'BL-0176a. the generic can\'t-pinpoint exit now emits verdict:"blocked" (with frd_end and the real blocked_reason) — never a mislabeled "fail" with no frd_end',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-bl0176a', deps: [], workOrders: [mkWo('wo-bl0176a-001', 'PLANNED', { frd: 'frd-bl0176a', artifacts: ['src/bl0176a/**'] })] }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-bl0176a')[0]
    t.ok(gate, 'the gate ran')
    t.ok(gate && !/verdict":"fail"/.test(gate.prompt), 'F4/BL-0176: no more hardcoded verdict:"fail"')
    t.ok(gate && /"event":"GateVerdict"[^`]*"verdict":"blocked"[^`]*"blocked_reason":"%s"/.test(gate.prompt), 'F4/BL-0176: GateVerdict reports "blocked" with the blocked_reason filled in by the agent at runtime (%s, same contract as the reopened-count placeholder elsewhere)')
    t.ok(gate && /"kind":"frd_end","frd":"frd-bl0176a"/.test(gate.prompt), 'F4/BL-0176: frd_end now closes the review on this exit too — canary D2 never got one')
  },
})

// F5/BL-0177 — the loop-top agent-ceiling brake used to set stopReason:'agents' unconditionally the
// instant agentSpawned crossed maxAgents, even when the very spawn that crossed it also finished every
// queue (globalQueue/gateQueue/gatesInFlight/gateResults/convergeQueue all empty). Canary D2 reported
// "Paro por techo de agentes" for a run that, by the time the ceiling was re-checked, had nothing left to
// build or gate — cosmetically wrong, confirmed by canary-d-wave-investigation.md's own analysis. Now the
// brake only claims the 'agents' stop when real work remains; otherwise it falls through unlabeled
// (stopReason stays null = ran to completion) and the natural end-of-queue check closes the run honestly.
SCENARIOS.push({
  // maxAgents:17 = the exact cost-weighted total (haiku/sonnet=1, opus=3) through this trivial single-WO
  // build's SECOND safe-point: baseline-precheck(1)+baseline(3)+plan(3)+safe-point(1)+dispatch(1)+
  // build(1)+commit(1)+gate-worktree(1)+gate(3)+apply-gate(1)+safe-point(1) = 17 — the WO is already
  // built+gated+applied by the time that spawn runs, so the loop-top brake re-checks the ceiling with
  // every queue already empty, exactly the canary D2 shape (verified against this harness's own defaults;
  // a plan/response change here would need re-deriving this number).
  name: 'BL-0177a. the agent-ceiling brake reports stopReason:null (not \'agents\') when the crossing spawn also cleared every queue — nothing was actually cut off',
  args: { mode: 'pro', maxAgents: 17 },
  plan: mkPlan([{ frd: 'frd-bl0177a', deps: [], workOrders: [mkWo('wo-bl0177a-001', 'PLANNED', { frd: 'frd-bl0177a', artifacts: ['src/bl0177a/**'] })] }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(run.result && run.result.builtFrds.includes('frd-bl0177a'), 'the single FRD still verifies (the brake never blocks progress, only mislabels the stop)')
    t.ok(run.result && run.result.stopReason === null, `F5/BL-0177: no work remains once the only FRD is built+applied, so the run reports stopReason:null even though agentSpawned certainly crossed maxAgents:1 along the way (got ${run.result && run.result.stopReason})`)
  },
})
// Regression guard — the pre-existing 'agents' scenarios (lines ~357/385/421/1419) already prove the
// OTHER half unchanged: when real work genuinely remains queued at the ceiling, the brake still reports
// 'agents' and still stops. Not re-duplicated here; re-asserted by re-running the full suite (run-engine-tests.sh).

// ---- BL-0180 ----
// The WP-08 cage in applyGate told the agent to read the bare relative path
// `.pandacorp/run/gate-report.json`, which resolves against the agent's OWN cwd — the MAIN tree,
// since applyGate is documented to run "on the MAIN tree (no workFrom)". On the concurrent C2 gate
// path (harvestGateResults → applyGate(..., GATE_WORKTREE)) the report that actually certifies the
// verdict was written by the reviewer INSIDE the gate worktree, not on main; main's own report file
// (if any) belongs to an unrelated run (proposal 38 §5 L1, evidence: main's report was scope:"full"
// from an unrelated close-out while the worktree's was the gate's own scope:"since"). Confirmed live
// in the canary tree. Fixed: the cage now points at `${sourceDir}/.pandacorp/run/gate-report.json`
// whenever a sourceDir (the gate worktree) is given, and at the bare path only on the legacy
// sourceDir:null path (gate already ran in place on main).
SCENARIOS.push({
  name: 'BL-0180a. apply-gate WP-08 cage reads the GATE WORKTREE\'s report on the concurrent (C2) path, not main\'s',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-bl0180a',
    deps: [],
    workOrders: [mkWo('wo-bl0180a-001', 'PLANNED', { frd: 'frd-bl0180a', artifacts: ['src/bl0180a/**'] })],
  }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const apply = byLabel(run, /^apply-gate:/)[0]
    t.ok(apply, 'the serialized apply-gate ran (concurrent gate path, the default C2 flow)')
    // BL-0182 moved the report's durable home: the release step salvages the gate worktree's report into
    // the FRD's evidence dir (a later chained gate can overwrite the worktree copy before this apply reads it).
    // BL-0180's invariant — never main's own relative copy on the concurrent path — is what stays asserted.
    t.ok(apply && /gate-evidence\/frd-bl0180a\/gate-report\.json/.test(apply.prompt),
      `BL-0180/BL-0182: the cage must read the report the gate left behind (salvaged to its evidence dir), not a bare relative path — prompt: ${apply && apply.prompt.slice(0, 400)}`)
    t.ok(apply && !/read `\.pandacorp\/run\/gate-report\.json`/.test(apply.prompt), 'BL-0180: never main\'s own bare relative report on the concurrent path')
  },
})
SCENARIOS.push({
  name: 'BL-0180b. apply-gate WP-08 cage reads the bare main-tree path on the LEGACY path (sourceDir:null — the gate already ran in place)',
  args: { mode: 'pro' },
  plan: mkPlan([{
    frd: 'frd-bl0180b',
    deps: [],
    workOrders: [mkWo('wo-bl0180b-001', 'PLANNED', { frd: 'frd-bl0180b', artifacts: ['src/bl0180b/**'] })],
  }]),
  responses: [
    // force the reject → legacy on-main convergence ladder, then a clean re-verify, so the FRD
    // converges via gateConverge (sourceDir:null) instead of the concurrent applyGate.
    { label: /^gate:/, response: { green: false, reopen: ['wo-bl0180b-001'], recommendation: 'patch', confidence: 'high' }, times: 1 },
    { prefix: 'patch:', response: { done: true } },
    { prefix: 'verify-patch:', response: { green: true } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const apply = byLabel(run, /^apply-gate:/)[0]
    t.ok(apply, 'apply-gate ran via the legacy patch-then-verify convergence on main')
    t.ok(apply && /(?<!gate-worktree\/)\.pandacorp\/run\/gate-report\.json/.test(apply.prompt),
      `BL-0180: on the legacy path (sourceDir:null) the cage keeps reading the bare main-tree path — prompt: ${apply && apply.prompt.slice(0, 400)}`)
    t.ok(apply && !/gate-worktree\/\.pandacorp\/run\/gate-report\.json/.test(apply.prompt),
      'BL-0180: no regression — the legacy path must NOT be pointed at a worktree path that does not apply to it')
  },
})

// ---- BL-0182..0184 ----
// The three C2 (DR-118) defects the proposal-38 red-team confirmed by reading code (X1-X3):
//  BL-0182 — every verdict left the gate worktree dirty and the NEXT chained gate probed it BEFORE anything
//            cleaned it → the run fell to the legacy synchronous path (canary D2's exact shape).
//  BL-0183 — same-pin gates skipped the probe (and its clean check), so a gate could run over another FRD's
//            untracked tests, which vitest `--changed` executes; a dirty tree must fail LOUD with its paths.
//  BL-0184 — a C2 reject stranded the reviewer's RED tests in the worktree; the patch + verifyPatched ran on
//            main without them (DR-080). Now they are ported, sha256-pinned and run explicitly by path.
// A STATEFUL worktree model: the gate writes its test file into `dirt`; the gate-worktree probe refuses a
// dirty tree (like the real `status --porcelain` check); the release salvages + cleans `dirt`.
function c2WorktreeModel({ releaseLeaves = [] } = {}) {
  const dirt = new Set()
  return {
    dirt,
    probe: () => (dirt.size
      ? { ok: false, failure: 'gate worktree is dirty, orphaned, unregistered, or ambiguous; evidence preserved', dirty: [...dirt].map((p) => `?? ${p}`) }
      : { ok: true, created: false }),
    release: () => {
      const salvaged = [...dirt].filter((p) => !releaseLeaves.includes(p)).map((p) => ({ path: p, status: 'untracked', sha256: `sha-${p}` }))
      for (const s of salvaged) dirt.delete(s.path)
      return { salvaged, remaining: [...dirt].map((p) => `?? ${p}`) }
    },
  }
}
// Two FRDs at DIFFERENT pins: frd-*-a is gate-ready after wave 1; frd-*-b (a dep chain) after wave 2. Distinct
// commit shas → distinct pins → frd-b's chained acquisition MUST spawn the probe (the clean check).
const twoPinPlan = (tag) => mkPlan([
  { frd: `frd-${tag}-a`, deps: [], workOrders: [mkWo(`wo-${tag}-a1`, 'PLANNED', { frd: `frd-${tag}-a`, artifacts: [`src/${tag}a/**`] })] },
  { frd: `frd-${tag}-b`, deps: [], workOrders: [
    mkWo(`wo-${tag}-b1`, 'PLANNED', { frd: `frd-${tag}-b`, artifacts: [`src/${tag}b1/**`] }),
    mkWo(`wo-${tag}-b2`, 'PLANNED', { frd: `frd-${tag}-b`, artifacts: [`src/${tag}b2/**`], deps: [`wo-${tag}-b1`] }),
  ] },
])
const distinctCommitShas = { prefix: 'commit:', response: (call) => ({ committed: 1, sha: `sha${call.index}` }) }
for (const [verdict, gateAResponse] of [
  ['pass', { green: true }],
  ['reopen', { green: false, reopen: ['wo-182VV-a1'], findings: [{ wo: 'wo-182VV-a1', finding: 'off-by-one at src/182VVa/x.ts:3', failingTest: 'src/182VVa/_tests/a.reviewer.test.ts', files: ['src/182VVa/x.ts'] }] }],
  ['blocked', { green: false, reopen: [], blocked_reason: 'needs-owner', failure: 'the AC contradicts the blueprint — the owner must decide' }],
  ['crash', null],
]) {
  const tag = `182${verdict.slice(0, 2)}`
  const wt = c2WorktreeModel()
  const testPath = `src/${tag}a/_tests/a.reviewer.test.ts`
  // a crashing reviewer has usually written its file before dying — the response fn dirties, then throws
  const gateA = verdict === 'crash'
    ? { label: `gate:frd-${tag}-a`, times: 1, response: () => { wt.dirt.add(testPath); throw new Error('terminal API error mid-review') } }
    : { label: `gate:frd-${tag}-a`, times: 1, response: () => { wt.dirt.add(testPath); return JSON.parse(JSON.stringify(gateAResponse).replace(/182VV/g, tag)) } }
  SCENARIOS.push({
    name: `BL-0182a-${verdict}. two CHAINED C2 gates at different pins — a ${verdict.toUpperCase()} verdict on the first leaves the worktree clean, so the SECOND gate stays concurrent (never legacy)`,
    args: { mode: 'pro' },
    plan: twoPinPlan(tag),
    responses: [
      distinctCommitShas,
      gateA,
      { label: 'gate-worktree', response: () => wt.probe() },
      { prefix: 'gate-release:', response: () => wt.release() },
    ],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const gA = byLabel(run, `gate:frd-${tag}-a`)[0]
      const rel = byLabel(run, `gate-release:frd-${tag}-a`)[0]
      const gB = byLabel(run, `gate:frd-${tag}-b`)[0]
      t.ok(gA && /GATE WORKTREE/.test(gA.prompt), 'the first gate ran concurrently in the pinned worktree')
      t.ok(gB && /GATE WORKTREE/.test(gB.prompt), `BL-0182: the SECOND chained gate still runs in the C2 worktree after a ${verdict} — not the legacy synchronous path on main`)
      t.ok(!hasLog(run, /legacy synchronous gate path/i), 'BL-0182: no fallback to the legacy synchronous gate path this run')
      t.ok(rel && gA && rel.index > gA.index, `BL-0182: the worktree RELEASE ran right after the first gate, whatever its verdict (${verdict})`)
      const probes = byLabel(run, 'gate-worktree')
      t.ok(Boolean(rel && gB && probes.length >= 2 && probes.some((p) => p.index > rel.index && p.index < gB.index)), 'the second gate (a different pin) probed the worktree AFTER the release, not before it')
      t.ok(wt.dirt.size === 0, `the worktree ends clean (left: ${[...wt.dirt].join(', ')})`)
      t.ok(rel && /--untracked-files=all/.test(rel.prompt) && /gate-evidence\/frd-/.test(rel.prompt) && /clean -f --/.test(rel.prompt) && /NEVER a blanket/.test(rel.prompt) && /remaining/.test(rel.prompt),
        'the release salvages every file (--untracked-files=all) into .pandacorp/run/gate-evidence/<frd>/, cleans EXACTLY those paths (never a blanket clean) and re-lists as its postcondition')
      if (verdict === 'pass') {
        const apply = byLabel(run, `apply-gate:frd-${tag}-a`)[0]
        t.ok(apply && new RegExp(`gate-evidence/frd-${tag}-a/<path>`).test(apply.prompt) && apply.prompt.includes(testPath) && /rev-parse --show-toplevel/.test(apply.prompt),
          'a PASS ports the SALVAGED test file from the evidence dir to the repo-root-relative path on main (the worktree is already clean)')
      }
      if (verdict === 'reopen') t.ok(byLabel(run, `port-reviewer-tests:frd-${tag}-a`).length === 1, 'the reopen\'s stranded test was ported onto main for the patch ladder (BL-0184)')
      t.ok(run.result && run.result.builtFrds.includes(`frd-${tag}-b`), 'the second FRD verifies via the concurrent gate')
    },
  })
}
// BL-0183a — SAME pin: before the fix the second acquisition took the no-spawn fast path and gated over the
// first reviewer's leftovers. When the release cannot prove the tree clean, the next gate must re-probe and
// refuse LOUDLY (with the path) — never run a gate over a dirty worktree in silence.
{
  const wt = c2WorktreeModel({ releaseLeaves: ['src/183a/_tests/stuck.reviewer.test.ts'] })
  SCENARIOS.push({
    name: 'BL-0183a. same-pin chained gates — a release that leaves a path behind makes the NEXT gate re-probe and fail LOUD with that path (no silent fast path over a dirty tree)',
    args: { mode: 'pro' },
    plan: mkPlan([
      { frd: 'frd-183a-x', deps: [], workOrders: [mkWo('wo-183a-x1', 'PLANNED', { frd: 'frd-183a-x', artifacts: ['src/183ax/**'] })] },
      { frd: 'frd-183a-y', deps: [], workOrders: [mkWo('wo-183a-y1', 'PLANNED', { frd: 'frd-183a-y', artifacts: ['src/183ay/**'] })] },
    ]),
    responses: [
      { label: /^gate:frd-183a-/, times: 1, response: () => { wt.dirt.add('src/183a/_tests/stuck.reviewer.test.ts'); return { green: true } } },
      { label: 'gate-worktree', response: () => wt.probe() },
      { prefix: 'gate-release:', response: () => wt.release() },
    ],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const gates = byLabel(run, /^gate:frd-183a-/)
      t.ok(gates.length === 2, `both FRDs were gated (got ${gates.length})`)
      const [first, second] = gates
      t.ok(first && /GATE WORKTREE/.test(first.prompt), 'the first gate ran in the worktree')
      const probes = byLabel(run, 'gate-worktree')
      t.ok(probes.length === 2, `BL-0183: the same-pin second acquisition RE-PROBED instead of the silent fast path (probes: ${probes.length})`)
      t.ok(hasLog(run, /REFUSING to gate over a DIRTY gate worktree[\s\S]*stuck\.reviewer\.test\.ts/), 'BL-0183: the refusal is LOUD and names the dirty path')
      t.ok(second && !/GATE WORKTREE/.test(second.prompt), 'BL-0183: the second gate did NOT run over the dirty worktree — it ran on the quiet main tree (legacy)')
      t.ok(run.result && run.result.builtFrds.length === 2, 'both FRDs still verify (the fallback is honest, never a skip)')
    },
  })
}
// BL-0183b — a FOREIGN untracked file already in the gate worktree (another FRD's / another run's test) at the
// very first probe: the probe lists it with --untracked-files=all and the engine refuses LOUDLY with the path.
SCENARIOS.push({
  name: 'BL-0183b. a foreign untracked file in the gate worktree → the probe fails LOUD naming the path, and the gate runs on main (never over it)',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-183b', deps: [], workOrders: [mkWo('wo-183b-001', 'PLANNED', { frd: 'frd-183b', artifacts: ['src/183b/**'] })] }]),
  responses: [
    { label: 'gate-worktree', response: { ok: false, failure: 'gate worktree is dirty, orphaned, unregistered, or ambiguous; evidence preserved', dirty: ['?? src/other/_tests/foreign.reviewer.test.ts'] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const wt = byLabel(run, 'gate-worktree')[0]
    t.ok(wt && /status --porcelain=v1 --untracked-files=all/.test(wt.prompt) && /dirty: \[every line/.test(wt.prompt), 'the probe lists every untracked file individually and returns them as `dirty`')
    t.ok(hasLog(run, /REFUSING to gate over a DIRTY gate worktree.*src\/other\/_tests\/foreign\.reviewer\.test\.ts/), 'BL-0183: the engine fails LOUD with the foreign path')
    const gate = byLabel(run, 'gate:frd-183b')[0]
    t.ok(gate && !/GATE WORKTREE/.test(gate.prompt), 'the gate ran on main, not over the dirty worktree')
    t.ok(byLabel(run, /^gate-release:/).length === 0, 'no release on the legacy path (nothing ran in the worktree)')
  },
})
// BL-0183c — the gate command itself runs the reviewer's tests BY PATH, not via `--changed`.
SCENARIOS.push({
  name: 'BL-0183c. the gate prompt runs the reviewer\'s own adversarial tests explicitly by path (never trusting vitest --changed to collect them)',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-183c', deps: [], workOrders: [mkWo('wo-183c-001', 'PLANNED', { frd: 'frd-183c', artifacts: ['src/183c/**'] })] }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-183c')[0]
    t.ok(gate && /RUN YOUR OWN ADVERSARIAL TESTS EXPLICITLY, BY PATH/.test(gate.prompt) && /pnpm vitest run <path>/.test(gate.prompt) && /--changed/.test(gate.prompt),
      'the gate step names the --changed hazard and runs every adversarial test file by path')
  },
})
// BL-0184a — a C2 REOPEN: the reviewer's RED test (salvaged by the release) is ported onto main BEFORE the
// patch, the patch is told it may not touch it, its hash is checked BEFORE the verifier, and the verifier
// runs it explicitly by path.
const REOPEN_184 = (tag) => ({ green: false, reopen: [`wo-${tag}-001`], findings: [{ wo: `wo-${tag}-001`, finding: `wrong total at src/${tag}/sum.ts:7`, failingTest: `src/${tag}/_tests/sum.reviewer.test.ts`, files: [`src/${tag}/sum.ts`] }] })
const reopenPlan184 = (tag) => mkPlan([{ frd: `frd-${tag}`, deps: [], workOrders: [mkWo(`wo-${tag}-001`, 'PLANNED', { frd: `frd-${tag}`, artifacts: [`src/${tag}/**`] })] }])
const releaseWith184 = (tag) => ({ prefix: 'gate-release:', times: 1, response: { salvaged: [{ path: `mission-control/src/${tag}/_tests/sum.reviewer.test.ts`, status: 'untracked', sha256: 'aaa111' }, { path: `mission-control/notes-${tag}.md`, status: 'untracked', sha256: 'bbb222' }], remaining: [] } })
SCENARIOS.push({
  name: 'BL-0184a. C2 reopen — the reviewer\'s RED test is ported to main before the patch, hash-checked before the verifier, and verifyPatched runs it explicitly by path',
  args: { mode: 'pro' },
  plan: reopenPlan184('184a'),
  responses: [
    { label: 'gate:frd-184a', times: 1, response: REOPEN_184('184a') },
    releaseWith184('184a'),
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const path = 'mission-control/src/184a/_tests/sum.reviewer.test.ts'
    const port = byLabel(run, 'port-reviewer-tests:frd-184a')[0]
    const patch = byLabel(run, 'patch:frd-184a')[0]
    const hash = byLabel(run, 'reviewer-test-hash:frd-184a')[0]
    const verify = byLabel(run, 'verify-patch:frd-184a')[0]
    t.ok(port && patch && port.index < patch.index, 'BL-0184: the reviewer\'s test was PORTED onto main BEFORE the patch')
    t.ok(port && port.prompt.includes(path) && /gate-evidence\/frd-184a/.test(port.prompt) && /rev-parse --show-toplevel/.test(port.prompt) && /shasum -a 256/.test(port.prompt), 'the port copies from the evidence dir to the SAME repo-root-relative path and hashes the copy')
    t.ok(port && !port.prompt.includes('notes-184a.md'), 'a non-test file the gate left behind is kept as evidence only — never ported')
    t.ok(patch && patch.prompt.includes(path) && /may NOT edit, move, rename, skip, delete or re-type them/.test(patch.prompt), 'DR-080: the patch prompt names the reviewer test and forbids editing it')
    t.ok(hash && verify && patch.index < hash.index && hash.index < verify.index, 'the engine checks the reviewer test\'s sha256 AFTER the patch and BEFORE the independent verifier')
    t.ok(hash && /EXPECTED \(JSON\): .*aaa111/.test(hash.prompt), 'the integrity check pins the hash the release recorded')
    t.ok(verify && verify.prompt.includes(path) && /pnpm vitest run "\$\(git rev-parse --show-toplevel\)\/<path>"/.test(verify.prompt), 'BL-0184: verifyPatched runs the reviewer\'s test EXPLICITLY by path')
    t.ok(run.result && run.result.builtFrds.includes('frd-184a'), 'the FRD verifies through the patch ladder')
  },
})
// BL-0184b — the patch ALTERED the reviewer's test: the engine's hash check fails the verification before the
// certifier is ever spawned, the originals are restored, and the ladder falls to revert (never VERIFIED).
SCENARIOS.push({
  name: 'BL-0184b. the reviewer\'s test hash changed after the patch → DR-080 breach: no verifier spawn, not VERIFIED, revert',
  args: { mode: 'pro' },
  plan: reopenPlan184('184b'),
  responses: [
    { label: 'gate:frd-184b', times: 1, response: REOPEN_184('184b') },
    releaseWith184('184b'),
    { label: 'reviewer-test-hash:frd-184b', response: { hashes: [{ path: 'mission-control/src/184b/_tests/sum.reviewer.test.ts', sha256: 'tampered999' }] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'reviewer-test-hash:frd-184b').length >= 1, 'the integrity check ran')
    t.ok(byLabel(run, 'verify-patch:frd-184b').length === 0, 'DR-080: the certifier was NEVER spawned over a tampered reviewer test')
    t.ok(hasLog(run, /DR-080 BREACH[\s\S]*sum\.reviewer\.test\.ts[\s\S]*tampered999/), 'the breach is logged loudly with the path and both hashes')
    const hash = byLabel(run, 'reviewer-test-hash:frd-184b')[0]
    t.ok(hash && /RESTORE the reviewer's original/.test(hash.prompt), 'the check restores the reviewer\'s original on a mismatch')
    t.ok(byLabel(run, 'revert:frd-184b').length === 1, 'the tampered patch falls to the revert path')
    t.ok(!run.result || !run.result.builtFrds.includes('frd-184b') || byLabel(run, /^gate:frd-184b/).length > 1, 'never VERIFIED off the tampered patch (only a fresh re-gate may verify it)')
  },
})
// BL-0184c — the port itself fails (a file missing from the evidence dir): never patch blind; re-gate on main.
SCENARIOS.push({
  name: 'BL-0184c. the reviewer\'s tests cannot be ported → no blind patch; the FRD re-gates on the MAIN tree',
  args: { mode: 'pro' },
  plan: reopenPlan184('184c'),
  responses: [
    { label: 'gate:frd-184c', times: 1, response: REOPEN_184('184c') },
    releaseWith184('184c'),
    { label: 'port-reviewer-tests:frd-184c', response: { hashes: [{ path: 'mission-control/src/184c/_tests/sum.reviewer.test.ts', sha256: null }] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gates = byLabel(run, 'gate:frd-184c')
    const port = byLabel(run, 'port-reviewer-tests:frd-184c')[0]
    t.ok(hasLog(run, /could not port the reviewer's test files onto main.*missing/), 'the failed port is logged loudly')
    t.ok(Boolean(gates.length === 2 && port && gates[1].index > port.index && !/GATE WORKTREE/.test(gates[1].prompt)), 'the FRD re-gates on the MAIN tree after the failed port')
    t.ok(gates.length === 2 && !byLabel(run, 'patch:frd-184c').some((p) => p.index < gates[1].index), 'no patch ran without the reviewer\'s tests (DR-080)')
  },
})
// BL-0184d — the gate-test repair is the tests' OWNER (BL-0001): its edits re-pin the hashes, never a false breach.
SCENARIOS.push({
  name: 'BL-0184d. a gate-test repair (the reviewer, the tests\' owner) edits a pinned test → hashes re-pinned, verification proceeds',
  args: { mode: 'pro' },
  plan: reopenPlan184('184d'),
  responses: [
    { label: 'gate:frd-184d', times: 1, response: REOPEN_184('184d') },
    releaseWith184('184d'),
    { label: 'patch:frd-184d', response: { green: false, cause: 'gate-test-defective', defectiveTests: [{ path: 'mission-control/src/184d/_tests/sum.reviewer.test.ts', why: 'asserts a rounding the AC does not require' }] } },
    { label: 'reviewer-test-hash:frd-184d', response: { hashes: [{ path: 'mission-control/src/184d/_tests/sum.reviewer.test.ts', sha256: 'repaired777' }] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const hash = byLabel(run, 'reviewer-test-hash:frd-184d')[0]
    t.ok(hash && /Record only/.test(hash.prompt), 'after the owner\'s repair the check records (re-pins) instead of restoring')
    t.ok(!hasLog(run, /DR-080 BREACH/), 'no false DR-080 breach for the owner\'s own repair')
    t.ok(byLabel(run, 'verify-patch:frd-184d').length === 1 && run.result && run.result.builtFrds.includes('frd-184d'), 'the independent verifier ran and the FRD verified')
  },
})

// ---- BL-0178 ----
// Pre-existing drift policy (a*) with a DIFFERENTIAL proof (proposal 38, red-team addendum §A4). The reviewer
// may only PROPOSE drift (`claim: "preexisting"` + `evidence_test` probe); a MECH spawn runs drift-proof.mjs
// (its real git/worktree/vitest mechanics are proven in test-drift-proof.mjs against a real repo) and the
// ENGINE applies the predicate to the facts it reports — mocked here as the script's JSON line. T1–T8 are the
// addendum's tests; the rest pin the rollback switch, the FRD-03 verifyPatched hole and the oracle stamp.
const b178Slug = (id) => id.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const b178Probe = (frd, id) => `.pandacorp/run/drift-probes/${frd}/${b178Slug(id)}.drift-probe.ts`
const b178Run = (s) => (s === 'fail'
  ? { parsed: true, exit: 1, total: 1, failed: 1, passed: 0, suiteErrors: 0 }
  : s === 'pass'
    ? { parsed: true, exit: 0, total: 1, failed: 0, passed: 1, suiteErrors: 0 }
    : { parsed: true, exit: 1, total: 0, failed: 0, passed: 0, suiteErrors: 1 })   // 'load' — the module never loaded
// The drift-proof.mjs stdout the MECH hands back verbatim. `probes`: [[contractId, headStates, baseStates]].
const b178Proof = ({ frd, wos, owned, probes, baseValid = true }) => ({ output: JSON.stringify({
  ok: true, version: 1, frd, pin: 'pin0000aa', base: 'base000bb', baseValid, baseReason: baseValid ? '' : 'wo is already IN_REVIEW at last_green_sha',
  owned: Object.fromEntries(wos.map((w) => [`docs/frds/${frd}/work-orders/${w}.md`, { sourceRequirements: owned, ids: owned }])),
  probes: probes.map(([id, head, base]) => ({ path: b178Probe(frd, id), stored: `.pandacorp/run/gate-evidence/${frd}/drift/${b178Slug(id)}.drift-probe.ts`, head: head.map(b178Run), base: base.map(b178Run) })),
  cleanup: { ok: true, leftover: [] },
}) })
const b178Claim = (frd, id, text, direction = 'code') => ({ contract: `${id} — ${text}`, contractClass: 'acceptance-criterion', status: 'fail', claim: 'preexisting', evidence_test: b178Probe(frd, id), direction, tests: [] })
const b178Trace = (...extra) => [...validTraceability, ...extra]
const b178Record = { prefix: 'drift-record:', response: (call) => ({ output: JSON.stringify({ ok: true, written: [(call.prompt.match(/drift record for (\S+)\./) || [])[1] + '-drift.md'], skipped: [] }) }) }
const b178Plan = (frd, wo, extra = {}) => mkPlan([{ frd, deps: [], workOrders: [mkWo(wo, 'PLANNED', { frd, artifacts: [`src/${frd}/**`], ...extra })] }])

// T1 — shared-helper regression: WO-A breaks an OLD contract through a shared helper; the reviewer mislabels it
// drift. Probe green at last_green, red at the pin → a REGRESSION → reopened patch-first, never a card.
SCENARIOS.push({
  name: 'BL-0178 T1. shared-helper regression labelled "pre-existing" → probe passes at last_green → cycle fault, reopen patch-first, NO card',
  args: { mode: 'pro' },
  plan: b178Plan('frd-b178-t1', 'wo-b178t1-001'),
  responses: [
    { label: 'gate:frd-b178-t1', times: 1, response: { green: true, testFiles: [], traceability: b178Trace(b178Claim('frd-b178-t1', 'AC-91-003.1', 'old AC owned by a VERIFIED WO')) } },
    { prefix: 'drift-proof:', response: b178Proof({ frd: 'frd-b178-t1', wos: ['wo-b178t1-001'], owned: ['REQ-91-001'], probes: [['AC-91-003.1', ['fail', 'fail'], ['pass', 'pass']]] }) },
    b178Record,
    { prefix: 'verify-patch:', response: { green: true, inheritedResolved: [{ contract: 'AC-91-003.1 — old AC owned by a VERIFIED WO', pass: true, tests: ['src/frd-b178-t1/_tests/ac-91-003-1.test.ts'] }] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'drift-proof:frd-b178-t1').length === 1, 'the differential proof ran once')
    t.ok(byLabel(run, /^drift-record:/).length === 0, 'NO drift card for a regression the cycle caused')
    const patch = byLabel(run, 'patch:frd-b178-t1')[0]
    t.ok(patch && /AC-91-003\.1/.test(patch.prompt) && /regression/.test(patch.prompt), 'the patcher gets the contract as a regression finding')
    t.ok(patch && /git diff <last_green_sha>\.\.HEAD/.test(patch.prompt) && /shared helper/.test(patch.prompt), 'the patcher is pointed at the whole base..pin diff (the culprit may be a shared helper)')
    t.ok(patch && /gate-evidence\/frd-b178-t1\/drift\/ac-91-003-1\.drift-probe\.ts/.test(patch.prompt), 'the reviewer\'s probe is handed over as the RED-proven failing test')
    const vp = byLabel(run, 'verify-patch:frd-b178-t1')[0]
    t.ok(vp && /INHERITED OPEN CONTRACTS/.test(vp.prompt) && /AC-91-003\.1/.test(vp.prompt), 'verifyPatched inherits the unproven claim as an open contract')
    t.ok(hasLog(run, /AC-91-003\.1 is a CYCLE FAULT \(regression/), 'logged as a regression cycle fault')
    t.ok(run.result && run.result.builtFrds.includes('frd-b178-t1'), 'VERIFIED only after the patch proves the contract closed')
  },
})

// T2 — genuine legacy drift inside a file the cycle touched: the predicate is FILE-AGNOSTIC by construction
// (no diff/path input exists anywhere in it), so touching the file can't turn legacy drift into a revert.
SCENARIOS.push({
  name: 'BL-0178 T2. legacy drift (probe red at pin AND last_green, contract not owned) → WO VERIFIED + 1 draft card + FRD drift frontmatter, NO reopen',
  args: { mode: 'pro' },
  plan: b178Plan('frd-b178-t2', 'wo-b178t2-001'),
  responses: [
    { label: 'gate:frd-b178-t2', response: { green: true, testFiles: ['src/frd-b178-t2/_tests/x.reviewer.test.ts'], traceability: b178Trace(b178Claim('frd-b178-t2', 'REQ-92-001', 'ACTIVE_PHASES must exclude architecture')) } },
    { prefix: 'drift-proof:', response: b178Proof({ frd: 'frd-b178-t2', wos: ['wo-b178t2-001'], owned: ['REQ-92-007'], probes: [['REQ-92-001', ['fail', 'fail'], ['fail', 'fail']]] }) },
    b178Record,
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const proof = byLabel(run, 'drift-proof:frd-b178-t2')[0]
    t.ok(proof && proof.opts.agentType === 'pandacorp:mech' && proof.opts.model === 'haiku', 'the proof runs on the cheap mechanical agent (MECH) — it never judges')
    t.ok(proof && /drift-proof\.mjs' prove/.test(proof.prompt) && /--source '[^']*gate-worktree'/.test(proof.prompt), 'the proof reads the probe where the concurrent gate wrote it (the gate worktree)')
    t.ok(proof && !/--diff|--changed|name-only/.test(proof.prompt), 'T2: nothing in the decision is keyed on which files the cycle touched')
    const rec = byLabel(run, 'drift-record:frd-b178-t2')
    t.ok(rec.length === 1 && /REQ-92-001/.test(rec[0].prompt) && /gate-evidence\/frd-b178-t2\/drift\//.test(rec[0].prompt), 'exactly one draft card, carrying the preserved probe')
    t.ok(byLabel(run, /^(patch|revert|repair):/).length === 0, 'NO patch, NO revert, NO repair — the correct WO is not touched')
    const apply = byLabel(run, 'apply-gate:frd-b178-t2')[0]
    t.ok(apply && /drift: \[REQ-92-001\]/.test(apply.prompt), 'the certifying landing writes drift: [REQ-92-001] into the FRD frontmatter')
    t.ok(run.result && run.result.builtFrds.includes('frd-b178-t2') && !run.result.blockedFrds.includes('frd-b178-t2'), 'the FRD lands VERIFIED')
  },
})

// T3 — a probe that imports a symbol the cycle introduced is a LOAD error at base: not proof of anything. The
// addendum's static fallback card (madge import-closure) is NOT implemented — an unproven claim is a cycle
// fault (fail-closed). The load-bearing half of T3 (never classified pre-existing) is what this asserts.
SCENARIOS.push({
  name: 'BL-0178 T3. probe unloadable at last_green → unproven → cycle fault (never "red at base ⇒ pre-existing"), NO card',
  args: { mode: 'pro' },
  plan: b178Plan('frd-b178-t3', 'wo-b178t3-001'),
  responses: [
    { label: 'gate:frd-b178-t3', times: 1, response: { green: true, testFiles: [], traceability: b178Trace(b178Claim('frd-b178-t3', 'AC-93-002.1', 'uses a symbol this cycle added')) } },
    { prefix: 'drift-proof:', response: b178Proof({ frd: 'frd-b178-t3', wos: ['wo-b178t3-001'], owned: ['REQ-93-009'], probes: [['AC-93-002.1', ['fail', 'fail'], ['load', 'load']]] }) },
    { prefix: 'verify-patch:', response: { green: true, inheritedResolved: [{ contract: 'AC-93-002.1 — uses a symbol this cycle added', pass: true, tests: ['t.test.ts'] }] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^drift-record:/).length === 0, 'NO card — a load error at base proves nothing')
    t.ok(hasLog(run, /AC-93-002\.1 is a CYCLE FAULT \(cycle-fault: the probe is load-error at last_green_sha/), 'the reason names the load error at last green')
    t.ok(byLabel(run, 'patch:frd-b178-t3').length === 1, 'routed patch-first like any cycle fault')
  },
})

// T4 — a contract a reviewed WO OWNS is never pre-existing, even if its probe is red at both shas.
SCENARIOS.push({
  name: 'BL-0178 T4. owned contract (source_requirements) labelled drift → cycle fault even with a probe red at both shas',
  args: { mode: 'pro' },
  plan: b178Plan('frd-b178-t4', 'wo-b178t4-001'),
  responses: [
    { label: 'gate:frd-b178-t4', times: 1, response: { green: true, testFiles: [], traceability: b178Trace(b178Claim('frd-b178-t4', 'AC-94-002.3', 'the WO was supposed to build this')) } },
    { prefix: 'drift-proof:', response: b178Proof({ frd: 'frd-b178-t4', wos: ['wo-b178t4-001'], owned: ['REQ-94-002'], probes: [['AC-94-002.3', ['fail', 'fail'], ['fail', 'fail']]] }) },
    { prefix: 'verify-patch:', response: { green: true, inheritedResolved: [{ contract: 'AC-94-002.3 — the WO was supposed to build this', pass: true, tests: ['t.test.ts'] }] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^drift-record:/).length === 0, 'NO card for an owned contract')
    t.ok(hasLog(run, /AC-94-002\.3 is owned by a reviewed work order/), 'the reason names ownership (REQ-94-002 owns AC-94-002.3)')
    t.ok(byLabel(run, 'patch:frd-b178-t4').length === 1, 'reopened patch-first')
  },
})

// T5 — cross-FRD regression. The culprit WO sits in a SIBLING FRD of the same wave. Madge attribution to the
// sibling is NOT implemented (stated in the engine); what holds: the FRD whose contract regressed can never
// land VERIFIED over it — its verifier must prove the inherited contract closed, and a verifier that doesn't is
// refused.
SCENARIOS.push({
  name: 'BL-0178 T5. cross-FRD regression → the regressed FRD cannot certify over it (verifier without proof refused); sibling attribution out of scope',
  args: { mode: 'pro' },
  plan: mkPlan([
    { frd: 'frd-b178-t5a', deps: [], workOrders: [mkWo('wo-b178t5a-001', 'PLANNED', { frd: 'frd-b178-t5a', artifacts: ['src/t5a/**'] })] },
    { frd: 'frd-b178-t5b', deps: [], workOrders: [mkWo('wo-b178t5b-001', 'PLANNED', { frd: 'frd-b178-t5b', artifacts: ['src/lib/shared/**'] })] },
  ]),
  responses: [
    { label: 'gate:frd-b178-t5a', times: 1, response: { green: true, testFiles: [], traceability: b178Trace(b178Claim('frd-b178-t5a', 'AC-95-001.1', 'broken by a sibling\'s shared-lib change')) } },
    { prefix: 'drift-proof:', response: b178Proof({ frd: 'frd-b178-t5a', wos: ['wo-b178t5a-001'], owned: ['REQ-95-004'], probes: [['AC-95-001.1', ['fail', 'fail'], ['pass', 'pass']]] }) },
    { label: 'verify-patch:frd-b178-t5a', times: 1, response: { green: true } },   // claims green, proves nothing
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^drift-record:/).length === 0, 'no card for a regression')
    t.ok(hasLog(run, /⛔ frd-b178-t5a: the post-patch verifier claims GREEN but 1 inherited fail contract\(s\) are not proven closed \(AC-95-001\.1\)/), 'the unproven certification is REFUSED')
    t.ok(byLabel(run, 'revert:frd-b178-t5a').length === 1, 'the refused verification takes the genuine-red path (revert + reopen)')
    t.ok(run.result && run.result.builtFrds.includes('frd-b178-t5b'), 'the sibling FRD is not blocked by this FRD\'s regression')
  },
})

// T6 — the FRD-02 shape (direct: green / legacy needs-owner block) and the FRD-03 shape (a patchable cycle
// fault AND drift → patch → verifyPatched) produce BYTE-IDENTICAL drift cards. Two extra runs, awaited here.
const b178T6Proof = { prefix: 'drift-proof:', response: b178Proof({ frd: 'frd-b178-t6', wos: ['wo-b178t6-001'], owned: ['REQ-96-014'], probes: [['AC-96-010.4', ['fail', 'fail'], ['fail', 'fail']]] }) }
const b178T6Claim = b178Claim('frd-b178-t6', 'AC-96-010.4', 'team roster drift', 'unknown')
const b178T6Patched = await runEngine({
  args: { mode: 'pro' }, plan: b178Plan('frd-b178-t6', 'wo-b178t6-001'),
  responses: [
    { label: 'gate:frd-b178-t6', times: 1, response: { green: false, reopen: ['wo-b178t6-001'], findings: [{ wo: 'wo-b178t6-001', finding: 'date validation accepts 2026-02-30 (src/x.ts:12)', failingTest: 'src/x/_tests/date.reviewer.test.ts', files: ['src/x.ts'] }], failure: 'date validation', traceability: b178Trace(b178T6Claim) } },
    b178T6Proof, b178Record,
  ],
})
const b178T6Blocked = await runEngine({
  args: { mode: 'pro' }, plan: b178Plan('frd-b178-t6', 'wo-b178t6-001'),
  responses: [
    { label: 'gate:frd-b178-t6', times: 1, response: { green: false, reopen: [], blocked_reason: 'needs-owner', failure: 'AC-96-010.4 contradicted by code no reviewed WO touched — needs the owner', testFiles: ['src/x/_tests/a.reviewer.test.ts'], traceability: b178Trace(b178T6Claim) } },
    b178T6Proof, b178Record,
  ],
})
SCENARIOS.push({
  name: 'BL-0178 T6. FRD-02 shape (direct green), FRD-02 legacy shape (needs-owner block lifted) and FRD-03 shape (patch path) file BYTE-IDENTICAL cards and all land VERIFIED + drift',
  args: { mode: 'pro' },
  plan: b178Plan('frd-b178-t6', 'wo-b178t6-001'),
  responses: [{ label: 'gate:frd-b178-t6', times: 1, response: { green: true, testFiles: [], traceability: b178Trace(b178T6Claim) } }, b178T6Proof, b178Record],
  assert(t, run) {
    for (const [name, r] of [['direct', run], ['patched', b178T6Patched], ['blocked-lifted', b178T6Blocked]]) {
      t.ok(!r.error, `${name}: engine threw: ${r.error}`)
      t.ok(!r.unmatched.length, `${name}: unmatched labels ${r.unmatched.join(', ')}`)
      t.ok(r.result && r.result.builtFrds.includes('frd-b178-t6') && !r.result.blockedFrds.includes('frd-b178-t6'), `${name}: the FRD lands VERIFIED`)
      t.ok(byLabel(r, 'drift-record:frd-b178-t6').length === 1, `${name}: exactly one drift record`)
    }
    const card = (r) => (byLabel(r, 'drift-record:frd-b178-t6')[0] || {}).prompt
    t.ok(card(run) && card(run) === card(b178T6Patched) && card(run) === card(b178T6Blocked), 'the three paths file the BYTE-IDENTICAL drift record')
    t.ok(/drift: \[AC-96-010\.4\]/.test((byLabel(run, 'apply-gate:frd-b178-t6')[0] || {}).prompt || ''), 'direct: apply-gate stamps drift: [AC-96-010.4]')
    const vp = byLabel(b178T6Patched, 'verify-patch:frd-b178-t6')[0]
    const cp = byLabel(b178T6Patched, 'certify-patch:frd-b178-t6')[0]
    t.ok(cp && vp && cp.index > vp.index && /drift: \[AC-96-010\.4\]/.test(cp.prompt), 'patch path: the certify step of the INDEPENDENT verification stamps the same drift frontmatter (the FRD-03 hole: drift no longer vanishes; BL-0191 moved the stamp after the engine\'s check)')
    t.ok(vp && !/INHERITED OPEN CONTRACTS/.test(vp.prompt), 'patch path: proven drift is NOT inherited as an open contract (it has its own record)')
    t.ok(byLabel(b178T6Patched, 'patch:frd-b178-t6').length === 1 && !/AC-96-010\.4/.test(byLabel(b178T6Patched, 'patch:frd-b178-t6')[0].prompt), 'patch path: the patcher fixes only the real cycle fault, never the drift')
    t.ok(byLabel(b178T6Blocked, /^persist-block:/).length === 0 && hasLog(b178T6Blocked, /block is lifted/), 'legacy shape: a needs-owner block resting ONLY on proven drift is lifted, never persisted')
  },
})

// T7 — a flaky probe (two runs disagree) proves nothing.
SCENARIOS.push({
  name: 'BL-0178 T7. flaky probe (runs disagree at the pin) → unproven → cycle fault, NO card',
  args: { mode: 'pro' },
  plan: b178Plan('frd-b178-t7', 'wo-b178t7-001'),
  responses: [
    { label: 'gate:frd-b178-t7', times: 1, response: { green: true, testFiles: [], traceability: b178Trace(b178Claim('frd-b178-t7', 'AC-97-005.1', 'timing-dependent')) } },
    { prefix: 'drift-proof:', response: b178Proof({ frd: 'frd-b178-t7', wos: ['wo-b178t7-001'], owned: ['REQ-97-001'], probes: [['AC-97-005.1', ['fail', 'pass'], ['fail', 'fail']]] }) },
    { prefix: 'verify-patch:', response: { green: true, inheritedResolved: [{ contract: 'AC-97-005.1 — timing-dependent', pass: true, tests: ['t.test.ts'] }] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^drift-record:/).length === 0, 'NO card for a flaky probe')
    t.ok(hasLog(run, /the probe is flaky at the gate pin/), 'the reason names the flakiness')
  },
})

// T8 — a re-gate of the same FRD in the same run re-proves the same drift: it is filed ONCE (engine-level;
// the on-disk idempotency by drift_key is proven in test-drift-proof.mjs).
SCENARIOS.push({
  name: 'BL-0178 T8. re-gate after revert + in-run retry re-proves the same drift → drift-record runs ONCE, final landing still stamps drift',
  args: { mode: 'pro', repairBrake: false },   // the ladder must reach the in-run retry's re-gate (the cost brake is not under test)
  plan: b178Plan('frd-b178-t8', 'wo-b178t8-001'),
  responses: [
    { label: 'gate:frd-b178-t8', times: 1, response: { green: false, reopen: ['wo-b178t8-001'], findings: [{ wo: 'wo-b178t8-001', finding: 'bug at src/y.ts:3', failingTest: 'src/y/_tests/y.reviewer.test.ts', files: ['src/y.ts'] }], failure: 'bug', traceability: b178Trace(b178Claim('frd-b178-t8', 'AC-98-010.8', 'never-built ficha content', 'spec')) } },
    { label: 'gate:frd-b178-t8', times: 1, response: { green: true, testFiles: [], traceability: b178Trace(b178Claim('frd-b178-t8', 'AC-98-010.8', 'never-built ficha content', 'spec')) } },
    { prefix: 'patch:', times: 2, response: { green: false, cause: 'code', failure: 'still red' } },
    { prefix: 'drift-proof:', response: b178Proof({ frd: 'frd-b178-t8', wos: ['wo-b178t8-001'], owned: ['REQ-98-014'], probes: [['AC-98-010.8', ['fail', 'fail'], ['fail', 'fail']]] }) },
    b178Record,
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'drift-proof:frd-b178-t8').length === 2, 'both gates proved the claim')
    t.ok(byLabel(run, 'drift-record:frd-b178-t8').length === 1, 'the drift was filed exactly once')
    t.ok(hasLog(run, /AC-98-010\.8 already recorded this run/), 'the second filing was skipped, loudly')
    t.ok(/drift: \[AC-98-010\.8\]/.test((byLabel(run, 'apply-gate:frd-b178-t8')[0] || {}).prompt || ''), 'the final certifying landing still stamps the drift')
    t.ok(run.result && run.result.builtFrds.includes('frd-b178-t8'), 'the FRD lands VERIFIED after the retry')
  },
})

// Reviewer wrong: the probe PASSES at the pin → the claim is discarded, logged, nothing filed.
SCENARIOS.push({
  name: 'BL-0178 R1. reviewer wrong — probe passes at the pin → claim DISCARDED with a log, gate green lands VERIFIED with no drift and no card',
  args: { mode: 'pro' },
  plan: b178Plan('frd-b178-r1', 'wo-b178r1-001'),
  responses: [
    { label: 'gate:frd-b178-r1', response: { green: true, testFiles: [], traceability: b178Trace(b178Claim('frd-b178-r1', 'AC-99-001.1', 'the reviewer misread it')) } },
    { prefix: 'drift-proof:', response: b178Proof({ frd: 'frd-b178-r1', wos: ['wo-b178r1-001'], owned: ['REQ-99-002'], probes: [['AC-99-001.1', ['pass', 'pass'], []]] }) },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(hasLog(run, /drift claim on AC-99-001\.1 DISCARDED — the probe PASSES at the gate pin/), 'the discard is logged, never silent')
    t.ok(byLabel(run, /^drift-record:/).length === 0, 'nothing filed')
    const apply = byLabel(run, 'apply-gate:frd-b178-r1')[0]
    t.ok(apply && /delete that line/.test(apply.prompt) && !/drift: \[/.test(apply.prompt), 'the landing re-derives the replica to EMPTY (a stale drift: key is removed)')
    t.ok(run.result && run.result.builtFrds.includes('frd-b178-r1'), 'VERIFIED')
  },
})

// Rollback switch: args.driftPolicy:'block' — claims are ignored, no proof spawn, a green over a fail stays RED.
SCENARIOS.push({
  name: 'BL-0178 R2. args.driftPolicy:"block" (rollback) → no proof spawn; a claimed fail under green still reds (pre-BL-0178 contract)',
  args: { mode: 'pro', driftPolicy: 'block' },
  plan: b178Plan('frd-b178-r2', 'wo-b178r2-001'),
  responses: [{ label: 'gate:frd-b178-r2', response: { green: true, testFiles: [], traceability: b178Trace(b178Claim('frd-b178-r2', 'AC-99-002.1', 'legacy')) } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^drift-(proof|record):/).length === 0, 'no drift spawn at all')
    t.ok(hasLog(run, /IGNORED — args\.driftPolicy:'block'/), 'the rollback is logged')
    t.ok(!(run.result && run.result.builtFrds.includes('frd-b178-r2')), 'never VERIFIED from a green over an open fail')
  },
})

// The FRD-03 hole itself (BL-0178 "Tests" section): a patched gate carrying a still-open, UNCLAIMED `fail`
// entry used to ship VERIFIED through verifyPatched, which never looked at traceability. RED before, GREEN now.
SCENARIOS.push({
  name: 'BL-0178 R3. FRD-03 hole — verifyPatched inherits an unclaimed open fail; a green that does not prove it closed is refused (no silent VERIFIED)',
  args: { mode: 'pro' },
  plan: b178Plan('frd-b178-r3', 'wo-b178r3-001'),
  responses: [
    { label: 'gate:frd-b178-r3', times: 1, response: { green: false, reopen: ['wo-b178r3-001'], findings: [{ wo: 'wo-b178r3-001', finding: 'bug at src/z.ts:9', failingTest: 'src/z/_tests/z.reviewer.test.ts', files: ['src/z.ts'] }], failure: 'bug', traceability: b178Trace({ contract: 'REQ-99-003 — the rail lists only building/shipped', contractClass: 'requirement', status: 'fail', tests: ['src/z/_tests/rail.reviewer.test.ts'] }) } },
    { label: 'verify-patch:frd-b178-r3', times: 1, response: { green: true } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const vp = byLabel(run, 'verify-patch:frd-b178-r3')[0]
    t.ok(vp && /REQ-99-003 — the rail lists only building\/shipped/.test(vp.prompt) && /rail\.reviewer\.test\.ts/.test(vp.prompt), 'the verifier is handed the open contract and the gate\'s own test for it')
    t.ok(hasLog(run, /⛔ frd-b178-r3: the post-patch verifier claims GREEN but 1 inherited fail contract/), 'the unproven green is refused')
    t.ok(byLabel(run, 'revert:frd-b178-r3').length === 1, 'it takes the genuine-red path instead of shipping')
  },
})

// Fail-closed: a dead proof runner proves nothing; a reviewer-typed 'drift' status is not an engine stamp.
SCENARIOS.push({
  name: 'BL-0178 R4. dead drift-proof runner → every claim is a cycle fault (reopen), never drift',
  args: { mode: 'pro' },
  plan: b178Plan('frd-b178-r4', 'wo-b178r4-001'),
  responses: [
    { label: 'gate:frd-b178-r4', times: 1, response: { green: true, testFiles: [], traceability: b178Trace(b178Claim('frd-b178-r4', 'AC-99-004.1', 'x')) } },
    { prefix: 'drift-proof:', response: null },
    { prefix: 'verify-patch:', response: { green: true, inheritedResolved: [{ contract: 'AC-99-004.1 — x', pass: true, tests: ['t.test.ts'] }] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(hasLog(run, /drift-proof runner returned no output — every drift claim stays a cycle fault/), 'the dead runner is logged')
    t.ok(byLabel(run, /^drift-record:/).length === 0 && byLabel(run, 'patch:frd-b178-r4').length === 1, 'no card; reopened patch-first')
  },
})
SCENARIOS.push({
  name: 'BL-0178 R5. a reviewer returning status:"drift" itself (no engine stamp) under green is still an open fail → never VERIFIED',
  args: { mode: 'pro' },
  plan: b178Plan('frd-b178-r5', 'wo-b178r5-001'),
  responses: [{ label: 'gate:frd-b178-r5', response: { green: true, testFiles: [], traceability: b178Trace({ contract: 'AC-99-005.1 — sneaky', contractClass: 'acceptance-criterion', status: 'drift', tests: [] }) } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(!(run.result && run.result.builtFrds.includes('frd-b178-r5')), 'a self-declared drift status waives nothing')
  },
})
// Prompt contract: the gate carries the generated DRIFT_CLAIM directive (source: reviewer.md) and the oracle
// amendment; the "no reviewer waivers" sentence is untouched.
SCENARIOS.push({
  name: 'BL-0178 R6. the gate prompt carries the drift-claim directive + the oracle amendment; "no reviewer waivers" stays verbatim',
  args: { mode: 'pro' },
  plan: b178Plan('frd-b178-r6', 'wo-b178r6-001'),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-b178-r6')[0]
    t.ok(gate && /you PROPOSE, the engine DECIDES/.test(gate.prompt) && /claim: "preexisting"/.test(gate.prompt) && /drift-probes\/<frd>\/<contract-id>\.drift-probe\.ts/.test(gate.prompt), 'the directive tells the reviewer exactly how to propose')
    t.ok(gate && /never take the blocked\/needs-owner exit for a drift claim/.test(gate.prompt), 'drift alone never takes the blocked exit')
    t.ok(gate && /there are no reviewer waivers for approved spec text/.test(gate.prompt) && /never dropped, never waived/.test(gate.prompt), 'the oracle keeps "no reviewer waivers" and adds "never dropped, never waived"')
  },
})

// ---- BL-0185 (integration BL-0182..0184 × BL-0178) ----
// Cross-review of the two engine packages once merged: (a) a concurrent PASS whose apply fails is re-applied
// by gateConverge — it must port from the gate's EVIDENCE dir (the worktree is already clean), never assume
// the tests are on main; (b) a needs-owner block carrying drift claims emits its terminal outcome ONCE — the
// reviewer defers, the engine emits whatever survives adjudication; (c) the combined reject: 1 cycle fail +
// 1 proven drift → reviewer tests ported + pinned, patch, verifyPatched green, drift card filed once.
const b185GateEmits = (prompt) => /"kind":"review_end","frd":"[^"]+","verdict":"blocked"/.test(prompt) && /"event":"GateVerdict"[^']*"verdict":"blocked"/.test(prompt)
{
  const wt = c2WorktreeModel()
  const testPath = 'src/185a/_tests/a.reviewer.test.ts'
  SCENARIOS.push({
    name: 'BL-0185a. a concurrent PASS whose apply fails is re-applied from the gate-evidence dir (tests + report), never "already on the main tree"',
    args: { mode: 'pro' },
    plan: mkPlan([{ frd: 'frd-185a', deps: [], workOrders: [mkWo('wo-185a-001', 'PLANNED', { frd: 'frd-185a', artifacts: ['src/185a/**'] })] }]),
    responses: [
      { label: 'gate:frd-185a', times: 1, response: () => { wt.dirt.add(testPath); return { green: true, testFiles: [testPath] } } },
      { label: 'gate-worktree', response: () => wt.probe() },
      { prefix: 'gate-release:', response: () => wt.release() },
      { label: 'apply-gate:frd-185a', times: 1, response: { done: false } },
    ],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const applies = byLabel(run, 'apply-gate:frd-185a')
      t.ok(applies.length === 2, `the failed apply was retried once through the convergence (got ${applies.length})`)
      const second = applies[1]
      t.ok(second && /gate-evidence\/frd-185a\/<path>/.test(second.prompt) && second.prompt.includes(testPath) && /rev-parse --show-toplevel/.test(second.prompt),
        'the re-apply ports the salvaged test from the evidence dir to its repo-root-relative path on main')
      t.ok(second && /gate-evidence\/frd-185a\/gate-report\.json/.test(second.prompt), 'the re-apply\'s WP-08 cage reads the gate\'s salvaged report, not main\'s own')
      t.ok(second && !/already on the main tree/.test(second.prompt), 'the re-apply never assumes the reviewer\'s tests are already on main (the worktree was cleaned)')
      t.ok(run.result && run.result.builtFrds.includes('frd-185a'), 'the FRD lands VERIFIED on the re-apply')
    },
  })
}
SCENARIOS.push({
  name: 'BL-0185b1. the gate\'s blocked exit defers its telemetry when a drift claim rides on a needs-owner block (the engine emits the one terminal outcome)',
  args: { mode: 'pro' },
  plan: b178Plan('frd-185b1', 'wo-185b1-001'),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-185b1')[0]
    t.ok(gate && /emit NOTHING here/.test(gate.prompt) && /claim: "preexisting"/.test(gate.prompt), 'the blocked branch tells the reviewer to defer the outcome when a drift claim rides on a needs-owner block')
  },
})
SCENARIOS.push({
  name: 'BL-0185b2. a needs-owner block resting ONLY on proven drift is lifted → exactly ONE terminal outcome (the apply\'s pass), no blocked emission anywhere on the engine side',
  args: { mode: 'pro' },
  plan: b178Plan('frd-185b2', 'wo-185b2-001'),
  responses: [
    { label: 'gate:frd-185b2', times: 1, response: { green: false, reopen: [], blocked_reason: 'needs-owner', failure: 'AC-85-010.4 contradicted by legacy code', testFiles: [], traceability: b178Trace(b178Claim('frd-185b2', 'AC-85-010.4', 'legacy roster')) } },
    { prefix: 'drift-proof:', response: b178Proof({ frd: 'frd-185b2', wos: ['wo-185b2-001'], owned: ['REQ-85-001'], probes: [['AC-85-010.4', ['fail', 'fail'], ['fail', 'fail']]] }) },
    b178Record,
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^persist-block:/).length === 0, 'the lifted block is never persisted (so never emitted as blocked by the engine)')
    const applies = byLabel(run, 'apply-gate:frd-185b2')
    t.ok(applies.length === 1 && /"verdict":"pass"/.test(applies[0].prompt), 'exactly one terminal outcome: the apply\'s pass')
    t.ok(run.calls.filter((c) => c.label !== 'gate:frd-185b2' && b185GateEmits(c.prompt)).length === 0, 'no engine-side spawn emits a blocked outcome for this FRD')
    t.ok(run.result && run.result.builtFrds.includes('frd-185b2'), 'VERIFIED')
  },
})
SCENARIOS.push({
  name: 'BL-0185b3. a needs-owner block that STANDS after drift adjudication (another open fail) is emitted by the engine (persist-block, not alreadyTracked)',
  args: { mode: 'pro' },
  plan: b178Plan('frd-185b3', 'wo-185b3-001'),
  responses: [
    { label: 'gate:frd-185b3', times: 1, response: { green: false, reopen: [], blocked_reason: 'needs-owner', failure: 'REQ-85-020 needs an owner decision', testFiles: [], traceability: b178Trace(
      b178Claim('frd-185b3', 'AC-85-030.1', 'legacy'),
      { contract: 'REQ-85-020 — ambiguous spec the owner must settle', contractClass: 'requirement', status: 'fail', tests: [] }) } },
    { prefix: 'drift-proof:', response: b178Proof({ frd: 'frd-185b3', wos: ['wo-185b3-001'], owned: ['REQ-85-001'], probes: [['AC-85-030.1', ['fail', 'fail'], ['fail', 'fail']]] }) },
    b178Record,
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const pb = byLabel(run, 'persist-block:frd-185b3')
    t.ok(pb.length === 1 && b185GateEmits(pb[0].prompt), 'the standing block is persisted AND its terminal outcome emitted by the engine (the reviewer deferred it)')
    t.ok(run.result && run.result.blockedFrds.includes('frd-185b3'), 'blocked needs-owner')
    t.ok(byLabel(run, 'drift-record:frd-185b3').length === 1, 'the proven drift is still filed')
  },
})
SCENARIOS.push({
  name: 'BL-0185b4. control — a needs-owner block WITHOUT drift claims keeps the reviewer\'s own emission (persist-block alreadyTracked, BL-0159 unchanged)',
  args: { mode: 'pro' },
  plan: b178Plan('frd-185b4', 'wo-185b4-001'),
  responses: [
    { label: 'gate:frd-185b4', times: 1, response: { green: false, reopen: [], blocked_reason: 'needs-owner', failure: 'the AC contradicts the blueprint', testFiles: [] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const pb = byLabel(run, 'persist-block:frd-185b4')
    t.ok(pb.length === 1 && !b185GateEmits(pb[0].prompt), 'no duplicate: the reviewer already emitted this block')
  },
})
SCENARIOS.push({
  name: 'BL-0185b5. a post-repair re-gate that blocks needs-owner with a deferred drift claim is still emitted once (persisted by the engine)',
  args: { mode: 'pro' },
  plan: b178Plan('frd-185b5', 'wo-185b5-001'),
  responses: [
    { label: 'gate:frd-185b5', times: 1, response: { green: false, reopen: [], blocked_reason: 'error', failure: 'the suite crashed', testFiles: [] } },
    { label: 'gate:frd-185b5', times: 1, response: { green: false, reopen: [], blocked_reason: 'needs-owner', failure: 'REQ-85-050 needs an owner decision', testFiles: [], traceability: b178Trace(
      b178Claim('frd-185b5', 'AC-85-040.1', 'legacy'),
      { contract: 'REQ-85-050 — ambiguous spec the owner must settle', contractClass: 'requirement', status: 'fail', tests: [] }) } },
    { prefix: 'drift-proof:', response: b178Proof({ frd: 'frd-185b5', wos: ['wo-185b5-001'], owned: ['REQ-85-001'], probes: [['AC-85-040.1', ['fail', 'fail'], ['fail', 'fail']]] }) },
    b178Record,
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'repair:frd-185b5').length >= 1 || byLabel(run, /^repair:/).length >= 1, 'the error block went through the repair + re-gate')
    const pb = byLabel(run, 'persist-block:frd-185b5')
    t.ok(pb.length === 1 && b185GateEmits(pb[0].prompt), 'the deferred block is persisted and emitted by the engine exactly once')
    t.ok(run.result && run.result.blockedFrds.includes('frd-185b5'), 'blocked')
  },
})
{
  const wt = c2WorktreeModel()
  const testPath = 'src/185c/_tests/date.reviewer.test.ts'
  const cycle = { contract: 'AC-85-060.2 — dates reject 2026-02-30', contractClass: 'acceptance-criterion', status: 'fail', tests: [testPath] }
  SCENARIOS.push({
    name: 'BL-0185c. C2 × D2 — reopen with 1 cycle fail + 1 proven drift: reviewer test ported + pinned, patch, verifyPatched proves the inherited fail, drift card filed ONCE and stamped',
    args: { mode: 'pro' },
    plan: b178Plan('frd-185c', 'wo-185c-001'),
    responses: [
      { label: 'gate:frd-185c', times: 1, response: () => { wt.dirt.add(testPath); return { green: false, reopen: ['wo-185c-001'], findings: [{ wo: 'wo-185c-001', finding: 'date validation accepts 2026-02-30 (src/185c/x.ts:12)', failingTest: testPath, files: ['src/185c/x.ts'] }], failure: 'date validation', traceability: b178Trace(cycle, b178Claim('frd-185c', 'AC-85-070.1', 'legacy ficha drift', 'spec')) } } },
      { label: 'gate-worktree', response: () => wt.probe() },
      { prefix: 'gate-release:', response: () => wt.release() },
      { prefix: 'drift-proof:', response: b178Proof({ frd: 'frd-185c', wos: ['wo-185c-001'], owned: ['REQ-85-060'], probes: [['AC-85-070.1', ['fail', 'fail'], ['fail', 'fail']]] }) },
      b178Record,
      { label: 'verify-patch:frd-185c', response: { green: true, inheritedResolved: [{ contract: cycle.contract, pass: true, tests: [testPath] }] } },
    ],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(!run.unmatched.length, `unmatched labels: ${run.unmatched.join(', ')}`)
      const at = (l) => (byLabel(run, l)[0] || { index: -1 }).index
      t.ok(at('drift-proof:frd-185c') >= 0 && at('drift-proof:frd-185c') < at('gate-release:frd-185c'), 'the differential proof ran inside the gate link, BEFORE the release cleaned the worktree')
      t.ok(byLabel(run, 'drift-record:frd-185c').length === 1, 'the drift card is filed exactly once')
      t.ok(byLabel(run, 'port-reviewer-tests:frd-185c').length === 1 && wt.dirt.size === 0, 'the reviewer\'s RED test was salvaged and ported onto main (BL-0184); the worktree ends clean')
      const patch = byLabel(run, 'patch:frd-185c')[0]
      t.ok(patch && patch.prompt.includes(testPath) && /THE GATE'S OWN RED TESTS ARE ON THIS TREE/.test(patch.prompt), 'the patch is held to the reviewer\'s own test file')
      t.ok(patch && !/AC-85-070\.1/.test(patch.prompt), 'the patcher is never asked to fix the proven drift')
      t.ok(at('reviewer-test-hash:frd-185c') >= 0 && at('reviewer-test-hash:frd-185c') < at('verify-patch:frd-185c'), 'the DR-080 hash check ran before the independent verifier')
      const vp = byLabel(run, 'verify-patch:frd-185c')[0]
      t.ok(vp && /INHERITED OPEN CONTRACTS/.test(vp.prompt) && vp.prompt.includes('AC-85-060.2') && !/• \[[^\]]+\] AC-85-070\.1/.test(vp.prompt), 'verifyPatched inherits the cycle fail only — never the proven drift')
      t.ok(vp && /THE GATE'S OWN ADVERSARIAL TESTS \(BL-0184, DR-080\)/.test(vp.prompt) && vp.prompt.includes(testPath), 'verifyPatched runs the ported reviewer test explicitly by path')
      const cp = byLabel(run, 'certify-patch:frd-185c')[0]
      t.ok(cp && cp.index > vp.index && /drift: \[AC-85-070\.1\]/.test(cp.prompt), 'the certify step of the accepted verification stamps drift: [AC-85-070.1] in the FRD frontmatter (BL-0191)')
      t.ok(byLabel(run, /^(revert|persist-block):/).length === 0, 'no revert, no block')
      t.ok(run.result && run.result.builtFrds.includes('frd-185c'), 'the FRD lands VERIFIED')
    },
  })
}

// ---- GATE-COST ----
// Proposal 38 "Red-team addendum (2026-09-25)": the gate is ~77% of a multi-FRD run's cost (D2: reviews 24.61 $
// of 36.24 $ dedup) and parallel gates do not move it. The three cost levers of this block:
//   BL-0187 · `gateEvidence:'digested'` made measurable on the REAL (nested) topology — exercised here against a
//             real git repository whose project is nested like Mission Control, by EXECUTING the collector's own
//             shell commands as the engine wrote them (not string-matching them).
//   BL-0188 · the gate context scope (args.gateContextScope) + a lossless compaction of the digested report.
//   BL-0189 · the FRD contract-inventory cache (args.gateInventoryCache), incl. a round trip through the REAL
//             gate-inventory.mjs (write by the landing → check by the next gate → HIT / STALE).
const { execFileSync: gcExecFile } = await import('node:child_process')
const gcFs = await import('node:fs')
const gcOs = await import('node:os')
const { fnv1a: gcFnv1a } = await import('./gate-inventory.mjs')
const gcRealStateCli = path.join(__dirname, 'pandacorp-build-state.mjs')
const gcGit = (cwd, ...a) => gcExecFile('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const gcWrite = (file, text) => { gcFs.mkdirSync(path.dirname(file), { recursive: true }); gcFs.writeFileSync(file, text) }
const gcBash = (cmd, cwd) => { try { return { ok: true, out: gcExecFile('bash', ['-c', cmd], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } } catch (e) { return { ok: false, out: String(e.stdout || ''), err: String(e.stderr || e.message) } } }
const gcCleanups = []

// A factory-shaped repo with a NESTED project (repo/mission-control), one cycle commit touching BOTH the project
// and factory files, and the C2 gate worktree created where the engine creates it (inside the project's
// gitignored .pandacorp/run/) and bootstrapped the way BL-0155 left it (node_modules under the PROJECT dir).
function gcNestedFixture(frd) {
  const root = gcFs.mkdtempSync(path.join(gcOs.tmpdir(), 'gate-cost-'))
  gcCleanups.push(root)
  const repo = path.join(root, 'repo')
  const app = path.join(repo, 'mission-control')
  gcFs.mkdirSync(app, { recursive: true })
  gcGit(repo, 'init', '-q'); gcGit(repo, 'config', 'user.email', 't@example.com'); gcGit(repo, 'config', 'user.name', 't')
  gcWrite(path.join(app, '.gitignore'), '.pandacorp/run/\nnode_modules/\n')
  gcWrite(path.join(app, 'package.json'), '{ "name": "mission-control" }\n')
  gcWrite(path.join(app, '.pandacorp/status.yaml'), 'phase: implementation\nlast_green_sha: none\n')
  gcWrite(path.join(app, `docs/frds/${frd}/frd.md`), '---\nimplementation_status: IN_REVIEW\n---\n# FRD\n\nREQ-90-001 The board SHALL mark an empty column.\n')
  gcWrite(path.join(app, 'src/app/board/view.tsx'), 'export const v = 1\n')
  gcWrite(path.join(repo, 'plugin/engine.js'), 'factory v1\n')
  gcGit(repo, 'add', '-A'); gcGit(repo, 'commit', '-qm', 'base')
  const base = gcGit(repo, 'rev-parse', 'HEAD')
  gcWrite(path.join(app, 'src/app/board/view.tsx'), 'export const v = 2\n')
  gcWrite(path.join(app, 'src/app/board/_tests/view.test.tsx'), 'test("v", () => {})\n')
  gcWrite(path.join(repo, 'plugin/engine.js'), 'factory v2\n')
  gcWrite(path.join(repo, 'factory/memory/lesson.md'), 'factory noise\n')
  gcWrite(path.join(app, '.pandacorp/status.yaml'), `phase: implementation\nlast_green_sha: ${base}\n`)
  gcGit(repo, 'add', '-A'); gcGit(repo, 'commit', '-qm', 'cycle')
  const pin = gcGit(repo, 'rev-parse', 'HEAD')
  const wt = path.join(app, '.pandacorp/run/gate-worktree')
  gcGit(app, 'worktree', 'add', '--detach', '-q', wt, pin)
  gcWrite(path.join(wt, 'mission-control/node_modules/.bin/vitest'), '#!/bin/sh\n')
  return { root, repo, app, base, pin, wt }
}
// The real Mission Control gate-report.json as verify.sh writes it (2-space pretty print; content as read from
// mission-control/.pandacorp/run/gate-report.json on 2026-09-25) — 1,291 chars pretty (+1 trailing newline in the file), 805 compact.
const GC_REAL_REPORT = JSON.stringify({ at: '2026-09-25T20:23:01Z', scope: 'full', green: true, sha: '4a15f4cce1fda92ed274e5517b45143bb821f3ec', subgates: [
  ['structure-guard', 21], ['data-layer', 5], ['api-error-contract', 8], ['doc-lint', 2444], ['residual-ambiguity', 52], ['biome', 674],
  ['tsc', 2548], ['knip', 925], ['madge', 1662], ['vitest', 36283], ['playwright', 56140]].map(([name, ms]) => ({ name, exit: 0, duration_ms: ms, failures: [] })) }, null, 2)

// ── BL-0187 · the digested collector on a NESTED project: its own commands, executed ──
{
  const frd = 'frd-90-board'
  const fx = gcNestedFixture(frd)
  SCENARIOS.push({
    name: 'GC-L1a. BL-0187 — nested project: the collector cds into the PROJECT dir inside the gate worktree; its step 0 says BOOTSTRAPPED (the worktree root would say NOT), its --relative stat drops the enclosing repo\'s files, its quoted pathspec yields the real patch, and 3b lists the cycle\'s tests',
    args: { mode: 'pro', gateEvidence: 'digested', projectDir: fx.app, project: 'mission-control' },
    plan: mkPlan([{ frd, deps: [], workOrders: [wp06Wo('wo-90-001', frd, { artifacts: ['src/app/board/**'], acText: 'AC-90-001.1 WHEN a column is empty THE SYSTEM SHALL announce it' })] }]),
    responses: [
      { prefix: 'commit:', response: { committed: 1, sha: fx.pin } },
      { prefix: 'evidence:', response: { report: GC_REAL_REPORT, diffStat: ' src/app/board/view.tsx | 2 +-', diff: '-export const v = 1\n+export const v = 2', truncated: false, tests: ['src/app/board/_tests/view.test.tsx'], ac: '[wo-90-001] AC-90-001.1 WHEN a column is empty THE SYSTEM SHALL announce it' } },
    ],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const ev = byLabel(run, `evidence:${frd}`)[0]
      t.ok(Boolean(ev), 'the digested collector ran')
      if (!ev) return
      const cd = (ev.prompt.match(/FIRST cd into the PROJECT directory inside it, exactly: `([^`]+)`/) || [])[1]
      t.ok(Boolean(cd), 'the collector prompt carries ONE exact cd command into the project dir inside the worktree')
      const here = cd ? gcBash(`${cd} && pwd -P`, gcOs.tmpdir()) : { ok: false }
      t.ok(here.ok && here.out.trim() === gcFs.realpathSync(path.join(fx.wt, 'mission-control')), `executed, that cd lands in <gate-worktree>/mission-control — the nested PROJECT dir (got ${here.out && here.out.trim()} ${here.err || ''})`)
      const step0 = (ev.prompt.match(/[Rr]un exactly `(node -e "[^`]+")`/) || [])[1]
      t.ok(Boolean(step0) && !/`test -e/.test(ev.prompt), 'step 0 is an alias-proof Node probe, never shell `test` (an owner alias test=\'npm test\' hijacked it)')
      const inProject = step0 && cd ? gcBash(`${cd} && ${step0}`, gcOs.tmpdir()) : { ok: false, out: '' }
      const atRoot = step0 ? gcBash(step0, fx.wt) : { ok: false, out: '' }
      t.ok(inProject.out === 'BOOTSTRAPPED', `executed from the project dir, step 0 answers BOOTSTRAPPED (got ${JSON.stringify(inProject.out)})`)
      t.ok(atRoot.out === 'NOT-BOOTSTRAPPED', `the pre-fix cwd (the worktree ROOT) answers NOT-BOOTSTRAPPED — the reason the nested collector always fell back (got ${JSON.stringify(atRoot.out)})`)
      const sub = (cmd) => cmd.replaceAll('<PIN_BASE>', fx.base)
      const statCmd = (ev.prompt.match(/2\) `(git diff --relative [^`]+--stat)`/) || [])[1]
      const stat = statCmd && cd ? gcBash(`${cd} && ${sub(statCmd)}`, gcOs.tmpdir()) : { ok: false, out: '' }
      t.ok(stat.ok && /src\/app\/board\/view\.tsx/.test(stat.out) && !/plugin\/engine\.js|factory\/memory/.test(stat.out), `the --relative stat lists the project's files only (got: ${stat.out.trim().split('\n').pop()})`)
      const oldStat = gcBash(`git diff ${fx.base}..${fx.pin} --stat`, fx.wt)
      t.ok(/plugin\/engine\.js/.test(oldStat.out), 'fixture check: the pre-fix stat (no --relative, worktree root) DID carry the enclosing repo\'s files')
      const patchCmd = (ev.prompt.match(/3\) `(git diff --relative [^`]+)`/) || [])[1]
      const patch = patchCmd && cd ? gcBash(`${cd} && ${sub(patchCmd)}`, gcOs.tmpdir()) : { ok: false, out: '' }
      t.ok(patch.ok && /\+export const v = 2/.test(patch.out) && !/factory v2/.test(patch.out), 'the artifact-scoped patch (quoted pathspec, project-relative) returns the WO\'s real hunk')
      const oldPatch = gcBash(`git diff ${fx.base}..${fx.pin} -- src/app/board/**`, fx.wt)
      t.ok(oldPatch.ok && oldPatch.out === '', 'fixture check: the pre-fix patch (worktree-root cwd, unquoted pathspec) came back EMPTY on a nested project')
      const testsCmd = (ev.prompt.match(/the output lines of `([^`]+)`/) || [])[1]
      const tests = testsCmd && cd ? gcBash(`${cd} && ${sub(testsCmd)}`, gcOs.tmpdir()) : { ok: false, out: '' }
      t.ok(tests.ok && tests.out.trim() === 'src/app/board/_tests/view.test.tsx', `3b lists exactly the test file the cycle added (got ${JSON.stringify(tests.out.trim())})`)
      t.ok(/\[wo-90-001\] AC-90-001\.1/.test(ev.prompt), 'the collector\'s AC seed is labelled with its owning work order (the WO → contract traceability map)')
      const gate = byLabel(run, `gate:${frd}`)[0]
      t.ok(gate && /YOUR EVIDENCE IS ALREADY COLLECTED/.test(gate.prompt), 'the gate ran DIGESTED (no fallback) on the nested project')
      t.ok(gate && gate.prompt.includes(cd || '§'), 'the reviewer starts in the same project dir inside the worktree')
      t.ok(gate && gate.prompt.includes('src/app/board/_tests/view.test.tsx') && /TEST FILES THIS CYCLE ADDED OR CHANGED/.test(gate.prompt), 'the digest hands the reviewer the cycle\'s test-file list')
      t.ok(gate && /You MUST run verify\.sh exactly once/.test(gate.prompt) && /RUN YOUR OWN ADVERSARIAL TESTS EXPLICITLY, BY PATH/.test(gate.prompt), 'digested still obliges the verify.sh re-run AND the by-path run of its own tests (REV2-1, BL-0183)')
      t.ok(!hasLog(run, /GateEvidenceFallback/), 'no GateEvidenceFallback')
      t.ok(run.result && run.result.builtFrds.includes(frd), 'the FRD verified through the digested gate')
    },
  })
}

// ── BL-0188 · the digested report is compacted losslessly (real MC report) ──
SCENARIOS.push({
  name: 'GC-L2a. BL-0188 — the digested gate carries the real gate-report.json compacted (≥30% smaller, lossless: the same parsed value)',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: mkPlan([{ frd: 'frd-91-report', deps: [], workOrders: [wp06Wo('wo-91-001', 'frd-91-report')] }]),
  responses: [{ prefix: 'evidence:', response: { report: GC_REAL_REPORT, diffStat: 's', diff: 'd', truncated: false, ac: 'a' } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-91-report')[0]
    const compact = JSON.stringify(JSON.parse(GC_REAL_REPORT))
    t.ok(gate && gate.prompt.includes(compact) && !gate.prompt.includes(GC_REAL_REPORT), 'the attachment is the compact serialization, not the pretty one')
    const saved = 1 - compact.length / GC_REAL_REPORT.length
    t.ok(GC_REAL_REPORT.length === 1291 && compact.length === 805 && saved >= 0.30, `measured on the real report: ${GC_REAL_REPORT.length} → ${compact.length} chars (−${(saved * 100).toFixed(1)}%)`)
    t.ok(JSON.stringify(JSON.parse(compact)) === JSON.stringify(JSON.parse(GC_REAL_REPORT)), 'lossless: both forms parse to the identical value (every sub-gate, exit and failures[] row)')
  },
})

// ── BL-0188 · the context-scope directive: off by default, and what it scopes when on ──
const gcScopePlan = (frd) => mkPlan([{ frd, deps: [], workOrders: [
  wp06Wo('wo-92-014', frd, { artifacts: ['src/app/board/IdeaBoardView/**'] }),
  ...Array.from({ length: 9 }, (_, i) => mkWo(`wo-92-00${i + 1}`, 'VERIFIED', { frd })),
] }])
const gcScopePrompts = {}
for (const on of [false, true]) {
  const frd = on ? 'frd-92-scope-on' : 'frd-92-scope-off'
  SCENARIOS.push({
    name: `GC-L2b${on ? '2' : '1'}. BL-0188 — gateContextScope ${on ? 'ON: the gate reads frd.md + the cycle WO in full, other WOs header-only, the blueprint by section, rules as pointers, never the engine source, heavy output to file+tail' : 'OFF (default): the gate prompt carries no scope directive'}`,
    args: { mode: 'pro', ...(on ? { gateContextScope: true } : {}) },
    plan: gcScopePlan(frd),
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const gate = byLabel(run, `gate:${frd}`)[0]
      t.ok(Boolean(gate), 'the gate ran')
      if (!gate) return
      gcScopePrompts[on ? 'on' : 'off'] = gate.prompt.replaceAll(frd, 'FRD')
      if (!on) { t.ok(!/CONTEXT SCOPE \(gate cost, BL-0188\)/.test(gate.prompt), 'default: no scope directive (flag off until canary E)'); return }
      t.ok(/CONTEXT SCOPE \(gate cost, BL-0188\)/.test(gate.prompt), 'the directive is present')
      t.ok(gate.prompt.includes(`READ IN FULL: \`docs/frds/${frd}/frd.md\``), 'frd.md is still read IN FULL — the oracle\'s source is never trimmed without a verified cache')
      t.ok(gate.prompt.includes(`docs/frds/${frd}/work-orders/wo-92-014.md`), 'the cycle\'s work order is named for a full read')
      t.ok(/HEADER ONLY: the FRD's OTHER work orders/.test(gate.prompt) && /SECTIONS ONLY: `docs\/frds\/[^`]+\/blueprint\.md`/.test(gate.prompt), 'VERIFIED work orders header-only; blueprint by section')
      t.ok(/POINTERS ONLY/.test(gate.prompt) && /NEVER: the factory, plugin or build-engine source/.test(gate.prompt) && /\.pandacorp\/run\/gate-logs\//.test(gate.prompt), 'rules as pointers, engine source forbidden, heavy output to a gitignored log + tail')
      t.ok(/Whole-FRD source oracle/.test(gate.prompt) && /there are no reviewer waivers for approved spec text/.test(gate.prompt) && /RUN YOUR OWN ADVERSARIAL TESTS EXPLICITLY, BY PATH/.test(gate.prompt), 'the oracle, the no-waiver rule and the by-path adversarial tests are untouched')
      const off = gcScopePrompts.off || ''
      const on2 = gcScopePrompts.on || ''
      const delta = on2.length - off.length
      t.ok(off.length > 0 && delta > 0 && delta <= 2500, `prompt size measured on the same 10-WO FRD: ${off.length} → ${on2.length} chars (+${delta}, +${off.length ? ((delta / off.length) * 100).toFixed(1) : '?'}%) — the directive costs ≤ 2.5k chars; its saving is in what the reviewer reads, not in the prompt`)
    },
  })
}

SCENARIOS.push({
  name: 'GC-L2c. BL-0188 — gateContextScope reaches the SPLIT gate too: all four finder lenses and the closer carry the scope directive',
  args: { mode: 'powerful', gateContextScope: true },
  plan: mkPlan([{ frd: 'frd-92-split', deps: [], workOrders: [{ ...mkWo('wo-92-101', 'PLANNED', { frd: 'frd-92-split', artifacts: ['src/split/**'], reopen_count: 1 }) }] }]),
  responses: [{ label: /^find:/, response: { findings: [] } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const finders = byLabel(run, /^find:/)
    const closer = byLabel(run, 'gate:frd-92-split')[0]
    t.ok(finders.length === 4 && finders.every((c) => /CONTEXT SCOPE \(gate cost, BL-0188\)/.test(c.prompt)), 'every finder lens carries the directive')
    t.ok(closer && /CONTEXT SCOPE \(gate cost, BL-0188\)/.test(closer.prompt) && closer.opts.model === 'opus', 'the split closer carries it too, still on the opus judge')
  },
})

// ── BL-0189 · the contract-inventory cache, mocked MECH facts (the engine's decisions) ──
const gcTrace = (extra = []) => [
  { contract: 'REQ-93-001 — the board SHALL mark an empty column', contractClass: 'requirement', status: 'pass', tests: ['src/b/_tests/a.test.ts'] },
  { contract: 'AC-93-001.1 — an empty column is announced', contractClass: 'acceptance-criterion', status: 'pass', tests: ['src/b/_tests/a.test.ts'] },
  { contract: 'AC-93-002.1 — the owner\'s `ACTIVE_PHASES` filter costs $0', contractClass: 'acceptance-criterion', status: 'pass', tests: ['src/b/_tests/b.test.ts'] },
  { contract: 'invariant: columns are fixed', contractClass: 'invariant', status: 'not-applicable', tests: [] },
  { contract: 'edge: zero cards', contractClass: 'edge-case', status: 'pass', tests: ['src/b/_tests/edge.test.ts'] },
  { contract: 'limit: 500 cards', contractClass: 'limit', status: 'pass', tests: ['src/b/_tests/limit.test.ts'] },
  { contract: 'error: unreadable card', contractClass: 'error', status: 'not-applicable', tests: [] },
  { contract: 'exclusion: no drag and drop', contractClass: 'exclusion', status: 'not-applicable', tests: [] },
  ...extra,
]
const GC_SOURCES = { frd: 'a'.repeat(64), blueprint: 'b'.repeat(64) }
const gcInv = (frd, over = {}) => JSON.stringify({ version: 1, frd, gatedAt: 'abc1234', sources: GC_SOURCES, writtenAt: '2026-09-25T00:00:00Z', contracts: gcTrace(), ...over })
const gcCheck = (frd, inventory, sources = GC_SOURCES) => ({ prefix: 'gate-inventory:', response: { output: JSON.stringify({ ok: true, frd, pin: 'abc1234', sources, inventoryPath: `.pandacorp/run/gate-evidence/${frd}/inventory.json`, inventory }) } })
const gcHasBlock = (p) => /CACHED WHOLE-FRD INVENTORY — FRD baseline gated at/.test(p)

SCENARIOS.push({
  name: 'GC-L3a. BL-0189 — flag OFF (default): zero inventory spawns, no cache block, no LAST STEP in the apply (the historical path)',
  args: { mode: 'pro' },
  plan: b178Plan('frd-93-off', 'wo-93-001'),
  responses: [{ prefix: 'gate:', response: { green: true, traceability: gcTrace() } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^gate-inventory:/).length === 0, 'no gate-inventory spawn')
    const apply = byLabel(run, 'apply-gate:frd-93-off')[0]
    t.ok(apply && !/BL-0189/.test(apply.prompt), 'the apply prompt carries no cache write')
    t.ok(byLabel(run, 'gate:frd-93-off').every((g) => !gcHasBlock(g.prompt)), 'no cached inventory in the gate prompt')
  },
})
SCENARIOS.push({
  name: 'GC-L3b. BL-0189 — MISS (absent): the full inventory runs; the GREEN landing is asked to write the cache with a digest the script\'s own FNV-1a reproduces',
  args: { mode: 'pro', gateInventoryCache: true },
  plan: b178Plan('frd-93-miss', 'wo-93-001'),
  responses: [
    gcCheck('frd-93-miss', null),
    { prefix: 'gate:', response: { green: true, traceability: gcTrace() } },
    { prefix: 'apply-gate:', response: { done: true, inventory_output: JSON.stringify({ ok: true, path: '.pandacorp/run/gate-evidence/frd-93-miss/inventory.json', entries: 8, gatedAt: 'abc1234' }) } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const chk = byLabel(run, 'gate-inventory:frd-93-miss')[0]
    const gate = byLabel(run, 'gate:frd-93-miss')[0]
    t.ok(chk && gate && chk.index < gate.index && chk.opts.model === 'haiku' && chk.opts.effort === 'low', 'the MECH check runs BEFORE the gate, on the cheap tier')
    t.ok(chk && /gate-inventory\.mjs' check --project/.test(chk.prompt), 'the check runs the installed gate-inventory.mjs next to the state CLI')
    t.ok(gate && !gcHasBlock(gate.prompt) && /Whole-FRD source oracle/.test(gate.prompt), 'a miss is the full whole-FRD inventory (no cache block)')
    t.ok(hasLog(run, /no cached contract inventory yet/), 'the miss is logged as ABSENT, never as an empty inventory')
    const apply = byLabel(run, 'apply-gate:frd-93-miss')[0]
    const cmd = apply && (apply.prompt.match(/```sh\n\s*([\s\S]*?)\n\s*```/) || [])[1]
    t.ok(Boolean(cmd) && /gate-inventory\.mjs' write --project/.test(cmd), 'the certifying landing (the single writer) carries the write as its LAST STEP')
    const digest = cmd && (cmd.match(/--digest ([0-9a-f]{8})/) || [])[1]
    const quoted = cmd && (cmd.match(/--contracts '([\s\S]*)'$/) || [])[1]
    const json = quoted && quoted.replaceAll(`'"'"'`, "'")
    t.ok(Boolean(json) && gcFnv1a(json) === digest, 'the engine\'s digest equals gate-inventory.mjs\'s FNV-1a of the exact JSON (the two implementations agree)')
    const parsed = json ? JSON.parse(json) : []
    t.ok(parsed.length === gcTrace().length && parsed.some((e) => /ACTIVE_PHASES/.test(e.contract)), 'the payload is the green verdict\'s full adjudicated traceability')
    t.ok(hasLog(run, /contract inventory cached \(8 contracts/), 'the landing\'s receipt is read back and logged')
  },
})
SCENARIOS.push({
  name: 'GC-L3c. BL-0189 — HIT: the gate gets the cached inventory (deep-review the cycle, re-run the rest\'s evidence, sample), frd.md is read by section, and the oracle text is intact',
  args: { mode: 'pro', gateInventoryCache: true, gateContextScope: true },
  plan: b178Plan('frd-93-hit', 'wo-93-001'),
  responses: [gcCheck('frd-93-hit', gcInv('frd-93-hit')), { prefix: 'gate:', response: { green: true, traceability: gcTrace() } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-93-hit')[0]
    t.ok(gate && gcHasBlock(gate.prompt) && gate.prompt.includes('abc1234'), 'the cached inventory (gated at abc1234) is injected')
    t.ok(gate && gate.prompt.includes('acceptance-criterion | pass | AC-93-001.1 — an empty column is announced | src/b/_tests/a.test.ts'), 'as compact rows: class | status | contract | evidence tests')
    t.ok(gate && /DEEP-REVIEW every contract this cycle's work orders \(wo-93-001\)/.test(gate.prompt) && /re-run its recorded evidence tests BY PATH/.test(gate.prompt) && /SAMPLE of at least 3/.test(gate.prompt), 'deep review of the cycle, by-path evidence re-run of the rest, plus a sample')
    t.ok(gate && /return EVERY contract below in `traceability`/.test(gate.prompt) && /Whole-FRD source oracle/.test(gate.prompt), 'the verdict must still be the COMPLETE traceability; the oracle text is still there')
    t.ok(gate && /engine-verified CACHED INVENTORY above stands in for a whole-file re-read/.test(gate.prompt) && !/READ IN FULL: `docs\/frds\/frd-93-hit\/frd\.md`/.test(gate.prompt), 'with the scope directive, frd.md is read by section on a verified hit')
    t.ok(hasLog(run, /cached contract inventory HIT/), 'the hit is logged')
    t.ok(run.result && run.result.builtFrds.includes('frd-93-hit'), 'a verdict covering every cached contract verifies')
  },
})
SCENARIOS.push({
  name: 'GC-L3d. BL-0189 — HIT, but the green verdict DROPS a cached AC: refused, re-asked WITHOUT the cache, and only the complete verdict lands',
  args: { mode: 'pro', gateInventoryCache: true },
  plan: b178Plan('frd-93-drop', 'wo-93-001'),
  responses: [
    gcCheck('frd-93-drop', gcInv('frd-93-drop')),
    { label: 'gate:frd-93-drop', times: 1, response: { green: true, traceability: gcTrace().filter((e) => !/AC-93-002\.1/.test(e.contract)) } },
    { prefix: 'gate:', response: { green: true, traceability: gcTrace() } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gates = byLabel(run, 'gate:frd-93-drop')
    t.ok(gates.length === 2, `the dropped-contract verdict was re-asked exactly once (got ${gates.length} gates)`)
    t.ok(gates[0] && gcHasBlock(gates[0].prompt) && gates[1] && !gcHasBlock(gates[1].prompt), 'the re-ask runs WITHOUT the cache (a full whole-FRD inventory)')
    t.ok(gates[1] && /AC-93-002\.1/.test(gates[1].prompt), 'the re-ask names the dropped contract')
    t.ok(hasLog(run, /DROPPED 1 cached contract\(s\).*AC-93-002\.1/), 'the drop is logged by id')
    t.ok(byLabel(run, 'apply-gate:frd-93-drop').length === 1 && run.result.builtFrds.includes('frd-93-drop'), 'only the complete re-asked verdict is applied')
  },
})
SCENARIOS.push({
  name: 'GC-L3e. BL-0189 — STALE (frd.md body changed since gatedAt) and MALFORMED (bad JSON / a missing class) caches are never used; malformed is logged LOUD',
  args: { mode: 'pro', gateInventoryCache: true },
  plan: mkPlan(['frd-93-stale', 'frd-93-badjson', 'frd-93-noclass'].map((frd, i) => ({ frd, deps: [], workOrders: [mkWo(`wo-93-10${i}`, 'PLANNED', { frd, artifacts: [`src/${frd}/**`] })] }))),
  responses: [
    { label: 'gate-inventory:frd-93-stale', response: gcCheck('frd-93-stale', gcInv('frd-93-stale'), { frd: 'c'.repeat(64), blueprint: GC_SOURCES.blueprint }).response },
    { label: 'gate-inventory:frd-93-badjson', response: gcCheck('frd-93-badjson', '{"version":1,"frd":"frd-93-badjson",').response },
    { label: 'gate-inventory:frd-93-noclass', response: gcCheck('frd-93-noclass', gcInv('frd-93-noclass', { contracts: gcTrace().filter((e) => e.contractClass !== 'exclusion') })).response },
    { prefix: 'gate:', response: { green: true, traceability: gcTrace() } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    for (const frd of ['frd-93-stale', 'frd-93-badjson', 'frd-93-noclass']) {
      const gate = byLabel(run, `gate:${frd}`)[0]
      t.ok(gate && !gcHasBlock(gate.prompt), `${frd}: no cached inventory reaches the gate`)
      t.ok(run.result && run.result.builtFrds.includes(frd), `${frd}: the full-oracle gate still verifies it`)
    }
    t.ok(hasLog(run, /frd-93-stale: cached contract inventory is STALE — frd\.md changed normatively since abc1234/), 'stale: logged with WHICH doc changed')
    t.ok(hasLog(run, /⊘ frd-93-badjson: MALFORMED cached contract inventory .*not valid JSON/), 'malformed JSON: logged LOUD (⊘), never read as empty')
    t.ok(hasLog(run, /⊘ frd-93-noclass: MALFORMED cached contract inventory .*missing contractClass: exclusion/), 'malformed shape: logged LOUD with the defect')
  },
})

SCENARIOS.push({
  name: 'GC-L3g. BL-0189 — an apply that does NOT land keeps the cache candidate: the re-apply (BL-0185a path) still carries the write, and it is written once',
  args: { mode: 'pro', gateInventoryCache: true },
  plan: b178Plan('frd-93-reapply', 'wo-93-001'),
  responses: [
    gcCheck('frd-93-reapply', null),
    { prefix: 'gate:', response: { green: true, traceability: gcTrace() } },
    { label: 'apply-gate:frd-93-reapply', times: 1, response: { done: false, failure: 'index.lock' } },
    { prefix: 'apply-gate:', response: { done: true, inventory_output: JSON.stringify({ ok: true, entries: 8, gatedAt: 'abc1234' }) } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const applies = byLabel(run, 'apply-gate:frd-93-reapply')
    t.ok(applies.length === 2 && applies.every((a) => /LAST STEP \(BL-0189/.test(a.prompt)), `both apply attempts carry the cache write (got ${applies.length})`)
    t.ok(run.logs.filter((l) => /contract inventory cached/.test(l)).length === 1 && !hasLog(run, /cache was NOT written/), 'the failed apply is not misreported as a failed cache write; the landed one is recorded once')
    t.ok(run.result && run.result.builtFrds.includes('frd-93-reapply'), 'the FRD verifies on the re-apply')
  },
})

// ── BL-0189 · the REAL round trip: the landing writes through gate-inventory.mjs, the next gate checks it ──
{
  const frd = 'frd-94-real'
  const fx = gcNestedFixture(frd)
  const runReal = (call, re) => { const cmd = (call.prompt.match(re) || [])[1]; return cmd ? gcBash(cmd, fx.app) : { ok: false, out: '' } }
  const realArgs = { mode: 'pro', gateInventoryCache: true, projectDir: fx.app, project: 'mission-control', stateCli: gcRealStateCli }
  const checkReal = { prefix: 'gate-inventory:', response: (call) => ({ output: runReal(call, /return its stdout VERBATIM as `output`: `([^`]+)`/).out }) }
  const applyReal = { prefix: 'apply-gate:', response: (call) => ({ done: true, inventory_output: runReal(call, /```sh\n\s*([\s\S]*?)\n\s*```/).out }) }
  const greenGate = { prefix: 'gate:', response: { green: true, traceability: gcTrace() } }
  SCENARIOS.push({
    name: 'GC-L3f1. BL-0189 real round trip — 1st gate: real check → absent (miss); the landing\'s real write (shell-quoted JSON with quotes, backticks and $) is accepted and lands on disk',
    args: realArgs,
    plan: mkPlan([{ frd, deps: [], workOrders: [mkWo('wo-94-001', 'PLANNED', { frd, artifacts: ['src/app/board/**'] })] }]),
    responses: [{ prefix: 'commit:', response: { committed: 1, sha: fx.pin } }, checkReal, greenGate, applyReal],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(hasLog(run, /no cached contract inventory yet/), 'the real check reported the cache absent')
      const file = path.join(fx.app, `.pandacorp/run/gate-evidence/${frd}/inventory.json`)
      const inv = gcFs.existsSync(file) ? JSON.parse(gcFs.readFileSync(file, 'utf8')) : null
      t.ok(inv && inv.gatedAt === fx.pin && inv.contracts.length === gcTrace().length, 'the real write persisted the inventory, gatedAt = the gate\'s pin')
      t.ok(inv && inv.contracts.some((e) => e.contract === gcTrace()[2].contract), 'the quote/backtick/$ contract text survived the shell round trip byte-for-byte')
      t.ok(hasLog(run, /contract inventory cached \(8 contracts, gated at /), 'the engine read the real receipt')
      t.ok(gcGit(fx.repo, 'status', '--porcelain') === '', 'the cache is gitignored run-state: the main tree stays clean')
    },
  })
  SCENARIOS.push({
    name: 'GC-L3f2. BL-0189 real round trip — next gate of the SAME FRD, unchanged docs: the real check yields a HIT and the prompt carries the cached rows',
    args: realArgs,
    plan: mkPlan([{ frd, deps: [], workOrders: [mkWo('wo-94-001', 'IN_REVIEW', { frd, artifacts: ['src/app/board/**'] })] }]),
    responses: [{ prefix: 'pin:', response: { sha: fx.pin } }, checkReal, greenGate, applyReal],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const gate = byLabel(run, `gate:${frd}`)[0]
      t.ok(hasLog(run, /cached contract inventory HIT/) && gate && gcHasBlock(gate.prompt), 'HIT: the cached inventory reaches the gate')
      t.ok(gate && gate.prompt.includes('AC-93-002.1 — the owner\'s `ACTIVE_PHASES` filter costs $0'), 'the cached rows are the persisted contracts, verbatim')
    },
  })
  SCENARIOS.push({
    name: 'GC-L3f3. BL-0189 real round trip — after a normative frd.md edit (committed), the real check makes it STALE (the frontmatter-only case is proven in test-gate-inventory.mjs)',
    args: realArgs,
    plan: mkPlan([{ frd, deps: [], workOrders: [mkWo('wo-94-001', 'IN_REVIEW', { frd, artifacts: ['src/app/board/**'] })] }]),
    responses: [{ prefix: 'pin:', response: () => {
      gcWrite(path.join(fx.app, `docs/frds/${frd}/frd.md`), '---\nimplementation_status: VERIFIED\n---\n# FRD\n\nREQ-90-001 The board SHALL mark AND announce an empty column.\n')
      gcGit(fx.repo, 'add', '-A'); gcGit(fx.repo, 'commit', '-qm', 'spec change')
      return { sha: gcGit(fx.repo, 'rev-parse', 'HEAD') }
    } }, checkReal, greenGate, applyReal],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const gate = byLabel(run, `gate:${frd}`)[0]
      t.ok(hasLog(run, /cached contract inventory is STALE — frd\.md changed normatively/) && gate && !gcHasBlock(gate.prompt), 'STALE: the gate runs the full whole-FRD inventory')
      for (const r of gcCleanups.splice(0)) gcFs.rmSync(r, { recursive: true, force: true })
    },
  })
}

// ---- D1 parallelGates ----
// proposal 38 Decision 1 + its red-team addendum (BL-0186): args.parallelGates runs up to `gateSlots` FRD gates
// at once, each in its own gate worktree `gate-worktree-<k>` (explicit e2e port 3800+10k); a gate runs only if
// its FRD neither depends on nor is depended on by an FRD whose verdict has not landed, and its artifacts are
// disjoint (DR-060); verdicts land on main ONE at a time in arrival order (the lane), with a stale-pin guard.
// CONCURRENCY IS OBSERVED, not assumed: a gate's response is a promise the scenario resolves itself (a
// controller), so "N gates started before the first result" is a fact of the recorded timeline. Every
// deferred verdict also resolves on a short timer, so a SERIAL engine (the pre-D1 one, the RED baseline)
// cannot hang the suite — it just fails the concurrency assertions.
const d1Resume = (tag, n, artifactsOf = (k) => [`src/${tag}${k}/**`]) => mkPlan(Array.from({ length: n }, (_, i) => {
  const k = i + 1
  return { frd: `frd-${tag}-${k}`, deps: [], workOrders: [mkWo(`wo-${tag}-${k}`, 'IN_REVIEW', { frd: `frd-${tag}-${k}`, artifacts: artifactsOf(k) })] }
}))
function d1Harness({ order = [], autoFlushAt = Infinity, verdicts = {}, staleCounts = [], fallbackMs = 5, onStart = {} } = {}) {
  const tl = []
  const pending = new Map()
  const lane = { active: 0, max: 0 }
  let started = 0
  let staleIdx = 0
  const thrown = new Set()
  const release = (frd) => { const r = pending.get(frd); if (r) { pending.delete(frd); r() } }
  const flush = (list) => { for (const frd of list) release(frd) }
  const seen = new Set()
  const gate = (call) => {
    const frd = call.label.slice('gate:'.length)
    const repeat = seen.has(frd)   // a later gate of the same FRD (a re-gate on main) answers on the next macrotask
    seen.add(frd)
    tl.push(`start:${frd}`)
    started++
    const v = verdicts[frd]
    const deferred = new Promise((resolve, reject) => {
      const done = () => {
        tl.push(`result:${frd}`)
        if (v && v.throws && !thrown.has(frd)) { thrown.add(frd); return reject(new Error(v.throws)) }   // throws ONCE (the crash); a later re-gate of that FRD answers green
        const verdict = typeof v === 'function' ? v(call) : ((v && !v.throws) ? v : { green: true })
        resolve('traceability' in verdict ? verdict : { ...verdict, traceability: validTraceability })
      }
      pending.set(frd, done)
      // a MACROtask: every started gate has subscribed to its own promise by then, so the resolution order
      // below IS the arrival order the engine sees (a synchronous flush would race the runner's own adoption)
      if (started === autoFlushAt) setTimeout(() => flush(order), 0)
      if (onStart[frd]) setTimeout(() => onStart[frd]({ flush }), 0)
      setTimeout(() => release(frd), repeat ? 0 : fallbackMs)
    })
    // The runner adds a default traceability to an OBJECT gate answer by spreading it — which would flatten a
    // promise into {}. Mark this one as carrying its own (the resolved verdict does, above).
    deferred.traceability = undefined
    return deferred
  }
  const writer = (value) => async (call) => {
    lane.active++; lane.max = Math.max(lane.max, lane.active)
    tl.push(`start:${call.label}`)
    await new Promise((r) => setTimeout(r, 1))
    tl.push(`end:${call.label}`)
    lane.active--
    return typeof value === 'function' ? value(call) : value
  }
  const responses = [
    { label: /^gate:/, response: gate },
    { prefix: 'gate-worktree:', response: { ok: true, created: true } },
    { prefix: 'stale-pin:', response: writer(() => ({ count: staleCounts.length ? staleCounts[Math.min(staleIdx++, staleCounts.length - 1)] : 0 })) },
    { prefix: 'reverify:', response: writer({ green: true, report_scope: 'since' }) },
    { prefix: 'apply-gate:', response: writer({ done: true }) },
    { prefix: 'persist-block:', response: writer({ done: true }) },
    { prefix: 'port-reviewer-tests:', response: writer((call) => promptAwareDefault(call)) },
    { prefix: 'patch:', response: writer({ green: true }) },
    { prefix: 'verify-patch:', response: writer({ green: true }) },
    { prefix: 'certify-patch:', response: writer({ done: true }) },
    { prefix: 'unport-reviewer-tests:', response: writer((call) => ({ removed: JSON.parse((call.prompt.match(/EXPECTED \(JSON\): (\[.*?\])\. Return/) || [0, '[]'])[1]).map((x) => x.path), kept: [] })) },
  ]
  const at = (tag) => tl.indexOf(tag)
  return { tl, lane, responses, at, flush, release }
}
const d1Slot = (call) => ((call && call.prompt.match(/GATE WORKTREE (\S+gate-worktree(?:-\d+)?) /)) || [])[1] || null

// (a) three disjoint FRDs → three gates in flight at once; landings serialized, in ARRIVAL order.
{
  const h = d1Harness({ order: ['frd-d1a-3', 'frd-d1a-1', 'frd-d1a-2'], autoFlushAt: 3 })
  SCENARIOS.push({
    name: 'D1a. parallelGates (gateSlots 3) — 3 disjoint FRDs: 3 gates STARTED before the first result, each in its own slot; verdicts land ONE at a time in arrival order (3 → 1 → 2)',
    args: { mode: 'pro', parallelGates: true, gateSlots: 3 },
    plan: d1Resume('d1a', 3),
    responses: h.responses,
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const firstResult = h.tl.findIndex((x) => x.startsWith('result:'))
      t.ok(['frd-d1a-1', 'frd-d1a-2', 'frd-d1a-3'].every((f) => h.at(`start:${f}`) >= 0 && h.at(`start:${f}`) < firstResult), `all 3 gates started before the first verdict (timeline: ${h.tl.slice(0, 6).join(' ')})`)
      const slots = ['frd-d1a-1', 'frd-d1a-2', 'frd-d1a-3'].map((f) => d1Slot(byLabel(run, `gate:${f}`)[0]))
      t.ok(slots.every(Boolean) && new Set(slots).size === 3 && slots.every((x, i) => x.endsWith(`gate-worktree-${i + 1}`)), `each gate ran in its OWN slot (FIFO → slot 1, 2, 3): ${slots.join(', ')}`)
      const applies = byLabel(run, /^apply-gate:/).map((c) => c.label)
      t.ok(JSON.stringify(applies) === JSON.stringify(['apply-gate:frd-d1a-3', 'apply-gate:frd-d1a-1', 'apply-gate:frd-d1a-2']), `landings in ARRIVAL order (got ${applies.join(', ')})`)
      t.ok(h.lane.max === 1, `the landing lane never ran two main-tree writers at once (max ${h.lane.max})`)
      t.ok(byLabel(run, /^stale-pin:/).length === 3 && byLabel(run, /^reverify:/).length === 0, 'every PASS landing asked the stale-pin guard once; no code moved (count 0) → no re-verify')
      t.ok(byLabel(run, /^gate-release:/).length === 3 && byLabel(run, /^gate-release:/).every((c) => /gate-worktree-\d/.test(c.prompt)), 'each gate released (salvage + exact clean) ITS OWN slot')
      t.ok(!hasLog(run, /legacy synchronous gate path/i) && hasLog(run, /D1: PARALLEL FRD gates/), 'the pool ran — never the legacy path')
      t.ok(run.result && ['frd-d1a-1', 'frd-d1a-2', 'frd-d1a-3'].every((f) => run.result.builtFrds.includes(f)), 'all three FRDs VERIFIED')
    },
  })
}
// (b) an FRD that DEPENDS on one whose verdict has not landed may GATE, but it LANDS after that verdict (E2 finding 1
// replaced the launch deferral: red-team R6 is caught at the landing, where the stale-pin guard sees the upstream).
{
  const h = d1Harness()
  SCENARIOS.push({
    name: 'D1b. parallelGates — frd-b depends on frd-a (cross-FRD dependsOn): its gate is NOT deferred for frd-a\'s verdict, but it LANDS only after frd-a (E2 finding 1; red-team R6 moves to the landing)',
    args: { mode: 'pro', parallelGates: true },
    plan: mkPlan([
      { frd: 'frd-d1b-a', deps: [], workOrders: [mkWo('wo-d1b-a1', 'PLANNED', { frd: 'frd-d1b-a', artifacts: ['src/d1ba/**'] })] },
      { frd: 'frd-d1b-b', deps: [], workOrders: [mkWo('wo-d1b-b1', 'PLANNED', { frd: 'frd-d1b-b', artifacts: ['src/d1bb/**'], deps: ['wo-d1b-a1'] })] },
    ]),
    responses: [distinctCommitShas, ...h.responses],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(!hasLog(run, /gate for frd-d1b-b deferred: depends on frd-d1b-a \(verdict not landed yet\)/), 'no launch deferral for an upstream whose gate is already running')
      t.ok(hasLog(run, /frd-d1b-b: repair brake on agent-weight, usage unreliable — 1 parallel gate\(s\) were reviewing during its build wave/), 'BL-0138: the wave that built frd-b ran alongside frd-a\'s gate → its build-token total is never trusted (loud agent-weight fallback)')
      t.ok(h.at('start:stale-pin:frd-d1b-b') > h.at('end:apply-gate:frd-d1b-a') && h.at('end:apply-gate:frd-d1b-a') > 0, `frd-b LANDED only after frd-a landed (timeline: ${h.tl.join(' ')})`)
      t.ok(run.result && run.result.builtFrds.includes('frd-d1b-a') && run.result.builtFrds.includes('frd-d1b-b'), 'both verify')
    },
  })
}
// (c) overlapping artifacts → queued; a disjoint third FRD still runs alongside.
{
  const h = d1Harness({ order: ['frd-d1c-1', 'frd-d1c-3'], autoFlushAt: 2 })
  SCENARIOS.push({
    name: 'D1c. parallelGates — two FRDs whose artifacts OVERLAP never gate together (DR-060); a disjoint third one does',
    args: { mode: 'pro', parallelGates: true },
    plan: d1Resume('d1c', 3, (k) => (k === 3 ? ['src/d1c3/**'] : ['src/shared/**'])),
    responses: h.responses,
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(hasLog(run, /gate for frd-d1c-2 deferred: artifacts overlap frd-d1c-1 \(DR-060\)/), 'the overlap deferral is logged')
      t.ok(h.at('start:frd-d1c-3') < h.at('result:frd-d1c-1'), 'the disjoint frd-3 gated alongside frd-1')
      t.ok(h.at('start:frd-d1c-2') > h.at('end:apply-gate:frd-d1c-1'), 'the overlapping frd-2 gated only after frd-1 landed')
      t.ok(run.result && run.result.builtFrds.length === 3, 'all three verify')
    },
  })
}
// (d) budget: a second concurrent gate that would not fit maxAgents (gate + one landing) is deferred, loudly.
{
  const h = d1Harness()
  SCENARIOS.push({
    name: 'D1d. parallelGates — maxAgents cannot cover a SECOND concurrent opus gate + its landing → `gate deferred: agent budget`, gates run one at a time (the first always runs)',
    // pre-loop: precheck 1 + baseline 3 + plan 3 + pin 1 = 8; gate 1 reserves 5 and its probe is charged (9):
    // 20 − 9 − 5 = 6 < 5 + 2 → the second gate waits. With nothing in flight the next one always starts.
    args: { mode: 'pro', parallelGates: true, maxAgents: 20 },
    plan: d1Resume('d1d', 3),
    responses: h.responses,
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(hasLog(run, /gate for frd-d1d-2 deferred: agent budget/), 'the budget deferral is logged explicitly')
      t.ok(h.at('start:frd-d1d-2') > h.at('result:frd-d1d-1'), `the second gate started only after the first returned (timeline: ${h.tl.join(' ')})`)
      t.ok(run.result && run.result.builtFrds.includes('frd-d1d-1'), 'the first gate ran and landed (progress guarantee)')
    },
  })
}
// (e1) main advanced in CODE since the pin → re-verify with verify.sh --since <pin> (tests ported first) → land.
{
  const h = d1Harness({ order: ['frd-d1e-1', 'frd-d1e-2'], autoFlushAt: 2, staleCounts: [0, 1], verdicts: { 'frd-d1e-2': { green: true, testFiles: ['src/d1e2/_tests/x.reviewer.test.ts'] } } })
  SCENARIOS.push({
    name: 'D1e1. parallelGates — the 2nd PASS lands after the 1st committed code: stale-pin count 1 → port reviewer tests FIRST, verify.sh --since <pin> on main, then apply',
    args: { mode: 'pro', parallelGates: true },
    plan: d1Resume('d1e', 2),
    responses: h.responses,
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const sp = byLabel(run, 'stale-pin:frd-d1e-2')[0]
      t.ok(sp && /rev-list --count pinsha0\.\.HEAD -- \. ':\(exclude\)\.pandacorp' ':\(exclude\)docs'/.test(sp.prompt) && sp.opts.agentType === 'pandacorp:mech', 'the guard counts CODE commits since the pin via a MECH (everything but .pandacorp/ and docs/)')
      const rv = byLabel(run, 'reverify:frd-d1e-2')[0]
      t.ok(rv && /verify\.sh --since pinsha0/.test(rv.prompt) && !/verify\.sh --since pinsha0 --only|--files=/.test(rv.prompt), 're-verified with verify.sh --since <pin>, never scoped')
      t.ok(rv && rv.prompt.indexOf('PORT FIRST') >= 0 && rv.prompt.indexOf('PORT FIRST') < rv.prompt.indexOf('verify.sh --since') && /gate-evidence\/frd-d1e-2\/<path>/.test(rv.prompt), 'the reviewer\'s tests are ported from the evidence dir BEFORE the re-run (X4)')
      t.ok(rv && /run EACH of the reviewer's test files explicitly by path/i.test(rv.prompt), 'the ported reviewer tests run by path on the landing tree')
      t.ok(byLabel(run, 'reverify:frd-d1e-1').length === 0, 'the 1st landing (count 0) needed no re-verify')
      t.ok(h.at('end:reverify:frd-d1e-2') < h.at('start:apply-gate:frd-d1e-2'), 'stamped only after the re-verify')
      t.ok(run.result && run.result.builtFrds.includes('frd-d1e-2') && byLabel(run, /^patch:/).length === 0, 'green re-verify → lands VERIFIED, no patch')
    },
  })
}
// (e2) … and a RED re-verify turns the PASS into a REOPEN that goes down the normal ladder.
{
  const h = d1Harness({ order: ['frd-d1f-1', 'frd-d1f-2'], autoFlushAt: 2, staleCounts: [0, 2], verdicts: { 'frd-d1f-2': { green: true, testFiles: ['src/d1f2/_tests/x.reviewer.test.ts'] } } })
  SCENARIOS.push({
    name: 'D1e2. parallelGates — the landing re-verify is RED → the PASS becomes a REOPEN: reviewer tests ported + pinned, patch-first, independent verify (never stamped over the red combination)',
    args: { mode: 'pro', parallelGates: true },
    plan: d1Resume('d1f', 2),
    responses: [{ prefix: 'reverify:', response: { green: false, report_scope: 'since', failure: 'tsc: TS2322 in src/d1f1/x.ts:4 — the two landings disagree on a type' } }, ...h.responses],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(hasLog(run, /frd-d1f-2: D1 stale-pin guard[\s\S]*RED[\s\S]*converted into a REOPEN/), 'the conversion is logged')
      t.ok(byLabel(run, 'apply-gate:frd-d1f-2').length === 0, 'NEVER applied over the red combination')
      const patch = byLabel(run, 'patch:frd-d1f-2')[0]
      t.ok(patch && /D1 stale-pin guard/.test(patch.prompt) && /TS2322/.test(patch.prompt), 'the patch is handed the re-verify failure as its finding')
      t.ok(h.at('start:port-reviewer-tests:frd-d1f-2') >= 0 && h.at('start:port-reviewer-tests:frd-d1f-2') < h.at('start:patch:frd-d1f-2'), 'the reviewer tests were ported + sha256-pinned before the patch (BL-0184)')
      t.ok(byLabel(run, 'verify-patch:frd-d1f-2').length === 1 && run.result && run.result.builtFrds.includes('frd-d1f-2'), 'VERIFIED only through the independent post-patch verifier')
      t.ok(byLabel(run, /^unport-reviewer-tests:/).length === 0, 'a certified landing committed the ported tests — no cleanup')
    },
  })
}
// (f) needs-owner in slot 2 lands while slots 1 and 3 are still reviewing; they land after it.
{
  const h = d1Harness({ order: ['frd-d1g-2'], autoFlushAt: 3, verdicts: { 'frd-d1g-2': { green: false, reopen: [], blocked_reason: 'needs-owner', failure: 'AC-12-004 contradicts the blueprint — the owner must decide' } } })
  const persist = h.responses.find((r) => r.prefix === 'persist-block:')
  const inner = persist.response
  persist.response = async (call) => { const r = await inner(call); h.flush(['frd-d1g-1', 'frd-d1g-3']); return r }
  SCENARIOS.push({
    name: 'D1f. parallelGates (gateSlots 3) — a needs-owner BLOCK in slot 2 is persisted while slots 1 and 3 are STILL reviewing (no quiesce); 1 and 3 then land VERIFIED',
    args: { mode: 'pro', parallelGates: true, gateSlots: 3 },
    plan: d1Resume('d1g', 3),
    responses: h.responses,
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(d1Slot(byLabel(run, 'gate:frd-d1g-2')[0]).endsWith('gate-worktree-2'), 'the blocking gate ran in slot 2')
      t.ok(h.at('end:persist-block:frd-d1g-2') < h.at('result:frd-d1g-1') && h.at('end:persist-block:frd-d1g-2') < h.at('result:frd-d1g-3'), `the block landed while 1 and 3 were still in flight (timeline: ${h.tl.join(' ')})`)
      const pb = byLabel(run, 'persist-block:frd-d1g-2')[0]
      t.ok(pb && /No gate-worktree salvage here \(D1/.test(pb.prompt) && !/gate-worktree status --porcelain|clean -f --/.test(pb.prompt), 'persist-block never salvages/cleans a slot another gate may occupy')
      t.ok(run.result && run.result.blockedFrds.includes('frd-d1g-2') && run.result.builtFrds.includes('frd-d1g-1') && run.result.builtFrds.includes('frd-d1g-3'), 'frd-2 BLOCKED (terminal for it); 1 and 3 VERIFIED')
      t.ok(h.lane.max === 1, 'landings stayed serialized')
    },
  })
}
// (g) a gate that CRASHES frees its slot in `finally` (salvaged + cleaned) and the run goes on.
{
  const dirt = new Map()   // slot path -> Set of untracked paths (a stateful per-slot worktree model)
  const bag = (p) => { if (!dirt.has(p)) dirt.set(p, new Set()); return dirt.get(p) }
  const h = d1Harness({ order: ['frd-d1h-1'], autoFlushAt: 2, verdicts: { 'frd-d1h-1': { throws: 'terminal API error mid-review' } }, fallbackMs: 200, onStart: { 'frd-d1h-3': ({ flush }) => flush(['frd-d1h-2', 'frd-d1h-3']) } })
  const gateR = h.responses[0].response
  SCENARIOS.push({
    name: 'D1g. parallelGates (2 slots) — a gate CRASHES in slot 1: its release still salvages + cleans the slot (finally), the queued 3rd FRD takes slot 1 while slot 2 is still reviewing, and the run completes',
    args: { mode: 'pro', parallelGates: true, gateSlots: 2 },
    plan: d1Resume('d1h', 3),
    responses: [
      { label: /^gate:/, response: (call) => { const slot = d1Slot(call); if (slot) bag(slot).add(`src/${call.label.slice(5)}/_tests/x.reviewer.test.ts`); return gateR(call) } },
      { prefix: 'gate-worktree:', response: (call) => { const slot = (call.prompt.match(/checkout at (\S+) pinned/) || [])[1]; return bag(slot).size ? { ok: false, failure: 'gate worktree is dirty, orphaned, unregistered, or ambiguous; evidence preserved', dirty: [...bag(slot)].map((x) => `?? ${x}`) } : { ok: true, created: false } } },
      { prefix: 'gate-release:', response: (call) => { const slot = (call.prompt.match(/finished in the gate worktree (\S+);/) || [])[1]; const salvaged = [...bag(slot)].map((x) => ({ path: x, status: 'untracked', sha256: `sha-${x}` })); bag(slot).clear(); return { salvaged, remaining: [] } } },
      ...h.responses.slice(1),
    ],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const rel = byLabel(run, 'gate-release:frd-d1h-1')[0]
      t.ok(rel && /gate-worktree-1;/.test(rel.prompt), 'the crashed gate\'s slot was released (finally)')
      const g3 = byLabel(run, 'gate:frd-d1h-3')[0]
      t.ok(g3 && d1Slot(g3).endsWith('gate-worktree-1'), 'the 3rd FRD reused slot 1 — freed by the crash, proven clean')
      t.ok(h.at('start:frd-d1h-3') < h.at('result:frd-d1h-2'), 'it started while slot 2 was still reviewing')
      t.ok(!hasLog(run, /dropped from the parallel pool|legacy synchronous gate path/i), 'no slot left the pool, no legacy fallback')
      t.ok([...dirt.values()].every((b) => b.size === 0), 'every slot ends clean')
      t.ok(run.result && ['frd-d1h-1', 'frd-d1h-2', 'frd-d1h-3'].every((f) => run.result.builtFrds.includes(f)), 'the crashed FRD recovers through the normal repair path; the run completes')
    },
  })
}
// (h) flag OFF → the C2 topology, untouched (the byte-level proof is the differential run in BL-0186).
for (const [label, flag] of [['absent', undefined], ['false', false], ['"false" string', 'false']]) {
  const tag = `d1i${label.length}`
  SCENARIOS.push({
    name: `D1h-${label}. parallelGates ${label} → single C2 worktree, one mutex chain, no D1 spawn (gate-worktree, never gate-worktree-<k>; no stale-pin/reverify)`,
    args: { mode: 'pro', ...(flag === undefined ? {} : { parallelGates: flag }), ...(label === 'false' ? { gateSlots: 2 } : {}) },
    plan: twoPinPlan(tag),
    responses: [distinctCommitShas],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const gates = byLabel(run, /^gate:/)
      t.ok(gates.length === 2 && gates.every((g) => /gate-worktree /.test(g.prompt) && !/gate-worktree-\d/.test(g.prompt)), 'both gates ran in the single C2 worktree')
      t.ok(byLabel(run, /^(gate-worktree:|stale-pin:|reverify:)/).length === 0 && byLabel(run, 'gate-worktree').length >= 1, 'only the legacy probe label; no D1 spawn')
      t.ok(!hasLog(run, /D1: /) || (label === 'false' && hasLog(run, /ignored — args\.parallelGates is off/)), 'no D1 log (gateSlots without the flag is only reported as ignored)')
      t.ok(run.result && run.result.builtFrds.length === 2, 'both FRDs verify')
    },
  })
}
// (i) one EXPLICIT e2e port per slot (the path hash can collide — even with main's 3900); pool size args.
SCENARIOS.push({
  name: 'D1i. parallelGates (gateSlots 3) — each slot is bootstrapped with its OWN explicit PANDACORP_E2E_PORT (3810/3820/3830), distinct paths, label gate-worktree:<k>',
  args: { mode: 'pro', parallelGates: true, gateSlots: 3 },
  plan: d1Resume('d1j', 3),
  responses: d1Harness({ order: ['frd-d1j-1', 'frd-d1j-2', 'frd-d1j-3'], autoFlushAt: 3 }).responses,
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const probes = byLabel(run, /^gate-worktree:\d$/)
    const ports = probes.map((c) => (c.prompt.match(/PANDACORP_E2E_PORT=(\d+) bash \.pandacorp\/worktree-bootstrap\.sh/) || [])[1])
    const paths = probes.map((c) => (c.prompt.match(/checkout at (\S+) pinned/) || [])[1])
    t.ok(probes.length === 3 && JSON.stringify(ports.sort()) === JSON.stringify(['3810', '3820', '3830']), `three distinct explicit ports (got ${ports.join(', ')})`)
    t.ok(new Set(paths).size === 3 && paths.every((x) => /gate-worktree-\d$/.test(x)) && !ports.includes('3900'), 'three distinct slot paths, never main\'s 3900')
    t.ok(probes.every((c) => (c.prompt.match(/PANDACORP_E2E_PORT=\d+ bash/g) || []).length === 2), 'the port is passed on create AND on reuse')
    t.ok(probes.every((c) => /drops THIS gate slot/.test(c.prompt)), 'a failed slot is dropped from the pool, not the whole run')
  },
})
for (const [label, extra, want, logRe] of [
  ['default (absent)', {}, 2, null],
  ['gateSlots:3', { gateSlots: 3 }, 3, null],
  ['maxParallelGates:3 (alias)', { maxParallelGates: 3 }, 3, null],
  ['gateSlots:"abc" (invalid)', { gateSlots: 'abc' }, 2, /gateSlots='abc' is not an integer 1\.\.8 — using 2/],
  ['gateSlots:9 (above the cap)', { gateSlots: 9 }, 2, /gateSlots='9' is not an integer 1\.\.8/],
]) {
  SCENARIOS.push({
    name: `D1i-${label}. the pool has ${want} slot(s)`,
    args: { mode: 'pro', parallelGates: true, ...extra },
    plan: d1Resume(`d1k${want}${label.length}`, 4),
    responses: d1Harness({ fallbackMs: 2 }).responses,
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const slots = new Set(byLabel(run, /^gate:/).map(d1Slot))
      t.ok(slots.size === want, `${want} distinct slots used across 4 gates (got ${[...slots].join(', ')})`)
      if (logRe) t.ok(hasLog(run, logRe), 'the invalid value is reported loudly')
      t.ok(run.result && run.result.builtFrds.length === 4, 'all four verify')
    },
  })
}
// (j) BL-0138 honesty: a repair rung that runs on main while another gate is still reviewing cannot trust its
// budget.spent() delta → the FRD's token layer is switched off, LOUDLY, and nothing polluted is recorded.
{
  const h = d1Harness({ order: ['frd-d1l-1'], autoFlushAt: 2, verdicts: { 'frd-d1l-1': { green: false, reopen: ['wo-d1l-1'], findings: [{ wo: 'wo-d1l-1', finding: 'off-by-one at src/d1l1/x.ts:3', failingTest: 'src/d1l1/_tests/x.reviewer.test.ts', files: ['src/d1l1/x.ts'] }], failure: 'off-by-one' } } })
  const patch = h.responses.find((r) => r.prefix === 'patch:')
  const inner = patch.response
  patch.response = async (call) => { const r = await inner(call); h.flush(['frd-d1l-2']); return r }
  SCENARIOS.push({
    name: 'D1j. parallelGates — a patch rung running while another gate reviews marks that FRD\'s repair tokens UNRELIABLE (agent-weight fallback, logged with the reason — BL-0138)',
    args: { mode: 'pro', parallelGates: true },
    plan: d1Resume('d1l', 2),
    responses: h.responses,
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(h.at('start:patch:frd-d1l-1') < h.at('result:frd-d1l-2'), 'the patch ran while frd-2 was still in flight')
      t.ok(hasLog(run, /frd-d1l-1: repair brake on agent-weight, usage unreliable — 1 parallel gate\(s\) were reviewing while its repair rung ran/), 'the fallback is loud and names the real reason')
      t.ok(run.result && run.result.builtFrds.includes('frd-d1l-1') && run.result.builtFrds.includes('frd-d1l-2'), 'both verify')
    },
  })
}
// (k) BL-0178 × D1: two gates proving drift at once read their probes from THEIR slot, and drift-proof.mjs
// never shares a temp tree between them (its tmp root is keyed by FRD + pid + clock; each FRD its own card dir).
{
  const h = d1Harness({ order: ['frd-d1m-1', 'frd-d1m-2'], autoFlushAt: 2, verdicts: {
    'frd-d1m-1': { green: true, testFiles: [], traceability: b178Trace(b178Claim('frd-d1m-1', 'REQ-71-001', 'legacy drift one')) },
    'frd-d1m-2': { green: true, testFiles: [], traceability: b178Trace(b178Claim('frd-d1m-2', 'REQ-72-001', 'legacy drift two')) },
  } })
  const driftSrc = readFileSync(path.resolve(__dirname, 'drift-proof.mjs'), 'utf8')
  SCENARIOS.push({
    name: 'D1k. parallelGates × BL-0178 — each concurrent gate\'s differential drift proof reads ITS slot, and drift-proof.mjs keys its temp worktrees by FRD + pid + clock (no shared tmp)',
    args: { mode: 'pro', parallelGates: true },
    plan: d1Resume('d1m', 2),
    responses: [
      { prefix: 'drift-proof:frd-d1m-1', response: b178Proof({ frd: 'frd-d1m-1', wos: ['wo-d1m-1'], owned: ['REQ-71-009'], probes: [['REQ-71-001', ['fail', 'fail'], ['fail', 'fail']]] }) },
      { prefix: 'drift-proof:frd-d1m-2', response: b178Proof({ frd: 'frd-d1m-2', wos: ['wo-d1m-2'], owned: ['REQ-72-009'], probes: [['REQ-72-001', ['fail', 'fail'], ['fail', 'fail']]] }) },
      b178Record,
      ...h.responses,
    ],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const src = (f) => ((byLabel(run, `drift-proof:${f}`)[0] || { prompt: '' }).prompt.match(/--source '([^']+)'/) || [])[1]
      t.ok(/gate-worktree-1$/.test(src('frd-d1m-1') || '') && /gate-worktree-2$/.test(src('frd-d1m-2') || ''), `each proof reads its own slot (${src('frd-d1m-1')} | ${src('frd-d1m-2')})`)
      t.ok(/drift-proof', `\$\{o\.frd\}-\$\{process\.pid\}-\$\{Date\.now\(\)\}`/.test(driftSrc) && /gate-evidence', o\.frd, 'drift'/.test(driftSrc), 'drift-proof.mjs tmp root = <frd>-<pid>-<clock>, evidence dir per FRD — two gates never share one')
      t.ok(byLabel(run, /^drift-record:/).length === 2 && run.result && run.result.builtFrds.length === 2, 'both drifts recorded once each; both FRDs VERIFIED')
    },
  })
}
// (l) the gates never write shared state: every gate/probe/release/evidence runs with a slot workFrom; every
// shared-document writer (apply, persist, patch, verify, the guard) runs on MAIN with no workFrom.
{
  const h = d1Harness({ order: ['frd-d1n-2', 'frd-d1n-1'], autoFlushAt: 2 })
  SCENARIOS.push({
    name: 'D1l. parallelGates — only the landing lane writes main: gate prompts stay review-only in their slot; apply/stale-pin run on the main tree',
    args: { mode: 'pro', parallelGates: true, gateEvidence: 'digested' },
    plan: d1Resume('d1n', 2),
    responses: [{ prefix: 'evidence:', response: { report: '{"green":true,"scope":"since","subgates":[]}', diffStat: '', diff: '', truncated: false, ac: '' } }, ...h.responses],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const gates = byLabel(run, /^gate:/)
      t.ok(gates.every((g) => /gate-worktree-\d/.test(g.prompt) && /do NOT edit \.pandacorp\/status\.yaml/.test(g.prompt) && /do NOT \\`git commit\\`|do NOT `git commit`/.test(g.prompt)), 'gate prompts are review-only, in their slot')
      const inSlot = (c) => ((c.prompt.match(/^Work from the GATE WORKTREE (\S+) /) || [])[1] || null)
      const ev = byLabel(run, /^evidence:/)
      t.ok(ev.length === 2 && ev.every((c) => /gate-worktree-\d$/.test(inSlot(c) || '')) && new Set(ev.map(inSlot)).size === 2, 'digested evidence is collected INLINE in each gate\'s own slot (never a prelaunch on a shared chain)')
      t.ok(gates.every((g) => inSlot(g) === (inSlot(ev.find((e) => e.label === g.label.replace('gate:', 'evidence:'))) || 'x')), 'each gate reviews in the very slot its evidence was collected in')
      const writers = byLabel(run, /^(apply-gate|stale-pin):/)
      t.ok(writers.length === 4 && writers.every((c) => !inSlot(c)), 'every landing step runs on the main tree')
      t.ok(h.lane.max === 1, 'one writer at a time')
    },
  })
}

// (m) landing ORDER: a dependent FRD that is gate-ready while its upstream is still BUILDING does not gate yet (its pin
// could not hold the upstream's code); once the upstream gates, the dependent may gate too, and it lands after it.
{
  const h = d1Harness()
  SCENARIOS.push({
    name: 'D1m. parallelGates — frd-d (dep on frd-u\'s first WO) is gate-ready while frd-u still builds: its gate waits until frd-u has stopped building, and it LANDS after frd-u',
    args: { mode: 'pro', parallelGates: true },
    plan: mkPlan([
      { frd: 'frd-d1o-u', deps: [], workOrders: [
        mkWo('wo-d1o-u1', 'PLANNED', { frd: 'frd-d1o-u', artifacts: ['src/d1ou1/**'] }),
        mkWo('wo-d1o-u2', 'PLANNED', { frd: 'frd-d1o-u', artifacts: ['src/d1ou2/**'], deps: ['wo-d1o-u1'] }),
        mkWo('wo-d1o-u3', 'PLANNED', { frd: 'frd-d1o-u', artifacts: ['src/d1ou3/**'], deps: ['wo-d1o-u2'] }),
      ] },
      { frd: 'frd-d1o-d', deps: [], workOrders: [mkWo('wo-d1o-d1', 'PLANNED', { frd: 'frd-d1o-d', artifacts: ['src/d1od/**'], deps: ['wo-d1o-u1'] })] },
    ]),
    responses: [distinctCommitShas, ...h.responses],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(hasLog(run, /gate for frd-d1o-d deferred: depends on frd-d1o-u, which has not gated yet/), 'the landing-order deferral is logged')
      const buildU3 = byLabel(run, 'build:wo-d1o-u3')[0]
      const gateD = byLabel(run, 'gate:frd-d1o-d')[0]
      t.ok(buildU3 && gateD && gateD.index > buildU3.index, 'frd-d did not gate while frd-u was still building')
      t.ok(h.at('start:stale-pin:frd-d1o-d') > h.at('end:apply-gate:frd-d1o-u'), 'frd-d landed only after frd-u landed')
      t.ok(run.result && run.result.builtFrds.includes('frd-d1o-u') && run.result.builtFrds.includes('frd-d1o-d'), 'both verify')
    },
  })
}
// (n) two FRDs whose WOs depend on EACH OTHER across FRDs (no WO cycle, so no cycle block): the queued-upstream rule
// would wait forever — the idle path waives it. A mutual pair cannot order its landings, so it never holds either:
// both land in arrival order, one writer at a time (E2 finding 1).
{
  const h = d1Harness()
  SCENARIOS.push({
    name: 'D1n. parallelGates — mutually dependent FRDs (x2→y1, y2→x1) never deadlock: the idle path waives the landing-order rule; their landings (which cannot be ordered) run one at a time',
    args: { mode: 'pro', parallelGates: true },
    plan: mkPlan([
      { frd: 'frd-d1p-x', deps: [], workOrders: [mkWo('wo-d1p-x1', 'PLANNED', { frd: 'frd-d1p-x', artifacts: ['src/d1px1/**'] }), mkWo('wo-d1p-x2', 'PLANNED', { frd: 'frd-d1p-x', artifacts: ['src/d1px2/**'], deps: ['wo-d1p-y1'] })] },
      { frd: 'frd-d1p-y', deps: [], workOrders: [mkWo('wo-d1p-y1', 'PLANNED', { frd: 'frd-d1p-y', artifacts: ['src/d1py1/**'] }), mkWo('wo-d1p-y2', 'PLANNED', { frd: 'frd-d1p-y', artifacts: ['src/d1py2/**'], deps: ['wo-d1p-x1'] })] },
    ]),
    responses: [distinctCommitShas, ...h.responses],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(hasLog(run, /waiving the landing-order rule/), 'the waiver is logged')
      t.ok(h.lane.max === 1 && h.at('end:apply-gate:frd-d1p-x') > 0 && h.at('end:apply-gate:frd-d1p-y') > 0, 'both land, one main-tree writer at a time')
      t.ok(!hasLog(run, /lands before .*nothing else can land/), 'a mutual pair never needs the hold waiver (it is not held)')
      t.ok(!hasLog(run, /gating it on main \(legacy\)/), 'no legacy fallback was needed')
      t.ok(run.result && run.result.builtFrds.length === 2, 'both verify')
    },
  })
}

// (o) an FRD a safe-point drain enrolls ALREADY gate-ready (a bug change's WO lands IN_REVIEW) carries no pin;
// it is pinned at HEAD before a slot is probed at it — a probe at an undefined sha would cost the pool a slot.
{
  const h = d1Harness()
  SCENARIOS.push({
    name: 'D1o. parallelGates — a drained change\'s gate-ready FRD (no wave pinned it) is pinned at HEAD before it takes a slot; no slot is lost',
    args: { mode: 'pro', parallelGates: true },
    plan: mkPlan([{ frd: 'frd-d1q-a', deps: [], workOrders: [mkWo('wo-d1q-a1', 'PLANNED', { frd: 'frd-d1q-a', artifacts: ['src/d1qa/**'] })] }]),
    responses: [
      { label: 'safe-point', times: 1, response: { stop: false, ready: ['fix-login'], unblocked: [] } },
      { label: 'process-change:fix-login', response: { done: true, affectedFrds: ['frd-d1q-new'], changeFile: 'fix-login.md' } },
      { label: 'plan-drained:fix-login', response: { frds: [{ frd: 'frd-d1q-new', deps: [], workOrders: [mkWo('wo-d1q-n1', 'IN_REVIEW', { frd: 'frd-d1q-new', artifacts: ['src/d1qn/**'] })] }] } },
      { prefix: 'pin:frd-d1q-new', response: { sha: 'drainpin1' } },
      ...h.responses,
    ],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const pin = byLabel(run, 'pin:frd-d1q-new')[0]
      const probe = byLabel(run, /^gate-worktree:\d$/).find((c) => /drainpin1/.test(c.prompt))
      const gate = byLabel(run, 'gate:frd-d1q-new')[0]
      t.ok(pin && probe && gate && pin.index < probe.index && probe.index < gate.index, 'pinned, then the slot probed AT that pin, then the gate')
      t.ok(!byLabel(run, /^gate-worktree:\d$/).some((c) => /pinned to commit undefined/.test(c.prompt)), 'no slot is ever probed at an undefined sha')
      t.ok(!hasLog(run, /dropped from the parallel pool/), 'no slot lost')
      t.ok(run.result && run.result.builtFrds.includes('frd-d1q-new') && run.result.builtFrds.includes('frd-d1q-a'), 'both FRDs verify')
    },
  })
}

// (p) red-team of this change, #2: a safe point UNBLOCKS a WO of an FRD whose gate is IN FLIGHT. Before the
// fix the FRD was re-queued and gated a second time concurrently (the tracker overwritten), the live reviewIds
// array made the first landing stamp the unreviewed WO VERIFIED, and the guard read the NEW pin. Now: the
// verdict carries snapshots, and the FRD is re-queued (re-pinned at HEAD) only once its first verdict landed.
{
  const h = d1Harness({ fallbackMs: 6 })
  SCENARIOS.push({
    name: 'D1p. parallelGates — an unblocked WO re-enrolled into an FRD whose gate is in flight: no second concurrent gate; the first landing stamps ONLY what it reviewed, at ITS pin; then a fresh gate at HEAD',
    args: { mode: 'pro', parallelGates: true },
    plan: mkPlan([
      { frd: 'frd-d1r-a', deps: [], workOrders: [mkWo('wo-d1r-a1', 'IN_REVIEW', { frd: 'frd-d1r-a', artifacts: ['src/d1ra1/**'] }), mkWo('wo-d1r-a2', 'BLOCKED', { frd: 'frd-d1r-a', artifacts: ['src/d1ra2/**'] })] },
      { frd: 'frd-d1r-b', deps: [], workOrders: [mkWo('wo-d1r-b1', 'PLANNED', { frd: 'frd-d1r-b', artifacts: ['src/d1rb1/**'] }), mkWo('wo-d1r-b2', 'PLANNED', { frd: 'frd-d1r-b', artifacts: ['src/d1rb2/**'], deps: ['wo-d1r-b1'] })] },
    ]),
    responses: [
      distinctCommitShas,
      { label: 'safe-point', times: 1, response: { stop: false, ready: [], unblocked: [] } },
      { label: 'safe-point', times: 1, response: { stop: false, ready: [], unblocked: [{ frd: 'frd-d1r-a', wo: 'wo-d1r-a2' }] } },
      { label: 'pin:frd-d1r-a', times: 1, response: { sha: 'pinsha0' } },
      { label: 'pin:frd-d1r-a', times: 1, response: { sha: 'repin1' } },
      ...h.responses,
    ],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const gatesA = byLabel(run, 'gate:frd-d1r-a')
      t.ok(gatesA.length === 2, `frd-a gated exactly twice (got ${gatesA.length})`)
      const starts = h.tl.map((x, k) => (x === 'start:frd-d1r-a' ? k : -1)).filter((k) => k >= 0)
      t.ok(starts.length === 2 && starts[1] > h.at('end:apply-gate:frd-d1r-a'), `the second frd-a gate started only after the first LANDED — never two at once (timeline: ${h.tl.join(' ')})`)
      const applies = byLabel(run, 'apply-gate:frd-d1r-a')
      t.ok(applies[0] && /wo-d1r-a1/.test(applies[0].prompt) && !/wo-d1r-a2/.test(applies[0].prompt), 'the first landing stamped ONLY the WO its gate reviewed (a snapshot, not the live reviewIds)')
      const guards = byLabel(run, 'stale-pin:frd-d1r-a')
      t.ok(guards[0] && /pinsha0\.\.HEAD/.test(guards[0].prompt), 'the first landing\'s guard used the pin its gate reviewed')
      t.ok(guards[1] && /repin1\.\.HEAD/.test(guards[1].prompt) && applies[1] && /wo-d1r-a2/.test(applies[1].prompt), 'the fresh gate ran at a new pin and certified the unblocked WO')
      t.ok(hasLog(run, /frd-d1r-a gained work while its gate was in flight — queued for a fresh gate at HEAD/), 'the re-queue is logged')
      t.ok(run.result && run.result.builtFrds.includes('frd-d1r-b'), 'frd-b verifies')
    },
  })
}
// (q) the lane never leaves ported reviewer tests UNTRACKED on main after a landing that did not certify its FRD
// (else the next landing's verify.sh --since — vitest --changed — runs them against another FRD).
{
  const h = d1Harness({ verdicts: { 'frd-d1s-1': { green: false, reopen: ['wo-d1s-1'], findings: [{ wo: 'wo-d1s-1', finding: 'bad sort at src/d1s1/x.ts:9', failingTest: 'src/d1s1/_tests/r.reviewer.test.ts', files: ['src/d1s1/x.ts'] }], failure: 'bad sort', testFiles: ['src/d1s1/_tests/r.reviewer.test.ts'] } } })
  SCENARIOS.push({
    name: 'D1q. parallelGates — a reopen that ends deferred (patch-1/2 fail, revert, reopen cap) removes the reviewer test copies it ported from main (untracked + byte-identical only); a certified landing does not',
    args: { mode: 'pro', parallelGates: true },
    plan: mkPlan([{ frd: 'frd-d1s-1', deps: [], workOrders: [mkWo('wo-d1s-1', 'IN_REVIEW', { frd: 'frd-d1s-1', artifacts: ['src/d1s1/**'], reopen_count: 2 })] }]),
    responses: [{ prefix: 'patch:', response: { green: false, cause: 'code', failure: 'still red' } }, ...h.responses],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(run.result && run.result.reopenedFrds.includes('frd-d1s-1') && !run.result.builtFrds.includes('frd-d1s-1'), 'the FRD ends deferred (not certified)')
      const up = byLabel(run, 'unport-reviewer-tests:frd-d1s-1')[0]
      const port = byLabel(run, 'port-reviewer-tests:frd-d1s-1')[0]
      t.ok(up && port && up.index > port.index && up.index > byLabel(run, 'revert:frd-d1s-1')[0].index, 'the cleanup ran after the ladder ended')
      t.ok(up && up.prompt.includes('src/d1s1/_tests/r.reviewer.test.ts') && /ls-files --error-unmatch/.test(up.prompt) && /shasum -a 256/.test(up.prompt) && /--literal-pathspecs clean -f -- '<path>'/.test(up.prompt) && /Never a blanket clean/.test(up.prompt), 'it removes only untracked, byte-identical copies, path by path (literal pathspec, E2 finding 3)')
      t.ok(up && up.opts.agentType === 'pandacorp:mech' && !/^Work from the GATE WORKTREE/.test(up.prompt), 'a MECH on the main tree')
      t.ok(hasLog(run, /frd-d1s-1 did not land VERIFIED — removed 1 untracked reviewer test copy/), 'logged')
    },
  })
}

// (r) a slot failing its probe: DIRT is slot-specific → the FRD is re-queued ONCE for another slot; any other
// failure (unreachable sha, bootstrap) would burn the next slot the same way → the FRD is gated on main instead.
for (const [kind, probeFail, requeued] of [
  ['dirty', { ok: false, failure: 'gate worktree is dirty, orphaned, unregistered, or ambiguous; evidence preserved', dirty: ['?? src/old/_tests/crash.reviewer.test.ts'] }, true],
  ['not-dirt', { ok: false, failure: 'worktree-bootstrap.sh exited 1', dirty: [] }, false],
]) {
  const tag = `d1t${kind.length}`
  const h = d1Harness()
  SCENARIOS.push({
    name: `D1r-${kind}. parallelGates — slot 1's probe fails (${kind}) → ${requeued ? 're-queued ONCE into slot 2' : 'NOT re-queued: gated on main (the failure is not slot-specific)'}`,
    args: { mode: 'pro', parallelGates: true },
    plan: d1Resume(tag, 1),
    responses: [{ label: 'gate-worktree:1', response: probeFail }, ...h.responses],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const gates = byLabel(run, `gate:frd-${tag}-1`)
      t.ok(hasLog(run, /gate slot 1 .* dropped from the parallel pool/), 'slot 1 left the pool, loudly')
      if (requeued) {
        t.ok(gates.length === 1 && /gate-worktree-2 /.test(gates[0].prompt), 'the gate ran in slot 2')
        t.ok(hasLog(run, /re-queued ONCE for another slot/), 'the re-queue is logged')
      } else {
        t.ok(gates.length === 1 && !/GATE WORKTREE/.test(gates[0].prompt) && byLabel(run, 'gate-worktree:2').length === 0, 'gated on the main tree; slot 2 was never burned on the same failure')
      }
      t.ok(run.result && run.result.builtFrds.includes(`frd-${tag}-1`), 'the FRD still verifies')
    },
  })
}

// ---- INTEGRATION gate-cost × D1 (post-merge cross-review) ----
// The two lanes were built in parallel and meet in the gate: the inventory cache (BL-0189) and the digested
// collector on a nested project (BL-0187) must keep their guarantees when N gates run at once (BL-0186).
const xaInvWrite = (frd) => new RegExp(`gate-inventory\\.mjs' write --project \\S+ --frd '${frd}'`)
const xaApply = (h) => ({ prefix: 'apply-gate:', response: async (call) => {
  const frd = call.label.slice('apply-gate:'.length)
  const r = await h.responses.find((x) => x.prefix === 'apply-gate:').response(call)
  return { ...r, inventory_output: JSON.stringify({ ok: true, path: `.pandacorp/run/gate-evidence/${frd}/inventory.json`, entries: gcTrace().length, gatedAt: 'abc1234' }) }
} })
// (a1) parallelGates × gateInventoryCache — two disjoint FRDs gate AT ONCE; each resolves ITS OWN cache inside
// its gate link, and the cache is written ONLY by that FRD's landing, in the one-writer lane.
{
  const h = d1Harness({ order: ['frd-xa-2', 'frd-xa-1'], autoFlushAt: 2, verdicts: { 'frd-xa-1': { green: true, testFiles: [], traceability: gcTrace() }, 'frd-xa-2': { green: true, testFiles: [], traceability: gcTrace() } } })
  SCENARIOS.push({
    name: 'XA1. parallelGates × gateInventoryCache — 2 concurrent gates: one cache check per FRD before its own gate; the cache write rides ONLY in that FRD\'s landing (the serialized lane), never in a gate or another FRD\'s landing',
    args: { mode: 'pro', parallelGates: true, gateSlots: 2, gateInventoryCache: true },
    plan: d1Resume('xa', 2),
    responses: [gcCheck('frd-xa', null), xaApply(h), ...h.responses],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const firstResult = h.tl.findIndex((x) => x.startsWith('result:'))
      t.ok(['frd-xa-1', 'frd-xa-2'].every((f) => h.at(`start:${f}`) >= 0 && h.at(`start:${f}`) < firstResult), `both gates were in flight together (timeline: ${h.tl.join(' ')})`)
      for (const f of ['frd-xa-1', 'frd-xa-2']) {
        const chk = byLabel(run, `gate-inventory:${f}`)
        const gate = byLabel(run, `gate:${f}`)
        t.ok(chk.length === 1 && gate.length === 1 && chk[0].index < gate[0].index && new RegExp(`--frd '${f}'`).test(chk[0].prompt), `${f}: exactly one cache check, for ITS OWN FRD, before its one gate`)
        const writes = run.calls.filter((c) => xaInvWrite(f).test(c.prompt))
        t.ok(writes.length === 1 && writes[0].label === `apply-gate:${f}`, `${f}: the cache is written once, by its OWN landing (got ${writes.map((c) => c.label).join(', ') || 'none'})`)
      }
      t.ok(run.calls.filter((c) => /gate-inventory\.mjs' write/.test(c.prompt)).every((c) => /^apply-gate:/.test(c.label)), 'no gate, probe, collector or release ever carries a cache write')
      t.ok(h.lane.max === 1, `the landings (the only cache writers) never overlapped (max ${h.lane.max})`)
      t.ok(run.logs.filter((l) => /contract inventory cached/.test(l)).length === 2, 'both landings\' receipts were read back')
      t.ok(run.result && ['frd-xa-1', 'frd-xa-2'].every((f) => run.result.builtFrds.includes(f)), 'both FRDs VERIFIED')
    },
  })
}
// (a2) the SAME FRD under both flags: its second gate (a WO re-enrolled while the first was in flight) never
// coincides with the first, and it checks the cache only AFTER the first landing wrote it — at a new pin.
{
  const h = d1Harness({ fallbackMs: 6, verdicts: { 'frd-xb-a': { green: true, testFiles: [], traceability: gcTrace() }, 'frd-xb-b': { green: true, testFiles: [], traceability: gcTrace() } } })
  SCENARIOS.push({
    name: 'XA2. parallelGates × gateInventoryCache — the same FRD gated twice: never two gates at once (gateUnlanded); the 2nd cache check follows the 1st landing\'s write; each write carries ITS gate\'s pin',
    args: { mode: 'pro', parallelGates: true, gateInventoryCache: true },
    plan: mkPlan([
      { frd: 'frd-xb-a', deps: [], workOrders: [mkWo('wo-xb-a1', 'IN_REVIEW', { frd: 'frd-xb-a', artifacts: ['src/xba1/**'] }), mkWo('wo-xb-a2', 'BLOCKED', { frd: 'frd-xb-a', artifacts: ['src/xba2/**'] })] },
      { frd: 'frd-xb-b', deps: [], workOrders: [mkWo('wo-xb-b1', 'PLANNED', { frd: 'frd-xb-b', artifacts: ['src/xbb1/**'] }), mkWo('wo-xb-b2', 'PLANNED', { frd: 'frd-xb-b', artifacts: ['src/xbb2/**'], deps: ['wo-xb-b1'] })] },
    ]),
    responses: [
      distinctCommitShas,
      { label: 'safe-point', times: 1, response: { stop: false, ready: [], unblocked: [] } },
      { label: 'safe-point', times: 1, response: { stop: false, ready: [], unblocked: [{ frd: 'frd-xb-a', wo: 'wo-xb-a2' }] } },
      { label: 'pin:frd-xb-a', times: 1, response: { sha: 'pinsha0' } },
      { label: 'pin:frd-xb-a', times: 1, response: { sha: 'repin1' } },
      gcCheck('frd-xb', null),
      xaApply(h),
      ...h.responses,
    ],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const starts = h.tl.map((x, k) => (x === 'start:frd-xb-a' ? k : -1)).filter((k) => k >= 0)
      t.ok(starts.length === 2 && starts[1] > h.at('end:apply-gate:frd-xb-a'), `frd-a's two gates never coincided — the 2nd started after the 1st LANDED (timeline: ${h.tl.join(' ')})`)
      const chk = byLabel(run, 'gate-inventory:frd-xb-a')
      const applies = byLabel(run, 'apply-gate:frd-xb-a')
      t.ok(chk.length === 2 && applies.length === 2 && chk[1].index > applies[0].index, 'the 2nd cache check ran after the 1st landing (the writer) — a check never races its own FRD\'s write')
      t.ok(/--pin 'pinsha0'/.test(chk[0].prompt) && /--pin 'repin1'/.test(chk[1].prompt), 'each check reads at the pin ITS gate judges')
      t.ok(xaInvWrite('frd-xb-a').test(applies[0].prompt) && /--pin 'pinsha0'/.test(applies[0].prompt.split('LAST STEP (BL-0189')[1] || '') && /--pin 'repin1'/.test(applies[1].prompt.split('LAST STEP (BL-0189')[1] || ''), 'each landing writes the cache at the pin ITS gate reviewed (a snapshot, never the live re-pin)')
      t.ok(run.calls.filter((c) => /gate-inventory\.mjs' write/.test(c.prompt)).every((c) => /^apply-gate:/.test(c.label)), 'only landings write the cache')
      t.ok(run.result && run.result.builtFrds.includes('frd-xb-b'), 'frd-b verifies')
    },
  })
}
// (b) parallelGates × gateEvidence:'digested' on a NESTED project: slot k's collector, gate and bootstrap all
// enter gate-worktree-<k>/<prefix> — executed against real slot worktrees, not string-matched.
{
  const fx = gcNestedFixture('frd-xc-1')
  gcCleanups.splice(gcCleanups.indexOf(fx.root), 1)   // owned here: the GC block's last scenario empties gcCleanups before this one runs
  const slotDir = (k) => path.join(fx.app, `.pandacorp/run/gate-worktree-${k}`)
  for (const k of [1, 2]) {
    gcGit(fx.app, 'worktree', 'add', '--detach', '-q', slotDir(k), fx.pin)
    gcWrite(path.join(slotDir(k), 'mission-control/node_modules/.bin/vitest'), '#!/bin/sh\n')
    gcWrite(path.join(slotDir(k), 'mission-control/.pandacorp/worktree-bootstrap.sh'), 'echo "BOOTSTRAP-IN $(pwd -P) PORT=$PANDACORP_E2E_PORT"\n')
  }
  const h = d1Harness({ order: ['frd-xc-2', 'frd-xc-1'], autoFlushAt: 2 })
  SCENARIOS.push({
    name: 'XB. parallelGates × digested on a nested project — slot k\'s collector cd lands in gate-worktree-<k>/mission-control (BOOTSTRAPPED there), its gate reviews there, and its bootstrap runs from there with ITS port',
    args: { mode: 'pro', parallelGates: true, gateSlots: 2, gateEvidence: 'digested', projectDir: fx.app, project: 'mission-control' },
    plan: d1Resume('xc', 2),
    responses: [{ prefix: 'evidence:', response: { report: '{"green":true,"scope":"since","subgates":[]}', diffStat: '', diff: '', truncated: false, tests: [], ac: '' } }, ...h.responses],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const cdOf = (c) => (c && (c.prompt.match(/FIRST cd into the PROJECT directory inside it, exactly: `([^`]+)`/) || [])[1]) || ''
      const ev = byLabel(run, /^evidence:/)
      t.ok(ev.length === 2, `both collectors ran (got ${ev.length})`)
      const landed = new Set()
      for (const c of ev) {
        const frd = c.label.slice('evidence:'.length)
        const k = (d1Slot(c) || '').match(/gate-worktree-(\d)$/)
        const here = cdOf(c) ? gcBash(`${cdOf(c)} && pwd -P`, gcOs.tmpdir()) : { ok: false, out: '' }
        t.ok(k && here.ok && here.out.trim() === gcFs.realpathSync(path.join(slotDir(k[1]), 'mission-control')), `${frd}: executed, the collector's cd lands in gate-worktree-${k && k[1]}/mission-control (got ${here.out.trim() || here.err})`)
        landed.add(here.out.trim())
        const step0 = (c.prompt.match(/[Rr]un exactly `(node -e "[^`]+")`/) || [])[1]
        t.ok(step0 && gcBash(`${cdOf(c)} && ${step0}`, gcOs.tmpdir()).out === 'BOOTSTRAPPED', `${frd}: step 0 answers BOOTSTRAPPED from inside its slot's project dir`)
        const gate = byLabel(run, `gate:${frd}`)[0]
        t.ok(gate && cdOf(gate) === cdOf(c), `${frd}: its gate enters the SAME slot project dir as its collector`)
      }
      t.ok(landed.size === 2, 'the two concurrent collectors ran in two DIFFERENT slots')
      for (const p of byLabel(run, /^gate-worktree:\d$/)) {
        const k = p.label.slice(-1)
        const boot = (p.prompt.match(/run exactly `(\(cd [^`]+\))`/) || [])[1]
        const out = boot ? gcBash(boot, gcOs.tmpdir()) : { ok: false, out: '' }
        t.ok(out.ok && out.out.trim() === `BOOTSTRAP-IN ${gcFs.realpathSync(path.join(slotDir(k), 'mission-control'))} PORT=${3800 + 10 * Number(k)}`, `slot ${k}: executed, the bootstrap runs .pandacorp/worktree-bootstrap.sh from gate-worktree-${k}/mission-control with port ${3800 + 10 * Number(k)} (got ${out.out.trim() || out.err})`)
      }
      const preFix = gcBash('bash .pandacorp/worktree-bootstrap.sh', slotDir(1))
      t.ok(!preFix.ok, 'fixture check: the pre-fix form (bootstrap from the worktree ROOT) finds no script on a nested project')
      gcFs.rmSync(fx.root, { recursive: true, force: true })
    },
  })
}

// ---- BL-0191..0193 ----
// Canary E (docs/reviews/canary-e-partial-report.md). BL-0191: verifyPatched's BL-0178 matcher refused a PROVEN
// id-less inherited contract (the prompt itself adds the `[class]` tag and the ` — the gate's tests: …` suffix, so
// an exact echo could never match), and the refusal landed AFTER the verifier had already stamped VERIFIED, the
// review_end pass and last_green_sha. BL-0192: the D1 landing lane (a whole patch ladder) was awaited before any
// free slot was refilled. BL-0193: the digested collector ran verify.sh with no timeout, backgrounded it, and
// polled the MAIN tree's gate-report.json instead of its slot's.
const b191Err = 'Error — unparseable last sync SHALL show an explicit invalid-date chip'
const b191Test = (frd) => `src/${frd}/_tests/rail.reviewer.test.tsx`
const b191Gate = (frd, wo, extra = []) => ({
  green: false, reopen: [wo], failure: 'invalid date renders blank',
  findings: [{ wo, finding: `invalid date renders blank (src/${frd}/rail.tsx:12)`, failingTest: b191Test(frd), files: [`src/${frd}/rail.tsx`] }],
  traceability: b178Trace({ contract: b191Err, contractClass: 'error', status: 'fail', tests: [b191Test(frd)] }, ...extra),
})
// What a certification writes: VERIFIED frontmatter, the last-green publication, the review_end pass line.
const b191Stamps = (frd, prompt) => /implementation_status: VERIFIED/.test(prompt) || /publish last green snapshot/.test(prompt) || prompt.includes(`"kind":"review_end","frd":"${frd}","verdict":"pass"`)
const b191Refused = (run, frd) => hasLog(run, new RegExp(`⛔ ${frd}: the post-patch verifier claims GREEN but`))

// T-idless — the canary's exact echo: `error: <text> — the gate's tests: <file>` (class prefix + tests suffix).
SCENARIOS.push({
  name: 'BL-0191a. an id-less inherited contract echoed as "<class>: <text> — the gate\'s tests: …" (the canary E shape) is MATCHED → certified, no refusal, no revert',
  args: { mode: 'pro' },
  plan: b178Plan('frd-b191a', 'wo-b191a-001'),
  responses: [
    { label: 'gate:frd-b191a', times: 1, response: b191Gate('frd-b191a', 'wo-b191a-001') },
    { label: 'verify-patch:frd-b191a', response: { green: true, inheritedResolved: [{ contract: `error: ${b191Err} — the gate's tests: ${b191Test('frd-b191a')}`, pass: true, tests: [b191Test('frd-b191a')] }] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(!b191Refused(run, 'frd-b191a'), 'the proven id-less contract is NOT refused (BL-0178 false negative)')
    t.ok(byLabel(run, /^revert:/).length === 0, 'no revert of a correct patch')
    t.ok(run.result && run.result.builtFrds.includes('frd-b191a'), 'the FRD lands VERIFIED on its first verify-patch')
  },
})
// The other echo shapes the prompt invites: the `[class]` bullet tag, unicode dash variants, the key suffix.
SCENARIOS.push({
  name: 'BL-0191b. "[class] <text> — the gate\'s tests: … · key INH-n" with an en-dash variant, next to an id-keyed REQ contract → both MATCHED',
  args: { mode: 'pro' },
  plan: b178Plan('frd-b191b', 'wo-b191b-001'),
  responses: [
    { label: 'gate:frd-b191b', times: 1, response: b191Gate('frd-b191b', 'wo-b191b-001', [{ contract: 'REQ-91-007 — the rail lists only building/shipped', contractClass: 'requirement', status: 'fail', tests: ['src/b/_tests/rail.test.ts'] }]) },
    { label: 'verify-patch:frd-b191b', response: { green: true, inheritedResolved: [
      { contract: `[error]  ${b191Err.replace('—', '–')}   — the gate's tests: ${b191Test('frd-b191b')} · key INH-1`, pass: true, tests: [b191Test('frd-b191b')] },
      { contract: 'REQ-91-007 (paraphrased by the verifier)', pass: true, tests: ['src/b/_tests/rail.test.ts'] },
    ] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(!b191Refused(run, 'frd-b191b') && byLabel(run, /^revert:/).length === 0, 'neither contract is refused')
    t.ok(run.result && run.result.builtFrds.includes('frd-b191b'), 'VERIFIED')
  },
})
// Keyed: the verifier echoes only the INH-n key the prompt numbered the contract with.
SCENARIOS.push({
  name: 'BL-0191c. the verify prompt numbers each inherited contract (INH-n) and a resolution carrying that key is MATCHED even when its text is paraphrased',
  args: { mode: 'pro' },
  plan: b178Plan('frd-b191c', 'wo-b191c-001'),
  responses: [
    { label: 'gate:frd-b191c', times: 1, response: b191Gate('frd-b191c', 'wo-b191c-001') },
    { label: 'verify-patch:frd-b191c', response: { green: true, inheritedResolved: [{ key: 'INH-1', contract: 'the invalid-date chip contract', pass: true, tests: [b191Test('frd-b191c')] }] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const vp = byLabel(run, 'verify-patch:frd-b191c')[0]
    t.ok(vp && /INH-1/.test(vp.prompt) && /\bkey\b/.test(vp.prompt), 'the verifier is told each contract\'s key and asked to return it')
    t.ok(!b191Refused(run, 'frd-b191c') && run.result && run.result.builtFrds.includes('frd-b191c'), 'matched by key → VERIFIED')
  },
})
// T-genuine-refusal — a contract the verifier really did not prove. The ORDER is the point: nothing is stamped
// before the engine's refusal (the verifier writes nothing; no certify step ever runs), and the revert follows.
for (const [tag, resolved, why] of [
  ['d', [{ contract: `error: Error — some OTHER contract — the gate's tests: ${b191Test('frd-b191d')}`, pass: true, tests: [b191Test('frd-b191d')] }], 'a different contract'],
  ['e', [{ contract: `error: ${b191Err}`, pass: false, tests: [b191Test('frd-b191e')] }], 'the right contract with pass:false'],
  ['f', [{ contract: `error: ${b191Err}`, pass: true, tests: [] }], 'the right contract with no test'],
]) {
  const frd = `frd-b191${tag}`
  SCENARIOS.push({
    name: `BL-0191${tag}. genuine refusal (${why}) → REFUSED, and NOTHING was stamped before it: the verifier writes nothing, no certify step runs, then revert`,
    args: { mode: 'pro' },
    plan: b178Plan(frd, `wo-b191${tag}-001`),
    responses: [
      { label: `gate:${frd}`, times: 1, response: b191Gate(frd, `wo-b191${tag}-001`) },
      { label: `verify-patch:${frd}`, times: 1, response: { green: true, inheritedResolved: resolved } },
    ],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(b191Refused(run, frd), 'the unproven certification is REFUSED (fail-loud stays)')
      const gate = byLabel(run, `gate:${frd}`)[0]
      const vp = byLabel(run, `verify-patch:${frd}`)[0]
      const revert = byLabel(run, `revert:${frd}`)[0]
      t.ok(gate && vp && revert && vp.index < revert.index, 'the refusal takes the genuine-red path (revert)')
      t.ok(vp && !b191Stamps(frd, vp.prompt), 'the verifier\'s own prompt carries NO stamp (no VERIFIED, no last-green publication, no review_end pass)')
      const between = run.calls.filter((c) => gate && revert && c.index > gate.index && c.index < revert.index)
      t.ok(between.every((c) => !b191Stamps(frd, c.prompt)), `no spawn between the gate and the revert stamps anything (${between.filter((c) => b191Stamps(frd, c.prompt)).map((c) => c.label).join(', ') || 'none'})`)
      t.ok(byLabel(run, `certify-patch:${frd}`).length === 0 || byLabel(run, `certify-patch:${frd}`)[0].index > revert.index, 'no certify step runs before the revert')
    },
  })
}
// Green path ordering: verify (writes nothing) → the ENGINE checks → a separate serialized certify step stamps.
SCENARIOS.push({
  name: 'BL-0191g. accepted patch → the verifier writes nothing; a separate certify-patch step AFTER it stamps VERIFIED + last_green_sha + review_end pass + drift + journal, staging the reviewer tests',
  args: { mode: 'pro' },
  plan: reopenPlan184('191g'),
  responses: [
    { label: 'gate:frd-191g', times: 1, response: REOPEN_184('191g') },
    releaseWith184('191g'),
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(!run.unmatched.length, `unmatched labels: ${run.unmatched.join(', ')}`)
    const vp = byLabel(run, 'verify-patch:frd-191g')[0]
    const cp = byLabel(run, 'certify-patch:frd-191g')
    t.ok(vp && !b191Stamps('frd-191g', vp.prompt) && /write NOTHING/.test(vp.prompt), 'the verifier is told to write nothing and its prompt stamps nothing')
    t.ok(cp.length === 1 && cp[0].index > vp.index, 'exactly one certify step, AFTER the verifier returned')
    const p = (cp[0] || {}).prompt || ''
    t.ok(/implementation_status: VERIFIED/.test(p) && /reopen_count: 0/.test(p) && /publish last green snapshot/.test(p) && p.includes('"kind":"review_end","frd":"frd-191g","verdict":"pass"'), 'the certify step carries the full stamp (VERIFIED, reopen_count 0, last-green ordering, review_end pass)')
    t.ok(/"kind":"resolution"/.test(p) && /"outcome":"green"/.test(p) && /"event":"achievement"/.test(p) && /BL-0178 DRIFT/.test(p), 'journal resolution, PatchResult green, achievement and the drift replica ride in the certify step')
    t.ok(p.includes("--literal-pathspecs add -- 'mission-control/src/191g/_tests/sum.reviewer.test.ts'"), 'the certify step stages the reviewer\'s ported test file with a literal, repo-root-anchored command (BL-0184, E2 finding 3)')
    t.ok(cp[0] && cp[0].opts.model === 'haiku', 'the certify step is mechanical (it persists a verdict, it judges nothing)')
    t.ok(run.result && run.result.builtFrds.includes('frd-191g'), 'VERIFIED')
  },
})
SCENARIOS.push({
  name: 'BL-0191h. a verifier green on a PARTIAL gate report (WP-08 cage) → refused BEFORE any certify step (the cage no longer runs after the stamp)',
  args: { mode: 'pro' },
  plan: b178Plan('frd-b191h', 'wo-b191h-001'),
  responses: [
    { label: 'gate:frd-b191h', times: 1, response: b191Gate('frd-b191h', 'wo-b191h-001') },
    { label: 'verify-patch:frd-b191h', times: 1, response: { green: true, report_scope: 'partial', inheritedResolved: [{ contract: b191Err, pass: true, tests: [b191Test('frd-b191h')] }] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const revert = byLabel(run, 'revert:frd-b191h')[0]
    const cp = byLabel(run, 'certify-patch:frd-b191h')
    t.ok(revert && (cp.length === 0 || cp[0].index > revert.index), 'the partial verdict is refused and never certified before the revert')
  },
})
SCENARIOS.push({
  name: 'BL-0191i. the certify step fails to confirm its stamp → the verified patch is NOT reverted (kept for a re-gate), FRD deferred, never counted VERIFIED',
  args: { mode: 'pro' },
  plan: b178Plan('frd-b191i', 'wo-b191i-001'),
  responses: [
    { label: 'gate:frd-b191i', times: 1, response: b191Gate('frd-b191i', 'wo-b191i-001') },
    { label: 'verify-patch:frd-b191i', times: 1, response: { green: true, inheritedResolved: [{ contract: b191Err, pass: true, tests: [b191Test('frd-b191i')] }] } },
    { label: 'certify-patch:frd-b191i', times: 1, response: { done: false, failure: 'index.lock' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^revert:/).length === 0, 'a stamping failure never discards independently verified code')
    t.ok(run.result && !run.result.builtFrds.includes('frd-b191i') && run.result.reopenedFrds.includes('frd-b191i'), 'deferred (re-gates next pass), never reported VERIFIED')
    t.ok(hasLog(run, /frd-b191i: .*certif.*did not confirm/i), 'the failed certification is logged loudly')
  },
})

// BL-0192 — 2 slots, 4 disjoint resume FRDs. frd-1's gate settles FIRST with a reopen; frd-2's gate is still in
// flight and only settles DURING frd-1's patch rung. Expected: frd-3 takes the free slot BEFORE frd-1's landing
// ladder runs, and frd-4 takes frd-2's slot WHILE the ladder is still running — never after it.
{
  const reopen1 = { green: false, reopen: ['wo-b192-1'], findings: [{ wo: 'wo-b192-1', finding: 'off by one (src/b1921/x.ts:3)', failingTest: 'src/b1921/_tests/x.test.ts', files: ['src/b1921/x.ts'] }], failure: 'off by one' }
  const h = d1Harness({
    order: ['frd-b192-1'], autoFlushAt: 2, fallbackMs: 400, verdicts: { 'frd-b192-1': reopen1 },
    onStart: { 'frd-b192-3': ({ flush }) => flush(['frd-b192-3']), 'frd-b192-4': ({ flush }) => flush(['frd-b192-4']) },
  })
  const slowPatch = async (call) => {
    h.tl.push(`start:${call.label}`)
    h.release('frd-b192-2')                                  // slot 2's gate settles while the ladder is on its patch rung
    await new Promise((r) => setTimeout(r, 25))
    h.tl.push(`end:${call.label}`)
    return { green: true }
  }
  const certifyWriter = async (call) => { h.tl.push(`start:${call.label}`); await new Promise((r) => setTimeout(r, 1)); h.tl.push(`end:${call.label}`); return { done: true } }
  SCENARIOS.push({
    name: 'BL-0192a. parallelGates — a landing ladder no longer blocks launches: frd-3 starts BEFORE frd-1\'s ladder, frd-4 takes the slot freed MID-ladder, both pinned at the pre-landing HEAD, main keeps one writer',
    args: { mode: 'pro', parallelGates: true, gateSlots: 2 },
    plan: d1Resume('b192', 4),
    responses: [{ label: 'patch:frd-b192-1', response: slowPatch }, { prefix: 'certify-patch:', response: certifyWriter }, ...h.responses],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(!run.unmatched.length, `unmatched labels: ${run.unmatched.join(', ')}`)
      const tl = h.tl
      const idx = (tag) => tl.indexOf(tag)
      t.ok(idx('start:frd-b192-3') >= 0 && idx('start:frd-b192-3') < idx('start:patch:frd-b192-1'), `frd-3's gate starts BEFORE frd-1's landing ladder (timeline: ${tl.join(' ')})`)
      t.ok(idx('start:frd-b192-4') >= 0 && idx('start:frd-b192-4') < idx('end:verify-patch:frd-b192-1'), 'frd-4\'s gate starts in the slot freed MID-ladder, before frd-1\'s verify-patch returns')
      const first = byLabel(run, 'patch:frd-b192-1')[0]
      const last = byLabel(run, 'certify-patch:frd-b192-1')[0]
      const during = run.calls.filter((c) => first && last && c.index > first.index && c.index < last.index)
      t.ok(first && last && !during.some((c) => /^pin:/.test(c.label)), 'no pin is captured mid-landing (a mid-ladder HEAD may hold the uncertified patch)')
      t.ok(!during.some((c) => /^(build|commit|dispatch):/.test(c.label)), 'no build wave / WO commit is dispatched while the landing runs (main keeps one writer)')
      for (const k of [3, 4]) {
        const g = byLabel(run, `gate:frd-b192-${k}`)[0]
        t.ok(g && /pinned commit pinsha0/.test(g.prompt), `frd-${k}'s gate reviews the pre-landing pin (pinsha0)`)
      }
      t.ok(h.lane.max === 1, `landings stay serialized — one main-tree writer at a time (max ${h.lane.max})`)
      t.ok(run.result && [1, 2, 3, 4].every((k) => run.result.builtFrds.includes(`frd-b192-${k}`)), `all four land VERIFIED (built: ${run.result && run.result.builtFrds.join(', ')})`)
    },
  })
}
// Flag off: the C2 topology is untouched (no D1 lane, no top-up).
SCENARIOS.push({
  name: 'BL-0192b. parallelGates OFF — same reopen shape: no D1 lane/top-up log, the C2 quiesce + convergence path is unchanged and every FRD verifies',
  args: { mode: 'pro' },
  plan: d1Resume('b192off', 3),
  responses: [{ label: 'gate:frd-b192off-1', times: 1, response: { green: false, reopen: ['wo-b192off-1'], findings: [{ wo: 'wo-b192off-1', finding: 'bug (src/x.ts:1)', failingTest: 't.test.ts', files: ['src/x.ts'] }], failure: 'bug' } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(!hasLog(run, /D1/), 'no D1 log line at all with the flag off')
    t.ok(byLabel(run, /^gate-worktree:\d/).length === 0, 'no gate slot is ever probed')
    t.ok(run.result && ['frd-b192off-1', 'frd-b192off-2', 'frd-b192off-3'].every((f) => run.result.builtFrds.includes(f)), 'all verify')
  },
})

// BL-0193 — the digested collector on a NESTED project, executed: its verify.sh runs in the FOREGROUND with an
// explicit timeout and its output to a file, and the report path it reads resolves to ITS slot's
// gate-worktree-<k>/mission-control/.pandacorp/run/gate-report.json — never the main tree's.
{
  const fx = gcNestedFixture('frd-b193-1')
  gcCleanups.splice(gcCleanups.indexOf(fx.root), 1)
  const slotDir = (k) => path.join(fx.app, `.pandacorp/run/gate-worktree-${k}`)
  for (const k of [1, 2]) {
    gcGit(fx.app, 'worktree', 'add', '--detach', '-q', slotDir(k), fx.pin)
    gcWrite(path.join(slotDir(k), 'mission-control/node_modules/.bin/vitest'), '#!/bin/sh\n')
    // a fake verify.sh: writes ITS slot's report where the real one does (relative to the project dir); 'hang' sleeps
    gcWrite(path.join(slotDir(k), 'mission-control/.pandacorp/verify.sh'), `[ "$2" = hang ] && sleep 5\nmkdir -p .pandacorp/run && printf '{"green":true,"fresh":"slot-${k}"}' > .pandacorp/run/gate-report.json\necho verify-console-noise\n`)
    gcWrite(path.join(slotDir(k), 'mission-control/.pandacorp/run/gate-report.json'), '{"green":false,"STALE":true}')
  }
  gcWrite(path.join(fx.app, '.pandacorp/run/gate-report.json'), '{"green":true,"MAIN-TREE":true}')
  const h = d1Harness({ order: ['frd-b193-2', 'frd-b193-1'], autoFlushAt: 2 })
  SCENARIOS.push({
    name: 'BL-0193a. digested collector in slot k — verify.sh in the FOREGROUND with an explicit timeout, output to a file, and the report read from gate-worktree-<k>/mission-control/.pandacorp/run/gate-report.json (executed), never the main tree',
    args: { mode: 'pro', parallelGates: true, gateSlots: 2, gateEvidence: 'digested', projectDir: fx.app, project: 'mission-control' },
    plan: d1Resume('b193', 2),
    responses: [{ prefix: 'evidence:', response: { report: '{"green":true,"scope":"since","subgates":[]}', diffStat: '', diff: '', truncated: false, tests: [], ac: '' } }, ...h.responses],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const ev = byLabel(run, /^evidence:/)
      t.ok(ev.length === 2, `both collectors ran (got ${ev.length})`)
      for (const c of ev) {
        const frd = c.label.slice('evidence:'.length)
        const k = ((d1Slot(c) || '').match(/gate-worktree-(\d)$/) || [])[1]
        t.ok(/timeout: 600000/.test(c.prompt) && /perl -e 'alarm/.test(c.prompt), `${frd}: verify.sh carries an explicit timeout (the Bash tool's timeout: 600000 AND a shell-level alarm)`)
        t.ok(/run_in_background/.test(c.prompt) && /NEVER/.test(c.prompt) && /> "\$LOG" 2>&1/.test(c.prompt), `${frd}: foreground only (never run_in_background / a polling loop), console output to a file`)
        const assign = (c.prompt.match(/(REPORT="[^\n`]*gate-report\.json")/) || [])[1]
        const out = assign ? gcBash(`${assign}; printf %s "$REPORT"`, gcOs.tmpdir()) : { ok: false, out: '' }
        t.ok(k && out.ok && out.out === path.join(slotDir(k), 'mission-control/.pandacorp/run/gate-report.json'), `${frd}: executed, REPORT resolves to gate-worktree-${k}/mission-control/.pandacorp/run/gate-report.json (got ${out.out || out.err})`)
        t.ok(!c.prompt.includes(`${fx.app}/.pandacorp/run/gate-report.json`), `${frd}: the MAIN tree's report path is never named as the one to read`)
        // Execute the collector's whole command from an UNRELATED cwd against a fake verify.sh: it must cd into the
        // slot's project dir, drop the slot's stale report, and print the FRESH slot report — never main's.
        const cmd = (c.prompt.match(/verbatim except PIN_BASE:\*\* `([^`]+)`/) || [])[1]
        const run1 = cmd ? gcBash(cmd.replace('<PIN_BASE>', 'base0'), gcOs.tmpdir()) : { ok: false, out: '', err: 'no command in the prompt' }
        t.ok(run1.ok && run1.out.includes(`"fresh":"slot-${k}"`) && !/STALE|MAIN-TREE/.test(run1.out) && /verify exit=0/.test(run1.out), `${frd}: executed from another cwd, the command prints slot ${k}'s FRESH report (got ${(run1.out || run1.err || '').slice(0, 160)})`)
        t.ok(gcFs.existsSync(path.join(slotDir(k), 'mission-control/.pandacorp/run/evidence-verify.log')), `${frd}: the verify.sh console output went to the slot's log file`)
        const hung = cmd ? gcBash(cmd.replace('<PIN_BASE>', 'hang').replace(' 540 bash ', ' 1 bash '), gcOs.tmpdir()) : { ok: false, out: '' }
        t.ok(/verify exit=142/.test(hung.out) && /REPORT MISSING/.test(hung.out), `${frd}: the shell-level alarm really bounds a hung verify.sh (1 s here, 540 s in the engine) and the report is then reported missing (got ${(hung.out || hung.err || '').slice(0, 160)})`)
      }
      gcFs.rmSync(fx.root, { recursive: true, force: true })
    },
  })
}

// ---- E2 findings ----
// Canary E2 (docs/reviews/canary-e2-report.md, wf_405eeb21-f9e): seven defects the live run surfaced. Each block
// below is anchored in the transcript evidence of that run; the nested-project ones EXECUTE the engine's own
// commands against a real git repository whose project is nested like Mission Control.
const { createHash: e2Hash } = await import('node:crypto')
const e2Sha = (file) => e2Hash('sha256').update(gcFs.readFileSync(file)).digest('hex')
const e2Cmd = (prompt, marker) => ((prompt || '').match(new RegExp(`${marker}: \`([^\`]+)\``)) || [])[1] || null

// (1) E2 §4.2: FRD-05 waited 23.2 min with a free slot because its upstream's verdict had not landed. A dependency
// now orders only the LANDING: both gates run at once, the dependent lands after its upstream, and re-verifies
// `--since <pin>` when the upstream's landing moved code.
{
  const h = d1Harness({ order: ['frd-e21a-b'], autoFlushAt: 2, fallbackMs: 30, staleCounts: [0, 1] })
  SCENARIOS.push({
    name: 'E2-1a. parallelGates — frd-b depends on frd-a (cross-FRD WO dep): BOTH gates start before any verdict; frd-b\'s verdict arrives FIRST but waits; frd-a lands, then frd-b re-verifies --since its pin and lands',
    args: { mode: 'pro', parallelGates: true, gateSlots: 2 },
    plan: mkPlan([
      { frd: 'frd-e21a-a', deps: [], workOrders: [mkWo('wo-e21a-a1', 'IN_REVIEW', { frd: 'frd-e21a-a', artifacts: ['src/e21aa/**'] })] },
      { frd: 'frd-e21a-b', deps: [], workOrders: [mkWo('wo-e21a-b1', 'IN_REVIEW', { frd: 'frd-e21a-b', artifacts: ['src/e21ab/**'], deps: ['wo-e21a-a1'] })] },
    ]),
    responses: h.responses,
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const firstResult = h.tl.findIndex((x) => x.startsWith('result:'))
      t.ok(h.at('start:frd-e21a-a') >= 0 && h.at('start:frd-e21a-b') >= 0 && h.at('start:frd-e21a-a') < firstResult && h.at('start:frd-e21a-b') < firstResult, `both gates started before the first verdict — the dependency no longer defers the LAUNCH (timeline: ${h.tl.join(' ')})`)
      t.ok(!hasLog(run, /gate for frd-e21a-b deferred: depends on/), 'no launch deferral for the dependency')
      t.ok(h.at('result:frd-e21a-b') < h.at('result:frd-e21a-a'), 'frd-b\'s verdict arrived first (the case the hold exists for)')
      t.ok(hasLog(run, /frd-e21a-b's verdict waits to land: it depends on frd-e21a-a/), 'the landing hold is logged with its reason')
      t.ok(h.at('end:apply-gate:frd-e21a-a') >= 0 && h.at('start:stale-pin:frd-e21a-b') > h.at('end:apply-gate:frd-e21a-a'), 'frd-b\'s landing starts only after frd-a has landed')
      const rv = byLabel(run, 'reverify:frd-e21a-b')[0]
      t.ok(rv && /verify\.sh --since pinsha0/.test(rv.prompt) && h.at('start:reverify:frd-e21a-b') > h.at('end:apply-gate:frd-e21a-a'), 'main moved (frd-a landed) → frd-b re-verifies with verify.sh --since <its pin> before it is stamped')
      t.ok(h.at('start:apply-gate:frd-e21a-b') > h.at('end:reverify:frd-e21a-b'), 'frd-b is stamped only after the re-verify')
      t.ok(h.lane.max === 1, 'one main-tree writer at a time')
      t.ok(run.result && run.result.builtFrds.includes('frd-e21a-a') && run.result.builtFrds.includes('frd-e21a-b'), 'both VERIFIED')
    },
  })
}
{
  const reopenA = { green: false, reopen: ['wo-e21b-a1'], findings: [{ wo: 'wo-e21b-a1', finding: 'lenient parse (src/e21ba/x.ts:3)', failingTest: 'src/e21ba/_tests/x.test.ts', files: ['src/e21ba/x.ts'] }], failure: 'lenient parse' }
  const h = d1Harness({ order: ['frd-e21b-b'], autoFlushAt: 2, fallbackMs: 30, staleCounts: [1], verdicts: { 'frd-e21b-a': reopenA } })
  SCENARIOS.push({
    name: 'E2-1b. parallelGates — the upstream REOPENS: its patch ladder lands first (port, patch, verify, certify); the dependent\'s PASS then re-verifies --since its pin on the patched tree before it is stamped',
    args: { mode: 'pro', parallelGates: true, gateSlots: 2 },
    plan: mkPlan([
      { frd: 'frd-e21b-a', deps: [], workOrders: [mkWo('wo-e21b-a1', 'IN_REVIEW', { frd: 'frd-e21b-a', artifacts: ['src/e21ba/**'] })] },
      { frd: 'frd-e21b-b', deps: ['frd-e21b-a'], workOrders: [mkWo('wo-e21b-b1', 'IN_REVIEW', { frd: 'frd-e21b-b', artifacts: ['src/e21bb/**'] })] },
    ]),
    responses: h.responses,
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const firstResult = h.tl.findIndex((x) => x.startsWith('result:'))
      t.ok(h.at('start:frd-e21b-b') >= 0 && h.at('start:frd-e21b-b') < firstResult, 'an FRD-level dependency does not defer the dependent\'s gate either')
      t.ok(h.at('end:certify-patch:frd-e21b-a') >= 0 && h.at('start:stale-pin:frd-e21b-b') > h.at('end:certify-patch:frd-e21b-a'), `the dependent lands only after the upstream's whole ladder (timeline: ${h.tl.join(' ')})`)
      const rv = byLabel(run, 'reverify:frd-e21b-b')[0]
      t.ok(rv && /verify\.sh --since pinsha0/.test(rv.prompt), 'the upstream\'s patch moved code → the dependent re-verifies --since its pin')
      t.ok(run.result && ['frd-e21b-a', 'frd-e21b-b'].every((f) => run.result.builtFrds.includes(f)), 'both VERIFIED')
    },
  })
}

// (2) E2 §4.6: the pre-check's `git status --porcelain` prints REPO-ROOT-relative paths, so for a nested project
// the lease's own status.yaml read `mission-control/.pandacorp/status.yaml` and the BL-0124 exclusion (strict
// equality with `.pandacorp/status.yaml`) never matched → an opus judge-baseline (2.47 min) every nested run.
SCENARIOS.push({
  name: 'E2-2a. nested project — the pre-check\'s repo-root-relative `mission-control/.pandacorp/status.yaml` + its projectPrefix take the BL-0124 fast path (no judge baseline)',
  args: { mode: 'pro' },
  responses: [{ label: 'baseline-precheck', response: { escalate: true, dirty: true, dirtyPaths: ['mission-control/.pandacorp/status.yaml'], leaseValid: true, projectPrefix: 'mission-control/' } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'baseline').length === 0, 'no judge-baseline for the lease\'s own status.yaml in a nested project')
    t.ok(hasLog(run, /BL-0124/), 'the BL-0124 fast-path log fires')
    const p = byLabel(run, 'baseline-precheck')[0]
    t.ok(p && /rev-parse --show-prefix/.test(p.prompt) && /projectPrefix/.test(p.prompt), 'the pre-check is asked for the project prefix (git rev-parse --show-prefix)')
    t.ok(p && /repo-root-relative/i.test(p.prompt) && /BARE path/.test(p.prompt) && /XY status code/.test(p.prompt) && /STRIPPED/.test(p.prompt), 'the prompt says the paths are repo-root-relative, still bare (XY status code stripped)')
  },
})
for (const [tag, dirtyPaths, projectPrefix, why] of [
  ['b', ['mission-control/.pandacorp/status.yaml', 'mission-control/src/x.ts'], 'mission-control/', 'real WIP next to the leased status.yaml'],
  ['c', ['plugin/engine.js'], 'mission-control/', 'a dirty path OUTSIDE the project'],
  ['d', ['mission-control/.pandacorp/status.yaml'], '', 'a nested path with no prefix to strip (an unverifiable claim)'],
  ['e', ['mission-control/.pandacorp/status.yaml'], '../', 'a malformed prefix'],
]) {
  SCENARIOS.push({
    name: `E2-2${tag}. control — ${why} still escalates to the judge baseline (the exclusion never widens)`,
    args: { mode: 'pro' },
    responses: [{ label: 'baseline-precheck', response: { escalate: true, dirty: true, dirtyPaths, leaseValid: true, projectPrefix } }],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(byLabel(run, 'baseline').length === 1, 'the judge baseline runs')
    },
  })
}
{
  // Ground the payload in REAL git output: a nested repo whose only dirt is the project's status.yaml.
  const fx = gcNestedFixture('frd-e22f')
  gcFs.appendFileSync(path.join(fx.app, '.pandacorp/status.yaml'), 'running: true\n')
  const porcelain = gcExecFile('git', ['status', '--porcelain'], { cwd: fx.app, encoding: 'utf8' }).split('\n').filter(Boolean).map((l) => l.slice(3))   // untrimmed: the XY code's leading space matters
  const prefix = gcGit(fx.app, 'rev-parse', '--show-prefix')
  SCENARIOS.push({
    name: 'E2-2f. nested project, REAL git output (porcelain + show-prefix from a nested repo) → fast path',
    args: { mode: 'pro' },
    responses: [{ label: 'baseline-precheck', response: { escalate: true, dirty: true, dirtyPaths: porcelain, leaseValid: true, projectPrefix: prefix } }],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(JSON.stringify(porcelain) === '["mission-control/.pandacorp/status.yaml"]' && prefix === 'mission-control/', `the fixture reproduces E2's exact signal (porcelain ${JSON.stringify(porcelain)}, prefix ${JSON.stringify(prefix)})`)
      t.ok(byLabel(run, 'baseline').length === 0, 'no judge baseline')
    },
  })
}

// (3)+(4) E2 §4.3/§4.4 — executed on a nested repo. apply-gate:frd-05 (haiku) ignored the prose "let TOP = …",
// copied the repo-root-relative test path relative to its PROJECT cwd and committed
// `mission-control/mission-control/src/…` (4ceac8e0), leaving reverify's correct copy untracked; and it staged the
// WO file but not the frd.md/blueprint.md rollups sync-rollups rewrote (left dirty), then committed the timelines
// AFTER the last-green pointer. The engine now hands literal commands anchored at the repo root.
function e2NestedLanding(tag) {
  const frd = `frd-${tag}`
  const fx = gcNestedFixture(frd)
  gcCleanups.splice(gcCleanups.indexOf(fx.root), 1)
  const test = 'mission-control/src/app/projects/[slug]/_tests/wo.gate.reviewer.test.tsx'
  const decoy = path.join(fx.app, 'src/app/projects/s/_tests/wo.gate.reviewer.test.tsx')   // `[slug]` as a glob class would match it
  const evDir = path.join(fx.app, `.pandacorp/run/gate-evidence/${frd}`)
  gcWrite(path.join(evDir, test), 'test("reviewer", () => {})\n')
  gcWrite(decoy, 'untracked owner scratch\n')
  const sha = e2Sha(path.join(evDir, test))
  const release = { prefix: 'gate-release:', times: 1, response: { salvaged: [{ path: test, status: 'untracked', sha256: sha }], remaining: [] } }
  const plan = mkPlan([{ frd, deps: [], workOrders: [mkWo(`wo-${tag}-1`, 'IN_REVIEW', { frd, artifacts: ['src/app/projects/**'] })] }])
  const staged = () => gcGit(fx.repo, 'diff', '--cached', '--name-only').split('\n').filter(Boolean)
  const untracked = () => gcGit(fx.repo, 'ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean)
  return { frd, fx, test, decoy, sha, release, plan, staged, untracked }
}
{
  const L = e2NestedLanding('e23a')
  const h = d1Harness({ staleCounts: [1] })
  SCENARIOS.push({
    name: 'E2-3a. nested project, stale PASS → reverify → apply-gate (executed): the reviewer test lands ONCE at mission-control/src/…, staged, no doubled prefix, no untracked copy, no sibling swept in; the rollups are in the snapshot and nothing is committed after the pointer',
    args: { mode: 'pro', parallelGates: true, gateSlots: 2, projectDir: L.fx.app, project: 'mission-control' },
    plan: L.plan,
    responses: [L.release, ...h.responses],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const rv = byLabel(run, `reverify:${L.frd}`)[0]
      const ap = byLabel(run, `apply-gate:${L.frd}`)[0]
      const rvPort = e2Cmd(rv && rv.prompt, 'port command VERBATIM, as ONE Bash call')
      const apPort = e2Cmd(ap && ap.prompt, 'port command VERBATIM, as ONE Bash call')
      const apStage = e2Cmd(ap && ap.prompt, "stage the reviewer's test files with exactly this command")
      const snap = e2Cmd(ap && ap.prompt, 'stage snapshot \\(A\\) with exactly this command')
      t.ok(rvPort && apPort && apStage && snap, `the landing prompts carry literal commands (reverify port ${Boolean(rvPort)}, apply port ${Boolean(apPort)}, stage ${Boolean(apStage)}, snapshot ${Boolean(snap)})`)
      // Run them the way the E2 agent did: from the PROJECT directory.
      const r1 = gcBash(rvPort || 'false', L.fx.app)
      const r2 = gcBash(apPort || 'false', L.fx.app)
      gcWrite(path.join(L.fx.app, `docs/frds/${L.frd}/frd.md`), '---\nimplementation_status: VERIFIED\n---\n# FRD\n')   // what sync-rollups rewrites
      gcFs.appendFileSync(path.join(L.fx.app, '.pandacorp/status.yaml'), 'updated_at: now\n')
      const r3 = gcBash(apStage || 'false', L.fx.app)
      const r4 = gcBash(snap || 'false', L.fx.app)
      t.ok(r1.ok && r2.ok && r3.ok && r4.ok, `every command ran (${[r1, r2, r3, r4].map((r) => r.ok ? 'ok' : r.err).join(' | ')})`)
      t.ok(gcFs.existsSync(path.join(L.fx.app, 'src/app/projects/[slug]/_tests/wo.gate.reviewer.test.tsx')) && e2Sha(path.join(L.fx.app, 'src/app/projects/[slug]/_tests/wo.gate.reviewer.test.tsx')) === L.sha, 'the test is at <repo>/mission-control/src/…, byte-identical to the reviewer\'s')
      t.ok(!gcFs.existsSync(path.join(L.fx.app, 'mission-control')), 'NO doubled mission-control/mission-control/ directory')
      const st = L.staged()
      t.ok(st.includes(L.test) && !st.some((p) => p.includes('mission-control/mission-control')), `the test is staged at its single repo-root-relative path (staged: ${st.join(', ')})`)
      t.ok(!st.includes('mission-control/src/app/projects/s/_tests/wo.gate.reviewer.test.tsx'), 'the literal pathspec did not sweep a sibling that `[slug]` matches as a glob')
      t.ok(st.includes(`mission-control/docs/frds/${L.frd}/frd.md`) && st.includes('mission-control/.pandacorp/status.yaml'), 'the snapshot stages the rollup doc and status.yaml')
      t.ok(!L.untracked().includes(L.test), 'no untracked copy of the reviewer test is left behind')
      const p = (ap && ap.prompt) || ''
      t.ok(/If that command changed any docs\/frds\/\*\/frd\.md or blueprint\.md on disk/.test(p) && /stage ONLY those rollup documents and commit them right now/.test(p), 'apply-gate commits the sync-rollups documents (BL-0172 SYNC_ROLLUPS_COMMIT)')
      t.ok(p.indexOf('publish last green snapshot') > p.indexOf('"kind":"resolution"') && p.indexOf('publish last green snapshot') > p.indexOf('stage snapshot (A)'), 'the last-green ordering is the LAST step, after the journal/timeline appends and the snapshot staging')
      t.ok(/NO commit after/.test(p) && /status --porcelain -- docs\/frds/.test(p), 'no commit after the pointer; the snapshot is checked to leave docs/frds clean')
      t.ok(p.indexOf('WP-08 cage') >= 0 && p.indexOf('WP-08 cage') < p.indexOf('implementation_status: VERIFIED'), 'the WP-08 partial-report check comes BEFORE any stamp')
      gcFs.rmSync(L.fx.root, { recursive: true, force: true })
    },
  })
}
{
  const L = e2NestedLanding('e23b')
  const reopen = { green: false, reopen: ['wo-e23b-1'], findings: [{ wo: 'wo-e23b-1', finding: 'lenient parse (src/app/projects/x.ts:3)', failingTest: L.test, files: ['src/app/projects/x.ts'] }], failure: 'lenient parse' }
  SCENARIOS.push({
    name: 'E2-3b. nested project, REOPEN ladder (executed): port-reviewer-tests, the integrity hash and certify-patch\'s staging all address mission-control/src/… once — never a project-relative copy',
    args: { mode: 'pro', parallelGates: true, gateSlots: 2, projectDir: L.fx.app, project: 'mission-control' },
    plan: L.plan,
    responses: [L.release, { label: `gate:${L.frd}`, times: 1, response: reopen }, { prefix: 'gate-worktree:', response: { ok: true, created: true } }],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const port = byLabel(run, `port-reviewer-tests:${L.frd}`)[0]
      const hash = byLabel(run, `reviewer-test-hash:${L.frd}`)[0]
      const cert = byLabel(run, `certify-patch:${L.frd}`)[0]
      const cPort = e2Cmd(port && port.prompt, 'port command VERBATIM, as ONE Bash call')
      const cHash = e2Cmd(hash && hash.prompt, 'hash command VERBATIM, as ONE Bash call')
      const cStage = e2Cmd(cert && cert.prompt, "stage the reviewer's test files with exactly this command")
      t.ok(cPort && cHash && cStage, `literal commands present (port ${Boolean(cPort)}, hash ${Boolean(cHash)}, stage ${Boolean(cStage)})`)
      const r1 = gcBash(cPort || 'false', L.fx.app)
      const r2 = gcBash(cHash || 'false', L.fx.app)
      const r3 = gcBash(cStage || 'false', L.fx.app)
      t.ok(r1.ok && r2.ok && r3.ok, `every command ran (${[r1, r2, r3].map((r) => r.ok ? 'ok' : r.err).join(' | ')})`)
      t.ok(r2.out.includes(L.sha), 'the integrity hash reads the ported copy (same sha256 as the reviewer\'s)')
      t.ok(!gcFs.existsSync(path.join(L.fx.app, 'mission-control')), 'NO doubled prefix directory')
      const st = L.staged()
      t.ok(st.length === 1 && st[0] === L.test, `certify stages exactly the one repo-root-relative test (staged: ${st.join(', ')})`)
      t.ok(cert && /If that command changed any docs\/frds\/\*\/frd\.md or blueprint\.md on disk/.test(cert.prompt) && cert.prompt.indexOf('publish last green snapshot') > cert.prompt.indexOf('stage snapshot (A)'), 'certify-patch commits the rollups and ends with the last-green ordering')
      t.ok(run.result && run.result.builtFrds.includes(L.frd), 'VERIFIED')
      gcFs.rmSync(L.fx.root, { recursive: true, force: true })
    },
  })
}

// (4) backstop: canary E2's notify-end ran sync-rollups, which changed nothing (FRD-05's flip was already on disk,
// just uncommitted), so the BL-0172 conditional commit never fired and the run ended dirty. The rollup commit now
// also covers a rollup document an earlier step left modified.
SCENARIOS.push({
  name: 'E2-4a. notify-end\'s rollup commit also covers an frd.md/blueprint.md an earlier landing left modified (not only what its own sync-rollups changed)',
  args: { mode: 'balanced', maxAgents: 7 },
  plan: mkPlan([{ frd: 'frd-e24a', deps: [], workOrders: [mkWo('wo-e24a-001', 'PLANNED', { frd: 'frd-e24a', artifacts: ['src/a/**'] })] }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const end = byLabel(run, 'notify-end')[0]
    const i = end ? end.prompt.indexOf('stage ONLY those rollup documents') : -1
    t.ok(end && i > 0 && /git status --porcelain -- docs\/frds` still lists one of those rollup documents as modified/.test(end.prompt.slice(0, i)), 'the commit condition includes rollup documents already modified before this step')
  },
})

// (5) E2 §4.5: visual-qa (sonnet) answered {done:false} in its first turn with 0 tool calls. The prompt was
// byte-identical to D2's (12 min of real work); the only new input was a harness relay of an unrelated owner
// question, framed as "this request wins", present in all 38 E2 transcripts. The prompt now scopes that relay,
// and a done:false must carry its reason, which the engine logs.
SCENARIOS.push({
  name: 'E2-5a. visual-qa — its prompt says an unrelated relayed message does not change this step, and a done:false carries a `reason` the engine logs (never a silent no-op)',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-e25', deps: [], workOrders: [mkWo('wo-e25-1', 'PLANNED', { frd: 'frd-e25', artifacts: ['src/app/e25/page.tsx'] })] }], { hasFrontend: true }),
  responses: [{ label: 'visual-qa', response: { done: false, reason: 'no mocks folder for frd-e25' } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const vq = byLabel(run, 'visual-qa')[0]
    t.ok(vq && /relayed/i.test(vq.prompt) && /not addressed to this step/i.test(vq.prompt), 'the prompt scopes a relayed message that does not address this step')
    t.ok(vq && vq.opts.schema && vq.opts.schema.properties && vq.opts.schema.properties.reason, 'the schema carries a reason field')
    t.ok(hasLog(run, /visual-qa .*done:false.*no mocks folder for frd-e25/), 'the engine logs the reason of a done:false')
  },
})

// (6) E2 §4 (BL-0193 residue): in a FRESH slot `.pandacorp/run/` does not exist (gitignored), so the collector's
// `> "$LOG"` redirect failed on its first attempt in 2/2 fresh slots. Executed on a slot with no run dir.
{
  const fx = gcNestedFixture('frd-e26-1')
  gcCleanups.splice(gcCleanups.indexOf(fx.root), 1)
  const slot = path.join(fx.app, '.pandacorp/run/gate-worktree-1')
  gcGit(fx.app, 'worktree', 'add', '--detach', '-q', slot, fx.pin)
  gcWrite(path.join(slot, 'mission-control/node_modules/.bin/vitest'), '#!/bin/sh\n')
  gcWrite(path.join(slot, 'mission-control/.pandacorp/verify.sh'), `mkdir -p .pandacorp/run && printf '{"green":true,"fresh":"slot-1"}' > .pandacorp/run/gate-report.json\n`)
  const h = d1Harness()
  SCENARIOS.push({
    name: 'E2-6a. digested collector in a FRESH slot with no .pandacorp/run/ (executed) — the command creates it, logs to the file and prints the report on its FIRST attempt',
    args: { mode: 'pro', parallelGates: true, gateSlots: 1, gateEvidence: 'digested', projectDir: fx.app, project: 'mission-control' },
    plan: d1Resume('e26', 1),
    responses: [{ prefix: 'evidence:', response: { report: '{"green":true,"scope":"since","subgates":[]}', diffStat: '', diff: '', truncated: false, tests: [], ac: '' } }, ...h.responses],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(!gcFs.existsSync(path.join(slot, 'mission-control/.pandacorp/run')), 'precondition: the slot has no .pandacorp/run/ (as in a fresh worktree)')
      const ev = byLabel(run, 'evidence:frd-e26-1')[0]
      const cmd = ev && (ev.prompt.match(/verbatim except PIN_BASE:\*\* `([^`]+)`/) || [])[1]
      const r = cmd ? gcBash(cmd.replace('<PIN_BASE>', 'base0'), gcOs.tmpdir()) : { ok: false, out: '', err: 'no command' }
      t.ok(r.ok && /verify exit=0/.test(r.out) && r.out.includes('"fresh":"slot-1"'), `first attempt succeeds (got ${(r.out || r.err || '').slice(0, 200)})`)
      t.ok(gcFs.existsSync(path.join(slot, 'mission-control/.pandacorp/run/evidence-verify.log')), 'the console log file was written')
      gcFs.rmSync(fx.root, { recursive: true, force: true })
    },
  })
}

// (7) E2 §4 BL-0179: the since-arm never fired, and it cannot be sound: every landing publishes last_green_sha
// from a `since`-scoped report (E2 apply-gate:frd-05 read `"scope": "since"` and published 4ceac8e0), so a report
// "since last_green_sha" stacks since on since — it never adds up to a full run. The close-out FULL suite is the
// declared backstop for `--since`'s blind spots (build-orchestration §5c). BL-0179's arm is retired; only
// BL-0147's exact full-green-at-HEAD reuse remains, now also checked by the engine itself.
SCENARIOS.push({
  name: 'E2-7a. the reuse-check prompt no longer offers a "since" arm (BL-0179 retired); BL-0147\'s full arm stays',
  args: { mode: 'balanced', maxAgents: 7 },
  plan: mkPlan([{ frd: 'frd-e27a', deps: [], workOrders: [mkWo('wo-e27a-001', 'PLANNED', { frd: 'frd-e27a', artifacts: ['src/a/**'] })] }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const check = byLabel(run, 'close-out-verify-reuse-check')[0]
    t.ok(check && !/reportScope === "since"/.test(check.prompt) && !/reportSince === lastGreenSha/.test(check.prompt), 'no since arm')
    t.ok(check && /reportScope === "full"/.test(check.prompt) && /reportSha === headSha/.test(check.prompt), 'the full arm is intact')
  },
})
SCENARIOS.push({
  name: 'E2-7b. an agent that still answers canReuse:true for a "since" report is overruled by the ENGINE → full rerun, no reuse event',
  args: { mode: 'balanced', maxAgents: 7 },
  plan: mkPlan([{ frd: 'frd-e27b', deps: [], workOrders: [mkWo('wo-e27b-001', 'PLANNED', { frd: 'frd-e27b', artifacts: ['src/a/**'] })] }]),
  responses: [{ label: 'close-out-verify-reuse-check', response: { canReuse: true, reason: 'reused', reportScope: 'since', reportSince: 'aaaa111', lastGreenSha: 'aaaa111', reportGreen: true, reportSha: 'deadbeef', headSha: 'deadbeef', dirty: false, ageSeconds: 30 } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const end = byLabel(run, 'notify-end')[0]
    t.ok(end && /FIRST run the FULL `bash \.pandacorp\/verify\.sh`/.test(end.prompt) && !/CloseOutVerifyReused/.test(end.prompt), 'the full suite runs; nothing is reused')
    t.ok(hasLog(run, /reuse refused by the engine/), 'the engine logs why it overruled the check')
  },
})
SCENARIOS.push({
  name: 'E2-7c. the engine also refuses a "full" canReuse:true whose sha does not match HEAD or whose tree is dirty (defense in depth over the agent)',
  args: { mode: 'balanced', maxAgents: 7 },
  plan: mkPlan([{ frd: 'frd-e27c', deps: [], workOrders: [mkWo('wo-e27c-001', 'PLANNED', { frd: 'frd-e27c', artifacts: ['src/a/**'] })] }]),
  responses: [{ label: 'close-out-verify-reuse-check', response: { canReuse: true, reason: 'reused', reportScope: 'full', reportGreen: true, reportSha: 'aaaa', headSha: 'bbbb', dirty: false, ageSeconds: 30 } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const end = byLabel(run, 'notify-end')[0]
    t.ok(end && /FIRST run the FULL `bash \.pandacorp\/verify\.sh`/.test(end.prompt) && !/CloseOutVerifyReused/.test(end.prompt), 'no reuse on a sha mismatch even when the agent says canReuse')
  },
})

// ---- BL-0202 ----
// For a project NESTED in a larger repository (Mission Control inside the factory, whose main checkout the owner
// shares with parallel sessions) `git status` lists the WHOLE repository, and the judge baseline's restore step
// (`git checkout <last_green_sha> -- <files>`) was built from that list: a parallel session's WIP under plugin/ or
// factory/ escalated the baseline and fell under its restore. Every tree read/write is now scoped to the project
// prefix; dirt outside it is informational; every restore/clean goes through a guard that refuses (exit 3,
// touching nothing) a path outside the prefix. EXECUTED against real nested and flat git repositories.
const b2Marker = (prompt, name) => e2Cmd(prompt, `the BL-0202 ${name} COMMAND`)
const b2Parse = (out) => {
  const lines = (out || '').split('\n').filter(Boolean)
  return {
    prefix: ((lines.find((l) => l.startsWith('PREFIX=')) || 'PREFIX=?').slice('PREFIX='.length)),
    in: lines.filter((l) => l.startsWith('IN ')).map((l) => l.slice(3)),
    out: lines.filter((l) => l.startsWith('OUT ')).map((l) => l.slice(4)),
  }
}
const b2Paths = (paths) => paths.map((p) => `'${p}'`).join(' ')
const b2Fill = (cmd, { sha = '', paths = [] } = {}) => cmd.replace('<LAST_GREEN_SHA>', sha).replace('<PATHS>', b2Paths(paths))
const b2Read = (file) => gcFs.readFileSync(file, 'utf8')
// Each BL-0202 fixture is removed by its own scenario (never via gcCleanups: a GC scenario empties that list
// when it runs, which is BEFORE these). A factory-shaped repo: repo/plugin/x.js (factory code) + repo/mission-control (the nested project).
function b2Nested() {
  const root = gcFs.mkdtempSync(path.join(gcOs.tmpdir(), 'bl0202-nested-'))
  const repo = path.join(root, 'repo')
  const app = path.join(repo, 'mission-control')
  gcFs.mkdirSync(app, { recursive: true })
  gcGit(repo, 'init', '-q'); gcGit(repo, 'config', 'user.email', 't@example.com'); gcGit(repo, 'config', 'user.name', 't')
  gcWrite(path.join(app, '.gitignore'), '.pandacorp/run/\n')
  gcWrite(path.join(app, '.pandacorp/status.yaml'), 'phase: implementation\n')
  gcWrite(path.join(app, 'src/y.ts'), 'export const y = 1\n')
  gcWrite(path.join(repo, 'plugin/x.js'), 'factory v1\n')
  gcGit(repo, 'add', '-A'); gcGit(repo, 'commit', '-qm', 'base')
  return { root, repo, app, base: gcGit(repo, 'rev-parse', 'HEAD'), branch: gcGit(repo, 'rev-parse', '--abbrev-ref', 'HEAD') }
}
function b2Flat() {
  const root = gcFs.mkdtempSync(path.join(gcOs.tmpdir(), 'bl0202-flat-'))
  const repo = path.join(root, 'app')
  gcFs.mkdirSync(repo, { recursive: true })
  gcGit(repo, 'init', '-q'); gcGit(repo, 'config', 'user.email', 't@example.com'); gcGit(repo, 'config', 'user.name', 't')
  gcWrite(path.join(repo, '.gitignore'), '.pandacorp/run/\n')
  gcWrite(path.join(repo, '.pandacorp/status.yaml'), 'phase: implementation\n')
  gcWrite(path.join(repo, 'src/y.ts'), 'export const y = 1\n')
  gcGit(repo, 'add', '-A'); gcGit(repo, 'commit', '-qm', 'base')
  return { root, repo, app: repo, base: gcGit(repo, 'rev-parse', 'HEAD') }
}
// The pre-check agent, played honestly: it runs the engine's own STATUS command and reports what it printed.
const b2HonestPrecheck = (cwd) => (call) => {
  const cmd = b2Marker(call.prompt, 'STATUS')
  const r = cmd ? gcBash(cmd, cwd) : { ok: false, out: '' }
  const s = b2Parse(r.out)
  if (!r.ok || !s.in.length) return { escalate: true, dirty: false, dirtyPaths: [], outsideDirtyPaths: s.out }
  return { escalate: true, dirty: true, dirtyPaths: s.in, outsideDirtyPaths: s.out, leaseValid: true, projectPrefix: s.prefix }
}

{
  // (a) the pre-check's listing, executed: plugin/x.js is OUT, mission-control/src/y.ts is IN.
  const fx = b2Nested()
  gcWrite(path.join(fx.repo, 'plugin/x.js'), 'factory WIP of another session\n')
  gcWrite(path.join(fx.app, 'src/y.ts'), 'export const y = 2\n')
  SCENARIOS.push({
    name: 'BL-0202a. nested project — the pre-check lists the tree with a LITERAL project-scoped status command (executed): mission-control/src/y.ts is IN, the factory WIP plugin/x.js is OUT (informational), the prefix is reported',
    args: { mode: 'pro', projectDir: fx.app, project: 'mission-control' },
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const p = byLabel(run, 'baseline-precheck')[0]
      const cmd = b2Marker(p && p.prompt, 'STATUS')
      t.ok(Boolean(cmd), 'the pre-check prompt carries the BL-0202 STATUS COMMAND')
      const r = cmd ? gcBash(cmd, fx.repo) : { ok: false, out: '', err: 'no command' }   // from the REPO ROOT: the command is anchored with -C, cwd does not matter
      const s = b2Parse(r.out)
      t.ok(r.ok, `the command runs (${r.err || ''})`)
      t.ok(s.prefix === 'mission-control/', `PREFIX is the project's show-prefix (got ${JSON.stringify(s.prefix)})`)
      t.ok(JSON.stringify(s.in) === '["mission-control/src/y.ts"]', `IN = the project's dirt only, bare and repo-root-relative (got ${JSON.stringify(s.in)})`)
      t.ok(JSON.stringify(s.out) === '["plugin/x.js"]', `OUT = the factory WIP (got ${JSON.stringify(s.out)})`)
      t.ok(/OUT paths are INFORMATIONAL ONLY/.test(p.prompt) && /never escalate/.test(p.prompt) && /outsideDirtyPaths/.test(p.prompt), 'the prompt says OUT paths never escalate and are reported as outsideDirtyPaths')
      t.ok(/diff --name-only --relative/.test(p.prompt), 'the pointer-commit check (BL-0066 b) reads the project\'s own paths (--relative), so a nested pointer commit can match')
      t.ok(!/run `git -C [^`]* status --porcelain` and read/.test(p.prompt), 'the old unscoped whole-repo status read is gone')
      gcFs.rmSync(fx.root, { recursive: true, force: true })
    },
  })
}
{
  // (b) RED→GREEN: only the factory WIP and the lease's own status.yaml are dirty. The honest agent (real command
  // output) reports status.yaml IN and plugin/x.js OUT → BL-0124 fast path, no judge baseline, OUT logged.
  const fx = b2Nested()
  gcWrite(path.join(fx.repo, 'plugin/x.js'), 'factory WIP of another session\n')
  gcFs.appendFileSync(path.join(fx.app, '.pandacorp/status.yaml'), 'running: true\n')
  SCENARIOS.push({
    name: 'BL-0202b. nested project, factory WIP outside the project + the leased status.yaml (REAL command output) → the pre-check does NOT escalate; the outside path is logged as informational',
    args: { mode: 'pro', projectDir: fx.app, project: 'mission-control' },
    responses: [{ label: 'baseline-precheck', response: b2HonestPrecheck(fx.repo) }],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(byLabel(run, 'baseline').length === 0, 'no judge baseline: the dirt outside the project does not escalate')
      t.ok(hasLog(run, /BL-0124/), 'the BL-0124 fast path fires on the in-project status.yaml alone')
      t.ok(hasLog(run, /BL-0202: 1 ruta\(s\) sucia\(s\) FUERA del proyecto \(mission-control\/\).*informativo.*plugin\/x\.js/), 'the outside path is logged as informational')
      t.ok(b2Read(path.join(fx.repo, 'plugin/x.js')) === 'factory WIP of another session\n', 'plugin/x.js untouched')
      gcFs.rmSync(fx.root, { recursive: true, force: true })
    },
  })
}
SCENARIOS.push({
  name: 'BL-0202c. an agent that still lists the whole repository (plugin/x.js in dirtyPaths) is re-partitioned by the ENGINE on the project prefix → fast path, outside path informational',
  args: { mode: 'pro' },
  responses: [{ label: 'baseline-precheck', response: { escalate: true, dirty: true, dirtyPaths: ['mission-control/.pandacorp/status.yaml', 'plugin/x.js'], leaseValid: true, projectPrefix: 'mission-control/' } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'baseline').length === 0, 'no judge baseline for dirt outside the project')
    t.ok(hasLog(run, /BL-0202: .*informativo.*plugin\/x\.js/), 'logged as informational')
  },
})
SCENARIOS.push({
  name: 'BL-0202c2. controls — real in-project WIP next to outside dirt still escalates; with no prefix (flat project / unverifiable claim) every path stays in-project, exactly as before',
  args: { mode: 'pro' },
  responses: [{ label: 'baseline-precheck', response: { escalate: true, dirty: true, dirtyPaths: ['mission-control/.pandacorp/status.yaml', 'mission-control/src/y.ts', 'plugin/x.js'], leaseValid: true, projectPrefix: 'mission-control/' } }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const b = byLabel(run, 'baseline')[0]
    t.ok(Boolean(b), 'the judge baseline runs for mission-control/src/y.ts')
    t.ok(b && /leave every one exactly as it is: `plugin\/x\.js`/.test(b.prompt), 'and it is told plugin/x.js is an OUT path it must leave exactly as it is')
  },
})
for (const [tag, dirtyPaths, projectPrefix] of [['d', ['.pandacorp/status.yaml', 'plugin/x.js'], ''], ['e', ['.pandacorp/status.yaml', 'src/x.ts'], '']]) {
  SCENARIOS.push({
    name: `BL-0202c${tag}. flat project (prefix '') — ${JSON.stringify(dirtyPaths)} is all in-project: escalates exactly as before BL-0202, nothing logged as outside`,
    args: { mode: 'pro' },
    responses: [{ label: 'baseline-precheck', response: { escalate: true, dirty: true, dirtyPaths, leaseValid: true, projectPrefix } }],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(byLabel(run, 'baseline').length === 1, 'the judge baseline runs')
      t.ok(!hasLog(run, /BL-0202: .*FUERA/), 'no outside-path log for a flat project')
    },
  })
}
{
  // (d) the judge baseline's restore, executed: only mission-control/ is restored; plugin/x.js stays dirty. Then the
  // guard's refusals, executed against the same repository.
  const fx = b2Nested()
  gcWrite(path.join(fx.repo, 'plugin/x.js'), 'factory WIP of another session\n')
  gcWrite(path.join(fx.app, 'src/y.ts'), 'export const y = 2 // half-written by a killed run\n')
  SCENARIOS.push({
    name: 'BL-0202d. nested project, judge baseline (executed): its STATUS + RESTORE commands restore mission-control/src/y.ts to last green and leave the factory WIP plugin/x.js dirty; no stash is dropped, no whole-tree form is offered',
    args: { mode: 'pro', projectDir: fx.app, project: 'mission-control' },
    responses: [{ label: 'baseline-precheck', response: b2HonestPrecheck(fx.repo) }],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const b = byLabel(run, 'baseline')[0]
      t.ok(Boolean(b), 'the in-project dirt escalates to the judge baseline')
      const status = b2Marker(b && b.prompt, 'STATUS')
      const restore = b2Marker(b && b.prompt, 'RESTORE')
      t.ok(status && restore, `the baseline prompt carries the literal STATUS (${Boolean(status)}) and RESTORE (${Boolean(restore)}) commands`)
      const s = b2Parse(gcBash(status || 'false', fx.app).out)
      t.ok(JSON.stringify(s.in) === '["mission-control/src/y.ts"]' && JSON.stringify(s.out) === '["plugin/x.js"]', `the baseline sees src/y.ts IN and plugin/x.js OUT (got ${JSON.stringify(s)})`)
      const r = gcBash(b2Fill(restore || 'false', { sha: fx.base, paths: s.in }), fx.app)
      t.ok(r.ok, `the restore ran (${r.err || ''})`)
      t.ok(b2Read(path.join(fx.app, 'src/y.ts')) === 'export const y = 1\n', 'mission-control/src/y.ts is back at last green')
      t.ok(b2Read(path.join(fx.repo, 'plugin/x.js')) === 'factory WIP of another session\n', 'plugin/x.js is STILL dirty with the other session\'s WIP')
      t.ok(gcGit(fx.repo, 'rev-parse', 'HEAD') === fx.base && gcGit(fx.repo, 'rev-parse', '--abbrev-ref', 'HEAD') === fx.branch, 'HEAD and the branch did not move')
      t.ok(b && /leave EVERY stash as it is — never drop or pop one/.test(b.prompt) && !/drop entries that are leftover build stashes/.test(b.prompt), 'no stash is dropped (the stash list is repository-wide)')
      t.ok(b && /NEVER a whole-tree form/.test(b.prompt) && /never `git add -A`\/`git add \.`\/`git commit -a`/.test(b.prompt), 'whole-tree resets/checkouts/cleans and whole-repo staging are forbidden')
      t.ok(b && !/`git checkout <last_green_sha> -- <those modified tracked files/.test(b.prompt), 'the old unguarded restore form is gone')

      // Guard refusals: nothing is touched, exit 3, a BL-0202 REFUSED message.
      gcWrite(path.join(fx.app, 'src/y.ts'), 'export const y = 3\n')
      const refuse = (label, paths) => {
        const before = [b2Read(path.join(fx.repo, 'plugin/x.js')), b2Read(path.join(fx.app, 'src/y.ts')), gcGit(fx.repo, 'rev-parse', 'HEAD')]
        const x = gcBash(b2Fill(restore || 'true', { sha: fx.base, paths }), fx.app)
        const after = [b2Read(path.join(fx.repo, 'plugin/x.js')), b2Read(path.join(fx.app, 'src/y.ts')), gcGit(fx.repo, 'rev-parse', 'HEAD')]
        t.ok(!x.ok && /BL-0202 REFUSED/.test(x.err || ''), `${label}: fail-loud refusal (ok=${x.ok}, err=${(x.err || '').trim()})`)
        t.ok(JSON.stringify(before) === JSON.stringify(after), `${label}: nothing was touched`)
        return x
      }
      t.ok(/OUTSIDE this project/.test(refuse('a factory path', ['plugin/x.js']).err), 'the refusal names the outside path')
      refuse('all-or-nothing: an in-project path next to an outside one', ['mission-control/src/y.ts', 'plugin/x.js'])
      refuse('a `..` escape from the prefix', ['mission-control/../plugin/x.js'])
      refuse('an absolute path', [path.join(fx.repo, 'plugin/x.js')])
      refuse('a project-relative path (the doubled-prefix convention, fails loud instead)', ['src/y.ts'])
      refuse('the controller-owned status.yaml', ['mission-control/.pandacorp/status.yaml'])
      refuse('an empty list (would move HEAD)', [])
      const z = gcExecFile('zsh', ['-c', b2Fill(restore || 'false', { sha: fx.base, paths: ['plugin/x.js'] }) + ' ; echo "exit=$?"'], { cwd: fx.app, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      t.ok(/exit=3/.test(z) && b2Read(path.join(fx.repo, 'plugin/x.js')) === 'factory WIP of another session\n', 'the guard also refuses under zsh (the agent\'s login shell on the owner\'s Mac)')
      const zr = gcExecFile('zsh', ['-c', b2Fill(restore || 'false', { sha: fx.base, paths: ['mission-control/src/y.ts'] }) + ' ; echo "exit=$?"'], { cwd: fx.app, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      t.ok(/exit=0/.test(zr) && b2Read(path.join(fx.app, 'src/y.ts')) === 'export const y = 1\n', 'and restores an in-project path under zsh')

      // The CLEAN command: removes an untracked in-project preview page, refuses an outside path.
      const clean = b2Marker(b && b.prompt, 'CLEAN')
      t.ok(Boolean(clean), 'the baseline prompt carries the literal CLEAN command')
      gcWrite(path.join(fx.app, 'src/app/preview-wo1/page.tsx'), 'scratch\n')
      gcWrite(path.join(fx.repo, 'plugin/scratch.txt'), 'another session\'s untracked file\n')
      const c1 = gcBash(b2Fill(clean || 'false', { paths: ['mission-control/src/app/preview-wo1/'] }), fx.app)
      t.ok(c1.ok && !gcFs.existsSync(path.join(fx.app, 'src/app/preview-wo1')), `the in-project preview page is cleaned (${c1.err || ''})`)
      const c2 = gcBash(b2Fill(clean || 'true', { paths: ['plugin/scratch.txt'] }), fx.app)
      t.ok(!c2.ok && /OUTSIDE this project/.test(c2.err || '') && gcFs.existsSync(path.join(fx.repo, 'plugin/scratch.txt')), 'an outside untracked file is refused and survives')
      gcFs.rmSync(fx.root, { recursive: true, force: true })
    },
  })
}
{
  // (e) a flat project: identical behavior — PREFIX is empty, everything is IN, the same restore works on
  // project paths; the guard still refuses status.yaml and a `..` escape.
  const fx = b2Flat()
  gcWrite(path.join(fx.repo, 'src/y.ts'), 'export const y = 2\n')
  SCENARIOS.push({
    name: 'BL-0202e. flat project (prefix empty, executed) — everything is IN, nothing is OUT, and the same RESTORE command restores src/y.ts exactly as the pre-BL-0202 restore did',
    args: { mode: 'pro', projectDir: fx.app, project: 'flat' },
    responses: [{ label: 'baseline-precheck', response: b2HonestPrecheck(fx.repo) }],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const b = byLabel(run, 'baseline')[0]
      const status = b2Marker(b && b.prompt, 'STATUS')
      const restore = b2Marker(b && b.prompt, 'RESTORE')
      const s = b2Parse(gcBash(status || 'false', fx.repo).out)
      t.ok(s.prefix === '' && JSON.stringify(s.in) === '["src/y.ts"]' && s.out.length === 0, `flat: PREFIX empty, src/y.ts IN, no OUT (got ${JSON.stringify(s)})`)
      t.ok(!hasLog(run, /BL-0202: .*FUERA/), 'no outside-path log')
      const r = gcBash(b2Fill(restore || 'false', { sha: fx.base, paths: ['src/y.ts'] }), fx.repo)
      t.ok(r.ok && b2Read(path.join(fx.repo, 'src/y.ts')) === 'export const y = 1\n', `restored (${r.err || ''})`)
      const x = gcBash(b2Fill(restore || 'true', { sha: fx.base, paths: ['.pandacorp/status.yaml'] }), fx.repo)
      const y = gcBash(b2Fill(restore || 'true', { sha: fx.base, paths: ['../elsewhere'] }), fx.repo)
      t.ok(!x.ok && !y.ok && /REFUSED/.test(x.err) && /REFUSED/.test(y.err), 'the guard still refuses status.yaml and a `..` escape on a flat project')
      gcFs.rmSync(fx.root, { recursive: true, force: true })
    },
  })
}
{
  // (f) the foundation auto-repair's reset: a nested project never hard-resets (it would rewind the whole
  // repository — other sessions' commits and WIP included); a flat one keeps the ANCESTOR reset unchanged.
  const plan = mkPlan([{ frd: 'frd-b2f', deps: [], workOrders: [mkWo('wo-b2f-surf', 'PLANNED', { frd: 'frd-b2f', artifacts: ['src/app/surface/**'] })] }], { hasFrontend: true })
  SCENARIOS.push({
    name: 'BL-0202f. foundation auto-repair — hard reset only when PREFIX is empty; a nested project takes the guarded scoped restore/clean path even when last green is an ancestor',
    args: { mode: 'pro' },
    plan,
    responses: [{ label: 'foundation-gate', times: 1, response: { complete: false, missing: [{ name: 'Room', referencedBy: ['frd-b2f'], suggestedPath: 'src/components/core/Room.tsx' }] } }],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const fr = byLabel(run, 'foundation-repair:1')[0]
      const p = (fr && fr.prompt) || ''
      t.ok(/If ANCESTOR AND PREFIX is empty\*\* \(a project at its repository root\): `git reset --hard <last_green_sha>`/.test(p), 'flat project: the ANCESTOR hard reset is unchanged')
      t.ok(/If PREFIX is NOT empty\*\*[^\n]*NEVER `git reset --hard`[^\n]*take the surgical path below even when ANCESTOR/.test(p), 'nested project: never a hard reset')
      t.ok(Boolean(b2Marker(p, 'RESTORE')) && Boolean(b2Marker(p, 'CLEAN')), 'the surgical path uses the guarded RESTORE and CLEAN commands')
      t.ok(!/`git checkout HEAD -- <those surface files>` and `git clean -fd <their new dirs>`/.test(p), 'the old unguarded checkout/clean is gone')
    },
  })
}
SCENARIOS.push({
  name: 'BL-0202g. the per-WO commit reads THIS project\'s status only (`git status -- .`)',
  args: { mode: 'pro' },
  plan: mkPlan([{ frd: 'frd-b2g', deps: [], workOrders: [mkWo('wo-b2g-001', 'PLANNED', { frd: 'frd-b2g' })] }]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const c = byLabel(run, /^commit:/)[0]
    t.ok(c && /use `git status -- \.` \(THIS project only, BL-0202\)/.test(c.prompt) && !/use `git status` to identify/.test(c.prompt), `scoped status read in the commit step (labels: ${run.calls.map((x) => x.label).join(' ')})`)
  },
})

// ---- F2 drift finder ----
// BL-0203 (canary F2, BL-0201): `gateEvidence:'digested'` cut the gate's cost −62 % on canary E2 but its judge never
// opened the files where the FRD's drift lived (an 8-read budget + a diff scoped to the reviewed WOs), so it lost
// AC-02-010.8, REQ-03-001 and the lenient `Date.parse` in formatLastSync. The fix under test: a sonnet whole-FRD
// DRIFT FINDER (`find:drift:<frd>`, agent pandacorp:drift-finder) that runs beside the gate's evidence collection
// (and beside the split gate's four lenses), gets the FRD's whole contract roster and NOT the diff, and PROPOSES:
// its report reaches the judge's prompt (DR-015: the reviewer judges), and every drift claim with a probe that the
// judge neither recorded nor refuted with a test of its own goes through the DR-122 differential proof — proven
// pre-existing → card + `drift:`; a regression or a reviewed-WO-owned contract failing at the pin → reopened
// patch-first; anything else → discarded with a log (a finder claim never becomes an unproven cycle fault).
const f2Slug = (id) => id.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const f2Probe = (frd, id) => `.pandacorp/run/drift-probes/${frd}/${f2Slug(id)}.finder.drift-probe.ts`
const f2Row = (frd, id, status, extra = {}) => ({
  contract: `${id} — ${extra.text || 'fixture contract'}`,
  contractClass: extra.contractClass || (id.startsWith('REQ') ? 'requirement' : 'acceptance-criterion'),
  owner: extra.owner || 'none',
  status,
  claim: extra.claim || (extra.owner && extra.owner !== 'none' ? 'cycle' : 'preexisting'),
  evidence: { file: extra.file || 'src/lib/fixture.ts', line: extra.line || 1, snippet: extra.snippet || 'fixture()' },
  ...(status === 'drift' ? { probe_test: extra.probe || f2Probe(frd, id), direction: extra.direction || 'code' } : {}),
  why: extra.why || 'fixture',
})
const f2Finding = (rows, extra = {}) => ({ contracts: rows, toolCalls: 31, budgetExhausted: false, ...extra })
const f2Proof = ({ frd, wos, owned, probes, baseValid = true }) => ({ output: JSON.stringify({
  ok: true, version: 1, frd, pin: 'pin0000aa', base: 'base000bb', baseValid, baseReason: baseValid ? '' : 'no valid base',
  owned: Object.fromEntries(wos.map((w) => [`docs/frds/${frd}/work-orders/${w}.md`, { sourceRequirements: owned, ids: owned }])),
  probes: probes.map(([id, head, base]) => ({ path: f2Probe(frd, id), stored: `.pandacorp/run/gate-evidence/${frd}/drift/${f2Slug(id)}.finder.drift-probe.ts`, head: head.map(b178Run), base: base.map(b178Run) })),
  cleanup: { ok: true, leftover: [] },
}) })
const f2Pack = (tag) => ({ report: wp06GreenReport, diffStat: ` src/${tag}/x.ts | 3 ++- F2-STAT-${tag}`, diff: `+// F2-DIFF-${tag}`, truncated: false, ac: `AC-80-001.1 WHEN F2-AC-${tag} THE SYSTEM SHALL hold` })
const f2Plan = (frd, wo, extra = {}) => mkPlan([{ frd, deps: [], workOrders: [{ ...mkWo(wo, 'PLANNED', { frd, artifacts: [`src/${frd}/**`], reopen_count: extra.reopen_count }), acText: extra.acText }, ...(extra.verified || [])] }])
// A rendezvous: a response that resolves only once another call has been MADE proves the two ran concurrently
// (a sequential engine would never make the other call while this one is pending — the wait times out instead).
function f2Rendezvous() {
  const marks = new Set()
  const seen = {}
  const mark = (tag, value) => (call) => { marks.add(tag); return typeof value === 'function' ? value(call) : value }
  const waitFor = async (tag, ms = 400) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) { if (marks.has(tag)) return true; await new Promise((r) => setTimeout(r, 2)) }
    return false
  }
  const finderAfter = (tag, finding) => async () => { seen[tag] = await waitFor(tag); return finding }
  return { mark, finderAfter, seen }
}

// (a) serial first gate, digested: ONE finder, sonnet, in the pinned slot, launched concurrently with the evidence
// collector; it gets the FRD's whole roster (a VERIFIED WO included) and the method — never the diff or the pack.
{
  const rv = f2Rendezvous()
  SCENARIOS.push({
    name: 'F2a1. digested (serial first gate) — find:drift:<frd> spawns ONCE, sonnet/medium, in the pinned slot, CONCURRENT with evidence:<frd>; gets the whole FRD roster, never the diff; its report reaches the judge',
    args: { mode: 'pro', gateEvidence: 'digested' },
    plan: f2Plan('frd-f2a1', 'wo-f2a1-002', { acText: 'AC-80-002.1 WHEN F2A1-CYCLE-AC THE SYSTEM SHALL hold', verified: [mkWo('wo-f2a1-001', 'VERIFIED', { frd: 'frd-f2a1', artifacts: ['src/f2a1-old/**'] })] }),
    responses: [
      { prefix: 'evidence:', response: rv.mark('evidence', f2Pack('f2a1')) },
      { prefix: 'find:drift:', response: rv.finderAfter('evidence', f2Finding([
        f2Row('frd-f2a1', 'REQ-80-001', 'implemented', { file: 'src/lib/portfolio.ts', line: 335, snippet: 'F2A1-IMPL-SNIPPET' }),
        f2Row('frd-f2a1', 'AC-80-002.1', 'implemented', { owner: 'wo-f2a1-002' }),
      ])) },
    ],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const fd = byLabel(run, /^find:drift:/)
      t.ok(fd.length === 1 && fd[0].label === 'find:drift:frd-f2a1', `exactly ONE finder, labelled find:drift:<frd> (got ${fd.map((c) => c.label).join(', ')})`)
      const f = fd[0]
      t.ok(f && f.opts.model === 'sonnet' && f.opts.effort === 'medium', `the finder runs on sonnet at effort medium (got ${f && f.opts.model}/${f && f.opts.effort})`)
      t.ok(f && f.opts.agentType === 'pandacorp:drift-finder' && f.opts.fallbackAgentType === 'pandacorp:reviewer', 'agentType pandacorp:drift-finder, degrading honestly to the reviewer definition (still sonnet) on a stale session')
      t.ok(f && /^Work from the GATE WORKTREE/.test(f.prompt) && /pinned commit/.test(f.prompt), 'it reads the code in the PINNED gate worktree, not the moving main tree')
      t.ok(rv.seen.evidence === true, 'the collector was spawned WHILE the finder was still running (concurrent, not sequential)')
      t.ok(f && /Whole-FRD drift finder method/.test(f.prompt) && /docs\/frds\/frd-f2a1\/frd\.md/.test(f.prompt), 'the finder carries the method and the FRD it inventories')
      t.ok(f && /wo-f2a1-001 · VERIFIED/.test(f.prompt) && /wo-f2a1-002 · PLANNED|wo-f2a1-002 · IN_REVIEW/.test(f.prompt), 'it gets the WHOLE roster of the FRD, the VERIFIED foundation included (where drift lives)')
      t.ok(f && /F2A1-CYCLE-AC/.test(f.prompt), "it gets the planner's verbatim criteria of the cycle's work orders")
      t.ok(f && /at most 60 tool calls/.test(f.prompt), 'an explicit tool budget (60) instead of the digested 8-read cap')
      t.ok(f && /\.pandacorp\/run\/drift-probes\/frd-f2a1\/<contract-id-slug>\.finder\.drift-probe\.ts/.test(f.prompt), 'probes go to the finder-only path the DR-122 proof accepts')
      t.ok(f && !/F2-DIFF-f2a1/.test(f.prompt) && !/F2-STAT-f2a1/.test(f.prompt) && !/ATTACHMENT 2\/3/.test(f.prompt) && !/YOUR EVIDENCE IS ALREADY COLLECTED/.test(f.prompt), 'the finder NEVER receives the diff or the evidence pack')
      const gate = byLabel(run, 'gate:frd-f2a1')[0]
      t.ok(gate && f && gate.index > f.index, 'the judge spawns after the finder')
      t.ok(gate && /WHOLE-FRD DRIFT FINDER REPORT/.test(gate.prompt) && /F2A1-IMPL-SNIPPET/.test(gate.prompt) && /src\/lib\/portfolio\.ts:335/.test(gate.prompt), "the finder's report (with its file:line pointers) reaches the judge's prompt")
      t.ok(gate && /not a verdict/i.test(gate.prompt) && /you are the judge/i.test(gate.prompt), 'framed as a proposal — the reviewer stays the judge (DR-015)')
      t.ok(run.result && run.result.builtFrds.includes('frd-f2a1'), 'the FRD verified')
    },
  })
}
// (a) split gate, digested: the finder overlaps the four lenses; the lenses stay four (and never see the report);
// the closer gets the report.
// (Under parallelGates — the canary's configuration — the collector runs inline in the slot link, so the finder
// overlaps the collector AND the lenses. On the single legacy slot it overlaps the collector only: that link must
// hold the one worktree until the finder has read it, before the chain may check out another pin.)
{
  const rv = f2Rendezvous()
  const h = d1Harness()
  SCENARIOS.push({
    name: 'F2a2. digested SPLIT gate (parallelGates slot) — find:drift runs IN PARALLEL with the 4 finder lenses (still 4 lenses, report-free); the closer receives the finder report',
    args: { mode: 'powerful', gateEvidence: 'digested', parallelGates: true, gateSlots: 1 },
    plan: f2Plan('frd-f2a2', 'wo-f2a2-001', { reopen_count: 1 }),
    responses: [
      { prefix: 'evidence:', response: f2Pack('f2a2') },
      { prefix: 'find:drift:', response: rv.finderAfter('lens', f2Finding([f2Row('frd-f2a2', 'REQ-80-010', 'implemented', { snippet: 'F2A2-IMPL' })])) },
      { label: /^find:(?!drift:)/, response: rv.mark('lens', { findings: [] }) },
      ...h.responses,
    ],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      const lenses = byLabel(run, /^find:(?!drift:)/)
      t.ok(lenses.length === 4, `the four split lenses still spawn (got ${lenses.length})`)
      t.ok(byLabel(run, /^find:drift:/).length === 1, 'plus exactly one drift finder')
      t.ok(rv.seen.lens === true, 'a lens was spawned WHILE the finder was still running (the finder overlaps the lenses)')
      t.ok(lenses.every((c) => !/WHOLE-FRD DRIFT FINDER REPORT/.test(c.prompt)), 'the lenses stay independent of the finder report')
      const closer = byLabel(run, 'gate:frd-f2a2')[0]
      t.ok(closer && /WHOLE-FRD DRIFT FINDER REPORT/.test(closer.prompt) && /F2A2-IMPL/.test(closer.prompt) && closer.opts.model === 'opus', 'the opus closer receives the report')
      t.ok(run.result && run.result.builtFrds.includes('frd-f2a2'), 'the FRD verified')
    },
  })
}
// (b) a pre-existing drift the judge did not record: the engine submits the finder's claim to the DR-122 proof.
SCENARIOS.push({
  name: 'F2b1. a finder DRIFT with a probe that the judge ignored → merged as a claim → drift-proof runs the finder probe → proven pre-existing → card + drift: frontmatter; the cycle is not blocked',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: f2Plan('frd-f2b1', 'wo-f2b1-001'),
  responses: [
    { prefix: 'evidence:', response: f2Pack('f2b1') },
    { prefix: 'find:drift:', response: f2Finding([
      f2Row('frd-f2b1', 'REQ-81-001', 'drift', { text: 'architecture projects SHALL NOT appear', file: 'src/lib/portfolio.ts', line: 335, snippet: 'ACTIVE_PHASES = ["design", "architecture"]' }),
      f2Row('frd-f2b1', 'AC-81-009.1', 'implemented', { owner: 'wo-f2b1-001' }),
    ]) },
    { label: 'gate:frd-f2b1', response: { green: true, testFiles: [], traceability: validTraceability } },
    { prefix: 'drift-proof:', response: f2Proof({ frd: 'frd-f2b1', wos: ['wo-f2b1-001'], owned: ['AC-81-009.1'], probes: [['REQ-81-001', ['fail', 'fail'], ['fail', 'fail']]] }) },
    b178Record,
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-f2b1')[0]
    t.ok(gate && gate.prompt.includes(f2Probe('frd-f2b1', 'REQ-81-001')) && /ACTIVE_PHASES/.test(gate.prompt), 'the judge saw the drift claim, its evidence and its probe')
    const proof = byLabel(run, 'drift-proof:frd-f2b1')
    t.ok(proof.length === 1 && proof[0].prompt.includes(`--probe '${f2Probe('frd-f2b1', 'REQ-81-001')}'`), "the engine proved the FINDER's probe with the DR-122 differential run")
    t.ok(proof[0] && /GATE WORKTREE|gate-worktree/.test(proof[0].prompt), 'the proof reads the probe from the slot the finder wrote it in')
    t.ok(hasLog(run, /drift finder.*REQ-81-001.*(submitted|merged)/i), 'the merge of an un-adjudicated finder claim is logged')
    t.ok(hasLog(run, /REQ-81-001 is PROVEN pre-existing drift/), 'proven pre-existing by the same predicate as a reviewer claim')
    const rec = byLabel(run, /^drift-record:/)
    t.ok(rec.length === 1 && /REQ-81-001/.test(rec[0].prompt), 'a draft card is filed for the owner')
    const apply = byLabel(run, 'apply-gate:frd-f2b1')[0]
    t.ok(apply && /drift: \[REQ-81-001\]/.test(apply.prompt), 'the certifying landing writes the drift: replica')
    t.ok(byLabel(run, /^patch:/).length === 0 && run.result && run.result.builtFrds.includes('frd-f2b1'), 'never a block, never a reopen: the FRD verified')
  },
})
SCENARIOS.push({
  name: 'F2b2. a finder DRIFT on a contract a REVIEWED work order owns (the formatLastSync Date.parse case), which the judge passed without a test of its own → probe fails at the pin → cycle fault → reopened patch-first with the finder probe as the RED test',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: f2Plan('frd-f2b2', 'wo-f2b2-001'),
  responses: [
    { prefix: 'evidence:', response: f2Pack('f2b2') },
    { prefix: 'find:drift:', response: f2Finding([f2Row('frd-f2b2', 'AC-82-007.2', 'drift', { owner: 'wo-f2b2-001', text: 'an unparseable date SHALL render "unknown"', file: 'src/lib/formatLastSync.ts', line: 12, snippet: 'if (Number.isNaN(Date.parse(date)))', why: 'V8 parses "N/A 3" as 2001-03-01' })]) },
    { label: 'gate:frd-f2b2', times: 1, response: { green: true, testFiles: ['src/f2b2/_tests/new.reviewer.test.ts'], traceability: [...validTraceability, { contract: 'AC-82-007.2 — an unparseable date SHALL render "unknown"', contractClass: 'acceptance-criterion', status: 'pass', tests: ['src/f2b2/_tests/old-month13.test.ts'] }] } },
    { prefix: 'drift-proof:', response: f2Proof({ frd: 'frd-f2b2', wos: ['wo-f2b2-001'], owned: ['AC-82-007.2'], probes: [['AC-82-007.2', ['fail', 'fail'], ['load', 'load']]] }) },
    { prefix: 'verify-patch:', response: { green: true, inheritedResolved: [{ contract: 'AC-82-007.2 — an unparseable date SHALL render "unknown"', pass: true, tests: ['src/f2b2/_tests/lenient.test.ts'] }] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'drift-proof:frd-f2b2').length === 1, 'the claim was proven, not trusted')
    t.ok(hasLog(run, /AC-82-007\.2.*CYCLE FAULT/), 'owned + failing on an assertion at the pin → a cycle fault')
    const patch = byLabel(run, 'patch:frd-f2b2')[0]
    t.ok(patch && /AC-82-007\.2/.test(patch.prompt) && patch.prompt.includes('.pandacorp/run/gate-evidence/frd-f2b2/drift/ac-82-007-2.finder.drift-probe.ts'), 'patch-first, with the finder probe handed over as the RED-proven failing test')
    t.ok(byLabel(run, /^drift-record:/).length === 0, 'no card: it is this cycle\'s defect, not legacy drift')
    const vp = byLabel(run, 'verify-patch:frd-f2b2')[0]
    t.ok(vp && /INHERITED OPEN CONTRACTS/.test(vp.prompt) && /AC-82-007\.2/.test(vp.prompt), 'the independent verifier must prove the contract closed')
    t.ok(run.result && run.result.builtFrds.includes('frd-f2b2'), 'the FRD verified after the patch')
  },
})
SCENARIOS.push({
  name: 'F2b3. the judge REFUTES a finder drift with a test of its own (status pass + that test in testFiles) → the claim is dropped before any proof (DR-015: the reviewer is the judge)',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: f2Plan('frd-f2b3', 'wo-f2b3-001'),
  responses: [
    { prefix: 'evidence:', response: f2Pack('f2b3') },
    { prefix: 'find:drift:', response: f2Finding([f2Row('frd-f2b3', 'AC-83-004.1', 'drift', { text: 'the chip SHALL be shown' })]) },
    { label: 'gate:frd-f2b3', response: { green: true, testFiles: ['src/f2b3/_tests/chip.reviewer.test.ts'], traceability: [...validTraceability, { contract: 'AC-83-004.1 — the chip SHALL be shown', contractClass: 'acceptance-criterion', status: 'pass', tests: ['src/f2b3/_tests/chip.reviewer.test.ts'] }] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^drift-proof:/).length === 0, 'no proof: the judge refuted the claim with its own passing test')
    t.ok(hasLog(run, /AC-83-004\.1.*refuted by the reviewer/i), 'the refutation is logged, never silent')
    t.ok(run.result && run.result.builtFrds.includes('frd-f2b3'), 'the FRD verified')
  },
})
SCENARIOS.push({
  name: 'F2b4. a finder claim whose probe PASSES at the pin → discarded with a log; no card, no reopen',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: f2Plan('frd-f2b4', 'wo-f2b4-001'),
  responses: [
    { prefix: 'evidence:', response: f2Pack('f2b4') },
    { prefix: 'find:drift:', response: f2Finding([f2Row('frd-f2b4', 'AC-84-002.1', 'drift')]) },
    { label: 'gate:frd-f2b4', response: { green: true, testFiles: [], traceability: validTraceability } },
    { prefix: 'drift-proof:', response: f2Proof({ frd: 'frd-f2b4', wos: ['wo-f2b4-001'], owned: ['AC-84-009.1'], probes: [['AC-84-002.1', ['pass', 'pass'], []]] }) },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, 'drift-proof:frd-f2b4').length === 1, 'the claim was proven')
    t.ok(hasLog(run, /AC-84-002\.1 DISCARDED/), 'discarded, loudly')
    t.ok(byLabel(run, /^drift-record:/).length === 0 && byLabel(run, /^patch:/).length === 0, 'no card, no reopen')
    const apply = byLabel(run, 'apply-gate:frd-f2b4')[0]
    t.ok(apply && !/drift: \[/.test(apply.prompt), 'no drift: replica')
    t.ok(run.result && run.result.builtFrds.includes('frd-f2b4'), 'the FRD verified')
  },
})
SCENARIOS.push({
  name: 'F2b5. an UNPROVEN finder claim (not owned, unloadable at last_green) → discarded with a log — never an unproven cycle fault that reds a green judge',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: f2Plan('frd-f2b5', 'wo-f2b5-001'),
  responses: [
    { prefix: 'evidence:', response: f2Pack('f2b5') },
    { prefix: 'find:drift:', response: f2Finding([f2Row('frd-f2b5', 'AC-85-003.1', 'drift')]) },
    { label: 'gate:frd-f2b5', response: { green: true, testFiles: [], traceability: validTraceability } },
    { prefix: 'drift-proof:', response: f2Proof({ frd: 'frd-f2b5', wos: ['wo-f2b5-001'], owned: ['AC-85-009.1'], probes: [['AC-85-003.1', ['fail', 'fail'], ['load', 'load']]] }) },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(hasLog(run, /AC-85-003\.1.*unproven.*discarded/i), 'discarded as unproven, loudly')
    t.ok(byLabel(run, /^patch:/).length === 0 && byLabel(run, /^drift-record:/).length === 0, 'no reopen and no card')
    t.ok(run.result && run.result.builtFrds.includes('frd-f2b5'), 'the FRD verified')
  },
})
SCENARIOS.push({
  name: "F2b6. driftPolicy:'block' (the DR-122 rollback switch) — the finder report still reaches the judge, but the engine never merges its claims",
  args: { mode: 'pro', gateEvidence: 'digested', driftPolicy: 'block' },
  plan: f2Plan('frd-f2b6', 'wo-f2b6-001'),
  responses: [
    { prefix: 'evidence:', response: f2Pack('f2b6') },
    { prefix: 'find:drift:', response: f2Finding([f2Row('frd-f2b6', 'AC-86-001.1', 'drift')]) },
    { label: 'gate:frd-f2b6', response: { green: true, testFiles: [], traceability: validTraceability } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-f2b6')[0]
    t.ok(gate && /WHOLE-FRD DRIFT FINDER REPORT/.test(gate.prompt), 'the report still informs the judge')
    t.ok(byLabel(run, /^drift-proof:/).length === 0, 'no merge, no proof under the rollback switch')
    t.ok(run.result && run.result.builtFrds.includes('frd-f2b6'), 'the FRD verified')
  },
})
// (c) when the finder runs at all.
SCENARIOS.push({
  name: 'F2c1. explore (the default) with no driftFinder flag → no find:drift spawn, no report block',
  args: { mode: 'pro' },
  plan: f2Plan('frd-f2c1', 'wo-f2c1-001'),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^find:drift:/).length === 0, 'no finder in explore by default')
    const gate = byLabel(run, 'gate:frd-f2c1')[0]
    t.ok(gate && !/WHOLE-FRD DRIFT FINDER REPORT/.test(gate.prompt), 'no report block')
  },
})
SCENARIOS.push({
  name: 'F2c2. explore + driftFinder:true → the finder runs in explore too (opt-in)',
  args: { mode: 'pro', driftFinder: true },
  plan: f2Plan('frd-f2c2', 'wo-f2c2-001'),
  responses: [{ prefix: 'find:drift:', response: f2Finding([f2Row('frd-f2c2', 'REQ-87-001', 'implemented', { snippet: 'F2C2-IMPL' })]) }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^find:drift:/).length === 1 && byLabel(run, /^evidence:/).length === 0, 'the finder ran without a collector')
    const gate = byLabel(run, 'gate:frd-f2c2')[0]
    t.ok(gate && /F2C2-IMPL/.test(gate.prompt) && /Run the FOCUSED gate/.test(gate.prompt), 'the explore judge gets the report on top of its explore contract')
  },
})
SCENARIOS.push({
  name: 'F2c3. digested + driftFinder:false → no finder (the escape hatch); an invalid driftFinder value warns and keeps the default',
  args: { mode: 'pro', gateEvidence: 'digested', driftFinder: false },
  plan: f2Plan('frd-f2c3', 'wo-f2c3-001'),
  responses: [{ prefix: 'evidence:', response: f2Pack('f2c3') }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(byLabel(run, /^find:drift:/).length === 0, 'no finder when turned off')
    const gate = byLabel(run, 'gate:frd-f2c3')[0]
    t.ok(gate && /YOUR EVIDENCE IS ALREADY COLLECTED/.test(gate.prompt) && !/WHOLE-FRD DRIFT FINDER REPORT/.test(gate.prompt), 'plain digested gate')
  },
})
SCENARIOS.push({
  name: 'F2c4. an invalid args.driftFinder value is logged and falls back to the mode default (on under digested)',
  args: { mode: 'pro', gateEvidence: 'digested', driftFinder: 'maybe' },
  plan: f2Plan('frd-f2c4', 'wo-f2c4-001'),
  responses: [{ prefix: 'evidence:', response: f2Pack('f2c4') }],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(hasLog(run, /args\.driftFinder='maybe'/), 'the bad value is named in the log')
    t.ok(byLabel(run, /^find:drift:/).length === 1, 'the digested default (on) applies')
  },
})
SCENARIOS.push({
  name: 'F2c5. a dead / malformed finder (null, no contracts) is a LOUD DriftFinderFallback — the gate still runs, without a report block, never on a silent empty list (DR-078)',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: mkPlan([
    { frd: 'frd-f2c5a', deps: [], workOrders: [mkWo('wo-f2c5a-001', 'PLANNED', { frd: 'frd-f2c5a', artifacts: ['src/f2c5a/**'] })] },
    { frd: 'frd-f2c5b', deps: [], workOrders: [mkWo('wo-f2c5b-001', 'PLANNED', { frd: 'frd-f2c5b', artifacts: ['src/f2c5b/**'] })] },
  ]),
  responses: [
    { prefix: 'evidence:', response: f2Pack('f2c5') },
    { label: 'find:drift:frd-f2c5a', response: null },
    { label: 'find:drift:frd-f2c5b', response: { contracts: [] } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    t.ok(hasLog(run, /DriftFinderFallback frd-f2c5a/) && hasLog(run, /DriftFinderFallback frd-f2c5b.*no contracts/), 'both degradations are logged with their reason')
    const gates = byLabel(run, /^gate:frd-f2c5/)
    t.ok(gates.length === 2 && gates.every((g) => !/WHOLE-FRD DRIFT FINDER REPORT/.test(g.prompt)), 'both gates ran, without a report')
    t.ok(run.result && run.result.builtFrds.length === 2, 'both FRDs verified')
  },
})
// (d) an UNKNOWN on a contract the cycle's work orders own obliges the judge to deep-review it.
SCENARIOS.push({
  name: 'F2d1. UNKNOWN on a cycle-owned contract → the split CLOSER is told it MUST deep-review it (outside its read budget); non-cycle unknowns are listed apart',
  args: { mode: 'powerful', gateEvidence: 'digested' },
  plan: f2Plan('frd-f2d1', 'wo-f2d1-001', { reopen_count: 1 }),
  responses: [
    { prefix: 'evidence:', response: f2Pack('f2d1') },
    { label: /^find:(?!drift:)/, response: { findings: [] } },
    { prefix: 'find:drift:', response: f2Finding([
      f2Row('frd-f2d1', 'AC-88-003.2', 'unknown', { owner: 'wo-f2d1-001', why: 'no reference to the chip found' }),
      f2Row('frd-f2d1', 'AC-88-011.1', 'unknown', { why: 'budget exhausted' }),
    ], { budgetExhausted: true }) },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const closer = byLabel(run, 'gate:frd-f2d1')[0]
    const p = closer ? closer.prompt : ''
    const cycleSection = (p.match(/UNKNOWN ON THIS CYCLE'S CONTRACTS[\s\S]*?(?=\n\s*\(3\))/) || [''])[0]
    t.ok(/MUST deep-review/.test(cycleSection) && /AC-88-003\.2/.test(cycleSection) && !/AC-88-011\.1/.test(cycleSection), 'the cycle-owned unknown is singled out as a MUST deep-review item')
    t.ok(/do NOT count against your read budget/.test(cycleSection), 'its review is outside the digested read budget')
    t.ok(/non-empty `tests`/.test(cycleSection), 'it must come back in traceability with a test')
    t.ok(/AC-88-011\.1/.test(p), 'the non-cycle unknown is still listed')
    t.ok(/budget ran out/i.test(p), "the finder's exhausted budget is disclosed to the judge")
  },
})
SCENARIOS.push({
  name: 'F2d2. the same obligation on the SERIAL gate (first attempt)',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: f2Plan('frd-f2d2', 'wo-f2d2-001', { acText: 'AC-89-001.1 WHEN F2D2 THE SYSTEM SHALL hold' }),
  responses: [
    { prefix: 'evidence:', response: f2Pack('f2d2') },
    { prefix: 'find:drift:', response: f2Finding([f2Row('frd-f2d2', 'AC-89-001.1', 'unknown', { owner: 'none' })]) },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gate = byLabel(run, 'gate:frd-f2d2')[0]
    const cycleSection = gate ? ((gate.prompt.match(/UNKNOWN ON THIS CYCLE'S CONTRACTS[\s\S]*?(?=\n\s*\(3\))/) || [''])[0]) : ''
    t.ok(/MUST deep-review/.test(cycleSection) && /AC-89-001\.1/.test(cycleSection), "a contract in the planner's criteria of a reviewed WO counts as the cycle's even when the finder named no owner")
  },
})
// (f) the report is scoped to the gate that ran with it: a re-gate on main neither re-spawns the finder nor
// re-injects a report whose probes live in a released slot.
SCENARIOS.push({
  name: 'F2f. a REJECT re-gate on main carries no finder report and spawns no second finder',
  args: { mode: 'pro', gateEvidence: 'digested' },
  plan: f2Plan('frd-f2f', 'wo-f2f-001'),
  responses: [
    { prefix: 'evidence:', response: f2Pack('f2f') },
    { prefix: 'find:drift:', response: f2Finding([f2Row('frd-f2f', 'REQ-90-001', 'implemented', { snippet: 'F2F-IMPL' })]) },
    { label: 'gate:frd-f2f', times: 1, response: { green: false, failure: 'integration is red' } },
  ],
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    const gates = byLabel(run, 'gate:frd-f2f')
    t.ok(gates.length === 2, `one reject + one re-gate (got ${gates.length})`)
    t.ok(gates[0] && /F2F-IMPL/.test(gates[0].prompt), 'the pinned gate had the report')
    t.ok(gates[1] && !/WHOLE-FRD DRIFT FINDER REPORT/.test(gates[1].prompt), 'the re-gate on main does not')
    t.ok(byLabel(run, /^find:drift:/).length === 1, 'no second finder')
  },
})
// (e) budget: the finder is one sonnet unit (COST('sonnet') = 1) and the parallel-gate reservation counts it.
// pre-loop 8 (precheck 1 + baseline 3 + plan 3 + pin 1); a digested gate link with the finder is probe 1 +
// collector 1 + finder 1 + opus judge 3 + release 1 = 7 (6 without it), so with maxAgents 20 the second gate is
// deferred and the log names the estimate.
{
  const h = d1Harness()
  SCENARIOS.push({
    name: 'F2e1. budget — the parallel-gate reservation counts the finder: a digested gate link is ~7 units (probe + collector + finder + opus judge + release)',
    args: { mode: 'pro', parallelGates: true, gateEvidence: 'digested', maxAgents: 20 },
    plan: d1Resume('f2e1', 2),
    responses: [{ prefix: 'evidence:', response: f2Pack('f2e1') }, ...h.responses],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(hasLog(run, /gate for frd-f2e1-2 deferred: agent budget — ~7 units for the gate/), `the reservation includes the finder (${run.logs.filter((l) => /deferred: agent budget/.test(l)).join(' | ')})`)
    },
  })
}
{
  const h = d1Harness()
  SCENARIOS.push({
    name: 'F2e2. budget — with driftFinder:false the same digested gate link is ~6 units',
    args: { mode: 'pro', parallelGates: true, gateEvidence: 'digested', maxAgents: 20, driftFinder: false },
    plan: d1Resume('f2e2', 2),
    responses: [{ prefix: 'evidence:', response: f2Pack('f2e2') }, ...h.responses],
    assert(t, run) {
      t.ok(!run.error, `engine threw: ${run.error}`)
      t.ok(hasLog(run, /gate for frd-f2e2-2 deferred: agent budget — ~6 units for the gate/), `no finder, no reservation for it (${run.logs.filter((l) => /deferred: agent budget/.test(l)).join(' | ')})`)
    },
  })
}
SCENARIOS.push({
  name: 'F2e3. static recount — the finder is ONE new sonnet spawn site (not MECH: the 25 MECH sites are unchanged); its agent exists on sonnet; its method is the generated copy of drift-finder.md',
  args: { mode: 'pro' },
  plan: mkPlan([]),
  assert(t, run) {
    t.ok(!run.error, `engine threw: ${run.error}`)
    // Not a MECH site: the finder reads and judges code against a spec (a STANDARD-tier task), so it is a
    // sonnet spawn with its own agent, never MECH_AGENT(...). The WP03a count (25) therefore does not move.
    t.ok((source.match(/agentType: MECH_AGENT\(/g) || []).length === 25, 'the 25 MECH_AGENT sites are unchanged')
    t.ok((source.match(/agentType: 'pandacorp:drift-finder'/g) || []).length === 1, 'exactly one pandacorp:drift-finder spawn site')
    t.ok(/label: `find:drift:\$\{frd\}`[^\n]*model: 'sonnet'[^\n]*effort: 'medium'/.test(source), 'that site is sonnet at effort medium')
    const agentMd = readFileSync(path.resolve(__dirname, '../agents/drift-finder.md'), 'utf8')
    t.ok(/^model: sonnet$/m.test(agentMd) && /^tools: Read, Grep, Glob, Bash$/m.test(agentMd), 'plugin/agents/drift-finder.md: model sonnet, tools Read/Grep/Glob/Bash')
    const block = (agentMd.match(/<!-- DRIFT_FINDER_START -->([\s\S]*?)<!-- DRIFT_FINDER_END -->/) || [])[1]
    t.ok(block && source.includes(`const DRIFT_FINDER_DIRECTIVE = ${JSON.stringify(block.trim().replace(/\s+/g, ' '))}`), 'DRIFT_FINDER_DIRECTIVE is byte-identical to the generated agent block')
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
    for (const x of t.xfails) console.log(`      ~ xfail ${x}`)
  } else {
    failed++
    console.log(`FAIL  ${s.name}`)
    for (const f of t.failures) console.log(`      ✗ ${f}`)
    if (run.error) console.log(`      engine error: ${run.error.stack || run.error}`)
  }
}
console.log(`RESULT: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
