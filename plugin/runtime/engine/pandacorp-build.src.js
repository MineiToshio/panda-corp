export const meta = {
  name: 'pandacorp-build',
  description: 'Pandacorp build engine v2 (DR-050 + BL-0021 + DR-118): builds in GLOBAL WAVES — every wave takes the ready work orders of ALL FRDs (dependsOn satisfied, artifacts disjoint per DR-060, capped at the mode\'s wave) so independent features build in parallel; the per-FRD review/test gate runs CONCURRENTLY with the next wave\'s build, against its own pinned detached worktree snapshot (DR-118) — gates never wait for a wave boundary, but still serialize WITH EACH OTHER (one gate worktree). State lives in the work-order frontmatter (implementation_status). Runs to COMPLETION by default; stops ONLY by health or budget — nothing left to build, a budget ceiling, too many blocks in a row, or work that needs the owner. It TRIES TO REPAIR before giving up; an unrecoverable stop BLOCKS with a reason (needs-owner | external | error) instead of dying. Resumable: it reads the frontmatter and NEVER rebuilds a VERIFIED work order.',
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
// BL-0178: the pre-existing-drift fact gatherer ships next to the state CLI in the SAME installed plugin
// scripts dir — derived from the already-validated capability path, never from CLAUDE_PLUGIN_ROOT (BL-0071).
const DRIFT_CLI_COMMAND = `node ${shellQuote(STATE_CLI.replace(/[^/]+$/, 'drift-proof.mjs'))}`
// BL-0189: the FRD contract-inventory cache's I/O script ships in the same installed scripts dir (same rule).
const INVENTORY_CLI_COMMAND = `node ${shellQuote(STATE_CLI.replace(/[^/]+$/, 'gate-inventory.mjs'))}`

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
//   args.driftFinder: BL-0203 (canary F2) — the WHOLE-FRD DRIFT FINDER. **Default ON under gateEvidence:'digested',
//     OFF under 'explore'**; `true` turns it on in explore too, `false` turns it off. Canary E2 measured why digested
//     needs it: the judge's 8-read budget and a diff scoped to the reviewed WOs never reached the VERIFIED code where
//     the FRD's drift lived (AC-02-010.8, REQ-03-001 lost; recall 2/5 vs explore's 4/5). One sonnet
//     `find:drift:<frd>` agent (pandacorp:drift-finder, effort medium, ≤ DRIFT_FINDER_TOOL_BUDGET tool calls) runs in
//     the gate's pinned worktree CONCURRENTLY with the evidence collector (and so beside the split gate's lenses),
//     receives the FRD's whole contract roster — never the diff — and reports implemented | drift | unknown per
//     contract with file:line evidence, writing a probe per drift. It PROPOSES: the report reaches the judge's
//     prompt (DR-015), and every drift claim the judge neither recorded as a fail nor refuted with a test of its own
//     goes through the DR-122 differential proof (finalizeGate): proven pre-existing → card + `drift:`; a regression,
//     or a reviewed-WO-owned contract failing on an assertion at the pin → reopened patch-first; anything unproven →
//     discarded with a log. Cost: 1 sonnet unit in maxAgents (COST('sonnet')). A dead/malformed finder is a logged
//     DriftFinderFallback; the gate always runs. Only the pinned gate that launched it sees its report; re-gates on
//     main do not (its probes live in the released slot).
//   args.gateContextScope: OPT-IN (BL-0188, **default FALSE** until canary E measures it) — proposal 38
//     addendum lever (g). Adds a CONTEXT-SCOPE directive to every FRD gate (serial, split finders and
//     closer): read frd.md and this cycle's WOs in full, the FRD's other (VERIFIED) WOs header-only, the
//     blueprint by section, rules/standards/memory as pointers, never the factory/engine source, heavy
//     command output to a file + tail. A gate's cost ≈ turns × context-per-turn and cache reads are ~80%
//     of it (D2: 125-143k tokens/turn), so what the reviewer READS is the lever (the spawn prompt is ~3-4% of a turn).
//     It never relaxes an obligation: the whole-FRD oracle, DR-080 tests and the 7-class inventory stand.
//   args.gateInventoryCache: OPT-IN (BL-0189, **default FALSE** until a repeat-gate canary measures it) —
//     proposal 38 addendum lever (d), "FRD baseline gated at SHA". After a GREEN gate the certifying
//     landing (applyGate — the single writer) persists .pandacorp/run/gate-evidence/<frd>/inventory.json:
//     the adjudicated contract list (REQ/AC/…, class, status, evidence tests) + gatedAt + the sha256 of
//     frd.md/blueprint.md's normative BODY at that pin (frontmatter excluded: rollups rewrite it on every
//     landing). The next gate of that FRD runs a MECH `gate-inventory:<frd>` check first; ONLY when both
//     fingerprints are unchanged at the new pin does the prompt inject the cached inventory — the reviewer
//     deep-reviews the cycle's contracts, re-runs every other contract's evidence tests by path, samples
//     the rest, and must still return EVERY cached contract (the engine refuses a green that drops one).
//     Absent/stale → the full whole-FRD inventory, as today. Malformed → logged LOUD (DR-078), full oracle.
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
//     burn 85 tool calls — it brakes agent WEIGHT, not tokens. BL-0138 (path 1) adds a SECOND, REAL-TOKEN
//     signal alongside it — see the brake's own comment below for what it can and cannot measure.
//   args.repairBudgetFactor: how many times an FRD's own build spend its repair may cost before the
//     brake fires (default 3 — the FRD-24 measurement was 3.5x). Only read when repairBrake is on. The
//     budget floors at 9 units regardless of factor x base (BL-0138 path 2, shipped): on a realistic 1-WO
//     FRD (build cost C=2, budget = 3x2 = 6) the unfloored ladder patch-1(3)+diagnose(3)+patch-2(3)=9 was
//     cut BEFORE patch-2 — losing a whole rung of recovery depth on the smallest, most common FRD shape.
//     The floor guarantees that escalator always fits regardless of the agent-weight proxy's accuracy.
//     BL-0138 path 1 (real tokens) layers a SECOND, independent ceiling on top, in the SAME units the
//     repair actually spends: REPAIR_BUDGET_FACTOR x this FRD's build spend measured in real output
//     tokens (a budget.spent() delta), consulted with OR semantics — it can only RESCUE a rung the
//     floored agent-weight ceiling would have refused, never refuse one agent-weight would have allowed.
//     It is trustworthy only when the FRD's own build wave contained THAT ONE FRD alone (budget.spent()
//     is a single un-partitioned counter for the whole run — a multi-FRD wave's delta can't be split
//     among its FRDs); when it can't be isolated, the brake falls back to agent-weight alone and logs
//     that fallback (see canAffordRepair). Real tokens are NOT tracked for the build-side denominator in
//     the general case — the engine's own global-wave design deliberately builds MULTIPLE FRDs
//     concurrently (see the module description above), so a per-FRD real-token BUILD cost is provably
//     unmeasurable there without either serializing builds (an unacceptable regression) or an SDK change
//     exposing per-agent token usage (agent() returns none today).
//   args.driftPolicy: 'record' (DEFAULT) | 'block' — BL-0178 policy (a*). The whole-FRD oracle still reports
//     EVERY contradiction as a `fail` entry; the reviewer may only PROPOSE one as pre-existing drift
//     (`claim: "preexisting"` + a probe test, `evidence_test`). Under 'record' the ENGINE proves it with a
//     differential run (MECH: drift-proof.mjs runs the probe at the pin AND at the pin's last_green_sha):
//     fails at both → recorded as a draft change card + the FRD's `drift:` frontmatter, and it never blocks
//     or reopens the cycle's work orders; passes at last green → a regression this cycle caused → reopened
//     patch-first; passes at the pin → the claim is discarded (logged); unloadable/flaky/owned/unprovable →
//     a cycle fault (fail-closed). 'block' is the rollback switch: claims are ignored and every `fail` is a
//     cycle fault exactly as before BL-0178. Any other value falls back to 'record' with a loud log.
//   args.parallelGates: OPT-OUT (**default TRUE** since v9.116.0 — canary F1/F2 verdict, proposal 38
//     "Cierre del sprint": the gates are no longer the cost/time bottleneck, 0 drops to the legacy lane, 0
//     idle slots, same recall parity, ~0.3-0.4 $/run overhead. D1 — proposal 38 Decision 1 + its red-team
//     addendum, BL-0186). Explicit `false`/`'false'` restores the DR-118/C2 topology byte-for-byte (one gate
//     worktree, gates serialized on one mutex chain, a reject quiesces every in-flight gate). On (the
//     default) = a POOL of `gateSlots` gate worktrees (`.pandacorp/run/gate-worktree-<k>`, k = 1..N, each
//     bootstrapped with its OWN explicit e2e port), so up to N FRD gates REVIEW at once — only FRDs whose
//     artifacts are disjoint (DR-060's own artifactsOverlap); a dependency (cross-FRD `dependsOn`,
//     transitive, plus FRD-level deps) orders only the LANDING (E2 finding 1, BL-0194); every verdict then
//     LANDS on main through ONE serialized lane in arrival order (apply / patch ladder / persist-block,
//     never two at once), with a stale-pin guard (main advanced in code since the pin → `verify.sh --since
//     <pin>` before stamping; red → the PASS becomes a reopen).
//     See the "D1 PARALLEL FRD GATES" section below and factory/standards/build-orchestration.md §5c.
//   args.gateSlots: the pool size when parallelGates is on (integer 1..8, **default 2** — the red-team's
//     16 GB measurement, X6; anything else → 2 with a loud log). `args.maxParallelGates` (the proposal's name) is accepted as an alias; gateSlots
//     wins when both are set. Ignored (logged) when parallelGates is off.
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
// BL-0203: see the arg doc above. Default = on iff the gate runs digested; any other value is named in the log.
const DRIFT_FINDER = (() => {
  const raw = args ? args.driftFinder : undefined
  if (raw === undefined || raw === null) return GATE_EVIDENCE === 'digested'
  if (raw === true || raw === 'true') return true
  if (raw === false || raw === 'false') return false
  log(`⚠ args.driftFinder='${raw}' no es booleano — usando el default (${GATE_EVIDENCE === 'digested' ? 'on' : 'off'} con gateEvidence '${GATE_EVIDENCE}') (BL-0203)`)
  return GATE_EVIDENCE === 'digested'
})()
// proposal 37 / E-3: visual-qa is DR-072 ADVISORY (a punch-list, never a block) — sonnet is the
// default judge for it instead of opus (measured ≈2.20 $ on FRD-24 vs 5.50 $ on opus). Escape hatch
// args.visualQaModel='opus' restores the prior tier; anything else falls back to 'sonnet' with a loud
// log — an unrecognised value must never silently pick a tier the owner did not ask for.
const VISUAL_QA_MODEL = (args && args.visualQaModel === 'opus') ? 'opus' : 'sonnet'
const GATE_CONTEXT_SCOPE = argBool(args, 'gateContextScope', true)       // BL-0188 — see the arg doc above (default off)
const GATE_INVENTORY_CACHE = argBool(args, 'gateInventoryCache', true)   // BL-0189 — see the arg doc above (default off)
if (args && args.visualQaModel !== undefined && args.visualQaModel !== 'sonnet' && args.visualQaModel !== 'opus') {
  log(`⚠ args.visualQaModel='${args.visualQaModel}' no es 'sonnet' ni 'opus' — usando 'sonnet' (E-3 fail-closed)`)
}
const DRIFT_POLICY = (args && args.driftPolicy === 'block') ? 'block' : 'record'
if (args && args.driftPolicy !== undefined && args.driftPolicy !== 'record' && args.driftPolicy !== 'block') {
  log(`⚠ args.driftPolicy='${args.driftPolicy}' no es 'record' ni 'block' — usando 'record' (BL-0178)`)
}
// D1 (BL-0186): see the arg doc above. Default TRUE since v9.116.0 (F1/F2 verdict) — opt-out via an
// explicit {"parallelGates": false} (or the launcher's --no-parallel-gates), the same pattern as
// LEAN_CLOSE_OUT/REPAIR_BRAKE below. argBool tolerates the stringly-typed "false" (D-9).
const PARALLEL_GATES = !argBool(args, 'parallelGates', false)
const GATE_SLOTS_MAX = 8
// 2, not the proposal's 3: the red-team measured the build machine at 16 GB (addendum e6/X6), where each slot
// runs its own next dev + Chromium + vitest + tsc — raise it explicitly on a bigger machine.
const GATE_SLOTS_DEFAULT = 2
const GATE_SLOTS = (() => {
  const raw = args && (args.gateSlots !== undefined && args.gateSlots !== null ? args.gateSlots : args.maxParallelGates)
  if (!PARALLEL_GATES) {
    if (raw !== undefined && raw !== null) log(`⚠ args.gateSlots/maxParallelGates='${raw}' ignored — args.parallelGates is off, so gates keep the single C2 worktree (D1)`)
    return 0
  }
  if (args && args.gateSlots !== undefined && args.gateSlots !== null && args.maxParallelGates !== undefined && args.maxParallelGates !== null && Number(args.gateSlots) !== Number(args.maxParallelGates)) {
    log(`⚠ both args.gateSlots=${args.gateSlots} and args.maxParallelGates=${args.maxParallelGates} were passed — gateSlots wins (D1)`)
  }
  if (raw === undefined || raw === null) return GATE_SLOTS_DEFAULT
  const n = Number(raw)
  if (Number.isInteger(n) && n >= 1 && n <= GATE_SLOTS_MAX) return n
  log(`⚠ args.gateSlots='${raw}' is not an integer 1..${GATE_SLOTS_MAX} — using ${GATE_SLOTS_DEFAULT} gate slots (D1 fail-closed)`)
  return GATE_SLOTS_DEFAULT
})()
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
// BL-0172: SYNC_ROLLUPS's own text only ever asks for the governed CLI write itself — the command
// rewrites docs/frds/*/frd.md and blueprint.md DIRECTLY ON DISK (see syncRollupsUnlocked in
// plugin/runtime/build-state.mjs), never through git. Every call site is responsible for staging+
// committing THAT mutation itself. Most already do, folded into one broader "stage X, Y, Z and commit"
// sentence a few words later — but the notify-end/partial-close prompts' only LATER staging instruction
// is RELEASE_LEASE, whose own text is a literal "stage ONLY .pandacorp/status.yaml" (line below): that
// silently starves the rollup-doc commit THIS same prompt just asked sync-rollups for, leaving
// frd.md/blueprint.md dirty, uncommitted, after the run ends (canary-d evidence, BL-0172 — work_orders_
// in_review already reflected the new rollup in status.yaml, but the tracked frd.md/blueprint.md that
// same command rewrote never made it into a commit). Appended right after ${SYNC_ROLLUPS} wherever no
// broader commit sentence already covers it.
// E2 finding 4: canary E2's FRD-05 landing left its frd.md/blueprint.md flip uncommitted, and notify-end's own
// sync-rollups then changed nothing (the disk was already right), so this conditional never fired. It also commits
// a rollup document an earlier step left modified.
const SYNC_ROLLUPS_COMMIT = ' If that command changed any docs/frds/*/frd.md or blueprint.md on disk — or `git status --porcelain -- docs/frds` still lists one of those rollup documents as modified (an earlier step left it uncommitted) — stage ONLY those rollup documents and commit them right now, as their OWN commit (Conventional Commits, scope) — BEFORE anything else below.'
// GENERATED from the canonical marked block in plugin/agents/reviewer.md — do not hand-edit.
const WHOLE_FRD_ORACLE = "**Whole-FRD source oracle (mandatory, fail-closed):** before judging code or writing tests, inventory every normative contract in the entire `frd.md` — requirements, numbered acceptance criteria, invariants, edge cases, limits, errors and exclusions — including normative material outside numbered ACs. Record a traceability checklist in the verdict with each contract, its class, `pass | fail | not-applicable`, and the test path(s) that prove it. **The inventory needs at least one entry for EACH of the 7 contract classes** (requirement, acceptance-criterion, invariant, edge-case, limit, error, exclusion): a numbered REQ-NN-MMM requirement is its OWN `requirement` entry, distinct from the acceptance-criterion entries that verify it — do not cover a requirement only through its ACs and skip the `requirement` entry. If a class genuinely does not apply to this FRD, add a `not-applicable` entry for it with `tests: []` instead of omitting the class — an omitted class is itself RED even when every other class is complete. Every applicable edge-case or limit class requires at least one adversarial boundary test. Missing inventory, missing applicable boundary coverage, or any contradiction is RED. Passing numbered ACs can never waive, override or dismiss another normative FRD clause; there are no reviewer waivers for approved spec text. A contradiction you believe pre-dates this cycle is still a `fail` entry — never dropped, never waived — at most PROPOSED as pre-existing drift for the engine to prove or reject."
// BL-0178: GENERATED from plugin/agents/reviewer.md's DRIFT_CLAIM block (generate-build-prompt-fragments.mjs) — do not hand-edit.
// The reviewer PROPOSES pre-existing drift (claim + a probe test); the engine proves or rejects it (adjudicateDrift below).
const DRIFT_CLAIM_DIRECTIVE = "**Pre-existing drift (DR-122, BL-0178) — you PROPOSE, the engine DECIDES:** when a `fail` contract is contradicted by code you believe this cycle did NOT cause (legacy code, a contract no reviewed work order owns through its `source_requirements`), keep it a `status: \"fail\"` traceability entry and ADD `claim: \"preexisting\"`, `evidence_test` and `direction`. `evidence_test` is the repo-relative path of a probe you write at `.pandacorp/run/drift-probes/<frd>/<contract-id>.drift-probe.ts` (one file per claim, named after the contract id, e.g. `ac-02-010-4.drift-probe.ts`): a vitest file that FAILS on an assertion precisely because of the contradiction and would PASS once the contract holds, importing production code ONLY through the `@/` alias (never a relative import — the engine runs it from a copy placed elsewhere). The path is deliberately outside the collected test tree: never list it in `testFiles` and never copy it into `src/`. `direction` is `code` (the code is wrong), `spec` (the spec is stale) or `unknown`. The engine runs your probe at this pin AND at the pin's `last_green_sha`: only a probe that fails on an assertion at BOTH is recorded as pre-existing drift (a draft change card for the owner plus a `drift:` list in the FRD frontmatter) — it then never blocks and never reopens this cycle's work orders; a probe that passes at `last_green_sha` is a regression this cycle caused and is reopened patch-first; a probe that passes at this pin is discarded; an unloadable or flaky probe proves nothing and is treated as a cycle fault. So when your ONLY reds are pre-existing drift claims, return the verdict you would give without them — `green: true` with your `testFiles` — and never take the blocked/needs-owner exit for a drift claim. Never claim a contract a reviewed work order owns."
// BL-0203: GENERATED from plugin/agents/drift-finder.md's DRIFT_FINDER block (generate-build-prompt-fragments.mjs) — do not hand-edit.
const DRIFT_FINDER_DIRECTIVE = "**Whole-FRD drift finder method (BL-0203) — one pass over EVERY contract, located in the code, never assumed:** 1. **Inventory.** Read `docs/frds/<frd>/frd.md` in full at this pin and list every normative contract with its id: each `REQ-NN-MMM` requirement, each `AC-NN-MMM.K` acceptance criterion, and the `CMP-NN-*`/`IF-NN-*` components and interfaces its `blueprint.md` declares. A clause without an id is still a contract — name it by its section. Do not stop at the contracts the work orders under review own: the drift this pass exists for lives in the OTHER contracts, the ones earlier cycles verified. 2. **Locate each one in the code, not in its name.** `grep` for the id, for the identifiers, routes, labels and literal strings the contract names, and OPEN the file that implements it. Never mark a contract implemented because a file or function has a plausible name, because a test with its id exists, or because a work order's Status Note says so — read the lines that do the work and quote them. 3. **Compare literally.** Check values, sets, enums, lists and mappings item by item against the text — a filter set the spec requires to exclude a category can still contain it under an old or renamed label. Check that content the spec requires is actually present in the rendered output, not just that the component that should carry it exists — a prior revert can silently drop the content while leaving the component standing. Check that a surface the spec requires is mounted on a reachable route, not only defined in an unused component. 4. **Check input validation beyond the type.** For every contract about parsing, dates, numbers or user input, find the validation and ask what it accepts that it should not: a lenient date parser can accept a string that only looks like a date, or resolve a calendar day in the wrong timezone; a lenient number parser can accept trailing non-numeric characters. A validation criterion met only for the inputs the implementer happened to test is drift. 5. **Classify each contract** — `implemented` (you read the implementing lines; give file, line and a short snippet), `drift` (the code contradicts the text; quote both sides in `why`), or `unknown` (you could not locate the implementation, or your tool budget ran out before you reached it). Never guess `implemented` to finish faster: an honest `unknown` makes the judge look; a false `implemented` hides the defect. Set `owner` to the work order whose `source_requirements` (frontmatter) lists the contract, or `none`, and `claim` to `cycle` when that owner is one of the work orders under review this cycle, else `preexisting`. 6. **Write one probe per drift.** A vitest file at `.pandacorp/run/drift-probes/<frd>/<contract-id-slug>.finder.drift-probe.ts` (e.g. `req-03-001.finder.drift-probe.ts`; the `.finder` infix keeps it apart from the reviewer's own probes) that FAILS on an assertion precisely because of the contradiction and would PASS once the contract holds. Import production code ONLY through the `@/` alias (the engine runs a copy of it from another directory) and `describe/it/expect` from `vitest`; keep it deterministic (fixed dates, no network, no real clock). Write it with a Bash heredoc. Do not run it — the engine runs it twice at two commits. It lives outside the collected test tree on purpose: never copy it into `src/`. 7. **Stay read-only everywhere else.** Before your first probe, delete only your own stale probes for this FRD (`rm -f .pandacorp/run/drift-probes/<frd>/*.finder.drift-probe.ts*`). Never edit production code, tests, docs or frontmatter; never run `verify.sh`, the test suite, a dev server or a browser; never run a git command that writes; never commit. Another agent is running the gate script in this same worktree right now. 8. **Budget.** Spend at most the tool-call budget the engine states. Work through the contracts the work orders under review do NOT own first (that is where the digested judge cannot look), then the cycle's own. When the budget runs out, mark every contract you have not reached `unknown` and set `budgetExhausted: true` — never drop a contract from the list."
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

// B2b (BL-0159) — the SINGLE choke point for a gate's TERMINAL-outcome telemetry: a PASS or ANY block
// (needs-owner | external | error). A REOPEN is not terminal (the FRD loops back into a build/patch pass
// THIS same run) so it keeps its own inline review_end/GateVerdict emission in the reviewing agent's own
// prompt (frdGateSerial/frdGateSplit, unchanged) — this helper is never used for it.
// Before BL-0159, every block exit hand-rolled its OWN subset of this telemetry — persistGateBlock emitted
// NOTHING, attemptRepair's own "cannot fix" branch emitted NOTHING, blockRepairBudgetExhausted/
// blockEarlyNeedsOwner emitted GateVerdict but never review_end/frd_end — so a block reached via any path
// OTHER than the reviewing agent's own inline 'blocked'/'fail' branch left a dangling review_start and no
// GateVerdict at all in the dashboard/track streams (canary-c-forensics.md §7 — BL-0157 fixed ONE such
// path, the traceability oracle; this closes the class for every OTHER terminal exit). `verdict` is
// 'pass' | 'blocked' (the review_end/GateVerdict coarse category — a specific blocked_reason, when it
// varies at runtime, travels through `fields`/`args`, same %s-placeholder contract as GATE_VERDICT itself).
const emitGateOutcome = (frd, verdict, fields = '', args = '') =>
  `${TRACK('review_end', `,"frd":"${frd}","verdict":"${verdict}"`)}${TRACK('frd_end', `,"frd":"${frd}"`)}${GATE_VERDICT(frd, verdict, fields, args)}`

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
// The gate agent's cwd preamble: cd to the frozen worktree (NOT the main project root). Every relative path
// in the gate prompt is relative to the PROJECT directory inside that worktree; absolute ${PROJECT_DIR}/...
// paths (dashboard events, track.jsonl, punch-list) still target the MAIN tree (append-only, no git).
// BL-0187: the worktree checks out the WHOLE repository. For a project nested in a larger repo (Mission
// Control lives at <factory>/mission-control/, sharing the factory's .git) the worktree ROOT is the factory,
// not the project — `.pandacorp/verify.sh`, `docs/frds/…` and `node_modules` do not exist there. "cd to the
// worktree" left every gate-worktree agent one level too high: the digested collector's step 0 reported
// "not bootstrapped" and its artifact-scoped diff came back EMPTY, and reviewers spent turns rediscovering
// the project. The cd now appends the project's repo prefix (`git rev-parse --show-prefix`: empty for a flat
// project, `mission-control/` for MC), computed by git at run time — never guessed by the engine.
// D1: `wt` is the gate worktree THIS gate occupies — the single C2 worktree by default, or its pool slot's
// path under args.parallelGates (gateWorktreePathOf below). The project-prefix cd applies to EVERY slot: a
// slot is a whole-repo checkout too, so a nested project's gate enters `gate-worktree-<k>/<prefix>` — and the
// slot's bootstrap (gateWorktreePrompt) runs from that same project directory, where `.pandacorp/` lives.
const gateProjectCd = (wt = GATE_WORKTREE) => `cd "${wt}/$(git -C ${shellQuote(PROJECT_DIR)} rev-parse --show-prefix)"`
const worktreeWorkFrom = (pinSha, wt = GATE_WORKTREE) => `Work from the GATE WORKTREE ${wt} — FIRST cd into the PROJECT directory inside it, exactly: \`${gateProjectCd(wt)}\` (the worktree holds the WHOLE repo; a nested project's root is not the worktree root). It is a DETACHED git worktree checked out at the pinned commit ${pinSha} (a frozen, quiet copy of the tree so the main build keeps going); DO NOT cd to the main project root and DO NOT run any \`git commit\`/branch op that writes the main tree. Every relative path below is relative to that project directory inside the worktree; any path written as an absolute ${PROJECT_DIR}/... is the MAIN tree (append-only files only).\n`
// ── D1 gate-slot pool geometry (args.parallelGates, BL-0186) ──────────────────────────────────────
// Slot k (1-based) lives at `${GATE_WORKTREE}-<k>` — never the single C2 path, so a dirty legacy worktree
// (BL-0067 crash evidence, e.g. Mission Control's own) can never poison the pool, and the flag-off path
// keeps its exact directory. Each slot is bootstrapped with an EXPLICIT e2e port: worktree-bootstrap.sh's
// BL-0154 hash of the worktree path does NOT separate slots reliably — its free-port probe only sees
// servers ALREADY listening, so N bootstraps before any `next dev` starts cannot see each other, and the
// hash is not injective (verified 2026-09-25 with the script's own shasum formula on Mission Control's
// slot paths: gate-worktree-1 → 3988, -2 → 3902, -3 → 3900 = main's reserved port). 3800 + 10·k sits
// outside the [3900, 3999] range the hash hands out to every other worktree.
const GATE_SLOT_PORT_BASE = 3800
const gateSlotPath = (k) => `${GATE_WORKTREE}-${k}`
const gateSlotPort = (k) => GATE_SLOT_PORT_BASE + 10 * k
// The worktree a gate for `frd` runs in: its pool slot's path under parallelGates (recorded when the slot is
// acquired, and kept after the release for the landing's own prose), else the single C2 worktree.
const gateWorktreePathOf = (frd) => { const st = frdState.get(frd); return (st && st.gateSlotPath) || GATE_WORKTREE }
// Under parallelGates the BL-0175 backstop salvage in persistGateBlock would clean a slot ANOTHER FRD's gate
// may already occupy (landings no longer quiesce the gates) — so it is left out there: each slot is salvaged
// by its own gate's release, in the `finally` of the slot link, the only writer of a slot's cleanliness.
const PARALLEL_PERSIST_NO_SALVAGE = `    **No gate-worktree salvage here (D1, args.parallelGates):** this gate's slot was already salvaged and cleaned by its own release step, and another FRD's gate may be reviewing in that slot right now — do NOT touch any ${gateSlotPath('<k>')} directory. `
// BL-0182/0184: the durable, gitignored home of everything a gate leaves in GATE_WORKTREE (the reviewer's
// adversarial tests, snapshots, its gate-report.json) — salvaged there by releaseGateWorktree after EVERY
// verdict, so the worktree can be cleaned for the next gate without losing the evidence, and so the PASS
// port (applyGate) and the reject port (portReviewerTests) read a copy no later gate can overwrite.
const GATE_EVIDENCE_ROOT = PROJECT_DIR === '.' ? '.pandacorp/run/gate-evidence' : `${PROJECT_DIR}/.pandacorp/run/gate-evidence`
const gateEvidenceDir = (frd) => `${GATE_EVIDENCE_ROOT}/${frd}`
// E2 finding 3: ONE path convention for the reviewer's salvaged test files. The release lists them the way git
// does — REPO-ROOT-relative (`mission-control/src/…` for a nested project) — so every copy, hash, stage and clean
// of them is anchored at the repository root, inside a LITERAL command the agent runs verbatim. Prose ("let TOP =
// …") is not enough: canary E2's apply-gate (haiku) re-derived the destination from its project cwd and committed
// `mission-control/mission-control/src/…` (4ceac8e0), leaving reverify's correct copy untracked on main. Each path is
// single-quoted and every git pathspec is literal — `[slug]` is a glob class otherwise and stages (or cleans) the
// sibling files it matches.
const REPO_TOP_ASSIGN = `TOP="$(git -C ${shellQuote(PROJECT_DIR)} rev-parse --show-toplevel)"`
const repoParentOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '.')
const repoRootPortCommand = (srcDir, paths) => [REPO_TOP_ASSIGN, ...paths.map((p) => `mkdir -p "$TOP"/${shellQuote(repoParentOf(p))} && cp ${shellQuote(`${srcDir}/${p}`)} "$TOP"/${shellQuote(p)}`)].join(' && ')
const repoRootHashCommand = (paths) => [REPO_TOP_ASSIGN, ...paths.map((p) => `{ shasum -a 256 "$TOP"/${shellQuote(p)} || echo "MISSING ${p}"; }`)].join(' && ')
const repoRootStageCommand = (paths) => `${REPO_TOP_ASSIGN} && git -C "$TOP" --literal-pathspecs add -- ${paths.map(shellQuote).join(' ')}`
const REPO_ROOT_PATHS_NOTE = 'These paths are REPO-ROOT-relative (git listed them from the repository root): NEVER copy, hash, stage or clean one relative to the project directory — for a nested project the path already starts with the project folder, so a project-relative copy DOUBLES it (`mission-control/mission-control/…`, canary E2).'
// BL-0202: every read or write of the MAIN tree's state is scoped to THIS project. `git status`, `git checkout`,
// `git clean` and `git stash` act on the WHOLE repository: for a project nested in a larger one (Mission Control
// inside the factory, whose main checkout the owner shares with parallel sessions) an unscoped status lists the
// factory's WIP as if it were the build's, and a restore built from it would overwrite that WIP. The prefix is
// computed by git at run time ('' for a flat project, where every command below acts exactly as before).
const PREFIX_ASSIGN = `P="$(git -C ${shellQuote(PROJECT_DIR)} rev-parse --show-prefix)"`
// A literal listing: `PREFIX=<p>`, then `IN <path>` for every dirty path INSIDE the project (pathspec `.` from the
// project dir) and `OUT <path>` for every dirty path elsewhere in the repository (informational, never touched).
// Paths are repo-root-relative with the 2-character XY status code already cut (BL-0160).
const PROJECT_STATUS_COMMAND = `${PREFIX_ASSIGN} && printf 'PREFIX=%s\\n' "$P" && git -C ${shellQuote(PROJECT_DIR)} status --porcelain -- . | cut -c4- | sed 's/^/IN /' && git -C ${shellQuote(PROJECT_DIR)} status --porcelain | cut -c4- | while IFS= read -r p; do case "$p" in "$P"*) ;; *) printf 'OUT %s\\n' "$p" ;; esac; done`
// The fail-loud guard every main-tree restore/clean goes through: ALL paths must be plain repo-root-relative paths
// under the project prefix (and never the controller-owned status.yaml), or NOTHING runs (exit 3). An empty list
// is refused too: `git checkout <sha> --` with no path would move HEAD instead of restoring files.
const SCOPE_GUARD = `${REPO_TOP_ASSIGN} && ${PREFIX_ASSIGN} && inproj() { [ "$#" -gt 0 ] || { echo 'BL-0202 REFUSED: no path given, nothing was touched' >&2; return 3; }; for p in "$@"; do case "$p" in ''|/*|..|../*|*/..|*/../*|:*) printf 'BL-0202 REFUSED: %s is not a plain repo-root-relative path, nothing was touched\\n' "$p" >&2; return 3 ;; esac; case "$p" in "$P"*) ;; *) printf 'BL-0202 REFUSED: %s is OUTSIDE this project (prefix %s), nothing was touched\\n' "$p" "$P" >&2; return 3 ;; esac; case "$p" in "$P".pandacorp/status.yaml) printf 'BL-0202 REFUSED: %s is controller-owned, nothing was touched\\n' "$p" >&2; return 3 ;; esac; done; }`
const SCOPED_PATHS = '<PATHS>'
const scopedRestoreCommand = (ref) => `${SCOPE_GUARD} && set -- ${SCOPED_PATHS} && inproj "$@" && git -C "$TOP" --literal-pathspecs checkout ${ref} -- "$@"`
const scopedCleanCommand = () => `${SCOPE_GUARD} && set -- ${SCOPED_PATHS} && inproj "$@" && git -C "$TOP" --literal-pathspecs clean -fd -- "$@"`
const SCOPED_PATHS_NOTE = `${SCOPED_PATHS} = the paths, each single-quoted, REPO-ROOT-relative EXACTLY as the IN lines list them (a nested project's paths start with its folder, e.g. 'mission-control/src/x.ts'). A BL-0202 REFUSED exit means your path list is wrong: fix the list, never work around the guard with another command.`
const NO_WHOLE_TREE_WRITES = 'NEVER a whole-tree form: no `git reset --hard`, no `git checkout -- .`/`git checkout .`/`git restore .`, no `git clean` without an explicit path, no `git stash` push/pop/drop, no `git add -A`/`git add .`/`git commit -a` (BL-0202: the repository may be shared with other sessions\' uncommitted work outside this project).'
// Which salvaged paths are the reviewer's TEST evidence (ported to main) vs anything else it left behind
// (kept in the evidence dir only). Snapshot PNGs under e2e/ and __tests__/ ride with their specs.
const REVIEWER_TEST_PATH = /(^|\/)(__tests__|_tests|tests?|e2e)\/|\.(test|spec)\.[cm]?[jt]sx?$/
// BL-0183: `verify.sh --since` selects tests with vitest `--changed <sha>`, which (vitest 4.1.9) ALSO runs
// every UNCOMMITTED file in the tree — so which tests certify this FRD must never be left to it.
const REVIEWER_TESTS_EXPLICIT = `\n  **RUN YOUR OWN ADVERSARIAL TESTS EXPLICITLY, BY PATH (BL-0183):** the focused gate's vitest step selects tests with \`--changed <sha>\`, which ALSO picks up any uncommitted file in the tree — it is NOT the contract for which tests certify this FRD. After that verify.sh run, run EVERY adversarial test file you wrote this gate by its path — \`pnpm vitest run <path> [<path> …]\` (a Playwright spec: \`pnpm playwright test <path>\`) — never relying on \`--changed\` to have collected them. On a PASS every one of them must pass; on a reopen the RED-proven ones must fail for the reason you state. (On the concurrent path the engine refuses to start a gate over a dirty worktree, so every uncommitted file you see there is yours.)`

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
// BL-0192: { frd, spawnedAt, reserve } while a (non-final) D1 landing runs, else null. Declared HERE, before the wrapper
// below reads it through laneTopUp() at every agent boundary (the lane logic lives with landParallelVerdict).
let landingInFlight = null
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
    const answer = await __rawAgent(finalPrompt, rest)
    laneTopUp()   // BL-0192: every agent boundary of a D1 landing ladder refills slots freed meanwhile (no-op otherwise)
    return answer
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
                docStatus: { type: 'string', description: "BL-0171 defense-in-depth: the LITERAL `status:` frontmatter field on the WO file (DRAFT|ACTIVE) — DR-100's gating field, DISTINCT from `status` above (which is really `implementation_status`). Omit/leave empty when the WO has no `status:` line at all (a legacy WO predating this field defaults to buildable, matching preflight-implement.sh's own grep). The engine refuses to schedule a WO whose docStatus is literally DRAFT — never built un-gated, even if some other path let it reach the plan." },
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
const APPLY_GATE_SCHEMA = { type: 'object', required: ['done'], properties: { done: { type: 'boolean' }, failure: { type: 'string' }, report_scope: REPORT_SCOPE, inventory_output: { type: 'string', description: 'BL-0189: the stdout of the inventory-cache write command, VERBATIM (only when the prompt asked for it)' } } }
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
    dirtyPaths: { type: 'array', items: { type: 'string' }, description: "BL-0124: every BARE path `git status --porcelain` reported dirty — EXACTLY as that command prints it (repo-root-relative: git prints paths from the REPOSITORY root even for a nested project, e.g. 'mission-control/.pandacorp/status.yaml'), WITHOUT the leading 2-character XY status code + separating space it prints before each path (' M mission-control/.pandacorp/status.yaml' → 'mission-control/.pandacorp/status.yaml'; never the raw porcelain line with its status code still attached); [] when clean. The engine — not this step — strips projectPrefix and decides whether the narrow leased-status.yaml exclusion applies, so a path still carrying its status code silently fails that comparison and forces an unnecessary judge-baseline (BL-0160) — report the bare path honestly even when escalating." },
    outsideDirtyPaths: { type: 'array', items: { type: 'string' }, description: "BL-0202: every `OUT <path>` line of the scoped status command — a dirty path OUTSIDE this project (a nested project shares its repository, e.g. the factory's parallel sessions). INFORMATIONAL ONLY: it never escalates the baseline and nothing ever touches it; [] when none." },
    projectPrefix: { type: 'string', description: "E2 finding 2: the VERBATIM output of `git -C <project> rev-parse --show-prefix` (trimmed) — '' for a project at its repository root, e.g. 'mission-control/' for a nested one. The engine strips it from dirtyPaths before comparing, because porcelain paths are repo-root-relative." },
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
    traceability: { type: 'array', minItems: 7, description: 'Whole-FRD normative inventory: AT LEAST ONE entry per contractClass (requirement, acceptance-criterion, invariant, edge-case, limit, error, exclusion) — an omitted class is RED. A REQ-NN-MMM requirement is its OWN requirement entry, never covered only via its acceptance-criterion entries. A class that genuinely does not apply gets a not-applicable entry with tests: [] instead of being omitted.', items: { type: 'object', required: ['contract', 'contractClass', 'status', 'tests'], properties: { contract: { type: 'string' }, contractClass: { type: 'string', enum: ['requirement', 'acceptance-criterion', 'invariant', 'edge-case', 'limit', 'error', 'exclusion'] }, status: { type: 'string', enum: ['pass', 'fail', 'not-applicable'] }, tests: { type: 'array', items: { type: 'string' } },
      // BL-0178: a PROPOSAL only — the engine proves or rejects it (adjudicateDrift). Meaningful on a `fail` entry.
      claim: { type: 'string', enum: ['preexisting'], description: 'BL-0178: set ONLY on a status:"fail" entry you believe this cycle did NOT cause. A proposal — the engine proves it with a differential run of evidence_test before it counts.' },
      evidence_test: { type: 'string', description: 'BL-0178: the probe you wrote to demonstrate the contradiction, at .pandacorp/run/drift-probes/<frd>/<contract-id>.drift-probe.ts (imports via @/ only; never in testFiles).' },
      direction: { type: 'string', enum: ['code', 'spec', 'unknown'], description: 'BL-0178: your read of which side is wrong — the owner decides on the resulting card.' } } } },
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
// B1 (BL-0157, canary C wf_1cf782d6-2ed): a traceability gap is a REVIEWER-INVENTORY defect, not proof
// the code failed. The prior version stamped a BRAND-NEW `{ green:false, failure }` object over every
// deficient verdict — including an already-red reject — which silently DESTROYED its `reopen`,
// `findings`, `missingFoundation` and `blocked_reason`. gateConverge then read the wiped object as a
// bare "no specific reopen" failure and skipped straight past the DR-073 patch-first path to the
// expensive `attemptRepair`, and a deficient-but-green re-gate fell all the way to `blockFrd(…,'error')`
// with no retry and no log naming the missing class. Fix: a REJECT keeps every field it returned — only
// a traceability note is appended. A GREEN is the only shape this still overrides, and only to flag it
// `traceabilityDeficient` (never a fabricated hard failure), so gateConverge (B2) can re-ask the gate
// once instead of repairing production code or blocking 'error'. The WP06f invariant is unchanged: a
// traceability-deficient result is NEVER `{ green: true }` — it can't reach applyGate/VERIFIED.
// BL-0178: `drift` / `discarded` are ENGINE-WRITTEN statuses (adjudicateDrift stamps __driftAdjudicated
// on them after the differential proof). A reviewer can never produce one that counts: the same status
// WITHOUT the engine's stamp is still an open fail, so the waiver hole BL-0078 closed stays closed.
const DRIFT_STATUSES = ['drift', 'discarded']
const isOpenFail = (entry) => Boolean(entry) && (entry.status === 'fail' || (DRIFT_STATUSES.includes(entry.status) && entry.__driftAdjudicated !== true))
function enforceWholeFrdTraceability(result) {
  const trace = result && result.traceability
  const missingClasses = Array.isArray(trace) ? REQUIRED_TRACE_CLASSES.filter((kind) => !trace.some((entry) => entry && entry.contractClass === kind)) : REQUIRED_TRACE_CLASSES.slice()
  const missing = missingClasses.length > 0
  const invalidBoundary = Array.isArray(trace) && trace.some((entry) => entry && ['edge-case', 'limit'].includes(entry.contractClass) && entry.status === 'pass' && (!Array.isArray(entry.tests) || entry.tests.length === 0))
  // BL-0178: only an OPEN fail waives nothing — an engine-proven pre-existing drift entry (status 'drift')
  // or an engine-refuted claim ('discarded') no longer contradicts a green verdict; an unproven claim does.
  const waivedFailure = result && result.green === true && Array.isArray(trace) && trace.some(isOpenFail)
  if (!(missing || invalidBoundary || waivedFailure)) return result
  // Keep the original phrase verbatim (older log/test assertions match on it, e.g. WP06f) and APPEND the
  // specifics B1/B2 need to act on — which classes are missing, named, never just "incomplete".
  const note = `whole-FRD traceability is missing, lacks boundary evidence, or contradicts a green verdict${missing ? ` — missing contractClass: ${missingClasses.join(', ')}` : ''}${invalidBoundary ? '; an edge-case/limit entry claims pass with no boundary test' : ''}${waivedFailure ? '; a traceability entry is status:fail under an overall green verdict' : ''}`
  log(`⚠ ${(result && result.frd) || 'gate'}: ${note}`)
  // BL-0157 scope guard: the "reviewer forgot to inventory a whole class" defect (canary C) is a
  // FORMAT gap a re-ask can fix (B2). A NULL/garbled result (dead agent, G2) or a genuine CONTRADICTION
  // — invalidBoundary (a boundary claimed pass with zero tests) or waivedFailure (a recorded `fail` under
  // an overall green) — is NOT a format gap; it is evidence the underlying judgment itself may be wrong,
  // so it keeps the pre-BL-0157 hard-fail contract (no traceabilityDeficient flag → gateConverge never
  // re-asks it, falls straight to attemptRepair/blocked 'error' exactly as before this fix).
  const reaskable = missing && !invalidBoundary && !waivedFailure && result && typeof result === 'object'
  if (!result || typeof result !== 'object') return { green: false, traceability: [], failure: note }
  const safeTrace = Array.isArray(trace) ? trace : []
  const deficientFields = reaskable ? { traceabilityDeficient: true, missingClasses } : {}
  if (result.green !== true) {
    // Already a reject: preserve reopen/findings/missingFoundation/blocked_reason/everything else —
    // only annotate. gateConverge's normal reopen/patch-first/blocked_reason routing still applies.
    return { ...result, traceability: safeTrace, ...deficientFields, failure: result.failure ? `${result.failure} · traceability: ${note}` : note }
  }
  // Was green: downgrade to a DEFICIENT (not a hard) failure — never stamp VERIFIED on it.
  return { green: false, traceability: safeTrace, ...deficientFields, failure: note }
}
// ── BL-0178 PRE-EXISTING DRIFT — policy (a*): the reviewer PROPOSES, a DIFFERENTIAL PROOF decides ─────
// The whole-FRD oracle finds contradictions the cycle never caused (canary D2: frd-02 BLOCKED a correct
// WO over legacy drift on the direct path, while frd-03 shipped the same class of drift silently through
// patch → verifyPatched). The outcome depended on WHICH rung the gate landed on. The uniform rule, applied
// to EVERY gate verdict before any routing (finalizeGate — used by the concurrent gate, the legacy gate,
// the B2 re-asks, the in-run retry and the post-repair re-gate alike):
//   • A `fail` entry is pre-existing drift IF AND ONLY IF the reviewer's own probe (`evidence_test`) fails
//     on an ASSERTION at the gate's pin AND at the pin's `last_green_sha` (run by a MECH agent through
//     drift-proof.mjs, twice per sha; the ENGINE parses the facts and applies the predicate below), the
//     base provably precedes the cycle, and no reviewed WO owns the contract (source_requirements).
//   • fails only at the pin → a REGRESSION this cycle caused → cycle fault → reopen patch-first.
//   • passes at the pin → the reviewer was wrong → the entry is DISCARDED (logged loudly).
//   • unloadable / flaky / missing probe / invalid base / no contract id / owned → cycle fault (fail-closed:
//     an unproven claim is never recorded as drift and never waives a green).
// Proven drift NEVER blocks and NEVER reopens the cycle's WOs: it becomes a `draft` change card (the owner
// decides direction — `/pandacorp:sync` rule: never degrade the spec) with the probe preserved under
// .pandacorp/run/gate-evidence/<frd>/drift/, plus the FRD's `drift:` frontmatter at the certifying landing.
// Honest limits: no madge import-closure attribution — a regression is reopened on THIS FRD's reviewed WOs
// (the patcher is told to look at the whole base..pin diff), never attributed to a sibling FRD's WO; and an
// unproven claim is a cycle fault instead of the proposal's static fallback card.
const DRIFT_PROBE_RE = /^\.pandacorp\/run\/drift-probes\/[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*\.drift-probe\.tsx?$/
const DRIFT_WO_PATH_RE = /^docs\/frds\/[A-Za-z0-9][A-Za-z0-9._-]*\/work-orders\/wo-[A-Za-z0-9._-]+\.md$/
const DRIFT_OUTPUT_SCHEMA = { type: 'object', required: ['output'], properties: { output: { type: 'string', description: 'the command stdout, VERBATIM — a single JSON line; never summarized, never re-formatted' } } }
const contractIdOf = (contract) => { const m = String(contract || '').match(/\b(?:REQ|AC)-\d+-\d+(?:\.\d+)?\b/); return m ? m[0] : null }
// ── BL-0191: matching the verifier's inheritedResolved against the inherited open contracts ──────────
// verifyPatched lists each inherited contract as `• [<class>] <contract> — the gate's tests: <files> · key INH-<n>`.
// A verifier asked to echo it "verbatim" echoes some of that decoration back (canary E: `error: Error — … — the
// gate's tests: …`), so the old exact-or-REQ/AC-id match could NEVER close an id-less contract (error/edge-case/
// limit/invariant/exclusion rows are routinely id-less): a proven contract was refused. Match, in order: the INH key
// the prompt assigned; the REQ/AC id; the contract text with the decoration the PROMPT adds stripped from both sides
// (bullet, key, `[class]`/`class:` tag, tests suffix; dash/quote variants and whitespace folded, case-insensitive).
// Still fail-loud: an entry proves a contract only with pass:true AND ≥1 test, and nothing looser than equality of
// the stripped text is accepted — a contract nobody resolved stays open.
const INHERITED_KEY = (i) => `INH-${i + 1}`
const INHERITED_CLASS_TAG_RE = new RegExp(`^(?:\\[\\s*(?:${REQUIRED_TRACE_CLASSES.join('|')})\\s*\\]|(?:${REQUIRED_TRACE_CLASSES.join('|')})\\s*:)\\s*`, 'i')
function stripInheritedContract(x) {
  let s = String(x || '').replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\s+/g, ' ').trim()
  s = s.replace(/^[•*]\s*/, '')
  s = s.replace(/\s*(?:[·|]\s*)?\bkey:?\s*INH-\d+\s*$/i, '')
  s = s.replace(/\s+-{1,2}\s+the gate's tests:[\s\S]*$/i, '')
  for (let k = 0; k < 3; k++) {
    const t = s.replace(/^INH-\d+\s*[:.)·-]?\s*/i, '').replace(INHERITED_CLASS_TAG_RE, '')
    if (t === s) break
    s = t
  }
  return s.trim()
}
/**
 * The inherited open contracts NOT proven closed by the verifier's `inheritedResolved` (BL-0178, matched per BL-0191).
 * @param {ReadonlyArray<{contract: string}>} inherited the gate's stashed open fails, in prompt order (INH-1…INH-n)
 * @param {unknown} resolved the verifier's inheritedResolved (untrusted agent output)
 * @returns the still-open inherited entries (empty = every one proven closed)
 */
function unresolvedInherited(inherited, resolved) {
  const proofs = (Array.isArray(resolved) ? resolved : []).filter((r) => r && r.pass === true && Array.isArray(r.tests) && r.tests.length > 0)
  const norm = (x) => stripInheritedContract(x).toLowerCase()
  return (inherited || []).filter((e, i) => {
    const key = INHERITED_KEY(i).toLowerCase()
    const id = contractIdOf(stripInheritedContract(e.contract))
    const text = norm(e.contract)
    return !proofs.some((r) => String(r.key || '').trim().toLowerCase() === key
      || (id && contractIdOf(stripInheritedContract(r.contract)) === id)
      || (text && norm(r.contract) === text))
  })
}
// REQ-02-010, AC-02-010.4 and AC-02-010.8 share the core "02-010": owning the requirement owns its ACs and
// vice-versa (fail-closed — the broad match can only turn a claim INTO a cycle fault, never out of one).
const contractCore = (id) => String(id).replace(/^(?:REQ|AC)-/, '').replace(/\.\d+$/, '')
// One probe's state at one sha, from drift-proof.mjs's per-run vitest summaries. Two runs that disagree
// are 'flaky' — evidence of nothing.
function probeRunState(runs) {
  if (!Array.isArray(runs) || runs.length === 0) return 'load-error'
  const one = (r) => ((!r || r.parsed !== true || Number(r.suiteErrors) > 0 || !(Number(r.total) > 0)) ? 'load-error' : (Number(r.failed) > 0 ? 'assertion-failed' : 'passed'))
  const states = [...new Set(runs.map(one))]
  return states.length === 1 ? states[0] : 'flaky'
}
// Fail-closed parse of the MECH's verbatim stdout (same discipline as validateEvidence): anything that is
// not the script's ok:true shape proves nothing.
function parseDriftProof(raw) {
  const text = raw && typeof raw.output === 'string' ? raw.output.trim().split('\n').pop() : ''
  if (!text) return { proof: null, error: 'the drift-proof runner returned no output' }
  let j
  try { j = JSON.parse(text) } catch { return { proof: null, error: 'the drift-proof output is not valid JSON' } }
  if (!j || j.ok !== true) return { proof: null, error: `the drift-proof script refused: ${(j && j.error) || 'no ok:true'}` }
  if (!Array.isArray(j.probes) || !j.owned || typeof j.owned !== 'object') return { proof: null, error: 'the drift-proof output lacks probes/owned' }
  return { proof: j, error: '' }
}
// Owned contract cores from the reviewed WOs at the pin: `source_requirements` when declared, else every
// id the file mentions (fail-closed). null = ownership unprovable → every claim is a cycle fault.
function ownedDriftCores(proof, woPaths) {
  if (!proof || !woPaths.length) return null
  const cores = new Set()
  for (const p of woPaths) {
    const o = proof.owned[p]
    if (!o || o.error || !Array.isArray(o.ids)) return null
    const ids = Array.isArray(o.sourceRequirements) && o.sourceRequirements.length ? o.sourceRequirements : o.ids
    for (const id of ids) cores.add(contractCore(id))
  }
  return cores
}
/**
 * The BL-0178 predicate for ONE claimed `fail` entry. Pure: every input is a fact the MECH run reported.
 * @returns {{ verdict: 'preexisting'|'regression'|'refuted'|'cycle-fault', why: string, stored?: string }}
 */
function classifyDriftClaim(entry, proof, owned, proofError) {
  const id = contractIdOf(entry.contract)
  if (!id) return { verdict: 'cycle-fault', why: 'the contract carries no REQ/AC id, so non-ownership cannot be proven' }
  if (!DRIFT_PROBE_RE.test(String(entry.evidence_test || ''))) return { verdict: 'cycle-fault', why: 'no valid evidence_test probe (.pandacorp/run/drift-probes/<frd>/<id>.drift-probe.ts)' }
  if (!proof) return { verdict: 'cycle-fault', why: proofError || 'the differential proof did not run' }
  if (!owned) return { verdict: 'cycle-fault', why: 'reviewed work-order ownership could not be read at the pin' }
  if (owned.has(contractCore(id))) return { verdict: 'cycle-fault', why: `${id} is owned by a reviewed work order (source_requirements) — never pre-existing` }
  const probe = proof.probes.find((p) => p && p.path === entry.evidence_test)
  if (!probe || probe.missing) return { verdict: 'cycle-fault', why: 'the probe file was not found where the reviewer said it wrote it' }
  const stored = probe.stored
  const head = probeRunState(probe.head)
  if (head === 'passed') return { verdict: 'refuted', why: 'the probe PASSES at the gate pin — the claimed contradiction is not demonstrated', stored }
  if (head !== 'assertion-failed') return { verdict: 'cycle-fault', why: `the probe is ${head} at the gate pin — it proves nothing`, stored }
  if (proof.baseValid !== true) return { verdict: 'cycle-fault', why: `no valid pre-cycle base (${proof.baseReason || 'unknown'})`, stored }
  const base = probeRunState(probe.base)
  if (base === 'assertion-failed') return { verdict: 'preexisting', why: `fails on an assertion at the pin AND at last_green_sha ${String(proof.base || '').slice(0, 8)}`, stored }
  if (base === 'passed') return { verdict: 'regression', why: `held at last_green_sha ${String(proof.base || '').slice(0, 8)} and fails at the pin — this cycle broke it`, stored }
  return { verdict: 'cycle-fault', why: `the probe is ${base} at last_green_sha — unproven`, stored }
}
async function runDriftProof(frd, reviewIds, claims, pinSha, sourceDir) {
  const st = frdState.get(frd)
  const reviewed = st ? st.f.workOrders.filter((w) => reviewIds.includes(w.id)) : []
  const woPaths = reviewed.map((w) => w.path).filter((p) => DRIFT_WO_PATH_RE.test(String(p || '')))
  const provable = claims.filter((e) => DRIFT_PROBE_RE.test(String(e.evidence_test || '')) && String(e.evidence_test).includes(`/drift-probes/${frd}/`))
  if (!provable.length) return { proof: null, owned: null, error: 'no claim carries a valid evidence_test for this FRD' }
  if (!reviewed.length || woPaths.length !== reviewed.length) return { proof: null, owned: null, error: 'a reviewed work order has no valid path — ownership cannot be read' }
  const cmd = `${DRIFT_CLI_COMMAND} prove --project ${shellQuote(PROJECT_DIR)} --frd ${shellQuote(frd)} --source ${shellQuote(sourceDir)} --pin ${shellQuote(pinSha || 'HEAD')} ${woPaths.map((p) => `--wo ${shellQuote(p)}`).join(' ')} ${[...new Set(provable.map((e) => e.evidence_test))].map((p) => `--probe ${shellQuote(p)}`).join(' ')}`
  agentSpawned++
  let raw = null
  try {
    raw = await agent(`MECHANICAL COMMAND RUNNER — BL-0178 differential drift proof for ${frd}. Your SOLE action is to execute this exact command ONCE from the project root (no command before or after it) and return its stdout VERBATIM as \`output\`: \`${cmd}\`. It checks the reviewer's probe(s) out at the gate pin and at that pin's last_green_sha in throwaway worktrees it creates and removes itself, runs them, and prints ONE JSON line; it can take several minutes and exits 0 even when probes fail — that is data, not a problem for you to fix. Do not inspect, edit, test, fix, stage or commit anything yourself, and do not summarize or reformat the output.`,
      { label: `drift-proof:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: DRIFT_OUTPUT_SCHEMA })
  } catch (e) {
    log(`⚠ ${frd}: the drift-proof runner threw (${(e && e.message) || e}) — every drift claim stays a cycle fault (BL-0178 fail-closed)`)
    return { proof: null, owned: null, error: 'the drift-proof runner threw' }
  }
  const { proof, error } = parseDriftProof(raw)
  if (!proof) { log(`⚠ ${frd}: ${error} — every drift claim stays a cycle fault (BL-0178 fail-closed)`); return { proof: null, owned: null, error } }
  if (proof.cleanup && proof.cleanup.ok === false) log(`⚠ ${frd}: drift-proof left temporary worktree(s) behind: ${(proof.cleanup.leftover || []).join(', ')}`)
  return { proof, owned: ownedDriftCores(proof, woPaths), error: '' }
}
// Files the confirmed drift as draft change cards (MECH, idempotent twice over: once per FRD per run here,
// and on disk by drift-key in drift-proof.mjs — a re-gate never files the same drift twice).
async function recordDrift(frd, confirmed) {
  const st = frdState.get(frd)
  if (st && !st.recordedDrift) st.recordedDrift = new Set()
  const fresh = confirmed.filter((d) => !(st && st.recordedDrift.has(d.id)))
  if (!fresh.length) { log(`◦ ${frd}: drift ${confirmed.map((d) => d.id).join(', ')} already recorded this run — not filing it again (BL-0178 idempotent)`); return }
  const items = fresh.map((d) => ({ id: d.id, contract: d.contract, contractClass: d.contractClass, direction: d.direction, probe: d.stored, pin: d.pin, base: d.base }))
  const cmd = `${DRIFT_CLI_COMMAND} record --project ${shellQuote(PROJECT_DIR)} --frd ${shellQuote(frd)} --project-name "${PROJECT}" --items ${shellQuote(JSON.stringify(items))}`
  agentSpawned++
  let raw = null
  try {
    raw = await agent(`MECHANICAL COMMAND RUNNER — BL-0178 drift record for ${frd}. Your SOLE action is to execute this exact command ONCE from the project root and return its stdout VERBATIM as \`output\`: \`${cmd}\`. It writes draft change card(s) into .pandacorp/inbox/changes/ (gitignored owner channel, idempotent) and appends one GateDriftRecorded event. Do not edit, stage or commit anything yourself.`,
      { label: `drift-record:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: DRIFT_OUTPUT_SCHEMA })
  } catch (e) { raw = null; log(`⚠ ${frd}: the drift-record runner threw (${(e && e.message) || e})`) }
  let res = null
  try { res = raw && typeof raw.output === 'string' ? JSON.parse(raw.output.trim().split('\n').pop()) : null } catch { res = null }
  if (!res || res.ok !== true) {
    log(`⚠⚠ ${frd}: drift ${fresh.map((d) => d.id).join(', ')} is PROVEN but its draft card could NOT be written (${(res && res.error) || 'no ok:true output'}) — it still lands in the FRD's committed \`drift:\` frontmatter; file the card by hand (BL-0178)`)
    return
  }
  if (st) for (const d of fresh) st.recordedDrift.add(d.id)
  log(`✎ ${frd}: pre-existing drift recorded as draft card(s) — written ${(res.written || []).join(', ') || 'none'}; already present ${(res.skipped || []).join(', ') || 'none'} (BL-0178)`)
}
/**
 * BL-0178: adjudicate every `claim: "preexisting"` fail entry of ONE gate verdict and reshape the verdict
 * so the ordinary routing below applies the policy uniformly. Never touches a verdict without claims.
 * @returns the verdict with claims resolved; `__drift` = the engine-proven drift list (possibly empty).
 */
async function adjudicateDrift(frd, reviewIds, gate, pinSha, sourceDir) {
  if (!gate || typeof gate !== 'object' || !Array.isArray(gate.traceability)) return gate
  const claimIdx = gate.traceability.map((e, i) => (e && e.status === 'fail' && e.claim === 'preexisting' ? i : -1)).filter((i) => i >= 0)
  if (!claimIdx.length) return gate
  if (DRIFT_POLICY === 'block') {
    log(`◦ ${frd}: ${claimIdx.length} pre-existing-drift claim(s) IGNORED — args.driftPolicy:'block' treats every fail as a cycle fault (BL-0178 rollback)`)
    return { ...gate, traceability: gate.traceability.map((e, i) => { if (!claimIdx.includes(i)) return e; const { claim, ...rest } = e; return rest }) }
  }
  const claims = claimIdx.map((i) => gate.traceability[i])
  const { proof, owned, error } = await runDriftProof(frd, reviewIds, claims, pinSha, sourceDir)
  const confirmed = []
  const faults = []
  const trace = gate.traceability.map((e, i) => {
    if (!claimIdx.includes(i)) return e
    // BL-0203: a claim the drift finder proposed (merged by mergeDriftFinderClaims) takes the finder predicate —
    // same facts, but an unproven finder claim is discarded instead of becoming a cycle fault.
    const fromFinder = e.origin === 'drift-finder'
    const c = fromFinder ? classifyFinderClaim(e, proof, owned, error) : classifyDriftClaim(e, proof, owned, error)
    const id = contractIdOf(e.contract)
    const { __judgeEntry, ...claimEntry } = e
    const dropFinderClaim = (why) => (__judgeEntry ? __judgeEntry : { ...claimEntry, status: 'discarded', __driftAdjudicated: true, driftWhy: why })
    if (c.verdict === 'preexisting') {
      confirmed.push({ id, contract: e.contract, contractClass: e.contractClass, direction: e.direction || 'unknown', stored: c.stored, pin: proof.pin, base: proof.base })
      log(`⚖ ${frd}: ${id} is PROVEN pre-existing drift (${c.why}) — recorded, it never blocks nor reopens this cycle (BL-0178${fromFinder ? '; claimed by the drift finder, BL-0203' : ''})`)
      return { ...claimEntry, status: 'drift', __driftAdjudicated: true, driftWhy: c.why }
    }
    if (c.verdict === 'refuted') {
      log(`⚖ ${frd}: drift claim on ${id} DISCARDED — ${c.why} (${fromFinder ? 'BL-0203: the drift finder was wrong' : 'BL-0178: the reviewer was wrong'})`)
      return fromFinder ? dropFinderClaim(c.why) : { ...e, status: 'discarded', __driftAdjudicated: true, driftWhy: c.why }
    }
    if (c.verdict === 'unproven') {
      log(`⚖ ${frd}: drift finder claim on ${id || e.contract} is unproven (${c.why}) — discarded, never a cycle fault on a finder's word (BL-0203)`)
      return dropFinderClaim(c.why)
    }
    log(`⚖ ${frd}: drift claim on ${id || e.contract} is a CYCLE FAULT (${c.verdict}: ${c.why}) — routed patch-first like any other fail (BL-0178${fromFinder ? '; claimed by the drift finder, BL-0203' : ''})`)
    const { claim, ...rest } = claimEntry
    faults.push({ entry: rest, c })
    return { ...rest, driftVerdict: c.verdict, driftWhy: c.why }
  })
  let next = { ...gate, traceability: trace, __drift: confirmed }
  if (confirmed.length) await recordDrift(frd, confirmed)
  const st = frdState.get(frd)
  const atCap = Boolean(st) && st.f.workOrders.some((w) => reviewIds.includes(w.id) && (w.reopen_count || 0) >= MAX_REOPENS)
  const otherOpen = trace.some((e, i) => !claimIdx.includes(i) && isOpenFail(e))
  const reportRed = Boolean(gate.gateReport && gate.gateReport.green === false)
  const onlyDriftRed = !otherOpen && !reportRed && !(gate.missingFoundation && gate.missingFoundation.length) && !(gate.findings && gate.findings.length) && !atCap
  if (faults.length) {
    const findingsAdd = faults.map(({ entry, c }) => ({
      wo: reviewIds[0],
      finding: `${entry.contract} — contradicted, and the BL-0178 differential proof makes it a CYCLE FAULT (${c.verdict}: ${c.why})${c.verdict === 'regression' ? '. It held at last_green_sha: find the change in `git diff <last_green_sha>..HEAD` that broke it — a shared helper outside this FRD may be the culprit' : ''}`,
      failingTest: c.stored ? `${c.stored} — the reviewer's probe; install it VERBATIM as a collected test (renamed *.test.ts under src/**/_tests/, it imports via @/ only) to reproduce` : String(entry.evidence_test || ''),
      files: [],
    }))
    if (next.green === true && !atCap) next = { ...next, green: false, reopen: [...reviewIds], findings: findingsAdd, failure: `BL-0178: ${faults.length} pre-existing-drift claim(s) were NOT proven pre-existing — reopened patch-first` }
    else if (next.green !== true && next.reopen && next.reopen.length) next = { ...next, findings: [...(next.findings || []), ...findingsAdd] }
    else if (next.green !== true && onlyDriftRed && next.blocked_reason !== 'external') next = { ...next, blocked_reason: undefined, reopen: [...reviewIds], findings: findingsAdd, failure: `BL-0178: the block rested only on drift claims, and ${faults.length} of them are cycle faults — reopened patch-first` }
  } else if (next.green !== true && onlyDriftRed && !(next.reopen && next.reopen.length) && next.blocked_reason === 'needs-owner') {
    // The canary-D2 frd-02 shape: the reviewer blocked needs-owner ONLY because of drift it could not pin on a
    // reviewed WO. Every one of its reds is now proven drift (or refuted) → policy (a): the cycle is not blocked.
    log(`✓ ${frd}: the gate blocked needs-owner ONLY over drift the engine proved pre-existing — policy (a): the block is lifted, the cycle's work orders are certified (BL-0178)`)
    next = { ...next, green: true, blocked_reason: undefined, failure: undefined, __driftBlockLifted: true }
  }
  return next
}
/**
 * The single choke point every gate verdict passes through before routing (BL-0178): adjudicate drift
 * claims, THEN the whole-FRD oracle (so an unproven claim still reds a green), then remember what the
 * landing steps need — the proven drift (FRD `drift:` frontmatter) and the still-open fails that
 * verifyPatched inherits.
 */
// The exact condition the gate prompt's blocked branch uses to skip its own terminal emission (BL-0185).
const deferredGateOutcome = (raw) => Boolean(raw) && typeof raw === 'object' && raw.green !== true && raw.blocked_reason === 'needs-owner'
  && Array.isArray(raw.traceability) && raw.traceability.some((e) => e && e.status === 'fail' && e.claim === 'preexisting')
async function finalizeGate(frd, reviewIds, raw, pinSha = null, sourceDir = PROJECT_DIR) {
  const adjudicated = await adjudicateDrift(frd, reviewIds, mergeDriftFinderClaims(frd, raw), pinSha, sourceDir)   // BL-0203: finder claims join the reviewer's before the proof
  let result = enforceWholeFrdTraceability(adjudicated)
  // BL-0185: a reviewer that blocks needs-owner while carrying a drift claim DEFERS its review_end/GateVerdict
  // (its prompt says so) — the adjudication may still lift the block into a pass. When the verdict is STILL a
  // block, the engine owes that one terminal emission: the block's persist step runs un-alreadyTracked.
  if (deferredGateOutcome(raw) && result && result.green !== true && !(result.reopen && result.reopen.length)) result = { ...result, __outcomeDeferred: true }
  const st = frdState.get(frd)
  if (st) {
    st.landingDrift = (adjudicated && Array.isArray(adjudicated.__drift)) ? adjudicated.__drift : []
    st.inheritedFails = (result && Array.isArray(result.traceability)) ? result.traceability.filter(isOpenFail) : []
    st.inventoryCandidate = inventoryCandidateOf(result, pinSha)   // BL-0189: a GREEN verdict's inventory, persisted by its certifying landing (null otherwise)
  }
  return result
}
// The certifying landings' (applyGate / verifyPatched) half of the drift policy: the FRD frontmatter
// `drift:` list is a REPLICA of the proven drift — single writer (these two landings), re-derived at every
// certifying landing from the latest adjudicated gate of that FRD (DR-115 honest cache; the cards in the
// gitignored inbox are the owner's channel, this committed key is the portable trace).
const driftFrontmatter = (frd) => {
  const st = frdState.get(frd)
  const ids = ((st && st.landingDrift) || []).map((d) => d.id)
  return ids.length
    ? ` **BL-0178 DRIFT (engine-proven pre-existing drift — it does NOT block):** in docs/frds/${frd}/frd.md frontmatter set exactly \`drift: [${ids.join(', ')}]\` (add the key if absent, replace it if present — a replica of the draft change card(s) already filed, written only by this certifying step) and include frd.md in the snapshot commit.`
    : ` **BL-0178 DRIFT:** if docs/frds/${frd}/frd.md frontmatter has a \`drift:\` line, delete that line (this gate proved no pre-existing drift; the replica is re-derived at every certifying landing) and include frd.md in the snapshot commit; otherwise change nothing.`
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
    report: { type: ['string', 'null'], description: 'the VERBATIM contents of .pandacorp/run/gate-report.json after `bash .pandacorp/verify.sh --since <last_green_sha> --report-all` — the whole file as text, never a summary, never re-formatted. `null` iff the sanity gate (step 0) refused to run verify.sh at all — see `reason`.' },
    reason: { type: 'string', description: 'BL-0149: set ONLY when `report` is null — why the collector refused to run verify.sh (e.g. "gate-worktree-not-bootstrapped"). The engine surfaces this VERBATIM in the GateEvidenceFallback log/event instead of a generic message.' },
    report_suspect: { type: 'boolean', description: 'BL-0149: true iff 3+ cheap sub-gates (biome/tsc/knip/madge…) are red with environment-only noise (command not found, Cannot find module) rather than a real finding — the pack is discarded and the gate degrades to explore, same as a null report.' },
    diffStat: { type: 'string', description: 'the output of `git diff <pin_base>..<pin> --stat` (the full stat, every file)' },
    diff: { type: 'string', description: "the UNIFIED diff `git diff <pin_base>..<pin> -- <the reviewed work orders' artifact paths>`, capped at EVIDENCE_DIFF_MAX_LINES lines" },
    truncated: { type: 'boolean', description: 'true iff the unified diff exceeded the line cap and was clipped — the gate is told so explicitly, so a clipped diff is never read as the complete change set' },
    tests: { type: 'array', items: { type: 'string' }, description: 'BL-0187: the project-relative test files this cycle added or changed (`git diff --relative --name-only --diff-filter=AMR <pin_base>..<pin>` filtered to test paths), verbatim — [] when none' },
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
    // BL-0178: verifyPatched inherits the gate's still-open `fail` contracts and must prove EACH one closed.
    inheritedResolved: { type: 'array', description: 'BL-0178 (verify-patch only): one entry per inherited open contract you were given — the test file(s) you ran that prove it now holds, and whether they passed', items: { type: 'object', required: ['contract', 'pass', 'tests'], properties: { key: { type: 'string', description: 'BL-0191: the INH-<n> key the prompt gave this contract' }, contract: { type: 'string', description: 'the inherited contract text as given (without its [class] tag and tests suffix)' }, pass: { type: 'boolean' }, tests: { type: 'array', items: { type: 'string' } } } } },
    resolved: { type: 'string', description: 'BL-0191 (verify-patch only, on green): one line — what the patch resolved; the certify step journals it' },
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
// BL-0171: processChange's own agent is the AUTHOR of the FRDs/WOs it just created/updated — grading its
// own plan is exactly the self-certification the constitution (rule 4) and /pandacorp:architecture's own
// step 9 forbid. A work order the work-order template births `status: DRAFT` and a brand-new blueprint.md
// carries none of the DR-100 readiness/grounding/consistency stamps until a FRESH reviewer runs the SAME
// evidence contract architecture's step 9/9b/9b2 requires before the DRAFT→ACTIVE flip. Without this gate
// the engine would schedule and BUILD an ungated WO in THIS SAME run (canary-d, 2026-09-25): the launch-
// time preflight (plugin/scripts/preflight-implement.sh §3/§5) only ever catches a DRAFT WO/blueprint on a
// LATER relaunch, once the change already created them on disk. This schema is the FRESH gate's verdict,
// one entry per affected FRD folder.
const CHANGE_GATE_SCHEMA = {
  type: 'object', required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object', required: ['frd', 'gated'],
        properties: {
          frd: { type: 'string', description: 'the FRD folder graded (one of the affected FRDs passed in)' },
          gated: { type: 'boolean', description: 'true iff every DRAFT work order this change added/touched in this FRD passed readiness+grounding+consistency AND was stamped/flipped to ACTIVE in this same call' },
          failure: { type: 'string', description: 'what failed and what the owner/architect must fix, when gated is false — nothing was changed on disk for this FRD' },
        },
      },
    },
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
  **STEP W — preserve gate-worktree crash evidence (BL-0067):** NEVER delete, recreate, prune, reset, clean, or force-remove ${GATE_WORKTREE}. Its contents may be the only evidence left by a crashed gate. Leave it untouched here; the lazy gate-worktree probe below will reuse it only when Git records that exact path as a worktree and its tree is clean. Any dirty, orphaned, unregistered, locked, or ambiguous state falls back to the synchronous gate without mutation.${PARALLEL_GATES ? ` The SAME protection covers every parallel gate slot ${gateSlotPath('<k>')} (D1, args.parallelGates): never delete, recreate, prune, reset, clean or force-remove any of them — a dirty slot is dropped from the pool by its own probe, never cleaned.` : ''}
  **STEP 1 — consume the rethink stop:** if ${PROJECT_DIR}/.pandacorp/status.yaml has \`rethink_pending: true\`, set it to \`false\` and commit that one-line change (this run STARTS from the re-planned docs, so the stop signal is consumed — DR-069).
  **STEP 2 — owner stop signal:** already decided exclusively by STEP 0's Node receipt. Do not probe it again. Do NOT delete the signal (the owner removes it).
  **STEP 3 — clean-tree fast path (BL-0066), scoped to THIS project (BL-0202):** list the tree with the BL-0202 STATUS COMMAND: \`${PROJECT_STATUS_COMMAND}\` (run it VERBATIM, as ONE Bash call). Its first line is \`PREFIX=<p>\` — this project's repository prefix, the output of \`git -C ${PROJECT_DIR} rev-parse --show-prefix\` ('' for a project at its repository root, e.g. \`mission-control/\` for a nested one) — then one \`IN <path>\` line per dirty path INSIDE this project and one \`OUT <path>\` line per dirty path ELSEWHERE in the repository (a nested project shares its repository with other work, e.g. the factory's parallel sessions). **OUT paths are INFORMATIONAL ONLY: they never make this project dirty, never escalate, and you never touch them** — just report every one as outsideDirtyPaths. This project's tree is CLEAN iff there is NO \`IN\` line. Read \`last_green_sha\` from status.yaml. Prove it exists and is an ancestor: \`git -C ${PROJECT_DIR} cat-file -e <last_green>^{commit} && git -C ${PROJECT_DIR} merge-base --is-ancestor <last_green> HEAD\`. A CLEAN tree is known-green only when EITHER (a) HEAD == last_green_sha (legacy projects), OR (b) HEAD is its DIRECT child (\`git rev-parse HEAD^\` == last_green_sha) AND \`git -C ${PROJECT_DIR} diff --name-only --relative <last_green>..HEAD\` is EXACTLY \`.pandacorp/status.yaml\` (the BL-0066 metadata-only pointer commit; \`--relative\` lists this project's own paths, project-relative). Then return { green: true, outsideDirtyPaths: <every OUT path> }. Any other descendant may contain unverified work: return { escalate: true, dirty: false, dirtyPaths: [], outsideDirtyPaths: <every OUT path> }. **A dirty tree (at least one IN line) always escalates from here — do NOT decide any exclusion yourself, even if the only IN path looks like the controller's own status.yaml** — but ALWAYS also report the raw signal the engine needs to apply the narrow BL-0124 exclusion on its own: return { escalate: true, dirty: true, dirtyPaths: <every IN path>, outsideDirtyPaths: <every OUT path>, leaseValid: true, projectPrefix: <the PREFIX= value> }. **dirtyPaths entries are BARE paths, EXACTLY as the IN lines print them — repo-root-relative (git prints paths from the REPOSITORY root even for a nested project) — with the 2-character XY status code AND its separating space STRIPPED** (the command already cuts it: \`git status --porcelain\` prints \` M mission-control/.pandacorp/status.yaml\` for a nested project — status code, space, path — and the IN line reads \`IN mission-control/.pandacorp/status.yaml\`; report \`mission-control/.pandacorp/status.yaml\`, never a raw porcelain line, and never rewrite the path yourself). **projectPrefix** is the PREFIX= value VERBATIM. This is not cosmetic: the engine strips projectPrefix from dirtyPaths[0] and matches the rest against the literal string \`.pandacorp/status.yaml\` with strict equality to decide the exclusion (BL-0160 — a path still carrying its status code silently fails that match and forces an avoidable judge-baseline every time; E2 finding 2 — without the prefix a nested project could never match). (leaseValid is true, not a fresh check — reaching this step already proves it, since STEP 0's inspect-stop just succeeded under THIS run's own token/epoch, the SAME fence BL-0079 relies on for the repair step).${STRICT_BASELINE ? ' NOTE: this run launched with args.strictBaseline — the engine will NOT apply the BL-0124 exclusion regardless of what dirtyPaths/leaseValid say, so it makes no difference to your answer; report the same honest signal.' : ''}`,
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
// E2 finding 2: `git status --porcelain` prints REPO-ROOT-relative paths, so in a nested project (Mission Control
// inside the factory repo) the lease's own write reads `mission-control/.pandacorp/status.yaml` and the strict match
// below could never succeed (canary E2: an avoidable opus judge-baseline, 2.47 min). The pre-check also reports the
// project's `git rev-parse --show-prefix`; the engine strips it here. Only a well-formed prefix is stripped (no
// leading '/', no '..', ends in '/'), and only from a path that starts with it — anything else stays unmatched
// and escalates, so the exclusion can never widen.
const PRECHECK_PREFIX = (precheck && typeof precheck.projectPrefix === 'string' && /^(?:[^/.][^/]*\/)*$/.test(precheck.projectPrefix) && !precheck.projectPrefix.split('/').includes('..')) ? precheck.projectPrefix : ''
const projectRelativeDirtyPath = (p) => (typeof p === 'string' && PRECHECK_PREFIX && p.startsWith(PRECHECK_PREFIX)) ? p.slice(PRECHECK_PREFIX.length) : p
// BL-0202: a dirty path OUTSIDE the project prefix is another session's work in a shared repository — it is
// informational, never this project's dirt. The pre-check lists it apart (outsideDirtyPaths); a path the agent
// still reported under dirtyPaths is re-partitioned here by the same prefix. With no prefix (a flat project, or
// an unverifiable claim) every path stays in-project, exactly as before.
const isInProject = (p) => !PRECHECK_PREFIX || (typeof p === 'string' && p.startsWith(PRECHECK_PREFIX))
const precheckDirty = Array.isArray(precheck && precheck.dirtyPaths) ? precheck.dirtyPaths : null
const projectDirtyPaths = precheckDirty ? precheckDirty.filter(isInProject) : null
const outsideDirtyPaths = [...new Set([...((precheck && Array.isArray(precheck.outsideDirtyPaths)) ? precheck.outsideDirtyPaths : []), ...(precheckDirty || []).filter((p) => !isInProject(p))].filter((p) => typeof p === 'string' && p))]
if (outsideDirtyPaths.length) log(`ℹ BL-0202: ${outsideDirtyPaths.length} ruta(s) sucia(s) FUERA del proyecto${PRECHECK_PREFIX ? ` (${PRECHECK_PREFIX})` : ''}, de otra sesión — informativo: no escalan el baseline y el motor no las toca: ${outsideDirtyPaths.slice(0, 10).join(', ')}${outsideDirtyPaths.length > 10 ? ', …' : ''}`)
const leasedStatusOnly = Array.isArray(projectDirtyPaths) && projectDirtyPaths.length === 1 && projectRelativeDirtyPath(projectDirtyPaths[0]) === '.pandacorp/status.yaml'
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
    **STEP 1 — DR-067 RECONCILIATION, scoped to THIS project (BL-0202) (only if the tree is dirty/conflicted):** list the tree with the BL-0202 STATUS COMMAND: \`${PROJECT_STATUS_COMMAND}\` (VERBATIM, ONE Bash call). \`IN <path>\` lines are THIS project's dirty paths; \`OUT <path>\` lines are OTHER work sharing the repository (a nested project: the factory's parallel sessions) — NEVER restore, clean, stage, stash or commit an OUT path, it is not yours.${outsideDirtyPaths.length ? ` The pre-check already saw these OUT paths — leave every one exactly as it is: ${outsideDirtyPaths.slice(0, 20).map((p) => `\`${p}\``).join(', ')}.` : ''} Read \`last_green_sha\` from status.yaml. The valid active fence makes \`.pandacorp/status.yaml\` controller-owned: NEVER checkout or restore \`.pandacorp/status.yaml\`; renew/sync-rollups deterministically re-derive its active projection from the fenced lease. If the IN lines show other uncommitted/conflicted changes (unmerged paths or \`<<<<<<<\` markers — a kill or app-restart left a run mid-write), RESTORE only those other tracked MODIFIED IN paths to the last green (every IN path except .pandacorp/status.yaml) with the BL-0202 RESTORE COMMAND: \`${scopedRestoreCommand('<LAST_GREEN_SHA>')}\` — run it VERBATIM except <LAST_GREEN_SHA> (the sha you just read) and ${SCOPED_PATHS_NOTE} It refuses (exit 3, touching nothing) any path outside this project, the controller-owned status.yaml, or an empty list. Surgical — ${NO_WHOLE_TREE_WRITES} Stashes: leave EVERY stash as it is — never drop or pop one (DR-067: never stash-pop across a moved tree; the stash list is repository-wide, so in a nested project it holds other sessions' stashes, and a drop is unrecoverable). Remove leftover temp preview pages — any \`preview-wo*\` scratch page/route the build created (untracked IN paths) — with the BL-0202 CLEAN COMMAND: \`${scopedCleanCommand()}\` (VERBATIM except <PATHS>, same path rules). Leave legitimate untracked owner state (\`.pandacorp/\`, etc.) untouched.
    **STEP 2 —${GATE_SKIP} THEN run \`bash ${PROJECT_DIR}/.pandacorp/verify.sh\`:**
    - GREEN → return { green: true }, change nothing further.
    - RED → fix the PRODUCTION code (never weaken/skip tests) until it passes end-to-end, commit (Conventional Commits with scope) staging ONLY this project's files by explicit path (never \`git add -A\`/\`git add .\`/\`git commit -a\` — BL-0202: in a nested project they sweep other sessions' work into your commit), return { green: true }. (A route quarantined above is NOT yours to fix — it waits on the owner; do not touch it.)
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

// BL-0171: a FRESH, INDEPENDENT judge-tier gate over what processChange just created/updated — never the
// SAME agent that authored it (self-certification, constitution rule 4). Runs the SAME evidence contract
// /pandacorp:architecture's step 9/9b/9b2 requires before a blueprint/work-order may leave `status: DRAFT`
// (readiness + repo-grounding + cross-doc consistency), scoped to the delta a change actually touches —
// architecture's own three PARALLEL fresh-context gates are proportionate to a brand-new multi-WO FRD
// surface; a change is typically one FRD/one WO, so ONE fresh judge pass covering all three dimensions is
// the right-sized equivalent (still a genuinely independent reviewer, still the same fail-closed default,
// still the same DR-100 stamp — just not fanned out into 3 separate spawns for a 1-WO delta). On PASS it
// stamps the evidence AND flips DRAFT→ACTIVE itself, in the SAME call (mirrors architecture 9b2 exactly);
// on FAIL it changes nothing — the DRAFT stays DRAFT, never built.
async function gateChangeWorkOrders(affectedFrds, phaseTitle) {
  agentSpawned += COST(P.judge)
  const gate = await agent(
    `You are a FRESH, INDEPENDENT reviewer running the Pandacorp DR-100 readiness gate — the SAME evidence contract /pandacorp:architecture's step 9/9b/9b2 requires before a blueprint/work-order may leave \`status: DRAFT\` (see plugin/skills/architecture/SKILL.md). You did NOT write these documents; grade them as an outside reviewer would, fail-closed.

For EACH of these FRD folders: ${affectedFrds.join(', ')}
1. Read its frd.md, blueprint.md and every work-orders/wo-*.md whose frontmatter is \`status: DRAFT\` (a WO already \`status: ACTIVE\` from a prior gate is NOT yours to re-grade — leave it untouched).
2. READINESS (mirrors architecture step 9): every REQ/AC this change touches maps to a component; the new/updated DRAFT work order(s) are each covered unambiguously; the data model has no \`TBD\`; \`dependsOn\`/intra-FRD deps are acyclic and complete; each DRAFT WO's \`artifacts:\` globs don't overlap a SIBLING work order's; no \`[NEEDS CLARIFICATION]\` survives anywhere this change touched; if a DRAFT WO is backend and materializes an API contract, its \`docs/api/<wo-id>.md\` ownership is clear.
3. GROUNDING (mirrors architecture step 9b): every file path, import and API each DRAFT WO's spec references actually exists (or is genuinely new and declared as such) — no invented symbol/path.
4. CONSISTENCY (mirrors architecture step 9b-consistency): the new/updated content does not contradict an EXISTING ACTIVE/VERIFIED FRD, blueprint or ADR elsewhere in the project.
5. If ALL THREE pass for this FRD's DRAFT work order(s): stamp evidence and flip status, in ONE commit per FRD (Conventional Commits, scope = the FRD slug):
   - Every DRAFT work-orders/wo-*.md you gated → frontmatter \`status: DRAFT\` → \`status: ACTIVE\`.
   - Its blueprint.md: if its frontmatter is STILL \`status: DRAFT\` (a brand-new FRD this change created), flip \`status: DRAFT\` → \`status: ACTIVE\` and ADD \`readiness_gate: passed <today YYYY-MM-DD>\`, \`grounding_gate: passed <today YYYY-MM-DD>\`, \`consistency_gate: passed <today YYYY-MM-DD>\`. If the blueprint is ALREADY \`status: ACTIVE\` (a change that only added a WO to an existing gated FRD), leave its status/stamps exactly as they are — only the new WO's own \`status:\` flips.
   Return { frd, gated: true } for this FRD.
6. If ANY of the three checks fails: change NOTHING for this FRD (every DRAFT WO and the blueprint stay exactly as they are — DRAFT stays DRAFT, never built), and return { frd, gated: false, failure: '<what failed and what the owner/architect must fix>' }.
Return { results: [{ frd, gated, failure? }, ...] } — one entry per FRD folder listed above, in the same order.${NOTIFY('Verificando el readiness gate (DR-100) de la change')}`,
    { label: `gate-change-wos:${affectedFrds.join('+')}`, phase: phaseTitle, model: P.judge, agentType: 'pandacorp:architect', schema: CHANGE_GATE_SCHEMA },
  )
  // Fail-closed: a null/garbled verdict is NOT "gated" for anything — never swallow a dead gate agent
  // into a silent empty affectedFrds (error-handling.md: never swallow an error).
  if (!gate || !Array.isArray(gate.results)) {
    return { gatedFrds: [], failures: affectedFrds.map((frd) => ({ frd, failure: 'gate-change-wos returned no verdict (dead/garbled agent) — treating as NOT gated' })) }
  }
  const gatedFrds = gate.results.filter((r) => r && r.gated === true).map((r) => r.frd)
  // Any affected FRD the gate's own results never mentioned is ALSO not gated (fail-closed default —
  // an agent that forgot an FRD must not silently pass it).
  const failures = affectedFrds.filter((frd) => !gatedFrds.includes(frd)).map((frd) => {
    const r = gate.results.find((x) => x && x.frd === frd)
    return { frd, failure: (r && r.failure) || 'gate-change-wos did not report this FRD as gated' }
  })
  return { gatedFrds, failures }
}

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
    // BL-0171: gate what processChange just created/updated (a FRESH agent, never its own author) BEFORE
    // any of its FRDs may be scheduled/built this run — see gateChangeWorkOrders above for why.
    const { gatedFrds, failures } = await gateChangeWorkOrders(proc.affectedFrds, phaseTitle)
    for (const f of failures) log(`⊘ ${f.frd}: work order(s) from change '${proc.changeFile || slug}' did NOT pass the DR-100 readiness/grounding/consistency gate — left DRAFT, NOT built this run (needs-owner)${f.failure ? ': ' + f.failure : ''}.`)
    proc.affectedFrds = gatedFrds
    if (gatedFrds.length) integratedChanges.push({ file: proc.changeFile || `${slug}.md`, frds: gatedFrds })
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
  - WALK every FRD module docs/frds/*/. For each, read frd.md and blueprint.md's **Build Plan** (WO order, intra-FRD deps, parallelism, cross-FRD deps) in full, and the **frontmatter ONLY** of every work-orders/wo-*.md (the \`implementation_status\`, \`id\`, deps, title, **\`difficulty\`** (low|medium|high, default medium), **\`reopen_count\`** (number, default 0) and **the LITERAL \`status:\` field** (DRAFT|ACTIVE — DR-100's gating field, distinct from \`implementation_status\`; absent when the WO predates this field) — NOT the full WO body; the implementer reads the body when it builds its own WO, so planning stays fast and cheap).
  - For each work order, the **frontmatter \`implementation_status\` is the source of truth**: PLANNED/IN_PROGRESS = pending; IN_REVIEW = built, awaiting its FRD gate; VERIFIED = done (NEVER rebuild); BLOCKED = skip.
  - **DR-100 gating (BL-0171 defense-in-depth):** a WO whose LITERAL \`status:\` frontmatter reads \`DRAFT\` never passed the readiness/grounding/consistency gate (/pandacorp:architecture step 9b2) — report it via \`docStatus\` below EXACTLY as it reads on disk; the engine itself refuses to schedule it. Do not silently promote or omit it.
  - docs/product/architecture.md → the platform stack.
  - **FOUNDATION (DR-057, web only): read docs/design/components.md** (the shared-component inventory) and skim every FRD's \`mocks/\`/\`fdd.md\` to grasp the COMPLETE set of shared primitives the surfaces reference. The foundation work orders must build the UNION of those primitives — not a hand-picked subset (the gap that shipped flat Party surfaces: Room/AgentSprite/etc. were never in the foundation). Mark \`foundation: true\` on EVERY WO that builds a shared primitive the inventory lists, so the engine builds them all before surfaces fan out.
  Return the FRDs that still have non-VERIFIED work orders, **in cross-FRD dependency order** (from the Build Plans). For each FRD: its \`frd\` folder, its \`deps\` (FRD folders that must be VERIFIED first), and its \`workOrders\` (each with id, frontmatter \`status\`, **\`docStatus\` (the LITERAL \`status:\` frontmatter field, DRAFT|ACTIVE — DR-100/BL-0171; omit when the WO has no \`status:\` line at all)**, **\`path\` (the WO file's repo-relative path — DR-108, the builder opens THE file instead of hunting)**, **\`acText\` (DR-108 CONTEXT PACK — copy VERBATIM from frd.md the EARS acceptance-criteria lines THIS work order owns per the Build Plan; bounded to its own ACs, never the whole FRD. You are the ONLY agent that reads frd.md in full — this hand-off is what lets each builder construct against the real AC scope on the FIRST attempt instead of a one-line summary)**, intra-FRD \`deps\`, one-line \`summary\`, **\`difficulty\` (low|medium|high — COPY it from the WO's \`difficulty:\` frontmatter; default \`medium\` when absent — DR-073: \`high\` builds on opus a-priori)**, **\`reopen_count\` (number — COPY it from the WO's \`reopen_count:\` frontmatter; default \`0\` when absent — DR-073: \`>=1\` builds on opus empirically)**, **its \`artifacts\` = the file/dir globs it writes, COPIED FROM the WO's \`artifacts:\` frontmatter — REQUIRED so the engine keeps parallel WOs disjoint (DR-060); if a WO has none in frontmatter, infer the files it will write from its title/summary**, and **\`foundation: true\` if this WO builds a shared design-system primitive / the inventory the other WOs reuse — DR-057, it must build before they fan out**, and **\`priorAttempts\` (A4 CROSS-PASS LEARNING) — if \`${JOURNAL_PATH}\` EXISTS, read it and, for EACH WO, synthesize a BOUNDED digest (the last 2 relevant entries) of what earlier attempts tried and why they did not hold: \`[{ attempt, classification, findingKey, tried, why }]\` drawn from that WO's attempt/verdict/diagnosis lines. Return \`[]\` (or omit) when the journal is absent or has no entries for the WO — it is fed to the builder as HYPOTHESES to verify against the CURRENT code, never as gospel**) **in the Build Plan's order**.${ONLY ? ' Limit to these FRD folders: ' + ONLY.join(', ') + '.' : ''}
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
      `You are the SOLE git writer at this instant (serialized — no other commit runs concurrently, so there is NO index.lock race), committing work order ${wo.id} now that its self-test is green and its frontmatter is IN_REVIEW.${TRACK_AND_WO_COMMIT(frd, wo.id)} Then make exactly ONE commit (Conventional Commits, with scope) staging ONLY this work order's own files: its declared artifacts ${wo.artifacts && wo.artifacts.length ? '(' + wo.artifacts.join(' ') + ')' : "(use `git status -- .` (THIS project only, BL-0202) to identify THIS wo's files)"} AND its own work-order markdown under \`docs/frds/${frd}/work-orders/\` (the IN_REVIEW frontmatter + ## Status Note) AND \`.pandacorp/track.jsonl\` (the durable timeline lines for THIS wo — the wo_start the builder appended + the wo_end you just appended) AND \`.pandacorp/build-journal.jsonl\` if it changed (append-only, shared — like track.jsonl; sweeps any pending build-journal lines a retry builder appended). Sibling work orders of the same wave may be MID-BUILD — do NOT stage or touch their files; if \`git status -- .\` shows changes outside this WO's files (other than track.jsonl / build-journal.jsonl, which are append-only and shared), leave them untouched. Do NOT advance last_green_sha (that is the FRD gate's job — this WO is self-test-green, not yet review-verified). THEN return the sha of the commit you just made (\`git rev-parse --short HEAD\`). Return { committed: 1, sha: "<that short sha>" }.`,
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
  // BL-0178: where THIS gate's reviewer worked (its probe files live there) and the sha it judged.
  const concurrent = typeof workFrom === 'string' && workFrom.length > 0
  const drift = concurrent ? { pin: (st && st.pinSha) || null, source: gateWorktreePathOf(frd) } : { pin: null, source: PROJECT_DIR }   // D1: the probe lives in THIS gate's slot
  // BL-0203: a finder report only means something to the pinned gate it ran beside (its probes live in that slot). A
  // gate that fell to the main tree (the slot failed after the prelaunch) runs without it.
  if (!concurrent && st && st.driftFinderPromise) { log(`◦ ${frd}: the drift-finder report was gathered in the gate worktree, but this gate runs on the main tree — running without it (BL-0203)`); st.driftFinderPromise = null; st.driftFinding = null }
  const priorAttempts = (st && st.gateAttempts) || 0   // gate attempts ALREADY made for this FRD this run
  const attemptNo = priorAttempts + 1                  // 1-based attempt number for THIS gate (B8)
  if (st) st.gateAttempts = attemptNo
  // C1a serial-first: the reviewed WO objects carry reopen_count (from the plan/frontmatter, already enrolled).
  const reviewedWos = st ? st.f.workOrders.filter((w) => reviewIds.includes(w.id)) : []
  const anyReopened = reviewedWos.some((w) => (w.reopen_count || 0) >= 1)
  const useSplit = P.reviewSplit && (priorAttempts >= 1 || anyReopened)   // first gates run SERIAL (DR-100: ~80% pass or need a ≤6-min fix)
  // BL-0189: the inventory cache is resolved for THIS gate only (at the pin it judges) and dropped after it —
  // a re-gate that calls frdGateSerial directly (the B2 re-ask, the ladder's re-gates) never sees it and
  // runs the full whole-FRD inventory. No-op (no spawn) unless args.gateInventoryCache.
  if (st && GATE_INVENTORY_CACHE) st.inventoryCache = await resolveInventoryCache(frd, drift.pin)   // guarded, not just null-returning: with the flag off the gate's promise timing stays byte-identical (no extra await tick)
  try {
    if (useSplit) {
      const remaining = MAX_AGENTS ? MAX_AGENTS - agentSpawned : Infinity
      if (remaining >= splitGateEstimatedCost()) {
        const split = await frdGateSplit(frd, reviewIds, attemptNo, workFrom, evidencePack)
        if (!split || !split.__splitFailed) return enforceInventoryCoverage(frd, await finalizeGate(frd, reviewIds, split, drift.pin, drift.source))   // sentinel __splitFailed → all finders died → fall to serial
      } else {
        log(`↩ ${frd}: reviewSplit on but the split's estimated cost (${splitGateEstimatedCost()}) exceeds the remaining agent budget (${remaining}) — using the serial gate instead (contract 5)`)
      }
    } else if (P.reviewSplit) {
      log(`▹ ${frd}: first gate attempt this run — running SERIAL (split kicks in on a re-gate or a prior-reopened WO, C1a)`)
    }
    return enforceInventoryCoverage(frd, await finalizeGate(frd, reviewIds, await frdGateSerial(frd, reviewIds, attemptNo, workFrom, evidencePack), drift.pin, drift.source))
  } finally {
    if (st) st.inventoryCache = null
    // BL-0203: the finder report belongs to THIS pinned gate only — its probes live in the slot the release is about
    // to clean, so a later re-gate (on main) neither sees the report nor re-merges its claims.
    if (st) { st.driftFinderPromise = null; st.driftFinding = null }
  }
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
  // BL-0149: the collector's own sanity gate (step 0 of collectGateEvidence) refuses to run verify.sh
  // at all when the pinned worktree was never bootstrapped (no node_modules) — it returns { report:
  // null, reason }. Surface that SPECIFIC reason, never the generic "missing from the pack" message,
  // so the log/GateEvidenceFallback event tells the operator exactly what to fix.
  if (typeof pack.report !== 'string' || !pack.report.trim()) return { evidence: null, fallbackReason: pack.reason ? String(pack.reason) : 'gate-report.json missing from the pack' }
  let parsed
  try { parsed = JSON.parse(pack.report) } catch { return { evidence: null, fallbackReason: 'gate-report.json is not valid JSON' } }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.green !== 'boolean') return { evidence: null, fallbackReason: 'gate-report.json has no boolean green' }
  // BL-0149: a well-formed report can still be UNTRUSTWORTHY — the collector flags report_suspect
  // when 3+ cheap sub-gates are red on environment noise (command not found / Cannot find module),
  // the signature of an unbootstrapped worktree rather than a real finding. Treat it exactly like a
  // null report: strictly worse than no evidence would be to hand a reviewer as authoritative.
  if (pack.report_suspect === true) return { evidence: null, fallbackReason: 'collector flagged report_suspect (3+ cheap sub-gates red on environment noise, e.g. an unbootstrapped worktree) — discarding the pack rather than risk it being read as authoritative' }
  // BL-0188: verify.sh pretty-prints the report (2-space indent, one key per line). The attachment rides in
  // EVERY turn of the gate's context, so it is re-serialized compactly — the SAME parsed value (lossless:
  // every sub-gate, exit and failures[] row survives; only insignificant whitespace goes).
  const tests = Array.isArray(pack.tests) ? pack.tests.filter((t) => typeof t === 'string' && t.trim()) : []
  return { evidence: { ...pack, tests, reportCompact: JSON.stringify(parsed) }, fallbackReason: '' }
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
// BL-0187: each work order's criteria are LABELLED with its id, so the attachment is also the cycle's
// WO → contract traceability map (which reviewed work order owns which criterion), not an anonymous list.
function reviewedAcText(frd, reviewIds) {
  const st = frdState.get(frd)
  const reviewed = st ? st.f.workOrders.filter((w) => reviewIds.includes(w.id)) : []
  return reviewed.filter((w) => w.acText).map((w) => `[${w.id}] ${w.acText}`).join('\n  ')
}

// The collector itself: a MECH, effort:'low', zero-judgment agent. It runs commands and pastes their
// output. It NEVER reviews, NEVER writes a file, NEVER commits, NEVER touches frontmatter — it is not a
// second opinion, so it cannot dilute the trust boundary (DR-015: the judge remains the only judge).
async function collectGateEvidence(frd, reviewIds, pinSha) {
  const artifacts = reviewedArtifacts(frd, reviewIds)
  const acText = reviewedAcText(frd, reviewIds)
  // BL-0187: the stat/patch/tests commands carry `--relative` — on the canary-D2 range Mission Control's stat
  // was 301 files / 18,613 chars without it (the factory's own changes) vs 54 files / 3,405 chars with it.
  // BL-0187: each artifact glob is SHELL-QUOTED so git (not the shell) expands it — unquoted, bash expands
  // `src/x/**` against the pinned tree (a deleted file's hunk is lost) and zsh aborts on no match ("no
  // matches found"), silently returning an empty patch. The explanation stays OUTSIDE the command span.
  const scope = artifacts.length ? ` -- ${artifacts.map(shellQuote).join(' ')}` : ''
  const scopeNote = artifacts.length
    ? "the pathspecs are the reviewed work orders' declared artifacts, relative to THIS project directory"
    : 'the reviewed work orders declare no artifacts — do NOT scope by path; take the whole project diff and let the line cap clip it'
  // BL-0193 (canary E evidence:frd-02): the collector ran verify.sh (~150 s) with the Bash tool's 120 s default, so
  // it went to the background, and the agent then polled the MAIN tree's gate-report.json for 600 s — the report
  // was in the SLOT all along (10 min lost on the critical path). Now: ONE foreground Bash call with the tool's
  // timeout raised AND a shell-level alarm under it (portable: perl, not GNU `timeout`, which macOS lacks), console
  // output to a log file, the stale report removed first (a slot is reused; .pandacorp/run/ survives it), and every
  // path absolute INSIDE this gate's own worktree — the same show-prefix rule as gateProjectCd. E2 finding 6: a FRESH
  // slot has no `.pandacorp/run/` (gitignored, so a new worktree never carries it) and the `> "$LOG"` redirect failed
  // on the first attempt in 2/2 fresh slots of canary E2 — the command creates the directory first.
  const wt = gateWorktreePathOf(frd)
  const slotRun = `${wt}/$(git -C ${shellQuote(PROJECT_DIR)} rev-parse --show-prefix).pandacorp/run`
  agentSpawned++
  return await agent(`WP-06 GATE EVIDENCE COLLECTOR for ${frd}. You are NOT the reviewer: you judge NOTHING, you fix NOTHING, you decide NOTHING. Your entire job is to run the commands below in this frozen worktree and return their output VERBATIM, so the reviewer that runs after you does not have to re-derive it. **Write no file, edit no frontmatter, run no mutating git command, never \`git commit\`, never touch the main tree.**
  0) **SANITY GATE (BL-0149) — confirm this worktree is actually bootstrapped BEFORE you touch verify.sh.** From the project directory (the cd above), run exactly \`node -e "process.stdout.write(require('node:fs').existsSync('node_modules/.bin/vitest') ? 'BOOTSTRAPPED' : 'NOT-BOOTSTRAPPED')"\` — NEVER shell \`test\`/\`[\`, which an owner alias can hijack (BL-0187). If it prints NOT-BOOTSTRAPPED, \`.pandacorp/worktree-bootstrap.sh\` never ran here (or it failed): do NOT run verify.sh, do NOT attempt steps 1-4 below, and return IMMEDIATELY \`{ report: null, reason: "gate-worktree-not-bootstrapped" }\`. A gate report produced without node_modules is command-not-found noise dressed up as evidence — worse than no report at all, because a reviewer would read it as authoritative.
  1) Read \`last_green_sha\` from .pandacorp/status.yaml (call it PIN_BASE) and run the gate script exactly once (that argument ORDER is required — \`--since\` is positional). **Run it as ONE Bash call, in the FOREGROUND, with the Bash tool's \`timeout: 600000\` (the run takes minutes; the 120 s default would push it to the background) — NEVER \`run_in_background\`, never \`&\`, NEVER a polling/\`until\`/\`sleep\` loop. The command, verbatim except PIN_BASE:** \`${gateProjectCd(wt)} && { mkdir -p "${slotRun}"; REPORT="${slotRun}/gate-report.json"; LOG="${slotRun}/evidence-verify.log"; rm -f "$REPORT"; perl -e 'alarm shift; exec @ARGV' 540 bash .pandacorp/verify.sh --since <PIN_BASE> --report-all > "$LOG" 2>&1; echo "verify exit=$?"; cat "$REPORT" || echo "REPORT MISSING: $REPORT"; }\` — REPORT is THIS gate worktree's own report, an absolute path inside it (for a nested project such as Mission Control it resolves to \`<this worktree>/mission-control/.pandacorp/run/gate-report.json\`); NEVER read the main project tree's copy of that file, it belongs to a different run. The perl alarm is the hard bound (540 s): exit 142 means it timed out, and the report is then missing. A non-zero exit is FINE and expected otherwise — it is data, not a problem for you to fix. Return the report that command printed — its **entire contents as a string**, byte-for-byte, in \`report\`. Do NOT summarise it, do NOT reformat it, do NOT drop \`failures[]\` rows however many there are. If the file is missing after the run, say so in \`report\` — the engine detects the malformed pack and falls back.
  1b) **SANITY CHECK (BL-0149) on what step 1 just produced.** Look at the sub-gates in that report. If **3 or more** of the cheap sub-gates (biome/tsc/knip/madge and similar) are RED with an ENVIRONMENT-only message (\`command not found\`, \`Cannot find module\`, \`ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL\`, or equivalent "the tool itself could not run" text — never an actual lint/type finding), set \`report_suspect: true\`: this is a broken worktree, not a real verdict, and a reviewer must never mistake environment noise for a finding. Otherwise set \`report_suspect: false\`.
  2) \`git diff --relative <PIN_BASE>..${pinSha} --stat\` → return it verbatim in \`diffStat\`. \`--relative\` is REQUIRED (BL-0187): it keeps the stat to THIS project — without it a nested project's stat lists every file the enclosing repo changed.
  3) \`git diff --relative <PIN_BASE>..${pinSha}${scope}\` → return it in \`diff\` (${scopeNote}). **Hard cap ${EVIDENCE_DIFF_MAX_LINES} lines.** If the full patch is longer, do NOT silently cut it: include the largest files first, clip each at a hunk boundary, add a \`… <N> lines clipped from <path>\` marker where you clipped, and set \`truncated: true\`. Under the cap → the complete patch and \`truncated: false\`.
  3b) \`tests\`: the test files this cycle ADDED or CHANGED — the output lines of \`git diff --relative --name-only --diff-filter=AMR <PIN_BASE>..${pinSha} | grep -E '(^|/)(__tests__|_tests|tests?|e2e)/|\\.(test|spec)\\.[cm]?[jt]sx?$' || true\`, one path per array item, verbatim ([] when it prints nothing).
  4) \`ac\`: this FRD's EARS acceptance criteria, VERBATIM. The build plan already extracted the criteria these work orders own — each line is prefixed with the \`[WO id]\` that owns it; start from exactly this text and return it unchanged${acText ? `:\n  ${acText}\n  ` : ` (the plan threaded none, so read docs/frds/${frd}/frd.md and copy its acceptance criteria verbatim). `}Only ADD to it: if docs/frds/${frd}/frd.md carries numbered acceptance criteria this list is missing, append those verbatim too, each prefixed \`[not owned by a reviewed work order]\`. Never paraphrase, never renumber, never drop one.
  Return { report, diffStat, diff, truncated, tests, ac, report_suspect } — or, if step 0 refused, just { report: null, reason }.`,
    { label: `evidence:${frd}`, phase: 'Review', model: MECH, effort: MECH_EFFORT, agentType: MECH_AGENT('pandacorp:implementer'), schema: EVIDENCE_SCHEMA, workFrom: worktreeWorkFrom(pinSha, gateWorktreePathOf(frd)) })   // D1: the gate's own slot
}

// Start the collector for `frd` as a background promise on the gate-worktree mutex. Idempotent per FRD and
// a no-op in explore mode, so the call sites need no mode branch of their own.
function launchEvidence(frd) {
  if (GATE_EVIDENCE !== 'digested') return
  if (PARALLEL_GATES) return   // D1: no slot is assigned at wave close — the collector runs INLINE in the gate's own slot link (resolveGateEvidence)
  const st = frdState.get(frd)
  if (!st || st.evidencePromise) return
  const pinSha = st.pinSha
  if (!pinSha) return   // no pin → no frozen tree to collect from; the gate resolves it inline (or degrades)
  const work = gateWorktreeChain.then(async () => {
    const ok = await ensureGateWorktree(pinSha)
    if (!ok) return null   // worktree unavailable → this run is heading for the legacy synchronous path anyway
    // BL-0203: the drift finder reads the same frozen tree, concurrently; the link holds the worktree until it is
    // done too (the next link may check the tree out at another sha).
    const finder = startDriftFinder(frd, st.reviewIds, pinSha, worktreeWorkFrom(pinSha))
    try { return await collectGateEvidence(frd, st.reviewIds, pinSha) }
    finally { if (finder) await finder }
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

// ── BL-0203 · WHOLE-FRD DRIFT FINDER (canary F2) ─────────────────────────────────────────────────
// Canary E2 (docs/reviews/canary-e2-report.md §3.3): the digested judge's recall fell to 2/5 because the drift of
// an FRD lives in VERIFIED code OUTSIDE the diff it is handed, and 8 reads never reach it (gate:frd-02 opened
// phases.ts 0 times; explore's gate opened it 9 times). The fix keeps the cheap digested judge and adds ONE sonnet
// agent per gate whose only job is to walk the WHOLE FRD against the code at the pin. Trust boundary, unchanged:
//   • it PROPOSES — its report is a prompt block for the judge (DR-015), never a verdict;
//   • its drift claims are proven, never trusted — the engine merges each claim the judge neither recorded nor
//     refuted with a test of its own into the SAME DR-122 differential proof a reviewer claim takes (finalizeGate);
//   • a finder claim can never become an UNPROVEN cycle fault: only a probe that fails on an assertion at the pin
//     AND is either owned by a reviewed WO or held at last_green_sha reopens the cycle; everything else is
//     discarded with a log (the judge, not a sonnet helper, owns the fail-closed side of the oracle).
// Lifecycle: started in the gate's slot link beside the evidence collector (launchEvidence / launchGate /
// launchGateInSlot), awaited by the serial gate before it spawns and by the split gate beside its four lenses,
// and dropped when frdGate returns — a re-gate on main never sees a report whose probes live in a released slot.
const DRIFT_FINDER_TOOL_BUDGET = 60   // tool calls; the digested judge's cap is 8 reads — the finder exists to read
const FINDER_PROBE_RE = /\.finder\.drift-probe\.tsx?$/   // the finder's own probes, never the reviewer's (DR-122 path + infix)
const DRIFT_FINDER_STATUSES = ['implemented', 'drift', 'unknown']
const DRIFT_FINDER_SCHEMA = {
  type: 'object', required: ['contracts'],
  properties: {
    contracts: { type: 'array', description: 'ONE entry per normative contract of the FRD — none dropped, none merged into a range', items: {
      type: 'object', required: ['contract', 'status'],
      properties: {
        contract: { type: 'string', description: 'the contract id first, then its text, e.g. "REQ-03-001 — architecture projects SHALL NOT appear"' },
        contractClass: { type: 'string', enum: REQUIRED_TRACE_CLASSES },
        owner: { type: 'string', description: 'the work-order id whose source_requirements lists this contract, or "none"' },
        status: { type: 'string', enum: DRIFT_FINDER_STATUSES },
        evidence: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, snippet: { type: 'string' } } },
        claim: { type: 'string', enum: ['preexisting', 'cycle'] },
        probe_test: { type: 'string', description: 'drift only: .pandacorp/run/drift-probes/<frd>/<contract-id-slug>.finder.drift-probe.ts' },
        direction: { type: 'string', enum: ['code', 'spec', 'unknown'] },
        why: { type: 'string' },
      },
    } },
    toolCalls: { type: 'number' },
    budgetExhausted: { type: 'boolean' },
  },
}
// The FRD's work orders as the finder's roster: every one, the VERIFIED foundation included (that is where drift lives).
const frdRoster = (frd) => {
  const st = frdState.get(frd)
  const wos = st ? st.f.workOrders : []
  return wos.map((w) => `${w.id} · ${w.status || 'unknown'} · ${w.path || `docs/frds/${frd}/work-orders/${w.id}.md`}`).join('\n  ')
}
// Start the finder for THIS gate (idempotent per FRD; a no-op unless DRIFT_FINDER). The promise never rejects.
function startDriftFinder(frd, reviewIds, pinSha, workFrom) {
  if (!DRIFT_FINDER) return null
  const st = frdState.get(frd)
  if (!st) return null
  if (st.driftFinderPromise) return st.driftFinderPromise
  const acText = reviewedAcText(frd, reviewIds)
  agentSpawned += COST('sonnet')   // BL-0203: one STANDARD-tier unit, reserved in gateCostEstimate
  st.driftFinderPromise = agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'find-drift' })}FRD gate — the WHOLE-FRD DRIFT FINDER for ${frd} (BL-0203, canary F2). You run BESIDE this FRD's gate, in its pinned worktree, while another agent runs the gate script here; the opus reviewer that judges this FRD reads your report. You are NOT the judge (DR-015): everything you return is a proposal the judge weighs and the engine proves (DR-122).
  ${DRIFT_FINDER_DIRECTIVE}
  **THIS FRD:** \`docs/frds/${frd}/frd.md\` and \`docs/frds/${frd}/blueprint.md\` at this pin — inventory EVERY contract in them. Its work orders (id · status · path) — read each one's frontmatter \`source_requirements\` (ownership) and its \`## Status Note\` (the tests it declares as evidence):
  ${frdRoster(frd) || '(the plan carried no work-order list — find them under docs/frds/' + frd + '/work-orders/)'}
  **THE WORK ORDERS UNDER REVIEW THIS CYCLE:** ${reviewIds.join(', ')} — a contract one of them owns is a \`cycle\` contract; every other contract is \`preexisting\`, and those are where the judge cannot look: do them FIRST.${acText ? `\n  The planner's verbatim criteria of those work orders (a head start, not the inventory): \n  ${acText}` : ''}
  **DECLARED EVIDENCE, if cached:** \`${PROJECT_DIR}/.pandacorp/run/gate-evidence/${frd}/inventory.json\` (MAIN tree, read-only, may be absent or stale — frd.md at this pin is the authority) lists the evidence tests of the last green gate per contract.
  **PROBES:** write each drift probe at \`.pandacorp/run/drift-probes/${frd}/<contract-id-slug>.finder.drift-probe.ts\`, relative to this project directory inside the worktree.
  **TOOL BUDGET: at most ${DRIFT_FINDER_TOOL_BUDGET} tool calls** — count them; report the count in \`toolCalls\`.
  Return { contracts: [{ contract, contractClass, owner, status: implemented|drift|unknown, evidence: { file, line, snippet }, claim: preexisting|cycle, probe_test (drift only), direction (drift only: code|spec|unknown), why }], toolCalls, budgetExhausted }.`,
    { label: `find:drift:${frd}`, phase: 'Review', model: 'sonnet', effort: 'medium', agentType: 'pandacorp:drift-finder', fallbackAgentType: 'pandacorp:reviewer', schema: DRIFT_FINDER_SCHEMA, workFrom })
    .then((r) => r, (e) => ({ __threw: (e && e.message) || String(e) }))
  return st.driftFinderPromise
}
// DR-078 fail-loud read boundary over the finder's answer: a usable report, or an explicit reason — never a
// silent empty list. Malformed ROWS are counted and named, never dropped silently; a drift row without a valid
// finder probe for THIS FRD stays in the report as an unproven pointer (the judge sees it; nothing is merged).
function validateDriftFinding(raw, frd) {
  if (!raw || typeof raw !== 'object') return { finding: null, reason: 'the finder returned no verdict' }
  if (raw.__threw) return { finding: null, reason: `the finder threw (${raw.__threw})` }
  if (!Array.isArray(raw.contracts)) return { finding: null, reason: 'the finder output has no contracts array' }
  if (!raw.contracts.length) return { finding: null, reason: 'the finder returned no contracts (an FRD always has some — it did not do the pass)' }
  const rows = []
  const malformed = []
  for (const [i, r] of raw.contracts.entries()) {
    if (!r || typeof r.contract !== 'string' || !r.contract.trim() || !DRIFT_FINDER_STATUSES.includes(r.status)) { malformed.push(i); continue }
    const probeOk = r.status === 'drift' && typeof r.probe_test === 'string' && DRIFT_PROBE_RE.test(r.probe_test) && FINDER_PROBE_RE.test(r.probe_test) && r.probe_test.includes(`/drift-probes/${frd}/`)
    rows.push({ ...r, provable: probeOk && Boolean(contractIdOf(r.contract)) })
  }
  if (!rows.length) return { finding: null, reason: `every one of the finder's ${raw.contracts.length} rows is malformed` }
  return { finding: { rows, malformed, toolCalls: Number(raw.toolCalls) || null, budgetExhausted: raw.budgetExhausted === true }, reason: '' }
}
// Await + validate the finder of THIS gate (memoized on st.driftFinding for the prompt block and finalizeGate).
async function awaitDriftFinding(frd) {
  const st = frdState.get(frd)
  if (!st || !st.driftFinderPromise) return null
  if (st.driftFinding !== undefined && st.driftFinding !== null) return st.driftFinding
  const { finding, reason } = validateDriftFinding(await st.driftFinderPromise, frd)
  if (!finding) { log(`⚠ DriftFinderFallback ${frd}: ${reason} — this gate runs without a drift-finder report (the gate itself is never skipped)`); st.driftFinding = false; return null }
  const n = (s) => finding.rows.filter((r) => r.status === s).length
  log(`⌕ ${frd}: drift finder → ${finding.rows.length} contract(s): ${n('implemented')} implemented, ${n('drift')} drift (${finding.rows.filter((r) => r.provable).length} with a probe), ${n('unknown')} unknown${finding.malformed.length ? `; ${finding.malformed.length} MALFORMED row(s) ignored (#${finding.malformed.join(', #')})` : ''}${finding.budgetExhausted ? '; its tool budget ran out' : ''}`)
  st.driftFinding = finding
  return finding
}
const currentDriftFinding = (frd) => { const st = frdState.get(frd); return (st && st.driftFinding) || null }
// Is a finder row one of THIS cycle's contracts? Its declared owner is a reviewed WO, or its id is in the planner's
// verbatim criteria of a reviewed WO (the finder may miss the frontmatter; the engine does not rely on it alone).
function isCycleRow(frd, reviewIds, row) {
  if (row.owner && reviewIds.includes(row.owner)) return true
  const id = contractIdOf(row.contract)
  return Boolean(id) && reviewedAcText(frd, reviewIds).includes(id)
}
const finderRowLine = (r) => `• ${r.contract}${r.evidence && r.evidence.file ? ` — ${r.evidence.file}${r.evidence.line ? `:${r.evidence.line}` : ''}` : ''}${r.evidence && r.evidence.snippet ? ` \`${String(r.evidence.snippet).slice(0, 160)}\`` : ''}${r.owner ? ` · owner ${r.owner}` : ''}${r.why ? ` · ${String(r.why).slice(0, 240)}` : ''}${r.status === 'drift' ? (r.provable ? ` · probe ${r.probe_test}${r.direction ? ` · direction ${r.direction}` : ''}` : ' · NO valid probe (unproven pointer)') : ''}`
// The judge's view of the report (serial gate + split closer). Empty when there is no usable report.
function driftFinderBlock(frd, reviewIds) {
  const f = currentDriftFinding(frd)
  if (!f) return ''
  const drift = f.rows.filter((r) => r.status === 'drift')
  const unknown = f.rows.filter((r) => r.status === 'unknown')
  const unknownCycle = unknown.filter((r) => isCycleRow(frd, reviewIds, r))
  const unknownOther = unknown.filter((r) => !isCycleRow(frd, reviewIds, r))
  const implemented = f.rows.filter((r) => r.status === 'implemented')
  const list = (rows) => (rows.length ? rows.map(finderRowLine).join('\n  ') : '(none)')
  return `
  **WHOLE-FRD DRIFT FINDER REPORT (BL-0203).** A separate sonnet agent walked EVERY contract of \`docs/frds/${frd}/frd.md\` (and the blueprint's CMP/IF) against the code at this pin, OUTSIDE the diff you were handed${f.toolCalls ? `, in ${f.toolCalls} tool calls` : ''}${f.budgetExhausted ? ' — its tool budget ran out, so treat its UNKNOWN rows as unreviewed' : ''}. It is not a verdict and it proved nothing by itself: you are the judge (DR-015).
  (1) DRIFT CLAIMS — open each evidence file:line and each probe. If the code contradicts the contract, record it as a \`fail\` traceability entry: with \`claim: "preexisting"\`, \`evidence_test\` = that probe path and a \`direction\` when no reviewed work order owns it (the engine proves it, DR-122), or as a finding/reopen of the reviewed work order that owns it. If you disagree, refute it ONLY with a test of your own that asserts the contract HOLDS: status \`pass\`, that test in the entry's \`tests\` AND in \`testFiles\`. **The engine submits every drift claim you neither record as a \`fail\` nor refute with a test of your own to the same differential proof:** proven pre-existing → a draft card, never a block; a regression, or a contract a reviewed work order owns failing on an assertion at this pin → reopened patch-first; anything unproven → discarded with a log.
  ${list(drift)}
  (2) UNKNOWN ON THIS CYCLE'S CONTRACTS (${reviewIds.join(', ')}) — the finder could NOT locate their implementation. You MUST deep-review each one yourself: open the implementing code, exercise it with at least one test, and return it in \`traceability\` with non-empty \`tests\` (or as a \`fail\`). These reads do NOT count against your read budget.
  ${list(unknownCycle)}
  (3) UNKNOWN ON OTHER CONTRACTS — review what you can; a contract you cannot confirm stays out of a \`pass\` without a test.
  ${list(unknownOther)}
  (4) IMPLEMENTED — a pointer map (file:line) to jump straight to the code instead of searching; do not re-verify every row.
  ${list(implemented)}
`
}
// finalizeGate's first step: turn every provable finder drift the judge neither recorded as a fail nor refuted with
// its own test into a `claim: "preexisting"` fail entry tagged origin:'drift-finder', so adjudicateDrift proves it.
// The judge's own entry for that contract is kept on the claim (restored if the proof discards the claim).
function mergeDriftFinderClaims(frd, raw) {
  const f = currentDriftFinding(frd)
  if (!f || !raw || typeof raw !== 'object' || !Array.isArray(raw.traceability)) return raw
  const claims = f.rows.filter((r) => r.status === 'drift' && r.provable)
  if (!claims.length) return raw
  if (DRIFT_POLICY === 'block') { log(`◦ ${frd}: ${claims.length} drift-finder claim(s) NOT merged — args.driftPolicy:'block' (the judge saw them in its prompt; BL-0203)`); return raw }
  const own = new Set(Array.isArray(raw.testFiles) ? raw.testFiles : [])
  const trace = [...raw.traceability]
  for (const r of claims) {
    const id = contractIdOf(r.contract)
    const at = trace.findIndex((e) => e && contractIdOf(e.contract) === id)
    const judge = at >= 0 ? trace[at] : null
    if (judge && judge.origin === 'drift-finder') { log(`◦ ${frd}: drift finder listed ${id} twice — the first claim stands (BL-0203)`); continue }
    if (judge && judge.status === 'fail') { log(`◦ ${frd}: drift finder claim on ${id} — the judge already recorded it as a fail; its entry governs (BL-0203)`); continue }
    if (judge && judge.status === 'pass' && Array.isArray(judge.tests) && judge.tests.some((x) => own.has(x))) { log(`⚖ ${frd}: drift finder claim on ${id} refuted by the reviewer with its own passing test (${judge.tests.filter((x) => own.has(x)).join(', ')}) — dropped before any proof (DR-015; BL-0203)`); continue }
    const entry = { contract: r.contract, contractClass: REQUIRED_TRACE_CLASSES.includes(r.contractClass) ? r.contractClass : (/^REQ-/.test(id) ? 'requirement' : 'acceptance-criterion'), status: 'fail', claim: 'preexisting', evidence_test: r.probe_test, direction: r.direction || 'unknown', tests: [], origin: 'drift-finder', ...(judge ? { __judgeEntry: judge } : {}) }
    if (at >= 0) trace[at] = entry
    else trace.push(entry)
    log(`⌕ ${frd}: drift finder claim on ${id} ${judge ? `(the judge marked it ${judge.status} without a test of its own)` : '(absent from the judge\'s traceability)'} submitted to the DR-122 differential proof (BL-0203)`)
  }
  return { ...raw, traceability: trace }
}
/**
 * BL-0203: the DR-122 predicate for a FINDER claim. Same facts, one asymmetry: the fail-closed side (an unproven
 * claim is a cycle fault) belongs to the judge's own claims only — a finder claim reopens the cycle only when its
 * probe fails on an assertion at the pin AND the contract is owned by a reviewed WO or held at last_green_sha.
 * @returns {{ verdict: 'preexisting'|'regression'|'cycle-fault'|'refuted'|'unproven', why: string, stored?: string }}
 */
function classifyFinderClaim(entry, proof, owned, proofError) {
  const id = contractIdOf(entry.contract)
  if (!proof) return { verdict: 'unproven', why: proofError || 'the differential proof did not run' }
  const probe = proof.probes.find((p) => p && p.path === entry.evidence_test)
  if (!probe || probe.missing) return { verdict: 'unproven', why: 'the finder probe was not found where it said it wrote it' }
  const head = probeRunState(probe.head)
  if (head === 'passed') return { verdict: 'refuted', why: 'the probe PASSES at the gate pin — the claimed contradiction is not demonstrated', stored: probe.stored }
  if (head !== 'assertion-failed') return { verdict: 'unproven', why: `the probe is ${head} at the gate pin`, stored: probe.stored }
  if (!owned) return { verdict: 'unproven', why: 'reviewed work-order ownership could not be read at the pin', stored: probe.stored }
  if (id && owned.has(contractCore(id))) return { verdict: 'cycle-fault', why: `${id} is owned by a reviewed work order and the finder probe fails on an assertion at the pin — a defect of this cycle the gate did not record`, stored: probe.stored }
  const c = classifyDriftClaim(entry, proof, owned, proofError)
  return c.verdict === 'cycle-fault' ? { ...c, verdict: 'unproven' } : c
}

const evidenceOf = (pack) => (pack && pack.evidence) || null
const evidenceFallbackOf = (frd, pack) => ((pack && pack.fallbackReason) ? GATE_EVIDENCE_FALLBACK_EVENT(frd, pack.fallbackReason) : '')

// The three attachments, interpolated at the TOP of the gate prompt (before the lenses) so they are the
// reviewer's first material, plus the bounded exploration budget that replaces open-ended exploration.
const evidenceBlock = (frd, ev) => ev ? `
  **${EVIDENCE_MARKER} (WP-06).** A dedicated collector already ran the gate script and gathered the diff and the acceptance criteria at this exact pinned commit, in this exact worktree. **The three attachments below ARE your primary material** — read them first and judge from them. Do NOT re-walk the tree to rebuild what is already here.
  **EXPLORATION BUDGET FOR THIS GATE: at most ${EVIDENCE_READ_BUDGET} additional file reads, plus EXACTLY ONE mandatory execution of the gate script AFTER you write your adversarial tests (step 2 below — not optional: ATTACHMENT 1 predates those tests and cannot certify them).** Writing your adversarial tests, running them, and building the traceability inventory are NOT exploration — they are the job, and they are not capped. **If ${EVIDENCE_READ_BUDGET} reads are not enough to reach a verdict you can defend, do NOT keep exploring: return the verdict you can defend and state in \`failure\` exactly what you still needed and why.** An honest bounded verdict beats an unbounded hunt.

  ── ATTACHMENT 1/3 · GATE REPORT — \`.pandacorp/run/gate-report.json\` from \`bash .pandacorp/verify.sh --since <last_green_sha> --report-all\` run at THIS pin (whitespace-compacted by the engine; every sub-gate, exit and failures[] row is intact) ──
  ${ev.reportCompact || ev.report}

  ── ATTACHMENT 2/3 · THE CHANGE UNDER REVIEW — \`git diff <pin_base>..<pin>\`, the patch scoped to the reviewed work orders' declared artifacts ──${ev.truncated ? `
  ⚠ **TRUNCATED**: the unified patch exceeded the ${EVIDENCE_DIFF_MAX_LINES}-line cap, so it carries the largest files clipped at hunk boundaries. This is NOT the complete change set — the \`--stat\` below IS complete, so reconcile against it and spend budgeted reads on any file you need in full.` : ''}
  STAT:
  ${ev.diffStat || '(the collector reported none)'}
  PATCH:
  ${ev.diff || '(the collector reported none)'}
  TEST FILES THIS CYCLE ADDED OR CHANGED (\`git diff --relative --name-only\`, test paths only — the implementers' evidence; run the ones covering the reviewed work orders BY PATH, never trusting \`--changed\` to have picked them up):
  ${ev.tests && ev.tests.length ? ev.tests.join('\n  ') : '(none — the cycle added or changed no test file)'}

  ── ATTACHMENT 3/3 · EARS ACCEPTANCE CRITERIA of ${frd}, verbatim ──
  ${ev.ac || `(the collector reported none — recover them from docs/frds/${frd}/frd.md within your read budget)`}
` : ''

// Step 2 of the gate. EXPLORE = the historical text (plus the WP-08 report_scope cage, reconciled at
// integration time — every certifier carries it, not only the ones WP-08 itself touched). DIGESTED = the
// SAME obligation (the focused gate must be clean, under the SAME cage), reached from the attached report
// PLUS a MANDATORY re-run (REV2-1/DR-080): ATTACHMENT 1 was collected BEFORE the reviewer's own
// adversarial tests existed, so it cannot possibly certify them — a permissive "you MAY re-run" let a gate
// write tests it never executed and certify green off stale evidence. The re-run is required, not offered.
const gateFocusedStep = (frd, ev) => (ev
  ? `  2) **Do NOT re-run the focused gate merely to discover its result — ATTACHMENT 1 above IS that result** (\`verify.sh --since <last_green_sha> --report-all\`, executed for you at this pin). Read every sub-gate's \`exit\` and every \`failures[]\` row in it; a red sub-gate there is first-class blocking evidence, and a \`green: false\` report can never be waived into a pass. **You MUST run verify.sh exactly once — \`bash .pandacorp/verify.sh --since <last_green_sha>\` — after writing your adversarial tests: ATTACHMENT 1 predates them and therefore cannot certify them.** Do NOT pass \`--only\`/\`--files\` on that re-run: this gate is the FRD's certification oracle, and a scoped run stamps the report \`scope:"partial"\`, which the engine refuses to certify on. It must pass clean.${REPORT_SCOPE_DIRECTIVE} Return THAT run's \`.pandacorp/run/gate-report.json\` VERBATIM as \`gateReport\` — never ATTACHMENT 1's — when it is RED, so the engine can route the failing sub-gate without paying a model to re-read your prose.${PREVIEW_SMOKE(frd)}`
  : `  2) Run the FOCUSED gate \`bash .pandacorp/verify.sh --since <last_green_sha>\` (read last_green_sha from .pandacorp/status.yaml) — biome + tsc run globally, but only the TESTS affected since the last green (fast and scales; the full suite runs once at close-out). It must pass clean. Do NOT pass \`--only\`/\`--files\` here: this run is the FRD's certification oracle, and a scoped run stamps the report \`scope:"partial"\`, which the engine refuses to certify on.${REPORT_SCOPE_DIRECTIVE} Also return that run's \`.pandacorp/run/gate-report.json\` VERBATIM as \`gateReport\` when it is RED, so the engine can route the failing sub-gate without paying a model to re-read your prose.${PREVIEW_SMOKE(frd)}`) + REVIEWER_TESTS_EXPLICIT

// ── BL-0188 · GATE CONTEXT SCOPE (args.gateContextScope) ─────────────────────────────────────────
// The gate's spawn prompt carries NO FRD/blueprint/WO text — the reviewer reads those itself, and every
// byte it reads or prints rides in its context for every later turn (D2: 59-80 turns/gate at 125-143k
// tokens/turn; bash exploration 25-54% of turns). So the trim is a READ SCOPE, not a prompt diet. What it
// never touches: frd.md is still read whole (the oracle's source) unless an engine-verified inventory
// cache stands in for the re-inventory (BL-0189); and it relaxes no obligation (the whole-FRD oracle,
// DR-080 adversarial tests, the 7-class traceability all stand as written above it in the prompt).
const gateContextScope = (frd, reviewIds) => {
  if (!GATE_CONTEXT_SCOPE) return ''
  const st = frdState.get(frd)
  const cycle = (st ? st.f.workOrders.filter((w) => reviewIds.includes(w.id)).map((w) => w.path || w.id) : []).join(', ') || reviewIds.join(', ')
  const cached = Boolean(st && st.inventoryCache && st.inventoryCache.hit)
  return `
  **CONTEXT SCOPE (gate cost, BL-0188) — your obligations above are unchanged; this governs only HOW MUCH you read.** Everything you read or print stays in your context for every later turn, so read what the verdict needs, not the whole tree:
  • ${cached ? `FRD: the engine-verified CACHED INVENTORY above stands in for a whole-file re-read — read the sections of \`docs/frds/${frd}/frd.md\` holding the contracts you deep-review.` : `READ IN FULL: \`docs/frds/${frd}/frd.md\` (the whole-FRD oracle needs every contract).`} Also in full: this cycle's work orders (${cycle}).
  • HEADER ONLY: the FRD's OTHER work orders (VERIFIED in earlier cycles, a stable foundation) — their frontmatter (\`source_requirements\`, \`artifacts\`) and \`## Status Note\` (which tests cover them), never the whole body.
  • SECTIONS ONLY: \`docs/frds/${frd}/blueprint.md\` — \`grep -n\` the REQ/CMP/IF ids this cycle's work orders cite and read those sections.
  • POINTERS ONLY: \`docs/rules/*\`, \`AGENTS.md\`, the factory standards and memory — open one only when a specific finding hinges on it (memory: grep \`INDEX.md\` for a matching trigger).
  • NEVER: the factory, plugin or build-engine source (\`plugin/\`, \`.claude/engines/\`, an enclosing repo's \`factory/\` when this project is nested) — it is not the product under review.
  • HEAVY OUTPUT → FILE + TAIL: run verify.sh / vitest / playwright / \`git log\` with stdout+stderr redirected to \`.pandacorp/run/gate-logs/<name>.log\` (gitignored) and read \`tail -n 80\` plus a \`grep\` of the failures — never print a whole log into the conversation.`
}

// ── BL-0189 · FRD CONTRACT-INVENTORY CACHE — "FRD baseline gated at SHA" (args.gateInventoryCache) ──
// The whole-FRD oracle re-inventories every normative contract on every gate, even when the FRD has not
// changed since its last green gate (D2's frd-02 gate spent turns on `for id in AC-02-…` loops and `git log
// -S` archaeology). DR-115 HONEST CACHE, stated at the field: .pandacorp/run/gate-evidence/<frd>/
// inventory.json is a REPLICA of the last green gate's adjudicated traceability; its SINGLE writer is the
// certifying landing (applyGate, via gate-inventory.mjs write); it is re-derived at EVERY green gate; it is
// fingerprinted against its atomic source (the sha256 of frd.md/blueprint.md's normative body at the pin)
// and used ONLY when both fingerprints still match at the new pin; no display surface reads it. It never
// narrows the verdict: the gate still returns the COMPLETE traceability (7 classes, every cached REQ/AC —
// enforceInventoryCoverage refuses a green that drops one), and still deep-reviews the cycle's contracts.
const INVENTORY_STATUSES = ['pass', 'not-applicable', 'drift']   // a green verdict holds no open fail; `drift` = engine-proven (BL-0178)
const INVENTORY_SAMPLE_MIN = 3   // non-cycle contracts the reviewer re-judges in full on a cache hit, beyond those its evidence run flags
// FNV-1a 32-bit over UTF-16 code units — byte-identical to gate-inventory.mjs fnv1a(): the write refuses a
// contracts JSON the MECH copier damaged instead of caching it.
const inventoryDigest = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 } return h.toString(16).padStart(8, '0') }
// DR-078 fail-loud read boundary: '' when the parsed cache is a usable inventory, else the first defect.
function inventoryError(inv, frd) {
  if (!inv || typeof inv !== 'object' || Array.isArray(inv)) return 'not a JSON object'
  if (inv.version !== 1) return `unknown version ${JSON.stringify(inv.version)}`
  if (inv.frd !== frd) return `it belongs to ${JSON.stringify(inv.frd)}`
  if (typeof inv.gatedAt !== 'string' || !/^[0-9a-f]{7,40}$/.test(inv.gatedAt)) return 'gatedAt is not a commit sha'
  if (!inv.sources || typeof inv.sources.frd !== 'string' || !(inv.sources.blueprint === null || typeof inv.sources.blueprint === 'string')) return 'sources (the frd.md/blueprint.md fingerprints) are missing'
  if (!Array.isArray(inv.contracts) || !inv.contracts.length) return 'it lists no contracts'
  for (const [i, e] of inv.contracts.entries()) {
    if (!e || typeof e.contract !== 'string' || !e.contract.trim()) return `contract ${i} has no text`
    if (!REQUIRED_TRACE_CLASSES.includes(e.contractClass)) return `contract ${i} has an unknown class`
    if (!INVENTORY_STATUSES.includes(e.status)) return `contract ${i} has status ${JSON.stringify(e.status)}`
    if (!Array.isArray(e.tests) || e.tests.some((x) => typeof x !== 'string')) return `contract ${i} has no tests array`
  }
  const missing = REQUIRED_TRACE_CLASSES.filter((k) => !inv.contracts.some((e) => e.contractClass === k))
  return missing.length ? `missing contractClass: ${missing.join(', ')}` : ''
}
// MECH check (a read: git objects + one gitignored file) → { hit, inventory } | { hit:false, reason[, malformed] }.
// The script only reports facts; the ENGINE parses the cache and compares the fingerprints.
async function resolveInventoryCache(frd, pinSha) {
  if (!GATE_INVENTORY_CACHE) return null
  const cmd = `${INVENTORY_CLI_COMMAND} check --project ${shellQuote(PROJECT_DIR)} --frd ${shellQuote(frd)} --pin ${shellQuote(pinSha || 'HEAD')}`
  agentSpawned++
  let raw = null
  try {
    raw = await agent(`MECHANICAL COMMAND RUNNER — BL-0189 inventory-cache check for ${frd}. Your SOLE action is to execute this exact command ONCE (no command before or after it) and return its stdout VERBATIM as \`output\`: \`${cmd}\`. It only READS (git objects and one gitignored file) and prints ONE JSON line. Do not inspect, edit, fix, summarize or reformat anything.`,
      { label: `gate-inventory:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: DRIFT_OUTPUT_SCHEMA })
  } catch (e) { log(`⚠ ${frd}: the inventory-cache check threw (${(e && e.message) || e}) — full whole-FRD inventory this gate`); return { hit: false, reason: 'check threw' } }
  const line = (raw && typeof raw.output === 'string') ? raw.output.trim().split('\n').pop() : ''
  let j = null
  try { j = JSON.parse(line) } catch { j = null }
  if (!j || j.ok !== true || !j.sources || typeof j.sources.frd !== 'string') {
    log(`⚠ ${frd}: the inventory-cache check returned no usable facts (${(j && j.error) || 'unparseable output'}) — full whole-FRD inventory this gate`)
    return { hit: false, reason: 'check failed' }
  }
  if (j.inventory === null || j.inventory === undefined) { log(`◦ ${frd}: no cached contract inventory yet — full whole-FRD inventory this gate (a green gate seeds it)`); return { hit: false, reason: 'absent' } }
  let inv = null
  let defect = ''
  try { inv = JSON.parse(j.inventory) } catch { defect = 'not valid JSON' }
  if (!defect) defect = inventoryError(inv, frd)
  if (defect) {
    log(`⊘ ${frd}: MALFORMED cached contract inventory (${j.inventoryPath || 'inventory.json'}: ${defect}) — IGNORED, never read as an empty or partial inventory (DR-078); this gate re-derives the whole-FRD inventory and its green landing rewrites the cache`)
    return { hit: false, reason: 'malformed', malformed: true }
  }
  const changed = [inv.sources.frd !== j.sources.frd ? 'frd.md' : '', (inv.sources.blueprint || null) !== (j.sources.blueprint || null) ? 'blueprint.md' : ''].filter(Boolean)
  if (changed.length) { log(`↻ ${frd}: cached contract inventory is STALE — ${changed.join(' + ')} changed normatively since ${inv.gatedAt} — full whole-FRD inventory this gate`); return { hit: false, reason: 'stale' } }
  log(`⚡ ${frd}: cached contract inventory HIT (gated at ${inv.gatedAt}, ${inv.contracts.length} contracts, frd.md/blueprint.md unchanged) — the reviewer deep-reviews this cycle's contracts and re-runs the rest's evidence`)
  return { hit: true, inventory: inv }
}
// The cached inventory, injected into the gate prompt on a HIT only. Compact rows, not JSON: it rides in
// every turn of the gate's context.
const inventoryBlock = (frd, reviewIds) => {
  const st = frdState.get(frd)
  const c = st && st.inventoryCache
  if (!c || !c.hit) return ''
  const inv = c.inventory
  const rows = inv.contracts.map((e) => `${e.contractClass} | ${e.status} | ${e.contract} | ${e.tests.length ? e.tests.join(', ') : '—'}`).join('\n  ')
  return `
  **CACHED WHOLE-FRD INVENTORY — FRD baseline gated at ${inv.gatedAt} (BL-0189).** The engine verified that the normative body of \`docs/frds/${frd}/frd.md\`${inv.sources.blueprint ? ' and of its blueprint.md' : ''} (sha256, frontmatter excluded) is UNCHANGED since the last GREEN gate of this FRD inventoried it at ${inv.gatedAt}. The oracle above is NOT relaxed — your verdict still returns the COMPLETE traceability (every contract below, all 7 classes) and any contradiction is still RED — but do NOT re-derive the inventory from scratch:
  (1) DEEP-REVIEW every contract this cycle's work orders (${reviewIds.join(', ')}) own or cite, exactly as without a cache;
  (2) for EVERY other contract below, re-run its recorded evidence tests BY PATH in ONE batched run (\`pnpm vitest run <paths…>\`; Playwright specs \`pnpm playwright test <paths…>\`) — a contract whose evidence is missing or fails, or whose code this cycle's diff touched, gets the full deep review;
  (3) deep-review a further SAMPLE of at least ${INVENTORY_SAMPLE_MIN} of the remaining contracts (or 20% of them, whichever is larger), spread across classes;
  (4) return EVERY contract below in \`traceability\` (its status re-confirmed now) plus any the cache missed — the engine REFUSES a green verdict that drops a cached REQ/AC contract.
  CACHED INVENTORY (class | status at ${inv.gatedAt} | contract | evidence tests):
  ${rows}
`
}
// On a HIT, a green verdict must still carry every cached REQ/AC contract — the cache can shorten the
// reviewer's WORK, never the verdict's COVERAGE (DR-115/BL-0078). A drop is a traceability deficiency:
// gateConverge's B2 re-ask runs the gate again WITHOUT the cache (a full whole-FRD inventory).
function enforceInventoryCoverage(frd, result) {
  const st = frdState.get(frd)
  const c = st && st.inventoryCache
  if (!c || !c.hit || !result || result.green !== true) return result
  const seen = new Set((Array.isArray(result.traceability) ? result.traceability : []).map((e) => contractIdOf(e && e.contract)).filter(Boolean))
  const dropped = [...new Set(c.inventory.contracts.map((e) => contractIdOf(e.contract)).filter((id) => id && !seen.has(id)))]
  if (!dropped.length) return result
  log(`⚠ ${frd}: the green verdict DROPPED ${dropped.length} cached contract(s) from its traceability (${dropped.join(', ')}) — refused (BL-0189: a cache never shrinks the oracle); re-asking with the full whole-FRD inventory`)
  if (st) st.inventoryCandidate = null
  return { ...result, green: false, traceabilityDeficient: true, missingClasses: dropped.map((id) => `cached contract ${id}`), failure: `whole-FRD traceability dropped cached contract(s): ${dropped.join(', ')}` }
}
// What a GREEN verdict leaves for the certifying landing to persist: its adjudicated traceability mapped to
// cache entries (an engine-refuted `discarded` claim is a contract that holds → pass). null when any entry
// cannot be cached — a partial cache is never written.
function inventoryCandidateOf(result, pinSha) {
  if (!GATE_INVENTORY_CACHE || !result || result.green !== true || !Array.isArray(result.traceability)) return null
  const contracts = result.traceability.map((e) => ({ contract: String((e && e.contract) || ''), contractClass: e && e.contractClass, status: e && e.status === 'discarded' ? 'pass' : e && e.status, tests: Array.isArray(e && e.tests) ? e.tests.filter((x) => typeof x === 'string') : [] }))
  if (!contracts.length || contracts.some((e) => !e.contract.trim() || !INVENTORY_STATUSES.includes(e.status) || !REQUIRED_TRACE_CLASSES.includes(e.contractClass))) return null
  return { pin: pinSha || null, contracts }
}
// The applyGate prompt's LAST step (only when a candidate exists): the single writer of the cache.
function inventoryPersistStep(frd) {
  const st = frdState.get(frd)
  const cand = st && st.inventoryCandidate
  if (!GATE_INVENTORY_CACHE || !cand) return ''
  const json = JSON.stringify(cand.contracts)
  const cmd = `${INVENTORY_CLI_COMMAND} write --project ${shellQuote(PROJECT_DIR)} --frd ${shellQuote(frd)} --pin ${shellQuote(cand.pin || 'HEAD')} --digest ${inventoryDigest(json)} --contracts ${shellQuote(json)}`
  return `
    **LAST STEP (BL-0189 — only after the commit above succeeded):** refresh this FRD's contract-inventory cache from the gate you just applied. Run the command in the fenced block below EXACTLY ONCE, byte-for-byte (it writes the gitignored run-state file .pandacorp/run/gate-evidence/${frd}/inventory.json — NEVER stage or commit it), and return its stdout VERBATIM as \`inventory_output\` together with \`done\`. It refuses (ok:false) rather than write a damaged cache, and its outcome never changes \`done\`.
    \`\`\`sh
    ${cmd}
    \`\`\``
}
// Read the landing's cache-write receipt. Never fatal: a failed write only means the next gate misses.
function recordInventoryWrite(frd, r) {
  const st = frdState.get(frd)
  if (!GATE_INVENTORY_CACHE || !st || !st.inventoryCandidate) return
  if (!r || r.done !== true) return   // the stamp itself did not land — keep the candidate for the re-apply (BL-0185a path)
  st.inventoryCandidate = null
  let j = null
  try { j = JSON.parse(String((r && r.inventory_output) || '').trim().split('\n').pop()) } catch { j = null }
  if (j && j.ok === true) log(`▣ ${frd}: contract inventory cached (${j.entries} contracts, gated at ${j.gatedAt}) — the next gate of this FRD reuses it while frd.md/blueprint.md stay unchanged`)
  else log(`⚠ ${frd}: the contract-inventory cache was NOT written (${(j && j.error) || 'no receipt'}) — the next gate runs the full whole-FRD inventory`)
}

// ── FRD gate (serial): ONE review + integration test over the whole feature ──
async function frdGateSerial(frd, reviewIds, attemptNo = 1, workFrom, evidencePack, directive = '') {
  const ev = evidenceOf(evidencePack)   // WP-06: null ⇒ this gate runs in EXPLORE mode (the historical contract)
  if (DRIFT_FINDER) await awaitDriftFinding(frd)   // BL-0203: the finder started beside the evidence collector; its report joins the prompt. Guarded, not just null-returning: with the flag off the gate's promise timing stays byte-identical (no extra await tick)
  agentSpawned += COST(P.judge)   // DR-073: the gate runs on the judge model — weight it honestly
  return await agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'gate' })}${TRACK('review_start', `,"frd":"${frd}"`)}${GATE_EVENT(frd, reviewIds.length, attemptNo)}${evidenceFallbackOf(frd, evidencePack)} FRD review + integration gate for ${frd}. Review the work orders built/changed THIS cycle: ${reviewIds.join(', ')} (all IN_REVIEW). This FRD MAY already have OTHER work orders VERIFIED from a previous run — treat those as a stable foundation: exercise them in integration, but do NOT re-review them and NEVER change their state.
 BUILD-JOURNAL (A1) — at WHICHEVER exit you take below (pass / reopen / blocked / fail), record this gate's verdict:${gateVerdictJournal(frd, reviewIds, attemptNo)}
${directive ? `\n  ${directive}\n` : ''}
  **THE GATE IS SPLIT (DR-072) — this is what makes the build converge instead of churning. Two categories with DIFFERENT consequences:**
  • **CORRECTION (BLOCKING — your hard gate):** correctness, **requirements/acceptance criteria met** (the EARS AC of FRD ${frd} — the required behavior/sections/elements EXIST and work), security, no genuine DUPLICATE of an existing shared primitive (DR-057), and **GROSS visual-structural mismatch** (the surface is not RECOGNIZABLY the designed thing — e.g. a flat text list where the mock shows a multi-panel/pixel-art layout; a section missing entirely). These BLOCK.
  • **VISUAL-FIDELITY NITS (ADVISORY — do NOT block, do NOT reopen):** sizing (15px vs 16px), spacing, exact color/shade, minor density/polish, "doesn't match the mock 100%". A pixel-judge is noisy; rejecting on nits is the #1 cause of the build never finishing. **NEVER reopen a WO for a nit.** Instead APPEND each nit to the punch-list \`.pandacorp/comms/visual-punch-list.md\` (one line: \`- [ ] ${frd} · <route> · <the gap, e.g. "heading is 15px, design tokens say 16px"> · <file:approx-line if known>\`). The dedicated end-of-build Visual QA pass + the owner sweep these directly — they do not gate VERIFIED. Scope yourself to CORRECTION + GROSS only; **flag, don't fix, don't reject** the rest (an over-broad reviewer reporting every gap HARMS convergence — research-backed).

  ${WHOLE_FRD_ORACLE}
  ${DRIFT_CLAIM_DIRECTIVE}${inventoryBlock(frd, reviewIds)}${gateContextScope(frd, reviewIds)}
${evidenceBlock(frd, ev)}${driftFinderBlock(frd, reviewIds)}
  1) Review the changed work orders for CORRECTION (the blocking lenses above) and write adversarial tests the implementers did not see (anchored in EARS + real bugs), exercising them TOGETHER with the rest of the feature (real integration, not isolated).
${gateFocusedStep(frd, ev)}

${GATE_PASS_RETURN}

  **If a SPECIFIC reviewed work order fails CORRECTION (a real bug / missing requirement / gross-structural miss):** check that WO's frontmatter \`reopen_count\` (default 0). **DR-072 NON-PROGRESS STOP — if it is already ≥ ${MAX_REOPENS}, do NOT reopen again** (the same fault is not resolving autonomously): you are REVIEW-ONLY — do NOT stamp BLOCKED, do NOT write decisions.md, do NOT commit; just${TRACK('review_end', `,"frd":"${frd}","verdict":"blocked"`)}${GATE_VERDICT(frd, 'blocked', `,"blocked_reason":"needs-owner"`)} return { green: false, reopen: [], blocked_reason: 'needs-owner', failure: 'reopened ${MAX_REOPENS}x, gate not satisfiable autonomously' } — the engine persists the BLOCKED state + the decision record on the MAIN tree. **Otherwise — DR-073 PATCH-FIRST: do NOT revert, do NOT change the WO's \`implementation_status\` (leave it IN_REVIEW), do NOT touch \`reopen_count\`, do NOT \`git checkout\`/\`git rm\` anything, do NOT commit a revert.** The build is ~correct except a bounded fault — the engine will attempt an in-place PATCH on the existing build BEFORE any revert. **FIX-FORWARD MANDATE (DR-073, calibrated 2026-07-01): a BOUNDED fault you can name at file:line with an estimated fix of ≤ ~30 lines (a hardcoded string, a missing null-guard, a clipped breakpoint, a missing escape) MUST take this findings exit — never a bare failure, never blocked_reason 'error' (80% of real first-gate fails had ≤6-min fixes; routing them to revert cost ~1.5h of a run's 2.2h rework).** Your job here is to REPORT the fixable fault(s) precisely: for EACH failing reviewed WO, write the specific finding (with file:line) and a RED-PROVEN failing test (a test you wrote that fails WITHOUT the fix and will pass WITH it — give its path / describe-it / a snippet) and the file(s) the fix should touch.${TRACK('review_end', `,"frd":"${frd}","verdict":"reopen"`)}${GATE_VERDICT(frd, 'reopen', `,"reopened":%s`, ` "<the count of work orders you are reopening — an integer>"`)} Return { green: false, reopen: [those ids], findings: [{ wo, finding, failingTest, files }], failure }. The engine patches those findings in place; only if the patch can't green it whole-project does it then revert + reopen for a clean rebuild (DR-070, the fallback).
  **DR-065 — missing foundation primitive:** if a surface looks FLAT / structurally wrong because a SHARED design-system primitive it needs is NOT built (it isn't in src/components nor docs/design/components.md — e.g. the mock shows a Room/AgentSprite/StoneBridge the foundation never built), do NOT block and do NOT just reopen — return { green: false, missingFoundation: [the primitive names], failure }. The engine auto-repairs the foundation and rebuilds the surfaces against it.
  If it's broken and you can't pinpoint specific WOs, first classify \`blocked_reason\` ('needs-owner' if a human must act, 'external' if it's a transient outside failure, else 'error'), then — **unless** that reason is 'needs-owner' AND a \`fail\` entry of your traceability carries \`claim: "preexisting"\` (BL-0178/BL-0185: then emit NOTHING here — the engine adjudicates the claim first and emits this gate's ONE terminal outcome itself, so a block it lifts is never reported as both blocked and passed) —${emitGateOutcome(frd, 'blocked', `,"blocked_reason":"%s"`, ` "<the SAME blocked_reason value you are about to return>"`)} return { green: false, failure, blocked_reason }. **\`failure\` MUST open with ONE sentence naming what is RED and what the owner must do — any context or praise for what passed comes AFTER that sentence, never before it** (F1/BL-0174: the engine keeps only the first ~400 chars of \`failure\`; leading with praise for passing work silently drops the real blocking cause).${NOTIFY('FRD ' + frd + ' no paso la revision (correccion) — necesita tu atencion')}`,
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
  // BL-0203: the whole-FRD drift finder (started beside the evidence collector) is awaited ALONGSIDE the four lenses —
  // it is the fifth, diff-free lens; its report goes to the closer only (the lenses stay independent of it).
  const lensSweep = () => parallel(FINDER_LENSES.map((L) => () =>
    agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'find' })}FRD split-gate FIND stage — the ${L.key} lens for ${frd} (proposal 31 T1.2). You are ONE of four parallel read-only finders. Review the work orders built/changed THIS cycle: ${reviewIds.join(', ')} (all IN_REVIEW), exercising them together with the rest of the feature. This FRD MAY have OTHER work orders VERIFIED from a previous run — treat those as a stable foundation; do NOT re-review or change them.
    Your lens: ${L.lens}${evidenceBlock(frd, ev)}${gateContextScope(frd, reviewIds)}
    **READ-ONLY — findings ONLY:** do NOT write or modify tests, do NOT fix anything, do NOT run \`verify.sh\`, do NOT change any file or frontmatter. Just report. For each defect return { file (with a line if you can), claim (one sentence), severity ('correction' for a blocking defect in your lens; 'nit' for advisory polish), evidence (the concrete code/behavior you observed, so a skeptic can try to refute it) }. If your lens finds nothing, return { findings: [] }.`,
      { label: `find:${L.key}:${frd}`, phase: 'Review', model: 'sonnet', agentType: 'pandacorp:reviewer', schema: FINDER_SCHEMA, workFrom }),
  ))
  const finderResults = DRIFT_FINDER ? (await Promise.all([lensSweep(), awaitDriftFinding(frd)]))[0] : await lensSweep()   // flag off: the pre-BL-0203 await shape, byte-identical timing
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
  ${DRIFT_CLAIM_DIRECTIVE}${inventoryBlock(frd, reviewIds)}${gateContextScope(frd, reviewIds)}
${evidenceBlock(frd, ev)}${driftFinderBlock(frd, reviewIds)}
  1) Independently CONFIRM the surviving corrections and write adversarial tests the implementers did not see (anchored in EARS + real bugs), exercising the work orders TOGETHER with the rest of the feature (real integration, not isolated).
${gateFocusedStep(frd, ev)}

${GATE_PASS_RETURN}

  **If a SPECIFIC reviewed work order fails CORRECTION (a confirmed real bug / missing requirement / gross-structural miss):** check that WO's frontmatter \`reopen_count\` (default 0). **DR-072 NON-PROGRESS STOP — if it is already ≥ ${MAX_REOPENS}, do NOT reopen again:** you are REVIEW-ONLY — do NOT stamp BLOCKED, do NOT write decisions.md, do NOT commit; just${TRACK('review_end', `,"frd":"${frd}","verdict":"blocked"`)}${GATE_VERDICT(frd, 'blocked', `,"blocked_reason":"needs-owner"`)} return { green: false, reopen: [], blocked_reason: 'needs-owner', failure: 'reopened ${MAX_REOPENS}x, gate not satisfiable autonomously' } — the engine persists the BLOCKED state + the decision record on the MAIN tree. **Otherwise — DR-073 PATCH-FIRST: do NOT revert, do NOT change the WO's \`implementation_status\` (leave it IN_REVIEW), do NOT touch \`reopen_count\`, do NOT \`git checkout\`/\`git rm\` anything, do NOT commit a revert.** The build is ~correct except a bounded fault — the engine will attempt an in-place PATCH BEFORE any revert. **FIX-FORWARD MANDATE (DR-073): a BOUNDED fault you can name at file:line with a fix of ≤ ~30 lines MUST take this findings exit.** For EACH failing reviewed WO, write the specific finding (with file:line) and a RED-PROVEN failing test (fails WITHOUT the fix, passes WITH it — give its path / describe-it / a snippet) and the file(s) the fix should touch.${TRACK('review_end', `,"frd":"${frd}","verdict":"reopen"`)}${GATE_VERDICT(frd, 'reopen', `,"reopened":%s`, ` "<the count of work orders you are reopening — an integer>"`)} Return { green: false, reopen: [those ids], findings: [{ wo, finding, failingTest, files }], failure }.
  **DR-065 — missing foundation primitive:** if a surface looks FLAT / structurally wrong because a SHARED design-system primitive it needs is NOT built, do NOT block and do NOT just reopen — return { green: false, missingFoundation: [the primitive names], failure }. The engine auto-repairs the foundation and rebuilds the surfaces against it.
  If it's broken and you can't pinpoint specific WOs, first classify \`blocked_reason\` ('needs-owner' if a human must act, 'external' if it's a transient outside failure, else 'error'), then — **unless** that reason is 'needs-owner' AND a \`fail\` entry of your traceability carries \`claim: "preexisting"\` (BL-0178/BL-0185: then emit NOTHING here — the engine adjudicates the claim first and emits this gate's ONE terminal outcome itself, so a block it lifts is never reported as both blocked and passed) —${emitGateOutcome(frd, 'blocked', `,"blocked_reason":"%s"`, ` "<the SAME blocked_reason value you are about to return>"`)} return { green: false, failure, blocked_reason }. **\`failure\` MUST open with ONE sentence naming what is RED and what the owner must do — any context or praise for what passed comes AFTER that sentence, never before it** (F1/BL-0174: the engine keeps only the first ~400 chars of \`failure\`; leading with praise for passing work silently drops the real blocking cause).${NOTIFY('FRD ' + frd + ' no paso la revision (correccion) — necesita tu atencion')}`,
    { label: `gate:${frd}`, phase: 'Review', model: P.judge, effort: 'high', agentType: 'pandacorp:reviewer', schema: FRD_GATE_SCHEMA, workFrom })   // C1d: the split closer drops xhigh→high — the finders already hunted; it adjudicates the survivors (the SERIAL gate keeps xhigh)
}

// ── C2 gate worktree lifecycle (MECH, MAIN-tree git op) ──────────────────────────────────────────
// Lazily creates the persistent detached worktree at GATE_WORKTREE, bootstrapped via the SAME
// .pandacorp/worktree-bootstrap.sh every other fresh worktree gets (BL-0149 — a bare ad-hoc `pnpm
// install` left the WP-06 evidence collector running verify.sh against a worktree with no
// node_modules, so its biome/tsc/knip/madge sub-gates failed on environment noise, not real
// findings, and the reviewer had to redo the expensive work `digested` exists to avoid). One label
// 'gate-worktree'. Returns true iff the worktree is ready at `sha`. First hard failure →
// LEGACY_SLOT.state 'failed' → the whole run falls back to the legacy synchronous gate path.
// BL-0150: memoized by `sha` on a SHARED in-flight promise — `launchEvidence`, `launchGate` and the
// concurrent-gate probe each call this independently (no shared mutex between them), and canary B
// caught two concurrent `gate-worktree` agents (different keys, 5ms apart) spawned because both
// callers raced the SAME `state !== 'ready'` check before either's spawn had resolved. A
// second call for the SAME sha now reuses the FIRST call's pending promise instead of spawning its
// own agent; a call for a DIFFERENT sha (not expected on the current call sites, all sharing one
// FRD's pinSha) still proceeds independently. Idempotent: a no-op (no spawn) once frozen at `sha`.
// BL-0183: the no-spawn fast path is taken ONLY when the tree is ALSO known clean (slot.clean — set
// by this probe's own clean check or by the previous gate's releaseGateWorktree postcondition). Before,
// two FRDs pinned at the SAME sha skipped the probe — and with it the clean check — so the second gate ran
// in a tree still holding the first reviewer's untracked tests, which vitest `--changed` then executed.
// Any acquisition over a tree not proven clean re-probes, and a dirty tree fails LOUD with its paths.
// D1: `slot` is the worktree being acquired — LEGACY_SLOT (the single C2 worktree, flag off: prompt, label
// and logs byte-identical to the pre-D1 engine) or one pool slot under args.parallelGates, whose state,
// in-flight memo (BL-0150) and clean proof (BL-0183) are its OWN. A failed pool slot only leaves the pool;
// the run falls to the legacy synchronous path only when EVERY slot has failed (launchParallelGates).
const gateWorktreePrompt = (wt, sha, bootstrap, onFailure) =>
  `C2 gate worktree — prepare a FROZEN detached checkout at ${wt} pinned to commit ${sha} (MAIN-tree git op; this is the only main-tree git command you run here). Do EXACTLY:
      1) If the directory ${wt} does NOT exist: first confirm \`git -C ${PROJECT_DIR} worktree list --porcelain\` has NO worktree entry for that exact path. Then run \`git -C ${PROJECT_DIR} worktree add --detach ${wt} ${sha}\` and, from the project root you started in, run exactly \`(${gateProjectCd(wt)} && ${bootstrap})\` — the cd enters the PROJECT directory inside the worktree (the worktree holds the WHOLE repo: a nested project's \`.pandacorp/\` is under its prefix, not at the worktree root) (BL-0149 — it reconstitutes node_modules and everything else a fresh worktree needs; it is idempotent, safe to re-run, and skips reinstalling when the lockfile hasn't changed). Return { ok: true, created: true }.
      2) If the directory ALREADY exists: reuse it ONLY if \`git -C ${PROJECT_DIR} worktree list --porcelain\` records that exact canonical path AND \`git -C ${wt} status --porcelain=v1 --untracked-files=all\` prints nothing. If either check fails, DO NOT mutate anything; return { ok: false, failure: "gate worktree is dirty, orphaned, unregistered, or ambiguous; evidence preserved", dirty: [every line that status command printed, verbatim — the engine names them in its log (BL-0183); [] when the failure was not dirt] }.
      3) For a registered CLEAN reuse, \`git -C ${wt} checkout --detach ${sha}\`, then re-run exactly \`(${gateProjectCd(wt)} && ${bootstrap})\` from the project root (BL-0149 — same idempotent script; it is cheap when pnpm-lock.yaml is unchanged, so you do NOT need to diff the lockfile yourself first). Return { ok: true, created: false }.
      If ANY step fails (stuck lock, unreachable sha, linked path conflict, dirty/orphan evidence, worktree-bootstrap.sh exits non-zero), do NOT retry and DO NOT delete, reset, clean, prune, recreate, or force-remove the path: return { ok: false, failure: "<what failed>" }. ${onFailure} NEVER modify preserved crash evidence.`
const GATE_WORKTREE_SCHEMA = { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, created: { type: 'boolean' }, failure: { type: 'string' }, dirty: { type: 'array', items: { type: 'string' } } } }
async function ensureGateWorktree(sha, slot = LEGACY_SLOT) {
  if (slot.state === 'failed') return false
  if (slot.state === 'ready' && slot.lastSha === sha && slot.clean) return true   // frozen at this sha AND proven clean — no spawn
  if (slot.inFlight && slot.inFlightSha === sha) return slot.inFlight   // BL-0150: reuse the SAME pending spawn, never a second one
  const pooled = slot !== LEGACY_SLOT
  const attempt = (async () => {
    agentSpawned++
    let r
    try {
    r = await agent(
      pooled
        ? gateWorktreePrompt(slot.path, sha, `PANDACORP_E2E_PORT=${slot.port} bash .pandacorp/worktree-bootstrap.sh`, `The engine drops THIS gate slot (${slot.id}) from the parallel pool for the rest of the run (D1); the other slots keep gating.`)
        : gateWorktreePrompt(GATE_WORKTREE, sha, 'bash .pandacorp/worktree-bootstrap.sh', 'The engine falls back to synchronous gates on the quiet main tree for the rest of the run.'),
      { label: pooled ? `gate-worktree:${slot.id}` : 'gate-worktree', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: GATE_WORKTREE_SCHEMA })
    } catch (e) {
      // D1: a probe that died mid-way may have left a half-done checkout — never trust the old clean proof
      // (the next acquisition re-probes). The LEGACY_SLOT keeps its pre-D1 behaviour (flag-off parity).
      if (pooled) { slot.clean = false; slot.lastSha = null }
      throw e
    }
    if (r && r.ok === true) { slot.state = 'ready'; slot.lastSha = sha; slot.clean = true; return true }
    slot.state = 'failed'; slot.lastSha = null; slot.clean = false
    const dirty = (r && Array.isArray(r.dirty)) ? r.dirty.filter(Boolean) : []
    if (pooled) slot.failedOnDirt = dirty.length > 0   // D1: dirt is slot-specific (another slot may be clean); any other failure is not
    if (pooled) {
      if (dirty.length) log(`⊘ D1 (BL-0183): REFUSING to gate over a DIRTY gate slot ${slot.id} (${slot.path}) — uncommitted path(s) a gate would silently execute (vitest --changed runs untracked files): ${dirty.join(' | ')} — evidence preserved, inspect/salvage by hand`)
      log(`⚠ D1: gate slot ${slot.id} (${slot.path}) could not be prepared (${(r && r.failure) || 'no verdict'}) — dropped from the parallel pool (${gatePool.filter((x) => x.state !== 'failed').length}/${gatePool.length} slot(s) left)`)
      return false
    }
    if (dirty.length) log(`⊘ C2 (BL-0183): REFUSING to gate over a DIRTY gate worktree ${GATE_WORKTREE} — uncommitted path(s) a gate would silently execute (vitest --changed runs untracked files): ${dirty.join(' | ')} — evidence preserved, inspect/salvage by hand`)
    log(`⚠ C2: gate worktree could not be prepared (${(r && r.failure) || 'no verdict'}) — falling back to the LEGACY synchronous gate path for the whole run`)
    return false
  })()
  slot.inFlight = attempt
  slot.inFlightSha = sha
  try { return await attempt }
  finally { if (slot.inFlight === attempt) { slot.inFlight = null; slot.inFlightSha = null } }
}

// ── C2 gate-worktree RELEASE (MECH) — the post-condition of EVERY gate (BL-0182/0183/0184) ─────────
// The review-only gate writes its adversarial tests (and snapshots, scratch) into GATE_WORKTREE whatever
// its verdict: a PASS left them there because applyGate only COPIED them out, a reject stranded them (the
// patch ladder runs on main), a block left them until persistGateBlock's salvage — which runs on the
// main loop, AFTER the next chained gate's ensureGateWorktree had already found the tree dirty (canary D2
// went legacy exactly so). So the release runs INSIDE the gate's own gateWorktreeChain link, before the
// chain lets the next gate in: salvage every `git status` path (+ the gitignored gate-report.json) to
// gateEvidenceDir(frd), clean EXACTLY those paths, and re-list. The chain's next acquisition then sees a
// tree proven clean (slot.clean) — or, when the release could not prove it, re-probes and fails
// loud. Returns { dir, tests:[{path, sha256}] } — the salvaged TEST files, repo-root-relative, with the
// sha256 of the salvaged copy (the DR-080 fingerprint the reject path holds the patch to).
const GATE_RELEASE_SCHEMA = {
  type: 'object', required: ['salvaged', 'remaining'],
  properties: {
    salvaged: { type: 'array', items: { type: 'object', required: ['path', 'status'], properties: { path: { type: 'string' }, status: { type: 'string', enum: ['untracked', 'modified', 'deleted'] }, sha256: { type: ['string', 'null'] } } } },
    remaining: { type: 'array', items: { type: 'string' }, description: 'every line the post-clean `git status --porcelain=v1 --untracked-files=all` printed — [] iff the worktree is clean' },
    failure: { type: 'string' },
  },
}
async function releaseGateWorktree(frd, gate, slot = LEGACY_SLOT) {
  const wt = slot.path   // D1: the slot this gate occupied (LEGACY_SLOT.path === GATE_WORKTREE, flag off)
  const declared = (gate && Array.isArray(gate.testFiles)) ? gate.testFiles.filter(Boolean) : []
  const dir = gateEvidenceDir(frd)
  agentSpawned++
  let r = null
  try {
    r = await agent(
      `C2 gate-worktree RELEASE for ${frd} (BL-0182). The FRD gate for ${frd} just finished in the gate worktree ${wt}; whatever it left there must be SALVAGED to the durable evidence dir ${dir} and then CLEANED, so the next gate starts on a clean tree. You run commands only — judge nothing, edit no source, run no git command that writes the MAIN tree. Do EXACTLY, in order:
      1) LIST: \`git -C ${wt} status --porcelain=v1 --untracked-files=all\`. \`--untracked-files=all\` is REQUIRED — plain \`--porcelain\` collapses a new directory to one \`?? dir/\` line and its files would never be salvaged. Each line is \`XY <path>\`; the path is relative to the worktree ROOT (git prints repo-root paths even for a nested project) — keep it EXACTLY as printed (unquote it if git double-quoted it).
      2) SALVAGE each listed path: \`??\` → untracked; a \`D\` in either status column → deleted; anything else → modified. Untracked/modified: \`mkdir -p\` the parent and \`cp ${wt}/<path> ${dir}/<path>\` (overwrite), then \`shasum -a 256 ${dir}/<path>\` and record { path, status, sha256 }. Deleted: record { path, status: "deleted", sha256: null } (nothing to copy).
      3) REPORT: the gate's report is gitignored, so step 1 does not list it. Let P = \`git -C ${PROJECT_DIR} rev-parse --show-prefix\` (empty for a flat project, e.g. \`mission-control/\` for a nested one). If ${wt}/<P>.pandacorp/run/gate-report.json exists, copy it to ${dir}/gate-report.json (overwrite).
      4) CLEAN exactly the listed paths, one at a time, and ONLY a path whose step-2 copy SUCCEEDED (or a deleted one): untracked → \`git -C ${wt} --literal-pathspecs clean -f -- <path>\`; modified or deleted → \`git -C ${wt} --literal-pathspecs checkout -- <path>\` (\`--literal-pathspecs\`: a \`[slug]\` segment is a glob class otherwise and would clean sibling files). NEVER a blanket \`clean -fd\`/\`reset --hard\`/\`checkout .\`, and never remove, prune or recreate the worktree (BL-0067).
      5) POSTCONDITION: re-run the step-1 command and return every line it prints as \`remaining\` ([] when clean).
      The gate declared these test files (JSON): ${JSON.stringify(declared)} — informational only; salvage what git lists, not this list.
      Return { salvaged: [...], remaining: [...] }. If a command fails, stop there and return what you have plus \`failure: "<what failed>"\` — never clean a path you could not copy.`,
      { label: `gate-release:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: GATE_RELEASE_SCHEMA })
  } catch (e) { log(`⚠ C2 (BL-0182): the gate-worktree release for ${frd} threw (${(e && e.message) || e})`) }
  const salvaged = (r && Array.isArray(r.salvaged)) ? r.salvaged.filter((x) => x && typeof x.path === 'string' && x.path) : []
  const remaining = (r && Array.isArray(r.remaining)) ? r.remaining.filter(Boolean) : null
  if (remaining && remaining.length === 0 && !(r && r.failure)) slot.clean = true
  else {
    slot.clean = false   // the next acquisition re-probes instead of taking the no-spawn fast path (BL-0183)
    log(`⚠ C2 (BL-0182): the gate worktree is NOT proven clean after ${frd}'s gate (${(r && r.failure) || (remaining ? 'paths remain' : 'no release verdict')})${remaining && remaining.length ? `: ${remaining.join(' | ')}` : ''} — the next gate re-probes it and falls back to the legacy path rather than gate over it`)
  }
  const tests = salvaged
    .filter((x) => x.status !== 'deleted' && typeof x.sha256 === 'string' && x.sha256 && REVIEWER_TEST_PATH.test(x.path))
    .map((x) => ({ path: x.path, sha256: x.sha256 }))
  const other = salvaged.filter((x) => !tests.some((t) => t.path === x.path))
  if (other.length) log(`◦ ${frd}: the gate also left non-test path(s) in the worktree — kept as evidence in ${dir} only, never ported: ${other.map((x) => `${x.path} (${x.status})`).join(', ')}`)
  const undeclared = declared.filter((d) => !tests.some((t) => t.path === d || t.path.endsWith(`/${d}`)))
  if (undeclared.length) log(`⚠ ${frd}: the gate declared test file(s) the worktree did not contain — nothing to port for them: ${undeclared.join(', ')}`)
  return { dir, tests }
}

// ── BL-0184: the reject path holds the patch to the reviewer's OWN test files (DR-080) ─────────────
// A C2 reject used to leave the reviewer's RED-proven tests in the worktree while attemptPatch and
// verifyPatched ran on main — the patcher was told to satisfy a test it never had (free to re-type it)
// and the certifier never ran it. Now: portReviewerTests copies the salvaged files onto main at the SAME
// repo-root-relative path before the patch (the path the tests were written for, so their relative
// imports and the runner's include globs resolve exactly as in the gate — running them from the evidence
// dir would break both), checks the copies' sha256, and records them here for the convergence of THIS
// verdict only (drainConverge clears it; a revert starts a fresh gate on main that owns its own tests).
const reviewerTestsByFrd = new Map()   // frd -> { dir, tests:[{path, sha256}], rebless:boolean }
const REVIEWER_TEST_HASH_SCHEMA = { type: 'object', properties: { hashes: { type: 'array', items: { type: 'object', required: ['path'], properties: { path: { type: 'string' }, sha256: { type: ['string', 'null'] } } } }, failure: { type: 'string' } } }
// Pure: every expected file must be observed with the SAME sha256. Returns the problems (empty = intact).
function compareReviewerHashes(expected, observed) {
  const seen = new Map((Array.isArray(observed) ? observed : []).filter((o) => o && typeof o.path === 'string').map((o) => [o.path, o.sha256]))
  const problems = []
  for (const e of expected || []) {
    const got = seen.get(e.path)
    if (!got) problems.push(`${e.path}: missing`)
    else if (got !== e.sha256) problems.push(`${e.path}: sha256 ${got} ≠ reviewer's ${e.sha256}`)
  }
  return problems
}
const reviewerTestPaths = (rt) => rt.tests.map((t) => t.path).join(', ')
async function portReviewerTests(frd, gate) {
  const ev = gate && gate.reviewerEvidence
  if (!gate || !Array.isArray(gate.reopen) || !gate.reopen.length || !ev || !ev.tests.length) return null   // nothing stranded → the ladder runs exactly as before
  agentSpawned++
  const r = await agent(
    `BL-0184 — PORT the reviewer's adversarial test files for ${frd} onto the MAIN tree BEFORE the patch (DR-080: the patch is judged by the reviewer's OWN files, never a re-typed copy). The review-only gate rejected in the gate worktree; the engine salvaged its test files into ${ev.dir}. ${REPO_ROOT_PATHS_NOTE} (1) run this port command VERBATIM, as ONE Bash call: \`${repoRootPortCommand(ev.dir, ev.tests.map((t) => t.path))}\`. (2) run this hash command VERBATIM, as ONE Bash call: \`${repoRootHashCommand(ev.tests.map((t) => t.path))}\` — and record { path, sha256 } for EACH entry of EXPECTED from its output (sha256 null for a MISSING line, or when step 1 failed). Stage nothing, commit nothing, touch nothing else. EXPECTED (JSON): ${JSON.stringify(ev.tests)}. Return { hashes: [{ path, sha256 }] }.`,
    { label: `port-reviewer-tests:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: REVIEWER_TEST_HASH_SCHEMA })
  const problems = compareReviewerHashes(ev.tests, r && r.hashes)
  if (problems.length) {
    log(`⊘ ${frd} (BL-0184): could not port the reviewer's test files onto main (${problems.join('; ')}) — a patch would run without the tests that judge it (DR-080); re-gating ${frd} on the MAIN tree instead`)
    return false
  }
  reviewerTestsByFrd.set(frd, { dir: ev.dir, tests: ev.tests.map((t) => ({ path: t.path, sha256: t.sha256 })), rebless: false })
  log(`▹ ${frd}: the reviewer's ${ev.tests.length} RED test file(s) ported onto main for the patch ladder, sha256-pinned (BL-0184): ${ev.tests.map((t) => t.path).join(', ')}`)
  return true
}
// The independent gate-test repair (BL-0001/BL-0051) is the reviewer — the tests' OWNER — so its edits are
// legitimate: the next integrity check re-pins the hashes instead of calling them a breach.
function markReviewerTestsReblessed(frd) { const rt = reviewerTestsByFrd.get(frd); if (rt) rt.rebless = true }
// Run BEFORE the independent verifier may stamp: returns null when intact (or nothing is pinned), else a
// red REPAIR_SCHEMA verdict. The engine compares — never the agent — and the originals are restored.
async function checkReviewerTestIntegrity(frd) {
  const rt = reviewerTestsByFrd.get(frd)
  if (!rt || !rt.tests.length) return null
  agentSpawned++
  const r = await agent(
    `BL-0184 — DR-080 integrity check of the reviewer's test files for ${frd}, BEFORE the independent verifier runs. ${REPO_ROOT_PATHS_NOTE} Run this hash command VERBATIM, as ONE Bash call: \`${repoRootHashCommand(rt.tests.map((t) => t.path))}\` — and record { path, sha256 } for EACH entry of EXPECTED from its output (sha256 null for a MISSING line).${rt.rebless ? ' Record only — change nothing.' : ` THEN, for every file whose hash differs from EXPECTED or that is missing, RESTORE the reviewer's original by running ITS OWN restore command VERBATIM (and no other): ${rt.tests.map((t) => `${t.path} → \`${repoRootPortCommand(rt.dir, [t.path])}\``).join('; ')} — record the hash you OBSERVED before restoring, never the restored one.`} Edit nothing else, stage nothing, commit nothing. EXPECTED (JSON): ${JSON.stringify(rt.tests)}. Return { hashes: [{ path, sha256 }] }.`,
    { label: `reviewer-test-hash:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: REVIEWER_TEST_HASH_SCHEMA })
  if (rt.rebless) {
    const observed = (r && Array.isArray(r.hashes)) ? r.hashes : []
    const missing = rt.tests.filter((t) => !observed.some((o) => o && o.path === t.path && typeof o.sha256 === 'string' && o.sha256))
    if (missing.length) {
      log(`⊘ ${frd} (BL-0184): the gate-test repair left reviewer test file(s) missing (${missing.map((t) => t.path).join(', ')}) — coverage is never deleted; verification refused`)
      return { green: false, failure: `DR-080: reviewer test file(s) missing after the gate-test repair: ${missing.map((t) => t.path).join(', ')}` }
    }
    rt.tests = rt.tests.map((t) => ({ path: t.path, sha256: observed.find((o) => o.path === t.path).sha256 }))
    rt.rebless = false
    return null
  }
  const problems = compareReviewerHashes(rt.tests, r && r.hashes)
  if (!problems.length) return null
  log(`⊘ ${frd} (BL-0184): DR-080 BREACH — the reviewer's test file(s) changed or vanished after the gate (${problems.join('; ')}); originals restored, the patch is NOT certified`)
  return { green: false, failure: `DR-080: the reviewer's test file(s) were modified or removed after the gate (${problems.join('; ')}) — a patch may not edit the tests that judge it` }
}
const reviewerTestsPatchDirective = (frd) => {
  const rt = reviewerTestsByFrd.get(frd)
  if (!rt || !rt.tests.length) return ''
  return `\n  **THE GATE'S OWN RED TESTS ARE ON THIS TREE (BL-0184, DR-080):** ${reviewerTestPaths(rt)} (REPO-ROOT-relative — run them by absolute path, \`pnpm vitest run "$(git rev-parse --show-toplevel)/<path>"\`). They are the REVIEWER's: you may NOT edit, move, rename, skip, delete or re-type them — make them PASS with production code. The engine pinned their sha256; the independent verification FAILS the patch on any difference. If you believe one is defective, take the gate-test-defective exit below and leave the file untouched.`
}
const reviewerTestsVerifyDirective = (frd) => {
  const rt = reviewerTestsByFrd.get(frd)
  if (!rt || !rt.tests.length) return ''
  return `\n  **THE GATE'S OWN ADVERSARIAL TESTS (BL-0184, DR-080) — run them EXPLICITLY, by path:** the review-only gate rejected on these reviewer-authored files, ported onto this tree and sha256-checked by the engine just before you: ${reviewerTestPaths(rt)}. They are REPO-ROOT-relative: run \`pnpm vitest run "$(git rev-parse --show-toplevel)/<path>" …\` for each (a Playwright spec: \`pnpm playwright test\` with the same absolute path), IN ADDITION to the FRD test files above — never trust \`--changed\`/affected selection to have picked them up. Every one must PASS; a missing one is RED. Do NOT edit them, and do NOT stage them — you write nothing (BL-0191); the certify step commits them.`
}
// BL-0191: the certify step (not the verifier) commits the reviewer's ported test files with the stamp — staged by the
// literal command of the commit protocol (E2 finding 3); this directive only names them.
const reviewerTestsStageDirective = (frd) => {
  const rt = reviewerTestsByFrd.get(frd)
  if (!rt || !rt.tests.length) return ''
  return ` **THE GATE'S OWN ADVERSARIAL TESTS (BL-0184, DR-080):** the verifier ran these reviewer-authored files (ported onto this tree and sha256-checked by the engine): ${reviewerTestPaths(rt)}. They go into the snapshot commit (A) through the commit protocol's staging command below. Do NOT edit them.`
}
/**
 * E2 findings 3, 4 and 7 — the END of every certifying landing (applyGate, certifyPatched). Canary E2's apply-gate
 * staged the WO file but not the frd.md/blueprint.md rollups sync-rollups had rewritten (left dirty after the run),
 * and — following the prompt's own order, where the last-green ordering came BEFORE the timeline/journal appends —
 * committed those appends AFTER the pointer commit, leaving HEAD two bookkeeping commits past last_green_sha. So the
 * protocol is literal, comes LAST, and nothing is committed after the pointer. `testPaths` = the reviewer's
 * repo-root-relative test files to stage into (A) ([] = none to stage by this step).
 * @param {readonly string[]} testPaths
 * @returns {string} the prompt fragment
 */
const landingCommitProtocol = (testPaths) => ` **COMMIT PROTOCOL — do this LAST, after every edit and append above, and make NO commit after it:** stage snapshot (A) with exactly this command: \`git -C ${shellQuote(PROJECT_DIR)} add -u -- docs/frds .pandacorp\`${testPaths.length ? `, then stage the reviewer's test files with exactly this command: \`${repoRootStageCommand(testPaths)}\`` : ''} (if \`.pandacorp/track.jsonl\` or \`.pandacorp/build-journal.jsonl\` exists but git does not track it yet, \`git -C ${shellQuote(PROJECT_DIR)} add -f -- <that file>\`). Commit (A), then run \`git -C ${shellQuote(PROJECT_DIR)} status --porcelain -- docs/frds\`: it must print NOTHING — a line there is a VERIFIED flip, a rollup or a drift replica left out of the snapshot; stage and commit it before (B). Then make the pointer commit (B) exactly as the ordering below says. Every timeline/journal line belongs in (A): a bookkeeping commit after (B) leaves HEAD past last_green_sha.${testPaths.length ? ` ${REPO_ROOT_PATHS_NOTE}` : ''}`

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
  // BL-0182: on the concurrent path `sourceDir` is the gate's EVIDENCE dir (releaseGateWorktree salvaged
  // the worktree there and cleaned it before the next gate could start), holding repo-root-relative paths.
  const fromEvidence = Boolean(sourceDir && sourceDir.startsWith(GATE_EVIDENCE_ROOT))
  const port = fromEvidence && files.length
    ? ` FIRST port the reviewer's adversarial test files — salvaged out of the gate worktree ${gateWorktreePathOf(frd)} into ${sourceDir} by the release step — onto the main tree: each \`${sourceDir}/<path>\` goes to \`<repo root>/<path>\` (the repo root is \`git -C ${PROJECT_DIR} rev-parse --show-toplevel\`) for ${files.join(', ')} — run this port command VERBATIM, as ONE Bash call: \`${repoRootPortCommand(sourceDir, files)}\`. ${REPO_ROOT_PATHS_NOTE}`
    : sourceDir && files.length
      ? ` FIRST port the reviewer's adversarial test files from the gate worktree onto the main tree — for EACH of these repo-relative paths copy \`${sourceDir}/<path>\` → \`<path>\` (mkdir -p the parent; overwrite): ${files.join(', ')}.`
      : (files.length ? ` The reviewer's adversarial test files are already on the main tree (${files.join(', ')}) — just make sure they are staged in the commit below.` : '')
  // BL-0180: the gate that PASSED may have run inside a DIFFERENT checkout than this applier (the C2
  // concurrent path reviews in GATE_WORKTREE while this MECH step writes on main — see the comment atop
  // this function). Its gate-report.json therefore lives at sourceDir, not at the applier's own cwd; a
  // bare relative path here silently reads main's OWN (unrelated) report instead, defeating the cage.
  // BL-0182: the release step copies that report into the evidence dir, where no LATER chained gate can
  // overwrite it before this (main-loop-paced) apply reads it.
  const gateReportPath = fromEvidence ? `${sourceDir}/gate-report.json` : sourceDir ? `${sourceDir}/.pandacorp/run/gate-report.json` : '.pandacorp/run/gate-report.json'
  const applyJournal = JOURNAL(
    `"wo":"%s","frd":"${frd}","attempt":0,"reopen_count":0,"rung":"gate","role":"verifier","kind":"resolution","classification":"","seam":null,"findingKey":"","tried":"gate passed in the pinned worktree; applied on main","verdict":"green","why":"%s","confidence":"high"`,
    ` "<the primary work order this gate verified, else ${(reviewIds || [])[0] || frd}>" "<one line: what the gate confirmed>"`)
  const link = commitChain.then(() => agent(
    `You are the SOLE main-tree git writer at this instant (serialized — no other commit runs concurrently, so there is NO index.lock race). Apply the PASSED FRD gate for ${frd} onto the MAIN tree (the review already happened; you only PERSIST it — do NOT re-review, do NOT re-run the suite).${port}
    **BEFORE you stamp anything (WP-08 cage):** read \`${gateReportPath}\` — the report the gate you are applying left behind (in the gate worktree, NOT your own main-tree copy of that filename, when this apply followed a concurrent gate) — and return its \`scope\` field VERBATIM as \`report_scope\`. If it reads \`partial\`, that gate ran \`--only\`/\`--files\` and certified NOTHING: stamp nothing, advance nothing, commit nothing, and return { done: false, report_scope: 'partial' }.
    Set the reviewed work orders (${(reviewIds || []).join(', ')}) frontmatter \`implementation_status: VERIFIED\` and **reset their \`reopen_count: 0\`** (DR-072 C2), then ${SYNC_ROLLUPS}${SYNC_ROLLUPS_COMMIT} Set safe_to_test:true through its owning transition until that field migrates.${driftFrontmatter(frd)}${emitGateOutcome(frd, 'pass', `,"passed":${(reviewIds || []).length}`)}${ACHIEVEMENT(frd)} BUILD-JOURNAL (A1): record the gate's green resolution (the trust boundary was the gate; you are its main-tree applier):${applyJournal}${landingCommitProtocol(fromEvidence ? files : [])}${fromEvidence || !files.length ? '' : ` Also stage the reviewer's test files (${files.join(', ')}) into (A).`}${LAST_GREEN_ORDERING} Return { done: true }.${inventoryPersistStep(frd)}`,
    { label: `apply-gate:${frd}`, phase: 'Review', model: MECH, agentType: 'pandacorp:implementer', schema: APPLY_GATE_SCHEMA }))
  commitChain = link.then(() => {}, () => {})   // share ONE serialized git-writer chain on main (WO commits + gate applies) — no interleaved writers
  return link.then((r) => {
    if (isPartialReport(r)) { refusePartial(frd, 'apply-gate'); return false }   // WP-08 cage, belt to the gate's own braces
    recordInventoryWrite(frd, r)   // BL-0189: the landing's cache-write receipt (never fatal)
    return Boolean(r && r.done === true)
  }, (e) => { log(`apply-gate failed for ${frd}: ${(e && e.message) || e}`); return false })
}

// ── C2 persist-block (serialized MAIN-tree writer) — the non-progress / classified BLOCK the review-only
// gate could not write (it is review-only). Stamps BLOCKED + the decision record on main. ──
// BL-0159: `alreadyTracked` (default false) — a caller passes true ONLY when the review-only gate agent
// that classified THIS block already ran its own inline review_end/GateVerdict emission (the DR-072
// non-progress-stop and generic "broken, can't pinpoint WOs" branches in frdGateSerial/frdGateSplit both
// self-emit before returning). Every OTHER caller (the B2 traceability re-ask, still deficient after one
// retry) never went through that agent-side branch at all — a deficient-but-GREEN verdict takes NEITHER
// the reopen NOR the blocked/fail branch of the reviewer's own prompt, so nothing was ever emitted for it
// (canary C gate 2's exact shape). Passing false there closes that gap via emitGateOutcome; passing true
// avoids a duplicate review_end/GateVerdict for a block already told to the dashboard.
// F2/BL-0175: a reviewer that reaches a BLOCK verdict has usually already written its adversarial test
// files into the (review-only) gate worktree before giving up — those files never get PORTED (that only
// happens on a PASS, via applyGate's testFiles) so they are left untracked in GATE_WORKTREE. The NEXT
// `ensureGateWorktree` reuse check (`git status --porcelain` must be empty) then sees them, refuses to
// reuse the worktree, and C2 degrades to the legacy synchronous gate path for the REST of the run (and
// forever after, since BL-0067 forbids ever deleting that evidence) — exactly the state canary D2 found
// already stuck in MC real (`decision-id.reviewer.test.ts`) and canary C's own worktree
// (`sealCoverage.reviewer.test.ts`). Salvage the evidence into a durable, gitignored home BEFORE
// clearing the exact same paths, so the worktree goes back to clean without losing anything.
async function persistGateBlock(frd, reviewIds, reason, failure, alreadyTracked = false) {
  agentSpawned++
  // BL-0178: a block that ALSO carried proven pre-existing drift still files that drift (adjudicateDrift
  // already wrote the draft card) — but the drift is never the block's reason, and a block never stamps
  // the FRD's `drift:` frontmatter (only a certifying landing writes that replica).
  const blockDrift = ((frdState.get(frd) || {}).landingDrift || []).map((d) => d.id)
  const driftNote = blockDrift.length ? ` BL-0178: the pre-existing drift the engine proved for this gate (${blockDrift.join(', ')}) is ALREADY filed as draft change card(s) and is NOT a reason for this block — do not list it as a blocker in decisions.md.` : ''
  const link = commitChain.then(() => agent(
    `You are the SOLE main-tree git writer at this instant (serialized). The FRD gate for ${frd} classified a BLOCK (${reason})${failure ? ` — ${failure}` : ''} but is review-only, so persist it on the MAIN tree now. For EACH reviewed work order (${(reviewIds || []).join(', ')}) whose frontmatter fault warrants it (a DR-072 non-progress WO has \`reopen_count\` ≥ ${MAX_REOPENS}; for a generic gate block, all of them): set \`implementation_status: BLOCKED\` + \`blocked_reason: ${reason}\`. Append an owner-facing record (SPANISH) to .pandacorp/inbox/decisions.md — what the gate keeps rejecting, the diagnosis, what the owner must decide. ${SYNC_ROLLUPS} Bump pending_decisions through its current owning transition.${driftNote} Commit (Conventional Commits, scope).${alreadyTracked ? '' : emitGateOutcome(frd, 'blocked', `,"blocked_reason":"${reason}"`)}
${PARALLEL_GATES ? PARALLEL_PERSIST_NO_SALVAGE : `    **Gate-worktree salvage (F2/BL-0175) — run this BEFORE you finish, it is a SEPARATE tree from the one you just committed to:** if ${GATE_WORKTREE} exists and \`git -C ${PROJECT_DIR} worktree list --porcelain\` registers it, run \`git -C ${GATE_WORKTREE} status --porcelain=v1 --untracked-files=all\` (BL-0182: without \`--untracked-files=all\` a new directory collapses to one \`?? dir/\` line and its files are never salvaged; paths are worktree-ROOT-relative). For EACH path it reports, copy that file to \`.pandacorp/run/gate-evidence/${frd}/<the same relative path>\` (mkdir -p the parent; this is a gitignored MAIN-tree append, not a git write), then run \`git -C ${GATE_WORKTREE} clean -f -- <that exact path>\` for an untracked file or \`git -C ${GATE_WORKTREE} checkout -- <that exact path>\` for a modified tracked one — copy-then-clean EXACTLY the reported paths, one at a time, NEVER a blanket \`clean -fd\`/\`reset --hard\`/\`checkout .\` (BL-0067: this worktree may hold other crash evidence you must not touch). If \`git status --porcelain\` is already empty, or the worktree does not exist, skip this step entirely — do not create or touch anything. This keeps the gate worktree clean for C2 reuse by the NEXT FRD gate this run, instead of silently degrading the rest of the run (and every future one) to the legacy synchronous gate path. `}Return { done: true }.`,
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
//     tool calls — the actual FRD-24 driver. It brakes agent WEIGHT, not tokens. BL-0138 path 1 (below)
//     adds a real-token SECOND opinion on top of it, not a replacement for it.
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
// ── BL-0138 path 1: a REAL-TOKEN second opinion on top of the agent-weight brake ───────────────────
// agent() exposes no per-call usage (verified against the Workflow script API — there is no such field
// on its return value); the ONLY live token signal is `budget.spent()`, ONE un-partitioned counter for
// the whole run. A delta around a call is honest ONLY when nothing ELSE is spending in that window.
// Every repair rung is provably on such a window: each one runs on a quiesced, one-FRD-at-a-time tree —
// the wave build barrier resolves before the post-wave repair loop starts (`await parallel(...)` then a
// sequential per-FRD `for`, see the Build-phase loop), and drainConverge() awaits every in-flight gate
// (`settleGates(true)`) before draining its queue one item at a time. So repairTokensByFrd is always a
// trustworthy real number. The BUILD side is the opposite: the engine's own global-wave design (see the
// module description) deliberately builds MULTIPLE FRDs' work orders concurrently in one `parallel()`
// barrier, so a `budget.spent()` delta around that barrier is shared across every FRD in it and cannot
// be disentangled — buildTokensByFrd is only trustworthy for an FRD whose EVERY build wave contained
// that FRD alone (buildTokensReliable), and is permanently marked unusable (never reset) the moment a
// multi-FRD wave touches it, since an already-mixed total can't be un-mixed by a later clean wave.
const buildTokensByFrd = new Map()       // frd -> real output tokens spent BUILDING it (single-FRD waves only)
const buildTokensReliable = new Map()    // frd -> true iff every wave that built it so far was single-FRD
const repairTokensByFrd = new Map()      // frd -> real output tokens spent REPAIRING it (always trustworthy)
const loggedTokenFallback = new Set()    // frd -> already logged the agent-weight fallback once (avoid log spam per rung)
// D1 (args.parallelGates): with gates reviewing in their slots while the build wave or a landing's repair
// rung runs on main, budget.spent() also absorbs THEIR spend — the "quiet window" the two deltas above rely
// on no longer exists. Such a delta is never read as real: the FRD's token layer is switched off for the
// run (sticky, same as a mixed multi-FRD wave) and the brake runs on agent-weight alone, LOUDLY, with the
// real reason. (The red-team's X9: the token layer is an OR-rescue, so a polluted delta could never trip a
// false needs-owner — this keeps the brake honest, not safe-by-accident.)
const tokenFallbackReason = new Map()    // frd -> why its token layer is off (the fallback log names it)
function markTokensUnreliable(frd, why) {
  buildTokensReliable.set(frd, false)
  if (!tokenFallbackReason.has(frd)) {
    tokenFallbackReason.set(frd, why)
    log(`… ${frd}: repair brake on agent-weight, usage unreliable — ${why} (budget.spent() is one un-partitioned counter; D1/BL-0138)`)
    loggedTokenFallback.add(frd)
  }
}
// Records ONE wave's real build spend against every FRD it touched — call right after the wave's
// `parallel(wave.map(buildWO))` barrier resolves, with the budget.spent() delta across that barrier.
function recordWaveBuildTokens(waveFrds, tokensSpent) {
  if (waveFrds.length === 1) {
    const [frd] = waveFrds
    // A zero delta is NOT evidence of a free build — budget.spent() never moving across a whole wave
    // means token tracking isn't actually live for this run (a still-cold counter, an instrumentation
    // gap), and treating that zero as a real ceiling would make the token layer WRONGLY permissive
    // (repairTokensByFrd would also read 0, and 0 <= 0 rescues everything). Stay UNMARKED (neither
    // reliable nor unreliable) until a genuinely positive delta is observed — a later single-FRD wave
    // for the same FRD can still promote it.
    if (tokensSpent > 0 && buildTokensReliable.get(frd) !== false) {
      buildTokensByFrd.set(frd, (buildTokensByFrd.get(frd) || 0) + tokensSpent)
      buildTokensReliable.set(frd, true)
    }
  } else {
    for (const frd of waveFrds) buildTokensReliable.set(frd, false)   // sticky — a mixed total never becomes trustworthy again
  }
}
// The real-token ceiling, or null when this FRD's build tokens can't be trusted (see above) — null is
// the fallback signal, never treated as "budget 0" (that would make the token layer STRICTER, which it
// must never be — see canAffordRepair's OR).
const tokenRepairBudget = (frd) => (buildTokensReliable.get(frd) === true ? REPAIR_BUDGET_FACTOR * (buildTokensByFrd.get(frd) || 0) : null)
function chargeRepair(frd, model, tokensSpent = 0) {
  if (!REPAIR_BRAKE) return
  repairCostByFrd.set(frd, (repairCostByFrd.get(frd) || 0) + COST(model))
  if (tokensSpent > 0) repairTokensByFrd.set(frd, (repairTokensByFrd.get(frd) || 0) + tokensSpent)
}
// Wraps a repair rung's own agent()/buildWO call with a budget.spent() delta and charges it as REAL
// tokens (BL-0138 path 1) — safe because every call site is on the quiesced tree described above.
async function chargedRepair(frd, model, callFn) {
  const before = budget.spent()
  // D1: a parallel gate still reviewing in its slot spends into the same counter during this rung.
  const gatesAlongside = PARALLEL_GATES ? gatesInFlight.size : 0
  if (gatesAlongside) markTokensUnreliable(frd, `${gatesAlongside} parallel gate(s) were reviewing while its repair rung ran`)
  try {
    return await callFn()
  } finally {
    chargeRepair(frd, model, gatesAlongside ? 0 : budget.spent() - before)   // a polluted delta is never recorded as this FRD's repair tokens
  }
}
function canAffordRepair(frd, model, units = 1) {
  if (!REPAIR_BRAKE) return true
  const ceiling = repairBudget(frd)
  const spent = repairCostByFrd.get(frd) || 0
  if (spent === 0) return true                       // the first attempt is always affordable
  if (spent + COST(model) * units <= ceiling) return true   // agent-weight (floored) already affords it
  // Agent-weight says no — ask the real-token signal before agreeing. It is STRICTLY MORE PERMISSIVE,
  // never stricter (OR, not AND): it can only rescue a false-early trip the coarse COST() proxy caused,
  // never cut a repair the floored budget would have allowed. Unlike the weight check it cannot PRICE
  // the next call in advance (no per-call token estimate exists before the call runs), so it compares
  // spend-so-far only — still a real, honestly-measured second opinion for exactly the failure mode
  // COST() cannot see (see the brake's block comment: one opus/xhigh agent burning far more real work
  // than its "3 units" implies).
  const tokenCeiling = tokenRepairBudget(frd)
  if (tokenCeiling === null) {
    if (!loggedTokenFallback.has(frd)) {
      loggedTokenFallback.add(frd)
      log(`… ${frd}: repair brake on agent-weight, usage unavailable (this FRD's build spend was mixed into a multi-FRD wave — no trustworthy per-FRD token total, BL-0138)`)
    }
    return false
  }
  return (repairTokensByFrd.get(frd) || 0) <= tokenCeiling
}
// The honest exit when the budget is gone: the work orders are filed needs-owner with the OBJECTIVE
// gate report attached, the work stays on the branch (nothing is reverted or discarded — the owner may
// well want to finish it by hand), and the owner is told through BOTH DR-099 channels (the GateVerdict
// event Mission Control reads, and the push notification).
async function blockRepairBudgetExhausted(frd, reopenIds, gate) {
  agentSpawned += COST(P.judge)   // the exit is never charged to the repair budget — it IS the budget's conclusion
  const spent = repairCostByFrd.get(frd) || 0
  const ceiling = repairBudget(frd)   // BL-0138: renamed from `budget` — that name shadowed the injected global budget object
  const report = gate && gate.gateReport ? JSON.stringify(gate.gateReport).slice(0, 4000) : '(the gate returned no machine-readable report; quote its `failure` text instead)'
  const record = `El motor gastó ${spent} unidades de coste reparando ${frd}, por encima del techo de ${ceiling} (${REPAIR_BUDGET_FACTOR}× lo que costó construir esa feature en esta corrida). Seguir intentándolo sale más caro que construirla entera, así que paro y te lo paso: el trabajo está INTACTO en la rama y el informe objetivo del gate va adjunto.`
  return await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'block' })}REPAIR BUDGET EXHAUSTED (WP-08) for ${frd}. Repair has cost ${spent} weighted cost-units against a ceiling of ${ceiling} (${REPAIR_BUDGET_FACTOR}× this FRD's own build spend this run). Do NOT patch, do NOT diagnose, do NOT retry — the point of stopping is to stop.
  1) **PRESERVE the work exactly as it is.** Do NOT revert, do NOT \`git checkout\` anything, do NOT \`git rm\` anything, and never a hard reset — the partially-repaired build stays on the branch so the owner (or a later run) can pick it up. Commit nothing but the state changes in step 2/3.
  2) Set EACH reopened work order (${(reopenIds || []).join(', ')}) \`implementation_status: BLOCKED\` + \`blocked_reason: needs-owner\`; ${SYNC_ROLLUPS} Bump pending_decisions through its current owning transition.
  3) Append the owner-facing DECISION RECORD to .pandacorp/inbox/decisions.md (SPANISH) and ATTACH the objective gate-report under it as a fenced \`\`\`json block so the owner reads the machine verdict, not a summary of it: ${record}
  GATE-REPORT (verbatim, from the failing gate): ${report}
  4) COMMIT (Conventional Commits, scope) staging the frontmatter flips, decisions.md, status.yaml and \`.pandacorp/build-journal.jsonl\`.${emitGateOutcome(frd, 'blocked', `,"blocked_reason":"needs-owner","repair_units":${spent},"repair_budget":${ceiling}`)}${NOTIFY('FRD ' + frd + ' parado: la reparacion ya cuesta mas de ' + REPAIR_BUDGET_FACTOR + 'x construirlo — trabajo intacto, necesita tu decision')}
  Return { green: false, blocked_reason: 'needs-owner' }.`,
    { label: `block-repair-budget:${frd}`, phase: 'Review', model: P.judge, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}

// ── Repair pass: TRY TO FIX before giving up (owner's rule, DR-050) ────────────
// The build resolves problems itself and only stops when it genuinely can't — then it
// BLOCKS with a reason instead of dying. Run by a strong model (it's hard diagnosis).
// `gateBlocked` (BL-0159, default false): true ONLY when this call sits directly downstream of a FRD
// gate/review attempt that already ran this cycle (gateConverge's "no specific reopen → attempt repair"
// ladder) — so a step-3 give-up here IS a gate's terminal outcome and must emit review_end/frd_end/
// GateVerdict (the exact shape canary C's gate 2 left untelemetried: attemptRepair itself SUCCEEDED that
// run, but the re-gate it fed into then failed with no agent branch left to emit anything — see the
// gateConverge call site). The OTHER call site (a build-wave work-order self-test failure, BEFORE any
// review ever starts — no review_start was emitted for it) leaves this false: emitting review_end there
// would announce the close of a review that never opened.
async function attemptRepair(frd, context, gateBlocked = false) {
  agentSpawned += COST(P.judge)   // DR-073: repair runs on the judge model — weight it honestly
  return await chargedRepair(frd, P.judge, () => agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'repair' })}The build of FRD ${frd} hit a problem: ${context}. You are the repair engineer — TRY TO FIX it before we give up.
  1) Diagnose the root cause: read the failing output, the work orders, and .pandacorp/comms/progress.md.
  2) If it is within your reach (code / test / local config): fix the PRODUCTION code (never weaken or skip tests) until \`bash .pandacorp/verify.sh\` is green for this feature; set the affected work orders' frontmatter back to \`implementation_status: IN_REVIEW\`; commit (Conventional Commits with scope); return { green: true }.
  3) If you CANNOT fix it, classify WHY, set the affected work orders' frontmatter to \`implementation_status: BLOCKED\` + \`blocked_reason: <reason>\`, then ${SYNC_ROLLUPS} **DR-070 — discard the blocked WO's committed-but-broken code so it doesn't pollute sibling FRDs' global gate: revert its files to the last green (\`git checkout <last_green_sha> -- <its existing files>\`; \`git rm\` newly-created ones; NEVER a hard reset of the whole tree).** Commit only the status change + the revert${gateBlocked ? `, then append ONE more printf naming the blocked_reason you are actually returning below (needs-owner, external or error) — literally: ${emitGateOutcome(frd, 'blocked', `,"blocked_reason":"%s"`, ` "<the blocked_reason you return: needs-owner|external|error>"`)}` : ''}, and return { green: false, blocked_reason, failure }:
     - 'needs-owner' → it needs a HUMAN action/decision the agent can't take: a missing env var or secret, an external account/service to set up, a product decision. ALSO append it to .pandacorp/inbox/decisions.md (what's blocked, the options, your recommendation).
     - 'external' → a transient OUTSIDE failure (no internet, an upstream 5xx) — worth a retry on a later run, not our bug.
     - 'error' → a technical failure you could not resolve.`,
    { label: `repair:${frd}`, phase: 'Review', model: P.judge, effort: 'xhigh', agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA }))
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
  return await chargedRepair(frd, patchModel, () => agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'patch' })}Patch-in-place repair (DR-073)${priorDiagnosis ? ' — SECOND diagnosis-guided attempt (A3 patch-2)' : ''}. The build of ${frd} is ~CORRECT EXCEPT these specific findings:
  ${list}${diagText}${reviewerTestsPatchDirective(frd)}
  Patch ONLY these on the EXISTING build — do NOT revert, do NOT rebuild from scratch, do NOT touch unrelated files. For each finding, make the RED-proven failing test PASS (production code, never weaken/skip a test). Reviewed work orders this cycle: ${(reviewIds || []).join(', ')}.
  BUILD-JOURNAL (A1): record ONE kind:"attempt" line for this patch (descriptive — verdict stays empty, a patcher never certifies itself):${patchAttemptJournal}
  THEN RE-GATE (this is the safety invariant — a focused gate is NOT enough, red-team-A): run the FULL FRD adversarial + integration tests for ${frd} AND a WHOLE-PROJECT \`pnpm knip\` + \`pnpm biome check .\` + \`pnpm tsc --noEmit\` (NOT \`verify.sh --since\` — a dead export left by the patch must not slip to a sibling FRD's global gate). Everything must be whole-project-clean.
  **SELF-REPAIR BUDGET (DR-107) — a red introduced by YOUR OWN edits does not end the patch:** if the re-gate fails on something YOUR patch just added or touched (a type/lint error in a file you created or edited — e.g. a TS2345 in your own new test file), FIX that and re-gate. You may spend up to 2 such internal fix-and-re-gate cycles. (The real incident this exists for: a 1-line i18n patch was discarded — and its whole work order rebuilt from scratch — because its own new a11y spec had a trivial type error the old contract forbade fixing.)${scoped ? `
  **SCOPED INNER LOOP (WP-08) — for those ≤2 internal cycles ONLY, do NOT re-run the whole project.** The gate report says this failure is confined to ${mech.subgates.join(' + ')}, so re-check with \`bash .pandacorp/verify.sh ${scopeFlags}\` (it runs only those sub-gates, narrows biome to those paths and vitest to their related tests; tsc/knip/madge stay whole-program inside it). Add any file YOU touch to that \`--files\` list as you go. Such a run stamps the gate report \`scope:"partial"\` and CERTIFIES NOTHING — it is a fast inner check, which is exactly why the whole-project RE-GATE above remains mandatory and unscoped before you commit. If a scoped check surfaces a failure OUTSIDE the named sub-gates, stop scoping and go back to the full re-gate.` : ''}
  **If whole-project-clean:** COMMIT the patch (Conventional Commits, scope), staging \`.pandacorp/build-journal.jsonl\` too (append-only — your attempt line) — but do NOT set any WO \`VERIFIED\`, do NOT touch \`reopen_count\`, do NOT advance \`last_green_sha\`/status.yaml: you patched it, so you may not certify it (constitution rule 4, generator ≠ verifier — audit-20). An INDEPENDENT verifier re-runs the gate and stamps. Return { green: true }.
  **If the blocker is a DEFECTIVE reviewer test (BL-0001):** you conclude a blocking adversarial test is INTERNALLY INCONSISTENT or unsatisfiable by ANY correct implementation (e.g. it asserts desktop-only nav visibility without forcing a viewport while the Playwright config runs desktop+mobile) — **or (BL-0051) it is a BLESSED test asserting a contract that a work order of THIS FRD intentionally DEROGATES**, which no correct implementation of the new contract can satisfy either — do NOT edit that test (the patcher never rewrites the reviewer's tests) and do NOT keep bending production code to satisfy it: UNDO all your own edits (restore files you modified, delete files you created — \`git status\` must read as you found it, EXCEPT the append-only \`.pandacorp/build-journal.jsonl\` line, which is a durable record of this attempt and is swept by the engine's next commit — do NOT undo it),${PATCH_RESULT(frd, 'gate-test-defective')} and return { green: false, cause: 'gate-test-defective', defectiveTests: [{ path, why }], failure }. The engine routes it to an independent gate-test repair — not to a revert of the build.
  **If you CANNOT green it in place** (the ORIGINAL build genuinely fails beyond the findings, or your self-repair budget is spent): UNDO all your own edits the same way — leave the tree exactly as you found it (do NOT commit, do NOT revert the WO; the engine reverts cleanly), EXCEPT the append-only \`.pandacorp/build-journal.jsonl\` line (a durable record of this attempt — leave it; the engine's next commit sweeps it),${PATCH_RESULT(frd, 'code-fail')} and return { green: false, cause: 'code', failure: <why> }.`,
    { label: `patch:${frd}`, phase: 'Review', model: patchModel, effort: patchEffort, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA }))
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
  markReviewerTestsReblessed(frd)   // BL-0184: this reviewer OWNS the pinned tests (DR-080) — its edits re-pin their hashes, never a breach
  // WP-08: charged to the repair budget, but deliberately NEVER refused by it. This path exists to
  // preserve a CORRECT build against a defective/superseded gate test — refusing it would push the
  // flow into a revert + full rebuild, which costs strictly more than the agent the brake just saved.
  const list = (defectiveTests || []).map((t) => `• ${t.path}: ${t.why}`).join('\n  ') || '(see the patch output)'
  // BL-0051: the same INDEPENDENT reviewer also owns the DEADLOCK BREAK — when the diagnoser classified
  // `deadlocked-contract`, the flagged test is not internally inconsistent: it asserts a contract a SIBLING
  // work order of this same FRD intentionally derogates (LESSON-0104). Same role, same DR-080 boundary,
  // different framing of the judgment — so the build breaks the cycle itself instead of stopping for a
  // human to hand-edit the blessed test.
  const head = deadlock
    ? `GATE-TEST RE-BLESS — DEADLOCK BREAK (BL-0051) for ${frd}. The diagnoser classified this failure **deadlocked-contract** (confidence ${(deadlock && deadlock.confidence) || 'medium'}): a BLESSED reviewer test still asserts a contract that a work order of THIS SAME FRD intentionally DEROGATES, while the work order that would re-bless it \`dependsOn\` the derogating one — neither can ever go green (LESSON-0104). Diagnosis: ${(deadlock && deadlock.seam && deadlock.seam.why) || (deadlock && deadlock.decisionRecord) || '(see the build journal)'}. The blessed test(s) at issue:`
    : `GATE-TEST REPAIR (BL-0001) for ${frd}. The patch agent flagged these reviewer adversarial test(s) as DEFECTIVE — internally inconsistent, unsatisfiable by ANY correct implementation, or asserting a contract this FRD's own work orders intentionally derogate (BL-0051):`
  return await chargedRepair(frd, P.judge, () => agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'gate-test-repair' })}${head}
  ${list}
  You are an INDEPENDENT reviewer (you own the gate's tests; the patcher may not touch them). For EACH flagged test, judge the claim on the evidence — do not take the patcher's word:
  - **Genuinely defective** (the assertion contradicts its own setup/config, or no correct implementation of the FRD's acceptance criteria could satisfy it): REPAIR the test so it correctly asserts the FRD's REAL acceptance criterion (fix the assertion/setup — e.g. force the viewport it assumed; NEVER delete the coverage or weaken what the AC requires).
  - **DEROGATED CONTRACT (BL-0051 deadlock break)** (the test is internally consistent, but the contract it encodes was intentionally SUPERSEDED by a work order of THIS FRD): before you accept this, PROVE the derogation is DECLARED — read ${frd}'s \`frd.md\`, its blueprint and the sibling work orders **including their \`dependsOn\` graph**, and confirm a work order states the new contract. Only then RE-BLESS the test: rewrite the assertion(s) to the NEW contract the FRD now specifies (never delete the coverage, never weaken what the acceptance criteria require — the re-blessed test must still FAIL against an implementation that gets the NEW contract wrong). **DR-080 stays intact:** you are the INDEPENDENT reviewer who OWNS this test, which is exactly why this edit is yours and never the implementer's/patcher's. If NO work order declares the derogation, it is not a derogation — fall through to "Actually right".
  - **Actually right** (the build really violates it, or the claimed derogation is undeclared): change NOTHING and return { green: false, cause: 'code', failure: 'test upheld: <why the build is wrong>' } — the engine falls back to the normal revert (or, for a deadlock claim, to the needs-owner block).
  After repairing: re-run the repaired test file(s) + the FULL FRD test files for ${frd} AND whole-project \`pnpm biome check .\` + \`pnpm tsc --noEmit\` against the EXISTING build (work orders this cycle: ${(reviewIds || []).join(', ')}). If everything is clean, COMMIT only the test repair(s) (Conventional Commits, scope; note WHY each test was defective in the commit body) and return { green: true } — an independent verifier still re-runs the objective gate and stamps. If red remains, change nothing further and return { green: false, cause: 'code', failure }.`,
    { label: `gate-test-repair:${frd}`, phase: 'Review', model: P.judge, effort: 'xhigh', agentType: 'pandacorp:reviewer', schema: REPAIR_SCHEMA }))
}

// ── Independent post-patch verification (constitution rule 4 — the patcher never certifies itself) ──
// A DIFFERENT agent re-runs the objective gate over the patched build (mechanical re-run — the scripts are the
// oracle, so a worker-model agent suffices). BL-0191 — VERIFY, THEN CHECK, THEN STAMP: the verifier used to stamp
// VERIFIED + review_end pass + last_green_sha + the publication itself, and only AFTERWARDS did the engine run the
// WP-08 partial-report cage and the BL-0178 inherited-contract check. A downgrade-to-red then took the revert path
// with nothing compensating the stamps: last_green_sha already pointed at the refused patch, so the revert had
// nothing to check out and the "clean base" retry rebuilt from the rejected code (canary E, FRD-03). Now the
// verifier WRITES NOTHING and returns its verdict; the engine runs every oracle over it; only an accepted verdict
// reaches certifyPatched — the same verify/apply split as the review-only gate + applyGate. Every caller keeps the
// old contract: green:true = certified and stamped; anything else = red, nothing stamped.
async function verifyPatched(frd, reviewIds) {
  const breach = await checkReviewerTestIntegrity(frd)   // BL-0184: never spawn the certifier over tampered/missing reviewer tests
  if (breach) return breach
  agentSpawned++
  // BL-0178: the FRD-03 hole — a verifier that only re-ran vitest/tsc/biome certified VERIFIED while the
  // first gate's still-open `fail` contracts (and, before, its drift) vanished. It now INHERITS every open
  // fail of the gate it is certifying (finalizeGate stashed them; proven drift is excluded — that has its
  // own record) and may not return green until each one is shown closed by a passing test.
  const inherited = ((frdState.get(frd) || {}).inheritedFails) || []
  const inheritedBlock = inherited.length
    ? `\n  **INHERITED OPEN CONTRACTS (BL-0178 — the gate recorded these as \`fail\`; you may NOT return green while any one stays open):**\n  ${inherited.map((e, i) => `• [${e.contractClass}] ${e.contract}${Array.isArray(e.tests) && e.tests.length ? ` — the gate's tests: ${e.tests.join(', ')}` : ''} · key ${INHERITED_KEY(i)}`).join('\n  ')}\n  For EACH one, run the test file(s) that prove it now holds on the patched build (the gate's tests above when they exist in this tree, else the patch's RED-proven test for it) and report it in \`inheritedResolved\` as { key: <its key, e.g. ${INHERITED_KEY(0)}>, contract: <its contract text as listed, without the [class] tag and the tests suffix>, pass, tests }. "Everything is clean" REQUIRES every inherited contract pass:true with at least one test — otherwise take the red exit.`
    : ''
  const verdict = await agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'verify-patch' })}INDEPENDENT post-patch verification for ${frd} (constitution rule 4: the patch agent may not certify its own fix). Re-run the objective gate yourself — trust nothing the patcher reported: the FULL FRD test files for ${frd} — the affected tests — (\`pnpm vitest run\` on them) AND whole-project \`pnpm tsc --noEmit\` + \`pnpm biome check .\`. ${reviewerTestsVerifyDirective(frd)}
  **Do NOT re-run \`pnpm knip\` here (C1b): attemptPatch already ran the whole-project knip immediately before this step (its dead-export gate, red-team-A) and nothing changed since it committed — re-running knip is a duplicate multi-second whole-project scan for no new signal (the close-out full suite covers it once more at the end).**
  **YOU VERIFY — YOU DO NOT STAMP (BL-0191): write NOTHING, whatever the outcome** — no frontmatter or status.yaml edit, no journal/track/dashboard line, no \`git add\`, no commit. The engine checks your verdict (the WP-08 scope cage and every inherited contract below) BEFORE anything is certified; only an accepted verdict is then persisted by a separate serialized step.
${inheritedBlock}
  **If everything is clean:** return { green: true, inheritedResolved, report_scope, resolved: <one line: what the patch resolved> }.
  **If anything is red:** return { green: false, failure: <what failed> } — the engine reverts + reopens.
  **WHOLE-PROJECT ONLY (WP-08 cage):** run the checks above unscoped — never \`verify.sh --only\`/\`--files\`. Yours is THE certification verdict: a scoped run stamps \`scope:"partial"\` and the engine will refuse your verdict outright.${REPORT_SCOPE_DIRECTIVE}`,
    { label: `verify-patch:${frd}`, phase: 'Review', model: P.worker, agentType: 'pandacorp:reviewer', schema: REPAIR_SCHEMA })
  if (!verdict || verdict.green !== true) return verdict
  // WP-08 cage: a green claim standing on a PARTIAL gate report certifies nothing — refused here, before any stamp,
  // as the same red every caller already routes (revert + reopen).
  if (isPartialReport(verdict)) {
    refusePartial(frd, 'the independent post-patch verification')
    return { ...verdict, green: false, failure: 'verification ran a SCOPED gate (gate-report scope:"partial") — it certifies nothing (WP-08 cage)' }
  }
  // BL-0178: a green that does not prove EVERY inherited open contract closed is a red (BL-0191: matched by key,
  // REQ/AC id or de-decorated text — see unresolvedInherited).
  const open = unresolvedInherited(inherited, verdict.inheritedResolved)
  if (open.length) {
    const names = open.map((e) => contractIdOf(e.contract) || e.contract).join(', ')
    log(`⛔ ${frd}: the post-patch verifier claims GREEN but ${open.length} inherited fail contract(s) are not proven closed (${names}) — REFUSING to certify (BL-0178)`)
    return { ...verdict, green: false, failure: `BL-0178: inherited fail contract(s) not proven closed by a passing test: ${names}` }
  }
  const stamped = await certifyPatched(frd, reviewIds, verdict)
  if (!stamped) {
    log(`⊘ ${frd}: the independent verification ACCEPTED the patch but the certify step did not confirm its stamp — NOT marking it verified and NOT reverting the verified code; it re-gates next pass (BL-0191)`)
    return { ...verdict, green: false, unstamped: true, failure: 'BL-0191: the certify step did not confirm the stamp of an accepted post-patch verification' }
  }
  return verdict
}
// BL-0191: the stamp of an ACCEPTED post-patch verification — the serialized main-tree writer that persists what the
// independent verifier proved and the engine checked (the applyGate of the patch ladder). It judges nothing and
// re-runs nothing; it is spawned ONLY after every engine oracle accepted the verdict. Returns true iff it confirmed.
async function certifyPatched(frd, reviewIds, verdict) {
  agentSpawned++
  const resolved = String((verdict && verdict.resolved) || '').replace(/[`\n\r]/g, ' ').slice(0, 300)
  const resolutionJournal = JOURNAL(
    `"wo":"%s","frd":"${frd}","attempt":%s,"reopen_count":%s,"rung":"verify","role":"verifier","kind":"resolution","classification":"","seam":null,"findingKey":"","tried":"patched in place, independently verified","verdict":"green","why":"%s","confidence":"high"`,
    ` "<the primary patched work order, else ${(reviewIds || [])[0] || frd}>" "<its attempt number, an integer>" "<its reopen_count BEFORE you reset it, an integer>" "<one line: what the patch resolved>"`)
  const link = commitChain.then(() => agent(`You are the SOLE main-tree git writer at this instant (serialized — no other commit runs concurrently). An INDEPENDENT verifier just re-ran the objective gate over the in-place patch of ${frd} and the ENGINE accepted its verdict (WP-08 scope cage + every inherited open contract proven closed — BL-0178/BL-0191). You only PERSIST that certification: do NOT re-review, do NOT re-run the suite, do NOT edit code or tests.${resolved ? ` The verifier's summary of what the patch resolved: ${resolved}.` : ''}
  Set the patched work orders (${(reviewIds || []).join(', ')}) \`implementation_status: VERIFIED\` and **reset their \`reopen_count: 0\`**; ${SYNC_ROLLUPS}${SYNC_ROLLUPS_COMMIT} Set last_green_sha and safe_to_test through their current owning transition.${driftFrontmatter(frd)}${reviewerTestsStageDirective(frd)} BUILD-JOURNAL (A1) — record the independent verifier's kind:"resolution" (green) line (you persist ITS verdict; the patcher never certifies itself):${resolutionJournal}${emitGateOutcome(frd, 'pass', `,"passed":${(reviewIds || []).length},"via":"patch"`)}${PATCH_RESULT(frd, 'green')}${ACHIEVEMENT(frd)}${landingCommitProtocol(((reviewerTestsByFrd.get(frd) || {}).tests || []).map((t) => t.path))}${LAST_GREEN_ORDERING} Commits use Conventional Commits with a scope. Return { done: true }. If you cannot complete the stamp, return { done: false, failure: <why> }.`,
    { label: `certify-patch:${frd}`, phase: 'Review', model: MECH, agentType: 'pandacorp:implementer', schema: APPLY_GATE_SCHEMA }))
  commitChain = link.then(() => {}, () => {})   // the ONE serialized main-tree writer chain (WO commits + gate applies + this)
  return link.then((r) => Boolean(r && r.done === true), (e) => { log(`certify-patch failed for ${frd}: ${(e && e.message) || e}`); return false })
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
  reviewerTestsByFrd.delete(frd)   // BL-0184: the pinned tests bound THIS verdict's patch ladder; the retry's fresh gate on main owns its own
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
    1) Reset to the last green — SAFELY (DR-072 R3, this prevents wiping verified work): read last_green_sha from .pandacorp/status.yaml, then FIRST verify it is an ANCESTOR of HEAD: \`git merge-base --is-ancestor <last_green_sha> HEAD && echo ANCESTOR || echo ORPHAN\`. ALSO run \`${PREFIX_ASSIGN} && printf 'PREFIX=%s\\n' "$P"\` (BL-0202). **If ANCESTOR AND PREFIX is empty** (a project at its repository root): \`git reset --hard <last_green_sha>\` to discard the flat half-built surfaces (NOT the verified foundation). **If PREFIX is NOT empty** (a project NESTED in a larger repository, e.g. Mission Control in the factory): NEVER \`git reset --hard\` — it rewinds the WHOLE repository, other sessions' commits and uncommitted work outside this project included — take the surgical path below even when ANCESTOR. **If ORPHAN** (the SHA drifted off-branch via reverts / factory commits / an overlay upgrade — a real footgun seen 2026-06-20): do NOT hard-reset (it would discard verified work). Instead surgically discard ONLY the failed surfaces' files — restore the tracked ones with the BL-0202 RESTORE COMMAND: \`${scopedRestoreCommand('HEAD')}\` and remove their new untracked dirs with the BL-0202 CLEAN COMMAND: \`${scopedCleanCommand()}\` (each VERBATIM except ${SCOPED_PATHS_NOTE} List the paths with \`${PROJECT_STATUS_COMMAND}\`: only IN paths are yours, OUT paths belong to other work) — keeping HEAD and every verified commit. ${NO_WHOLE_TREE_WRITES.replace('no `git reset --hard`, ', '')} If you cannot safely identify exactly which files to discard, STOP: return { green: false, blocked_reason: 'needs-owner', failure: 'last_green_sha orphaned — a hard reset would wipe verified work; the owner must confirm the recovery point' }.
    2) For EACH missing primitive: build it as a SHARED foundation component on the frozen design tokens, faithful to its mock/fdd spec (read docs/frds/*/mocks + docs/design/design-tokens.json + DESIGN.md); place it under src/components/core or src/components/modules; APPEND a row to docs/design/components.md so surfaces reuse it. TDD; never weaken tests.
    3) Run \`bash .pandacorp/verify.sh\` until green and commit (Conventional Commits, scope), staging ONLY this project's files by explicit path (never \`git add -A\`/\`git add .\`/\`git commit -a\`, BL-0202). The surfaces that depended on these primitives stay PLANNED so the normal loop rebuilds them next — now against REAL primitives.
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
const blockedFailures = {}   // BL-0159: frd -> the concrete failure text behind blockedReasons[frd], when known (see blockFrd)
let consecutiveBlocks = 0   // health breaker: non-external blocks in a row
let stopReason = null       // 'budget' | 'blocks' | 'maxFrds' (null = ran to completion)
let deferredWork = false    // WS-D/D4a: a safe-point drain routed a change's new WOs into an ALREADY-planned FRD
// (they build on a LATER run) — so "all planned FRDs built" is NOT the whole story. Gates release (allDone) on !deferredWork.

// `failure` (BL-0159, optional): the concrete reason TEXT behind `reason`'s coarse category, when the
// caller already has one in scope (a gate's own `.failure`, a repair's, a synthesized one-liner). Threaded
// into `blockedFailures` so notify-end's closing narrative (see the close-out prompts) can quote the REAL,
// LATEST cause instead of guessing from an earlier gate attempt's stale findings — the exact canary C
// symptom (BL-0159 §2: "solo recibio el reason error y relleno con findings viejos del gate 1").
// `trace` (F1/BL-0174, optional): the gate's own `traceability` array, when the caller has one in scope.
// A reviewer's `failure` prose often opens with praise for the passing work before naming the actual
// blocking cause hundreds of characters in (canary D2, frd-02: "WO-02-014 ... is CORRECT and must NOT
// be reverted. [...200+ chars later...] two FRD-vs-build contradictions") — a head-truncated slice kept
// only the praise, so progress.md narrated a false "just needs your OK" story (BL-0159 emitted the right
// verdict; the TEXT it quoted was wrong). Prefixing the failing contract ids from `trace` guarantees the
// stored text names the actual cause even when the reviewer's prose doesn't lead with it.
function blockFrd(frd, reason, failure = '', trace = null) {
  reason = reason || 'error'
  blockedFrds.push(frd)
  blockedReasons[frd] = reason
  const failing = Array.isArray(trace)
    ? trace.filter((e) => e && e.status === 'fail').map((e) => String(e.contract || '').split(' — ')[0]).filter(Boolean).slice(0, 4)
    : []
  const text = `${failing.length ? `FAIL ${failing.join(', ')} · ` : ''}${failure || ''}`
  if (text) blockedFailures[frd] = text.slice(0, 400)
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
// BL-0173: `cutBy` names WHY the pick stopped short of `ready.length` — 'count-cap' (the mode's P.wave
// size) vs 'agent-budget' (the projected cost would breach costBudget) used to be INDISTINGUISHABLE:
// both fell through to the caller's generic '(blocked:wave-cap)' deferred-reason label. That hid a real
// failure mode (canary-d, 2026-09-25): fixed PRE-wave overhead (precheck+process-change+plan+safe-point+
// foundation-gate, opus-weighted) can consume most/all of a small `maxAgents` BEFORE the first wave is
// even picked, so `remainingAgents` collapses to 1 and the progress-guarantee floor below silently
// admits exactly ONE WO — logically identical, from the caller's side, to "only 1 WO was ready". Naming
// the real reason lets the dispatch log say so instead of the owner mis-reading it as a dependency stall.
const pickDisjointWave = (ready, max, costBudget = Infinity, costOf = () => 1) => {
  const picked = []
  let cost = 1   // the shared dispatch stamp spawns one MECH agent for the whole wave
  let cutBy = null
  for (const w of ready) {
    if (picked.length >= max) { cutBy = cutBy || 'count-cap'; break }
    if (picked.some((p) => artifactsOverlap(p, w))) continue   // overlaps a picked WO → defer to a later wave
    if (picked.length > 0 && cost + costOf(w) > costBudget) { cutBy = cutBy || 'agent-budget'; break }   // would breach the agent budget → next wave
    picked.push(w)
    cost += costOf(w)
  }
  return { picked, cutBy }
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
          `Re-plan ONLY these FRD folders (they were just created/updated by a drained change): ${newFolders.join(', ')}. Same contract as the main build planner: read each folder's frd.md + blueprint.md Build Plan + the frontmatter ONLY of every work-orders/wo-*.md, and return { frds: [{ frd, deps, workOrders: [{ id, status, docStatus (the LITERAL \`status:\` frontmatter field, DRAFT|ACTIVE — DR-100/BL-0171; omit when the WO has none), path, acText (the EARS AC lines this WO owns, verbatim from frd.md — DR-108), difficulty, reopen_count, deps, artifacts, foundation, priorAttempts (A4 — if \`${JOURNAL_PATH}\` exists, a bounded digest [{attempt, classification, findingKey, tried, why}] of the last 2 attempts on this WO; [] otherwise), summary }] }] } in Build Plan order. Read-only.`,
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
  const findingsList = (gate.findings || []).map((x) => `• ${x.wo}: ${x.finding}${x.files && x.files.length ? ` [${x.files.join(', ')}]` : ''}`).join('\n  ') || '(see the gate output)'
  const diagJournal = JOURNAL(
    `"wo":"%s","frd":"${frd}","attempt":%s,"reopen_count":%s,"rung":"diagnose","role":"diagnoser","kind":"diagnosis","classification":"%s","seam":%s,"findingKey":"%s","tried":"","verdict":"","why":"%s","confidence":"%s"`,
    ` "<the primary reopened work order, else ${(gate.reopen || [])[0] || frd}>" "<its attempt number, an integer>" "<its current reopen_count, an integer>" "<point|architectural|gate-test-defective|deadlocked-contract>" "<a compact JSON object {\\"files\\":[...],\\"symbol\\":\\"...\\",\\"why\\":\\"...\\"} or the bare token null>" "<\`<file>::<one-line claim>\` of the fault>" "<one line: your diagnosis>" "<low|medium|high>"`)
  return await chargedRepair(frd, P.judge, () => agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'diagnose' })}DIAGNOSE (A2, progressive-learning recovery) for ${frd}. An in-place patch just FAILED to green the build (cause: code). You are a READ-ONLY diagnoser — change NOTHING, write no tests, fix nothing, run no revert. Read the CURRENT code, the failing gate findings, the reopened work orders (${(gate.reopen || []).join(', ')}), and the prior attempts recorded in ${JOURNAL_PATH} (if it exists). Findings:
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
    { label: `diagnose:${frd}`, phase: 'Review', model: P.judge, effort: 'high', agentType: 'pandacorp:reviewer', schema: DIAGNOSE_SCHEMA }))
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
  4) COMMIT (Conventional Commits, scope) staging the frontmatter flip, the code revert, decisions.md, status.yaml AND \`.pandacorp/build-journal.jsonl\` (append-only — sweeps the diagnosis line).${emitGateOutcome(frd, 'blocked', `,"blocked_reason":"needs-owner"`)}${NOTIFY('FRD ' + frd + ' bloqueado (diagnóstico ' + cls + ') — necesita tu decisión')}
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
    blockFrd(f.frd, 'needs-owner', 'repair budget exhausted before the in-run retry rebuild')
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
  for (const w of budgetedRetry) await chargedRepair(f.frd, 'opus', () => buildWO(w, f.frd))
  const regate = await frdGate(f.frd, reviewIds)
  // WP-08 cage: the in-run retry's re-gate is a certification too — a partial one certifies nothing.
  if (regate && regate.green === true && isPartialReport(regate)) { refusePartial(f.frd, "the in-run retry's re-gate"); reopenedFrds.push(f.frd); return 'reopened' }
  if (regate && regate.green === true) { await applyGate(f.frd, reviewIds, regate.testFiles, null); log(`✓ ${f.frd} VERIFIED (in-run retry)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
  if (regate && regate.reopen && regate.reopen.length) await revertAndReopen(f.frd, regate.reopen)
  // B2 (BL-0157): same rule as gateConverge — a deficient traceability inventory with no reopen is a
  // reviewer-paperwork gap, not a stall to silently defer forever. Re-ask ONCE, naming what's missing;
  // if it's still deficient, block needs-owner outright rather than looping passes on a formatting gap.
  else if (regate && regate.traceabilityDeficient) {
    const missingClasses = regate.missingClasses || []
    log(`⚠ ${f.frd}: in-run retry's re-gate has an incomplete traceability contract (missing: ${missingClasses.join(', ') || 'see failure'}) — re-asking once before deferring (B2, BL-0157)`)
    const st = frdState.get(f.frd)
    const attemptNo = ((st && st.gateAttempts) || 0) + 1
    if (st) st.gateAttempts = attemptNo
    const directive = `**RE-ASK — your prior verdict's traceability inventory was INCOMPLETE (this is not a re-review of the code, judge the same work again):** your last \`traceability\` array had no entry for: ${missingClasses.join(', ') || 'a required contractClass'}. Every one of the 7 \`contractClass\` values (requirement, acceptance-criterion, invariant, edge-case, limit, error, exclusion) needs >= 1 entry. A REQ-NN-MMM requirement is its OWN \`requirement\` entry, distinct from the acceptance-criterion entries that test it. If a class genuinely does not apply to this FRD, add a \`not-applicable\` status entry for it with \`tests: []\` instead of omitting it. Re-submit your FULL verdict with a COMPLETE traceability inventory this time.`
    const reregate = await finalizeGate(f.frd, reviewIds, await frdGateSerial(f.frd, reviewIds, attemptNo, undefined, undefined, directive))
    if (reregate && reregate.green === true && isPartialReport(reregate)) { refusePartial(f.frd, "the in-run retry's traceability re-ask"); reopenedFrds.push(f.frd); return 'reopened' }
    if (reregate && reregate.green === true) { await applyGate(f.frd, reviewIds, reregate.testFiles, null); log(`✓ ${f.frd} VERIFIED (in-run retry, traceability re-ask)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
    if (reregate && reregate.reopen && reregate.reopen.length) { await revertAndReopen(f.frd, reregate.reopen); reopenedFrds.push(f.frd); return 'reopened' }
    if (reregate && reregate.traceabilityDeficient) {
      const stillMissing = reregate.missingClasses || missingClasses
      log(`⊘ ${f.frd}: gate traceability contract STILL incomplete after the re-ask (missing: ${stillMissing.join(', ') || 'see failure'}) — BLOCK needs-owner, never 'error' (B2, BL-0157)`)
      await persistGateBlock(f.frd, reviewIds, 'needs-owner', reregate.failure || `gate traceability contract: missing ${stillMissing.join(', ')}`)
      blockFrd(f.frd, 'needs-owner', reregate.failure || `gate traceability contract: missing ${stillMissing.join(', ')}`, reregate.traceability)
      return 'blocked'
    }
  }
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
// BL-0191: an ACCEPTED post-patch verification whose certify step did not confirm the stamp. The code is
// independently verified, so it is never reverted; the FRD stays IN_REVIEW and re-gates next pass (the same
// fallback as a PASS whose apply-gate did not confirm).
function deferUnstamped(f) { reopenedFrds.push(f.frd); return 'reopened' }
async function gateConverge(f, reviewIds, gate, traceabilityReasked = false) {
  phase('Review')
  // WP-08 cage, at the certification boundary: a gate that ran `--only`/`--files` stamped its report
  // `scope:"partial"` and is NOT an oracle for this FRD. Refuse BEFORE the apply step is even spawned,
  // and defer the FRD for a full re-gate — never stamp, never advance last_green_sha.
  if (gate && gate.green === true && isPartialReport(gate)) {
    refusePartial(f.frd, 'the FRD gate')
    reopenedFrds.push(f.frd); return 'reopened'
  }
  if (gate && gate.green === true) {
    // BL-0185: a CONCURRENT pass whose first apply failed lands here from the harvest — its reviewer's tests
    // and gate-report live in the gate-EVIDENCE dir (the release already cleaned the worktree), never on
    // main. Re-port from there exactly as the harvest did; only a gate that ran on main applies in place.
    const ev = gate.reviewerEvidence
    const applied = ev
      ? await applyGate(f.frd, reviewIds, ev.tests.map((x) => x.path), ev.dir)
      : await applyGate(f.frd, reviewIds, gate.testFiles, null)
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
      if (iv && iv.unstamped) return deferUnstamped(f)   // BL-0191: verified but not stamped — keep the code, re-gate; never revert it
      patchFailNote = `patch claimed green but the independent verification FAILED (${iv?.failure || 'red'})`
    } else if (patched && patched.cause === 'gate-test-defective' && (patched.defectiveTests || []).length) {
      // BL-0001 second fallback: the gate's own adversarial test is the defect — repair the TEST,
      // never discard a correct build over an unsatisfiable assertion (LESSON-0002).
      log(`⚖ ${f.frd}: patch flagged defective gate test(s) (${patched.defectiveTests.map((t) => t.path).join(', ')}) — repairing the TEST, not rebuilding (BL-0001)`)
      const tr = await repairGateTest(f.frd, patched.defectiveTests, reviewIds)
      if (tr && tr.green === true) {
        const iv2 = await verifyPatched(f.frd, reviewIds)
        if (iv2 && iv2.green === true) { log(`✓ ${f.frd} VERIFIED (defective gate test repaired, independently verified)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
        if (iv2 && iv2.unstamped) return deferUnstamped(f)   // BL-0191: verified but not stamped — keep the code, re-gate; never revert it
        patchFailNote = `gate-test repair greened but the independent verification failed (${iv2?.failure || 'red'})`
      } else patchFailNote = `gate-test claim not upheld (${tr?.failure || 'test was right — the build is wrong'})`
    } else if (patched && patched.cause === 'code' && !capHit() && !canAffordRepair(f.frd, P.judge)) {
      // WP-08 (d): patch-1 failed on real code and the repair budget is gone. Stopping HERE is the whole
      // point — one more diagnosis + patch-2 is exactly the spend the brake exists to refuse.
      log(`⊘ ${f.frd}: presupuesto de reparación agotado (${repairCostByFrd.get(f.frd) || 0} > ${repairBudget(f.frd)} unidades = ${REPAIR_BUDGET_FACTOR}× el coste de construirlo) — repair budget exhausted, honest needs-owner exit with the work preserved (WP-08)`)
      await blockRepairBudgetExhausted(f.frd, gate.reopen, gate)
      blockFrd(f.frd, 'needs-owner', 'repair budget exhausted after patch-1 (WP-08)')
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
          if (iv && iv.unstamped) return deferUnstamped(f)   // BL-0191: verified but not stamped — keep the code, re-gate; never revert it
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
          if (iv && iv.unstamped) return deferUnstamped(f)   // BL-0191: verified but not stamped — keep the code, re-gate; never revert it
          log(`⊘ ${f.frd}: the re-bless greened but the independent verification failed (${iv?.failure || 'red'}) — BLOCK needs-owner (BL-0051 fail-closed)`)
        } else log(`⊘ ${f.frd}: the blessed test was UPHELD (${tr?.failure || 'no declared derogation'}) — BLOCK needs-owner (BL-0051 fail-closed)`)
        await blockEarlyNeedsOwner(f.frd, gate.reopen, diag)
        blockFrd(f.frd, 'needs-owner', (diag && diag.decisionRecord) || `diagnosed deadlocked-contract (confidence ${conf})`)
        return 'blocked'
      }
      // (b) architectural at confidence medium|high → EARLY BLOCK needs-owner: do NOT burn the remaining
      // reopens on a spec only the owner can fix. (A deadlocked-contract only reaches here at
      // confidence:low, which falls through to 'point' like any other weak diagnosis.)
      if (cls === 'architectural' && (conf === 'medium' || conf === 'high')) {
        log(`⊘ ${f.frd}: diagnosis = ${cls} (confidence ${conf}) — early BLOCK needs-owner, NOT burning the remaining reopens on a doomed spec (A3)`)
        await blockEarlyNeedsOwner(f.frd, gate.reopen, diag)
        blockFrd(f.frd, 'needs-owner', (diag && diag.decisionRecord) || `diagnosed ${cls} (confidence ${conf})`)
        return 'blocked'
      }
      // confidence:low architectural/deadlocked falls through and is treated as 'point' (never block on a weak diagnosis).
      // (c) point + NOT repeatsPrior + patch budget left → PATCH-2, diagnosis-guided.
      if (!repeats && patchesThisCycle < PATCH_ATTEMPT_CAP && !canAffordRepair(f.frd, 'opus')) {
        // WP-08 (d): the diagnosis fit the budget but patch-2 does not. Same honest exit.
        log(`⊘ ${f.frd}: presupuesto de reparación agotado antes del patch-2 (${repairCostByFrd.get(f.frd) || 0} + ${COST('opus')} > ${repairBudget(f.frd)} unidades = ${REPAIR_BUDGET_FACTOR}× el coste de construirlo) — repair budget exhausted (WP-08)`)
        await blockRepairBudgetExhausted(f.frd, gate.reopen, gate)
        blockFrd(f.frd, 'needs-owner', 'repair budget exhausted before patch-2 (WP-08)')
        return 'blocked'
      }
      if (!repeats && patchesThisCycle < PATCH_ATTEMPT_CAP) {
        patchesThisCycle++
        log(`↺ ${f.frd}: diagnosis = point (fresh) — patch-2 (${patchesThisCycle}/${PATCH_ATTEMPT_CAP}), diagnosis-guided (A3)`)
        const patched2 = await attemptPatch(f.frd, gate.findings || [], reviewIds, diag)
        if (patched2 && patched2.green === true) {
          const iv = await verifyPatched(f.frd, reviewIds)
          if (iv && iv.green === true) { log(`✓ ${f.frd} VERIFIED (patch-2 diagnosis-guided, independently verified)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
          if (iv && iv.unstamped) return deferUnstamped(f)   // BL-0191: verified but not stamped — keep the code, re-gate; never revert it
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

  // B2 (BL-0157): a DEFICIENT traceability inventory with no specific WO reopen is a reviewer-paperwork
  // gap, not a code failure (B1 marks it `traceabilityDeficient`, never a bare `{green:false}` that would
  // fall into `attemptRepair` — an IMPLEMENTER that edits production code for a formatting gap — or the
  // generic fallback below, which defaults an unclassified block to `'error'`). Re-ask the SAME gate
  // ONCE, naming exactly what's missing, THEN replay the normal ladder on whatever it returns (`gate =
  // regate`, `traceabilityReasked: true` so this branch can never fire twice for one FRD this cycle — a
  // reviewer that is STILL incomplete on the second try is a genuine stop, not an infinite re-ask). If
  // the re-ask is STILL deficient with no reopen, block `needs-owner` directly — never `'error'`, because
  // this was never a code defect.
  if (gate && gate.traceabilityDeficient && (!gate.reopen || !gate.reopen.length) && !traceabilityReasked) {
    const missingClasses = gate.missingClasses || []
    log(`⚠ ${f.frd}: gate traceability contract incomplete (missing: ${missingClasses.join(', ') || 'see failure'}) — re-asking the SAME gate once before any repair (B2, BL-0157)`)
    const st = frdState.get(f.frd)
    const attemptNo = ((st && st.gateAttempts) || 0) + 1
    if (st) st.gateAttempts = attemptNo
    const directive = `**RE-ASK — your prior verdict's traceability inventory was INCOMPLETE (this is not a re-review of the code, judge the same work again):** your last \`traceability\` array had no entry for: ${missingClasses.join(', ') || 'a required contractClass'}. Every one of the 7 \`contractClass\` values (requirement, acceptance-criterion, invariant, edge-case, limit, error, exclusion) needs >= 1 entry. A REQ-NN-MMM requirement is its OWN \`requirement\` entry, distinct from the acceptance-criterion entries that test it. If a class genuinely does not apply to this FRD, add a \`not-applicable\` status entry for it with \`tests: []\` instead of omitting it. Re-submit your FULL verdict (green/reopen/findings unchanged unless your judgment of the code itself has changed) with a COMPLETE traceability inventory this time.`
    const regate = await finalizeGate(f.frd, reviewIds, await frdGateSerial(f.frd, reviewIds, attemptNo, null, null, directive))
    if (regate && regate.traceabilityDeficient && (!regate.reopen || !regate.reopen.length)) {
      const stillMissing = regate.missingClasses || missingClasses
      log(`⊘ ${f.frd}: gate traceability contract STILL incomplete after the re-ask (missing: ${stillMissing.join(', ') || 'see failure'}) — BLOCK needs-owner, never 'error' (B2, BL-0157)`)
      await persistGateBlock(f.frd, reviewIds, 'needs-owner', regate.failure || `gate traceability contract: missing ${stillMissing.join(', ')}`)
      blockFrd(f.frd, 'needs-owner', regate.failure || `gate traceability contract: missing ${stillMissing.join(', ')}`, regate.traceability)
      return 'blocked'
    }
    return await gateConverge(f, reviewIds, regate, true)
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
    if (gate.blocked_reason === 'needs-owner') await persistGateBlock(f.frd, reviewIds, 'needs-owner', gate.failure, !gate.__outcomeDeferred)   // BL-0185: a reviewer that deferred its emission (drift claim on the block) is emitted HERE instead. C2: the review-only gate classified but did not persist — write BLOCKED + decisions.md on main. alreadyTracked:true (BL-0159) — the reviewing agent's OWN prompt already emitted review_end/GateVerdict for this classification (frdGateSerial/frdGateSplit's inline 'blocked'/'fail' branch); persisting the state here must not re-emit a duplicate.
    blockFrd(f.frd, gate.blocked_reason, gate.failure, gate.traceability)
    return 'blocked'
  }

  // Gate failed with no specific reopen → TRY TO REPAIR, then re-gate ONCE (fail-closed).
  log(`! ${f.frd} gate failed${gate?.failure ? ': ' + gate.failure : ''} — attempting repair`)
  const fix = await attemptRepair(f.frd, 'the FRD review/integration gate failed: ' + (gate?.failure || 'unknown'), true)   // BL-0159: gateBlocked:true — a step-3 give-up here IS a gate's terminal outcome
  if (fix && fix.green === true) {
    gate = await frdGate(f.frd, reviewIds)
    if (gate && gate.green === true && isPartialReport(gate)) { refusePartial(f.frd, 'the post-repair re-gate'); reopenedFrds.push(f.frd); return 'reopened' }   // WP-08 cage
    if (gate && gate.green === true) { await applyGate(f.frd, reviewIds, gate.testFiles, null); log(`✓ ${f.frd} VERIFIED (after repair)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
  }
  // BL-0159: the post-repair re-gate above is ALSO wrapped by enforceWholeFrdTraceability (frdGate wraps
  // every call) and can come back a genuinely deficient-but-GREEN verdict the oracle downgraded WITHOUT
  // the reviewing agent ever taking its own reopen/blocked/fail branch — those self-emit inline; a
  // deficient green does not (the agent believed it was returning green; that telemetry is deferred to
  // applyGate, which this verdict never reaches). Left unhandled this fell straight to the bare 'error'
  // fallback below with ZERO review_end/GateVerdict trace — canary C gate 2's exact shape, reproducible
  // here independently of BL-0157's already-covered call sites (gateConverge's own top-of-function guard,
  // inRunRetry's). No repair budget is spent re-asking a THIRD gate this deep in the ladder — persist the
  // block directly (needs-owner, never the silent 'error' default) so it is always traced.
  if (gate && gate.traceabilityDeficient) {
    const missing = (gate.missingClasses || []).join(', ') || 'see failure'
    log(`⊘ ${f.frd}: post-repair re-gate traceability contract incomplete (missing: ${missing}) — BLOCK needs-owner, never 'error' (B2/BL-0159)`)
    await persistGateBlock(f.frd, reviewIds, 'needs-owner', gate.failure || `gate traceability contract: missing ${missing}`)
    blockFrd(f.frd, 'needs-owner', gate.failure || `gate traceability contract: missing ${missing}`, gate.traceability)
    return 'blocked'
  }
  const reason = (fix && fix.blocked_reason) || (gate && gate.blocked_reason) || 'error'
  const failureText = (fix && fix.failure) || (gate && gate.failure) || ''
  // BL-0185: the post-repair re-gate blocked needs-owner with a drift claim, so its reviewer deferred the
  // terminal emission to the engine — persist (and thereby emit) that block exactly once.
  if (gate && gate.__outcomeDeferred && reason === 'needs-owner') await persistGateBlock(f.frd, reviewIds, 'needs-owner', failureText)
  log(`⊘ ${f.frd}: BLOCKED (${reason})`)
  blockFrd(f.frd, reason, failureText, gate && gate.traceability)
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
// A gate worktree's lifecycle state (D1: one object per worktree — the single C2 worktree is LEGACY_SLOT;
// under args.parallelGates each pool slot carries its own):
//   state     'unknown' | 'ready' | 'failed' (failed → legacy synchronous path for LEGACY_SLOT; out of the pool for a slot)
//   lastSha   the sha it is checked out at (skip redundant checkout/install)
//   clean     BL-0183: true ONLY right after a probe's clean check or a gate release's verified-clean postcondition — the no-spawn fast path requires it
//   inFlight  BL-0150: the SHARED pending ensureGateWorktree() promise, memoized so a concurrent caller reuses it instead of spawning a second probe
//   inFlightSha  the sha inFlight is preparing — only a call for this SAME sha reuses it
//   busy      D1 only: the FRD whose gate occupies the slot (null = free)
const mkGateSlot = (id, path, port) => ({ id, path, port, state: 'unknown', lastSha: null, clean: false, inFlight: null, inFlightSha: null, busy: null })
const LEGACY_SLOT = mkGateSlot(0, GATE_WORKTREE, null)
let concurrentGates = null      // null = undecided (probe at the first gate); true = concurrent; false = legacy inline
let gateWorktreeChain = Promise.resolve()   // single worktree = one checkout at a time → serialize (checkout+review) among gates
const gatesInFlight = new Map() // frd -> promise (settled entries are deleted; size capped at MAX_CONCURRENT_GATES)
const gateResults = []          // settled gate verdicts awaiting main-loop processing: { f, reviewIds, gate }
const convergeQueue = []        // reject verdicts needing on-main convergence (drained under a quiesce): { f, reviewIds, gate }
function enqueueGateIfComplete(frd) {
  const st = frdState.get(frd)
  if (!st || st.enqueued || st.failed) return false
  if (PARALLEL_GATES && st.gateUnlanded) return false   // D1 #2: never queue a second gate of an FRD whose verdict has not landed (the landing re-checks)
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
  // BL-0171 defense-in-depth: a WO whose LITERAL `status:` frontmatter is DRAFT never passed the DR-100
  // readiness/grounding/consistency gate (/pandacorp:architecture step 9b2) — refuse to schedule OR gate
  // it, no matter which path let it reach the plan (the primary defense is gateChangeWorkOrders, above;
  // this is the fail-loud backstop, mirroring preflight-implement.sh §5's own "un-gated DRAFT work
  // order" check but INSIDE the run, not only at launch — never build a DRAFT WO). Mirrors preflight's
  // own carve-out too: a DRAFT WO already VERIFIED is a stable foundation (built before this field
  // existed), not a problem — only a NOT-yet-VERIFIED DRAFT WO is refused.
  const draftWos = f.workOrders.filter((w) => w.docStatus === 'DRAFT' && w.status !== 'VERIFIED')
  if (draftWos.length) log(`⊘ ${f.frd}: WO(s) ${draftWos.map((w) => w.id).join(', ')} are still \`status: DRAFT\` (never gated by /pandacorp:architecture's DR-100 readiness/grounding/consistency check) — refusing to build or gate them this run (needs-owner); route back to /pandacorp:architecture.`)
  const draftIds = new Set(draftWos.map((w) => w.id))
  const pending = f.workOrders.filter((w) => w.status !== 'VERIFIED' && w.status !== 'BLOCKED' && !draftIds.has(w.id))
  const toBuild = pending.filter((w) => w.status !== 'IN_REVIEW')   // IN_REVIEW = built by a prior interrupted run → straight to the gate, don't rebuild
  for (const w of f.workOrders) if ((w.status === 'VERIFIED' || w.status === 'IN_REVIEW') && !draftIds.has(w.id)) doneIds.add(w.id)
  for (const w of f.workOrders) if (w.status === 'BLOCKED' || draftIds.has(w.id)) blockedIds.add(w.id)   // WS-A/D3: a dep on this fails closed
  for (const w of toBuild) globalQueue.set(w.id, { wo: w, frd: f.frd })
  frdState.set(f.frd, { f, reviewIds: pending.map((w) => w.id), toBuildIds: new Set(toBuild.map((w) => w.id)), failed: false, enqueued: false, gateAttempts: 0 })   // gateAttempts: 1-based gate-attempt counter per FRD this run (B8 event field + C1a serial-first gate)
  log(`▶ ${f.frd}: ${toBuild.length} to build${pending.length - toBuild.length ? ` · ${pending.length - toBuild.length} already in review` : ''}`)
  enqueueGateIfComplete(f.frd)   // resume / drained bug-fix: an all-IN_REVIEW FRD goes straight to the gate
  // BL-0171: if excluding the DRAFT WO(s) above left NOTHING pending for this FRD (its only non-VERIFIED
  // work WAS the ungated WO), it would otherwise silently vanish from both the schedule AND the close-out
  // narrative (0 to build, never gate-eligible, never in blockedFrds). Surface it explicitly instead.
  if (draftIds.size && pending.length === 0 && f.workOrders.some((w) => w.status !== 'VERIFIED' && w.status !== 'BLOCKED')) {
    blockFrdInSchedule(f.frd, 'needs-owner')
  }
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
    startDriftFinder(frd, reviewIds, pinSha, worktreeWorkFrom(pinSha))   // BL-0203: idempotent — already running when launchEvidence prelaunched it
    const evidencePack = await resolveGateEvidence(frd, reviewIds, pinSha)
    // BL-0182: the gate + its RELEASE are ONE link of the worktree chain — the reviewer dirties the tree,
    // and the release (salvage + exact clean, whatever the verdict, even a crash) runs before the chain
    // admits the next gate, so the next acquisition finds a clean tree instead of falling back to legacy.
    LEGACY_SLOT.clean = false
    let gate
    let released = null
    try { gate = await frdGate(frd, reviewIds, worktreeWorkFrom(pinSha), evidencePack) }
    finally { released = await releaseGateWorktree(frd, gate) }
    return (gate && typeof gate === 'object') ? { ...gate, reviewerEvidence: released } : gate
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
      // BL-0182: port what the release SALVAGED (git's own list, repo-root-relative) from the evidence dir —
      // the worktree is already clean for the next gate. Only a gate with no release verdict falls back to
      // the declared list read straight from the worktree.
      const ev = gate.reviewerEvidence
      const ok = ev
        ? await applyGate(f.frd, reviewIds, ev.tests.map((x) => x.path), ev.dir)
        : await applyGate(f.frd, reviewIds, gate.testFiles, GATE_WORKTREE)
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
  while (convergeQueue.length) await convergeOne(convergeQueue.shift())
}
// ONE reject/blocked/failed verdict's convergence on main — shared by the C2 drain above and the D1 landing
// lane below (same ladder, same DR-080 port, byte-for-byte).
async function convergeOne(item) {
  if (item.__needsLegacy) { await gateAndConverge(item.f, item.reviewIds); return }   // worktree-failed gate → whole gate+converge on main
  // BL-0184: a C2 reopen's RED tests were salvaged from the worktree — port them onto the (quiesced)
  // main tree, sha256-pinned, BEFORE the patch ladder; a failed port never patches blind (DR-080).
  const ported = await portReviewerTests(item.f.frd, item.gate)
  if (ported === false) { await gateAndConverge(item.f, item.reviewIds); return }
  try { await gateConverge(item.f, item.reviewIds, item.gate) }
  finally { reviewerTestsByFrd.delete(item.f.frd) }
}

// ── D1 PARALLEL FRD GATES (args.parallelGates, proposal 38 Decision 1 + red-team addendum, BL-0186) ──────
// C2 overlaps a gate with the BUILD, but gates still serialize with EACH OTHER on one worktree, and any
// reject quiesces every in-flight gate before its ladder runs — canary D2's 57.6-min post-wave gate segment.
// Under the flag, three pieces replace that, and NOTHING else in the trust boundary moves:
//  1. A POOL of GATE_SLOTS worktrees (gatePool). A gate occupies one slot for its whole link — probe, digested
//     evidence (collected inline in the slot), review, drift proof, and the BL-0182 release in a `finally` —
//     so a crash still salvages and frees its slot. A slot that fails its probe (dirty, orphaned) leaves the
//     pool, loudly; only when EVERY slot has failed does the run fall to the legacy synchronous gate on main.
//  2. ELIGIBILITY. A gate launches only if its reviewed artifacts are disjoint from those of every FRD whose
//     verdict has not LANDED yet (DR-060's own artifactsOverlap, fail-safe on undeclared), and — outside the
//     idle path — none of its upstream FRDs (cross-FRD WO `deps`, transitive, plus FRD-level deps) is still
//     building or still queued for its own gate. A DEPENDENCY ORDERS ONLY THE LANDING (canary E2 §4.2: FRD-05
//     waited 23.2 min with a free slot for FRD-04's landing, then gated at its old pin anyway): a dependent's
//     gate runs in parallel with its upstream's, on its own pin, and its verdict waits in the lane until the
//     upstream's verdict has landed (landingHeldBy). Red-team R6 (B PASSES on its pin while A's ladder reverts
//     the WO B built on) is then caught where it always was: B lands after A, so the stale-pin guard sees A's
//     landed commits and re-verifies B `--since <pin>` on the tree A left.
//     BUDGET: maxAgents is cost-weighted — N opus reviewers launched together commit ~3N units at once. A gate
//     is launched alongside others only if the budget still covers its estimated cost + one landing after
//     reserving what the in-flight gates are expected to spend (reserved at launch, released at settle —
//     conservative in between); otherwise `gate deferred: agent budget`. With nothing in flight the first
//     eligible gate always launches (progress guarantee — the loop-top brake is still what stops the run).
//  3. ONE LANDING LANE on main. Verdicts land strictly one at a time, in arrival order (gateResults is
//     FIFO): PASS → stale-pin guard → applyGate; REJECT/BLOCK/crash → convergeOne (the unchanged DR-072/073/
//     117 ladder, BL-0184 port). The quiesce is gone — reviews in other slots never touch main — but a build
//     wave never overlaps a landing either: the loop lands, then `continue`s, so main keeps ONE writer at a
//     time and every shared document (decision records, work-order frontmatter + README rollups,
//     status.yaml, last_green_sha) is written only here, never from a gate.
//     STALE-PIN GUARD (red-team R5/X4): a PASS was judged at its pin; if main gained CODE commits since
//     (`git rev-list --count <pin>..HEAD` outside .pandacorp/ and docs/ — another landing's ported tests, a
//     patch, a revert), the reviewer's tests are ported FIRST and `verify.sh --since <pin>` re-runs on main
//     before anything is stamped; red → the PASS becomes a REOPEN with that failure and takes the ladder.
// Honest limits: `--since` is vitest `--changed` (import-affected tests), so a coupling through a fixture/JSON/
// CSS can still slip to the close-out FULL suite, which stays the final backstop (DR-118's stated limit).
// Contention (N reviewers × vitest/tsc/Playwright/next dev on one machine) is not modelled here — size
// gateSlots to the machine (the red-team measured 16 GB → 2).
const gatePool = PARALLEL_GATES ? Array.from({ length: GATE_SLOTS }, (_, i) => mkGateSlot(i + 1, gateSlotPath(i + 1), gateSlotPort(i + 1))) : []
let gateReserved = 0                    // cost-weighted units reserved by in-flight gates (released at settle, X10)
const GATE_LANDING_COST = 2             // one PASS landing on main: the stale-pin check + the apply (a re-verify adds 1)
// BL-0192: a REOPEN landing runs the patch ladder's first rungs on main: port the reviewer tests (1) + the patch
// (opus) + the hash check (1) + the verifier (1) + the certify stamp (1). Reserved for the landing in flight so the
// gates launched during it cannot starve it (a revert/retry beyond that is what the loop-top brake is for).
const GATE_LADDER_COST = 4 + COST('opus')
const liveSlots = () => gatePool.filter((x) => x.state !== 'failed')
const freeSlot = () => liveSlots().find((x) => !x.busy) || null
const deferredGateLog = new Map()       // frd -> the last deferral reason logged (one line per change, never per spin)
// FRD folder → the FRDs it DIRECTLY builds on: FRD-level deps + the owner FRD of every cross-FRD WO dep.
function frdDirectUpstream(frd, woOwner) {
  const st = frdState.get(frd)
  const up = new Set((st && st.f.deps) || [])
  for (const w of (st ? st.f.workOrders : [])) for (const d of (w.deps || [])) { const o = woOwner.get(d); if (o) up.add(o) }
  up.delete(frd)
  return up
}
// Transitive closure of frdDirectUpstream (a WO chain A→B→C across FRDs makes C upstream of A).
function frdUpstream(frd) {
  const woOwner = new Map()
  for (const [k, x] of frdState) for (const w of x.f.workOrders) woOwner.set(w.id, k)
  const seen = new Set()
  const stack = [frd]
  while (stack.length) for (const y of frdDirectUpstream(stack.pop(), woOwner)) if (y !== frd && !seen.has(y)) { seen.add(y); stack.push(y) }
  return seen
}
// The artifacts a gate's landing may touch = its reviewed WOs' globs; [] when ANY is undeclared, which
// artifactsOverlap reads as "overlaps everything" (fail-safe, DR-060).
function frdGateArtifacts(frd) {
  const st = frdState.get(frd)
  const wos = st ? st.f.workOrders.filter((w) => st.reviewIds.includes(w.id)) : []
  if (!wos.length || wos.some((w) => !(w.artifacts && w.artifacts.length))) return []
  return [...new Set(wos.flatMap((w) => w.artifacts))]
}
/**
 * Why `frd`'s gate may NOT run now, or null when it is eligible. (1) Disjoint artifacts with every FRD whose
 * verdict has not LANDED (DR-060). A dependency on such an FRD is NOT a reason: it orders the landing only
 * (landingHeldBy, E2 finding 1). (2) An upstream FRD still building, or still queued for its gate, gates
 * first — the dependent's pin could not contain code that does not exist yet, and a queued upstream would
 * otherwise land after it. `force` (the idle path, nothing left to build or in flight) waives (2) only.
 */
function gateConflict(frd, force = false) {
  const up = frdUpstream(frd)
  for (const [other, x] of frdState) {
    if (other === frd || !x.gateUnlanded) continue
    if (artifactsOverlap({ artifacts: frdGateArtifacts(frd) }, { artifacts: frdGateArtifacts(other) })) return `artifacts overlap ${other} (DR-060)`
  }
  if (!force) {
    for (const u of up) {
      const x = frdState.get(u)
      if (x && !x.failed && (x.toBuildIds.size > 0 || gateQueue.includes(u))) return `depends on ${u}, which has not gated yet (it lands first)`
    }
  }
  return null
}
// The cost-weighted units ONE gate link is expected to spend: probe + (digested collector) + (the BL-0203 drift
// finder, one sonnet unit) + the review (the split when frdGate would pick it) + the release. The drift proof is
// rare and not reserved.
function gateCostEstimate(frd) {
  const st = frdState.get(frd)
  const reviewed = st ? st.f.workOrders.filter((w) => st.reviewIds.includes(w.id)) : []
  const split = P.reviewSplit && (((st && st.gateAttempts) || 0) >= 1 || reviewed.some((w) => (w.reopen_count || 0) >= 1))
  return 1 + (GATE_EVIDENCE === 'digested' ? 1 : 0) + (DRIFT_FINDER ? COST('sonnet') : 0) + (split ? splitGateEstimatedCost() : COST(P.judge)) + 1
}
/**
 * E2 finding 1: the upstream FRD whose verdict must land BEFORE `frd`'s may (its gate is in flight or its verdict
 * waits in the lane), or null. A mutual pair (each upstream of the other through cross-FRD WO deps) cannot order
 * its landings, so it never holds — both land in arrival order and the second one's stale-pin guard re-verifies.
 */
function landingHeldBy(frd) {
  for (const u of frdUpstream(frd)) {
    const x = frdState.get(u)
    if (x && x.gateUnlanded && !frdUpstream(u).has(frd)) return u
  }
  return null
}
/**
 * Index in gateResults of the verdict the lane lands next: the oldest one no upstream verdict holds. -1 = every
 * settled verdict waits on a gate still in flight (the caller awaits one). With nothing in flight the head lands
 * anyway (a hold can only wait on a gate that will settle; landParallelVerdict logs the waiver).
 */
function nextLandingIndex() {
  if (!gateResults.length) return -1
  const i = gateResults.findIndex((r) => !landingHeldBy(r.f.frd))
  if (i >= 0) return i
  return gatesInFlight.size ? -1 : 0
}
const landingHoldLog = new Map()   // frd -> the upstream its held verdict was last logged waiting for
function logLandingHolds() {
  for (const r of gateResults) {
    const u = landingHeldBy(r.f.frd)
    if (!u || landingHoldLog.get(r.f.frd) === u) continue
    landingHoldLog.set(r.f.frd, u)
    log(`⏸ D1: ${r.f.frd}'s verdict waits to land: it depends on ${u}, whose verdict has not landed yet (a dependency orders the landing, not the gate — E2 finding 1)`)
  }
}
function logGateDeferral(frd, why) {
  if (deferredGateLog.get(frd) === why) return
  deferredGateLog.set(frd, why)
  log(`⏸ D1: gate for ${frd} deferred: ${why}`)
}
// Start ONE gate as a background promise that owns `slot` from probe to release.
function launchGateInSlot(frd, slot, est) {
  const st = frdState.get(frd)
  // SNAPSHOTS, never live references (red-team of this change, #2): a safe point may re-enroll an unblocked WO
  // into this FRD (reviewIds.push, a later re-pin) while this gate is in flight — the verdict must land
  // exactly the WOs this gate reviewed, judged at exactly the pin it reviewed.
  const pinSha = st.pinSha
  const reviewIds = [...st.reviewIds]
  slot.busy = frd
  st.gateSlotPath = slot.path
  st.gateUnlanded = true
  gateReserved += est
  deferredGateLog.delete(frd)
  log(`▶ D1: gate ${frd} → slot ${slot.id} (${slot.path}, e2e port ${slot.port}) · ${gatesInFlight.size + 1}/${GATE_SLOTS} in flight`)
  const work = (async () => {
    const ok = await ensureGateWorktree(pinSha, slot)
    if (!ok) return { __worktreeFailed: true, __slotDirty: Boolean(slot.failedOnDirt) }
    startDriftFinder(frd, reviewIds, pinSha, worktreeWorkFrom(pinSha, slot.path))   // BL-0203: beside the collector, in this slot
    const evidencePack = await resolveGateEvidence(frd, reviewIds, pinSha)   // digested: collected INLINE in this slot (launchEvidence is a no-op under D1)
    slot.clean = false
    let gate
    let released = null
    try { gate = await frdGate(frd, reviewIds, worktreeWorkFrom(pinSha, slot.path), evidencePack) }
    finally { released = await releaseGateWorktree(frd, gate, slot) }   // BL-0182: salvage + exact clean, whatever the verdict — even a crash
    return (gate && typeof gate === 'object') ? { ...gate, reviewerEvidence: released } : gate
  })()
  // ONE settle handler (ok or crash): the verdict joins the landing FIFO, and the slot + its reservation are
  // freed in the same tick, so a free slot always means "no gate in flight there".
  const settle = (gate) => { gatesInFlight.delete(frd); slot.busy = null; gateReserved -= est; gateResults.push({ f: st.f, reviewIds, pin: pinSha, gate, slot: slot.id }); laneTopUp() }   // BL-0192: a slot freed mid-landing is refilled now
  const tracked = work.then(settle, (e) => settle({ green: false, blocked_reason: 'error', failure: `gate crashed: ${(e && e.message) || e}` }))
  gatesInFlight.set(frd, tracked)
}
// Fill free slots from gateQueue (FIFO, skipping what is not eligible yet). Returns false iff the pool has
// no live slot left — the caller then takes the legacy synchronous path for the rest of the run. `force`: see
// gateConflict (the idle path's progress guarantee).
function launchParallelGates(force = false, pinnedOnly = false) {
  if (!liveSlots().length) {
    if (concurrentGates !== false) log(`⚠ D1: every gate slot failed — falling back to the LEGACY synchronous gate path for the rest of the run`)
    concurrentGates = false
    return false
  }
  if (concurrentGates === null) { concurrentGates = true; log(`▹ D1: PARALLEL FRD gates — up to ${GATE_SLOTS} gate(s) review at once in ${gatePool.map((x) => x.path).join(', ')}; verdicts land on main one at a time (args.parallelGates)`) }
  for (let i = 0; i < gateQueue.length;) {
    const slot = freeSlot()
    if (!slot) break
    const frd = gateQueue[i]
    if (frdState.get(frd) && frdState.get(frd).gateUnlanded) { logGateDeferral(frd, 'its previous gate has not landed yet'); i++; continue }   // #2: never two gates of one FRD
    const why = gateConflict(frd, force)
    if (why) { logGateDeferral(frd, why); i++; continue }
    // BL-0192: mid-landing, main's HEAD may hold the ladder's uncertified patch commit — never pin a gate there; an
    // unpinned FRD waits for the next pre-landing top-up, which pins it at the quiet pre-landing HEAD.
    if (pinnedOnly && !(frdState.get(frd) || {}).pinSha) { logGateDeferral(frd, 'no pin yet — a landing is in flight; it is pinned at the next pre-landing HEAD'); i++; continue }
    const est = gateCostEstimate(frd)
    const pipelineBusy = gatesInFlight.size > 0 || gateResults.length > 0 || Boolean(landingInFlight)
    if (MAX_AGENTS && pipelineBusy) {
      const laneReserve = laneReserveLeft()
      const remaining = MAX_AGENTS - agentSpawned - gateReserved - laneReserve
      if (remaining < est + GATE_LANDING_COST) {
        logGateDeferral(frd, `agent budget — ~${est} units for the gate + ${GATE_LANDING_COST} for its landing, only ${remaining} left after reserving ${gateReserved} for ${gatesInFlight.size} gate(s) in flight${laneReserve ? ` and ${laneReserve} for the landing in progress` : ''} (maxAgents ${MAX_AGENTS})`)
        i++
        continue
      }
    }
    gateQueue.splice(i, 1)
    launchGateInSlot(frd, slot, est)
  }
  return true
}
// Re-verify a PASS on the MAIN tree at landing time (the stale-pin guard's second half). MECH: it ports the
// reviewer's tests FIRST (X4 — they must run against the landing tree), runs verify.sh --since <pin>, runs the
// ported tests by path, and returns the report's verdict; the ENGINE decides.
const REVERIFY_SCHEMA = { type: 'object', required: ['green'], properties: { green: { type: 'boolean' }, failure: { type: 'string' }, report_scope: REPORT_SCOPE, gateReport: FRD_GATE_SCHEMA.properties.gateReport } }
async function reverifyAtLanding(frd, gate, pin, count) {
  const ev = gate && gate.reviewerEvidence
  const files = ev ? ev.tests.map((x) => x.path) : ((gate && gate.testFiles) || []).filter(Boolean)
  const since = pin ? `--since ${pin}` : ''
  agentSpawned++
  try {
    return await agent(`MECHANICAL GATE RE-RUN — D1 stale-pin guard for ${frd} (BL-0186; BL-0179 stamps the report's scope). The review-only gate for ${frd} PASSED at pin ${pin || '(unknown)'}, but the MAIN tree gained ${count >= 0 ? count : 'an unknown number of'} code commit(s) since then, so the verdict may not describe the tree it would certify. Re-run the objective gate on the MAIN tree at HEAD before anything is stamped. You judge nothing, fix nothing, stage nothing, commit nothing. Do EXACTLY, in order:
  1) PORT FIRST (the reviewer's adversarial tests must run against the landing tree):${files.length && ev ? ` each \`${ev.dir}/<path>\` goes to \`<repo root>/<path>\` (${files.join(', ')}) — run this port command VERBATIM, as ONE Bash call: \`${repoRootPortCommand(ev.dir, files)}\`. ${REPO_ROOT_PATHS_NOTE}` : files.length ? ` the reviewer's test files (${files.join(', ')}) must be present on this tree; if one is missing, say so in \`failure\` and return green:false.` : ' (the gate left no test files — skip this step).'}
  2) Run \`bash .pandacorp/verify.sh ${since}\` — NEVER with \`--only\`/\`--files\` (a scoped run stamps scope:"partial" and certifies nothing). It may exit non-zero; that is data.
  3) ${files.length ? `Run EACH of the reviewer's test files explicitly by path — \`pnpm vitest run "$(git rev-parse --show-toplevel)/<path>"\` (a Playwright spec: \`pnpm playwright test "$(git rev-parse --show-toplevel)/<path>"\`): ${files.join(', ')}.` : 'No reviewer test files to run.'}
  4) Read \`.pandacorp/run/gate-report.json\` and return { green: <true ONLY if that report is green AND every step-3 run passed>, report_scope: <its \`scope\` VERBATIM>, failure: <one sentence naming the first red sub-gate or test>, gateReport: <the report verbatim when it is red> }.`,
      { label: `reverify:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: REVERIFY_SCHEMA })
  } catch (e) { log(`⚠ D1: the landing re-verify for ${frd} threw (${(e && e.message) || e}) — treated as RED (fail-closed)`); return null }
}
const STALE_PIN_SCHEMA = { type: 'object', required: ['count'], properties: { count: { type: 'number', description: 'the integer the command printed; -1 if it failed' }, failure: { type: 'string' } } }
/**
 * D1 stale-pin guard for a PASS about to land. Returns null when it may land as reviewed, else the REOPEN
 * verdict it becomes (the re-verify on the landing tree was red, partial, or produced nothing — fail-closed).
 */
async function stalePinGuard(frd, reviewIds, gate, launchPin) {
  const pin = launchPin || null   // the pin THIS gate reviewed (snapshotted at launch), never a later re-pin
  let count = -1
  if (pin) {
    agentSpawned++
    let r = null
    try {
      r = await agent(`MECHANICAL COMMAND RUNNER — D1 stale-pin guard for ${frd} (BL-0186). Execute exactly this command once, from anywhere, and return the integer it prints as \`count\`: \`git -C ${PROJECT_DIR} rev-list --count ${pin}..HEAD -- . ':(exclude).pandacorp' ':(exclude)docs'\` — the MAIN-tree commits since the pin ${pin} that touched CODE (anything outside .pandacorp/ and docs/). Change nothing. If the command fails, return { count: -1, failure: "<its error>" }.`,
        { label: `stale-pin:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STALE_PIN_SCHEMA })
    } catch (e) { log(`⚠ D1: the stale-pin check for ${frd} threw (${(e && e.message) || e}) — re-verifying (fail-closed)`) }
    count = (r && Number.isInteger(r.count) && r.count >= 0) ? r.count : -1
  }
  if (count === 0) { log(`◦ D1: no code commit on main since ${frd}'s pin ${pin} — its verdict lands as reviewed`); return null }
  log(`↻ D1: main ${count > 0 ? `gained ${count} code commit(s)` : 'may have advanced (the count is unknown)'} since ${frd}'s pin ${pin || '(none)'} — porting its reviewer tests and re-verifying with verify.sh ${pin ? `--since ${pin}` : '(full)'} on main before landing (stale-pin guard)`)
  const rv = await reverifyAtLanding(frd, gate, pin, count)
  if (rv && rv.green === true && !isPartialReport(rv)) { log(`✓ D1: ${frd} re-verified green on the landing tree — landing its PASS`); gate.__reverified = true; return null }
  if (rv && rv.green === true) refusePartial(frd, 'the landing re-verify')
  const failure = `D1 stale-pin guard: main advanced since the gate's pin ${pin || '(none)'} and \`verify.sh ${pin ? `--since ${pin}` : ''}\` on the landing tree is RED${rv && rv.failure ? `: ${rv.failure}` : rv ? '' : ' (no verdict)'}`
  log(`⊘ ${frd}: ${failure} — the PASS is converted into a REOPEN (patch-first on main); it is never stamped VERIFIED over an unverified combination`)
  const tests = gate && gate.reviewerEvidence ? gate.reviewerEvidence.tests.map((x) => x.path) : []
  return {
    ...gate, green: false, reopen: [...reviewIds], failure,
    findings: [{ wo: reviewIds[0], finding: `${failure}. The gate passed at its pin; the combination with what landed on main since is red — find the interaction in \`git diff ${pin || '<pin>'}..HEAD\`.`, failingTest: tests.length ? tests.join(', ') : '(see the gate report)', files: [] }],
    gateReport: (rv && rv.gateReport) || (gate && gate.gateReport), report_scope: rv && rv.report_scope,
  }
}
// ── BL-0192: the landing lane no longer starves the gate slots ────────────────────────────────────────
// The lane was awaited inline at the loop top and launchParallelGates() ran only AFTER it, so while one verdict
// converged (a whole patch ladder: port, patch, verify, revert, retry, re-gate) every slot freed meanwhile stayed
// idle (canary E: ≈28 slot-minutes idle, FRD-04/05 never gated in 36 min). Slots never touch main — each is a
// detached worktree at its own pin, and stalePinGuard re-verifies on main any PASS whose pin main has moved past —
// so a gate may start while a verdict lands. Two refill points: (1) topUpBeforeLanding, right before each landing
// (pins unpinned queued FRDs at the quiet pre-landing HEAD, then fills the slots the previous settle freed);
// (2) laneTopUp, at every agent boundary of the ladder and at every gate settle while the landing runs — PINNED
// FRDs only (a mid-ladder HEAD may hold an uncertified patch). Only GATES start early: main keeps one writer (the
// lane), no build wave is dispatched until the landing returns, and the lane itself stays exclusive.
const landingCostOf = (gate) => (gate && gate.green !== true && Array.isArray(gate.reopen) && gate.reopen.length ? GATE_LADDER_COST : GATE_LANDING_COST)
// The part of the in-flight landing's reserve it has not spent yet (conservative: any spawn counts against it).
const laneReserveLeft = () => (landingInFlight ? Math.max(0, landingInFlight.reserve - (agentSpawned - landingInFlight.spawnedAt)) : 0)
function laneTopUp() {
  if (!landingInFlight || concurrentGates !== true || !gateQueue.length || !freeSlot()) return
  try { launchParallelGates(false, true) } catch (e) { log(`⚠ D1: mid-landing slot refill failed (${(e && e.message) || e}) — the loop refills after the landing`) }
}
async function topUpBeforeLanding(idx = 0) {
  if (concurrentGates !== true || !gateQueue.length || !freeSlot()) return
  const unpinned = gateQueue.filter((x) => { const st = frdState.get(x); return st && !st.pinSha })
  if (unpinned.length) await capturePin(unpinned)   // the pre-landing HEAD: nothing of the coming ladder is on main yet
  landingInFlight = { frd: gateResults[idx].f.frd, spawnedAt: agentSpawned, reserve: landingCostOf(gateResults[idx].gate) }   // reserve the landing's cost BEFORE the refill spends the budget
  try { launchParallelGates() } finally { landingInFlight = null }
}
// Land ONE settled verdict on main (the lane) — gateResults[idx], picked by nextLandingIndex (arrival order among
// the verdicts no upstream holds). `final` (post-loop): a verdict whose slot failed is gated on main right away
// instead of being re-queued for another slot — and no slot is refilled (the run is stopping).
async function landParallelVerdict(final = false, idx = 0) {
  const [{ f, reviewIds, pin, gate }] = gateResults.splice(idx, 1)
  const st = frdState.get(f.frd)
  const heldBy = landingHeldBy(f.frd)
  if (heldBy) log(`⚠ D1: ${f.frd} lands before ${heldBy}'s verdict — nothing else can land and no gate is in flight (a dependency cycle through WO deps; the hold is waived)`)
  landingHoldLog.delete(f.frd)
  gateSettledSinceSafePoint = true
  if (!final) landingInFlight = { frd: f.frd, spawnedAt: agentSpawned, reserve: landingCostOf(gate) }
  const builtBefore = builtFrds.length
  let ported = false   // did THIS landing copy the reviewer's tests onto main (re-verify or the reopen port)?
  try {
    if (gate && gate.__worktreeFailed) {
      // Only DIRT is slot-specific (another slot may be clean) — and even then once per FRD: any other probe
      // failure (unreachable sha, bootstrap) would just burn the next slot the same way. Else: gate on main.
      if (!final && gate.__slotDirty && st && !st.slotRequeued && liveSlots().length) {
        st.slotRequeued = true
        log(`↻ D1: ${f.frd}'s gate slot was dirty — re-queued ONCE for another slot (${liveSlots().length} live)`)
        gateQueue.unshift(f.frd)
        return
      }
      await convergeOne({ f, reviewIds, gate: null, __needsLegacy: true })
      return
    }
    if (gate && gate.green === true && isPartialReport(gate)) { refusePartial(f.frd, 'the parallel FRD gate'); reopenedFrds.push(f.frd); return }
    if (gate && gate.green === true) {
      const ev = gate.reviewerEvidence
      if (!ev) {
        // The release's evidence is the ONLY copy of this gate's tests and report — its slot may already hold
        // another FRD's gate, so never read it. Fail loud: re-gate this FRD on the quiet main tree instead.
        log(`⊘ D1: ${f.frd}'s PASS carries no salvaged evidence (its release returned nothing) — NOT applying from a slot another gate may now occupy; re-gating it on main`)
        await convergeOne({ f, reviewIds, gate: null, __needsLegacy: true })
        return
      }
      const reopened = await stalePinGuard(f.frd, reviewIds, gate, pin)
      if (reopened || gate.__reverified) ported = ev.tests.length > 0
      if (reopened) { await convergeOne({ f, reviewIds, gate: reopened }); return }
      const ok = await applyGate(f.frd, reviewIds, ev.tests.map((x) => x.path), ev.dir)
      if (ok) { log(`✓ ${f.frd} VERIFIED (parallel gate, landed on main)`); builtFrds.push(f.frd); consecutiveBlocks = 0; return }
      ported = ported || ev.tests.length > 0   // the apply agent may have copied them before failing
      await convergeOne({ f, reviewIds, gate })   // apply failed → converge (repair) on main, exactly as C2's harvest does
      return
    }
    ported = Boolean(gate && Array.isArray(gate.reopen) && gate.reopen.length && gate.reviewerEvidence && gate.reviewerEvidence.tests.length)
    await convergeOne({ f, reviewIds, gate })   // reject / block / crash → the unchanged ladder, in the lane
  } finally {
    landingInFlight = null
    if (st) st.gateUnlanded = false
    // A landing that did NOT certify the FRD may leave the reviewer's ported tests UNTRACKED on main (a block,
    // a budget stop, a deferred reopen) — and the next landing's `verify.sh --since` (vitest --changed runs
    // untracked files) would execute them against another FRD: a chain of false reopens. Remove exactly those
    // copies (the evidence dir keeps the originals). A certified landing committed them.
    if (ported && builtFrds.length === builtBefore) await unportReviewerTests(f.frd, gate.reviewerEvidence)
    // #2: an unblocked WO the safe point re-enrolled while this gate was in flight could not be queued then
    // (enqueueGateIfComplete refuses an unlanded FRD) — queue it now, re-pinned at the current HEAD.
    if (st && !gateQueue.includes(f.frd) && enqueueGateIfComplete(f.frd)) { st.pinSha = null; log(`↻ D1: ${f.frd} gained work while its gate was in flight — queued for a fresh gate at HEAD`) }
  }
}
// Remove the reviewer's ported test copies that are still UNTRACKED on main and byte-identical to the salvaged
// originals (sha256) — nothing tracked, nothing edited since, never anything else. MECH, zero judgment.
const UNPORT_SCHEMA = { type: 'object', properties: { removed: { type: 'array', items: { type: 'string' } }, kept: { type: 'array', items: { type: 'string' } } } }
async function unportReviewerTests(frd, ev) {
  if (!ev || !ev.tests.length) return
  agentSpawned++
  let r = null
  try {
    r = await agent(`MECHANICAL COMMAND RUNNER — D1 lane cleanup for ${frd} (BL-0186). This landing did NOT certify ${frd}, so the reviewer's test copies ported onto the MAIN tree must not stay behind as untracked files (the next landing's \`verify.sh --since\` would run them). The originals stay in ${ev.dir}. First run \`${REPO_TOP_ASSIGN}\` (the repository root) in the same Bash call as the checks below. ${REPO_ROOT_PATHS_NOTE} For EACH entry of EXPECTED: if \`"$TOP"/'<path>'\` exists AND \`git -C "$TOP" --literal-pathspecs ls-files --error-unmatch -- '<path>'\` FAILS (it is untracked) AND \`shasum -a 256 "$TOP"/'<path>'\` equals its sha256, run \`git -C "$TOP" --literal-pathspecs clean -f -- '<path>'\` and add the path to \`removed\`; otherwise touch nothing and add it to \`kept\` (tracked, edited, or already gone). Never a blanket clean, stage nothing, commit nothing. EXPECTED (JSON): ${JSON.stringify(ev.tests)}. Return { removed, kept }.`,
      { label: `unport-reviewer-tests:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: UNPORT_SCHEMA })
  } catch (e) { log(`⚠ D1: the lane cleanup for ${frd} threw (${(e && e.message) || e}) — untracked reviewer test copies may remain on main`) }
  const removed = (r && Array.isArray(r.removed)) ? r.removed : []
  const kept = (r && Array.isArray(r.kept)) ? r.kept : []
  log(`◦ D1: ${frd} did not land VERIFIED — removed ${removed.length} untracked reviewer test cop${removed.length === 1 ? 'y' : 'ies'} from main${kept.length ? `; left in place (tracked/edited/gone): ${kept.join(', ')}` : ''} (originals kept in ${ev.dir})`)
}
// Run-end invariant (C2-v, kept): every gate already spawned is waited for and its verdict landed.
async function drainParallelGates() {
  while (gatesInFlight.size || gateResults.length) {
    const idx = nextLandingIndex()
    if (idx < 0) { logLandingHolds(); await Promise.race([...gatesInFlight.values()]) }
    else await landParallelVerdict(true, idx)
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
  // F5/BL-0177: the ceiling can be reached on the SAME pass that finishes all remaining work (the
  // closing agents — visual-qa/close-out-verify/notify-end — run outside this brake by design, so
  // agentSpawned can cross MAX_AGENTS one beat after the last real gate/apply already cleared the
  // queues). Reporting 'agents' then is cosmetic-wrong: canary D2 narrated "Paro por techo de
  // agentes" for a run that had nothing left to build or gate. Only call it an agent-cap STOP when
  // work actually remains; otherwise fall through unlabeled (stopReason stays null = ran to
  // completion) and let the natural end-of-queue check a few lines below close the run honestly.
  if (MAX_AGENTS && agentSpawned >= MAX_AGENTS) {
    const workRemains = globalQueue.size > 0 || gateQueue.length > 0 || gatesInFlight.size > 0 || gateResults.length > 0 || convergeQueue.length > 0
    if (workRemains) { stopReason = 'agents'; log(`Agent ceiling reached (${agentSpawned} ≥ maxAgents ${MAX_AGENTS}) — stopping at a safe point`); break }
    log(`Agent ceiling reached (${agentSpawned} ≥ maxAgents ${MAX_AGENTS}) but no work remains (F5/BL-0177) — closing normally, not an agent-cap stop`)
  }
  if (MAX_SPEND && budget.spent() >= MAX_SPEND) { stopReason = 'budget'; log(`Spend ceiling reached (${Math.round(budget.spent() / 1000)}k ≥ maxSpend ${Math.round(MAX_SPEND / 1000)}k) — stopping at a safe point`); break }
  if ((builtFrds.length + blockedFrds.length + reopenedFrds.length) >= MAX_FRDS) { stopReason = 'maxFrds'; log(`Reached the test cap maxFrds=${MAX_FRDS} (built+blocked+reopened) — stopping at a safe point`); break }
  if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) { stopReason = 'blocks'; break }

  if (PARALLEL_GATES) {
    // ── D1 landing lane: land ONE settled verdict (arrival order) on main, then re-check the brakes and the
    // pool — no quiesce: the other slots keep reviewing; no wave dispatch overlaps a landing. ──
    if (gateResults.length) {
      const idx = nextLandingIndex()   // E2 finding 1: a verdict whose upstream has not landed waits; the loop goes on
      if (idx >= 0) { await topUpBeforeLanding(idx); await landParallelVerdict(false, idx); continue }   // BL-0192: refill free slots FIRST
      logLandingHolds()
    }
  } else {
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
  // D1: under args.parallelGates the pool takes this step (per-slot lazy probes, eligibility, budget);
  // launchParallelGates() returns false only once EVERY slot has failed → the legacy path below. An FRD the
  // safe-point drain enrolled already gate-ready carries no pin (only wave closes and the pre-loop resume pin);
  // a slot probed at an undefined sha would fail and leave the pool, so it is pinned at the current HEAD first.
  if (PARALLEL_GATES && concurrentGates !== false) {
    const unpinned = gateQueue.filter((x) => { const st = frdState.get(x); return st && !st.pinSha })
    if (unpinned.length) await capturePin(unpinned)
  }
  if (gateQueue.length && !(PARALLEL_GATES && concurrentGates !== false && launchParallelGates())) {
    if (concurrentGates === null) {
      concurrentGates = await ensureGateWorktree(frdState.get(gateQueue[0]).pinSha)   // probe → creates the worktree at the first pin
      log(concurrentGates ? '▹ C2: gates run CONCURRENTLY with builds in a pinned worktree' : '↩ C2: legacy synchronous gate path (worktree unavailable) for the whole run')
    }
    if (concurrentGates && LEGACY_SLOT.state !== 'failed') {
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
    if (PARALLEL_GATES && (gatesInFlight.size || gateResults.length)) {
      if (nextLandingIndex() < 0) await Promise.race([...gatesInFlight.values()])   // D1: wait for ONE verdict (or the upstream a held one waits on); it lands at the loop top
      continue
    }
    if (gatesInFlight.size || gateResults.length || convergeQueue.length) { await settleGates(false); continue }
    if (PARALLEL_GATES && gateQueue.length && concurrentGates !== false) {
      // Nothing left to build and nothing in flight, yet gates wait — only rule (2) of gateConflict can do
      // that (e.g. two FRDs whose WOs depend on each other across FRDs): waive it so the run progresses.
      log(`⚠ D1: ${gateQueue.length} gate(s) still wait on each other's landing with nothing left to build or in flight — waiving the landing-order rule for the head of the queue so the run progresses`)
      if (launchParallelGates(true) && gatesInFlight.size) continue
    }
    if (PARALLEL_GATES && gateQueue.length) {
      // Unreachable by construction (with nothing in flight the first queued gate is always eligible and
      // launched) — but a queued gate must never be dropped silently: gate it on main instead.
      const frd = gateQueue.shift()
      log(`⚠ D1: ${frd} is gate-ready but no parallel gate could start with nothing in flight — gating it on main (legacy) rather than dropping it`)
      const st = frdState.get(frd)
      await gateAndConverge(st.f, st.reviewIds)
      continue
    }
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
  // D1: under parallelGates the units the in-flight gates are expected to spend are reserved (gateReserved) — a
  // wave never plans on budget those gates are about to consume.
  const remainingAgents = MAX_AGENTS ? Math.max(1, MAX_AGENTS - agentSpawned - (PARALLEL_GATES ? gateReserved : 0)) : Infinity
  const { picked: wave, cutBy: waveCutBy } = pickDisjointWave(candidates, P.wave, remainingAgents, woWaveCost)   // DR-060: never co-schedule overlapping artifacts — now across FRDs; DR-073/D2: cost-budgeted width
  const waveFrds = [...new Set(wave.map((w) => w._frd))]
  log(`⚒ wave: ${wave.length} WO(s) across ${waveFrds.length} FRD(s) — ${wave.map((w) => w.id).join(', ')}`)
  // BL-0173: a wave silently collapsed to exactly 1 WO by pre-wave agent-BUDGET overhead (not a real
  // dependency/artifact/count stall) used to be indistinguishable from "only 1 WO was genuinely ready" —
  // canary-d measured this exact shape (maxAgents:8, agentSpawned:11 before wave 1, 4 disjoint WOs ready,
  // only 1 dispatched). Call it out loudly the moment it happens so the owner reads the REAL reason
  // instead of mis-diagnosing a scheduler/dependency bug.
  if (waveCutBy === 'agent-budget' && wave.length === 1 && candidates.length > 1) {
    log(`⚠ oleada reducida a 1 WO por presupuesto de agentes agotado (agentSpawned=${agentSpawned} ≥ maxAgents=${MAX_AGENTS}, remainingAgents=${remainingAgents}) — ${candidates.length - 1} WO(s) más estaban listos y disjuntos pero no caben en el presupuesto restante. Esto NO es un recorte por dependencias/artefactos/tope de conteo (P.wave=${P.wave}).`)
  }
  // WP-09: name WHY each non-elected candidate was deferred (deps pending / artifacts overlap / blocked
  // by the foundation gate or the wave cap) — reuses pickDisjointWave's own artifactsOverlap, unmodified,
  // so a stalled wave is diagnosable from the log alone instead of re-deriving the scheduler's reasoning.
  const wavePicked = new Set(wave.map((w) => w.id))
  const deferred = [...globalQueue.values()].map(({ wo }) => wo).filter((wo) => !wavePicked.has(wo.id)).map((wo) => {
    const unmetDeps = (wo.deps || []).filter((d) => !(doneIds.has(d) || (!globalQueue.has(d) && !blockedIds.has(d))))
    if (unmetDeps.length) return `${wo.id}(deps:${unmetDeps.join('+')})`
    if (!candidates.some((c) => c.id === wo.id)) return `${wo.id}(blocked:foundation-pending)`
    const overlapsWith = wave.find((p) => artifactsOverlap(p, wo))
    // BL-0173: the deferred-reason label itself now names an agent-budget cut distinctly from a real
    // count-cap (P.wave) cut — both used to print the same generic '(blocked:wave-cap)'.
    return overlapsWith ? `${wo.id}(artifacts:${overlapsWith.id})` : `${wo.id}(blocked:${waveCutBy === 'agent-budget' ? 'agent-budget' : 'wave-cap'})`
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
  // BL-0138 path 1: bracket the wave's own build barrier with a real-token delta, attributed to
  // buildTokensByFrd only when this wave is single-FRD (see recordWaveBuildTokens's own comment for why
  // a multi-FRD wave's delta can't be split among its FRDs).
  const waveBuildTokensBefore = budget.spent()
  const gatesAlongsideWave = PARALLEL_GATES ? gatesInFlight.size : 0   // D1: parallel gates reviewing during this wave spend into the same counter
  const results = await parallel(wave.map((w) => () => buildWO(w, w._frd)))
  if (gatesAlongsideWave) for (const frd of waveFrds) markTokensUnreliable(frd, `${gatesAlongsideWave} parallel gate(s) were reviewing during its build wave`)
  else recordWaveBuildTokens(waveFrds, budget.spent() - waveBuildTokensBefore)
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
if (PARALLEL_GATES) await drainParallelGates()   // D1: the same invariant, landed through the one lane
else {
  await settleGates(true)
  await drainConverge()
}

// ── Close-out shared prompt fragments (WP-02) — defined ONCE, reused byte-identically by both the
// lean (default) and legacy (args.leanCloseOut:false) shapes below, so the ACTUAL agent instructions
// never fork between the two — only the ORCHESTRATION around them (when they fire, how many spawns) does.
// E2 finding 5: canary E2's visual-qa answered {done:false} in its first turn with 0 tool calls. Its prompt was
// byte-identical to D2's (12 min of real work there); the one new input was a harness relay, present in all 38 E2
// transcripts and in none of D2's/E1's, of an unrelated owner question to the orchestrating session, framed as "the
// user request … this request wins". The step now says how to read such a relay, and a done:false must carry its
// reason (VISUAL_QA_SCHEMA), which the engine logs — a no-op is never silent again. BL-0198 tracks the harness side.
const VISUAL_QA_SCHEMA = { type: 'object', required: ['done'], properties: { done: { type: 'boolean' }, reason: { type: 'string', description: 'REQUIRED when done is false: the step that could not complete and why (e.g. "step 1: the dev server does not start: <error>")' } } }
const VISUAL_QA_SCOPE = 'THIS STEP\'S SCOPE: your task is the engine-computed END-OF-BUILD VISUAL QA below. The harness may ALSO relay a message the owner sent to the ORCHESTRATING session (for example a question about how the run delegates its work); when that relayed message does not mention this visual QA pass or these FRDs, it is not addressed to this step: do not answer it, do not stop because of it, do the steps below. Only a relayed message that explicitly asks to skip or change THIS visual QA pass changes it — then return done:false with a reason that quotes it. Return done:false ONLY after attempting the steps, always with `reason` naming the step that could not complete.\n'
const visualQaPromptBody = (frds) =>
  `${EMIT('reviewer', 'visual-qa', { phase: 'review', activity: 'visual-qa' })}${VISUAL_QA_SCOPE}END-OF-BUILD VISUAL QA (DR-072) — the dedicated fidelity pass, scoped to the FRDs VERIFIED this run: ${frds.join(', ')}. This is a PUNCH-LIST + bounded DIRECT fixes, NOT a re-gate: NEVER reopen a work order or send anything back to the build loop (that restarts the churn). Compare, list, fix the cheap ones, leave the rest for the owner.
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

// ── BL-0147: don't re-pay the FULL whole-project verify.sh at close-out/notify-end when a full,
// GREEN gate-report.json for this EXACT commit was already produced minutes earlier (measured on
// canary A/B2/C: ~8-10 min and several $ burned re-proving an already-proven fact). The engine has no
// fs/shell of its own, so the decision is a single cheap MECH read-only spawn — never the engine
// trusting a stale in-memory belief. Reuse is opt-in and narrow: ONLY scope:"full" + green:true +
// sha==HEAD + a clean tree + a report no older than REUSE_MAX_AGE_SECONDS counts; any doubt keeps the full
// rerun. The engine re-checks those fields itself on the agent's answer (checkFullVerifyReuse), so a check
// agent that says canReuse:true on anything less is overruled.
// E2 finding 7 — BL-0179's "since" arm (a since-scoped report anchored at the current last_green_sha) is
// RETIRED. It never fired live (0 CloseOutVerifyReused events in the whole history, canaries D and E2), and its
// premise is false: every landing publishes last_green_sha from a `since`-scoped report (E2's apply-gate:frd-05
// read `"scope": "since"` and published 4ceac8e0), so last_green_sha is never itself full-certified and a report
// "since last_green_sha" stacks since on since. The close-out FULL suite is the declared backstop for
// `--since`'s blind spots (vitest --changed; build-orchestration §5c honest limits) — it is not reusable from a
// since report. A "partial" report never counts either (the WP-08 cage).
const REUSE_MAX_AGE_SECONDS = 900   // 15 min — generous over the canary's "a few minutes" gap, never long enough to plausibly hide drift within the same run
const REUSE_CHECK_SCHEMA = { type: 'object', required: ['canReuse', 'reason'], properties: {
  canReuse: { type: 'boolean' },
  reason: { type: 'string' },
  reportScope: { type: 'string' },
  reportGreen: { type: 'boolean' },
  reportSha: { type: 'string' },
  reportSince: { type: 'string' },
  lastGreenSha: { type: 'string' },
  headSha: { type: 'string' },
  dirty: { type: 'boolean' },
  ageSeconds: { type: 'number' }
} }
// B9 — BL-0147: close-out/notify-end reused a recent full-green gate-report instead of re-running the
// whole suite. Fire-and-forget, same contract as the other dashboard events (engine has no shell/fs).
const CLOSE_OUT_VERIFY_REUSED_EVENT = (sha, ageSeconds) =>
  ` Also append the CloseOutVerifyReused event (fire-and-forget — BL-0147: this step reused a recent full green gate-report instead of re-running the whole-project suite): printf '{"event":"CloseOutVerifyReused","at":"%s","project":"%s","sha":"${sha}","ageSeconds":${Math.max(0, Math.round(ageSeconds || 0))}}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson.`
// The reused report is always scope:"full" (checkFullVerifyReuse refuses anything else).
const REUSE_REPORT_CLAUSE = (reuse) => `a FULL, GREEN run of this EXACT commit (sha ${reuse.headSha}, ~${Math.max(0, Math.round(reuse.ageSeconds || 0))}s ago, clean tree)`
async function checkFullVerifyReuse() {
  agentSpawned++
  const r = await agent(
    `BL-0147 READ-ONLY CHECK — before the next step runs the WHOLE-PROJECT \`bash .pandacorp/verify.sh\`, decide whether it actually needs to: a recent \`scope:"full"\` green gate-report for this EXACT commit may already certify it. A \`scope:"since"\` or \`scope:"partial"\` report NEVER does — the full suite is the backstop for what a since-scoped run cannot see. Change NOTHING; this is a pure read, not a gate. Do these steps IN ORDER:
  1) \`git -C ${PROJECT_DIR} rev-parse HEAD\` → headSha (the full sha).
  2) \`git -C ${PROJECT_DIR} status --porcelain\` → dirty = true if it prints ANY line, else false.
  3) Read \`last_green_sha\` from \`${PROJECT_DIR}/.pandacorp/status.yaml\` → lastGreenSha.
  4) If \`${PROJECT_DIR}/.pandacorp/run/gate-report.json\` does not exist or fails to parse as JSON, stop and return { canReuse: false, reason: "no-report", headSha, dirty, lastGreenSha }.
  5) Read it. Copy its \`scope\`, \`green\`, \`sha\` fields VERBATIM as reportScope/reportGreen/reportSha, and its \`since\` field (empty string "" if the report has none) VERBATIM as reportSince — never guess or normalize any of them — and read its \`at\` timestamp.
  6) ageSeconds = (now, UTC) minus the report's \`at\`, in whole seconds (e.g. \`date -u +%s\` minus the parsed \`at\`'s epoch).
  \`canReuse\` is true ONLY IF: reportScope === "full"; reportGreen === true; reportSha is non-empty AND reportSha === headSha; dirty === false; AND ageSeconds <= ${REUSE_MAX_AGE_SECONDS}. A "since" or "partial" scope NEVER counts, whatever else matches. green:false, a missing/mismatched sha, a dirty tree, or ageSeconds over the ceiling ALL make canReuse false — on ANY doubt return false, the full rerun is the safe default and this check never relaxes the WP-08 partial-report cage. Return { canReuse, reason: one of "reused"|"no-report"|"scope-not-eligible"|"not-green"|"sha-missing"|"sha-mismatch"|"dirty-tree"|"stale-report", reportScope, reportGreen, reportSha, reportSince, lastGreenSha, headSha, dirty, ageSeconds }.`,
    { label: 'close-out-verify-reuse-check', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: REUSE_CHECK_SCHEMA })
  if (!r || typeof r !== 'object' || r.canReuse !== true) return { ...(r || {}), canReuse: false, reason: (r && r.reason) || 'agent-no-result' }
  // E2 finding 7: the engine re-checks the agent's own fields — a canReuse:true on anything but a fresh, full,
  // green report of exactly HEAD over a clean tree is overruled (the close-out full suite then runs).
  const why = r.reportScope !== 'full' ? `scope ${JSON.stringify(r.reportScope)} is not "full"`
    : r.reportGreen !== true ? 'the report is not green'
      : (typeof r.reportSha !== 'string' || !r.reportSha || r.reportSha !== r.headSha) ? `report sha ${r.reportSha || '(none)'} ≠ HEAD ${r.headSha || '(none)'}`
        : r.dirty !== false ? 'the tree is not proven clean'
          : !(typeof r.ageSeconds === 'number' && r.ageSeconds >= 0 && r.ageSeconds <= REUSE_MAX_AGE_SECONDS) ? `age ${r.ageSeconds} is outside 0..${REUSE_MAX_AGE_SECONDS}s`
            : null
  if (why) { log(`⊘ close-out verify reuse refused by the engine (${why}) — the full verify.sh runs (E2 finding 7)`); return { ...r, canReuse: false, reason: 'engine-refused' } }
  return r
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
        { label: 'visual-qa', phase: 'Review', model: VISUAL_QA_MODEL, effort: 'high', agentType: 'pandacorp:reviewer', schema: VISUAL_QA_SCHEMA })
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
      log(`⚠ visual-qa agent returned no confirmed result${vq && vq.done === false ? ` (done:false — reason: ${vq.reason ? String(vq.reason).slice(0, 300) : 'none given'})` : ''} — degrading honestly (punch-list may be incomplete this run)`)
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
      const reuseLeanCloseOut = await checkFullVerifyReuse()
      closed = await agent(`${archiveStep}All FRDs are VERIFIED and the DR-085 hardening left its evidence — now the CROSS-FEATURE INTEGRATION REVIEW (DR-060): the seam check the per-FRD gates CANNOT do (each only sees its own feature). The dominant failure of parallel builds is at the seams BETWEEN features — every component correct in isolation, broken together. Trace the data flow ACROSS feature boundaries and verify every producer/consumer pair actually AGREES: each consumer's expectations vs its provider's \`docs/api/<wo-id>.md\` contract (field names, data shapes, formats, units, status codes, routes), shared types/enums used consistently across features, and NO two features that shipped duplicate or divergent versions of the same component/util (cross-check \`docs/design/components.md\`).${GATE_SKIP}${reuseLeanCloseOut.canReuse ? ` THEN — BL-0147 REUSE, do NOT re-run \`bash .pandacorp/verify.sh\`: gate-report.json already recorded ${REUSE_REPORT_CLAUSE(reuseLeanCloseOut)} — treat that as this step's whole-project result (it already covers the smoke + visual gates).${CLOSE_OUT_VERIFY_REUSED_EVENT(reuseLeanCloseOut.headSha, reuseLeanCloseOut.ageSeconds)}` : ` THEN run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since — includes the smoke + visual gates)`} and kill any test dev servers with TaskStop. FINALLY, before you may declare release, assert ALL of these ON DISK (BL-0012 + WS-D/D4 fail-closed) — if ANY fails, do NOT set phase: release and return done:false naming exactly what failed:
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
    // BL-0159: carry the concrete failure TEXT alongside each blocked_reason code — the engine's OWN
    // live in-run state (blockedFailures, populated by blockFrd at the exact moment each FRD's terminal
    // verdict was decided THIS run), never a re-derivation the closing agent has to go hunting for in
    // older gate-attempt transcripts or a stale decisions.md entry.
    const blk = blockedFrds.map((x) => `${x}(${blockedReasons[x]}${blockedFailures[x] ? `: ${blockedFailures[x]}` : ''})`).slice(0, 8).join(', ') || 'ninguno'
    const why = stopReason === 'agents' ? ' Paro por techo de agentes (maxAgents).'
      : stopReason === 'budget' ? ' Paro por techo de presupuesto.'
      : stopReason === 'blocks' ? ' Paro: demasiados FRDs bloqueados seguidos (algo sistemico va mal).'
      : stopReason === 'rethink' ? ' Paro en safe point: el owner re-planificó (rethink_pending) — la próxima corrida retoma con el plan nuevo.'
      : stopReason === 'maxFrds' ? ' Paro por el tope de prueba (maxFrds).' : ''
    const ownerMsg = needsOwner.length
      ? `Termine lo que se podia. ${needsOwner.length} FRD(s) te esperan a ti: ${needsOwner.slice(0, 6).join(', ')}`
      : `Tramo: ${builtFrds.length} FRDs ok, ${blockedFrds.length} bloqueados, ${reopenedFrds.length} a reintentar`
    agentSpawned++   // WS-A/D4: honest counter — every spawn site increments (DR-070); notify-end was the one omission
    const reuseLeanNotifyEnd = await checkFullVerifyReuse()
    closed = await agent(`${archiveStep}The build run ended.${why} Verified this run: ${builtFrds.length}. Reopened (retry next run): ${reopenedFrds.length}. Blocked: ${blockedFrds.length} (${blk}). Of those, NEEDS-OWNER (a human must act): ${needsOwner.join(', ') || 'none'}.${GATE_SKIP}${reuseLeanNotifyEnd.canReuse ? ` FIRST — BL-0147 REUSE, do NOT re-run \`bash .pandacorp/verify.sh\`: gate-report.json already recorded ${REUSE_REPORT_CLAUSE(reuseLeanNotifyEnd)} — treat that as this step's whole-project result.${CLOSE_OUT_VERIFY_REUSED_EVENT(reuseLeanNotifyEnd.headSha, reuseLeanNotifyEnd.ageSeconds)}` : ` FIRST run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since)`} to confirm this pass left no global regression — note the result (a needs-owner-quarantined route is held aside, so its blocked state must NOT red this full-suite check; that is the whole point — the independent features still reach a green baseline while the blocked route waits on the owner, BL-0011). Then ${SYNC_ROLLUPS}${SYNC_ROLLUPS_COMMIT} (BL-0159 — the WO count you are about to report MUST be this freshly-recomputed one, never a figure remembered from earlier in the run: a gate/repair/block resolved AFTER the last sync would otherwise under- or over-count against the real \`wo-*.md\` files on disk). Then write a short Spanish summary to .pandacorp/comms/progress.md (what advanced, what's blocked and the reason, the full-suite result, and exactly what needs the owner's action/decision for the needs-owner ones). **BL-0159 — narrate the LATEST state only:** the \`Blocked: … (${blk})\` reason/detail above for each FRD is already this run's FINAL verdict (a later gate/repair attempt supersedes an earlier one automatically — blockedReasons/blockedFailures are never stale). Never narrate an earlier reject/findings you might recall from this run's own transcript as if it were still the open issue once a later attempt changed the outcome — if a fix commit landed and a later gate re-blocked for a DIFFERENT reason (or none), report THAT reason, not the first one you saw. Do NOT touch \`phase\` (leave it as-is) — \`running\` is set to false by the terminal lease release at the very end of this prompt, NOT by hand here.${visualQaNote}${JOURNAL_GOLD}${BUILD_COMPLETE('partial', `${builtFrds.length}/${plan.frds.length}`)}${RELEASE_LEASE} Return done:true ONLY once status.yaml/progress.md reflect the above AND this terminal lease release succeeded.${NOTIFY(ownerMsg)}`,
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
      const vq = await agent(visualQaPromptBody(builtFrds),
        { label: 'visual-qa', phase: 'Review', model: VISUAL_QA_MODEL, effort: 'high', agentType: 'pandacorp:reviewer', schema: VISUAL_QA_SCHEMA })
      if (vq && vq.done === false) log(`⚠ visual-qa returned done:false — reason: ${vq.reason ? String(vq.reason).slice(0, 300) : 'none given'} (E2 finding 5)`)
      else log(`Visual QA pass done over ${builtFrds.length} FRD(s) — see .pandacorp/comms/visual-punch-list.md`)
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
      const reuseLegacyCloseOut = await checkFullVerifyReuse()
      closed = await agent(`All FRDs are VERIFIED and the DR-085 hardening left its evidence — now the CROSS-FEATURE INTEGRATION REVIEW (DR-060): the seam check the per-FRD gates CANNOT do (each only sees its own feature). The dominant failure of parallel builds is at the seams BETWEEN features — every component correct in isolation, broken together. Trace the data flow ACROSS feature boundaries and verify every producer/consumer pair actually AGREES: each consumer's expectations vs its provider's \`docs/api/<wo-id>.md\` contract (field names, data shapes, formats, units, status codes, routes), shared types/enums used consistently across features, and NO two features that shipped duplicate or divergent versions of the same component/util (cross-check \`docs/design/components.md\`).${GATE_SKIP}${reuseLegacyCloseOut.canReuse ? ` THEN — BL-0147 REUSE, do NOT re-run \`bash .pandacorp/verify.sh\`: gate-report.json already recorded ${REUSE_REPORT_CLAUSE(reuseLegacyCloseOut)} — treat that as this step's whole-project result (it already covers the smoke + visual gates).${CLOSE_OUT_VERIFY_REUSED_EVENT(reuseLegacyCloseOut.headSha, reuseLegacyCloseOut.ageSeconds)}` : ` THEN run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since — includes the smoke + visual gates)`} and kill any test dev servers with TaskStop. FINALLY, before you may declare release, assert ALL of these ON DISK (BL-0012 + WS-D/D4 fail-closed) — if ANY fails, do NOT set phase: release and return done:false naming exactly what failed:
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
    // BL-0159: see the lean-close-out twin above for why this carries failure text, not just the code.
    const blk = blockedFrds.map((x) => `${x}(${blockedReasons[x]}${blockedFailures[x] ? `: ${blockedFailures[x]}` : ''})`).slice(0, 8).join(', ') || 'ninguno'
    const why = stopReason === 'agents' ? ' Paro por techo de agentes (maxAgents).'
      : stopReason === 'budget' ? ' Paro por techo de presupuesto.'
      : stopReason === 'blocks' ? ' Paro: demasiados FRDs bloqueados seguidos (algo sistemico va mal).'
      : stopReason === 'rethink' ? ' Paro en safe point: el owner re-planificó (rethink_pending) — la próxima corrida retoma con el plan nuevo.'
      : stopReason === 'maxFrds' ? ' Paro por el tope de prueba (maxFrds).' : ''
    const ownerMsg = needsOwner.length
      ? `Termine lo que se podia. ${needsOwner.length} FRD(s) te esperan a ti: ${needsOwner.slice(0, 6).join(', ')}`
      : `Tramo: ${builtFrds.length} FRDs ok, ${blockedFrds.length} bloqueados, ${reopenedFrds.length} a reintentar`
    agentSpawned++
    const reuseLegacyNotifyEnd = await checkFullVerifyReuse()
    closed = await agent(`The build run ended.${why} Verified this run: ${builtFrds.length}. Reopened (retry next run): ${reopenedFrds.length}. Blocked: ${blockedFrds.length} (${blk}). Of those, NEEDS-OWNER (a human must act): ${needsOwner.join(', ') || 'none'}.${GATE_SKIP}${reuseLegacyNotifyEnd.canReuse ? ` FIRST — BL-0147 REUSE, do NOT re-run \`bash .pandacorp/verify.sh\`: gate-report.json already recorded ${REUSE_REPORT_CLAUSE(reuseLegacyNotifyEnd)} — treat that as this step's whole-project result.${CLOSE_OUT_VERIFY_REUSED_EVENT(reuseLegacyNotifyEnd.headSha, reuseLegacyNotifyEnd.ageSeconds)}` : ` FIRST run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since)`} to confirm this pass left no global regression — note the result (a needs-owner-quarantined route is held aside, so its blocked state must NOT red this full-suite check; that is the whole point — the independent features still reach a green baseline while the blocked route waits on the owner, BL-0011). Then ${SYNC_ROLLUPS}${SYNC_ROLLUPS_COMMIT} (BL-0159 — report THIS freshly-recomputed WO count, never a figure remembered from earlier in the run). Then write a short Spanish summary to .pandacorp/comms/progress.md (what advanced, what's blocked and the reason, the full-suite result, and exactly what needs the owner's action/decision for the needs-owner ones). **BL-0159 — narrate the LATEST state only:** the \`Blocked: … (${blk})\` reason/detail above for each FRD is already this run's FINAL verdict; never narrate an earlier reject/findings from this run's own transcript once a later attempt superseded it. Set .pandacorp/status.yaml running: false. Return done:true once status.yaml is written.${JOURNAL_GOLD}${BUILD_COMPLETE('partial', `${builtFrds.length}/${plan.frds.length}`)}${NOTIFY(ownerMsg)}`,
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

return { mode: MODE, builtFrds, blockedFrds, reopenedFrds, blockedReasons, blockedFailures, stopReason }
