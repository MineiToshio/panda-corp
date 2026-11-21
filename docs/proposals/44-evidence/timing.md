# Where Pandacorp implementation time goes

Read-only measurement for the proposal. The 30-day window is 2026-10-22 16:00 UTC through 2026-11-21 16:00 UTC. All observations are **MEASURED** unless marked **ESTIMATED**. The project sample is the factory root, its nested Mission Control app, Funko Tracker and Personal Page v2.

- The queue ledgers record **26 attempts, 8 gate reds, 9 green production-order stops and 5 landings**. The attempts occupied gates for **2.209 job-hours**. Playwright and Vitest accounted for **94.42%** of matched stage time. Logged lock and host-slot waits totaled **177 seconds**. The ledgers cover part of one day, concentrated on overlay and Proposal 43 work. [Queue output](../work/timing-queue.txt)
- One Funko build launched **40 successful G2 jobs with the same recorded commit and comparison base**. They occupied **1.868 job-hours ESTIMATED** from the saved command and exit clocks. The journal harvested 39. [Build output](../work/timing-build.txt)
- Earlier saved stdout, archived jobs and published transcript annotations show activity before the structured queue ledgers begin. The surviving sources give measured subsets of gate and wait time over the 30-day window. [Archive output](../work/timing-archive.txt)

## Queue attempts and waits

One start UUID counts as one invocation. A successful fast-forward counts as a local landing. A retry is an additional start on the same project/branch before its next landing. The stricter column also requires a previously seen identical start HEAD. Exit 11 can mean a failed gate or failed certification. The red column uses the recorded verifier result, which was rc=1 for all eight exit-11 attempts. Exit 21 is a green gate held for a production order, 12 is main busy, 10 is a conflict, and 20 covers usage/lock/preflight errors. Exact event lines appear in the ATTEMPT rows. [Queue output](../work/timing-queue.txt) · [Gate exit semantics](</Users/Shared/Proyectos/funko-tracker/.pandacorp/merge-queue.sh:848>) · [Production-order guard](</Users/Shared/Proyectos/funko-tracker/.pandacorp/merge-queue.sh:892>)

| Project | Queue events and UTC window, all Nov 21 | Runs and exit distribution | Red share of attempts | Branch retries | Branch + identical HEAD retries | Landings and prior requeues |
|---|---|---|---|---|---|---|
| Factory root | No queue ledger located | Unavailable | — | — | — | — |
| Mission Control | 118, 06:24:30.432–12:35:59.568 | 11 · 0×3, 10×1, 11×6, 20×1 | 6/11 (54.55%) | 8/11 (72.73%) | 2/11 (18.18%) | 3 · [3, 2, 3], mean 2.67 |
| Funko Tracker | 74, 06:24:33.960–14:41:10.619 | 7 · 0×1, 11×1, 21×5 | 1/7 (14.29%) | 5/7 (71.43%) | 5/7 (71.43%) | 1 · [2] |
| Personal Page v2 | 75, 06:24:26.108–14:59:50.810 | 8 · 0×1, 11×1, 12×1, 20×1, 21×4 | 1/8 (12.50%) | 6/8 (75.00%) | 4/8 (50.00%) | 1 · [3] |
| Overall | 267, 06:24:26.108–14:59:50.810 | 26 · 0×5, 10×1, 11×8, 12×1, 20×2, 21×9 | 8/26 (30.77%) · 8/17 (47.06%) among executed gates | 19/26 (73.08%) | 11/26 (42.31%) | 5 · [3, 2, 3, 2, 3], mean 2.60 |

Closed changes account for **13** of **19** branch retries. Two branch episodes remained unlanded in these ledgers. There were **5** certified-tree skips, three in Funko and two in Personal Page. Branch retries include production-order requeues. [Per-attempt rows](../work/timing-queue.txt) · [Native queue metrics](../work/timing-native.txt)

| Project | Merge-lock wait, summed | Host-slot wait, summed | First attempt start to local landing, median / p90 |
|---|---:|---:|---:|
| Mission Control | 1 s | 106 s | 45.83 / 52.32 min, n=3 |
| Funko Tracker | 2 s | 0 s | 121.36 / 121.36 min, n=1 |
| Personal Page v2 | 2 s | 66 s | 119.73 / 119.73 min, n=1 |
| Overall | 5 s across 26 acquisitions | 172 s across 17 acquisitions | 52.32 / 121.36 min, n=5 |

