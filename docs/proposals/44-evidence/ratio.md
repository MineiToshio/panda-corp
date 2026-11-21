# Gate yield: real product bugs caught vs non-bug blocks (Pandacorp, 2026-07 → 2026-11-21)

Worker: ratio. Scope: mission-control (MC), funko-tracker (funko, launched), personal-page-v2 (ppv2).
All helper scripts and intermediate data: `/private/tmp/claude-501/-Users-sergio--claude-spares-spare-Kis6jz/486d4b23-cf7f-44e5-b370-390dd1a1a812/scratchpad/work/` (`extract_reds.py`, `distinct.py`, `view.py`, `tally.py`, `codex_reds2.py`, `codex_detail.py`, `cards.py`, `commits.py`; outputs `reds.json`, `distinct.json`, `stop_tally.json`, `codex_eps2.json`, `appendix.md`).

## TL;DR

| Stream (what blocked) | Unit | Real product bug (a) | Non-bug (b–g) | Yield | Label |
|---|---|---|---|---|---|
| A. Automated whole-project gate at end of turn (Stop hook running `verify.sh`) | 93 distinct episodes (664 red events) | **2** (+1 reviewer-authored red counted in C) | 90 | **~2 %** | MEASURED (all 145 signature groups read and classified) |
| B. Merge-queue full gate (`merge-queue.sh`) | 8 red gate runs (only day with logs: 2026-11-21) | **0** | 8 | 0 % | MEASURED |
| A+B combined | 101 episodes | **2** | 98(+1) | **≈ 1 : 50** | MEASURED |
| C. Independent reviewer / FRD gate (spec-reading reviewer + adversarial tests + browser) | findings in ~20 review docs/commits | **≈ 80–90** | ≈ 10–20 (process/coverage/harness items) | **≈ 80–85 %** of findings are real | ESTIMATED (counted from headings/commit bullets, not each re-verified) |
| D. Escapes to users despite all gates | bug cards + incident commits | ≥ 20 escaped bugs | — | — | MEASURED list, partial |

**Answer to the core question:** the automated, deterministic gate battery (vitest whole suite, Playwright smoke/visual/responsive, tsc, biome, knip, doc-lint, structure guards) almost never stops a real user-facing bug at the points where it blocks the agent (end of turn, queue). In 101 measured red episodes it caught **2** real bugs, both minor, both in ppv2 (MEASURED). The other ~98 % were environment/harness collisions, flakes under machine load, mid-work transients, process rules, formatting, or stale tests. In contrast, the **independent reviewer gate** (an agent that reads the FRD, writes adversarial tests, and drives a browser) produced most of the real catches in the record (ESTIMATED ≈ 80–90 real findings, e.g. open redirects, rate-limit bypass, lost photo credits, wrong "finished" states). Meanwhile the green automated gates let through at least one production outage (ppv2 blog posts broken in production by CSP) and live hydration errors in MC that were logged during a green gate.

Confidence: **high** that stream A+B yield is in the 0–5 % range (full enumeration; the two (a) episodes are verified against fix commits). **Medium** on the exact reviewer count (C) and on the escapes list (D), which is a lower bound.

---

## 1. Data sources and what each one actually contains

| Source | Path / command | Coverage | Usable? |
|---|---|---|---|
| `test-outcomes.jsonl` | `<project>/.pandacorp/run/test-outcomes.jsonl` | **Only 2026-11-21** (MC 28,161 rows / 5 attempts; funko 14,344 / 2; ppv2 4,812 / 3). MEASURED via `work/outcomes.py` | Thin. Failed rows: MC 1 vitest, ppv2 1 playwright, funko 0 |
| `queue-log.jsonl` | `<project>/.pandacorp/run/queue-log.jsonl` | **Only 2026-11-21** (MC 118 lines, funko 74, ppv2 75). MEASURED via `work/qlog.py` | 8 red gate runs, all read |
| `gate-reports/*.json` | `<project>/.pandacorp/run/gate-reports/` | Only today's attempts (MC 11, funko 4, ppv2 4 files) | Read every red one (`work/greports.py`) |
| Build journals | funko `.pandacorp/run/build{,-archive/*}/journal.jsonl` (345 lines) | 3 runs, Nov 13–21 | Few gate events; 2 `technical_failure g1_red:code` on a **docs-only** unit today |
| Claude Code transcripts | `~/.claude/projects/*{funko,personal-page-v2,panda-corp}*/*.jsonl` (≈7 GB) | 2026-07-06 → 2026-11-21 | **Main source.** Every Stop-hook red (`Pandacorp verify gate FAILED`) carries the last 30 lines of `verify.sh` |
| Codex sessions | `~/.codex/sessions/2026/**` (5.6 GB, 276 sessions, 275 in Nov) | Worker loop | Used for a side analysis (§5) |
| Review docs | `<project>/docs/reviews/*.md` (funko 65, MC 56, ppv2 4) | Whole life | Reviewer findings (stream C) |
| Change cards | `<project>/.pandacorp/inbox/changes/**` `type: bug` (funko 23, MC 9, ppv2 4) | Whole life | Escapes + test-infra bugs (stream D) |
| Git history | funko 1,186 non-merge commits, ppv2 336, MC 1,368 (`work/commits.py`) | Whole life | Fix-commit verification |
| Factory memory/backlog | `factory/memory` (676 files), `factory/backlog` (332) | Whole life | Corroboration |

Key limitation: the structured ledgers (`test-outcomes`, `queue-log`, `gate-reports`) only exist for **one day**; they were introduced or rotated recently. Everything before 2026-11-21 had to be reconstructed from transcripts and docs.

## 2. Stream A: Stop-hook gate reds (transcripts), fully enumerated

