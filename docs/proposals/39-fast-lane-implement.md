# 39 — Fast lane for `implement`: build like vanilla, review like a factory, off the owner's clock

**Status:** proposed, revised after two red-teams (correctness, speed) · **Date:** 2026-10-01
**Home:** FACTORY proposal (the build engine). Plugin 9.118.0 / overlay 8.95.0. Nothing here has been executed. Figures marked PROJECTION are arithmetic on measured spans; inputs marked UNMEASURED are Phase-0 work.

---

## TL;DR

1. **The wrong clock.** In A2/A3 the last WO reached `main` at **12.9 / 15.0 min**; review and close-out took 36-44 more. But ~13 min is still 2.5-4× vanilla, so moving the clock is not enough.
2. **Per-FRD milestones.** A non-floor FRD is **USABLE** when its WOs are committed on `main` and `verify.sh` is green on that clean landed SHA (push to the owner). A floor FRD is USABLE only when **VERIFIED** (the unchanged opus gate, DR-015).
3. **Small-scope solo lane** (≤ 1 FRD or ≤ 5 WOs): no plan agent, no foundation split, one sonnet builder working like vanilla, one scripted `commit-wo` per WO, one `verify.sh`. Target T_usable ≤ 2× vanilla.
4. **Larger projects:** foundation on `main`, then FRD lanes in worktrees through a landing train. They are **usage-bound** on a subscription, so the design guarantees clean halt/resume and pushes review to later windows.
5. **Safety contracts from the red-team:** an `infra` failure class (a usage limit is never a repair or a discard), a clean-tree invariant, stamp-anchored resume, fix-forward after USABLE, a deterministic floor, derived review debt.
6. **Kill criterion (§9):** shelve the build half if the small bench's T_usable exceeds 2× the vanilla median or usage exceeds 3× vanilla. The fallback is **build directly, then `/pandacorp:implement --review-only`**.

---

## §0 · Evidence

| Fact | Source |
|---|---|
| Engine 9.117.1: 84.3 min; 9.118.0: 51.4 / 58.6; vanilla sonnet 2.6-5.5 (n=4). All 151/151 | `pandacorp-bench-form/runs/results.md` |
| Judge: engine 93-95, vanilla 79 (token bug, 34 vs 156 tests); the gate (~20-25 min, ~half the cost) holds the edge | same |
| Haiku mech: 12-16 s spawn floor, ≈16 ops ≈ 9 min on the critical path (≈4.5 tool time); `gate-worktree` 2.5 min | A2/A3 rollups |
| F2: serial landing lane 40.1 of 54.3 gate-segment min. D2: 87.5 min for 3 WOs. Canary E1 cut by a usage limit at 12.18 $ with 11 × 429 | `38-…md` |
| No usage-limit/429/quota handling in the engine (`grep -i "429\|usage.limit\|quota"`: no hit) | `pandacorp-build.src.js` (5,767 lines) |
| `classify-change.mjs`: deterministic, fail-closed, backtested; floor covers auth, middleware, `app/api`, data layer, migrations, PII on schema surfaces | `plugin/scripts/classify-change.mjs` |

---

## §1 · Decision

Add `lane:'fast'|'classic'` to `/pandacorp:implement`. `classic` stays byte-identical. `fast` becomes the default only after §9 passes.

Invariants: every review that runs today still runs at the same tier and effort; one commit per WO, carrying its IN_REVIEW flip; one writer per checkout; **a clean tree** at every verify, train, USABLE and gate start; `last_green_sha` advances only on VERIFIED, never on USABLE (BL-0066).

---

## §2 · Mechanism

### C1 · Scripted mech

New `plugin/scripts/pandacorp-build-mech.mjs` (the `pandacorp-build-state.mjs` pattern). Every op prints one sealed JSON line:
- `precheck`, `lane-open`, `slot-prepare`, `slot-release-port`;
- `apply-gate`, `certify`, `reuse-check`, `relock`, `land-train`, `park-wo`.

Each MECH prompt becomes "run exactly `<cmd>`, return its last line". A haiku spawn is still needed (no shell in a Workflow), so the projection is **ops × 0.25 min + tool time**: about 4-5 min saved per bench run, not 9. `safePoint()` spawns the LLM drain only when the probe finds work.