The acquired-event waited_s fields are integer clocks. There were zero standalone ready events, so time from worker-ready to enqueue cannot be isolated. Elapsed time across attempts can include repairs, owner order, parallel work and pauses. The longest individual logged lock and slot waits were **1 s** and **101 s**. The summed attempt clocks were **8,230.424 s**, with **2 s** of recorded rebases and **39 s** of environment steps. [Queue comparisons](../work/timing-queue.txt)

### Earlier queue evidence

- **MEASURED, archived stdout.** Mission Control landed fin/next-land on Nov 3 at 12:51:54 UTC. Saved gzip output reports **80.31 s** for Vitest and **21.6 min** for Playwright. These are runner clocks. The total gate start is absent. The fast-forward is timestamped in main's reflog. [Archive output](../work/timing-archive.txt)
- **MEASURED from prior transcript annotations, separate cohort.** Published episode rows for Nov 1–20 yield **137** Funko calls across **61** episodes, **57** landings and **71** extra calls on landed episodes (**1.25 per landing**). The remaining **1** call and **1** landing were labeled Mission Control / factory. The prior aggregate identified **60** gate reds or timeouts across **138** calls, using inferred outcome classification. Transcript tool clocks can include wrappers and censored intervals. I recalculated the episode counts from the published rows and used the prior red classification as reported. [Episode table and methods](</Users/Shared/Proyectos/panda-corp/docs/proposals/43-evidence/w-tr/episodes.md:5>) · [Recalculation](../work/timing-archive.txt)

## Gate duration and stage cost

Queue gate wall is gate_end.duration_s. It includes a small amount of wrapper work and can reflect a fail-fast run. Stage durations use the attempt-linked reports' subgates[].duration_ms. Report timestamps are set during startup. Percentages use reported stage time as denominator. Static covers doc and structural checks, formatting, types, dependency analysis and API contract. Live-data and data-layer assertions, database cleanup and other runtime/policy stages are in Other. Median is ordinary median and p90 is nearest rank. Small samples frequently place p90 at max. [Report writer](</Users/Shared/Proyectos/funko-tracker/.pandacorp/verify.sh:724>) · [Report startup timestamp](</Users/Shared/Proyectos/funko-tracker/.pandacorp/verify.sh:299>)

| Project | Queue gates, n | Wall median / p90 / max, sec | Summed queue gate wall in 30-day window | Playwright / Vitest / static / other shares |
|---|---:|---:|---:|---:|
| Factory root | 0 observed | — | Unavailable | — |
| Mission Control | 9 | 298 / 1,093 / 1,093 | 3,186 s (0.885 h) | 67.51% / 22.93% / 9.49% / 0.07% |
| Funko Tracker | 4 | 1,081.5 / 1,387 / 1,387 | 4,349 s (1.208 h) | 58.21% / 39.30% / 2.12% / 0.38% |
| Personal Page v2 | 4 | 102.5 / 129 / 129 | 418 s (0.116 h) | 68.56% / 23.68% / 7.67% / 0.08% |
| Overall | 17 | 298 / 1,093 / 1,387 | 7,953 s (2.209 h) | 62.46% / 31.96% / 5.35% / 0.24% |

The chronological union is **1.775 h ESTIMATED**, reconstructed from gate-end timestamps minus integer durations. Summed hours count simultaneous jobs separately. Stage totals are **4,939.318 s Playwright**, **2,527.461 s Vitest**, **422.786 s static** and **18.800 s other**. [Gate wall and reports](../work/timing-queue.txt)

| Project | Playwright n · median / p90 / max s | Vitest n · median / p90 / max s | Largest static stage n · median / p90 / max s |
|---|---:|---:|---:|
| Mission Control | 5 · 500.757 / 910.529 / 910.529 | 8 · 62.017 / 166.012 / 166.012 | doc-lint 9 · 13.566 / 26.242 / 26.242 |
| Funko Tracker | 4 · 621.156 / 896.231 / 896.231 | 4 · 401.245 / 655.493 / 655.493 | doc-lint 4 · 5.699 / 7.246 / 7.246 |
| Personal Page v2 | 4 · 72.154 / 78.268 / 78.268 | 4 · 21.362 / 35.597 / 35.597 | doc-lint 4 · 1.667 / 3.920 / 3.920 |
| Overall | 13 · 389.764 / 896.231 / 910.529 | 16 · 62.017 / 457.136 / 655.493 | doc-lint 17 · 13.242 / 18.561 / 26.242 |

