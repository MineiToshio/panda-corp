export const meta = {
  name: 'pandacorp-build',
  description: 'Pandacorp build engine v2 (DR-050 + BL-0021): builds in GLOBAL WAVES — every wave takes the ready work orders of ALL FRDs (dependsOn satisfied, artifacts disjoint per DR-060, capped at the mode\'s wave) so independent features build in parallel; the per-FRD review/test gates run SERIALIZED at wave boundaries (quiet tree). State lives in the work-order frontmatter (implementation_status). Runs to COMPLETION by default; stops ONLY by health or budget — nothing left to build, a budget ceiling, too many blocks in a row, or work that needs the owner. It TRIES TO REPAIR before giving up; an unrecoverable stop BLOCKS with a reason (needs-owner | external | error) instead of dying. Resumable: it reads the frontmatter and NEVER rebuilds a VERIFIED work order.',
  phases: [
    { title: 'Baseline' },
    { title: 'Process Change' },
    { title: 'Plan' },
    { title: 'Build' },
    { title: 'Hardening' },
    { title: 'Review' },
  ],
}

// scriptPath launches deliver `args` as a JSON STRING (name launches delivered an object) —
// normalize before ANY read, or every args.* below silently falls to its legacy default (BL-0022 class).
// Verified empirically 2026-07-06 (proposal 31 T0). Unparseable string = fail LOUD, never run misconfigured.
if (typeof args === 'string') {
  try { args = JSON.parse(args) } catch (e) { log('FATAL: args arrived as an unparseable string: ' + e.message); throw e }
}

// BL-0071: installed Workflow subagents do not reliably inherit CLAUDE_PLUGIN_ROOT. The launcher
// therefore passes the canonical, realpath-validated state writer as an explicit capability. Reject
// absent/relative/control-character paths before the first agent spawn; never guess `/scripts/...`.
const STATE_CLI = args && typeof args.stateCli === 'string' ? args.stateCli : ''
if (!STATE_CLI.startsWith('/') || /[\0\r\n]/.test(STATE_CLI)) {
  const message = 'FATAL: args.stateCli must be an absolute validated build-state CLI path'
  log(message)
  throw new Error(message)
}
const shellQuote = (value) => `'${String(value).replaceAll("'", `'"'"'`)}'`
const STATE_CLI_COMMAND = `node ${shellQuote(STATE_CLI)}`

// ── Input (all optional) ─────────────────────────────────────────────────────
//   args.mode:    'pro' | 'balanced' | 'powerful' | 'deep'  (default: powerful)
//   args.frds:    specific FRD folders to limit to           (default: all pending)
//   args.change:  a change slug/filename from .pandacorp/inbox/changes/ to process
//     and build in one targeted run. The engine reads the change, creates/updates
//     its FRDs+WOs via the iterate/bug engine, then builds only those FRDs (with
//     dep checking). Mutually exclusive with args.frds — if both are set, args.change
//     wins (frds is derived from the change's affected FRDs). null = off.
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
//   args.strictBaseline: escape hatch (BL-0124) — true restores the PRE-WP-04 behavior: the baseline
//     pre-check's dirtiness predicate never excludes a lone in-flight `.pandacorp/status.yaml` write,
//     so it escalates to the full judge-baseline/verify.sh cycle exactly as it always did. Default
//     false/unset applies the narrow lease-aware exclusion (see the Baseline self-heal section below).
//   args.safePointEveryWave: escape hatch (WP-11) — true restores the unthrottled per-wave-boundary
//     safe-point cadence for a TARGETED build too (bare-run parity). Default false: a targeted build
//     (a specific `change`/`frds` — safePoint() drains nothing there, DR-069) runs the safe-point sweep
//     once at the first wave boundary and then only every WAVE_THROTTLE boundaries — see the call site
//     for why (Date.now() is unavailable in a Workflow script). null/false = off (the throttle applies).
//   args.forceUiPasses: OPT-IN escape hatch (default false) — forces the foundation-completeness
//     gate and the end-of-build visual-QA pass to run even when the ready/built work orders declare
//     no UI-touching artifacts (WP-01, DR-057/DR-072). Use when the UI-relevance heuristic is wrong
//     for a given run (e.g. a WO's real UI surface hides behind an undeclared or unconventional path).
//   args.leanCloseOut: OPT-OUT escape hatch (default true) — set to `false` to fall back to the
//     pre-WP-02 close-out shape: visual-qa awaited fully in series, and archive-changes/notify-end-or-
//     close-out/release-lease as three separate serial spawns. Default `true` fires visual-qa as a
//     promise (awaited only right before the run's terminal closing agent, so its wall-clock overlaps
//     the hardening chain instead of stacking in front of it) and folds archive-changes + release-lease
//     into whichever closing agent actually fires (WP-02, proposal 37 / FRD-24 measurement). Use `false`
//     if a close-out regression needs isolating from this change.
//   args.mechLean: OPT-OUT escape hatch (default true, WP-03) — the class-(a)/(b) MECH sites (pure command
//     execution / a light frontmatter-list edit / a bounded text assembly from facts the engine already
//     computed — never the genuine judgment sites, which stay untouched: safe-point, and apply-gate/
//     persist-block, both inside another package's in-flight region) spawn on the narrower `pandacorp:mech`
//     agent (Bash+Read only, no Write/Edit) at `effort: 'low'` instead of the broad `pandacorp:implementer`/
//     `pandacorp:devops` at default effort — cheaper AND faster for a spawn that only runs exact commands
//     (FRD-24: 17 haiku plumbing agents were 14% of wall-clock). Also gates two spawn-count fusions: the
//     Plan-phase `sync-rollups` spawn folds into the FIRST wave's `dispatch` call (one agent, two commands,
//     same order) instead of its own spawn; and `capturePin` reuses the sha `commitWOGreen` already
//     returned from the wave's LAST landed commit instead of spawning its own `pin:` agent — but ONLY when
//     a commit actually landed via commitWOGreen this wave AND no repair agent ran (attemptRepair commits
//     on its own, invalidating the cached sha) — an empty/repaired wave still spawns `pin:` as before.
//     Use `false` to revert every MECH site + both fusions to the pre-WP-03 shape (isolates a regression).
//   args.gateEvidence: 'explore' (DEFAULT) | 'digested' — WP-06. Controls HOW the per-FRD gate gets its
//     EVIDENCE; it never changes what the gate must PROVE. 'explore' (default, and the value any
//     unrecognised string falls back to) is the historical contract byte-for-byte: the opus reviewer
//     collects its own evidence — it explores the tree, runs `verify.sh --since` inside its own loop and
//     parses the raw log (FRD-24 measured that as 99 calls / 54 tool-calls / 93.7k context per call / 31%
//     of the run's wall clock, while the verdict itself is the cheap part). 'digested' spawns a cheap MECH
//     `evidence:<frd>` COLLECTOR first — in the SAME pinned gate worktree — which runs
//     `bash .pandacorp/verify.sh --since <last_green> --report-all` and hands the reviewer the resulting
//     `gate-report.json`, the pinned diff (stat + a size-capped unified patch scoped to the reviewed WOs'
//     artifacts) and the FRD's verbatim EARS acceptance criteria. The gate then judges from that material
//     under a bounded exploration budget instead of re-deriving it. INVARIANTS THAT DO NOT MOVE: the judge
//     stays opus at the same effort (DR-015 — never a cheaper judge), it still writes adversarial tests
//     (DR-080), still returns the 7-class whole-FRD traceability inventory (enforceWholeFrdTraceability),
//     and still owns every reject/blocked exit. FAIL-CLOSED: a collector that returns null, a `report` that
//     is not valid JSON, or a `report.green` that is not a boolean makes THAT gate run in 'explore' mode
//     (logged + a `GateEvidenceFallback` event) — there is never a gate without evidence.
//     SCOPE: only a gate that is handed a pack runs digested. Re-gates on the quiesced main tree (the
//     convergence ladder, the post-repair re-gate) and the legacy synchronous gate path always run
//     'explore' — their evidence would be from a superseded pin, and a stale digest is worse than none.
//   args.scopedRepair: OPT-IN escape hatch (WP-08, **default FALSE**) — turns on the SCOPED repair loop
//     ONLY (D4/REV2 split: scoping and the cost brake are now two INDEPENDENT levers — see
//     args.repairBrake below for the brake, which is on by default regardless of this flag):
//     (a) the failing SUB-GATE is classified DETERMINISTICALLY from verify.sh's `.pandacorp/run/
//     gate-report.json` (lint|types|structure|cycles|deadcode|unit-test|e2e|doc) before the opus
//     diagnoser is ever spawned, and a purely MECHANICAL failure (lint|types|structure|cycles) is fixed
//     by a SONNET agent at effort:'medium' instead of opus/xhigh; (b) that agent's <=2 internal
//     self-repair cycles re-gate with `verify.sh --only=<failing subgates> --files=<files it touched>`
//     instead of a whole-project knip+biome+tsc each time.
//     The FINAL certification re-gate inside attemptPatch is NEVER scoped (see there, red-team-A).
//     WHY DEFAULT FALSE: the scoped inner loop's sonnet/medium fixer + narrowed re-gate is itself a
//     tradeoff the owner should opt into on live data. Flip it with `{"scopedRepair": true}`.
//   args.repairBrake: the repair-cost BRAKE (WP-08 (d)/D4, **default TRUE**) — repair spend per FRD is
//     capped at `args.repairBudgetFactor` x that FRD's measured build spend THIS RUN (the same COST()
//     weighting the maxAgents brake uses), and exhausting it is an honest needs-owner exit with the gate
//     report attached and the work preserved on the branch. Checked by canAffordRepair() at EVERY rung
//     of the ladder that spends real agent cost — patch-1/patch-2, diagnose, gate-test-repair, AND the
//     in-run retry rebuild (the single priciest rung: it rebuilds every reopened WO on opus). REV2-3
//     found this OFF by default used to leave the ladder with NO spend ceiling at all (scopedRepair
//     gated the brake as well as the scoping) — that coupling is fixed: the brake now runs independently
//     and defaults ON. Opt out with `{"repairBrake": false}` (restores the pre-D4 unbounded ladder).
//     The COST() proxy is still coarse (opus=3, sonnet=1) and cannot see that ONE opus/xhigh agent might
//     burn 85 tool calls — it brakes agent WEIGHT, not tokens (see the brake's own comment below).
//   args.repairBudgetFactor: how many times an FRD's own build spend its repair may cost before the
//     brake fires (default 3 — the FRD-24 measurement was 3.5x). Only read when repairBrake is on. The
//     budget floors at 9 units regardless of factor x base (BL-0138): on a realistic 1-WO FRD (build
//     cost C=2, budget = 3x2 = 6) the unfloored ladder patch-1(3)+diagnose(3)+patch-2(3)=9 was cut BEFORE
//     patch-2 — losing a whole rung of recovery depth on the smallest, most common FRD shape. The floor
//     guarantees that escalator always fits; only the (pricier) in-run-retry rung after it is still
//     gated by the real budget.
//   NOTE — the scope:"partial" CAGE is NOT behind any flag. A gate-report whose `scope` is "partial"
//     (what verify.sh stamps on every --only/--files run) can never promote a work order to VERIFIED
//     nor advance last_green_sha, whatever scopedRepair/repairBrake say. See the cage section below.
const MODE = (args && args.mode) || 'powerful'
// D-9: the args-string guard above (line ~17) re-parses the WHOLE args blob when scriptPath delivers it
// JSON-stringified once — but that does NOT protect an individual boolean flag arriving as the literal
// JS STRING "true"/"false" instead of a JSON boolean, e.g. a future launch-implement.sh flag built the
// same way maxAgents/maxFrds/maxSpend already are (a raw shell value passed through) but WITHOUT their
// existing Number() cast. Tolerate both shapes for every boolean escape hatch below — never only the
// strict boolean — so a stringly-typed flag fails safe instead of silently taking its opposite default.
const argBool = (a, key, expect) => Boolean(a && (a[key] === expect || a[key] === String(expect)))
const STRICT_BASELINE = argBool(args, 'strictBaseline', true)   // BL-0124 escape hatch — see the arg doc above
// Normalize change: accept 'slug', 'slug.md', '.pandacorp/inbox/changes/slug', '.pandacorp/inbox/changes/slug.md' → just the slug
const CHANGE = (args && args.change) ? String(args.change).split('/').pop().replace(/\.md$/, '') : null
// Normalize frds: accept folder name, 'docs/frds/<folder>', 'docs/frds/<folder>/frd.md' → folder name only
const normalizeFolder = (s) => String(s).replace(/\/[^/]+\.md$/, '').replace(/\/$/, '').split('/').pop()
let ONLY = (args && !args.change && args.frds) ? args.frds.map(normalizeFolder) : null  // frds filter (derived from CHANGE when set)
// DR-069 TARGETED-BUILD SCOPE (owner incident 2026-07-06): when the owner launches a TARGETED build —
// a specific `change` OR explicit `frds` — the safe-point queue drain MUST NOT pull in OTHER `ready`
// changes sitting in the queue. "Implement only X" means only X; the rest of the queue waits for a
// bare `/implement`. ONLY a bare launch (no change, no frds) drains the whole ready queue. Computed from
// the LAUNCH args (immutable — ONLY gets reassigned to the change's affected FRDs at line ~351, so we
// can't derive intent from ONLY later; this const captures "was this launched as targeted" up front).
const TARGETED = Boolean(CHANGE) || Boolean(args && args.frds)
// WP-11: safePoint() drains NOTHING on a targeted run (DR-069 — it returns ready: [] by design), but it
// is NOT pure overhead there — the SAME prompt also renews the run's atomic lease (RENEW_LEASE is the
// engine's ONLY renewal site), consumes the owner's stop/rethink signal, and re-enrolls decision-unblocked
// WOs. Only the queue-drain part is genuinely a no-op on a targeted run. Calling the WHOLE thing at every
// wave boundary is still real, measured overhead on a targeted run (FRD-24: 2 × ~52s = 105s for zero
// drain), and the stop-signal/decision-unblock checks tolerate a lower cadence (bounded by the throttle
// below, so they're never starved for more than SAFE_POINT_WAVE_THROTTLE boundaries) — but lease renewal
// does NOT tolerate it: the TTL is 600s (build-state.mjs), and a long targeted run left unrenewed between
// throttled checkpoints risks the lease expiring mid-build (REV-5). Ideal would be "skip if <10 min since
// the last safe point", but Date.now()/new Date() are unavailable in a Workflow script (they would break
// resume) and safePoint()'s own prompt/schema is out of scope for this change — no safe way to obtain
// "now" from here. Fallback, counted in-engine (deterministic, replay-safe — not wall time): the FULL
// safe point runs once per run (the first wave boundary) + once every SAFE_POINT_WAVE_THROTTLE boundaries
// after that; every OTHER (throttled/skipped) boundary still fires a minimal renewal-only spawn (RENEW_LEASE
// alone, no stop/rethink check, no drain) so the lease never goes an unbounded number of boundaries without
// renewal. A bare run (drains the queue) is UNCHANGED — every boundary runs the full safe point, as before.
// args.safePointEveryWave === true restores the unthrottled full-safe-point cadence for a targeted run too
// (escape hatch).
const SAFE_POINT_WAVE_THROTTLE = 3
const SAFE_POINT_EVERY_WAVE = argBool(args, 'safePointEveryWave', true)
// BL-0129: a BARE run (TARGETED === false) whose planner finds NOTHING to build used to exit via
// ensureStopped('nothing to build') BEFORE the main loop ever ran — so the DR-069 ready-changes queue
// (only ever drained by safePoint(), which lives INSIDE that loop) was never scanned. `drainOnEmptyPlan`
// is the escape hatch: false restores that pre-fix behavior (immediate exit, no drain). Ignored on a
// TARGETED run — the drain there stays forbidden regardless (DR-069 targeted-build scope, unchanged).
const DRAIN_ON_EMPTY_PLAN = !(args && args.drainOnEmptyPlan === false)
const MAX_FRDS = (args && args.maxFrds) || Infinity   // counts features PROCESSED (built+blocked+reopened); no cap unless set
const LOW_BUDGET = (args && args.lowBudget) || 80000  // margin to leave when budget.total IS set (a +Nk turn directive)
const MAX_SPEND = (args && args.maxSpend) || null      // output-token ceiling via budget.spent() — UNRELIABLE alone (under-counts subagent work; unenforced if the supervisor dies). Secondary.
const MAX_AGENTS = (args && args.maxAgents) || null     // hard cap on subagents spawned this run — the RELIABLE spend brake (each implementer/reviewer ≈ work ≈ tokens), counted INSIDE the engine, independent of budget.spent AND of the supervisor surviving. THE real guardrail.
const MAX_CONSECUTIVE_BLOCKS = (args && args.maxConsecutiveBlocks) || 3   // health breaker: N non-external blocks in a row → stop (something is systemically wrong)
const FOUNDATION_REPAIR_CAP = (args && args.foundationRepairCap) || 2   // DR-065: bounded auto-repair of an incomplete foundation — after N failed auto-repairs of the SAME class, escalate to the owner instead of looping/burning budget
const FOUNDATION_GATE_NULL_CAP = (args && args.foundationGateNullCap) || 2   // WS-D/D5: a SEPARATE cap for null/garbled foundation-completeness gate verdicts (a dead gate agent) — counted on its OWN counter so a couple of dead gates never eat the real repair budget (FOUNDATION_REPAIR_CAP), and vice-versa
const MAX_REOPENS = (args && args.maxReopens) || 3   // DR-072 NON-PROGRESS STOP: a WO reopened this many times across runs (same gate fault not resolving) → BLOCK needs-owner instead of grinding forever. "Refuse to treat repeated failure as progress" — the gate can't be satisfied autonomously, the owner must look.
const FORCE_UI_PASSES = argBool(args, 'forceUiPasses', true)   // WP-01 escape hatch: always run the foundation-completeness gate + end-of-build visual-QA pass, bypassing the UI-artifact heuristic (artifactsTouchUi)
// WP-06: 'explore' (default = today's behaviour, byte-identical) | 'digested' (pre-collected evidence pack).
// Anything else falls back to 'explore' with a loud log — an unrecognised value must never silently pick a
// mode the owner did not ask for.
const GATE_EVIDENCE = (args && args.gateEvidence === 'digested') ? 'digested' : 'explore'
if (args && args.gateEvidence !== undefined && args.gateEvidence !== 'explore' && args.gateEvidence !== 'digested') {
  log(`⚠ args.gateEvidence='${args.gateEvidence}' no es 'explore' ni 'digested' — usando 'explore' (WP-06 fail-closed)`)
}
// proposal 37 / E-3: visual-qa is DR-072 ADVISORY (a punch-list, never a block) — sonnet is the
// default judge for it instead of opus (measured ≈2.20 $ on FRD-24 vs 5.50 $ on opus). Escape hatch
// args.visualQaModel='opus' restores the prior tier; anything else falls back to 'sonnet' with a loud
// log — an unrecognised value must never silently pick a tier the owner did not ask for.
const VISUAL_QA_MODEL = (args && args.visualQaModel === 'opus') ? 'opus' : 'sonnet'
if (args && args.visualQaModel !== undefined && args.visualQaModel !== 'sonnet' && args.visualQaModel !== 'opus') {
  log(`⚠ args.visualQaModel='${args.visualQaModel}' no es 'sonnet' ni 'opus' — usando 'sonnet' (E-3 fail-closed)`)
}
const LEAN_CLOSE_OUT = !argBool(args, 'leanCloseOut', false)   // WP-02 escape hatch: default true — visual-qa fired as a promise + archive-changes/release-lease folded into the closing agent; `false` reverts to the pre-WP-02 fully-serial three-spawn close-out
const SCOPED_REPAIR = argBool(args, 'scopedRepair', true)   // WP-08 opt-in: deterministic sub-gate classification + sonnet mechanical fixer + scoped inner re-gates ONLY. Default OFF — see the arg doc above.
const REPAIR_BRAKE = !argBool(args, 'repairBrake', false)   // D4/REV2-3: the repair-cost BRAKE, independent of SCOPED_REPAIR. Default ON — explicit {"repairBrake": false} restores the pre-D4 unbounded ladder.
const REPAIR_BUDGET_FACTOR = (args && args.repairBudgetFactor) || 3   // WP-08: repair spend ceiling per FRD, as a multiple of that FRD's own measured build spend (COST()-weighted). Only read when REPAIR_BRAKE.
// ── PROGRESSIVE-LEARNING RECOVERY (package A) — the diagnose ladder's two caps ──────────────────────
const FINDING_SPREAD_THRESHOLD = (args && args.findingSpreadThreshold) || 3   // A2/A6: findings spread over MORE than this many files → the diagnoser leans 'architectural' (a localized point-fix can't reach a fault smeared across the codebase)
const PATCH_ATTEMPT_CAP = (args && args.patchAttemptCap) || 2   // A3/A6: at most this many in-place patch attempts per gate cycle (patch-1 + one diagnosis-guided patch-2); beyond it the ladder reverts+rebuilds instead of a 3rd patch — reopen_count stays the hard non-progress budget

// ── BL-0022: EXPLICIT project identity + root, end to end (never derive from cwd) ──────────────────
// The engine used to identify the project IMPLICITLY from the working directory: events stamped
// "project":"$(basename \"$PWD\")" and TRACK appended to the RELATIVE ".pandacorp/track.jsonl".
// Workflow subagents inherit the SESSION's cwd — so a build launched from a conversation opened at the
// factory root (with the project as a subfolder) mislabelled every engine event and scattered a stray
// track.jsonl at the wrong tree (the 2026-07-02 mission-control incident: 18+ events tagged
// "panda-corp", a stray panda-corp/.pandacorp/track.jsonl, the run invisible to its own dashboard).
// Now the implement skill resolves both at launch (it already knows the project root — where it found
// status.yaml) and passes them in. When ABSENT we keep the legacy $PWD form so an old launcher / a
// bare relaunch from the project folder still works (back-compat). PROJECT is a literal (no shell
// substitution when provided); PROJECT_DIR is the absolute root every relative path / event anchors to.
const PROJECT = (args && args.project) || '$(basename "$PWD")'   // event key — the folder basename; literal when provided, shell fallback otherwise
const PROJECT_DIR = (args && args.projectDir) || '.'              // absolute project root; '.' = session cwd (back-compat)
const LEASE_TOKEN = (args && args.leaseToken) || ''
const LEASE_EPOCH = (args && args.leaseEpoch) || 0
const TRACK_PATH = PROJECT_DIR === '.' ? '.pandacorp/track.jsonl' : `${PROJECT_DIR}/.pandacorp/track.jsonl`   // absolute when PROJECT_DIR is set, else the legacy relative path
// One-line preamble prepended to EVERY agent prompt (a small helper — the `agent` wrapper below, NOT N
// hand edits) so each subagent works from the project root regardless of the session cwd. Empty in the
// back-compat case (cwd == project root already), so the legacy behaviour is byte-for-byte unchanged.
const WORK_FROM = PROJECT_DIR === '.' ? '' : `Work from the project root ${PROJECT_DIR} — cd there FIRST; every relative path below is relative to it.\n`
// GENERATED from plugin/runtime/prompts/sync-rollups.md — do not hand-edit this fragment.
const SYNC_ROLLUPS = "Run the sole governed rollup writer exactly once: `{{STATE_CLI_COMMAND}} sync-rollups --project \"{{PROJECT_DIR}}\" --token \"{{LEASE_TOKEN}}\" --epoch \"{{LEASE_EPOCH}}\"`. Do not edit FRD/blueprint rollups or work-order counters yourself. The command re-derives them from work-order frontmatter, advances producer freshness, validates the lease fence inside the mutation mutex, and fails closed. Return its JSON `corrected` value.".replaceAll('{{STATE_CLI_COMMAND}}', STATE_CLI_COMMAND).replaceAll('{{PROJECT_DIR}}', PROJECT_DIR).replaceAll('{{LEASE_TOKEN}}', LEASE_TOKEN).replaceAll('{{LEASE_EPOCH}}', String(LEASE_EPOCH))
// GENERATED from the canonical marked block in plugin/agents/reviewer.md — do not hand-edit.
const WHOLE_FRD_ORACLE = "**Whole-FRD source oracle (mandatory, fail-closed):** before judging code or writing tests, inventory every normative contract in the entire `frd.md` — requirements, numbered acceptance criteria, invariants, edge cases, limits, errors and exclusions — including normative material outside numbered ACs. Record a traceability checklist in the verdict with each contract, its class, `pass | fail | not-applicable`, and the test path(s) that prove it. Every applicable edge-case or limit class requires at least one adversarial boundary test. Missing inventory, missing applicable boundary coverage, or any contradiction is RED. Passing numbered ACs can never waive, override or dismiss another normative FRD clause; there are no reviewer waivers for approved spec text."
const RENEW_LEASE = `FIRST renew this run's atomic lease (fail closed): \`${STATE_CLI_COMMAND} renew --project "${PROJECT_DIR}" --token "${LEASE_TOKEN}" --epoch "${LEASE_EPOCH}"\`. If renewal fails, return stop:true and mutate nothing.`
// REV-5: the minimal, standalone shape of RENEW_LEASE's own ask (no stop_receipt fence — RENEW_LEASE
// never runs INSPECT_STOP, only the full safe-point prompt does) — used by the throttled-boundary
// renewal-only spawn below, which does NOT run the rest of the safe-point checklist.
const RENEW_LEASE_SCHEMA = { type: 'object', properties: { stop: { type: 'boolean', description: 'true iff the lease renewal itself failed — the engine stops rather than continue building on an unrenewed/lost lease' } } }
const RELEASE_LEASE = `Release this run with the fenced TWO-PHASE protocol, in this exact order: (1) \`${STATE_CLI_COMMAND} quiesce --project "${PROJECT_DIR}" --token "${LEASE_TOKEN}" --epoch "${LEASE_EPOCH}"\` (projects running:false while the lease STILL fences every writer); (2) stage ONLY .pandacorp/status.yaml and commit it as \`chore: quiesce Claude build lease\` when it changed; (3) only after that commit succeeds run \`${STATE_CLI_COMMAND} finalize-release --project "${PROJECT_DIR}" --token "${LEASE_TOKEN}" --epoch "${LEASE_EPOCH}"\`. Any failure is fatal. Never use the compatibility \`release\` command here, never clear status.yaml, and never delete the lease directory by hand.`
const INSPECT_STOP = `${STATE_CLI_COMMAND} inspect-stop --project "${PROJECT_DIR}" --token "${LEASE_TOKEN}" --epoch "${LEASE_EPOCH}"`

let agentSpawned = 0   // running count of subagents spawned (the maxAgents brake)
let foundationRepairs = 0   // DR-065: how many foundation auto-repairs we've spent this run (capped by FOUNDATION_REPAIR_CAP) — REAL repair attempts ONLY (WS-D/D5)
let foundationGateNulls = 0   // WS-D/D5: null/garbled foundation-completeness gate verdicts (a dead gate agent), capped by FOUNDATION_GATE_NULL_CAP — a SEPARATE counter so a dead gate never consumes the real repair budget
// DR-070: the maxAgents brake, checked at EVERY safe point (FRD boundary AND each build-wave boundary)
// — not only at the top of the per-FRD loop. A pass with a few large FRDs used to inflate the count
// INSIDE one FRD and overshoot the ceiling arbitrarily (a 40-cap run reached 68). The supervisor ALSO
// enforces a reliable EXTERNAL agent-file count brake, independent of this in-engine counter.
const capHit = () => Boolean(MAX_AGENTS && agentSpawned >= MAX_AGENTS)

// Concurrency/models per mode (DR-014). `wave` = work orders built in parallel within
// an FRD. `split` runs test→backend→frontend; otherwise one full-stack implementer
// builds the coarse slice end-to-end (faster).
// The JUDGE is ALWAYS a different model from the worker (DR-015, constitution §22 — the
// generator can never judge itself; a same-model judge shares its training blind spot). So even
// pro, the cheapest mode, runs an OPUS judge over its sonnet worker: pro economizes on throughput
// (fewer waves, no split, one full-stack worker), NOT on the trust boundary. The judge is ONE
// weighted spawn per FRD gate (not per WO), so the diversity costs ~2 extra cost-units per gate.
// `reviewSplit` (proposal 31 T1.2) is INDEPENDENT of `split` (worker-team split, above). When true, the
// per-FRD gate MAY fan out into 4 parallel finder lenses + adversarial verification before the judge closes;
// when false, the single serial `frdGate()` reviewer runs byte-for-byte unchanged. On for the higher-return
// modes (powerful/deep), off for pro/balanced. SERIAL-FIRST (proposal 31 pkg C1a): even with reviewSplit on,
// the FRD's FIRST gate this run runs SERIAL — the split only kicks in on a RE-GATE (a 2nd+ gate attempt) or a
// WO already reopened on a prior run (frontmatter reopen_count≥1). Rationale (DR-100 data): ~80% of first
// gates pass or need a ≤6-min fix, so paying the 4-lens split on a first gate is net-negative; the split
// earns its cost precisely where the first pass already failed. The engine also falls back to the serial gate
// if the split's projected cost doesn't fit the remaining maxAgents budget (see frdGate/gateAndConverge).
const PROFILES = {
  pro:      { wave: 2, worker: 'sonnet', judge: 'opus',   split: false, reviewSplit: false },
  balanced: { wave: 4, worker: 'sonnet', judge: 'opus',   split: false, reviewSplit: false },
  powerful: { wave: 8, worker: 'sonnet', judge: 'opus',   split: false, reviewSplit: true  },
  deep:     { wave: 6, worker: 'opus',   judge: 'opus',   split: true,  reviewSplit: true  },
}
const P = PROFILES[MODE] || PROFILES.balanced
// DR-073: opus costs ~3x sonnet in tokens, but the maxAgents brake counts AGENTS not TOKENS — so an
// opus escalation would silently blow the token budget while agentSpawned reads low (red-team-B). We
// WEIGHT each spawn by model cost (opus ≈ 3 cost-units) so maxAgents brakes on a token-proxy, not a
// raw agent count. Every model-spawn site below adds COST(model) instead of a bare ++.
const COST = (m) => (m === 'opus' ? 3 : 1)
// DR-072 R2 — make a silently-dropped `args` VISIBLE. Two failure modes, both loud (BL-0024):
// (a) args passed as a STRING (the Workflow-tool serialization bug seen 2026-06-19);
// (b) args arriving UNDEFINED entirely (the 2026-07-02 permission-handler drop) — the old
//     `args && …` guard short-circuited on exactly that case and a change:-scoped run silently
//     degraded to an unbounded plan pass. `undefined` is only OK when the launcher truly passed
//     no args; a bounded/overnight/change run ALWAYS passes them, so surface it and let the
//     supervisor (which knows what was passed) decide whether to kill.
if (args === undefined || args === null) {
  log(`⚠⚠ args arrived ${args === null ? 'null' : 'undefined'} — if you launched this run WITH args (mode/maxAgents/maxFrds/change), they were DROPPED (DR-072 R2 / BL-0024) and this run is UNBOUNDED in powerful mode. Supervisor: verify against what you passed; if args were intended, TaskStop and relaunch.`)
} else if (typeof args !== 'object') {
  log(`⚠⚠ args arrived as a ${typeof args}, NOT an object — mode/maxAgents/maxFrds were DROPPED. This run is UNBOUNDED. Stop and relaunch passing args as a JSON object (DR-072 R2).`)
}
if (!LEASE_TOKEN || !LEASE_EPOCH) throw new Error('FATAL: atomic lease token/epoch missing — launch only through launch-implement.sh')
log(`Mode ${MODE} · wave ≤${P.wave} · maxFrds ${MAX_FRDS === Infinity ? 'sin tope' : MAX_FRDS} · maxAgents ${MAX_AGENTS || 'OFF (sin freno de presupuesto!)'} · workers ${P.worker} · judge ${P.judge}${CHANGE ? ' · change ' + CHANGE : ONLY ? ' · frds ' + ONLY.join(',') : ''}`)

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
  `  printf '{"event":"AgentWorking","at":"%s","project":"%s","data":{"role":"${role}","wo":"${wo}","frd":"${ctx.frd || ''}","phase":"${ctx.phase || 'build'}","activity":"${ctx.activity || ''}","mode":"${MODE}"}}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson\n`

// DURABLE per-project build timeline (DR-086 → Observabilidad timeline). The global event stream
// (dashboard-events.ndjson) ROTATES, so the engine ALSO appends timing to `.pandacorp/track.jsonl`
// — committed machine-state (like status.yaml), the durable source Mission Control's timeline reads.
// One JSON line per transition: wo_start / wo_end / review_start / review_end. Fire-and-forget; the
// commit writer (commitWOGreen) and the FRD gate STAGE track.jsonl so it travels with the build.
// `fields` is a JSON fragment of extra keys, e.g. `,"frd":"...","wo":"...","state":"..."`.
const TRACK = (kind, fields = '') =>
  ` Also append ONE line to ${TRACK_PATH} for the durable build timeline (fire-and-forget): printf '{"kind":"${kind}"${fields},"at":"%s"}\\n' "$(date -u +%FT%TZ)" >> ${TRACK_PATH}.`

// ── PROGRESSIVE-LEARNING BUILD JOURNAL (package A0/A1) ──────────────────────────────────────────────
// A COMMITTED, append-only sibling of track.jsonl — the cross-attempt/cross-pass learning record. It
// follows the EXACT same durability model as track.jsonl: agents APPEND their line fire-and-forget; the
// next committer STAGES the file (so it never drifts from the tree — the .gitignore keeps it committed,
// like status.yaml/track.jsonl). TRUST SPLIT (constitution rule 4): builders/patchers write ONLY
// kind:"attempt" (descriptive — verdict:null); gate reviewers write kind:"verdict"; the diagnoser writes
// kind:"diagnosis"; ONLY verifyPatched / the gate write kind:"resolution" on green — a builder can NEVER
// journal its own success. Entry schema (one JSON line): { at, wo, frd, attempt (monotone per wo),
// reopen_count (snapshot), rung: build|patch|diagnose|verify|revert|gate|retry, role:
// builder|reviewer|verifier|diagnoser, kind: attempt|verdict|diagnosis|resolution, classification:
// point|architectural|gate-test-defective|deadlocked-contract|"" , seam: {files,symbol,why}|null,
// findingKey: "<file>::<normalized one-line claim>"|null, tried, verdict: green|red|refuted|upheld|"",
// why, confidence: low|medium|high }. `body` is the JSON fragment of the entry's keys (WITHOUT braces,
// WITHOUT `at` — JOURNAL injects it), engine-known values as literals and agent-filled values as %s;
// `args` supplies the space-prefixed printf fillers for those %s (in order), same house style as
// GATE_VERDICT. Empty string "" means "not applicable" (keeps the printf robust — no bare-null quoting).
const JOURNAL_PATH = PROJECT_DIR === '.' ? '.pandacorp/build-journal.jsonl' : `${PROJECT_DIR}/.pandacorp/build-journal.jsonl`
const JOURNAL = (body, args = '') =>
  ` Append ONE line to ${JOURNAL_PATH} (the committed build-journal — append-only like track.jsonl, fire-and-forget; a later commit stages it): printf '{"at":"%s",${body}}\\n' "$(date -u +%FT%TZ)"${args} >> ${JOURNAL_PATH}.`
// A5 close-out distillation: at the end of a run, the GOLD entries of the journal (hard-won rework) are
// distilled into the DR-047 raw lesson inbox so the memory harvest can promote them. Injected into the
// close-out and notify-end prompts.
const JOURNAL_GOLD = ` BUILD-JOURNAL GOLD (A5, DR-047): read ${JOURNAL_PATH} (if it exists) and distill its GOLD entries — any work order that reached \`reopen_count\` ≥ 2 before resolving, and any entry classified \`architectural\` or \`deadlocked-contract\` — into ONE-LINE lessons appended to .pandacorp/run/lessons.md (the raw DR-047 capture inbox; tag each \`(agent-inferred)\`). Skip silently if the journal is absent or has no gold.`

// Party contract completion (BL-0020): Mission Control's FRD-06 Party tab derives the Bóveda trophy
// shelf + the unlock toast from `achievement` events and the tribunal's open state from `gate` events
// — the engine NEVER emitted either (0 in a 13MB stream), so the shelf stayed empty and the tribunal
// never lit while frontmatter said VERIFIED. The stampers (the FRD gate and the post-patch verifier —
// the only two agents allowed to set VERIFIED) now emit achievement; the gate emits gate at open.
// B8 (proposal 31 pkg B): the bare gate-open event now also carries `wos` (how many work orders are
// under review at this gate) and `attempt` (the 1-based gate attempt for THIS FRD this run — tracked in
// frdState.gateAttempts) so the tribunal view can show the review load + whether this is a re-gate. Both
// are engine-known integers, injected as literals.
const GATE_EVENT = (frd, wos, attempt) =>
  ` Also append the Party gate-open event (fire-and-forget — the tribunal lights up, BL-0020): printf '{"event":"gate","at":"%s","project":"%s","frd":"${frd}","wos":${wos},"attempt":${attempt}}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson.`
const ACHIEVEMENT = (frd) =>
  ` For EACH work order you just set VERIFIED, ALSO append its Party achievement event (one line per WO, fire-and-forget — the Bóveda trophy shelf + unlock toast read exactly this event, BL-0020): printf '{"event":"achievement","at":"%s","project":"%s","workOrder":"%s","wo":"%s","frd":"${frd}"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" "<the-wo-id>" "<the-wo-id>" >> ~/.claude/dashboard-events.ndjson.`
// Per-WO commit event (2026-07-01): Mission Control's Party refreshes its frontmatter read when a
// FRESHER dashboard event arrives — the IN_REVIEW stamp alone appends nothing, so without this line
// a WO finishing mid-session never walked forge→tribunal until a manual reload. WP-03: folded into
// TRACK_AND_WO_COMMIT (defined next to commitWOGreen, its only caller) — one heredoc instead of two
// separate printf appends for the commit writer.

// ── Package B (proposal 31): LIVE build events the Mission Control consumer reads ──────────────────
// Same contract as the events above (fire-and-forget, ONE line, single printf, payload well under 4096
// bytes, second-precision `$(date -u +%FT%TZ)`, all id fields TOP-LEVEL, project stamped with the literal
// ${PROJECT}). Counts, never id arrays. Engine-known values are injected as literals; values only the
// spawned agent can know (a reopen count, a Playwright pass/fail, done/total tallies) are `%s` args with a
// bracketed placeholder the agent fills — same house style as ACHIEVEMENT's `"<the-wo-id>"`.

// B1 — the build launched (emitted by the baseline-precheck agent, the very first spawn).
const BUILD_LAUNCH_EVENT =
  ` Also append the BuildLaunch event, ONCE, right away (fire-and-forget): printf '{"event":"BuildLaunch","at":"%s","project":"%s","mode":"${MODE}","maxAgents":${MAX_AGENTS || 0},"targeted":${TARGETED}}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson.`

// B2 — the gate's verdict at EVERY exit branch (COUNTS only, never id arrays). `fields` is a JSON fragment
// (engine-known counts injected literally); `args` supplies extra printf args for agent-filled values.
const GATE_VERDICT = (frd, verdict, fields = '', args = '') =>
  ` Also append the GateVerdict event for this exit (fire-and-forget — COUNTS only, never id arrays): printf '{"event":"GateVerdict","at":"%s","project":"%s","frd":"${frd}","verdict":"${verdict}"${fields}}\\n' "$(date -u +%FT%TZ)" "${PROJECT}"${args} >> ~/.claude/dashboard-events.ndjson.`

// B3 — a per-WO reopen event on the DASHBOARD stream (the durable track.jsonl wo_reopen line stays; this is
// the live counterpart). ONE line per reopened WO, emitted next to that track.jsonl line. reopen_count is the
// NEW value after the increment.
const WO_REOPEN_EVENT = (frd, reason = 'gate-reject') =>
  ` ALSO append the live Party wo_reopen event to the dashboard stream (fire-and-forget, ONE line for THIS reopened WO): printf '{"event":"wo_reopen","at":"%s","project":"%s","frd":"${frd}","wo":"%s","reason":"${reason}","reopen_count":%s}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" "<the-wo-id>" "<its NEW reopen_count after you increment it, an integer>" >> ~/.claude/dashboard-events.ndjson.`

// B4 — the outcome of an in-place patch attempt (green when independently verified; the two give-up causes).
const PATCH_RESULT = (frd, outcome) =>
  ` Also append the PatchResult event (fire-and-forget): printf '{"event":"PatchResult","at":"%s","project":"%s","frd":"${frd}","outcome":"${outcome}"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson.`

// B5 — the Preview Smoke Gate result for a UI FRD (real numbers from the Playwright run). Skipped entirely
// when the FRD has no UI surface.
const PREVIEW_SMOKE = (frd) =>
  ` PREVIEW SMOKE EVENT (UI FRDs only): if ${frd} exposes a UI surface, right after the verify.sh browser/Playwright layer append the PreviewSmoke event with the REAL numbers from that Playwright output (fire-and-forget): printf '{"event":"PreviewSmoke","at":"%s","project":"%s","frd":"${frd}","pass":%s,"routes":%s,"failed":%s}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" "<true if every route rendered clean, else false>" "<number of routes exercised>" "<number of routes that failed>" >> ~/.claude/dashboard-events.ndjson. If ${frd} has NO UI surface, SKIP this event entirely (do not emit it).`

// B6 — a hardening-stage result (security folds audit+fix into one; telemetry; the close-out integration).
const HARDENING_EVENT = (stage) =>
  ` Also append the Hardening event for the ${stage} stage (fire-and-forget): printf '{"event":"Hardening","at":"%s","project":"%s","stage":"${stage}","status":"%s"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" "<ok if this stage passed, else fail>" >> ~/.claude/dashboard-events.ndjson.`

// B7 — the run's terminal verdict (released at the hardening-gated close-out; partial at notify-end). `frds`
// is the engine-known done/total; `wos` the agent fills from the status.yaml per-status counts.
const BUILD_COMPLETE = (verdict, frdsDoneTotal) =>
  ` Also append the BuildComplete event (fire-and-forget): printf '{"event":"BuildComplete","at":"%s","project":"%s","wos":"%s","frds":"${frdsDoneTotal}","verdict":"${verdict}"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" "<VERIFIED work orders/total work orders from .pandacorp/status.yaml, e.g. 12/15>" >> ~/.claude/dashboard-events.ndjson.`

// WP-01 — a UI-gated pass (foundation-gate | visual-qa) was SKIPPED because no ready/built work order
// this run declared a UI-touching artifact (never emitted when FORCE_UI_PASSES bypassed the skip, nor
// when the pass genuinely ran) — so Mission Control's timeline can tell "not needed" from "silently
// dropped". Same fire-and-forget contract as the other dashboard events; embedded in whichever agent
// prompt already runs at that point in the loop (the engine itself has no shell/fs access).
const UI_PASS_SKIPPED_EVENT = (pass, frd, reason) =>
  ` Also append the UiPassSkipped event (fire-and-forget): printf '{"event":"UiPassSkipped","at":"%s","project":"%s","pass":"${pass}","frd":"${frd}","reason":"${reason}"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson.`

// WP-06 — the digested-evidence collector for THIS gate produced nothing usable (null verdict, a `report`
// that is not valid JSON, or a non-boolean `green`), so the gate fell back to EXPLORE mode and collects its
// own evidence exactly as it always did. Emitted so a silent, permanent degradation of the digested path is
// visible in the stream instead of only showing up as a cost regression. Same fire-and-forget contract as
// the events above; embedded in the gate prompt that actually ran (the engine has no shell of its own).
const GATE_EVIDENCE_FALLBACK_EVENT = (frd, reason) =>
  ` Also append the GateEvidenceFallback event (fire-and-forget — WP-06: the pre-collected evidence pack was unusable, so THIS gate ran in explore mode): printf '{"event":"GateEvidenceFallback","at":"%s","project":"%s","frd":"${frd}","reason":"${reason}"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson.`

// BL-0141 — the ONE-TIME dashboard record of a runtime/plugin agentType skew (a session still running an
// OLDER plugin than the engine version it launched, e.g. plugin 9.102.3 resident while the 9.103.0 engine
// references the new `pandacorp:mech` agent — the runtime only picks up a new agent definition on session
// restart). Injected into the RETRIED prompt itself (the engine has no shell/fs of its own, see the
// agent() wrapper below) exactly once, the same call that first hits the fallback.
const MECH_FALLBACK_EVENT = (requestedType, fallbackType) =>
  ` Also append the MechFallback event, ONCE (fire-and-forget — BL-0141: the runtime rejected agentType '${requestedType}', this run falls back to '${fallbackType}'): printf '{"event":"MechFallback","at":"%s","project":"%s","requestedType":"${requestedType}","fallbackType":"${fallbackType}"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson.\n`

// DR-108: mechanical steps — a serialized git commit, a frontmatter stamp, a rollup sync, an archive
// move, a run-summary write — don't need the worker model; they run on the cheap tier. The trust
// boundary is never these steps (the FRD gate re-verifies everything); they just execute a script.
const MECH = (args && args.mechModel) || 'haiku'
// WP-03: the class-(a)/(b) MECH sites (pure command execution / a bounded list edit / a text assembly
// from already-computed facts) run on the narrow `pandacorp:mech` agent (Bash+Read, no Write/Edit) at
// `effort: 'low'` — see the args.mechLean doc above. MECH_AGENT(fallback) composes with each call site's
// PRE-WP-03 agentType so args.mechLean:false restores it byte-for-byte, never a guessed default.
const MECH_LEAN = !(args && args.mechLean === false)
const MECH_AGENT = (fallback) => (MECH_LEAN ? 'pandacorp:mech' : fallback)
const MECH_EFFORT = MECH_LEAN ? 'low' : undefined

// ── C2: CONCURRENT FRD GATES IN A PINNED WORKTREE ─────────────────────────────────────────────────
// Today the loop either builds a wave OR drains ONE gate per iteration — build and review NEVER overlap,
// so wall-clock = builds + gates (fully additive). The gate needs a QUIET tree only because it runs
// whole-project checks — so give it a FROZEN worktree (a detached checkout pinned at the FRD's last-commit
// sha) instead of freezing the build. Gates run as BACKGROUND promises WHILE the loop keeps dispatching
// build waves; on PASS a serialized apply step ports the result to the main tree; on REJECT the loop
// QUIESCES and runs today's convergence ladder on main, byte-for-byte. Staged for risk containment: build
// WAVES stay synchronous barriers — only GATES go concurrent. If worktree creation fails, the whole run
// falls back to the legacy synchronous gate path (a real, tested fallback).
const MAX_CONCURRENT_GATES = (args && args.maxConcurrentGates) || 2   // cap on gate promises in flight at once (they still serialize on the single worktree; this bounds the backlog)
const GATE_WORKTREE = PROJECT_DIR === '.' ? '.pandacorp/run/gate-worktree' : `${PROJECT_DIR}/.pandacorp/run/gate-worktree`   // detached worktree dir (gitignored run/ state); crash residue is preserved and causes synchronous fallback
// The gate agent's cwd preamble: cd to the frozen worktree (NOT the project root). Every relative path in
// the gate prompt is worktree-relative; absolute ${PROJECT_DIR}/... paths (dashboard events, track.jsonl,
// punch-list) still target the MAIN tree (append-only, no git — worktree-safe).
const worktreeWorkFrom = (pinSha) => `Work from the GATE WORKTREE ${GATE_WORKTREE} — cd there FIRST. It is a DETACHED git worktree checked out at the pinned commit ${pinSha} (a frozen, quiet copy of the tree so the main build keeps going); DO NOT cd to the main project root and DO NOT run any \`git commit\`/branch op that writes the main tree. Every relative path below is relative to the worktree; any path written as an absolute ${PROJECT_DIR}/... is the MAIN tree (append-only files only).\n`

// Owner notification — macOS desktop only (osascript). Fire-and-forget; never blocks the
// build. (Phone push, when Remote Control is on, is sent by the supervising agent via
// PushNotification — see the implement skill. No third-party push app: owner decision 2026-06-16.)
const NOTIFY = (msg, sound) =>
  ` Notify the owner (run via Bash, fire-and-forget): ` +
  `osascript -e 'display notification "${msg}" with title "Pandacorp build" sound name "${sound || 'Basso'}"' 2>/dev/null || true.`

// ── BL-0022: prepend the WORK_FROM preamble to EVERY agent prompt, in ONE place ────────────────────
// Every subagent inherits the session cwd (which may be the factory root, not the project root). So we
// wrap the provided `agent` global once: it prepends the WORK_FROM directive (`cd` to PROJECT_DIR
// first) to the prompt string of every call site — no N hand edits, no call site forgotten. When
// PROJECT_DIR is unset (back-compat), WORK_FROM is '' and the prompt is passed through byte-for-byte.
// The provided `agent` is an injected global (like log/phase/parallel/budget), so rebinding it here
// re-points every later `agent(...)` call through the wrapper; the raw impl is captured first.
const __rawAgent = agent
// ── BL-0141: honest, automatic agentType degradation ────────────────────────────────────────────────
// A session can launch a build on an engine version that references an agent NEWER than the plugin the
// session itself still has resident (the update applies at session restart, not mid-session) — e.g.
// engine 9.103.0 spawning `pandacorp:mech` from a session still running plugin 9.102.3. The runtime's own
// rejection is a thrown error naming the missing type: `agent type '<x>' not found. Available agents: …`.
// Handled generically for ANY 'pandacorp:*' type (not just mech) so a renamed/removed agent degrades the
// same way instead of killing the whole run on its very first spawn (the 2026-09-22 canary A incident —
// baseline-precheck died before the scheduler loop even existed, leaving the atomic lease taken until an
// owner freed it by hand). ONE retry, with the fallback the call declares (`opts.fallbackAgentType`) or
// 'pandacorp:implementer' by default; a failing fallback propagates the ORIGINAL not-found error — never
// a second retry, never a loop.
let mechUnavailable = false   // sticky once 'pandacorp:mech' itself 404s once — every LATER mech-typed
// call this run goes straight to its fallback instead of paying another guaranteed-failed spawn for the
// same runtime/plugin skew.
let mechFallbackLogged = false   // the explanatory log fires ONCE this run, not once per call site
const AGENT_TYPE_NOT_FOUND_RE = /agent type '([^']+)' not found/
const DEFAULT_AGENT_FALLBACK = 'pandacorp:implementer'
// REV3-H / D1 (DR-015): these types are INDEPENDENT ORACLES — their whole contract is judging work
// someone else built (the reviewer edits test files only, never production code; the security-auditor
// and test-writer never touch app code either). The generic BL-0141 degradation exists so a builder
// role can fall back to the plugin's stock implementer, but an oracle has no honest substitute: silently
// re-spawning a missing reviewer AS pandacorp:implementer would let the builder judge its own work and
// still promote it to VERIFIED. So an oracle-typed call with no call-site-declared `fallbackAgentType`
// re-throws instead of retrying — a missing judge FAILS the gate, it is never impersonated.
const ORACLE_TYPES = new Set(['pandacorp:reviewer', 'pandacorp:security-auditor', 'pandacorp:test-writer'])
let oracleNoFallbackLogged = false   // the explanatory log fires ONCE this run, not once per call site
agent = async (prompt, opts = {}) => {
  // C2: a per-call `workFrom` override lets the CONCURRENT gate run from the pinned gate worktree instead
  // of the project root (default). undefined → the legacy WORK_FROM (cd PROJECT_DIR). '' → no preamble.
  const wf = (opts && opts.workFrom !== undefined) ? opts.workFrom : WORK_FROM
  let rest = opts
  if (opts && opts.workFrom !== undefined) { rest = { ...opts }; delete rest.workFrom }   // never leak workFrom into the real agent() opts
  const finalPrompt = typeof prompt === 'string' && wf ? wf + prompt : prompt
  // Already know pandacorp:mech is unavailable this run — substitute the fallback BEFORE spawning, so
  // this call never pays for a repeat of the same guaranteed rejection.
  if (mechUnavailable && rest && rest.agentType === 'pandacorp:mech') {
    rest = { ...rest, agentType: rest.fallbackAgentType || DEFAULT_AGENT_FALLBACK }
  }
  try {
    return await __rawAgent(finalPrompt, rest)
  } catch (e) {
    const requestedType = rest && rest.agentType
    const match = requestedType && typeof requestedType === 'string' && requestedType.startsWith('pandacorp:') && e && typeof e.message === 'string'
      ? e.message.match(AGENT_TYPE_NOT_FOUND_RE)
      : null
    // Only ever retry the SPECIFIC "unknown agentType" rejection of the type THIS call itself requested —
    // a generic/unrelated failure (timeout, malformed response, a tool error) is never treated as retryable.
    if (!match || match[1] !== requestedType) throw e
    // D1 (DR-015): an oracle type with no explicit fallback declared at the call site never degrades
    // into the default builder fallback — re-throw the original not-found so the gate fails honestly.
    if (ORACLE_TYPES.has(requestedType) && !rest.fallbackAgentType) {
      if (!oracleNoFallbackLogged) {
        oracleNoFallbackLogged = true
        log(`agentType '${requestedType}' no disponible en este runtime — es un tipo oráculo sin fallback explícito, así que el gate falla en vez de degradar el juez (DR-015).`)
      }
      throw e
    }
    const fallback = rest.fallbackAgentType || DEFAULT_AGENT_FALLBACK
    if (fallback === requestedType) throw e   // no distinct fallback to retry with
    if (requestedType === 'pandacorp:mech') {
      mechUnavailable = true
      if (!mechFallbackLogged) {
        mechFallbackLogged = true
        log(`pandacorp:mech no disponible en este runtime (plugin desactualizado en la sesión): usando ${fallback}; reinicia la sesión para 9.103.0`)
      }
    } else {
      log(`agentType '${requestedType}' no disponible en este runtime — usando ${fallback} como fallback.`)
    }
    const retryPrompt = requestedType === 'pandacorp:mech' && typeof finalPrompt === 'string' ? MECH_FALLBACK_EVENT(requestedType, fallback) + finalPrompt : finalPrompt
    try {
      return await __rawAgent(retryPrompt, { ...rest, agentType: fallback })
    } catch (e2) {
      // D5 (error-handling.md: never swallow an error): the fallback's own failure reason must not be
      // discarded — log it so an operator can tell WHY the rescue failed, then still surface the
      // ORIGINAL not-found error (never a second retry, never masking the root cause with e2).
      log(`⚠ fallback ${fallback} also failed: ${e2 && e2.message ? e2.message : e2}`)
      throw e
    }
  }
}

// ── BL-0011: whole-project gate quarantine of a needs-owner-BLOCKED route (LESSON-0021, DR-085) ──
// The whole-project e2e gates (smoke/visual/responsive/shell) assert over EVERY declared route. When one
// route's owning work order is legitimately `BLOCKED: needs-owner` — an accepted incompleteness only the
// owner can clear (a missing secret, an external account) — that single node used to red-lock the ENTIRE
// gate, coupling unrelated FRDs AND the baseline/close-out to it (personal-page-v2 /contact without
// NEXT_PUBLIC_WEB3FORMS_KEY, runs wf_9e98acaf-92e / wf_978129ab-eca). A blocked node is a tracked owner
// TODO, not a code defect. So before any WHOLE-PROJECT verify.sh (baseline self-heal, close-out, notify-end,
// the fail-safe) the agent derives the quarantine set FROM THE FRONTMATTER and exports it as
// `PANDACORP_GATE_SKIP_ROUTES`, which the e2e specs read (e2e/_skip.ts) to hold those routes ASIDE.
// FAIL-CLOSED: ONLY a route whose WO is provably `implementation_status: BLOCKED` + `blocked_reason:
// needs-owner` may be listed (a route blocked for error/external/any-other-reason still reds the gate), and
// the quarantine is LOGGED LOUDLY (both here and by _skip.ts). This is threaded ONLY into the whole-project
// invocations — the per-FRD `--since` gate never runs shell/smoke on a sibling route, so the coupling only
// ever bit the FULL gate (BL-0011 §Problem); do NOT skip anything on a `--since` run.
const GATE_SKIP =
  ` GATE QUARANTINE (BL-0011, fail-closed) — you are about to run a WHOLE-PROJECT \`bash .pandacorp/verify.sh\` (no \`--since\`), whose e2e layer asserts EVERY route. FIRST derive the needs-owner quarantine set so a route the OWNER must unblock does not red-lock the whole gate: scan every docs/frds/*/work-orders/wo-*.md and collect ONLY those whose frontmatter is EXACTLY \`implementation_status: BLOCKED\` AND \`blocked_reason: needs-owner\` (NOT error, NOT external, NOT any other reason — those still RED). For each such WO, take the route it owns (its \`route:\`/\`path:\` frontmatter if present, else the live path of the surface it builds, matched against e2e/routes.ts SURFACES). If the set is NON-EMPTY, export it before running verify.sh: \`export PANDACORP_GATE_SKIP_ROUTES="/route-a,/route-b"\` (comma-separated, no spaces) and LOG it loudly to your output ("⚠ quarantining needs-owner-blocked route(s): …, held aside from the whole-project gate — tracked owner TODO(s), not regressions"). If the set is EMPTY, do NOT export the variable (the default is zero quarantine — the full gate ranges over every route). NEVER add a route that is not provably BLOCKED needs-owner.`

// ── BL-0066: publish last_green_sha through an honest two-commit protocol ──────
// A commit cannot contain its own SHA: amending after writing that SHA creates a different commit and
// orphans the recorded object. Commit A is the immutable reviewed snapshot; commit B publishes
// last_green_sha=A. The pointer commit is metadata-only and A remains an ancestor of HEAD.
const LAST_GREEN_ORDERING = ` **last_green_sha ORDERING (BL-0066 — do this EXACTLY, TWO commits):** (A) COMMIT the complete independently verified snapshot first (code/tests, VERIFIED frontmatter, frd.md/blueprint.md rollups, timeline/journal, and status.yaml with every field EXCEPT the new last_green_sha/safe_to_test publication). (B) Run \`git rev-parse HEAD\` and prove it exists + is on the current chain with \`git cat-file -e <sha>^{commit} && git merge-base --is-ancestor <sha> HEAD\`; only then write THAT SHA as \`last_green_sha\` and \`safe_to_test: true\` in .pandacorp/status.yaml and make a SECOND metadata-only commit: \`git add .pandacorp/status.yaml && git commit -m "chore(build): publish last green snapshot"\`. NEVER amend commit A: the stable contract is last_green_sha = the verified ancestor snapshot, and pointer commit B descends from A.`

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
    unsatisfiedDeps: {
      type: 'array',
      description: 'Only when args.frds is set: deps of the requested FRDs that are NOT fully VERIFIED yet. Return [] if all deps are satisfied or args.frds is not set.',
      items: {
        type: 'object', required: ['frd', 'dep'],
        properties: {
          frd: { type: 'string', description: 'the requested FRD folder that has this unmet dep' },
          dep: { type: 'string', description: 'the dep FRD folder that is NOT fully VERIFIED yet (at least one of its WOs is not VERIFIED)' },
        },
      },
    },
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
                path: { type: 'string', description: 'repo-relative path of this work-order markdown file, e.g. docs/frds/frd-03-x/work-orders/wo-03-001-y.md — injected into the builder prompt so the agent opens THE file instead of hunting for it (DR-108)' },
                acText: { type: 'string', description: "DR-108 context pack: the FRD's EARS acceptance-criteria lines that THIS work order must satisfy, copied VERBATIM from frd.md (only the ACs this WO owns per the Build Plan — bounded, not the whole FRD). Injected into the builder + test-writer prompts so the first attempt builds against the REAL AC scope instead of a one-line summary (first-attempt gate failures were the top rework cause)." },
                difficulty: { type: 'string', description: 'low|medium|high from the WO frontmatter (default medium). high → built on opus a-priori (DR-073 HYBRID)' },
                reopen_count: { type: 'number', description: 'from the WO frontmatter (default 0) — empirical escalation signal (a WO that already failed once is built on opus, DR-073)' },
                deps: { type: 'array', items: { type: 'string' }, description: 'intra-FRD WO ids that must be built first' },
                artifacts: { type: 'array', items: { type: 'string' }, description: 'globs of files/dirs this WO writes (from its `artifacts:` frontmatter) — the engine serializes wave-parallel WOs whose artifacts overlap, so they never collide (DR-060)' },
                foundation: { type: 'boolean', description: 'true if this WO builds the shared design-system primitives / component inventory the other WOs reuse — the engine builds it FIRST, alone, before the rest fan out (DR-057)' },
                priorAttempts: { type: 'array', description: 'A4 CROSS-PASS LEARNING: a BOUNDED digest (last 2) of what earlier attempts on THIS work order tried and why they did not hold — synthesized by reading .pandacorp/build-journal.jsonl (if present) for this wo id. Injected into the builder as HYPOTHESES to verify against the CURRENT code, never gospel. [] when the journal is absent or has no entries for this wo.', items: { type: 'object', properties: { attempt: { type: 'number' }, classification: { type: 'string' }, findingKey: { type: 'string' }, tried: { type: 'string' }, why: { type: 'string' } } } },
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
// ── WP-08 THE scope:"partial" CAGE (unconditional — NOT behind args.scopedRepair) ────────────────
// verify.sh stamps `"scope":"partial"` into `.pandacorp/run/gate-report.json` on any `--only`/`--files`
// run. Such a run is a PARTIAL ORACLE by construction: it skipped sub-gates and/or narrowed biome to a
// file list and vitest to those files' related tests. It exists to make a repair agent's INNER loop
// cheap — never to certify. So every path that would promote a work order to VERIFIED or advance
// last_green_sha asserts the scope first and REFUSES a partial one, whatever the agent claims.
// The engine cannot read files (a Workflow script has no fs), so the value travels back in the
// verdict: each certifying agent reads the JSON and returns its `scope` verbatim as `report_scope`.
// ABSENT / unknown is treated as unscoped — back-compat, and honest: only the engine ever passes the
// scoped flags, so a missing field means a pre-WP-08 agent, not a hidden partial run.
const REPORT_SCOPE = { type: 'string', enum: ['full', 'since', 'partial'], description: 'WP-08: the `scope` value of `.pandacorp/run/gate-report.json` as written by the LAST verify.sh run you performed for this verdict. Copy it VERBATIM, never guess it — the engine REFUSES to stamp VERIFIED or advance last_green_sha on "partial" (a --only/--files scoped run is not a certification).' }
const REPORT_SCOPE_DIRECTIVE = ' **GATE-REPORT SCOPE (WP-08, mandatory):** after the verify.sh run behind this verdict, read `.pandacorp/run/gate-report.json` and return its `scope` field VERBATIM as `report_scope`. Never guess or normalize it. A `partial` scope (a `--only`/`--files` scoped run) can certify NOTHING — the engine refuses the promotion — so reporting it honestly costs you nothing and reporting it wrongly is a false certification.'
const isPartialReport = (v) => Boolean(v && v.report_scope === 'partial')
const refusePartial = (frd, what) =>
  log(`⛔ ${frd}: ${what} claims GREEN but its gate-report says scope:"partial" (a --only/--files SCOPED run). A scoped gate is not a certification — REFUSING to stamp VERIFIED / advance last_green_sha (WP-08 cage).`)
// Generic done/failure result (close-out, archive, hardening stages).
const STOP_SCHEMA = { type: 'object', required: ['done'], properties: { done: { type: 'boolean' }, failure: { type: 'string' } } }
// WP-08: apply-gate is one of exactly two agents that stamp VERIFIED + advance last_green_sha, so its
// verdict carries the same REPORT_SCOPE field the other one does (one definition, not a second copy).
const APPLY_GATE_SCHEMA = { type: 'object', required: ['done'], properties: { done: { type: 'boolean' }, failure: { type: 'string' }, report_scope: REPORT_SCOPE } }
const CLOSE_RECEIPT_SCHEMA = { type: 'object', required: ['done', 'allowed_paths', 'lease_released'], properties: { done: { type: 'boolean' }, reason: { type: 'string' }, allowed_paths: { type: 'array', items: { type: 'string' } }, before_dirty: { type: 'array', items: { type: 'string' } }, after_dirty: { type: 'array', items: { type: 'string' } }, commit: {}, lease_released: { type: 'boolean' } } }
// WS-D/D10: the cheap MECH baseline PRE-CHECK verdict (a discriminated union — exactly one of stop / green /
// escalate / a BL-0022 failure). It does the root guard, consumes rethink_pending, honours the owner stop
// signal (.pandacorp/run/stop) and the clean-tree fast path; only on `escalate` does the expensive judge
// baseline run (DR-067 reconciliation + verify.sh). No `required` — it returns whichever field applies.
// BL-0124: `dirtyPaths` + `leaseValid` let the ENGINE (not the agent's own prose) apply the narrow
// leased-status.yaml exclusion deterministically — see the Baseline self-heal decision below.
const PRECHECK_SCHEMA = {
  type: 'object',
  properties: {
    stop: { type: 'boolean', description: 'true iff .pandacorp/run/stop exists — the owner asked to halt; the engine stops clean without building' },
    green: { type: 'boolean', description: 'true = clean tree AND HEAD is last_green_sha OR its direct metadata-only pointer child (known-green fast path); false ONLY paired with a BL-0022 failure' },
    escalate: { type: 'boolean', description: 'true = dirty tree or HEAD is beyond the certified snapshot/pointer pair → run the judge baseline' },
    dirty: { type: 'boolean', description: 'true iff `git status --porcelain` showed changes (informs the judge baseline whether reconciliation is needed)' },
    dirtyPaths: { type: 'array', items: { type: 'string' }, description: "BL-0124: every path `git status --porcelain` reported dirty (project-relative, exactly as printed; [] when clean). The engine — not this step — decides whether the narrow leased-status.yaml exclusion applies, so report this honestly even when escalating." },
    leaseValid: { type: 'boolean', description: "BL-0124: true iff THIS run already holds the current valid lease fence — already PROVEN by STEP 0's inspect-stop succeeding under this run's own token/epoch (the same fence BL-0079 relies on for the repair step), not a fresh check. Only meaningful together with dirtyPaths." },
    failure: { type: 'string' },
  },
}
// DR-069 SAFE-POINT (audit-20 P0-3): the ENGINE checks the owner's signals at every FRD boundary —
// the change queue (ready items), answered decisions (unblock BLOCKED needs-owner WOs), and the
// rethink stop — instead of leaving the drain to supervisor prose (a supervisor may not exist, and
// its safe points are between passes, not between FRDs).
const SAFE_POINT_SCHEMA = {
  type: 'object', required: ['stop', 'stop_receipt'],
  properties: {
    stop: { type: 'boolean', description: 'true iff rethink_pending: true — owner-file stop truth is carried separately by stop_receipt' },
    stop_receipt: { type: 'object', required: ['status_exists', 'stop', 'method'], properties: {
      status_exists: { type: 'boolean' }, stop: { type: 'boolean' }, method: { type: 'string' },
    }, description: 'verbatim fenced stateCli inspect-stop receipt; mandatory and validated fail-closed by the engine' },
    ready: { type: 'array', items: { type: 'string' }, description: 'queue slugs with status: ready — expedite first, then standard FIFO' },
    // WS-D/D14: report each unblocked WO with its OWNING FRD so the engine can re-enroll it into THIS run's
    // schedule (remove from blockedIds, restore into globalQueue + the FRD's toBuildIds) — the unblock takes
    // effect this pass, not next. Was a flat string[] of ids (engine only logged them; the WO rebuilt next run).
    unblocked: { type: 'array', description: 'WOs flipped BLOCKED→PLANNED because the owner answered their decision — reported so the engine re-enrolls them THIS run', items: { type: 'object', required: ['frd', 'wo'], properties: { frd: { type: 'string', description: 'the FRD folder that owns this WO' }, wo: { type: 'string', description: 'the WO id flipped BLOCKED→PLANNED' } } } },
  },
}
// DR-065: a `missingFoundation` list flags the HIGH-CONFIDENCE, BOUNDED auto-repair class — "a
// surface failed because a shared primitive it needs isn't in the foundation". When present, the
// engine auto-resolves (add the primitive to the foundation, rebuild, retry) instead of escalating.
const MISSING_FOUNDATION = { type: 'array', items: { type: 'string' }, description: 'names of shared design-system primitives the surface needed but that are NOT in the built foundation (e.g. Room, AgentSprite). Set this when the failure is "a needed primitive is missing from the foundation" — the engine auto-repairs the foundation (DR-065), it does NOT escalate.' }
// DR-073: `findings` carries the specific fixable fault(s) + the RED-proven failing test(s) the
// reviewer wrote for a LOCALIZED reject, so the engine can attempt an in-place patch BEFORE reverting.
const FINDINGS = { type: 'array', description: 'DR-073: the specific fixable fault(s) of the rejected WO(s) + the RED-proven failing test(s) the reviewer wrote — fed to attemptPatch for an in-place repair before any revert', items: {
  type: 'object', required: ['wo', 'finding'],
  properties: { wo: { type: 'string' }, finding: { type: 'string', description: 'the specific bounded fault, with file:line' }, failingTest: { type: 'string', description: 'the RED-proven test (path / describe-it / a snippet) that fails without the fix and passes with it' }, files: { type: 'array', items: { type: 'string' }, description: 'the file(s) the fix should touch' } },
} }
const FRD_GATE_SCHEMA = {
  type: 'object', required: ['green', 'traceability'],
  properties: { green: { type: 'boolean' }, reopen: { type: 'array', items: { type: 'string' } }, findings: FINDINGS, missingFoundation: MISSING_FOUNDATION, blocked_reason: BLOCK_REASON, failure: { type: 'string' },
    traceability: { type: 'array', minItems: 7, description: 'Whole-FRD normative inventory. It includes requirements, acceptance-criteria, invariant, edge-case, limit, error and exclusion entries; missing coverage is RED.', items: { type: 'object', required: ['contract', 'contractClass', 'status', 'tests'], properties: { contract: { type: 'string' }, contractClass: { type: 'string', enum: ['requirement', 'acceptance-criterion', 'invariant', 'edge-case', 'limit', 'error', 'exclusion'] }, status: { type: 'string', enum: ['pass', 'fail', 'not-applicable'] }, tests: { type: 'array', items: { type: 'string' } } } } },
    // C2: on a PASS the review-only gate returns the new/changed adversarial TEST FILES it wrote (repo-relative)
    // so the serialized apply-gate step can PORT them from the frozen worktree onto the main tree.
    testFiles: { type: 'array', items: { type: 'string' }, description: 'C2: repo-relative paths of the new/changed adversarial test files the gate wrote this cycle (in its worktree) — the apply step ports them to the main tree on green' },
    report_scope: REPORT_SCOPE,
    // WP-08: the raw machine-readable verdict, so the ENGINE classifies the failing sub-gate
    // deterministically instead of paying an opus diagnoser to re-read prose. Never interpreted as
    // BLAME — it names WHICH gate went red (tsc, vitest, knip…), never whose fault it is; the
    // cause:'gate-test-defective' discrimination stays entirely the patcher's and diagnoser's call.
    gateReport: { type: 'object', description: 'WP-08: the verbatim `.pandacorp/run/gate-report.json` written by the verify.sh run behind this verdict. Copy it as-is (you may omit `duration_ms` and truncate each sub-gate\'s `failures` to its first 20 entries). The engine reads the failing sub-gate NAMES and their failure FILE paths from it — nothing else — to route a purely mechanical failure to a cheap fixer.', properties: {
      scope: { type: 'string' }, green: { type: 'boolean' },
      subgates: { type: 'array', items: { type: 'object', properties: {
        name: { type: 'string', description: 'structure-guard | data-layer | api-error-contract | doc-lint | residual-ambiguity | biome | tsc | knip | madge | vitest | playwright' },
        exit: { type: 'number' },
        failures: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, code: { type: 'string' }, msg: { type: 'string' } } } },
      } } },
    } },
  },
}
// ── WP-08 DETERMINISTIC SUB-GATE CLASSIFICATION ──────────────────────────────────────────────────
// Which gate went red is a FACT the report already states — it needs no judgement and no model. Map
// each sub-gate to its failure class, and call the failure MECHANICAL only when EVERY failing class is
// mechanical (a red vitest alongside a red tsc is real-behaviour work and keeps the full opus ladder).
// This function decides a MODEL and a SCOPE. It never decides fault: it can never produce (or suppress)
// `cause: 'gate-test-defective'` — that discrimination is LESSON-0002's and stays with the patcher.
const SUBGATE_CLASS = {
  biome: 'lint', tsc: 'types', madge: 'cycles', knip: 'deadcode',
  'structure-guard': 'structure', 'data-layer': 'structure', 'api-error-contract': 'structure',
  vitest: 'unit-test', playwright: 'e2e', 'doc-lint': 'doc', 'residual-ambiguity': 'doc',
}
const MECHANICAL_CLASSES = ['lint', 'types', 'structure', 'cycles']
function classifyGateFailure(gate) {
  const subgates = gate && gate.gateReport && Array.isArray(gate.gateReport.subgates) ? gate.gateReport.subgates : null
  if (!subgates) return null   // no report → no deterministic signal; the legacy ladder decides
  const failed = subgates.filter((s) => s && typeof s.name === 'string' && Number(s.exit) !== 0)
  if (!failed.length) return null
  const names = [...new Set(failed.map((s) => s.name))]
  const classes = [...new Set(names.map((n) => SUBGATE_CLASS[n]).filter(Boolean))]
  if (!classes.length) return null   // unknown sub-gate names → fail safe into the legacy ladder
  const files = [...new Set(failed.flatMap((s) => (s.failures || []).map((x) => x && x.file).filter(Boolean)))]
  return { subgates: names, classes, files, mechanical: classes.every((c) => MECHANICAL_CLASSES.includes(c)) }
}
const REQUIRED_TRACE_CLASSES = ['requirement', 'acceptance-criterion', 'invariant', 'edge-case', 'limit', 'error', 'exclusion']
function enforceWholeFrdTraceability(result) {
  const trace = result && result.traceability
  const missing = !Array.isArray(trace) || REQUIRED_TRACE_CLASSES.some((kind) => !trace.some((entry) => entry && entry.contractClass === kind))
  const invalidBoundary = Array.isArray(trace) && trace.some((entry) => entry && ['edge-case', 'limit'].includes(entry.contractClass) && entry.status === 'pass' && (!Array.isArray(entry.tests) || entry.tests.length === 0))
  const waivedFailure = result && result.green === true && Array.isArray(trace) && trace.some((entry) => entry && entry.status === 'fail')
  if (missing || invalidBoundary || waivedFailure) return { green: false, traceability: Array.isArray(trace) ? trace : [], failure: 'whole-FRD traceability is missing, lacks boundary evidence, or contradicts a green verdict' }
  return result
}
// ── WP-06 evidence-pack schema (args.gateEvidence: 'digested') ───────────────
// What the cheap `evidence:<frd>` collector returns to the ENGINE (never to the reviewer directly — the
// engine validates it fail-closed first, then interpolates it into the gate prompt). `report` is the
// VERBATIM text of `.pandacorp/run/gate-report.json` (a string, not a parsed object) precisely so the
// engine can prove it is well-formed JSON with a boolean `green` before any reviewer sees it: a pack that
// cannot be proven well-formed is discarded and the gate runs in explore mode.
const EVIDENCE_SCHEMA = {
  type: 'object', required: ['report'],
  properties: {
    report: { type: 'string', description: 'the VERBATIM contents of .pandacorp/run/gate-report.json after `bash .pandacorp/verify.sh --since <last_green_sha> --report-all` — the whole file as text, never a summary, never re-formatted' },
    diffStat: { type: 'string', description: 'the output of `git diff <pin_base>..<pin> --stat` (the full stat, every file)' },
    diff: { type: 'string', description: "the UNIFIED diff `git diff <pin_base>..<pin> -- <the reviewed work orders' artifact paths>`, capped at EVIDENCE_DIFF_MAX_LINES lines" },
    truncated: { type: 'boolean', description: 'true iff the unified diff exceeded the line cap and was clipped — the gate is told so explicitly, so a clipped diff is never read as the complete change set' },
    ac: { type: 'string', description: "the FRD's EARS acceptance criteria, VERBATIM from frd.md" },
  },
}

// ── Split-gate schemas (proposal 31 T1.2) ────────────────────────────────────
// The FIND stage's finders each report a flat list of {file, claim, evidence, severity}. `severity`
// discriminates a blocking CORRECTION from an advisory nit (only corrections reach the adversarial
// VERIFY stage; nits are advisory and pass straight to the closer). Read-only: findings only, no fixes.
const FINDER_SCHEMA = {
  type: 'object', required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object', required: ['file', 'claim', 'severity', 'evidence'],
        properties: {
          file: { type: 'string', description: 'the file (path, ideally with a line) the finding is anchored to' },
          claim: { type: 'string', description: 'the specific defect claimed, one sentence' },
          severity: { type: 'string', enum: ['correction', 'nit'], description: "'correction' = a blocking defect (correctness/security/SSOT/render) that must be verified and, if confirmed, fixed; 'nit' = advisory polish that never blocks" },
          evidence: { type: 'string', description: 'the concrete evidence for the claim (the code/behavior observed) — grounds it so the skeptic can try to refute it' },
        },
      },
    },
  },
}
// The VERIFY stage's skeptic returns whether it REFUTED the correction. Default-refuted if it cannot
// reproduce/anchor the finding against the real code (an unreproducible claim is noise, not a defect).
const VERIFY_FINDING_SCHEMA = {
  type: 'object', required: ['refuted'],
  properties: {
    refuted: { type: 'boolean', description: 'true iff the skeptic could NOT anchor/reproduce the finding against the actual code (the finding dies); false iff it stands (a real defect the closer must act on)' },
    reason: { type: 'string', description: 'why refuted or upheld, with the evidence checked' },
  },
}
const REPAIR_SCHEMA = {
  type: 'object', required: ['green'],
  properties: {
    green: { type: 'boolean' }, missingFoundation: MISSING_FOUNDATION, blocked_reason: BLOCK_REASON, failure: { type: 'string' },
    // BL-0001 (DR-107): a green:false patch verdict is DISCRIMINATED — 'code' (the build is wrong;
    // the engine reverts + retries) vs 'gate-test-defective' (the reviewer's adversarial test is
    // internally inconsistent / unsatisfiable; the engine repairs the TEST, it does NOT discard a
    // correct build). One fallback for two causes was rebuilding correct work in unwinnable loops.
    cause: { type: 'string', enum: ['code', 'gate-test-defective'], description: "why the patch could not green: 'code' = the build genuinely fails → revert+retry; 'gate-test-defective' = a reviewer test is internally inconsistent/unsatisfiable by ANY correct implementation → the engine routes to gate-test repair (BL-0001), never a rebuild" },
    defectiveTests: { type: 'array', description: 'BL-0001: the reviewer test(s) judged defective, with evidence — only when cause is gate-test-defective', items: { type: 'object', required: ['path', 'why'], properties: { path: { type: 'string' }, why: { type: 'string', description: 'the internal inconsistency, e.g. "asserts desktop-only nav visibility but the Playwright config runs desktop+mobile and no viewport is forced"' } } } },
    report_scope: REPORT_SCOPE,
  },
}
// ── Diagnosis schema (A2, progressive-learning recovery) ─────────────────────
// The read-only diagnoser's verdict when an in-place patch fails cause:'code'. It classifies the failure
// and recommends the CHEAPEST safe recovery so the ladder stops EARLIER than the reopen cap on a doomed
// spec — never LATER (the cap is still the hard bound). A diagnosis without a file:line anchor is
// confidence:low and cannot justify block/architectural (default 'point'); priors it cannot reproduce
// against CURRENT code go in supersededPriors (poison self-purge).
const DIAGNOSE_SCHEMA = {
  type: 'object', required: ['classification', 'recommendation', 'confidence'],
  properties: {
    classification: { type: 'string', enum: ['point', 'architectural', 'gate-test-defective', 'deadlocked-contract'], description: "point = a bounded, cleanly-fixable fault; architectural = findings spread over > FINDING_SPREAD_THRESHOLD files OR the same findingKey recurring across >=2 attempts OR an AC unsatisfiable vs the blueprint; gate-test-defective = a reviewer adversarial test is internally inconsistent/unsatisfiable (route to gate-test repair); deadlocked-contract = a blessed test asserts a contract a dependsOn sibling WO intentionally derogates (LESSON-0104)" },
    seam: { type: 'object', description: 'where the fault localizes', properties: { files: { type: 'array', items: { type: 'string' } }, symbol: { type: 'string' }, why: { type: 'string' }, cleanlySeparable: { type: 'boolean', description: 'true iff reverting ONLY seam.files cleanly isolates the fault without unwinding good work — gates the PARTIAL revert' } } },
    repeatsPrior: { type: 'boolean', description: 'true iff this SAME fault (findingKey) already appears in the journal for this WO on a prior attempt, AFTER purging priors you cannot reproduce now (supersededPriors)' },
    supersededPriors: { type: 'array', description: 'prior journal diagnoses this diagnosis REFUTES against the current code (poison self-purge) — not counted as recurrences', items: { type: 'object', properties: { attempt: { type: 'number' }, whyCannotReproduce: { type: 'string' } } } },
    recommendation: { type: 'string', enum: ['patch', 'partial-revert', 'full-revert', 'block-needs-owner'], description: 'block-needs-owner ONLY for architectural/deadlocked-contract at confidence medium|high' },
    decisionRecord: { type: 'string', description: 'Spanish, owner-facing — what keeps failing, the diagnosis, what the owner must decide (meaningful when recommending block-needs-owner; a one-liner otherwise)' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
}
// Targeted change build: the process-change agent reads a change from the queue, creates/updates
// its FRDs+WOs via iterate/bug logic, and returns the list of affected FRD folders so the normal
// build loop can pick them up (with dep checking). The change is NOT archived here — the FRD gate
// does that when the FRDs verify, same as in the normal change-drain flow.
const PROCESS_CHANGE_SCHEMA = {
  type: 'object', required: ['done', 'affectedFrds'],
  properties: {
    done: { type: 'boolean' },
    affectedFrds: { type: 'array', items: { type: 'string' }, description: 'FRD folder names (docs/frds/<folder>) created or updated by this change' },
    changeFile: { type: 'string', description: 'the matched change filename in .pandacorp/inbox/changes/' },
    failure: { type: 'string' },
  },
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

// ── WS-D/D3: the ONE guaranteed-shutdown helper for every PRE-LOOP early return ────────────────────
// Before the scheduler loop the engine can bail for several reasons (baseline red, change not processed,
// planner failed, unsatisfied deps). Each of those used to `return` WITHOUT writing running:false, leaving
// Mission Control showing a phantom running build until the next launch. ensureStopped() is a single cheap
// MECH spawn that guarantees running:false (and NEVER touches `phase`) — awaited before every such return.
async function ensureStopped(reason) {
  agentSpawned++
  const receipt = await agent(`MECHANICAL COMMAND RUNNER — your SOLE action is to execute this exact command once, with no command before or after it, and return its JSON stdout verbatim: \`${STATE_CLI_COMMAND} close-preloop --project "${PROJECT_DIR}" --token "${LEASE_TOKEN}" --epoch "${LEASE_EPOCH}" --reason "${reason}"\`. Do not inspect, edit, test, build, stage or commit anything yourself. The CLI owns the fenced two-phase close and rejects every diff outside .pandacorp/status.yaml.`,
    { label: 'ensure-stopped', phase: 'Baseline', model: MECH, agentType: MECH_AGENT('pandacorp:devops'), effort: MECH_EFFORT, schema: CLOSE_RECEIPT_SCHEMA })
  if (!receipt || receipt.done !== true || receipt.lease_released !== true || JSON.stringify(receipt.allowed_paths) !== JSON.stringify(['.pandacorp/status.yaml'])) throw new Error('FATAL: bounded pre-loop close returned an invalid receipt')
}

// BL-0141 (D7 extension): the pre-loop drain below (drainReadyQueuePreLoop) already guarantees this same
// running:false close-out on its OWN thrown exception — but that was the only pre-loop await wrapped this
// way. Every OTHER pre-loop await (the baseline pre-check/repair spawns, a targeted change's integration,
// the planner) had no such guarantee: an agent()-level throw there (the mech-agentType incident — the
// runtime rejected the very FIRST spawn, before any of the red/failed checks below ever ran) escaped
// uncaught, leaving `running:true` and the atomic lease held with nothing left to release it. One tiny
// wrapper, reused at each remaining pre-loop await site, so ANY exception before the scheduler loop exists
// gets the SAME guaranteed close-out as a normal failure branch.
async function preLoopGuarded(fn) {
  try {
    return await fn()
  } catch (e) {
    log('☠ pre-loop failure: ' + e.message)
    await ensureStopped('pre-loop failure: ' + e.message)
    throw e
  }
}

// ── Baseline self-heal (deadlock breaker) — WS-D/D10 two-step: cheap MECH pre-check → reconciling judge ──
phase('Baseline')
// (a) MECH PRE-CHECK: the root guard + rethink consume + owner stop signal + the clean-tree fast path — all
// cheap, no verify.sh. Only if it escalates does the expensive judge baseline run.
agentSpawned++
const precheck = await preLoopGuarded(() => agent(
  `You are the Pandacorp baseline PRE-CHECK (mechanical — cheap; do NOT run verify.sh, do NOT fix code, just return a verdict). Do these steps IN ORDER:
  **STEP L — record the launch (B1):** as your very FIRST action, emit the build-launch event so the dashboard knows this run started.${BUILD_LAUNCH_EVENT}
  **STEP 0 — deterministic root + owner-stop receipt (BL-0068):** execute exactly \`${INSPECT_STOP}\` with Node (NEVER shell \`test\`, \`[\` or an alias-sensitive builtin). If it fails, STOP and return { green: false, failure: "BL-0022: deterministic project/lease inspection failed" }. Preserve its JSON receipt. If receipt.stop is true, return { stop: true } immediately; if false, continue. Never infer stop from a command exit code.
  **STEP W — preserve gate-worktree crash evidence (BL-0067):** NEVER delete, recreate, prune, reset, clean, or force-remove ${GATE_WORKTREE}. Its contents may be the only evidence left by a crashed gate. Leave it untouched here; the lazy gate-worktree probe below will reuse it only when Git records that exact path as a worktree and its tree is clean. Any dirty, orphaned, unregistered, locked, or ambiguous state falls back to the synchronous gate without mutation.
  **STEP 1 — consume the rethink stop:** if ${PROJECT_DIR}/.pandacorp/status.yaml has \`rethink_pending: true\`, set it to \`false\` and commit that one-line change (this run STARTS from the re-planned docs, so the stop signal is consumed — DR-069).
  **STEP 2 — owner stop signal:** already decided exclusively by STEP 0's Node receipt. Do not probe it again. Do NOT delete the signal (the owner removes it).
  **STEP 3 — clean-tree fast path (BL-0066):** run \`git -C ${PROJECT_DIR} status --porcelain\` and read \`last_green_sha\` from status.yaml. Prove it exists and is an ancestor: \`git -C ${PROJECT_DIR} cat-file -e <last_green>^{commit} && git -C ${PROJECT_DIR} merge-base --is-ancestor <last_green> HEAD\`. A CLEAN tree is known-green only when EITHER (a) HEAD == last_green_sha (legacy projects), OR (b) HEAD is its DIRECT child (\`git rev-parse HEAD^\` == last_green_sha) AND \`git diff --name-only <last_green>..HEAD\` is EXACTLY \`.pandacorp/status.yaml\` (the BL-0066 metadata-only pointer commit). Then return { green: true }. Any other descendant may contain unverified work: return { escalate: true, dirty: false, dirtyPaths: [] }. **A dirty tree always escalates from here — do NOT decide any exclusion yourself, even if the only dirty path looks like the controller's own status.yaml** — but ALWAYS also report the raw signal the engine needs to apply the narrow BL-0124 exclusion on its own: return { escalate: true, dirty: true, dirtyPaths: <every path \`git status --porcelain\` listed, project-relative, exactly as printed>, leaseValid: true } (leaseValid is true, not a fresh check — reaching this step already proves it, since STEP 0's inspect-stop just succeeded under THIS run's own token/epoch, the SAME fence BL-0079 relies on for the repair step).${STRICT_BASELINE ? ' NOTE: this run launched with args.strictBaseline — the engine will NOT apply the BL-0124 exclusion regardless of what dirtyPaths/leaseValid say, so it makes no difference to your answer; report the same honest signal.' : ''}`,
  { label: 'baseline-precheck', phase: 'Baseline', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: PRECHECK_SCHEMA },
))
if (precheck && precheck.stop === true) {
  log('⏸ owner stop signal (.pandacorp/run/stop) — el motor para limpio antes de construir (no lo borro, lo hace el owner)')
  await ensureStopped('owner stop signal')
  return { mode: MODE, builtFrds: [], blockedFrds: [], note: 'owner stop signal' }
}
let baseline
// BL-0124: the ONLY dirty path is this run's own leased .pandacorp/status.yaml write — the SAME write
// BL-0079 already forbids the repair step from restoring (the controller keeps rewriting it: running,
// lease, heartbeat). The exclusion is decided HERE, deterministically, from the pre-check's structured
// signal — never from the pre-check's own free-form escalate/green wording — so it can't silently widen:
// exactly one dirty path, exactly that path, and a lease this run already proved valid by reaching STEP 3
// at all (STEP 0's inspect-stop fences token+epoch against the CURRENT lease — the identical check
// BL-0079 relies on). args.strictBaseline (escape hatch) restores the pre-WP-04 behavior unconditionally.
const leasedStatusOnly = Array.isArray(precheck && precheck.dirtyPaths) && precheck.dirtyPaths.length === 1 && precheck.dirtyPaths[0] === '.pandacorp/status.yaml'
if (precheck && precheck.green === true) {
  baseline = { green: true }
  log('Baseline verde (fast path: árbol limpio en el snapshot verde o su pointer commit BL-0066) — no se corrió verify.sh.')
} else if (precheck && precheck.green === false && precheck.failure) {
  baseline = precheck   // BL-0022 root guard failed in the pre-check — carry its failure to the red path below
} else if (!STRICT_BASELINE && precheck && precheck.leaseValid === true && leasedStatusOnly) {
  baseline = { green: true }
  log('Baseline verde (fast path BL-0124: el único diff sucio es el status.yaml propio bajo un lease ya probado válido) — no se corrió verify.sh.')
} else {
  // (b) ESCALATE → the judge baseline: DR-067 reconciliation (the SKILL promised it; the prompt never had it)
  // for a dirty/off-green tree, THEN verify.sh. Keeps the BL-0022 fail path defensively.
  agentSpawned += COST(P.judge)   // DR-070/DR-073: weight EVERY spawn by model cost so the maxAgents brake is a token-proxy
  baseline = await preLoopGuarded(() => agent(
    `You are the Pandacorp baseline-repair engineer (DR-067 reconciliation + verify). The cheap pre-check found the tree DIRTY or HEAD beyond the certified last_green snapshot/pointer pair${precheck && precheck.dirty ? ' (tree is dirty)' : ''}.
    **STEP 0 — FAIL-LOUD project-root guard (BL-0022/BL-0068):** execute exactly \`${INSPECT_STOP}\`; if it fails, return { green: false, failure: "BL-0022: deterministic project/lease inspection failed" } and do nothing else. NEVER use shell \`test\` or \`[\` for this guard.
    **STEP 1 — DR-067 RECONCILIATION (only if the tree is dirty/conflicted):** read \`last_green_sha\` from status.yaml. The valid active fence makes \`.pandacorp/status.yaml\` controller-owned: NEVER checkout or restore \`.pandacorp/status.yaml\`; renew/sync-rollups deterministically re-derive its active projection from the fenced lease. If the working tree has other uncommitted/conflicted changes (unmerged paths or \`<<<<<<<\` markers — a kill or app-restart left a run mid-write), RESTORE only those other tracked MODIFIED files to the last green: \`git checkout <last_green_sha> -- <those modified tracked files except .pandacorp/status.yaml>\` (surgical — NEVER \`git reset --hard\` the whole tree, which would discard verified work). Drop stale build stashes: inspect \`git stash list\` and drop entries that are leftover build stashes (DR-067 — never stash-pop across a moved tree). Remove leftover temp preview pages: any \`preview-wo*\` scratch page/route the build created. Leave legitimate untracked owner state (\`.pandacorp/\`, etc.) untouched.
    **STEP 2 —${GATE_SKIP} THEN run \`bash ${PROJECT_DIR}/.pandacorp/verify.sh\`:**
    - GREEN → return { green: true }, change nothing further.
    - RED → fix the PRODUCTION code (never weaken/skip tests) until it passes end-to-end, commit (Conventional Commits with scope), return { green: true }. (A route quarantined above is NOT yours to fix — it waits on the owner; do not touch it.)
    If you genuinely can't, return { green: false, failure } describing what remains.${NOTIFY('Baseline roto y no se pudo reparar — necesita tu intervencion')}`,
    { label: 'baseline', phase: 'Baseline', model: P.judge, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA },
  ))
}
if (!baseline || baseline.green !== true) {
  log(`Baseline red and auto-repair failed${baseline?.failure ? ': ' + baseline.failure : ''} — stopping for the owner.`)
  await ensureStopped('baseline red')
  return { mode: MODE, builtFrds: [], blockedFrds: ['baseline'], blockedReasons: { baseline: 'error' }, note: 'baseline red (needs manual fix)' }
}
log('Baseline green — planning by FRD.')

// ── Process Change (targeted change build + the DR-069 safe-point drain) ──────
// Integrate ONE queued change via the iterate/bug engine (creates/updates FRDs + WOs). Used by the
// targeted change build (args.change) AND by the in-loop safe-point drain. The change is NOT archived
// here — the engine archives it at close-out once its affected FRDs actually VERIFIED (DR-069 §7,
// audit-20 P0-3: the old "the FRD gate archives it" was fiction — the gate prompt never did).
const integratedChanges = []   // { file, frds } — every change this run integrated; archived at close-out when its FRDs verify
const drainedThisRun = new Set()   // WS-D/D9: slugs the safe-point drain already integrated THIS run — a backstop so a
// change whose `building` stamp failed to land can't be re-drained in a loop (each safe point re-lists the queue)
async function processChange(slug, phaseTitle) {
  agentSpawned += COST(P.judge)
  const proc = await agent(
    `You are integrating a specific pending change into the build (DR-069).

1. Find the change file .pandacorp/inbox/changes/${slug}.md — the exact filename, the extension is always .md. If the file does not exist, list .pandacorp/inbox/changes/*.md and return { done: false, affectedFrds: [], failure: "no existe .pandacorp/inbox/changes/${slug}.md — archivos disponibles: <list>" }.
2. Read its frontmatter. If status is "draft", return { done: false, affectedFrds: [], failure: "la change está en borrador — márcala ready primero" }. If status is "needs-owner" or "structural", return { done: false, affectedFrds: [], failure: "esta change requiere decisión del owner antes de construirla" }. Only proceed if status is "ready".
3. Read its type and full description.
4. Route by type:
   - type "bug" or "regression" → TDD fix: write a RED regression test (fails without the fix, passes with it); implement the minimum production-code fix; never weaken or skip tests. Create a WO in the affected FRD (or create a minimal FRD if none exists) and set it IN_REVIEW.
   - type "feature" | "change" | "improvement" | "chore" → minimum FRD scope: does this fit an existing FRD? Add a WO to it with implementation_status: PLANNED. Is it genuinely new? Create a minimal new FRD folder (docs/frds/frd-NN-<slug>/) with frd.md + blueprint.md + at least one work-orders/wo-NN-001-*.md with implementation_status: PLANNED. Follow the same FRD/WO structure as existing ones in docs/frds/.
5. Mark the change IN-FLIGHT so it is (a) not re-drained by a later safe point and (b) archivable ACROSS runs: set its frontmatter \`status: building\` and \`affected_frds: [the FRD folders you created/updated above]\`. Do NOT archive it and do NOT set it done — the ENGINE moves it to done/ once ALL its \`affected_frds\` are VERIFIED, reading that from the FRD rollups on disk at close-out (DR-069 §7). This durable stamp is what lets a change whose FRDs finish verifying on a LATER run still get archived (WS-A/D1 — the old in-session ledger silently lost those). Commit this frontmatter edit.
6. Return { done: true, affectedFrds: ['frd-XX-slug', ...], changeFile: '<the matched filename>' }.${NOTIFY('Procesando change ' + slug)}`,
    { label: `process-change:${slug}`, phase: phaseTitle, model: P.judge, agentType: 'pandacorp:implementer', schema: PROCESS_CHANGE_SCHEMA },
  )
  if (proc && proc.done === true && proc.affectedFrds && proc.affectedFrds.length) {
    integratedChanges.push({ file: proc.changeFile || `${slug}.md`, frds: proc.affectedFrds })
  }
  return proc
}
if (CHANGE) {
  phase('Process Change')
  const proc = await preLoopGuarded(() => processChange(CHANGE, 'Process Change'))
  if (!proc || !proc.done || !proc.affectedFrds || !proc.affectedFrds.length) {
    log(`⊘ No se pudo procesar la change '${CHANGE}': ${proc?.failure || 'no se encontró o no tiene FRDs afectados'}.`)
    await ensureStopped('change not processed')   // WS-D/D3
    return { mode: MODE, builtFrds: [], blockedFrds: [], note: `change '${CHANGE}' no procesada: ${proc?.failure || 'sin FRDs'}` }
  }
  ONLY = proc.affectedFrds
  log(`Change '${proc.changeFile || CHANGE}' procesada — FRDs afectados: ${ONLY.join(', ')}`)
}

// ── Plan: read FRDs, their Build Plans and the frontmatter state (no inferred "done") ──
// BL-0129: wrapped in a function (was a single inline `const plan = await agent(...)`) so the SAME
// agent/prompt/schema can be re-run after a pre-loop queue drain (drainReadyQueuePreLoop below) without
// duplicating this prose — the prompt itself is unchanged byte-for-byte from before this refactor.
async function runPlanner(label) {
  agentSpawned += COST(P.judge)   // DR-070/DR-073: weighted — the planner runs on the judge model
  return await agent(
    `You are the Pandacorp build planner. Read state WITHOUT modifying anything:
  - WALK every FRD module docs/frds/*/. For each, read frd.md and blueprint.md's **Build Plan** (WO order, intra-FRD deps, parallelism, cross-FRD deps) in full, and the **frontmatter ONLY** of every work-orders/wo-*.md (the \`implementation_status\`, \`id\`, deps, title, **\`difficulty\`** (low|medium|high, default medium) and **\`reopen_count\`** (number, default 0) — NOT the full WO body; the implementer reads the body when it builds its own WO, so planning stays fast and cheap).
  - For each work order, the **frontmatter \`implementation_status\` is the source of truth**: PLANNED/IN_PROGRESS = pending; IN_REVIEW = built, awaiting its FRD gate; VERIFIED = done (NEVER rebuild); BLOCKED = skip.
  - docs/product/architecture.md → the platform stack.
  - **FOUNDATION (DR-057, web only): read docs/design/components.md** (the shared-component inventory) and skim every FRD's \`mocks/\`/\`fdd.md\` to grasp the COMPLETE set of shared primitives the surfaces reference. The foundation work orders must build the UNION of those primitives — not a hand-picked subset (the gap that shipped flat Party surfaces: Room/AgentSprite/etc. were never in the foundation). Mark \`foundation: true\` on EVERY WO that builds a shared primitive the inventory lists, so the engine builds them all before surfaces fan out.
  Return the FRDs that still have non-VERIFIED work orders, **in cross-FRD dependency order** (from the Build Plans). For each FRD: its \`frd\` folder, its \`deps\` (FRD folders that must be VERIFIED first), and its \`workOrders\` (each with id, frontmatter \`status\`, **\`path\` (the WO file's repo-relative path — DR-108, the builder opens THE file instead of hunting)**, **\`acText\` (DR-108 CONTEXT PACK — copy VERBATIM from frd.md the EARS acceptance-criteria lines THIS work order owns per the Build Plan; bounded to its own ACs, never the whole FRD. You are the ONLY agent that reads frd.md in full — this hand-off is what lets each builder construct against the real AC scope on the FIRST attempt instead of a one-line summary)**, intra-FRD \`deps\`, one-line \`summary\`, **\`difficulty\` (low|medium|high — COPY it from the WO's \`difficulty:\` frontmatter; default \`medium\` when absent — DR-073: \`high\` builds on opus a-priori)**, **\`reopen_count\` (number — COPY it from the WO's \`reopen_count:\` frontmatter; default \`0\` when absent — DR-073: \`>=1\` builds on opus empirically)**, **its \`artifacts\` = the file/dir globs it writes, COPIED FROM the WO's \`artifacts:\` frontmatter — REQUIRED so the engine keeps parallel WOs disjoint (DR-060); if a WO has none in frontmatter, infer the files it will write from its title/summary**, and **\`foundation: true\` if this WO builds a shared design-system primitive / the inventory the other WOs reuse — DR-057, it must build before they fan out**, and **\`priorAttempts\` (A4 CROSS-PASS LEARNING) — if \`${JOURNAL_PATH}\` EXISTS, read it and, for EACH WO, synthesize a BOUNDED digest (the last 2 relevant entries) of what earlier attempts tried and why they did not hold: \`[{ attempt, classification, findingKey, tried, why }]\` drawn from that WO's attempt/verdict/diagnosis lines. Return \`[]\` (or omit) when the journal is absent or has no entries for the WO — it is fed to the builder as HYPOTHESES to verify against the CURRENT code, never as gospel**) **in the Build Plan's order**.${ONLY ? ' Limit to these FRD folders: ' + ONLY.join(', ') + '.' : ''}
  hasFrontend=true only if the stack is web (A).${ONLY ? ` TARGETED BUILD — also check cross-FRD deps of the requested FRDs: for each dep folder listed in their Build Plans, read the frontmatter \`implementation_status\` of every work-orders/wo-*.md in that dep. If ALL are VERIFIED the dep is satisfied; if ANY is not VERIFIED, include it in unsatisfiedDeps as { frd: '<requested-frd>', dep: '<the-dep-folder>' }. Return unsatisfiedDeps:[] when all deps are satisfied.` : ''}`,
    { label, phase: 'Plan', schema: PLAN_SCHEMA, model: P.judge, agentType: 'pandacorp:architect' },
  )
}
phase('Plan')
let plan = await preLoopGuarded(() => runPlanner('plan'))
// WS-D/D3: SPLIT the old single guard. A null/garbled planner verdict (agent died / no `frds` array) is
// NOT "all verified" — reading it that way silently declared a project done. Fail LOUD with a distinct
// note. Only a REAL empty `frds` array (the planner ran and found nothing pending) is all-verified.
if (!plan || !plan.frds) {
  log('planner returned no verdict — fail-loud (NOT treating a dead/garbled plan as "all verified")')
  await ensureStopped('planner failed')
  return { mode: MODE, builtFrds: [], blockedFrds: ['plan'], blockedReasons: { plan: 'error' }, note: 'planner failed' }
}
if (plan.frds.length === 0) {
  // BL-0129: a BARE run (never a TARGETED one — that scope stays forbidden, unchanged) whose planner
  // found nothing pending used to exit here immediately, so the DR-069 ready-changes queue was never
  // drained (safePoint() below only runs inside the main loop, which this path never reaches). Drain
  // ONCE before declaring "nothing to build"; if it surfaces real work, re-plan and fall through into
  // the normal loop with it instead of reporting a false "all verified".
  if (!TARGETED && DRAIN_ON_EMPTY_PLAN) {
    // REV2-6: drainReadyQueuePreLoop() runs BEFORE the scheduler loop exists, so it has no equivalent of
    // the loop's own WS-D/D2 try/catch boundary — an invalid fenced receipt (or a lease-renewal failure)
    // inside it used to throw straight out of this function with running:true still in status.yaml (a
    // phantom-running build). Guarantee the SAME running:false close-out WS-D/D2 gives the in-loop path,
    // then rethrow so the caller still sees the failure loud.
    let drain
    try { drain = await drainReadyQueuePreLoop() } catch (e) { log('☠ pre-loop drain failed: ' + e.message); await ensureStopped('pre-loop drain failed'); throw e }
    if (drain.stop) {
      await ensureStopped('owner stop signal')
      return { mode: MODE, builtFrds: [], blockedFrds: [], note: 'owner stop signal' }
    }
    if (drain.drained) {
      log('Cola de changes drenada antes del plan vacío (BL-0129) — replanificando con el trabajo recién creado.')
      plan = await preLoopGuarded(() => runPlanner('plan-post-drain'))
      if (!plan || !plan.frds) {
        log('planner returned no verdict after the pre-loop drain — fail-loud (NOT treating a dead/garbled plan as "all verified")')
        await ensureStopped('planner failed')
        return { mode: MODE, builtFrds: [], blockedFrds: ['plan'], blockedReasons: { plan: 'error' }, note: 'planner failed' }
      }
    }
  }
  if (plan.frds.length === 0) {
    log('Nothing to build: every FRD is VERIFIED and the change queue is empty — cola vacía (BL-0129: checked, not skipped).')
    await ensureStopped('nothing to build')
    return { mode: MODE, builtFrds: [], blockedFrds: [], note: 'all verified' }
  }
}

// Dep-satisfaction gate (targeted build only) — refuse to start if the requested FRDs have deps that are not VERIFIED.
if (ONLY && plan.unsatisfiedDeps && plan.unsatisfiedDeps.length > 0) {
  const byFrd = {}
  for (const { frd, dep } of plan.unsatisfiedDeps) {
    if (!byFrd[frd]) byFrd[frd] = []
    byFrd[frd].push(dep)
  }
  const detail = Object.entries(byFrd).map(([f, deps]) => `${f} requiere: ${deps.join(', ')}`).join('; ')
  log(`⊘ Build parcial bloqueado — hay dependencias sin VERIFIED: ${detail}. Implementa primero esos FRDs (o corre /pandacorp:implement sin filtro para el orden automático).`)
  await ensureStopped('unsatisfied deps')   // WS-D/D3
  return { mode: MODE, builtFrds: [], blockedFrds: ONLY, blockedReasons: Object.fromEntries(ONLY.map((f) => [f, 'needs-owner'])), note: `deps sin verificar — ${detail}` }
}
log(`${plan.frds.length} FRDs with pending work · stack ${plan.stack}${plan.hasFrontend ? ' (web)' : ''}`)

// Design fidelity (DR-054/056): the engine PASSES the design references into the build prompt.
// It used to pass only a one-line summary, so the implementer NEVER saw the design — the root cause
// of a build diverging from an approved prototype. For a web build, inject the binding visual refs
// + the in-loop fidelity check into every UI work order's prompt (the agent reads the files itself).
const designRef = (frd) => plan.hasFrontend
  ? ` VISUAL FIDELITY (DR-054/056, web — do NOT skip): OPEN this work order's \`## Visual reference\`, then read \`docs/frds/${frd}/fdd.md\` + its \`mocks/\` (the BINDING screen mock — view the screenshot AND the mock's source) and \`docs/design/design-tokens.json\` + root \`DESIGN.md\`. Your job is to TRANSLATE that one screen's mock into the project's components on the frozen tokens — reproduce its layout, structure, spacing, components and density; do NOT approximate, invent, or restyle. THEN run a SINGLE LIGHT in-loop fidelity check BEFORE marking IN_REVIEW (DR-072 — keep it cheap; the thorough pass is at the end): render the route ONCE (preview/Playwright), screenshot it next to the mock, and fix ONLY a GROSS structural divergence (wrong layout, a missing section) — do NOT iterate on nits (exact sizes/spacing/shades): the dedicated end-of-build Visual QA pass owns fine fidelity, so don't pay that loop twice. Aim for a RECOGNIZABLE, faithful match (right layout, structure, components, density), NOT pixel-perfection. The FRD gate blocks only a GROSS structural mismatch (a flat list where the mock is a rich layout, a missing section); small nits (exact sizes/spacing/shades) are swept later by the end-of-build Visual QA pass + the owner (DR-072) — so get it recognizably right and move on, don't burn cycles chasing the last pixel.`
  : ''

// Reuse & coherence (DR-057): parallel agents reinvent slightly-different versions of the same
// component when they can't see what already exists (the two-near-identical-banners bug). Inject the
// component-inventory "check before you create" directive so each agent reuses the shared primitives.
const reuseRef = (frd) => plan.hasFrontend
  ? ` REUSE & COHERENCE (DR-057): before creating ANY UI component, READ the component inventory \`docs/design/components.md\` (if it doesn't exist yet you're early in the build — create it and list your component as the first row) and scan \`src/components/core\` + \`src/components/modules\`. REUSE an existing component if one fits; ADAPT/extend it (add a prop/variant) if it is close — do NOT fork a near-duplicate for a small difference; CREATE a new shared component only if none fits, and when you do, APPEND it to \`docs/design/components.md\` so the next agent reuses it. A component that re-implements an existing pattern (a second banner/card/modal) is a defect the gate rejects.`
  : ''

// Sync derived rollups through the sole fenced writer before building. WP-03 fusion (i), MECH_LEAN only:
// folded into the FIRST wave's `dispatch` call below (one agent, the sync-rollups command THEN the
// IN_PROGRESS stamp, same order as this standalone spawn used to run before dispatch) — `pendingSyncRollups`
// carries the fragment across to that call site and is consumed exactly once. args.mechLean:false keeps
// this its own Plan-phase spawn, unchanged.
let pendingSyncRollups = null
if (MECH_LEAN) {
  pendingSyncRollups = SYNC_ROLLUPS + ' Stage only the rollup documents and .pandacorp/status.yaml changed by the command, then commit them together (Conventional Commits, scope). THEN, as a SEPARATE step (do not commit this part — see below):\n  '
} else {
  agentSpawned++
  await agent(SYNC_ROLLUPS + ' Stage only the rollup documents and .pandacorp/status.yaml changed by the command, then commit them together (Conventional Commits, scope).',
    { label: 'sync-rollups', phase: 'Plan', model: MECH, agentType: 'pandacorp:implementer' })
}

// ── Adaptive model selection (DR-073) — escalate to opus within the mode, never below the floor ──
// The mode's P.worker is the FLOOR. Escalate to opus when the WO is genuinely hard (HYBRID a-priori,
// owner decision: difficulty=high) OR has already failed once (empirical: reopen_count>=1 — a sonnet
// build that didn't pass is unlikely to pass again, so raise the model for the retry). Never downgrade.
function pickWorkerModel(wo) {
  if (P.worker === 'opus') return 'opus'                       // already at the ceiling (deep mode)
  if (wo.difficulty === 'high') return 'opus'                  // HYBRID a-priori (DR-073, owner decision)
  if ((wo.reopen_count || 0) >= 1) return 'opus'              // empirical — it already failed once
  return P.worker
}

// ── Finer save points (DR-086, owner): commit each WO the INSTANT its self-test greens ──
// Not batched at wave end. So an interruption keeps every already-green WO and only the
// still-building ones rebuild (a mid-wave cut used to lose the WHOLE wave — up to P.wave WOs).
// ONE git writer at a time, serialized through this promise chain, so committing a WO while sibling
// WOs of the SAME wave are still building causes NO index.lock race (the invariant Option B/DR-060
// protects); the selective `git add` of the WO's DISJOINT `artifacts` (+ its own work-order .md) can
// never capture a sibling's in-flight files. The resume path is unchanged: a committed WO is IN_REVIEW
// → skipped on relaunch (never rebuilt); only PLANNED/IN_PROGRESS (uncommitted) work is redone.
let commitChain = Promise.resolve()
// WP-03 fusion (ii) support: the sha of the LAST commit that actually landed via commitWOGreen — reset
// per wave (see the Build-phase loop below), read by capturePin so a wave that already committed doesn't
// need its own `pin:` spawn to learn what it already knows. Populated from the commit agent's OWN report
// (git-truth from the SAME serialized writer, not re-derived), never guessed.
let lastCommitSha = null
// WP-03 fusion (iii): the commit prompt's TWO fire-and-forget printf appends (the durable track.jsonl
// timeline line + the dashboard wo_commit event) run as ONE bash call instead of two — same two lines,
// one fewer round trip for the mech writer. Neither depends on the git commit already existing (both just
// announce facts already true — the WO's frontmatter state, this wave's timing), so firing them together
// right before the commit (instead of straddling it) is safe.
const TRACK_AND_WO_COMMIT = (frd, woId) =>
  ` Also, in a SINGLE bash call (one heredoc covering both printfs, not two separate commands), append BOTH fire-and-forget lines: (1) to ${TRACK_PATH} — the durable timeline wo_end line: \`printf '{"kind":"wo_end","frd":"${frd}","wo":"${woId}","state":"in_review","at":"%s"}\\n' "$(date -u +%FT%TZ)" >> ${TRACK_PATH}\`; (2) to ~/.claude/dashboard-events.ndjson — the Party wo_commit event: \`printf '{"event":"wo_commit","at":"%s","project":"%s","frd":"${frd}","wo":"${woId}","state":"IN_REVIEW"}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson\`.`
async function commitWOGreen(wo, frd) {
  agentSpawned++
  const link = commitChain.then(() =>
    agent(
      `You are the SOLE git writer at this instant (serialized — no other commit runs concurrently, so there is NO index.lock race), committing work order ${wo.id} now that its self-test is green and its frontmatter is IN_REVIEW.${TRACK_AND_WO_COMMIT(frd, wo.id)} Then make exactly ONE commit (Conventional Commits, with scope) staging ONLY this work order's own files: its declared artifacts ${wo.artifacts && wo.artifacts.length ? '(' + wo.artifacts.join(' ') + ')' : "(use `git status` to identify THIS wo's files)"} AND its own work-order markdown under \`docs/frds/${frd}/work-orders/\` (the IN_REVIEW frontmatter + ## Status Note) AND \`.pandacorp/track.jsonl\` (the durable timeline lines for THIS wo — the wo_start the builder appended + the wo_end you just appended) AND \`.pandacorp/build-journal.jsonl\` if it changed (append-only, shared — like track.jsonl; sweeps any pending build-journal lines a retry builder appended). Sibling work orders of the same wave may be MID-BUILD — do NOT stage or touch their files; if \`git status\` shows changes outside this WO's files (other than track.jsonl / build-journal.jsonl, which are append-only and shared), leave them untouched. Do NOT advance last_green_sha (that is the FRD gate's job — this WO is self-test-green, not yet review-verified). THEN return the sha of the commit you just made (\`git rev-parse --short HEAD\`). Return { committed: 1, sha: "<that short sha>" }.`,
      { label: `commit:${wo.id}`, phase: 'Build', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: { type: 'object', required: ['committed'], properties: { committed: { type: 'number' }, sha: { type: 'string' } } } },
    ),
  )
  commitChain = link.catch(() => {}) // keep the chain alive even if one commit errors
  // WS-D/D1: a commit failure must NOT reject the wave (Promise.all would reject the whole parallel wave).
  // Resolve to a boolean the caller acts on: a green-but-UNCOMMITTED WO is routed into its FRD's repair
  // path (same as a self-test failure), never silently treated as done. REV2-2: a verdict that reports
  // committed:0 (nothing to commit — the mech writer dutifully returning HEAD's sha anyway) must NOT seed
  // capturePin's fast path with an unverified sha; only a sha from an ACTUAL landed commit is trustworthy.
  // (The `return true` below on committed:0 is a separate, preexisting, out-of-scope behavior — the caller
  // still treats it as "done", not routed to repair; left unchanged here.)
  return link.then((r) => { if (r && r.sha && Number(r.committed) > 0) lastCommitSha = r.sha; return true }, (e) => { log(`commit failed for ${wo.id}: ${(e && e.message) || e}`); return false })
}

// ── Build ONE work order: implement → fast self-test → IN_REVIEW + hand-off → commit-when-green ──
// DR-108 context pack: the planner (the ONE agent that reads frd.md in full) hands each builder its
// WO file path + the verbatim AC lines it owns, injected into the prompt — instead of N builders each
// re-hunting the docs and still constructing against a one-line summary (first-attempt gate failures
// were the top rework cost of the personal-page-v2 run). The builder still reads its own WO body.
// A4 CROSS-PASS LEARNING: earlier attempts on THIS WO (from the build-journal, threaded by the planner)
// are injected as HYPOTHESES TO VERIFY against the current code — not gospel, never blindly repeated.
const priorAttemptsCtx = (wo) => (wo.priorAttempts && wo.priorAttempts.length)
  ? ` PRIOR ATTEMPTS ON THIS WORK ORDER (from the build-journal — they MAY be wrong; treat each as a HYPOTHESIS to verify, and re-diagnose against the CURRENT code, do NOT blindly repeat or trust them): ${wo.priorAttempts.map((a) => `[attempt ${a.attempt ?? '?'}: ${a.classification || 'point'}${a.findingKey ? ' · ' + a.findingKey : ''} · tried: ${a.tried || '?'} · why it didn't hold: ${a.why || '?'}]`).join(' ')}`
  : ''
// A3: the in-run retry threads the last failed patch's DIAGNOSIS into the rebuild so it isn't blind.
const priorDiagnosisCtx = (wo) => wo._priorDiagnosis
  ? ` DIAGNOSIS FROM THE LAST FAILED PATCH (A3 — a hypothesis to VERIFY against the CURRENT code, not gospel): classification=${wo._priorDiagnosis.classification || 'point'}; seam=${wo._priorDiagnosis.seam ? ((wo._priorDiagnosis.seam.files || []).join(', ') + (wo._priorDiagnosis.seam.symbol ? ' @ ' + wo._priorDiagnosis.seam.symbol : '')) : 'n/a'}${wo._priorDiagnosis.seam && wo._priorDiagnosis.seam.why ? ' — ' + wo._priorDiagnosis.seam.why : ''}. Rebuild focusing on that seam; if the diagnosis does not match what you see, follow the code.` : ''
const woCtx = (wo, frd) =>
  `${wo.path ? ` Your work-order file: \`${wo.path}\` — open it and follow it in full.` : ''}${wo.acText ? ` The EARS acceptance criteria THIS work order must satisfy (verbatim from FRD ${frd} — the gate will assert exactly these):\n  ${wo.acText}\n ` : ''}${priorAttemptsCtx(wo)}${priorDiagnosisCtx(wo)}`

// The SELF-TEST + hand-off contract, shared by both branches (solo: folded into the builder — DR-108;
// split: a separate closer agent, since three hands built the slice and one must close it coherently).
const SELFTEST = (woId) => ` THEN run your fast SELECTIVE self-test (NOT the whole suite): \`pnpm biome check .\`, \`pnpm tsc --noEmit\`, and \`pnpm vitest run\` limited to THIS work order's own test files. If green: set the WO's frontmatter **\`implementation_status: IN_REVIEW\`** and fill its **\`## Status Note\`** hand-off (what it built; the interfaces/contracts exposed with signatures; the integration seams; **the implicit DECISIONS & ASSUMPTIONS you made — naming, data shapes, formats, units, error/empty conventions — so the consumer inherits them instead of re-deciding incompatibly**; which test files cover it). **Do NOT call git — the engine commits THIS work order the INSTANT your self-test passes, via a serialized single writer (Option B, DR-060), so there is no index.lock race.** Return green=true. If red after honest attempts, return green=false with the reason.`

// A1 build-journal: a RETRY rebuild (the DR-107/A3 in-run retry, wo._isRetry) records a descriptive
// kind:"attempt" line — what it rebuilt, so the next attempt (this pass or a later one) can learn from
// it. TRUST SPLIT: verdict is "" (a builder can NEVER journal its own success — the gate/verifier does).
// The engine's commitWOGreen stages the build-journal, so the builder only appends (fire-and-forget).
const retryAttemptJournal = (wo, frd) => wo._isRetry
  ? JOURNAL(`"wo":"${wo.id}","frd":"${frd}","attempt":${(wo.reopen_count || 0) + 1},"reopen_count":${wo.reopen_count || 0},"rung":"retry","role":"builder","kind":"attempt","classification":"","seam":null,"findingKey":"","tried":"%s","verdict":"","why":"%s","confidence":"%s"`,
      ` "<one line: what you rebuilt/changed this retry>" "<one line: your approach vs the prior attempt>" "<low|medium|high: your confidence it now meets the AC>"`)
  : ''

async function buildWO(wo, frd) {
  const woModel = pickWorkerModel(wo)   // DR-073: opus floor-escalation, a-priori (difficulty=high) or empirical (reopen_count>=1)
  if (woModel !== P.worker) log(`⤴ opus: ${wo.id} (${wo.difficulty === 'high' ? 'difficulty=high' : 'reopen=' + (wo.reopen_count || 0)})`)
  // WP-08/D4b: the denominator of the repair budget. woWaveCost() already mirrors, exactly, the
  // agentSpawned increments the two branches below make — reuse it rather than re-deriving the sum
  // in a second place (a second derivation of the same fact is how the two drift, DR-115). FROZEN
  // after the FRD's first build wave: an in-run retry rebuild (wo._isRetry, D4b) never adds to it, or
  // the spend the brake exists to bound would inflate the very ceiling that bounds it.
  if (!wo._isRetry) buildCostByFrd.set(frd, (buildCostByFrd.get(frd) || 0) + woWaveCost(wo))
  let v
  if (P.split && plan.hasFrontend) {
    // DR-073 cost-weighting: 3 build agents at woModel + 1 worker-model closer (self-test).
    agentSpawned += 3 * COST(woModel) + 1
    // INTENTIONAL ASYMMETRY (BL-0115, owner decision 2026-09-02): test-writer stays at P.worker even when
    // the implementers below escalate to woModel/opus. Reason is DR-015 builder/verifier diversity — holding
    // the test author at the worker model is what keeps builder and verifier on DIFFERENT models exactly on
    // the hard/reopened work orders where that independence is worth the most. Do not "fix" this to match.
    await agent(`${EMIT('test-writer', wo.id, { frd, activity: 'test' })}${TRACK('wo_start', `,"frd":"${frd}","wo":"${wo.id}"`)} Write the acceptance tests (RED) for work order ${wo.id} from the EARS criteria of FRD ${frd}: ${wo.summary || ''}.${woCtx(wo, frd)} No production code.`,
      { label: `test:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:test-writer' })
    await agent(`${EMIT('backend-dev', wo.id, { frd, activity: 'backend' })}First read the \`## Status Note\` of the work orders ${wo.id} depends on (their exposed interfaces). Then implement the backend of ${wo.id} (TDD until green): ${wo.summary || ''}.${woCtx(wo, frd)} Publish YOUR API contract at docs/api/${wo.id}.md (your own per-WO file — DR-060: never a shared docs/api.md, which races across parallel WOs). Do NOT call git — you never commit; the engine commits this work order (serialized single writer) when it greens (Option B).`,
      { label: `be:${wo.id}`, phase: 'Build', model: woModel, effort: woModel === 'opus' ? 'high' : undefined, agentType: 'pandacorp:backend-dev' })
    await agent(`${EMIT('frontend-dev', wo.id, { frd, activity: 'frontend' })}Implement the UI of ${wo.id} using ONLY design tokens and the provider WO's contract at docs/api/<the-backend-WO-in-your-Dependencies>.md (DR-060: read that specific per-WO file, never a shared docs/api.md): ${wo.summary || ''}.${woCtx(wo, frd)}${designRef(frd)}${reuseRef(frd)} Do NOT call git — you never commit; the engine commits this work order when it greens (Option B).`,
      { label: `fe:${wo.id}`, phase: 'Build', model: woModel, effort: woModel === 'opus' ? 'high' : undefined, agentType: 'pandacorp:frontend-dev' })
    v = await agent(`${EMIT('implementer', wo.id, { frd, activity: 'selftest' })}Close work order ${wo.id} (built by the split team this wave).${SELFTEST(wo.id)} These are file edits to THIS WO's own files only.${retryAttemptJournal(wo, frd)}`,
      { label: `selftest:${wo.id}`, phase: 'Build', model: P.worker, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA })
  } else {
    // DR-108: the solo builder runs its OWN self-test + hand-off — the separate selftest agent was a
    // second same-model spawn per WO that re-read everything; the trust boundary was never the
    // self-test, it is the independent FRD gate (reviewer, different model), which re-verifies all of
    // it. One spawn per WO instead of two. (IN_PROGRESS is stamped by the engine at dispatch — BL-0002.)
    agentSpawned += COST(woModel)
    v = await agent(`${EMIT('implementer', wo.id, { frd, activity: 'implement' })}${TRACK('wo_start', `,"frd":"${frd}","wo":"${wo.id}"`)} Fully implement work order ${wo.id} with TDD (RED→GREEN→refactor), anchored in the EARS criteria of FRD ${frd} and in bugs from .pandacorp/comms/progress.md: ${wo.summary || ''}.${woCtx(wo, frd)} This is a COARSE slice (a whole view/capability) — build it end-to-end. First read the \`## Status Note\` of the work orders ${wo.id} depends on (their exposed interfaces) and integrate against those, not a guess. If \`.pandacorp/run/preserved-tests/${wo.id}/\` exists, RESTORE those test files into the tree first — they are proven coverage a previous revert preserved (DR-107): they are your RED baseline, make them pass.${designRef(frd)}${reuseRef(frd)}${SELFTEST(wo.id)}${retryAttemptJournal(wo, frd)}`,
      { label: `build:${wo.id}`, phase: 'Build', model: woModel, effort: woModel === 'opus' ? 'high' : undefined, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA })
  }
  const green = Boolean(v && v.green === true)
  // Finer save points (DR-086): commit THIS WO the instant it is green — serialized single writer —
  // so a mid-wave interruption keeps it (committed → IN_REVIEW → skipped on resume) instead of losing
  // the whole wave. Only still-building (uncommitted) WOs are rebuilt.
  // WS-D/D1: capture whether the commit actually LANDED — a green build whose commit failed is NOT done;
  // the wave-results handling routes it into the FRD's repair path (never adds it to doneIds).
  const committed = green ? await commitWOGreen(wo, frd) : false
  return { green, committed }
}

// A1 build-journal: the FRD gate (serial + split-close) records a kind:"verdict" line at WHICHEVER exit
// it takes (pass/reopen/blocked/fail) — the reviewer's judgement, the trust-boundary half of the split
// (constitution rule 4: a builder writes only kind:"attempt"; the reviewer writes kind:"verdict"). One
// directive covers all exits; the reviewer fills verdict/classification/findingKey for the exit it took.
const gateVerdictJournal = (frd, reviewIds, attemptNo) => JOURNAL(
  `"wo":"%s","frd":"${frd}","attempt":${attemptNo},"reopen_count":0,"rung":"gate","role":"reviewer","kind":"verdict","classification":"%s","seam":null,"findingKey":"%s","tried":"","verdict":"%s","why":"%s","confidence":"%s"`,
  ` "<the primary work order this verdict is about, else ${(reviewIds && reviewIds[0]) || frd}>" "<point|architectural|gate-test-defective|deadlocked-contract, or empty for a green/unclassified verdict>" "<\`<file>::<one-line claim>\` for a reopen/fail, else empty>" "<green if you set VERIFIED, else red>" "<one line why>" "<low|medium|high>"`)

// ── FRD gate: dispatch split (proposal 31 T1.2) vs serial (C1a serial-first) ──
// gateAndConverge() and every convergence path call frdGate() and get the SAME FRD_GATE_SCHEMA back
// whichever branch runs — the dispatch is INSIDE frdGate so the callers stay byte-for-byte unchanged.
// SPLIT runs only when: the mode enables it (P.reviewSplit) AND this is NOT the FRD's FIRST gate attempt
// this run (frdState.gateAttempts≥1) OR any reviewed WO was already reopened on a prior run (frontmatter
// reopen_count≥1) — the SERIAL-FIRST trust boundary (C1a); AND the split's estimated cost fits the remaining
// maxAgents budget (contract 5, the brake check happens BEFORE any spawn). If the split's finders all die
// mid-run it returns a sentinel and we fall back to the serial gate — the gate is NEVER skipped (contract 4).
// Every gate call bumps frdState.gateAttempts (1-based `attempt` for the gate-open event, B8) so a re-gate is
// distinguishable from a first gate.
async function frdGate(frd, reviewIds, workFrom, evidencePack) {
  // C2: `workFrom` (optional) points the REVIEW spawns at the frozen gate worktree for the CONCURRENT path;
  // undefined → the legacy main-tree cwd (used by the converge re-gates, which run on a quiesced main tree).
  // WP-06: `evidencePack` (optional) is the validated digested-evidence pack for THIS gate — supplied only
  // by the concurrent path (launchGate), which is the only caller with a frozen pin to collect from. Absent
  // (re-gates on main, the legacy synchronous path) → the gate runs in EXPLORE mode, unchanged.
  const st = frdState.get(frd)
  const priorAttempts = (st && st.gateAttempts) || 0   // gate attempts ALREADY made for this FRD this run
  const attemptNo = priorAttempts + 1                  // 1-based attempt number for THIS gate (B8)
  if (st) st.gateAttempts = attemptNo
  // C1a serial-first: the reviewed WO objects carry reopen_count (from the plan/frontmatter, already enrolled).
  const reviewedWos = st ? st.f.workOrders.filter((w) => reviewIds.includes(w.id)) : []
  const anyReopened = reviewedWos.some((w) => (w.reopen_count || 0) >= 1)
  const useSplit = P.reviewSplit && (priorAttempts >= 1 || anyReopened)   // first gates run SERIAL (DR-100: ~80% pass or need a ≤6-min fix)
  if (useSplit) {
    const remaining = MAX_AGENTS ? MAX_AGENTS - agentSpawned : Infinity
    if (remaining >= splitGateEstimatedCost()) {
      const split = await frdGateSplit(frd, reviewIds, attemptNo, workFrom, evidencePack)
      if (!split || !split.__splitFailed) return enforceWholeFrdTraceability(split)   // sentinel __splitFailed → all finders died → fall to serial
    } else {
      log(`↩ ${frd}: reviewSplit on but the split's estimated cost (${splitGateEstimatedCost()}) exceeds the remaining agent budget (${remaining}) — using the serial gate instead (contract 5)`)
    }
  } else if (P.reviewSplit) {
    log(`▹ ${frd}: first gate attempt this run — running SERIAL (split kicks in on a re-gate or a prior-reopened WO, C1a)`)
  }
  return enforceWholeFrdTraceability(await frdGateSerial(frd, reviewIds, attemptNo, workFrom, evidencePack))
}

// ── C2 REVIEW-ONLY gate contract (shared by serial + split) ───────────────────────────────────────
// The gate is now REVIEW-ONLY: it reviews with full rigor, writes its adversarial test files (in its cwd —
// the worktree for the concurrent path), runs verify.sh --since, and RETURNS a verdict. It NEVER stamps
// VERIFIED, recomputes rollups, edits status.yaml, advances last_green_sha, or commits — a separate
// SERIALIZED apply-gate step on the MAIN tree owns every commit-bearing write (so the gate can run on a
// frozen worktree while the build keeps moving). It STILL emits the absolute-path, git-free events/track
// lines on the reject exits (worktree-safe). On PASS it returns { green:true, testFiles:[...] } and does
// nothing else; apply-gate ports the test files and stamps. On the non-progress cap it CLASSIFIES the block
// but does NOT persist it (persistGateBlock does that on main).
const GATE_PASS_RETURN = ` **If CORRECTION passes (visual nits, if any, APPEND to the punch-list at the MAIN tree \`${PROJECT_DIR}/.pandacorp/comms/visual-punch-list.md\` — absolute path, they do NOT block):** you are a REVIEW-ONLY gate — do NOT set any work order VERIFIED, do NOT reset reopen_count, do NOT recompute the FRD rollup, do NOT edit .pandacorp/status.yaml, do NOT advance last_green_sha, and do NOT \`git commit\` (you may be running in a FROZEN worktree; a separate serialized apply step on the MAIN tree performs every one of those writes). Just make sure the adversarial test files you wrote this cycle are SAVED in your working tree, and return { green: true, testFiles: [the repo-relative path of EACH new or changed test file you wrote this gate] } so the apply step can port them to the main tree.`

// ── WP-06: DIGESTED GATE EVIDENCE ────────────────────────────────────────────────────────────────
// The per-FRD gate is the build's ONE independent oracle, and FRD-24 measured where its money goes: the
// opus reviewer spends most of its 99 calls / 54 tool-calls / 93.7k-context-per-call COLLECTING evidence
// (walking the tree, running `verify.sh --since` inside its own loop, parsing the raw log); the verdict
// itself is the cheap part. WP-06 moves that collection to a cheap MECH agent running in the SAME pinned
// worktree and hands the reviewer a PACK. The oracle's authority is untouched: same opus judge, same
// effort, same adversarial tests (DR-080), same 7-class traceability inventory, same reject/blocked exits.
// Only the INPUT changes — and only when the owner asks (args.gateEvidence: 'digested'; default 'explore').
//
// WHERE IT RUNS (the choice this package asked us to justify): the collector needs (a) the pin sha and
// (b) the wave's commits to exist, and BOTH only exist after the wave barrier — capturePin() runs at the
// close of the wave, on the post-wave HEAD. There is therefore NO honest point "in parallel with the last
// WO of the wave": evidence gathered before those commits land would describe a tree that does not
// contain the work under review — exactly the stale-oracle defect this package must not create. So it is
// launched AT WAVE CLOSE, immediately after capturePin(), as a background PROMISE chained on the
// gate-worktree mutex. That still buys the overlap: the collector occupies the worktree while the main
// loop runs its safe point and dispatches the NEXT build wave, and the gate — which chains behind it on
// the same mutex — finds the worktree already pinned (ensureGateWorktree is idempotent: no extra spawn).
const EVIDENCE_MARKER = 'YOUR EVIDENCE IS ALREADY COLLECTED'
const EVIDENCE_READ_BUDGET = 8          // additional file reads a digested gate may spend before it must answer
const EVIDENCE_DIFF_MAX_LINES = 1500    // size cap on the unified diff carried into the prompt; over it → stat + clipped largest files, LABELLED truncated

// Fail-closed validation of a collector verdict. A pack is usable ONLY if it is an object whose `report`
// parses as JSON and carries a BOOLEAN `green`. Anything else (null verdict, garbled JSON, `green: "yes"`)
// returns a reason and the gate degrades to explore — a malformed digest is strictly worse than none,
// because the reviewer would treat it as authoritative.
function validateEvidence(pack) {
  if (!pack || typeof pack !== 'object') return { evidence: null, fallbackReason: 'collector returned no verdict' }
  if (typeof pack.report !== 'string' || !pack.report.trim()) return { evidence: null, fallbackReason: 'gate-report.json missing from the pack' }
  let parsed
  try { parsed = JSON.parse(pack.report) } catch { return { evidence: null, fallbackReason: 'gate-report.json is not valid JSON' } }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.green !== 'boolean') return { evidence: null, fallbackReason: 'gate-report.json has no boolean green' }
  return { evidence: pack, fallbackReason: '' }
}

// The reviewed work orders' declared artifact globs — what the unified diff is scoped to (the same DR-060
// `artifacts:` frontmatter the wave scheduler already trusts to prove disjointness).
function reviewedArtifacts(frd, reviewIds) {
  const st = frdState.get(frd)
  const reviewed = st ? st.f.workOrders.filter((w) => reviewIds.includes(w.id)) : []
  return [...new Set(reviewed.flatMap((w) => w.artifacts || []).filter(Boolean))]
}
// The planner already extracted each WO's owning EARS criteria VERBATIM from frd.md (the DR-108 context
// pack) — reuse it instead of paying a second extraction. The collector only COMPLETES it from frd.md if
// the FRD carries normative acceptance criteria the planner threaded onto no single work order.
function reviewedAcText(frd, reviewIds) {
  const st = frdState.get(frd)
  const reviewed = st ? st.f.workOrders.filter((w) => reviewIds.includes(w.id)) : []
  return reviewed.map((w) => w.acText).filter(Boolean).join('\n  ')
}

// The collector itself: a MECH, effort:'low', zero-judgment agent. It runs commands and pastes their
// output. It NEVER reviews, NEVER writes a file, NEVER commits, NEVER touches frontmatter — it is not a
// second opinion, so it cannot dilute the trust boundary (DR-015: the judge remains the only judge).
async function collectGateEvidence(frd, reviewIds, pinSha) {
  const artifacts = reviewedArtifacts(frd, reviewIds)
  const acText = reviewedAcText(frd, reviewIds)
  const scope = artifacts.length
    ? `-- ${artifacts.join(' ')} (the reviewed work orders' declared artifacts)`
    : '(the reviewed work orders declare no artifacts — do NOT scope by path; take the whole diff and let the line cap clip it)'
  agentSpawned++
  return await agent(`WP-06 GATE EVIDENCE COLLECTOR for ${frd}. You are NOT the reviewer: you judge NOTHING, you fix NOTHING, you decide NOTHING. Your entire job is to run the commands below in this frozen worktree and return their output VERBATIM, so the reviewer that runs after you does not have to re-derive it. **Write no file, edit no frontmatter, run no mutating git command, never \`git commit\`, never touch the main tree.**
  1) Read \`last_green_sha\` from .pandacorp/status.yaml (call it PIN_BASE) and run the gate script exactly once: \`bash .pandacorp/verify.sh --since <PIN_BASE> --report-all\` (that argument ORDER is required — \`--since\` is positional). It may exit non-zero; that is FINE and expected — it is data, not a problem for you to fix. Then read \`.pandacorp/run/gate-report.json\`, which that run always writes, and return its **entire contents as a string**, byte-for-byte, in \`report\`. Do NOT summarise it, do NOT reformat it, do NOT drop \`failures[]\` rows however many there are. If the file is missing after the run, say so in \`report\` — the engine detects the malformed pack and falls back.
  2) \`git diff <PIN_BASE>..${pinSha} --stat\` → return it verbatim in \`diffStat\`.
  3) \`git diff <PIN_BASE>..${pinSha} ${scope}\` → return it in \`diff\`. **Hard cap ${EVIDENCE_DIFF_MAX_LINES} lines.** If the full patch is longer, do NOT silently cut it: include the largest files first, clip each at a hunk boundary, add a \`… <N> lines clipped from <path>\` marker where you clipped, and set \`truncated: true\`. Under the cap → the complete patch and \`truncated: false\`.
  4) \`ac\`: this FRD's EARS acceptance criteria, VERBATIM. The build plan already extracted the criteria these work orders own — start from exactly this text and return it unchanged${acText ? `:\n  ${acText}\n  ` : ` (the plan threaded none, so read docs/frds/${frd}/frd.md and copy its acceptance criteria verbatim). `}Only ADD to it: if docs/frds/${frd}/frd.md carries numbered acceptance criteria this list is missing, append those verbatim too. Never paraphrase, never renumber, never drop one.
  Return { report, diffStat, diff, truncated, ac }.`,
    { label: `evidence:${frd}`, phase: 'Review', model: MECH, effort: MECH_EFFORT, agentType: MECH_AGENT('pandacorp:implementer'), schema: EVIDENCE_SCHEMA, workFrom: worktreeWorkFrom(pinSha) })
}

// Start the collector for `frd` as a background promise on the gate-worktree mutex. Idempotent per FRD and
// a no-op in explore mode, so the call sites need no mode branch of their own.
function launchEvidence(frd) {
  if (GATE_EVIDENCE !== 'digested') return
  const st = frdState.get(frd)
  if (!st || st.evidencePromise) return
  const pinSha = st.pinSha
  if (!pinSha) return   // no pin → no frozen tree to collect from; the gate resolves it inline (or degrades)
  const work = gateWorktreeChain.then(async () => {
    const ok = await ensureGateWorktree(pinSha)
    if (!ok) return null   // worktree unavailable → this run is heading for the legacy synchronous path anyway
    return await collectGateEvidence(frd, st.reviewIds, pinSha)
  }).then((r) => r, () => null)
  gateWorktreeChain = work.then(() => {}, () => {})   // keep the worktree mutex chain alive across errors
  st.evidencePromise = work
}

// Resolve the pack for a gate about to run: await the prelaunched promise, or collect inline when there is
// none (a resume gate enrolled before any wave). Validates fail-closed and LOGS every degradation.
async function resolveGateEvidence(frd, reviewIds, pinSha) {
  if (GATE_EVIDENCE !== 'digested') return null
  const st = frdState.get(frd)
  let raw = null
  try { raw = (st && st.evidencePromise) ? await st.evidencePromise : await collectGateEvidence(frd, reviewIds, pinSha) }
  catch (e) { log(`⚠ GateEvidenceFallback ${frd}: the evidence collector threw (${(e && e.message) || e}) — this gate runs in EXPLORE mode`); return { evidence: null, fallbackReason: 'collector threw' } }
  const verdict = validateEvidence(raw)
  if (!verdict.evidence) log(`⚠ GateEvidenceFallback ${frd}: ${verdict.fallbackReason} — this gate runs in EXPLORE mode (the gate is never skipped and never runs blind)`)
  return verdict
}

const evidenceOf = (pack) => (pack && pack.evidence) || null
const evidenceFallbackOf = (frd, pack) => ((pack && pack.fallbackReason) ? GATE_EVIDENCE_FALLBACK_EVENT(frd, pack.fallbackReason) : '')

// The three attachments, interpolated at the TOP of the gate prompt (before the lenses) so they are the
// reviewer's first material, plus the bounded exploration budget that replaces open-ended exploration.
const evidenceBlock = (frd, ev) => ev ? `
  **${EVIDENCE_MARKER} (WP-06).** A dedicated collector already ran the gate script and gathered the diff and the acceptance criteria at this exact pinned commit, in this exact worktree. **The three attachments below ARE your primary material** — read them first and judge from them. Do NOT re-walk the tree to rebuild what is already here.
  **EXPLORATION BUDGET FOR THIS GATE: at most ${EVIDENCE_READ_BUDGET} additional file reads, plus EXACTLY ONE mandatory execution of the gate script AFTER you write your adversarial tests (step 2 below — not optional: ATTACHMENT 1 predates those tests and cannot certify them).** Writing your adversarial tests, running them, and building the traceability inventory are NOT exploration — they are the job, and they are not capped. **If ${EVIDENCE_READ_BUDGET} reads are not enough to reach a verdict you can defend, do NOT keep exploring: return the verdict you can defend and state in \`failure\` exactly what you still needed and why.** An honest bounded verdict beats an unbounded hunt.

  ── ATTACHMENT 1/3 · GATE REPORT — verbatim \`.pandacorp/run/gate-report.json\` from \`bash .pandacorp/verify.sh --since <last_green_sha> --report-all\` run at THIS pin ──
  ${ev.report}

  ── ATTACHMENT 2/3 · THE CHANGE UNDER REVIEW — \`git diff <pin_base>..<pin>\`, the patch scoped to the reviewed work orders' declared artifacts ──${ev.truncated ? `
  ⚠ **TRUNCATED**: the unified patch exceeded the ${EVIDENCE_DIFF_MAX_LINES}-line cap, so it carries the largest files clipped at hunk boundaries. This is NOT the complete change set — the \`--stat\` below IS complete, so reconcile against it and spend budgeted reads on any file you need in full.` : ''}
  STAT:
  ${ev.diffStat || '(the collector reported none)'}
  PATCH:
  ${ev.diff || '(the collector reported none)'}

  ── ATTACHMENT 3/3 · EARS ACCEPTANCE CRITERIA of ${frd}, verbatim ──
  ${ev.ac || `(the collector reported none — recover them from docs/frds/${frd}/frd.md within your read budget)`}
` : ''

// Step 2 of the gate. EXPLORE = the historical text (plus the WP-08 report_scope cage, reconciled at
// integration time — every certifier carries it, not only the ones WP-08 itself touched). DIGESTED = the
// SAME obligation (the focused gate must be clean, under the SAME cage), reached from the attached report
// PLUS a MANDATORY re-run (REV2-1/DR-080): ATTACHMENT 1 was collected BEFORE the reviewer's own
// adversarial tests existed, so it cannot possibly certify them — a permissive "you MAY re-run" let a gate
// write tests it never executed and certify green off stale evidence. The re-run is required, not offered.
const gateFocusedStep = (frd, ev) => ev
  ? `  2) **Do NOT re-run the focused gate merely to discover its result — ATTACHMENT 1 above IS that result** (\`verify.sh --since <last_green_sha> --report-all\`, executed for you at this pin). Read every sub-gate's \`exit\` and every \`failures[]\` row in it; a red sub-gate there is first-class blocking evidence, and a \`green: false\` report can never be waived into a pass. **You MUST run verify.sh exactly once — \`bash .pandacorp/verify.sh --since <last_green_sha>\` — after writing your adversarial tests: ATTACHMENT 1 predates them and therefore cannot certify them.** Do NOT pass \`--only\`/\`--files\` on that re-run: this gate is the FRD's certification oracle, and a scoped run stamps the report \`scope:"partial"\`, which the engine refuses to certify on. It must pass clean.${REPORT_SCOPE_DIRECTIVE} Return THAT run's \`.pandacorp/run/gate-report.json\` VERBATIM as \`gateReport\` — never ATTACHMENT 1's — when it is RED, so the engine can route the failing sub-gate without paying a model to re-read your prose.${PREVIEW_SMOKE(frd)}`
  : `  2) Run the FOCUSED gate \`bash .pandacorp/verify.sh --since <last_green_sha>\` (read last_green_sha from .pandacorp/status.yaml) — biome + tsc run globally, but only the TESTS affected since the last green (fast and scales; the full suite runs once at close-out). It must pass clean. Do NOT pass \`--only\`/\`--files\` here: this run is the FRD's certification oracle, and a scoped run stamps the report \`scope:"partial"\`, which the engine refuses to certify on.${REPORT_SCOPE_DIRECTIVE} Also return that run's \`.pandacorp/run/gate-report.json\` VERBATIM as \`gateReport\` when it is RED, so the engine can route the failing sub-gate without paying a model to re-read your prose.${PREVIEW_SMOKE(frd)}`

// ── FRD gate (serial): ONE review + integration test over the whole feature ──
async function frdGateSerial(frd, reviewIds, attemptNo = 1, workFrom, evidencePack) {
  const ev = evidenceOf(evidencePack)   // WP-06: null ⇒ this gate runs in EXPLORE mode (the historical contract)
  agentSpawned += COST(P.judge)   // DR-073: the gate runs on the judge model — weight it honestly
  return await agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'gate' })}${TRACK('review_start', `,"frd":"${frd}"`)}${GATE_EVENT(frd, reviewIds.length, attemptNo)}${evidenceFallbackOf(frd, evidencePack)} FRD review + integration gate for ${frd}. Review the work orders built/changed THIS cycle: ${reviewIds.join(', ')} (all IN_REVIEW). This FRD MAY already have OTHER work orders VERIFIED from a previous run — treat those as a stable foundation: exercise them in integration, but do NOT re-review them and NEVER change their state.
 BUILD-JOURNAL (A1) — at WHICHEVER exit you take below (pass / reopen / blocked / fail), record this gate's verdict:${gateVerdictJournal(frd, reviewIds, attemptNo)}

  **THE GATE IS SPLIT (DR-072) — this is what makes the build converge instead of churning. Two categories with DIFFERENT consequences:**
  • **CORRECTION (BLOCKING — your hard gate):** correctness, **requirements/acceptance criteria met** (the EARS AC of FRD ${frd} — the required behavior/sections/elements EXIST and work), security, no genuine DUPLICATE of an existing shared primitive (DR-057), and **GROSS visual-structural mismatch** (the surface is not RECOGNIZABLY the designed thing — e.g. a flat text list where the mock shows a multi-panel/pixel-art layout; a section missing entirely). These BLOCK.
  • **VISUAL-FIDELITY NITS (ADVISORY — do NOT block, do NOT reopen):** sizing (15px vs 16px), spacing, exact color/shade, minor density/polish, "doesn't match the mock 100%". A pixel-judge is noisy; rejecting on nits is the #1 cause of the build never finishing. **NEVER reopen a WO for a nit.** Instead APPEND each nit to the punch-list \`.pandacorp/comms/visual-punch-list.md\` (one line: \`- [ ] ${frd} · <route> · <the gap, e.g. "heading is 15px, design tokens say 16px"> · <file:approx-line if known>\`). The dedicated end-of-build Visual QA pass + the owner sweep these directly — they do not gate VERIFIED. Scope yourself to CORRECTION + GROSS only; **flag, don't fix, don't reject** the rest (an over-broad reviewer reporting every gap HARMS convergence — research-backed).

  ${WHOLE_FRD_ORACLE}
${evidenceBlock(frd, ev)}
  1) Review the changed work orders for CORRECTION (the blocking lenses above) and write adversarial tests the implementers did not see (anchored in EARS + real bugs), exercising them TOGETHER with the rest of the feature (real integration, not isolated).
${gateFocusedStep(frd, ev)}

${GATE_PASS_RETURN}

  **If a SPECIFIC reviewed work order fails CORRECTION (a real bug / missing requirement / gross-structural miss):** check that WO's frontmatter \`reopen_count\` (default 0). **DR-072 NON-PROGRESS STOP — if it is already ≥ ${MAX_REOPENS}, do NOT reopen again** (the same fault is not resolving autonomously): you are REVIEW-ONLY — do NOT stamp BLOCKED, do NOT write decisions.md, do NOT commit; just${TRACK('review_end', `,"frd":"${frd}","verdict":"blocked"`)}${GATE_VERDICT(frd, 'blocked', `,"blocked_reason":"needs-owner"`)} return { green: false, reopen: [], blocked_reason: 'needs-owner', failure: 'reopened ${MAX_REOPENS}x, gate not satisfiable autonomously' } — the engine persists the BLOCKED state + the decision record on the MAIN tree. **Otherwise — DR-073 PATCH-FIRST: do NOT revert, do NOT change the WO's \`implementation_status\` (leave it IN_REVIEW), do NOT touch \`reopen_count\`, do NOT \`git checkout\`/\`git rm\` anything, do NOT commit a revert.** The build is ~correct except a bounded fault — the engine will attempt an in-place PATCH on the existing build BEFORE any revert. **FIX-FORWARD MANDATE (DR-073, calibrated 2026-07-01): a BOUNDED fault you can name at file:line with an estimated fix of ≤ ~30 lines (a hardcoded string, a missing null-guard, a clipped breakpoint, a missing escape) MUST take this findings exit — never a bare failure, never blocked_reason 'error' (80% of real first-gate fails had ≤6-min fixes; routing them to revert cost ~1.5h of a run's 2.2h rework).** Your job here is to REPORT the fixable fault(s) precisely: for EACH failing reviewed WO, write the specific finding (with file:line) and a RED-PROVEN failing test (a test you wrote that fails WITHOUT the fix and will pass WITH it — give its path / describe-it / a snippet) and the file(s) the fix should touch.${TRACK('review_end', `,"frd":"${frd}","verdict":"reopen"`)}${GATE_VERDICT(frd, 'reopen', `,"reopened":%s`, ` "<the count of work orders you are reopening — an integer>"`)} Return { green: false, reopen: [those ids], findings: [{ wo, finding, failingTest, files }], failure }. The engine patches those findings in place; only if the patch can't green it whole-project does it then revert + reopen for a clean rebuild (DR-070, the fallback).
  **DR-065 — missing foundation primitive:** if a surface looks FLAT / structurally wrong because a SHARED design-system primitive it needs is NOT built (it isn't in src/components nor docs/design/components.md — e.g. the mock shows a Room/AgentSprite/StoneBridge the foundation never built), do NOT block and do NOT just reopen — return { green: false, missingFoundation: [the primitive names], failure }. The engine auto-repairs the foundation and rebuilds the surfaces against it.
  If it's broken and you can't pinpoint specific WOs,${TRACK('review_end', `,"frd":"${frd}","verdict":"fail"`)}${GATE_VERDICT(frd, 'fail')} return { green: false, failure, blocked_reason } (classify: 'needs-owner' if a human must act, 'external' if it's a transient outside failure, else 'error').${NOTIFY('FRD ' + frd + ' no paso la revision (correccion) — necesita tu atencion')}`,
    { label: `gate:${frd}`, phase: 'Review', model: P.judge, effort: 'xhigh', agentType: 'pandacorp:reviewer', schema: FRD_GATE_SCHEMA, workFrom })
}

// ── FRD gate SPLIT (proposal 31 T1.2): parallel finder lenses → dedup → adversarial verify → close ──
// Used INSTEAD of the single frdGate() reviewer spawn when P.reviewSplit AND the split fits the maxAgents
// budget (the choice is made in gateAndConverge, which pre-checks the brake). It returns the SAME
// FRD_GATE_SCHEMA as frdGate(), so every downstream convergence path (patch/verify/revert/repair) is
// untouched. The four stages decompose the ONE serial reviewer into diverse lenses + per-finding
// adversarial refutation — the canonical quality pattern (a generator's blind spots differ per lens; a
// skeptic kills the noise before the closer pays to act on it). The CLOSE stage still does everything the
// serial gate does (adversarial tests, verify.sh --since, DR-072 split verdict, punch-list) — it only
// skips re-hunting from scratch (the finders already swept), and still independently confirms each
// correction it acts on (generator ≠ verifier). Fail-safe: dead finders/verifiers degrade, never a
// silent skip of the gate; all four finders dead → the caller falls back to serial frdGate().
const VERIFY_CAP = 8   // max adversarial verifiers spawned per gate; overflow corrections pass through UNVERIFIED (labeled)
// The four read-only finder lenses (one agent each). `key` labels the spawn; `lens` is the prompt focus.
const FINDER_LENSES = [
  { key: 'correctness', lens: 'CORRECTNESS vs the FRD\'s acceptance criteria — read the EARS AC of this FRD and assert the required behavior/sections/elements EXIST and work; every AC this feature owns is met. Report each unmet/incorrect AC.' },
  { key: 'security', lens: 'SECURITY — OWASP-class defects for this stack: missing authz on a mutating route/action, injection, unsafe input at a boundary, secrets in code, missing/incorrect validation. Report each concrete exposure.' },
  { key: 'quality', lens: 'QUALITY — a near-DUPLICATE of an existing shared component/primitive (DR-057; cross-check docs/design/components.md + src/components), a SINGLE-SOURCE-OF-TRUTH violation (DR-115: a fact with two writers, an increment-maintained counter, a second independent derivation of the same value), and a DEAD/STALE reader mapping (a field read that nothing writes, a stale replica rendered as truth). Report each.' },
  { key: 'runtime', lens: 'RUNTIME/VISUAL — does the feature actually RENDER/RUN? You MAY run the existing browser gates READ-ONLY (render the routes, screenshot) but write no tests and change nothing. Report a route that errors, a blank/error render, an uncaught console error, or a GROSS structural mismatch vs the binding mock (a flat list where the mock is a rich layout, a missing section). Advisory nits (exact px/shade/spacing) → severity nit.' },
]
// Estimated agent-cost of the split BEFORE we know how many corrections survive dedup (contract 5): the
// 4 finders + the expected verifiers (bounded at VERIFY_CAP — we can't know the real correction count
// until the finders run, so the pre-check assumes the worst case, a full cap of verifies) + the closer,
// all on their real models. Used to pre-check the maxAgents brake in gateAndConverge so the split-vs-serial
// choice happens BEFORE any spawn (contract: the brake check runs first).
const splitGateEstimatedCost = () => 4 * COST('sonnet') + Math.min(VERIFY_CAP, VERIFY_CAP) * COST('sonnet') + COST(P.judge)   // Math.min(expectedVerifies, VERIFY_CAP) with expectedVerifies=VERIFY_CAP (worst case) per contract 6
// Normalized merge key so the same defect reported by two lenses dedups to one (DEDUP stage).
const findingKey = (find) => `${String(find.file || '').trim().toLowerCase()}::${String(find.claim || '').trim().toLowerCase().replace(/\s+/g, ' ')}`

async function frdGateSplit(frd, reviewIds, attemptNo = 1, workFrom, evidencePack) {
  // WP-06: the SAME validated pack feeds all four lenses and the closer — one collection, five readers. The
  // finders are already forbidden to run verify.sh, so for them the pack is pure gain (they stop re-walking
  // the tree for the diff and the AC). `ev` null ⇒ every stage runs in EXPLORE mode, unchanged.
  const ev = evidenceOf(evidencePack)
  // ── FIND (parallel): 4 read-only finder lenses ── (C2: all run in the pinned worktree when workFrom is set)
  agentSpawned += 4 * COST('sonnet')   // weight every spawn (DR-070/DR-073) — the finders are the FIND stage's cost
  const finderResults = await parallel(FINDER_LENSES.map((L) => () =>
    agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'find' })}FRD split-gate FIND stage — the ${L.key} lens for ${frd} (proposal 31 T1.2). You are ONE of four parallel read-only finders. Review the work orders built/changed THIS cycle: ${reviewIds.join(', ')} (all IN_REVIEW), exercising them together with the rest of the feature. This FRD MAY have OTHER work orders VERIFIED from a previous run — treat those as a stable foundation; do NOT re-review or change them.
    Your lens: ${L.lens}${evidenceBlock(frd, ev)}
    **READ-ONLY — findings ONLY:** do NOT write or modify tests, do NOT fix anything, do NOT run \`verify.sh\`, do NOT change any file or frontmatter. Just report. For each defect return { file (with a line if you can), claim (one sentence), severity ('correction' for a blocking defect in your lens; 'nit' for advisory polish), evidence (the concrete code/behavior you observed, so a skeptic can try to refute it) }. If your lens finds nothing, return { findings: [] }.`,
      { label: `find:${L.key}:${frd}`, phase: 'Review', model: 'sonnet', agentType: 'pandacorp:reviewer', schema: FINDER_SCHEMA, workFrom }),
  ))
  const liveFinders = finderResults.filter((r) => r && Array.isArray(r.findings))
  const deadFinders = FINDER_LENSES.filter((_, i) => !finderResults[i] || !Array.isArray(finderResults[i].findings))
  if (deadFinders.length) log(`⚠ ${frd}: ${deadFinders.length}/4 finder lens(es) returned no verdict — proceeding with the other lenses (fail-safe)`)
  // Fail-safe (contract 4): ALL four finders null → the split produced nothing; the caller falls back to
  // the serial gate (the gate itself may NEVER be skipped). Signalled by a sentinel the caller checks.
  if (liveFinders.length === 0) { log(`⚠ ${frd}: all four finder lenses died — falling back to the serial frdGate() (the gate is never skipped)`); return { __splitFailed: true } }

  // ── DEDUP (plain code): merge by normalized file+claim key ──
  const byKey = new Map()
  for (const r of liveFinders) for (const f of r.findings) {
    if (!f || !f.claim) continue
    const k = findingKey(f)
    if (!byKey.has(k)) byKey.set(k, f)
  }
  const deduped = [...byKey.values()]
  const corrections = deduped.filter((f) => f.severity === 'correction')
  const nits = deduped.filter((f) => f.severity !== 'correction')
  log(`⚑ ${frd}: finders → ${deduped.length} deduped finding(s) (${corrections.length} correction(s), ${nits.length} nit(s))`)

  // ── VERIFY (parallel, adversarial): one skeptic per CORRECTION, capped at VERIFY_CAP ──
  // Overflow corrections (beyond the cap) pass through UNVERIFIED but LABELED (never silently dropped).
  const toVerify = corrections.slice(0, VERIFY_CAP)
  const overflow = corrections.slice(VERIFY_CAP)
  if (overflow.length) log(`⚠ ${frd}: ${overflow.length} correction(s) exceed the verify cap of ${VERIFY_CAP} — passing them through UNVERIFIED (labeled) to the closer`)
  let survivingCorrections = [...overflow.map((f) => ({ ...f, verification: 'unverified-overflow' }))]
  if (toVerify.length) {
    agentSpawned += toVerify.length * COST('sonnet')
    const verdicts = await parallel(toVerify.map((f) => () =>
      agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'verify-finding' })}FRD split-gate VERIFY stage — adversarial skeptic for ONE finding on ${frd} (proposal 31 T1.2). A finder lens claimed this defect:
      • file: ${f.file}
      • claim: ${f.claim}
      • evidence given: ${f.evidence || '(none)'}
      Your job is to try to REFUTE it against the ACTUAL code — read the file, reproduce the claim, check the evidence holds. Be a skeptic: **default to refuted if you cannot reproduce or anchor the finding** in the real code (an unreproducible claim is noise, not a defect). Return { refuted: true, reason } if it does not hold; { refuted: false, reason } only if the defect genuinely stands. READ-ONLY: change nothing.`,
        { label: `verify-finding:${frd}`, phase: 'Review', model: 'sonnet', agentType: 'pandacorp:reviewer', schema: VERIFY_FINDING_SCHEMA, workFrom }),
    ))
    for (let i = 0; i < toVerify.length; i++) {
      const v = verdicts[i]
      // Fail-safe (contract 4): a null verifier → the finding stays ALIVE but labeled unverified — never
      // silently drop a correction because the SKEPTIC died. Only an explicit refuted:true kills it.
      if (!v) { survivingCorrections.push({ ...toVerify[i], verification: 'unverified-dead-skeptic' }); log(`⚠ ${frd}: a verifier returned no verdict — keeping its finding ALIVE (unverified, never drop a correction on a dead skeptic)`); continue }
      if (v.refuted === true) continue   // refuted findings die
      survivingCorrections.push({ ...toVerify[i], verification: 'confirmed', verifyReason: v.reason })
    }
    log(`⚖ ${frd}: verify → ${survivingCorrections.length} correction(s) survive (of ${corrections.length}; ${corrections.length - survivingCorrections.length} refuted or died)`)
  }

  // ── CLOSE (one judge-model reviewer): act on the survivors, return the SAME FRD_GATE_SCHEMA ──
  const survList = survivingCorrections.length
    ? survivingCorrections.map((f) => `• [${f.verification}] ${f.file} — ${f.claim}${f.evidence ? ` (evidence: ${f.evidence})` : ''}`).join('\n  ')
    : '(none — the finder sweep + adversarial verify surfaced no surviving blocking correction)'
  const nitList = nits.length ? nits.map((f) => `• ${f.file} — ${f.claim}`).join('\n  ') : '(none)'
  agentSpawned += COST(P.judge)   // the closer runs on the judge model — weight it honestly
  return await agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'gate' })}${TRACK('review_start', `,"frd":"${frd}"`)}${GATE_EVENT(frd, reviewIds.length, attemptNo)}${evidenceFallbackOf(frd, evidencePack)} FRD review + integration gate for ${frd} — the CLOSE stage of the split gate (proposal 31 T1.2). A parallel finder sweep (4 diverse lenses) + per-finding adversarial verification ALREADY RAN — so you do NOT re-hunt findings from scratch; you act on the survivors below. Review the work orders built/changed THIS cycle: ${reviewIds.join(', ')} (all IN_REVIEW). This FRD MAY already have OTHER work orders VERIFIED from a previous run — treat those as a stable foundation: exercise them in integration, but do NOT re-review them and NEVER change their state.
 BUILD-JOURNAL (A1) — at WHICHEVER exit you take below (pass / reopen / blocked / fail), record this gate's verdict:${gateVerdictJournal(frd, reviewIds, attemptNo)}

  **SURVIVING BLOCKING CORRECTIONS (the finder sweep confirmed these — you must independently CONFIRM each one you act on; generator ≠ verifier, do not take the sweep's word):**
  ${survList}

  **ADVISORY NITS (from the finders — punch-list only, NEVER block or reopen on these):**
  ${nitList}

  **THE GATE IS SPLIT (DR-072) — two categories with DIFFERENT consequences:**
  • **CORRECTION (BLOCKING — your hard gate):** correctness, **requirements/acceptance criteria met** (the EARS AC of FRD ${frd}), security, no genuine DUPLICATE of an existing shared primitive (DR-057), and **GROSS visual-structural mismatch**. These BLOCK. The survivors above are your starting set — CONFIRM each independently against the code before you act; you may also add a blocking correction the sweep missed if you find one exercising the feature (the sweep is a head-start, not a ceiling).
  • **VISUAL-FIDELITY NITS (ADVISORY — do NOT block, do NOT reopen):** sizing, spacing, exact color/shade, minor polish. **NEVER reopen a WO for a nit.** APPEND each nit (the ones above + any you find) to \`.pandacorp/comms/visual-punch-list.md\` (one line: \`- [ ] ${frd} · <route> · <the gap> · <file:approx-line if known>\`). The end-of-build Visual QA pass + the owner sweep these; they never gate VERIFIED.

  ${WHOLE_FRD_ORACLE}
${evidenceBlock(frd, ev)}
  1) Independently CONFIRM the surviving corrections and write adversarial tests the implementers did not see (anchored in EARS + real bugs), exercising the work orders TOGETHER with the rest of the feature (real integration, not isolated).
${gateFocusedStep(frd, ev)}

${GATE_PASS_RETURN}

  **If a SPECIFIC reviewed work order fails CORRECTION (a confirmed real bug / missing requirement / gross-structural miss):** check that WO's frontmatter \`reopen_count\` (default 0). **DR-072 NON-PROGRESS STOP — if it is already ≥ ${MAX_REOPENS}, do NOT reopen again:** you are REVIEW-ONLY — do NOT stamp BLOCKED, do NOT write decisions.md, do NOT commit; just${TRACK('review_end', `,"frd":"${frd}","verdict":"blocked"`)}${GATE_VERDICT(frd, 'blocked', `,"blocked_reason":"needs-owner"`)} return { green: false, reopen: [], blocked_reason: 'needs-owner', failure: 'reopened ${MAX_REOPENS}x, gate not satisfiable autonomously' } — the engine persists the BLOCKED state + the decision record on the MAIN tree. **Otherwise — DR-073 PATCH-FIRST: do NOT revert, do NOT change the WO's \`implementation_status\` (leave it IN_REVIEW), do NOT touch \`reopen_count\`, do NOT \`git checkout\`/\`git rm\` anything, do NOT commit a revert.** The build is ~correct except a bounded fault — the engine will attempt an in-place PATCH BEFORE any revert. **FIX-FORWARD MANDATE (DR-073): a BOUNDED fault you can name at file:line with a fix of ≤ ~30 lines MUST take this findings exit.** For EACH failing reviewed WO, write the specific finding (with file:line) and a RED-PROVEN failing test (fails WITHOUT the fix, passes WITH it — give its path / describe-it / a snippet) and the file(s) the fix should touch.${TRACK('review_end', `,"frd":"${frd}","verdict":"reopen"`)}${GATE_VERDICT(frd, 'reopen', `,"reopened":%s`, ` "<the count of work orders you are reopening — an integer>"`)} Return { green: false, reopen: [those ids], findings: [{ wo, finding, failingTest, files }], failure }.
  **DR-065 — missing foundation primitive:** if a surface looks FLAT / structurally wrong because a SHARED design-system primitive it needs is NOT built, do NOT block and do NOT just reopen — return { green: false, missingFoundation: [the primitive names], failure }. The engine auto-repairs the foundation and rebuilds the surfaces against it.
  If it's broken and you can't pinpoint specific WOs,${TRACK('review_end', `,"frd":"${frd}","verdict":"fail"`)}${GATE_VERDICT(frd, 'fail')} return { green: false, failure, blocked_reason } (classify: 'needs-owner' if a human must act, 'external' if it's a transient outside failure, else 'error').${NOTIFY('FRD ' + frd + ' no paso la revision (correccion) — necesita tu atencion')}`,
    { label: `gate:${frd}`, phase: 'Review', model: P.judge, effort: 'high', agentType: 'pandacorp:reviewer', schema: FRD_GATE_SCHEMA, workFrom })   // C1d: the split closer drops xhigh→high — the finders already hunted; it adjudicates the survivors (the SERIAL gate keeps xhigh)
}

// ── C2 gate worktree lifecycle (MECH, MAIN-tree git op) ──────────────────────────────────────────
// Lazily creates the persistent detached worktree at GATE_WORKTREE; on safe reuse it checks out the new pin sha
// (+ pnpm install ONLY if pnpm-lock.yaml changed between shas). One label 'gate-worktree'. Returns true iff
// the worktree is ready at `sha`. First hard failure → worktreeState 'failed' → the whole run falls back to
// the legacy synchronous gate path. Idempotent: a no-op (no spawn) when already frozen at `sha`.
async function ensureGateWorktree(sha) {
  if (worktreeState === 'failed') return false
  if (worktreeState === 'ready' && lastWorktreeSha === sha) return true   // already frozen at this sha — no spawn
  agentSpawned++
  const r = await agent(
    `C2 gate worktree — prepare a FROZEN detached checkout at ${GATE_WORKTREE} pinned to commit ${sha} (MAIN-tree git op; this is the only main-tree git command you run here). Do EXACTLY:
    1) If the directory ${GATE_WORKTREE} does NOT exist: first confirm \`git -C ${PROJECT_DIR} worktree list --porcelain\` has NO worktree entry for that exact path. Then run \`git -C ${PROJECT_DIR} worktree add --detach ${GATE_WORKTREE} ${sha}\` and \`pnpm install\` inside ${GATE_WORKTREE}. Return { ok: true, created: true }.
    2) If the directory ALREADY exists: reuse it ONLY if \`git -C ${PROJECT_DIR} worktree list --porcelain\` records that exact canonical path AND \`git -C ${GATE_WORKTREE} status --porcelain\` is empty. If either check fails, DO NOT mutate anything; return { ok: false, failure: "gate worktree is dirty, orphaned, unregistered, or ambiguous; evidence preserved" }.
    3) For a registered CLEAN reuse, note its old sha, then \`git -C ${GATE_WORKTREE} checkout --detach ${sha}\`. Run \`pnpm install --frozen-lockfile\` inside ${GATE_WORKTREE} ONLY IF pnpm-lock.yaml changed between the old sha and ${sha} (\`git -C ${PROJECT_DIR} diff --name-only <oldsha> ${sha} -- pnpm-lock.yaml\` non-empty); otherwise SKIP install. Return { ok: true, created: false }.
    If ANY step fails (stuck lock, unreachable sha, linked path conflict, dirty/orphan evidence), do NOT retry and DO NOT delete, reset, clean, prune, recreate, or force-remove the path: return { ok: false, failure: "<what failed>" }. The engine falls back to synchronous gates on the quiet main tree for the rest of the run. NEVER modify preserved crash evidence.`,
    { label: 'gate-worktree', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, created: { type: 'boolean' }, failure: { type: 'string' } } } })
  if (r && r.ok === true) { worktreeState = 'ready'; lastWorktreeSha = sha; return true }
  worktreeState = 'failed'; lastWorktreeSha = null
  log(`⚠ C2: gate worktree could not be prepared (${(r && r.failure) || 'no verdict'}) — falling back to the LEGACY synchronous gate path for the whole run`)
  return false
}

// ── C2 pin capture (MECH) — the boundary sha the gate(s) freeze at (HEAD right after the wave's commits) ──
// WP-03 fusion (ii): `preSha` is the sha commitWOGreen's LAST landed commit already returned THIS wave
// (null when nothing committed this wave, or when attemptRepair ran — its own commit is untracked here,
// so the cached sha would be stale). Only trusted under MECH_LEAN; args.mechLean:false always spawns.
async function capturePin(frds, preSha = null) {
  if (MECH_LEAN && preSha) {
    for (const frd of frds) { const st = frdState.get(frd); if (st) st.pinSha = preSha }
    return preSha
  }
  agentSpawned++
  const r = await agent(
    `Return the current MAIN-tree HEAD short sha (\`git -C ${PROJECT_DIR} rev-parse --short HEAD\`) — the pin the FRD gate(s) for ${frds.join(', ')} will freeze at. Change nothing, commit nothing. Return { sha: "<the short sha>" }.`,
    { label: `pin:${frds.join('+')}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: { type: 'object', required: ['sha'], properties: { sha: { type: 'string' } } } })
  const sha = (r && r.sha) || null
  for (const frd of frds) { const st = frdState.get(frd); if (st) st.pinSha = sha }
  return sha
}

// ── C2 apply-gate (serialized MAIN-tree writer) ──────────────────────────────────────────────────
// The review-only gate PASSED in the (possibly frozen) worktree. This MECH step is the SOLE main-tree git
// writer for the result — serialized on commitChain (no interleaved index.lock race with the WO commits). It
// ports the reviewer's new test files, stamps VERIFIED + reopen_count 0, recomputes rollups, updates
// status.yaml, advances last_green_sha (WS-D/D11 ordering), commits, and emits the PASS events (one
// GateVerdict pass + one achievement per WO + the track/journal pass lines) — moved here from the gate's pass
// path so the event counts stay identical to the pre-C2 topology. `sourceDir` = the worktree to port test
// files from (null when the gate ran on main — they are already in place). Runs on the MAIN tree (no workFrom).
async function applyGate(frd, reviewIds, testFiles, sourceDir) {
  agentSpawned++
  const files = (testFiles || []).filter(Boolean)
  const port = sourceDir && files.length
    ? ` FIRST port the reviewer's adversarial test files from the gate worktree onto the main tree — for EACH of these repo-relative paths copy \`${sourceDir}/<path>\` → \`<path>\` (mkdir -p the parent; overwrite): ${files.join(', ')}.`
    : (files.length ? ` The reviewer's adversarial test files are already on the main tree (${files.join(', ')}) — just make sure they are staged in the commit below.` : '')
  const applyJournal = JOURNAL(
    `"wo":"%s","frd":"${frd}","attempt":0,"reopen_count":0,"rung":"gate","role":"verifier","kind":"resolution","classification":"","seam":null,"findingKey":"","tried":"gate passed in the pinned worktree; applied on main","verdict":"green","why":"%s","confidence":"high"`,
    ` "<the primary work order this gate verified, else ${(reviewIds || [])[0] || frd}>" "<one line: what the gate confirmed>"`)
  const link = commitChain.then(() => agent(
    `You are the SOLE main-tree git writer at this instant (serialized — no other commit runs concurrently, so there is NO index.lock race). Apply the PASSED FRD gate for ${frd} onto the MAIN tree (the review already happened; you only PERSIST it — do NOT re-review, do NOT re-run the suite).${port}
    Set the reviewed work orders (${(reviewIds || []).join(', ')}) frontmatter \`implementation_status: VERIFIED\` and **reset their \`reopen_count: 0\`** (DR-072 C2), then ${SYNC_ROLLUPS} Set safe_to_test:true through its owning transition until that field migrates.${LAST_GREEN_ORDERING}${TRACK('review_end', `,"frd":"${frd}","verdict":"pass"`)}${TRACK('frd_end', `,"frd":"${frd}"`)}${GATE_VERDICT(frd, 'pass', `,"passed":${(reviewIds || []).length}`)}${ACHIEVEMENT(frd)} BUILD-JOURNAL (A1): record the gate's green resolution (the trust boundary was the gate; you are its main-tree applier):${applyJournal} Stage the ported test files, \`.pandacorp/track.jsonl\` AND \`.pandacorp/build-journal.jsonl\` too, and commit (Conventional Commits, scope). Return { done: true }.
    **BEFORE you stamp anything (WP-08 cage):** read \`.pandacorp/run/gate-report.json\` — the report the gate you are applying left behind — and return its \`scope\` field VERBATIM as \`report_scope\`. If it reads \`partial\`, that gate ran \`--only\`/\`--files\` and certified NOTHING: stamp nothing, advance nothing, commit nothing, and return { done: false, report_scope: 'partial' }.`,
    { label: `apply-gate:${frd}`, phase: 'Review', model: MECH, agentType: 'pandacorp:implementer', schema: APPLY_GATE_SCHEMA }))
  commitChain = link.then(() => {}, () => {})   // share ONE serialized git-writer chain on main (WO commits + gate applies) — no interleaved writers
  return link.then((r) => {
    if (isPartialReport(r)) { refusePartial(frd, 'apply-gate'); return false }   // WP-08 cage, belt to the gate's own braces
    return Boolean(r && r.done === true)
  }, (e) => { log(`apply-gate failed for ${frd}: ${(e && e.message) || e}`); return false })
}

// ── C2 persist-block (serialized MAIN-tree writer) — the non-progress / classified BLOCK the review-only
// gate could not write (it is review-only). Stamps BLOCKED + the decision record on main. ──
async function persistGateBlock(frd, reviewIds, reason, failure) {
  agentSpawned++
  const link = commitChain.then(() => agent(
    `You are the SOLE main-tree git writer at this instant (serialized). The FRD gate for ${frd} classified a BLOCK (${reason})${failure ? ` — ${failure}` : ''} but is review-only, so persist it on the MAIN tree now. For EACH reviewed work order (${(reviewIds || []).join(', ')}) whose frontmatter fault warrants it (a DR-072 non-progress WO has \`reopen_count\` ≥ ${MAX_REOPENS}; for a generic gate block, all of them): set \`implementation_status: BLOCKED\` + \`blocked_reason: ${reason}\`. Append an owner-facing record (SPANISH) to .pandacorp/inbox/decisions.md — what the gate keeps rejecting, the diagnosis, what the owner must decide. ${SYNC_ROLLUPS} Bump pending_decisions through its current owning transition. Commit (Conventional Commits, scope). Return { done: true }.`,
    { label: `persist-block:${frd}`, phase: 'Review', model: MECH, agentType: 'pandacorp:implementer', schema: STOP_SCHEMA }))
  commitChain = link.then(() => {}, () => {})
  return link.then(() => true, () => false)
}

// ── WP-08/D4 REPAIR COST BRAKE (behind args.repairBrake, independent of args.scopedRepair) ───────
// The pre-existing brakes count ATTEMPTS (PATCH_ATTEMPT_CAP=2, MAX_REOPENS=3), never spend — which is
// exactly how FRD-24 paid $4.30 of repair on $1.23 of build (3.5x) without any cap noticing. This one
// counts SPEND, in the same COST() units the maxAgents brake already uses, per FRD: repair may cost at
// most REPAIR_BUDGET_FACTOR x what BUILDING that FRD's work orders cost THIS RUN — floored at 9 units
// (BL-0138/D4) so a small (1-WO) FRD's build cost never starves the patch-1→diagnose→patch-2 escalator
// itself; only the pricier rungs AFTER it (a second revert+retry, the in-run rebuild) stay bounded by
// the real budget.
// Honest about its own limits (stated here so nobody mistakes it for more than it is):
//   • COST() is a coarse proxy (opus=3, sonnet=1). It cannot see that ONE opus/xhigh agent spent 85
//     tool calls — the actual FRD-24 driver. It brakes agent WEIGHT, not tokens.
//   • It is scoped to THIS run's measured build spend. buildCostByFrd is FROZEN after the FRD's first
//     build wave (D4b) — an in-run retry rebuild (wo._isRetry) never inflates it, or the very spend the
//     brake exists to bound would also raise the ceiling that bounds it.
//   • The FIRST repair attempt of an FRD is always affordable — the brake bounds grinding, it never
//     forbids trying once.
// Charged at EVERY rung that spends real agent cost — patch / diagnose / gate-test-repair / repair /
// the in-run retry rebuild (D4, the single priciest rung — see inRunRetry). The independent VERIFIER
// and the honest EXIT are never charged: refusing to pay for certification, or for the block that tells
// the owner, would be the brake defeating its own purpose.
const buildCostByFrd = new Map()    // frd -> COST()-weighted units spent BUILDING its work orders this run (frozen after the first wave, D4b)
const repairCostByFrd = new Map()   // frd -> COST()-weighted units spent REPAIRING it this run
const REPAIR_BUDGET_FLOOR = 9       // D4/BL-0138: absolute minimum, regardless of factor x base — see the block comment above
const repairBudget = (frd) => Math.max(REPAIR_BUDGET_FACTOR * (buildCostByFrd.get(frd) || 0), REPAIR_BUDGET_FLOOR)
function chargeRepair(frd, model) {
  if (!REPAIR_BRAKE) return
  repairCostByFrd.set(frd, (repairCostByFrd.get(frd) || 0) + COST(model))
}
function canAffordRepair(frd, model, units = 1) {
  if (!REPAIR_BRAKE) return true
  const budget = repairBudget(frd)
  const spent = repairCostByFrd.get(frd) || 0
  if (spent === 0) return true                       // the first attempt is always affordable
  return spent + COST(model) * units <= budget
}
// The honest exit when the budget is gone: the work orders are filed needs-owner with the OBJECTIVE
// gate report attached, the work stays on the branch (nothing is reverted or discarded — the owner may
// well want to finish it by hand), and the owner is told through BOTH DR-099 channels (the GateVerdict
// event Mission Control reads, and the push notification).
async function blockRepairBudgetExhausted(frd, reopenIds, gate) {
  agentSpawned += COST(P.judge)   // the exit is never charged to the repair budget — it IS the budget's conclusion
  const spent = repairCostByFrd.get(frd) || 0
  const budget = repairBudget(frd)
  const report = gate && gate.gateReport ? JSON.stringify(gate.gateReport).slice(0, 4000) : '(the gate returned no machine-readable report; quote its `failure` text instead)'
  const record = `El motor gastó ${spent} unidades de coste reparando ${frd}, por encima del techo de ${budget} (${REPAIR_BUDGET_FACTOR}× lo que costó construir esa feature en esta corrida). Seguir intentándolo sale más caro que construirla entera, así que paro y te lo paso: el trabajo está INTACTO en la rama y el informe objetivo del gate va adjunto.`
  return await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'block' })}REPAIR BUDGET EXHAUSTED (WP-08) for ${frd}. Repair has cost ${spent} weighted cost-units against a ceiling of ${budget} (${REPAIR_BUDGET_FACTOR}× this FRD's own build spend this run). Do NOT patch, do NOT diagnose, do NOT retry — the point of stopping is to stop.
  1) **PRESERVE the work exactly as it is.** Do NOT revert, do NOT \`git checkout\` anything, do NOT \`git rm\` anything, and never a hard reset — the partially-repaired build stays on the branch so the owner (or a later run) can pick it up. Commit nothing but the state changes in step 2/3.
  2) Set EACH reopened work order (${(reopenIds || []).join(', ')}) \`implementation_status: BLOCKED\` + \`blocked_reason: needs-owner\`; ${SYNC_ROLLUPS} Bump pending_decisions through its current owning transition.
  3) Append the owner-facing DECISION RECORD to .pandacorp/inbox/decisions.md (SPANISH) and ATTACH the objective gate-report under it as a fenced \`\`\`json block so the owner reads the machine verdict, not a summary of it: ${record}
  GATE-REPORT (verbatim, from the failing gate): ${report}
  4) COMMIT (Conventional Commits, scope) staging the frontmatter flips, decisions.md, status.yaml and \`.pandacorp/build-journal.jsonl\`.${GATE_VERDICT(frd, 'blocked', `,"blocked_reason":"needs-owner","repair_units":${spent},"repair_budget":${budget}`)}${NOTIFY('FRD ' + frd + ' parado: la reparacion ya cuesta mas de ' + REPAIR_BUDGET_FACTOR + 'x construirlo — trabajo intacto, necesita tu decision')}
  Return { green: false, blocked_reason: 'needs-owner' }.`,
    { label: `block-repair-budget:${frd}`, phase: 'Review', model: P.judge, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}

// ── Repair pass: TRY TO FIX before giving up (owner's rule, DR-050) ────────────
// The build resolves problems itself and only stops when it genuinely can't — then it
// BLOCKS with a reason instead of dying. Run by a strong model (it's hard diagnosis).
async function attemptRepair(frd, context) {
  agentSpawned += COST(P.judge)   // DR-073: repair runs on the judge model — weight it honestly
  chargeRepair(frd, P.judge)          // WP-08: a fix agent — charged to this FRD's repair budget
  return await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'repair' })}The build of FRD ${frd} hit a problem: ${context}. You are the repair engineer — TRY TO FIX it before we give up.
  1) Diagnose the root cause: read the failing output, the work orders, and .pandacorp/comms/progress.md.
  2) If it is within your reach (code / test / local config): fix the PRODUCTION code (never weaken or skip tests) until \`bash .pandacorp/verify.sh\` is green for this feature; set the affected work orders' frontmatter back to \`implementation_status: IN_REVIEW\`; commit (Conventional Commits with scope); return { green: true }.
  3) If you CANNOT fix it, classify WHY, set the affected work orders' frontmatter to \`implementation_status: BLOCKED\` + \`blocked_reason: <reason>\`, mirror it in .pandacorp/status.yaml. **DR-070 — discard the blocked WO's committed-but-broken code so it doesn't pollute sibling FRDs' global gate: revert its files to the last green (\`git checkout <last_green_sha> -- <its existing files>\`; \`git rm\` newly-created ones; NEVER a hard reset of the whole tree).** Commit only the status change + the revert, and return { green: false, blocked_reason, failure }:
     - 'needs-owner' → it needs a HUMAN action/decision the agent can't take: a missing env var or secret, an external account/service to set up, a product decision. ALSO append it to .pandacorp/inbox/decisions.md (what's blocked, the options, your recommendation).
     - 'external' → a transient OUTSIDE failure (no internet, an upstream 5xx) — worth a retry on a later run, not our bug.
     - 'error' → a technical failure you could not resolve.`,
    { label: `repair:${frd}`, phase: 'Review', model: P.judge, effort: 'xhigh', agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}

// ── DR-073 in-place PATCH: fix the specific finding(s) on the EXISTING build, don't rebuild ──────
// On a localized gate reject the build is ~correct except a bounded fault. Discarding a ~99%-correct
// build and rebuilding from scratch wastes a full multi-agent pass AND re-introduces a new micro-bug
// (the WO-07-005 4-cycle non-convergence). So FIRST attempt one in-place patch (a sub-step of
// this reject cycle — NOT a second counter axis; reopen_count is the single budget). The patch agent
// re-gates with the FULL FRD adversarial+integration pass AND a WHOLE-PROJECT knip+biome+tsc (red-team-A:
// a dead export must NOT slip to a sibling FRD; `--since` would have let it).
// DR-107 (personal-page-v2 incident): the old "one shot, then change NOTHING" contract threw away a
// 1-line i18n fix — and with it the whole WO — because the patch's OWN new test file had a trivial
// TS2345. So the patch now carries a SELF-REPAIR budget (fix failures its own edits introduced, up
// to 2 internal cycles) and a DISCRIMINATED give-up verdict (BL-0001): 'code' → the engine reverts;
// 'gate-test-defective' → the engine repairs the reviewer's TEST instead of discarding a correct build.
// Commit + hand to the independent verifier only on whole-project-clean; on give-up it UNDOES its own
// edits so the engine can still revert cleanly.
// WP-08: `mech` is classifyGateFailure()'s verdict for THIS gate cycle. When it says every failing
// sub-gate is mechanical (lint|types|structure|cycles) AND this is patch-1 (no prior diagnosis — a
// diagnosis-guided patch-2 always escalates back to opus, per CONV-12 "escalate upward, never
// downward"), the fix runs on SONNET at effort medium and its INTERNAL self-repair cycles re-gate with
// the scoped `verify.sh --only=… --files=…` instead of a whole-project knip+biome+tsc each time. The
// FINAL certification re-gate below is untouched in either case.
async function attemptPatch(frd, findings, reviewIds, priorDiagnosis = null, mech = null) {
  const scoped = Boolean(SCOPED_REPAIR && mech && mech.mechanical && !priorDiagnosis)
  const patchModel = scoped ? 'sonnet' : 'opus'
  const patchEffort = scoped ? 'medium' : 'xhigh'
  agentSpawned += COST(patchModel)   // A6: patch-2 is weighted like patch-1 (opus=3); WP-08: a mechanical patch-1 is weighted as the sonnet it is
  chargeRepair(frd, patchModel)
  if (scoped) log(`◦ ${frd}: gate-report classes ${mech.classes.join('+')} are MECHANICAL (${mech.subgates.join(', ')}) — patch-1 on sonnet/medium with a scoped inner loop instead of opus/xhigh (WP-08)`)
  const scopeFlags = scoped
    ? `--only=${mech.subgates.join(',')}${mech.files.length ? ` --files=${mech.files.join(',')}` : ''}`
    : ''
  const list = (findings || []).map((x) => `• ${x.wo}: ${x.finding}${x.failingTest ? ` — failing test: ${x.failingTest}` : ''}${x.files && x.files.length ? ` — file(s): ${x.files.join(', ')}` : ''}`).join('\n  ') || '(see the gate output)'
  // A3: patch-2 carries the failed-patch-1 DIAGNOSIS as a hypothesis to VERIFY (re-diagnose against the
  // current code), so the second attempt is guided by why the first missed — never a blind re-try.
  const diagText = priorDiagnosis
    ? `\n  DIAGNOSIS OF WHY PATCH-1 FAILED (A3 — a HYPOTHESIS to verify against the CURRENT code, re-diagnose; it may be wrong): classification=${priorDiagnosis.classification || 'point'}; seam=${priorDiagnosis.seam ? ((priorDiagnosis.seam.files || []).join(', ') + (priorDiagnosis.seam.symbol ? ' @ ' + priorDiagnosis.seam.symbol : '')) : 'n/a'}${priorDiagnosis.seam && priorDiagnosis.seam.why ? ' — ' + priorDiagnosis.seam.why : ''}. Address that seam this time; if it does not match what you observe, follow the code.`
    : ''
  const patchAttemptJournal = JOURNAL(
    `"wo":"%s","frd":"${frd}","attempt":%s,"reopen_count":%s,"rung":"patch","role":"builder","kind":"attempt","classification":"","seam":null,"findingKey":"%s","tried":"%s","verdict":"","why":"%s","confidence":"%s"`,
    ` "<the primary reopened work order you patched, else ${(reviewIds || [])[0] || frd}>" "<its attempt number, an integer>" "<its current reopen_count, an integer>" "<\`<file>::<one-line claim>\` of the primary finding>" "<one line: what you changed>" "<one line: why>" "<low|medium|high>"`)
  return await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'patch' })}Patch-in-place repair (DR-073)${priorDiagnosis ? ' — SECOND diagnosis-guided attempt (A3 patch-2)' : ''}. The build of ${frd} is ~CORRECT EXCEPT these specific findings:
  ${list}${diagText}
  Patch ONLY these on the EXISTING build — do NOT revert, do NOT rebuild from scratch, do NOT touch unrelated files. For each finding, make the RED-proven failing test PASS (production code, never weaken/skip a test). Reviewed work orders this cycle: ${(reviewIds || []).join(', ')}.
  BUILD-JOURNAL (A1): record ONE kind:"attempt" line for this patch (descriptive — verdict stays empty, a patcher never certifies itself):${patchAttemptJournal}
  THEN RE-GATE (this is the safety invariant — a focused gate is NOT enough, red-team-A): run the FULL FRD adversarial + integration tests for ${frd} AND a WHOLE-PROJECT \`pnpm knip\` + \`pnpm biome check .\` + \`pnpm tsc --noEmit\` (NOT \`verify.sh --since\` — a dead export left by the patch must not slip to a sibling FRD's global gate). Everything must be whole-project-clean.
  **SELF-REPAIR BUDGET (DR-107) — a red introduced by YOUR OWN edits does not end the patch:** if the re-gate fails on something YOUR patch just added or touched (a type/lint error in a file you created or edited — e.g. a TS2345 in your own new test file), FIX that and re-gate. You may spend up to 2 such internal fix-and-re-gate cycles. (The real incident this exists for: a 1-line i18n patch was discarded — and its whole work order rebuilt from scratch — because its own new a11y spec had a trivial type error the old contract forbade fixing.)${scoped ? `
  **SCOPED INNER LOOP (WP-08) — for those ≤2 internal cycles ONLY, do NOT re-run the whole project.** The gate report says this failure is confined to ${mech.subgates.join(' + ')}, so re-check with \`bash .pandacorp/verify.sh ${scopeFlags}\` (it runs only those sub-gates, narrows biome to those paths and vitest to their related tests; tsc/knip/madge stay whole-program inside it). Add any file YOU touch to that \`--files\` list as you go. Such a run stamps the gate report \`scope:"partial"\` and CERTIFIES NOTHING — it is a fast inner check, which is exactly why the whole-project RE-GATE above remains mandatory and unscoped before you commit. If a scoped check surfaces a failure OUTSIDE the named sub-gates, stop scoping and go back to the full re-gate.` : ''}
  **If whole-project-clean:** COMMIT the patch (Conventional Commits, scope), staging \`.pandacorp/build-journal.jsonl\` too (append-only — your attempt line) — but do NOT set any WO \`VERIFIED\`, do NOT touch \`reopen_count\`, do NOT advance \`last_green_sha\`/status.yaml: you patched it, so you may not certify it (constitution rule 4, generator ≠ verifier — audit-20). An INDEPENDENT verifier re-runs the gate and stamps. Return { green: true }.
  **If the blocker is a DEFECTIVE reviewer test (BL-0001):** you conclude a blocking adversarial test is INTERNALLY INCONSISTENT or unsatisfiable by ANY correct implementation (e.g. it asserts desktop-only nav visibility without forcing a viewport while the Playwright config runs desktop+mobile) — **or (BL-0051) it is a BLESSED test asserting a contract that a work order of THIS FRD intentionally DEROGATES**, which no correct implementation of the new contract can satisfy either — do NOT edit that test (the patcher never rewrites the reviewer's tests) and do NOT keep bending production code to satisfy it: UNDO all your own edits (restore files you modified, delete files you created — \`git status\` must read as you found it, EXCEPT the append-only \`.pandacorp/build-journal.jsonl\` line, which is a durable record of this attempt and is swept by the engine's next commit — do NOT undo it),${PATCH_RESULT(frd, 'gate-test-defective')} and return { green: false, cause: 'gate-test-defective', defectiveTests: [{ path, why }], failure }. The engine routes it to an independent gate-test repair — not to a revert of the build.
  **If you CANNOT green it in place** (the ORIGINAL build genuinely fails beyond the findings, or your self-repair budget is spent): UNDO all your own edits the same way — leave the tree exactly as you found it (do NOT commit, do NOT revert the WO; the engine reverts cleanly), EXCEPT the append-only \`.pandacorp/build-journal.jsonl\` line (a durable record of this attempt — leave it; the engine's next commit sweeps it),${PATCH_RESULT(frd, 'code-fail')} and return { green: false, cause: 'code', failure: <why> }.`,
    { label: `patch:${frd}`, phase: 'Review', model: patchModel, effort: patchEffort, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}

// ── BL-0001 gate-test repair: when the GATE's own test is the defect, fix the TEST, not the build ──
// The patcher flagged reviewer adversarial test(s) as internally inconsistent. An independent
// reviewer-role agent judges each claim: a genuinely defective test is REPAIRED (the assertion/setup
// corrected to test the FRD's REAL acceptance criterion — coverage is never deleted); an upheld test
// sends the flow back to the normal revert fallback. This is the second exit DR-073 lacked — one
// fallback for two causes meant a defective test could grind a correct build through rebuild loops
// that could never converge (LESSON-0002).
async function repairGateTest(frd, defectiveTests, reviewIds, deadlock) {
  agentSpawned += COST(P.judge)
  // WP-08: charged to the repair budget, but deliberately NEVER refused by it. This path exists to
  // preserve a CORRECT build against a defective/superseded gate test — refusing it would push the
  // flow into a revert + full rebuild, which costs strictly more than the agent the brake just saved.
  chargeRepair(frd, P.judge)
  const list = (defectiveTests || []).map((t) => `• ${t.path}: ${t.why}`).join('\n  ') || '(see the patch output)'
  // BL-0051: the same INDEPENDENT reviewer also owns the DEADLOCK BREAK — when the diagnoser classified
  // `deadlocked-contract`, the flagged test is not internally inconsistent: it asserts a contract a SIBLING
  // work order of this same FRD intentionally derogates (LESSON-0104). Same role, same DR-080 boundary,
  // different framing of the judgment — so the build breaks the cycle itself instead of stopping for a
  // human to hand-edit the blessed test.
  const head = deadlock
    ? `GATE-TEST RE-BLESS — DEADLOCK BREAK (BL-0051) for ${frd}. The diagnoser classified this failure **deadlocked-contract** (confidence ${(deadlock && deadlock.confidence) || 'medium'}): a BLESSED reviewer test still asserts a contract that a work order of THIS SAME FRD intentionally DEROGATES, while the work order that would re-bless it \`dependsOn\` the derogating one — neither can ever go green (LESSON-0104). Diagnosis: ${(deadlock && deadlock.seam && deadlock.seam.why) || (deadlock && deadlock.decisionRecord) || '(see the build journal)'}. The blessed test(s) at issue:`
    : `GATE-TEST REPAIR (BL-0001) for ${frd}. The patch agent flagged these reviewer adversarial test(s) as DEFECTIVE — internally inconsistent, unsatisfiable by ANY correct implementation, or asserting a contract this FRD's own work orders intentionally derogate (BL-0051):`
  return await agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'gate-test-repair' })}${head}
  ${list}
  You are an INDEPENDENT reviewer (you own the gate's tests; the patcher may not touch them). For EACH flagged test, judge the claim on the evidence — do not take the patcher's word:
  - **Genuinely defective** (the assertion contradicts its own setup/config, or no correct implementation of the FRD's acceptance criteria could satisfy it): REPAIR the test so it correctly asserts the FRD's REAL acceptance criterion (fix the assertion/setup — e.g. force the viewport it assumed; NEVER delete the coverage or weaken what the AC requires).
  - **DEROGATED CONTRACT (BL-0051 deadlock break)** (the test is internally consistent, but the contract it encodes was intentionally SUPERSEDED by a work order of THIS FRD): before you accept this, PROVE the derogation is DECLARED — read ${frd}'s \`frd.md\`, its blueprint and the sibling work orders **including their \`dependsOn\` graph**, and confirm a work order states the new contract. Only then RE-BLESS the test: rewrite the assertion(s) to the NEW contract the FRD now specifies (never delete the coverage, never weaken what the acceptance criteria require — the re-blessed test must still FAIL against an implementation that gets the NEW contract wrong). **DR-080 stays intact:** you are the INDEPENDENT reviewer who OWNS this test, which is exactly why this edit is yours and never the implementer's/patcher's. If NO work order declares the derogation, it is not a derogation — fall through to "Actually right".
  - **Actually right** (the build really violates it, or the claimed derogation is undeclared): change NOTHING and return { green: false, cause: 'code', failure: 'test upheld: <why the build is wrong>' } — the engine falls back to the normal revert (or, for a deadlock claim, to the needs-owner block).
  After repairing: re-run the repaired test file(s) + the FULL FRD test files for ${frd} AND whole-project \`pnpm biome check .\` + \`pnpm tsc --noEmit\` against the EXISTING build (work orders this cycle: ${(reviewIds || []).join(', ')}). If everything is clean, COMMIT only the test repair(s) (Conventional Commits, scope; note WHY each test was defective in the commit body) and return { green: true } — an independent verifier still re-runs the objective gate and stamps. If red remains, change nothing further and return { green: false, cause: 'code', failure }.`,
    { label: `gate-test-repair:${frd}`, phase: 'Review', model: P.judge, effort: 'xhigh', agentType: 'pandacorp:reviewer', schema: REPAIR_SCHEMA })
}

// ── Independent post-patch verification (constitution rule 4 — the patcher never certifies itself) ──
// A DIFFERENT agent re-runs the objective gate over the patched build and only IT may stamp VERIFIED +
// advance last_green_sha. Mechanical re-run (the scripts are the oracle), so a worker-model agent suffices.
async function verifyPatched(frd, reviewIds) {
  agentSpawned++
  const resolutionJournal = JOURNAL(
    `"wo":"%s","frd":"${frd}","attempt":%s,"reopen_count":%s,"rung":"verify","role":"verifier","kind":"resolution","classification":"","seam":null,"findingKey":"","tried":"patched in place, independently verified","verdict":"green","why":"%s","confidence":"high"`,
    ` "<the primary patched work order, else ${(reviewIds || [])[0] || frd}>" "<its attempt number, an integer>" "<its reopen_count BEFORE you reset it, an integer>" "<one line: what the patch resolved>"`)
  const verdict = await agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'verify-patch' })}INDEPENDENT post-patch verification for ${frd} (constitution rule 4: the patch agent may not certify its own fix). Re-run the objective gate yourself — trust nothing the patcher reported: the FULL FRD test files for ${frd} — the affected tests — (\`pnpm vitest run\` on them) AND whole-project \`pnpm tsc --noEmit\` + \`pnpm biome check .\`. **Do NOT re-run \`pnpm knip\` here (C1b): attemptPatch already ran the whole-project knip immediately before this step (its dead-export gate, red-team-A) and nothing changed since it committed — re-running knip is a duplicate multi-second whole-project scan for no new signal (the close-out full suite covers it once more at the end).**
  **If everything is clean:** set the patched work orders (${(reviewIds || []).join(', ')}) \`implementation_status: VERIFIED\` and **reset their \`reopen_count: 0\`**; ${SYNC_ROLLUPS} Set last_green_sha and safe_to_test through their current owning transition.${LAST_GREEN_ORDERING} BUILD-JOURNAL (A1) — you are the ONLY agent allowed to record a kind:"resolution" (green) line for this patch (the patcher never certifies itself):${resolutionJournal}${TRACK('review_end', `,"frd":"${frd}","verdict":"pass"`)}${TRACK('frd_end', `,"frd":"${frd}"`)}${GATE_VERDICT(frd, 'pass', `,"passed":${(reviewIds || []).length},"via":"patch"`)}${PATCH_RESULT(frd, 'green')}${ACHIEVEMENT(frd)} Stage .pandacorp/track.jsonl AND .pandacorp/build-journal.jsonl too and commit (Conventional Commits, scope). Return { green: true }.
  **If anything is red:** change NOTHING (no status edits, no commit) and return { green: false, failure: <what failed> } — the engine reverts + reopens.
  **WHOLE-PROJECT ONLY (WP-08 cage):** run the checks above unscoped — never \`verify.sh --only\`/\`--files\`. You are THE certification: a scoped run stamps \`scope:"partial"\` and the engine will refuse your verdict outright.${REPORT_SCOPE_DIRECTIVE}`,
    { label: `verify-patch:${frd}`, phase: 'Review', model: P.worker, agentType: 'pandacorp:reviewer', schema: REPAIR_SCHEMA })
  // WP-08 cage: this agent is one of the two that may stamp VERIFIED + advance last_green_sha. A green
  // claim standing on a PARTIAL gate report is downgraded to a red here, so every caller falls through
  // to exactly the path a genuinely-red verification takes (revert + reopen) — no special-casing.
  if (verdict && verdict.green === true && isPartialReport(verdict)) {
    refusePartial(frd, 'the independent post-patch verification')
    return { ...verdict, green: false, failure: 'verification ran a SCOPED gate (gate-report scope:"partial") — it certifies nothing (WP-08 cage)' }
  }
  return verdict
}

// ── DR-073 fallback: revert + reopen for a clean rebuild (the old DR-070 revert logic) ──
// Runs ONLY when the in-place patch could not green the build. For each reopened WO: set it PLANNED,
// INCREMENT reopen_count (so the non-progress cap can fire), and discard its committed-but-rejected
// code so it does NOT pollute sibling FRDs' WHOLE-PROJECT gate (DR-070) — surgical `git checkout
// <last_green_sha> -- <its files that existed at last green>` + `git rm` newly-created files, NEVER a
// whole-tree hard reset (it would discard verified siblings). Commit the status change + the revert
// together. Reviewer-authored / Status-Note-referenced TEST files are PRESERVED, not deleted (the
// personal-page-v2 revert deleted a green a11y spec the hand-off cited; the reviewer had to re-author
// it blind a pass later). The rebuild happens on opus (reopen_count>=1) — first via the DR-107 in-run
// retry in this same run, else on the next pass.
// A3 PARTIAL REVERT: when the diagnosis says the fault is cleanly separable to a SEAM (opts.seamFiles),
// COMMIT 2 discards ONLY those seam files (not every file the WO touched), still two-commit, still
// increments reopen_count, still preserves reviewer tests, and the wo_reopen event carries reason:"seam".
async function revertAndReopen(frd, reopenIds, opts = {}) {
  agentSpawned += COST(P.judge)
  const seamFiles = (opts.seamFiles && opts.seamFiles.length) ? opts.seamFiles : null
  const reopenReason = seamFiles ? 'seam' : 'gate-reject'
  const revertJournal = JOURNAL(
    `"wo":"%s","frd":"${frd}","attempt":%s,"reopen_count":%s,"rung":"revert","role":"builder","kind":"attempt","classification":"","seam":${seamFiles ? `"${seamFiles.join(', ').replace(/"/g, '')}"` : 'null'},"findingKey":"","tried":"${seamFiles ? 'partial revert (seam only)' : 'full revert'}","verdict":"","why":"%s","confidence":""`,
    ` "<the reopened work order, else ${(reopenIds || [])[0] || frd}>" "<its NEW attempt number after the increment, an integer>" "<its NEW reopen_count after you increment it, an integer>" "<one line: why it was reverted>"`)
  return await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'revert' })}DR-073 fallback — the in-place patch could NOT green ${frd}, so revert + reopen for a clean rebuild${seamFiles ? ' (A3 PARTIAL revert — restricted to the diagnosed seam)' : ''}. Read last_green_sha from .pandacorp/status.yaml. Reopened work orders: ${(reopenIds || []).join(', ')}${seamFiles ? `\n  **SEAM (A3) — the diagnosis isolated the fault to these files ONLY; discard NOTHING else the WO touched, so good work is preserved: ${seamFiles.join(', ')}.**` : ''}
  **WS-D/D12 — do this in TWO commits, in THIS order (crash-safe: never leave a committed IN_REVIEW pointing at code that has been reverted away).**
  **COMMIT 1 — flip the frontmatter FIRST, before any code is removed.** For EACH reopened work order:
     a) Set its frontmatter \`implementation_status: PLANNED\` and **INCREMENT its \`reopen_count\`** (the non-progress cap, DR-072 — so a WO that keeps failing eventually BLOCKS needs-owner instead of grinding).
     b) **EXCEPTION — preserve test evidence (DR-107):** a newly-created TEST file that the reviewer authored or that a \`## Status Note\` references (an adversarial spec, an e2e spec like \`a11y.spec.ts\`) is COVERAGE, not rejected code — do not destroy it. MOVE it to \`.pandacorp/run/preserved-tests/<wo-id>/\` (mkdir -p; gitignored runtime state) instead of deleting it, so the rebuild restores it as its RED baseline (the personal-page-v2 incident: a green 6/6 a11y spec was deleted by a revert and had to be re-authored blind a pass later).
     c) Append one durable reopen line PER reopened work order to ${TRACK_PATH} (fire-and-forget — reopen_count resets to 0 when the WO finally passes, so WITHOUT this line the durable timeline under-reports rework): printf '{"kind":"wo_reopen","frd":"${frd}","wo":"%s","reason":"${reopenReason}","at":"%s"}\\n' "<the-wo-id>" "$(date -u +%FT%TZ)" >> ${TRACK_PATH}.${WO_REOPEN_EVENT(frd, reopenReason)} BUILD-JOURNAL (A1) — record ONE revert line (descriptive attempt; verdict stays empty):${revertJournal}
     ${SYNC_ROLLUPS} **COMMIT this frontmatter flip ALONE** (Conventional Commits, scope; stage \`.pandacorp/build-journal.jsonl\` too, append-only) — now no committed WO claims IN_REVIEW while its code is about to vanish.
  **COMMIT 2 — THEN discard the rejected code.** DR-070 — so it does not pollute sibling FRDs' WHOLE-PROJECT gate: ${seamFiles ? `for the SEAM files ONLY (${seamFiles.join(', ')}) \`git checkout <last_green_sha> -- <those of them that existed at last green>\` and \`git rm\` any of them the WO newly created — leave every OTHER file the WO touched in place (A3 partial revert: the diagnosis proved the fault is confined to the seam).` : `for EACH reopened WO \`git checkout <last_green_sha> -- <its files that existed at last green>\` and \`git rm\` any files it newly created.`} **NEVER a hard reset of the whole tree** (that would discard verified siblings). Leave every other WO (IN_REVIEW or VERIFIED) untouched. **COMMIT the revert** (Conventional Commits, scope).
  Return { green: false } (the engine retries the reopened WOs — in-run first (DR-107), else next pass — from a clean green base).`,
    { label: `revert:${frd}`, phase: 'Review', model: P.judge, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}

// ── Foundation-completeness gate (DR-057 extended) ────────────────────────────
// PREVENT: the foundation = the UNION of EVERY shared primitive any UI surface's mock/fdd
// references. It must be COMPLETE + green BEFORE any surface fans out — otherwise surfaces build
// flat against missing primitives and fail fidelity (the Party regression: Room/AgentSprite/
// StoneBridge/FlowStrip were never in the foundation). Read-only analysis; returns the gaps.
async function foundationCompletenessGate() {
  agentSpawned += COST(P.judge)   // DR-073: judge-model spawn — weighted
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
  agentSpawned += COST(P.judge)   // DR-073: judge-model spawn — weighted
  const list = (missing || []).map((m) => `${m.name}${m.referencedBy && m.referencedBy.length ? ' (needed by ' + m.referencedBy.join(', ') + ')' : ''}${m.suggestedPath ? ' → ' + m.suggestedPath : ''}`).join('; ')
  return await agent(
    `${EMIT('implementer', 'foundation', { phase: 'build', activity: 'repair' })}FOUNDATION AUTO-REPAIR (DR-065), attempt ${foundationRepairs}/${FOUNDATION_REPAIR_CAP}. ${context}. The foundation is INCOMPLETE — these shared primitives that surfaces need are NOT built: ${list || '(see the gate output)'}.
    1) Reset to the last green — SAFELY (DR-072 R3, this prevents wiping verified work): read last_green_sha from .pandacorp/status.yaml, then FIRST verify it is an ANCESTOR of HEAD: \`git merge-base --is-ancestor <last_green_sha> HEAD && echo ANCESTOR || echo ORPHAN\`. **If ANCESTOR:** \`git reset --hard <last_green_sha>\` to discard the flat half-built surfaces (NOT the verified foundation). **If ORPHAN** (the SHA drifted off-branch via reverts / factory commits / an overlay upgrade — a real footgun seen 2026-06-20): do NOT hard-reset (it would discard verified work). Instead surgically discard ONLY the failed surfaces' files — \`git checkout HEAD -- <those surface files>\` and \`git clean -fd <their new dirs>\` — keeping HEAD and every verified commit. If you cannot safely identify exactly which files to discard, STOP: return { green: false, blocked_reason: 'needs-owner', failure: 'last_green_sha orphaned — a hard reset would wipe verified work; the owner must confirm the recovery point' }.
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
    // FAIL-CLOSED (audit P1): only an EXPLICIT `complete === true` verdict lets surfaces fan out. A
    // null/missing/garbled gate result (the agent died or returned nothing) is NOT proof of completeness
    // — reading it as "complete" would ship surfaces against an unverified foundation. So a no-verdict
    // is a BOUNDED retry, then escalate; it is never silently treated as green.
    if (fc && fc.complete === true) { foundationVerified = true; return true }
    if (!fc) {
      // WS-D/D5: a NULL/garbled gate verdict (a dead gate agent) is counted on its OWN separate cap —
      // NOT against foundationRepairs (real repair attempts). A couple of dead gates no longer eat the
      // repair budget, and a run that legitimately needs 2 repairs isn't pre-capped by an earlier dead gate.
      foundationGateNulls++
      // G5b (KNOWN-GAP fix): tolerate FOUNDATION_GATE_NULL_CAP transient nulls (retry), escalate on the NEXT
      // one (`>`, not `>=`) — a couple of dead gate agents no longer hold surfaces that a later ok verdict clears.
      if (foundationGateNulls > FOUNDATION_GATE_NULL_CAP) {
        log(`⊘ Foundation-completeness gate produced no verdict (agent died/invalid) ${foundationGateNulls}x — escalating to the owner (fail-closed)`)
        foundationEscalated = true; return false
      }
      log('⚠ Foundation-completeness gate returned no verdict — NOT treating as complete; re-running (fail-closed)')
      continue
    }
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
let deferredWork = false    // WS-D/D4a: a safe-point drain routed a change's new WOs into an ALREADY-planned FRD
// (they build on a LATER run) — so "all planned FRDs built" is NOT the whole story. Gates release (allDone) on !deferredWork.

function blockFrd(frd, reason) {
  reason = reason || 'error'
  blockedFrds.push(frd)
  blockedReasons[frd] = reason
  if (reason !== 'external') consecutiveBlocks++   // external = not our bug; don't trip the breaker
}

// DR-060: keep wave-parallel work orders DISJOINT. Each WO declares `artifacts` (globs it writes); the
// engine serializes any whose artifacts overlap into different waves, so two agents never race on one
// file (the generalized banner-collision fix). Undeclared artifacts → FAIL-SAFE: a WO that cannot be
// PROVEN disjoint is serialized (never co-scheduled), so an un-migrated WO is correct-but-slower, never
// racy (see artifactsOverlap below, which returns true on an empty artifact set — WS-A/D6 corrected the
// stale "trust the Build Plan" note that once described the opposite, fail-open, behavior).
// Real glob overlap (not a crude prefix match): two globs overlap if one's pattern can match the
// other's concrete representative path (handles `**`, `*`, and extension globs like `Banner.*`).
const globToRe = (g) => new RegExp('^' + String(g)
  .replace(/[.+^${}()|[\]\\]/g, '\\$&')   // escape regex metachars (keep * )
  .replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$')
const globLiteral = (g) => String(g).replace(/\*\*\/?/g, '').replace(/\*/g, '') || '/'  // representative concrete-ish path
const globsOverlap = (x, y) => {
  if (x === y) return true
  return globToRe(x).test(globLiteral(y)) || globToRe(y).test(globLiteral(x))
}
const artifactsOverlap = (a, b) => {
  const A = a.artifacts || [], B = b.artifacts || []
  // FAIL-SAFE (audit P1): a WO with UNDECLARED artifacts can't be proven disjoint, so assume it MAY
  // collide and force serialization (correctness over parallelism) instead of reading "no globs" as
  // "no overlap" (the old back-compat path that let un-migrated WOs race on a shared file). The planner
  // is instructed to infer artifacts (DR-060), so this only bites old/un-migrated WOs — they serialize.
  if (!A.length || !B.length) return true
  return A.some((x) => B.some((y) => globsOverlap(x, y)))
}
// ── WP-01: UI-relevance heuristic for the foundation-completeness gate + end-of-build visual-QA pass ──
// Both passes exist ONLY to protect a visual/UI surface (DR-057 foundation completeness, DR-072 visual
// fidelity) — so they are pointless work on a run whose ready/built work orders are all backend/lib
// (the FRD-24 measurement: 179s + 761s, 24% of a build with artifacts only in src/lib/** and scripts/**).
// Matches the same artifact globs `artifactsOverlap` already reads (WO frontmatter `artifacts:`), so
// no new data source. FAIL-CLOSED the same way as artifactsOverlap (:1300): a WO with UNDECLARED
// artifacts can't be proven UI-free, so it counts as UI-touching (never a silent skip on missing data).
const UI_ARTIFACT_RE = /(^|\/)(src\/app\/|src\/components\/|src\/styles\/|public\/)|\.(tsx|jsx|css|scss|svg|html|mdx)$|design-tokens\.json$|tailwind\.config\.|(^|\/)DESIGN\.md$/
/**
 * True if ANY of the given work orders may touch a UI surface — either because an artifact glob
 * matches `UI_ARTIFACT_RE`, or because the work order declares no artifacts at all (fail-closed,
 * mirrors artifactsOverlap's undeclared-artifacts rule: unprovable is treated as UI-touching, never
 * silently skipped). An empty `wos` list is vacuously false (nothing ready/built to protect).
 */
const artifactsTouchUi = (wos) => wos.some((w) => !(w.artifacts && w.artifacts.length) || w.artifacts.some((a) => UI_ARTIFACT_RE.test(a)))
// REV-D6: artifactsTouchUi's own "empty list is vacuously false" is correct FOR IT (nothing ready/built
// to protect, in isolation) — but its two call sites derive `builtWos` from `frdState.get(frd)`, and an
// EMPTY result there is ambiguous: it means either "this FRD genuinely has no work orders" (fine, vacuous)
// OR "frdState has no entry for an FRD builtFrds says we built" (a data-integrity miss — unreadable, not
// provably UI-free). The two are indistinguishable from the call site, so both must fail closed alike:
// shared by both the lean and legacy close-out dispatch sites, so the fail-closed rule has one home.
const uiPassesRequired = (builtWos) => FORCE_UI_PASSES || !builtWos.length || artifactsTouchUi(builtWos)
// DR-073 cost-weighting (WS-A F1/D2): the wave must respect the COST budget, not a raw WO count —
// each WO spawns COST(model)+1 agents (build + its serialized commit; 3×COST+2 in the split relay),
// so a full opus fan-out used to overshoot maxAgents by ~4× mid-wave (a 6-cap run reached 13). The
// picker stops when EITHER the count cap (P.wave) OR the projected cost budget is reached, but always
// admits at least one WO (progress guarantee — a lone opus WO may exceed a tiny remaining budget; the
// loop-top brake then stops cleanly at the next boundary). costBudget=Infinity ⇒ pure count cap.
const pickDisjointWave = (ready, max, costBudget = Infinity, costOf = () => 1) => {
  const picked = []
  let cost = 1   // the shared dispatch stamp spawns one MECH agent for the whole wave
  for (const w of ready) {
    if (picked.length >= max) break
    if (picked.some((p) => artifactsOverlap(p, w))) continue   // overlaps a picked WO → defer to a later wave
    if (picked.length > 0 && cost + costOf(w) > costBudget) break   // would breach the agent budget → next wave
    picked.push(w)
    cost += costOf(w)
  }
  return picked
}
// Projected agent cost of building ONE work order this wave (mirrors the agentSpawned increments in
// buildWO): solo = COST(worker)+commit; split web relay = 3×COST(worker)+closer+commit.
const woWaveCost = (w) => {
  const m = pickWorkerModel(w)
  return (P.split && plan.hasFrontend) ? 3 * COST(m) + 2 : COST(m) + 1
}

// ── DR-069 SAFE-POINT (in-engine, audit-20 P0-3): every WAVE boundary IS a safe point (BL-0021: was every
// FRD boundary — the scheduler unit changed; C1c: it runs before every WAVE, and is SKIPPED on pure gate-drain
// iterations — a wave is the safe point, and the initial owner-signal check runs pre-loop in the baseline
// pre-check). The ENGINE itself checks the owner's signals here — the change queue, answered decisions, the
// rethink stop — instead of leaving the drain to supervisor prose (a supervisor may not exist, and its own
// safe points are only between passes; an expedite change used to wait a whole multi-hour pass).
// Returns 'stop' when the owner re-planned (rethink_pending), else null.
async function safePoint() {
  agentSpawned++
  const sp = await agent(
    `${RENEW_LEASE} Safe-point check (DR-069/BL-0073) — read the owner's signals; change ONLY what is specified:
    0) Execute exactly \`${INSPECT_STOP}\`. This is the EXCLUSIVE source of truth for the owner stop file. Preserve its JSON output verbatim as \`stop_receipt\`. NEVER use shell \`test\`, \`[\`, \`stat\`, \`ls\`, filesystem aliases, or infer stop from path presence/absence or an exit code. If the command fails or its JSON cannot be returned exactly, throw/fail this safe point and mutate nothing — NEVER guess \`stop:false\`.
    1) Read .pandacorp/status.yaml → set \`stop: true\` iff \`rethink_pending: true\`. Do not derive this field from the stop file; the engine evaluates the fenced \`stop_receipt.stop\` itself.
    2) ${TARGETED ? 'TARGETED BUILD (the owner launched with a specific `change`/`frds` — build ONLY that): do NOT scan the queue for ready changes. Return `ready: []`. Other queued changes are intentionally left for a later bare `/implement`.' : 'List .pandacorp/inbox/changes/*.md (IGNORE the done/ subfolder): collect the slugs whose frontmatter `status` is "ready" — `class: expedite` FIRST, then standard FIFO by date. Skip draft/done/building (a `building` change is already integrated and in flight — never re-drain it, WS-A/D1).'}
    3) Read .pandacorp/inbox/decisions.md: for each decision the owner ANSWERED (via /pandacorp:decide) that resolves blocked work, find the work orders with \`implementation_status: BLOCKED\` + \`blocked_reason: needs-owner\` that the answer unblocks, set each back to \`implementation_status: PLANNED\` (the DR-050 frontmatter signal), and update \`pending_decisions\` in status.yaml to the count still unanswered. Commit those frontmatter edits if you made any.
    Return { stop: <rethink_pending boolean>, stop_receipt: <the exact inspect-stop JSON object>, ready: [...slugs, expedite first], unblocked: [{ frd, wo } for EACH work order you flipped BLOCKED→PLANNED — WS-D/D14, report its OWNING FRD folder so the engine re-enrolls it THIS run] } (empty arrays when there is nothing).`,
    { label: 'safe-point', phase: 'Build', model: MECH, agentType: 'pandacorp:implementer', schema: SAFE_POINT_SCHEMA },
  )
  const receipt = sp && sp.stop_receipt
  if (!receipt || receipt.status_exists !== true || typeof receipt.stop !== 'boolean' || receipt.method !== 'node-lstat') {
    throw new Error('FATAL: recurring safe-point returned an invalid fenced stop receipt; refusing to guess owner stop state')
  }
  if (receipt.stop === true || sp.stop === true) { log('⏸ señal fenced de stop/rethink — el owner re-planificó o detuvo; el motor para en este safe point (la próxima corrida retoma con el plan nuevo)'); return 'stop' }
  // WS-D/D14: the safe point flipped answered-decision BLOCKED WOs to PLANNED — RE-ENROLL them into THIS
  // run's schedule (remove from blockedIds, restore into globalQueue + the FRD's toBuildIds, un-fail the FRD)
  // so the unblock takes effect NOW, not next run. Each item is { frd, wo }.
  if (sp && sp.unblocked && sp.unblocked.length) {
    for (const u of sp.unblocked) {
      if (!u || !u.wo) continue
      blockedIds.delete(u.wo)
      let st = u.frd ? frdState.get(u.frd) : null
      if (!st) { for (const [, s] of frdState) if (s.f.workOrders.some((w) => w.id === u.wo)) { st = s; break } }   // fall back: find the owning FRD
      const woObj = st ? st.f.workOrders.find((w) => w.id === u.wo) : null
      if (st && woObj) {
        woObj.status = 'PLANNED'
        globalQueue.set(u.wo, { wo: woObj, frd: st.f.frd })
        st.toBuildIds.add(u.wo)
        st.failed = false
        st.enqueued = false
        if (!st.reviewIds.includes(u.wo)) st.reviewIds.push(u.wo)
        log(`↺ WO desbloqueado re-enrolado ESTA corrida: ${u.wo} (${st.f.frd}) — se construye en la próxima ola, no en la próxima corrida (WS-D/D14)`)
      } else {
        log(`⚠ WO desbloqueado ${u.wo} no está en el schedule de esta corrida — se construye en la próxima corrida`)
      }
    }
  }
  // DR-069 TARGETED-BUILD SCOPE (owner incident 2026-07-06): a build launched with a specific change/frds
  // implements ONLY its target — the HARD JS guard here is the real enforcement (the prompt already asks
  // the agent to return []; this guarantees it even if a ready item leaks through). Other queued changes
  // wait for a bare `/implement`. Only a bare launch (TARGETED === false) drains the whole ready queue.
  if (TARGETED && sp && sp.ready && sp.ready.length) {
    log(`⊘ Build dirigido — ${sp.ready.length} change(s) ready en cola NO se drenan (solo el objetivo); esperan a un /implement sin objetivo: ${sp.ready.join(', ')}`)
  } else if (!TARGETED && sp && sp.ready && sp.ready.length) {
    log(`⇩ Drenando ${sp.ready.length} change(s) ready de la cola (DR-069): ${sp.ready.join(', ')}`)
    for (const slug of sp.ready) {
      if (capHit()) { log('⛔ Techo de agentes — el resto de la cola espera a la próxima corrida'); break }
      if (drainedThisRun.has(slug)) { log(`⚠ Change '${slug}' ya drenada ESTA corrida pero reaparece 'ready' — el sello 'building' no cuajó; la salto para no re-drenar (WS-D/D9)`); continue }
      const proc = await processChange(slug, 'Build')
      if (!proc || proc.done !== true || !proc.affectedFrds || !proc.affectedFrds.length) { log(`⊘ Change '${slug}' no drenada: ${proc?.failure || 'sin FRDs afectados'}`); continue }
      drainedThisRun.add(slug)   // WS-D/D9: integrated — never re-drain this run even if its 'building' stamp failed to land
      // NEW FRD folders join THIS run's schedule (the global scheduler picks their WOs up next wave).
      // An affected FRD already in the plan builds its new WOs on the NEXT run (its plan entry
      // predates the drain) — honest and bounded, logged so nothing lands silently.
      const newFolders = proc.affectedFrds.filter((x) => !plan.frds.some((pf) => pf.frd === x))
      const existing = proc.affectedFrds.filter((x) => plan.frds.some((pf) => pf.frd === x))
      if (existing.length) { deferredWork = true; log(`↷ Change '${slug}' tocó FRDs ya planificados (${existing.join(', ')}) — sus WOs nuevos se construyen en la PRÓXIMA corrida/pasada (WS-D/D4a: no se declara release esta corrida)`) }
      if (newFolders.length) {
        agentSpawned += COST(P.judge)
        const extra = await agent(
          `Re-plan ONLY these FRD folders (they were just created/updated by a drained change): ${newFolders.join(', ')}. Same contract as the main build planner: read each folder's frd.md + blueprint.md Build Plan + the frontmatter ONLY of every work-orders/wo-*.md, and return { frds: [{ frd, deps, workOrders: [{ id, status, path, acText (the EARS AC lines this WO owns, verbatim from frd.md — DR-108), difficulty, reopen_count, deps, artifacts, foundation, priorAttempts (A4 — if \`${JOURNAL_PATH}\` exists, a bounded digest [{attempt, classification, findingKey, tried, why}] of the last 2 attempts on this WO; [] otherwise), summary }] }] } in Build Plan order. Read-only.`,
          { label: `plan-drained:${slug}`, phase: 'Build', model: P.judge, agentType: 'pandacorp:architect', schema: PLAN_SCHEMA },
        )
        if (extra && extra.frds && extra.frds.length) { for (const nf of extra.frds) { plan.frds.push(nf); enrollFrd(nf) } detectCycles(); log(`＋ FRDs de la change añadidos a esta corrida: ${extra.frds.map((x) => x.frd).join(', ')}`) }
      }
    }
  }
  return null
}

// ── BL-0129: pre-loop DR-069 drain for a BARE run's empty-plan early exit ────────────────────────
// safePoint() above is the IN-LOOP drain — it closes over loop-scoped state (frdState, globalQueue,
// enrollFrd, detectCycles) that is declared further down and does not exist yet before the scheduler
// loop is built, so calling safePoint() itself from the pre-loop 'nothing to build' branch would throw
// (temporal dead zone on those bindings). This sibling reuses the SAME fenced stop-receipt check and the
// SAME SAFE_POINT_SCHEMA as safePoint()'s prompt (only the queue-listing step — a bare run never has
// answered-decision unblocks to re-enroll here: an empty plan means no BLOCKED work orders exist at all),
// and drains via the existing processChange() — never reimplementing that FRD/WO-creation prose. It does
// NOT splice new FRDs into an in-flight schedule (there isn't one yet); the caller re-runs runPlanner()
// from scratch instead. Called ONLY for a bare run (never TARGETED — that scope forbids the drain,
// unchanged) and only when plan.frds.length === 0.
async function drainReadyQueuePreLoop() {
  agentSpawned++
  const sp = await agent(
    `${RENEW_LEASE} Pre-build safe-point check (DR-069/BL-0129) — read the owner's signals; change ONLY what is specified:
    0) Execute exactly \`${INSPECT_STOP}\`. This is the EXCLUSIVE source of truth for the owner stop file. Preserve its JSON output verbatim as \`stop_receipt\`. NEVER use shell \`test\`, \`[\`, \`stat\`, \`ls\`, filesystem aliases, or infer stop from path presence/absence or an exit code. If the command fails or its JSON cannot be returned exactly, throw/fail this safe point and mutate nothing — NEVER guess \`stop:false\`.
    1) Read .pandacorp/status.yaml → set \`stop: true\` iff \`rethink_pending: true\`. Do not derive this field from the stop file; the engine evaluates the fenced \`stop_receipt.stop\` itself.
    2) List .pandacorp/inbox/changes/*.md (IGNORE the done/ subfolder): collect the slugs whose frontmatter \`status\` is "ready" — \`class: expedite\` FIRST, then standard FIFO by date. Skip draft/done/building (a \`building\` change is already integrated and in flight — never re-drain it, WS-A/D1).
    Return { stop: <rethink_pending boolean>, stop_receipt: <the exact inspect-stop JSON object>, ready: [...slugs, expedite first], unblocked: [] } (empty arrays when there is nothing).`,
    { label: 'safe-point-pre-loop', phase: 'Plan', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: SAFE_POINT_SCHEMA },
  )
  const receipt = sp && sp.stop_receipt
  if (!receipt || receipt.status_exists !== true || typeof receipt.stop !== 'boolean' || receipt.method !== 'node-lstat') {
    throw new Error('FATAL: pre-loop safe-point returned an invalid fenced stop receipt; refusing to guess owner stop state')
  }
  if (receipt.stop === true || sp.stop === true) {
    log('⏸ señal fenced de stop/rethink en el drenado previo al plan — el owner re-planificó o detuvo; el motor para antes de construir.')
    return { stop: true, drained: false }
  }
  if (!sp.ready || !sp.ready.length) return { stop: false, drained: false }
  log(`⇩ Drenando ${sp.ready.length} change(s) ready de la cola antes de declarar "nothing to build" (BL-0129/DR-069): ${sp.ready.join(', ')}`)
  let drained = false
  for (const slug of sp.ready) {
    if (capHit()) { log('⛔ Techo de agentes — el resto de la cola espera a la próxima corrida'); break }
    if (drainedThisRun.has(slug)) { log(`⚠ Change '${slug}' ya drenada ESTA corrida pero reaparece 'ready' — el sello 'building' no cuajó; la salto (WS-D/D9)`); continue }
    const proc = await processChange(slug, 'Plan')
    if (!proc || proc.done !== true || !proc.affectedFrds || !proc.affectedFrds.length) { log(`⊘ Change '${slug}' no drenada: ${proc?.failure || 'sin FRDs afectados'}`); continue }
    drainedThisRun.add(slug)   // WS-D/D9 backstop: never re-drain this run even if the 'building' stamp failed to land
    drained = true
  }
  return { stop: false, drained }
}

// ── A2 DIAGNOSE (progressive-learning recovery) — read-only reviewer, judge model ────────────────
// Spawned ONLY when an in-place patch fails with cause:'code' AND we are not at the agent ceiling. It
// classifies the failure and recommends the CHEAPEST safe recovery so the ladder can stop EARLIER than
// the reopen cap on a doomed spec (never later — the cap is still the hard bound). It re-checks priors
// adversarially against the CURRENT code (poison self-purge) and writes its OWN kind:"diagnosis" line.
async function diagnoseFailure(frd, gate, reviewIds) {
  agentSpawned += COST(P.judge)   // A6: the diagnoser runs on the judge model — weighted
  chargeRepair(frd, P.judge)          // WP-08: part of the repair ladder — charged to this FRD's repair budget
  const findingsList = (gate.findings || []).map((x) => `• ${x.wo}: ${x.finding}${x.files && x.files.length ? ` [${x.files.join(', ')}]` : ''}`).join('\n  ') || '(see the gate output)'
  const diagJournal = JOURNAL(
    `"wo":"%s","frd":"${frd}","attempt":%s,"reopen_count":%s,"rung":"diagnose","role":"diagnoser","kind":"diagnosis","classification":"%s","seam":%s,"findingKey":"%s","tried":"","verdict":"","why":"%s","confidence":"%s"`,
    ` "<the primary reopened work order, else ${(gate.reopen || [])[0] || frd}>" "<its attempt number, an integer>" "<its current reopen_count, an integer>" "<point|architectural|gate-test-defective|deadlocked-contract>" "<a compact JSON object {\\"files\\":[...],\\"symbol\\":\\"...\\",\\"why\\":\\"...\\"} or the bare token null>" "<\`<file>::<one-line claim>\` of the fault>" "<one line: your diagnosis>" "<low|medium|high>"`)
  return await agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'diagnose' })}DIAGNOSE (A2, progressive-learning recovery) for ${frd}. An in-place patch just FAILED to green the build (cause: code). You are a READ-ONLY diagnoser — change NOTHING, write no tests, fix nothing, run no revert. Read the CURRENT code, the failing gate findings, the reopened work orders (${(gate.reopen || []).join(', ')}), and the prior attempts recorded in ${JOURNAL_PATH} (if it exists). Findings:
  ${findingsList}
  Classify the failure and recommend the CHEAPEST SAFE recovery. RULES:
  - A diagnosis with NO file:line anchor is confidence:low and CANNOT justify a block or an 'architectural' classification. **Default to 'point' unless the evidence forces otherwise.**
  - Adversarially RE-CHECK every prior diagnosis in the journal against the CURRENT code — any you cannot reproduce NOW goes in \`supersededPriors\` (poison self-purge), and is NOT counted as a recurrence.
  - classification signals: **architectural** = findings spread over MORE than ${FINDING_SPREAD_THRESHOLD} files, OR the same \`findingKey\` recurring across >= 2 attempts (read the journal), OR an acceptance criterion that is unsatisfiable against the blueprint. **deadlocked-contract** = a blessed/preserved test asserts a contract that a SIBLING work order (a \`dependsOn\` relation) intentionally derogates (LESSON-0104). When you classify this, \`seam.files\` MUST list the BLESSED TEST file(s) that encode the superseded contract (not the production files) — the engine hands exactly those to an INDEPENDENT gate-test reviewer to RE-BLESS them to the derogated contract (BL-0051), so a wrong seam sends the wrong file for repair; in the decisionRecord, still recommend folding the derogation + the re-bless into ONE work order so the next plan cannot re-create the deadlock. **gate-test-defective** = a reviewer adversarial test is internally inconsistent / unsatisfiable by any correct implementation (route to the existing gate-test repair). **Otherwise → point** (a bounded fault).
  - \`seam\`: the file(s)/symbol the fault localizes to, \`why\`, and \`cleanlySeparable\` (true iff reverting ONLY those files cleanly isolates the fault WITHOUT unwinding good work — this gates the PARTIAL revert).
  - \`repeatsPrior\`: true iff this SAME fault (\`findingKey\`) already appears in the journal for this WO on a prior attempt, AFTER your \`supersededPriors\` purge.
  - \`recommendation\` ∈ patch | partial-revert | full-revert | block-needs-owner. Recommend **block-needs-owner ONLY** for architectural/deadlocked-contract at confidence medium|high (never on a weak diagnosis) — note that for deadlocked-contract the engine first attempts the independent gate-test RE-BLESS (BL-0051) and only blocks if that claim does not hold.
  - \`decisionRecord\`: a SPANISH, owner-facing paragraph (what keeps failing, your diagnosis, what the owner must decide) — meaningful when you recommend block-needs-owner; a one-liner otherwise.
  BUILD-JOURNAL (A1) — record YOUR kind:"diagnosis" line (you are the diagnoser; this is the trust-split's diagnosis half):${diagJournal}
  Return { classification, seam, repeatsPrior, supersededPriors, recommendation, decisionRecord, confidence }.`,
    { label: `diagnose:${frd}`, phase: 'Review', model: P.judge, effort: 'high', agentType: 'pandacorp:reviewer', schema: DIAGNOSE_SCHEMA })
}

// ── A3 EARLY BLOCK needs-owner — a diagnosed doomed spec (architectural/deadlocked-contract, med|high) ──
// Full revert + set the reopened WOs BLOCKED needs-owner + file the Spanish decisionRecord (with the
// journal digest inlined) so the engine does NOT burn the remaining reopens on a spec only the owner can fix.
async function blockEarlyNeedsOwner(frd, reopenIds, diag) {
  agentSpawned += COST(P.judge)
  const cls = (diag && diag.classification) || 'architectural'
  const conf = (diag && diag.confidence) || 'high'
  const record = (diag && diag.decisionRecord) || `El gate rechaza repetidamente ${frd} y el diagnóstico lo clasifica como ${cls} (confianza ${conf}) — no es un fallo puntual que el motor pueda arreglar solo; requiere una decisión del owner.`
  return await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'block' })}EARLY BLOCK needs-owner (A3 progressive-learning recovery) for ${frd}. The diagnoser classified this failure as **${cls}** (confidence ${conf}) — a doomed spec; burning the remaining reopens on it cannot help. Do NOT retry, do NOT patch. Steps:
  1) Read last_green_sha from .pandacorp/status.yaml and DISCARD the rejected code for the reopened work orders (${(reopenIds || []).join(', ')}): \`git checkout <last_green_sha> -- <their files that existed at last green>\` and \`git rm\` any files they newly created. **NEVER a whole-tree hard reset** (it would discard verified siblings). PRESERVE reviewer-authored / Status-Note-referenced TEST files — MOVE them to \`.pandacorp/run/preserved-tests/<wo-id>/\` (DR-107), do not delete.
  2) Set EACH reopened work order's frontmatter \`implementation_status: BLOCKED\` + \`blocked_reason: needs-owner\`; ${SYNC_ROLLUPS} Bump pending_decisions through its current owning transition.
  3) Append the owner-facing DECISION RECORD to .pandacorp/inbox/decisions.md (SPANISH) — what the gate keeps rejecting, the diagnosis, and exactly what the owner must decide — and INLINE the build-journal digest for this WO: read the last few ${JOURNAL_PATH} lines for ${(reopenIds || [])[0] || frd} and summarize the attempt/diagnosis history so the owner sees how it got here. The record: ${record}
  4) COMMIT (Conventional Commits, scope) staging the frontmatter flip, the code revert, decisions.md, status.yaml AND \`.pandacorp/build-journal.jsonl\` (append-only — sweeps the diagnosis line).${GATE_VERDICT(frd, 'blocked', `,"blocked_reason":"needs-owner"`)}${NOTIFY('FRD ' + frd + ' bloqueado (diagnóstico ' + cls + ') — necesita tu decisión')}
  Return { green: false, blocked_reason: 'needs-owner' }.`,
    { label: `block-needs-owner:${frd}`, phase: 'Review', model: P.judge, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}

// ── DR-107 in-run retry (bounded, budgeted) — extracted so the A3 ladder can thread a diagnosis in ──
// Runs AFTER a revert (full or partial): rebuilds the reopened WOs NOW from the clean green base (opus,
// reopen_count>=1) instead of paying a whole extra pass. `priorDiagnosis` (optional) is threaded into the
// rebuild via the wo object (_priorDiagnosis, injected by woCtx). Behaviour for the legacy call
// (priorDiagnosis omitted) is byte-equivalent to the old inline retry. Returns 'built' | 'reopened' | 'blocked'.
async function inRunRetry(f, reopenIds, reviewIds, priorDiagnosis = null) {
  const retryWos = f.workOrders.filter((w) => reopenIds.includes(w.id)).map((w) => ({ ...w, reopen_count: (w.reopen_count || 0) + 1, _isRetry: true, _priorDiagnosis: priorDiagnosis }))
  const canRetry = !capHit() && retryWos.length > 0 && retryWos.every((w) => w.reopen_count < MAX_REOPENS)
  if (!canRetry) { reopenedFrds.push(f.frd); return 'reopened' }
  // D4: the in-run retry rebuilds EVERY reopened WO on OPUS (reopen_count>=1) — the single PRICIEST
  // rung of the recovery ladder (its true cost scales with retryWos.length, unlike the single-agent
  // patch/diagnose rungs), and EVERY branch above (gate-test-defective fallback, patch-2 failure,
  // the (d)/(e) partial/full-revert branches, the legacy fallback) funnels through this one function, so
  // ONE check here covers all of them instead of duplicating it at each call site. Refuse BEFORE
  // spawning the rebuild when the FRD can no longer afford the FULL projected cost (never mid-rebuild —
  // see the per-WO chargeRepair below).
  if (!capHit() && !canAffordRepair(f.frd, 'opus', retryWos.length)) {
    log(`⊘ ${f.frd}: presupuesto de reparación agotado antes del in-run retry (${repairCostByFrd.get(f.frd) || 0} + ${COST('opus') * retryWos.length} > ${repairBudget(f.frd)} unidades = ${REPAIR_BUDGET_FACTOR}× el coste de construirlo) — repair budget exhausted (WP-08/D4)`)
    await blockRepairBudgetExhausted(f.frd, reopenIds, null)
    blockFrd(f.frd, 'needs-owner')
    return 'blocked'
  }
  // WS-D/D6: BUDGET the in-run retry against the remaining maxAgents allowance (each reopened WO now
  // rebuilds on OPUS — reopen_count>=1 — so its cost is real). No ≥1 progress guarantee here: if not even
  // the first fits, defer ALL to the next pass. The loop-top brake stops the run cleanly at the next boundary.
  let budgetedRetry = retryWos
  if (MAX_AGENTS) {
    const remaining = MAX_AGENTS - agentSpawned
    const affordable = []
    let spent = 0
    for (const w of retryWos) { const c = woWaveCost(w); if (spent + c > remaining) break; affordable.push(w); spent += c }
    budgetedRetry = affordable
  }
  if (budgetedRetry.length === 0) {
    log(`↩ ${f.frd}: in-run retry deferred — the reopened WO(s) don't fit the remaining agent budget (${MAX_AGENTS ? MAX_AGENTS - agentSpawned : '∞'}); they rebuild next pass (WS-D/D6)`)
    reopenedFrds.push(f.frd); return 'reopened'
  }
  if (budgetedRetry.length < retryWos.length) log(`↻ ${f.frd}: in-run retry trimmed to fit the agent budget — ${budgetedRetry.map((w) => w.id).join(', ')} now; the rest rebuild next pass (WS-D/D6)`)
  log(`↻ ${f.frd}: in-run retry (DR-107) — rebuilding ${budgetedRetry.map((w) => w.id).join(', ')} from the clean base now (opus)${priorDiagnosis ? ' with the diagnosis threaded (A3)' : ''} instead of paying a whole extra pass`)
  for (const w of budgetedRetry) { chargeRepair(f.frd, 'opus'); await buildWO(w, f.frd) }
  const regate = await frdGate(f.frd, reviewIds)
  // WP-08 cage: the in-run retry's re-gate is a certification too — a partial one certifies nothing.
  if (regate && regate.green === true && isPartialReport(regate)) { refusePartial(f.frd, "the in-run retry's re-gate"); reopenedFrds.push(f.frd); return 'reopened' }
  if (regate && regate.green === true) { await applyGate(f.frd, reviewIds, regate.testFiles, null); log(`✓ ${f.frd} VERIFIED (in-run retry)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
  if (regate && regate.reopen && regate.reopen.length) await revertAndReopen(f.frd, regate.reopen)
  log(`↻ ${f.frd}: in-run retry did not converge — deferred to the next pass`)
  reopenedFrds.push(f.frd); return 'reopened'
}

// ── FRD gate + convergence (DR-072/073/107, BL-0001) — one FRD, run on a QUIET tree ──────────────
// Extracted verbatim from the old per-FRD loop (BL-0021): the global scheduler calls this serially at
// wave boundaries, so the gate's whole-project checks never see another FRD's in-flight work.
// Returns 'built' | 'reopened' | 'blocked'; updates builtFrds/blockedFrds/reopenedFrds/consecutiveBlocks.
async function gateAndConverge(f, reviewIds) {
  // C2 legacy fallback (worktree unavailable): the gate runs synchronously on the (quiet) main tree, then
  // converges inline — the pre-C2 topology, one gate per loop iteration.
  const gate = await frdGate(f.frd, reviewIds)
  return await gateConverge(f, reviewIds, gate)
}

// C2: the convergence continuation. Fed a gate verdict (from the concurrent worktree gate via the harvest,
// or from an inline re-gate on the quiesced main tree). On green it APPLIES inline (sourceDir null — the gate
// ran on main). On a reject it runs the DR-072/073/107 + BL-0001 recovery ladder — byte-for-byte the pre-C2
// gateAndConverge body. The CONCURRENT PASS path never reaches here (the harvest applies from the worktree).
async function gateConverge(f, reviewIds, gate) {
  phase('Review')
  // WP-08 cage, at the certification boundary: a gate that ran `--only`/`--files` stamped its report
  // `scope:"partial"` and is NOT an oracle for this FRD. Refuse BEFORE the apply step is even spawned,
  // and defer the FRD for a full re-gate — never stamp, never advance last_green_sha.
  if (gate && gate.green === true && isPartialReport(gate)) {
    refusePartial(f.frd, 'the FRD gate')
    reopenedFrds.push(f.frd); return 'reopened'
  }
  if (gate && gate.green === true) {
    const applied = await applyGate(f.frd, reviewIds, gate.testFiles, null)
    if (!applied) { log(`↻ ${f.frd}: the serialized apply step did not confirm the stamp — NOT marking it verified; it re-gates next pass`); reopenedFrds.push(f.frd); return 'reopened' }
    log(`✓ ${f.frd} VERIFIED`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built'
  }
  // DR-073 PATCH-FIRST: a localized reject defaults to an in-place patch on the EXISTING build (inject
  // the finding + the RED-proven failing test), re-gated WHOLE-PROJECT — NOT a revert-and-rebuild. The
  // patch runs SYNCHRONOUSLY inside this FRD's gate step (before the loop moves to sibling FRDs), and it
  // VERIFIES only on whole-project-clean, so a sibling never sees broken committed code. Three exits:
  // (1) patch greens → independent verify stamps; (2) the patch flags the GATE's own test as defective →
  // gate-test repair (BL-0001), never a rebuild of correct work; (3) genuine code fault → revert+reopen
  // (DR-070) and then the DR-107 IN-RUN RETRY: rebuild the reopened WOs NOW from the clean base (opus —
  // reopen_count>=1) instead of deferring to the next pass, which re-pays the whole fixed overhead
  // (baseline + full re-plan + sync + safe-points). reopen_count stays the single budget: the patch
  // doesn't touch it; each revert increments it; the reopen cap still ends the grind.
  if (gate && gate.reopen && gate.reopen.length) {
    let patchFailNote = ''
    let patchesThisCycle = 0
    // WP-08 (a): classify the failing SUB-GATE deterministically from the gate report, BEFORE any model
    // is asked anything. This picks the fixer's MODEL and its inner-loop SCOPE — it never decides fault
    // (the patcher's own cause:'gate-test-defective' discrimination is untouched, LESSON-0002).
    const mech = SCOPED_REPAIR ? classifyGateFailure(gate) : null
    const patched = await attemptPatch(f.frd, gate.findings || [], reviewIds, null, mech)
    patchesThisCycle = 1   // patch-1 spent (A3 PATCH_ATTEMPT_CAP counts patches THIS gate cycle)
    if (patched && patched.green === true) {
      // Constitution rule 4 (audit-20): the patcher claimed green — an INDEPENDENT agent re-runs the
      // gate and is the only one allowed to stamp VERIFIED + advance last_green_sha.
      const iv = await verifyPatched(f.frd, reviewIds)
      if (iv && iv.green === true) { log(`✓ ${f.frd} VERIFIED (patched in place, independently verified)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
      patchFailNote = `patch claimed green but the independent verification FAILED (${iv?.failure || 'red'})`
    } else if (patched && patched.cause === 'gate-test-defective' && (patched.defectiveTests || []).length) {
      // BL-0001 second fallback: the gate's own adversarial test is the defect — repair the TEST,
      // never discard a correct build over an unsatisfiable assertion (LESSON-0002).
      log(`⚖ ${f.frd}: patch flagged defective gate test(s) (${patched.defectiveTests.map((t) => t.path).join(', ')}) — repairing the TEST, not rebuilding (BL-0001)`)
      const tr = await repairGateTest(f.frd, patched.defectiveTests, reviewIds)
      if (tr && tr.green === true) {
        const iv2 = await verifyPatched(f.frd, reviewIds)
        if (iv2 && iv2.green === true) { log(`✓ ${f.frd} VERIFIED (defective gate test repaired, independently verified)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
        patchFailNote = `gate-test repair greened but the independent verification failed (${iv2?.failure || 'red'})`
      } else patchFailNote = `gate-test claim not upheld (${tr?.failure || 'test was right — the build is wrong'})`
    } else if (patched && patched.cause === 'code' && !capHit() && !canAffordRepair(f.frd, P.judge)) {
      // WP-08 (d): patch-1 failed on real code and the repair budget is gone. Stopping HERE is the whole
      // point — one more diagnosis + patch-2 is exactly the spend the brake exists to refuse.
      log(`⊘ ${f.frd}: presupuesto de reparación agotado (${repairCostByFrd.get(f.frd) || 0} > ${repairBudget(f.frd)} unidades = ${REPAIR_BUDGET_FACTOR}× el coste de construirlo) — repair budget exhausted, honest needs-owner exit with the work preserved (WP-08)`)
      await blockRepairBudgetExhausted(f.frd, gate.reopen, gate)
      blockFrd(f.frd, 'needs-owner')
      return 'blocked'
    } else if (patched && patched.cause === 'code' && !capHit()) {
      // ── A3 PROGRESSIVE-LEARNING RECOVERY LADDER ───────────────────────────────────────────────────
      // patch-1 failed on real code AND we have agent budget → DIAGNOSE and route to the CHEAPEST safe
      // recovery. Every branch RETURNS; the classification can only stop EARLIER than the reopen cap,
      // never later (reopen_count stays the hard budget). A weak (confidence:low) diagnosis never blocks.
      const diag = await diagnoseFailure(f.frd, gate, reviewIds)
      const cls = (diag && diag.classification) || 'point'
      const conf = (diag && diag.confidence) || 'low'
      const repeats = Boolean(diag && diag.repeatsPrior)
      const seam = (diag && diag.seam) || null
      const cleanlySeparable = Boolean(seam && seam.cleanlySeparable && seam.files && seam.files.length)
      // (a) gate-test-defective → the existing gate-test repair path (never a rebuild of correct work)
      if (cls === 'gate-test-defective') {
        const defectiveTests = (seam && seam.files && seam.files.length)
          ? seam.files.map((p) => ({ path: p, why: seam.why || 'diagnosed gate-test-defective (A2)' }))
          : [{ path: '(see the diagnosis)', why: (seam && seam.why) || 'diagnosed gate-test-defective (A2)' }]
        log(`⚖ ${f.frd}: diagnosis = gate-test-defective — repairing the TEST, not rebuilding (A2→BL-0001)`)
        const tr = await repairGateTest(f.frd, defectiveTests, reviewIds)
        if (tr && tr.green === true) {
          const iv = await verifyPatched(f.frd, reviewIds)
          if (iv && iv.green === true) { log(`✓ ${f.frd} VERIFIED (diagnosed defective gate test repaired)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
        }
        log(`↻ ${f.frd}: gate-test repair from diagnosis did not green — full revert + retry`)
        await revertAndReopen(f.frd, gate.reopen)
        return await inRunRetry(f, gate.reopen, reviewIds, diag)
      }
      // (b0) BL-0051 DEADLOCK BREAK — a BLESSED reviewer test asserts a contract a work order of this
      // same FRD intentionally derogates, and the work order that would re-bless it `dependsOn` the
      // derogating one (LESSON-0104): WO-B cannot run until WO-A verifies, and WO-A cannot verify while
      // the blessed test encodes the pre-change contract. Circular. Blocking here is what forced a human
      // to hand-edit the blessed test — the exact DR-080-sensitive action the automation is supposed to
      // own. So route it to the INDEPENDENT gate-test-repair reviewer (who OWNS the gate's tests; the
      // implementer still never touches them) to RE-BLESS the derogated contract. Fail-closed: a claim
      // the reviewer does NOT uphold, or a re-bless the independent verifier cannot confirm, still lands
      // on the needs-owner block — this breaks a deadlock, it never rubber-stamps a red build.
      if (cls === 'deadlocked-contract' && (conf === 'medium' || conf === 'high')) {
        const blessedTests = (seam && seam.files && seam.files.length)
          ? seam.files.map((path) => ({ path, why: (seam && seam.why) || 'asserts a contract a sibling work order of this FRD intentionally derogates (deadlocked-contract)' }))
          : [{ path: '(see the diagnosis)', why: (seam && seam.why) || 'asserts a contract a sibling work order of this FRD intentionally derogates (deadlocked-contract)' }]
        log(`⚖ ${f.frd}: diagnosis = deadlocked-contract (confidence ${conf}) — breaking the deadlock via the INDEPENDENT gate-test RE-BLESS instead of stopping for a manual unblock (BL-0051)`)
        const tr = await repairGateTest(f.frd, blessedTests, reviewIds, diag)
        if (tr && tr.green === true) {
          const iv = await verifyPatched(f.frd, reviewIds)
          if (iv && iv.green === true) { log(`✓ ${f.frd} VERIFIED (deadlocked contract re-blessed by the independent reviewer, independently verified)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
          log(`⊘ ${f.frd}: the re-bless greened but the independent verification failed (${iv?.failure || 'red'}) — BLOCK needs-owner (BL-0051 fail-closed)`)
        } else log(`⊘ ${f.frd}: the blessed test was UPHELD (${tr?.failure || 'no declared derogation'}) — BLOCK needs-owner (BL-0051 fail-closed)`)
        await blockEarlyNeedsOwner(f.frd, gate.reopen, diag)
        blockFrd(f.frd, 'needs-owner')
        return 'blocked'
      }
      // (b) architectural at confidence medium|high → EARLY BLOCK needs-owner: do NOT burn the remaining
      // reopens on a spec only the owner can fix. (A deadlocked-contract only reaches here at
      // confidence:low, which falls through to 'point' like any other weak diagnosis.)
      if (cls === 'architectural' && (conf === 'medium' || conf === 'high')) {
        log(`⊘ ${f.frd}: diagnosis = ${cls} (confidence ${conf}) — early BLOCK needs-owner, NOT burning the remaining reopens on a doomed spec (A3)`)
        await blockEarlyNeedsOwner(f.frd, gate.reopen, diag)
        blockFrd(f.frd, 'needs-owner')
        return 'blocked'
      }
      // confidence:low architectural/deadlocked falls through and is treated as 'point' (never block on a weak diagnosis).
      // (c) point + NOT repeatsPrior + patch budget left → PATCH-2, diagnosis-guided.
      if (!repeats && patchesThisCycle < PATCH_ATTEMPT_CAP && !canAffordRepair(f.frd, 'opus')) {
        // WP-08 (d): the diagnosis fit the budget but patch-2 does not. Same honest exit.
        log(`⊘ ${f.frd}: presupuesto de reparación agotado antes del patch-2 (${repairCostByFrd.get(f.frd) || 0} + ${COST('opus')} > ${repairBudget(f.frd)} unidades = ${REPAIR_BUDGET_FACTOR}× el coste de construirlo) — repair budget exhausted (WP-08)`)
        await blockRepairBudgetExhausted(f.frd, gate.reopen, gate)
        blockFrd(f.frd, 'needs-owner')
        return 'blocked'
      }
      if (!repeats && patchesThisCycle < PATCH_ATTEMPT_CAP) {
        patchesThisCycle++
        log(`↺ ${f.frd}: diagnosis = point (fresh) — patch-2 (${patchesThisCycle}/${PATCH_ATTEMPT_CAP}), diagnosis-guided (A3)`)
        const patched2 = await attemptPatch(f.frd, gate.findings || [], reviewIds, diag)
        if (patched2 && patched2.green === true) {
          const iv = await verifyPatched(f.frd, reviewIds)
          if (iv && iv.green === true) { log(`✓ ${f.frd} VERIFIED (patch-2 diagnosis-guided, independently verified)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
          log(`↻ ${f.frd}: patch-2 greened but the independent verification failed (${iv?.failure || 'red'}) — full revert + retry`)
        } else {
          log(`↻ ${f.frd}: patch-2 did not green (${patched2?.failure || 'no verdict'}) — full revert + retry`)
        }
        await revertAndReopen(f.frd, gate.reopen)
        return await inRunRetry(f, gate.reopen, reviewIds, diag)
      }
      // (d) point + repeatsPrior + cleanlySeparable → PARTIAL revert (seam files ONLY) + retry.
      if (repeats && cleanlySeparable) {
        log(`↩ ${f.frd}: diagnosis = point, repeats a prior fault, cleanly separable — PARTIAL revert restricted to the seam (${seam.files.join(', ')}) + retry (A3)`)
        await revertAndReopen(f.frd, gate.reopen, { seamFiles: seam.files })
        return await inRunRetry(f, gate.reopen, reviewIds, diag)
      }
      // (e) point + repeatsPrior + NOT cleanlySeparable (or patch budget spent) → full revert + retry, diagnosis threaded.
      log(`↻ ${f.frd}: diagnosis = point${repeats ? ', repeats a prior fault, not cleanly separable' : ''} — full revert + retry with the diagnosis threaded (A3)`)
      await revertAndReopen(f.frd, gate.reopen)
      return await inRunRetry(f, gate.reopen, reviewIds, diag)
    } else {
      // capHit code-fail (honest degrade — no diagnosis at the ceiling, A3), or a no-verdict patch.
      patchFailNote = `in-place patch did not green (${patched?.failure || 'no verdict'}${patched && patched.cause === 'code' && capHit() ? '; agent ceiling reached — skipping the A3 diagnosis, legacy revert (honest degrade)' : ''})`
    }
    // Legacy fallback (verify-failed, gate-test-not-upheld, capHit code-fail, no-verdict): revert + in-run
    // retry with NO diagnosis — byte-equivalent to the pre-A3 path (DR-107).
    log(`↻ ${f.frd}: ${patchFailNote} — reverting + reopening`)
    await revertAndReopen(f.frd, gate.reopen)
    return await inRunRetry(f, gate.reopen, reviewIds)
  }

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
      reopenedFrds.push(f.frd); return 'reopened'   // the repair reset surfaces to the last green (→ PLANNED); next pass rebuilds them
    }
    log(`⊘ ${f.frd}: foundation auto-repair failed — falling through to block`)
  }

  // DR-072 C1 — the gate already CLASSIFIED a block (needs-owner from the reopen-cap / a human decision,
  // or external/transient): do NOT waste a repair pass + a second xhigh re-gate on it (a human or an
  // outside fix is required — a repair can't help). This is what makes the non-progress stop actually
  // STOP instead of grinding another full cycle per capped FRD every run. 'error' still falls through to repair.
  if (gate && (gate.blocked_reason === 'needs-owner' || gate.blocked_reason === 'external')) {
    log(`⊘ ${f.frd}: gate classified ${gate.blocked_reason}${gate.failure ? ' — ' + gate.failure : ''} — blocking (no repair)`)
    if (gate.blocked_reason === 'needs-owner') await persistGateBlock(f.frd, reviewIds, 'needs-owner', gate.failure)   // C2: the review-only gate classified but did not persist — write BLOCKED + decisions.md on main
    blockFrd(f.frd, gate.blocked_reason)
    return 'blocked'
  }

  // Gate failed with no specific reopen → TRY TO REPAIR, then re-gate ONCE (fail-closed).
  log(`! ${f.frd} gate failed${gate?.failure ? ': ' + gate.failure : ''} — attempting repair`)
  const fix = await attemptRepair(f.frd, 'the FRD review/integration gate failed: ' + (gate?.failure || 'unknown'))
  if (fix && fix.green === true) {
    gate = await frdGate(f.frd, reviewIds)
    if (gate && gate.green === true && isPartialReport(gate)) { refusePartial(f.frd, 'the post-repair re-gate'); reopenedFrds.push(f.frd); return 'reopened' }   // WP-08 cage
    if (gate && gate.green === true) { await applyGate(f.frd, reviewIds, gate.testFiles, null); log(`✓ ${f.frd} VERIFIED (after repair)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
  }
  const reason = (fix && fix.blocked_reason) || (gate && gate.blocked_reason) || 'error'
  log(`⊘ ${f.frd}: BLOCKED (${reason})`)
  blockFrd(f.frd, reason)
  return 'blocked'
}

// ── BL-0021 GLOBAL WAVE SCHEDULER ─────────────────────────────────────────────
// The engine used to build strictly FRD by FRD (a sequential for-loop): the wave parallelism only
// existed INSIDE one feature, so six independent 1-WO FRDs built single-file for ~4.5h in `powerful`
// mode (personal-page-v2, 2026-06-30 — the mode's wave of 8 was theoretical). Now each wave is picked
// from the READY WOs of ALL FRDs (dependsOn satisfied + artifacts disjoint across the whole wave,
// DR-060) and the per-FRD gates run SERIALIZED at wave boundaries — waves are synchronous barriers,
// so a gate's whole-project checks always see a QUIET tree (the trust boundary is unchanged).
// Every prior invariant holds: foundation-first (DR-057), Option B single commit writer, maxAgents/
// budget brakes at every boundary, DR-069 safe-points, the blocks health breaker, DR-107 in-run retry.

// Per-FRD tracking, seeded from the plan; drained changes enroll later via enrollFrd().
const frdState = new Map()   // frd -> { f, reviewIds, toBuildIds:Set, failed:false, enqueued:false }
const globalQueue = new Map() // woId -> { wo, frd }
const doneIds = new Set()     // committed (IN_REVIEW) or VERIFIED wo ids — satisfies dependsOn
// WS-A/D3: BLOCKED wo ids — a BLOCKED WO is neither in globalQueue nor doneIds, so the ready filter's
// `!globalQueue.has(d)` (meant for a VERIFIED-and-omitted dep) used to read it as SATISFIED and build a
// WO whose dependency is blocked (fail-open). Tracked here so a dep on a blocked WO fails CLOSED.
const blockedIds = new Set()
const gateQueue = []          // FRD folders whose build WOs are all committed + PINNED — gates launch FIFO
// ── C2 concurrent-gate state ──────────────────────────────────────────────────────────────────────
let worktreeState = 'unknown'   // 'unknown' | 'ready' | 'failed' (failed → legacy synchronous gate path)
let lastWorktreeSha = null      // the sha the worktree is currently checked out at (skip redundant checkout/install)
let concurrentGates = null      // null = undecided (probe at the first gate); true = concurrent; false = legacy inline
let gateWorktreeChain = Promise.resolve()   // single worktree = one checkout at a time → serialize (checkout+review) among gates
const gatesInFlight = new Map() // frd -> promise (settled entries are deleted; size capped at MAX_CONCURRENT_GATES)
const gateResults = []          // settled gate verdicts awaiting main-loop processing: { f, reviewIds, gate }
const convergeQueue = []        // reject verdicts needing on-main convergence (drained under a quiesce): { f, reviewIds, gate }
function enqueueGateIfComplete(frd) {
  const st = frdState.get(frd)
  if (!st || st.enqueued || st.failed) return false
  if (st.toBuildIds.size === 0 && st.reviewIds.length > 0) { st.enqueued = true; gateQueue.push(frd); return true }   // C2: newly gate-ready → the caller pins it
  return false
}
function enrollFrd(f) {
  if (frdState.has(f.frd)) return
  // WS-D/D7: WO-id uniqueness across FRDs. A WO id already owned by ANOTHER FRD (in the queue, done, or
  // blocked) means duplicate ids across FRDs; `globalQueue.set(id, …)` would SILENTLY overwrite the
  // other FRD's entry (last writer wins) and corrupt dep resolution. Refuse: block THIS FRD loudly.
  const dupes = (f.workOrders || []).filter((w) => globalQueue.has(w.id) || doneIds.has(w.id) || blockedIds.has(w.id))
  if (dupes.length) {
    log(`⊘ ${f.frd}: WO id(s) ${dupes.map((w) => w.id).join(', ')} already belong to another FRD — duplicate ids across FRDs, refusing to enroll (would silently overwrite the schedule). Blocking ${f.frd} (error) — the owner must give these work orders unique ids.`)
    blockFrdInSchedule(f.frd, 'error')
    return
  }
  const pending = f.workOrders.filter((w) => w.status !== 'VERIFIED' && w.status !== 'BLOCKED')
  const toBuild = pending.filter((w) => w.status !== 'IN_REVIEW')   // IN_REVIEW = built by a prior interrupted run → straight to the gate, don't rebuild
  for (const w of f.workOrders) if (w.status === 'VERIFIED' || w.status === 'IN_REVIEW') doneIds.add(w.id)
  for (const w of f.workOrders) if (w.status === 'BLOCKED') blockedIds.add(w.id)   // WS-A/D3: a dep on this fails closed
  for (const w of toBuild) globalQueue.set(w.id, { wo: w, frd: f.frd })
  frdState.set(f.frd, { f, reviewIds: pending.map((w) => w.id), toBuildIds: new Set(toBuild.map((w) => w.id)), failed: false, enqueued: false, gateAttempts: 0 })   // gateAttempts: 1-based gate-attempt counter per FRD this run (B8 event field + C1a serial-first gate)
  log(`▶ ${f.frd}: ${toBuild.length} to build${pending.length - toBuild.length ? ` · ${pending.length - toBuild.length} already in review` : ''}`)
  enqueueGateIfComplete(f.frd)   // resume / drained bug-fix: an all-IN_REVIEW FRD goes straight to the gate
}
for (const f of plan.frds) enrollFrd(f)
detectCycles()   // WS-D/D13: fail LOUD on a dependency cycle up front, before it surfaces late as a generic stall

// Block an FRD before its gate: drop its unbuilt WOs from the schedule (built/IN_REVIEW ones stay
// committed — the next run resumes them) and record the reason.
function blockFrdInSchedule(frd, reason) {
  const st = frdState.get(frd)
  if (st) { st.failed = true; for (const id of st.toBuildIds) { globalQueue.delete(id); blockedIds.add(id) } }   // WS-A/D3: dropped WOs are now BLOCKED — a dep on them fails closed
  blockFrd(frd, reason)
}

// FRD-level deps (a WO is schedulable only if its FRD doesn't depend on a blocked FRD).
function frdDepsBlocked(frd) {
  const st = frdState.get(frd)
  return Boolean(st && st.f.deps && st.f.deps.some((d) => blockedFrds.includes(d)))
}

// ── WS-D/D13: pure-JS acyclicity guard ────────────────────────────────────────
// A dependency CYCLE (WO-level `deps` or FRD-level `deps`) would otherwise surface LATE and vaguely as a
// generic "unresolved/circular deps" stall (ready.length === 0) with no diagnosis, or loop forever. Detect
// it UP FRONT — after enrollment and after any drained re-plan — over the merged graph, and BLOCK the
// involved FRD(s) needs-owner, NAMING the cycle. `findCycle` is a coloured DFS returning the cycle path.
function findCycle(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map()
  const stack = []
  for (const k of graph.keys()) color.set(k, WHITE)
  let cyclePath = null
  const visit = (node) => {
    color.set(node, GRAY); stack.push(node)
    for (const dep of (graph.get(node) || [])) {
      if (!graph.has(dep)) continue                 // dep outside the graph (satisfied elsewhere) — not a cycle edge
      if (color.get(dep) === GRAY) { cyclePath = stack.slice(stack.indexOf(dep)).concat(dep); return true }   // back edge → cycle
      if (color.get(dep) === WHITE && visit(dep)) return true
    }
    stack.pop(); color.set(node, BLACK); return false
  }
  for (const k of graph.keys()) { if (color.get(k) === WHITE && visit(k)) break }
  return cyclePath
}
function detectCycles() {
  // FRD-level cycle (only over non-failed FRDs still in the schedule).
  const frdDeps = new Map()
  for (const [frd, st] of frdState) if (!st.failed) frdDeps.set(frd, (st.f.deps || []).filter((d) => frdState.has(d)))
  const frdCycle = findCycle(frdDeps)
  if (frdCycle) {
    log(`⊘ FRD dependency CYCLE detected: ${frdCycle.join(' → ')} — blocking (needs-owner); the owner must break the cycle`)
    for (const frd of new Set(frdCycle)) if (!blockedFrds.includes(frd)) blockFrdInSchedule(frd, 'needs-owner')
    return
  }
  // WO-level cycle (across every enrolled non-failed FRD's work orders).
  const woDeps = new Map(); const woFrd = new Map()
  for (const [frd, st] of frdState) if (!st.failed) for (const w of st.f.workOrders) { woDeps.set(w.id, w.deps || []); woFrd.set(w.id, frd) }
  const woCycle = findCycle(woDeps)
  if (woCycle) {
    const frds = [...new Set(woCycle.map((id) => woFrd.get(id)).filter(Boolean))]
    log(`⊘ Work-order dependency CYCLE detected: ${woCycle.join(' → ')} (FRD(s): ${frds.join(', ')}) — blocking (needs-owner)`)
    for (const frd of frds) if (!blockedFrds.includes(frd)) blockFrdInSchedule(frd, 'needs-owner')
  }
}

// ── C2 concurrent-gate orchestration ──────────────────────────────────────────────────────────────
// launchGate: start a gate as a BACKGROUND promise. The (worktree checkout + review) is serialized on
// gateWorktreeChain (a single worktree can only be at one sha at a time); each gate still overlaps the
// BUILD on main. On settle it pushes its verdict to gateResults and frees its gatesInFlight slot.
let gateSettledSinceSafePoint = false
function launchGate(frd) {
  const st = frdState.get(frd)
  const pinSha = st.pinSha
  const reviewIds = st.reviewIds
  const work = gateWorktreeChain.then(async () => {
    const ok = await ensureGateWorktree(pinSha)
    if (!ok) return { __worktreeFailed: true }
    // WP-06: in digested mode, await the pack the wave close prelaunched (or collect it inline for a gate
    // that never had a prelaunch, e.g. a resume gate). Null in explore mode → frdGate behaves exactly as
    // it always has. A null/malformed pack degrades THIS gate to explore; the gate itself never skips.
    const evidencePack = await resolveGateEvidence(frd, reviewIds, pinSha)
    return await frdGate(frd, reviewIds, worktreeWorkFrom(pinSha), evidencePack)
  })
  gateWorktreeChain = work.then(() => {}, () => {})   // keep the worktree mutex chain alive across errors
  const tracked = work.then(
    (gate) => { gatesInFlight.delete(frd); gateResults.push({ f: st.f, reviewIds, gate }) },
    (e) => { gatesInFlight.delete(frd); gateResults.push({ f: st.f, reviewIds, gate: { green: false, blocked_reason: 'error', failure: `gate crashed: ${(e && e.message) || e}` } }) },
  )
  gatesInFlight.set(frd, tracked)
}
// Process every settled gate verdict: PASS → serialized apply-gate (port test files + stamp on main);
// anything else → queue for on-main convergence under a quiesce. A __worktreeFailed sentinel routes the FRD
// to the legacy full gate+converge on main. Returns true iff it applied at least one PASS (progress).
async function harvestGateResults() {
  let progressed = false
  while (gateResults.length) {
    const { f, reviewIds, gate } = gateResults.shift()
    gateSettledSinceSafePoint = true
    if (gate && gate.__worktreeFailed) { convergeQueue.push({ f, reviewIds, gate: null, __needsLegacy: true }); continue }
    if (gate && gate.green === true && isPartialReport(gate)) {
      // WP-08 cage (concurrent gate path) — same refusal as the inline one in gateConverge.
      refusePartial(f.frd, 'the concurrent FRD gate')
      reopenedFrds.push(f.frd)
      continue
    }
    if (gate && gate.green === true) {
      const ok = await applyGate(f.frd, reviewIds, gate.testFiles, GATE_WORKTREE)
      if (ok) { log(`✓ ${f.frd} VERIFIED (concurrent gate, applied on main)`); builtFrds.push(f.frd); consecutiveBlocks = 0; progressed = true }
      else convergeQueue.push({ f, reviewIds, gate })   // apply failed → converge (repair) on main
      continue
    }
    convergeQueue.push({ f, reviewIds, gate })   // reject/blocked/fail → the ladder runs on main under a quiesce
  }
  return progressed
}
// Await in-flight gates (all=true → every one; else settle at least one), then harvest.
async function settleGates(all) {
  if (gatesInFlight.size) {
    if (all) await Promise.all([...gatesInFlight.values()])
    else await Promise.race([...gatesInFlight.values()])
  }
  return await harvestGateResults()
}
// Drain the convergeQueue on the (quiesced) main tree: run the exact pre-C2 convergence ladder per reject.
async function drainConverge() {
  while (convergeQueue.length) {
    const item = convergeQueue.shift()
    if (item.__needsLegacy) { await gateAndConverge(item.f, item.reviewIds); continue }   // worktree-failed gate → whole gate+converge on main
    await gateConverge(item.f, item.reviewIds, item.gate)
  }
}
// C2: resume gates (an all-IN_REVIEW FRD enrolled before any wave) are frozen at the baseline HEAD.
if (gateQueue.length) { await capturePin([...gateQueue]); for (const frd of gateQueue) launchEvidence(frd) }   // WP-06: no-op unless gateEvidence:'digested'

// WP-11: counts safe-point CHECKPOINTS this run (every wantSafePoint boundary, whether that's an
// upcoming wave or an idle/gate-settle sweep) — the throttle for a targeted run below. Declared outside
// the loop so it survives across iterations; unused (and harmless) on a bare run.
let safePointChecks = 0

while (true) {
  try {   // WS-D/D2: error boundary around the whole scheduler body — a throw must never leave running:true
  // ── Brakes at every wave/gate boundary (same checks the per-FRD loop ran) ──
  if (budget.total && budget.remaining() < LOW_BUDGET) { stopReason = 'budget'; log('Circuit breaker: budget ceiling reached — stopping at a safe point'); break }
  if (MAX_AGENTS && agentSpawned >= MAX_AGENTS) { stopReason = 'agents'; log(`Agent ceiling reached (${agentSpawned} ≥ maxAgents ${MAX_AGENTS}) — stopping at a safe point`); break }
  if (MAX_SPEND && budget.spent() >= MAX_SPEND) { stopReason = 'budget'; log(`Spend ceiling reached (${Math.round(budget.spent() / 1000)}k ≥ maxSpend ${Math.round(MAX_SPEND / 1000)}k) — stopping at a safe point`); break }
  if ((builtFrds.length + blockedFrds.length + reopenedFrds.length) >= MAX_FRDS) { stopReason = 'maxFrds'; log(`Reached the test cap maxFrds=${MAX_FRDS} (built+blocked+reopened) — stopping at a safe point`); break }
  if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) { stopReason = 'blocks'; break }

  // ── C2 harvest: apply settled PASS gates on main (serialized); queue rejects for convergence ──
  await harvestGateResults()

  // ── C2 QUIESCE for convergence: a reject verdict must converge on a QUIET main tree. No wave is building
  // here (waves are synchronous barriers); await every in-flight gate to settle (they may land more
  // verdicts), then run the recovery ladder on main for each, synchronously — the pre-C2 semantics. ──
  if (convergeQueue.length) {
    await settleGates(true)
    await drainConverge()
    continue
  }

  // ── DR-069 safe point (owner signals; may enroll drained-change FRDs into this run) ──
  // C1c: run it BEFORE every wave dispatch (globalQueue non-empty = a wave is coming). C2: also on an
  // IDLE-WAIT iteration (nothing to build, only gates in flight) — but BOUNDED, only when a gate has
  // settled since the last check, so owner signals aren't starved without spamming a spawn per spin. The
  // initial owner-signal check already ran pre-loop in the baseline pre-check (rethink + stop signal).
  const nothingInFlight = gatesInFlight.size === 0 && gateResults.length === 0 && convergeQueue.length === 0
  // before a wave (build coming); OR truly idle with no queued gate (drain/unblock/final — the pre-C2 sweep
  // ran here every empty-queue iteration too); OR idle-waiting on in-flight gates, BOUNDED to a gate settle.
  const wantSafePoint = globalQueue.size > 0
    || (nothingInFlight && gateQueue.length === 0)
    || (!nothingInFlight && globalQueue.size === 0 && gateSettledSinceSafePoint)
  if (wantSafePoint) {
    // WP-11: a targeted run (safePoint() drains nothing there, DR-069) throttles this checkpoint — run
    // the FIRST one, then only every SAFE_POINT_WAVE_THROTTLE-th one after (counted in-engine, replay-safe
    // — see the const above for why not wall time). A bare run (the real queue drain) keeps the original
    // per-boundary cadence, untouched. args.safePointEveryWave restores per-boundary on a targeted run too.
    const throttled = TARGETED && !SAFE_POINT_EVERY_WAVE
    safePointChecks++
    const runSafePoint = !throttled || safePointChecks === 1 || safePointChecks % SAFE_POINT_WAVE_THROTTLE === 1
    if (runSafePoint) {
      gateSettledSinceSafePoint = false
      if ((await safePoint()) === 'stop') { stopReason = 'rethink'; break }
    } else {
      // REV-5: the throttle skips the FULL safe point (queue drain + stop/rethink signal + decision
      // unblock), but RENEW_LEASE is embedded ONLY in that prompt — the engine's single lease-renewal
      // site (600s TTL, build-state.mjs). A skipped boundary must still renew the lease on its own,
      // minimally, or a long targeted run silently stops renewing between throttled checkpoints.
      agentSpawned++
      const renewal = await agent(RENEW_LEASE,
        { label: 'renew-lease', phase: 'Build', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: RENEW_LEASE_SCHEMA })
      if (renewal && renewal.stop === true) { stopReason = 'rethink'; log('⏸ renovación de lease falló en un safe point saltado — el motor para (fail closed, DR-069)'); break }
      log(`⊘ safe point #${safePointChecks} saltado (build dirigido, no drena nada — WP-11: 1×/corrida + 1×/${SAFE_POINT_WAVE_THROTTLE} boundaries; args.safePointEveryWave:true restaura la cadencia por ola; lease renovada igual)`)
    }
  }

  // ── C2 launch ready gates as BACKGROUND promises (up to MAX_CONCURRENT_GATES) — WHILE the loop keeps
  // dispatching build waves. The FIRST gate probes the worktree synchronously: success → concurrent for
  // the whole run; failure → the legacy synchronous gate path (a real, tested fallback). ──
  if (gateQueue.length) {
    if (concurrentGates === null) {
      concurrentGates = await ensureGateWorktree(frdState.get(gateQueue[0]).pinSha)   // probe → creates the worktree at the first pin
      log(concurrentGates ? '▹ C2: gates run CONCURRENTLY with builds in a pinned worktree' : '↩ C2: legacy synchronous gate path (worktree unavailable) for the whole run')
    }
    if (concurrentGates && worktreeState !== 'failed') {
      while (gateQueue.length && gatesInFlight.size < MAX_CONCURRENT_GATES) launchGate(gateQueue.shift())
    } else {
      // legacy synchronous gate path: one gate inline per iteration, pre-C2 topology (gate on the quiet main tree).
      const gateFrd = gateQueue.shift()
      const st = frdState.get(gateFrd)
      await gateAndConverge(st.f, st.reviewIds)
      continue
    }
  }

  // Skip FRDs whose FRD-level deps blocked (the old loop's skip, evaluated lazily).
  for (const [frd, st] of frdState) {
    if (!st.failed && !st.enqueued && frdDepsBlocked(frd) && [...st.toBuildIds].some((id) => globalQueue.has(id))) {
      log(`⊘ ${frd} skipped (depends on a blocked FRD)`)
      blockFrdInSchedule(frd, 'needs-owner')
    }
  }
  if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) { stopReason = 'blocks'; break }

  // ── C2 nothing left to build: if gates are still in flight / settling / converging, IDLE-WAIT (settle
  // one and loop); else the run is done. ──
  if (globalQueue.size === 0) {
    if (gatesInFlight.size || gateResults.length || convergeQueue.length) { await settleGates(false); continue }
    break   // nothing to build and no gate outstanding → done
  }

  // ── Ready set across ALL FRDs: dependsOn satisfied (a dep outside the schedule counts as
  // satisfied — it belongs to a fully-VERIFIED FRD the planner omitted, mirroring the old
  // `!queue.has(d)` rule extended globally). ──
  // A dep is satisfied iff it is done (VERIFIED/IN_REVIEW) OR it is outside the schedule AND not
  // BLOCKED — the `!globalQueue.has(d)` clause covers a dep in a fully-VERIFIED FRD the planner omitted,
  // but a BLOCKED dep is ALSO outside the queue and must NOT count as satisfied (WS-A/D3 fail-closed).
  const ready = [...globalQueue.values()]
    .filter(({ wo }) => (wo.deps || []).every((d) => doneIds.has(d) || (!globalQueue.has(d) && !blockedIds.has(d))))
    .map(({ wo, frd }) => ({ ...wo, _frd: frd }))

  if (ready.length === 0) {
    const stuck = [...new Set([...globalQueue.values()].map((x) => x.frd))]
    // WS-A/D3: classify — a WO stuck on a BLOCKED dep is needs-owner (the owner must clear the block),
    // not a code 'error' the way a genuine circular/unresolvable dep is.
    const onBlockedDep = [...globalQueue.values()].some(({ wo }) => (wo.deps || []).some((d) => blockedIds.has(d)))
    const reason = onBlockedDep ? 'needs-owner' : 'error'
    log(`⚠ ${globalQueue.size} work order(s) can't proceed — ${onBlockedDep ? 'a dependency is BLOCKED' : 'unresolved/circular deps'} (${stuck.join(', ')}) — blocking those FRDs (${reason})`)
    for (const frd of stuck) blockFrdInSchedule(frd, reason)
    continue
  }

  // ── DR-057 foundation-first, ENGINE-ENFORCED: while any foundation WO is pending, the wave is
  // foundation-only; before any SURFACE fans out the foundation must be COMPLETE (bounded auto-repair).
  const foundationReady = ready.filter((w) => w.foundation)
  let candidates = ready
  let uiPassSkipEvent = ''   // WP-01: set below when this iteration skips a UI-gated pass; appended to whichever agent runs next
  if (foundationReady.length) {
    candidates = foundationReady
  } else if (plan.hasFrontend && !foundationVerified && ready.some((w) => !w.foundation)) {
    const nonFoundationReady = ready.filter((w) => !w.foundation)
    // WP-01: the gate only protects a UI surface (DR-057) — pointless work when every non-foundation
    // WO ready this wave is backend/lib-only (measured: 179s, 24% of a build with zero UI artifacts).
    // FORCE_UI_PASSES bypasses the heuristic; artifactsTouchUi fails CLOSED on undeclared artifacts.
    if (FORCE_UI_PASSES || artifactsTouchUi(nonFoundationReady)) {
      const ok = await ensureFoundationComplete()
      if (!ok) {
        const surfaceFrds = [...new Set(nonFoundationReady.map((w) => w._frd))]
        log(`⊘ foundation incomplete and it needs the owner — holding surface work (${surfaceFrds.join(', ')})`)
        for (const frd of surfaceFrds) blockFrdInSchedule(frd, 'needs-owner')
        continue
      }
    } else {
      const surfaceFrds = [...new Set(nonFoundationReady.map((w) => w._frd))].join(', ')
      log(`⊘ foundation-gate omitido: ninguna WO no-fundación lista declara artefactos de UI (fail-closed si no declaran); el diff visual determinista sigue en el verify.sh completo del cierre — ${surfaceFrds}`)
      uiPassSkipEvent += UI_PASS_SKIPPED_EVENT('foundation-gate', surfaceFrds, 'no-ui-artifacts')
    }
  }

  phase('Build')
  const undeclared = candidates.filter((w) => !(w.artifacts && w.artifacts.length))
  if (undeclared.length) log(`⚠ ${undeclared.length} ready WO(s) declare no artifacts — serializing them (can't prove disjoint, DR-060 fail-safe): ${undeclared.map((w) => w.id).join(', ')}`)
  // DR-070 (audit P1) + WS-A/D2: never START a wave whose PROJECTED cost overshoots the agent budget.
  // capHit() guards the wave boundary, but a full P.wave fan-out could overshoot maxAgents mid-wave;
  // the old cap counted raw WOs (1 each) while an opus WO costs COST+1 (≈4), so an opus wave blew the
  // cap ~4× (a 6-cap run reached 13). Now the picker is COST-aware: count cap P.wave AND a cost budget
  // = the remaining agent allowance, so the in-engine brake holds even if the supervisor is dead.
  const remainingAgents = MAX_AGENTS ? Math.max(1, MAX_AGENTS - agentSpawned) : Infinity
  const wave = pickDisjointWave(candidates, P.wave, remainingAgents, woWaveCost)   // DR-060: never co-schedule overlapping artifacts — now across FRDs; DR-073/D2: cost-budgeted width
  const waveFrds = [...new Set(wave.map((w) => w._frd))]
  log(`⚒ wave: ${wave.length} WO(s) across ${waveFrds.length} FRD(s) — ${wave.map((w) => w.id).join(', ')}`)
  // WP-09: name WHY each non-elected candidate was deferred (deps pending / artifacts overlap / blocked
  // by the foundation gate or the wave cap) — reuses pickDisjointWave's own artifactsOverlap, unmodified,
  // so a stalled wave is diagnosable from the log alone instead of re-deriving the scheduler's reasoning.
  const wavePicked = new Set(wave.map((w) => w.id))
  const deferred = [...globalQueue.values()].map(({ wo }) => wo).filter((wo) => !wavePicked.has(wo.id)).map((wo) => {
    const unmetDeps = (wo.deps || []).filter((d) => !(doneIds.has(d) || (!globalQueue.has(d) && !blockedIds.has(d))))
    if (unmetDeps.length) return `${wo.id}(deps:${unmetDeps.join('+')})`
    if (!candidates.some((c) => c.id === wo.id)) return `${wo.id}(blocked:foundation-pending)`
    const overlapsWith = wave.find((p) => artifactsOverlap(p, wo))
    return overlapsWith ? `${wo.id}(artifacts:${overlapsWith.id})` : `${wo.id}(blocked:wave-cap)`
  })
  if (deferred.length) log(`↻ deferred: ${deferred.join(', ')}`)

  // WP-03 fusion (i): the standalone Plan-phase sync-rollups spawn (if MECH_LEAN) folds into the FIRST
  // wave's dispatch call — one agent, two commands, same order (sync-rollups, THEN the IN_PROGRESS stamp).
  // Consumed exactly once; every later wave's dispatch is the plain frontmatter-only stamp, unchanged.
  const dispatchSyncRollups = pendingSyncRollups || ''
  pendingSyncRollups = null
  // WP-03 fusion (ii) bookkeeping: reset per wave — lastCommitSha tracks the LAST commit commitWOGreen
  // actually landed THIS wave; waveRepairRan marks that attemptRepair committed on its own THIS wave
  // (untracked here), which invalidates lastCommitSha for capturePin's fast path below.
  lastCommitSha = null
  let waveRepairRan = false

  // BL-0002: the ENGINE owns the PLANNED→IN_PROGRESS transition, stamped at dispatch — atomic and
  // independent of when each builder actually starts. Parallel waves used to leave five actively-
  // building WOs reading PLANNED (the builder's "first action" never ran first), so Mission Control
  // showed "En progreso: 0" over a busy build (LESSON-0003). Cheap tier; frontmatter only; no commit.
  agentSpawned++
  // D6: the exact command, not prose the mech agent has to interpret — scoped strictly to the
  // frontmatter block (never a body prose line that happens to mention implementation_status) and
  // idempotent (a re-run on a file already IN_PROGRESS rewrites it to itself — a harmless no-op, so
  // "skip any already IN_PROGRESS" needs no separate branch). Verified against real mission-control
  // WO frontmatter (incl. one with a `---` horizontal rule + a prose mention of the same field in
  // its body, which it correctly leaves untouched) on macOS' perl 5.34.1.
  await agent(`${dispatchSyncRollups}Stamp \`implementation_status: IN_PROGRESS\` in the frontmatter of EACH of these work-order files (change nothing else beyond the sync-rollups step above if present, do NOT commit this part) by running EXACTLY this command once per file, substituting its path: \`perl -0pi -e 's/\\A(---\\n(?:(?!---\\n).*\\n)*?)implementation_status:[^\\n]*/$1implementation_status: IN_PROGRESS/' <file>\`. Files: ${wave.map((w) => w.path || `docs/frds/${w._frd}/work-orders/${w.id}`).join(', ')}. Return when all are stamped.${uiPassSkipEvent}`,
    { label: `dispatch:${waveFrds.join('+')}`, phase: 'Build', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT })
  const results = await parallel(wave.map((w) => () => buildWO(w, w._frd)))
  // Option B (DR-060) + finer save points (DR-086): each GREEN work order was ALREADY committed the
  // instant its self-test passed (commitWOGreen — one serialized git writer, selective `git add` of
  // its disjoint artifacts), so there is no batched after-wave commit. A mid-wave interruption keeps
  // every WO that already greened (committed → IN_REVIEW → skipped on resume) and only the
  // still-building (uncommitted) WOs rebuild. No index.lock race: the writer is serialized.
  for (let i = 0; i < wave.length; i++) {
    const w = wave[i]
    globalQueue.delete(w.id)
    const st = frdState.get(w._frd)
    if (st) st.toBuildIds.delete(w.id)
    // WS-D/D1: done ONLY when the self-test was green AND the commit LANDED. A green-but-uncommitted WO
    // (buildWO returns { green, committed }) is NOT added to doneIds — it fails its FRD into the same
    // attemptRepair path as a self-test failure, so its unpersisted work never counts as a satisfied dep.
    if (results[i] && results[i].green === true && results[i].committed === true) doneIds.add(w.id)
    else if (st) st.failed = true
  }

  // A work order failed its self-test → TRY TO REPAIR that FRD before blocking (owner's rule).
  // Runs after the wave barrier (quiet tree), one FRD at a time.
  for (const frd of waveFrds) {
    const st = frdState.get(frd)
    if (!st || !st.failed) continue
    log(`! ${frd}: a work order failed — attempting repair before giving up`)
    waveRepairRan = true   // WP-03: attemptRepair ALWAYS commits (fix or block+revert) — untracked by commitWOGreen
    const fix = await attemptRepair(frd, 'a work order failed its self-test during the build wave')
    if (fix && fix.green === true) {
      log(`✓ ${frd}: repaired — proceeding to the gate`)
      st.failed = false
      for (const id of [...st.toBuildIds]) if (!globalQueue.has(id)) { st.toBuildIds.delete(id); doneIds.add(id) }
    } else {
      const reason = (fix && fix.blocked_reason) || 'error'
      log(`⊘ ${frd}: could not repair (${reason}) — BLOCKED, continuing with independent FRDs`)
      blockFrdInSchedule(frd, reason)
    }
  }

  // FRDs whose build WOs all committed → queue their gate + PIN it at the post-wave HEAD (a boundary
  // moment: no half-committed sibling wave). One pin spawn per completing wave (C2) — WP-03 fusion (ii):
  // skipped when this wave's last landed commit sha is already known and trustworthy (no repair ran).
  const newlyGateReady = []
  for (const frd of waveFrds) if (enqueueGateIfComplete(frd)) newlyGateReady.push(frd)
  if (newlyGateReady.length) {
    await capturePin(newlyGateReady, waveRepairRan ? null : lastCommitSha)
    // WP-06: the wave is closed and pinned — THE first moment the evidence can honestly describe the work
    // under review. Fire the collectors as background promises so they occupy the gate worktree while the
    // loop runs its safe point and dispatches the next wave (no-op unless gateEvidence:'digested').
    for (const frd of newlyGateReady) launchEvidence(frd)
  }
  } catch (loopErr) {
    // WS-D/D2: any throw inside the scheduler loop must NOT die with running:true left in status.yaml (Mission
    // Control would show a phantom running build forever). Log LOUD, guarantee running:false via a dedicated
    // MECH spawn (NEVER touching `phase` — nothing here is verified), then RETHROW (the crash is not swallowed;
    // the post-loop ensure-stopped fail-safe below covers the clean return paths, this covers the crash path).
    log(`☠☠ FATAL: the build scheduler loop threw — ${(loopErr && loopErr.message) || loopErr} — ensuring running:false before rethrow (WS-D/D2)`)
    agentSpawned++
    await agent(`Crash fail-safe (WS-D/D2): the scheduler loop threw. Ensure running:false through the lease owner. Do NOT touch \`phase\`; NEVER set phase: release here. ${RELEASE_LEASE} Confirm done:true.`,
      { label: 'ensure-stopped-crash', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
    throw loopErr
  }
}

// ── C2 run-end invariant: settle EVERY in-flight gate + drain the convergeQueue BEFORE hardening/close-out/
// notify-end (the loop may have broken — budget/agents/blocks — with gates still running; a gate already
// spawned is work we committed to, and its apply/converge decides builtFrds/release honestly). ──
await settleGates(true)
await drainConverge()

// ── Close-out shared prompt fragments (WP-02) — defined ONCE, reused byte-identically by both the
// lean (default) and legacy (args.leanCloseOut:false) shapes below, so the ACTUAL agent instructions
// never fork between the two — only the ORCHESTRATION around them (when they fire, how many spawns) does.
const visualQaPromptBody = (frds) =>
  `${EMIT('reviewer', 'visual-qa', { phase: 'review', activity: 'visual-qa' })}END-OF-BUILD VISUAL QA (DR-072) — the dedicated fidelity pass, scoped to the FRDs VERIFIED this run: ${frds.join(', ')}. This is a PUNCH-LIST + bounded DIRECT fixes, NOT a re-gate: NEVER reopen a work order or send anything back to the build loop (that restarts the churn). Compare, list, fix the cheap ones, leave the rest for the owner.
    For EACH of those FRDs, for each key route:
    1) Render the route (start the dev server if needed) and screenshot it; open the BINDING mock (docs/frds/<frd>/mocks/ — screenshot AND source), fdd.md, docs/design/design-tokens.json, DESIGN.md.
    2) Compare SEMANTICALLY (does the build look like the design?): layout, structure, spacing, sizing, colors/tokens, component reuse, density. Write every divergence to \`.pandacorp/comms/visual-punch-list.md\` (merge + dedupe with what the per-FRD gates already appended), one line each: \`- [ ] <frd> · <route> · <gap> · <file:line if known>\`.
    3) FIX the cheap, unambiguous ones DIRECTLY (a token/size/spacing/color/class correction against the EXISTING design docs — the doc already specified it, the build implemented it wrong; NO doc change). Check them off. Leave ambiguous/large gaps UNCHECKED for the owner. Bound your fixes (don't grind to perfection — the owner does the final polish).
    4) After fixing, run the FOCUSED \`bash .pandacorp/verify.sh --since <last_green_sha from .pandacorp/status.yaml>\` to confirm your fixes regressed nothing (DR-106 — the close-out/notify-end step right after runs the FULL suite once; don't pay it twice here); if a fix broke a test, revert THAT one fix (keep the rest) and re-run. Commit (e.g. \`style(visual-qa): sweep punch-list for ${frds.slice(0, 3).join(', ')}\`). Advance status.yaml last_event_at + updated_at + kill any dev server with TaskStop.
    Return { done: true } once the punch-list is written, safe fixes committed, and verify is green.${NOTIFY('QA Visual: punch-list generado + arreglos seguros aplicados', 'Glass')}`
const archiveChangesBody =
  ` 1) List .pandacorp/inbox/changes/*.md (IGNORE the done/ subfolder). For EACH whose frontmatter \`status\` is "building": read its \`affected_frds\` and check each of those FRD folders' rolled-up frd.md \`implementation_status\`. The change has LANDED iff ALL its affected_frds are VERIFIED (read the rollups from disk — this is what makes it work even when the verifying run is a LATER one).
  2) For EACH landed change: verify its durable record exists (the canonical docs/FRDs it names were touched); stamp \`status: done\` + \`shipped_sha\` (current \`git rev-parse --short HEAD\`) + \`shipped_at\` (ISO now); MOVE the file to .pandacorp/inbox/changes/done/ (a move, NEVER a delete — the folder is gitignored, a delete is irreversible); update its row in the queue index README.md.
  3) Leave every still-building change whose affected_frds are merely un-VERIFIED in place (they will verify on a later run). Commit the archive moves + status edits (Conventional Commits, scope) as their OWN commit. If NO building change has fully landed, change nothing.
  4) WS-D/D16 — ORPHANED building change: for EACH change still \`status: building\` whose \`affected_frds\` include a BLOCKED FRD (read that FRD's rolled-up frd.md \`implementation_status\` — it is \`BLOCKED\`, NOT merely un-VERIFIED), its build cannot complete on its own. Set it back to \`status: ready\` and add a one-line \`note:\` saying why (e.g. "re-opened: FRD <folder> quedó BLOCKED needs-owner"), so it re-surfaces at the next run's drain instead of stranding as a phantom building change. Commit that edit.`
// DR-085 HARDENING (BL-0012, fail-closed): security + telemetry are construction's LAST STEP, unchanged
// by WP-02 — extracted to a function only so both close-out shapes call the SAME sequence instead of
// duplicating ~15 lines of prompt text. `phase: release` is gated on their EVIDENCE — never on the FRD
// loop alone. Two real findings shipped as "green" before this gate existed (a missing CSP + an ASI01
// path traversal + never-firing events, run wf_978129ab-eca / LESSON-0022).
const runHardeningChain = async () => {
  phase('Hardening')
  // DR-085 HARDENING 1 is a TWO-spawn audit-then-fix split (RFC-30 N4): the security-auditor is
  // read-only (disallowedTools: Write, Edit — that independence is the point; an auditor that edits
  // the code it audits can't be trusted to grade it). It AUDITS and writes the evidence report only;
  // a Write/Edit-capable implementer then APPLIES the Critical/High fixes. Merging the two would
  // deadlock: a read-only agent can never reach done:true on a real Critical/High finding.
  agentSpawned += COST(P.judge)
  const audit = await agent(`DR-085 HARDENING 1a/3 — the security AUDIT, construction's last step (BL-0012). You are READ-ONLY: audit and report, do NOT edit code (that is the next spawn's job). Audit the WHOLE project: OWASP Top-10 for this stack, secrets in code/config/history, security headers + CSP (e.g. next.config), auth/authz on every mutating route, dependency risk; if the product has an agentic/LLM component, also ASI01–ASI10 (e.g. path traversal via model-chosen paths). Write the durable evidence report to docs/reviews/security-<YYYY-MM-DD>.md: for EACH finding record severity (critical/high/medium/low), file:line evidence, and concrete remediation. Commit the report (Conventional Commits, e.g. \`docs(security): audit report\`). Return { done: true, findings } ALWAYS once the report file exists — do NOT condition done on fixing anything (fixing is the next spawn). \`findings\` is a short array of { severity, summary } for the Critical/High items the fix spawn must clear (empty if none).`,
    { label: 'hardening:security-audit', phase: 'Hardening', model: P.judge, effort: 'high', agentType: 'pandacorp:security-auditor', schema: { type: 'object', required: ['done'], properties: { done: { type: 'boolean' }, failure: { type: 'string' }, findings: { type: 'array', items: { type: 'object' } } } } })
  agentSpawned++
  const fix = await agent(`DR-085 HARDENING 1b/3 — apply the security FIXES (BL-0012). The read-only auditor just wrote docs/reviews/security-<YYYY-MM-DD>.md with each finding + severity + remediation${audit && Array.isArray(audit.findings) ? ` (it flagged ${audit.findings.length} Critical/High item(s))` : ''}. Read that report. FIX every Critical AND High finding directly in production code (TDD — write the failing test first, then the fix; never weaken a test), then re-run the FOCUSED \`bash .pandacorp/verify.sh --since <last_green_sha from .pandacorp/status.yaml>\` until green (DR-106 — the close-out right after runs the FULL suite once; don't pay it twice here). Append to the SAME report, per finding: fixed | accepted-with-reason, and the final verify result. Commit (Conventional Commits).${HARDENING_EVENT('security')} (This one Hardening event folds the audit + fix into the single SECURITY stage result — status ok iff no Critical/High remains open, else fail; the read-only auditor does NOT emit its own.) Return { done: true } ONLY when no Critical/High remains open AND the report reflects it; otherwise { done: false, failure }. If the report lists NO Critical/High findings, there is nothing to fix — return { done: true } immediately.`,
    { label: 'hardening:security-fix', phase: 'Hardening', model: P.worker, agentType: 'pandacorp:implementer', schema: STOP_SCHEMA })
  const sec = { done: Boolean(audit && audit.done === true && fix && fix.done === true), failure: (fix && fix.failure) || (audit && audit.failure) }
  agentSpawned++
  const telem = await agent(`DR-085 HARDENING 3/3 — telemetry verification (BL-0012). Read docs/analytics/events.md (the event plan). VERIFY each planned event actually FIRES (exercise the flows via the tests/dev server; check the PostHog/analytics wiring is present and env-keyed). Fix trivial instrumentation gaps (a missing capture call) with TDD. Append a "## Verification <YYYY-MM-DD>" section to docs/analytics/events.md recording event-by-event: fires|gap-fixed|not-applicable. If the project has NO event plan and needs none (internal/personal return_type — check the PRD), record exactly that in the section instead. Commit.${HARDENING_EVENT('telemetry')} Return { done: true } (the verification section exists) or { done: false, failure }.`,
    { label: 'hardening:telemetry', phase: 'Hardening', model: P.worker, agentType: 'pandacorp:analytics', schema: STOP_SCHEMA })
  return { sec, telem, hardened: Boolean(sec && sec.done === true && telem && telem.done === true) }
}

let closed
if (LEAN_CLOSE_OUT) {
  // ═══ WP-02 lean close-out (default; args.leanCloseOut:false falls back to the legacy shape below)
  // proposal 37 / FRD-24 measurement: visual-qa 761s + archive-changes 34s + notify-end 186s +
  // release-lease 24s, all fully serial. Two changes from the legacy shape:
  //  (1) visual-qa FIRES as a promise here, but it is RESOLVED (awaited, below) BEFORE the hardening
  //      chain starts — NOT overlapped with it (REV-6). That is deliberate, not a missed opportunity:
  //      hardening's own agents (security-fix, telemetry) `git commit` to this SAME shared working tree
  //      (no worktree isolation here, unlike the per-WO build wave — see the archive-fold rationale in
  //      (2) below), and visual-qa's own end-of-build pass also commits (DR-072 cosmetic fixes) — two
  //      concurrent `git commit`s on one tree risk the exact index.lock race the wave's single-
  //      serialized-writer design (line ~2010) already exists to avoid. What firing it as a promise
  //      DOES buy: the archive-fold work between its dispatch and its await (computing archiveStep,
  //      logging) runs while visual-qa's agent call is in flight, instead of waiting on it FIRST. A
  //      REJECTED promise (a terminal tool/API error) is caught at the dispatch site (`.catch(() =>
  //      null)`) so it degrades exactly like a null result — never escapes the await and strands the
  //      close-out before it reaches the terminal lease release (REV-2).
  //  (2) archive-changes and release-lease are FOLDED into whichever of the three closing prompts fires,
  //      instead of spawning as separate agents — cutting the close-out region from 3 serial spawns to 1
  //      in the common case. Chosen over running archive-changes in parallel() with the closing agent
  //      because BOTH commit to the SAME working tree (no worktree isolation here, unlike the per-WO
  //      build wave) — two concurrent `git commit`s risk the exact index.lock race the wave's single-
  //      serialized-writer design (line ~2010) already exists to avoid.
  let visualQaPromise = null
  let visualQaNote = ''
  if (plan.hasFrontend && builtFrds.length) {
    const builtWos = builtFrds.flatMap((frd) => (frdState.get(frd) || {}).f?.workOrders || [])
    if (uiPassesRequired(builtWos)) {   // REV-D6: fails closed on a frdState miss, not just on a real UI artifact
      phase('Review')
      agentSpawned += COST(VISUAL_QA_MODEL)   // DR-073: weighted by the model actually spawned (E-3: sonnet by default, not P.judge)
      // REV-2: a REJECTED promise (terminal tool/API error) must degrade exactly like a null result —
      // caught HERE, at dispatch, so the bare `await visualQaPromise` below can never throw and strand
      // the close-out region before it reaches the terminal lease release.
      visualQaPromise = agent(visualQaPromptBody(builtFrds),
        { label: 'visual-qa', phase: 'Review', model: VISUAL_QA_MODEL, effort: 'high', agentType: 'pandacorp:reviewer', schema: { type: 'object', required: ['done'], properties: { done: { type: 'boolean' } } } })
        .catch(() => null)
    } else {
      log(`⊘ visual-qa omitido: ninguna WO de los FRDs verificados esta corrida (${builtFrds.join(', ')}) declara artefactos de UI (fail-closed si no declaran); el diff visual determinista sigue en el verify.sh completo del cierre`)
      visualQaNote = UI_PASS_SKIPPED_EVENT('visual-qa', builtFrds.join(','), 'no-ui-artifacts')
    }
  }

  // DR-069 §7 verify-then-archive (durable, cross-run) — folded as a prompt fragment into whichever
  // closing prompt fires below; computed here, independent of hardening/visual-qa (never gates on either).
  let archiveStep = ''
  if (builtFrds.length) {
    archiveStep = `STEP 0 — archive landed changes FIRST, the DR-069 §7 verify-then-archive protocol (durable, cross-run):\n${archiveChangesBody}\n  THEN, in this SAME agent call: `
    log(`↷ archive sweep folded into the close-out agent (${builtFrds.length} FRD(s) verified this run)`)
  } else if (integratedChanges.length) {
    log(`↷ ${integratedChanges.length} change(s) integradas pero este run no verificó FRDs — siguen 'building' y se archivan en la corrida que verifique sus FRDs (DR-069 §7, durable cross-run)`)
  }

  // Resolve visual-qa NOW — right before the terminal closing agent, and not one moment earlier — so
  // archiveStep/hardening above never depended on it. A missing/unconfirmed result degrades honestly.
  if (visualQaPromise) {
    const vq = await visualQaPromise
    if (vq && vq.done === true) {
      log(`Visual QA pass done over ${builtFrds.length} FRD(s) — see .pandacorp/comms/visual-punch-list.md`)
    } else {
      log('⚠ visual-qa agent returned no confirmed result — degrading honestly (punch-list may be incomplete this run)')
      visualQaNote = UI_PASS_SKIPPED_EVENT('visual-qa', builtFrds.join(','), 'agent-no-result') + ' VISUAL QA DEGRADED: the end-of-build visual QA pass did NOT return a confirmed result (agent failure/no-response) — its punch-list may be incomplete or missing this run. Note this explicitly in the progress/decisions write-up below so the owner knows to double-check fidelity by hand; the deterministic visual regression check inside the full verify.sh below is the remaining safety net.'
    }
  }

  phase('Review')
  const needsOwner = blockedFrds.filter((x) => blockedReasons[x] === 'needs-owner')
  // Project-wide hardening/release is authority a bare whole-project run owns. A targeted FRD/change
  // run closes as a scoped partial run even when its final gate happens to make every global WO VERIFIED.
  const allDone = !TARGETED && !stopReason && !deferredWork && blockedFrds.length === 0 && reopenedFrds.length === 0 && builtFrds.length === plan.frds.length   // WS-D/D4a: a drained change's deferred WOs (into an already-planned FRD) block release this run
  if (allDone) {
    const { sec, telem, hardened } = await runHardeningChain()
    phase('Review')
    if (hardened) {
      agentSpawned += COST(P.judge)
      closed = await agent(`${archiveStep}All FRDs are VERIFIED and the DR-085 hardening left its evidence — now the CROSS-FEATURE INTEGRATION REVIEW (DR-060): the seam check the per-FRD gates CANNOT do (each only sees its own feature). The dominant failure of parallel builds is at the seams BETWEEN features — every component correct in isolation, broken together. Trace the data flow ACROSS feature boundaries and verify every producer/consumer pair actually AGREES: each consumer's expectations vs its provider's \`docs/api/<wo-id>.md\` contract (field names, data shapes, formats, units, status codes, routes), shared types/enums used consistently across features, and NO two features that shipped duplicate or divergent versions of the same component/util (cross-check \`docs/design/components.md\`).${GATE_SKIP} THEN run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since — includes the smoke + visual gates) and kill any test dev servers with TaskStop. FINALLY, before you may declare release, assert ALL of these ON DISK (BL-0012 + WS-D/D4 fail-closed) — if ANY fails, do NOT set phase: release and return done:false naming exactly what failed:
    (i) **every** docs/frds/*/frd.md rollup \`implementation_status\` is VERIFIED (WS-D/D4b — do a FRESH read of each frd.md on disk right now; if any is NOT VERIFIED, return { done: false } listing the offending FRD folders — the in-memory built-count is NOT enough, the disk is the oracle);
    (ii) assert the hardening evidence EXISTS **and is FRESH**: the security report docs/reviews/security-<TODAY>.md exists (TODAY = \`date -u +%F\`) AND its mtime is NEWER than status.yaml's \`run_started_at\` (WS-D/D4c — compare epochs, e.g. \`date -r docs/reviews/security-<TODAY>.md +%s\` vs the epoch of run_started_at; a STALE same-day report left by a PREVIOUS run FAILS this assert), AND the "## Verification" section is present in docs/analytics/events.md.
  If a cross-feature seam is wrong, reopen the offending work order (set it \`implementation_status: PLANNED\`) and return done:false with the finding. If everything integrates AND the full suite is green AND all of (i)+(ii) hold: set .pandacorp/status.yaml phase: release (commit it as part of this step's own commit — \`running\` is set to false by the terminal lease release at the very end of this prompt, NOT by hand here).${JOURNAL_GOLD}${HARDENING_EVENT('integration')} (status ok iff you declared release, else fail.) If (and ONLY if) you set phase: release above, ALSO record the run's terminal verdict:${BUILD_COMPLETE('released', `${builtFrds.length}/${plan.frds.length}`)}${visualQaNote}${RELEASE_LEASE} Return done:true ONLY once every step above succeeded — phase:release committed, the terminal verdict recorded, AND this terminal lease release.${NOTIFY('Build COMPLETO: FRDs verificados + hardening + integracion cross-feature OK', 'Glass')}`,
        { label: 'close-out', phase: 'Review', model: P.judge, effort: 'xhigh', agentType: 'pandacorp:reviewer', schema: STOP_SCHEMA })
      // WS-A/D5: don't assert success the close-out did not confirm — a dead close-out returns done:false
      // (the fail-safe below then guarantees running:false); log honestly instead of a blanket "verified".
      log(closed && closed.done === true
        ? 'Run ended: all FRDs verified + hardened.'
        : 'Run ended: all FRDs verified + hardened, but the close-out agent did not confirm release — the fail-safe will ensure running:false (phase stays implementation).')
    } else {
      agentSpawned++
      closed = await agent(`${archiveStep}Every FRD is VERIFIED but the DR-085 hardening did NOT complete (security: ${sec && sec.done === true ? 'ok' : 'INCOMPLETE — ' + ((sec && sec.failure) || 'failed')}; telemetry: ${telem && telem.done === true ? 'ok' : 'INCOMPLETE — ' + ((telem && telem.failure) || 'failed')}). The project must NOT be declared released (BL-0012 fail-closed — release requires the hardening evidence). 1) Append the hardening failure + your recommendation to .pandacorp/inbox/decisions.md (needs-owner). 2) Write a short Spanish summary to .pandacorp/comms/progress.md (todo verificado, hardening incompleto, qué falta). 3) Do NOT touch \`phase\` (KEEP it implementation) — \`running\` is set to false by the terminal lease release at the very end of this prompt, NOT by hand here.${visualQaNote}${RELEASE_LEASE} Return done:true ONLY once status.yaml/decisions.md reflect the above AND this terminal lease release succeeded.${NOTIFY('Build verificado pero hardening INCOMPLETO — NO se declara release; necesita tu decision')}`,
        { label: 'close-needs-hardening', phase: 'Review', model: P.worker, agentType: 'pandacorp:implementer', schema: STOP_SCHEMA })
      log('Run ended: all FRDs verified but hardening incomplete — NOT released (needs-owner).')
    }
  } else {
    const blk = blockedFrds.map((x) => `${x}(${blockedReasons[x]})`).slice(0, 8).join(', ') || 'ninguno'
    const why = stopReason === 'agents' ? ' Paro por techo de agentes (maxAgents).'
      : stopReason === 'budget' ? ' Paro por techo de presupuesto.'
      : stopReason === 'blocks' ? ' Paro: demasiados FRDs bloqueados seguidos (algo sistemico va mal).'
      : stopReason === 'rethink' ? ' Paro en safe point: el owner re-planificó (rethink_pending) — la próxima corrida retoma con el plan nuevo.'
      : stopReason === 'maxFrds' ? ' Paro por el tope de prueba (maxFrds).' : ''
    const ownerMsg = needsOwner.length
      ? `Termine lo que se podia. ${needsOwner.length} FRD(s) te esperan a ti: ${needsOwner.slice(0, 6).join(', ')}`
      : `Tramo: ${builtFrds.length} FRDs ok, ${blockedFrds.length} bloqueados, ${reopenedFrds.length} a reintentar`
    agentSpawned++   // WS-A/D4: honest counter — every spawn site increments (DR-070); notify-end was the one omission
    closed = await agent(`${archiveStep}The build run ended.${why} Verified this run: ${builtFrds.length}. Reopened (retry next run): ${reopenedFrds.length}. Blocked: ${blockedFrds.length} (${blk}). Of those, NEEDS-OWNER (a human must act): ${needsOwner.join(', ') || 'none'}.${GATE_SKIP} FIRST run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since) to confirm this pass left no global regression — note the result (a needs-owner-quarantined route is held aside, so its blocked state must NOT red this full-suite check; that is the whole point — the independent features still reach a green baseline while the blocked route waits on the owner, BL-0011). Then write a short Spanish summary to .pandacorp/comms/progress.md (what advanced, what's blocked and the reason, the full-suite result, and exactly what needs the owner's action/decision for the needs-owner ones). Do NOT touch \`phase\` (leave it as-is) — \`running\` is set to false by the terminal lease release at the very end of this prompt, NOT by hand here.${visualQaNote}${JOURNAL_GOLD}${BUILD_COMPLETE('partial', `${builtFrds.length}/${plan.frds.length}`)}${RELEASE_LEASE} Return done:true ONLY once status.yaml/progress.md reflect the above AND this terminal lease release succeeded.${NOTIFY(ownerMsg)}`,
      { label: 'notify-end', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
    log(`Run ended: ${builtFrds.length} verified, ${reopenedFrds.length} reopened, ${blockedFrds.length} blocked${stopReason ? ' · stop=' + stopReason : ''}.`)
  }
} else {
  // ═══ LEGACY close-out (args.leanCloseOut:false) — byte-identical to the pre-WP-02 shape: visual-qa
  // awaited fully in series, then archive-changes, then the closing agent, then release-lease — four
  // potential serial spawns instead of WP-02's one. Kept for isolating a close-out regression.
  let visualQaSkipEvent = ''
  if (plan.hasFrontend && builtFrds.length) {
    const builtWos = builtFrds.flatMap((frd) => (frdState.get(frd) || {}).f?.workOrders || [])
    if (uiPassesRequired(builtWos)) {   // REV-D6: fails closed on a frdState miss, not just on a real UI artifact
      phase('Review')
      agentSpawned += COST(VISUAL_QA_MODEL)   // DR-073: weighted by the model actually spawned (E-3: sonnet by default, not P.judge)
      await agent(visualQaPromptBody(builtFrds),
        { label: 'visual-qa', phase: 'Review', model: VISUAL_QA_MODEL, effort: 'high', agentType: 'pandacorp:reviewer', schema: { type: 'object', required: ['done'], properties: { done: { type: 'boolean' } } } })
      log(`Visual QA pass done over ${builtFrds.length} FRD(s) — see .pandacorp/comms/visual-punch-list.md`)
    } else {
      log(`⊘ visual-qa omitido: ninguna WO de los FRDs verificados esta corrida (${builtFrds.join(', ')}) declara artefactos de UI (fail-closed si no declaran); el diff visual determinista sigue en el verify.sh completo del cierre`)
      visualQaSkipEvent = UI_PASS_SKIPPED_EVENT('visual-qa', builtFrds.join(','), 'no-ui-artifacts')
    }
  }

  if (builtFrds.length) {
    phase('Review')
    agentSpawned++
    await agent(`Archive landed changes — the DR-069 §7 verify-then-archive protocol (durable, cross-run).\n${archiveChangesBody}\n  Return { done: true }.${visualQaSkipEvent}`,
      { label: 'archive-changes', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
    log('✓ DR-069 §7 verify-then-archive sweep (building changes whose affected_frds all VERIFIED → done/)')
  } else if (integratedChanges.length) {
    log(`↷ ${integratedChanges.length} change(s) integradas pero este run no verificó FRDs — siguen 'building' y se archivan en la corrida que verifique sus FRDs (DR-069 §7, durable cross-run)`)
  }

  phase('Review')
  const needsOwner = blockedFrds.filter((x) => blockedReasons[x] === 'needs-owner')
  const allDone = !TARGETED && !stopReason && !deferredWork && blockedFrds.length === 0 && reopenedFrds.length === 0 && builtFrds.length === plan.frds.length
  if (allDone) {
    const { sec, telem, hardened } = await runHardeningChain()
    phase('Review')
    if (hardened) {
      agentSpawned += COST(P.judge)
      closed = await agent(`All FRDs are VERIFIED and the DR-085 hardening left its evidence — now the CROSS-FEATURE INTEGRATION REVIEW (DR-060): the seam check the per-FRD gates CANNOT do (each only sees its own feature). The dominant failure of parallel builds is at the seams BETWEEN features — every component correct in isolation, broken together. Trace the data flow ACROSS feature boundaries and verify every producer/consumer pair actually AGREES: each consumer's expectations vs its provider's \`docs/api/<wo-id>.md\` contract (field names, data shapes, formats, units, status codes, routes), shared types/enums used consistently across features, and NO two features that shipped duplicate or divergent versions of the same component/util (cross-check \`docs/design/components.md\`).${GATE_SKIP} THEN run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since — includes the smoke + visual gates) and kill any test dev servers with TaskStop. FINALLY, before you may declare release, assert ALL of these ON DISK (BL-0012 + WS-D/D4 fail-closed) — if ANY fails, do NOT set phase: release and return done:false naming exactly what failed:
    (i) **every** docs/frds/*/frd.md rollup \`implementation_status\` is VERIFIED (WS-D/D4b — do a FRESH read of each frd.md on disk right now; if any is NOT VERIFIED, return { done: false } listing the offending FRD folders — the in-memory built-count is NOT enough, the disk is the oracle);
    (ii) assert the hardening evidence EXISTS **and is FRESH**: the security report docs/reviews/security-<TODAY>.md exists (TODAY = \`date -u +%F\`) AND its mtime is NEWER than status.yaml's \`run_started_at\` (WS-D/D4c — compare epochs, e.g. \`date -r docs/reviews/security-<TODAY>.md +%s\` vs the epoch of run_started_at; a STALE same-day report left by a PREVIOUS run FAILS this assert), AND the "## Verification" section is present in docs/analytics/events.md.
  If a cross-feature seam is wrong, reopen the offending work order (set it \`implementation_status: PLANNED\`) and return done:false with the finding. If everything integrates AND the full suite is green AND all of (i)+(ii) hold: set .pandacorp/status.yaml phase: release and running: false. Return done:true once status.yaml is written.${JOURNAL_GOLD}${HARDENING_EVENT('integration')} (status ok iff you declared release, else fail.) If (and ONLY if) you set phase: release above, ALSO record the run's terminal verdict:${BUILD_COMPLETE('released', `${builtFrds.length}/${plan.frds.length}`)}${NOTIFY('Build COMPLETO: FRDs verificados + hardening + integracion cross-feature OK', 'Glass')}`,
        { label: 'close-out', phase: 'Review', model: P.judge, effort: 'xhigh', agentType: 'pandacorp:reviewer', schema: STOP_SCHEMA })
      log(closed && closed.done === true
        ? 'Run ended: all FRDs verified + hardened.'
        : 'Run ended: all FRDs verified + hardened, but the close-out agent did not confirm release — the fail-safe will ensure running:false (phase stays implementation).')
    } else {
      agentSpawned++
      closed = await agent(`Every FRD is VERIFIED but the DR-085 hardening did NOT complete (security: ${sec && sec.done === true ? 'ok' : 'INCOMPLETE — ' + ((sec && sec.failure) || 'failed')}; telemetry: ${telem && telem.done === true ? 'ok' : 'INCOMPLETE — ' + ((telem && telem.failure) || 'failed')}). The project must NOT be declared released (BL-0012 fail-closed — release requires the hardening evidence). 1) Append the hardening failure + your recommendation to .pandacorp/inbox/decisions.md (needs-owner). 2) Write a short Spanish summary to .pandacorp/comms/progress.md (todo verificado, hardening incompleto, qué falta). 3) Set .pandacorp/status.yaml running: false and KEEP phase: implementation. Return done:true once status.yaml is written.${NOTIFY('Build verificado pero hardening INCOMPLETO — NO se declara release; necesita tu decision')}`,
        { label: 'close-needs-hardening', phase: 'Review', model: P.worker, agentType: 'pandacorp:implementer', schema: STOP_SCHEMA })
      log('Run ended: all FRDs verified but hardening incomplete — NOT released (needs-owner).')
    }
  } else {
    const blk = blockedFrds.map((x) => `${x}(${blockedReasons[x]})`).slice(0, 8).join(', ') || 'ninguno'
    const why = stopReason === 'agents' ? ' Paro por techo de agentes (maxAgents).'
      : stopReason === 'budget' ? ' Paro por techo de presupuesto.'
      : stopReason === 'blocks' ? ' Paro: demasiados FRDs bloqueados seguidos (algo sistemico va mal).'
      : stopReason === 'rethink' ? ' Paro en safe point: el owner re-planificó (rethink_pending) — la próxima corrida retoma con el plan nuevo.'
      : stopReason === 'maxFrds' ? ' Paro por el tope de prueba (maxFrds).' : ''
    const ownerMsg = needsOwner.length
      ? `Termine lo que se podia. ${needsOwner.length} FRD(s) te esperan a ti: ${needsOwner.slice(0, 6).join(', ')}`
      : `Tramo: ${builtFrds.length} FRDs ok, ${blockedFrds.length} bloqueados, ${reopenedFrds.length} a reintentar`
    agentSpawned++
    closed = await agent(`The build run ended.${why} Verified this run: ${builtFrds.length}. Reopened (retry next run): ${reopenedFrds.length}. Blocked: ${blockedFrds.length} (${blk}). Of those, NEEDS-OWNER (a human must act): ${needsOwner.join(', ') || 'none'}.${GATE_SKIP} FIRST run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since) to confirm this pass left no global regression — note the result (a needs-owner-quarantined route is held aside, so its blocked state must NOT red this full-suite check; that is the whole point — the independent features still reach a green baseline while the blocked route waits on the owner, BL-0011). Then write a short Spanish summary to .pandacorp/comms/progress.md (what advanced, what's blocked and the reason, the full-suite result, and exactly what needs the owner's action/decision for the needs-owner ones). Set .pandacorp/status.yaml running: false. Return done:true once status.yaml is written.${JOURNAL_GOLD}${BUILD_COMPLETE('partial', `${builtFrds.length}/${plan.frds.length}`)}${NOTIFY(ownerMsg)}`,
      { label: 'notify-end', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
    log(`Run ended: ${builtFrds.length} verified, ${reopenedFrds.length} reopened, ${blockedFrds.length} blocked${stopReason ? ' · stop=' + stopReason : ''}.`)
  }
}
// Fail-safe: never leave Mission Control showing a phantom running build. Identical in both close-out
// shapes — WP-02 does not touch this (it stays the invariant that guarantees running:false no matter
// which closing agent ran or how it failed).
if (!closed || closed.done !== true) {
  agentSpawned++
  await agent(`Fail-safe close: ensure running:false through the lease owner. Do NOT touch \`phase\`; NEVER set phase: release here. ${RELEASE_LEASE} Confirm done:true.`,
    { label: 'ensure-stopped', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
}

// Legacy shape only: the lean closing agent above already performed its OWN terminal lease release as
// the last step of its own prompt (or the fail-safe above just did it after a failure) — a separate
// spawn here would be a redundant fourth close-out agent, exactly what WP-02 removes.
if (!LEAN_CLOSE_OUT && closed && closed.done === true) {
  agentSpawned++
  await agent(`Terminal lease close. ${RELEASE_LEASE} Confirm done:true.`,
    { label: 'release-lease', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
}

return { mode: MODE, builtFrds, blockedFrds, reopenedFrds, blockedReasons, stopReason }