Method (MEASURED): `work/extract_reds.py` scanned every top-level transcript JSONL of the three projects for user records starting `Stop hook feedback` and containing `verify gate FAILED`, capturing the verify tail, the agent's next messages and tool calls. Result: **664 red events** (MC 347, funko 217, ppv2 100), 2026-07-06 → 2026-11-21. `work/distinct.py` grouped them by failure signature (set of failing test/spec/TS files) into **145 signature groups**; groups with the same root cause (e.g. the hook running without `DATABASE_URL`, 17 groups) were merged into **93 episodes** (`work/tally.py`). Each group was read (condensed tail + the agent's diagnosis) and classified; ambiguous ones were checked against git (below). Full table: `work/appendix.md` (145 rows).

### 2.1 Counts by class (episodes; MEASURED)

| Class | Episodes | Red events | Meaning |
|---|---|---|---|
| (a) real product bug | **2** | 2 | fix changed product behavior a user would see |
| (b) invisible code issue | 6 | 279 | formatting (biome), unused exports (knip), a type error in a test file |
| (c) test wrong/brittle/stale | 7 | 28 | stale expectations after intended change, test reading live state |
| (d) flaky / load / order | 17 | 54 | timeouts under parallel suites, shared Postgres, known-flaky e2e |
| (e) visual baseline re-bless | 0 | 0 | (baseline reds appear only inside env collisions) |
| (f) environment/harness/foreign | 33 | 234 | port collisions, missing `DATABASE_URL`, stale Prisma client/.next types, other sessions' WIP, deps missing |
| (f-mid) mid-work transient | 21 | 40 | hook fired while a subagent was half-way through an edit/rebase/TDD RED |
| (g) process rule | 6 | 13 | doc-lint, status.yaml schema keys, copy-rule test, verbatim-CSS rule, doc-structure test |
| (R) reviewer-authored red on main | 1 | 14 | counted in stream C |
| **Total** | **93** | **664** | |

By project (episodes): funko 43 (0 a), MC 31 (0 a), ppv2 19 (2 a).

### 2.2 By stage (episodes; MEASURED)

| Stage | (a) | (b) | (c) | (d) | (f)+(f-mid) | (g) | Total | Yield (a) |
|---|---|---|---|---|---|---|---|---|
| vitest (whole suite) | 2 | 0 | 6 | 15 | 13 | 3 | 40 (+1 R) | 5 % |
| Playwright (smoke/visual/responsive/e2e) | 0 | 0 | 1 | 2 | 8 | 0 | 11 | 0 % |
| tsc | 0 | 1 | 0 | 0 | 9 | 0 | 10 | 0 % |
| biome | 0 | 4 | 0 | 0 | 17 | 0 | 21 | 0 % |
| knip | 0 | 1 | 0 | 0 | 4 | 0 | 5 | 0 % |
| doc-lint / status schema | 0 | 0 | 0 | 0 | 0 | 3 | 3 | 0 % |
| harness/build (hook cwd, next build) | 0 | 0 | 0 | 0 | 3 | 0 | 3 | 0 % |