The next largest static totals overall are **97.348 s TSC** and **68.043 s Madge**. Queue-report timestamp ranges on Nov 21 are **06:26:44–12:26:09** Mission Control, **06:24:41–14:27:44** Funko and **06:42:45–14:58:23** Personal Page. Every stage's count, median, p90, max, sum and reds are in the raw STAGE rows. [Per-stage output](../work/timing-queue.txt)

### Additional measured and estimated costs within the month

- **MEASURED.** Saved benchmark stdout reports **523.34 s** real for one Mission Control full gate at 23:54:50 UTC Nov 20. Independent epoch sidecars differ by **523 s**. This is separate from the 17 queue gates, yielding **2.355 directly clocked gate-job hours** across those sources. The Nov 3 archive above has runner clocks only. [Saved benchmark stdout](</Users/Shared/Proyectos/panda-corp/docs/proposals/43-evidence/out/verify-mission-control.log:2524>) · [Archive output](../work/timing-archive.txt)
- **MEASURED stage clocks.** 60 additional unique reports have stage-level timing or verdicts. Factory root **1** (Oct 21, 0.434 s, outside window), Mission Control **19** (Sep 26–Nov 21), Funko **39** (Oct 18–Nov 21), Personal Page **1** (Nov 13). They contain **7,213.434 s** of in-window stage durations based on report start, including **4,178.193 s Playwright** and **2,208.716 s Vitest**. This is a convenience sample of saved evidence with mixed scopes and worker checks. Identical report data are deduplicated. Build envelopes and standalone clocks may cover some of the same work. [Report cohorts and scopes](../work/timing-queue.txt)
- **ESTIMATED.** Funko CLI archive clocks cover **1.972 h** in 45 G2 envelopes and **0.190 h** in two G3 queue-job envelopes. These jobs ran Nov 13–19. Envelopes can include orchestration and bootstrap. Both G3 jobs returned 11 in the archived run, and their stdout gives Vitest runner clocks of **268.19 s** and **282.97 s**. [Build output](../work/timing-build.txt) · [First G3 stdout](</Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build-suspended/br-2026-11-13-02/jobs/land-25-1/out.log:408>) · [Second G3 stdout](</Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build-suspended/br-2026-11-13-02/jobs/land-25-2/out.log:277>)

Diagnosis outside the queue, overwritten manual reports, removed worktrees and older wrapper invocations lack compatible clocks. The full 30-day gate wall and wait totals are unavailable.

## Red stages and same-tree outcomes

The first nonzero report stage gives one primary stage per failed invocation. The full nonzero-stage ranking also counts secondary policy markers. [Red-stage output](../work/timing-queue.txt)

| Project | Primary stage of queue reds | Additional nonzero flags |
|---|---|---|
| Mission Control | Playwright 2, Vitest 2, Vitest policy 1, Biome 1 | Vitest policy +1 |
| Funko Tracker | Playwright 1 | — |
| Personal Page v2 | Playwright 1 | Playwright policy +1 |
| Overall | Playwright 4, Vitest 2, Vitest policy 1, Biome 1 | Vitest policy +1, Playwright policy +1 |

There are **5** distinct nonzero stages in the queue sample. In the additional reports the entire nonzero ranking is **TSC 10, Vitest 10, Biome 1, Knip 1, Playwright 1, residual ambiguity 1**. Funko accounts for all **10** TSC failures. One Mission Control queue report contains a Vitest reporter identity error and a companion identity-policy error, so the stage bins include runner/policy problems as well as assertion failures. [Example report](</Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/run/gate-reports/0ab31f4d-b393-4465-979c-d5914abe584d.json:68>) · [Rankings](../work/timing-queue.txt)

| Project | Test-outcomes rows raw / unique | UTC span, Nov 21 | Attempts represented | Failed rows / distinct IDs | Distinct same-tree suspects |
|---|---:|---|---:|---:|---:|
| Factory root | No ledger | — | — | — | — |
| Mission Control | 28,161 / 28,156 | 09:26:49.620–12:35:52.857 | 5 | 1 / 1 | 0 observed |
| Funko Tracker | 14,344 / 14,344 | 12:45:58.893–14:41:00.375 | 2 | 0 / 0 | 0 observed |
| Personal Page v2 | 4,812 / 4,812 | 13:00:37.576–14:59:46.962 | 3 | 1 / 1 | 1 |
| Overall | 47,317 / 47,312 | 09:26:49.620–14:59:46.962 | 10 | 2 / 2 | 1 |