**`precheck` order** (before the planner reads anything): `recoverPendingReverts` → `recoverFrdBranches` (salvage, abort rebase, audit, land what is committed) → on `main`, salvage **engine-owned** dirt (WO frontmatter, `.pandacorp/run`) to `.pandacorp/run/salvage/` and reset it to HEAD → demotion check (C7). Owner dirt is never touched: the build runs in a worktree and lands only when `main` is clean.

### C2 · `commit-wo`

The builder never writes git commands. After each WO it runs `commit-wo --wo <id> --files <declared> [--extra <path> --reason <r>]`, which:
1. takes `.pandacorp/run/main-writer.lock` (mkdir lock, 10-min stale reclaim);
2. **refuses** if `git status --porcelain` shows a modified path that is neither declared nor `--extra`;
3. refuses a schema or migration path (classifier S5 path patterns) on any checkout other than `main`;
4. re-runs **only the unit/component tests related to the staged files** (`vitest related --run`), never e2e; e2e runs once at verify;
5. stamps IN_REVIEW, stages declared + extra paths, the WO markdown and the journals, and commits once, naming the WO (extras listed in a trailer);
6. asserts the tree is clean afterwards.

It also refuses when some `AC-NN-MMM.K` of the WO is cited by no test (unless `tests: none` with a reason), or another WO's frontmatter changed; on failure it restores the stamp and exits non-zero. A fix to an earlier own-FRD WO is a separate `--fixup <wo>` commit.

**`park-wo <id>`** moves a `green:false` WO's dirty paths to `.pandacorp/run/salvage/<wo>/` and resets them, so the next WO never builds on broken files.

### C3 · Floor classification (deterministic)

`classify-change.mjs` runs at plan time over the blueprint's declared paths plus the FRD text (fail-closed), and again over the landed diff. Floor is monotone. The engine is the single writer of FRD frontmatter `floor:`.

### C4 · Build shapes

**S0 · Solo lane** (≤ 1 FRD or ≤ 5 WOs remaining; the default shape). No plan agent (Build Plan order), no foundation split. One sonnet `pandacorp:implementer` holds every WO context; per WO: TDD, then `commit-wo` (or `park-wo`). A WO marked `effort: high` gets its own opus builder in sequence; the chunk is never promoted. Then one `verify.sh` on a clean tree, then USABLE if non-floor.

**S1 · Multi-FRD.**
- **Foundation chunk on `main`.** It installs `sharedDeps[]`, which the planner must make cover **every** dependency any FRD plans to add. It writes the full data model plus additive migrations and the i18n catalogs, then runs `ensureFoundationComplete()`.
- **Lanes.** One lane builds on `main` as sole writer; two or more each get `build/<frd>` plus `worktree-bootstrap.sh`. Builders as in S0; pool `builderConcurrency` (3), refilled via `Promise.race`.
- **Later schema changes.** The lane stops at that WO and queues a small serial **schema step** on `main`, then rebases and continues; only the step serializes.
- **Dependencies.** A non-floor dependency is satisfied once the upstream has landed; a floor dependency needs VERIFIED.

### C5 · Landing train

`land-train` takes up to 3 branches:
1. lock;
2. commit audit: each commit flips at most one WO and names it; a violation sends that branch to `classic`;
3. rebase in a **staging worktree**, never squash;
4. one full `verify.sh` there;
5. fast-forward `main` only if the lock is free and `main` is clean. Otherwise hand back plus a push notification; never a silent retry.

**On red:** bisect one branch at a time; rebuild the culprit once on `main`.

**On conflict:**

| Conflict | Resolution |
|---|---|
| Lockfile | Main's version, then `relock`. The `chore(deps)` commit **names the WOs** whose dependency change caused it |
| i18n JSON | Key-merge driver |
| Other | One rebuild on `main`, then needs-owner |

**Revert:** any `wo-revert apply` that touches `package.json` re-runs `relock` in the same discard.

### C6 · USABLE, review and debt

