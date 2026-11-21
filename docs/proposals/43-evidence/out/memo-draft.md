<!-- proposed file: docs/proposals/43-certified-done-two-minute-merge.md -->
# 43 — "Done" means certified: merge in under two minutes without weakening main

**Status:** proposed, not red-teamed by an independent reviewer yet; nothing here has been executed · **Date:** 2026-11-20
**Home:** FACTORY proposal (overlay machinery: `merge-queue.sh`, `green-stamp.sh`, `verify.sh`, `worktree-bootstrap.sh`; build engine `land`; standards). Plugin 10.14.3, overlay template 9.4.2. Applies to mission-control (overlay 9.2.0, internal), funko-tracker (9.4.2, launched) and personal-page-v2 (9.2.0, launched).

Every number carries a mark: **measured** (read from a log, a report, git or a timed command), **derived** (arithmetic on measured numbers) or **estimated** (a judgement, with its basis). Evidence files live in the investigation scratchpad `S=/private/tmp/claude-501/-Users-sergio--claude-spares-spare-TJqzMF/d175f413-182a-404b-bc80-1f5840e42eb6/scratchpad` and are cited as `S/out/rules.md` etc. That folder is temporary; whoever adopts this memo should copy the four `S/out/*.md` files next to it.

---

## Terms used

- **Gate:** `.pandacorp/verify.sh`, the script that decides whether a tree is good. **Full gate:** verify.sh with no flags: static checks (lint, types, dead code, cycles, doc lint), the whole Vitest suite and the whole Playwright suite (behaviour, visual, responsive, mobile). **Light gate:** `verify.sh --light`: static checks plus, at most, the tests of the files a session edited. **Since gate:** `verify.sh --since <sha>`: static checks, Vitest on changed files, and only the smoke and shell browser specs.
- **Merge queue / the queue:** `.pandacorp/merge-queue.sh`. Today it takes a lock, rebases the branch onto main, runs the full gate on the rebased result, and fast-forwards main (plus `git push` in launched projects).
- **Rebase:** replaying the branch's commits on top of the current tip of main. **Fast-forward (ff):** moving main to the branch tip without creating a merge commit.
- **Certified tree / stamp / certificate:** a small gitignored file (`.pandacorp/run/green-stamp`, written only by verify.sh through `green-stamp.sh`) saying "this exact tree passed a full green gate in this environment". The queue skips its own gate when the stamp matches (DR-146). In this memo, **certification** means "a full green gate on the exact tree that will be merged, which leaves a valid stamp".
- **Worktree:** a second checkout of the same repository. **Bootstrap:** `worktree-bootstrap.sh`, which prepares a worktree (dependencies, a private e2e port). **Skip-worktree:** a git flag that hides a local edit of a tracked file from `git status`; the bootstrap uses it to hide its port rewrite.
- **Launched project:** `phase: release` and not `deploy_target: internal`. For these, DR-138 makes main = production: every push to main deploys, and only the owner's explicit order per landing allows it (`PANDACORP_OWNER_RELEASE_OK=1`). The queue stops with **exit 21** when the gate is green but the order is missing.
- **Engine gates:** the build engine (`pandacorp-build.mjs`) runs a light gate per unit of work (called G1 in the code), a since gate per feature (G2) and the queue's full gate when it lands the run (G3).
- **Flaky test:** a test that passes and fails on the same tree. **Quarantine:** a visible, temporary list of tests excluded from the blocking gate.
- **Episode:** one change's path from the first queue run to landing (or abandonment), reconstructed from session transcripts (`S/w-tr/episodes.md`). **Round:** one queue run inside an episode.

---

## TL;DR