The ledger top list has two IDs tied at **1** failure each. The Mission Control Vitest ID is **src/app/manual/_tests/manualSingleSource.test.ts > Manual pages have one source of content concepts/hooks-gates-seguridad: the .md of a bespoke page is an index stub, not prose**. The Personal Page Playwright ID is **blog-cover-alt.spec.ts > blog-cover-alt.spec.ts > Blog cover alt text reaches the browser from the committed MDX > /en/blog loads its cover with no failed request [mobile]**. It passed and failed in different attempts on tree **2cdf469b1fa3448789073315a973f180a6594358**, with retry index zero in each row. This is one suspect. Tree equality leaves environment and runner conditions open. The ledger omits earlier reds visible in reports, including Funko's saved Playwright failure. [Mission Control ledger row](</Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/run/test-outcomes.jsonl:4117>) · [Personal Page pass](</Users/Shared/Proyectos/personal-page-v2/.pandacorp/run/test-outcomes.jsonl:1571>) · [Personal Page fail](</Users/Shared/Proyectos/personal-page-v2/.pandacorp/run/test-outcomes.jsonl:3182>) · [Funko report](</Users/Shared/Proyectos/funko-tracker/.pandacorp/run/gate-reports/d893293c-a1f3-41e8-8d93-b0703bb33377.json:74>)

## Build CLI and work orders

There are **8** unique v2 journals, all for Funko, including archived, suspended, main-checkout and Claude-worktree runs. Factory, Mission Control and Personal Page had no matching v2 journals in the checked roots. Legacy journal and track rows cover their earlier work. The inventory prints paths and per-file counts and timestamps. It also identifies **8** Funko perf-sample ledgers. Those record host samples with their own time and step, which do not provide per-WO phase boundaries. [Journal and perf inventory](../work/timing-build.txt)

| Funko run | UTC journal range in November 2026 | Journal rows | Patch creation / dispatches | Other recovery signals |
|---|---|---:|---:|---|
| br-2026-11-13-01 | 13 17:58:37–19:02:29 | 13 | 0 / 0 | — |
| br-2026-11-13-02 | 13 20:42:37–14 00:31:44 | 219 | 2 / 2 | 1 non-resume redispatch |
| br-2026-11-14-01 | 14 00:32:54–06:36:46 | 152 | 1 / 1 | 7 non-resume redispatches |
| br-2026-11-16-01 | 16 03:55:07–18 05:30:47 | 272 | 0 / 0 | 2 scope repair approvals, 6 non-resume redispatches |
| br-2026-11-18-01 | 18 20:46:37–23:26:49 | 117 | 2 / 3 | 7 technical failures, 2 rescues, 4 non-resume redispatches |
| br-2026-11-18-02 | 18 22:03:30–19 00:38:30 | 87 | 1 / 1 | 3 technical failures, 1 rescue, 4 non-resume redispatches |
| br-2026-11-21-01 | 21 14:28:36–15:26:49 | 60 | 0 / 0 | 3 technical failures, 1 rescue, 3 non-resume redispatches |
| br-2026-11-21-02 | 21 15:30:56–15:54:10 | 19 | 0 / 0 | — |
| Overall | 13 17:58:37–21 15:54:10 | 939 | 6 / 7 | 13 technical failures, 4 rescues, 2 scope repair approvals, 25 non-resume redispatches |

Patch events, dispatches, rescues and redispatches can refer to the same work. The **7 patch dispatches** are the explicit repair-attempt count. **6** have a paired worker or agent timing interval. The automatic dispatch and harvest clocks can include time waiting for the controller. Agent dispatch-to-report intervals measure time to a report even on unsuccessful attempts. A partial or censored attempt is retained in the raw output, and a duration requires usable endpoints. [Build output](../work/timing-build.txt) · [Job harvest semantics](</Users/Shared/Proyectos/panda-corp/plugin/runtime/build/jobs.mjs:183>)

| Funko phase | Timed intervals | Median / p90 / max, sec | Sum of elapsed interval hours | Clock |
|---|---:|---:|---:|---|
| Implement | 19 | 542.661 / 2,040.509 / 2,570.395 | 4.805 | MEASURED journal intervals |
| Test authoring | 7 | 597.768 / 2,185.849 / 2,185.849 | 1.323 | MEASURED journal intervals |
| Review | 4 | 532.757 / 777.499 / 777.499 | 0.555 | MEASURED journal intervals |
| Repair | 6 | 452.012 / 695.381 / 695.381 | 0.681 | MEASURED journal intervals |
| Docs and planning | 18 | 571.394 / 1,133.579 / 1,508.499 | 3.058 | MEASURED journal intervals |
| G2 | 45 | 150.207 / 167.418 / 696.381 | 1.972 | ESTIMATED command/exit-file clocks |
| G3 land | 2 | 342.695 / 386.376 / 386.376 | 0.190 | ESTIMATED command/exit-file clocks |