**Gate base.** The gate worktree is prewarmed (checkout, `node_modules`) and **reset to the landed SHA** before the gate starts. Gate machinery is unchanged (`launchGateInSlot`, 2 slots, `explore`, `driftPolicy:'record'`, DR-073/117/080 ladder); patches certify through the train.

**After an FRD is USABLE, fix-forward only.**
- A gate rejection or an async finding is patched and certified (the DR-073 ladder).
- A discard (DR-070/117) becomes **needs-owner with a push**. On approval it reverts the whole dependent set at once, never a partial.

**Review debt** = FRDs whose WOs are all ≥ IN_REVIEW but not VERIFIED, **derived at read time** by release, Mission Control and the engine; no stored `review_debt`/`usable_sha` (DR-115); `build_usable` is an event. With ≥ 3 FRDs of debt the next run drains gates first (unless `--build-first`); an optional Desktop routine `pandacorp-review-drain` runs `--review-only` in a later window. External release refuses while debt is open; internal warns.

**Security** starts with the first gate; a fail-closed `security-delta` covers source changed since its pin. **`reviewBudget`:** `now` continues to VERIFIED; `defer` stops at USABLE (auto when over `usageBudget`, C8).

### C7 · Infrastructure failures, halt and resume

An `agent()` that throws, returns no output, or carries a usage-limit/429/overloaded signature is `infra`, never a WO failure: it consumes no `attemptRepair` try, never marks BLOCKED, never triggers `wo-revert`. One retry after 60 s; a second `infra` or any limit signature **halts**: no new dispatches, in-flight results taken as they arrive (`infra` → `park-wo`), a `build_paused` event and a PushNotification. Committed WOs survive; nothing is reverted.

**Resume:** a WO counts as IN_REVIEW only if HEAD holds **a commit flipping it to IN_REVIEW after its last IN_PROGRESS stamp commit** (the window `wo-revert.mjs` uses); otherwise it is demoted and rebuilt. `run_started_at` is not used, so a resume never rebuilds the previous run's committed work and `defer` semantics hold.

### C8 · Usage-aware scheduling

```
T ≈ max(critical path, projected usage / window rate)
```

- **Projected usage** = WOs × build usage per WO + FRDs × gate usage (measured rollups, BL-0219).
- **`usageBudget`**: owner-set per window; the remaining window is unobservable from a Workflow.
- **Over budget:** `defer` and `builderConcurrency` 1-2; more concurrency only hits the limit sooner (38).

---

## §3 · Defaults and DRs

**Defaults:** `lane:'fast'` (after §9), `mechScript:true`, `soloLaneMax` 1 FRD or 5 WOs, `builderConcurrency` 3 (1-2 over budget), `landBatch` 3, `reviewBudget:'now'` (auto `defer` over budget), `debtCap` 3 FRDs, `gateSlots` 2.

**New DR-124:** the fast lane as specified in §2.

**Amended:**

| DR | Amendment |
|---|---|
| DR-097 | IN_REVIEW is stranded only if it is not in the derived debt |
| DR-060 | One writer per checkout |
| DR-073 | Batch certify; fix-forward only after USABLE |
| DR-070/117 | Discard after USABLE is needs-owner and set-wide |
| DR-085 | Security runs alongside the gate, plus the delta audit |
| DR-118 | Prewarm reset to the landed SHA |

**Unchanged:** DR-015, DR-050, DR-122, DR-123.

---

## §4 · Critical path (PROJECTION)

**Inputs:**
- mech: ops × 0.25 + tool time;
- `verify.sh`: 1.5 (bench) / 2.2 (MC, Stop-hook average);
- worktree: 2.5 (UNMEASURED; A3 measured 2.5);
- contention c: 1.0-1.6 (UNMEASURED);
- gate: 19.6 bench / 18 medium.

### 1 FRD / 3 WOs (bench; today 51.4 / 58.6)

| Step | Min |
|---|---|
| precheck + `lane-open` (2 spawns + tools) | 0.8 |
| solo builder (vanilla 2.6-5.5, plus TDD discipline) | 4-6 |
| 3 × `commit-wo` (spawn-free, related unit tests) | 1.0 |
| verify + USABLE spawn | 1.8 |
| **T_usable (non-floor)** | **≈ 7.5-10** |
| gate + patch/certify + security-delta + close-out | 19.6 + 4.6 + 1.3 + 6.5 |
| **T_verified** | **≈ 40-42** |