1. **Today "done" and "mergeable" are judged by different gates, and the certificate that should make merging cheap almost never works.** No path that declares a change done runs the full gate on the tree that will be merged; the first one is the queue's own (`S/out/rules.md` §1b, §8.1). The stamp that would let the queue skip its gate is invalidated by the worktree bootstrap, by session-specific environment variables, by any movement of main (Mission Control shares main with the whole factory) and, in Mission Control, by Playwright writing into `e2e/` during the run itself (measured today: a green full gate ended with "inputs changed during the run — nothing certified", `S/out/measure.md` §2-3). In transcripts: 2 `[certified-tree]` runs against 28 `[full-gate]` runs (measured, `S/out/episodes-audit.md` B6).
2. **Where the time goes (funko-tracker, 61 of the 62 episodes):** 43 % land on the first run; time to land is a median of 29 min and a p90 of 272 min; **68 % of that wall time is between runs**, not inside them (measured, `S/out/episodes-audit.md` B1-B2). Of 60 red gates: about 19 were real defects the earlier gate did not cover, about 19 were the environment (load timeouts, a shared test database, unprepared worktrees), 6-9 were flaky tests, 7 were "the fix broke something else", and none was caused by main moving (estimated from a 16-red audited sample, `S/out/episodes-audit.md` Part A).
3. **The design: certify once, at "done", on the tree that will be merged; the merge only checks identity.** A new `merge-queue.sh --certify` mode does everything the queue does today up to and including the green full gate, leaves a stamp that actually survives, and stops. "Done" is defined as "this mode was green and its stamp still matches". Merging becomes: lock → rebase → stamp check → fast-forward (→ push with the owner's order). Measured certified landings already take 10-44 s (funko, `S/w-tr/episodes.md` EP046, EP048).
4. **To make the stamp survive:** certify on the committed e2e configuration (not the worktree port); run the gate with a declared, reproducible environment; stop Mission Control's e2e from writing into its own fixtures; for Mission Control, bind the certificate to its own subtree plus the factory files it provably reads, not to the whole factory tree.
5. **When main has moved after certification:** (a) clean rebase, no overlap inside the project's inputs: re-certify in the background as soon as main moves; the merge waits only for what is left of that run; (b) conflict: resolve, then certify again; (c) real overlap: certify again, always. Nothing reaches main without a full gate on its exact identity, for any project, unless the owner approves the optional Mission Control-only quick path (decision 2, option C).
6. **Fewer rounds, not just a faster last step:** a seconds-long environment preflight (bootstrap, generated types, test database health) before certification; Vitest and static checks report every failure in one red run; a same-tree re-run of a failing test to tell "flaky" from "broken", feeding a visible flake ledger and, if the owner agrees, a capped, expiring quarantine.
7. **Honest arithmetic:** the merge step fits in 2 min only when the certificate is fresh. The cost does not disappear: "done" now includes one full gate (Mission Control 8.7 min, funko-tracker about 24 min, personal-page-v2 about 3.8 min; measured, single or few runs). For a session that already ran a full gate before the queue (19 of 62 episodes) the total drops by one full gate. Estimated share of landings that find a fresh certificate: personal-page-v2 above 90 %, Mission Control 70-90 % with subtree binding, funko-tracker 60-80 %. The rest wait for a background re-certification.
8. **First phase is measurement:** the queue writes no log today, so lock waits, slot waits, exit 12/14 frequency and "main moved" frequency cannot be measured. An append-only queue log ships first and is the acceptance oracle for every later phase.

---

## §1 · Diagnosis

### 1.1 Timeline: where the time goes

| Span | Mission Control | funko-tracker | personal-page-v2 | Source |
|---|---|---|---|---|
| One full gate, green | **523 s = 8 min 43 s** (measured 2026-11-20, machine load 6-8): Playwright 446.7 s (85 %), Vitest 54.5 s (10 %), every static check ≈ 20 s (4 %); 890 e2e tests, 3 workers | **1407 / 1459 / 1499 s** (measured, three green full gate reports); Playwright median 7.8 min (max 17.3), Vitest up to 8.9 min (measured, 7 and 16 reports) | **3.8 min** (measured, one report 2026-11-13): Playwright 160.6 s, Vitest 58.0 s; not re-measured today (dirty tree) | `S/out/measure.md` §2; `S/out/rules.md` §8.2; `S/w-ext/timeline-ext.md` l.578-594, 1224-1239 |
| One queue run (any outcome) | 26 s (measured, n = 1: the only Mission Control queue run in the dataset) | median 11.5 min, p90 21.6 min (measured, 137 runs; red runs stop early) | no runs in the dataset | `S/out/episodes-audit.md` B1 |
| Change, first queue run → landed | n = 1 | median 29 min, p90 272 min (measured, 61 episodes) | — | same |
| Share of wall time inside queue runs vs between them | — | **32 % inside, 68 % between** (measured: 25.3 h of 79.5 h) | — | `S/out/episodes-audit.md` B2 |
| Owner's order wait after exit 21 | — | median 69 min, max 281 min (measured, n = 3) | — | same |
| Rounds per episode | — | 1 round: 30 · 2: 11 · 3: 10 · 4 or more: 11 (measured) | — | `S/out/episodes-audit.md` B5 |
| Outcomes of 138 runs | — | landed 58 · red gate 60 · rebase conflict 6 · main busy or lock 5 · exit 21: 4 · other 5 (measured) | — | `S/out/episodes-audit.md` B3 |

Reading it: the queue run itself (median 11.5 min) is not what makes merging take a morning. A morning comes from **rounds**: red → diagnose → fix → re-run, each round paying a full gate again, plus the owner's order wait in launched projects. The "between runs" 54.3 h includes at most 6.4 h of owner waits (derived from the three measured waits), so most of it is diagnosis, repair and re-waiting (derived; the split inside is not measurable without a log).

Historic contrast for Mission Control: the last captured landing (2026-11-03, before DR-146/158) spent about 23 min in its suites alone (measured, `S/w-mc/timeline-mc.md` §2-3). DR-158's parallel browser tier brought the full gate to 8.7 min. The gate is now fast enough that certifying it once is affordable; paying it twice or N times is the problem.

### 1.2 Why "done" fails at merge: suspects

Each suspect was either confirmed (the code makes it happen and the transcripts show it), discarded with evidence, or left undecidable with the datum that would decide it. "Predicts" says what we should observe if it is a cause; "Explains the successes" says why the cases that worked, worked.

| # | Suspect | Verdict | Evidence | Predicts | Explains the successes |
|---|---|---|---|---|---|
| 1 | **"Done" is judged by a weaker gate than "mergeable".** Stop hook and engine unit gate are light; the engine's feature gate is a since gate (smoke and shell browser specs only); the first full gate on the merged tree is the queue's. | **Confirmed** (code) | `S/out/rules.md` §1b, §8.1 (VBS:103-127; RB/report.mjs:166-176; RB/next/constants.mjs:27-34; MQ:242) | Reds in surfaces never run before: unchanged Vitest files, non-smoke e2e, visual, mobile. ≈19 of 60 reds were own defects not covered by the earlier gate (estimated). | Small changes that do not touch those surfaces land first time (43 %). |
| 1b | …but "ran a full verify before the queue" did **not** predict first-time landing (5/19 = 26 % vs 47-54 % without). | **Undecidable**, confounded | `S/out/episodes-audit.md` B4: full verify was used on big batches; sessions edited after verifying (EP008, EP022, EP043); subagent gates undetected | — | Matching gates is necessary but not sufficient; environment and flakiness weigh as much. |
| 2 | **The certificate cannot be reused.** (i) bootstrap rewrites `e2e/server-env.json` and hides it with skip-worktree, and a stamp needs zero hidden entries; (ii) the stamp hashes every environment variable, including per-session `TMPDIR` and cache paths; (iii) it binds the whole repository tree, so any movement of main invalidates it (Mission Control: 44 factory commits on main in 7 days, measured); (iv) it expires after 12 h; (v) in Mission Control the e2e run writes ignored files under `e2e/fixtures/`, so even a green gate on a clean main checkout certifies nothing. | **Confirmed** (code + experiment + transcripts) | `S/out/rules.md` §3; `S/out/measure.md` §3 (v measured today); transcripts: 2 `[certified-tree]` vs 28 `[full-gate]` | Every landing pays a full gate; a session that verified first pays two. | The 2 (likely 3) certified landings: **EP046**: a subagent manually restored the committed `server-env.json`/`launch.json`, removed skip-worktree, ran the full gate on the committed port and told the coordinator to launch the queue with the same extra variable (`SWC_NATIVE_BINDING_CACHE=0`); main had not moved. Landing took 10 s (measured; transcript `f16022dc…jsonl` l.5587-5611). **EP048**: retry after exit 21 using the queue's own stamp from 30 min earlier, 44 s. **E27.A03**: retry after exit 21, 13 s with no gate marker captured (inferred certified). This resolves the apparent contradiction with (i): the stamp works when a worktree is put back on committed config by hand, or when the queue itself certified. |
| 3 | **Fail-fast certification + fixes verified with a light gate.** Vitest stops at the first failure, Playwright at the first failure; the fix is checked with a light gate or loose tests; the next real judgement is another full run. | **Confirmed** (code) and observed | `S/out/rules.md` §4, §8.5-8.6; funko jobs land-25-1 → land-25-2: two consecutive reds with different failures (measured, `S/w-ext/timeline-ext.md` l.633-666); 7 "fix broke something else" reds (EP010 formatter, EP030 rules lost in conflict resolution, EP049 fix verified with loose Vitest) | Chains of distinct reds; N independent failures need N full runs. | Changes with a single latent failure finish in two rounds (11 episodes). |
| 4 | **Shared test state between runs** (funko's shared `ft_gate` database deleted, wrongly seeded or left with residue). | **Confirmed** | 7 of the environment reds; EP020 "Database `ft_gate` does not exist", EP014 reseed → green with no code change (`S/out/episodes-audit.md` Part A) | Reds unrelated to the diff, cured by reseeding. | Runs where the database was intact. |
| 5 | **Unprepared worktree** (no bootstrap, no generated `PageProps` types, missing biome). | **Confirmed** | 6 reds; EP054 and EP047 (run E27.A01) both failed with `TS2304: Cannot find name 'PageProps'` | Instant static reds in a fresh worktree; cured by `next typegen` or bootstrap. | Worktrees that had been used before. |
| 6 | **Machine load** turning slow tests into timeouts (funko Vitest `testTimeout` 20 s). | **Confirmed as a trigger** | 9 reds diagnosed as load timeouts; two of them passed unchanged in isolation (E23.A02 14/14, E27.A06 4/4); load measured "from 34 down to 5×" in EP031 | Timeout reds that vanish on re-run when the machine is quiet. Only 1 of 60 reds overlapped another queue run (measured), so the load came from other sessions' tests and builds, which the host slot does not cover. | Runs at quiet hours. |
| 7 | **Flaky tests** (order or timing dependent). | **Confirmed** | 6-9 reds (estimated); EP034 (9 s test, 20 s limit, fixed in the test), EP038 ("the app was fine, 20/20 after fixing the test") | Reds that move between runs with different seeds. | Most runs: the suite is mostly stable. |
| 8 | **Main moved and the combination broke** (semantic conflict). | **Discarded as a cause of reds**; rebase conflicts exist | 0 of 60 reds attributable to main moving (audited); 6 of 138 runs were textual rebase conflicts (exit 10) | — | — |
| 9 | **Unbounded waits** before the gate can start: merge lock up to 10 min, host heavy-job slot with no limit, funko's database lease. | **Undecidable** (no queue log) | `S/out/rules.md` §8.8; MQ:56-70, 124-152 | Long silent queue runs with no gate progress. Would be decided by a per-run log with lock/slot timestamps. | — |
| 10 | **Mission Control's "main busy" check looks at the whole factory checkout**, so any uncommitted file anywhere in the factory blocks a Mission Control landing (exit 12). | **Confirmed in code; frequency undecidable** | MQ:183, MQ:273; only 1 Mission Control queue run in the dataset | Exit 12 in Mission Control whenever another factory session has work in progress. | — |
| 11 | Visual baseline drift | **Discarded** | 0 reds | — | — |
| 12 | Port collision giving false reds | **Discarded** | a busy port yields exit 14 before the gate, not a red (MQ:232-238); 0 observed | — | — |
| 13 | Script drift between projects | **Discarded** | queue, stamp and bootstrap identical to the template in all three (`S/out/rules.md` §0) | — | — |

### 1.3 Why fixes break other things

Three mechanisms, all confirmed in code and seen in the 7 cases:
1. **The fix is checked by a weaker gate than the one that judges it** (light gate, a single test file, a partial subagent check). The next real judgement is a full queue run, 12-25 min later (`S/out/rules.md` §4).
2. **Fail-fast hides the second failure.** When run N shows failure B after failure A was fixed, it is often not "the fix broke B"; B was already broken and hidden. Without a run that reports everything, the two cannot be told apart (`S/out/rules.md` §8.5).
3. **The repair happens on the rebased tree, in a worktree whose environment differs from the queue's** (different port, different `.env.local` in Mission Control, different variables) (`S/out/rules.md` §5).

### 1.4 What the data does not support

- That the merge is slow because the gate is slow. A green full gate costs 4-25 min; mornings come from rounds and owner waits.
- That moving the full gate earlier alone will make changes land first time: suspect 1b. It removes the "done but not mergeable" surprise; it does not remove environment and flaky reds. Those need their own fixes (§2.5-2.7).
- Anything about Mission Control's queue history: one run in the dataset.

---

## §2 · Design

**Principle:** certify once, at the moment a change is declared done, on the tree that will be merged and in the environment the merge will check. The merge then verifies identity, not behaviour. This reuses the existing machinery: the queue already rebases, restores committed configuration, runs the full gate and stops before landing when the owner's order is missing (exit 21). The certification mode is that behaviour, offered for every project and invoked at "done".

### 2.1 `merge-queue.sh --certify` (new mode of the existing script)

- **What it does, in order:** refuse if the worktree is dirty (as today); run the environment preflight (§2.5); restore the committed `e2e/server-env.json` and `.claude/launch.json` and clear their skip-worktree flags (today's MQ:192-201); `git fetch` + `git rebase main` **without** the global merge lock (rebasing only reads main); take a **per-project certification lock** and a host heavy-job slot, both with a bounded wait (§2.8); run the full gate with the declared environment (§2.3); on green, the stamp is recorded by verify.sh as today; record the base (main's sha at the rebase) in the stamp and in the queue log; restore the worktree's local port overrides (re-run bootstrap) so the session can keep iterating. It never checks the owner's order, never fast-forwards and never pushes.
- **Why a per-project lock instead of the merge lock:** today the queue holds the repository-wide merge lock for the whole gate (up to 25 min), so other landings wait up to 10 min and then fail with exit 20 (MQ:66). Certification does not need that lock. It does need to own the project's committed e2e port and, in funko, the shared `ft_gate` database, which the existing lease already serializes (`funko-tracker/e2e/globalSetup.ts:14, 27`).
- **Why the committed port:** certifying on the worktree's private port means the certified environment differs from the merge's; in funko the auth and media origins stay fixed at `:4037` while the worktree port moves (`S/out/rules.md` §5; whether this changes verdicts is not verified). Certifying on the committed configuration removes the question. EP046 did exactly this by hand and it worked.
- **Exit codes:** 0 certified; 10 rebase conflict; 11 red (with the full failure list, §2.6); 14 committed port busy; 15 (new) environment preflight failed, with the reason, before any gate time is spent; 20 precondition or bounded wait exceeded.
- **Engine:** `land` becomes two jobs on the integration worktree: `certify`, then `land` (§2.2). The landing-metadata commit (`RB/land/command.mjs:writeLandingCommit`) is created before `certify`, so it is part of the certified tree, as today.
- **Risk:** certification serializes per project (two funko sessions finishing together wait for each other's ~24 min gate; already true today through the database lease). **Detection:** the log records lock waits. **Reversal:** the old single-shot path remains the default of `merge-queue.sh` with no flag when no valid stamp exists.

### 2.2 `merge-queue.sh` (land) becomes an identity check

Take the merge lock (bounded, §2.8) → main-busy preflight (in Mission Control, scoped to the paths the fast-forward will change, not the whole factory: `git diff --name-only main..branch` intersected with main's `git status`; the ff-only merge stays the real judge) → restore committed config → rebase → `green-stamp.sh check --wait 60` (wait up to 60 s for a running light gate in the same worktree instead of the current instant doubt, `S/out/rules.md` §3 last row) → **certificate matches: fast-forward; launched projects check the owner's order and push, exactly as today.** Certificate does not match: apply the main-moved policy (§3). The DR-138 order check, the push and the pre-push hook are unchanged.

### 2.3 A certificate that survives (stamp fixes)

| Invalidator today | Change | Mechanism | Evidence | Risk → detection → reversal |
|---|---|---|---|---|
| (i) skip-worktree from bootstrap; port rewrite in a tracked file | Certification always runs on committed config (§2.1). Iteration keeps the private port. | Reuse MQ:192-201 in `--certify`; re-bootstrap afterwards. | `S/out/rules.md` §3, §9 lever 1; EP046 | Committed port busy (a dev server) → exit 14 before the gate. |
| (ii) every environment variable hashed | **Declared gate environment.** verify.sh is started under `env -i` with three classes: *location* variables passed through but not hashed (`HOME`, `TMPDIR`, `PATH`, `npm_config_cache`, `PANDACORP_SESSION_TEMP_BASE`, `PANDACORP_CLEANUP_SESSION`); *behaviour* variables passed through and hashed (`NODE_OPTIONS`, `LANG`, `TZ` and a per-project list in a committed `.pandacorp/gate-env.allow`, e.g. funko's `SWC_NATIVE_BINDING_CACHE`); everything else dropped. | Amends DR-158's "all ambient environment inputs" (owner decision 4). DR-158's purpose (an unknown product variable must not silently change a certified verdict) is kept: an undeclared variable no longer reaches the gate at all. | `S/out/rules.md` §3, §8.10; GS:75-87; EP046 needed `SWC_NATIVE_BINDING_CACHE=0` on both sides | A needed variable is dropped → the gate fails loudly during certification, not later; fix = add it to the allow list (reviewed diff). `PATH` being a location variable means a different toolchain on `PATH` is not hashed; `node --version` stays hashed and the 12 h age remains the bound. |
| (iii) whole repository tree | funko and personal-page-v2: unchanged (the project is the repository). **Mission Control: certified identity = tree of `mission-control/` + blobs of a declared list of factory paths it reads** (`mission-control/.pandacorp/certify-inputs`). Proven by certifying inside a sparse checkout that contains only those paths: a test that reads an undeclared path fails in certification. | `HEAD:mission-control` tree hash + `git rev-parse HEAD:<path>` per declared path, stored in the stamp. | 44 factory commits in 7 days, 25 touching `mission-control/` (measured); Mission Control tests read `../plugin/templates/rules/logical-data-model.md`, `../plugin/skills/sync/SKILL.md`, `../docs/…`, and `plugin-sync.ts` resolves `cwd/..` (measured with `rg`, this session) | A test that falls back silently when a path is missing passes in the sparse proof and hides a dependency. Detection: the nightly main check (§2.7) runs on the full tree. Owner decision 2. |
| (iv) 12 h age | Unchanged. The log will show how many landings hit expiry; revisit with data. | — | exit-21 waits measured 31-281 min, all below 12 h (n = 3) | — |
| (v) Mission Control's e2e writes into `e2e/fixtures/factory-root` | The e2e server works on a per-run temporary copy of the fixture root (copied in global setup; `PANDACORP_FACTORY_ROOT` points to the copy). This is a Mission Control product change (through `/pandacorp:implement`), and also removes cross-run residue. | `mission-control/e2e/server-env.json`, `src/app/_actions/snapshotLedger.ts:96-127` | `S/out/measure.md` §3 | A test that relied on residue from a previous run fails once; that is a real defect surfacing. |
| Forgery or accidental copy | The stamp also records the sha256 of the archived gate report (§2.4) and the queue-log entry id of the certifying run; `check` refuses if the archived report is missing, not `scope: full`, not green, or for another identity. | `green-stamp.sh record/check` | "never hand-write a stamp" is policy only today (DR-146) | Not tamper-proof against a determined writer; it stops copies and hand edits. The backstop is the main check (§2.7). |

### 2.4 Measurement first: the queue log

`merge-queue.sh` appends one JSON line per invocation to `.pandacorp/run/merge-queue.log.jsonl` in the main checkout (project-relative, gitignored, never rotated by the script): mode (certify / land), branch, base and tip shas, certified identity, timestamps for lock acquired, slot acquired, rebase done, gate start and end, stamp-check result **and its reason text**, ff, push, exit code, Vitest seed, load average at start and end, and the path of the archived gate report. verify.sh copies each `gate-report.json` to `.pandacorp/run/gate-reports/<utc>-<tree>.json` instead of only overwriting it. Without this, suspects 9 and 10 stay undecidable and no phase below can prove it worked.

### 2.5 Environment preflight (seconds, before certification)

Run idempotently, fail with exit 15 and a named reason instead of a red gate 20 min later: bootstrap present and current (dependency marker, generated route types via `next typegen`; Mission Control, funko and personal-page-v2 are all Next.js); committed e2e port free; for funko, the `ft_gate` database exists and matches the seeded fingerprint, otherwise reseed it with the existing deterministic seed (EP014 shows reseeding cured the red with no code change). Targets the ≈13 avoidable environment reds (6 unprepared worktrees fully; 7 shared-database reds largely; estimated).

### 2.6 One red run shows every unit and static failure

Certification runs static checks with `--report-all` and Vitest without bail (both flags exist, `S/out/rules.md` §1a). Playwright keeps `maxFailures: 1` in its 3-worker tier, because DR-158's no-bail browser diagnosis drops to one worker (several times slower). Cost: only red runs get longer, by at most the rest of the Vitest suite (Mission Control ≈ 55 s; funko up to ≈ 9 min; measured maxima). Gain: chains of distinct unit failures collapse into one round. Also: **related tests first**: before the full Vitest suite, certification runs `vitest related` on the files changed since the base, so the likeliest red shows in minutes, not after 20. Owner decision 6 (it amends DR-158's "certification uses Vitest bail=1").

### 2.7 Flaky tests, load, and the main check (background)

- **Same-tree re-run, for diagnosis only.** On a red, certification re-runs only the failing test files once, same tree, same seed, same lock. Pass on re-run → the test is recorded as *unstable* in `.pandacorp/run/flaky.jsonl` (shown in Mission Control); **the certification stays red** (no retry makes anything green; DR-146 "no retries" holds).
- **Quarantine (owner decision 5).** A committed `.pandacorp/quarantine.json` lists excluded tests, each with the ledger evidence (two opposite outcomes on the same tree), a reason, an owner and an expiry of at most 14 days; at most 5 entries per project; an expired entry fails the gate loudly. Quarantined tests still run in the background main check, and their outcomes go to the ledger.
- **Load.** Certification records load average; when a red is a timeout and load was above the core count, the run is labelled *environment-suspect* in the log and the re-run happens when load falls (bounded wait). No admission throttle for other sessions' ad-hoc tests is proposed here (out of scope, noted as residual risk).
- **Main check (sentinel).** A full gate on main's tip, in a dedicated detached worktree, after any landing whose exact identity was not full-gated (Mission Control's optional quick path; direct commits on main) and nightly for every project. Red → a `main-red` marker that disables every quick path and makes `land` demand a fresh full certification; a desktop notification and a draft card; a prepared revert branch (`git revert` of the landing range) that lands through the queue. In launched projects, DR-138 already allows an instant rollback to an earlier Git-built deployment as incident response.

### 2.8 Bounded waits

Merge lock: wait at most 120 s (today 600 s) since certification no longer holds it. Host heavy-job slot: bounded (30 min) with position and holder logged (today an infinite silent loop, MQ:131-151). Certification lock: bounded with the holder's start time and its baseline duration shown as an estimated time to start. Stage durations inside the gate stay warning-only (DR-159); the log feeds the first real `gate-budget.json` (none exists today, `S/out/rules.md` §0).

---

## §3 · When main has moved between certification and merge

The land step compares the certified identity with the identity after rebasing. For funko-tracker and personal-page-v2 the identity is the repository tree; for Mission Control it is `mission-control/` plus its declared inputs (§2.3 iii). Factory commits outside that set do not count as "main moved" for Mission Control.

| Case | What it means | Policy, internal project (Mission Control) | Policy, launched projects (funko, personal-page-v2) | Merge time |
|---|---|---|---|---|
| **Normal** | Main did not move inside the identity | ff (+ push with order) | same | ≤ 2 min (measured 10-44 s in funko's certified landings) |
| **(a) Clean rebase, no shared files** | Main moved, the rebase applied, the branch diff and main's new commits touch disjoint files | Default: re-certify. As soon as any landing moves main, the land step spawns a detached `--certify` job for every other certified branch of that project (through the engine's existing job runner, `plugin/runtime/build/jobs.mjs`, under the host slot). The later merge waits only for the remainder of that job. **Optional quick path (owner decision 2, option C):** static checks + `vitest related` on the union of changed files + identity check, hard cap 120 s, then ff; the main check runs the full gate in the background. | Re-certify in the background exactly as for the internal default; **no quick path**: push = production deploy, and DR-158 keeps the full gate before main. | Default: remainder of a full gate (0 to 9 min Mission Control, 0 to ≈25 min funko). Quick path: ≈ 45-95 s (estimated: 19 s measured static + 10-60 s related Vitest + ≈ 15 s merge). |
| **(b) Conflict** | The rebase stops on a conflict (exit 10) | The resolution is new code: resolve, then `--certify` again. No shortcut. | same | resolution + full gate + ≤ 2 min |
| **(c) Real overlap** | The rebase applied, but both sides changed the same files | Full re-certification, always (no quick path even in Mission Control): textual success says nothing about semantics on shared files. | same | remainder of a full gate + ≤ 2 min |

**Estimated share of landings per case** (the log in phase 0 will measure them):
- **personal-page-v2:** 0 commits on main in 7 days and 2 landings in 14 days (measured) → normal case above 90 % (estimated).
- **funko-tracker:** 150 commits on main in 7 days and 65 fast-forward landings in 14 days (measured from git) ≈ one landing every 3 h of active time (derived, assuming 14 active hours a day). With a certification-to-merge window of about an hour (owner order median 69 min, n = 3) the chance that main moved is about 20-40 % → normal case 60-80 % (estimated). Conflicts: 6 of 138 runs (measured) → (b) about 4 %.
- **Mission Control:** 25 of 44 factory commits in 7 days touch `mission-control/` (measured), and many of them are Mission Control's own landings or direct commits; with subtree binding, normal 70-90 % (estimated); with today's whole-tree binding, 40-70 % (estimated).

**Two sessions at once.** Two certifications of the same project queue on the project lock (bounded, visible). Two landings serialize on the merge lock (held for seconds now): the first lands; the second finds its identity changed and falls into (a), (b) or (c). A certification that finishes after main moved during its own run is "certified on a stale base"; it is re-queued at once (funko: ≈ 13 % chance per run, derived from one landing per ≈ 3 h and a 24 min gate). Batches of finished branches still go through one integration branch and one certification (DR-141, unchanged).

---

## §4 · Every path that says "done" today, and what changes

Rule: no path may report a change as done, verified or ready to merge unless `green-stamp.sh check` succeeds for that branch's current rebased identity. Iteration gates stay as they are and must say "iteration" in their output.

| Path today | Gate today (`S/out/rules.md` §1b) | Change |
|---|---|---|
| Session turn end (Stop hook) | light, worktree, not rebased | Unchanged (iteration). Its message on a worktree says "not certified; run `merge-queue.sh --certify` before declaring done". Skips entirely when a fresh stamp matches (as today). |
| Engine unit gate (G1) | light | Unchanged (iteration). |
| Engine feature gate (G2) and VERIFIED work orders | since gate | Unchanged (it stays the per-feature review gate). VERIFIED keeps meaning "reviewed + green feature gate"; the run is "done" only after `certify`. |
| Engine rescue | full, in a sparse unit worktree | Unchanged (diagnosis; it cannot certify). |
| Engine landing (G3) | queue's full gate on the rebased integration branch | Becomes `certify` job + `land` job. Patch units after a red are verified by the next `certify`, never only by the light gate (closes mechanism 1 of §1.3). |
| Engine close-out (`finish`) | none | Reports done only with a landing or a fresh certificate (launched project waiting for the order). |
| Manual recipe "commit → verify.sh → merge-queue.sh" (`build-orchestration.md`, guide) | two full gates, the first one never certifies in a worktree | Becomes "commit → `merge-queue.sh --certify` → report done → `merge-queue.sh`". Plain `verify.sh` stays a diagnosis tool. |
| `worktrees` skill "Integrar" | queue | certify, then land. |
| `sync` close-out | accepts a green since gate | Requires a fresh certificate for the tree it commits, or lands through the queue. |
| Batch integration (DR-141) | one queue run on the combined branch | One `--certify` on the combined branch, then land. |
| Direct commits on main (allowed before launch; Mission Control has them) | light Stop gate on main | Allowed only for the write-gate's micro non-product edits (unchanged rule, now enforced by visibility): the main check (§2.7) runs after any such commit; a product change still isolates in a worktree (DR-096). |
| `implement-backlog` (factory items merged directly to factory main) | the item's own tests | Not a project path, but plugin files are Mission Control inputs: a plugin commit that touches a declared Mission Control input marks Mission Control's certificates stale and triggers the main check. |
| Old fast lane | — | Superseded already (REG:779). |

Mission Control (product change through `/pandacorp:implement`, optional in phase 2) shows per branch: *certified and fresh*, *certified, main moved (re-certifying, ETA)*, *not certified*.

---

## §5 · Blocking versus background

| Check | Where | Blocking? | Risk if it is wrong | How it is detected | How it is reversed |
|---|---|---|---|---|---|
| Full gate on the exact identity | `--certify`, at done | Yes, for "done" | — (this is the protection) | — | — |
| Identity check (stamp) | land | Yes (seconds) | A stamp that does not reflect reality (undeclared input, unhashed toolchain change within 12 h, forged file) | Main check nightly and after quick paths | `main-red` marker, revert branch through the queue; launched: deployment rollback (DR-138) |
| Owner's order | land, launched | Yes | — | — | — |
| Quick composition check (Mission Control, case a, only if decision 2 C) | land | Yes, capped 120 s | Semantic conflict between disjoint changes reaches Mission Control main (no production). Observed: 0 of 60 audited reds were caused by main moving (measured), but how many of the 58 landings had main moved is unknown; if all had, a rule-of-three upper bound would be ≈ 5 % (derived), and it is higher if fewer did | Background full gate on main within ≈ 9 min | Same as above; quick path disabled automatically while main is red; kill rule in §8 |
| Same-tree re-run of failing tests | certification | Diagnosis only | None for main | Ledger | — |
| Quarantined tests (decision 5) | background main check | No | A real defect hides in a quarantined test for up to 14 days | Their outcomes are logged; expiry fails loudly; cap of 5 | Remove the entry (committed diff) |
| Nightly main check | background | No | — | — | — |
| Stage durations vs budget | certification | No (warnings) | — | Log | — |

Moving Playwright or visual checks out of the blocking path is **not** proposed for any project (see §7), except implicitly for Mission Control's quick path if the owner chooses it.

---

## §6 · Time budget

### 6.1 Merge step (normal case), per project

| Stage | Mission Control | funko-tracker | personal-page-v2 | Basis |
|---|---|---|---|---|
| Merge lock, no contention | ≤ 1 s | ≤ 1 s | ≤ 1 s | estimated; cap 120 s |
| Main-busy preflight, restore config, fetch, rebase | 1-3 s | 1-3 s | 1-3 s | estimated |
| Stamp check | ≈ 1-2 s | ≈ 1-2 s | ≈ 1-2 s | hashing `e2e/` measured 0.05 / 0.04 / 0.05 s (153 / 96 / 45 files, this session); Python, git and node start-up estimated |
| Fast-forward | < 1 s | < 1 s | < 1 s | estimated |
| Push (launched only) | — | 2-10 s | 2-10 s | estimated |
| Stamp hand-off, change-reconcile | 1-5 s | 1-5 s | 1-5 s | estimated |
| **Total** | **≈ 5-15 s** (estimated; one 26 s measured landing) | **10-44 s measured** (EP046 10 s, E27.A03 13 s, EP048 44 s) | **≈ 10-30 s** (estimated) | |
| Hard cap of the merge step | 120 s | 120 s | 120 s | |

If the certificate is stale (cases a and c), merge time = what is left of the background re-certification + the above. Upper bounds: Mission Control ≈ 9 min, funko ≈ 25 min, personal-page-v2 ≈ 4 min (derived from the measured full gates). Only Mission Control's optional quick path brings case (a) under 2 min (≈ 45-95 s, estimated).

### 6.2 Cost moved to "done"

| | Mission Control | funko-tracker | personal-page-v2 | Basis |
|---|---|---|---|---|
| Certification (green) | + 8.7 min | + 23.5-25 min | + 3.8 min | measured full gates (n = 1, n = 3, n = 1) |
| Environment preflight | + 5-30 s | + 10-60 s (database fingerprint, reseed when needed) | + 5-30 s | estimated |
| Extra on a red certification (Vitest without bail) | ≤ + 1 min | ≤ + 9 min | ≤ + 1 min | measured Vitest durations as upper bound |
| Waiting for the certification lock or a host slot | unknown | unknown (database lease already serializes today) | unknown | not measurable without the log |
| Net for sessions that already ran a full verify before the queue (19 of 62 episodes, measured) | − 1 full gate | − 1 full gate | − 1 full gate | derived |
| Engine runs | ± 0 (G3 is relabelled `certify`) | ± 0 | ± 0 | derived |

**Expected effect on rounds** (estimated, to be checked in §8): of today's 60 reds, the preflight should remove most of the ≈ 13 avoidable environment reds; quarantine and the flaky ledger should remove most of the 6-9 flaky reds; one-run failure lists should shorten the 7 "fix broke something" chains. A plausible outcome is 30-35 reds for the same work instead of 60, and episodes needing 3 or more rounds falling from 34 % (21 of 62, measured) to about 15 % (estimated). The ≈ 19 own-defect reds stay; they move from "merge failed" to "certification failed", where they belong.

---

## §7 · Ideas considered and rejected

| Idea | Verdict | Why |
|---|---|---|
| Certify at done, queue checks the stamp and fast-forwards | **Adopted** (core) | It is the only option that reaches 2 min without moving verification out of the blocking path. |
| Impact-selected tests after the rebase as the merge gate | **Rejected** for launched projects; **optional** for Mission Control case (a) only | No spec-level impact map exists for Playwright; `--affected` only skips the browser for proven data-only diffs and never certifies (DR-158; branch `feat/verify-affected-browser-gates` holds 3 unmerged commits, `S/w-br/branches.md` l.23); visual and responsive suites are global by nature. |
| Retry failing tests automatically | **Rejected** | DR-146 "no retries anywhere"; would hide real races and the 9 load timeouts would land silently. Replaced by the diagnosis re-run plus an explicit, capped quarantine. |
| Quarantine of flaky tests with a visible ledger | **Adopted with caps** (decision 5) | 6-9 of 60 reds (estimated); each costs a full round. |
| Move Playwright or visual out of the blocking path in projects not launched | **Rejected** as a blanket rule | Playwright is 85 % of Mission Control's gate, so this would speed up "done", not the merge, which the stamp already solves. Visual fidelity is the owner's recurring concern in Mission Control (DR-055/056/074/075 browser gates). Revisit only if the log shows certification waits, not merges, are the bottleneck. |
| Stage time budgets that fail the gate when exceeded | **Rejected** for gate stages; **adopted** for waits and the merge step | A slow but green stage would become a red and add rounds; no evidence links slowness to wrongness. Infinite waits (host slot) and the 10 min lock wait are real and get caps. |
| Mission Control stamp bound to `mission-control/` only | **Rejected** | Its tests read factory files outside it (measured). Replaced by subtree + declared inputs proven with a sparse checkout. |
| Port injected by environment instead of rewriting `server-env.json` | **Rejected** for certification | funko's auth and media origins are tied to `:4037` (400 seeded rows); a moving port still changes the environment. Certifying on committed config is simpler. Iteration may still adopt it later. |
| Per-worktree test databases for funko | **Not reopened** | The owner rejected it (MQ:211). Certification serializes under the existing lease. |
| Speculative parallel queue (test several combinations at once) | **Rejected** | Two heavy slots per host and a serialized funko database leave no capacity. |
| Cryptographically signed stamps | **Rejected** | Single-operator, single-machine threat model; cross-checks against the archived report and the log stop accidental copies, the main check catches the rest. |
| Gates in a cloud CI | **Out of scope** | New infrastructure and spend; DR-140 keeps tests local. |
| Shortcut for docs-only edits after certification | **Rejected** | Mission Control and funko tests read docs (EP043: a docs edit after the gate turned a contract test red). |

---

## §8 · Phases (each ships alone)

| Phase | Ships | Expected effect | Proof it worked (from the queue log) | Machinery tests (new unless stated) |
|---|---|---|---|---|
| **0 · Measure** | Queue log (§2.4); gate-report archive; machine-readable stamp-check reasons | None on speed; makes suspects 9-10 and the case shares measurable | One log row per queue invocation: count equals fast-forwards in the reflog over one week | `test-merge-queue-log.sh` (a row for each exit 0/10/11/12/14/20/21, reason text present); `test-verify-gate-report-history.sh`; existing `test-merge-queue-*.sh` stay green |
| **1 · A certificate that survives** | `--certify` mode; per-project certification lock; declared gate environment (decision 4); stamp cross-checks; `check --wait`; bounded waits; Mission Control e2e on a temporary fixture copy (through `/pandacorp:implement`) | Every landing whose base did not move skips the gate | ≥ 90 % of land runs with an unchanged base log `[certified-tree]`; merge-step p50 ≤ 30 s and p90 ≤ 120 s on those; **zero** landed identities without a matching green full-gate report (audit join of log and archive) | `test-merge-queue-certify-mode.sh` (stops before ff and push; never holds the merge lock during the gate; launched project never pushes); `test-green-stamp-declared-env.sh` (two sessions with different `TMPDIR`/cache paths get the same fingerprint; an undeclared variable never reaches verify.sh); `test-green-stamp-crosscheck.sh` (copied or hand-written stamp without a matching archived report is refused); Mission Control e2e test "fixture root unchanged after a run" |
| **2 · Done = certified** | All paths of §4; engine `certify` + `land`; environment preflight; Vitest without bail and related-first (decision 6); Stop-hook wording; standards (`build-orchestration.md`, `quality-and-testing.md`, guide), skills (`implement` engine land, `worktrees`, `sync`); a new DR amending DR-146/158/141 | Merge reds (exit 11 at land) disappear except stale-base re-runs; fewer rounds | Exit 11 on `land` runs with unchanged base: 0; first-pass green certifications ≥ 60 % (today 43 % first-run landing); episodes with ≥ 3 rounds ≤ 15 % (today 34 %) | `test-engine-land-certify-then-land.mjs`; `test-verify-certify-preflight.sh` (missing typegen, unseeded database → exit 15 with reason, no gate run); `test-verify-no-bail-vitest-lists-all.sh`; existing `test-verify-before-stop.sh` updated for the new message |
| **3 · Main moved** | Background re-certification on every landing; Mission Control subtree identity + sparse proof (decision 2); main check (nightly and after non-full-gated landings); `main-red` marker; revert branch; optional quick path (decision 2 C) | Stale certificates are refreshed before the owner asks | Median time from "main moved" to fresh certificate ≤ one full gate; landings that waited for re-certification are counted per project; quick path, if enabled: kill rule = **any** main-red caused by a quick-path landing in its first 20 uses disables it | `test-merge-queue-stale-base-spawns-recertify.sh`; `test-green-stamp-subtree-identity.sh` (factory commit outside the declared set keeps the stamp; inside invalidates); `test-certify-sparse-proof-fails-on-undeclared-read.sh`; `test-main-red-disables-quick-path.sh` |
| **4 · Flakes** | Same-tree diagnosis re-run; flake ledger in Mission Control; quarantine with evidence, expiry and cap (decision 5); environment-suspect labelling under load | Flaky and load reds stop costing rounds | Flaky reds per 10 certifications fall by half (baseline from phase 0-2 logs); quarantine never exceeds the cap; zero expired entries pass | `test-quarantine-requires-evidence-and-expiry.sh`; `test-certify-rerun-never-turns-green.sh` |

Every phase bumps the plugin metadata and overlay version, regenerates the managed overlay in the three projects through `/pandacorp:upgrade`, and records its DR and a decision-log entry, as in proposals 40-41.

**Global kill rule:** if the phase-1 audit finds one landed identity that was not certified by a green full gate on that identity (outside an owner-approved quick path), phase 1 is reverted before anything else ships.

---

## §9 · Residual risks

1. **Undeclared inputs in Mission Control.** The sparse proof catches reads that fail when a file is missing, not reads that silently fall back. Bounded by the nightly main check on the full tree.
2. **Unhashed environment** (Playwright browser cache, system fonts, OS updates, clock-dependent tests) can drift within the 12 h stamp age. Same bound as today (DR-146 accepted it).
3. **More background machine load.** Re-certification adds full gates when main moves; that load can cause the very timeouts we are trying to remove. Mitigation: one re-certification per project at a time, under the two host slots; the log will show it.
4. **"Done" gets slower and people may route around it**, e.g. commit product changes directly on main in Mission Control. Detection: the main check runs after every direct commit; the visibility rule in §4.
5. **Quarantine can become a hiding place.** Cap of 5, 14-day expiry, evidence required, committed diff.
6. **funko certifications are serial** (database lease + committed port): two sessions finishing together wait ≈ 24 min for each other (already true today inside the queue).
7. **The estimates of reds avoided rest on a 16-red audited sample** (81 % classification accuracy, `S/out/episodes-audit.md` Part A). The gain in rounds may be smaller.

---

## §10 · Not measured or not verified

| Item | Why | What would decide it |
|---|---|---|
| personal-page-v2 full gate today | Main checkout dirty (untracked `.pandacorp/navigation-identity.json`); the rules forbid measuring on a dirty tree | One full gate on a clean checkout |
| Lock waits, slot waits, frequency of exit 12/14, Mission Control's whole-factory "main busy" blocks | The queue writes no log | Phase 0 |
| Share of landings where main moved (cases a/b/c) | Not recorded anywhere | Phase 0 (base sha at certify vs at land) |
| Whether Mission Control's gate reads factory files beyond those found by `rg` (for example `plugin/.claude-plugin/plugin.json`, which `plugin-sync.ts` reads at runtime and which changed in 32 of 44 factory commits in 7 days, measured) | Static search only | The sparse-checkout proof in phase 3 |
| Whether certifying on the worktree port changes funko verdicts | Not tested; the design sidesteps it | — |
| Whether the declared gate environment drops something funko needs | Not tested | Phase 1 test plus one funko certification |
| Whether funko's two consecutive reds (land-25-1/2) were flaky | Seeds 763470787 and 391584655 not replayed | Replay those seeds on the same trees |
| Whether `next build` rewrites `AGENTS.md` during the gate | Not verified (`S/out/rules.md` §3d) | One gate run with `git status` before and after |
| Stamp-check wall time end to end | Only the `e2e/` hashing part was timed (≤ 0.05 s) | Phase 0 log |
| Mission Control queue behaviour in general | 1 queue run in the 62-episode dataset | Phase 0 log |
| The 26 s Mission Control landing without a `[certified-tree]` marker | Not explained by the stamp or an early failure (`S/out/episodes-audit.md` B6) | — |
| Classification of the 60 reds | Audited on a sample of 16, 81 % accurate, with flaky under-detected | — |

---

## §11 · Own adversarial pass (before independent red-team)

| # | Objection | Disposition |
|---|---|---|
| A1 | "This only moves the 25 min from merge to done; the owner still waits." | **Accepted in part.** True for a single change that never failed. The gains are elsewhere: no second full gate for sessions that verify first (19 of 62); no merge-time surprise; the owner's order lands in seconds; the merge lock is no longer held for 25 min; and fewer rounds from §2.5-2.7. Stated plainly in §6. |
| A2 | "Background re-certification for funko could be a never-ending queue." | **Accepted as a risk.** One landing every ≈ 3 h against a 24 min gate leaves room (derived); the log measures it; DR-141 batching reduces landings. |
| A3 | "Subtree identity for Mission Control is the riskiest change; tests read the plugin." | **Accepted.** Kept behind a sparse proof and the nightly full-tree check, and made an explicit owner decision with the whole-tree option kept. |
| A4 | "env -i will break a gate on day one." | **Accepted.** That is the intended failure mode: loud, during certification, fixed by a reviewed allow-list line. |
| A5 | "Quarantine contradicts DR-146 'no retries'." | **Partly rejected.** It is not a retry: nothing turns green by re-running. It does weaken the blocking gate, which is why it is an owner decision with caps and expiry. |
| A6 | "Certifying on the committed port collides with a developer's server." | **Accepted.** Exit 14 before any gate time, as today. |
| A7 | "The quick path for Mission Control breaks DR-158's 'full G3 before main'." | **Accepted.** That is why it is option C of decision 2 and not the recommendation. |
| A8 | "A forged stamp still lands." | **Accepted.** Cross-checks stop copies and hand edits; a deliberate forgery needs three consistent artifacts and is caught by the main check. No stronger guarantee is claimed. |

---

## §12 · Decisions for the owner

Full decision cards, in Spanish, are in `decisions-es.md`. One line each, by urgency:
1. Adopt "done = certified" (the `--certify` mode at done, identity check at merge), with the queue log first.
2. Mission Control's certificate identity: whole factory tree, subtree plus proven factory inputs, or that plus a quick path for disjoint changes.
3. Launched projects when main moved: wait for a background re-certification, or allow a quick check before pushing to production.
4. Gate environment: declared allow-list (amends DR-158's "all ambient variables").
5. Flaky tests: ledger only, or ledger plus a capped, expiring quarantine.
6. Certification reports every unit and static failure in one red run (amends DR-158's Vitest bail=1).

DR-138 is unchanged by every option: one explicit owner order per landing in launched projects, push = production, full gate before the push.