These are observed phase envelopes across eight runs with different scopes, including failed and repeated attempts. They do not isolate model-active minutes, and phases can overlap. Selected work-order examples below use summed timed attempts, in minutes. FRD-level or run-level gate intervals stay shared. Exact per-unit rows, WO memberships, missing endpoints and worker attempts are in the build output. [Job and work-order evidence](../work/timing-build.txt)

| Funko WO or shared chain | Implement | Test authoring | Review | Repair | Related G2 envelope, ESTIMATED |
|---|---:|---:|---:|---:|---|
| WO-01-017 / 018 | 44.83 | — | 24.85 | 6.56 | 3.53 min shared across two runs of the FRD gate |
| WO-12-002 | 85.89 | 7.77 | — | — | — |
| WO-12-003 | 49.27 | 13.12 | — | — | — |
| WO-12-004 / 005 / 007 | 19.37 | 11.53 | — | — | — |
| WO-06-007 | 26.16 | 9.96 | — | — | FRD-06 job 0.43 min in this run |
| WO-09-002 | 23.24 | — | — | 29.65 | FRD-09 job 1.68 min in this run |
| WO-06-008 / 009 | 39.53 | 36.43 | — | — | FRD-06 job 0.58 min in this run |
| WO-06-010 | No timed implement report | 0.57 | — | — | — |

A dash indicates missing attributable timing. Separate scope-repair docs and run-shared review or gate work remain in the raw table. The G2 archive exposes **42 green and 3 red** exits including the file-only exit. Funko's **39 harvested green G2 events** for br-2026-11-13-02 name commit **ce047e0b16c3b8c6a61cb4e701812968b53b0ecd**. All **40** matching job directories, including the final start at journal line **218**, have exit 0 and the same G2 cwd and comparison base **66732ce6b317ef399612b840baa6dacf92358dde** in cmd.json. They occupied **6,726.441 s ESTIMATED** in that run, or **94.74% ESTIMATED** of the observed G2 envelope total. The job wrapper writes the exit artifact at completion. File modification times are proxies and the command envelope includes slot/bootstrap work. This evidence supports a repeated-G2 cost and leaves the scheduler cause open. [Suspended journal](</Users/Shared/Proyectos/funko-tracker/.pandacorp/run/build-suspended/br-2026-11-13-02/journal.jsonl:218>) · [Exit writer](</Users/Shared/Proyectos/panda-corp/plugin/runtime/build/jobs.mjs:252>) · [Job-by-job output](../work/timing-build.txt)

### Legacy logs

Main-checkout source coverage and nearest start/end pairings are **MEASURED**. Multiple starts replace the previous unmatched start for the same WO/FRD key, so these counts cover pairable intervals and can include pauses. Legacy repair counts use main build-journal rows with kind attempt and rung patch. Worktree copies and deduplicated counts are in the output. [Legacy sources and intervals](../work/timing-build.txt)

| Project | track.jsonl coverage, UTC | Paired WO / review intervals and medians | build-journal.jsonl coverage, UTC | Patch attempts |
|---|---|---|---|---:|
| Factory root | Missing | — | Missing | — |
| Mission Control | 115 rows, Jun 30–Oct 30 | 22 / 13, 342.5 s / 627 s | 14 rows, Sep 3–Oct 30 | 4 |
| Funko Tracker | 134 rows, Oct 18–Nov 18 | 43 / 6, 358.879 s / 1,569 s | 18 rows, Oct 18–19 | 6 |
| Personal Page v2 | 80 rows, Jun 30–Sep 11 | 19 / 15, 1,016 s / 630 s | 14 rows, Sep 9–Oct 7 | 1 |

## Time to main

Sample the latest six fast-forward ref moves per project with touched paths during the 30-day window, or all available when fewer. Use the timestamp of the local main reflog update and the author timestamp of the first commit in the landed Git range, in reverse traversal order. The report output also prints committer-time sensitivity. Direct commits and observations without a reliable branch boundary are outside this sample. Scope Mission Control by paths under mission-control/ and factory by paths outside it. A shared fast-forward may appear in both project slices. [Git output with every range and commit](../work/timing-git.txt)