If C3 marks the bench FRD floor (it collects email and phone; the PII signal is scoped to schema surfaces, so the verdict is unverified), then T_usable = T_verified. §9 pre-registers that the verdict is recorded and the run is scored accordingly.

### 4 FRDs / 16 WOs (F0 + 2 surfaces + 1 auth floor)

- **F0:** plan 2.3 + build 9.5 + commits/verify 2.5 = 14.3.
- **Lanes:** worktrees 2.5, then 3 lanes at 9.5 × c = 9.5-15.2; train 3.5.
- **Non-floor FRDs USABLE ≈ 30-36.**
- **Auth FRD (floor):** + gate 18 + patch 4.6, so **app-level T_usable ≈ 53-59**.
- **T_verified (2 slots, floor first):** F0 gate 14.3 → 32; auth and A 33 → 51; B 51 → 69; patches and close-out **≈ 80**. C is measured in §9, not assumed.

### 15 FRDs / ~52 WOs

- **Critical path (K = 3, no schema steps):** ≈ 17 + 14 × 9.5 × c / 3 + train contention ≈ **75-100 min**.
- **Train load:** ≈ 5 build trains + ≈ 8 patch certifies ≈ 45 min serial on the lock, overlapped with builds.
- **Usage:** ≈ 15 × (11 build + 12 gate) ≈ 350 $-equivalent: several windows (E1 was cut at 12 $). Wall clock is usage-bound under **any** design.
- **No claim to beat vanilla** (1-1.8 min/WO ≈ 52-95 min: parity; quality at that size unknown for both). The large-project claim is only: committed WOs survive halts, the build half finishes first, review drains in later windows. §9.2 must support it.

---

## §5 · Reliability traded and its bounds

**May be present at USABLE (never stamped VERIFIED):** gate-class edge cases (5-digit year, UTF-16 length), class-token bugs, 404/409 and pagination gaps, cross-FRD drift, non-floor security defects.

**Bounds:** floor FRDs VERIFIED first, deterministic floor twice, whole-program `verify.sh` on a clean landed tree, the AC-citation floor, the debt cap, no external release with open debt.

The small-bench oracle cannot separate the arms (vanilla 151/151), so "~90% at USABLE" is **unproven** until §9.2 measures it.

**Upstream contract change after downstream landed:** fix-forward (certify red → bisect → patch); discard is needs-owner. More than 1 downstream reopen per 4 FRDs on §9.2 → non-floor dependencies require VERIFIED.

---

## §6 · Answers to the prior red-team (bench (f))

- **IN_REVIEW without a commit (DR-097):** the flip and the code are one `commit-wo` commit under one lock; resume validates each IN_REVIEW against its stamp-commit window (C7).
- **Resume skips uncommitted work:** branch recovery and main salvage run before the planner, which reads HEAD; failed WOs are parked.
- **Blended commits break revert targeting:** clean-tree refusal, one WO per commit, named fixups, pre-landing audit, rebase never squash, attributed relock.
- **Foundation gate lost:** kept on S1. S0 has none: one FRD has no downstream, and the measured foundation gate was 0.2 min.

---

## §7 · Phased implementation (each phase ships alone)

**0 · Spike (1 d), findings only.** Measure `commit-wo` time and how reliably a sonnet builder calls it (10 synthetic WOs); worktree bootstrap; contention c (`vm_stat`, 3 builders + 2 gates + Playwright); `verify.sh` on bench and MC; train minutes for 3 branches; whether a mech subagent may fast-forward `main`; the floor verdict on both benches.

**1 · Safety first** (both lanes, on by default): scripted mech, `commit-wo`, `park-wo`, the clean-tree invariant, the `infra` class with halt/resume, stamp-anchored demotion, prewarm-at-landed-SHA, concurrent security plus delta.

**2 · Solo lane:** per-FRD USABLE, deterministic floor, derived debt with cap, `reviewBudget`/`usageBudget`, fix-forward after USABLE, release refusal, the drain routine.

