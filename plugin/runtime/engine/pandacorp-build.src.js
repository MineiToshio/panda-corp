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
// BL-0212: the deterministic discard of a rejected work order's OWN commits (same scripts dir, same rule).
const WO_REVERT_CLI_COMMAND = `node ${shellQuote(STATE_CLI.replace(/[^/]+$/, 'wo-revert.mjs'))}`
// BL-0214: the evidence collector's report sealer and the drift finder's snippet checker ship in the same scripts dir.
const SEAL_REPORT_CLI_COMMAND = `node ${shellQuote(STATE_CLI.replace(/[^/]+$/, 'seal-report.mjs'))}`
const FINDER_SNIPPETS_CLI_COMMAND = `node ${shellQuote(STATE_CLI.replace(/[^/]+$/, 'finder-snippets.mjs'))}`

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
//     (logged + a `GateEvidenceFallback` event) — there is never a gate without evidence. BL-0214: the report reaches
//     the engine as a SEALED line (seal-report.mjs); a relay that altered it is re-read from its stored copy (≤ 2) and,
//     failing that, discarded the same way — a model's copy of machine output is never trusted.
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
//     discarded with a log. Cost: 1 sonnet unit in maxAgents (COST('sonnet')) plus one MECH unit for the BL-0214
//     snippet check (an `implemented` row whose snippet is not at the pin becomes `unknown`). A dead/malformed finder
//     is a logged DriftFinderFallback; the gate always runs. Only the pinned gate that launched it sees its report; re-gates on
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
//     a cycle fault (fail-closed). BL-0206: the ONE exception is a proof that never ARRIVED intact (the line is
//     sealed, the engine re-reads the stored copy twice): every claim of that gate stays UNPROVEN — an OPEN fail that
//     is neither reopened nor carded (a transcription fault is not evidence about the code, either way): a green
//     resting on it is NOT certified, the FRD is deferred IN_REVIEW and re-gates next pass; loud DriftProofUnreadable.
//     'block' is the rollback switch: claims are ignored and every `fail` is a
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
//   args.lane: 'fast' (**DEFAULT since 9.119.0** — DR-124 amended, the small-bench verdict: USABLE in 8-12 min with the
//     oracle green vs 51-84 min to done classic) | 'classic' (the opt-out, byte-identical classic behavior) — proposal 39.
//     Any other value runs the default (fast) with a loud log. Its safety contracts are each also reachable alone:
//     args.mechScript (C1, scripted MECH ops + the C7 resume precheck) and args.infraGuard (C7, the `infra` failure class +
//     the paused-infra halt); both default to true under lane 'fast', false otherwise. The fast BUILD shape (stage 3, needs
//     mechScript): no plan agent, one builder per FRD committing each WO through commit-wo, a scripted verify → USABLE per
//     non-floor FRD, gates in the parallel slots while the next FRD builds — see "THE FAST LANE" below.
//   args.reviewBudget: 'now' (DEFAULT) | 'defer' — fast lane only. 'defer' stops at all-USABLE: no gate is launched and the
//     review debt (FRDs built but not VERIFIED) is derived in the result, never stored (DR-115).
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
// A-1 bench (2026-10-01): `args.maxAgents:'auto'` is OPT-IN — the cap is sized from projectedRunCost(plan) once the plan
// exists (and again whenever it grows). An explicit numeric value is NEVER overridden and NEVER fails fast (a deliberately
// partial, resumable run is legitimate, DR-050/070): below the projection it only gets an advisory log. Omitted stays
// unbounded, exactly as before. Until the first projection an auto run has no cap (null), like an omitted one.
const MAX_AGENTS_AUTO = Boolean(args && args.maxAgents === 'auto')
let MAX_AGENTS = MAX_AGENTS_AUTO ? null : ((args && args.maxAgents) || null)     // hard cap on subagents spawned this run — the RELIABLE spend brake (each implementer/reviewer ≈ work ≈ tokens), counted INSIDE the engine, independent of budget.spent AND of the supervisor surviving. THE real guardrail.
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
// The shared tail of every dashboard printf (its timestamp, the project key, the append): one copy, byte-identical prompts.
const EV_END = `\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson.`
// Bench FM-4: a relay whose op crossed the Bash default 120 s backgrounded it and polled to 600 s (10 min lost).
const MECH_FG = ' in the FOREGROUND with the Bash tool\'s `timeout: 600000` (NEVER `run_in_background`, `&` or a polling loop)'
const MCR = `MECHANICAL COMMAND RUNNER — every Bash call${MECH_FG}. `
const RUN_ONCE = 'Your SOLE action is to execute this exact command ONCE'
const VERBATIM_AS = '(no command before or after it) and return its stdout VERBATIM as `'
const UI_SKIP_NOTE = '(fail-closed si no declaran); el diff visual determinista sigue en el verify.sh completo del cierre'
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
// BL-0211: GENERATED from plugin/agents/reviewer.md's DISMISSAL_CITATION block (generate-build-prompt-fragments.mjs) — do not hand-edit.
// A scope dismissal needs its literal citation; a WO / change-card line never dismisses a normative FRD clause (engine side: classifyDismissals).
const DISMISSAL_CITATION_DIRECTIVE = "**Scope dismissals need a literal citation (BL-0211):** when you noticed something that looks like an unmet contract or a defect and you decline to record it as a `fail` or a finding because a work order, a change card or the FRD scopes it out (\"matches the WO scope\", \"out of scope\", \"by design\", \"deferred\"), list it in the verdict's `dismissals` array as `{ finding, ground, contract, source, quote }`. `source` is `<repo-relative path>:<line>` of the literal line that scopes it out: open the file and find the line with `grep -n`, never cite from memory and never paraphrase; `quote` is that line's own words, verbatim. No literal citation, no dismissal: if you cannot cite it, record it as a `fail` (or a finding). Set `contract` to the REQ/AC id (or the clause text) whenever the thing you noticed is a normative clause of `frd.md`. The FRD outranks the work order: a work order's or change card's \"out of scope\" can never dismiss a normative FRD clause, because a work order that defers something the FRD says SHALL exist is itself the contradiction. Record that clause as a `fail` (and propose it as pre-existing drift with `direction: spec` or `unknown` when it pre-dates this cycle). Only a line of `frd.md` itself (an out-of-scope or exclusions clause) or of the PRD can dismiss a `contract`; a work order or change-card line may dismiss only a finding that is not an FRD clause (for example a fence on which files to touch). The engine validates the citation's shape: a dismissal without a valid citation is treated as NOT dismissed and your verdict is sent back to you once."
// BL-0203: GENERATED from plugin/agents/drift-finder.md's DRIFT_FINDER block (generate-build-prompt-fragments.mjs) — do not hand-edit.
const DRIFT_FINDER_DIRECTIVE = "**Whole-FRD drift finder method (BL-0203) — one pass over EVERY contract, located in the code, never assumed:** 0. **Pin discipline (BL-0205) — the shell forgets its directory between your Bash calls.** Your Bash tool starts EVERY call in the launching session's own directory, the factory's MAIN checkout where later commits have already landed, never in the pinned worktree; a `cd` in one call does NOT carry to the next, so a bare `grep`/`cat` silently audits the wrong code. The engine's prompt names the pinned worktree and the pinned commit. Your FIRST call prints the absolute project directory inside the pin and its HEAD (`cd \"<dir>\" && pwd -P && git rev-parse HEAD`): that HEAD must start with the pinned commit, and if it does not, STOP and return no contracts. From then on start EVERY Bash command with the literal absolute directory it printed (`cd \"<pinDir>\" && …`, or `git -C \"<pinDir>\" …`, or only absolute paths), the heredocs that write probes included, and give Read, Grep and Glob absolute paths under it, never a relative one. Your LAST call repeats the HEAD check. Report `pinDir` and `headSha` (first call) and `headShaEnd` (last call) exactly as printed: the engine discards your whole report if a reported HEAD is not the pin. 1. **Inventory.** Read `docs/frds/<frd>/frd.md` in full at this pin and list every normative contract with its id: each `REQ-NN-MMM` requirement, each `AC-NN-MMM.K` acceptance criterion, and the `CMP-NN-*`/`IF-NN-*` components and interfaces its `blueprint.md` declares. A clause without an id is still a contract — name it by its section. Do not stop at the contracts the work orders under review own: the drift this pass exists for lives in the OTHER contracts, the ones earlier cycles verified. 2. **Locate each one in the code, not in its name.** `grep` for the id, for the identifiers, routes, labels and literal strings the contract names, and OPEN the file that implements it. Never mark a contract implemented because a file or function has a plausible name, because a test with its id exists, or because a work order's Status Note says so — read the lines that do the work and quote them. 3. **Compare literally.** Check values, sets, enums, lists and mappings item by item against the text — a filter set the spec requires to exclude a category can still contain it under an old or renamed label. Check that content the spec requires is actually present in the rendered output, not just that the component that should carry it exists — a prior revert can silently drop the content while leaving the component standing. Check that a surface the spec requires is mounted on a reachable route, not only defined in an unused component. 4. **Check input validation beyond the type.** For every contract about parsing, dates, numbers or user input, find the validation and ask what it accepts that it should not: a lenient date parser can accept a string that only looks like a date, or resolve a calendar day in the wrong timezone; a lenient number parser can accept trailing non-numeric characters. A validation criterion met only for the inputs the implementer happened to test is drift. 5. **Classify each contract** — `implemented` (you read the implementing lines; give the project-relative file, the line and a short snippet copied verbatim from those lines, at least 6 characters — the engine checks every snippet against the committed tree at the pin, and a row whose snippet is not there is handed to the judge as `unknown`; two such rows discard your whole report), `drift` (the code contradicts the text; quote both sides in `why`), or `unknown` (you could not locate the implementation, or your tool budget ran out before you reached it). Never guess `implemented` to finish faster: an honest `unknown` makes the judge look; a false `implemented` hides the defect. Set `owner` to the work order whose `source_requirements` (frontmatter) lists the contract, or `none`, and `claim` to `cycle` when that owner is one of the work orders under review this cycle, else `preexisting`. 6. **Write one probe per drift.** A vitest file at `.pandacorp/run/drift-probes/<frd>/<contract-id-slug>.finder.drift-probe.ts` (e.g. `req-03-001.finder.drift-probe.ts`; the `.finder` infix keeps it apart from the reviewer's own probes) that FAILS on an assertion precisely because of the contradiction and would PASS once the contract holds. Import production code ONLY through the `@/` alias (the engine runs a copy of it from another directory) and `describe/it/expect` from `vitest`; keep it deterministic (fixed dates, no network, no real clock). Write it with a Bash heredoc. Do not run it — the engine runs it twice at two commits. It lives outside the collected test tree on purpose: never copy it into `src/`. 7. **Stay read-only everywhere else.** Before your first probe, delete only your own stale probes for this FRD (`rm -f .pandacorp/run/drift-probes/<frd>/*.finder.drift-probe.ts*`). Never edit production code, tests, docs or frontmatter; never run `verify.sh`, the test suite, a dev server or a browser; never run a git command that writes; never commit. Another agent is running the gate script in this same worktree right now. 8. **Budget.** Spend at most the tool-call budget the engine states. Work through the contracts the work orders under review do NOT own first (that is where the digested judge cannot look), then the cycle's own. When the budget runs out, mark every contract you have not reached `unknown` and set `budgetExhausted: true` — never drop a contract from the list."
const RENEW_LEASE = `FIRST renew this run's atomic lease (fail closed): \`${STATE_CLI_COMMAND} renew --project "${PROJECT_DIR}" --token "${LEASE_TOKEN}" --epoch "${LEASE_EPOCH}"\`. If renewal fails, return stop:true and mutate nothing.`
// REV-5: the minimal, standalone shape of RENEW_LEASE's own ask (no stop_receipt fence — RENEW_LEASE
// never runs INSPECT_STOP, only the full safe-point prompt does) — used by the throttled-boundary
// renewal-only spawn below, which does NOT run the rest of the safe-point checklist.
const RENEW_LEASE_SCHEMA = { type: 'object', properties: { stop: { type: 'boolean', description: 'true iff the lease renewal itself failed — the engine stops rather than continue building on an unrenewed/lost lease' } } }
const RELEASE_LEASE = `Release this run with the fenced TWO-PHASE protocol, in this exact order: (1) \`${STATE_CLI_COMMAND} quiesce --project "${PROJECT_DIR}" --token "${LEASE_TOKEN}" --epoch "${LEASE_EPOCH}"\` (projects running:false while the lease STILL fences every writer); (2) stage ONLY .pandacorp/status.yaml and commit it as \`chore: quiesce Claude build lease\` when it changed; (3) only after that commit succeeds run \`${STATE_CLI_COMMAND} finalize-release --project "${PROJECT_DIR}" --token "${LEASE_TOKEN}" --epoch "${LEASE_EPOCH}"\`. Any failure is fatal. Never use the compatibility \`release\` command here, never clear status.yaml, and never delete the lease directory by hand.`
// 9.118.2: the greenfield baseline facts (last_green_sha + work-order implementation_status counts) — a sealed
// line from the installed scripts dir (same rule as DRIFT_CLI_COMMAND), read by the baseline pre-check.
const GREENFIELD_PROBE_COMMAND = `node ${shellQuote(STATE_CLI.replace(/[^/]+$/, 'greenfield-probe.mjs'))} --project ${shellQuote(PROJECT_DIR)}`
const INSPECT_STOP = `${STATE_CLI_COMMAND} inspect-stop --project "${PROJECT_DIR}" --token "${LEASE_TOKEN}" --epoch "${LEASE_EPOCH}"`
// The owner-stop receipt step, shared by the LLM safe point and the pre-loop drain (identical text).
const INSPECT_STOP_STEP = `0) Execute exactly \`${INSPECT_STOP}\`. This is the EXCLUSIVE source of truth for the owner stop file. Preserve its JSON output verbatim as \`stop_receipt\`. NEVER use shell \`test\`, \`[\`, \`stat\`, \`ls\`, filesystem aliases, or infer stop from path presence/absence or an exit code. If the command fails or its JSON cannot be returned exactly, throw/fail this safe point and mutate nothing — NEVER guess \`stop:false\`.`
const RETHINK_STEP = `1) Read .pandacorp/status.yaml → set \`stop: true\` iff \`rethink_pending: true\`. Do not derive this field from the stop file; the engine evaluates the fenced \`stop_receipt.stop\` itself.`

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
  log(`⚠⚠ args arrived ${args === null ? 'null' : 'undefined'} — any args passed at launch were DROPPED (BL-0024): this run is UNBOUNDED, powerful mode; if args were intended, TaskStop and relaunch.`)
} else if (typeof args !== 'object') {
  log(`⚠⚠ args arrived as a ${typeof args}, NOT an object — mode/maxAgents/maxFrds were DROPPED. This run is UNBOUNDED. Stop and relaunch passing args as a JSON object (DR-072 R2).`)
}
if (!LEASE_TOKEN || !LEASE_EPOCH) throw new Error('FATAL: atomic lease token/epoch missing — launch only through launch-implement.sh')
log(`Mode ${MODE} · wave ≤${P.wave} · maxFrds ${MAX_FRDS === Infinity ? 'sin tope' : MAX_FRDS} · maxAgents ${MAX_AGENTS_AUTO ? 'auto (se dimensiona tras el plan)' : (MAX_AGENTS || 'OFF (sin freno de presupuesto!)')} · workers ${P.worker} · judge ${P.judge}${CHANGE ? ' · change ' + CHANGE : ONLY ? ' · frds ' + ONLY.join(',') : ''}`)

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
  ` Also append the Party gate-open event (fire-and-forget — the tribunal lights up, BL-0020): printf '{"event":"gate","at":"%s","project":"%s","frd":"${frd}","wos":${wos},"attempt":${attempt}}${EV_END}`
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
  ` Also append the BuildLaunch event, ONCE, right away (fire-and-forget): printf '{"event":"BuildLaunch","at":"%s","project":"%s","mode":"${MODE}","maxAgents":${MAX_AGENTS || 0},"targeted":${TARGETED}}${EV_END}`

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
  ` Also append the PatchResult event (fire-and-forget): printf '{"event":"PatchResult","at":"%s","project":"%s","frd":"${frd}","outcome":"${outcome}"}${EV_END}`

// B5 — the Preview Smoke Gate result for a UI FRD (real numbers from the Playwright run). Skipped entirely
// when the FRD has no UI surface.
const PREVIEW_SMOKE = (frd) =>
  ` PREVIEW SMOKE EVENT (UI FRDs only): if ${frd} exposes a UI surface, right after the verify.sh browser/Playwright layer append the PreviewSmoke event with the REAL numbers from that Playwright output (fire-and-forget): printf '{"event":"PreviewSmoke","at":"%s","project":"%s","frd":"${frd}","pass":%s,"routes":%s,"failed":%s}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" "<true if every route rendered clean, else false>" "<number of routes exercised>" "<number of routes that failed>" >> ~/.claude/dashboard-events.ndjson. If ${frd} has NO UI surface, SKIP this event entirely (do not emit it).`

// B6 — a hardening-stage result (security folds audit+fix into one; telemetry; the close-out integration).
// A-1 bench: the security stage normally folds audit + fix into ONE event emitted by the fix spawn; when the engine skips the
// fix (an explicit empty findings array) the audit spawn has to emit it, and ONLY then — conditional on its own verdict.
const HARDENING_EVENT_IF_NO_FINDINGS = (stage) =>
  ` If (and ONLY if) your \`findings\` array is EMPTY, ALSO append the Hardening event for the ${stage} stage now, because no fix spawn will follow to emit it (fire-and-forget): printf '{"event":"Hardening","at":"%s","project":"%s","stage":"${stage}","status":"ok"}${EV_END} If \`findings\` is non-empty, do NOT emit it.`
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
  ` Also append the UiPassSkipped event (fire-and-forget): printf '{"event":"UiPassSkipped","at":"%s","project":"%s","pass":"${pass}","frd":"${frd}","reason":"${reason}"}${EV_END}`

// WP-06 — the digested-evidence collector for THIS gate produced nothing usable (null verdict, a `report`
// that is not valid JSON, or a non-boolean `green`), so the gate fell back to EXPLORE mode and collects its
// own evidence exactly as it always did. Emitted so a silent, permanent degradation of the digested path is
// visible in the stream instead of only showing up as a cost regression. Same fire-and-forget contract as
// the events above; embedded in the gate prompt that actually ran (the engine has no shell of its own).
const GATE_EVIDENCE_FALLBACK_EVENT = (frd, reason) =>
  ` Also append the GateEvidenceFallback event (fire-and-forget — WP-06: the pre-collected evidence pack was unusable, so THIS gate ran in explore mode): printf '{"event":"GateEvidenceFallback","at":"%s","project":"%s","frd":"${frd}","reason":"${reason}"}${EV_END}`

// BL-0141 — the ONE-TIME dashboard record of a runtime/plugin agentType skew (a session still running an
// OLDER plugin than the engine version it launched, e.g. plugin 9.102.3 resident while the 9.103.0 engine
// references the new `pandacorp:mech` agent — the runtime only picks up a new agent definition on session
// restart). Injected into the RETRIED prompt itself (the engine has no shell/fs of its own, see the
// agent() wrapper below) exactly once PER requested type, the call that first hits that fallback (BL-0168:
// the same skew hit a non-mech type — canary F2's `pandacorp:drift-finder` — and only a log line said so;
// the event is the visible, dashboard-side signal for EVERY type, not just mech).
const MECH_FALLBACK_EVENT = (requestedType, fallbackType) =>
  ` Also append the MechFallback event, ONCE (fire-and-forget — BL-0141/BL-0168: the runtime rejected agentType '${requestedType}', this run falls back to '${fallbackType}'): printf '{"event":"MechFallback","at":"%s","project":"%s","requestedType":"${requestedType}","fallbackType":"${fallbackType}"}${EV_END}\n`

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
// A MECH (haiku) agent that has nothing to report for an optional string field often returns a SENTINEL string
// instead of omitting it (bench-medium C-1, plugin 9.118.0: `failure: "null"`, `projectPrefix: "\"\""`). Control flow must
// never branch on such a value: this returns the trimmed string, or '' for null/undefined/non-string/''/'null'/
// 'undefined'/'none' (case-insensitive) and a quoted-empty string ('""', "''").
const optionalText = (v) => {
  if (typeof v !== 'string') return ''
  const t = v.trim()
  return /^(?:null|undefined|none|""|'')$/i.test(t) ? '' : t
}
const MECH_EFFORT = MECH_LEAN ? 'low' : undefined

// ── Proposal 39 (fast lane) stage 2: engine safety ─────────────────────────────────────────────────
// args.lane: 'fast' (DEFAULT since 9.119.0, DR-124) | 'classic' (opt-out, byte-identical classic behavior). The fast lane
// turns on, by default:
//   args.mechScript (C1): the scripted MECH ops of pandacorp-build-mech.mjs — each prompt is "run exactly <cmd>, return
//     its last line" and the engine verifies the line's seal; plus the C7 resume precheck before anything is read.
//   args.infraGuard (C7): an agent() that throws, returns nothing, or carries a usage-limit/429/overloaded signature is
//     `infra`, never a work-order failure (no repair try, no BLOCKED, no wo-revert): one pause + one retry; a second
//     infra or any limit signature HALTS the run (stopReason 'paused-infra'), committed work kept.
// Each flag can be passed explicitly in either lane (true/false), e.g. classic + mechScript:true.
const LANE = (args && args.lane === 'classic') ? 'classic' : 'fast'
if (args && args.lane !== undefined && args.lane !== 'fast' && args.lane !== 'classic') log(`⚠ args.lane ${JSON.stringify(args.lane)} is neither fast nor classic — running fast (the default; pass lane:'classic' to opt out)`)
const argFlag = (key, dflt) => (argBool(args, key, true) ? true : argBool(args, key, false) ? false : dflt)
const MECH_SCRIPT = argFlag('mechScript', LANE === 'fast')
const INFRA_GUARD = argFlag('infraGuard', LANE === 'fast')
const INFRA_PAUSE_SECONDS = 60
// Stage 3, the fast lane's BUILD shape (C3/C4/C6, §11): no plan agent, one builder per FRD that commits each work order
// itself through commit-wo, a scripted verify → USABLE per non-floor FRD, the unchanged gates in the parallel slots while
// the next FRD builds. It needs the scripted ops, so lane 'fast' with mechScript:false keeps the classic waves.
// args.reviewBudget: 'now' (default) continues to VERIFIED and closes once; 'defer' stops at all-USABLE, no gate launched
// (the review debt is derived at read time, never stored — DR-115).
const FAST = LANE === 'fast' && MECH_SCRIPT
// Bench F-1 (T_usable): the fast lane's start is ONE scripted op (`fast-start`: precheck, the stop/rethink probe, the
// baseline verdict, the compact plan with the floor, the rollup sync and the first FRD's dispatch) relayed by one haiku
// spawn instead of six. Only the quiet common case runs through; any other start hands the rest back to the separate
// steps below, unchanged. args.fusedStart:false keeps the separate steps; a change build and strictBaseline always do.
const FUSED_START = FAST && argFlag('fusedStart', true) && !CHANGE && !STRICT_BASELINE
const REVIEW_BUDGET = (args && args.reviewBudget === 'defer') ? 'defer' : 'now'
if (args && args.reviewBudget !== undefined && args.reviewBudget !== 'now' && args.reviewBudget !== 'defer') log(`⚠ args.reviewBudget ${JSON.stringify(args.reviewBudget)} is neither now nor defer — using now`)
const REVIEW_DEFERRED = FAST && REVIEW_BUDGET === 'defer'
// Proposal 40 §3 Phase B (DR-125): args.lanes N (launcher --lanes N) is the requested lane count K. Absent, K =
// DEFAULT_LANES = 2 (on by default since 9.120.0: the medium bench FM-9 met §6.2). The lane planner caps it by mode (pro
// 1, balanced 2, powerful 4) into the run's ceiling kRun, 1 on a DAG narrow throughout (no pool, no lane op beyond the
// one plan: exactly the sequential build); each lane round's K is min(kRun, the ready width then). --lanes 1 opts out:
// no lane plan, pool or round at all.
const DEFAULT_LANES = 2
const LANES_ARG = args && Number.isInteger(args.lanes) && args.lanes >= 1 ? args.lanes : null
const LANES_K = LANES_ARG || DEFAULT_LANES
if (args && args.lanes !== undefined && LANES_ARG === null) log(`⚠ args.lanes ${JSON.stringify(args.lanes)} is not an integer ≥ 1 — the default K = ${DEFAULT_LANES} (auto-narrowing) applies`)
if (LANE === 'fast' || MECH_SCRIPT || INFRA_GUARD) log(`lane ${LANE} · mechScript ${MECH_SCRIPT ? 'on' : 'off'} · infraGuard ${INFRA_GUARD ? 'on' : 'off'}${FAST ? ` · reviewBudget ${REVIEW_BUDGET} · lanes ${LANES_ARG || `${DEFAULT_LANES} (default, auto-narrowing)`}` : LANE === 'fast' ? ' · the fast build needs mechScript: classic waves' : ''} (proposal 39)`)
const fastFloor = new Set()        // C3: FRDs USABLE only when VERIFIED (plan-time or landed floor) — monotone, never removed
const fastClassified = new Set()   // FRDs whose plan-time floor ran; an unclassified one counts as floor (fail-closed)
const fastUsable = []              // C6: the build_usable events of this run, { frd, sha }, in order (an event, never stored)
const priorUsable = []             // C6: FRDs still USABLE from an EARLIER run, { frd, sha }, as the precheck derives them from the committed build_usable lines (any lane under mechScript)
let earlySecurity = null           // C6: { pin, promise } — the read-only audit started alongside the first gate
const MECH_CLI_COMMAND = `node ${shellQuote(STATE_CLI.replace(/[^/]+$/, 'pandacorp-build-mech.mjs'))}`
// `dir` is the project the op runs on: PROJECT_DIR, or a lane worktree's project (proposal 40 Phase B).
const mechOpCommand = (op, flags = '', dir = PROJECT_DIR) => `${MECH_CLI_COMMAND} ${op} --project ${shellQuote(dir)}${flags ? ` ${flags}` : ''}`
const MECH_LINE_SCHEMA = { type: 'object', required: ['line'], properties: { line: { type: 'string', description: 'the LAST line the command printed, verbatim' } } }
const MECH_LITERAL = (cmd) => `MECHANICAL COMMAND RUNNER (proposal 39 C1): run exactly \`${cmd}\` once, as ONE Bash call with no command before or after it,${MECH_FG}, and return its last line VERBATIM as \`line\`. That line is ONE JSON object ending in an integrity checksum ("sum"): copy it character for character. A non-zero exit is data, not a problem for you to fix: do not inspect, edit, fix, stage, commit or revert anything yourself.`
// A FUSED op (a step folded into the same spawn: the first dispatch's rollup sync, a fire-and-forget event) is ordered
// steps, so nothing in it says "no command before or after it" while another step asks for one.
const MECH_FUSED = (cmd, before, after) => `MECHANICAL STEPS (proposal 39 C1): do them IN THIS ORDER, each exactly once, skipping none.\n${[before, `MECHANICAL COMMAND RUNNER: run exactly \`${cmd}\` once, as ONE Bash call of its own (nothing chained into that call),${MECH_FG}, and return its last line VERBATIM as \`line\`. That line is ONE JSON object ending in an integrity checksum ("sum"): copy it character for character. Its exit code is data, not a problem for you to fix: whatever it is, do not inspect, edit, fix, stage, commit or revert anything because of it.`, after].map((x) => String(x || '').trim()).filter(Boolean).map((x, i) => `STEP ${i + 1}. ${x}`).join('\n')}\nReturn as \`line\` the last line of the MECHANICAL COMMAND RUNNER step, untouched by any other step.`

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
const worktreeWorkFrom = (pinSha, wt = GATE_WORKTREE) => `Work from the GATE WORKTREE ${wt} — FIRST cd into the PROJECT directory inside it, exactly: \`${gateProjectCd(wt)}\` (the worktree holds the WHOLE repo; a nested project's root is not the worktree root). It is a DETACHED git worktree checked out at the pinned commit ${pinSha} (a frozen, quiet copy of the tree so the main build keeps going); DO NOT cd to the main project root and DO NOT run any \`git commit\`/branch op that writes the main tree. Every relative path below is relative to that project directory inside the worktree; any path written as an absolute ${PROJECT_DIR}/... is the MAIN tree (append-only files only). **Your shell does NOT remember that \`cd\` (BL-0205):** a subagent's Bash tool starts every call in the launching session's own directory — the MAIN checkout, which is NOT the pinned commit — so a bare \`grep\`/\`cat\`/\`ls\` reads the wrong tree. Start EVERY Bash command with that same \`cd\` (\`<that cd> && <command>\`), or use only absolute paths / \`git -C <worktree>\`, and give Read/Grep/Glob absolute paths under the worktree.\n`
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
const GATE_JOURNAL_STEP = (frd, reviewIds, attemptNo) => `BUILD-JOURNAL (A1) — at WHICHEVER exit you take below (pass / reopen / blocked / fail), record this gate's verdict:${gateVerdictJournal(frd, reviewIds, attemptNo)}`
// The gate's generic block exit, shared by the serial and the split gate prompts (identical text).
const GATE_BROKEN_CLAUSE = (frd) => `If it's broken and you can't pinpoint specific WOs, first classify \`blocked_reason\` ('needs-owner' if a human must act, 'external' if it's a transient outside failure, else 'error'), then — **unless** that reason is 'needs-owner' AND a \`fail\` entry of your traceability carries \`claim: "preexisting"\` (BL-0178/BL-0185: then emit NOTHING here — the engine adjudicates the claim first and emits this gate's ONE terminal outcome itself, so a block it lifts is never reported as both blocked and passed) —${emitGateOutcome(frd, 'blocked', `,"blocked_reason":"%s"`, ` "<the SAME blocked_reason value you are about to return>"`)} return { green: false, failure, blocked_reason }. **\`failure\` MUST open with ONE sentence naming what is RED and what the owner must do — any context or praise for what passed comes AFTER that sentence, never before it** (F1/BL-0174: the engine keeps only the first ~400 chars of \`failure\`; leading with praise for passing work silently drops the real blocking cause).${NOTIFY('FRD ' + frd + ' no paso la revision (correccion) — necesita tu atencion')}`

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
const typeFallbackAnnounced = new Set()   // BL-0168: requested agentTypes whose fallback already emitted its ONE MechFallback dashboard event (any type, not only mech)
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
// Proposal 40 Phase A: the fast lane's main-writer mutex — the ONE task that holds the main tree ({ who, p, done, r, e },
// set by holdMain, cleared by the scheduler loop once it settled), else null. Declared here for the same reason as above.
let mainWriter = null
// Proposal 40 Phase B: null until decided (the first fast step, after the first safe point drained the ready cards into
// the schedule), then true for a run at K ≥ 2 and false at K = 1. `lane` is the lane scheduler's run state (laneRound).
let LANED = null
const lane = { k: 1, stepK: null, pool: null, ready: false, resumed: false, next: null, plan: true, sp: false, stop: false, landHold: false, idle: 0, broken: 0, jobs: new Map(), live: new Map(), land: [], fixQ: [], routed: new Set(), usableQ: [], usable: null, barrier: null, attempts: new Map(), landed: new Set(), parked: [], blocked: [], owned: new Set(), inFlight: [] }
// 9.118.2 (bench-medium C-1, plugin 9.118.1): a MECH (haiku) agent sometimes returns its structured result
// JSON-ENCODED inside one string field — `{ parameter: "{\"escalate\": true, \"dirtyPaths\": [...] …}" }` — so every
// field the engine branches on read as absent (the pre-check skipped the BL-0124 fast path and paid an opus judge
// baseline). This unwraps exactly that shape: an object whose ONLY key is one of these wrapper names, NOT a
// property the call's own schema declares (DRIFT_OUTPUT_SCHEMA's `output` is a legitimate verbatim string), and
// whose string value parses to a plain object. Anything else is returned untouched — the caller's own fail-closed
// checks still judge it.
const STRUCTURED_WRAPPER_KEYS = new Set(['parameter', 'input', 'result', 'output', 'json'])
const unwrapStructuredResult = (answer, schema) => {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return answer
  const keys = Object.keys(answer)
  if (keys.length !== 1 || !STRUCTURED_WRAPPER_KEYS.has(keys[0])) return answer
  if (schema && schema.properties && Object.prototype.hasOwnProperty.call(schema.properties, keys[0])) return answer
  const inner = answer[keys[0]]
  if (typeof inner !== 'string') return answer
  let parsed
  try { parsed = JSON.parse(inner) } catch { return answer }   // not JSON: the untouched answer goes on to the caller's own checks
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return answer
  // A bare SEALED line (it carries its own "sum") is a receipt, not the verdict object: re-serializing it would break
  // the character-exact seal, so it stays wrapped and the receipt reader's unwrapAnswer() lifts the verbatim text.
  if (typeof parsed.sum === 'string' && !(schema && schema.properties && Object.prototype.hasOwnProperty.call(schema.properties, 'sum'))) return answer
  return parsed
}
// Applied to every MECH spawn that declares a schema (the results the engine branches on); judge/worker results are untouched.
const unwrapMech = (answer, opts) => {
  if (!opts || opts.model !== MECH || !opts.schema) return answer
  const out = unwrapStructuredResult(answer, opts.schema)
  if (out !== answer) log(`ℹ 9.118.2: ${opts.label || 'a MECH step'} returned its result JSON-encoded inside \`${Object.keys(answer)[0]}\` — unwrapped.`)
  return out
}
agent = async (prompt, opts = {}) => {
  // C2: a per-call `workFrom` override lets the CONCURRENT gate run from the pinned gate worktree instead
  // of the project root (default). undefined → the legacy WORK_FROM (cd PROJECT_DIR). '' → no preamble.
  const wf = (opts && opts.workFrom !== undefined) ? opts.workFrom : WORK_FROM
  let rest = opts
  if (opts && opts.workFrom !== undefined) { rest = { ...opts }; delete rest.workFrom }   // never leak workFrom into the real agent() opts
  const finalPrompt = typeof prompt === 'string' && wf ? wf + prompt : prompt
  return INFRA_GUARD ? infraGuardedSpawn(finalPrompt, rest) : spawnWithTypeFallback(finalPrompt, rest)
}
// ── Proposal 39 C7: the `infra` failure class ─────────────────────────────────────────────────────
// A dead agent (a throw, no output) or a provider limit (usage limit, 429, overload) says nothing about the work
// order: it must never consume a repair try, never BLOCK, never discard code. One pause + one retry for a plain
// failure; a limit signature, or a second failure of the retried call, HALTS: from then on no new dispatch is spawned
// (only the in-flight results' own landing: their commit, their park, their gate-worktree release, the paused close).
class InfraError extends Error { constructor(message, extra = {}) { super(message); this.infra = true; Object.assign(this, extra) } }
const isInfraError = (e) => Boolean(e && e.infra === true)
let infraHalt = null   // { kind: 'limit'|'infra', label, detail } once the run is halted
const parkedWos = []
const acceptedWos = []
// A thrown message is the runtime's own error text: any limit-ish word counts. An ANSWER's text is the agent's prose
// (a builder or a reviewer may legitimately write about HTTP 429 handling or a product's own usage-limit banner), so
// only the provider's own envelope counts there (PROVIDER_ENVELOPE_RE); the runtime's plain limit reply counts only
// when it IS the whole bare-text answer, never as a phrase inside a verdict (LIMIT_REPLY_RE, anchored at the start).
const THROWN_LIMIT_RE = /\b(?:429|529)\b|overloaded|rate[ _-]?limit|usage limit|quota|too many requests/i
const PROVIDER_ENVELOPE_RE = /"type"\s*:\s*"(?:rate_limit_error|overloaded_error)"|\bAPI Error:?\s*(?:429|529)\b|Claude(?: AI)? usage limit reached\|\d{9,}/i
const LIMIT_REPLY_RE = /^\s*(?:Claude(?: AI)? usage limit reached\b|(?:you've|you have) (?:hit|reached) your (?:usage )?limit\b)/i
const INFRA_ALLOWED_AFTER_HALT = /^(?:commit:|park:|gate-release:|build-paused$)/
function infraSignal(answer, err, opts) {
  if (err) {
    const m = String((err && err.message) || err)
    return { kind: THROWN_LIMIT_RE.test(m) ? 'limit' : 'infra', detail: `threw: ${m.slice(0, 200)}` }
  }
  if (answer === null || answer === undefined) return { kind: 'infra', detail: 'returned no output' }
  if (typeof answer === 'string') {
    if (!answer.trim()) return { kind: 'infra', detail: 'returned empty text' }
    return PROVIDER_ENVELOPE_RE.test(answer) || LIMIT_REPLY_RE.test(answer) ? { kind: 'limit', detail: 'its text is a usage-limit reply' } : null
  }
  if (typeof answer === 'object') {
    if (opts && opts.schema && !Array.isArray(answer) && Object.keys(answer).length === 0) return { kind: 'infra', detail: 'returned an empty object' }
    const text = ['failure', 'reason', 'error'].map((k) => answer[k]).filter((v) => typeof v === 'string').join(' ')
    if (PROVIDER_ENVELOPE_RE.test(text)) return { kind: 'limit', detail: 'its text carries the provider\'s usage-limit envelope' }
  }
  return null
}
function haltForInfra(sig, label) {
  if (!infraHalt) {
    infraHalt = { kind: sig.kind, label: label || '', detail: sig.detail }
    log(`⏸ INFRA HALT (paused-infra, proposal 39 C7): ${sig.kind === 'limit' ? 'a usage-limit/429/overload signature' : 'a second infrastructure failure'} on ${label || 'an agent call'} (${sig.detail}) — no new dispatch; in-flight results land, unlanded work orders are parked`)
  }
  return new InfraError(`infra halt: ${sig.detail}`, { kind: sig.kind, label })
}
// The Workflow runtime has no sleep: the pause is a cheap MECH op whose only command is `sleep`.
async function infraPause(forLabel) {
  agentSpawned++
  try {
    const r = await spawnWithTypeFallback(`${WORK_FROM}INFRA PAUSE (proposal 39 C7): the previous agent call (${forLabel}) failed for an infrastructure reason. Run exactly \`sleep ${INFRA_PAUSE_SECONDS}\` as ONE Bash call (timeout ${(INFRA_PAUSE_SECONDS + 30) * 1000} ms), nothing before or after it, then return { done: true }.`,
      { label: `infra-pause:${forLabel}`, phase: 'Build', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
    return Boolean(r && r.done === true)
  } catch (e) { return false }
}
async function infraGuardedSpawn(finalPrompt, rest) {
  const label = (rest && rest.label) || ''
  if (infraHalt && !INFRA_ALLOWED_AFTER_HALT.test(label)) throw new InfraError(`run paused (${infraHalt.kind}): ${label || 'an agent call'} was not dispatched`, { kind: infraHalt.kind, label, refused: true })
  for (let attempt = 1; ; attempt++) {
    let answer
    let err = null
    try { answer = await spawnWithTypeFallback(finalPrompt, rest) } catch (e) { err = e }
    if (err && (isInfraError(err) || (typeof err.message === 'string' && AGENT_TYPE_NOT_FOUND_RE.test(err.message)))) throw err   // a missing agent type is configuration, never infra
    const sig = infraSignal(answer, err, rest)
    if (!sig) return answer
    if (sig.kind === 'limit' || attempt >= 2 || infraHalt) throw haltForInfra(sig, label)
    log(`⚠ infra on ${label || 'an agent call'} (${sig.detail}) — not a work-order failure: pausing ${INFRA_PAUSE_SECONDS}s, then one retry (proposal 39 C7)`)
    if (!(await infraPause(label))) throw haltForInfra({ kind: 'infra', detail: `${sig.detail}; the pause itself failed` }, label)
  }
}
async function spawnWithTypeFallback(finalPrompt, rest) {
  // Already know pandacorp:mech is unavailable this run — substitute the fallback BEFORE spawning, so
  // this call never pays for a repeat of the same guaranteed rejection.
  if (mechUnavailable && rest && rest.agentType === 'pandacorp:mech') {
    rest = { ...rest, agentType: rest.fallbackAgentType || DEFAULT_AGENT_FALLBACK }
  }
  try {
    const answer = await __rawAgent(finalPrompt, rest)
    laneTopUp()   // BL-0192: every agent boundary of a D1 landing ladder refills slots freed meanwhile (no-op otherwise)
    return unwrapMech(answer, rest)
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
      log(`agentType '${requestedType}' no disponible en este runtime — usando ${fallback} como fallback${typeFallbackAnnounced.has(requestedType) ? '.' : ` (plugin desactualizado en la sesión: reinicia la sesión para cargar el plugin instalado — BL-0168; hasta entonces el agente dedicado no se usa).`}`)
    }
    const announceFallback = !typeFallbackAnnounced.has(requestedType)
    typeFallbackAnnounced.add(requestedType)
    const retryPrompt = announceFallback && typeof finalPrompt === 'string' ? MECH_FALLBACK_EVENT(requestedType, fallback) + finalPrompt : finalPrompt
    try {
      return unwrapMech(await __rawAgent(retryPrompt, { ...rest, agentType: fallback }), rest)
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
    greenfieldProbe: { type: 'string', description: '9.118.2: the ONE stdout line of the greenfield probe command, VERBATIM (a sealed JSON line — never re-formatted, never summarized). Only when escalating.' },
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
  properties: { wo: { type: 'string' }, finding: { type: 'string', description: 'the specific bounded fault, with file:line' }, failingTest: { type: 'string', description: 'the RED-proven test (path / describe-it / a snippet) that fails without the fix and passes with it' }, files: { type: 'array', items: { type: 'string' }, description: 'the file(s) the fix should touch' }, fixLines: { type: 'integer', description: 'your estimate of the fix size in changed lines' } },
} }
// BL-0211: every finding the gate noticed but did NOT record as a fail/finding because a WO, change card or the FRD scopes
// it out. Only `finding` is schema-required: the ENGINE validates source/quote (enforceWholeFrdTraceability) and re-asks, so a
// missing citation is a fixable gap, never a schema rejection that would read as a dead gate.
const DISMISSALS = { type: 'array', description: 'BL-0211: each thing you noticed and did NOT record as a fail/finding because a work order, change card or the FRD scopes it out. Each needs the LITERAL citation (source = <repo-relative path>:<line>, quote = that line verbatim); without it the engine treats the finding as NOT dismissed.', items: {
  type: 'object', required: ['finding'],
  properties: { finding: { type: 'string', description: 'what you noticed' }, ground: { type: 'string', description: 'wo-scope | change-card-scope | frd-scope | other' }, contract: { type: 'string', description: 'the REQ/AC id (or clause text) when this is a normative clause of frd.md' }, source: { type: 'string', description: 'repo-relative path and line of the literal line that scopes it out, e.g. docs/frds/frd-03/frd.md:31' }, quote: { type: 'string', description: 'that line\'s own words, verbatim' } },
} }
const FRD_GATE_SCHEMA = {
  type: 'object', required: ['green', 'traceability'],
  properties: { green: { type: 'boolean' }, reopen: { type: 'array', items: { type: 'string' } }, findings: FINDINGS, missingFoundation: MISSING_FOUNDATION, blocked_reason: BLOCK_REASON, failure: { type: 'string' }, dismissals: DISMISSALS,
    traceability: { type: 'array', minItems: 7, description: 'Whole-FRD normative inventory: AT LEAST ONE entry per contractClass (requirement, acceptance-criterion, invariant, edge-case, limit, error, exclusion) — an omitted class is RED. A REQ-NN-MMM requirement is its OWN requirement entry, never covered only via its acceptance-criterion entries. A class that genuinely does not apply gets a not-applicable entry with tests: [] instead of being omitted.', items: { type: 'object', required: ['contract', 'contractClass', 'status', 'tests'], properties: { contract: { type: 'string' }, contractClass: { type: 'string', enum: ['requirement', 'acceptance-criterion', 'invariant', 'edge-case', 'limit', 'error', 'exclusion'] }, status: { type: 'string', enum: ['pass', 'fail', 'not-applicable'] }, tests: { type: 'array', items: { type: 'string' } },
      // BL-0178: a PROPOSAL only — the engine proves or rejects it (adjudicateDrift). Meaningful on a `fail` entry.
      claim: { type: 'string', enum: ['preexisting'], description: 'BL-0178: set ONLY on a status:"fail" entry you believe this cycle did NOT cause. A proposal — the engine proves it with a differential run of evidence_test before it counts.' },
      evidence_test: { type: 'string', description: 'BL-0178: the probe you wrote to demonstrate the contradiction, at .pandacorp/run/drift-probes/<frd>/<contract-id>.drift-probe.ts (imports via @/ only; never in testFiles).' },
      direction: { type: 'string', enum: ['code', 'spec', 'unknown'], description: 'BL-0178: your read of which side is wrong — the owner decides on the resulting card.' } } } },
    // C2: on a PASS the review-only gate returns the new/changed adversarial TEST FILES it wrote (repo-relative)
    // so the serialized apply-gate step can PORT them from the frozen worktree onto the main tree.
    probes: { type: 'array', items: { type: 'object', properties: { wo: { type: 'string' }, test: { type: 'string' } } } },
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
// ── BL-0211 — a scope dismissal is only a dismissal with its LITERAL citation ──────────────────────────────────────
// Canary F1: the FRD-03 gate saw the REQ-03-007 chip lives on an unmounted table and waved it off as "matches what the
// owner's change card and the WO scope asked for" without quoting either. Checked afterwards: the WO does carry "Out of
// scope: mounting PortfolioTable" but the change card does not, and frd.md says the row SHALL show the chip. So the rule has
// two halves: (1) no citation, no dismissal; (2) a work order / change card can never dismiss a normative FRD contract
// (the FRD outranks the WO; a WO that defers a SHALL is itself the contradiction), only a line of frd.md / the PRD can.
// The engine has no fs, so it validates the citation's SHAPE and (via the prompt) relies on the reviewer having opened the
// file; a dismissal that fails is treated as NOT dismissed: the verdict is deficient and the gate is re-asked once (B2).
const DISMISSAL_SOURCE_RE = /^(?:docs\/|\.pandacorp\/inbox\/changes\/)[^\s:]+\.md:[1-9]\d*(?:-[1-9]\d*)?$/
const DISMISSAL_FRD_SOURCE_RE = /^docs\/(?:frds\/[^/\s:]+\/frd\.md|product\/prd\.md|product\/prds\/[^\s:]+\.md):[1-9]\d*(?:-[1-9]\d*)?$/
const DISMISSAL_MIN_QUOTE_CHARS = 10
const HARNESS_MARKER_RE = /\bharness\b|opt-out marker|data-scroll-x|\bunblessed\b/i
function classifyDismissals(result) {
  const list = result && Array.isArray(result.dismissals) ? result.dismissals : []
  const flawed = []
  const valid = []
  for (const d of list) {
    const obj = d && typeof d === 'object' ? d : {}
    const finding = String(obj.finding || obj.contract || '').replace(/\s+/g, ' ').trim().slice(0, 120) || '(unnamed dismissal)'
    const source = String(obj.source || '').trim()
    const quote = String(obj.quote || '').replace(/\s+/g, ' ').trim()
    const contract = obj.contract || contractIdOf(obj.finding) || contractIdOf(quote)
    let why = ''
    if (FAST && HARNESS_MARKER_RE.test(String(obj.finding))) why = 'a harness-marker finding is a finding with its fix, never a dismissal'
    else if (!DISMISSAL_SOURCE_RE.test(source)) why = 'no <path>:<line> citation of a docs/ or change-card line'
    else if (quote.length < DISMISSAL_MIN_QUOTE_CHARS) why = 'no literal quote of that line'
    else if (contract && !DISMISSAL_FRD_SOURCE_RE.test(source)) why = 'a work order or change card cannot dismiss a normative FRD contract (the FRD outranks the work order): only a line of frd.md or the PRD can, otherwise record it as a fail'
    if (why) flawed.push({ finding, why })
    else valid.push({ finding, source, quote })
  }
  return { flawed, valid }
}
const flawedDismissals = (result) => classifyDismissals(result).flawed
// Proposal 40 Phase 4: a fast green verdict needs >= 1 probe per reviewed work order (GATE_TESTS). Missing → the same
// deficient-verdict path as a missing traceability class: ONE re-ask (B2), then needs-owner, never certified.
function enforceProbes(reviewIds, r) {
  if (!FAST || !r || r.green !== true) return r
  const has = new Set((Array.isArray(r.probes) ? r.probes : []).map((p) => String((p && p.wo) || '').toLowerCase()))
  const missing = reviewIds.filter((id) => !has.has(id.toLowerCase()))
  if (!missing.length) return r
  log(`⚠ green verdict without an adversarial probe for ${missing.join(', ')}`)
  return { ...r, green: false, traceabilityDeficient: true, missingClasses: missing.map((id) => `a probe for ${id} (write the test, list it in \`probes\`)`), failure: `no probe for ${missing.join(', ')}` }
}
// What the re-ask tells the reviewer about its flawed dismissals ('' when there are none).
const dismissalReaskNote = (flawed) => flawed && flawed.length
  ? ` Your verdict's \`dismissals\` array carried ${flawed.length} scope dismissal(s) without a valid LITERAL citation, so the engine treats them as NOT dismissed: ${flawed.map((x) => `"${x.finding}" (${x.why})`).join('; ')}. For each one either (a) open the file, find the line that scopes it out with grep -n, and cite it as source \`<path>:<line>\` plus its verbatim quote (note: the FRD outranks the work order, so a work order or change card line can never dismiss a normative FRD clause; only a line of frd.md can), or (b) you cannot cite it, so record it as a \`fail\` traceability entry or a finding. Never dismiss from memory or paraphrase.`
  : ''
// The B2 re-ask directive (BL-0157), shared by gateConverge and the in-run retry. Unchanged text when only classes are
// missing; BL-0211 adds the flawed-dismissal paragraph, and a dismissal-only deficiency drops the class paragraph.
function traceabilityReaskDirective(gate, resubmitTail) {
  const missingClasses = (gate && gate.missingClasses) || []
  const dismissalNote = dismissalReaskNote(gate && gate.flawedDismissals)
  const dismissalOnly = dismissalNote && missingClasses.length === 0
  const head = dismissalOnly
    ? '**RE-ASK — your prior verdict\'s scope dismissals were not backed by a literal citation (this is not a re-review of the code, judge the same work again):**'
    : '**RE-ASK — your prior verdict\'s traceability inventory was INCOMPLETE (this is not a re-review of the code, judge the same work again):**'
  const classes = dismissalOnly ? '' : ` your last \`traceability\` array had no entry for: ${missingClasses.join(', ') || 'a required contractClass'}. Every one of the 7 \`contractClass\` values (requirement, acceptance-criterion, invariant, edge-case, limit, error, exclusion) needs >= 1 entry. A REQ-NN-MMM requirement is its OWN \`requirement\` entry, distinct from the acceptance-criterion entries that test it. If a class genuinely does not apply to this FRD, add a \`not-applicable\` status entry for it with \`tests: []\` instead of omitting it.`
  return `${head}${classes}${dismissalNote} Re-submit your FULL verdict ${resubmitTail}`
}
function enforceWholeFrdTraceability(result) {
  const trace = result && result.traceability
  const missingClasses = Array.isArray(trace) ? REQUIRED_TRACE_CLASSES.filter((kind) => !trace.some((entry) => entry && entry.contractClass === kind)) : REQUIRED_TRACE_CLASSES.slice()
  const missing = missingClasses.length > 0
  const invalidBoundary = Array.isArray(trace) && trace.some((entry) => entry && ['edge-case', 'limit'].includes(entry.contractClass) && entry.status === 'pass' && (!Array.isArray(entry.tests) || entry.tests.length === 0))
  // BL-0178: only an OPEN fail waives nothing — an engine-proven pre-existing drift entry (status 'drift')
  // or an engine-refuted claim ('discarded') no longer contradicts a green verdict; an unproven claim does.
  const waivedFailure = result && result.green === true && Array.isArray(trace) && trace.some(isOpenFail)
  const flawed = flawedDismissals(result)   // BL-0211
  if (!(missing || invalidBoundary || waivedFailure || flawed.length)) return result
  // Keep the original phrase verbatim (older log/test assertions match on it, e.g. WP06f) and APPEND the
  // specifics B1/B2 need to act on — which classes are missing, named, never just "incomplete".
  const note = `whole-FRD traceability is missing, lacks boundary evidence, or contradicts a green verdict${missing ? ` — missing contractClass: ${missingClasses.join(', ')}` : ''}${invalidBoundary ? '; an edge-case/limit entry claims pass with no boundary test' : ''}${waivedFailure ? '; a traceability entry is status:fail under an overall green verdict' : ''}${flawed.length ? `; a scope dismissal lacks a valid literal citation: ${flawed.map((x) => `"${x.finding}" (${x.why})`).join('; ')}` : ''}`
  log(`⚠ ${(result && result.frd) || 'gate'}: ${note}`)
  // BL-0157 scope guard: the "reviewer forgot to inventory a whole class" defect (canary C) is a
  // FORMAT gap a re-ask can fix (B2). A NULL/garbled result (dead agent, G2) or a genuine CONTRADICTION
  // — invalidBoundary (a boundary claimed pass with zero tests) or waivedFailure (a recorded `fail` under
  // an overall green) — is NOT a format gap; it is evidence the underlying judgment itself may be wrong,
  // so it keeps the pre-BL-0157 hard-fail contract (no traceabilityDeficient flag → gateConverge never
  // re-asks it, falls straight to attemptRepair/blocked 'error' exactly as before this fix).
  const reaskable = (missing || flawed.length > 0) && !invalidBoundary && !waivedFailure && result && typeof result === 'object'
  if (!result || typeof result !== 'object') return { green: false, traceability: [], failure: note }
  const safeTrace = Array.isArray(trace) ? trace : []
  const deficientFields = reaskable ? { traceabilityDeficient: true, missingClasses, flawedDismissals: flawed } : {}
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
//   • BL-0206: the proof line itself never arrived intact (seal mismatch after two re-reads of the stored copy) →
//     UNPROVEN: neither drift nor a cycle fault — a model's transcription error says nothing about the code — so
//     the entry stays an OPEN fail: no reopen, no card, and a green resting on it is deferred, never certified.
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
// BL-0206: the proof line reaches the engine through a MECH agent — a model, not a lossless copy channel.
// Canary F1 lost a whole `"base":[…]` key in the relay (still valid JSON → read as "probe unloadable at
// last_green_sha" → a spurious cycle fault, BL-0209); canary F2 dropped one `]` (invalid JSON → the same
// fault, 4.01 $ of spurious patch). drift-proof.mjs therefore SEALS its line (drift-seal.mjs: a cyrb53 checksum
// of the body as the last key, body ASCII-only) and the engine recomputes the seal over the EXACT text it got.
// This is a verbatim copy of drift-seal.mjs's `cyrb53` + verifier (a Workflow script has no imports); the test
// suite seals every fixture with the real module, so a divergence between the two fails every sealed scenario.
const cyrb53 = (str) => {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}
const DRIFT_SEAL_RE = /,"sum":"([0-9a-f]{14})"\}$/
// Bench FM-8: a relay that DECODED an escape (\u203a → ›) changed no value; the text is re-escaped as sealLine wrote it
// before hashing (drift-seal.mjs asciiOnly), so only a real change fails.
const driftSealHolds = (text) => {
  const m = DRIFT_SEAL_RE.exec(text)
  return Boolean(m) && cyrb53(`${text.slice(0, m.index)}}`.replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)).toString(16).padStart(14, '0') === m[1]
}
// Fail-closed parse of the MECH's verbatim stdout (same discipline as validateEvidence): anything that is not
// the script's ok:true shape proves nothing. `transport: true` = the line never ARRIVED intact (nothing came
// back, unparseable, unsealed, or the seal does not match what the relay delivered). That says nothing about
// the claim, so the caller never turns it into a verdict (a cycle fault / reopen, BL-0206) — it re-reads the
// stored proof and, failing that, leaves the claim UNPROVEN. A script REFUSAL (`ok:false`, an intact line) and a
// shape violation in a sealed line stay what they always were: fail-closed cycle faults.
function parseDriftProof(answer) {
  const raw = unwrapAnswer(answer, 'output')
  const text = raw && typeof raw.output === 'string' ? raw.output.trim().split('\n').pop() : ''
  if (!text) return { proof: null, error: 'the drift-proof runner returned no output', transport: true }
  let j
  try { j = JSON.parse(text) } catch { return { proof: null, error: 'the drift-proof output is not valid JSON', transport: true } }
  if (j && typeof j === 'object' && j.ok === false && typeof j.error === 'string') return { proof: null, error: `the drift-proof script refused: ${j.error}` }
  const sealed = Boolean(j) && typeof j === 'object' && (j.sum !== undefined || Number(j.version) >= 2)
  if (sealed && !driftSealHolds(text)) return { proof: null, error: 'the drift-proof output failed its integrity seal (the relay altered it)', transport: true }
  if (!sealed && !(j && typeof j === 'object' && j.version === 1)) return { proof: null, error: 'the drift-proof output carries neither a seal nor a legacy version marker (garbled)', transport: true }
  if (!j || j.ok !== true) return { proof: null, error: `the drift-proof script refused: ${(j && j.error) || 'no ok:true'}` }
  if (!Array.isArray(j.probes) || !j.owned || typeof j.owned !== 'object') return { proof: null, error: 'the drift-proof output lacks probes/owned' }
  return { proof: j, error: '', legacy: !sealed }
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
 * @param {boolean} [unreadable] the proof line never arrived intact (BL-0206) — the claim is then UNPROVEN, not a fault
 * @returns {{ verdict: 'preexisting'|'regression'|'refuted'|'cycle-fault'|'unproven', why: string, stored?: string }}
 */
function classifyDriftClaim(entry, proof, owned, proofError, unreadable = false) {
  const id = contractIdOf(entry.contract)
  if (!id) return { verdict: 'cycle-fault', why: 'the contract carries no REQ/AC id, so non-ownership cannot be proven' }
  if (!DRIFT_PROBE_RE.test(String(entry.evidence_test || ''))) return { verdict: 'cycle-fault', why: 'no valid evidence_test probe (.pandacorp/run/drift-probes/<frd>/<id>.drift-probe.ts)' }
  if (!proof) return { verdict: unreadable ? 'unproven' : 'cycle-fault', why: proofError || 'the differential proof did not run' }
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
const DRIFT_PROOF_REPLAYS = 2   // BL-0206: cheap re-reads of the stored proof after an altered relay, before a claim is left unproven
async function runDriftProof(frd, reviewIds, claims, pinSha, sourceDir) {
  const st = frdState.get(frd)
  const reviewed = st ? st.f.workOrders.filter((w) => reviewIds.includes(w.id)) : []
  const woPaths = reviewed.map((w) => w.path).filter((p) => DRIFT_WO_PATH_RE.test(String(p || '')))
  const provable = claims.filter((e) => DRIFT_PROBE_RE.test(String(e.evidence_test || '')) && String(e.evidence_test).includes(`/drift-probes/${frd}/`))
  if (!provable.length) return { proof: null, owned: null, error: 'no claim carries a valid evidence_test for this FRD' }
  if (!reviewed.length || woPaths.length !== reviewed.length) return { proof: null, owned: null, error: 'a reviewed work order has no valid path — ownership cannot be read' }
  // BL-0206: the script keeps a SEALED copy of its line on disk (`--out`); when the first relay of the stdout
  // fails its seal, the engine re-reads that stored line (`replay`: no probe re-runs, seconds) instead of
  // trusting or re-running anything. The single spawn site below serves both reads.
  st.driftProofSeq = (st.driftProofSeq || 0) + 1
  const storedProof = `.pandacorp/run/drift-proofs/${frd}/${String(pinSha || 'head').replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'head'}-${st.driftProofSeq}.json`
  const proveCmd = `${DRIFT_CLI_COMMAND} prove --project ${shellQuote(PROJECT_DIR)} --frd ${shellQuote(frd)} --source ${shellQuote(sourceDir)} --pin ${shellQuote(pinSha || 'HEAD')} ${woPaths.map((p) => `--wo ${shellQuote(p)}`).join(' ')} ${[...new Set(provable.map((e) => e.evidence_test))].map((p) => `--probe ${shellQuote(p)}`).join(' ')} --out ${shellQuote(storedProof)}`
  const replayCmd = `${DRIFT_CLI_COMMAND} replay --project ${shellQuote(PROJECT_DIR)} --frd ${shellQuote(frd)} --file ${shellQuote(storedProof)}`
  const relay = async (label, cmd, what) => {
    agentSpawned++
    try {
      return await agent(`${MCR}BL-0178 ${what} for ${frd}. ${RUN_ONCE} from the project root ${VERBATIM_AS}output\`: \`${cmd}\`. ${label.startsWith('drift-proof-replay:') ? 'It only prints a line it stored earlier, so it is instant.' : "It checks the reviewer's probe(s) out at the gate pin and at that pin's last_green_sha in throwaway worktrees it creates and removes itself, runs them, and prints ONE JSON line; it can take several minutes and exits 0 even when probes fail — that is data, not a problem for you to fix."} The line is machine JSON ending in an integrity checksum (\`"sum":"…"\`): copy it CHARACTER FOR CHARACTER — the engine rejects any altered copy. Do not inspect, edit, test, fix, stage or commit anything yourself, and do not summarize, re-format or re-type the output.`,
        { label, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: DRIFT_OUTPUT_SCHEMA })
    } catch (e) {
      if (isInfraError(e)) throw e   // proposal 39 C7: an infra halt is never read as a missing receipt
      log(`⚠ ${frd}: the ${label} runner threw (${(e && e.message) || e})`)
      return null
    }
  }
  let parsed = parseDriftProof(await relay(`drift-proof:${frd}`, proveCmd, 'differential drift proof'))
  for (let i = 1; !parsed.proof && parsed.transport && i <= DRIFT_PROOF_REPLAYS; i++) {
    log(`⚠ DriftProofRelay ${frd}: ${parsed.error} — re-reading the stored proof, attempt ${i}/${DRIFT_PROOF_REPLAYS} (BL-0206: a model's copy of machine JSON is never trusted, never turned into a verdict)`)
    parsed = parseDriftProof(await relay(`drift-proof-replay:${frd}`, replayCmd, 'drift proof re-read'))
  }
  const { proof, error } = parsed
  if (!proof && parsed.transport) {
    log(`⚠⚠ DriftProofUnreadable ${frd}: ${error} after ${DRIFT_PROOF_REPLAYS} re-read(s) — the proof is unreadable: every drift claim stays UNPROVEN: no reopen, no card, no drift: entry; an open fail (DR-122, BL-0206); re-running the gate proves it`)
    return { proof: null, owned: null, error, unreadable: true }
  }
  if (!proof) { log(`⚠ ${frd}: ${error} — every drift claim stays a cycle fault (BL-0178 fail-closed)`); return { proof: null, owned: null, error } }
  if (parsed.legacy) log(`⚠ ${frd}: the drift-proof script predates the sealed output (version 1) — its relay integrity could not be verified (BL-0206; update the installed plugin)`)
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
  // BL-0206: the command is idempotent on disk (drift_key), so when its one-line result never ARRIVES readable
  // (nothing back / unparseable — the relay is a model) it is simply run once more; a script REFUSAL (ok:false) is final.
  let res = null
  for (let attempt = 1; attempt <= 2 && !res; attempt++) {
    agentSpawned++
    let raw = null
    try {
      raw = await agent(`${MCR}BL-0178 drift record for ${frd}. ${RUN_ONCE} from the project root and return its stdout VERBATIM as \`output\`: \`${cmd}\`. It writes draft change card(s) into .pandacorp/inbox/changes/ (gitignored owner channel, idempotent) and appends one GateDriftRecorded event. Do not edit, stage or commit anything yourself.`,
        { label: `drift-record:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: DRIFT_OUTPUT_SCHEMA })
    } catch (e) { raw = null; log(`⚠ ${frd}: the drift-record runner threw (${(e && e.message) || e})`) }
    raw = unwrapAnswer(raw, 'output')
    try { res = raw && typeof raw.output === 'string' ? JSON.parse(raw.output.trim().split('\n').pop()) : null } catch { res = null }
    if (!res && attempt === 1) log(`⚠ ${frd}: the drift-record result was unreadable — running the idempotent command once more (BL-0206)`)
  }
  if (!res || res.ok !== true) {
    log(`⚠⚠ ${frd}: drift ${fresh.map((d) => d.id).join(', ')} is PROVEN but its draft card could NOT be written (${(res && res.error) || 'no ok:true output'}) — file the card by hand (BL-0178)`)
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
  const { proof, owned, error, unreadable } = await runDriftProof(frd, reviewIds, claims, pinSha, sourceDir)
  const confirmed = []
  const faults = []
  const unreadableIds = []
  const trace = gate.traceability.map((e, i) => {
    if (!claimIdx.includes(i)) return e
    // BL-0203: a claim the drift finder proposed (merged by mergeDriftFinderClaims) takes the finder predicate —
    // same facts, but an unproven finder claim is discarded instead of becoming a cycle fault.
    const fromFinder = e.origin === 'drift-finder'
    const c = fromFinder ? classifyFinderClaim(e, proof, owned, error) : classifyDriftClaim(e, proof, owned, error, unreadable === true)
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
      if (unreadable === true) unreadableIds.push(id || e.contract)
      if (!fromFinder) {
        // Red-team of BL-0206: an unread proof is not evidence FOR the claim either, so the reviewer's `fail` stays an
        // OPEN fail (it never waives a green, DR-015/DR-122) — only its routing changes: no reopen, no card (below).
        log(`⚖ ${frd}: drift claim on ${id || e.contract} is UNPROVEN (${c.why}) — unreadable proof: an OPEN fail, no reopen, no card (DR-122, BL-0206)`)
        const { claim, ...open } = claimEntry
        return { ...open, driftVerdict: 'unproven', driftWhy: c.why }
      }
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
  } else if (next.green !== true && onlyDriftRed && !(next.reopen && next.reopen.length) && next.blocked_reason === 'needs-owner' && unreadableIds.length) {
    // BL-0206: the lift below needs PROVEN drift. The proof was unreadable, so the reviewer's own block stands
    // (the engine adds no block and no reopen of its own — the owner decides).
    log(`◦ ${frd}: the needs-owner block is KEPT — it rested on drift claim(s) ${unreadableIds.join(', ')} whose proof could not be read, so they are not proven drift (BL-0206)`)
  } else if (next.green !== true && onlyDriftRed && !(next.reopen && next.reopen.length) && next.blocked_reason === 'needs-owner') {
    // The canary-D2 frd-02 shape: the reviewer blocked needs-owner ONLY because of drift it could not pin on a
    // reviewed WO. Every one of its reds is now proven drift (or refuted) → policy (a): the cycle is not blocked.
    log(`✓ ${frd}: the gate blocked needs-owner ONLY over drift the engine proved pre-existing — policy (a): the block is lifted, the cycle's work orders are certified (BL-0178)`)
    next = { ...next, green: true, blocked_reason: undefined, failure: undefined, __driftBlockLifted: true }
  }
  // BL-0206 (red-team): an UNPROVEN claim is an open fail that is not the cycle's fault either. A green verdict resting on
  // it is NOT certified (the waiver hole BL-0078 closed stays closed) and NOT reopened (no code change is warranted by an
  // unread proof): the FRD is deferred — kept IN_REVIEW, nothing reverted — and re-gates next pass with a fresh proof.
  // Under a reopen it rides along as a finding, exactly as before BL-0206 (the verifier inherits it as an open fail).
  const unproven = trace.filter((e) => e && e.driftVerdict === 'unproven')
  if (unproven.length && next.green === true && !faults.length) {
    log(`⛔ DriftProofUnproven ${frd}: ${unproven.map((e) => contractIdOf(e.contract) || e.contract).join(', ')} stay OPEN fails — the FRD is NOT certified this run and NOT reopened; it re-gates next pass (DR-122, BL-0206)`)
    next = { ...next, green: false, __driftUnproven: true, failure: `BL-0206: ${unproven.length} pre-existing-drift claim(s) could not be proven (the differential proof was unreadable) — not certified, re-gated next pass` }
  } else if (unproven.length && next.reopen && next.reopen.length) {
    next = { ...next, findings: [...(next.findings || []), ...unproven.map((e) => ({ wo: reviewIds[0], finding: `${e.contract} — contradicted, and its pre-existing-drift claim could NOT be proven (BL-0206: the differential proof was unreadable) — an open fail like any other`, failingTest: String(e.evidence_test || ''), files: [] }))] }
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
  let result = enforceProbes(reviewIds, enforceWholeFrdTraceability(adjudicated))
  // BL-0211: an ACCEPTED scope dismissal is auditable from the log alone (what was waved off, on which line, in whose words).
  for (const d of classifyDismissals(adjudicated).valid) log(`⊙ ${frd}: gate dismissed "${d.finding}" by ${d.source} — "${d.quote.slice(0, 160)}"`)
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
// SEALED line (seal-report.mjs, BL-0214) of `.pandacorp/run/gate-report.json` (a string, not a parsed object)
// precisely so the engine can prove it arrived intact (the checksum), is well-formed JSON and carries a boolean
// `green` before any reviewer sees it: a pack that cannot be proven is re-read from its stored copy, and if that
// fails too it is discarded and the gate runs in explore mode.
const EVIDENCE_SCHEMA = {
  type: 'object', required: ['report'],
  properties: {
    report: { type: ['string', 'null'], description: 'BL-0214: the SEALED LINE the last command of step 1 printed (`seal-report.mjs seal` over .pandacorp/run/gate-report.json after `bash .pandacorp/verify.sh --since <last_green_sha> --report-all`) — that one line, byte-for-byte, never re-formatted, never a summary. The engine recomputes its checksum. `null` iff the sanity gate (step 0) refused to run verify.sh at all — see `reason`.' },
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
// ── Proposal 39: scripted MECH ops (C1) and the paused-infra exit (C7) ─────────────────────────────
// A model sometimes returns its structured answer wrapped as ONE string-valued key ({"parameter": "<json>"}) instead of
// the schema's own `key`. Unwrapped once, before any check: the inner JSON object when it carries `key`, or the bare
// sealed line itself (an object with its "sum") as `key`. Nothing else is guessed; the seal check still decides.
function unwrapAnswer(raw, key) {
  const fromText = (text) => {
    let j = null
    try { j = JSON.parse(text) } catch { return null }
    if (!j || typeof j !== 'object' || Array.isArray(j)) return null
    if (key in j) return j
    return typeof j.sum === 'string' ? { [key]: text.trim() } : null
  }
  if (typeof raw === 'string') return fromText(raw) || raw
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || key in raw) return raw
  const keys = Object.keys(raw)
  return keys.length === 1 && typeof raw[keys[0]] === 'string' ? (fromText(raw[keys[0]]) || raw) : raw
}
// The relay is a model, never a lossless copy channel: the line must carry a valid seal and name its own op.
function parseMechLine(answer, op) {
  const raw = unwrapAnswer(answer, 'line')
  const text = raw && typeof raw.line === 'string' ? raw.line.trim().split('\n').pop().trim() : ''
  if (!text) return { body: null, error: `the ${op} runner returned no line` }
  let j
  try { j = JSON.parse(text) } catch { return { body: null, error: `the ${op} line is not valid JSON` } }
  if (!driftSealHolds(text)) return { body: null, error: `the ${op} line failed its integrity seal (the relay altered it)` }
  if (!j || j.op !== op) return { body: null, error: `the line is not a ${op} receipt` }
  return { body: j, error: '' }
}
// `prefix`/`suffix`: prose the SAME spawn carries around the literal command (a fused step, a fire-and-forget event).
// Bench FM-8: the op also stores its sealed line at .pandacorp/run/receipts/<op>-<nonce>.json. A relayed line that does
// not verify is re-read ONCE from that file by a cat-only relay, never by re-running the op (its side effects are done);
// only when the re-read fails too is the op unknown, and its caller's idempotent probe decides (for lane-next: the next
// round, whose inFlightChains re-adopts a chain the lost line claimed).
let mechSeq = 0
const MECH_NONCE = `${String(LEASE_TOKEN).replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'run'}e${LEASE_EPOCH}`
async function runMechOp(op, flags, { label, phase = 'Build', prefix = '', suffix = '', dir = PROJECT_DIR }) {
  const nonce = `${MECH_NONCE}n${++mechSeq}`
  const cmd = mechOpCommand(op, `${flags ? `${flags} ` : ''}--receipt ${nonce}`, dir)
  const opts = { phase, model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: MECH_LINE_SCHEMA }
  const r = parseMechLine(await agent(prefix.trim() || suffix.trim() ? MECH_FUSED(cmd, prefix, suffix) : MECH_LITERAL(cmd), { label, ...opts }), op)
  if (r.body) return r
  agentSpawned++
  const again = parseMechLine(await agent(MECH_LITERAL(`cat ${shellQuote(`${dir}/.pandacorp/run/receipts/${op}-${nonce}.json`)}`), { label: `receipt:${label}`, ...opts }), op)
  log(again.body ? `↺ ${label}: the relayed line was unverifiable (${r.error}) — re-read from its stored receipt, the op was not re-run` : `⚠ ${label}: the relayed line was unverifiable (${r.error}) and its stored receipt too (${again.error}) — the op's outcome is unknown`)
  return again.body ? again : r
}
// park-wo: a WO that did not land moves its dirty paths to .pandacorp/run/salvage/<wo>/ and resets them, so the next
// build (or the resume) never starts on its broken files. A park that cannot run is left to the resume precheck.
// The sequential fast lane (one builder on main) also sweeps every undeclared path dirtied since the FRD's dispatch
// (--all-undeclared): a stray edit left behind would ride the next WO's commit or keep the FRD's verify refused. The
// classic waves never do: a parallel sibling's files are dirty at the same time.
const parkWoFlags = (w) => `--wo ${shellQuote(w.id)}${(w.artifacts || []).map((a) => ` --file ${shellQuote(a)}`).join('')}${FAST ? ' --all-undeclared' : ''}`
async function parkWorkOrders(wos, dir = PROJECT_DIR) {
  for (const w of wos) {
    agentSpawned++
    let r = null
    try { r = await runMechOp('park-wo', parkWoFlags(w), { label: `park:${w.id}`, dir }) } catch (e) { r = { body: null, error: (e && e.message) || String(e) } }
    if (r.body && r.body.ok === true) { parkedWos.push(w.id); log(`⇣ ${w.id} parked (${r.body.status}${r.body.dir ? ` → ${r.body.dir}` : ''}) — rebuilt on resume`) }
    else log(`⚠ ${w.id} could not be parked (${r.error || (r.body && (r.body.reason || r.body.error)) || 'no receipt'}) — ${FAST ? 'its dirty paths stay (the next fast run stops on them)' : 'the resume precheck salvages it'}`)
  }
}
const PAUSED = Object.freeze({ paused: true })
const INFRA_RESUME_HINT = 'Paused on an infrastructure failure (usage limit, 429, overload or a dead agent). Committed work orders are kept; nothing was blocked, repaired or reverted. Relaunch /pandacorp:implement once the usage window resets: the resume precheck demotes any IN_REVIEW without its commit and only that work is rebuilt.'
const jsonSafe = (s) => String(s || '').replace(/[^\w:.+@/-]/g, '_').slice(0, 120)
// The run's exit on an infra halt: accept the in-flight gates as they settle (never landed: a landing is a new
// dispatch, they re-gate on resume), then ONE allowlisted close that records build_paused and releases the lease.
// Under a usage limit that close may fail too — the result still carries the pause for the supervisor.
async function pausedExit(st = {}) {
  if (st.inFlight && st.inFlight.size) { log(`⏸ waiting for ${st.inFlight.size} in-flight gate(s) to settle — their verdicts are not landed this run`); await Promise.allSettled([...st.inFlight.values()]) }
  const h = infraHalt || { kind: 'infra', label: '', detail: 'unknown' }
  agentSpawned++
  let closed = null
  try {
    closed = await agent(`BUILD PAUSED (paused-infra, proposal 39 C7): the run halted on an infrastructure failure (${jsonSafe(h.kind)} at ${jsonSafe(h.label)}). Record it and release the run, nothing else (no verify, no fix, no commit beyond the lease release). Append the dashboard event (fire-and-forget): printf '{"event":"build_paused","at":"%s","project":"%s","reason":"${jsonSafe(h.kind)}","label":"${jsonSafe(h.label)}"}${EV_END}${TRACK('build_paused', `,"reason":"${jsonSafe(h.kind)}","label":"${jsonSafe(h.label)}"`)} Then: ${RELEASE_LEASE} Return done:true once the lease release succeeded.`,
      { label: 'build-paused', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
  } catch (e) { log(`⚠ the build-paused close could not run (${(e && e.message) || e}) — build_paused is not recorded and the lease expires by its TTL`) }
  log(`⏸ Run ended: paused-infra (${h.kind} at ${h.label || '?'}). ${INFRA_RESUME_HINT}`)
  return { mode: MODE, builtFrds: st.builtFrds || [], blockedFrds: st.blockedFrds || [], reopenedFrds: st.reopenedFrds || [], blockedReasons: st.blockedReasons || {}, blockedFailures: st.blockedFailures || {}, stopReason: 'paused-infra',
    paused: { kind: h.kind, label: h.label, detail: h.detail, parked: [...parkedWos], accepted: [...acceptedWos], closed: Boolean(closed && closed.done === true) }, resumeHint: INFRA_RESUME_HINT, ...(FAST ? { usable: fastUsable.map((u) => ({ ...u })) } : {}) }
}

async function ensureStopped(reason) {
  agentSpawned++
  const receipt = await agent(`${MCR}your SOLE action is to execute this exact command once, with no command before or after it, and return its JSON stdout verbatim: \`${STATE_CLI_COMMAND} close-preloop --project "${PROJECT_DIR}" --token "${LEASE_TOKEN}" --epoch "${LEASE_EPOCH}" --reason "${reason}"\`. Do not inspect, edit, test, build, stage or commit anything yourself. The CLI owns the fenced two-phase close and rejects every diff outside .pandacorp/status.yaml.`,
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
// Proposal 39 C7: a pre-loop await whose NON-infra failure keeps its own, unchanged behaviour (no close-out added): only
// an infra halt there becomes a pause instead of an uncaught crash. With infraGuard off no InfraError exists: a no-op.
async function infraPausable(fn) {
  try { return await fn() } catch (e) { if (isInfraError(e)) return PAUSED; throw e }
}
async function preLoopGuarded(fn) {
  try {
    return await fn()
  } catch (e) {
    if (isInfraError(e)) return PAUSED   // proposal 39 C7: an infra halt is a pause, not a pre-loop failure — the caller returns pausedExit()
    log('☠ pre-loop failure: ' + e.message)
    await ensureStopped('pre-loop failure: ' + e.message)
    throw e
  }
}

// ── Baseline self-heal (deadlock breaker) — WS-D/D10 two-step: cheap MECH pre-check → reconciling judge ──
phase('Baseline')
// Proposal 39 C7 (mechScript): the resume precheck runs FIRST, before anything reads state — it finishes interrupted
// discards, commits the journals' pending lines (never resets them), salvages engine-owned dirt (a WO file whose diff is
// only the engine's frontmatter keys; an owner-edited WO keeps every byte but its status) and demotes every IN_REVIEW without a flip commit
// after its last IN_PROGRESS stamp, so the planner below reads only committed truth. Unverifiable = fail-closed stop.
// Greenfield (fast lane): a freshly architected project's verify.sh is red BY CONSTRUCTION (knip flags the dependencies
// the work orders will import, vitest finds no tests) and it has no last_green_sha, so the cheap pre-check can only
// escalate. The precheck decides greenfield from status.yaml and the work-order frontmatter (never model prose); the
// fast lane then spends no judge baseline on it and never stops there: each FRD's own verify certifies what it builds.
let mechGreenfield = null
// The precheck already leaves these out of ownerDirt (the lease projection, the append-only journals); kept here too.
const FAST_SHARED_PATHS = new Set(['.pandacorp/status.yaml', '.pandacorp/track.jsonl', '.pandacorp/build-journal.jsonl'])
// The fused start's verified body, or null (not fused, or its line failed: then every separate step runs). The script
// emits BuildLaunch itself, so the pre-check below never emits it a second time once a fused start was attempted.
let fused = null
if (FUSED_START) {
  agentSpawned++
  const flags = [`--token ${shellQuote(LEASE_TOKEN)} --epoch ${shellQuote(String(LEASE_EPOCH))}`, ...(TARGETED ? ['--targeted'] : []), ...(ONLY || []).map((f) => `--frd ${shellQuote(f)}`),
    `--launch-event --mode ${shellQuote(MODE)} --max-agents ${shellQuote(String(MAX_AGENTS || 0))}`, ...(args && args.project ? [`--project-name ${shellQuote(PROJECT)}`] : []),
    ...(LANES_K >= 2 ? [`--lane-plan --lanes ${LANES_K}`] : [])]
  const r = await preLoopGuarded(() => runMechOp('fast-start', flags.join(' '), { label: 'fast-start', phase: 'Baseline' }))
  if (r === PAUSED) return await pausedExit()
  const b = r.body
  if (b && b.ok === true && b.precheck && b.precheck.ok === true) { fused = b; log(`▶ fast-start (one scripted op): ${b.status}${b.stage ? ` at ${b.stage}` : ''}${b.baseline ? ` · baseline ${b.baseline}` : ''}`) }
  else log(`⚠ fast-start unverifiable (${r.error || (b && (b.reason || b.error || b.status)) || 'no receipt'}) — the separate start steps run (fail-safe)`)
}
// A quiet or working fused probe is the run's FIRST safe point (no second probe right after it); its dispatch is used only
// by the FRD the engine builds first, with the same work orders. A handoff reuses neither.
let fusedProbe = fused && ['planned', 'dispatched'].includes(fused.status) && fused.probe ? fused.probe : null
let fusedDispatch = fused && fused.status === 'dispatched' && fused.dispatch && fused.dispatch.ok === true ? fused.dispatch : null
if (MECH_SCRIPT) {
  if (!fused) agentSpawned++
  const pre = fused ? { body: fused.precheck } : await preLoopGuarded(() => runMechOp('precheck', '', { label: 'mech-precheck', phase: 'Baseline' }))
  if (pre === PAUSED) return await pausedExit()
  const p = pre.body
  if (!p || p.ok !== true) {
    const why = pre.error || (p && (p.reason || p.error || p.status)) || 'no receipt'
    log(`⊘ resume precheck unverifiable or refused (${why}) — stopping before planning (fail-closed, proposal 39 C7)`)
    await ensureStopped('precheck failed')
    return { mode: MODE, builtFrds: [], blockedFrds: ['precheck'], blockedReasons: { precheck: 'error' }, note: `precheck failed: ${why}` }
  }
  const demoted = Array.isArray(p.demoted) ? p.demoted : []
  for (const d of demoted) log(`↓ resume: ${d.wo} demoted ${d.from}→${d.to} (${d.why}${d.applied === false ? ', reported only: not on main' : ''}) — rebuilt this run (proposal 39 C7)`)
  // Fast lane: a builder commits on main and undoes an undeclared edit, so it must never start over an owner's edit (the
  // precheck keeps every one and reports it). Stop BEFORE any dispatch, needs-owner, naming the paths — the judge
  // baseline's DR-067 reconciliation (classic) is not this lane's, and the greenfield path would skip it anyway.
  const ownerDirt = FAST && Array.isArray(p.ownerDirt) ? p.ownerDirt.filter((x) => typeof x === 'string' && x && !FAST_SHARED_PATHS.has(x)) : []
  if (ownerDirt.length) {
    log(`⊘ fast lane: el árbol del proyecto tiene ${ownerDirt.length} cambio(s) del owner sin commitear — el motor NO construye encima. Commitea, guarda o descarta y relanza: ${ownerDirt.join(', ')}`)
    await ensureStopped('owner dirt')
    return { mode: MODE, builtFrds: [], blockedFrds: ['owner-dirt'], blockedReasons: { 'owner-dirt': 'needs-owner' }, ownerDirt, note: `owner dirt (needs-owner): the fast lane never builds over uncommitted owner edits — commit, stash or discard, then relaunch: ${ownerDirt.join(', ')}` }
  }
  if (FAST && p.greenfield && p.greenfield.greenfield === true) mechGreenfield = { reason: String(p.greenfield.reason || 'greenfield') }
  if (Array.isArray(p.keptInReview) && p.keptInReview.length) log(`✓ resume: ${p.keptInReview.length} IN_REVIEW work order(s) hold their flip commit after the last stamp — kept, never rebuilt`)
  if (Array.isArray(p.salvaged) && p.salvaged.length) log(`⇣ resume: ${p.salvaged.length} engine-owned dirty path(s) salvaged to ${p.salvageDir} and reset`)
  if (p.status === 'attention') log(`⚠ resume: interrupted discard(s) refused for ${(p.refused || []).join(', ')} — the engine's own recovery below handles them`)
  // Both lanes: a classic run paying a fast run's review debt holds the same never-auto-discard guard (C6). Without
  // mechScript the classic lane has no precheck; wo-revert.mjs then derives the same list and refuses the discard itself.
  for (const u of Array.isArray(p.usable) ? p.usable : []) if (u && typeof u.frd === 'string' && typeof u.sha === 'string') priorUsable.push({ frd: u.frd, sha: u.sha })
  if (priorUsable.length) log(`✓ resume: ${priorUsable.map((u) => `${u.frd} @ ${u.sha}`).join(', ')} USABLE since an earlier run (committed build_usable, proposal 39 C6) — fix-forward only, never auto-discarded`)
}
if (fused && fused.status === 'stop') {
  log('⏸ owner stop signal (.pandacorp/run/stop, fast-start) — el motor para limpio antes de planificar')
  await ensureStopped('owner stop signal')
  return { mode: MODE, builtFrds: [], blockedFrds: [], note: 'owner stop signal' }
}
// The fused start's scripted baseline verdict (the rule below, made deterministic): no pre-check, no judge.
const FUSED_BASELINE = fused && ['green', 'leased-status-only', 'greenfield'].includes(fused.baseline) ? fused.baseline : null
// (a) MECH PRE-CHECK: the root guard + rethink consume + owner stop signal + the clean-tree fast path — all
// cheap, no verify.sh. Only if it escalates does the expensive judge baseline run.
if (!FUSED_BASELINE) agentSpawned++
const precheck = FUSED_BASELINE ? null : await preLoopGuarded(() => agent(
  `You are the Pandacorp baseline PRE-CHECK (mechanical — cheap; do NOT run verify.sh, do NOT fix code, just return a verdict). Do these steps IN ORDER:
  ${FUSED_START ? '' : `**STEP L — record the launch (B1):** as your very FIRST action, emit the build-launch event so the dashboard knows this run started.${BUILD_LAUNCH_EVENT}`}
  **STEP 0 — deterministic root + owner-stop receipt (BL-0068):** execute exactly \`${INSPECT_STOP}\` with Node (NEVER shell \`test\`, \`[\` or an alias-sensitive builtin). If it fails, STOP and return { green: false, failure: "BL-0022: deterministic project/lease inspection failed" }. Preserve its JSON receipt. If receipt.stop is true, return { stop: true } immediately; if false, continue. Never infer stop from a command exit code.
  **STEP W — preserve gate-worktree crash evidence (BL-0067):** NEVER delete, recreate, prune, reset, clean, or force-remove ${GATE_WORKTREE}. Its contents may be the only evidence left by a crashed gate. Leave it untouched here; the lazy gate-worktree probe below will reuse it only when Git records that exact path as a worktree and its tree is clean. Any dirty, orphaned, unregistered, locked, or ambiguous state falls back to the synchronous gate without mutation.${PARALLEL_GATES ? ` The SAME protection covers every parallel gate slot ${gateSlotPath('<k>')} (D1, args.parallelGates): never delete, recreate, prune, reset, clean or force-remove any of them — a dirty slot is dropped from the pool by its own probe, never cleaned.` : ''}
  **STEP 1 — consume the rethink stop:** if ${PROJECT_DIR}/.pandacorp/status.yaml has \`rethink_pending: true\`, set it to \`false\` and commit that one-line change (this run STARTS from the re-planned docs, so the stop signal is consumed — DR-069).
  **STEP 2 — owner stop signal:** already decided exclusively by STEP 0's Node receipt. Do not probe it again. Do NOT delete the signal (the owner removes it).
  **STEP 3 — clean-tree fast path (BL-0066), scoped to THIS project (BL-0202):** list the tree with the BL-0202 STATUS COMMAND: \`${PROJECT_STATUS_COMMAND}\` (run it VERBATIM, as ONE Bash call). Its first line is \`PREFIX=<p>\` — this project's repository prefix, the output of \`git -C ${PROJECT_DIR} rev-parse --show-prefix\` ('' for a project at its repository root, e.g. \`mission-control/\` for a nested one) — then one \`IN <path>\` line per dirty path INSIDE this project and one \`OUT <path>\` line per dirty path ELSEWHERE in the repository (a nested project shares its repository with other work, e.g. the factory's parallel sessions). **OUT paths are INFORMATIONAL ONLY: they never make this project dirty, never escalate, and you never touch them** — just report every one as outsideDirtyPaths. This project's tree is CLEAN iff there is NO \`IN\` line. Read \`last_green_sha\` from status.yaml. Prove it exists and is an ancestor: \`git -C ${PROJECT_DIR} cat-file -e <last_green>^{commit} && git -C ${PROJECT_DIR} merge-base --is-ancestor <last_green> HEAD\`. A CLEAN tree is known-green only when EITHER (a) HEAD == last_green_sha (legacy projects), OR (b) HEAD is its DIRECT child (\`git rev-parse HEAD^\` == last_green_sha) AND \`git -C ${PROJECT_DIR} diff --name-only --relative <last_green>..HEAD\` is EXACTLY \`.pandacorp/status.yaml\` (the BL-0066 metadata-only pointer commit; \`--relative\` lists this project's own paths, project-relative). Then return { green: true, outsideDirtyPaths: <every OUT path> }. Any other descendant may contain unverified work: return { escalate: true, dirty: false, dirtyPaths: [], outsideDirtyPaths: <every OUT path> }. **A dirty tree (at least one IN line) always escalates from here — do NOT decide any exclusion yourself, even if the only IN path looks like the controller's own status.yaml** — but ALWAYS also report the raw signal the engine needs to apply the narrow BL-0124 exclusion on its own: return { escalate: true, dirty: true, dirtyPaths: <every IN path>, outsideDirtyPaths: <every OUT path>, leaseValid: true, projectPrefix: <the PREFIX= value> }. **dirtyPaths entries are BARE paths, EXACTLY as the IN lines print them — repo-root-relative (git prints paths from the REPOSITORY root even for a nested project) — with the 2-character XY status code AND its separating space STRIPPED** (the command already cuts it: \`git status --porcelain\` prints \` M mission-control/.pandacorp/status.yaml\` for a nested project — status code, space, path — and the IN line reads \`IN mission-control/.pandacorp/status.yaml\`; report \`mission-control/.pandacorp/status.yaml\`, never a raw porcelain line, and never rewrite the path yourself). **projectPrefix** is the PREFIX= value VERBATIM. This is not cosmetic: the engine strips projectPrefix from dirtyPaths[0] and matches the rest against the literal string \`.pandacorp/status.yaml\` with strict equality to decide the exclusion (BL-0160 — a path still carrying its status code silently fails that match and forces an avoidable judge-baseline every time; E2 finding 2 — without the prefix a nested project could never match). (leaseValid is true, not a fresh check — reaching this step already proves it, since STEP 0's inspect-stop just succeeded under THIS run's own token/epoch, the SAME fence BL-0079 relies on for the repair step).${STRICT_BASELINE ? ' NOTE: this run launched with args.strictBaseline — the engine will NOT apply the BL-0124 exclusion regardless of what dirtyPaths/leaseValid say, so it makes no difference to your answer; report the same honest signal.' : ''}
  **STEP G — greenfield facts (9.118.2):** whenever you return escalate:true, FIRST run exactly \`${GREENFIELD_PROBE_COMMAND}\` (VERBATIM, ONE Bash call) and add its single stdout line to your verdict as \`greenfieldProbe\` — a STRING, copied character for character (it ends in a \`"sum"\` seal the engine checks; never re-format, shorten or interpret it). It is a fact for the ENGINE; it never changes any other field of your answer. Return your verdict as the structured object itself — never JSON-encoded inside a single string field.`,
  { label: 'baseline-precheck', phase: 'Baseline', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: PRECHECK_SCHEMA },
))
if (precheck === PAUSED) return await pausedExit()
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
const PRECHECK_PREFIX = (precheck && /^(?:[^/.][^/]*\/)*$/.test(optionalText(precheck.projectPrefix)) && !optionalText(precheck.projectPrefix).split('/').includes('..')) ? optionalText(precheck.projectPrefix) : ''
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
// 9.118.2 GREENFIELD (bench-medium C-1): a freshly architected project — last_green_sha empty AND every work order
// still PLANNED/DRAFT — has never been green, and its verify.sh is red BY CONSTRUCTION (knip flags the dependencies
// the work orders will import, vitest has no test files yet). The judge baseline rightly refuses to "fix" that tree,
// so the build stopped `baseline red (needs manual fix)` before building anything: a new project could never start
// implement. On greenfield the baseline is NOT APPLICABLE — the red tree is the work orders' job (per-WO self-tests,
// then the FRD gate). Decided by greenfield-probe.mjs's SEALED verdict — decideGreenfield, the ONE greenfield
// definition (DR-115), also the fast lane's precheck verdict: no published last_green_sha, not adopted (created_via:
// adopt), no work order ever IN_REVIEW/VERIFIED in git history, every work order PLANNED/DRAFT. The engine never
// re-derives it from the facts; an unsealed/garbled/refused line or any other verdict leaves the behavior unchanged
// (judge baseline). args.strictBaseline keeps the judge baseline unconditionally.
const readGreenfieldFacts = (line) => {
  if (typeof line !== 'string') return null
  const text = line.trim()
  if (!driftSealHolds(text)) return null
  let facts
  try { facts = JSON.parse(text) } catch { return null }   // a sealed but unparseable line proves nothing: not greenfield
  return facts && facts.ok === true && facts.probe === 'greenfield' ? facts : null
}
const isGreenfield = (facts) => Boolean(facts) && facts.greenfield === true
const greenfieldFacts = readGreenfieldFacts(precheck && precheck.greenfieldProbe)
let baselineGreenfield = null   // the facts, when the engine took the greenfield path — the planner records the event

if (FUSED_BASELINE) {
  baseline = { green: true }
  log(`Baseline ${FUSED_BASELINE} (fast-start, scripted: ${FUSED_BASELINE === 'greenfield' ? `${(mechGreenfield && mechGreenfield.reason) || 'greenfield'} — red by construction, each FRD's verify certifies it` : FUSED_BASELINE === 'green' ? 'clean tree at last_green_sha or its BL-0066 pointer commit' : 'the only dirty path is the leased status.yaml, BL-0124'}) — no verify.sh, no judge.`)
} else if (precheck && precheck.green === true) {
  baseline = { green: true }
  log('Baseline verde (fast path: árbol limpio en el snapshot verde o su pointer commit BL-0066) — no se corrió verify.sh.')
} else if (precheck && precheck.green === false && optionalText(precheck.failure)) {
  baseline = precheck   // BL-0022 root guard failed in the pre-check — carry its failure to the red path below
} else if (!STRICT_BASELINE && precheck && precheck.leaseValid === true && leasedStatusOnly) {
  baseline = { green: true }
  log('Baseline verde (fast path BL-0124: el único diff sucio es el status.yaml propio bajo un lease ya probado válido) — no se corrió verify.sh.')
} else if (mechGreenfield) {
  baseline = { green: true }
  log(`Baseline: greenfield (${mechGreenfield.reason}) — sin juez de baseline: verify.sh es rojo por construcción hasta que se construyan; cada FRD lo certifica en su propio verify (proposal 39, fast lane).${precheck && precheck.dirty ? ` Rutas sucias del proyecto que el motor NO toca: ${(projectDirtyPaths || []).slice(0, 10).join(', ') || '(sin lista)'}.` : ''}`)
} else if (!STRICT_BASELINE && isGreenfield(greenfieldFacts)) {
  baseline = { green: true }
  baselineGreenfield = greenfieldFacts
  log(`Baseline no aplicable (greenfield 9.118.2): last_green_sha vacío y los ${greenfieldFacts.workOrders} work orders siguen PLANNED/DRAFT — rojo por construcción; sin judge baseline.`)
} else {
  // (b) ESCALATE → the judge baseline: DR-067 reconciliation (the SKILL promised it; the prompt never had it)
  // for a dirty/off-green tree, THEN verify.sh. Keeps the BL-0022 fail path defensively.
  agentSpawned += COST(P.judge)   // DR-070/DR-073: weight EVERY spawn by model cost so the maxAgents brake is a token-proxy
  baseline = await preLoopGuarded(() => agent(
    `You are the Pandacorp baseline-repair engineer (DR-067 reconciliation + verify). The cheap pre-check found the tree DIRTY or HEAD beyond the certified last_green snapshot/pointer pair${precheck && precheck.dirty ? ' (tree is dirty)' : ''}.
    **STEP 0 — FAIL-LOUD project-root guard (BL-0022/BL-0068):** execute exactly \`${INSPECT_STOP}\`; if it fails, return { green: false, failure: "BL-0022: deterministic project/lease inspection failed" } and do nothing else. NEVER use shell \`test\` or \`[\` for this guard.
    **STEP 1 — DR-067 RECONCILIATION, scoped to THIS project (BL-0202) (only if the tree is dirty/conflicted):** list the tree with the BL-0202 STATUS COMMAND: \`${PROJECT_STATUS_COMMAND}\` (VERBATIM, ONE Bash call). \`IN <path>\` lines are THIS project's dirty paths; \`OUT <path>\` lines are OTHER work sharing the repository (a nested project: the factory's parallel sessions) — NEVER restore, clean, stage, stash or commit an OUT path, it is not yours.${outsideDirtyPaths.length ? ` The pre-check already saw these OUT paths — leave every one exactly as it is: ${outsideDirtyPaths.slice(0, 20).map((p) => `\`${p}\``).join(', ')}.` : ''} The valid active fence makes \`.pandacorp/status.yaml\` controller-owned: NEVER checkout or restore \`.pandacorp/status.yaml\`; renew/sync-rollups deterministically re-derive its active projection from the fenced lease. If the IN lines show other uncommitted/conflicted changes (unmerged paths or \`<<<<<<<\` markers — a kill or app-restart left a run mid-write), DISCARD only the uncommitted edits of those other tracked MODIFIED IN paths (every IN path except .pandacorp/status.yaml) by restoring them to HEAD — NEVER to last_green_sha — with the BL-0202 RESTORE COMMAND: \`${scopedRestoreCommand('HEAD')}\` — run it VERBATIM except ${SCOPED_PATHS_NOTE} (Why HEAD: whenever IN_REVIEW work was committed after the pin — every carry-over work order, BL-0212 — a checkout of the pin rewrites the INDEX too, staging the reversal of those later commits, and the next commit anywhere would silently erase them.) It refuses (exit 3, touching nothing) any path outside this project, the controller-owned status.yaml, or an empty list. Surgical — ${NO_WHOLE_TREE_WRITES} Stashes: leave EVERY stash as it is — never drop or pop one (DR-067: never stash-pop across a moved tree; the stash list is repository-wide, so in a nested project it holds other sessions' stashes, and a drop is unrecoverable). Remove leftover temp preview pages — any \`preview-wo*\` scratch page/route the build created (untracked IN paths) — with the BL-0202 CLEAN COMMAND: \`${scopedCleanCommand()}\` (VERBATIM except <PATHS>, same path rules). Leave legitimate untracked owner state (\`.pandacorp/\`, etc.) untouched.
    **STEP 2 —${GATE_SKIP} THEN run \`bash ${PROJECT_DIR}/.pandacorp/verify.sh\`:**
    - GREEN → return { green: true }, change nothing further.
    - RED → fix the PRODUCTION code (never weaken/skip tests) until it passes end-to-end, commit (Conventional Commits with scope) staging ONLY this project's files by explicit path (never \`git add -A\`/\`git add .\`/\`git commit -a\` — BL-0202: in a nested project they sweep other sessions' work into your commit), return { green: true }. (A route quarantined above is NOT yours to fix — it waits on the owner; do not touch it.)
    If you genuinely can't, return { green: false, failure } describing what remains.${NOTIFY('Baseline roto y no se pudo reparar — necesita tu intervencion')}`,
    { label: 'baseline', phase: 'Baseline', model: P.judge, agentType: 'pandacorp:implementer', schema: VERIFY_SCHEMA },
  ))
  if (baseline === PAUSED) return await pausedExit()
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
  if (proc === PAUSED) return await pausedExit()
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
// 9.118.2: the engine has no shell, so the FIRST planner records the greenfield baseline decision for it.
const greenfieldEvent = (facts) =>
  ` FIRST, record the engine's greenfield baseline decision — your ONLY write, fire-and-forget, ONE Bash call: printf '{"event":"baseline_greenfield","at":"%s","project":"%s","workOrders":${facts.workOrders}}\\n' "$(date -u +%FT%TZ)" "${PROJECT}" >> ~/.claude/dashboard-events.ndjson; printf '{"kind":"baseline_greenfield","workOrders":${facts.workOrders},"at":"%s"}\\n' "$(date -u +%FT%TZ)" >> ${TRACK_PATH}.\n`
async function runPlanner(label) {
  agentSpawned += COST(P.judge)   // DR-070/DR-073: weighted — the planner runs on the judge model
  return await agent(
    `${label === 'plan' && baselineGreenfield ? greenfieldEvent(baselineGreenfield) : ''}You are the Pandacorp build planner. Read state WITHOUT modifying anything:
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
// Proposal 39 C4/C3: the fast lane's plan is the blueprints' Build Plan order + the work-order frontmatter, read by a
// script (no opus plan agent), with every FRD's floor classified in the same op. A missing or drifted Build Plan, or a line
// that fails its seal, falls back to the plan agent — never a guessed order; its FRDs are then classified lazily.
// --compact: no free text in the relayed line (bench F-1: the relay decoded the AC text's \u00f3 escapes, the seal failed
// and an opus plan agent ran); each WO's AC lines are a context file its builder reads. A fused start's plan (planned or
// declined) is used as is: a declined plan is never read twice.
async function fastPlan() {
  const fp = fused && fused.plan
  if (!fp) agentSpawned++
  const r = fp ? { body: fp } : await runMechOp('plan', `--classify --compact${ONLY ? ONLY.map((f) => ` --frd ${shellQuote(f)}`).join('') : ''}`, { label: 'mech-plan', phase: 'Plan' })
  const b = r.body
  if (b && b.ok === true && b.status === 'planned' && Array.isArray(b.frds)) {
    for (const f of b.frds) { fastClassified.add(f.frd); if (f.floor !== false) fastFloor.add(f.frd) }
    log(`▶ fast lane: no plan agent — ${b.frds.length} FRD(s) in Build Plan order${fastFloor.size ? ` · floor (USABLE only when VERIFIED): ${[...fastFloor].join(', ')}` : ''} (proposal 39 C3/C4)`)
    return b
  }
  log(`↩ fast lane: the scripted Build Plan reader declined (${r.error || (b && (b.reason || b.error || b.status)) || 'no receipt'}) — running the plan agent`)
  return await runPlanner('plan')
}
phase('Plan')
let plan = await preLoopGuarded(() => (FAST ? fastPlan() : runPlanner('plan')))
if (plan === PAUSED) return await pausedExit()
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
    try { drain = await drainReadyQueuePreLoop() } catch (e) { if (isInfraError(e)) return await pausedExit(); log('☠ pre-loop drain failed: ' + e.message); await ensureStopped('pre-loop drain failed'); throw e }
    if (drain.stop) {
      await ensureStopped('owner stop signal')
      return { mode: MODE, builtFrds: [], blockedFrds: [], note: 'owner stop signal' }
    }
    if (drain.drained) {
      log('Cola de changes drenada antes del plan vacío (BL-0129) — replanificando con el trabajo recién creado.')
      plan = await preLoopGuarded(() => runPlanner('plan-post-drain'))
      if (plan === PAUSED) return await pausedExit()
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
if (fused && fused.synced && fused.synced.ok === true) log(`✓ rollups synced by fast-start${fused.synced.commit ? ` (${fused.synced.commit})` : ''}`)
else if (MECH_LEAN) {
  // Under mechScript it is STEP 1 of the fused scripted dispatch (MECH_FUSED orders the steps); else the prose prefix.
  pendingSyncRollups = SYNC_ROLLUPS + ' Stage only the rollup documents and .pandacorp/status.yaml changed by the command, then commit them together (Conventional Commits, scope).' + (MECH_SCRIPT ? '' : ' THEN, as a SEPARATE step (do not commit this part — see below):\n  ')
} else {
  agentSpawned++
  if ((await infraPausable(() => agent(SYNC_ROLLUPS + ' Stage only the rollup documents and .pandacorp/status.yaml changed by the command, then commit them together (Conventional Commits, scope).',
    { label: 'sync-rollups', phase: 'Plan', model: MECH, agentType: 'pandacorp:implementer' }))) === PAUSED) return await pausedExit()
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
// Proposal 39 C1/C2 (mechScript): a SOLO wave (one WO building, so no sibling's in-flight files) with declared artifacts
// commits through the scripted commit-wo (clean-tree, AC-citation floor, related unit tests, one commit naming the WO).
// A multi-WO wave keeps the prose writer: commit-wo refuses any undeclared dirty path, and a sibling is still building.
const commitWoFlags = (wo) => [`--wo ${shellQuote(wo.id)}`, ...(wo.artifacts || []).map((a) => `--file ${shellQuote(a)}`),
  ...(plan && plan.hasFrontend ? [`--extra ${shellQuote('docs/design/components.md')} --reason ${shellQuote('DR-057 shared component inventory')}`] : []),
  ...(P.split && plan && plan.hasFrontend ? [`--extra ${shellQuote(`docs/api/${wo.id}.md`)} --reason ${shellQuote('DR-060 per-WO API contract')}`] : [])].join(' ')
async function scriptedCommitWO(wo) {
  const r = await runMechOp('commit-wo', commitWoFlags(wo), { label: `commit:${wo.id}` })
  const b = r.body
  if (b && b.ok === true && (b.status === 'committed' || b.status === 'nothing')) return { committed: b.status === 'committed' ? 1 : 0, sha: b.sha }
  throw new Error(`commit-wo did not commit ${wo.id}: ${r.error || (b && `${b.status}: ${b.reason || b.error || ''}`) || 'no receipt'}`)
}
async function commitWOGreen(wo, frd, solo = false) {
  agentSpawned++
  const scripted = MECH_SCRIPT && solo && Array.isArray(wo.artifacts) && wo.artifacts.length > 0
  const link = commitChain.then(() => scripted ? scriptedCommitWO(wo) :
    agent(
      `You are the SOLE git writer at this instant (serialized — no other commit runs concurrently, so there is NO index.lock race), committing work order ${wo.id} now that its self-test is green and its frontmatter is IN_REVIEW.${TRACK_AND_WO_COMMIT(frd, wo.id)} Then make exactly ONE commit (Conventional Commits, with scope, the subject naming ${wo.id}) staging ONLY this work order's own files: its declared artifacts ${wo.artifacts && wo.artifacts.length ? '(' + wo.artifacts.join(' ') + ')' : "(use `git status -- .` (THIS project only, BL-0202) to identify THIS wo's files)"} AND its own work-order markdown under \`docs/frds/${frd}/work-orders/\` (the IN_REVIEW frontmatter + ## Status Note) AND \`.pandacorp/track.jsonl\` (the durable timeline lines for THIS wo — the wo_start the builder appended + the wo_end you just appended) AND \`.pandacorp/build-journal.jsonl\` if it changed (append-only, shared — like track.jsonl; sweeps any pending build-journal lines a retry builder appended). Sibling work orders of the same wave may be MID-BUILD — do NOT stage or touch their files; if \`git status -- .\` shows changes outside this WO's files (other than track.jsonl / build-journal.jsonl, which are append-only and shared), leave them untouched. Do NOT advance last_green_sha (that is the FRD gate's job — this WO is self-test-green, not yet review-verified). THEN return the sha of the commit you just made (\`git rev-parse --short HEAD\`). Return { committed: 1, sha: "<that short sha>" }.`,
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
  return link.then((r) => { if (r && r.sha && Number(r.committed) > 0) lastCommitSha = r.sha; if (infraHalt) acceptedWos.push(wo.id); return true }, (e) => { log(`commit failed for ${wo.id}: ${(e && e.message) || e}`); return false })
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
  `${wo.path ? ` Your work-order file: \`${wo.path}\` — open it and follow it in full.` : ''}${wo.acText ? ` The EARS acceptance criteria THIS work order must satisfy (verbatim from FRD ${frd} — the gate will assert exactly these):\n  ${wo.acText}\n ` : wo.acFile ? ` The EARS acceptance criteria THIS work order must satisfy are in \`${wo.acFile}\` (verbatim from FRD ${frd} — the gate will assert exactly these): read it first.` : ''}${priorAttemptsCtx(wo)}${priorDiagnosisCtx(wo)}`

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

// Proposal 39 C7: an infra halt inside a build is never a WO failure — the wave parks the WO instead of repairing it.
async function buildWO(wo, frd, solo = false) {
  try { return await buildWOUnguarded(wo, frd, solo) } catch (e) {
    if (!isInfraError(e)) throw e
    log(`⏸ ${wo.id}: infrastructure failure, not a work-order failure (${e.message}) — parked, never repaired`)
    return { green: false, committed: false, infra: true }
  }
}
async function buildWOUnguarded(wo, frd, solo) {
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
  const committed = green ? await commitWOGreen(wo, frd, solo) : false
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
// Proposal 40 §2 (Close-out engine fixes, DR-080): the gate blesses a new route's baseline at green, never the builder and
// never the close-out (bench F-1/F-2: the gate in its slot did not bless, so the opus close-out blessed by hand). The gate
// leaves the bless uncommitted in its slot; the scripted gate-land commits it on main with the provenance trailers.
// Proposal 40 §2 (Patch): the patch tier reads each finding's size; an unestimated one is never bounded (opus).
const GATE_FIX_LINES = '; give each finding `fixLines`, the changed lines its fix needs'
const GATE_BLESS = ` **Bless at green (DR-080, only you):** bless each still-unblessed surface of this FRD you judged right, as your agent definition says; never change an existing baseline. Leave the bless uncommitted and list its paths in \`testFiles\`.`
// Proposal 40 §2/§9 (Opus FRD gate, DR-015/DR-080): the fast gate writes a regression test for each finding plus a few
// adversarial PROBES per reviewed work order (1-5, at its interaction, async and boundary edges), not a blanket suite
// (bench FM-3: ~2,800 lines of reviewer tests, 0 product defects). finalizeGate re-asks a green verdict that left a
// reviewed work order unprobed (the engine counts `probes`, it never trusts "I wrote tests").
const GATE_TESTS = FAST
  ? 'write a regression test for each finding, plus adversarial PROBES the implementers did not see: at least 1 and at most 5 per reviewed work order, aimed at its interaction, async and boundary edges (anchored in EARS + real bugs; never a blanket suite)'
  : 'write adversarial tests the implementers did not see (anchored in EARS + real bugs)'
// Proposal 40 §5 A2 (Harness markers, first pass): bench FM-3's FRD-04 gate waved off a designed table scroll missing the
// responsive harness's opt-out marker (punch-list, route left unblessed); only the BL-0211 re-ask turned it red. The rule
// raises it on the FIRST pass, and classifyDismissals refuses such a dismissal on the fast lane even with a citation.
const GATE_MARKER = ` **Harness markers (first pass):** a surface that is right but trips a gate harness for want of its opt-out marker (e.g. \`data-scroll-x="intentional"\` on a designed horizontal scroll), or a route left unblessed because of it, is a CORRECTION finding with its fix, raised on this first pass: never a dismissal, never the punch-list.`
const GATE_PASS_RETURN = ` **If CORRECTION passes (visual nits, if any, APPEND to the punch-list at the MAIN tree \`${PROJECT_DIR}/.pandacorp/comms/visual-punch-list.md\` — absolute path, they do NOT block):** you are a REVIEW-ONLY gate — do NOT set any work order VERIFIED, do NOT reset reopen_count, do NOT recompute the FRD rollup, do NOT edit .pandacorp/status.yaml, do NOT advance last_green_sha, and do NOT \`git commit\` (you may be running in a FROZEN worktree; a separate serialized apply step on the MAIN tree performs every one of those writes). Just make sure the adversarial test files you wrote this cycle are SAVED in your working tree, and return { green: true, testFiles: [the repo-relative path of EACH new or changed test file you wrote this gate] } so the apply step can port them to the main tree.${FAST ? `${GATE_BLESS} Also return \`probes: [{ wo, test }]\`, one entry per probe (the reviewed work order, its test path): every reviewed work order needs one.${GATE_MARKER}` : ''}`

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

// BL-0214: where the collector keeps the sealed copy of its report inside THIS gate's slot (`.pandacorp/run/` survives a slot
// reuse, so the name carries the FRD: another FRD's collector in the same serial worktree can never overwrite it). The shell
// expression is evaluated by the MECH's own shell, exactly like the collector's `slotRun`.
const gateSealedReportPath = (frd) => `${gateWorktreePathOf(frd)}/$(git -C ${shellQuote(PROJECT_DIR)} rev-parse --show-prefix).pandacorp/run/gate-report.${frd}.sealed.json`
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
  1) Read \`last_green_sha\` from .pandacorp/status.yaml (call it PIN_BASE) and run the gate script exactly once (that argument ORDER is required — \`--since\` is positional). **Run it as ONE Bash call,${MECH_FG}: it takes minutes. The command, verbatim except PIN_BASE:** \`${gateProjectCd(wt)} && { mkdir -p "${slotRun}"; REPORT="${slotRun}/gate-report.json"; LOG="${slotRun}/evidence-verify.log"; rm -f "$REPORT"; perl -e 'alarm shift; exec @ARGV' 540 bash .pandacorp/verify.sh --since <PIN_BASE> --report-all > "$LOG" 2>&1; echo "verify exit=$?"; ${SEAL_REPORT_CLI_COMMAND} seal --file "$REPORT" --frd ${frd} --pin ${pinSha} --out "${gateSealedReportPath(frd)}"; }\` — REPORT is THIS gate worktree's own report, an absolute path inside it (for a nested project such as Mission Control it resolves to \`<this worktree>/mission-control/.pandacorp/run/gate-report.json\`); NEVER read the main project tree's copy of that file, it belongs to a different run. The perl alarm is the hard bound (540 s): exit 142 means it timed out, and the report is then missing. A non-zero exit is FINE and expected otherwise — it is data, not a problem for you to fix. The LAST line that command printed is the report, SEALED by a script (\`{"ok":true,"version":2,"kind":"gate-report",…,"sum":"<14 hex>"}\`, ASCII, one line): return that line **byte-for-byte** in \`report\` — never pretty-print it, never re-indent it, never shorten it, never drop or reorder a key or a \`failures[]\` row however many there are. The engine recomputes the checksum over exactly what you return, and a copy that differs by ONE character is discarded (BL-0214). If that last line is \`{"ok":false,…}\` (the file was missing or unreadable), return it as \`report\` anyway — the engine detects it and falls back.
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
  const verdict = validateEvidence(await verifyEvidenceSeal(frd, raw, pinSha))
  if (!verdict.evidence) log(`⚠ GateEvidenceFallback ${frd}: ${verdict.fallbackReason} — this gate runs in EXPLORE mode (the gate is never skipped and never runs blind)`)
  return verdict
}

// BL-0214: the collector hands gate-report.json to the engine through a model, and a model is not a lossless copy channel
// (BL-0206): a copy that lost a failures[] row or flipped a sub-gate's exit is still valid JSON with a boolean `green`, which
// the judge would read as authoritative. seal-report.mjs seals the line (drift-seal.mjs) and keeps the sealed copy on disk;
// the engine recomputes the seal over the text it received. A line that never ARRIVED intact (unparseable, unsealed, or a
// mismatched seal) is re-read from the stored copy, at most EVIDENCE_REREADS times; if it still does not verify, the pack is
// discarded and the gate runs in explore mode (the existing GateEvidenceFallback log + event) — a copy is never trusted.
const EVIDENCE_REREADS = 2
function readSealedReport(text, frd, pinSha) {
  const line = String(text || '').trim().split('\n').pop()
  let j = null
  try { j = JSON.parse(line) } catch { return { error: 'the collector report is not valid JSON', transport: true } }
  if (j && typeof j === 'object' && j.ok === false && typeof j.error === 'string') return { error: `the collector could not seal gate-report.json: ${j.error.replace(/[^\w .,:;/()-]/g, ' ').slice(0, 120)}` }   // the reason is interpolated into a printf event line: no quotes
  if (!j || typeof j !== 'object' || j.kind !== 'gate-report' || !driftSealHolds(line)) return { error: 'the collector report failed its integrity seal (the relay altered it, or it was never sealed)', transport: true }
  if (j.frd !== frd || String(j.pin) !== String(pinSha)) return { error: `the sealed report belongs to ${String(j.frd).slice(0, 40)} at ${String(j.pin).slice(0, 12)}, not to ${frd} at ${String(pinSha).slice(0, 12)}` }
  if (!j.report || typeof j.report !== 'object') return { error: 'the sealed report carries no report object' }
  return { report: JSON.stringify(j.report) }
}
async function verifyEvidenceSeal(frd, raw, pinSha) {
  if (!raw || typeof raw !== 'object' || typeof raw.report !== 'string' || !raw.report.trim()) return raw   // null / missing: validateEvidence reports its own (BL-0149) reason
  let read = readSealedReport(raw.report, frd, pinSha)
  for (let i = 1; !read.report && read.transport && i <= EVIDENCE_REREADS; i++) {
    log(`⚠ EvidenceRelay ${frd}: ${read.error} — re-reading the stored sealed report, attempt ${i}/${EVIDENCE_REREADS} (BL-0214: a model's copy of machine JSON is never trusted)`)
    agentSpawned++
    let again = null
    try {
      again = await agent(`${MCR}BL-0214 evidence re-read for ${frd}. ${RUN_ONCE} ${VERBATIM_AS}output\`: \`${SEAL_REPORT_CLI_COMMAND} reread --file "${gateSealedReportPath(frd)}"\`. It only prints a line the collector stored earlier, so it is instant. Do not inspect, edit, fix, summarize, re-format or re-indent its output: it is ONE sealed JSON line and the engine verifies its checksum character by character.`,
        { label: `evidence-reread:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: DRIFT_OUTPUT_SCHEMA })
    } catch (e) { log(`⚠ ${frd}: the evidence re-read runner threw (${(e && e.message) || e})`) }
    again = unwrapAnswer(again, 'output')
    read = readSealedReport(again && typeof again.output === 'string' ? again.output : '', frd, pinSha)
  }
  if (!read.report) return { report: null, reason: `${read.error}${read.transport ? ` after ${EVIDENCE_REREADS} re-read(s)` : ''}` }
  return { ...raw, report: read.report }
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
// BL-0208 (canary F2): the tool budget is PROMPT-ENFORCED against the finder's own count of its calls, and that count
// is not a measurement — F2 billed 52/47/15/27 calls where the finder self-reported 34/27/8/17 (it undercounts by
// 35-47 %), and one finder narrated "the 60-call budget was spent" at 15 billed calls. So 60 is a soft ceiling in
// the finder's OWN units (the billed count runs ~1.5-1.9x that), and NOTHING in this engine decides on the
// self-reported `toolCalls` / `budgetExhausted`: `agent()` exposes no per-agent call ledger, so the authoritative
// figure is the transcript's own count, which usage-rollup.mjs reports per agent (`tool_calls`) and reconciles
// against the self-report (`tool_calls_self_reported`) at the run's shutdown.
const DRIFT_FINDER_TOOL_BUDGET = 60   // tool calls (finder's own count); the digested judge's cap is 8 reads — the finder exists to read
const FINDER_PROBE_RE = /\.finder\.drift-probe\.tsx?$/   // the finder's own probes, never the reviewer's (DR-122 path + infix)
const DRIFT_FINDER_STATUSES = ['implemented', 'drift', 'unknown']
const DRIFT_FINDER_SCHEMA = {
  type: 'object', required: ['contracts', 'pinDir', 'headSha'],
  properties: {
    pinDir: { type: 'string', description: 'BL-0205: the absolute project directory inside the pinned worktree, as `pwd -P` printed it on your FIRST call' },
    headSha: { type: 'string', description: 'BL-0205: `git rev-parse HEAD` as printed on your FIRST call, run inside pinDir — it must be the pinned commit' },
    headShaEnd: { type: 'string', description: 'BL-0205: the same HEAD check on your LAST call, run inside pinDir' },
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
    toolCalls: { type: 'number', description: 'your own count of your tool calls — telemetry only, never used to decide anything (it undercounts the billed calls)' },
    budgetExhausted: { type: 'boolean', description: 'true iff you stopped because the tool budget ran out — telemetry only, never used to decide anything' },
  },
}
// The FRD's work orders as the finder's roster: every one, the VERIFIED foundation included (that is where drift lives).
const frdRoster = (frd) => {
  const st = frdState.get(frd)
  const wos = st ? st.f.workOrders : []
  return wos.map((w) => `${w.id} · ${w.status || 'unknown'} · ${w.path || `docs/frds/${frd}/work-orders/${w.id}.md`}`).join('\n  ')
}
// Start the finder for THIS gate (idempotent per FRD; a no-op unless DRIFT_FINDER). The promise never rejects.
function startDriftFinder(frd, reviewIds, pinSha, workFrom, wt = GATE_WORKTREE) {
  if (!DRIFT_FINDER) return null
  const st = frdState.get(frd)
  if (!st) return null
  if (st.driftFinderPromise) return st.driftFinderPromise
  const acText = reviewedAcText(frd, reviewIds)
  st.driftFinderPin = { sha: String(pinSha || ''), wt }   // BL-0205: what awaitDriftFinding checks the finder's reported HEAD / dir against
  agentSpawned += COST('sonnet')   // BL-0203: one STANDARD-tier unit, reserved in gateCostEstimate
  st.driftFinderPromise = agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'find-drift' })}FRD gate — the WHOLE-FRD DRIFT FINDER for ${frd} (BL-0203, canary F2). You run BESIDE this FRD's gate, in its pinned worktree, while another agent runs the gate script here; the opus reviewer that judges this FRD reads your report. You are NOT the judge (DR-015): everything you return is a proposal the judge weighs and the engine proves (DR-122).
  ${DRIFT_FINDER_DIRECTIVE}
  **THIS FRD:** \`docs/frds/${frd}/frd.md\` and \`docs/frds/${frd}/blueprint.md\` at this pin — inventory EVERY contract in them. Its work orders (id · status · path) — read each one's frontmatter \`source_requirements\` (ownership) and its \`## Status Note\` (the tests it declares as evidence):
  ${frdRoster(frd) || '(the plan carried no work-order list — find them under docs/frds/' + frd + '/work-orders/)'}
  **THE WORK ORDERS UNDER REVIEW THIS CYCLE:** ${reviewIds.join(', ')} — a contract one of them owns is a \`cycle\` contract; every other contract is \`preexisting\`, and those are where the judge cannot look: do them FIRST.${acText ? `\n  The planner's verbatim criteria of those work orders (a head start, not the inventory): \n  ${acText}` : ''}
  **DECLARED EVIDENCE, if cached:** \`${PROJECT_DIR}/.pandacorp/run/gate-evidence/${frd}/inventory.json\` (MAIN tree, read-only, may be absent or stale — frd.md at this pin is the authority) lists the evidence tests of the last green gate per contract.
  **THE PIN (BL-0205 — read this twice).** Pinned worktree: \`${wt}\`. Pinned commit: \`${pinSha}\`. Your Bash tool starts EVERY call in the launching session's directory (the MAIN checkout, NOT this commit): a \`cd\` does not carry to your next call. Your FIRST call, exactly: \`PIN_DIR="${wt}/$(git -C ${shellQuote(PROJECT_DIR)} rev-parse --show-prefix)"; cd "$PIN_DIR" && pwd -P && git rev-parse HEAD\`. It prints the absolute project directory inside the pin (from here on \`<pinDir>\`) and its HEAD, which MUST start with \`${pinSha}\` — if it does not, STOP and return \`contracts: []\` with what you saw. Then begin EVERY Bash command with the literal printed directory (\`cd "<pinDir>" && …\`, or \`git -C "<pinDir>" …\`), each probe-writing heredoc included, and give Read/Grep/Glob absolute paths under \`<pinDir>\`. Your LAST call: \`cd "<pinDir>" && git rev-parse HEAD\`. Return \`pinDir\`, \`headSha\` (first call), \`headShaEnd\` (last call); the engine DISCARDS your whole report when a reported HEAD is not the pin.
  **PROBES:** write each drift probe at \`.pandacorp/run/drift-probes/${frd}/<contract-id-slug>.finder.drift-probe.ts\`, relative to this project directory inside the worktree (i.e. \`<pinDir>/.pandacorp/run/drift-probes/…\`).
  **TOOL BUDGET: at most ${DRIFT_FINDER_TOOL_BUDGET} tool calls** — count them (the two HEAD checks included); report your count in \`toolCalls\` (telemetry only: the engine decides nothing from it).
  Return { pinDir, headSha, headShaEnd, contracts: [{ contract, contractClass, owner, status: implemented|drift|unknown, evidence: { file, line, snippet }, claim: preexisting|cycle, probe_test (drift only), direction (drift only: code|spec|unknown), why }], toolCalls, budgetExhausted }.`,
    { label: `find:drift:${frd}`, phase: 'Review', model: 'sonnet', effort: 'medium', agentType: 'pandacorp:drift-finder', fallbackAgentType: 'pandacorp:reviewer', schema: DRIFT_FINDER_SCHEMA, workFrom })
    .then((r) => r, (e) => ({ __threw: (e && e.message) || String(e) }))
  return st.driftFinderPromise
}
// BL-0205: canary F2's finders told to `cd` into their pinned slot read the factory's MAIN checkout on later Bash
// calls (a subagent's cwd resets every call): 2 false `implemented` on defects that main had already fixed. The
// prompt now demands absolute paths and a HEAD check on the first and last call; the engine checks what the finder
// REPORTED and throws the whole report away on a mismatch — a claim proven against the wrong commit is never merged
// (a finder row is only a proposal anyway: the gate runs without it, DR-015). `headSha` and `pinDir` are required
// (they come from the mandatory first call); `headShaEnd` is checked whenever the finder gave it. Honest limit:
// this verifies what the finder SAYS it looked at, not each read in between — the per-command discipline in the
// prompt is the defense for those.
// → '' when the report names the pin, else the reason it cannot be trusted.
function finderWrongTree(raw, pin) {
  const want = String(pin.sha || '').trim().toLowerCase()
  if (!want) return ''
  const same = (x) => { const v = String(x || '').trim().toLowerCase(); return v.length >= 7 && (want.startsWith(v) || v.startsWith(want)) }
  if (typeof raw.headSha !== 'string' || !raw.headSha.trim()) return `the finder reported no HEAD sha, so the tree it audited cannot be shown to be the gate pin ${want.slice(0, 8)} (BL-0205)`
  if (!same(raw.headSha)) return `WRONG TREE: the finder's first HEAD check reported ${raw.headSha.trim().slice(0, 12)}, not the gate pin ${want.slice(0, 8)} — it audited another checkout (BL-0205)`
  if (raw.headShaEnd !== undefined && raw.headShaEnd !== null && !same(raw.headShaEnd)) return `WRONG TREE: the finder's last HEAD check reported ${String(raw.headShaEnd).trim().slice(0, 12)}, not the gate pin ${want.slice(0, 8)} — it drifted to another checkout mid-run (BL-0205)`
  const dir = typeof raw.pinDir === 'string' ? raw.pinDir.trim().replace(/\/+$/, '') : ''
  const slot = String(pin.wt || '').replace(/\/+$/, '').split('/').pop()
  if (!dir.startsWith('/') || (slot && !dir.includes(`/${slot}`)) || dir === String(PROJECT_DIR).replace(/\/+$/, '')) return `WRONG TREE: the finder reported working in '${dir || '(none)'}', not inside the pinned worktree ${pin.wt || '(unknown)'} (BL-0205)`
  return ''
}
// DR-078 fail-loud read boundary over the finder's answer: a usable report, or an explicit reason — never a
// silent empty list. Malformed ROWS are counted and named, never dropped silently; a drift row without a valid
// finder probe for THIS FRD stays in the report as an unproven pointer (the judge sees it; nothing is merged).
function validateDriftFinding(raw, frd, pin = null) {
  if (!raw || typeof raw !== 'object') return { finding: null, reason: 'the finder returned no verdict' }
  if (raw.__threw) return { finding: null, reason: `the finder threw (${raw.__threw})` }
  const wrongTree = pin ? finderWrongTree(raw, pin) : ''
  if (wrongTree) return { finding: null, reason: wrongTree }
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
  // BL-0208: what the finder says about ITS OWN execution is an unverified claim — kept under `selfReported` for the
  // log only; no decision and no judge prompt reads it (see the DRIFT_FINDER_TOOL_BUDGET note).
  return { finding: { rows, malformed, pinDir: typeof raw.pinDir === 'string' ? raw.pinDir.trim() : '', selfReported: { toolCalls: Number(raw.toolCalls) || null, budgetExhausted: raw.budgetExhausted === true } }, reason: '' }
}
// BL-0214: BL-0205 checks the HEAD the finder SAYS it saw; nothing checked the rows. A finder that reported the pin and
// then read the main checkout still yielded a false `implemented` (canary F2: 2 false negatives), and an `implemented`
// row tells the digested judge not to look. finder-snippets.mjs (a MECH step; its sealed line is verified like every
// other relayed machine line) contrasts each `implemented` row's cited snippet with the COMMITTED tree at the gate pin.
// A row whose snippet is not at the pin is downgraded to `unknown` (the judge must look, off its read budget); two such
// rows mean the finder read another tree, and the whole report is discarded like a wrong-tree report. If the check
// cannot be run or read back, no `implemented` row is trusted (all become `unknown`) and the log says so.
const FINDER_SNIPPET_MISS_LIMIT = 2   // missing/no-file citations that discard the whole report
const FINDER_SNIPPET_RETRIES = 2      // the check is read-only and idempotent: a relay that damaged either direction simply runs it again
const finderCitedFile = (file, pinDir) => {
  const f = String(file || '').trim()
  for (const base of [pinDir, PROJECT_DIR]) {
    const b = String(base || '').replace(/\/+$/, '')
    if (b && f.startsWith(`${b}/`)) return f.slice(b.length + 1)
  }
  return f
}
// → { results: Map<rowIndex,status> } | { error } — the line must verify, name this pin and answer every row asked.
function parseSnippetCheck(answer, pinSha, rows) {
  const raw = unwrapAnswer(answer, 'output')
  const line = raw && typeof raw.output === 'string' ? raw.output.trim().split('\n').pop() : ''
  if (!line) return { error: 'the snippet checker returned no output' }
  let j = null
  try { j = JSON.parse(line) } catch { return { error: 'the snippet checker output is not valid JSON' } }
  if (j && j.ok === false && typeof j.error === 'string') return { error: `the snippet checker refused: ${j.error.slice(0, 160)}` }
  if (!j || j.ok !== true || !driftSealHolds(line)) return { error: 'the snippet checker output failed its integrity seal (the relay altered it)' }
  if (j.pin !== pinSha || !Array.isArray(j.results)) return { error: 'the snippet checker output does not name this pin or carries no results' }
  const results = new Map(j.results.filter((x) => x && Number.isInteger(x.i) && typeof x.status === 'string').map((x) => [x.i, x.status]))
  if (rows.some((r) => !results.has(r.i))) return { error: 'the snippet checker did not answer every row' }
  return { results }
}
async function verifyFinderSnippets(frd, finding, pin) {
  const targets = finding.rows.map((r, at) => ({ r, at })).filter(({ r }) => r.status === 'implemented')
  if (!targets.length || !pin || !pin.sha) return { finding }
  const asked = targets.map(({ r, at }) => ({ i: at, file: finderCitedFile(r.evidence && r.evidence.file, finding.pinDir), line: Number(r.evidence && r.evidence.line) || null, snippet: String((r.evidence && r.evidence.snippet) || '') }))
  const json = JSON.stringify(asked)
  const cmd = `${FINDER_SNIPPETS_CLI_COMMAND} check --project ${shellQuote(PROJECT_DIR)} --pin ${shellQuote(pin.sha)} --digest ${inventoryDigest(json)} --rows ${shellQuote(json)}`
  let results = null
  let why = ''
  for (let attempt = 0; attempt <= FINDER_SNIPPET_RETRIES && !results; attempt++) {
    if (attempt) log(`⚠ DriftFinderSnippetRelay ${frd}: ${why} — running the check again, attempt ${attempt}/${FINDER_SNIPPET_RETRIES} (BL-0214: a model's copy of machine output is never trusted)`)
    agentSpawned++
    let raw = null
    try {
      raw = await agent(`${MCR}BL-0214 drift-finder snippet check for ${frd}. ${RUN_ONCE} ${VERBATIM_AS}output\`: \`${cmd}\`. The JSON after --rows is ONE argument: copy it character for character, never re-format it (the script refuses a copy whose checksum differs). It only READS committed git objects and prints ONE sealed JSON line: do not inspect, edit, fix, summarize, re-format or re-indent anything.`,
        { label: `finder-snippets:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: DRIFT_OUTPUT_SCHEMA })
    } catch (e) { why = `the snippet-check runner threw (${(e && e.message) || e})`; continue }
    const parsed = parseSnippetCheck(raw, pin.sha, asked)
    if (parsed.results) results = parsed.results
    else why = parsed.error
  }
  if (!results) log(`⚠⚠ DriftFinderSnippetsUnavailable ${frd}: ${why} after ${FINDER_SNIPPET_RETRIES} re-run(s) — none is trusted: its ${targets.length} "implemented" rows go to the judge as UNKNOWN (BL-0214)`)
  let misses = 0
  const cited = []
  const rows = finding.rows.map((r, at) => {
    if (r.status !== 'implemented') return r
    const status = results ? results.get(at) : 'unchecked'
    if (status === 'ok' || status === 'moved') return { ...r, snippetCheck: status }
    if (status === 'missing' || status === 'no-file') misses++
    cited.push(`${contractIdOf(r.contract) || String(r.contract).slice(0, 24)} ${status}`)
    return { ...r, status: 'unknown', snippetCheck: status }
  })
  if (misses >= FINDER_SNIPPET_MISS_LIMIT) return { finding: null, reason: `WRONG TREE (snippets): ${misses} of the finder's ${targets.length} implemented citations are not in the tree at the gate pin ${String(pin.sha).slice(0, 8)} — it read something other than the pinned commit (BL-0214)` }
  if (results && cited.length) log(`⚠ DriftFinderSnippets ${frd}: ${cited.length} of ${targets.length} "implemented" row(s) cite a snippet that cannot be verified at the pin (${cited.join(', ')}) — UNKNOWN (BL-0214)`)
  return { finding: { ...finding, rows } }
}
/**
 * BL-0208: does the finder's self-report contradict itself? A `budgetExhausted: true` claim paired with a self-count
 * well under DRIFT_FINDER_TOOL_BUDGET (or no count at all) cannot both be true — canary F2's FRD-04 finder narrated an
 * exhausted 60-call budget at 15 billed calls. Returns the discrepancy text, or '' when the two agree.
 */
function driftSelfReportDiscrepancy(selfReported) {
  if (!selfReported || !selfReported.budgetExhausted) return ''
  const { toolCalls } = selfReported
  if (toolCalls === null) return `it claims its ${DRIFT_FINDER_TOOL_BUDGET}-call tool budget ran out but reports no call count`
  if (toolCalls < DRIFT_FINDER_TOOL_BUDGET * 0.8) return `it claims its ${DRIFT_FINDER_TOOL_BUDGET}-call tool budget ran out but self-reports only ${toolCalls} calls`
  return ''
}
// Await + validate the finder of THIS gate (memoized on st.driftFinding for the prompt block and finalizeGate).
async function awaitDriftFinding(frd) {
  const st = frdState.get(frd)
  if (!st || !st.driftFinderPromise) return null
  if (st.driftFinding !== undefined && st.driftFinding !== null) return st.driftFinding
  const validated = validateDriftFinding(await st.driftFinderPromise, frd, st.driftFinderPin)
  const { finding, reason } = validated.finding ? await verifyFinderSnippets(frd, validated.finding, st.driftFinderPin) : validated
  if (!finding) { log(`⚠ DriftFinderFallback ${frd}: ${reason} — this gate runs without a drift-finder report (the gate itself is never skipped)`); st.driftFinding = false; return null }
  const n = (s) => finding.rows.filter((r) => r.status === s).length
  log(`⌕ ${frd}: drift finder → ${finding.rows.length} contract(s): ${n('implemented')} implemented, ${n('drift')} drift (${finding.rows.filter((r) => r.provable).length} with a probe), ${n('unknown')} unknown${finding.malformed.length ? `; ${finding.malformed.length} MALFORMED row(s) ignored (#${finding.malformed.join(', #')})` : ''}; self-reported (UNVERIFIED, telemetry only): ${finding.selfReported.toolCalls === null ? 'no tool-call count' : `${finding.selfReported.toolCalls} tool calls`}${finding.selfReported.budgetExhausted ? ', budget exhausted' : ''}`)
  const discrepancy = driftSelfReportDiscrepancy(finding.selfReported)
  if (discrepancy) log(`⚠ DriftFinderSelfReportDiscrepancy ${frd}: ${discrepancy} — its self-report is not trusted (BL-0208); the billed count is in the run's usage-rollup (tool_calls)`)
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
const finderRowLine = (r) => `• ${r.contract}${r.evidence && r.evidence.file ? ` — ${r.evidence.file}${r.evidence.line ? `:${r.evidence.line}` : ''}` : ''}${r.evidence && r.evidence.snippet ? ` \`${String(r.evidence.snippet).slice(0, 160)}\`` : ''}${r.owner ? ` · owner ${r.owner}` : ''}${r.why ? ` · ${String(r.why).slice(0, 240)}` : ''}${r.snippetCheck && r.snippetCheck !== 'ok' && r.snippetCheck !== 'moved' ? ` · [ENGINE] the finder called it implemented, but its cited snippet could not be verified at the pin (${r.snippetCheck}) — UNREVIEWED, open the code yourself` : ''}${r.status === 'drift' ? (r.provable ? ` · probe ${r.probe_test}${r.direction ? ` · direction ${r.direction}` : ''}` : ' · NO valid probe (unproven pointer)') : ''}`
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
  **WHOLE-FRD DRIFT FINDER REPORT (BL-0203).** A separate sonnet agent walked EVERY contract of \`docs/frds/${frd}/frd.md\` (and the blueprint's CMP/IF) against the code at this pin, OUTSIDE the diff you were handed. Every UNKNOWN row below is UNREVIEWED, whatever reason the finder gives (it may have stopped early or run out of tool budget, and its own account of how many calls it made is not reliable). It is not a verdict and it proved nothing by itself: you are the judge (DR-015).
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
    raw = await agent(`${MCR}BL-0189 inventory-cache check for ${frd}. ${RUN_ONCE} ${VERBATIM_AS}output\`: \`${cmd}\`. It only READS (git objects and one gitignored file) and prints ONE JSON line. Do not inspect, edit, fix, summarize or reformat anything.`,
      { label: `gate-inventory:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: DRIFT_OUTPUT_SCHEMA })
  } catch (e) { log(`⚠ ${frd}: the inventory-cache check threw (${(e && e.message) || e}) — full whole-FRD inventory this gate`); return { hit: false, reason: 'check threw' } }
  raw = unwrapAnswer(raw, 'output')
  const line = (raw && typeof raw.output === 'string') ? raw.output.trim().split('\n').pop() : ''
  let j = null
  try { j = JSON.parse(line) } catch { j = null }
  // Red-team of BL-0206: the same model relay carries the whole cached inventory; a copy that lost a contract row is
  // still valid JSON and would be a HIT that skips that contract. A sealed line must verify; a pre-seal script
  // (version skew) is read as before, loudly. An altered line is never a HIT — this gate re-derives the inventory.
  if (j && j.ok === true && (j.sum !== undefined || Number(j.version) >= 2) && !driftSealHolds(line)) {
    log(`⚠ ${frd}: the inventory-cache check line failed its integrity seal (the relay altered it) — full whole-FRD inventory this gate`)
    return { hit: false, reason: 'check altered' }
  }
  if (j && j.ok === true && j.sum === undefined && !(Number(j.version) >= 2)) log(`⚠ ${frd}: the inventory-cache check predates the sealed output — its relay integrity could not be verified (update the installed plugin)`)
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
    log(`⊘ ${frd}: MALFORMED cached contract inventory (${j.inventoryPath || 'inventory.json'}: ${defect}) — IGNORED (DR-078); the gate re-derives it`)
    return { hit: false, reason: 'malformed', malformed: true }
  }
  const changed = [inv.sources.frd !== j.sources.frd ? 'frd.md' : '', (inv.sources.blueprint || null) !== (j.sources.blueprint || null) ? 'blueprint.md' : ''].filter(Boolean)
  if (changed.length) { log(`↻ ${frd}: cached contract inventory is STALE — ${changed.join(' + ')} changed normatively since ${inv.gatedAt} — full whole-FRD inventory this gate`); return { hit: false, reason: 'stale' } }
  log(`⚡ ${frd}: cached contract inventory HIT (gated at ${inv.gatedAt}, ${inv.contracts.length} contracts, frd.md/blueprint.md unchanged)`)
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
  log(`⚠ ${frd}: the green verdict DROPPED ${dropped.length} cached contract(s) from its traceability (${dropped.join(', ')}) — refused (BL-0189); re-asking with the full inventory`)
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
// B2/BL-0157: shared by the in-run retry's two re-ask paths (identical text).
const logTraceabilityStillIncomplete = (f, stillMissing) => log(`⊘ ${f.frd}: gate traceability contract STILL incomplete after the re-ask (missing: ${stillMissing.join(', ') || 'see failure'}) — BLOCK needs-owner, never 'error' (B2, BL-0157)`)
// The serial and split gates' shared prompt fragments (byte-identical in both prompts).
const GATE_REVIEW_ONLY_STOP = (frd) => ` you are REVIEW-ONLY — do NOT stamp BLOCKED, do NOT write decisions.md, do NOT commit; just${TRACK('review_end', `,"frd":"${frd}","verdict":"blocked"`)}${GATE_VERDICT(frd, 'blocked', `,"blocked_reason":"needs-owner"`)} return { green: false, reopen: [], blocked_reason: 'needs-owner', failure: 'reopened ${MAX_REOPENS}x, gate not satisfiable autonomously' } — the engine persists the BLOCKED state + the decision record on the MAIN tree. **Otherwise — DR-073 PATCH-FIRST: do NOT revert, do NOT change the WO's \`implementation_status\` (leave it IN_REVIEW), do NOT touch \`reopen_count\`, do NOT \`git checkout\`/\`git rm\` anything, do NOT commit a revert.** The build is ~correct except a bounded fault — the engine will attempt an in-place PATCH `
const GATE_REVIEW_SCOPE = (reviewIds) => `. Review the work orders built/changed THIS cycle: ${reviewIds.join(', ')} (all IN_REVIEW). This FRD MAY already have OTHER work orders VERIFIED from a previous run — treat those as a stable foundation: exercise them in integration, but do NOT re-review them and NEVER change their state.`
const GATE_REOPEN_COUNT = ` real bug / missing requirement / gross-structural miss):** check that WO's frontmatter \`reopen_count\` (default 0). **DR-072 NON-PROGRESS STOP — if it is already ≥ ${MAX_REOPENS}, do NOT reopen again`
const GATE_REOPEN_RETURN = (frd) => ` WITH it — give its path / describe-it / a snippet) and the file(s) the fix should touch.${TRACK('review_end', `,"frd":"${frd}","verdict":"reopen"`)}${GATE_VERDICT(frd, 'reopen', `,"reopened":%s`, ` "<the count of work orders you are reopening — an integer>"`)} Return { green: false, reopen: [those ids], findings: [{ wo, finding, failingTest, files }], failure }${FAST ? GATE_FIX_LINES : ''}.`
async function frdGateSerial(frd, reviewIds, attemptNo = 1, workFrom, evidencePack, directive = '') {
  const ev = evidenceOf(evidencePack)   // WP-06: null ⇒ this gate runs in EXPLORE mode (the historical contract)
  if (DRIFT_FINDER) await awaitDriftFinding(frd)   // BL-0203: the finder started beside the evidence collector; its report joins the prompt. Guarded, not just null-returning: with the flag off the gate's promise timing stays byte-identical (no extra await tick)
  agentSpawned += COST(P.judge)   // DR-073: the gate runs on the judge model — weight it honestly
  return await agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'gate' })}${TRACK('review_start', `,"frd":"${frd}"`)}${GATE_EVENT(frd, reviewIds.length, attemptNo)}${evidenceFallbackOf(frd, evidencePack)} FRD review + integration gate for ${frd}${GATE_REVIEW_SCOPE(reviewIds)}
 ${GATE_JOURNAL_STEP(frd, reviewIds, attemptNo)}
${directive ? `\n  ${directive}\n` : ''}
  **THE GATE IS SPLIT (DR-072) — this is what makes the build converge instead of churning. Two categories with DIFFERENT consequences:**
  • **CORRECTION (BLOCKING — your hard gate):** correctness, **requirements/acceptance criteria met** (the EARS AC of FRD ${frd} — the required behavior/sections/elements EXIST and work), security, no genuine DUPLICATE of an existing shared primitive (DR-057), and **GROSS visual-structural mismatch** (the surface is not RECOGNIZABLY the designed thing — e.g. a flat text list where the mock shows a multi-panel/pixel-art layout; a section missing entirely). These BLOCK.
  • **VISUAL-FIDELITY NITS (ADVISORY — do NOT block, do NOT reopen):** sizing (15px vs 16px), spacing, exact color/shade, minor density/polish, "doesn't match the mock 100%". A pixel-judge is noisy; rejecting on nits is the #1 cause of the build never finishing. **NEVER reopen a WO for a nit.** Instead APPEND each nit to the punch-list \`.pandacorp/comms/visual-punch-list.md\` (one line: \`- [ ] ${frd} · <route> · <the gap, e.g. "heading is 15px, design tokens say 16px"> · <file:approx-line if known>\`). The dedicated end-of-build Visual QA pass + the owner sweep these directly — they do not gate VERIFIED. Scope yourself to CORRECTION + GROSS only; **flag, don't fix, don't reject** the rest (an over-broad reviewer reporting every gap HARMS convergence — research-backed).

  ${WHOLE_FRD_ORACLE}
  ${DRIFT_CLAIM_DIRECTIVE}
  ${DISMISSAL_CITATION_DIRECTIVE}${inventoryBlock(frd, reviewIds)}${gateContextScope(frd, reviewIds)}
${evidenceBlock(frd, ev)}${driftFinderBlock(frd, reviewIds)}
  1) Review the changed work orders for CORRECTION (the blocking lenses above) and ${GATE_TESTS}, exercising them TOGETHER with the rest of the feature (real integration, not isolated).
${gateFocusedStep(frd, ev)}

${GATE_PASS_RETURN}

  **If a SPECIFIC reviewed work order fails CORRECTION (a${GATE_REOPEN_COUNT}** (the same fault is not resolving autonomously):${GATE_REVIEW_ONLY_STOP(frd)}on the existing build BEFORE any revert. **FIX-FORWARD MANDATE (DR-073, calibrated 2026-07-01): a BOUNDED fault you can name at file:line with an estimated fix of ≤ ~30 lines (a hardcoded string, a missing null-guard, a clipped breakpoint, a missing escape) MUST take this findings exit — never a bare failure, never blocked_reason 'error' (80% of real first-gate fails had ≤6-min fixes; routing them to revert cost ~1.5h of a run's 2.2h rework).** Your job here is to REPORT the fixable fault(s) precisely: for EACH failing reviewed WO, write the specific finding (with file:line) and a RED-PROVEN failing test (a test you wrote that fails WITHOUT the fix and will pass${GATE_REOPEN_RETURN(frd)} The engine patches those findings in place; only if the patch can't green it whole-project does it then revert + reopen for a clean rebuild (DR-070, the fallback).
  **DR-065 — missing foundation primitive:** if a surface looks FLAT / structurally wrong because a SHARED design-system primitive it needs is NOT built (it isn't in src/components nor docs/design/components.md — e.g. the mock shows a Room/AgentSprite/StoneBridge the foundation never built), do NOT block and do NOT just reopen — return { green: false, missingFoundation: [the primitive names], failure }. The engine auto-repairs the foundation and rebuilds the surfaces against it.
  ${GATE_BROKEN_CLAUSE(frd)}`,
    { label: `gate:${frd}`, phase: 'Review', model: P.judge, effort: FAST ? fastGateEffort(frd) : 'xhigh', agentType: 'pandacorp:reviewer', schema: FRD_GATE_SCHEMA, workFrom })
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
  return await agent(`${EMIT('reviewer', frd, { frd, phase: 'review', activity: 'gate' })}${TRACK('review_start', `,"frd":"${frd}"`)}${GATE_EVENT(frd, reviewIds.length, attemptNo)}${evidenceFallbackOf(frd, evidencePack)} FRD review + integration gate for ${frd} — the CLOSE stage of the split gate (proposal 31 T1.2). A parallel finder sweep (4 diverse lenses) + per-finding adversarial verification ALREADY RAN — so you do NOT re-hunt findings from scratch; you act on the survivors below${GATE_REVIEW_SCOPE(reviewIds)}
 ${GATE_JOURNAL_STEP(frd, reviewIds, attemptNo)}

  **SURVIVING BLOCKING CORRECTIONS (the finder sweep confirmed these — you must independently CONFIRM each one you act on; generator ≠ verifier, do not take the sweep's word):**
  ${survList}

  **ADVISORY NITS (from the finders — punch-list only, NEVER block or reopen on these):**
  ${nitList}

  **THE GATE IS SPLIT (DR-072) — two categories with DIFFERENT consequences:**
  • **CORRECTION (BLOCKING — your hard gate):** correctness, **requirements/acceptance criteria met** (the EARS AC of FRD ${frd}), security, no genuine DUPLICATE of an existing shared primitive (DR-057), and **GROSS visual-structural mismatch**. These BLOCK. The survivors above are your starting set — CONFIRM each independently against the code before you act; you may also add a blocking correction the sweep missed if you find one exercising the feature (the sweep is a head-start, not a ceiling).
  • **VISUAL-FIDELITY NITS (ADVISORY — do NOT block, do NOT reopen):** sizing, spacing, exact color/shade, minor polish. **NEVER reopen a WO for a nit.** APPEND each nit (the ones above + any you find) to \`.pandacorp/comms/visual-punch-list.md\` (one line: \`- [ ] ${frd} · <route> · <the gap> · <file:approx-line if known>\`). The end-of-build Visual QA pass + the owner sweep these; they never gate VERIFIED.

  ${WHOLE_FRD_ORACLE}
  ${DRIFT_CLAIM_DIRECTIVE}
  ${DISMISSAL_CITATION_DIRECTIVE}${inventoryBlock(frd, reviewIds)}${gateContextScope(frd, reviewIds)}
${evidenceBlock(frd, ev)}${driftFinderBlock(frd, reviewIds)}
  1) Independently CONFIRM the surviving corrections and ${GATE_TESTS}, exercising the work orders TOGETHER with the rest of the feature (real integration, not isolated).
${gateFocusedStep(frd, ev)}

${GATE_PASS_RETURN}

  **If a SPECIFIC reviewed work order fails CORRECTION (a confirmed${GATE_REOPEN_COUNT}:**${GATE_REVIEW_ONLY_STOP(frd)}BEFORE any revert. **FIX-FORWARD MANDATE (DR-073): a BOUNDED fault you can name at file:line with a fix of ≤ ~30 lines MUST take this findings exit.** For EACH failing reviewed WO, write the specific finding (with file:line) and a RED-PROVEN failing test (fails WITHOUT the fix, passes${GATE_REOPEN_RETURN(frd)}
  **DR-065 — missing foundation primitive:** if a surface looks FLAT / structurally wrong because a SHARED design-system primitive it needs is NOT built, do NOT block and do NOT just reopen — return { green: false, missingFoundation: [the primitive names], failure }. The engine auto-repairs the foundation and rebuilds the surfaces against it.
  ${GATE_BROKEN_CLAUSE(frd)}`,
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
    r = MECH_SCRIPT   // proposal 39 C1: the scripted gate-prepare (same checks, same receipt shape)
      ? (await runMechOp('gate-prepare', `--path ${shellQuote(pooled ? slot.path : GATE_WORKTREE)} --sha ${shellQuote(sha)}${pooled ? ` --port ${slot.port}` : ''}`, { label: pooled ? `gate-worktree:${slot.id}` : 'gate-worktree', phase: 'Review' })).body
      : await agent(
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
    // The same BL-0183 refusal text for a pool slot and the legacy worktree (shared, so the two cannot drift).
    const refuseDirty = (tag, what) => dirty.length && log(`⊘ ${tag} (BL-0183): REFUSING to gate over a DIRTY gate ${what} — uncommitted path(s) a gate would silently execute (vitest --changed runs untracked files): ${dirty.join(' | ')} — evidence preserved, inspect/salvage by hand`)
    if (pooled) {
      refuseDirty('D1', `slot ${slot.id} (${slot.path})`)
      log(`⚠ D1: gate slot ${slot.id} (${slot.path}) could not be prepared (${(r && r.failure) || 'no verdict'}) — dropped from the parallel pool (${gatePool.filter((x) => x.state !== 'failed').length}/${gatePool.length} slot(s) left)`)
      return false
    }
    refuseDirty('C2', `worktree ${GATE_WORKTREE}`)
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
    r = MECH_SCRIPT   // proposal 39 C1: the scripted gate-release (salvage then clean exactly those paths)
      ? (await runMechOp('gate-release', `--path ${shellQuote(wt)} --dir ${shellQuote(dir)}`, { label: `gate-release:${frd}`, phase: 'Review' })).body
      : await agent(
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
  if (remaining && remaining.length === 0 && !optionalText(r && r.failure)) slot.clean = true
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
    log(`⊘ ${frd} (BL-0184): could not port the reviewer's test files onto main (${problems.join('; ')}) — re-gating ${frd} on the MAIN tree (DR-080)`)
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
// The repair-budget refusal's shared tail (three call sites, one wording).
const overRepairBudget = (frd) => ` > ${repairBudget(frd)} unidades = ${REPAIR_BUDGET_FACTOR}× el coste de construirlo) — repair budget exhausted`
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
  if (infraHalt) throw new InfraError(`run paused (${infraHalt.kind}): no repair of ${frd}`, { refused: true })   // proposal 39 C7: an infra halt never consumes a repair try
  agentSpawned += COST(P.judge)   // DR-073: repair runs on the judge model — weight it honestly
  return await chargedRepair(frd, P.judge, () => agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'repair' })}The build of FRD ${frd} hit a problem: ${context}. You are the repair engineer — TRY TO FIX it before we give up.
  1) Diagnose the root cause: read the failing output, the work orders, and .pandacorp/comms/progress.md.
  2) If it is within your reach (code / test / local config): fix the PRODUCTION code (never weaken or skip tests) until \`bash .pandacorp/verify.sh\` is green for this feature; set the affected work orders' frontmatter back to \`implementation_status: IN_REVIEW\`; commit (Conventional Commits with scope, the subject naming ${frd} and the work orders you fixed); return { green: true }.
  3) If you CANNOT fix it, classify WHY, set the affected work orders' frontmatter to \`implementation_status: BLOCKED\` + \`blocked_reason: <reason>\`, then ${SYNC_ROLLUPS} Discard ONLY the UNCOMMITTED edits of the blocked work orders' files (yours and a failed build's): restore tracked ones to HEAD with the BL-0202 RESTORE COMMAND \`${scopedRestoreCommand('HEAD')}\` and remove new untracked ones with the BL-0202 CLEAN COMMAND \`${scopedCleanCommand()}\` (each VERBATIM except ${SCOPED_PATHS_NOTE} List the paths with \`${PROJECT_STATUS_COMMAND}\`). **Never touch COMMITTED code and never restore anything "to last_green_sha"** (the pin may already contain the blocked work orders' rejected build, BL-0212): right after you return, the engine discards the blocked work orders' committed code by reverting their OWN commits (DR-070). Commit only the status change (the subject naming ${frd} and the work orders)${gateBlocked ? `, then append ONE more printf naming the blocked_reason you are actually returning below (needs-owner, external or error) — literally: ${emitGateOutcome(frd, 'blocked', `,"blocked_reason":"%s"`, ` "<the blocked_reason you return: needs-owner|external|error>"`)}` : ''}, and return { green: false, blocked_reason, failure }:
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
// Proposal 40 §2 (Patch): `bounded` (fastPatchBounded) puts a fast-lane patch-1 on sonnet/high; it never applies to a
// diagnosis-guided patch-2, and a red verify of it escalates to opus (gateConverge).
async function attemptPatch(frd, findings, reviewIds, priorDiagnosis = null, mech = null, bounded = false) {
  const scoped = Boolean(SCOPED_REPAIR && mech && mech.mechanical && !priorDiagnosis)
  const onSonnet = scoped || (bounded && !priorDiagnosis)
  const patchModel = onSonnet ? 'sonnet' : 'opus'
  const patchEffort = scoped ? 'medium' : onSonnet ? 'high' : 'xhigh'
  agentSpawned += COST(patchModel)   // A6: patch-2 is weighted like patch-1 (opus=3); WP-08: a mechanical patch-1 is weighted as the sonnet it is
  if (scoped) log(`◦ ${frd}: gate-report classes ${mech.classes.join('+')} are MECHANICAL (${mech.subgates.join(', ')}) — patch-1 on sonnet/medium with a scoped inner loop instead of opus/xhigh (WP-08)`)
  else if (onSonnet) log(`◦ ${frd}: bounded finding(s) off the floor — patch on sonnet`)
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
  **If whole-project-clean:** COMMIT the patch (Conventional Commits, scope, the subject naming ${frd} and the work orders you patched — a later revert attributes the patch by them, BL-0212), staging \`.pandacorp/build-journal.jsonl\` too (append-only — your attempt line) — but do NOT set any WO \`VERIFIED\`, do NOT touch \`reopen_count\`, do NOT advance \`last_green_sha\`/status.yaml: you patched it, so you may not certify it (constitution rule 4, generator ≠ verifier — audit-20). An INDEPENDENT verifier re-runs the gate and stamps. Return { green: true }.
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
  const scripted = FAST ? await scriptedVerifyPatched(frd, reviewIds) : null
  if (scripted) return scripted
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
  return (await certifyPatched(frd, reviewIds, verdict)) ? verdict : unstampedPatch(frd, verdict)
}
function unstampedPatch(frd, verdict) {
  log(`⊘ ${frd}: the independent verification ACCEPTED the patch but the certify step did not confirm its stamp — NOT marking it verified and NOT reverting the verified code; it re-gates next pass (BL-0191)`)
  return { ...verdict, green: false, unstamped: true, failure: 'BL-0191: the certify step did not confirm the stamp of an accepted post-patch verification' }
}
// Proposal 40 §2 (verify-patch + certify, fast lane): the verify mech op checks the pinned reviewer-test hashes FIRST,
// then runs those RED-proven tests and the full suite; certify-state stamps (WO VERIFIED, status.yaml, the last-green
// snapshot). Same contract as verifyPatched. null → the agent path: nothing pinned, a re-bless (the engine holds no
// hash for it), an inherited open contract no pinned test proves, or a verify that certified nothing either way.
const PATCH_SONNET_MAX_LINES = 30
const fastPatchBounded = (frd, findings) => FAST && !fastIsFloor(frd) && Array.isArray(findings) && findings.length > 0 && findings.every((x) => x && x.failingTest && Number.isInteger(x.fixLines) && x.fixLines > 0 && x.fixLines <= PATCH_SONNET_MAX_LINES)
async function scriptedVerifyPatched(frd, reviewIds) {
  const rt = reviewerTestsByFrd.get(frd)
  if (!rt || !rt.tests.length || rt.rebless) return null
  const pinned = (p) => rt.tests.some((t) => t.path === p || t.path.endsWith(`/${p}`))
  if ((((frdState.get(frd) || {}).inheritedFails) || []).some((e) => !(Array.isArray(e.tests) && e.tests.length && e.tests.every(pinned)))) return null
  const wos = (reviewIds || []).map((id) => ` --wo ${shellQuote(id)}`).join('')
  const tests = rt.tests.map((t) => ` --test ${shellQuote(`${t.sha256}:${t.path}`)}`).join('')
  agentSpawned++
  const v = await runMechOp('verify', `--patch --frd ${shellQuote(frd)}${wos}${tests} --dir ${shellQuote(rt.dir)}`, { label: `patch-verify:${frd}`, phase: 'Review' })
  const b = v.body
  if (!b || b.ok !== true) { log(`⚠ ${frd}: patch verify refused (${v.error || (b && b.status)}) — agent verifier instead`); return null }
  if (Array.isArray(b.breach) && b.breach.length) log(`⊘ ${frd}: DR-080 BREACH — ${b.failure}`)
  if (b.green !== true || b.scope === 'partial') return { green: false, failure: b.failure || 'red' }
  agentSpawned++
  const drift = (((frdState.get(frd) || {}).landingDrift) || []).map((d) => ` --drift ${shellQuote(d.id)}`).join('')
  const c = await runMechOp('certify-state', `--frd ${shellQuote(frd)}${wos}${tests}${drift} --token ${shellQuote(LEASE_TOKEN)} --epoch ${shellQuote(String(LEASE_EPOCH))}`, { label: `certify-state:${frd}`, phase: 'Review' })
  return c.body && c.body.ok === true && c.body.status === 'certified' ? { green: true, report_scope: b.scope } : unstampedPatch(frd, {})
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

// ── BL-0212: discard a rejected work order's OWN commits — deterministically, never "to last_green_sha" ──
// A publication is the whole main tree (build-orchestration.md, "What `last_green_sha` certifies"): with parallel
// gates, build waves between landings and every carry-over work order, the pin already CONTAINS IN_REVIEW work of
// FRDs whose gate has not landed. For such a work order a restore of its files to the pin restored its own rejected
// build — a silent no-op: the retry rebuilt on top of the rejected code and a BLOCKED work order's broken code stayed
// on main (the pollution DR-070 exists to prevent). wo-revert.mjs finds the commits of the work order's current
// attempt in git history and reverts THOSE: a file whose first touch by the attempt is not in the pin is restored to
// the pin exactly as before; any other file is reverted commit by commit, keeping every other commit's edit (a
// verified sibling's line in a shared file). A conflict, an uncommitted change on a target path or a work order in
// the wrong state refuses the WHOLE plan — nothing written, never a partial revert — and the engine blocks
// needs-owner. The script's one line is SEALED (drift-seal.mjs): a model relays it, the engine verifies it (BL-0206).
const WO_REVERT_OK = new Set(['reverted', 'nothing'])
// `frd`/`mode`: the receipt must be THIS request's (red-team 2026-09-30) — a sealed line of another FRD or mode is a
// misdirected or stale copy (a plan's "reverted" read as the apply's would report a discard that never ran).
function parseWoRevert(answer, frd, mode) {
  const raw = unwrapAnswer(answer, 'output')
  const text = raw && typeof raw.output === 'string' ? raw.output.trim().split('\n').pop() : ''
  if (!text) return { receipt: null, error: 'the revert runner returned no output', transport: true }
  let j
  try { j = JSON.parse(text) } catch { return { receipt: null, error: 'the revert output is not valid JSON', transport: true } }
  if (!driftSealHolds(text)) return { receipt: null, error: 'the revert output failed its integrity seal (the relay altered it)', transport: true }
  if (j && j.ok === true && (j.frd !== frd || j.mode !== mode)) return { receipt: null, error: `the revert receipt is not this request's (it names ${String(j.frd).slice(0, 40)} ${String(j.mode).slice(0, 8)}, expected ${frd} ${mode})`, transport: true }
  if (!j || j.ok !== true) return { receipt: null, error: `the revert script refused its input: ${(j && j.error) || 'no ok:true'}` }
  if (!WO_REVERT_OK.has(j.status)) return { receipt: j, error: `${j.status}: ${j.reason || 'refused'}` }
  if (typeof j.changed !== 'boolean') return { receipt: j, error: 'the revert receipt carries no `changed` flag' }
  return { receipt: j, error: '' }
}
let woRevertSeq = 0
/**
 * Runs wo-revert.mjs through a MECH relay and verifies its sealed receipt.
 * @param {'plan'|'apply'|'recover'} mode plan = read-only prediction (`recordIntent` also leaves the gitignored pending-discard
 *   marker, BL-0215); apply = write + commit (one commit naming the WOs); recover = finish a discard an interrupted run left behind
 * @param {{seam?: string[], requireStatus?: string, onlyStatus?: string, expectChange?: boolean, recordIntent?: 'PLANNED'|'BLOCKED'}} opts
 * @returns {Promise<{ok: boolean, receipt: object|null, error: string}>} ok only for status reverted|nothing
 */
async function woRevert(frd, ids, mode, opts = {}) {
  if (infraHalt) throw new InfraError(`run paused (${infraHalt.kind}): no ${mode} of ${frd}'s code`, { refused: true })   // proposal 39 C7: an infra halt never discards code
  // The lease epoch makes the path unique to THIS run: the sequence restarts at 1 every run, and a replay of a path an
  // earlier run wrote would serve that run's receipt when this run's command never executed (red-team 2026-09-30).
  const stored = `.pandacorp/run/wo-revert/${frd}-e${LEASE_EPOCH}-${++woRevertSeq}-${mode}.json`
  const flags = [...ids.map((id) => `--wo ${shellQuote(id)}`), ...(opts.seam || []).map((p) => `--seam ${shellQuote(p)}`),
    opts.requireStatus ? `--require-status ${opts.requireStatus}` : '', opts.onlyStatus ? `--only-status ${opts.onlyStatus}` : '', opts.expectChange ? '--expect-change' : '',
    opts.recordIntent ? `--record-intent ${opts.recordIntent}` : ''].filter(Boolean).join(' ')
  const cmd = `${WO_REVERT_CLI_COMMAND} ${mode} --project ${shellQuote(PROJECT_DIR)} --project-name "${PROJECT}" --frd ${shellQuote(frd)} ${flags} --out ${shellQuote(stored)}`
  const relay = async (label, command) => {
    agentSpawned++
    try {
      return await agent(`${MCR}BL-0212 ${mode === 'plan' ? 'revert plan (changes no tracked file)' : mode === 'recover' ? 'interrupted-revert recovery' : 'revert'} for ${frd}. ${RUN_ONCE} from the project root ${VERBATIM_AS}output\`: \`${command}\`. It prints ONE JSON line ending in an integrity checksum (\`"sum":"…"\`): copy it CHARACTER FOR CHARACTER — the engine rejects any altered copy. A non-zero exit is data, not a problem for you to fix: do not inspect, edit, restore, stage, commit or revert anything yourself.`,
        { label, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: DRIFT_OUTPUT_SCHEMA })
    } catch (e) {
      if (isInfraError(e)) throw e   // proposal 39 C7: an infra halt is never read as a missing receipt
      log(`⚠ ${frd}: the ${label} runner threw (${(e && e.message) || e})`)
      return null
    }
  }
  let parsed = parseWoRevert(await relay(`wo-revert-${mode}:${frd}`, cmd), frd, mode)
  if (!parsed.receipt && parsed.transport) {
    log(`⚠ ${frd}: ${parsed.error} — re-reading the stored revert receipt once (BL-0212)`)
    parsed = parseWoRevert(await relay(`wo-revert-replay:${frd}`, `${WO_REVERT_CLI_COMMAND} replay --project ${shellQuote(PROJECT_DIR)} --file ${shellQuote(stored)}`), frd, mode)
  }
  return { ok: !parsed.error, receipt: parsed.receipt, error: parsed.error }
}
// The non-silence guarantee: a discard that changed nothing where the rejected work was expected to leave is logged
// loud (the script also appends a RevertNoop dashboard event); a real discard is logged with what it touched.
function noteRevert(frd, ids, receipt, expectChange) {
  const files = (receipt.files || []).filter((x) => x.action !== 'keep')
  if (!receipt.changed) {
    if (expectChange) log(`⚠ RevertNoop ${frd}: discarding ${ids.join(', ')} changed NOTHING (${receipt.reason || 'no committed attempt found'}) — the rebuild starts from the current tree (BL-0212)`)
    return
  }
  log(`↩ ${frd}: discarded the rejected work of ${ids.join(', ')} — ${files.length} file(s) (${files.filter((x) => x.via === 'pin').length} restored to last_green_sha, ${files.filter((x) => x.via === 'revert').length} by reverting its own commits), commit ${receipt.committed || '?'} (BL-0212)`)
}
// A refused revert (conflict / dirty target / wrong state / unreadable receipt): NOTHING was reverted and nothing may
// be — the work orders are BLOCKED needs-owner with the reason, loudly. `flip`: the reopen flip already committed them
// PLANNED (their rejected code is still on main); `blocked`: a block path already set them BLOCKED.
// A `usable` refusal (proposal 39 C6: the script derived a committed build_usable line, in any lane) is the USABLE hold:
// its record names the certified sha and the dependent set a discard would have to take with it.
async function refuseRevert(frd, ids, rv, { flip = false, blocked = false, emit = true } = {}) {
  const why = rv.error || 'unknown'
  const conflicts = rv.receipt && Array.isArray(rv.receipt.conflicts) && rv.receipt.conflicts.length ? ` Conflicting file(s): ${rv.receipt.conflicts.join(', ')}.` : ''
  const usableSha = rv.receipt && rv.receipt.status === 'usable' ? String(rv.receipt.usableSha || '?') : null
  log(usableSha
    ? `⛔ ${frd}: USABLE since ${usableSha} (a committed build_usable line) — the discard of ${ids.join(', ')} is refused; fix-forward only: BLOCKED needs-owner, nothing reverted (proposal 39 C6)`
    : `⛔ RevertRefused ${frd}: the rejected code of ${ids.join(', ')} could NOT be discarded without touching other work (${why}) — nothing was reverted; BLOCKED needs-owner (BL-0212)`)
  agentSpawned++
  const record = usableSha
    ? usableHoldRecord(frd, usableSha, ids, 'el revert de wo-revert.mjs')
    : `No pude descartar el código rechazado de ${ids.join(', ')} (${frd}) sin tocar trabajo de otras features: ${why}.${conflicts} Ese código sigue en main y puede romper el gate de otras FRDs. Decide cómo resolverlo (revertir a mano los commits de esas órdenes resolviendo el conflicto, o conservar el código y corregirlo).`
  await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'block' })}BL-0212 REVERT REFUSED for ${frd}. The engine's deterministic revert of the rejected work orders (${ids.join(', ')}) refused: ${why}.${conflicts} NOTHING was reverted and nothing may be: do NOT \`git checkout\`/\`restore\`/\`rm\`/\`revert\` any code file, never hand-resolve anything.
  1) ${blocked ? 'For EACH of these work orders that is BLOCKED' : `For EACH of these work orders${flip ? ' (just set PLANNED — their rejected code is still on main)' : ''}`}: set \`implementation_status: BLOCKED\` + \`blocked_reason: needs-owner\`; ${SYNC_ROLLUPS} Bump pending_decisions through its current owning transition.
  2) Append this owner-facing DECISION RECORD to .pandacorp/inbox/decisions.md (SPANISH): ${record}
  3) COMMIT (Conventional Commits, scope, the subject naming ${frd}) staging ONLY those frontmatter/rollup files, decisions.md and status.yaml.${emit ? emitGateOutcome(frd, 'blocked', `,"blocked_reason":"needs-owner"`) : ''}${NOTIFY(usableSha ? 'FRD ' + frd + ' USABLE rechazado por su gate: descartarlo necesita tu decision' : 'FRD ' + frd + ': no pude descartar el codigo rechazado sin tocar otras features — necesita tu decision')}
  Return { green: false, blocked_reason: 'needs-owner' }.`,
    { label: `block-revert-refused:${frd}`, phase: 'Review', model: MECH, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}
// ── BL-0215: a run cut between a state flip and its discard ──
// Every discard is two steps (the flip commit, then wo-revert apply — crash-safe in ONE direction, WS-D/D12), and the
// external brake / a crash / an owner stop can cut exactly between them: the work order is PLANNED/BLOCKED over its
// rejected code, which the next pass would rebuild on top of (PLANNED) or keep on main (BLOCKED). Git cannot tell that
// from a deliberate state (an owner-unblocked work order, a repair that kept its code), so each discard records its
// INTENT first (`plan --record-intent`, a gitignored marker the apply consumes) and the next run START finishes it.
// The repair path has no plan step of its own (the repair agent decides to give up): record the intent before it runs.
async function recordRepairDiscardIntent(frd, ids) {
  if (isUsable(frd)) return   // proposal 39 C6: USABLE code is never discarded automatically, so no intent to finish later
  if (ids.length) await woRevert(frd, ids, 'plan', { recordIntent: 'BLOCKED' })   // a refused plan records nothing; discardBlockedCode reports the refusal itself
}
// Run ONCE at run start, after the plan is read (no extra read: the candidates come from it). Only an FRD holding a
// work order a flip can have left over rejected code — BLOCKED, or PLANNED after a reopen — costs one MECH `recover`
// unit; a run without any spends nothing. The script decides from the marker (no marker / a work order that moved on =
// `nothing`), so a BLOCKED FRD whose discard landed long ago only pays that one unit. A refusal blocks the FRD
// needs-owner exactly like refuseRevert does in the flow that raised it; the marker is consumed either way.
async function recoverPendingReverts() {
  for (const f of plan.frds || []) {
    if (ONLY && !ONLY.includes(f.frd)) continue
    const wos = f.workOrders || []
    const atRisk = wos.filter((w) => w.status === 'PLANNED' && (w.reopen_count || 0) >= 1).map((w) => w.id)
    if (!atRisk.length && !wos.some((w) => w.status === 'BLOCKED')) continue
    const rv = await woRevert(f.frd, [], 'recover')
    if (!rv.ok) {
      const named = rv.receipt && Array.isArray(rv.receipt.wos) && rv.receipt.wos.length ? rv.receipt.wos.map((w) => w.id) : atRisk
      await refuseRevert(f.frd, named, rv, { flip: atRisk.length > 0, blocked: atRisk.length === 0, emit: false })
      blockFrdInSchedule(f.frd, 'needs-owner')
      continue
    }
    const r = rv.receipt
    if (r.recovery === 'recovered') log(`↩ RevertRecovered ${f.frd}: a previous run was cut between the state flip and the discard — discarded the rejected work of ${(r.wos || []).map((w) => w.id).join(', ')} (${(r.files || []).filter((x) => x.action !== 'keep').length} file(s)), commit ${r.committed || '?'} (BL-0215)`)
    else if (r.recovery === 'stale' || r.recovery === 'dropped') log(`ℹ ${f.frd}: a pending revert intent was not acted on — ${r.reason} (BL-0215)`)
  }
}

// DR-070 for the repair path: after a repair gave up and BLOCKED work orders, discard the COMMITTED code of exactly
// the candidates now BLOCKED (--only-status). Returns false when the discard was refused (the caller blocks
// needs-owner instead of the repair's own reason).
async function discardBlockedCode(frd, ids) {
  if (!ids.length) return true
  if (isUsable(frd)) { await holdUsableDiscard(frd, ids, 'a discard of the work orders the repair blocked'); return false }   // C6: needs-owner
  const done = await woRevert(frd, ids, 'apply', { onlyStatus: 'BLOCKED' })
  if (done.ok) { noteRevert(frd, ids, done.receipt, false); return true }
  await refuseRevert(frd, ids, done, { blocked: true, emit: false })
  return false
}

// ── DR-073 fallback: revert + reopen for a clean rebuild (DR-070) ──
// Runs ONLY when the in-place patch could not green the build. For each reopened WO: set it PLANNED, INCREMENT
// reopen_count (so the non-progress cap can fire), and discard its committed-but-rejected code so it does NOT pollute
// sibling FRDs' WHOLE-PROJECT gate (DR-070). WS-D/D12 order, crash-safe: (0) a read-only revert PLAN first — a
// refusal blocks needs-owner before anything is flipped; (1) the flip commit (a judge: which tests are reviewer
// evidence to preserve is judgment, DR-107); (2) the deterministic discard (BL-0212), which requires the flip to
// have landed (--require-status PLANNED). Reviewer-authored / Status-Note-referenced TEST files are PRESERVED, not
// deleted (the personal-page-v2 revert deleted a green a11y spec the hand-off cited). The rebuild happens on opus
// (reopen_count>=1) — first via the DR-107 in-run retry in this same run, else on the next pass.
// A3 PARTIAL REVERT: when the diagnosis says the fault is cleanly separable to a SEAM (opts.seamFiles), the discard
// is restricted to those files (--seam), still increments reopen_count, still preserves reviewer tests, and the
// wo_reopen event carries reason:"seam".
// Returns { refused: true } after a refusal (the FRD is already blocked — callers return 'blocked').
async function revertAndReopen(frd, reopenIds, opts = {}) {
  const ids = reopenIds || []
  reviewerTestsByFrd.delete(frd)   // BL-0184: the pinned tests bound THIS verdict's patch ladder; the retry's fresh gate on main owns its own
  const seamFiles = (opts.seamFiles && opts.seamFiles.length) ? opts.seamFiles : null
  if (isUsable(frd)) { await holdUsableDiscard(frd, ids, seamFiles ? 'a partial revert of the seam + rebuild' : 'a revert + rebuild'); blockFrd(frd, 'needs-owner', 'USABLE code kept: the discard needs the owner (proposal 39 C6)'); return { refused: true } }
  const refused = async (rv, flip) => { await refuseRevert(frd, ids, rv, { flip }); blockFrd(frd, 'needs-owner', `revert refused (BL-0212): ${rv.error}`); return { refused: true } }
  const plan = await woRevert(frd, ids, 'plan', { seam: seamFiles, recordIntent: 'PLANNED' })   // BL-0215: the intent survives a cut between the flip and the apply
  if (!plan.ok) return await refused(plan, false)
  agentSpawned += COST(P.judge)
  const reopenReason = seamFiles ? 'seam' : 'gate-reject'
  const revertJournal = JOURNAL(
    `"wo":"%s","frd":"${frd}","attempt":%s,"reopen_count":%s,"rung":"revert","role":"builder","kind":"attempt","classification":"","seam":${seamFiles ? `"${seamFiles.join(', ').replace(/"/g, '')}"` : 'null'},"findingKey":"","tried":"${seamFiles ? 'partial revert (seam only)' : 'full revert'}","verdict":"","why":"%s","confidence":""`,
    ` "<the reopened work order, else ${ids[0] || frd}>" "<its NEW attempt number after the increment, an integer>" "<its NEW reopen_count after you increment it, an integer>" "<one line: why it was reverted>"`)
  await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'revert' })}DR-073 fallback — the in-place patch could NOT green ${frd}, so revert + reopen for a clean rebuild${seamFiles ? ' (A3 PARTIAL revert — restricted to the diagnosed seam)' : ''}. Reopened work orders: ${ids.join(', ')}${seamFiles ? `\n  **SEAM (A3) — the diagnosis isolated the fault to these files ONLY; the engine discards NOTHING else the WO touched, so good work is preserved: ${seamFiles.join(', ')}** (the diagnosis proved the fault is confined to the seam).` : ''}
  **WS-D/D12 — you make ONE commit, the frontmatter flip; the engine discards the code AFTER it (crash-safe: never a committed IN_REVIEW pointing at code that has been reverted away).** For EACH reopened work order:
     a) Set its frontmatter \`implementation_status: PLANNED\` and **INCREMENT its \`reopen_count\`** (the non-progress cap, DR-072 — so a WO that keeps failing eventually BLOCKS needs-owner instead of grinding).
     b) **EXCEPTION — preserve test evidence (DR-107):** a newly-created TEST file that the reviewer authored or that a \`## Status Note\` references (an adversarial spec, an e2e spec like \`a11y.spec.ts\`) is COVERAGE, not rejected code — do not destroy it. MOVE it to \`.pandacorp/run/preserved-tests/<wo-id>/\` (mkdir -p; gitignored runtime state) instead of deleting it, so the rebuild restores it as its RED baseline (the personal-page-v2 incident: a green 6/6 a11y spec was deleted by a revert and had to be re-authored blind a pass later).
     c) Append one durable reopen line PER reopened work order to ${TRACK_PATH} (fire-and-forget — reopen_count resets to 0 when the WO finally passes, so WITHOUT this line the durable timeline under-reports rework): printf '{"kind":"wo_reopen","frd":"${frd}","wo":"%s","reason":"${reopenReason}","at":"%s"}\\n' "<the-wo-id>" "$(date -u +%FT%TZ)" >> ${TRACK_PATH}.${WO_REOPEN_EVENT(frd, reopenReason)} BUILD-JOURNAL (A1) — record ONE revert line (descriptive attempt; verdict stays empty):${revertJournal}
     ${SYNC_ROLLUPS} **COMMIT this frontmatter flip ALONE** (Conventional Commits, scope, the subject naming ${frd} and the reopened work orders; stage \`.pandacorp/build-journal.jsonl\` too, append-only).
  **Do NOT discard any other code yourself** — no \`git checkout\`/\`restore\`/\`rm\` of the work orders' files, never a restore "to last_green_sha" (the pin may already contain their rejected build, BL-0212) and never a hard reset. Right after your commit the engine discards the rejected code deterministically, by reverting the work orders' OWN commits (DR-070), leaving every other WO (IN_REVIEW or VERIFIED) untouched.
  Return { green: false } (the engine retries the reopened WOs — in-run first (DR-107), else next pass — from a clean base).`,
    { label: `revert:${frd}`, phase: 'Review', model: P.judge, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
  const done = await woRevert(frd, ids, 'apply', { seam: seamFiles, requireStatus: 'PLANNED', expectChange: true })
  if (!done.ok) return await refused(done, true)
  noteRevert(frd, ids, done.receipt, true)
  return { refused: false }
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
  if (infraHalt) { log(`⏸ ${frd}: not BLOCKED (${reason || 'error'}) — the run is paused on infra, the FRD resumes next run (proposal 39 C7)`); return }
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
// A-1 bench (DR-123): a dependency-free WO may build in the foundation wave when its DECLARED artifacts provably cannot
// interact with the foundation: not UI (artifactsTouchUi, fail-closed on undeclared), and not an IMPLICIT shared surface that
// declared artifacts do not capture — package.json / any lockfile (a dependency change the foundation's own install must
// see) or messages/** (the i18n catalogs the foundation's keys live in). DR-057 guards exactly those implicit couplings, so
// anything that touches them (or declares nothing) keeps the deferral; artifacts stay disjoint per DR-060 via pickDisjointWave.
const FOUNDATION_SHARED_RE = /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|npm-shrinkwrap\.json)$|(^|\/)messages\//
const joinsFoundationWave = (w) => (w.deps || []).length === 0 && Boolean(w.artifacts && w.artifacts.length) && !artifactsTouchUi([w]) && !w.artifacts.some((a) => FOUNDATION_SHARED_RE.test(a))
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

// ── A-1 bench: evidence-based run projection (replaces the launcher's old "15 x FRDs" rule of thumb) ──────────────
// Cost units follow the engine's own weights (opus 3, every MECH step 1). Fixed overhead ~8 (baseline precheck + plan + the
// first safe-point + a UI build's foundation-gate); per WO to build 3 MECH steps (dispatch share, commit, self-test relay) +
// the builder's weight; ~20 per FRD for its gate link (~6), PASS landing (~2-3), one reopen ladder (~7-9 at the canaries' ~50 %
// first-gate reopen rate) and the tail share. Measured case: 1 FRD / 3 WOs / one reopen ≈ 48 units (bench A-1). The projection
// is deliberately a bit LOW for the raw sum (3 sonnet WOs = 40); AUTO_HEADROOM covers the reopen.
const AUTO_FIXED_COST = 8
const AUTO_WO_MECH_COST = 3
const AUTO_FRD_COST = 20
const AUTO_HEADROOM = 1.25
const AUTO_USD_PER_UNIT = 0.5   // APPROXIMATE: A-1 spent ≈25 USD for ≈48 units. Log-only, never a decision input.
const projectedFrdsCost = (frds) => {
  let units = 0
  for (const f of frds || []) {
    units += AUTO_FRD_COST
    for (const w of f.workOrders || []) {
      if (w.status === 'VERIFIED' || w.status === 'BLOCKED' || w.status === 'IN_REVIEW' || w.docStatus === 'DRAFT') continue   // nothing to build (IN_REVIEW goes straight to the gate, which the FRD share already prices)
      units += AUTO_WO_MECH_COST + COST(pickWorkerModel(w))
    }
  }
  return units
}
/** Projected cost-weighted units of the whole run for `pl` (fixed overhead + every FRD in it). */
const projectedRunCost = (pl) => AUTO_FIXED_COST + projectedFrdsCost(pl.frds)
// Sizes MAX_AGENTS for an opt-in 'auto' run: the first call (after the plan) sets ceil(1.25 x projection); a later call for
// FRDs ADDED to the plan (a drained change) raises the cap by the added FRDs' own projection — it never lowers it, so a
// grown plan cannot re-introduce a stop=agents. With an EXPLICIT numeric cap it only logs an advisory when the cap sits below
// the projection (never overrides, never stops: partial resumable runs are legitimate).
function sizeAgentBudget(addedFrds) {
  if (!MAX_AGENTS_AUTO && !MAX_AGENTS) return
  const first = addedFrds === undefined
  const units = first ? projectedRunCost(plan) : projectedFrdsCost(addedFrds)
  const usd = (n) => `≈ ${(n * AUTO_USD_PER_UNIT).toFixed(0)} USD aprox.`
  if (!MAX_AGENTS_AUTO) {
    if (first && MAX_AGENTS < units) log(`⚠ AgentBudgetAdvisory: explicit maxAgents ${MAX_AGENTS} is below the projected run cost of ~${units} units (${usd(units)}; fixed ~${AUTO_FIXED_COST} + per WO ${AUTO_WO_MECH_COST}+builder weight + ~${AUTO_FRD_COST} per FRD) — it may stop at the ceiling (maxAgents:'auto' sizes it).`)
    return
  }
  const cap = first ? Math.ceil(AUTO_HEADROOM * units) : (MAX_AGENTS || 0) + Math.ceil(AUTO_HEADROOM * units)
  MAX_AGENTS = Math.max(MAX_AGENTS || 0, cap)
  log(`⚖ maxAgents auto: projected ~${units} cost units${first ? '' : ' for the FRDs just added'} (${usd(units)}) → cap ${MAX_AGENTS} (x${AUTO_HEADROOM} headroom, plan of ${plan.frds.length} FRD(s))`)
}

// ── DR-069 SAFE-POINT (in-engine, audit-20 P0-3): every WAVE boundary IS a safe point (BL-0021: was every
// FRD boundary — the scheduler unit changed; C1c: it runs before every WAVE, and is SKIPPED on pure gate-drain
// iterations — a wave is the safe point, and the initial owner-signal check runs pre-loop in the baseline
// pre-check). The ENGINE itself checks the owner's signals here — the change queue, answered decisions, the
// rethink stop — instead of leaving the drain to supervisor prose (a supervisor may not exist, and its own
// safe points are only between passes; an expedite change used to wait a whole multi-hour pass).
// Returns 'stop' when the owner re-planned (rethink_pending), else null.
// Proposal 39 C1 (mechScript): the scripted probe runs first (fenced lease renewal, the lstat stop receipt, rethink,
// ready changes, answered needs-owner decisions); the LLM drain below, the judgment part, runs only when the probe
// finds work or cannot be verified (fail-safe). A probe stop stops here, like the LLM's own.
async function safePointProbe() {
  const reuse = fusedProbe
  fusedProbe = null
  if (!reuse) agentSpawned++
  const r = reuse ? { body: reuse } : await runMechOp('safe-point', `--token ${shellQuote(LEASE_TOKEN)} --epoch ${shellQuote(String(LEASE_EPOCH))}${TARGETED ? ' --targeted' : ''}`, { label: 'safe-point-probe' })
  const b = r.body
  if (!b || b.ok !== true) { log(`⚠ safe-point probe unverifiable (${r.error || (b && (b.reason || b.error || b.status)) || 'no receipt'}) — running the full safe point (fail-safe, proposal 39 C1)`); return 'work' }
  if (b.stop === true || (b.stop_receipt && b.stop_receipt.stop === true)) { log(`⏸ safe-point probe: stop (${b.reason || (b.rethink_pending ? 'rethink_pending' : 'owner stop file')}) — el motor para en este safe point (proposal 39 C1)`); return 'stop' }
  const rc = b.stop_receipt
  if (!rc || rc.status_exists !== true || rc.stop !== false || rc.method !== 'node-lstat') { log('⚠ safe-point probe returned no valid stop receipt — running the full safe point (fail-safe, proposal 39 C1)'); return 'work' }
  if (b.work === true) { log(`◦ safe-point probe found work (ready: ${(b.ready || []).join(', ') || 'none'}; unreadable: ${(b.unreadable || []).length}; answered decisions: ${b.answeredDecisions || 0}) — the full safe point drains it`); return 'work' }
  return 'quiet'
}
async function safePoint() {
  if (MECH_SCRIPT) {
    const probe = await safePointProbe()
    if (probe === 'stop') return 'stop'
    if (probe === 'quiet') return null
  }
  agentSpawned++
  const sp = await agent(
    `${RENEW_LEASE} Safe-point check (DR-069/BL-0073) — read the owner's signals; change ONLY what is specified:
    ${INSPECT_STOP_STEP}
    ${RETHINK_STEP}
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
        if (extra && extra.frds && extra.frds.length) { for (const nf of extra.frds) { plan.frds.push(nf); enrollFrd(nf) } sizeAgentBudget(extra.frds); detectCycles(); log(`＋ FRDs de la change añadidos a esta corrida: ${extra.frds.map((x) => x.frd).join(', ')}`) }
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
    ${INSPECT_STOP_STEP}
    ${RETHINK_STEP}
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
// BL-0212: the discard is the deterministic revert of the work orders' own commits, run AFTER the BLOCKED flip
// lands (--require-status BLOCKED); a plan that refuses keeps the code and says so in the decision record.
async function blockEarlyNeedsOwner(frd, reopenIds, diag) {
  const ids = reopenIds || []
  const plan = isUsable(frd) ? { ok: false, error: 'the FRD is USABLE (proposal 39 C6): its landed code is never discarded automatically' } : await woRevert(frd, ids, 'plan', { recordIntent: 'BLOCKED' })   // BL-0215
  if (!plan.ok) log(`⛔ RevertRefused ${frd}: the rejected code of ${ids.join(', ')} cannot be discarded without touching other work (${plan.error}) — it stays on main and the decision record says so (BL-0212)`)
  agentSpawned += COST(P.judge)
  const cls = (diag && diag.classification) || 'architectural'
  const conf = (diag && diag.confidence) || 'high'
  const record = (diag && diag.decisionRecord) || `El gate rechaza repetidamente ${frd} y el diagnóstico lo clasifica como ${cls} (confianza ${conf}) — no es un fallo puntual que el motor pueda arreglar solo; requiere una decisión del owner.`
  const refusedNote = plan.ok ? '' : ` AÑADE al registro: el motor NO pudo descartar el código rechazado sin tocar trabajo de otras features (${plan.error}); ese código sigue en main.`
  const res = await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'block' })}EARLY BLOCK needs-owner (A3 progressive-learning recovery) for ${frd}. The diagnoser classified this failure as **${cls}** (confidence ${conf}) — a doomed spec; burning the remaining reopens on it cannot help. Do NOT retry, do NOT patch. Steps:
  1) PRESERVE reviewer-authored / Status-Note-referenced TEST files of the reopened work orders (${ids.join(', ')}) — MOVE them to \`.pandacorp/run/preserved-tests/<wo-id>/\` (DR-107), do not delete. Discard NO other code yourself — no \`git checkout\`/\`restore\`/\`rm\`, never a restore "to last_green_sha" (the pin may already contain their rejected build), never a hard reset: ${plan.ok ? 'right after your commit the engine discards the rejected code by reverting the work orders\' OWN commits (BL-0212, DR-070).' : 'the engine\'s revert refused, so the rejected code stays on main for the owner to resolve (BL-0212).'}
  2) Set EACH reopened work order's frontmatter \`implementation_status: BLOCKED\` + \`blocked_reason: needs-owner\`; ${SYNC_ROLLUPS} Bump pending_decisions through its current owning transition.
  3) Append the owner-facing DECISION RECORD to .pandacorp/inbox/decisions.md (SPANISH) — what the gate keeps rejecting, the diagnosis, and exactly what the owner must decide — and INLINE the build-journal digest for this WO: read the last few ${JOURNAL_PATH} lines for ${ids[0] || frd} and summarize the attempt/diagnosis history so the owner sees how it got here. The record: ${record}${refusedNote}
  4) COMMIT (Conventional Commits, scope, the subject naming ${frd} and the work orders) staging the frontmatter flip, the moved tests, decisions.md, status.yaml AND \`.pandacorp/build-journal.jsonl\` (append-only — sweeps the diagnosis line).${emitGateOutcome(frd, 'blocked', `,"blocked_reason":"needs-owner"`)}${NOTIFY('FRD ' + frd + ' bloqueado (diagnóstico ' + cls + ') — necesita tu decisión')}
  Return { green: false, blocked_reason: 'needs-owner' }.`,
    { label: `block-needs-owner:${frd}`, phase: 'Review', model: P.judge, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
  if (plan.ok) {
    const done = await woRevert(frd, ids, 'apply', { requireStatus: 'BLOCKED', expectChange: true })
    if (done.ok) noteRevert(frd, ids, done.receipt, true)
    else await refuseRevert(frd, ids, done, { blocked: true, emit: false })
  }
  return res
}

// ── DR-107 in-run retry (bounded, budgeted) — extracted so the A3 ladder can thread a diagnosis in ──
// Runs AFTER a revert (full or partial): rebuilds the reopened WOs NOW from the clean green base (opus,
// reopen_count>=1) instead of paying a whole extra pass. `priorDiagnosis` (optional) is threaded into the
// rebuild via the wo object (_priorDiagnosis, injected by woCtx). Behaviour for the legacy call
// (priorDiagnosis omitted) is byte-equivalent to the old inline retry. Returns 'built' | 'reopened' | 'blocked'.
// The ladder's revert-then-rebuild: a refused revert (BL-0212) already blocked the FRD — never rebuild on top of it.
async function revertThenRetry(f, reopenIds, reviewIds, priorDiagnosis = null, opts = {}) {
  if ((await revertAndReopen(f.frd, reopenIds, opts)).refused) return 'blocked'
  return await inRunRetry(f, reopenIds, reviewIds, priorDiagnosis)
}
async function inRunRetry(f, reopenIds, reviewIds, priorDiagnosis = null) {
  const retryWos = f.workOrders.filter((w) => reopenIds.includes(w.id)).map((w) => ({ ...w, reopen_count: (w.reopen_count || 0) + 1, _isRetry: true, _priorDiagnosis: priorDiagnosis }))
  const canRetry = !capHit() && retryWos.length > 0 && retryWos.every((w) => w.reopen_count < MAX_REOPENS)
  if (!canRetry) { return reopenFrd(f) }
  // D4: the in-run retry rebuilds EVERY reopened WO on OPUS (reopen_count>=1) — the single PRICIEST
  // rung of the recovery ladder (its true cost scales with retryWos.length, unlike the single-agent
  // patch/diagnose rungs), and EVERY branch above (gate-test-defective fallback, patch-2 failure,
  // the (d)/(e) partial/full-revert branches, the legacy fallback) funnels through this one function, so
  // ONE check here covers all of them instead of duplicating it at each call site. Refuse BEFORE
  // spawning the rebuild when the FRD can no longer afford the FULL projected cost (never mid-rebuild —
  // see the per-WO chargeRepair below).
  if (!capHit() && !canAffordRepair(f.frd, 'opus', retryWos.length)) {
    log(`⊘ ${f.frd}: presupuesto de reparación agotado antes del in-run retry (${repairCostByFrd.get(f.frd) || 0} + ${COST('opus') * retryWos.length}${overRepairBudget(f.frd)} (WP-08/D4)`)
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
    return reopenFrd(f)
  }
  if (budgetedRetry.length < retryWos.length) log(`↻ ${f.frd}: in-run retry trimmed to fit the agent budget — ${budgetedRetry.map((w) => w.id).join(', ')} now; the rest rebuild next pass (WS-D/D6)`)
  log(`↻ ${f.frd}: in-run retry (DR-107) — rebuilding ${budgetedRetry.map((w) => w.id).join(', ')} from the clean base now (opus)${priorDiagnosis ? ' with the diagnosis threaded (A3)' : ''}`)
  for (const w of budgetedRetry) await chargedRepair(f.frd, 'opus', () => buildWO(w, f.frd))
  const regate = await frdGate(f.frd, reviewIds)
  // WP-08 cage: the in-run retry's re-gate is a certification too — a partial one certifies nothing.
  if (regate && regate.green === true && isPartialReport(regate)) { refusePartial(f.frd, "the in-run retry's re-gate"); return reopenFrd(f) }
  if (regate && regate.green === true) { await applyGate(f.frd, reviewIds, regate.testFiles, null); return verifiedBuilt(f, `in-run retry`) }
  if (regate && regate.reopen && regate.reopen.length) { if ((await revertAndReopen(f.frd, regate.reopen)).refused) return 'blocked' }
  // B2 (BL-0157): same rule as gateConverge — a deficient traceability inventory with no reopen is a
  // reviewer-paperwork gap, not a stall to silently defer forever. Re-ask ONCE, naming what's missing;
  // if it's still deficient, block needs-owner outright rather than looping passes on a formatting gap.
  else if (regate && regate.traceabilityDeficient) {
    const missingClasses = regate.missingClasses || []
    log(`⚠ ${f.frd}: in-run retry's re-gate has an incomplete traceability contract (missing: ${missingClasses.join(', ') || 'see failure'}) — re-asking once before deferring (B2, BL-0157)`)
    const st = frdState.get(f.frd)
    const attemptNo = ((st && st.gateAttempts) || 0) + 1
    if (st) st.gateAttempts = attemptNo
    const directive = traceabilityReaskDirective(regate, 'with a COMPLETE traceability inventory this time.')
    const reregate = await finalizeGate(f.frd, reviewIds, await frdGateSerial(f.frd, reviewIds, attemptNo, undefined, undefined, directive))
    if (reregate && reregate.green === true && isPartialReport(reregate)) { refusePartial(f.frd, "the in-run retry's traceability re-ask"); return reopenFrd(f) }
    if (reregate && reregate.green === true) { await applyGate(f.frd, reviewIds, reregate.testFiles, null); return verifiedBuilt(f, `in-run retry, traceability re-ask`) }
    if (reregate && reregate.reopen && reregate.reopen.length) { if ((await revertAndReopen(f.frd, reregate.reopen)).refused) return 'blocked'; return reopenFrd(f) }
    if (reregate && reregate.traceabilityDeficient) {
      const stillMissing = reregate.missingClasses || missingClasses
      logTraceabilityStillIncomplete(f, stillMissing)
      await persistGateBlock(f.frd, reviewIds, 'needs-owner', reregate.failure || `gate traceability contract: missing ${stillMissing.join(', ')}`)
      blockFrd(f.frd, 'needs-owner', reregate.failure || `gate traceability contract: missing ${stillMissing.join(', ')}`, reregate.traceability)
      return 'blocked'
    }
  }
  log(`↻ ${f.frd}: in-run retry did not converge — deferred to the next pass`)
  return reopenFrd(f)
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
// A certified FRD: logged with how it got there, counted built, the block streak reset.
function verifiedBuilt(f, how) { log(`✓ ${f.frd} VERIFIED (${how})`); builtFrds.push(f.frd); consecutiveBlocks = 0; return 'built' }
function deferUnstamped(f) { return reopenFrd(f) }
// The FRD stays IN_REVIEW and re-gates next pass.
function reopenFrd(f) { reopenedFrds.push(f.frd); return 'reopened' }
// BL-0206 (red-team): a green whose only red is an UNPROVEN drift claim (adjudicateDrift) — never certified, never
// reopened, never reverted, never blocked: deferred IN_REVIEW for a fresh gate (and a fresh proof) next pass.
const driftUnprovenDefer = (gate) => Boolean(gate && gate.__driftUnproven && !(gate.reopen && gate.reopen.length))
function deferDriftUnproven(f) { log(`↩ ${f.frd}: deferred to the next pass — an unproven drift claim keeps it from certification, and nothing warrants a code change (BL-0206)`); return reopenFrd(f) }
async function gateConverge(f, reviewIds, gate, traceabilityReasked = false) {
  phase('Review')
  // WP-08 cage, at the certification boundary: a gate that ran `--only`/`--files` stamped its report
  // `scope:"partial"` and is NOT an oracle for this FRD. Refuse BEFORE the apply step is even spawned,
  // and defer the FRD for a full re-gate — never stamp, never advance last_green_sha.
  if (gate && gate.green === true && isPartialReport(gate)) {
    refusePartial(f.frd, 'the FRD gate')
    return reopenFrd(f)
  }
  if (driftUnprovenDefer(gate)) return deferDriftUnproven(f)
  if (gate && gate.green === true) {
    // BL-0185: a CONCURRENT pass whose first apply failed lands here from the harvest — its reviewer's tests
    // and gate-report live in the gate-EVIDENCE dir (the release already cleaned the worktree), never on
    // main. Re-port from there exactly as the harvest did; only a gate that ran on main applies in place.
    const ev = gate.reviewerEvidence
    const applied = ev
      ? await applyGate(f.frd, reviewIds, ev.tests.map((x) => x.path), ev.dir)
      : await applyGate(f.frd, reviewIds, gate.testFiles, null)
    if (!applied) { log(`↻ ${f.frd}: the serialized apply step did not confirm the stamp — NOT marking it verified; it re-gates next pass`); return reopenFrd(f) }
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
    const bounded = fastPatchBounded(f.frd, gate.findings)
    const patched = await attemptPatch(f.frd, gate.findings || [], reviewIds, null, mech, bounded)
    patchesThisCycle = 1   // patch-1 spent (A3 PATCH_ATTEMPT_CAP counts patches THIS gate cycle)
    if (patched && patched.green === true) {
      // Constitution rule 4 (audit-20): the patcher claimed green — an INDEPENDENT agent re-runs the
      // gate and is the only one allowed to stamp VERIFIED + advance last_green_sha.
      let iv = await verifyPatched(f.frd, reviewIds)
      // Proposal 40 §2 (Patch): a sonnet patch the independent verify found red gets ONE opus patch on top of it.
      if (bounded && iv && iv.green !== true && !iv.unstamped && !capHit() && canAffordRepair(f.frd, 'opus')) {
        patchesThisCycle = 2
        log(`↑ ${f.frd}: sonnet patch red (${iv.failure || 'red'}) — opus patch`)
        const p2 = await attemptPatch(f.frd, [...(gate.findings || []), { wo: reviewIds[0], finding: `the previous patch did not hold: ${iv.failure || 'red'}` }], reviewIds)
        iv = p2 && p2.green === true ? await verifyPatched(f.frd, reviewIds) : { green: false, failure: (p2 && p2.failure) || 'red' }
      }
      if (iv && iv.green === true) { return verifiedBuilt(f, `patched in place, independently verified`) }
      if (iv && iv.unstamped) return deferUnstamped(f)   // BL-0191: verified but not stamped — keep the code, re-gate; never revert it
      patchFailNote = `patch claimed green but the independent verification FAILED (${iv?.failure || 'red'})`
    } else if (patched && patched.cause === 'gate-test-defective' && (patched.defectiveTests || []).length) {
      // BL-0001 second fallback: the gate's own adversarial test is the defect — repair the TEST,
      // never discard a correct build over an unsatisfiable assertion (LESSON-0002).
      log(`⚖ ${f.frd}: patch flagged defective gate test(s) (${patched.defectiveTests.map((t) => t.path).join(', ')}) — repairing the TEST, not rebuilding (BL-0001)`)
      const tr = await repairGateTest(f.frd, patched.defectiveTests, reviewIds)
      if (tr && tr.green === true) {
        const iv2 = await verifyPatched(f.frd, reviewIds)
        if (iv2 && iv2.green === true) { return verifiedBuilt(f, `defective gate test repaired, independently verified`) }
        if (iv2 && iv2.unstamped) return deferUnstamped(f)   // BL-0191: verified but not stamped — keep the code, re-gate; never revert it
        patchFailNote = `gate-test repair greened but the independent verification failed (${iv2?.failure || 'red'})`
      } else patchFailNote = `gate-test claim not upheld (${tr?.failure || 'test was right — the build is wrong'})`
    } else if (patched && patched.cause === 'code' && !capHit() && !canAffordRepair(f.frd, P.judge)) {
      // WP-08 (d): patch-1 failed on real code and the repair budget is gone. Stopping HERE is the whole
      // point — one more diagnosis + patch-2 is exactly the spend the brake exists to refuse.
      log(`⊘ ${f.frd}: presupuesto de reparación agotado (${repairCostByFrd.get(f.frd) || 0}${overRepairBudget(f.frd)}, honest needs-owner exit with the work preserved (WP-08)`)
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
          if (iv && iv.green === true) { return verifiedBuilt(f, `diagnosed defective gate test repaired`) }
          if (iv && iv.unstamped) return deferUnstamped(f)   // BL-0191: verified but not stamped — keep the code, re-gate; never revert it
        }
        log(`↻ ${f.frd}: gate-test repair from diagnosis did not green — full revert + retry`)
        return await revertThenRetry(f, gate.reopen, reviewIds, diag)
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
          if (iv && iv.green === true) { return verifiedBuilt(f, `deadlocked contract re-blessed by the independent reviewer, independently verified`) }
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
        log(`⊘ ${f.frd}: presupuesto de reparación agotado antes del patch-2 (${repairCostByFrd.get(f.frd) || 0} + ${COST('opus')}${overRepairBudget(f.frd)} (WP-08)`)
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
          if (iv && iv.green === true) { return verifiedBuilt(f, `patch-2 diagnosis-guided, independently verified`) }
          if (iv && iv.unstamped) return deferUnstamped(f)   // BL-0191: verified but not stamped — keep the code, re-gate; never revert it
          log(`↻ ${f.frd}: patch-2 greened but the independent verification failed (${iv?.failure || 'red'}) — full revert + retry`)
        } else {
          log(`↻ ${f.frd}: patch-2 did not green (${patched2?.failure || 'no verdict'}) — full revert + retry`)
        }
        return await revertThenRetry(f, gate.reopen, reviewIds, diag)
      }
      // (d) point + repeatsPrior + cleanlySeparable → PARTIAL revert (seam files ONLY) + retry.
      if (repeats && cleanlySeparable) {
        log(`↩ ${f.frd}: diagnosis = point, repeats a prior fault, cleanly separable — PARTIAL revert restricted to the seam (${seam.files.join(', ')}) + retry (A3)`)
        return await revertThenRetry(f, gate.reopen, reviewIds, diag, { seamFiles: seam.files })
      }
      // (e) point + repeatsPrior + NOT cleanlySeparable (or patch budget spent) → full revert + retry, diagnosis threaded.
      log(`↻ ${f.frd}: diagnosis = point${repeats ? ', repeats a prior fault, not cleanly separable' : ''} — full revert + retry with the diagnosis threaded (A3)`)
      return await revertThenRetry(f, gate.reopen, reviewIds, diag)
    } else {
      // capHit code-fail (honest degrade — no diagnosis at the ceiling, A3), or a no-verdict patch.
      patchFailNote = `in-place patch did not green (${patched?.failure || 'no verdict'}${patched && patched.cause === 'code' && capHit() ? '; agent ceiling reached — skipping the A3 diagnosis, legacy revert (honest degrade)' : ''})`
    }
    // Legacy fallback (verify-failed, gate-test-not-upheld, capHit code-fail, no-verdict): revert + in-run
    // retry with NO diagnosis — byte-equivalent to the pre-A3 path (DR-107).
    log(`↻ ${f.frd}: ${patchFailNote} — reverting + reopening`)
    return await revertThenRetry(f, gate.reopen, reviewIds)
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
    const directive = traceabilityReaskDirective(gate, '(green/reopen/findings unchanged unless your judgment of the code itself has changed) with a COMPLETE traceability inventory this time.')
    const regate = await finalizeGate(f.frd, reviewIds, await frdGateSerial(f.frd, reviewIds, attemptNo, null, null, directive))
    if (regate && regate.traceabilityDeficient && (!regate.reopen || !regate.reopen.length)) {
      const stillMissing = regate.missingClasses || missingClasses
      logTraceabilityStillIncomplete(f, stillMissing)
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
      return reopenFrd(f)   // the repair reset surfaces to the last green (→ PLANNED); next pass rebuilds them
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
  await recordRepairDiscardIntent(f.frd, reviewIds || [])
  const fix = await attemptRepair(f.frd, 'the FRD review/integration gate failed: ' + (gate?.failure || 'unknown'), true)   // BL-0159: gateBlocked:true — a step-3 give-up here IS a gate's terminal outcome
  // BL-0212/DR-070: a repair that gave up BLOCKED work orders — the engine discards their committed code (own commits).
  const discardRefused = !(fix && fix.green === true) && !(await discardBlockedCode(f.frd, reviewIds || []))
  if (fix && fix.green === true) {
    gate = await frdGate(f.frd, reviewIds)
    if (gate && gate.green === true && isPartialReport(gate)) { refusePartial(f.frd, 'the post-repair re-gate'); return reopenFrd(f) }   // WP-08 cage
    if (gate && gate.green === true) { await applyGate(f.frd, reviewIds, gate.testFiles, null); return verifiedBuilt(f, `after repair`) }
    if (driftUnprovenDefer(gate)) return deferDriftUnproven(f)
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
  const reason = discardRefused ? 'needs-owner' : ((fix && fix.blocked_reason) || (gate && gate.blocked_reason) || 'error')
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
    log(`⊘ ${f.frd}: WO id(s) ${dupes.map((w) => w.id).join(', ')} already belong to another FRD — duplicate ids across FRDs: refusing to enroll; blocking ${f.frd} (error): give them unique ids.`)
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
  if (draftWos.length) log(`⊘ ${f.frd}: WO(s) ${draftWos.map((w) => w.id).join(', ')} are still \`status: DRAFT\` (never passed the DR-100 readiness check) — not built or gated (needs-owner); route back to /pandacorp:architecture.`)
  const draftIds = new Set(draftWos.map((w) => w.id))
  const pending = f.workOrders.filter((w) => w.status !== 'VERIFIED' && w.status !== 'BLOCKED' && !draftIds.has(w.id))
  const toBuild = pending.filter((w) => w.status !== 'IN_REVIEW')   // IN_REVIEW = built by a prior interrupted run → straight to the gate, don't rebuild
  for (const w of f.workOrders) if ((w.status === 'VERIFIED' || w.status === 'IN_REVIEW') && !draftIds.has(w.id)) doneIds.add(w.id)
  for (const w of f.workOrders) if (w.status === 'BLOCKED' || draftIds.has(w.id)) blockedIds.add(w.id)   // WS-A/D3: a dep on this fails closed
  for (const w of toBuild) globalQueue.set(w.id, { wo: w, frd: f.frd })
  frdState.set(f.frd, { f, reviewIds: pending.map((w) => w.id), toBuildIds: new Set(toBuild.map((w) => w.id)), failed: false, enqueued: false, gateAttempts: 0 })   // gateAttempts: 1-based gate-attempt counter per FRD this run (B8 event field + C1a serial-first gate)
  log(`▶ ${f.frd}: ${toBuild.length} to build${pending.length - toBuild.length ? ` · ${pending.length - toBuild.length} already in review` : ''}`)
  // Proposal 39 C6 across runs: an FRD built in an earlier run (nothing left to build, all IN_REVIEW) that the precheck
  // does not list as still USABLE never certified USABLE (its verify stayed red, then a pause or a defer): exactly the
  // in-run "not USABLE" case, so its dependents wait for its VERIFIED, like a floor's.
  if (FAST && toBuild.length === 0 && pending.length > 0 && !priorUsable.some((u) => u.frd === f.frd) && !fastFloor.has(f.frd)) {
    fastFloor.add(f.frd)
    log(`◦ ${f.frd}: built in an earlier run but never USABLE (no committed build_usable line holds) — its dependents wait for its VERIFIED (proposal 39 C6)`)
  }
  enqueueGateIfComplete(f.frd)   // resume / drained bug-fix: an all-IN_REVIEW FRD goes straight to the gate
  // BL-0171: if excluding the DRAFT WO(s) above left NOTHING pending for this FRD (its only non-VERIFIED
  // work WAS the ungated WO), it would otherwise silently vanish from both the schedule AND the close-out
  // narrative (0 to build, never gate-eligible, never in blockedFrds). Surface it explicitly instead.
  if (draftIds.size && pending.length === 0 && f.workOrders.some((w) => w.status !== 'VERIFIED' && w.status !== 'BLOCKED')) {
    blockFrdInSchedule(f.frd, 'needs-owner')
  }
}
for (const f of plan.frds) enrollFrd(f)
sizeAgentBudget()
detectCycles()   // WS-D/D13: fail LOUD on a dependency cycle up front, before it surfaces late as a generic stall
if ((await preLoopGuarded(() => recoverPendingReverts())) === PAUSED) return await pausedExit({ builtFrds, blockedFrds, reopenedFrds, blockedReasons, blockedFailures })   // BL-0215: finish a discard a previous run was cut in the middle of, before any wave

// Block an FRD before its gate: drop its unbuilt WOs from the schedule (built/IN_REVIEW ones stay
// committed — the next run resumes them) and record the reason.
function blockFrdInSchedule(frd, reason, failure = '') {
  const st = frdState.get(frd)
  if (st) { st.failed = true; for (const id of st.toBuildIds) { globalQueue.delete(id); blockedIds.add(id) } }   // WS-A/D3: dropped WOs are now BLOCKED — a dep on them fails closed
  blockFrd(frd, reason, failure)
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
// finder, one sonnet unit, plus its one MECH snippet check, BL-0214) + the review (the split when frdGate would pick
// it) + the release. The drift proof, the evidence re-reads and the snippet-check re-runs are rare and not reserved.
function gateCostEstimate(frd) {
  const st = frdState.get(frd)
  const reviewed = st ? st.f.workOrders.filter((w) => st.reviewIds.includes(w.id)) : []
  const split = P.reviewSplit && (((st && st.gateAttempts) || 0) >= 1 || reviewed.some((w) => (w.reopen_count || 0) >= 1))
  return 1 + (GATE_EVIDENCE === 'digested' ? 1 : 0) + (DRIFT_FINDER ? COST('sonnet') + 1 : 0) + (split ? splitGateEstimatedCost() : COST(P.judge)) + 1
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
    startDriftFinder(frd, reviewIds, pinSha, worktreeWorkFrom(pinSha, slot.path), slot.path)   // BL-0203: beside the collector, in this slot
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
  2) Run \`bash .pandacorp/verify.sh ${since}\`${MECH_FG} — NEVER with \`--only\`/\`--files\` (a scoped run stamps scope:"partial" and certifies nothing). It may exit non-zero; that is data.
  3) ${files.length ? `Run EACH of the reviewer's test files explicitly by path — \`pnpm vitest run "$(git rev-parse --show-toplevel)/<path>"\` (a Playwright spec: \`pnpm playwright test "$(git rev-parse --show-toplevel)/<path>"\`): ${files.join(', ')}.` : 'No reviewer test files to run.'}
  4) Read \`.pandacorp/run/gate-report.json\` and return { green: <true ONLY if that report is green AND every step-3 run passed>, report_scope: <its \`scope\` VERBATIM>, failure: <one sentence naming the first red sub-gate or test>, gateReport: <the report verbatim when it is red> }.`,
      { label: `reverify:${frd}`, phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: REVERIFY_SCHEMA })
  } catch (e) { log(`⚠ D1: the landing re-verify for ${frd} threw (${(e && e.message) || e}) — treated as RED (fail-closed)`); return null }
}
// Proposal 40 §2 (Re-verify): on the fast lane a gate's PASS lands as a test-only commit (gate-land: the reviewer's tests
// and the bless). Another gate's write-back since this pin changed no production code, so it never forces a re-verify;
// a builder's code commit still does (the count excludes only test surfaces, e2e/ and *-snapshots/ included).
const STALE_PIN_TEST_EXCLUDES = ` ':(exclude,glob)**/*.test.*' ':(exclude,glob)**/*.spec.*' ':(exclude,glob)**/_tests/**' ':(exclude,glob)**/__tests__/**' ':(exclude)e2e'`
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
      r = await agent(`${MCR}D1 stale-pin guard for ${frd} (BL-0186). Execute exactly this command once, from anywhere, and return the integer it prints as \`count\`: \`git -C ${PROJECT_DIR} rev-list --count ${pin}..HEAD -- . ':(exclude).pandacorp' ':(exclude)docs'${FAST ? STALE_PIN_TEST_EXCLUDES : ''}\` — the MAIN-tree commits since the pin ${pin} that touched CODE (anything outside .pandacorp/ and docs/). Change nothing. If the command fails, return { count: -1, failure: "<its error>" }.`,
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
  if (!(landingInFlight || mainWriter) || concurrentGates !== true || !gateQueue.length || !freeSlot()) return
  try { launchParallelGates(false, true) } catch (e) { log(`⚠ D1: mid-landing slot refill failed (${(e && e.message) || e}) — the loop refills after the landing`) }
}
async function topUpBeforeLanding(idx = 0) {
  if (concurrentGates !== true || !gateQueue.length || !freeSlot()) return
  const unpinned = gateQueue.filter((x) => { const st = frdState.get(x); return st && !st.pinSha })
  if (unpinned.length) await capturePin(unpinned)   // the pre-landing HEAD: nothing of the coming ladder is on main yet
  landingInFlight = { frd: gateResults[idx].f.frd, spawnedAt: agentSpawned, reserve: landingCostOf(gateResults[idx].gate) }   // reserve the landing's cost BEFORE the refill spends the budget
  try { launchParallelGates() } finally { landingInFlight = null }
}
// Put `frd` back in gateQueue at its PLAN position (frdState's enrolment order), never at the tail, so the gates that
// fall to main still run upstream first.
function requeueGateInPlanOrder(frd) {
  const order = [...frdState.keys()]
  const at = order.indexOf(frd)
  const i = gateQueue.findIndex((x) => order.indexOf(x) > at)
  if (i < 0) gateQueue.push(frd)
  else gateQueue.splice(i, 0, frd)
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
      // Bench FM-2: under the fast lane a gate on main here is awaited INLINE in the lane — no builder runs meanwhile
      // (18 min on the medium bench). Re-queue it in plan order instead: a live slot takes it, or, once every slot
      // failed, fastLaneStep gates it on main only when nothing is left to build. Bounded: each such failure drops a slot.
      if (FAST && !final) {
        requeueGateInPlanOrder(f.frd)
        log(`↻ D1: ${f.frd}'s gate slot could not be prepared — re-queued in plan order (${liveSlots().length ? `${liveSlots().length} live slot(s) left` : 'no live slot: it gates on main once nothing is left to build'}); the builders keep running`)
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
      // Proposal 40: the gate's own tests and its new-route bless land as ONE scripted commit (gate-land); the apply agent
      // then only stamps. A landing that cannot run (no manifest, a conflict, an unverifiable line) keeps the agent port.
      const landed = FAST && MECH_SCRIPT ? await landGateEvidence(f.frd, ev, pin) : false
      const ok = await applyGate(f.frd, reviewIds, landed ? [] : ev.tests.map((x) => x.path), ev.dir)
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
// Proposal 40 §2 (Close-out engine fixes): the PASS lands what its gate wrote in the slot — the reviewer's tests, the NEW
// baselines it blessed, the routes.ts flip and the fdd.md provenance — as one scripted commit naming the gate and its pin
// (DR-080). True only when the sealed receipt says it landed (or that everything was already on main).
async function landGateEvidence(frd, ev, pin) {
  agentSpawned++
  const r = await runMechOp('gate-land', `--dir ${shellQuote(ev.dir)} --frd ${shellQuote(frd)}${pin ? ` --pin ${shellQuote(pin)}` : ''}`, { label: `gate-land:${frd}`, phase: 'Review' })
  const b = r.body
  // A reviewer test whose diff no longer applies on main is NOT on main: stamping VERIFIED would drop DR-080 evidence.
  const lost = ((b && b.unapplied) || []).filter((u) => ev.tests.some((x) => x.path === (u && u.path)))
  if (b && b.ok === true && !lost.length && ['landed', 'nothing'].includes(b.status)) {
    log(`▹ ${frd}: gate files landed (${b.status}) ${JSON.stringify([b.landed, b.unapplied, b.refused]).slice(0, 300)}`)
    return true
  }
  log(`⚠ ${frd}: gate landing did not land (${lost.length ? `${lost.length} reviewer test(s) unapplied` : r.error || (b && b.status)}) — the apply step ports`)
  return false
}
// Remove the reviewer's ported test copies that are still UNTRACKED on main and byte-identical to the salvaged
// originals (sha256) — nothing tracked, nothing edited since, never anything else. MECH, zero judgment.
const UNPORT_SCHEMA = { type: 'object', properties: { removed: { type: 'array', items: { type: 'string' } }, kept: { type: 'array', items: { type: 'string' } } } }
async function unportReviewerTests(frd, ev) {
  if (!ev || !ev.tests.length) return
  agentSpawned++
  let r = null
  try {
    r = await agent(`${MCR}D1 lane cleanup for ${frd} (BL-0186). This landing did NOT certify ${frd}, so the reviewer's test copies ported onto the MAIN tree must not stay behind as untracked files (the next landing's \`verify.sh --since\` would run them). The originals stay in ${ev.dir}. First run \`${REPO_TOP_ASSIGN}\` (the repository root) in the same Bash call as the checks below. ${REPO_ROOT_PATHS_NOTE} For EACH entry of EXPECTED: if \`"$TOP"/'<path>'\` exists AND \`git -C "$TOP" --literal-pathspecs ls-files --error-unmatch -- '<path>'\` FAILS (it is untracked) AND \`shasum -a 256 "$TOP"/'<path>'\` equals its sha256, run \`git -C "$TOP" --literal-pathspecs clean -f -- '<path>'\` and add the path to \`removed\`; otherwise touch nothing and add it to \`kept\` (tracked, edited, or already gone). Never a blanket clean, stage nothing, commit nothing. EXPECTED (JSON): ${JSON.stringify(ev.tests)}. Return { removed, kept }.`,
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
// ── Proposal 39 stage 3: THE FAST LANE (C3 floor, C4 S0 solo FRD builder, C6 USABLE + review, §11) ───────────────────
// One FRD per loop iteration, in dependency order, on main (§11: no worktree lanes, no landing train). Per FRD: ONE
// committed IN_PROGRESS dispatch stamp; ONE worker-tier builder holding every work order's brief inline (LESSON-0147) that
// commits each work order itself through the literal commit-wo command (or parks it) — a difficulty:high work order gets
// its own opus builder in sequence; the engine trusts only sealed receipts. Then ONE scripted verify on the clean landed
// tree: green and not floor = USABLE (build_usable: track.jsonl + dashboard + the push hint); red = one sonnet fix-forward,
// then the classic bounded repair. The FRD's unchanged opus gate then runs in a parallel slot (DR-118) while the next FRD
// builds. A floor FRD (C3) is USABLE only when VERIFIED, and a dependent of a floor FRD waits for that VERIFIED. After
// USABLE the ladder is fix-forward only: a discard becomes needs-owner (holdUsableDiscard), nothing is reverted.
// USABLE is this run's build_usable events plus the earlier runs' (priorUsable, derived by the precheck from the committed
// track.jsonl lines): a defer, a paused-infra halt or an unlanded gate never re-opens the auto-discard in the next run.
// ── Proposal 40 Phase A: THE EVENT LOOP (§3, K = 1, no worktrees) ─────────────────────────────────────────────────────
// The main tree has ONE writer at a time: the main-writer mutex. Its holder is either a BUILD (dispatch → the FRD builder,
// whose commit-wo / park-wo calls run inside it → the engine's own commit-wo (fastRecommit) → the scripted USABLE verify →
// the fix-forward / repair) or a LANDING (the stale-pin guard and its re-verify → gate-land → apply-gate, or the patch
// ladder). Both run verify.sh, write work-order files or stage `docs/frds` on the SAME tree, so they must never overlap:
// a landing's re-verify over a builder's half-written work order is a false reopen, and its `git add -u -- docs/frds` would
// sweep that builder's Status Note into the apply commit. The scripts keep taking main-writer.lock per op (the file lock);
// this is the engine-side holder of that tree across a whole build or landing.
// The scheduler loop starts a holder, then races it against the gates in flight (Promise.race): every gate settle wakes
// it, and a slot freed while the holder runs is refilled at once (laneTopUp, also called at every agent boundary) — bench
// FM-3's FRD-03 gate waited 23 min for a slot that had been free since mid-build. Gates never touch main (pinned slots).
// ORDER: a ready build is started before a settled verdict lands (FM-3: an apply delayed a dispatch by 2.8 min). Builds
// are on the done path; a VERIFIED stamp is not (its dependents that need it, floor FRDs, are not ready, so it lands
// then). Phase B extends the same loop to K lanes in worktrees.
function holdMain(who, fn) {
  if (mainWriter) throw new Error(`main held by ${mainWriter.who}: ${who}`)
  const h = mainWriter = { who, done: false }
  h.p = fn().then((r) => { h.r = r }, (e) => { h.e = e }).then(() => { h.done = true })
}
const usableOf = (frd) => fastUsable.find((u) => u.frd === frd) || priorUsable.find((u) => u.frd === frd) || null
// Proposal 40 Phase B: a lane-landed FRD is never auto-discarded either — other chains may already sit on top of it.
const isUsable = (frd) => Boolean(usableOf(frd)) || lane.landed.has(frd)   // both lanes: fastUsable is fast-only, priorUsable comes from any mechScript precheck
const fastIsFloor = (frd) => fastFloor.has(frd) || !fastClassified.has(frd)
// Proposal 40 §9: the serial opus gate runs at high off the floor; xhigh on the floor, on injection-style content landed
// by the FRD (the verify op's scan with the security delta's content triggers), and whenever that scan is unknown.
const fastGateEffort = (frd) => fastIsFloor(frd) || (frdState.get(frd) || {}).injection !== false ? 'xhigh' : 'high'
const FAST_BUILD_SCHEMA = { type: 'object', required: ['wos'], properties: { wos: { type: 'array', items: { type: 'object', required: ['id', 'line'], properties: { id: { type: 'string' }, line: { type: 'string', description: "the LAST line this work order's final commit or park command printed, copied character for character" } } } } } }
const SEC_AUDIT_SCHEMA = { type: 'object', required: ['done'], properties: { done: { type: 'boolean' }, failure: { type: 'string' }, findings: { type: 'array', items: { type: 'object' } } } }
// C3 for an FRD the scripted plan did not classify (plan-agent fallback, a drained change): one op, fail-closed to floor.
async function fastClassify(frds) {
  agentSpawned++
  const c = await runMechOp('classify-frd', frds.map((f) => `--frd ${shellQuote(f)}`).join(' '), { label: `floor:${frds.join('+')}`, phase: 'Plan' })
  const rows = c.body && c.body.ok === true && Array.isArray(c.body.frds) ? c.body.frds : []
  for (const frd of frds) { const row = rows.find((x) => x && x.frd === frd); if (!row || row.floor !== false) fastFloor.add(frd); fastClassified.add(frd) }
  if (!rows.length) log(`⚠ floor classification unreadable (${c.error || 'no rows'}) — ${frds.join(', ')} treated as floor (fail-closed, C3)`)
}
const fastWaitLog = new Map()
// Why `frd` cannot build yet, or null. A non-floor upstream is satisfied once it landed (built, not failed); a floor one
// only when VERIFIED this run. An upstream outside the schedule is VERIFIED already (the plan omits it).
function fastUpstreamWait(frd) {
  const woOwner = new Map()
  for (const [k, x] of frdState) for (const w of x.f.workOrders) woOwner.set(w.id, k)
  for (const u of frdDirectUpstream(frd, woOwner)) {
    if (blockedFrds.includes(u)) return { blocked: u }
    const x = frdState.get(u)
    if (!x) continue
    if (x.failed) return { wait: u, why: 'it did not land this run' }
    if (x.toBuildIds.size > 0) return { wait: u, why: 'not built yet' }
    if (fastIsFloor(u) && !builtFrds.includes(u)) return { wait: u, why: 'floor: a dependent waits for its VERIFIED (C3)' }
  }
  return null
}
function pickFastFrd() {
  for (const [frd, st] of frdState) {
    if (st.failed || st.toBuildIds.size === 0) continue
    const w = fastUpstreamWait(frd)
    if (!w) return frd
    if (w.blocked) { log(`⊘ ${frd} skipped (depends on the blocked ${w.blocked})`); blockFrdInSchedule(frd, 'needs-owner'); continue }
    if (fastWaitLog.get(frd) !== w.wait) { fastWaitLog.set(frd, w.wait); log(`⏸ ${frd} waits for ${w.wait} (${w.why})`) }
  }
  return null
}
// One loop iteration: build the next ready FRD, else wait for ONE gate to settle (its verdict lands at the loop top), else
// gate what is queued, else defer what can only build after an FRD that will not verify this run.
async function fastLaneStep() {
  const frd = pickFastFrd()
  if (frd) { holdMain(`build:${frd}`, () => fastBuildFrd(frd)); return null }
  return await fastIdle()
}
async function fastIdle() {
  if (gatesInFlight.size || gateResults.length || convergeQueue.length) {
    if (!PARALLEL_GATES) await settleGates(false)
    else if (gatesInFlight.size && nextLandingIndex() < 0) await Promise.race([...gatesInFlight.values()])
    return null
  }
  if (gateQueue.length) {
    if (PARALLEL_GATES && concurrentGates !== false && launchParallelGates(true) && gatesInFlight.size) return null
    const g = gateQueue.shift()
    const st = frdState.get(g)
    await gateAndConverge(st.f, st.reviewIds)
    return null
  }
  // Bench FM-8: work held by a chain the script lists in flight that this engine never owned (a lost dispatch it could not
  // re-adopt) is a LOUD stop naming the chain, never a silent deferral: its lane may hold commits nothing will land.
  for (const c of lane.inFlight) {
    const ids = new Set(c.wos.map((w) => String(w).toLowerCase()))
    for (const [f, st] of lane.owned.has(c.chain) ? [] : frdState) {
      if (st.failed || ![...st.toBuildIds].some((id) => ids.has(id.toLowerCase()))) continue
      log(`⛔ ${f}: its work is held by lane chain ${c.chain} (lane ${c.lane}), in flight for the script but never owned by this run — a stop for the owner, not a deferral`)
      blockFrdInSchedule(f, 'needs-owner', `held by the orphaned lane chain ${c.chain} (lane ${c.lane}): inspect .pandacorp/run/lanes/state.json, land or park it, then relaunch`)
      stopReason = 'orphan-chain'
    }
  }
  for (const [f, st] of frdState) {
    if (st.failed || st.toBuildIds.size === 0) continue
    log(`↩ ${f}: deferred to the next run — it waits for ${fastWaitLog.get(f) || 'an upstream'}, which will not be VERIFIED this run`)
    for (const id of st.toBuildIds) globalQueue.delete(id)
    st.failed = true
    reopenedFrds.push(f)
  }
  return null
}
const fastMarkLanded = (frd, ids) => { const st = frdState.get(frd); for (const id of ids) { globalQueue.delete(id); doneIds.add(id); if (st) st.toBuildIds.delete(id) } }
// Consecutive worker-tier work orders share ONE builder. A difficulty:high WO stays in it (bench F-1: its own opus builder
// was 4.9 of 16.4 min); opus enters after a red verify (the fix-forward, then the repair). Only a WO that already failed
// once (reopen_count, DR-073's empirical rung) gets its own escalated builder.
function fastSegments(wos) {
  const segs = []
  for (const w of wos) {
    const model = (w.reopen_count || 0) >= 1 ? pickWorkerModel(w) : P.worker
    const last = segs[segs.length - 1]
    if (last && model === P.worker && last.model === P.worker) last.wos.push(w)
    else segs.push({ model, wos: [w] })
  }
  return segs
}
const fastWoBrief = (w, frd, dir) => `### WORK ORDER ${w.id}${w.summary ? ` — ${w.summary}` : ''}
  owns: ${w.artifacts && w.artifacts.length ? w.artifacts.join(', ') : '(nothing declared: add one --file <path> per file you changed, only files this work order needs)'}; depends on: ${(w.deps || []).join(', ') || 'none'}.${woCtx(w, frd)}
  commit: \`${mechOpCommand('commit-wo', commitWoFlags(w), dir)}\`
  park: \`${mechOpCommand('park-wo', parkWoFlags(w), dir)}\``
// Proposal 40 §2 (Self-verify): commit-wo already runs each work order's related unit tests, and the engine's scripted
// verify runs the FULL suite once before USABLE. Bench FM-3's builder ran the whole verify.sh 14 times (8.2 min) and the
// scripted verify ran it again: the builder's own check is now `--since` the FRD's dispatch base (the tests the FRD
// changed + the global static checks), once, not per work order. With no known base it runs the full suite once.
const fastSelfVerify = (since) => `run \`bash .pandacorp/verify.sh${since ? ` --since ${since}` : ''}\` ONCE, never after each work order (its commit already ran its related tests)${since ? '; the engine runs the FULL suite once before USABLE' : ''}`
// Proposal 40 §2 (Builder trap checklist): the defects the gate caught before (benches F-1..3, Mission Control), so the
// builder gets them right instead of the gate catching them after USABLE.
const FAST_TRAPS = 'KNOWN TRAPS (past gate catches; get them right the first time): a state update from the previous value uses the functional form (no stale closure); a length limit counts what the spec counts (`[...s].length` code points vs `s.length` UTF-16 units); compare ISO timestamps with `Date.parse`, never as strings; no interactive element inside another (a button in a link or a button); a dialog traps focus, closes on Escape and returns focus to its trigger; `cn()` (tailwind-merge) drops a class it reads as conflicting, so check the classes really render; numeric bounds hold at both ends, including 5+-digit years.'
// A lane builder (proposal 40 Phase B) gets the same prompt, pointed at its lane worktree: `ln` is the lane-next chain.
const fastBuilderPrompt = (frd, wos, retry, since = null, ln = null) => `${EMIT('implementer', frd, { frd, activity: retry ? 'retry' : 'implement' })}FAST-LANE BUILDER (proposal 39 C4) for FRD ${frd}.${retry ? ' RETRY: these work orders did not land on the first attempt; find out why before you rebuild them.' : ''} Build its work orders below IN THIS ORDER, one at a time, each with TDD (RED → GREEN → refactor) against its EARS criteria. A work order's boundary is the files it owns: another work order's files and the .pandacorp state are not yours.
${wos.map((w) => fastWoBrief(w, frd, ln ? ln.path : PROJECT_DIR)).join('\n')}
${FAST_TRAPS}
HOW TO RUN each work order, in order:
 1) Append its start line: printf '{"kind":"wo_start","frd":"${frd}","wo":"<id>","at":"%s"}\\n' "$(date -u +%FT%TZ)" >> ${ln ? '.pandacorp/track.jsonl' : TRACK_PATH}. If .pandacorp/run/preserved-tests/<id>/ exists, restore those tests first (your RED baseline, DR-107). Read the ## Status Note of the work orders it depends on and build against those interfaces.
 2) Implement it until its own tests pass. Fill its ## Status Note: what it built, the interfaces with signatures, the seams, the decisions and assumptions a consumer inherits, its test files. Never edit implementation_status and never call git yourself: the commit command stamps IN_REVIEW and commits.
 3) Run its commit command exactly as given and read the LAST line it prints (one JSON object). "ok":true → the next work order. A refusal says why: "undeclared" → the tree held no owner edit at dispatch (the engine never builds over one), so an undeclared path is a stray edit of this build: undo it, or re-run adding --extra '<path>' --reason '<why this work order needs it>'; "parked-leftover" → that path is a parked work order's leftover, never this one's, whether it came in through --files or --extra: run the park command of the work order it names (it salvages the leftover), then re-run; "tests-red" or an uncited AC → fix it (cite each AC id in a test) and re-run.
 4) If it still does not commit after honest attempts, run its park command and go on; a work order that depends on a parked one is parked too (run its park command, do not build it).
 5) SELF-VERIFY, once every work order committed (none parked): ${fastSelfVerify(since)}${ln ? ' (static checks, the unit tests and this lane\'s own e2e on its port)' : ''}. If it is red, fix the PRODUCTION code it names here, in this same context (never weaken, skip or delete a test, never edit a blessed baseline), and commit each fix with \`${mechOpCommand('commit-wo', '--fixup <the-wo-id> --file <each path you changed>', ln ? ln.path : PROJECT_DIR)}\`, naming the work order whose code you fixed; re-run until green or after two honest attempts. Leave the tree clean: the engine's own verify runs next.${ln && laneSchemaBarrier() ? LANE_BARRIER_NOTE : ''}${designRef(frd)}${reuseRef(frd)}
Return { wos: [{ id, line }] }: one entry per work order above, line = the LAST line its final commit or park command printed, copied character for character.`
// The engine trusts only a sealed commit-wo (or park-wo) receipt naming the work order; anything else did not land.
function fastLanded(wos, wrappedAnswer) {
  const answer = unwrapAnswer(wrappedAnswer, 'wos')
  const rows = answer && Array.isArray(answer.wos) ? answer.wos : []
  const out = { committed: [], parked: [], unproven: [] }
  for (const w of wos) {
    const row = rows.find((x) => x && String(x.id).toLowerCase() === w.id.toLowerCase())
    const c = row ? parseMechLine(row, 'commit-wo') : { body: null, error: 'no receipt' }
    if (c.body && c.body.ok === true && ['committed', 'nothing'].includes(c.body.status) && String(c.body.wo || '').toLowerCase() === w.id.toLowerCase()) { out.committed.push(w); continue }
    const p = row ? parseMechLine(row, 'park-wo') : { body: null }
    if (p.body && p.body.ok === true) { out.parked.push(w); continue }
    log(`⚠ ${w.id}: no valid sealed commit-wo/park-wo receipt from its builder (${c.error || (c.body && `${c.body.status}: ${c.body.reason || ''}`)}) — unverified, treated as not landed`)
    out.unproven.push(w)
  }
  return out
}
// `ln` (proposal 40 Phase B): the lane chain this builder works in. Its WOs are committed on the lane branch, NOT landed:
// they are marked landed only by land-chain.
async function fastBuilder(frd, wos, model, retry = false, since = null, ln = null) {
  agentSpawned += COST(model)
  const label = ln ? `lane-build:${ln.chain}` : retry ? `fast-retry:${frd}` : model !== P.worker ? `fast-build:${frd}:${wos[0].id}` : `fast-build:${frd}`
  const out = fastLanded(wos, await agent(fastBuilderPrompt(frd, wos, retry, since, ln), { label, phase: 'Build', model, effort: model === 'opus' ? 'high' : undefined, agentType: 'pandacorp:implementer', schema: FAST_BUILD_SCHEMA, ...(ln ? { workFrom: laneWorkFrom(ln) } : {}) }))
  const dir = ln ? ln.path : PROJECT_DIR
  const recommitted = out.unproven.length ? await fastRecommit(out.unproven, dir) : []
  const unproven = out.unproven.filter((w) => !recommitted.includes(w))
  if (!ln) fastMarkLanded(frd, [...out.committed, ...recommitted].map((w) => w.id))
  if (unproven.length) await parkWorkOrders(unproven, dir)   // their files must never leak into the next commit
  return [...out.parked, ...unproven]
}
// Proposal 40 §2 (Fix-forward retry): a work order with no valid receipt was usually committed or left green (bench F-3:
// the builder committed WO-01-002, the relayed line failed its seal, and an opus rebuild redid it). The literal commit-wo
// decides, mechanically: already committed with a clean tree → `nothing`; built with green related tests → committed;
// anything else (red tests, undeclared paths) refuses, and the work order is parked and rebuilt as before.
async function fastRecommit(wos, dir = PROJECT_DIR) {
  const landed = []
  for (const w of wos) {
    agentSpawned++
    const b = (await runMechOp('commit-wo', commitWoFlags(w), { label: `recommit:${w.id}`, dir })).body
    const ok = b && b.ok === true && ['committed', 'nothing'].includes(b.status) && String(b.wo).toLowerCase() === w.id.toLowerCase()
    if (ok) landed.push(w)
    log(`◦ ${w.id}: ${ok ? 'commit-wo landed it' : 'not landed'} (${b && b.status})`)
  }
  return landed
}
// The classic bounded repair (attemptRepair, then the BL-0212 discard of what it blocked) — the FRD is not USABLE yet.
async function fastRepairOrBlock(frd, context) {
  const st = frdState.get(frd)
  const liveIds = st.f.workOrders.filter((w) => w.status !== 'VERIFIED' && w.status !== 'BLOCKED').map((w) => w.id)
  await recordRepairDiscardIntent(frd, liveIds)
  const fix = await attemptRepair(frd, `fast lane: ${context}`)
  if (fix && fix.green === true) { log(`✓ ${frd}: repaired`); return true }
  const reason = (await discardBlockedCode(frd, liveIds)) ? ((fix && fix.blocked_reason) || 'error') : 'needs-owner'
  log(`⊘ ${frd}: could not repair (${reason}) — BLOCKED, continuing with independent FRDs`)
  blockFrdInSchedule(frd, reason)
  return false
}
// The scripted USABLE check. Three outcomes: `refused` (it certified nothing either way: a dirty tree, an uncommitted WO,
// a busy lock, an input error or an unverifiable receipt — never a red verify.sh, so never the fix-forward or the repair
// ladder), red, or green. USABLE has ONE writer (DR-115): the script's committed build_usable line, so `usable` is its
// receipt's, and the engine's own fail-closed floor verdict is passed to it (--floor) so it can never commit that line.
async function fastVerify(frd, since, ids) {
  agentSpawned++
  return fastVerdict(frd, await runMechOp('verify', `--frd ${shellQuote(frd)}${since ? ` --since ${shellQuote(since)}` : ''}${ids.map((id) => ` --wo ${shellQuote(id)}`).join('')}${fastIsFloor(frd) ? ' --floor' : ''}`, { label: `verify:${frd}` }))
}
// The verdict of a `verify` or `lane-usable` receipt (the same shape; lane-usable adds the red class and its bisect candidates).
function fastVerdict(frd, r) {
  const b = r.body
  if (!b || b.ok !== true) return { refused: true, green: false, usable: false, failure: r.error || (b && `${b.status}: ${b.reason || b.error || ''}`) || 'no verify receipt' }
  if (b.floor === true) fastFloor.add(frd)
  const st = frdState.get(frd)
  if (st && st.injection !== true && Array.isArray(b.injection)) st.injection = b.injection.length > 0
  if (b.injection && b.injection.length) log(`◦ ${frd}: injection-style content (${b.injection.map((h) => h.detail).join('; ').slice(0, 200)}): its gate stays xhigh`)
  const green = b.green === true && b.scope !== 'partial'
  // Bench FM-7: `usable-preexisting` is USABLE on a red tree whose only failures are other FRDs' and pre-date its chains
  // (proved by lane-bisect --frd); `flaky-contention` is a red the timeout re-run proved was the host's, not the code's.
  const pre = b.status === 'usable-preexisting'
  return { refused: false, green, usable: (green || pre) && b.usable === true, pre, flaky: b.status === 'flaky-contention', foreign: b.foreign === true, sha: b.sha || null, failure: b.failure || b.usableFailure || '', cls: b.class || null, candidates: Array.isArray(b.candidates) ? b.candidates : [] }
}
// A refusal is retried once (a journal line or the lock held by a concurrent writer is transient); a second refusal
// stops there: the FRD is not USABLE and its gate decides.
async function fastVerifyOrRetry(frd, since, ids) {
  const v = await fastVerify(frd, since, ids)
  if (!v.refused) return v
  log(`⚠ ${frd}: verify was refused (${v.failure}) — it certified nothing either way; retrying once`)
  return await fastVerify(frd, since, ids)
}
const fastFixPrompt = (frd, ids, failure) => `${EMIT('implementer', frd, { frd, phase: 'review', activity: 'repair' })}FAST-LANE FIX-FORWARD (proposal 39 C6, rung 1) for ${frd}: its work orders (${ids.join(', ')}) are committed, but \`bash .pandacorp/verify.sh\` is RED on the clean landed tree: ${failure || '(see .pandacorp/run/gate-report.json)'}. Fix the PRODUCTION code (never weaken, skip or delete a test) until \`bash .pandacorp/verify.sh\` is green. Commit every fix with exactly \`${mechOpCommand('commit-wo', '--fixup <the-wo-id> --file <each path you changed>')}\`, naming the work order whose code you fixed; never call git yourself and never edit implementation_status. Return { done: true } once verify.sh is green and the project tree is clean, else { done: false, failure }.`
async function fastBuildFrd(frd) {
  const st = frdState.get(frd)
  phase('Build')
  if (!fastClassified.has(frd)) await fastClassify([frd])
  const wos = st.f.workOrders.filter((w) => st.toBuildIds.has(w.id))
  const ids = wos.map((w) => w.id)
  log(`⚒ fast lane: ${frd} — ${wos.length} work order(s), one builder per worker-tier run (C4): ${ids.join(', ')}`)
  const since = await fastDispatch(frd, ids)
  try {
    const missed = await fastBuildWos(frd, wos, since)
    if (missed.length) {
      if (!(await fastRepairOrBlock(frd, `work order(s) ${missed.map((w) => w.id).join(', ')} could not be built and committed`))) return null
      fastMarkLanded(frd, ids)
    }
    let v = await fastVerifyOrRetry(frd, since, ids)
    if (!v.refused && !v.green && !capHit() && canAffordRepair(frd, 'sonnet')) {
      log(`! ${frd}: verify.sh red on the clean landed tree (${v.failure}) — fix-forward (sonnet)`)
      agentSpawned += COST('sonnet')
      await chargedRepair(frd, 'sonnet', () => agent(fastFixPrompt(frd, ids, v.failure), { label: `fix:${frd}`, phase: 'Build', model: 'sonnet', effort: 'medium', agentType: 'pandacorp:implementer', schema: STOP_SCHEMA }))
      v = await fastVerifyOrRetry(frd, since, ids)
    }
    if (!v.refused && !v.green) {
      if (!(await fastRepairOrBlock(frd, `verify.sh is red on the clean landed tree after the fix-forward: ${v.failure}`))) return null
      v = await fastVerifyOrRetry(frd, since, ids)
    }
    await fastCertified(frd, v)
    return null
  } catch (e) {
    if (!isInfraError(e)) throw e
    await parkWorkOrders(wos.filter((w) => !doneIds.has(w.id)))
    return 'paused'
  }
}
// The committed IN_PROGRESS stamp of the WOs about to build on main; returns the landed range's base. When that receipt
// is lost (bench FM-1: the relay altered its checksum) verify runs without --since and derives the base itself from the
// committed dispatch stamp (then the dispatch snapshot); it falls back to floor only when the range is unknowable.
async function fastDispatch(frd, ids) {
  const pre = fusedDispatch && fusedDispatch.frd === frd && JSON.stringify([...fusedDispatch.wos].sort()) === JSON.stringify([...ids].sort()) ? fusedDispatch : null
  fusedDispatch = null
  if (!pre) agentSpawned++
  const prefix = pendingSyncRollups || ''
  pendingSyncRollups = null
  const d = pre ? { body: pre } : await runMechOp('dispatch', `${ids.map((id) => `--wo ${shellQuote(id)}`).join(' ')} --commit`, { label: `dispatch:${frd}`, prefix })
  if (!d.body || d.body.ok !== true) log(`⚠ ${frd}: dispatch stamp not confirmed (${d.error || (d.body && (d.body.reason || d.body.error))}) — building anyway; verify derives the landed range from the dispatch history`)
  return (d.body && d.body.ok === true && d.body.base) || null
}
// One worker-tier builder per run of segments (C4), then ONE opus rebuild of what did not land (DR-073). Returns the
// work orders still not committed on main.
async function fastBuildWos(frd, wos, since) {
  let missed = []
  for (const seg of fastSegments(wos)) {
    const waiting = seg.wos.filter((w) => (w.deps || []).some((dep) => missed.some((m) => m.id === dep)))
    missed.push(...waiting)
    const todo = seg.wos.filter((w) => !waiting.includes(w))
    if (!todo.length) continue
    buildCostByFrd.set(frd, (buildCostByFrd.get(frd) || 0) + COST(seg.model))   // WP-08/D4b: the repair budget's denominator
    missed.push(...(await fastBuilder(frd, todo, seg.model, false, since)))
  }
  if (missed.length && !capHit() && canAffordRepair(frd, 'opus')) {
    const again = wos.filter((w) => missed.includes(w))
    log(`↻ ${frd}: ${again.map((w) => w.id).join(', ')} did not land — one opus rebuild (DR-073 escalation)`)
    missed = await chargedRepair(frd, 'opus', () => fastBuilder(frd, again, 'opus', true, since))
  }
  return missed
}
// The USABLE verdict's consequences (C6): USABLE when green, committed and not floor; a non-USABLE FRD's dependents wait
// for its VERIFIED, like a floor's; the gate is queued, pinned at the verified SHA.
async function fastCertified(frd, v) {
  const st = frdState.get(frd)
  if (v.usable && !fastIsFloor(frd)) {
    fastUsable.push({ frd, sha: v.sha })
    log(`✅ USABLE: ${frd} @ ${v.sha} — committed, ${v.pre ? 'verify.sh red only on other FRDs\' pre-existing failures (bench FM-7)' : 'verify.sh green on the clean landed SHA'} (proposal 39 C6); its gate runs now, fix-forward only from here`)
  } else if (v.refused) log(`⚠ ${frd}: verify refused again (${v.failure}) — not USABLE; nothing is repaired or discarded, its gate decides`)
  else if (v.green && fastIsFloor(frd)) log(`◦ ${frd}: floor (C3) — green on ${v.sha}, USABLE only when VERIFIED; its gate runs now`)
  else if (v.green) log(`⚠ ${frd}: green on ${v.sha} but not USABLE (${v.failure || 'no committed build_usable line'}) — its gate decides`)
  else log(`⚠ ${frd}: built but verify.sh is not green on the clean tree (${v.failure}) — not USABLE; its gate decides`)
  if (!fastIsFloor(frd) && !v.usable) fastFloor.add(frd)   // not USABLE: its dependents wait for its VERIFIED, like a floor's
  if (enqueueGateIfComplete(frd)) {
    if (v.sha) st.pinSha = v.sha
    else await capturePin([frd])
    launchEvidence(frd)
    startEarlySecurity(st.pinSha)
  }
}
// C6: the security audit starts with the first gate, read-only over that pin's commit (a build still writes the tree).
function startEarlySecurity(pin) {
  if (!FAST || REVIEW_DEFERRED || earlySecurity || !pin) return
  agentSpawned += COST(P.judge)
  log(`▹ security audit started alongside the first gate, at ${pin} (proposal 39 C6); the close-out audits only the delta since`)
  earlySecurity = { pin, promise: agent(`DR-085 HARDENING 1a — the EARLY security audit (proposal 39 C6), alongside the first FRD gate. You are READ-ONLY. A build is still writing the working tree, so audit the COMMIT ${pin}, never the working tree: list it with \`git -C ${PROJECT_DIR} ls-tree -r --name-only ${pin} -- .\`, read a file with \`git -C ${PROJECT_DIR} show ${pin}:<repo-relative path>\`, search with \`git -C ${PROJECT_DIR} grep -n <pattern> ${pin} -- .\`. Checklist: OWASP Top-10 for this stack, secrets in code/config/history, security headers + CSP, auth/authz on every mutating route, dependency risk (ASI01–ASI10 too if there is an agentic/LLM component). Write the report (each finding: severity, file:line, remediation) to ${PROJECT_DIR}/.pandacorp/run/security-early/${pin}.md (gitignored; commit nothing). Return { done: true, findings }: the Critical/High items as { severity, summary }, [] when none.`,
    { label: 'hardening:security-audit-early', phase: 'Review', model: P.judge, effort: 'high', agentType: 'pandacorp:security-auditor', schema: SEC_AUDIT_SCHEMA }).catch(() => null) }
}
// The close-out half: the delta since the early audit's pin, fail-closed to the classic full audit.
async function securityDeltaAudit(fullAudit) {
  const early = await earlySecurity.promise
  if (!(early && early.done === true && Array.isArray(early.findings))) { log('⚠ the early security audit gave no usable verdict — running the full audit (fail-closed, C6)'); return await fullAudit() }
  const pin = earlySecurity.pin
  // Proposal 40 §2 (Security delta, conditional): the delta audit runs only when the landed diff since the pin touches an
  // attack surface (the deterministic path + content triggers next to the product floor). Otherwise the script commits
  // the early audit as the build's report. Any other answer (triggered, refused, unverifiable) runs the audit: fail-closed.
  agentSpawned++
  const scope = await runMechOp('security-scope', `--since ${shellQuote(pin)} --write-report --findings ${early.findings.length}`, { label: 'security-scope', phase: 'Hardening' })
  const sb = scope.body
  if (sb && sb.ok === true && sb.status === 'written' && sb.triggered === false) { log(`⊘ security delta not triggered since ${pin}: the early audit is the report`); return { done: true, findings: early.findings } }
  log(`▹ security delta audit runs: ${JSON.stringify((sb && sb.hits) || scope.error || (sb && sb.status)).slice(0, 200)}`)
  return await agent(`DR-085 HARDENING 1a/3 — the security DELTA audit (proposal 39 C6, fail-closed). A read-only audit of commit ${pin} ran alongside the first gate: its report is ${PROJECT_DIR}/.pandacorp/run/security-early/${pin}.md, its open Critical/High items: ${JSON.stringify(early.findings).slice(0, 1500)}. You are READ-ONLY on code. Audit EVERY source change since that commit (\`git -C ${PROJECT_DIR} diff ${pin}..HEAD -- . ':(exclude).pandacorp' ':(exclude)docs'\`) with the same checklist (OWASP Top-10, secrets, headers + CSP, authz on every mutating route, dependency risk), and re-check that each early item still holds at HEAD. Write docs/reviews/security-<YYYY-MM-DD>.md (the LOCAL date: \`date +%F\`, never \`date -u\`) merging both (each finding: severity, file:line, remediation, early or delta) and commit it (Conventional Commits, e.g. \`docs(security): audit report\`). Return { done: true, findings } ALWAYS once the report exists: findings = the Critical/High items still open at HEAD ([] when none).${HARDENING_EVENT_IF_NO_FINDINGS('security')}`,
    { label: 'hardening:security-delta', phase: 'Hardening', model: P.judge, effort: 'high', agentType: 'pandacorp:security-auditor', schema: SEC_AUDIT_SCHEMA })
}
// C6: after USABLE, a discard is the owner's call, set-wide — the engine records it and reverts nothing.
// The owner-facing record of a USABLE hold (Spanish): the certified sha and the whole dependent set a discard takes with it.
function usableHoldRecord(frd, sha, ids, what) {
  const set = [frd, ...[...frdState.keys()].filter((x) => x !== frd && frdUpstream(x).has(frd))]
  return `${frd} ${sha ? `ya era USABLE (en main, verify.sh verde en ${sha}) y su gate lo rechaza` : 'ya esta en main (aterrizado por un carril, con otro trabajo encima) y no se certifica'}; la escalera quiere descartar ${ids.join(', ')} (${what}). El motor no revierte codigo USABLE solo. Decide: corregirlo encima (fix-forward) o descartarlo; si apruebas el descarte se revierte de una vez todo el conjunto dependiente: ${set.join(', ')}.`
}
async function holdUsableDiscard(frd, ids, what) {
  const sha = (usableOf(frd) || {}).sha
  log(`⛔ ${frd}: ${sha ? `USABLE since ${sha}` : 'landed by a lane'} — ${what} would discard landed code; fix-forward only: BLOCKED needs-owner, nothing reverted (proposal 39 C6)`)
  const record = usableHoldRecord(frd, sha, ids, what)
  agentSpawned++
  await agent(`${EMIT('implementer', frd, { frd, phase: 'review', activity: 'block' })}USABLE CODE IS NEVER AUTO-DISCARDED (proposal 39 C6) for ${frd}: the recovery ladder wants ${what} of ${ids.join(', ')}, but ${frd} ${sha ? `was USABLE (committed, verify.sh green on ${sha})` : 'was landed by a lane (proposal 40)'} and other work may build on it. Do NOT \`git checkout\`/\`restore\`/\`rm\`/\`revert\` any code file.
  1) For EACH of ${ids.join(', ')}: set \`implementation_status: BLOCKED\` + \`blocked_reason: needs-owner\`; ${SYNC_ROLLUPS} Bump pending_decisions through its current owning transition.
  2) Append this owner-facing DECISION RECORD to .pandacorp/inbox/decisions.md (SPANISH): ${record}
  3) COMMIT (Conventional Commits, scope, the subject naming ${frd}) staging ONLY those frontmatter/rollup files, decisions.md and status.yaml.${emitGateOutcome(frd, 'blocked', ',"blocked_reason":"needs-owner"')}${NOTIFY('FRD ' + frd + ' USABLE rechazado por su gate: descartarlo necesita tu decision')}
  Return { green: false, blocked_reason: 'needs-owner' }.`,
    { label: `block-usable:${frd}`, phase: 'Review', model: MECH, agentType: 'pandacorp:implementer', schema: REPAIR_SCHEMA })
}
// C6 defer: a queued gate becomes review debt (derived from the work-order states, never stored — DR-115).
function deferQueuedGates() {
  for (const frd of gateQueue.splice(0)) log(`⏸ ${frd}: gate deferred (reviewBudget defer) — review debt until a later window`)
}
const fastReviewDebt = () => [...frdState].filter(([frd, st]) => !st.failed && st.toBuildIds.size === 0 && !builtFrds.includes(frd) && !blockedFrds.includes(frd)).map(([frd]) => frd)
function fastResult() {
  if (!FAST) return {}
  const usable = fastUsable.map((u) => ({ ...u }))
  const debt = fastReviewDebt()
  const pushHint = usable.length ? `PushNotification: USABLE on main — ${usable.map((u) => `${u.frd} @ ${u.sha}`).join(', ')}${debt.length ? `; review pending for ${debt.join(', ')}` : ''}` : ''
  return { usable, reviewDebt: debt, pushHint, ...(LANED ? { lanes: { k: lane.k, parked: lane.parked, blockedFrds: lane.blocked } } : {}) }
}

// ── Proposal 40 §3 Phase B: LANES (static K ≥ 2) ─────────────────────────────────────────────────────────────────────
// Every lane decision a script can make is a mech op (build-mech-lanes / -lane-land / -lane-next); the engine only
// orchestrates. They are on by default (K = DEFAULT_LANES = 2, DR-125); --lanes 1 turns them off (no lane op at all). Whether the run lanes is decided
// once (decideLanes: the fused start's lane plan, else one lane-plan op, after the first safe point drained every ready
// change card into the schedule: one DAG for bare /implement, --frds and --change alike) on the run's CEILING kRun: the
// requested K capped by mode, 1 when the DAG is narrow throughout or the gain is below the bootstrap. kRun = 1 is exactly
// the sequential build above. K itself is re-decided at EVERY lane-next round (bench FM-5: a run that starts one WO wide
// built strictly sequentially): min(kRun, the ready width now); a narrow round's chain builds on main (no lane, no
// landing), a wide one fills the lanes. At kRun ≥ 2 the pool boots at once, beside the first work, so the first wide
// round never waits for the bootstrap; each `lane-next` round dispatches the barrier (a schema/package chain, or the
// round's chain on main: a main-writer holder, lane landings pause, lane builds go on) and one chain of ≤ 3 WOs per lane.
// A lane builder is the fast-lane builder pointed at its worktree (commit-wo per WO on lane/<chain>, its self-verify with
// the lane's own e2e port), up to LANE_MAX_ATTEMPTS attempts, then the chain parks and only its DAG descendants wait.
// Main holders, one at a time (the Phase A mutex): the barrier, the USABLE fix-forward, `land-chain` (rebase keeping one
// commit per WO, union journals, checks, ff-only), then a settled gate verdict. USABLE is `lane-usable`: one full
// verify.sh per FRD on a pinned SHA in the snapshot worktree, beside the landings; red → bisect (other chains landed
// since the last green pin) → sonnet, then opus fix-forward on main → still red: needs-owner, never a revert. A usage
// limit is the global pause (infraGuard): no attempt counted, nothing parked, the resume re-dispatches from git + the
// lane journal (lane-next --resume). Classic lane unchanged.
const LANE_MAX_ATTEMPTS = 3
const laneBusy = () => Boolean(mainWriter || lane.next || lane.usable || lane.pool || lane.jobs.size || lane.land.length || lane.fixQ.length || lane.usableQ.length || lane.barrier)
const laneMainWork = () => Boolean(lane.barrier || lane.fixQ.length || (lane.land.length && !lane.landHold))
// Bench FM-8: a lane dispatched beside a schema/package barrier has a base without it; knip then flags the dependencies
// the barrier's work orders will use. That red is the base's, never a reason to touch the dependencies.
const laneSchemaBarrier = () => [...lane.live.values()].some((c) => c.onMain === 'schema')
const LANE_BARRIER_NOTE = ' A schema/package barrier is building on main and this lane\'s base predates it: a knip unused-dependency (or unlisted-dependency) red here is EXPECTED; never remove or add a dependency and never edit package.json or the lockfile to clear it (the landing re-checks on main).'
const laneWorkFrom = (ln) => `LANE ${ln.lane} (proposal 40 Phase B): you build chain ${ln.chain} in the lane worktree ${ln.path} on branch lane/${ln.chain}. cd there FIRST and run everything there with its env loaded (\`set -a; . .pandacorp/run/lane.env; set +a\`: PORT ${(ln.env || {}).PORT}; your dev server and e2e use this lane's port only, never main's or a sibling lane's). Never touch ${PROJECT_DIR} (main); never merge, rebase or push: the engine lands the chain.\n`
const laneScope = () => [...[...frdState].filter(([, st]) => !st.failed).map(([f]) => `--frd ${shellQuote(f)}`), ...[...globalQueue.keys()].map((id) => `--build ${shellQuote(id)}`),
  ...[...frdState.keys()].filter((f) => fastIsFloor(f) && !builtFrds.includes(f)).map((f) => `--wait-verified ${shellQuote(f)}`), `--lanes ${LANES_K}`, `--mode ${shellQuote(MODE)}`].join(' ')
const laneIds = (c) => { const st = frdState.get(c.frd); return c.wos.map((id) => ((st && st.f.workOrders.find((w) => w.id.toLowerCase() === String(id).toLowerCase())) || { id }).id) }
async function decideLanes() {
  LANED = false
  if (!FAST || !(LANES_K >= 2) || globalQueue.size < 2) return
  let b = fused && fused.lanes && fused.probe && fused.probe.work !== true ? fused.lanes : null   // drained cards would widen a fused plan
  if (!b) { agentSpawned++; b = (await runMechOp('lane-plan', laneScope(), { label: 'lane-plan', phase: 'Plan' })).body }
  const kRun = b && (Number.isInteger(b.kRun) ? b.kRun : b.k)
  // The planner only sees --lanes K; whether K was the owner's or the default is the engine's to name.
  const why = (r) => (r === 'requested' && !LANES_ARG ? 'default' : r)
  if (!b || b.ok !== true || !(kRun >= 2)) { log(`◦ lanes: K = 1 (${(b && why(b.kRunReason || b.kReason || b.reason || b.status)) || 'no lane plan'}) — one FRD at a time on main, as before (proposal 40 §3 B.7)`); return }
  LANED = true
  lane.k = kRun
  log(`⚒ lanes: K = ${kRun} (${why(b.kRunReason || b.kReason)}, ready width ${b.width} now, offPath ${b.offPath}) — the pool boots now; K is re-decided every round: up to ${kRun} worktree lanes when the DAG is wide, a narrow round on main (proposal 40 §3 Phase B)`)
  agentSpawned++
  lane.pool = runMechOp('lane-pool', `--size ${kRun}`, { label: 'lane-pool' }).then((r) => {
    lane.ready = Boolean(r.body && r.body.ok === true)
    log(lane.ready ? `▹ lane pool ready (${r.body.pool.length} lane(s))` : `⚠ the lane pool did not start (${r.error || (r.body && (r.body.reason || r.body.status))}) — barriers still build on main; the rest falls back to one FRD at a time`)
  }, (e) => { if (!isInfraError(e)) throw e }).finally(() => { lane.pool = null; lane.plan = true })
}
function laneNext() {
  lane.plan = false
  lane.next = (async () => {
    const unc = [...frdState.keys()].filter((f) => !fastClassified.has(f))
    if (unc.length) await fastClassify(unc)
    const resume = lane.ready && !lane.resumed
    const prefix = pendingSyncRollups || ''   // the rollup sync rides the first lane round, as it rides the first dispatch at K = 1
    pendingSyncRollups = null
    agentSpawned++
    const r = await runMechOp('lane-next', `${laneScope()}${resume ? ' --resume' : ''}`, { label: 'lane-next', prefix })
    const b = r.body
    if (!b || b.ok !== true) { lane.plan = ++lane.idle < 2; log(`⚠ lane-next unverifiable (${r.error || (b && (b.reason || b.error || b.status)) || 'no receipt'}) — nothing dispatched this round`); return }
    lane.idle = 0
    if (b.k !== lane.stepK) { lane.stepK = b.k; log(`◦ lanes: this round K = ${b.k} (${b.kReason}, ready width ${b.width})`) }
    if (resume) lane.resumed = true
    lane.broken = (b.pool && b.pool.broken) || 0
    for (const f of b.failed || []) log(`⚠ chain ${f.chain}: not dispatched (${f.status}: ${f.reason})`)
    const known = (id) => lane.jobs.has(id) || lane.land.some((x) => x.chain === id) || (lane.barrier && lane.barrier.chain === id) || Boolean(mainWriter && mainWriter.who.endsWith(`:${id}`))
    const track = (c) => { lane.live.set(c.chain, c); lane.owned.add(c.chain); return true }
    // The barrier first: a lane builder started in this same round must know a schema/package barrier is in flight.
    if (b.barrier && !known(b.barrier.chain) && track(b.barrier)) lane.barrier = b.barrier
    for (const c of b.dispatched || []) if (!known(c.chain) && track(c)) laneStart(c)
    for (const c of b.landQueue || []) if (!known(c.chain) && track(c)) lane.land.push(c)
    for (const c of b.needsFix || []) if (!known(c.chain) && track(c)) laneStart({ ...c, fix: { kind: 'resumed needs-fix' } })
    // Bench FM-8: a live lane chain the engine does not own is one whose dispatch line the relay lost. After the resume
    // round (an earlier run's chains are --resume's), it is re-adopted where it stands: its builder resumes in its lane
    // with what it committed, never re-dispatched or reset. One with no lane path cannot be: it stays unowned (fastIdle).
    lane.inFlight = b.inFlightChains || []
    for (const c of lane.resumed ? lane.inFlight : []) {
      if (c.status !== 'dispatched' || known(c.chain) || lane.live.has(c.chain)) continue
      if (!c.path) { log(`⚠ chain ${c.chain}: in flight in lane ${c.lane} but its lane has no worktree path — it cannot be re-adopted`); continue }
      log(`↺ re-adopting chain ${c.chain} (${c.wos.join(', ')}) in lane ${c.lane}: its dispatch line was lost, the script holds it in flight`)
      track(c)
      laneStart({ ...c, resumed: true, committed: c.committed || [] })
    }
    for (const f of b.landedFrds || []) lane.landed.add(f)
    lane.parked = b.parked || []
    if ((b.blockedFrds || []).join() !== lane.blocked.join()) { lane.blocked = b.blockedFrds || []; if (lane.blocked.length) log(`⊘ lanes: parked ${lane.parked.join(', ')} — only their DAG descendants wait: ${lane.blocked.join(', ')} (proposal 40 §3 B.9)`) }
  })().catch((e) => { if (!isInfraError(e)) throw e }).finally(() => { lane.next = null; lane.landHold = false })
}
function laneStart(c) {
  const job = (c.fix ? laneFix(c) : laneBuild(c)).catch((e) => {
    if (!isInfraError(e)) throw e
    log(`⏸ chain ${c.chain}: paused with the run (${infraHalt ? infraHalt.kind : 'infra'}) — no attempt counted, nothing parked; the resume re-dispatches it (proposal 40 §3 B.8)`)
  }).finally(() => lane.jobs.delete(c.chain))
  lane.jobs.set(c.chain, job)
}
// One chain in its lane: the builder, ONE literal commit-wo for a lost receipt, a park of what still did not commit, then
// an opus rebuild of the rest, up to LANE_MAX_ATTEMPTS attempts; `lane-mark --as built` checks one commit per WO.
async function laneBuild(c) {
  const st = frdState.get(c.frd)
  const own = (id) => st && st.f.workOrders.find((w) => w.id.toLowerCase() === String(id).toLowerCase())
  let todo = c.wos.filter((id) => !(c.committed || []).some((x) => x.toLowerCase() === id.toLowerCase())).map(own)
  if (todo.some((w) => !w)) return lanePark(c, 'a work order outside this run\'s schedule')
  log(`⚒ lane ${c.lane}: chain ${c.chain} (${c.frd}: ${c.wos.join(', ')})${c.resumed ? ` resumed${(c.committed || []).length ? `, ${c.committed.join(', ')} already committed (DR-086)` : ''}` : ''}`)
  for (;;) {
    if (todo.length) {
      const n = (lane.attempts.get(c.chain) || 0) + 1
      if (n > LANE_MAX_ATTEMPTS) return lanePark(c, `${todo.map((w) => w.id).join(', ')} not committed after ${LANE_MAX_ATTEMPTS} attempts`)
      if (lane.stop || infraHalt) return
      lane.attempts.set(c.chain, n)
      const model = n > 1 || todo.some((w) => (w.reopen_count || 0) >= 1) ? 'opus' : P.worker
      buildCostByFrd.set(c.frd, (buildCostByFrd.get(c.frd) || 0) + COST(model))
      todo = await fastBuilder(c.frd, todo, model, n > 1, c.base, c)
      continue
    }
    agentSpawned++
    const m = await runMechOp('lane-mark', `--chain ${shellQuote(c.chain)} --as built`, { label: `lane-mark:${c.chain}` })
    if (m.body && m.body.ok === true) { lane.land.push(c); log(`◦ chain ${c.chain} built in lane ${c.lane} — queued to land`); return }
    todo = ((m.body && m.body.missing) || []).map(own).filter(Boolean)
    if (!todo.length) return lanePark(c, `lane-mark refused it (${m.error || (m.body && (m.body.reason || m.body.status))})`)
  }
}
const laneFixPrompt = (c) => `${EMIT('implementer', c.frd, { frd: c.frd, activity: 'repair' })}LANE REBASE-FIX (proposal 40 §3 B.5) for chain ${c.chain} (${c.wos.join(', ')}): land-chain could not land it on main (${c.fix.kind || 'unknown'}: ${JSON.stringify(c.fix.conflicts || c.fix.checks || c.fix.reason || '').slice(0, 800)}).
 1) Rebase the lane branch onto main's tip: \`git -c core.attributesFile=${PROJECT_DIR}/.pandacorp/run/lanes/union.gitattributes rebase --empty=keep $(git -C ${shellQuote(PROJECT_DIR)} rev-parse HEAD)\` (a no-op when it is already there). Resolve each conflict keeping BOTH sides' intent: main's code has landed, adapt this chain to it. Never squash, drop, reorder or reword a commit: one commit per work order (DR-097).
 2) Make tsc, biome and the related unit tests green by fixing PRODUCTION code (never weaken a test), committing each fix with \`${mechOpCommand('commit-wo', '--fixup <the-wo-id> --file <each path you changed>', c.path)}\`.
 3) Leave the lane tree clean. Return { done: true }, or { done: false, failure }.`
async function laneFix(c) {
  const n = (lane.attempts.get(c.chain) || 0) + 1
  if (n > LANE_MAX_ATTEMPTS) return lanePark(c, `not landable after ${LANE_MAX_ATTEMPTS} attempts (${c.fix.kind})`)
  if (lane.stop || infraHalt) return
  lane.attempts.set(c.chain, n)
  agentSpawned += COST('sonnet')
  await agent(laneFixPrompt(c), { label: `lane-fix:${c.chain}`, phase: 'Build', model: 'sonnet', effort: 'high', agentType: 'pandacorp:implementer', schema: STOP_SCHEMA, workFrom: laneWorkFrom(c) })
  lane.land.push(c)   // land-chain re-checks everything; a second failure parks it (one rebase-fix)
}
async function lanePark(c, why) {
  agentSpawned++
  const r = await runMechOp('lane-mark', `--chain ${shellQuote(c.chain)} --as parked --why ${shellQuote(why.slice(0, 200))}`, { label: `lane-park:${c.chain}` })
  laneParked(c, why, r.body)
}
function laneParked(c, why, b) {
  lane.plan = true
  lane.live.delete(c.chain)
  if (!lane.parked.includes(c.chain)) lane.parked.push(c.chain)
  const blocked = (b && b.blockedFrds) || [c.frd]
  lane.blocked = [...new Set([...lane.blocked, ...blocked])]
  log(`⊘ chain ${c.chain} parked (${why}) — only its DAG descendants wait: ${blocked.join(', ')} (proposal 40 §3 B.9)`)
}
// Main holders (one at a time, holdMain): the barrier, a chain landing, the USABLE fix-forward.
async function laneBarrier(c) {
  const st = frdState.get(c.frd)
  const ids = laneIds(c)
  const wos = st ? st.f.workOrders.filter((w) => ids.includes(w.id) && st.toBuildIds.has(w.id)) : []
  lane.plan = true
  // A barrier of an earlier run this run cannot build (its FRD out of scope, a WO BLOCKED) would pause landings forever:
  // park it (only its descendants wait; the next run's resume round retires the park).
  if (!wos.length) { await lanePark(c, 'none of its work orders is buildable in this run'); return null }
  log(`⚒ ${c.onMain && c.onMain !== 'schema' ? `chain ${c.chain} (${ids.join(', ')}) builds on main (${c.onMain})` : `barrier ${c.chain} (${ids.join(', ')}) builds on main`} — lane landings wait for it, lane builds go on (proposal 40 §3 B.2)`)
  if (!fastClassified.has(c.frd)) await fastClassify([c.frd])
  const since = await fastDispatch(c.frd, wos.map((w) => w.id))
  let missed
  try { missed = await fastBuildWos(c.frd, wos, since) } catch (e) {
    if (!isInfraError(e)) throw e
    await parkWorkOrders(wos.filter((w) => !doneIds.has(w.id)))
    return 'paused'
  }
  if (missed.length) { await lanePark(c, `${missed.map((w) => w.id).join(', ')} did not commit on main`); return null }
  lane.landed.add(c.frd)
  lane.live.delete(c.chain)
  if (st && !st.failed && st.toBuildIds.size === 0) lane.usableQ.push({ frd: c.frd, rung: 0 })
  return null
}
async function laneLand(c) {
  agentSpawned++
  const r = await runMechOp('land-chain', `--chain ${shellQuote(c.chain)}`, { label: `land-chain:${c.chain}` })
  const b = r.body
  lane.plan = true
  if (b && b.ok === true && b.status === 'landed') {
    fastMarkLanded(c.frd, laneIds(c))
    lane.landed.add(c.frd)
    lane.live.delete(c.chain)
    lane.sp = true
    log(`⇪ chain ${c.chain} landed on main at ${b.sha} (${c.wos.join(', ')}: one commit per work order)`)
    const st = frdState.get(c.frd)
    if (st && !st.failed && st.toBuildIds.size === 0) lane.usableQ.push({ frd: c.frd, rung: 0 })
    return null
  }
  if (b && b.status === 'needs-rebase-fix') { log(`↻ chain ${c.chain}: ${b.kind} at landing — one rebase-fix in its lane`); laneStart({ ...c, fix: b }); return null }
  if (b && b.status === 'parked') { laneParked(c, `${b.kind} after its rebase-fix`, b); return null }
  const tries = (c.landTries || 0) + 1
  lane.landHold = true   // until the next lane-next round: a paused or busy landing is not retried in a spin
  if (b && b.status === 'landings-paused') { lane.land.push(c); return null }
  // Bench FM-6: dirt made only by the lane's own bootstrap (its launch.json ports…) says nothing about the chain's code;
  // it is never a landing attempt, so it can never park a correct chain and stall its DAG descendants.
  if (b && b.status === 'lane-dirty' && b.bootstrapOnly === true) { log(`⚠ chain ${c.chain}: its lane is dirty only with bootstrap-owned files (${(b.paths || []).join(', ')}) — not a landing attempt, it stays queued`); lane.land.push(c); return null }
  if (tries < 3) { log(`⚠ chain ${c.chain}: land-chain refused (${r.error || (b && (b.reason || b.status))}) — it stays queued`); lane.land.push({ ...c, landTries: tries }); return null }
  await lanePark(c, `land-chain refused it ${tries} times (${r.error || (b && (b.reason || b.status))})`)
  return null
}
function laneUsableStart(u) {
  lane.usable = laneUsable(u).catch((e) => { if (!isInfraError(e)) throw e }).finally(() => { lane.usable = null; lane.plan = true })
}
// USABLE of a lane-built FRD (§3 B.6): the snapshot verify on the pinned SHA, beside the landings; a refusal certified
// nothing either way (retried once, then its gate decides); red goes to the fix-forward holder.
async function laneUsable({ frd, rung, flakyRetry }) {
  const ids = frdState.get(frd).reviewIds
  let v = null
  for (let i = 0; i < 2 && (!v || v.refused); i++) {
    agentSpawned++
    v = fastVerdict(frd, await runMechOp('lane-usable', `--frd ${shellQuote(frd)}${ids.map((id) => ` --wo ${shellQuote(id)}`).join('')}${fastIsFloor(frd) ? ' --floor' : ''}`, { label: `usable:${frd}` }))
    if (v.refused) log(`⚠ ${frd}: the snapshot verify was refused (${v.failure}) — it certified nothing either way`)
  }
  // Bench FM-7: a red that timed out under contention again after its files passed alone is the host's: one more
  // snapshot verify later (no bisect, no fix-forward); a second one is treated as any red.
  if (!v.refused && !v.green && v.flaky && !flakyRetry) {
    log(`◦ ${frd}: verify.sh timed out under contention on ${v.sha} (the failing files pass alone) — the snapshot verify runs again later, no fix-forward`)
    lane.usableQ.push({ frd, rung, flakyRetry: true })
    return
  }
  if (!v.refused && !v.green) {
    log(`! ${frd}: verify.sh red on the pinned ${v.sha} (${v.failure}) — ${v.cls === 'cross' ? `other chains landed since the last green pin (${v.candidates.join(', ')}): bisect, then` : 'only its own chains since the last green pin:'} fix-forward, never a revert (proposal 40 §3 B.6)`)
    lane.fixQ.push({ frd, ids, v, rung })
    return
  }
  await fastCertified(frd, v)
}
async function laneFixForward({ frd, ids, v, rung, preFor }) {
  lane.plan = true
  if (preFor) return lanePreexistingFix(frd, ids, v, preFor)
  const model = rung ? 'opus' : 'sonnet'
  if (rung >= 2 || capHit() || !canAffordRepair(frd, model)) {
    log(`⛔ ${frd}: verify.sh still red on ${v.sha} after the fix-forward ladder (${v.failure}) — nothing is reverted (other chains landed on top): needs-owner`)
    await holdUsableDiscard(frd, ids, 'a revert of its landed chains')
    blockFrdInSchedule(frd, 'needs-owner')
    return null
  }
  let hint = ''
  if ((v.cls === 'cross' || v.foreign) && v.candidates.length && !rung) {
    agentSpawned++
    const b = (await runMechOp('lane-bisect', `--sha ${shellQuote(v.sha)} --frd ${shellQuote(frd)}${v.candidates.map((x) => ` --candidate ${shellQuote(x)}`).join('')}`, { label: `bisect:${frd}` })).body
    log(`◦ ${frd}: bisect over ${v.candidates.join(', ')} → ${(b && (b.culprit || b.status)) || 'no verdict'}`)
    if (b && b.ok === true && b.status === 'pre-existing' && b.preexisting && b.preexisting.unblocks === true && (await lanePreexistingUsable(frd, ids, v, b.preexisting))) return null
    hint = b && b.ok === true ? (b.status === 'culprit' ? ` A bisect over the chains landed since the last green pin names chain ${b.culprit} (its work orders' code) as the first red tip: start there.` : ` A bisect over the chains landed since the last green pin found: ${b.status}.`) : ''
  }
  log(`! ${frd}: fix-forward on main (${model})`)
  agentSpawned += COST(model)
  await chargedRepair(frd, model, () => agent(fastFixPrompt(frd, ids, v.failure) + hint, { label: `fix:${frd}`, phase: 'Build', model, effort: rung ? 'high' : 'medium', agentType: 'pandacorp:implementer', schema: STOP_SCHEMA }))
  lane.usableQ.unshift({ frd, rung: rung + 1 })
  return null
}
// Bench FM-7: a red whose every failing test is another FRD's and already red at the bisect base does not block this
// FRD: lane-usable --preexisting certifies it from the two recorded verdicts (no re-run), and each owning FRD gets ONE
// fix-forward for it. The build still closes only on a whole green tree (the scripted close's full verify).
async function lanePreexistingUsable(frd, ids, v, pre) {
  agentSpawned++
  const u = fastVerdict(frd, await runMechOp('lane-usable', `--frd ${shellQuote(frd)}${ids.map((id) => ` --wo ${shellQuote(id)}`).join('')} --sha ${shellQuote(v.sha)} --preexisting${fastIsFloor(frd) ? ' --floor' : ''}`, { label: `usable-pre:${frd}` }))
  if (u.refused || !u.pre) return false
  const byFrd = new Map()
  for (const o of pre.owners || []) if (o && o.frd && o.frd !== frd) byFrd.set(o.frd, [...(byFrd.get(o.frd) || []), o])
  for (const [owner, rows] of byFrd) {
    const key = `${owner}|${rows.map((o) => o.file).sort().join(',')}`
    if (lane.routed.has(key) || lane.fixQ.some((f) => f.frd === owner)) continue
    lane.routed.add(key)
    log(`↪ ${frd}: its red is ${owner}'s pre-existing failure (${rows.map((o) => o.file).join(', ')}) — routed once to ${owner}'s fix-forward`)
    lane.fixQ.push({ frd: owner, ids: [...new Set(rows.map((o) => o.wo))], v: { sha: v.sha, failure: `pre-existing red in ${rows.map((o) => o.file).join(', ')} (red at the bisect base too): ${v.failure}` }, rung: 0, preFor: frd })
  }
  await fastCertified(frd, u)
  return true
}
async function lanePreexistingFix(frd, ids, v, preFor) {
  if (capHit() || !canAffordRepair(frd, 'sonnet')) { log(`⚠ ${frd}: its pre-existing red (${v.failure}) gets no fix-forward (budget) — the close-out's full verify still requires it green`); return null }
  log(`! ${frd}: fix-forward on main of its pre-existing red, found while certifying ${preFor} (sonnet)`)
  agentSpawned += COST('sonnet')
  await chargedRepair(frd, 'sonnet', () => agent(`${fastFixPrompt(frd, ids, v.failure)} This red pre-dates ${preFor}'s chains (a bisect found it red at their base): fix ${frd}'s own code.`, { label: `fix-pre:${frd}`, phase: 'Build', model: 'sonnet', effort: 'medium', agentType: 'pandacorp:implementer', schema: STOP_SCHEMA }))
  return null
}
// One scheduler round at K ≥ 2: settle the main holder, plan, start what is due, then wait for the next event.
async function laneRound() {
  const h = mainWriter
  if (h && h.done) { mainWriter = null; lane.plan = true; if (h.e) throw h.e; if (h.r === 'paused') return 'paused' }
  if (infraHalt) return 'paused'
  // A round costs a relay spawn: only when a lane can take a chain (a built chain holds its lane until it lands), the
  // resume is pending, or a held landing waits for the refreshed queue.
  const occupied = lane.jobs.size + lane.land.length + (mainWriter && mainWriter.who.startsWith('land-chain:') ? 1 : 0)
  const held = new Set([...lane.live.values()].flatMap((c) => c.wos.map((w) => String(w).toLowerCase())))
  const unheld = [...globalQueue.keys()].some((id) => !held.has(id.toLowerCase()))
  if (lane.plan && !lane.next && ((unheld && occupied < lane.k) || (lane.ready && !lane.resumed) || lane.landHold)) laneNext()
  if (!lane.usable && lane.usableQ.length) laneUsableStart(lane.usableQ.shift())
  if (!mainWriter) {
    if (lane.barrier) { const c = lane.barrier; lane.barrier = null; holdMain(`barrier:${c.chain}`, () => laneBarrier(c)) }
    else if (lane.fixQ.length) { const f = lane.fixQ.shift(); holdMain(`fix:${f.frd}`, () => laneFixForward(f)) }
    else if (lane.land.length && !lane.landHold) { lane.land.sort((a, b) => (b.downstream || 0) - (a.downstream || 0)); const c = lane.land.shift(); holdMain(`land-chain:${c.chain}`, () => laneLand(c)) }
  }
  const waits = [mainWriter && mainWriter.p, lane.next, lane.usable, lane.pool, ...lane.jobs.values(), ...gatesInFlight.values()].filter(Boolean)
  if (waits.length) { await Promise.race(waits); return null }
  if (lane.plan || lane.usableQ.length || laneMainWork()) return null
  // Quiescent with work left: no lane can take it (the pool never came up, every lane broke, or lane-next kept failing)
  // → build the rest one FRD at a time on main; otherwise it waits on gates or is deferred (parked descendants).
  if (globalQueue.size && (!lane.ready || lane.broken >= lane.k || lane.idle >= 2)) { LANED = false; log(`↩ lanes unavailable (${!lane.ready ? 'no lane pool' : lane.idle >= 2 ? 'lane-next failed twice' : 'every lane is broken'}) — the rest builds one FRD at a time on main`); return null }
  return await fastIdle()
}
async function laneSettle() {
  lane.stop = true
  const all = [mainWriter && mainWriter.p, lane.next, lane.usable, lane.pool, ...lane.jobs.values()].filter(Boolean)
  if (all.length) { log(`⏸ lanes: waiting for ${all.length} in-flight lane task(s) to settle — built chains stay queued for the next run`); await Promise.allSettled(all) }
}

// C2: resume gates (an all-IN_REVIEW FRD enrolled before any wave) are frozen at the baseline HEAD.
if (gateQueue.length && !REVIEW_DEFERRED) {
  if ((await infraPausable(() => capturePin([...gateQueue]))) === PAUSED) return await pausedExit({ builtFrds, blockedFrds, reopenedFrds, blockedReasons, blockedFailures })   // proposal 39 C7: a pause, never a crash
  for (const frd of gateQueue) launchEvidence(frd)   // WP-06: no-op unless gateEvidence:'digested'
}

// WP-11: counts safe-point CHECKPOINTS this run (every wantSafePoint boundary, whether that's an
// upcoming wave or an idle/gate-settle sweep) — the throttle for a targeted run below. Declared outside
// the loop so it survives across iterations; unused (and harmless) on a bare run.
let safePointChecks = 0

// BL-0207: the agent budget is the run's real brake, and a parallel-gate run can spend it to the last unit without
// any line saying so (canary F2: 60/60, finished one reopen short of an agent-cap stop). Two ONE-SHOT advisories
// over the same cost-weighted counter the brake reads, only while work remains: (1) 80 % of maxAgents consumed;
// (2) what is left can no longer pay one more reopen ladder (GATE_LADDER_COST). Log-only — never a stop.
const AGENT_BUDGET_WARN_RATIO = 0.8
let agentBudget80Warned = false
let agentBudgetLadderWarned = false
function warnAgentBudgetNearExhaustion(workRemains) {
  if (!MAX_AGENTS || !workRemains || agentSpawned >= MAX_AGENTS) return
  const remaining = MAX_AGENTS - agentSpawned
  if (!agentBudget80Warned && agentSpawned >= AGENT_BUDGET_WARN_RATIO * MAX_AGENTS) {
    agentBudget80Warned = true
    log(`⚠ AgentBudgetAdvisory: ${agentSpawned}/${MAX_AGENTS} cost-weighted agent units spent (${Math.round((100 * agentSpawned) / MAX_AGENTS)} %, threshold ${Math.round(AGENT_BUDGET_WARN_RATIO * 100)} %) with work still pending (${globalQueue.size} WO(s) to build, ${gateQueue.length + gatesInFlight.size + gateResults.length} gate(s) queued/in flight) — ${remaining} unit(s) left (BL-0207)`)
  }
  if (!agentBudgetLadderWarned && remaining < GATE_LADDER_COST) {
    agentBudgetLadderWarned = true
    log(`⚠ AgentBudgetAdvisory: only ${remaining} cost-weighted unit(s) left of maxAgents ${MAX_AGENTS} — less than one reopen ladder (~${GATE_LADDER_COST}) with work still pending (BL-0207)`)
  }
}

while (true) {
  try {   // WS-D/D2: error boundary around the whole scheduler body — a throw must never leave running:true
  // Proposal 40 Phase A: while a build or a landing holds main, only the gates move (their settles refill the slots);
  // every brake, the safe point and the next dispatch wait for the holder, and its outcome is read here once it settled.
  if (mainWriter && !LANED) {   // at K ≥ 2 laneRound settles the holder (the lanes move while it holds main)
    const h = mainWriter
    if (!h.done) { await Promise.race([h.p, ...gatesInFlight.values()]); continue }
    mainWriter = null
    if (h.e) throw h.e
    if (h.r === 'paused') { stopReason = 'paused-infra'; break }
    continue
  }
  if (infraHalt) { stopReason = 'paused-infra'; break }   // proposal 39 C7: no new dispatch after an infra halt
  // ── Brakes at every wave/gate boundary (same checks the per-FRD loop ran) ──
  if (budget.total && budget.remaining() < LOW_BUDGET) { stopReason = 'budget'; log('Circuit breaker: budget ceiling reached — stopping at a safe point'); break }
  // F5/BL-0177: the ceiling can be reached on the SAME pass that finishes all remaining work (the
  // closing agents — visual-qa/close-out-verify/notify-end — run outside this brake by design, so
  // agentSpawned can cross MAX_AGENTS one beat after the last real gate/apply already cleared the
  // queues). Reporting 'agents' then is cosmetic-wrong: canary D2 narrated "Paro por techo de
  // agentes" for a run that had nothing left to build or gate. Only call it an agent-cap STOP when
  // work actually remains; otherwise fall through unlabeled (stopReason stays null = ran to
  // completion) and let the natural end-of-queue check a few lines below close the run honestly.
  const workRemains = globalQueue.size > 0 || gateQueue.length > 0 || gatesInFlight.size > 0 || gateResults.length > 0 || convergeQueue.length > 0
  warnAgentBudgetNearExhaustion(workRemains)
  if (MAX_AGENTS && agentSpawned >= MAX_AGENTS) {
    if (workRemains) { stopReason = 'agents'; log(`Agent ceiling reached (${agentSpawned} ≥ maxAgents ${MAX_AGENTS}) — stopping at a safe point`); break }
    log(`Agent ceiling reached (${agentSpawned} ≥ maxAgents ${MAX_AGENTS}) but no work remains (F5/BL-0177) — closing normally, not an agent-cap stop`)
  }
  if (MAX_SPEND && budget.spent() >= MAX_SPEND) { stopReason = 'budget'; log(`Spend ceiling reached (${Math.round(budget.spent() / 1000)}k ≥ maxSpend ${Math.round(MAX_SPEND / 1000)}k) — stopping at a safe point`); break }
  if ((builtFrds.length + blockedFrds.length + reopenedFrds.length) >= MAX_FRDS) { stopReason = 'maxFrds'; log(`Reached the test cap maxFrds=${MAX_FRDS} (built+blocked+reopened) — stopping at a safe point`); break }
  if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) { stopReason = 'blocks'; break }
  if (REVIEW_DEFERRED && gateQueue.length) deferQueuedGates()   // proposal 39 C6: reviewBudget defer launches no gate

  if (PARALLEL_GATES) {
    // ── D1 landing lane: land ONE settled verdict (arrival order) on main, then re-check the brakes and the
    // pool — no quiesce: the other slots keep reviewing; no wave dispatch overlaps a landing. ──
    if (gateResults.length) {
      const idx = nextLandingIndex()   // E2 finding 1: a verdict whose upstream has not landed waits; the loop goes on
      // Proposal 40 Phase A: the fast lane lands only when no FRD is ready to build (build first), as a main-writer holder.
      // BL-0192: refill free slots FIRST (topUpBeforeLanding).
      const land = async () => { await topUpBeforeLanding(idx); await landParallelVerdict(false, idx) }
      if (idx >= 0 && !FAST) { await land(); continue }
      if (idx >= 0 && (LANED ? !mainWriter && !laneMainWork() : !pickFastFrd())) { holdMain(`land:${gateResults[idx].f.frd}`, land); continue }
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
  // Proposal 40 Phase B: at K ≥ 2 the boundary is a chain landing (lane.sp), never every scheduler round, and never while
  // a holder writes main (the drain edits docs on main).
  const wantSafePoint = LANED
    ? !mainWriter && (lane.sp || (globalQueue.size === 0 && !laneBusy() && (nothingInFlight ? gateQueue.length === 0 : gateSettledSinceSafePoint)))
    : globalQueue.size > 0
    || (nothingInFlight && gateQueue.length === 0)
    || (!nothingInFlight && globalQueue.size === 0 && gateSettledSinceSafePoint)
  if (wantSafePoint) {
    if (LANED) { lane.sp = false; lane.plan = true }
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
      log(`⊘ safe point #${safePointChecks} saltado (build dirigido — WP-11: 1×/corrida + 1×/${SAFE_POINT_WAVE_THROTTLE} boundaries; lease renovada igual)`)
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
  // Bench FM-2: the fast lane never runs this inline legacy gate ahead of its builders — fastLaneStep (or the idle path
  // below) gates on main only once nothing is left to build.
  if (gateQueue.length && !(PARALLEL_GATES && concurrentGates !== false && launchParallelGates()) && !(FAST && PARALLEL_GATES)) {
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
  if (globalQueue.size === 0 && !(LANED && laneBusy())) {
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
      if (FAST && concurrentGates === false) log(`⚠ D1: no gate slot is usable — gating ${frd} on main (legacy), in plan order, now that nothing is left to build`)
      else log(`⚠ D1: ${frd} is gate-ready but no parallel gate could start with nothing in flight — gating it on main (legacy) rather than dropping it`)
      const st = frdState.get(frd)
      await gateAndConverge(st.f, st.reviewIds)
      continue
    }
    break   // nothing to build and no gate outstanding → done
  }

  // Proposal 39 §11: the fast lane builds ONE FRD per iteration (sequential FRD lanes on main); its gate runs in the slots above.
  // Proposal 40 Phase B: whether to lane is decided here once (the first safe point has drained the ready cards), on the
// run's ceiling kRun; kRun ≥ 2 runs the lanes, each round re-deciding its own K.
  if (FAST) {
    if (LANED === null) await decideLanes()
    if ((await (LANED ? laneRound() : fastLaneStep())) === 'paused') { stopReason = 'paused-infra'; break }
    continue
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
    candidates = [...foundationReady, ...ready.filter((w) => !w.foundation && joinsFoundationWave(w))]   // DR-123: lib-only, dependency-free WOs ride the foundation wave
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
      log(`⊘ foundation-gate omitido: ninguna WO no-fundación lista declara artefactos de UI ${UI_SKIP_NOTE} — ${surfaceFrds}`)
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
    log(`⚠ oleada reducida a 1 WO por presupuesto de agentes agotado (agentSpawned=${agentSpawned} ≥ maxAgents=${MAX_AGENTS}, remainingAgents=${remainingAgents}) — ${candidates.length - 1} WO(s) listos más no caben. Esto NO es un recorte por dependencias/artefactos/tope de conteo (P.wave=${P.wave}).`)
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
  if (MECH_SCRIPT) {
    // Proposal 39 C1/C7: the scripted stamp, COMMITTED — the IN_PROGRESS stamp commit is the anchor of the resume window.
    const d = await runMechOp('dispatch', `${wave.map((w) => `--wo ${shellQuote(w.id)}`).join(' ')} --commit`, { label: `dispatch:${waveFrds.join('+')}`, prefix: dispatchSyncRollups, suffix: uiPassSkipEvent })
    if (!d.body || d.body.ok !== true) log(`⚠ dispatch stamp not confirmed (${d.error || (d.body && (d.body.reason || d.body.error))}) — the builders run anyway; an unstamped WO is rebuilt on resume`)
  } else
  await agent(`${dispatchSyncRollups}Stamp \`implementation_status: IN_PROGRESS\` in the frontmatter of EACH of these work-order files (change nothing else beyond the sync-rollups step above if present, do NOT commit this part) by running EXACTLY this command once per file, substituting its path: \`perl -0pi -e 's/\\A(---\\n(?:(?!---\\n).*\\n)*?)implementation_status:[^\\n]*/$1implementation_status: IN_PROGRESS/' <file>\`. Files: ${wave.map((w) => w.path || `docs/frds/${w._frd}/work-orders/${w.id}`).join(', ')}. Return when all are stamped.${uiPassSkipEvent}`,
    { label: `dispatch:${waveFrds.join('+')}`, phase: 'Build', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT })
  // BL-0138 path 1: bracket the wave's own build barrier with a real-token delta, attributed to
  // buildTokensByFrd only when this wave is single-FRD (see recordWaveBuildTokens's own comment for why
  // a multi-FRD wave's delta can't be split among its FRDs).
  const waveBuildTokensBefore = budget.spent()
  const gatesAlongsideWave = PARALLEL_GATES ? gatesInFlight.size : 0   // D1: parallel gates reviewing during this wave spend into the same counter
  const results = await parallel(wave.map((w) => () => buildWO(w, w._frd, wave.length === 1)))
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
  // Proposal 39 C7: after an infra halt the wave's in-flight results have landed (a green one committed, even after the
  // halt); every WO that did not land is parked — never repaired, never BLOCKED, never reverted — and dispatch stops.
  if (infraHalt || results.some((r) => r && r.infra)) {
    await parkWorkOrders(wave.filter((w) => !doneIds.has(w.id)))
    stopReason = 'paused-infra'
    break
  }

  // A work order failed its self-test → TRY TO REPAIR that FRD before blocking (owner's rule).
  // Runs after the wave barrier (quiet tree), one FRD at a time.
  for (const frd of waveFrds) {
    const st = frdState.get(frd)
    if (!st || !st.failed) continue
    log(`! ${frd}: a work order failed — attempting repair before giving up`)
    waveRepairRan = true   // WP-03: attemptRepair ALWAYS commits (fix or block+revert) — untracked by commitWOGreen
    const liveIds = ((st.f && st.f.workOrders) || []).filter((w) => w.status !== 'VERIFIED' && w.status !== 'BLOCKED').map((w) => w.id)
    await recordRepairDiscardIntent(frd, liveIds)
    const fix = await attemptRepair(frd, 'a work order failed its self-test during the build wave')
    if (fix && fix.green === true) {
      log(`✓ ${frd}: repaired — proceeding to the gate`)
      st.failed = false
      for (const id of [...st.toBuildIds]) if (!globalQueue.has(id)) { st.toBuildIds.delete(id); doneIds.add(id) }
    } else {
      // BL-0212/DR-070: discard the committed code of this run's work orders the repair BLOCKED (never an older block).
      const reason = (await discardBlockedCode(frd, liveIds)) ? ((fix && fix.blocked_reason) || 'error') : 'needs-owner'
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
    if (isInfraError(loopErr) || infraHalt) { stopReason = 'paused-infra'; log(`⏸ scheduler stopped on the infra halt (${(loopErr && loopErr.message) || loopErr})`); break }   // proposal 39 C7: a pause, not a crash
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

if (LANED !== null && laneBusy()) await laneSettle()   // proposal 40 Phase B: no lane task outlives the scheduler
// ── C2 run-end invariant: settle EVERY in-flight gate + drain the convergeQueue BEFORE hardening/close-out/
// notify-end (the loop may have broken — budget/agents/blocks — with gates still running; a gate already
// spawned is work we committed to, and its apply/converge decides builtFrds/release honestly). ──
if (REVIEW_DEFERRED && !stopReason && fastReviewDebt().length) stopReason = 'review-deferred'   // proposal 39 C6: stopped at all-USABLE
if (stopReason === 'paused-infra') return await pausedExit({ inFlight: gatesInFlight, builtFrds, blockedFrds, reopenedFrds, blockedReasons, blockedFailures })   // proposal 39 C7: in-flight gates settle, nothing lands, no close-out
try {   // proposal 39 C7: an infra halt during the drain or the close-out is a pause too (the catch is at the end)
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
// reason (VISUAL_QA_SCHEMA), which the engine logs — a no-op is never silent again.
// BL-0198 (engine half): the relay itself is the harness's behaviour and cannot be switched off from here, so the engine
// also retries a no-work done:false ONCE (spawnVisualQa below). It cannot see tool calls, only the schema'd answer, so
// "no work" is read from the answer: done:false that reports no tool calls and names no step ("step <n>").
const VISUAL_QA_SCHEMA = { type: 'object', required: ['done'], properties: { done: { type: 'boolean' }, reason: { type: 'string', description: 'REQUIRED when done is false: the step that could not complete and why, starting with the step number (e.g. "step 1: the dev server does not start: <error>")' }, toolCalls: { type: 'number', description: 'REQUIRED when done is false: how many tool calls you made before answering' } } }
const VISUAL_QA_SCOPE = 'THIS STEP\'S SCOPE: your task is the engine-computed END-OF-BUILD VISUAL QA below. The harness may ALSO relay a message the owner sent to the ORCHESTRATING session (for example a question about how the run delegates its work); when that relayed message does not mention this visual QA pass or these FRDs, it is not addressed to this step: do not answer it, do not stop because of it, do the steps below. Only a relayed message that explicitly asks to skip or change THIS visual QA pass changes it — then return done:false with a reason that quotes it. Return done:false ONLY after attempting the steps, always with `reason` starting with the number of the step that could not complete ("step <n>: …") and `toolCalls`.\n'
const VISUAL_QA_STEP_RE = /\bstep\s*[1-4]\b/i
const visualQaDidNoWork = (r) => Boolean(r) && typeof r === 'object' && r.done === false && !(Number(r.toolCalls) > 0) && !VISUAL_QA_STEP_RE.test(String(r.reason || ''))
const visualQaRetryNote = (prior) => `RETRY (BL-0198) — your previous attempt at this task returned done:false without attempting any step${prior && prior.reason ? ` (its reason: "${String(prior.reason).slice(0, 200)}")` : ''}. That is not an acceptable result: a message relayed from the orchestrating session does not cancel this pass, and "nothing to do" is never the answer, because this pass has a concrete task below. START AT STEP 1 NOW and make the tool calls. Return done:false only after attempting the steps, with a reason that begins "step <n>:" and your toolCalls.\n`
// One visual-qa spawn plus, when its answer says it did no work, exactly one retry (never a third). Never throws: a
// rejected spawn is a null result, which is NOT retried (null is ambiguous: a 13-minute pass can also die late).
// Returns { result, retried, noop } where noop = the FINAL answer is still a no-work done:false.
async function spawnVisualQa(frds) {
  const spawn = (note) => agent(note + visualQaPromptBody(frds), { label: 'visual-qa', phase: 'Review', model: VISUAL_QA_MODEL, effort: 'high', agentType: 'pandacorp:reviewer', schema: VISUAL_QA_SCHEMA }).catch(() => null)
  let result = await spawn('')
  if (!visualQaDidNoWork(result)) return { result, retried: false, noop: false }
  log(`↻ visual-qa answered done:false with no work (no tool calls reported, no step named; reason: ${result.reason ? String(result.reason).slice(0, 200) : 'none given'}) — retrying once (BL-0198)`)
  agentSpawned += COST(VISUAL_QA_MODEL)
  result = await spawn(visualQaRetryNote(result))
  return { result, retried: true, noop: visualQaDidNoWork(result) }
}
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
  const fullAudit = () => agent(`DR-085 HARDENING 1a/3 — the security AUDIT, construction's last step (BL-0012). You are READ-ONLY: audit and report, do NOT edit code (that is the next spawn's job). Audit the WHOLE project: OWASP Top-10 for this stack, secrets in code/config/history, security headers + CSP (e.g. next.config), auth/authz on every mutating route, dependency risk; if the product has an agentic/LLM component, also ASI01–ASI10 (e.g. path traversal via model-chosen paths). Write the durable evidence report to docs/reviews/security-<YYYY-MM-DD>.md (the LOCAL date: \`date +%F\`, never \`date -u\`): for EACH finding record severity (critical/high/medium/low), file:line evidence, and concrete remediation. Commit the report (Conventional Commits, e.g. \`docs(security): audit report\`). Return { done: true, findings } ALWAYS once the report file exists — do NOT condition done on fixing anything (fixing is the next spawn). \`findings\` is a short array of { severity, summary } for the Critical/High items the fix spawn must clear (empty if none).${HARDENING_EVENT_IF_NO_FINDINGS('security')}`,
    { label: 'hardening:security-audit', phase: 'Hardening', model: P.judge, effort: 'high', agentType: 'pandacorp:security-auditor', schema: { type: 'object', required: ['done'], properties: { done: { type: 'boolean' }, failure: { type: 'string' }, findings: { type: 'array', items: { type: 'object' } } } } })
  const audit = earlySecurity ? await securityDeltaAudit(fullAudit) : await fullAudit()   // proposal 39 C6: the fast lane's audit started with the first gate
  // A-1 bench (lean tail, DR-123): the fix spawn only exists to clear Critical/High items, so an audit that returned an
  // EXPLICIT empty findings array has nothing for it to do (its own prompt already says "return done:true immediately").
  // FAIL-CLOSED: anything but a real empty array (done not true, findings missing/null/non-array/garbled) runs the fix as
  // before — a dead or malformed audit never reads as "clean". The audit then emitted the security Hardening event itself.
  const securityFixSkippable = Boolean(audit && audit.done === true && Array.isArray(audit.findings) && audit.findings.length === 0)
  if (securityFixSkippable) log('✓ security audit returned an explicit empty findings array — security-fix not applicable, skipped (DR-123)')
  if (!securityFixSkippable) agentSpawned++
  const fix = securityFixSkippable ? { done: true } : await agent(`DR-085 HARDENING 1b/3 — apply the security FIXES (BL-0012). The read-only auditor just wrote docs/reviews/security-<YYYY-MM-DD>.md with each finding + severity + remediation${audit && Array.isArray(audit.findings) ? ` (it flagged ${audit.findings.length} Critical/High item(s))` : ''}. Read that report. FIX every Critical AND High finding directly in production code (TDD — write the failing test first, then the fix; never weaken a test), then re-run the FOCUSED \`bash .pandacorp/verify.sh --since <last_green_sha from .pandacorp/status.yaml>\` until green (DR-106 — the close-out right after runs the FULL suite once; don't pay it twice here). Append to the SAME report, per finding: fixed | accepted-with-reason, and the final verify result. Commit (Conventional Commits).${HARDENING_EVENT('security')} (This one Hardening event folds the audit + fix into the single SECURITY stage result — status ok iff no Critical/High remains open, else fail; the read-only auditor does NOT emit its own.) Return { done: true } ONLY when no Critical/High remains open AND the report reflects it; otherwise { done: false, failure }. If the report lists NO Critical/High findings, there is nothing to fix — return { done: true } immediately.`,
    { label: 'hardening:security-fix', phase: 'Hardening', model: P.worker, agentType: 'pandacorp:implementer', schema: STOP_SCHEMA })
  const sec = { done: Boolean(audit && audit.done === true && fix && fix.done === true), failure: (fix && fix.failure) || (audit && audit.failure) }
  // Proposal 40 §2 (Telemetry, conditional): the fast lane asks the script first. No event plan, or a plan with no events
  // (its verification section recorded) → nothing to verify, no agent. A plan whose events no product code emits → fails
  // loud (the instrumentation was never built). Only a plan with emitters to verify spawns the telemetry agent; an
  // unverifiable answer spawns it too (fail-safe).
  const telemScope = FAST ? await telemetryScope() : null
  if (telemScope && telemScope.skip) return { sec, telem: telemScope.telem, hardened: Boolean(sec.done === true && telemScope.telem.done === true) }
  agentSpawned++
  const telem = await agent(`DR-085 HARDENING 3/3 — telemetry verification (BL-0012). Read docs/analytics/events.md (the event plan). VERIFY each planned event actually FIRES (exercise the flows via the tests/dev server; check the PostHog/analytics wiring is present and env-keyed). Fix trivial instrumentation gaps (a missing capture call) with TDD. Append a "## Verification <YYYY-MM-DD>" section to docs/analytics/events.md recording event-by-event: fires|gap-fixed|not-applicable. If the project has NO event plan and needs none (internal/personal return_type — check the PRD), record exactly that in the section instead. Commit.${HARDENING_EVENT('telemetry')} Return { done: true } (the verification section exists) or { done: false, failure }.`,
    { label: 'hardening:telemetry', phase: 'Hardening', model: P.worker, agentType: 'pandacorp:analytics', schema: STOP_SCHEMA })
  return { sec, telem, hardened: Boolean(sec && sec.done === true && telem && telem.done === true) }
}

// Proposal 40 §2: the scripted telemetry scope. { skip, telem } when no agent is needed (or the plan fails loud), else
// { skip: false, missing } — the planned events the scan found no emitter for.
async function telemetryScope() {
  agentSpawned++
  const r = await runMechOp('telemetry-scope', '--write-na', { label: 'telemetry-scope', phase: 'Hardening' })
  const b = r.body
  log(`◦ telemetry scope: ${r.error || (b && b.status)}`)
  if (b && b.ok === true && ['absent', 'no-events'].includes(b.status)) return { skip: true, telem: { done: true } }
  if (b && b.status === 'no-emitters') return { skip: true, telem: { done: false, failure: b.reason } }
  return { skip: false }
}

const RELEASE_ASSERT_I = `(i) **every** docs/frds/*/frd.md rollup \`implementation_status\` is VERIFIED (WS-D/D4b — do a FRESH read of each frd.md on disk right now; if any is NOT VERIFIED, return { done: false } listing the offending FRD folders — the in-memory built-count is NOT enough, the disk is the oracle);`
const RELEASE_ASSERT_II = `(ii) assert the hardening evidence EXISTS **and is FRESH**: the security report docs/reviews/security-<TODAY>.md exists (TODAY = \`date +%F\`, the LOCAL date the auditor names it with — never \`date -u\`, which is another day in the evening) AND its mtime is NEWER than status.yaml's \`run_started_at\` (WS-D/D4c — compare epochs, e.g. \`date -r docs/reviews/security-<TODAY>.md +%s\` vs the epoch of run_started_at; a STALE same-day report left by a PREVIOUS run FAILS this assert), AND the "## Verification" section is present in docs/analytics/events.md.`
// DR-060: the cross-feature seam check, shared by the opus close-outs and the fast lane's cross-feature review.
const SEAM_CHECK = `the seam check the per-FRD gates CANNOT do (each only sees its own feature). The dominant failure of parallel builds is at the seams BETWEEN features — every component correct in isolation, broken together. Trace the data flow ACROSS feature boundaries and verify every producer/consumer pair actually AGREES: each consumer's expectations vs its provider's \`docs/api/<wo-id>.md\` contract (field names, data shapes, formats, units, status codes, routes), shared types/enums used consistently across features, and NO two features that shipped duplicate or divergent versions of the same component/util (cross-check \`docs/design/components.md\`).`
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
  ` Also append the CloseOutVerifyReused event (fire-and-forget — BL-0147: this step reused a recent full green gate-report instead of re-running the whole-project suite): printf '{"event":"CloseOutVerifyReused","at":"%s","project":"%s","sha":"${sha}","ageSeconds":${Math.max(0, Math.round(ageSeconds || 0))}}${EV_END}`
// The reused report is always scope:"full" (checkFullVerifyReuse refuses anything else).
const REUSE_REPORT_CLAUSE = (reuse) => `a FULL, GREEN run of this EXACT commit (sha ${reuse.headSha}, ~${Math.max(0, Math.round(reuse.ageSeconds || 0))}s ago, clean tree)`
async function checkFullVerifyReuse() {
  agentSpawned++
  const r = MECH_SCRIPT   // proposal 39 C1: the scripted reuse-check (the engine re-checks its fields below either way)
    ? (await runMechOp('reuse-check', `--max-age ${REUSE_MAX_AGE_SECONDS}`, { label: 'close-out-verify-reuse-check', phase: 'Review' })).body
    : await agent(
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

// The partial run's owner-facing summary (BL-0159), shared by both close-out shapes (identical text).
function runEndSummary(needsOwner) {
  const blk = blockedFrds.map((x) => `${x}(${blockedReasons[x]}${blockedFailures[x] ? `: ${blockedFailures[x]}` : ''})`).slice(0, 8).join(', ') || 'ninguno'
  const why = stopReason === 'agents' ? ' Paro por techo de agentes (maxAgents).'
    : stopReason === 'budget' ? ' Paro por techo de presupuesto.'
    : stopReason === 'blocks' ? ' Paro: demasiados FRDs bloqueados seguidos (algo sistemico va mal).'
    : stopReason === 'rethink' ? ' Paro en safe point: el owner re-planificó (rethink_pending) — la próxima corrida retoma con el plan nuevo.'
    : stopReason === 'maxFrds' ? ' Paro por el tope de prueba (maxFrds).'
    : stopReason === 'orphan-chain' ? ' Paro: una cadena de lane quedo huerfana (su recibo se perdio); revisa .pandacorp/run/lanes/state.json.'
    : stopReason === 'review-deferred' ? ` Revision diferida (reviewBudget defer): ${fastUsable.length} FRD(s) USABLE en main; los gates quedan pendientes para otra ventana.` : ''
  const ownerMsg = needsOwner.length
    ? `Termine lo que se podia. ${needsOwner.length} FRD(s) te esperan a ti: ${needsOwner.slice(0, 6).join(', ')}`
    : `Tramo: ${builtFrds.length} FRDs ok, ${blockedFrds.length} bloqueados, ${reopenedFrds.length} a reintentar`
  return { blk, why, ownerMsg }
}
const logVisualQaSkipped = () => log(`⊘ visual-qa omitido: ninguna WO de los FRDs verificados esta corrida (${builtFrds.join(', ')}) declara artefactos de UI ${UI_SKIP_NOTE}`)
const logChangesStillBuilding = () => log(`↷ ${integratedChanges.length} change(s) integradas pero este run no verificó FRDs — siguen 'building' hasta la corrida que verifique sus FRDs (DR-069 §7)`)
// The run's last log line, shared by both close-out shapes (identical text).
const logRunEnded = (hardened) => (hardened === false ? 'Run ended: all FRDs verified but hardening incomplete — NOT released (needs-owner).' : `Run ended: ${builtFrds.length} verified, ${reopenedFrds.length} reopened, ${blockedFrds.length} blocked${stopReason ? ' · stop=' + stopReason : ''}.`)
const logReleaseOutcome = (r) => log(r && r.done === true
  ? 'Run ended: all FRDs verified + hardened.'
  : 'Run ended: all FRDs verified + hardened, but the close-out agent did not confirm release — the fail-safe will ensure running:false (phase stays implementation).')
// The closing agents' options, shared by both close-out shapes (a fresh object per call).
const CLOSE_OUT_OPTS = () => ({ label: 'close-out', phase: 'Review', model: P.judge, effort: 'xhigh', agentType: 'pandacorp:reviewer', schema: STOP_SCHEMA })
const NEEDS_HARDENING_OPTS = () => ({ label: 'close-needs-hardening', phase: 'Review', model: P.worker, agentType: 'pandacorp:implementer', schema: STOP_SCHEMA })
// ── Proposal 40 §2: the fast lane's release tail ───────────────────────────────────────────────────────────────
// The production-build smoke runs in its own detached worktree (never a gate slot, never the main tree) on a port outside
// the slots' 3800 + 10·k and the bootstrap hash range. It never rejects: an infra error is carried to its await site, and
// an unverifiable line is retried once, then red (fail-closed). It judges the commit at its start (`sha`); the hardening
// and visual-qa may commit product code after it, so the scripted close certifies the release only on that commit
// (`close --smoke-sha`, refused `stale-smoke` otherwise) and the engine re-smokes HEAD once.
const PROD_SMOKE_WORKTREE = `${GATE_WORKTREE}-smoke`
const PROD_SMOKE_FLAGS = () => `--path ${shellQuote(PROD_SMOKE_WORKTREE)} --port ${GATE_SLOT_PORT_BASE + 90}`
async function runProdSmoke() {
  try {
    let r = null
    for (let i = 0; i < 2 && !(r && r.body); i++) { agentSpawned++; r = await runMechOp('prod-smoke', PROD_SMOKE_FLAGS(), { label: 'prod-smoke', phase: 'Review' }) }
    const b = r.body || {}
    const failure = b.green === true ? '' : b.failure || b.reason || r.error
    log(`◦ production-build smoke: ${failure || 'green'}`)
    return { green: !failure, failure, sha: b.head || b.sha }
  } catch (e) { return { green: false, failure: String(e), infraError: isInfraError(e) ? e : null } }
}
// The cross-feature review runs only when two or more built FRDs are linked (sonnet, high); a seam it reopens makes the
// run partial (the reopened FRD rebuilds next run). Returns false on a seam defect.
async function crossFeatureReview() {
  const linked = builtFrds.filter((x) => builtFrds.some((y) => y !== x && (frdUpstream(x).has(y) || frdUpstream(y).has(x))))
  if (!linked.length) return true
  agentSpawned += COST('sonnet')
  const r = await agent(`CROSS-FEATURE INTEGRATION REVIEW (DR-060) of the linked FRDs ${linked.join(', ')} — ${SEAM_CHECK} Review only: do NOT run the whole-project verify.sh, touch no \`phase\` or lease; you may commit a cross-feature test. A wrong seam: set its work order \`implementation_status: PLANNED\`, commit, return { done: false, failure }; else { done: true }.`,
    { label: 'cross-feature-review', phase: 'Review', model: 'sonnet', effort: 'high', agentType: 'pandacorp:reviewer', schema: STOP_SCHEMA })
  if (r && r.done === true) return true
  log(`⊘ cross-feature review: ${(r && r.failure) || 'no verdict'} — not released`)
  reopenedFrds.push(...linked)
  return false
}
// The scripted release close: the fail-closed asserts, ONE full verify.sh, phase release, the fenced lease release — one
// op. A building change card is archived first; anything else it cannot release falls back to the opus close-out. With a
// production smoke, the close is handed the SHA it judged: `stale-smoke` (product code moved past it) re-smokes HEAD once,
// and a red re-smoke returns { smokeRed } so the caller takes the not-released close.
async function scriptedReleaseClose(vq, smoke, fallback) {
  let smokeSha = smoke && smoke.sha
  const flags = () => `--token ${shellQuote(LEASE_TOKEN)} --epoch ${shellQuote(String(LEASE_EPOCH))}${vq ? ` --ui-skip ${shellQuote(vq.reason)} --ui-skip-frds ${shellQuote(builtFrds.join(','))}${vq.degraded ? ' --visual-qa degraded' : ''}` : ''}${smokeSha ? ` --smoke-sha ${shellQuote(smokeSha)}` : ''}`
  const closeOnce = async () => { agentSpawned++; return await runMechOp('close', flags(), { label: 'close-scripted', phase: 'Review' }) }
  let c = await closeOnce()
  if (c.body && c.body.status === 'archive-pending') {
    agentSpawned++
    await agent(`${archiveChangesBody}\nReturn { done: true }.`, { label: 'archive-changes', phase: 'Review', model: MECH, agentType: 'pandacorp:implementer', schema: STOP_SCHEMA })
    c = await closeOnce()
  }
  if (smoke && c.body && c.body.status === 'stale-smoke') {
    log(`◦ ${c.body.reason}`)
    const again = await runProdSmoke()
    if (again.infraError) throw again.infraError
    if (!again.green) return { smokeRed: again.failure }
    smokeSha = again.sha
    c = await closeOnce()
  }
  const b = c.body
  log(`◦ scripted close: ${c.error || (b ? `${b.status} ${b.failure || b.reason || b.verify}` : 'no receipt')}`)
  if (b && b.ok === true && b.status === 'released') return { done: true }
  return await fallback(smokeSha)
}
// The opus fallback close's own smoke-currency assert (fast lane, frontend): it may commit fixes after the smoke judged
// `sha`, so before phase release it re-smokes HEAD whenever product code moved past it (the scripted close's rule).
const SMOKE_CURRENT_ASSERT = (sha) => ` PRODUCTION-BUILD SMOKE (fail-closed): it judged ${sha}. Last, before phase: release: if \`git -C ${shellQuote(PROJECT_DIR)} diff --name-only ${sha} HEAD -- . ':!.pandacorp' ':!docs'\` prints anything, run \`${mechOpCommand('prod-smoke', PROD_SMOKE_FLAGS())}\`; unless its line's status is "green", do NOT set phase: release and return done:false naming the smoke.`

// The close-out prompts' shared text (both close-out shapes, lean and legacy, send these byte-for-byte).
const crossCloseHead = (reuse) => `All FRDs are VERIFIED and the DR-085 hardening left its evidence — now the CROSS-FEATURE INTEGRATION REVIEW (DR-060): ${SEAM_CHECK}${GATE_SKIP}${reuse.canReuse ? ` THEN — BL-0147 REUSE, do NOT re-run \`bash .pandacorp/verify.sh\`: gate-report.json already recorded ${REUSE_REPORT_CLAUSE(reuse)} — treat that as this step's whole-project result (it already covers the smoke + visual gates).${CLOSE_OUT_VERIFY_REUSED_EVENT(reuse.headSha, reuse.ageSeconds)}` : ` THEN run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since — includes the smoke + visual gates)`} and kill any test dev servers with TaskStop. FINALLY, before you may declare release, assert ALL of these ON DISK (BL-0012 + WS-D/D4 fail-closed) — if ANY fails, do NOT set phase: release and return done:false naming exactly what failed:
    ${RELEASE_ASSERT_I}
    ${RELEASE_ASSERT_II}
  If a cross-feature seam is wrong, reopen the offending work order (set it \`implementation_status: PLANNED\`) and return done:false with the finding. If everything integrates AND the full suite is green AND all of (i)+(ii) hold: set .pandacorp/status.yaml phase: release THROUGH the fenced state CLI, never by hand-editing the file (the lease owns the projected phase and the terminal quiesce re-projects it, silently undoing a hand edit): \`${STATE_CLI_COMMAND} set-phase --project "${PROJECT_DIR}" --token "${LEASE_TOKEN}" --epoch "${LEASE_EPOCH}" --phase release\` (it re-checks every FRD VERIFIED plus the hardening evidence and refuses otherwise; a refusal means you do NOT declare release)`
const crossCloseTail = () => `${JOURNAL_GOLD}${HARDENING_EVENT('integration')} (status ok iff you declared release, else fail.) If (and ONLY if) you set phase: release above, ALSO record the run's terminal verdict:${BUILD_COMPLETE('released', `${builtFrds.length}/${plan.frds.length}`)}`
const CROSS_CLOSE_NOTIFY = NOTIFY('Build COMPLETO: FRDs verificados + hardening + integracion cross-feature OK', 'Glass')
const runEndHead = (why, blk, needsOwner, reuse) => `The build run ended.${why} Verified this run: ${builtFrds.length}. Reopened (retry next run): ${reopenedFrds.length}. Blocked: ${blockedFrds.length} (${blk}). Of those, NEEDS-OWNER (a human must act): ${needsOwner.join(', ') || 'none'}.${GATE_SKIP}${reuse.canReuse ? ` FIRST — BL-0147 REUSE, do NOT re-run \`bash .pandacorp/verify.sh\`: gate-report.json already recorded ${REUSE_REPORT_CLAUSE(reuse)} — treat that as this step's whole-project result.${CLOSE_OUT_VERIFY_REUSED_EVENT(reuse.headSha, reuse.ageSeconds)}` : ` FIRST run the FULL \`bash .pandacorp/verify.sh\` (complete suite, NO --since)`} to confirm this pass left no global regression — note the result (a needs-owner-quarantined route is held aside, so its blocked state must NOT red this full-suite check; that is the whole point — the independent features still reach a green baseline while the blocked route waits on the owner, BL-0011). Then ${SYNC_ROLLUPS}${SYNC_ROLLUPS_COMMIT} (BL-0159 — `
const runEndMid = (blk) => ` Then write a short Spanish summary to .pandacorp/comms/progress.md (what advanced, what's blocked and the reason, the full-suite result, and exactly what needs the owner's action/decision for the needs-owner ones). **BL-0159 — narrate the LATEST state only:** the \`Blocked: … (${blk})\` reason/detail above for each FRD is already this run's FINAL verdict`
const hardeningIncompleteHead = (sec, telem) => `Every FRD is VERIFIED but the DR-085 hardening did NOT complete (security: ${sec && sec.done === true ? 'ok' : 'INCOMPLETE — ' + ((sec && sec.failure) || 'failed')}; telemetry: ${telem && telem.done === true ? 'ok' : 'INCOMPLETE — ' + ((telem && telem.failure) || 'failed')}`
const HARDENING_INCOMPLETE_MID = `). The project must NOT be declared released (BL-0012 fail-closed — release requires the hardening evidence). 1) Append the hardening failure + your recommendation to .pandacorp/inbox/decisions.md (needs-owner). 2) Write a short Spanish summary to .pandacorp/comms/progress.md (todo verificado, hardening incompleto, qué falta). 3) `
const HARDENING_INCOMPLETE_NOTIFY = NOTIFY('Build verificado pero hardening INCOMPLETO — NO se declara release; necesita tu decision')
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
  let visualQaState = null   // proposal 40: the scripted close's own record of a skipped/degraded visual QA (FAST only)
  // Proposal 40 §2 (Production-build smoke): `next build && next start` in a detached worktree at HEAD, in parallel with
  // visual-qa (which runs next dev and commits on the main tree). Red blocks the release like missing hardening evidence.
  const prodSmokePromise = FAST && plan.hasFrontend && builtFrds.length ? runProdSmoke() : null
  if (plan.hasFrontend && builtFrds.length) {
    const builtWos = builtFrds.flatMap((frd) => (frdState.get(frd) || {}).f?.workOrders || [])
    if (uiPassesRequired(builtWos)) {   // REV-D6: fails closed on a frdState miss, not just on a real UI artifact
      phase('Review')
      agentSpawned += COST(VISUAL_QA_MODEL)   // DR-073: weighted by the model actually spawned (E-3: sonnet by default, not P.judge)
      // REV-2: a REJECTED promise (terminal tool/API error) must degrade exactly like a null result —
      // caught HERE, at dispatch, so the bare `await visualQaPromise` below can never throw and strand
      // the close-out region before it reaches the terminal lease release.
      visualQaPromise = spawnVisualQa(builtFrds).catch(() => null)   // spawnVisualQa never throws (BL-0198); the catch stays as the REV-2 belt
    } else {
      logVisualQaSkipped()
      visualQaNote = UI_PASS_SKIPPED_EVENT('visual-qa', builtFrds.join(','), 'no-ui-artifacts')
      visualQaState = { reason: 'no-ui-artifacts', degraded: false }
    }
  }

  // DR-069 §7 verify-then-archive (durable, cross-run) — folded as a prompt fragment into whichever
  // closing prompt fires below; computed here, independent of hardening/visual-qa (never gates on either).
  let archiveStep = ''
  if (builtFrds.length) {
    archiveStep = `STEP 0 — archive landed changes FIRST, the DR-069 §7 verify-then-archive protocol (durable, cross-run):\n${archiveChangesBody}\n  THEN, in this SAME agent call: `
    log(`↷ archive sweep folded into the close-out agent (${builtFrds.length} FRD(s) verified this run)`)
  } else if (integratedChanges.length) {
    logChangesStillBuilding()
  }

  // Resolve visual-qa NOW — right before the terminal closing agent, and not one moment earlier — so
  // archiveStep/hardening above never depended on it. A missing/unconfirmed result degrades honestly.
  if (visualQaPromise) {
    const out = await visualQaPromise
    const vq = out && out.result
    if (vq && vq.done === true) {
      log(`Visual QA pass done over ${builtFrds.length} FRD(s) — see .pandacorp/comms/visual-punch-list.md`)
    } else {
      log(`⚠ visual-qa agent returned no confirmed result${vq && vq.done === false ? ` (done:false — reason: ${vq.reason ? String(vq.reason).slice(0, 300) : 'none given'})` : ''}${out && out.retried ? ' after one no-work retry (BL-0198)' : ''} — degrading honestly (punch-list may be incomplete this run)`)
      visualQaState = { reason: out && out.noop ? 'agent-noop-after-retry' : 'agent-no-result', degraded: true }
      visualQaNote = UI_PASS_SKIPPED_EVENT('visual-qa', builtFrds.join(','), out && out.noop ? 'agent-noop-after-retry' : 'agent-no-result') + ' VISUAL QA DEGRADED: the end-of-build visual QA pass did NOT return a confirmed result (agent failure/no-response) — its punch-list may be incomplete or missing this run. Note this explicitly in the progress/decisions write-up below so the owner knows to double-check fidelity by hand; the deterministic visual regression check inside the full verify.sh below is the remaining safety net.'
    }
  }

  const smoke = prodSmokePromise ? await prodSmokePromise : null
  if (smoke && smoke.infraError) throw smoke.infraError
  const smokeRed = smoke && smoke.green !== true ? smoke.failure : ''
  phase('Review')
  const needsOwner = blockedFrds.filter((x) => blockedReasons[x] === 'needs-owner')
  // Project-wide hardening/release is authority a bare whole-project run owns. A targeted FRD/change
  // run closes as a scoped partial run even when its final gate happens to make every global WO VERIFIED.
  const releasable = () => !TARGETED && !stopReason && !deferredWork && blockedFrds.length === 0 && reopenedFrds.length === 0 && builtFrds.length === plan.frds.length   // WS-D/D4a: a drained change's deferred WOs (into an already-planned FRD) block release this run
  const allDone = releasable() && (!FAST || (await crossFeatureReview()))   // proposal 40: the fast lane's seam review comes first; a reopened seam makes the run partial
  if (allDone) {
    const { sec, telem, hardened } = await runHardeningChain()
    phase('Review')
    // The opus release close-out (the classic lane's, and the fast lane's fallback when its scripted close cannot release).
    const llmReleaseClose = async (smokeSha) => {
      agentSpawned += COST(P.judge)
      const reuseLeanCloseOut = await checkFullVerifyReuse()
      const out = await agent(`${archiveStep}${crossCloseHead(reuseLeanCloseOut)} (commit it as part of this step's own commit — \`running\` is set to false by the terminal lease release at the very end of this prompt, NOT by hand here).${crossCloseTail()}${smokeSha ? SMOKE_CURRENT_ASSERT(smokeSha) : ''}${visualQaNote}${RELEASE_LEASE} Return done:true ONLY once every step above succeeded — phase:release committed, the terminal verdict recorded, AND this terminal lease release.${CROSS_CLOSE_NOTIFY}`,
        CLOSE_OUT_OPTS())
      // WS-A/D5: don't assert success the close-out did not confirm — a dead close-out returns done:false
      // (the fail-safe below then guarantees running:false); log honestly instead of a blanket "verified".
      logReleaseOutcome(out)
      return out
    }
    // Not released: the hardening is incomplete or the production smoke is red (before the release or on its re-smoke).
    const needsHardeningClose = async (red) => {
      agentSpawned++
      const out = await agent(`${archiveStep}${hardeningIncompleteHead(sec, telem)}${red ? `; production-build smoke: RED — ${red}` : ''}${HARDENING_INCOMPLETE_MID}Do NOT touch \`phase\` (KEEP it implementation) — \`running\` is set to false by the terminal lease release at the very end of this prompt, NOT by hand here.${visualQaNote}${RELEASE_LEASE} Return done:true ONLY once status.yaml/decisions.md reflect the above AND this terminal lease release succeeded.${HARDENING_INCOMPLETE_NOTIFY}`,
        NEEDS_HARDENING_OPTS())
      logRunEnded(false)
      return out
    }
    if (hardened && !smokeRed) {
      closed = FAST ? await scriptedReleaseClose(visualQaState, smoke, llmReleaseClose) : await llmReleaseClose()
      if (closed && closed.smokeRed) closed = await needsHardeningClose(closed.smokeRed)
    } else {
      closed = await needsHardeningClose(smokeRed)
    }
  } else {
    // BL-0159: carry the concrete failure TEXT alongside each blocked_reason code — the engine's OWN
    // live in-run state (blockedFailures, populated by blockFrd at the exact moment each FRD's terminal
    // verdict was decided THIS run), never a re-derivation the closing agent has to go hunting for in
    // older gate-attempt transcripts or a stale decisions.md entry.
    const { blk, why, ownerMsg } = runEndSummary(needsOwner)
    agentSpawned++   // WS-A/D4: honest counter — every spawn site increments (DR-070); notify-end was the one omission
    const reuseLeanNotifyEnd = await checkFullVerifyReuse()
    closed = await agent(`${archiveStep}${runEndHead(why, blk, needsOwner, reuseLeanNotifyEnd)}the WO count you are about to report MUST be this freshly-recomputed one, never a figure remembered from earlier in the run: a gate/repair/block resolved AFTER the last sync would otherwise under- or over-count against the real \`wo-*.md\` files on disk).${runEndMid(blk)} (a later gate/repair attempt supersedes an earlier one automatically — blockedReasons/blockedFailures are never stale). Never narrate an earlier reject/findings you might recall from this run's own transcript as if it were still the open issue once a later attempt changed the outcome — if a fix commit landed and a later gate re-blocked for a DIFFERENT reason (or none), report THAT reason, not the first one you saw. Do NOT touch \`phase\` (leave it as-is) — \`running\` is set to false by the terminal lease release at the very end of this prompt, NOT by hand here.${visualQaNote}${JOURNAL_GOLD}${BUILD_COMPLETE('partial', `${builtFrds.length}/${plan.frds.length}`)}${RELEASE_LEASE} Return done:true ONLY once status.yaml/progress.md reflect the above AND this terminal lease release succeeded.${NOTIFY(ownerMsg)}`,
      { label: 'notify-end', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
    logRunEnded()
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
      const out = await spawnVisualQa(builtFrds)
      const vq = out.result
      if (vq && vq.done === false) log(`⚠ visual-qa returned done:false — reason: ${vq.reason ? String(vq.reason).slice(0, 300) : 'none given'}${out.retried ? ' (after one no-work retry, BL-0198)' : ''} (E2 finding 5)`)
      else if (!vq || vq.done !== true) log('⚠ visual-qa agent returned no confirmed result — the punch-list may be incomplete this run')
      else log(`Visual QA pass done over ${builtFrds.length} FRD(s) — see .pandacorp/comms/visual-punch-list.md`)
      if (out.noop) visualQaSkipEvent = UI_PASS_SKIPPED_EVENT('visual-qa', builtFrds.join(','), 'agent-noop-after-retry')
    } else {
      logVisualQaSkipped()
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
    logChangesStillBuilding()
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
      closed = await agent(`${crossCloseHead(reuseLegacyCloseOut)} and running: false. Return done:true once status.yaml is written.${crossCloseTail()}${CROSS_CLOSE_NOTIFY}`,
        CLOSE_OUT_OPTS())
      logReleaseOutcome(closed)
    } else {
      agentSpawned++
      closed = await agent(`${hardeningIncompleteHead(sec, telem)}${HARDENING_INCOMPLETE_MID}Set .pandacorp/status.yaml running: false and KEEP phase: implementation. Return done:true once status.yaml is written.${HARDENING_INCOMPLETE_NOTIFY}`,
        NEEDS_HARDENING_OPTS())
      logRunEnded(false)
    }
  } else {
    // BL-0159: see the lean-close-out twin above for why this carries failure text, not just the code.
    const { blk, why, ownerMsg } = runEndSummary(needsOwner)
    agentSpawned++
    const reuseLegacyNotifyEnd = await checkFullVerifyReuse()
    closed = await agent(`${runEndHead(why, blk, needsOwner, reuseLegacyNotifyEnd)}report THIS freshly-recomputed WO count, never a figure remembered from earlier in the run).${runEndMid(blk)}; never narrate an earlier reject/findings from this run's own transcript once a later attempt superseded it. Set .pandacorp/status.yaml running: false. Return done:true once status.yaml is written.${JOURNAL_GOLD}${BUILD_COMPLETE('partial', `${builtFrds.length}/${plan.frds.length}`)}${NOTIFY(ownerMsg)}`,
      { label: 'notify-end', phase: 'Review', model: MECH, agentType: MECH_AGENT('pandacorp:implementer'), effort: MECH_EFFORT, schema: STOP_SCHEMA })
    logRunEnded()
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
} catch (e) {
  if (!isInfraError(e) && !infraHalt) throw e
  log(`⏸ infra halt during the drain/close-out (${(e && e.message) || e}) — the run pauses instead of closing`)
  return await pausedExit({ inFlight: gatesInFlight, builtFrds, blockedFrds, reopenedFrds, blockedReasons, blockedFailures })
}

return { mode: MODE, builtFrds, blockedFrds, reopenedFrds, blockedReasons, blockedFailures, stopReason, ...fastResult() }