| Project | n | First author to main median / p90 / max, min | Later commits matching test/gate message heuristic |
|---|---:|---:|---:|
| Factory root | 6 | 98.77 / 209.13 / 209.13 | 2 of 17 |
| Mission Control | 6 | 39.57 / 177.65 / 177.65 | 3 of 11 |
| Funko Tracker | 6 | 45.39 / 121.67 / 121.67 | 5 of 7 |
| Personal Page v2 | 3 | 0 / 119.77 / 119.77 | 1 of 1 |
| Pooled project slices | 21 | 45.30 / 177.65 / 209.13 | 11 of 36 |
| Unique local ref moves | 16 | 40.56 / 177.65 / 209.13 | — |

Unique moves use the longer measured project-slice clock where both slices appear. The **11** keyword matches are **MEASURED**. Their interpretation as repair commits is **ESTIMATED**. The regex matches test, fix(test), baseline, flaky, gate and related words. The match list includes some gate feature work and broad subjects, and generic fix subjects can escape it. A landing interval includes rebase, parallel work, overnight gaps or owner ordering as applicable. Zero-second samples are real reflog/commit-second coincidences on the overlay fast-forwards. Reflog coverage is **341** entries Oct 2–Nov 21 for the shared factory/Mission Control repo, **498** Oct 15–Nov 21 for Funko, and **159** Sep 5–Nov 21 for Personal Page. [Commit evidence and reflog ranges](../work/timing-git.txt)

## Commands and raw output

Run from the scratchpad. Runtime inventory uses Git worktree list, a pruned runtime-directory walk, known Claude worktree directories and Git's tracked gate-report inventory. Git timing uses reflog, log and diff-tree only. The factory's root runtime supplied one report and no primary queue, test-outcome or v2 journal. The same inventory looked for archived reports, independently saved stdout, old track/journal files and build directories in the main checkouts and worktrees. No project build, test, gate or merge process was invoked.

    PYTHONDONTWRITEBYTECODE=1 python3 work/timing.py queue > work/timing-queue.txt
    PYTHONDONTWRITEBYTECODE=1 python3 work/timing.py build > work/timing-build.txt
    PYTHONDONTWRITEBYTECODE=1 python3 work/timing.py git > work/timing-git.txt
    PYTHONDONTWRITEBYTECODE=1 python3 work/timing_archive.py > work/timing-archive.txt
    P=/Users/Shared/Proyectos/panda-corp/plugin/scripts/queue-metrics.mjs
    for app in panda-corp/mission-control funko-tracker personal-page-v2; do
      node "$P" "/Users/Shared/Proyectos/$app/.pandacorp/run/queue-log.jsonl"
    done > work/timing-native.txt
    PYTHONDONTWRITEBYTECODE=1 python3 work/verify_timing.py > work/timing-verification.txt

Full stdout captures include raw evidence paths, event and report values, exact source lines, source ranges and calculations. [Queue and reports](../work/timing-queue.txt) · [Build and work orders](../work/timing-build.txt) · [Git ranges](../work/timing-git.txt) · [Archive and prior transcript rows](../work/timing-archive.txt) · [Native queue metrics](../work/timing-native.txt) · [Verification](../work/timing-verification.txt)

Selected raw output from those commands:

    QUEUE GATES (17, 298, 1093, 1387, 7953) rc {1: 8, 0: 9} summed 30d h 2.209167 union approx 30d h 1.774858
    QUEUE WAIT lock (26, 0.0, 1, 1, 5) summed 30d seconds 5.0
    QUEUE WAIT host slot (17, 0, 66, 101, 172) summed 30d seconds 172.0
    PRIMARY RED STAGE {'vitest': 2, 'playwright': 4, 'vitest-policy': 1, 'biome': 1}
    BUILD AGG G2 gate job (45, 150.207, 167.418, 696.381, 7099.803) timing type counts {'command start-to-exit mtime': 45} 30d summed h 1.9722 30d union h 1.9722
    LAND SUMMARY pooled project slices (shared merges can appear twice) (21, 2718.0, 10659.0, 12548.0, 84181.0) repair matches 11 commits after first 36
    LAND SUMMARY unique sampled ref moves (longer first-author slice clock on shared moves) (16, 2433.5, 10659.0, 12548.0, 63959.0)
