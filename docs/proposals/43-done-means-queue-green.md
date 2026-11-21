# 43 — "Done" means the queue is green: fewer rounds, a faster gate, and a two-minute owner landing

**Status: approved by the owner on 2026-11-20 — decisions recorded in §12; not yet implemented.**

**Status:** proposed (v3: v1 was rejected by two independent red-teams; v2 was found fit with corrections by an independent verifier, and those corrections are applied here); nothing here has been executed · **Date:** 2026-11-20
**Home:** FACTORY proposal (overlay machinery: `merge-queue.sh`, `green-stamp.sh`, `verify.sh`, `worktree-bootstrap.sh`, the pre-push hook; build engine `land` job and its result handling; Stop hook; skills `implement`, `worktrees`, `sync`, `implement-backlog`; standards). Plugin 10.14.3, overlay template 9.4.2. Applies to mission-control (overlay 9.2.0, internal), funko-tracker (9.4.2, launched) and personal-page-v2 (9.2.0, launched).

Every number carries a mark: **measured** (read from a log, a report, git or a timed command, with its sample size n), **derived** (arithmetic on measured numbers) or **estimated** (a judgement, with its basis). Medians are standard medians (mean of the two middle values when n is even); p90 is nearest-rank. Evidence files are archived in `S=docs/proposals/43-evidence` (relative to the factory root), cited as `S/out/rules.md` etc.; the episode figures are reproduced by `python3 S/out/v3counts.py S`. `S/w-tr/episodes.json` (5.7 MB) is kept on disk but not versioned (see `S/README.md`).

---

## Terms used

- **Gate:** `.pandacorp/verify.sh`. **Full gate:** no flags; every static check (lint, types, dead code, import cycles, doc lint), the whole Vitest suite and the whole Playwright suite (behaviour, visual, responsive, mobile). **Light gate:** `--light`; static checks plus at most the tests of the files a session edited. **Since gate:** `--since <sha>`; static checks, Vitest on changed files, smoke and shell browser specs only.
- **The queue:** `.pandacorp/merge-queue.sh`. It takes a repository-wide lock, rebases the branch onto main, runs the full gate on the rebased tree, then fast-forwards main (and pushes in launched projects), all under the one lock: the **single critical section** this memo keeps. **Exit codes** used here: 0 landed; 10 rebase conflict; 11 red gate; 12 main checkout has uncommitted work; 13 merged locally but the push failed; 14 committed e2e port busy; 20 precondition failed; 21 launched project, gate green, waiting for the owner's order; 16 and 17 are new in this memo (§2.2).
- **Rebase:** replaying the branch's commits on top of main's current tip. **Fast-forward (ff):** moving main to the branch tip without a merge commit.
- **Stamp:** the gitignored file `.pandacorp/run/green-stamp`, written only through `green-stamp.sh` when a full gate is green, saying "this exact tree, with these inputs, passed". When it still matches, the queue skips the gate and logs `[certified-tree]`; otherwise it logs `[full-gate]` (DR-146).
- **Launched project:** `phase: release` and not `deploy_target: internal`. Under DR-138, main is production: every push deploys, and only the owner's explicit order for that landing (`PANDACORP_OWNER_RELEASE_OK=1`) allows it. **Order up front:** the owner gave that order when asking for the change, so the queue gates and lands in one run. **Deferred order:** the queue stops at exit 21 and the owner orders later.
- **Worktree / bootstrap / skip-worktree:** a second checkout of the repo; `worktree-bootstrap.sh` prepares it (dependencies and a private e2e port, written into the tracked `e2e/server-env.json`); skip-worktree is a git flag that hides that local edit from `git status`. **`lane.env`:** an ignored file `.pandacorp/run/lane.env` in which the build engine writes a lane's port; `playwright.config.ts` reads it.
- **Build engine:** `pandacorp-build.mjs`. It runs a light gate per unit of work, a since gate per feature (FRD) as a background job of kind `g2`, and the queue as a job of kind `land`. Its **result handling** (`plugin/runtime/build/land/harvest.mjs`) maps a `land` job's exit code to the next action; on a red it creates a **patch unit**, a small repair task. A **rescue run** is the engine re-running a stuck unit's full gate inside that unit's own partial (sparse) worktree. The **`drive` actor** is the engine's unattended relay mode; the engine strips the owner's order variable from jobs it starts in that mode.
- **`plugin-sync`:** Mission Control's module that reads the factory's plugin version and installed plugin data (`src/lib/plugin-sync/plugin-sync.ts`).
- **Episode, `EPnnn`:** one change's path from its first queue run to landing, reconstructed from session transcripts (`S/w-tr/episodes.json`, 62 episodes, 1-20 Nov; `EPnnn` is an episode id there). **Round:** one queue run inside an episode. Each red run carries a cause label from an automatic classifier; the labels used here are *own defect not covered by the earlier gate*, *environment*, *flaky*, *the previous fix broke something else*, *other sessions' work*, *undetermined*. The labels were audited on a sample of 16 reds (13 correct, `S/out/episodes-audit.md`, section "Parte A"); the 22 reds since 13 Nov were re-read one by one from their recorded diagnoses.
- **"Done to main", two definitions** (both published, §1.1): **(Q)** from the change's first queue run to its landing; **(R)** from the session's declared "ready" when one was observed in the transcript (5 of 22 episodes since 13 Nov, 8 of 35 before), otherwise from the first queue run.
- **Flaky suspect:** a test observed failing and passing on the same tree.

---

## TL;DR

1. **The pain is gate duration × number of rounds, not the final merge step.** funko-tracker since 13 Nov (its test infrastructure last changed then): "done to main" from the first queue run has a median of **25.5 min and a p90 of 209 min** (measured, n = 22); before 13 Nov it was 21.4 / 276 min (n = 35), so the median got worse and the p90 better. A green queue run takes a median of **17.6 min, p90 24.9 min** (measured, n = 20). 9 of 22 recent episodes needed 3 or more rounds (measured). In 55 of 61 funko episodes the owner's order was already present on the first queue run (measured), so for the dominant flow "merge" and "gate" are the same run.
2. **"Done" gets one meaning, by observable state, with no second gate.** A change is *done* only when the queue has reported a green full gate on the rebased tree: in an internal project, "in main"; in a launched project, "certified, awaiting your order" (exit 21 with a stamp that still matches) or "in main". Every earlier state, on every path, must be called **"implemented, not certified"**.
3. **The owner's landing step fits in 2 min when it acts on a certified, still-current tree:** stamp check → fast-forward of the exact gated commit → push. Measured stamp landings: 10 s (EP046, order up front, stamp prepared by hand), 44 s (EP048, deferred order) and a probable third of ≈ 13 s with no marker captured (EP047, deferred order). If main moved in between, the gate must run again: that does **not** fit in 2 min, and no shortcut is proposed.
4. **The cheap environment fixes are about correctness and noise, not time.** 8 of the 22 recent reds were environment (4 missing generated `PageProps` types, 1 missing tool, 3 load timeouts); the 5 with a mechanical fix here cost only **3.0 min of wall time in total** and removing them leaves the median and p90 unchanged (measured what-if, `S/out/v3counts.py`). The time lives in rounds that need real code repairs and in the gate's length. Hence the design's weight on: a repair pre-check (static checks + whole Vitest suite before re-queueing; all 3 audited "fix broke something else" cases would have been caught), a diagnosis run listing every unit failure after a red, a fixed lock protocol, and a faster gate.
5. **A faster gate:** in Mission Control, 425 of 890 browser tests run in a single-worker serial tier (274 s of summed test time, measured, n = 1 run); per-worker fixture roots would let them run in parallel: about 8.7 → 5.5-6.5 min (estimated). funko needs a profile first (§2.5). Time budgets that fail a change are an owner decision.
6. **Production path without a gate, today:** in funko two direct commits on main were pushed to production today without the queue (`d98eaccd`, `e1ffcfae`; measured from the `origin/main` reflog); the pre-push hook only checks the owner flag. Decision: the pre-push hook of a launched project requires proof that the pushed commit passed the full gate, or an explicit, logged owner bypass.
7. **Mission Control keeps the whole-factory tree as the stamp's identity.** Moving its browser checks out of the blocking path is an owner decision, not recommended.
8. **Phase 0 is measurement:** a durable queue log and the "done to main" metric, with a baseline taken before anything else changes.