**3 · Multi-FRD:** worktree lanes, pool, train, schema step, attributed relock, bisect, i18n driver.

**4 · Visual-qa per FRD; `gateSlots` 3** if Phase 0 shows c supports it.

---

## §8 · Dropped, and why

Gate packing, a sonnet gate or a cheaper default gate effort (38 §A2, DR-015: the gate is the only proven value); gate on `main` (`main` must stay usable); concurrent `--only` commits; an LLM floor classification.

---

## §9 · Measurement plan (pre-registered)

**Arms:** F = fast lane, C = engine 9.118.x, V = vanilla `claude -p` sonnet.

**Per run:** T_usable (per FRD, app), T_verified, oracle and judge at both SHAs, usage (BL-0219), 429s, halts, interventions, refusals, reopens, bisects, floor verdict.

n is a go/no-go screen sized for the 3-10× effects in question, not a significance test.

### 9.1 Small bench (F n=3, V n=3 same session, C n=1)

**Pass:** T_usable ≤ 2× V median; usage ≤ 3× V; oracle ≥ 143/151 at USABLE in every run and 151/151 at VERIFIED; judge ≥ 90 at VERIFIED; recall of the 4 known gate findings ≥ C; 0 interventions.

If the bench classifies as floor, T_usable is scored as T_verified and the solo-lane bar is judged on a non-floor variant.

### 9.2 Medium bench `pandacorp-bench-crud` (F n=2, V n=2, C n=1)

**Spec:** four FRDs frozen before any arm runs: a foundation with a SQLite/Drizzle schema, two surfaces with route handlers and UI, and an auth-lite floor FRD. The hidden oracle has ≥ 150 HTTP and Playwright cases with planted edges.

**Pass:** non-floor FRD T_usable ≤ 40; app T_usable ≤ 65 and ≤ 2× V; oracle at USABLE ≥ V; oracle ≥ 95% and judge ≥ 90 at VERIFIED; T_verified ≤ 0.75 × C; ≤ 1 downstream reopen.

**Kill S1** (multi-FRD lanes stay off, the solo lane loops over FRDs) if app T_usable > 2× V or the oracle at USABLE < V.

### 9.3 Gate-effort A/B

`xhigh` vs `high`, n = 3, measurement only.

### 9.4 Crash and quota canaries

**Deliberate SIGKILL at each point**, each followed by a resume:
1. inside `commit-wo` between stamp and commit;
2. mid-rebase in the train;
3. between the fast-forward and the state write;
4. mid `wo-revert apply`;
5. during relock.

**Quota canary:** agents return a limit error for 30 min.

**Pass:** 0 IN_REVIEW WOs without a commit, 0 blended commits, 0 BLOCKED or discarded WOs from `infra`, an exact `wo-revert plan` per WO, and no resume rebuilds committed work.

**Kill the build half** (flags off, `classic` untouched) if §9.1 or any canary fails twice after fixes. Fallback: **build directly, then `--review-only`**.

---

## §10 · Red-team record

A = adopted, P = partly adopted (reason given), R = rejected (reason given).

**Correctness review**

| # | Objection | Disposition |
|---|---|---|
| K1 | Crash after a committed stamp leaves dirty frontmatter, blocks `merge-queue.sh` | A: precheck salvage/reset, limited to engine paths (owner edits never reset) |
| K2 | Undeclared edits make green-on-uncommitted | P: refusal plus `--extra` with reason and a clean assertion; a hard refusal alone would loop builders on legitimate shared edits |
| K3 | Failed WO leaves broken files dirty | A: `park-wo` |
| K4 | USABLE verify on uncommitted files | A: clean-tree invariant |
| K5 | `run_started_at` demotion rebuilds prior-run work, breaks `defer` | A: stamp-commit window (C7) |
| K6 | Branch recovery must precede the planner | A: precheck order |
| K7 | Conflicting migrations across lanes | A: schema paths refused off `main`; serial schema step |
| K8 | Async discard after USABLE breaks downstream | A: fix-forward only; discard needs-owner, set-wide |
| K9 | Prewarmed gate reviews pre-rebase code | A: reset to landed SHA |
| K10 | Unattributed relock breaks `npm ci` after revert | A: relock names WOs; revert re-runs relock |
| K11 | Owner edits break the fast-forward | A: staging worktree, ff only when clean, hand back plus push |
| K12 | USABLE must not advance `last_green_sha` | A: §1 invariant |
| K13 | Stored debt fields violate DR-115 | A: derived at read time |
| K14 | LLM floor needs a mechanical check | A: deterministic, plan and landing |
| K15 | No usage-limit handling | A: C7 (confirmed: no hit in source) |
| K16 | Random crash canary too weak; no quota canary | A: §9.4 |

