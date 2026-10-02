# 40 — `implement` speed v2: a cheaper review tail and DAG-parallel building

**Status:** proposed, revised after one red-team per lever · **Date:** 2026-10-02
**Home:** FACTORY proposal (build engine). Plugin 9.119.0; the fast lane is the default (DR-124, proposal 39). Nothing here has been executed.

PROJECTION means arithmetic on measured spans. The transcript cost recompute reads about 18-21 % above `results.md` (FM-3: 74.2 vs 61.2 $-eq), so **compare ratios, not dollars**. Dollars are notional: the owner is on a subscription, and the usage windows are the scarce resource.

---

## TL;DR

1. **Nothing after the builder ever changed an oracle result.** Every fast-lane run was already at 151/151 or 289/289 at USABLE. The tail after that point (about 30 min on the small bench, +40.4 min on FM-3) only buys quality the oracle does not measure. Almost all of it comes from the opus FRD gate, 38-62 % of the cost.
2. **Lever 1: keep the gate, make it cheaper, trim around it.** `xhigh` stays on the floor and on injection-style content; `high` elsewhere only if a planted-defect replay proves it catches what `xhigh` catches. The gate writes tests for findings plus probes, not a blanket suite; the builder gets the known traps up front; `verify-patch`/`certify` merge into the scripted verify; oracle runs are deduplicated; the security delta and telemetry become conditional; the close-out stops doing engine-bug work. **Added:** one production-build smoke.
3. **Lever 2: parallel building is viable, at WO level rather than FRD level.**
   The WO graph (`dependsOn`, DR-087) is acyclic; Mission Control's FRD graph is not. Chains of ≤ 3 WOs go to K worktree builders, landed one at a time (rebase → check → ff). K is static: 2 by default, **auto 1** when the DAG is narrow. A usage limit is a global pause, never a failure.
4. **PROJECTION (done time):**

   | Build | Today | After |
   |---|---|---|
   | Small | ≈ 43 min | ≈ 32-37 min |
   | Medium | 108 min | ≈ 70-90 min |
   | Large | ≈ 11 h | ≈ 6 h at K = 2 |

   Vanilla stays 3-12× faster; that gap is the cost of review.
5. **Nothing becomes a default without passing the pre-registered thresholds in §6.**

---

## §1 · Evidence

| Fact | Source |
|---|---|
| Small bench, fast lane vs vanilla:<br>• Fast lane: USABLE at 8.0 / 11.8 min, VERIFIED + close-out in 40.1-44 min, oracle 151/151.<br>• Vanilla: 2.6-5.5 min, 151/151. | `pandacorp-bench-form/runs/F-{1,2,3}/`, `runs/results.md` (B-3/B-4) |
| FM-3: the four FRDs were USABLE at 28.7 / 42.8 / 55.5 / 67.8 min. All VERIFIED at 99.9, done at 108.2, oracle 289/289, 0 interventions. Vanilla 11.5-12.1 min (V-2 scored 285/289: missed focus traps). Classic C-1: about 132 min. | `pandacorp-bench-medium/runs/results.md`, `runs/FM-3/wf_2c17cde1-108/` |
| The gate's share of cost is 38.6-43 % on the small bench and **61.8 %** on FM-3. On FM-3 it found 0 product defects and wrote about 2,800 lines of reviewer tests. | recomputed from transcripts |
| What the gate catches beyond the oracle:<br>• Benches: stale `errors` on Enter (2 of 2), UTF-16 length (1 of 1). Both were introduced by the builder; vanilla never had them.<br>• Mission Control: about 12 missing behaviours, about 10 reuse findings, 2 hydration bugs.<br>• ppv2: a JSON-LD XSS. | F-1/F-3 probe, F-2 `validate.reviewer.test.ts` |
| Steps that found nothing:<br>• `verify-patch`: no writes in 4 of 4 runs.<br>• `certify`: wrote only WO and status files.<br>• Security delta: no finding in 7 of 7 runs, all on benches with no attack surface. | FM-3, F-* |
| FM-3 builder: 50.6 % of the critical path. It ran self-verify 14 times (8.2 min), then the scripted verify ran again (8.5 min). | FM-3 |
| FM-3 stalls: apply-gate blocked a dispatch 2.8 min; FRD-03's gate started 23 min after a slot freed. | `journal.jsonl` |
| Production CSP broke every blog post for about 2 months while every `next dev` gate stayed green. | ppv2 `f4ed29a` |
| Mission Control: 24 FRD folders, **110 WOs, 103 with `dependsOn`** (counted 2026-10-02). From the design pass: the WO graph is acyclic, 8 levels deep, up to 21 WOs wide. The FRD graph is cyclic (01↔05, 02→06→04→02). | `mission-control/docs/frds/*/work-orders/` |