---

## §1 · Diagnosis

### 1.1 Timeline: where the time goes

| Span | Mission Control | funko-tracker | personal-page-v2 | Source |
|---|---|---|---|---|
| Full gate, green | **523 s wall** (measured, n = 1, 2026-11-20, machine load 6-8): Playwright stage 446.7 s (85 %; build + browser run; visual not separable in the log), Vitest 54.5 s (10 %), static checks 19.2 s in total (doc lint 9.6, residual-ambiguity 2.8, import cycles 2.4, types 1.8, dead code 1.6, lint 0.9; the rest < 0.2) | **Green queue run wall: median 17.6 min, p90 24.9 min since 13 Nov** (measured, n = 20; criterion: funko queue runs that landed without a `[certified-tree]` marker); before 13 Nov 14.6 / 21.6 min (n = 35). Stage sums of three full green reports: 1408, 1460, 1500 s (measured, **sums of stages, not wall**; two of the three are engine rescue runs). Stage medians over 30 reports of mixed scope: types 1.2 s, lint 1.5 s, dead code 2.1 s, import cycles 6.1 s, doc lint 3.2 s (measured, `S/w-ext/timeline-ext.md` l.578-594) | Stage sum 230 s ≈ 3.8 min (measured, n = 1, 2026-11-13: Playwright 160.6 s, Vitest 58.0 s); not re-measured today because the checkout was dirty | `S/out/measure.md`; `S/out/v3counts.py`; `S/w-ext/timeline-ext.md` l.1224-1239 |
| Red queue run (exit 11) | — | median 2.2 min, p90 10.6 min since 13 Nov (measured, n = 22); most reds fail fast | — | `S/w-tr/episodes.json` |
| **"Done to main" (Q), from first queue run** | queue used once in the dataset (26 s, n = 1, unexplained) | **since 13 Nov: median 25.5, p90 209 min** (n = 22); **before: 21.4 / 276 min** (n = 35) (measured) | no episodes | `S/out/v3counts.py` |
| **"Done to main" (R), from declared "ready" when observed** | — | since 13 Nov: median 29.0, p90 211 min; before: 38.1 / 276 min (measured; R ≥ Q by construction) | — | same |
| First queue run lands | — | 9 of 22 since 13 Nov; 17 of 39 before (measured; the design red-team counted 8/22 and 20/39 with another label rule) | — | `S/w-tr/episodes.json` |
| Episodes with ≥ 3 rounds | — | 9 of 22 since 13 Nov; 12 of 39 before (measured) | — | same |
| Wall time inside vs between queue runs (all landed funko episodes, definition R) | — | 31.7 % inside, 68.2 % between (measured, 25.25 h of 79.53 h; "between" includes time before the queue where a "ready" was observed) | — | `S/out/episodes-audit.md`, section "B2" |
| Owner order already present on the first run | — | **55 of 61 episodes; 129 of 137 runs** (measured from each run's command line) | — | `S/w-tr/episodes.json` |
| Interval after an exit 21 until the next run | — | 31, 69, 281 min (measured, n = 3; an upper bound of the owner's wait) | — | same |
| Main movements | 43-44 factory commits in 7 days, 25 touching `mission-control/` (measured; the count drifts with the window) | **14 days: 91 = 65 queue fast-forwards + 25 direct commits (14 chore, 13 of them memory-routine or overlay-upgrade commits; 9 docs; 2 fix) + 1 reset** (measured, reflog) | 2 landings in 14 days, 0 commits in 7 days (measured) | git, this session |
| Rebase step | not measured | not measured | not measured | no log (§11) |

Reading it: with the order up front, the queue run *is* the merge. A long episode is several rounds of a ≈ 18 min gate plus the time between them (diagnosis, repair, waiting). The between-runs share cannot be split further without a log.

### 1.2 Why "done" fails at merge: suspects

| # | Suspect | Verdict | Evidence | Predicts | Explains the successes |
|---|---|---|---|---|---|
| 1 | **"Done" is declared on a weaker gate than the queue's.** Stop hook and engine unit gate are light; the engine's feature gate is a since gate; the first full gate on the merged tree is the queue's. | **Confirmed** (code) | `S/out/rules.md` §1b, §8.1 | Reds in surfaces never run before. Since 13 Nov, 8 of 22 reds carry the label *own defect not covered by the earlier gate* (re-read). | Small changes that touch none of those surfaces land first time (9 of 22; 17 of 39). |
| 1b | …yet "ran a full verify before the queue" did not predict first-time landing (5 of 19 vs 47-54 %). | **Undecidable**, confounded | `S/out/episodes-audit.md`, section "B4": full verifies were used on big batches, sessions edited after verifying, subagent gates were not detected | — | Matching gates is necessary, not sufficient. |
| 2 | **Unprepared environment after the rebase or in a fresh worktree.** The queue deletes `.next` after every gate (`merge-queue.sh:247`), the route types live in `.next/types` (`funko-tracker/tsconfig.json:30`), and no funko script runs `next typegen`; one red was a missing tool (biome). | **Confirmed** | Since 13 Nov: 4 `PageProps` reds (EP047, EP054, EP055 twice) + 1 missing-biome red (EP058) (measured) | A static red seconds into the run, cured by `next typegen` or bootstrap with no code change; a retry after another red falling into `PageProps` because `.next` was just deleted (EP055). | Worktrees whose `.next/types` survived from a previous build, and every run that did not follow a deleted `.next`. |
| 3 | **Shared test database between runs** (funko). | **Confirmed before 13 Nov; not seen since** | 7 reds from 1 to 8 Nov ("Database `ft_gate` does not exist", residue between runs; EP001, EP016, EP020, EP021); funko added a per-worker isolated database and server on 13 Nov (`5d50c114`); 0 database reds since (measured) | Reds unrelated to the diff, cured by reseeding with no code change (as in EP014). | Before 13 Nov, runs in which no other run had touched `ft_gate`; since 13 Nov, isolation. |
| 4 | **Machine load turning slow tests into timeouts** (funko Vitest `testTimeout` 20 s). | **Confirmed as a trigger** | 6 reds before 13 Nov (EP028 ×2, EP031 ×2, EP034, EP039) plus 1 mixed (EP028); **3 since** (EP049 "4/4 isolated", EP060, EP062 "20 s limit under load") (measured from recorded diagnoses); only 1 of 60 reds overlapped another queue run, so the load came from other sessions' tests and builds | Timeout reds that pass unchanged when re-run quietly (EP039 14/14, EP049 4/4). | Runs at quiet hours. |
| 5 | **Flaky tests** (order- or timing-dependent). | **Confirmed** | 6-9 of 60 reds (estimated from the audited sample: EP034 a 9 s test with a 20 s limit fixed in the test; EP038 "the app was fine, 20/20 after fixing the test") | Reds that move between runs with different shuffle seeds. | Most of the suite is stable. |
| 6 | **The fix is verified with a weaker gate than the one that judges it.** | **Confirmed** | 7 reds labelled *the previous fix broke something else*; the 3 audited ones are new breakages caused by the fix (EP010 formatter not run; EP030 rules lost while resolving a conflict; EP049 fix checked with one Vitest file), all static or Vitest | A red in a check the repair skipped. | Repairs that ran the static checks and the whole Vitest suite before re-queueing. |
| 7 | **Fail-fast hides a second, older failure**, so N failures need N rounds. | **Hypothesis only** | Code makes it possible (Vitest `--bail=1`, Playwright `maxFailures: 1`); two consecutive engine landing jobs of one funko run failed on different tests (jobs `land-25-1`, `land-25-2`), but the audited "fix broke" cases are new breakages | Distinct reds on consecutive runs with no related code change. | — |
| 8 | **The stamp does not survive**, so owner-order re-runs and retries pay a full gate again. Invalidators: bootstrap's skip-worktree; every environment variable hashed, including per-session `TMPDIR` and cache paths; any movement of main (whole repository tree); 12 h age; in Mission Control, the browser run writes ignored files under `e2e/fixtures/`. | **Confirmed** (code + experiment) | `S/out/rules.md` §3; measured today: a green Mission Control full gate ended "inputs changed during the run — nothing certified" (`S/out/measure.md`); transcripts: 2 runs with `[certified-tree]`, 28 with `[full-gate]`, 108 with no marker captured | Re-runs of an unchanged tree paying a full gate. | The landings where it survived: EP046 (a subagent put the worktree back on committed config by hand and the queue was launched with the same extra variable; 10 s), EP048 (retry after exit 21 in the same session; 44 s) and, probably, EP047 (retry after exit 21; ≈ 13 s; no marker captured). |
| 9 | **verify.sh reports green even when the stamp was refused**: `record` is called with `|| true` (`verify.sh:628`). | **Confirmed** (code) | `verify.sh:620-629` | "Green but nothing certified", exactly the Mission Control run measured today. | n/a: no success depends on it (it only removes a later saving). |
| 10 | **Main moves during the gate because direct commits do not take the queue's lock**; the final ff then fails with a misleading exit 12. | **Confirmed in code; frequency undecidable** | 25 direct commits in funko in 14 days; factory routines commit to the factory main that Mission Control shares (measured); `merge-queue.sh:273-274` | Exit 12 right after a green gate. | Most direct commits fall outside a running gate's window (no measurement of the overlap). |
| 11 | **A waiter that times out deletes the holder's lock**: the EXIT trap is installed before `acquire` and releases unconditionally (`merge-queue.sh:71, 174-175`). | **Confirmed** (code) | trap at l.174, `acquire` at l.175, `release() { rm -rf "$LOCK"; }` at l.71 | Two landings inside the critical section at once after a 10 min wait. | Most waits end before 10 min. |
| 12 | **The heavy-job cap can fail open**: the queue continues without a slot if the slot directory cannot be created (`merge-queue.sh:128`), and the shell queue and the Node engine reclaim slots with different rules. | **Confirmed** (code) | `merge-queue.sh:128, 142-144`; `plugin/runtime/build/admission/hostSlots.mjs` | More than 2 heavy gates at once, more timeouts. | Normally the host directory exists and the cap holds. |
| 13 | **Reds and blocks caused by other sessions' work.** | **Confirmed, small** | 1 red with that label plus 5 non-red outcomes (main with another session's uncommitted work; a wrapper waiting 2 h for main); EP015 (a photo fixture tied to another session's folder); EP020 (another session deleted `ft_gate`); 5 runs ended in "main busy" (exit 12 or lock timeout) (measured) | Reds or blocks that vanish when the other session finishes or cleans up. | Most runs happen with no other session touching shared state; since 13 Nov each test worker has its own database. |
| 14 | Main moved and the combination broke semantically. | **Not attributed**: none of the 16 audited reds, nor any of the 60 classified, was attributed to it; how many landings had main moving is unknown | `S/out/episodes-audit.md` | — | — |
| 15 | Visual baseline drift; port collisions; script drift between projects. | **Discarded** | 0 reds; a busy port gives exit 14 before the gate; scripts identical by SHA-256 in all three projects | — | — |
| 16 | Waits for the lock, the host slot or funko's machine test lease. | **Undecidable** (no log) | `merge-queue.sh:56-70, 124-152`; funko lease timeout 45 min (`scripts/test/gateLease.mjs:182-195`) | Long runs with no gate progress. | — |

### 1.3 Why fixes break other things

1. **The repair is checked by something weaker than the gate that judges it** (one test file, the light gate, a partial subagent check). All 3 audited cases would have been caught by the static checks plus the whole Vitest suite, which costs about 74 s in Mission Control (measured) and up to about 9 min in funko (measured maximum Vitest stage, n = 16).
2. **The repair happens on the rebased tree, after the queue deleted `.next`**, so the next run can fail on generated types that have nothing to do with the fix (EP055).
3. **Fail-fast** may hide older failures (hypothesis 7). The data does not show it yet; the diagnosis run of §2.4 will measure how many reds carry two or more failures.

### 1.4 What the data does not support

- That the final merge step is the bottleneck: with the order up front (55 of 61) there is no separate merge step.
- That the v1 "certify earlier" design would shorten anything for that flow: it moves the same gate and the same rounds to an earlier label.
- That fixing the mechanical environment reds shortens "done to main": it removes 5 reds but only 3.0 min of wall time over 22 episodes (measured what-if).
- Any estimate of the share of landings where main moved between gate and landing: nothing records it.

---

## §2 · Design

**Principle:** one gate, one critical section, one meaning of "done". The queue keeps lock → rebase → full gate → fast-forward under the same lock. "Done" is read off the queue's observable state. The work goes into (a) fewer rounds, (b) a faster gate, (c) a stamp that survives the owner's waiting window, (d) closing the one production path that bypasses the gate. No step may leave the tree dirty or set skip-worktree between the rebase and the stamp check or gate (§2.2 step 4, §2.3).

### 2.1 States, and what each path may say

| State (machine name) | Owner-facing words (Spanish) | Exact condition | Who may report it |
|---|---|---|---|
| `implemented-uncertified` | "implementado, sin certificar" | anything before a green queue run on the current rebased tree | every path, always, until the next state holds |
| `certified-awaiting-order` | "certificado, espera tu orden" | launched project, queue exit 21, and `merge-queue.sh --status` confirms the stamp still matches the tree and main is still at the stamp's recorded base | the session or engine run that owns the branch |
| `certified-stale` | "certificado sobre un main viejo: hace falta otra pasada del gate" | a stamp exists but main moved since its base, or it expired | same |
| `landed` | "en main" (launched: "en main y publicado") | the queue's ff (and push) event is in the queue log | same |

"Done", "listo", "terminado" may only be used for `certified-awaiting-order` and `landed`. Mechanism:
- **New read-only `merge-queue.sh --status`** (no lock, no writes): prints the state from the stamp (which gains a `base=` field: main's sha at the rebase), main's tip, the worktree's tree and the queue log.
- **Engine:** the run's state machine records `certified-awaiting-order` when its `land` job exits 21 and `landed` on exit 0; close-out reports exactly those. No new job kind is needed (`plugin/runtime/build/jobs.mjs:28` accepts only `g2` and `land`).
- **Stop hook:** today it emits a message only on main; it will also emit, in worktrees, "state: implemented, not certified" unless `--status` says otherwise. This is information; the deterministic control is the queue, the engine CLI and the pre-push hook, not the wording of a turn.
- **Skills and standards** (`implement`, `worktrees`, `sync`, `implement-backlog`, `build-orchestration.md`, `quality-and-testing.md`, the project guide): replace "commit → verify.sh → merge-queue.sh" by "commit → merge-queue.sh", and use the state names.

### 2.2 The queue's critical section, hardened (DR-096 amended)

Order inside the lock, with what changes:
1. **Lock with ownership and a visible FIFO** (replaces `mkdir` + 10 min abandonment): a ticket per waiter in the shared git dir; the holder writes a unique token; only the holder releases; a stale holder is reclaimed by atomic rename and re-check, never by deleting another's directory; waiters print their position, the holder's start time and expected duration (from the log). Fixes suspect 11.
2. Preflight "main busy": in Mission Control only the paths the fast-forward will touch (`git diff --name-only main..<gated-sha>` against main's `git status`), not the whole factory; elsewhere unchanged.
3. Restore committed config (today's `merge-queue.sh:192-201`); `git rebase main`.
4. **Environment step after the rebase, dependencies only:** reinstall dependencies when the rebase changed the lockfile; run `next typegen` when the project has `next`; check required tools (biome, jq). **It never rewrites `e2e/server-env.json` or `.claude/launch.json` and never sets skip-worktree** (running the full bootstrap here would trip `merge-queue.sh:209-219`, exit 11 "server-env.json differs from HEAD", and make `green-stamp.sh` refuse every stamp because a tree with skip-worktree entries is never clean). Its writes land only in ignored, unhashed paths (`node_modules` contents, `.next/types`); a reinstall changes install metadata before the gate starts, so start and end fingerprints agree. A failure exits with the new code **16**, "environment not ready", with its reason, before any gate time; the engine's result handling maps 16 to "run bootstrap, retry once". Fixes suspect 2.
5. **Stamp check** (unchanged rule; new `--explain` names which input group differs: tree, verify.sh, dependencies, e2e inputs, or which environment variable *names* changed; never values).
6. If no match: **heavy-job slot** (§2.4) → port probe → full gate, which **inherits the queue's slot** (token passed in the environment; the queue never holds two slots, so two queues cannot deadlock holding one slot each) → **require a successful stamp `record` before continuing**; a green gate that could not record is reported as "green but uncertifiable: <reason>" (exit 11 with that text) instead of landing. A project without an executable `verify.sh` becomes an explicit error (today `merge-queue.sh:226, 253` silently skips the whole gate block). Fixes suspect 9. *The required record ships only after the Mission Control run-output fix (§2.3), otherwise every Mission Control landing would stop.*
7. Launched project without the order → **exit 21, main untouched**, as today. The order check stays **before** ff and push.
8. **Fast-forward the exact gated commit** (`git merge --ff-only <sha>`) and, in launched projects, **push that sha** (`git push origin <sha>:main`), so a commit that arrived by name in between can never ride along. A failed ff because main advanced gets the new exit **17**, "main advanced during the gate — re-run", distinct from exit 12.
9. Push with a timeout; a timeout is logged as "push result unknown" and the next step re-reads `origin/main` before retrying (killing the client does not undo an accepted push).
10. The stamp hand-off to the main checkout stays between ff and push (today's order, `merge-queue.sh:291-305`), because the pre-push rule of §2.6 may need it. Release the lock, then (outside the critical section and the 2 min budget) run `change-reconcile`, **resolved from the project directory** so that Mission Control's reconciler actually runs (today `merge-queue.sh:313` looks for it at the factory root, where it does not exist; measured with `ls`; Mission Control landings never reconcile).

Tools that commit straight to a main that a queue serves (the factory memory routine, `/pandacorp:upgrade`, `implement-backlog`, `sync` close-out) take the same lock for their commit through a small `with-merge-lock.sh <command>` helper, so they stop moving main under a running gate (suspect 10).

### 2.3 A stamp that survives the owner's window (DR-146 amended)

The owner's landing step only needs the stamp to survive from exit 21 to the order, in the same worktree.

| Invalidator | Change | Risk → detection → reversal |
|---|---|---|
| Per-session environment variables in the fingerprint | Add per-invocation location variables to the existing `controls` list in `green-stamp.sh`: `TMPDIR`, `npm_config_cache`, `PANDACORP_CLEANUP_SESSION`, `PANDACORP_SESSION_TEMP_BASE`, and the queue's own slot token (§2.2 step 6). `PATH` and `HOME` **stay hashed** (they change real behaviour: tools, browser cache, `plugin-sync`'s reads). Every reader already goes through `green-stamp.sh`, so start, record and check use one rule. Store per-key hashes so `--explain` can name the variable. | A remaining mismatch (a different `PATH` between sessions) shows by name in the log and is decided with data; the list is a reviewed diff. |
| Mission Control's browser run writes ignored files under `e2e/` | Declared run outputs: a committed `e2e/.run-outputs` list (today the ledger `e2e/fixtures/factory-root/factory/gamification-ledger.json` and `e2e/fixtures/factory-root/host/home/Library/Preferences/`; completed by listing `git status --ignored -- e2e` after a run). verify.sh deletes them **before** the start fingerprint and `green-stamp.sh` leaves them out. Anything else that changes under `e2e/` still invalidates (fail closed). | A test that depended on residue from a previous run fails once (a real defect). A per-run sandbox copy of every fixture root, built before the server build and passed to every spec, is the stronger alternative; it is deferred because it touches build, server and many specs. |
| The full gate writes a missing visual baseline into `e2e/` (`updateSnapshots: "missing"` locally) | **Only when the gate scope is full** (verify.sh's `GATE_SCOPE=full`, which is what the queue runs), verify.sh exports a new `PANDACORP_E2E_SNAPSHOTS=none` (added to `controls`) and `playwright.config.ts` uses `updateSnapshots: "none"`; a missing baseline is then a red that says "baseline not blessed — bless it at the feature gate (DR-080), commit it, re-queue". Light and since gates keep today's behaviour (`verify.sh:671` exports `PANDACORP_E2E_CERTIFICATION=1` on every run, so that variable cannot be the switch). | One extra round for a change that adds a visual route without a blessed baseline; today it would never leave a stamp. Amends the "missing baseline = bless, not fail" rule for the full gate only (§8). |
| Bootstrap re-run by the queue's exit trap after exit 21 | Unchanged in phase 0.5: the trap re-bootstraps the worktree for iteration, and the next queue run restores committed config (step 3) before the check, which is why EP048 worked. Phase 2 moves the worktree's port out of the tracked `e2e/server-env.json` into an ignored port file read first by `playwright.config.ts`; the queue gates on the committed port through a variable added to `controls`. Then no tracked file is rewritten and no skip-worktree is set anywhere. | The precedence change touches three projects' `playwright.config.ts` and engine lanes that already use `lane.env`; machinery tests in §8. |
| 12 h age | Unchanged; the log records expiries. Observed intervals after exit 21: 31-281 min (n = 3). An expired stamp re-gates, even with the order (correct). | — |
| Main moved | **No change**: the identity is the whole repository tree, in Mission Control the whole factory tree. A partial-tree identity cannot fail closed against new reads of factory files. | — |

Not covered, stated as accepted limits (as in DR-146 and DR-158 today): `node_modules` contents beyond install metadata, generated clients (Prisma, content-collections) beyond what install metadata implies, browser binaries and system fonts. Copying a stamp between two worktrees with the same tree and inputs is not a risk: the check already requires both.

### 2.4 Fewer rounds

| Measure | Mechanism | Targets | Cost |
|---|---|---|---|
| Route types regenerated, tools present | §2.2 step 4; also `next typegen` at the start of verify.sh's static stage when `.next/types` is missing | 5 of 22 recent reds (only ≈ 3 min of wall time, measured; correctness and noise) | seconds (not measured) |
| Repair pre-check before re-queueing | Rule in skills and in the engine's patch unit: after a static or Vitest red, run the static checks + the whole Vitest suite (`verify.sh --only=<static stages>,vitest`) before re-entering the queue; after a Playwright red, the failing spec file plus the static checks | the 3 audited "fix broke something else" cases (all static/Vitest); 7 such reds classified in all | ≈ 74 s Mission Control; up to ≈ 9 min funko, per red |
| Diagnosis run after a red (outside the lock, never certifying) | New flag `verify.sh --diagnose-unit` = all static checks reported + Vitest without bail; **Playwright untouched** (the existing `--no-bail` switches Playwright to one global worker, `playwright.config.ts:142, 165-166`, so it is not used). Offered by the queue's red message, run by the session or patch unit on the same tree, under the slot | hypothesis 7; measures how many reds have ≥ 2 failures | only on reds: up to the rest of Vitest (≈ 55 s Mission Control, up to ≈ 9 min funko, measured stage maxima) |
| Heavy-gate cap for every full gate | verify.sh in full mode takes a host slot **unless it inherited one from its caller** (§2.2 step 6); one canonical slot directory, fail closed if unusable; one owner-token and reclaim protocol shared by the shell queue and the Node engine; bounded wait with position. The cap is 1-2 slots depending on CPU count (2 on the owner's 10-core machine). | 3 recent load-timeout reds; other sessions' ad-hoc test runs stay outside the cap (stated) | waits move from "timeouts mid-gate" to "visible wait before the gate" |
| Load recorded | load average at gate start and end in the log; timeout reds under load > core count labelled "environment-suspect" | measurement for a later admission rule | none |
| Flaky suspects ledger | Every queue run and diagnosis run appends per-test outcomes with tree, seed, worker and project to `.pandacorp/run/test-outcomes.jsonl`; a test with both outcomes on the same tree becomes a *suspect*, shown in Mission Control. **Nothing re-runs to turn a red green; no agent can exclude a test.** Exclusions only by owner decision (decision 5): per exact test id, with a reason and an expiry of at most 14 days; the stamp expires at the earliest exclusion expiry; excluded tests still run in a nightly full run in a disposable worktree at main's tip (part of decision 5, independent of decision 4), and their outcomes go to the ledger. | 6-9 of 60 reds (estimated) | none for the ledger; one nightly gate per project with exclusions |

The engine's patch unit after a red is still judged by the next queue run (unchanged); it gains the repair pre-check.

### 2.5 A faster gate

| Project | Profile today | Lever | Estimated effect | Risk |
|---|---|---|---|---|
| Mission Control | Playwright test run 432 s: serial tier `desktop` + `mobile` = 425 tests, 274 s summed at 1 worker; parallel tier 465 tests, 416 s summed over 3 workers ≈ 139 s (measured, n = 1 run, `S/out/verify-mission-control.log`) | The serial tier is serial because its specs write shared fixture state (DR-158). Give each worker its own copy of the fixture roots (the deferred sandbox of §2.3), then move those specs to the 3-worker tier after an inventory review | Playwright ≈ 432 → 250-300 s; full gate ≈ 8.7 → 5.5-6.5 min (estimated: 274 / 3 ≈ 91 s) | Hidden cross-spec dependencies; mitigated by the reviewed inventory and the flaky ledger |
| funko-tracker | Green queue run wall median 17.6 min (n = 20); Playwright stage median 7.8 min (n = 7, mixed runs), Vitest up to 8.9 min (n = 16); only stage sums exist for full runs | **Profile first.** Missing: per-stage wall on a clean main checkout; Vitest split by environment (jsdom vs node) and database setup per worker; Playwright split serial vs parallel and visual vs behaviour; production build time; time waiting for the machine test lease. Candidate levers: database-heavy tests to the node environment; review the serial browser inventory now that each worker has its own database (since 13 Nov); reuse the production build between the engine's feature gate and the queue when the tree is identical | Not estimated until profiled | — |
| personal-page-v2 | Stage sum 3.8 min (n = 1) | None needed now; profile only if the log shows growth | — | — |

Time budgets that **fail** a change when exceeded (today DR-159 only warns, and no project has a `gate-budget.json`) are decision 6.

### 2.6 The production path without a gate (decision 2)

The launched projects' pre-push hook gains: refuse a push to `main` unless the exact commit being pushed (read from the hook's input) has proof of a green full gate, **or** the owner set `PANDACORP_OWNER_UNGATED_PUSH=1`, in which case the push is logged with commit, time and reason. Proof, in order: (1) a queue-log event "gated and fast-forwarded `<sha>`" written under the lock by the queue that is pushing; (2) otherwise `green-stamp.sh check` in the main checkout matching that commit's tree. A direct commit on main needs a full gate on the clean main checkout (which records a stamp) or the bypass.

**Not verified:** whether a queue landing passes check (2) in the main checkout. `check` there re-hashes the main checkout's own install metadata, ignored `e2e/` files, `.env*` and `lane.env`, and runs with the environment git gives the hook; any difference would refuse the push after the ff already happened (an exit-13 state). That is why proof (1) comes first. The phase-1 test `test-pre-push-requires-stamp.sh` must cover exactly this case before the rule is switched on.

---

## §3 · When main moved between the green gate and the owner's order

Only relevant for launched projects with a deferred order (6 of 61 funko episodes started without the order, measured). With the order up front, gate and ff are in one critical section and main cannot move in between (once direct commits take the lock, §2.2).

| Case | What happens | Merge time |
|---|---|---|
| Main did not move | stamp check → ff of the gated sha → push | ≤ 2 min (measured 44 s for EP048 and ≈ 13 s probable for EP047, both deferred orders) |
| (a) Main moved, rebase clean, no shared files | identity changed → full gate again under the lock | one full gate (Mission Control ≈ 9 min; funko median 17.6 min; personal-page-v2 ≈ 4 min) — **does not fit in 2 min** |
| (b) Rebase conflict | exit 10; the resolution is new code → `implemented-uncertified` → queue again | resolution + one full gate |
| (c) Main moved and touched the same files | same as (a); textual success says nothing about semantics | one full gate |

No shortcut is proposed for any case. Mitigations: a faster gate (§2.5); the FIFO lock (§2.2) so the wait is visible and ordered; and, and giving the order up front, which removes the window (decision 3, adopted as the default for launched projects: the agent asks at the start of the work whether to authorize landing once the queue is green).

Two sessions at once: both queue on the FIFO lock; the second rebases on the first's landing and gates that tree. No background re-certification and no writes to other sessions' checkouts exist in this design.

---

## §4 · Every path that says "done" today, and what changes

| Path | Gate today (`S/out/rules.md` §1b) | What it may say after |
|---|---|---|
| Session turn end (Stop hook), worktree | light | "implemented, not certified" (new worktree message) |
| Session turn end, main checkout | light; prints that the full gate has not run | "implemented, not certified" unless a valid stamp on main |
| Engine unit gate | light | "implemented, not certified" |
| Engine feature gate (`g2` job) and work orders `VERIFIED` | since gate | `VERIFIED` keeps its meaning (reviewed + feature gate); the run is not "done" until `land` exits 21 or 0 |
| Engine rescue run | full, in a sparse unit worktree | diagnosis only; "implemented, not certified" |
| Engine landing (`land` job) | queue | `certified-awaiting-order` (21) or `landed` (0) |
| Engine close-out | none | reports the landing state; never "done" before it |
| Manual recipe "commit → verify.sh → merge-queue.sh" | two full gates; the first never certifies in a worktree | "commit → merge-queue.sh"; plain verify.sh is a diagnosis tool |
| `worktrees` skill "Integrar" | queue | queue states |
| `sync` close-out | accepts a green since gate | its commit lands through the queue (or takes the lock on an internal main); until then "implemented, not certified" |
| `implement-backlog` (factory) | the item's own tests; merges to factory main directly | takes the merge lock for its commit; reports "merged to the factory; Mission Control gate not run" when it touched files Mission Control's tests read |
| Direct commits on main, internal project | light | "implemented, not certified" until a full gate on the clean main checkout |
| **Direct commit + push, launched project** | **none (pre-push checks only the flag)** | blocked by the pre-push rule (decision 2) |
| Batch integration (DR-141) | one queue run on the combined branch | queue states; one queue run per batch is unchanged |

---

## §5 · Blocking versus background

| Check | Blocking? | Risk if wrong | Detection | Reversal |
|---|---|---|---|---|
| Full gate on the rebased tree, under the lock | Yes (all projects, unless decision 4 B for Mission Control) | Accepted limits of §2.3 (unhashed toolchain, browsers, generated code) | Next full gate of any change | Revert through the queue; launched: Vercel instant rollback (allowed by DR-138 as incident response) while main is fixed |
| Stamp check for an owner-order re-run | Yes (seconds) | Same limits, within the 12 h age | Same | Same |
| Owner order (DR-138) | Yes | Order given for the wrong change | Queue log (order, sha) | Rollback + revert |
| Pre-push proof (decision 2) | Yes | Owner bypass misused; check (2) refusing a legitimate queue push (§2.6) | Bypass log; phase-1 test | Bypass, logged |
| Diagnosis run, ledger, load record | No | A diagnosis read as a pass (never: it cannot write a stamp) | — | — |
| Mission Control browser tier (only if decision 4 B) | No: runs after each landing in its **own disposable worktree at main's tip**, never in the shared factory checkout | A behaviour, visual or mobile regression reaches Mission Control main for up to ≈ 7.5 min (measured Playwright stage 446.7 s); other sessions' gates on top of it would fail for a reason they did not cause | Background result + desktop notification + `main-red` marker in the log | `main-red` blocks further Mission Control landings and the snapshot redeploy until a revert or fix lands through the queue (≈ 75 s blocking gate) |
| Excluded tests (only if decision 5 B or C) | No | A real defect hides in an excluded test until its expiry (≤ 14 days) | Nightly full run in a disposable worktree at main's tip; ledger; the stamp expires at the earliest exclusion expiry | Remove the entry |

---

## §6 · Time budget

### 6.1 The owner's landing step (order on a certified, current tree)

A single deadline of 120 s for the whole step; each wait gets what is left. The stamp hand-off (a file copy) is inside the step; reconcile runs after the landing event, outside the budget.

| Step | Mission Control¹ | funko-tracker | personal-page-v2 | Basis |
|---|---|---|---|---|
| Lock, no contention | ≤ 5 s | ≤ 5 s | ≤ 5 s | estimated |
| Main-busy preflight, restore config, local fetch, rebase (no-op) | ≤ 15 s | ≤ 15 s | ≤ 15 s | estimated; rebase time not measured |
| Environment step (no reinstall; `next typegen`; tool check) | ≤ 10 s | ≤ 10 s | ≤ 10 s | estimated; `typegen` time not measured |
| Stamp check | ≤ 10 s | ≤ 10 s | ≤ 10 s | hashing `e2e/` measured 0.04-0.05 s per project (this session); process start-up estimated |
| Order check, ff of the gated sha, stamp hand-off | ≤ 5 s | ≤ 5 s | ≤ 5 s | estimated |
| Push of the gated sha | — | ≤ 60 s | ≤ 60 s | estimated; timeout → "result unknown" |
| **Total** | **≤ 45 s** | **≤ 105 s; measured 44 s (EP048) and ≈ 13 s probable (EP047)** | **≤ 105 s** | |

¹ Mission Control is internal: there is no separate owner step; this row applies only if decision 4 B makes its blocking gate short.

The 2 min holds **only without contention**: if another gate of the same repository holds the lock, the step waits in FIFO for it (up to one full gate) and then, because that change landed first, its own tree is stale and needs a full gate (§3 a). The log will measure how often.

### 6.2 "Done to main" and where the cost goes

| | Mission Control | funko-tracker | personal-page-v2 |
|---|---|---|---|
| Full gate, today | 8.7 min (measured, n = 1) | green queue run median 17.6 min, p90 24.9 (measured, n = 20) | 3.8 min stage sum (measured, n = 1) |
| Full gate, after §2.5 | 5.5-6.5 min (estimated); ≈ 75 s blocking + 7.5 min background if decision 4 B (static + Vitest measured 73.7 s) | unchanged until profiled | unchanged |
| "Done to main", today | not measurable (queue used once) | from first queue run: median 25.5, p90 209 min; from declared "ready": 29.0 / 211 min (measured, n = 22, since 13 Nov) | no episodes |
| "Done to main", after phases 0.5-1 | ≈ one full gate per round | **not recalculable.** The only mechanical what-if (removing the 5 rounds whose cause the environment step fixes) leaves the median and p90 unchanged at 25.5 / 209 min (measured, `S/out/v3counts.py`). The other levers (repair pre-check, diagnosis run, lock fixes) act through how sessions repair code, which the transcripts cannot replay; their effect is measured in phase 1 against the phase-0 baseline. A faster funko gate would shorten every round, but has no estimate until profiled. | ≈ one full gate per round |
| Cost added | repair pre-check ≈ 74 s per static/Vitest red; diagnosis ≈ 55 s per red (optional) | repair pre-check up to ≈ 9 min per static/Vitest red; diagnosis up to ≈ 9 min per red (optional); `typegen` seconds per run | small |
| Cost removed | the second full gate of sessions that verified before the queue (recipe change) | same (19 of 62 episodes ran a full verify before the queue, measured) | same |

---

## §7 · Ideas considered and rejected (v1 included)

| Idea | Verdict | Why |
|---|---|---|
| v1: certify at "done" outside the lock, then an identity-only merge | **Rejected** | For 55 of 61 episodes it relabels the same gate and rounds; rebasing before waiting for the lock makes the second of three simultaneous sessions gate a stale tree and pay twice (breaks DR-096's convergence). |
| v1: background re-certification of every other certified branch when main moves | **Rejected** | It writes into other sessions' worktrees (rebase, config restore, long gates), takes funko's machine test lease away from interactive work, needs a new engine job kind, and does not converge when main moves often. |
| v1: Mission Control stamp bound to its subtree + declared factory inputs, proven by a sparse checkout | **Rejected** | A sparse checkout sets skip-worktree bits the stamp forbids, and it cannot fail closed against new reads guarded by "file missing → fallback" (`plugin-sync.ts` does exactly that). The design red-team derived that main moves during a 9 min Mission Control gate about 7 % of the time, so the gain is small. |
| v1: declared gate environment with `env -i`; `PATH`/`HOME` as location-only | **Rejected** | `PATH` and `HOME` change behaviour; launching verify under a different environment than the readers creates mismatches. Replaced by extending the existing `controls` list. |
| v1: Vitest no-bail + "related tests first" inside certification | **Rejected** | The existing `--no-bail` turns Playwright into a one-worker diagnosis run; "related first" adds work to every green run. Replaced by a separate diagnosis flag used only after a red. |
| v1: quarantine maintained by the agent; same-tree re-run of the failing file | **Rejected** | A subset re-run does not reproduce order, workers or database state; the agent could exclude a test inside the branch it is certifying; in launched projects that is a weaker gate to production. Replaced by the suspects ledger and owner-only exclusions. |
| v1: Mission Control quick path for disjoint changes; production quick path option | **Rejected** | "Disjoint files" is not safe (a global CSS token change breaks a new page's visual test); a production quick path contradicts DR-158 and the owner's request. |
| v1: database fingerprint and reseed in the preflight | **Rejected** | 0 database reds since funko's per-worker isolation (13 Nov); the reseed could drop a database another gate is using. |
| Full bootstrap after the rebase inside the queue (v2 draft) | **Rejected** | Rewrites the tracked port file and sets skip-worktree: exit 11 at `merge-queue.sh:209-219` and no stamp ever. Replaced by the dependencies-only step. |
| Automatic retries of failing tests | **Rejected** | DR-146 "no retries"; would hide real races and load regressions. |
| Impact-selected tests as the merge gate after a rebase | **Rejected** | No spec-level impact map for Playwright; `--affected` only skips the browser for proven data-only diffs and never certifies (DR-158; the 3 unmerged commits on `feat/verify-affected-browser-gates` do not change that). |
| Moving Playwright/visual out of the blocking path in all non-launched projects | **Rejected as a rule**; offered for Mission Control only as decision 4 | See decision 4. |
| Stage time budgets that fail on absolute wall time | **Rejected as the default** | Load makes a green stage slow; failing it adds a round. A budget on test time added by a change is offered in decision 6. |
| Signed stamps / anti-forgery cross-checks | **Rejected** | The check already requires the same tree and inputs; the threat model is one operator on one machine. |
| Speculative parallel queue; gates in cloud CI | **Rejected / out of scope** | 1-2 heavy slots per host; DR-140 keeps tests local and adds no spend. |

---

## §8 · Phases (each ships alone)

| Phase | Ships | Expected effect | Proof it worked | Machinery tests (new unless stated) |
|---|---|---|---|---|
| **0 · Measure** (no behaviour change) | Queue log `.pandacorp/run/queue-log.jsonl` resolved from the project directory: one UUID per attempt; a durable start event; events for lock (ticket, acquired), slot, rebase, environment step, stamp check (+ `--explain` reason), gate start/end (+ archived gate report path), order check, ff (sha), push (sha, result), terminal event with exit code; load at gate start/end; atomic appends. Gate reports archived immutably as `gate-reports/<attempt-uuid>.json`. "Done to main" metric in both definitions (Q and R; R needs a "ready" event, which the engine and the state names of §2.1 provide), plus rounds per episode. | None | ≥ 1 week of baseline before phase 0.5 ships; every ff event in the log matches a reflog fast-forward; direct commits identified separately | `test-queue-log-events.sh` (events for exits 0/10/11/12/13/14/20/21; a killed run leaves its start event); `test-gate-report-archive-unique.sh`; existing `test-merge-queue-*.sh` green |
| **0.5 · Cheap fixes** | Lock ownership + FIFO; dependencies-only environment step after the rebase (exit 16); ff and push of the gated sha; exit 17; `controls` extension + `--explain`; slot inherited by verify.sh, fail closed, one protocol; Mission Control run outputs reset and excluded; `updateSnapshots: "none"` for full-scope gates only; explicit error without `verify.sh`; reconcile resolved from the project; `with-merge-lock.sh` for routines, upgrade, implement-backlog, sync | Fewer environment reds; stamps survive exit 21 → order; no lost-lock races; no double slots | Mechanically fixable environment reds since the baseline: 0 (from 5 of 22); `[certified-tree]` on ≥ 90 % of order re-runs whose base did not move; Mission Control full gate records a stamp | `test-merge-queue-lock-ownership.sh` (a timed-out waiter never removes the holder's lock); `test-merge-queue-env-step-keeps-committed-config.sh` (after the step, `e2e/server-env.json` and `.claude/launch.json` equal HEAD, no skip-worktree entry exists, the gate does not exit 11, and a stamp can be recorded); `test-merge-queue-env-step-after-rebase.sh` (lockfile change → reinstall before the gate; missing types → exit 16 before the gate); `test-merge-queue-ff-gated-sha.sh` (a commit added by name after the gate is neither merged nor pushed); `test-merge-queue-single-slot.sh` (one queue holds one slot; two queues never deadlock); `test-green-stamp-controls.sh` (different `TMPDIR`/cache → same fingerprint; different `PATH` → mismatch named by `--explain`); `test-green-stamp-run-outputs.sh`; `test-verify-snapshots-none-full-only.sh`; `test-host-slot-fail-closed.sh`; Mission Control e2e "only declared outputs change under e2e/" |
| **1 · One meaning of done** | States and `--status`; engine records 21/0 states; Stop hook worktree message; skills and standards wording and recipe; required `record` before ff (after the Mission Control output fix is live); pre-push proof (decision 2); diagnosis flag and repair pre-check; flaky suspects ledger | No "done" that later fails to merge; fewer "fix broke" rounds | Zero `landed`/`certified-awaiting-order` reports without a matching log event (audit); "done to main" median and p90 (both definitions) vs the phase-0 baseline; share of episodes with ≥ 3 rounds vs baseline | `test-merge-queue-status.sh`; `test-merge-queue-requires-record.sh` (green gate + refused record → exit 11, no ff); `test-pre-push-requires-stamp.sh` (direct commit refused; bypass logged; a queue landing passes through proof (1) and through check (2) with the main checkout's own install metadata, `e2e/` and `.env*`); `test-verify-diagnose-unit.sh` (Vitest lists all failures, Playwright worker count unchanged); engine `test-land-states.mjs`; updated `test-verify-before-stop.sh` |
| **2 · Faster gate** | Mission Control per-worker fixture roots and serial-tier review; funko profile and its chosen levers; worktree port moved out of the tracked file | Shorter rounds | Mission Control full gate wall ≤ 6.5 min on 3 consecutive green runs; funko figures after profiling | `test-e2e-tiers.mjs` extended (existing); `test-playwright-port-precedence.sh` across the three projects |
| **3 · Owner-dependent** | Decision 4 B (Mission Control browser in a disposable background worktree + `main-red`), decision 5 exclusions and their nightly run, decision 6 budgets | Per decision | Per decision; decision 4 B kill rule: any `main-red` caused by a Mission Control landing in its first 20 landings restores the blocking browser tier | per decision |

Every phase bumps plugin metadata and the overlay version, reaches the three projects through `/pandacorp:upgrade`, and records its DR and decision-log entry, as in proposals 40-41. Phase 0 must run on unchanged machinery: the post-13-Nov transcript baseline (n = 22) is the only contemporaneous one today.

**Decisions in force that change:**
- **DR-096** (queue protocol): lock ownership and FIFO, dependencies-only environment step, exits 16/17, fixed shas for ff and push, the lock taken by direct-commit tools.
- **DR-141** (batch integration): one queue run per assembled batch is unchanged, but the recipe no longer recommends a separate full `verify.sh` before the queue as the batch's evidence; the queue's own `[full-gate]` run is the evidence.
- **DR-146** (certified tree): `controls` list, declared run outputs, required record, `--status`, `base=` field.
- **DR-153** (git pre-push guard) — only if decision 2 is taken: the launched projects' pre-push hook adds the gate-proof condition and the logged bypass.
- **The quality rule "a missing visual baseline on a genuinely new route = bless at the feature gate, not a failure"** (DR-056/DR-080, `docs/rules/quality-and-testing.md`): for full-scope gates only, a missing baseline becomes a red with the bless instruction; light and since gates keep today's behaviour.
- **DR-158** — only if decisions 4 B or 5 B/C: a Mission Control blocking gate without the browser tier; owner-approved exclusions. The diagnosis flag is outside certification and changes nothing in it.
- **DR-159** — only if decision 6: failing budgets.
- **DR-138 is not changed**: the order stays per landing and is checked before ff and push; the pre-push rule only adds a condition; no background job ever inherits `PANDACORP_OWNER_RELEASE_OK` (`land/command.mjs:98-102` strips it only for the `drive` actor today; the new tests cover jobs started from the CLI too).

---

## §9 · Red-team record

Three independent reviews: two attacked v1 (design and data, `S/out/redteam-design.md`; mechanics against the code, `S/out/redteam-mech.md`), and a verifier checked v2 (`S/out/final-verification.md`). Every finding and its disposition is in `S/out/dispositions.md`. What they broke and what changed:

| Attack | What changed |
|---|---|
| v1 renamed the pain: with the order up front (verified: 55 of 61) "done" arrived when "main" arrives today | TL;DR and §1 rebuilt around gate duration × rounds; the 2 min target is stated only for the deferred-order step |
| Certifying outside the lock gates stale trees; background re-certification writes into other sessions' checkouts | Single critical section kept; no background writers |
| A production path without any full gate exists (two direct pushes today, verified in the `origin/main` reflog) | Pre-push proof, decision 2 |
| Agent-maintained quarantine is a weaker gate to production | Ledger only; exclusions owner-only with expiry; none in launched projects by default |
| Sparse proof for Mission Control cannot work with the stamp's skip-worktree rule | Whole-factory identity kept |
| A timed-out waiter deletes the holder's lock (verified) | Lock ownership + FIFO |
| verify.sh reports green when the stamp was refused (verified, `verify.sh:628`) | Required record before ff |
| `--no-bail` switches Playwright to one worker (verified) | Separate Vitest-only diagnosis flag, outside certification |
| v2: a full bootstrap after the rebase would rewrite the tracked port file and set skip-worktree (verified against `worktree-bootstrap.sh:177-222` and `merge-queue.sh:209-219`) | Environment step limited to dependencies, `typegen` and tool checks; new machinery test |
| v2: "done to main" figures counted from a declared "ready", not from the first queue run; the green-run median used a nearest-rank median | Both definitions published; standard medians; recalculation script `S/out/v3counts.py` |
| v2: the funko "after" estimate was inherited from the v1 review, not recalculated | Recalculated as a mechanical what-if (no change) and declared not recalculable otherwise |
| v2: the queue and verify.sh would each take a heavy-job slot | verify.sh inherits the caller's slot |
| v2: undeclared amendments (pre-push guard, batch recipe, missing-baseline rule) | Declared in §8; `updateSnapshots: "none"` limited to full-scope gates |
| v2: excluded tests "still run in the background" only existed with decision 4 B | Nightly run in a disposable worktree is part of decision 5 itself; 14-day expiry in the memo |
| v2: queue landings passing the pre-push check in the main checkout was asserted, not verified | Marked not verified; queue-log proof first; test named |
| Baseline changed on 13 Nov (database isolation); "0 of 60 audited" was 16 audited; stage sums shown as wall time; direct commits omitted | Corrected throughout |
| Mission Control never reconciles after a landing (verified) | Reconcile resolved from the project directory |

Findings accepted only in part, with reasons, are in `S/out/dispositions.md` (in particular: an admission throttle for other sessions' ad-hoc tests stays out of scope; the per-run sandbox copy of all fixture roots is deferred in favour of declared run outputs).

---

## §10 · Residual risks

1. **The ≤ 2 min landing step only exists for deferred orders without contention.** With the order up front, "merge" is a full gate; the gain there can only come from fewer real repair rounds and a faster gate.
2. **The time effect of phases 0.5-1 on funko is unknown.** The mechanical environment fixes remove 5 of 8 recent environment reds but almost no time; the repair pre-check and the diagnosis run have no counterfactual in the data.
3. **funko's gate stays ≈ 18 min until it is profiled**; no lever is committed for it here.
4. **Declared run outputs** could hide a residue-dependent test if the list is too broad; it is a reviewed committed file and everything not on it still invalidates.
5. **The heavy-gate cap does not cover other sessions' ad-hoc test runs**, which caused most load timeouts; the log will show whether that needs an admission rule.
6. **Unhashed inputs** (browser binaries, fonts, generated code, `node_modules` contents) can differ within the 12 h stamp age, as today.
7. **The "done" wording is not machine-enforceable in an agent's prose**; the queue, the engine CLI, `--status` and the pre-push hook are the enforceable parts.

---

## §11 · Not measured or not verified

| Item | Why | What would decide it |
|---|---|---|
| personal-page-v2 full gate today | Dirty main checkout (untracked `.pandacorp/navigation-identity.json`); measuring on a dirty tree was out of bounds | One full gate on a clean checkout |
| Lock, slot and machine-lease waits; exit 12/14/17 frequency; how often main moved between exit 21 and the order | The queue writes no log | Phase 0 |
| Rebase time inside the queue | No log | Phase 0 |
| Visual tests' time, separate from the rest of Playwright | The logs report the Playwright stage as one figure | Per-project timing in the phase-0 archive |
| Duration of a no-op environment step (bootstrap check, `next typegen`) | Not run (no builds allowed in this investigation) | Phase 0.5 tests |
| Whether a queue landing passes the stamp check in the main checkout (pre-push, §2.6) | The main checkout's install metadata, ignored `e2e/` files and `.env*` may differ from the worktree's | `test-pre-push-requires-stamp.sh` in phase 1 |
| Wall time of each funko stage on a clean main checkout | Only stage sums exist, two of three from rescue runs | Phase 2 profile |
| Whether fail-fast hides older failures | The audited cases are new breakages | Diagnosis runs in phase 1 |
| Whether the direct pushes `d98eaccd` and `e1ffcfae` were preceded by a full verify | Not in any log | — |
| Whether funko's consecutive engine landing reds (`land-25-1`, `land-25-2`) were flaky | Seeds 763470787 and 391584655 not replayed | Replay on the same trees |
| Whether EP047's ≈ 13 s landing used the stamp | No `[certified-tree]` marker was captured | Phase 0 log |
| Mission Control's queue behaviour | 1 queue run in 62 episodes; most Mission Control commits land directly | Phase 0 |
| The 26 s Mission Control landing without a stamp marker | Unexplained by the transcript | — |
| Effect of per-worker fixtures on Mission Control's serial tier | Estimated from summed test durations of one run | Phase 2 |
| Whether Playwright with `updateSnapshots: "missing"` passes or fails a test whose baseline it just wrote | Not run | Phase 0.5 test |
| Whether `next build` rewrites `AGENTS.md` during the gate | Not verified | `git status` before and after one gate |

---

## §12 · Decisions for the owner

Full decision cards, in Spanish, are in `S/out/decisions-es.md`. One line each, by urgency:
1. Adopt the plan: measurement, cheap fixes, and one meaning of "done" by observable state.
2. Launched projects: the pre-push hook requires proof of a green full gate for the pushed commit, or a logged owner bypass.
3. Launched projects: give the landing order up front by default, review first by default, or keep deciding per change.
4. Mission Control only: keep the browser tier blocking (and make it faster), or move it to a background run on main.
5. Flaky tests: ledger only; or owner-approved exclusions with a 14-day expiry in Mission Control; or also in launched projects.
6. Gate time budgets: keep warnings, fail on absolute stage time, or fail on test time added by a change.

### Owner decisions (2026-11-20)

**Owner override (2026-11-20): phase 0.5 does not wait a week; overriding the waiting period in section 8, its baseline is the transcript dataset (n = 22 since 13 Nov, `docs/proposals/43-evidence/out/v3counts.py`) plus whatever the new queue log accumulates.**

The owner delegated the six decisions with this criterion: "the easiest and fastest possible, without affecting that things are reliable and well done". Decisions taken:

| # | Decision | Option chosen | Reason (one line) |
|---|---|---|---|
| 1 | Adopt the plan | **A**: all phases (0 measure, 0.5 cheap fixes, 1 single meaning of "done"), then phase 2 faster gate | Cheapest start, measurement first, and each phase is reversible |
| 2 | Pre-push gate proof in launched projects | **A**: mandatory, with an explicit owner bypass that is logged | Closes the only path to production without a full gate at almost no cost |
| 3 | Landing order in launched projects | **A**: up front by default | Already the case in 55 of 61 episodes; fastest, with no new flow to learn |
| 4 | Mission Control browser tests | **A**: stay blocking, made faster with per-process test data | Keeps reliability; the speed-up comes from phase 2 rather than from removing a check |
| 5 | Flaky tests | **B**: visible ledger; exclusions authorized by the owner one by one, 14-day expiry, nightly run, Mission Control only, none in launched projects | Fixes the noise without hiding defects where production is at stake |
| 6 | Gate time budgets | **C**: fail when the tests a change adds exceed their own cap; baseline and general warnings | Targets the cause (new slow tests) without punishing machine load |

Note on decision 3: this memo recommended C (no default rule: decide per change). The owner chose A because of the speed criterion and because the order is already present on the first run in 55 of 61 episodes. Under A, the agent asks at the start of the work whether to authorize landing once the queue is green; the full gate still runs before publishing, and DR-138 does not change (still an explicit owner order per landing, only requested at the start). Consequence for the design: the deferred-order path of §3 becomes the exception, not the default.

Conditional parts of the memo resolve as follows: "only if decision 4 B" parts are not adopted; "decision 5 B or C" parts apply as B (Mission Control only); "decision 6" applies as C.