**Speed review**

| # | Objection | Disposition |
|---|---|---|
| S1 | Mech saves 4-5 min, not 9 | A: projection formula |
| S2 | Self-test re-run duplicates e2e | P: related unit tests only; dropping it is R, the commit must certify its own green |
| S3 | "≥ 1 test" is gameable | A: AC-citation floor |
| S4 | PII form classed floor; auth gate missing from 4-FRD projection | A: deterministic floor, per-FRD USABLE, projection redone |
| S5 | Worktree time, contention assumed | A: Phase 0 measures; ranges used |
| S6 | Serial schema chunks collapse K | A: only the schema step serializes |
| S7 | Foundation split on 1 FRD wastes time | A: S0 has none |
| S8 | Per-chunk opus promotion | A: per-WO opus builder |
| S9 | The train is F2 renamed | P: F2 certified each patch and landing separately; the train batches ≤ 3 and overlaps builds. Cost admitted, measured in Phase 0 |
| S10 | Lockfile on every train | A: `sharedDeps` covers planned deps |
| S11 | USABLE only moves "done" | Accepted as true: it is the owner's objective; quality at USABLE must be proven on the medium bench |
| S12 | Unbounded debt | A: cap plus scheduled drain |
| S13 | No usage term | A: C8, §4 rewritten |
| S14 | "Beats vanilla on 15 FRDs" uncompared | A: claim withdrawn |
| S15 | n = 2 has no power | P: small bench n = 3; medium stays n = 2 for cost, a screen for 3-10× effects |
| S16 | Kill bar 20 min too loose | A: 2× vanilla, 3× usage |
| S17 | Defer when usage exceeds remaining window | P: the window is unobservable from a Workflow; uses owner-set `usageBudget` |
| S18 | Must beat V on medium T_usable | R: commit and verify discipline cannot reach vanilla parity; bar is ≤ 2× V, oracle ≥ V at USABLE, better at VERIFIED |
| S19 | No medium kill, no vanilla arm | A: §9.2 |

---

## §11 · Orchestrator decision (2026-10-01, before implementation)

**Phase 3 (parallel worktree lanes + landing train) is deferred; the first multi-FRD shape is S0 repeated: sequential FRD lanes on `main`, gates pipelined.**
Reason, from this document's own numbers: §4 shows a 15-FRD build is **usage-bound** under any design (≈350 $-equivalent, several
windows) and the parallel shape projects 75-100 min including contention c and ≈45 min of serialized train load; sequential
solo FRD builders at vanilla-like speed (≈5-6 min/FRD measured on the small bench) give ≈75-90 min for 15 FRDs with **none** of
the C5 machinery (worktree lanes, staging rebase, bisect, i18n merge driver, attributed relock, schema step). The review half
already runs in parallel slots (DR-118, `gateSlots` 2): FRD k's gate overlaps FRD k+1's build. Parallel lanes come back only if
§9.2 shows the build half, not usage, is the bottleneck.
Implementation order: Phase 1 (safety: scripted mech, `commit-wo`/`park-wo`, clean tree, `infra` halt/resume, stamp-anchored
demotion) → Phase 2 (fast lane: per-FRD solo builder, USABLE per non-floor FRD, async gates in slots, floor FRDs VERIFIED before
their dependents, `reviewBudget now|defer`) → measure §9.1 and §9.2 → decide the default (owner delegated the decision; bar:
T_usable ≤ 2× vanilla on the small bench and oracle ≥ 90 % at USABLE on both benches).