---

## §2 · Lever 1: decisions after the red-team (PROJECTION)

| Step | Decision | Mechanism | Time saved | Usage saved | What can slip, and its bound | DR |
|---|---|---|---|---|---|---|
| Builder trap checklist | **Add**; ships first and is measured alone | The builder prompt lists the traps the gate has caught before: functional setState with no stale closures, `[...s].length` vs `String.length` per spec, `Date.parse` instead of lexicographic ISO comparison, no nested interactive elements, dialog focus trap, `cn()` merge groups, numeric bounds including 5+-digit years | unmeasured | ≈ 0 | nothing; it moves catches earlier | 124 |
| Opus FRD gate | **Cheaper**, only if the replay passes | **Effort:** `xhigh` on the floor and on non-floor diffs with injection-style content (the delta's content triggers); `high` elsewhere. **Tests:** regression tests for findings only, plus adversarial probes, at least 1 and at most 5 per WO, aimed at interaction, async and boundary edges | ≈ 5 per gate (critical path: the last FRD only) | small ≈ -$3.3, FM-3 ≈ -$16 | a thinner net off the floor; bounded by `xhigh` on floor and injection content, the checklist, and the §6.3 kill rule | 015, 072(5), 080, 124 |
| Harness-marker findings | **Prompt rule** | A harness-marker or opt-out finding is always raised on the **first** pass (replaces the rejected "skip re-gate", §5 A2) | 0 counted | 0 | — | 124 |
| Patch | **Keep**; cheaper model off the floor | Sonnet for bounded findings (30 lines or fewer) off the floor, opus on the floor. After one red verify it escalates to opus. Reuses the WP-08 router | — | small | a green but wrong patch; bounded by the RED-proven test plus tsc, biome and knip | 073 |
| `verify-patch` + `certify` | **Merge into scripted verify** | The `verify` mech op first checks the reviewer-test hash (now mandatory), then runs the RED-proven test and the suite. A new `certify-state` mech op writes WO VERIFIED, `status.yaml` and the last-green snapshot | 2.3-4.8 per red FRD | ≈ $1 per red FRD | nothing new: the script is the independent checker (DR-097) | 073, 097 |
| Self-verify / scripted verify | **Cheaper** | Per WO: `verify.sh --since` runs only the related tests. The full FRD suite runs once before USABLE. `reuse-check` reuses a green result only from a script-written report whose SHA matches HEAD and whose content hash is intact | FM-3 ≈ 8-10 | ≈ 0 | nothing | 106, 118 |
| Re-verify / apply-gate | **Cheaper** | Re-verify is skipped when the gate wrote back tests only. Apply runs under the main-writer mutex and never blocks a dispatch (§3) | FM-3 ≈ 5 | ≈ 0 | full suite still runs at close-out | 106, 118 |
| Eager gate launch | **Add** | A gate starts as soon as a slot frees | FM-3 ≈ 2 | 0 | — | 118 |
| Visual-QA | **Keep** | Sonnet, once per build, skipped when there is no UI. It is the only catcher of the `cn()` drop, and in F-3 it fixed product code | 0 | 0 | — | 072 |
| Early security audit | **Keep** | Runs in parallel. It is the only catcher of a real Critical (ppv2) | 0 | 0 | — | 085 |
| Security delta | **Conditional** | Runs when a deterministic rule next to `product-floor.mjs` P4 detects either:<br>• a **path trigger**: routes, server actions, middleware, `next.config`, headers, auth, dependencies, lockfile;<br>• a **content trigger**: `dangerouslySetInnerHTML`, `innerHTML`, `eval`/`new Function`, `$queryRaw`, fs path joins, redirect or fetch built from input, cookies | ≈ 0 on server projects; 0.7-2.4 on client-only builds | up to ≈ $1.1 | client-only bugs outside the triggers; bounded by the early audit and the floor | 085, 124 |
| Telemetry | **Conditional**, in parallel | Runs only if `docs/analytics/events.md` exists. A plan with no emitters fails loud | 0.2 | ≈ $0.4 | — | 085 |
| Close-out | **Cheaper**; the LLM part becomes conditional | **Engine fixes:** the security report gets a local-time name; gate-release commits its own tests; the gate blesses new-route baselines at green, with DR-080 provenance, and never the builder. **Scripted close:** one full `verify.sh` (about 2 min), then phase and lease. **Cross-feature review:** sonnet `high`, only when 2 or more built FRDs are linked | small 4-5, FM-3 ≈ 2 | small -$4.4, FM-3 -$3.4 | seam bugs (none seen so far); the full suite still runs | 072(5), 124 |
| Fix-forward retry | **Cheaper** | A mech `commit-wo` only when the WO was "not committed" and its tests are green. Anything else goes to a sonnet agent | ≈ 1.4 per occurrence | ≈ $1.1 | — | 073 |
| Fused start, mech plumbing, floor classifier | **Keep** | Already cheap | — | — | — | 124 |
| Production-build smoke | **Add** | `next build && next start`, in parallel with visual-QA. It visits every blessed route plus one sample per dynamic route, and goes red on a CSP console violation, a rendered error boundary, or an empty `<main>` | adds 1-3 to the tail | ≈ 0 | closes the class of bugs that only show up in a production build | 106 |

**Lever 1 net:**

| Bench | Time | Usage |
|---|---|---|
| Small | **-9 to -12 min**, or about -8.5 if the replay fails | about -$7 to -9 |
| FM-3 | **-17 to -22 min** | about -$19 to -21 |

---

## §3 · Lever 2: DAG-parallel fast lane (after the red-team)

Proposal 39 §11 put lanes off because large builds hit the usage limit regardless. FM-3 since showed the build half sits **on** the critical path (the builder is 50.6 % of it), and Mission Control's graph shows enough width to exploit. K stays conservative because the usage window is still the real limit.

### Phase A: event loop (K = 1, no worktrees)

- A `Promise.race` over builds, USABLE verifies, gates, applies and patches.
- One **main-writer mutex** (the existing `main-writer.lock`) covers apply, patch and `commit-wo`.
- Gates launch eagerly (§2).
- Honest gain: about 4-5 min of done time on FM-3, plus an earlier VERIFIED for each FRD. The 7.9, 6.3 and 14.1-min apply waits are real but sit off the done path.

### Phase B: chains in a worktree pool

1. **Chains.** A chain is up to 3 WOs from one FRD, built in dependency order. The ready set is recomputed after every landing, so a cyclic FRD graph gets sliced (FRD-01 slice 1, then FRD-05, then FRD-01 slice 2).
2. **Foundation.** The foundation is DAG-driven, which matches the blueprint's own disjoint-artifact waves. A chain touching `prisma/**`, migrations, `package.json` or the lockfile is a **barrier**:
   - it builds on main (`schema-off-main` stays);
   - lane *landings* pause until it commits;
   - lane *builds* continue.
3. **Pool.** Created alongside the fused start (about 2.5 min). Each dispatch:
   - runs `git reset --hard <main>`;
   - resyncs (install, `prisma generate`, DB reset) when the lockfile, `prisma/**` or migrations changed;
   - gets its own port offset;
   - sets an env flag forcing Playwright `reuseExistingServer: false`, so a lane can never test a sibling's server.

   The one package-owning chain installs online. Disk budget: K + gate slots + 1 snapshot worktree.
4. **Lane builder.** Works exactly as today on `lane/<chain>`: TDD, `commit-wo` per WO, then self-verify with static checks, unit tests and the lane's own e2e.
5. **`land-chain`.** One chain at a time:
   1. Rebase, keeping **one commit per WO** (DR-097).
   2. Run tsc, biome and `vitest related`.
   3. `ff-only`.
   Track journals get a `merge=union` driver, with SHAs re-keyed by WO id; `messages/*.json` merges by key union (same key, different value → red); a conflict gets one rebase-fix, then parks; FIFO, longest downstream path first.
6. **USABLE.** Unchanged: one full `verify.sh` per FRD, on a pinned SHA, in a snapshot worktree (DR-115). A red result is never answered by reverting the most recent chain. Instead:
   1. Classify the failure.
   2. Bisect the 1-3 candidates in parallel snapshot worktrees.
   3. Hand it to the fix-forward patch ladder.

   A revert takes the chain's full descendant closure with it, and never happens automatically after USABLE.
7. **Concurrency.** Static K: default 2, `--lanes N` overrides, auto 1 when the ready width is ≤ 1 or the gain is below the bootstrap; mode caps pro 1 / balanced 2 / powerful 4.
8. **Usage limit.** It is a **global pause** until the window resets. It never counts as an attempt, a park or a revert.
9. **Isolation.** A lane still red after 3 attempts is parked. Only its DAG descendants wait, and the blocked-FRD set is reported at once.
10. **Resume.** From git plus the journal (`{chain, worktree, base SHA}`): the lane check re-runs before re-queuing; partial work restarts from the last committed WO (DR-086); the board derives lane state from the journal.
11. **Incremental builds.** Bare `/implement` drains **every** ready card into one DAG. `--frds` and `--change` share the same scheduler. A typical 1-FRD change runs at auto K = 1, which is today's speed with no new risk. The rule that upstream must be VERIFIED still applies.

### Phase C: third gate slot

Comes only after Lever 1 and FM-5. Gates are $37.6 of the $61.2 on FM-3, so a third slot multiplies the dominant cost.

### Usage (corrected)

- FM-3 ran at **0.57 $-eq/min**. Measured per role: a sonnet builder is 0.22 $/min, an opus gate 0.52 $/min.
- Projected burn rate:

  | Setup | $-eq/min | vs today |
  |---|---|---|
  | K = 2 + 2 gates | ≈ 1.5 | ≈ 2.6× |
  | K = 4 + 3 gates | ≈ 2.4 | ≈ 4× |

- Total usage grows ≈ +0.75 $-eq per extra chain (+3-5 medium, ≈ +45 Mission Control). Wall time can never fall below total usage ÷ window rate; only Lever 1 lowers the total.

---

## §4 · Combined PROJECTION

| Size | Metric | Today (measured) | Lever 1 | Lever 1 + 2 | Vanilla |
|---|---|---|---|---|---|
| Small (1 FRD, 3 WOs) | USABLE / done | 8.0-11.8 / 40-44 min | 7-11 / **32-37** | same (auto K = 1) | 2.6-5.5, no review |
| | Usage | 1× | ≈ 0.6-0.7× | same | ≈ 0.03-0.1× |
| Medium (4 FRDs, 10 WOs) | All USABLE / done | 67.8 / 108.2 | ≈ 58-63 / 87-93 | **≈ 45-58 / 70-90** (K = 2) | 11.5-12.1 |
| | Usage | 1× | ≈ 0.73× | ≈ 0.78× | ≈ 0.06× |
| Large (Mission Control: 110 WOs, 23 FRDs) | Done | ≈ 11 h (sequential, extrapolated) | ≈ 9.5-10 h | **≈ 6 h (K = 2); ≈ 3.5-4 h (K = 4)** | unmeasured (about 2 h linear, no review) |
| | Usage ($-eq) | ≈ 450-500 | ≈ 360-400 | ≈ 400-445 | — |

The medium low end assumes `high` passes the replay. The large row is an **upper bound** (4.44-min mean WO from 10 WOs, 3-4 min overhead per chain, CPU contention unmeasured); at K = 4 the burn rate likely exceeds the window.

---

## §5 · Red-team record

### Lever 1

| # | Objection | Disposition |
|---|---|---|
| A1 | `high` at line 3303 is the split *closer*; a serial `high` gate is unmeasured. Fast gates missed the 5-digit year 3/3 (classic 1/3). Five probes per FRD erodes DR-080. The ppv2 XSS was off the floor. | **Accepted.** The n = 3 A/B is replaced by the replay (§6.3). Probes are now at least 1 and at most 5 per WO. Injection content stays at `xhigh`. The checklist ships first. |
| A2 | The FM-3 FRD-04 "re-gate" was a thin-green verdict that the BL-0211 re-ask correctly turned red; its patch fixed a real 390 px failure. | **Accepted.** The skip is withdrawn and replaced by the first-pass rule. No saving is counted. |
| B | Certify does the honesty writes, and a patcher could weaken the RED test. | **Accepted.** `certify-state`, a mandatory test hash, sonnet escalating to opus, and the WP-08 router. |
| C | A report the builder can write could be reused, and the re-verify saving was overstated. | **Accepted.** Script provenance + SHA + hash; the full suite still runs before USABLE; the saving is cut to about 5 min. The eager launch it suggested is added. |
| D, E | — | **Approved.** |
| F | The delta is the only security review of FRDs 2..N. The benches have no attack surface. The XSS was in a page. | **Accepted.** Content triggers added; the saving is now about 0 on server projects. |
| G | A plan with no emitters must fail loud. | **Accepted.** |
| H | A scripted bless loses the mock comparison, and the full verify is not free. | **Accepted.** The gate blesses at green; `verify.sh` is budgeted at about 2 min. |
| I | A blind mech re-commit just refuses again. | **Accepted.** Mech re-commit only for "not committed" with green tests. |
| Smoke | A 200 response passes even when the CSP breaks the page. | **Accepted.** Console, error-boundary and `main` checks; 2-4 min budget. |
| Totals | The totals are overstated. | **Accepted.** §2 and §4 use the red-team's recomputation. |

### Lever 2

| # | Objection | Disposition |
|---|---|---|
| B1 | Phase A doesn't recover 14-17 min of done time. | **Accepted.** Restated as about 4-5 min; mutex added. |
| B2 | The foundation rule is contradicted, and 01-003 owns the schema, package and lockfile. | **Accepted.** DAG-driven foundation, with a schema/package barrier on main. |
| B3 | Stale Prisma client or DB, reuse of a sibling's server, and offline install failures. | **Accepted.** Resync triggers, forced no-reuse, online install, disk budget. |
| B4 | `track.jsonl` appends conflict on every rebase, and SHAs go stale. | **Accepted.** Union driver, one commit per WO, re-keying. |
| B5 | Reverting the latest chain blames the wrong chain and breaks its descendants. | **Accepted.** Classify → bisect → fix-forward; a revert takes the full closure only. |
| B6 | The journals are not in the shared-file set. | **Accepted.** |
| B7 | The rate was 0.57 $/min, not 1.6, and the usage limit is account-wide. | **Accepted.** Global pause; default K = 2. **Own extension:** with the limit no longer a trigger, AIMD has no signal left worth its machinery, so it is dropped in favour of a static K. |
| B8 | Cyclic FRDs widen the impact of a parked WO. | **Accepted.** The blocked-FRD set is reported immediately. |
| B9 | Self-verify isn't recorded in git, and IN_REVIEW on lane branches is invisible. | **Accepted.** The lane check re-runs on resume; the board reads the journal. |
| B10 | — | **Approved.** |
| B11 | The overhead is understated. | **Accepted.** §4 uses 45-58 for all-USABLE; the large row is marked as an upper bound. |
| B12 | A third slot amplifies the dominant cost. | **Accepted.** Phase C is gated. |

No objection was rejected. Two design-pass ideas were withdrawn outright: A2's skip and B5's revert.

---

## §6 · Measurement plan (pre-registered)

**Arms:** F = today's fast lane (F-1..3, FM-3); F1 = Lever 1; FL = Lever 1 + lanes; V = vanilla.
**Recorded every run:** T_usable per FRD, all-USABLE, all-VERIFIED, done; oracle at USABLE and final; usage by role and peak $/min; 429s and pauses; interventions; gate red rate; for lanes, landing conflicts, bisects and false greens.

### 6.1 Small bench (F1, n = 3)

- **Pass:** 151/151 at USABLE and at final in every run; median done ≤ 37 min; usage ≤ 0.75× F; 0 interventions; the production smoke runs green.
- **Kill:** revert the phase if any run falls below 151, or if the median done is above 40 min after one fix.

### 6.2 Medium bench (FM-4: F1, K = 1, n = 1. FM-5: FL, K = 2, n = 2)

- **FM-4 pass:** 289/289; done ≤ 93 min; usage ≤ 0.8× FM-3.
- **FM-5 pass:**
  - 289/289 at both points;
  - all USABLE ≤ 58 min;
  - done ≤ 0.85× FM-4;
  - **0 false greens**, checked against server logs and ports;
  - at most 1 rebase-fix per 5 landings;
  - a usage pause is never logged as an attempt, park or revert.
- **Also measured:** contention, landing minutes, peak $/min, and gate red rate vs FM-3 (the signal of context lost by chain builders).
- **Kill lanes** (K stays at 1, Phase A is kept) if all-USABLE gains less than 10 min vs FM-4, any false green appears, or a pause is misclassified.

### 6.3 Planted-defect gate replay

**Setup.** Frozen pre-patch SHAs of F-1, F-2, F-3 and FM-3 FRD-04. Catches: stale `errors`, UTF-16 length, 390 px responsive, and the 5-digit year (a known miss: scored, not a kill criterion).

Each SHA is gated at `xhigh` and at `high` (with the new mandate), **N ≥ 5 per arm**.

- **Pass:** for every catch, the catch rate at `high` is at least the rate at `xhigh`, and `high` uses no more than 0.75× the gate minutes.
- **Kill** if `high` misses any catch more often than `xhigh`: every FRD stays at `xhigh`; only the test-mandate and checklist savings ship.
- **Measured first:** the checklist on its own, by re-running the builder on the same SHAs.

### 6.4 Lane canaries

SIGKILL at four points: mid-rebase, between ff and the journal write, mid-resync, and during a barrier. A quota canary also feeds every lane limit errors for 30 min.

**Pass:** 0 IN_REVIEW WOs without a commit, 0 blended commits, 0 lost branches, no committed work rebuilt, and the pause resumes every lane.

---

## §7 · Phased implementation (each phase ships alone)

Tests go in `plugin/scripts/test-pandacorp-build.mjs` (mech and `product-floor` suites beside it).

| Phase | Ships | Named tests | Bump |
|---|---|---|---|
| 0 · Replay harness | A planted-defect replay over frozen SHAs | `replay-reproduces-original-catch-at-xhigh`, `replay-freezes-sha-and-restores` | PATCH |
| 1 · Engine-bug and plumbing fixes | <ul><li>Report date; gate commits its own tests; gate blesses with provenance</li><li>Scripted close; conditional mech fix-forward</li><li>`reuse-check` provenance; per-WO `--since`; re-verify skip</li><li>Conditional delta and telemetry; production smoke</li></ul> | `closeout-security-report-local-date`, `gate-blesses-new-route-with-provenance`, `reuse-check-rejects-builder-written-report`, `security-delta-content-trigger-dangerouslySetInnerHTML`, `telemetry-plan-without-emitter-fails-loud`, `prod-smoke-red-on-csp-violation` (replays `f4ed29a`) | MINOR |
| 2 · Event loop | `Promise.race`, the mutex, eager gates | `apply-gate-never-blocks-dispatch`, `main-writer-mutex-serializes-apply-patch-commit`, `gate-launches-when-slot-frees` | MINOR |
| 3 · Patch-ladder merge | `certify-state`, mandatory test hash, sonnet patch with escalation | `reviewer-test-hash-tamper-red`, `sonnet-patch-escalates-after-red`, `certify-state-writes-wo-and-status` | MINOR |
| 4 · Gate trims | The checklist first. Then, only after §6.3 passes: effort by floor or content, findings + probes, the first-pass marker rule, conditional cross-feature review | `builder-prompt-carries-trap-checklist`, `gate-effort-xhigh-on-injection-content`, `probe-mandate-min-one-per-wo`, `harness-marker-raised-first-pass` | MINOR |
| 5 · Lanes, behind `--lanes` (auto 1 until §6.2 passes) | <ul><li>Pool with resync; chains; schema barrier</li><li>`land-chain` with union journals; i18n key union</li><li>Bisect → fix-forward; static K; global pause</li><li>Lane resume; drain all cards</li></ul> | `cyclic-frd-graph-sliced-by-ready-set`, `schema-chain-pauses-landings`, `lane-never-reuses-sibling-server`, `land-chain-union-merges-track-journal`, `usable-red-bisects-then-fixforward`, `usage-limit-global-pause-not-attempt`, `auto-k1-on-narrow-dag` | MINOR |
| 6 · Third gate slot | `gateSlots` 3 when 3 or more FRDs are ungated | `third-slot-only-when-three-ungated` | PATCH |

**DR amendments, recorded as each phase ships:**

| DR | Amendment |
|---|---|
| DR-015 / DR-080 | Findings + probes |
| DR-072(5) | `xhigh` on floor or injection content; conditional cross-feature review |
| DR-073 | Script certifies; sonnet patch; mech fix-forward |
| DR-085 | Conditional delta and telemetry |
| DR-106 / DR-118 | Verify dedupe, eager gates, smoke |
| DR-060 / DR-124 | Chains and lanes |

---

## §8 · Not in scope

- **Dropping the gate off the floor.** It is the only step with a beyond-oracle record, and two of its catches were bugs the builder introduced.
- **Vanilla parity.** The no-review alternative is still "build directly, then `/pandacorp:implement --review-only`" (proposal 39).
- **Large-project speed beyond the subscription window.** Past that point, only Lever 1 shortens the build.

---

## §9 · Orchestrator decision (2026-10-02, owner-delegated)

The owner set the balance explicitly: maximize speed for any project size, ~90 % reliability is acceptable, decide the trade-offs.
- **Ship Phases 1-4 (Lever 1) and Phase 5 (lanes, Lever 2). Skip Phase 0 (replay harness) and Phase 6 (third gate slot).**
- **Gate effort without the replay:** `xhigh` stays on floor FRDs and on non-floor diffs with injection-style content (the delta's content triggers); `high` elsewhere ships directly. Why: the gate now runs AFTER USABLE (the owner never waits for it), every oracle result was already final at USABLE (§TL;DR 1), and floor + injection content — the classes where a miss is costly (the ppv2 JSON-LD XSS) — keep `xhigh`. The check is the benches' oracle plus a blind judge, not a replay harness.
- **Lanes default:** K = 2 with auto 1 on a narrow DAG; `--lanes N` overrides. Accepted only if FM-5 meets §6.2 thresholds; otherwise lanes ship behind `--lanes` with auto 1.
- **Order:** Lever 1 first, measured (small n=2, medium FM-4), then lanes, measured (FM-5).