Note the event weight: one foreign biome formatting error in `mission-control/src/lib/status/status.ts` re-fired the Stop hook **232 times** across 4 sessions (group #135, 2026-11-10; MEASURED). The funko hook-without-`DATABASE_URL` root cause produced 17 signature groups / ~20 events across Oct 23–25 (MEASURED).

### 2.3 The two real catches (verified against git)

1. **ppv2, 2026-09-12, vitest `llmsTxt.test.ts`**: a newly published Spanish blog post was missing from `public/llms.txt`. Fix `931b64f fix(seo): add the second blog post to llms.txt` (1 file, `public/llms.txt`, +2). Real, user/crawler-visible, minor. (Group #40.)
2. **ppv2, 2026-09-11, vitest `frd08.gate.integration.test.ts`** (a **reviewer-authored** test for WO-08-005): blog generator could leave one locale published when its sibling failed. Fix `2a1ae37 fix(blog-generator): roll back a published locale if its sibling fails`. Real, operator-facing (the owner's publishing tool). The test came from the reviewer gate; the Stop hook merely re-ran it. (Group #39.)

### 2.4 Representative non-bug episodes (10 examples)

| Group | Class | What happened (evidence: agent diagnosis in transcript + fix) |
|---|---|---|
| #3–#6 (MC, 2026-07-06) | f | `http://127.0.0.1:3900 is already used`; another session's `next dev` (PID 63229) held the port |
| #7–#27 (ppv2, Sept) | f | 9 groups of `EADDRINUSE`/`ERR_CONNECTION_REFUSED` on port 4010: hook gate and agent gate running Playwright at once; "Falsa alarma, confirmada con evidencia" (#23, 23 failures incl. smoke) |
| #75–#97 (funko, Oct 23–25) | f | hook runs `verify.sh` without `DATABASE_URL`; 161 DB-backed test files fail; "Es el mismo fallo de siempre" |
| #94, #104, #107, #124, #125 (funko) | f | stale generated Prisma client in the main checkout (gitignored); fixed by regenerating, no code change |
| #50–#58 (funko, 2026-10-19) | d | `Test timed out in 5000ms` / `Hook timed out in 10000ms` while three Codex suites shared one Postgres; passes alone; #56 fixed by raising a timeout (`874b874`) |
| #68–#73, #84, #106 (MC, Oct 22–30) | d | known flakes `persistent-navigation.spec.ts:342`, `logical-data-model.spec.ts`, DataModelViewer «Organizando modelo…» |
| #64/#66 (MC, Oct 21–22) | c | e2e expected 9 workspace tabs, app has 10 ("Cuentas"); card `e2e-workspace-tabs-stale.md` |
| #49 (funko, 2026-10-19) | g | `styles.test.ts` requires ported prototype CSS byte-identical (ADR-0002); Codex's intended tap-target fix was **reverted** (`181c6d9`) to satisfy the rule. The agent called it "a real regression", but it was an intended UI change blocked by a process invariant |
| #129 (funko, 2026-11-05) | c | toggle-lock test red; investigation: "El bloqueo funcionaba bien" (product correct, test wrong) |
| #135 (MC, 2026-11-10) | b | biome formatting in `status.ts`; 232 Stop-hook re-fires |

## 3. Stream B: merge-queue full gate reds (2026-11-21 only; MEASURED)

`work/qlog.py` + `work/greports.py` on today's logs. 8 gate runs with `rc: 1`, plus non-gate queue exits (exit 20 missing gate ×2, exit 12 dirty main, exit 10 rebase conflict).

| Attempt | Project | Failing stage | Class | Evidence |
|---|---|---|---|---|
| 239307b7, 3f98fcb6 | MC | Playwright (`frd-07-10-s4c.reviewer.spec.ts:98` reload; WO detail tab) | d | same SHA `9890fcc1` went green on the 3rd run (42320f6c, rc 0); load avg 20 on 10 CPUs at gate end |
| b3214d18 | MC | vitest `manualSingleSource.test.ts` ("the .md of a bespoke page is an index stub") | g | doc-structure rule |
| e325c9ce | MC | biome `biome.json` deserialize | f | config/harness |
| 9e5120b5, 0ab31f4d | MC | vitest-policy "invalid reporter identity: Vitest fullName/task name" | f | the gate's own reporter |
| d893293c | funko | Playwright toggle "Tengo" not visible | d | load avg 22 at gate end; next run of the same branch green (01cdac65) |
| e843af86 | ppv2 | Playwright `blog-cover-alt.spec.ts:84` `page.goto networkidle` | d | `test-outcomes.jsonl` shows the same tree pass+fail (1 same-tree flaky pair, MEASURED) |

0 of 8 real. Today's red gate time alone (MEASURED from `duration_s`): MC 298+338+87+16+93+79 = 911 s, funko 1,083 s, ppv2 104 s ≈ **35 min of gate time that produced no product fix**.

## 4. Stream C: independent reviewer / FRD gate (ESTIMATED counts)

This is a different kind of check: an agent reads the FRD, writes adversarial tests the implementer did not see, and drives the real route in a browser. Its findings are mostly real product defects.

| Source | Real findings | Non-bug items | Examples |
|---|---|---|---|
| funko `docs/reviews/gate-frd-0{2,5,6,7}-*-codex-2026-10-19.md` | 15 (2+6+1+6) | 0 | FRD-02 C1 sibling/included photos omit their credits (live route: 0 credits for 2 photos); FRD-05 C1 retrying a failed export cannot restart it, C4 invalid franchise silently becomes the first one; FRD-06 C1 full-ingest continuation silently keeps its old scope |
| funko FRD gate patch commits `a858fb20`, `26d491f1`, `354c61ca`, `5026d6bf`, `db320c16` (2026-10-18/19) | ≈ 25 | 4 (port harness, responsive opt-out, knip, mail outbox) | `26d491f1`: `safeReturnTo` open redirect via tab/LF/CR; `354c61ca`: open redirect via `/.//host`, 409 conflict loop; `5026d6bf`: duplicate React key, retry that fails again is not retryable |
| funko FRD-12 reviews (`frd-12-cut-fluid-cpu-{review,rereview,final-review}.md`) | 10 (R1–R5, RR1–RR3, FINAL-1/2) | 1 (RR4 evidence-only) | R3 browser accepts cursors issued for a different query; FINAL-2 Explore's session-error retry never retries the failed request |
| funko deferred review DR-0001 (`.pandacorp/inbox/changes/review-frd-01-catalog-browsing-dr-0001.md`, journal `review_recorded` high:2 medium:2) | ≈ 3 | 1 (scope/card mismatch) | anonymous POST `updateExploreBatch` bypasses the 30/300-per-minute rate limit |
| funko other reviewer catches | ≈ 3 | — | contact returns HTTP 200 instead of 429 (`contact-http-status.md`); mouse drag starts native link drag (`7f0a4fb6`); goal-selection race |
| MC WO reviews (`docs/reviews/wo-*-review.md`, June) | ≈ 9 | ≈ 3 (shallow freeze, dangling i18n keys, "zero tests") | `wo-13-003` B1 focus ring class does not exist; `wo-05-001` greedy `Status:` match; `wo-12-004` WO reported finished while a direct action is open; `wo-04-002` phantom decision from a blank title |
| MC FRD-21 WO-21-003 (2026-10-30) | 9 ("rechazó WO-21-003 con 9 defectos reales") | — | work reverted `134af454` |
| MC canary E2 replay (`docs/reviews/canary-e2-report.md:32`) | 5 known real defects; explore gate found 4/5, digested gate 2/5 | — | AC drift, lenient `Date.parse` |
| `factory/memory/LESSON-0280` | 4 ("gate re-run found four real defects") | — | |
| ppv2 | ≈ 2 | — | blog generator atomic publish (above); security review High (Next CVE) |
| **Total** | **≈ 85** (overlap possible) | **≈ 10–15** | |

Caveats: counted from headings/commit bullets; some findings are spec-conformance on operator tooling (ingest skills) rather than end-user UI; some reviewer catches surface later as Stop-hook reds (#39, #110) and were counted only here.

## 5. Side stream: worker-internal test failures (Codex), not assessable as "catches"

`work/codex_reds2.py` over 276 Codex sessions: **253** tool outputs with failing tests (funko 211, other worktrees 40, MC 2). In 43 (32 unique), a test file the worker had not edited failed and the worker then edited non-test source. A 25-case sample (`work/codex_detail.py 0 25`) is dominated by **TDD/spec-driving** reds: acceptance or reviewer tests written by another unit fail until the feature is implemented (e.g. `ownerIntent.test.ts`, `approvalSecurity.test.ts`, `*.review.test.ts` P1). These are the tests acting as an executable spec for the agent. They are not regressions caught by a gate, and the logs cannot tell the two apart. Worker-loop failures caused by environment (`DATABASE_URL`, `EPERM`, timeouts) were 54/253 (MEASURED by regex, lower bound).

## 6. Stream D: bugs that escaped to users despite all gates

Lower bound. Sources: `type: bug` change cards (`work/cards.py`), incident commits, transcripts, archived queue log.

| # | Project / date | Escaped bug | Why the gates missed it | What would have caught it |
|---|---|---|---|---|
| 1 | ppv2 2026-09-06 | **Blog post page broken in production**: CSP blocks MDX `eval`, error boundary, zero content (`blog-post-page-broken-in-production-csp-eval.md`; owner later published "Why My Tests Passed While My Blog Was Broken in Production", `4e6acc9`) | smoke ran against `next dev` (CSP dev-only `unsafe-eval`) | smoke on a **production build** (`next build && next start`) of one real page per route type, failing on `pageerror`/console error |
| 2 | ppv2 2026-09-06 | `page_viewed` lost on every initial load (PostHog init race) | no analytics assertion | e2e asserting the first analytics request fires |
| 3 | ppv2 2026-07-09 | console error on language switch ("script tag while rendering") | console errors not failing | console-error-as-failure in smoke |
| 4 | MC (fixed 2026-11-03, `1e65ce45`) | hydration mismatch on client navigation; the archived green queue run (`.pandacorp/run/archive/queue-next-16-4-3.log.gz`) logged **6** `Uncaught Error: Hydration failed` and **7** attribute mismatches while the gate passed (MEASURED by grep) | server/browser errors are logged, not asserted | fail the browser gate on `pageerror` / hydration warnings |
| 5 | MC 2026-09-24 | duplicate React key in `Informe.tsx:707` | React warning not asserted | same console-error rule |
| 6 | MC 2026-09-25, 2026-09-23, 2026-07-07, 2026-10-30 | portfolio rail leaks `architecture`-phase projects; Fragua multi-FRD ambiguity; per-project seal coverage; URL params lost on in-flight replace | logic gaps in untested combinations | reviewer with real data / property tests; not the regression suite |
| 7 | funko 2026-10-20 | production failures after deploy (`production-deploy-acceptance-remediation.md`), maintenance cron never fired (`fix-maintenance-schedule-delivery.md`), One Piece ingest plan fails at real size (`fix-large-ingest-plan.md`) | gates run on fixtures, not production config/scale | production canary + synthetic cron check; one realistic-scale data test |
| 8 | funko 2026-10-20/22 | restored export retry duplicates; goal selection race; contact 200 vs 429 | partially caught by reviewer only after deploy | reviewer before landing |
| 9 | funko 2026-10-27 | catalog-prep timestamps off by the timezone | tests run in UTC | run unit tests under a non-UTC `TZ` |
| 10 | funko 2026-10-24/26 | export column uniformity; mobile-only footer; control motion; original control colors | owner taste/visual intent | visual review against the approved mock (owner/reviewer), not a pixel baseline |
| 11 | funko 2026-11-15 | rate-limit bypass on anonymous Explore POST found by the **deferred** review after landing on launched main | review deferred past landing | the reviewer gate before landing for risk paths |

Funko also has **139 `fix(...)` commits touching `src/` after launch (2026-10-21 → 2026-11-19)** (MEASURED, `work/funko.json`). Many are reviewer corrections or owner feedback; the split between escaped and pre-landing was not determinable from messages alone.

## 7. Test-infrastructure burden visible in the same records (MEASURED unless noted)

- Bug cards that are about the **test harness itself**, not the product: funko `fidelity-gate-cannot-run`, `fidelity-gate-member-session-500`, `fidelity-harness-recipes`, `local-fidelity-production-fixture`, `e2e-own-origin-follows-worktree-port`, `nextconfig-test-order-dependent-swc`; MC `e2e-workspace-tabs-stale`, `navigation-identity-test-isolation`, `persistent-navigation-history-flaky`, `data-model-viewer-layout-flaky-tests`. That is 10 of 36 `type: bug` cards (28 %) about tests/gates.
- Commits touching only tests/baselines: funko 167/1,186, MC 62/1,368, ppv2 9/336. Commits whose subject mentions gate/verify/harness/port/knip/biome/format/lint/tsc/types: funko 229, MC 302, ppv2 36 (keyword heuristic, ESTIMATED relevance).
- Factory memory has a cluster of lessons whose whole point is "this red is not a real regression": LESSON-0040, -0079, -0099, -0111, -0185, -0438, -0446, -0480, -0545, -0614.
- Review docs dedicated to flake forensics: funko `frd05-export-goal-flake.md`, `personal-controls-e2e-flakes-2026-10-27.md`, `unit-harness-stability-2026-10-26.md`; MC `flaky-test-isolation.md`.

## 8. Best and worst yield

- **Best:** the independent reviewer gate (spec-reading, adversarial tests, real browser): ≈ 80–85 % of its findings are real defects (ESTIMATED), and it caught the security bugs (open redirects ×2, rate-limit bypass, prototype pollution) and most of the spec violations. Its explore-mode recall on a seeded replay was 4/5 (`canary-e2-report.md:32`).
- **Some value:** focused vitest tests that encode a cross-cutting invariant on content (`llmsTxt.test.ts`): 1 real catch.
- **Worst (≈ 0 real catches, highest event volume):** biome (279 events, 0 real), tsc in the main checkout (stale generated clients and types), Playwright full browser layer at the Stop hook/queue (11 + 4 episodes, 0 real, dominated by port collisions and load), doc-lint/status-schema/process tests.
- **Missed what mattered:** the browser layer passed while production-build CSP broke every blog post (ppv2) and while hydration errors were being logged (MC). The checks with the largest cost did not cover the failure modes that reached users.

## 9. Confidence and limits

- Stream A is a census of Stop-hook reds in top-level Claude Code transcripts. Not covered: subagent transcripts (`subagents/` folders), Stop reds in Codex sessions (Codex hooks), and reds the agent saw by running `verify.sh` manually. The share of (a) could be higher in those; the worker-loop sample (§5) does not suggest it, but it cannot separate TDD reds from regressions.
- Episode merging (145 → 93) was done by root cause on my reading; the (a) share is 2/145 by groups (1.4 %), 2/93 by episodes (2.2 %), 2/664 by events (0.3 %).
- A gate that rarely fires on real bugs may still deter them (agents write code knowing tests exist). That counterfactual is not measurable from this data.
- Stream C counts are not re-verified one by one; overlap between canary replays and original reviews is possible.

## 10. What data is missing, and the minimal logging that would fix it

Missing:
1. No durable red ledger before 2026-11-21. `test-outcomes.jsonl` / `queue-log.jsonl` / `gate-reports` cover one day.
2. No link from a red to the change that turned it green, so "did the fix touch product source?" must be inferred.
3. No cause tag on a red, so env/flake/process/product must be reconstructed from agent prose.
4. Reviewer findings live in prose docs and commit bullets, not a structured record with severity and fix SHA.
5. Escapes are not tagged with "which check should have caught this".

Minimal fix (about 3 fields, no new tool):
- **Red ledger, kept indefinitely:** on every non-green gate (Stop hook, queue, worker), append `{ts, project, attempt, entry (stop|queue|worker|reviewer), stage, failing_ids, tree, head}` to `.pandacorp/run/gate-reds.jsonl` (the queue already has most of these fields).
- **Green-after-red link:** when the same branch/worktree next goes green, append `{red_attempt, green_tree, changed_paths}` and derive `fix_kind` automatically: `src-nontest` / `tests-only` / `baselines-only` / `config-or-env` / `none` (passed on rerun = flake). That makes the yield computable with no human input.
- **One cause trailer on the fixing commit:** `Gate-Red: <attempt> cause=product|test|flake|env|process`. It is cheap and settles the ambiguous `src-nontest` cases.
- **Escape tag on bug cards:** `escaped_past: [stage...]` plus `would_catch: <check>`.

## Appendix: all 145 Stop-hook red signature groups and their classification

Classes: a real product bug, b invisible code issue, c test wrong/stale, d flaky/load, f env/harness/foreign, fm mid-work transient, g process rule, R reviewer-authored red (counted in stream C).

| # | project | first seen (UTC) | events | stage | class | signature (failing files or first output) |
|---|---|---|---|---|---|---|
| 0 | mc | 2026-07-06T06:37 | 11 | vitest | f | reference.test.ts |
| 1 | mc | 2026-07-06T15:36 | 13 | vitest | d | frd-11-gate.reviewer.test.tsx |
| 2 | mc | 2026-07-06T17:23 | 1 | playwright | f | responsive.spec.ts, shell.spec.ts |
| 3 | mc | 2026-07-06T17:25 | 1 | playwright | f | nosig: (node:90077) Warning: `--localstorage-file` was provided without a valid path ( |
| 4 | mc | 2026-07-06T18:18 | 1 | playwright | f | nosig: ·······(node:74251) Warning: `--localstorage-file` was provided without a valid |
| 5 | mc | 2026-07-06T18:21 | 1 | playwright | f | nosig: ·············(node:84316) Warning: `--localstorage-file` was provided without a |
| 6 | mc | 2026-07-06T18:40 | 1 | playwright | f | nosig: (node:3017) Warning: `--localstorage-file` was provided without a valid path (U |
| 7 | ppv2 | 2026-09-07T02:27 | 10 | playwright | f | global-error.test.tsx, not-found.test.tsx |
| 8 | ppv2 | 2026-09-07T05:08 | 2 | playwright | f | global-error.test.tsx |
| 9 | ppv2 | 2026-09-07T06:07 | 3 | playwright | f | responsive.spec.ts, shell.spec.ts, smoke.spec.ts, visual.spec.ts |
| 10 | ppv2 | 2026-09-07T06:24 | 1 | doc-lint/status-schema | g | nosig: • .pandacorp/status.yaml carries key 'pending_bugs' not declared by the canonic |
| 11 | ppv2 | 2026-09-07T06:25 | 1 | vitest | g | contentParity.test.ts |
| 12 | ppv2 | 2026-09-07T06:35 | 2 | vitest | g | messages.test.ts |
| 13 | ppv2 | 2026-09-07T06:49 | 1 | tsc | fm | buildHomeLabels.ts |
| 14 | ppv2 | 2026-09-07T06:59 | 1 | biome | fm | webveloper.ts |
| 15 | ppv2 | 2026-09-07T07:05 | 1 | biome | fm | nosig: ════════════════════════════════════════════════════════════════════════ src/ap |
| 16 | ppv2 | 2026-09-07T07:09 | 1 | playwright | f | not-found.test.tsx |
| 17 | ppv2 | 2026-09-07T07:20 | 4 | biome | fm | nosig: 181 181 │ 182 │ - ····console.log('\n'·+·'='.repeat(60)); 183 │ - ····console.l |
| 18 | ppv2 | 2026-09-07T07:43 | 1 | biome | fm | Eyebrow.test.tsx |
| 19 | ppv2 | 2026-09-07T09:27 | 1 | playwright | f | i18n-routing.spec.ts, projects-fidelity.spec.ts, responsive.spec.ts, shell.spec.ts, visual |
| 20 | ppv2 | 2026-09-07T09:52 | 1 | biome | fm | nosig: 27 27 │ await expect(page.locator("main, h1").first()).toBeVisible(); 28 28 │ 2 |
| 21 | ppv2 | 2026-09-07T15:40 | 1 | biome | fm | nosig: 19 │ - ··const·h1LineInfo·=·await·page.locator(".hero·h1").first().evaluate((el |
| 22 | ppv2 | 2026-09-07T15:47 | 1 | biome | fm | .tmp-hero-shots.mjs |
| 23 | ppv2 | 2026-09-07T17:54 | 20 | playwright | f | projects-fidelity.spec.ts, shell.spec.ts, smoke.spec.ts, visual.spec.ts |
| 24 | ppv2 | 2026-09-07T19:42 | 1 | biome | fm | nosig: 14 │ + ······const·context·=·await·browser.newContext({ 15 │ + ········viewport |
| 25 | ppv2 | 2026-09-08T01:21 | 1 | playwright | f | smoke.spec.ts, visual.spec.ts |
| 26 | ppv2 | 2026-09-08T05:41 | 20 | playwright | f | visual.spec.ts |
| 27 | ppv2 | 2026-09-09T00:20 | 1 | playwright | f | nosig: This ensures that you're testing the behavior the user would see in the browser |
| 28 | ppv2 | 2026-09-09T04:05 | 1 | vitest | f | filesystem.test.ts |
| 29 | ppv2 | 2026-09-09T06:13 | 4 | tsc | f | buildContactLabels.ts |
| 30 | ppv2 | 2026-09-09T14:22 | 2 | tsc | f | about.ts, blog.ts, getAboutOrThrow.ts, getNowOrThrow.ts, now.ts |
| 31 | ppv2 | 2026-09-09T14:28 | 2 | playwright | f | nosig: [WebServer] digest: '344946385' [WebServer] } [WebServer] ⨯ Error: NEXT_PUBLIC_ |
| 32 | ppv2 | 2026-09-09T14:29 | 4 | biome | fm | pandacorp.ts |
| 33 | ppv2 | 2026-09-09T14:43 | 2 | vitest | d | CaseStudyCardList.test.tsx, ProjectsIndexView.test.tsx |
| 34 | ppv2 | 2026-09-09T17:13 | 2 | vitest | d | CodeBlock.mdxOverride.test.tsx, ContactView.test.tsx |
| 35 | ppv2 | 2026-09-09T21:13 | 2 | biome | fm | nosig: > 101 │ es: { │ ^^^ 102 │ name: "Alohub", 103 │ contextLine: i Expected a state |
| 36 | ppv2 | 2026-09-09T21:15 | 1 | biome | fm | nosig: 105 │ problem: 106 │ "Construir un producto completo en solitario hace que docs |
| 37 | ppv2 | 2026-09-09T21:16 | 1 | biome | fm | nosig: 113 │ problem: 114 │ "Los trabajadores de primera línea buscan empleo con herra |
| 38 | ppv2 | 2026-09-09T21:17 | 1 | biome | fm | nosig: > 80 │ glance: { │ ^^^^^^^ 81 │ role: "Co-founder · CEO · Lead programmer", 82  |
| 39 | ppv2 | 2026-09-11T05:35 | 1 | vitest | a | frd08.gate.integration.test.ts |
| 40 | ppv2 | 2026-09-12T05:21 | 1 | vitest | a | llmsTxt.test.ts |
| 41 | ppv2 | 2026-09-15T16:16 | 1 | vitest | c | frd08.acceptance.test.ts, global-error.test.tsx |
| 42 | mc | 2026-09-22T04:11 | 1 | playwright | d | responsive.spec.ts, visual.spec.ts |
| 43 | mc | 2026-09-22T14:42 | 1 | playwright | f | reference.test.ts, standards.test.ts |
| 44 | mc | 2026-09-22T14:53 | 1 | vitest | fm | changes.test.ts |
| 45 | mc | 2026-10-01T14:13 | 2 | playwright | f | headers.spec.ts, responsive.spec.ts, shell.spec.ts, smoke.spec.ts, visual.spec.ts |
| 46 | funko | 2026-10-17T06:24 | 2 | doc-lint | g | nosig: • docs/frds/frd-06-franchise-backfill/work-orders/wo-06-005-review-queue-decisi |
| 47 | funko | 2026-10-18T01:14 | 1 | biome | f | nosig: undefined ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "biome" not found This hoo |
| 48 | funko | 2026-10-18T14:28 | 2 | knip | fm | nosig: VARIANT_KEYS src/lib/pieces/pieceSummary.ts:5:14 Unused exported types (17) Ale |
| 49 | funko | 2026-10-19T06:24 | 2 | vitest | g | styles.test.ts |
| 50 | funko | 2026-10-19T06:43 | 1 | vitest | d | actions.test.ts, seedDetail.gate.test.ts |
| 51 | funko | 2026-10-19T06:49 | 1 | vitest | d | catalogDirectory.test.ts, gateDecisionProbes.test.ts |
| 52 | funko | 2026-10-19T08:22 | 1 | vitest | d | auth.test.ts, eligibility.test.ts |
| 53 | funko | 2026-10-19T08:44 | 1 | vitest | d | deltaWindow.test.ts |
| 54 | funko | 2026-10-19T09:15 | 3 | vitest | d | seed.test.ts |
| 55 | funko | 2026-10-19T09:29 | 1 | vitest | d | vercelBuild.test.ts |
| 56 | funko | 2026-10-19T10:46 | 1 | vitest | d | capacitySecurity.test.ts |
| 57 | funko | 2026-10-19T10:59 | 1 | vitest | f | catalogMatch.test.ts, decisions.test.ts, deltaWindow.test.ts, erasureWiring.codexGate.test |
| 58 | funko | 2026-10-19T11:09 | 1 | vitest | d | seedDetail.gate.test.ts |
| 59 | mc | 2026-10-20T14:38 | 3 | vitest | c | wo-18-001-fixes.test.tsx |
| 60 | mc | 2026-10-20T22:51 | 14 | knip | f | ChangeCard.review.test.tsx, IdeaBoardView.wo02014.review.test.tsx, PortfolioTable.lastSync |
| 61 | mc | 2026-10-21T01:08 | 2 | harness | f | nosig: ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND No package.json (or package.yaml, or packag |
| 62 | mc | 2026-10-21T01:41 | 2 | vitest | d | usability.reviewer.test.tsx |
| 63 | mc | 2026-10-21T17:12 | 1 | vitest | d | navigation.test.tsx |
| 64 | mc | 2026-10-21T17:21 | 4 | playwright | c | logical-data-model.spec.ts, portfolio-spec.spec.ts |
| 65 | mc | 2026-10-21T22:36 | 1 | vitest | d | fullscreen.consistency.reviewer.test.tsx |
| 66 | mc | 2026-10-22T10:17 | 4 | playwright | c | logical-data-model.spec.ts, persistent-navigation.spec.ts, portfolio-spec.spec.ts |
| 67 | funko | 2026-10-22T16:09 | 10 | biome | f | nosig: 65 │ - ··········447 66 │ - ········], 51 │ + ········"natural":·[447,·447], 67 |
| 68 | mc | 2026-10-22T18:20 | 4 | playwright | d | persistent-navigation.spec.ts |
| 69 | mc | 2026-10-22T18:25 | 1 | playwright | d | logical-data-model.spec.ts, smoke.spec.ts, visual.spec.ts |
| 70 | mc | 2026-10-22T21:16 | 1 | playwright | d | logical-data-model.spec.ts |
| 71 | mc | 2026-10-22T21:22 | 2 | playwright | d | logical-data-model.spec.ts, persistent-navigation.spec.ts |
| 72 | mc | 2026-10-22T21:54 | 1 | vitest | d | fullscreen.ux.reviewer.test.tsx |
| 73 | mc | 2026-10-22T23:07 | 3 | vitest | d | viewer.reviewer.test.tsx |
| 74 | funko | 2026-10-23T04:12 | 18 | tsc | f | validator.ts |
| 75 | funko | 2026-10-23T04:15 | 2 | vitest | f | goals.gate.test.ts, ingestionRun.test.ts, manyScopes.test.ts, mediaReclassification.test.t |
| 76 | funko | 2026-10-23T04:17 | 2 | vitest | f | accountDeletion.test.ts, auth.test.ts, catalogMerge.test.ts, catalogSearch.gate.test.ts, e |
| 77 | funko | 2026-10-23T17:44 | 2 | vitest | f | _db.test.ts, catalogMatch.test.ts, catalogSearch.test.ts, exportJobSafety.independent.test |
| 78 | funko | 2026-10-23T17:48 | 2 | vitest | f | actions.test.ts, codexGate.test.ts, mutationReceipt.test.ts, publicSecurity.test.ts, rende |
| 79 | funko | 2026-10-23T17:55 | 2 | vitest | d | AppShell.test.tsx |
| 80 | funko | 2026-10-23T20:11 | 1 | vitest | f | actions.test.ts, migrationStatus.test.ts, mutationReceipt.test.ts, ownership.gate.test.ts, |
| 81 | funko | 2026-10-23T20:25 | 1 | vitest | f | candidate.test.ts, catalogDirectory.test.ts, erasureMigration.test.ts, erasureRecovery.ind |
| 82 | funko | 2026-10-23T20:30 | 1 | vitest | f | catalogMatch.test.ts, closeoutServer.test.ts, inventory.test.ts, largePlan.test.ts, migrat |
| 83 | funko | 2026-10-23T20:32 | 1 | vitest | f | bulkSafety.review.test.ts, contactRetentionMigration.test.ts, erasureCredentials.independe |
| 84 | mc | 2026-10-23T23:59 | 1 | playwright | d | logical-data-model.spec.ts, visual.spec.ts |
| 85 | funko | 2026-10-24T01:43 | 1 | vitest | f | catalogDirectory.gate.test.ts, codexGateCli.test.ts, collectibleDetail.gate.test.ts, delta |
| 86 | funko | 2026-10-24T01:48 | 1 | vitest | f | accountDeletion.test.ts, actions.test.ts, inventory.test.ts, manyScopes.test.ts, mediaHeal |
| 87 | funko | 2026-10-24T03:20 | 1 | vitest | f | actions.test.ts, closeoutServer.test.ts, durableAcceptance.test.ts, ingestPlan.test.ts, me |
| 88 | funko | 2026-10-24T03:29 | 1 | vitest | f | backoffSecurity.test.ts, follow.test.ts, gateConcurrency.test.ts, goals.gate.test.ts, medi |
| 89 | funko | 2026-10-24T03:33 | 1 | vitest | f | deltaSkillContract.test.ts, gateDecisionProbes.test.ts, mediaCheck.test.ts, publicSecurity |
| 90 | funko | 2026-10-24T03:37 | 1 | vitest | f | actions.test.ts, expireExports.test.ts, exportJob.test.ts, exportSnapshot.codexGate.test.t |
| 91 | funko | 2026-10-24T04:03 | 1 | vitest | fm | profiles.test.ts |
| 92 | funko | 2026-10-24T05:05 | 1 | vitest | f | codexGateCli.test.ts, exportDurability.test.ts, follow.test.ts, merge.test.ts, preview.gat |
| 93 | funko | 2026-10-24T05:11 | 1 | vitest | f | accountDeletion.test.ts, deltaSkillContract.test.ts, ingestPlan.test.ts, loadMoreResults.t |
| 94 | funko | 2026-10-25T02:20 | 1 | tsc | f | catalogDirectory.ts, catalogExport.ts, catalogMatch.ts, catalogPublish.ts, exportSnapshot. |
| 95 | funko | 2026-10-25T02:30 | 1 | vitest | f | runtimeEnv.test.ts |
| 96 | funko | 2026-10-25T02:32 | 1 | biome | fm | FichaLightbox.tsx |
| 97 | funko | 2026-10-25T02:41 | 3 | vitest | f | productionRunNote.test.ts |
| 98 | funko | 2026-10-25T04:21 | 1 | biome | fm | records.ts |
| 99 | funko | 2026-10-25T05:15 | 1 | vitest | c | FilterRail.test.tsx |
| 100 | funko | 2026-10-25T05:24 | 13 | vitest | c | fixtureIsolation.independent.test.ts |
| 101 | funko | 2026-10-25T14:56 | 1 | vitest | d | erasureSafety.independent.test.ts, modalDeploy.test.ts |
| 102 | funko | 2026-10-25T15:01 | 2 | vitest | d | modalDeploy.test.ts |
| 103 | funko | 2026-10-25T16:17 | 1 | vitest | d | erasureSafety.independent.test.ts |
| 104 | funko | 2026-10-26T05:46 | 1 | tsc | f | exportSnapshot.test.ts, inventory.ts, merge.ts, reservedMerge.test.ts, reservedViews.test. |
| 105 | funko | 2026-10-28T15:26 | 40 | tsc | b | lightCatalog.test.ts |
| 106 | mc | 2026-10-30T01:20 | 1 | vitest | d | DataModelViewer.test.tsx |
| 107 | funko | 2026-10-30T04:18 | 1 | tsc | f | goal.ts, publication.ts |
| 108 | mc | 2026-10-30T08:58 | 1 | tsc | f | nosig: • .pandacorp/status.yaml carries key 'work_orders_verified' not declared by the |
| 109 | funko | 2026-10-30T12:33 | 3 | biome | fm | nosig: 1080 │ + ····"partitions":·["classic"], 1124 1081 │ "visibility": "public", 112 |
| 110 | mc | 2026-10-30T19:00 | 14 | vitest | R | snapshot-panel.gate.reviewer.test.tsx |
| 111 | mc | 2026-10-31T01:52 | 1 | biome | f | nosig: 56 43 │ "projectId": "project_94f700aa-2064-4a89-8f90-770c34d618ac" ····· │ 61  |
| 112 | mc | 2026-10-31T02:14 | 1 | vitest | f | workspace-navigation.test.tsx |
| 113 | mc | 2026-10-31T06:24 | 1 | biome | f | owner.json |
| 114 | mc | 2026-10-31T11:08 | 1 | vitest | d | ChangesPanel.test.tsx |
| 115 | mc | 2026-10-31T21:27 | 2 | harness | f | configurationCatalogs.test.ts, reference.test.ts |
| 116 | mc | 2026-11-01T00:19 | 1 | vitest | d | workspace-frame.integration.test.tsx |
| 117 | funko | 2026-11-01T06:43 | 3 | doc-lint | g | nosig: PROJECT-SKILLS: legacy rollout is advisory; new or renamed skills require --str |
| 118 | funko | 2026-11-01T06:47 | 2 | knip | fm | nosig: i Run the command biome migrate to migrate the configuration file. Checked 1664 |
| 119 | funko | 2026-11-01T06:55 | 1 | biome | fm | loading.tsx |
| 120 | funko | 2026-11-01T07:06 | 2 | knip | b | nosig: i Expected: 2.5.15 Found: 2.5.1 i Run the command biome migrate to migrate the  |
| 121 | funko | 2026-11-01T07:14 | 1 | vitest | c | FranchisesView.test.tsx |
| 122 | funko | 2026-11-01T07:26 | 1 | vitest | fm | universeLogoBindings.test.ts |
| 123 | funko | 2026-11-01T07:37 | 1 | vitest | fm | dispatch.test.ts |
| 124 | funko | 2026-11-03T17:07 | 1 | tsc | f | UniverseModalLoader.tsx, catalogSql.ts, parts.tsx, types.ts, universeImport.ts, universeIm |
| 125 | funko | 2026-11-04T04:33 | 1 | tsc | f | catalogDirectory.ts, catalogMatch.ts, eligibility.ts, exportSnapshot.ts, helpExamples.ts,  |
| 126 | funko | 2026-11-04T16:33 | 2 | vitest | g | franchiseBackfillContract.test.ts |
| 127 | funko | 2026-11-05T12:34 | 1 | biome | fm | PreviewInspect.test.tsx, checklistSnapshotPlan.test.ts, checksOption.test.ts, exportar.tes |
| 128 | funko | 2026-11-05T12:45 | 1 | biome | fm | nosig: 38 │ + ····...plan, 39 │ + ····rendered:·ids.size, 40 │ + ····franchises:·plan. |
| 129 | funko | 2026-11-05T13:10 | 1 | vitest | c | exportar.test.tsx |
| 130 | funko | 2026-11-06T01:44 | 2 | playwright | f | frd-04-goals-and-to-get.behaviour.spec.ts |
| 131 | funko | 2026-11-07T03:11 | 1 | playwright | f | fidelity-harness.spec.ts, frd-08-help-contact-legal.behaviour.spec.ts |
| 132 | funko | 2026-11-07T04:12 | 1 | vitest | f | runtimeDotenv.test.ts |
| 133 | funko | 2026-11-07T20:30 | 19 | build | f | nosig: #2 [App Route]: ./src/lib/media/fixtureMediaRoot.ts ./src/app/oracle-media/[... |
| 134 | funko | 2026-11-09T01:00 | 34 | tsc | f | client.ts, contactMessage.ts, pipeline.ts, sdk.ts, sdkSecurity.test.ts, validator.ts |
| 135 | mc | 2026-11-10T20:56 | 232 | biome | b | status.ts |
| 136 | mc | 2026-11-12T20:00 | 1 | biome | b | nosig: 60 79 │ it("missing lease file is not an error and does not make a project live |
| 137 | mc | 2026-11-12T20:53 | 6 | tsc | f | routes.d.ts, validator.ts |
| 138 | mc | 2026-11-13T00:28 | 2 | knip | fm | nosig: i The configuration schema version does not match the CLI version 2.5.2 1 │ { > |
| 139 | mc | 2026-11-13T13:36 | 1 | tsc | f | vitest.config.ts |
| 140 | funko | 2026-11-14T07:26 | 1 | biome | fm | nosig: × Formatter would have printed the following content: 2 2 │ for (const key of [ |
| 141 | mc | 2026-11-14T21:40 | 2 | biome | b | manualPages.tsx |
| 142 | funko | 2026-11-19T00:34 | 1 | vitest | f | FilterRail.gate.test.tsx, FilterRail.test.tsx, FollowBar.test.tsx, FollowPicker.test.tsx,  |
| 143 | funko | 2026-11-19T02:25 | 1 | vitest | f | FilterRail.gate.test.tsx, FilterRail.test.tsx, FollowBar.test.tsx, FollowPicker.test.tsx,  |
| 144 | mc | 2026-11-21T03:48 | 2 | biome | b | nosig: × Formatter would have printed the following content: 681 681 │ actualiza <Code |
