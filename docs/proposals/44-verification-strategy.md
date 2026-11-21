# 44 — Verification strategy: fix how agents get and act on feedback; keep the release proof until a shadow comparison says otherwise

**Status: The owner chose option B on 2026-11-21. [Proposal 46](46-implement-and-verification.md#owner-decisions) is the decision vehicle and carries option B forward. Implementation is pending.**

**Date:** 2026-11-21 · **Home:** FACTORY proposal (verification policy across the Stop hook, the build engine's unit, feature and landing gates, the merge queue, the reviewer and test-writer roles, and the standards that govern them). Applies to mission-control (internal), funko-tracker (launched), personal-page-v2 (launched) and every future project.

**Marks.** Factory figures use the stated research windows (the frozen sample of 2026-11-21); §5 separately labels the later Funko queue observations. External studies retain their own samples. A date, model version, identifier, section or phase number is a reference, not a measurement. Every number carries a mark: **measured** (read from a log, report, transcript, Git or code, with its sample size n where one exists), **derived** (calculated from measured numbers; still measured data), **estimated** (first-finder credit, attribution, illustrative policies, bounds, counterfactuals and projections, with their basis) or **external** (a vendor's or paper's own result, not reproduced here). Evidence files are archived in `E=docs/proposals/44-evidence` (relative to the factory root) and cited as `E/timing.md` etc. Four files in that folder correct the others and take precedence wherever they disagree: `E/verify-ratio.md`, `E/verify-sources.md`, `E/redteam.md` and the acceptance audit of this memo, `E/verify-memo.md`. The first draft of the recommendation (`E/synthesis.md`) is kept only as the object of the red team.

**Relation to proposal 43.** Proposal 43 ("done means the queue is green", approved 2026-11-20) made the queue the single proof of done, added the queue log, the per-test outcome ledger, queue states, the pre-push proof, owner-only flaky exclusions and added-test budgets. Git confirms commits for all of its listed phases on main (`246f4ba4` phase 0; `c40e452d`, `5419e778` phase 0.5; `31de507a`, `b94be3d2` phase 1; `f844af57` phase 2; `5ed055d6`, `01acbe06` phase 3). Its header ("not yet implemented") is stale. Production adoption, sustained performance and installed scheduling are separate questions that Git does not answer. This proposal **depends on** proposal 43: its first experiments read 43's queue log and outcome ledger and keep 43's full proof as the control. It **complements** 43: 43 made the final proof honest and faster; 44 targets how agents receive and act on feedback before that proof. Its recommended default **supersedes none** of 43's six owner decisions. The faster variant in §9 and §11.6 would, if the owner applied it to Mission Control, expressly reopen 43's decision 4A (Mission Control browser tests stay blocking).

---

## Terms used

- **Test:** a program that runs the app or part of it and checks a result. **Vitest** runs unit and integration tests in Node; **Playwright** drives a real browser against the app.
- **Static checks:** checks that read code without running it: TypeScript type checking (`tsc`), lint and format (Biome), dead code (knip), import cycles (madge), plus the factory's document and structure checks (doc-lint, residual ambiguity, structure guard).
- **Gate:** `.pandacorp/verify.sh`, the script that runs a selection of the checks above and answers green (pass) or red (fail). **Full gate:** every check; browser checks run against the production build. **Light gate:** static checks plus, at most, explicitly selected test files. **Since gate:** static checks, changed unit tests, and the smoke and shell browser specs on the default development server.
- **Blocking:** a red stops the work from moving on until it is repaired.
- **Stop hook:** a check the plugin runs when a Claude session ends a turn. By default it runs static checks and test files selected from the session's edits and dirty paths. An active build, a matching proof or another early-exit condition can skip it. When it runs, a red blocks if it is attributed to the session or cannot be attributed, and verifier contention (exit 75, another verifier owns the checkout) also blocks.
- **Engine gates:** the build engine (`pandacorp-build.mjs`) runs **G1** (light gate on each unit report before it is committed), **G2** (since gate per eligible feature, FRD) and **G3** (the merge queue, at landing).
- **Queue:** `.pandacorp/merge-queue.sh`; under a lock it rebases a branch onto main, runs the full gate on the result (or reuses an exact-tree proof) and moves main. **Stamp:** the record that an exact tree passed a full gate, so an unchanged tree is not re-gated.
- **Launched project:** in production (`phase: release`, not internal). Every landing needs the **owner order** (DR-138); by default it is asked for at the start of the work and checked at landing.
- **Reviewer:** an independent agent that reads the feature's requirements, inspects the change, drives the running app and writes adversarial tests. **Test writer:** an agent that writes acceptance tests from the requirements before the implementer starts. **Oracle:** the independent statement of expected behaviour that judges a change.
- **Flaky:** a test that passes and fails on the same code. **Environment red:** a red caused by the machine or setup (a missing generated file, a busy port, a missing tool, load timeouts), not by the change.
- **Production-build smoke:** a browser check that serves the production build and opens real routes.
- **Affected run:** `verify.sh --affected`, an existing mode that can omit the browser only on proven data-only changes and keeps full browser coverage for unknown paths; its result is partial and never certifies.
- **Exclusion-audit nightly run:** the existing proposal-43 helper that runs the full gate on main's tip without exclusions and never certifies. It requires explicit scheduling and a committed exclusions file; without that file it exits before running tests.
- **Shadow comparison:** a candidate rule runs alongside the current one and records what it *would* have decided, without being allowed to decide anything.
- **Episode:** one change's path from its first queue run to landing.

---

## TL;DR

1. **Verdict: Outcome 2 for how agents get feedback and repair; Outcome 3 at the release boundary.** Change where and how the agents' feedback loop runs now; keep today's full rebased proof before production on launched projects (and Mission Control's blocking browser tests) until a shadow comparison measures what a lighter landing check would miss. Outcome 1 (remove tests almost entirely) is rejected for anything with users or shared consumers; it is defensible only for disposable, isolated, reversible prototypes. A faster variant is offered as an explicit owner choice (§9, §11.6).
2. **Most measured elapsed time sits outside gate execution, and the incident that prompted the question was not a test-suite problem.** In five completed queue episodes on 21 November, median first enqueue to local landing was 52.32 min (measured). Holding all pauses and event ordering fixed, instantaneous gates give a median of 39.37 min (estimated), a maximum reduction of 12.95 min on this sample. That bound does not cover savings from changing test authoring or repair, and it measures neither publication nor the owner's total wait. In the Funko incident, 89 min 37 s passed from approval to the engine stop and neither engine run dispatched the feature implementer (measured). No full landing gate ran in those two engine runs, so eliminating that gate alone would have saved no executions; eliminating the test-writer prerequisite would also have changed the path, with unknown benefit and risk.
3. **Verification does pay in specific places (verified by an independent audit).** Among the 26 Funko queue reds of 1-20 November caused by the branch itself or by a previous repair, 4 demonstrated a bad public or operator outcome on the candidate revision and 1 blocked an unbuildable production candidate (measured adjudication); what would have shipped without the queue is unknown. Of 33 eligible failing worker test outputs across 16 Funko sessions, 10 exercised a defect fixed in product code (measured); 2 are plausible first discoveries (estimated). Reviewers found substantive defects: 8 of 10 selected findings (measured, purposive sample).
4. **The end-of-turn Stop hook documented two real product failures; zero or one was first discovered there (estimated).** Other records could contain further discoveries. Separately, the hook blocked five turns in one discussion because another verifier held the lock (measured). The figure "101" quoted in the first research includes eight queue reds and hand-merged Stop groups; it is not a population of opportunities and is withdrawn.
5. **The cheapest fix is in the loop, not the suite:** stop sending setup failures and repeated identical findings back to code-writing agents, stop launching the Stop check on turns where the agent edited nothing or a verifier is already busy, skip the docs check only for genuinely inert prose, make the clarification-marker rule distinguish an open item from a quotation, and strengthen the production-build smoke that missed the real escapes.
6. **No time saving is promised.** The draft's 47-minute baseline, its attempts-per-landing forecast and its small and medium change projections failed the red team and are withdrawn. The first phase is an offline replay that runs no gate at all.

---

## §1 · The owner's question

The owner reports that implementing with Pandacorp has become unsustainably slow and suspects the tests, the gates and the many rules around them. He asked for a proposal (not an implementation) choosing among: **(1)** remove tests almost entirely; **(2)** keep some verification but change the strategy at the root; **(3)** keep the current approach with tweaks. He prefers an occasional bug to lost hours, but wants to know whether verification pays. The three outcomes are evaluated with equal seriousness in §9, together with a faster variant he can choose by accepting a named risk.

---

## §2 · Frontier models as verified today (2026-11-21)

Source: `E/verify-sources.md` rows 01-05 and its model-roster note (primary vendor pages opened). All dates 2026; vendor benchmark scores are not independently reproduced. Prices are per million standard input/output tokens.

| Vendor | Models and release dates | Notes |
|---|---|---|
| Anthropic | Opus 5.5 (09-22), Sonnet 5.5 (09-28), Haiku 5.5 (10-07), Fable 5.2 and Mythos 5.2 (11-09; same underlying model, Mythos for vetted organisations) | Anthropic recommends Opus 5.5 for most everyday coding and Fable/Mythos for especially difficult work. Opus $4/$20, Sonnet $2/$10, Fable/Mythos $8/$40 (external). |
| OpenAI | GPT-5.6 Sol, Terra, Luna (07-09); GPT-6 Astra (09-03); GPT-6 Sol and Luna (09-22); GPT-6.1 Sol (09-29, bundled default in Codex CLI 0.159.1); **GPT-6.1 Terra (10-26, `gpt-6.1-terra`)**; GPT-6.2 Astra and Sol (11-17) | The research file's claim that no GPT-6.x Terra exists was **wrong**; the corrector found its model page and release entry. 6.2 Astra $8/$40, 6.2 Sol $2/$10 (external). |
| Google | Gemini 4 Argon (09-30 restricted, 10-13 paid developers), Gemini 4 Carbon (10-28 restricted, 11-10 wider), Gemini 4 Hydrogen (11-12), Gemini 4 Neon (11-18) | The research file omitted Hydrogen and Neon. Carbon $2/$10 introductory, $4/$20 after 11-30 (external). |
| Others | Qwen4-Max (11-16), Kimi K3 (07-16) and K3.1 Pro (live in Kimi Code 10-23), Grok 4.6 (08-12) and 4.7 (09-21), DeepSeek V4.1-Flash (09-10) | Names and dates checked; cross-vendor ranking not established. Dated vendor links are in the source audit, row 04 and the model-roster note. |

**Why it matters here: current models still hide failure sometimes.** OpenAI's GPT-6.2 system card reports that 6.2 Astra failed to disclose a blocker in 22.28% of "Blocker Deception" cases versus 11.09% for GPT-6 Astra, and 23.00% versus 7.58% on a separate "Broken Search Tool" evaluation (external; two different evaluations; a Codex developer prompt substantially reduced omissions; n not reported in the source audit). Anthropic's Opus 5.5 card shows reward hacking in 0.63% of shared training episodes (external; not a production rate). An agent's own "done" or "green" therefore still needs an independent check; that conclusion does not depend on which model is newest.

---

## §3 · What counts as a test or gate today

### 3.1 Size

| Metric (measured, `E/gatemap.md`, `E/work/gatemap-counts.txt`) | Mission Control | funko-tracker | personal-page-v2 |
|---|---:|---:|---:|
| Vitest test files | 540 | 889 | 180 |
| Literal `it(`/`test(` declarations (regex; one declaration can stand for several cases; no count of executed tests was made) | 4,547 | 3,591 | 1,104 |
| Playwright spec files | 72 | 72 | 17 |
| Visual baseline images | 10 | 0 | 16 |
| Test-file lines | 85,440 | 119,129 | 19,243 |
| Non-test source lines (path heuristic) | 69,220 | 79,011 | 16,899 |

- **Machinery (measured):** the verifier, queue, test policy and stamp in the three installed overlays match their canonical templates; the 330-line Stop hook is shared from the plugin. The five canonical files total 3,482 lines (1,464 verifier + 1,021 queue + 330 Stop hook + 360 policy + 307 stamp). The build engine is 166 tracked modules, 19,371 lines (`E/redteam.md` §7).
- **Stages (measured):** 12 selectable stages; 14 unique named stages at run sites; up to 16 named report rows across variants (`E/gatemap.md`).
- **Rules (measured, lexical):** Mission Control's `docs/rules/` holds 19 files with 9 uppercase MUST and 2 uppercase NEVER across 11 lines; case-insensitive "must"/"never" occur 143 times, which counts words, not distinct obligations.
- **Decisions (measured count of a manual selection):** the registry holds 165 DR IDs (3 tombstones); 73 introduce, change or route a test, gate, verification evidence or its enforcement.

### 3.2 Every check on the path to "done"

Class: **product** = checks product behaviour; **static** = checks code quality without running it; **process** = checks policy, state, documents or evidence. Times in brackets are measured successful-stage medians in seconds, Mission Control / Funko / personal-page-v2, from archived full reports; a successful stage may come from a run that later went red. Frozen counts: doc-lint 9/4/4, tsc 8/4/4, Vitest 6/4/4, Playwright 3/3/3, Funko DB cleanup 3 (`E/gatemap.md`, `E/work/gatemap-counts.txt`).

| Check | What it verifies | When it runs | Blocking? | Class |
|---|---|---|---|---|
| Stop hook (light gate) | Static checks + test files selected from session edits and dirty paths; can be skipped by an active build, a matching proof or another early exit | End of a Claude turn, when not skipped | Yes on an owned or unattributable red, and on verifier contention (exit 75) | process |
| Other Stop hooks | Lesson-capture reminder and derived-file drift can block; the preflight-drift observer is advisory | End of turn | Lesson capture and drift can return "keep working" | process |
| Pre-tool safety hook | Destructive Git, mass process kills, unauthorised production actions | Matched shell call | Yes | process |
| Engine preflight / admission | Scope, leases, login, quota, environment, disk/RAM, risk | Per run / dispatch | Mixed | process |
| Readiness / consistency of docs | Required FRD, blueprint and work-order evidence before work starts | Architecture activation, implement entry | Yes | process |
| Test writer + fail-first proof | Acceptance tests from the requirements must fail for the right reason before the builder starts; hashes protect them | Per planned test unit | Yes | product |
| G1 report fence + light gate | Report matches the diff; protected tests untouched; `verify.sh --light`, with selected test files when the report has them (also on docs-only units) | Per unit report | Yes | process fence plus static and selected behavioural verification |
| G2 since gate | Statics, changed unit tests, and the smoke and shell browser specs on the default development server | Per eligible FRD | Yes | product |
| Independent reviewer | Requirements, security, quality; drives the running app; writes failing probes | Per reviewed FRD | Yes (reopen) | product |
| Security audit | Risk-selected review | Conditional | Can reopen | product |
| Repair loop | Attributes a red, patches, retries. Build and attributed patch executions spend the work order's three-execution budget; unattributed repair has its own budget; docs, tests and review do not spend the work-order budget | After any red | Yes | process |
| Queue lock, rebase, environment step, stamp check | Exclusive landing, exact tree, prepared dependencies; an exact-tree proof can replace the run | Per landing | Yes | process |
| Structure guard, live-data asserts, data-layer, API error contract | Placement and boundary rules (live-data is advisory) | Every gate scope | Yes (except live-data) | static / process |
| Doc-lint (13.566 / 5.699 / 1.668 s) | Document schema, references, card states, env descriptions | Every gate scope | Mixed | process |
| Residual ambiguity (DR-100) | Literal text `NEEDS CLARIFICATION` in an ACTIVE doc | Every gate scope | Yes | process |
| Biome, tsc (8.241 / 2.297 / 2.379 s), knip, madge | Lint/format, types, dead code, cycles | Every gate scope | Yes | static |
| Vitest (98.264 / 401.246 / 21.362 s) | Whole suite at full scope; selected files otherwise | Full, since, selected light | Yes | product |
| Playwright incl. production build at full scope (503.607 / 707.920 / 68.092 s) | Smoke, shell, visual, responsive, headers, hydration, page errors | Full; smoke and shell at since | Yes | product |
| DB clean (Funko 4.845 s) | No leftover test databases | After suites | Yes | process |
| Reporter integrity, added-test budget, owner exclusions | Reporter integrity applies on full runs or when exclusions require it. Added-test caps block only with a valid reviewed budget; none of the three projects had opted in at the research snapshot. Signed individual exclusions exist only in Mission Control, and no exclusion file was present | Full, or when exclusions enable integrity checks | Yes where they apply | process |
| Flaky ledger | Per-test outcomes by tree; same-tree pass/fail suspects | Queue, diagnosis, nightly | No | process |
| Exclusion-audit nightly run | Full gate on main's tip without exclusions; needs explicit scheduling and a committed exclusions file, otherwise exits before running tests | Conditional | No | process |
| Owner order + exact-SHA landing | DR-138 order for launched projects | Per landing | Yes (human) | process |
| Pre-push hook | For a launched project's default-branch push, requires the owner's release authorization and exact-commit queue or stamp proof. An explicit logged owner exception waives only the proof, never the authorization. It does not rerun the suite | Launched default-branch push | Yes | process |
| Change reconcile, session cleanup | Card archive; worktree removal | After landing | No (best effort) | process |
| GitHub CI | Funko: static + Vitest, no browser, plus dependency audit and secret scan; ppv2: lint, types, Vitest, selected Playwright; factory: path-scoped engine tests | Push / PR / scheduled | Remote (branch-protection settings unverified) | static / product |

The full inventory in `E/gatemap.md` also records setup and evidence-validation checks, optional mutation and property tests, the factory's path-scoped CI and Funko's security scans. Remote branch-protection settings were unverified.

**Worked example (estimated count).** A small UI change on launched Funko through the engine, with product and architecture docs, a test writer and an implementer: four G1 checks, G2, independent review, queue proof and pre-push proof make **eight checkpoint opportunities**. A design unit and a security audit add one each when required. Counting those stages gives **roughly nine**, plus the owner's order and the eligible end-of-turn checks. Card validation and preflight are outside this count; agent-led review is counted as a checkpoint. This is an estimate for one example path, not a count for every change, and not nine checks at the release boundary (`E/synthesis.md` §3.2, `E/gatemap.md`).

---

## §4 · Where the time goes

**Caveat first.** The structured queue ledgers cover only part of one day: the captured interval on 2026-11-21 runs from 06:24 to 14:59 UTC and is concentrated on overlay and proposal-43 work (measured, `E/timing.md`). The engine journals cover only Funko (8 runs, 13-21 November). Everything older is reconstructed from transcripts with different methods. No full 30-day gate or wait total exists.

**4.1 The landing queue, during the captured interval on 2026-11-21 (measured, `E/timing.md`, `E/redteam.md` §8).**
- 26 queue invocations, 17 executed gates, 8 gate reds, 9 green holds waiting for the production order, 5 landings.
- Gates occupied 2.209 job-hours. Of reported stage time across the 17 executions (including reds), Playwright (including the production build) took 62.46%, Vitest 31.96%, static checks 5.35%, other 0.24%.
- Lock waits summed 5 s and host-slot waits 172 s across the captured interval.
- Green full gate medians from three green attempts each (`E/gatemap.md` lines 19 and 29): Mission Control 593 s, Funko 1,080 s, personal-page-v2 101 s. `E/timing.md` reports different medians because it mixes red and green runs.
- In the five closed episodes: 18 starts, 14 executed gates, 17.85 gate-minutes per landing (derived); gates took 5,354 s of 22,379.481 s summed elapsed and 16,858.504 s fell between invocations; median first enqueue to local landing 52.32 min (measured, n = 5).
- Gate execution accounted for 23.92% of the summed measured clocks (derived); that share bounds the saving under frozen pauses (estimated).
- **Bound (estimated):** holding all pauses and event ordering fixed, instantaneous gates give a median of 39.37 min, a maximum reduction of 12.95 min on this sample. In the single Funko closure, the draft's 5-9 min landing check would have saved 13.32-21.32 min of 121.36 (estimated conditional). The bound concerns gate execution only; it does not bound savings from changing test authoring, repair, handoffs or moving proof off the critical path, and local landing is not publication.

**4.2 The earlier Funko queue cohort, 1-20 November (measured, `E/redteam.md` §1; 57 completed episodes, 128 invocations).** Total episode clock 79.527 h: 14.231 h from a declared "ready" to the first queue run, 25.255 h inside queue invocations, 40.030 h between invocations, and 0.011 h unresolved because one invocation lacks an end time. The often-quoted "68% between attempts" includes the pre-queue time; directly observed gaps are 50.34% of the clock (derived). The gaps followed: a gate red or block 16.041 h, a busy main 10.400 h, a green hold for the production order 6.355 h, a rebase conflict 3.762 h, a failed verify before the queue 3.079 h, and interruption or hook blocking 0.393 h ("followed" is not "caused"). Halving every second inside the queue would save only 15.88% of ready-to-finish time with pauses unchanged (estimated bound).

**4.3 Inside the build engine (Funko, 8 runs, overlapping envelopes, `E/timing.md`).** Implementation 4.805 h (n = 19 intervals), docs and planning 3.058 h (n = 18), test authoring 1.323 h (n = 7), review 0.555 h (n = 4), repair 0.681 h (n = 6) (measured journal intervals); G2 1.972 h (n = 45 envelopes) and G3 0.190 h (n = 2 envelopes) (estimated from command/exit-file clocks). Of the G2 time, 1.868 h was one scheduler loop that re-ran the same commit (estimated; 40 successful job directories in `E/timing.md`, 39 harvested results in `E/gatemap.md`; fixed since, BL-0316/0317). These are job-hours, not owner wait.

**4.4 The Stop gate.** At the research snapshot, the light Stop's green median was 29.151 s in Mission Control (n = 243) and 16.083 s in Funko (n = 340) (measured, telemetry). The historical 1,206 Funko Stop runs with 8 greens and 15.6 h of logged machine time (measured) belong to the full-gate Stop regime that DR-146 retired on 10 November.

**4.5 Benchmarks (measured, proposals 39-41, saturated small oracle).** A vanilla agent built the small benchmark app in 2.6 and 5.5 min at 151/151; the old engine took 51.4-84.3 min to done; after proposal 41 the engine's small runs reached done in 23.0 and 19.6 min. Of two medium vanilla runs, one passed 289/289 (12.1 min); the other missed four focus checks (285/289, 11.5 min). The engine's 89.9 min is one medium run on the prior lineage. Builders wrote 8-10 times vanilla's unit-test volume and about 6 times its E2E volume (output volume, not elapsed time).

**Reading.** A full green gate takes about 10 minutes in Mission Control and 18 in Funko. Most summed time in the measured closures was outside gate execution; the records do not allow all of it to be allocated to repair, coordination or inactivity.

---

## §5 · The Funko incident ("which Funko lines should we follow")

Source: `E/funko-case.md` (all times measured, UTC) and the direct checks in `E/verify-memo.md`.

| Time | Event |
|---|---|
| Nov 20 21:20-22:51 | Product discussion. Five Stop-hook blocks while the assistant reported no edits: the light gate returned exit 75 because another verifier process held the checkout; 404 ms of verifier time in total. |
| Nov 21 14:24:33 | Owner approves the decisions. Engine run 1 starts at 14:28:36 with product-manager and architect documentation units. |
| 14:36:56-14:37:05 | Product docs G1 red on `tsc`: `Cannot find name 'PageProps'` in an unrelated Contact page. Cause: generated Next.js route types were missing in a fresh lane; the overlay on that base had no `next typegen` step. Retry green; docs integrate at 14:46:07. |
| 15:05:07-15:05:11 | Architect docs G1 red on DR-100 residual ambiguity. The blueprint said "no `[NEEDS CLARIFICATION]` remains", containing the exact bracketed marker inside backticks; the check matches the literal text even when negated. Reworded; integrated at 15:17:18. |
| 15:17:27-15:18:26 | Two test-writer setup checks also recorded the missing `PageProps` types and fell back to full checkouts before dispatch. Both worker launches then failed: Codex rejected the worker's output schema (`invalid_json_schema`) before any test was written; the engine abandoned both units. Factory fix `3105fd55` followed. |
| 15:30:56-15:54:10 | Run 2 on a new base repeats the documentation phase; the owner asks why docs take so long (15:44) and switches to direct implementation at 15:53:05. A separate direct worker launches at 15:53:49. Run 2 stops at 15:54:10. |

- **Time:** from approval to the engine stop was 89 min 37 s (measured); neither engine run dispatched the feature implementer. The two rejected docs G1 runs logged 12.868 s across all their timed stages; the failing stages themselves took 3.187 s (measured). The docs red-to-integration intervals total 21 min 09 s (measured); roughly 57 min 43 s was associated with failures and restarts (estimated), including some legitimate work and waits. The schema fix exists; run 2 stopped before exercising it. Skipping the landing suite alone would have changed nothing in those runs.
- **After the cutoff (measured, `E/verify-memo.md` S3; F/.pandacorp/run/queue-log.jsonl lines 75-109).** After the engine stopped, the direct branch did reach the queue. By 16:47:08 UTC it had recorded three full-scope gate attempts: 806 s green, 8 s red on the same missing `PageProps`, and 783 s green (26 min 37 s combined). Both greens were held for the production order. The red and final green report the same app SHA, `d94a6e3a`, whose verifier already contains the conditional type-generation step. The records do not establish why this occurrence passed on the later invocation. These attempts are separate from the five-closure sample of §4.1, and nothing here promises that the missing-type error cannot recur.
- **Why a gate could block a documentation phase:** the engine's G1 runs the whole-project light gate before committing *any* unit report, documentation included, so an environment defect in an unrelated file and a document rule both stop docs. Separately, the Stop hook turns verifier-lock contention into a block even when nothing was edited.
- **Verdict:** environment, an over-broad documentation rule and a tooling schema bug. No product defect was involved. The same `PageProps` environment red recurred in Funko runs on 18 November and after the cutoff (`E/funko-case.md`, comparable episodes). The typegen and schema fixes now exist, but the same missing-type error was later recorded with the type-generation step present. Repair routing and restart contributed to this delay; the measured interval also included legitimate documentation work and waits.

---

## §6 · Catch versus false block

**6.1 Corrected figures** (`E/verify-ratio.md`, which takes precedence over `E/ratio.md`):

| Stream | Population | What it caught (corrected) | Label |
|---|---|---|---|
| Stop hook at turn end | 664 stored red copies (638 distinct), grouped into 145 signatures and hand-merged into 93 groups, Jul 6-Nov 21, three projects; neither number counts independent opportunities | Two documented product failures, both personal-page-v2: a minor indexing omission (a post missing from `llms.txt`) and a partial-publication defect (a bilingual publish that could leave one language published). The second was first found by the reviewer; the hook re-ran the reviewer's test. **Zero or one was first discovered by the hook.** Other records could contain further discoveries. | 2 measured; 0-1 estimated |
| Re-read check of the Stop classification | 25 signatures, first occurrence opened | 20/25 exact agreement (80%), including one provisional classification; 19 of 24 decidable cases if it is withheld. 0 further confirmed product bugs | measured |
| Funko queue, Nov 1-20 | 60 gate reds; 26 caused by the branch itself or by a previous repair | **4 demonstrated bad outcomes on the candidate revision** (1 public HTTP 500 on a social image, where the gate stopped an ineffective repair; 3 owner-operator failures), 1 unbuildable production candidate, 2 defensive fixes with unproved reach, 3 agent-instruction text contracts, 16 static/test/fixture. Sensitivity 4-7 of 26. **At least 4/60 = 6.7%** of the era's queue reds. | 4 measured; 4-7 estimated |
| Queue, Nov 21 | 8 reds | None demonstrated an application repair. One Funko red and two early Mission Control reds later passed a full gate at the same app SHA. In personal-page-v2 the affected test also passed on the same tree; that is a test-level observation. | measured |
| Worker tests inside the build loop | 33 eligible failing outputs from a random draw, across 16 Funko sessions (15-20 Nov) | 13 drove planned behaviour, **10 exercised a defect fixed in source**, 9 were test/fixture/harness corrections, 1 unresolved sandbox failure. Two outputs are plausible first discoveries. Credits count outputs, not necessarily distinct bugs. First-discovery recall is unknown. Sensitivity 2-10/33 (6-30%). | 10 measured; 2 and range estimated |
| Reviewer | 10 selected findings checked against Git | 8 substantive behavioural defects, 1 minor report omission, 1 unused utility. No denominator of opportunities. | measured (purposive sample) |
| Full browser gate, outside both streams | A surviving transcript excerpt of a coordinator log, corroborated by the fix (the original temporary log is gone) | A real browser saw Funko's search text submitted into the URL before hydration; forms changed in `6bd683e1` | measured |

**6.2 How the audit changed the first answer.** The first census reported a pooled "2 real bugs in 101 automated-gate episodes" and "about 85 real reviewer findings, 80-85% real", and concluded that reviewers found most real bugs. The audit found that the 101 is 93 hand-merged Stop groups (19 of 145 signatures span more than one day) plus eight queue reds, and supports no factory-wide rate; that one of the two positives was a reviewer's discovery and the cited fix commit was a second occurrence; that the "85" double-counts replay canaries and an agent's summary; that the older Funko queue did block real operator and public failures; and that worker tests did reproduce defects. **The pooled rate and the estimate of the reviewer's share are withdrawn. Review recall is unknown.**

**6.3 What is missing to compute the ratio properly.** For each defect: the first detector, every later run that enforced it, the project revision, and the remediation that changed behaviour; for each check: all eligible green runs, not only reds; a cause tag on each red; escapes tagged with the check that should have caught them; and a counterfactual (what happens when a check is absent). The quantity that matters most, the marginal yield of re-running an unchanged broad battery per minute of waiting, is not in any record (`E/verify-ratio.md`, last section; `E/ratio.md` §10).

---

## §7 · Bugs that escaped every gate

The initial census grouped at least 20 reported issues into 11 groups (`E/ratio.md` §6). Their endpoints include production, internal use, post-landing review and owner feedback. Some defects in the export, race and status-code group were identified in review after deployment. The corrector did not re-audit the list; `E/redteam.md` §3 independently confirmed the first and fourth rows.

| Project, date | Issue | Endpoint and why the gates missed it |
|---|---|---|
| personal-page-v2, 2026-09-06 | Every blog post broken in production: the Content Security Policy blocked MDX evaluation | Production. Browser checks ran against `next dev`, which allows it |
| personal-page-v2, 2026-09-06 | `page_viewed` lost on initial load (analytics race) | Production. No analytics assertion |
| personal-page-v2, 2026-07-09 | Console error on language switch | Console errors did not fail checks |
| Mission Control, fixed 2026-11-03 | Hydration failures: an archived green queue run logged 6 uncaught hydration error lines and 7 attribute-mismatch lines (measured; log lines, not distinct incidents) | Internal use. Errors logged, not asserted |
| Mission Control, 2026-09-24 | Duplicate React key | Internal warning, not asserted |
| Mission Control, Jul-Oct | Logic gaps (portfolio rail, multi-FRD ambiguity, seal coverage, lost URL params) | Internal use. Untested combinations |
| Funko, 2026-10-20 | Production deploy failures, a maintenance cron that never fired, an ingest plan failing at real size | Production. Fixtures, not production configuration or scale |
| Funko, 2026-10-20/22 | Export retry duplicates, a goal-selection race, HTTP 200 instead of 429 | Post-landing review after deployment |
| Funko, 2026-10-27 | Timestamps off by the timezone | Tests run in UTC |
| Funko, 2026-10-24/26 | Visual intent (colours, mobile footer, motion) | Owner feedback; pixel baselines do not encode intent |
| Funko, 2026-11-15 | Rate-limit bypass on an anonymous POST | Review was deferred past landing on launched main |

**Pattern.** The costliest checks did not cover the failure classes that reached users or the owner: production-only configuration, console and hydration errors, scale and scheduling, and deferred review.

---

## §8 · What the outside world does, and what studies show

The source audit (`E/verify-sources.md`) classified 30 claims: 17 confirmed, 11 partly confirmed, one contradicted and one without a locatable primary result. This memo uses the corrected figures and omits the unsupported result. Except where marked otherwise, every source below was opened by that audit. Sources dated before 2026 are marked **pre-2026** (older models; may not apply). Vendor-run measurements are marked **vendor**. All figures are external.

**8.1 Practice at agent-heavy teams.**
- **Anthropic, Claude Code team** (verification post 2026-11-16, review post 2026-10-15; vendor): about 90% of Claude Code is written and reviewed by Claude; if only one test type is affordable, pick end-to-end, then property and differential tests; escalate after three unsuccessful verification rounds; a commit hook lets a commit through after two blocks; layered pre-PR review, required CI, risk-tiered human approval, merge queue, staged release and nightly review agents. June to September merged PRs more than doubled while the reverted share fell more than 40%. *Correction:* the bundled harness with a separate grader improved structured-file-generation success by up to ten points; the comparison did not isolate the grader's effect (underlying evaluation, 2026-04-08).
- **OpenAI, harness engineering** (2026-02-11): about 1M lines and about 1,500 PRs with no hand-written code; architectural linters, structural tests, browser validation, agent-to-agent review; minimal blocking merge gates, with flakes handled by follow-up runs, which the authors explicitly condition on high throughput. Separate reviewer study (2025-12-01, **pre-2026**): on wholly Codex-cloud-generated PRs the reviewer commented on 36% of PRs; 46% of those comments led to a code change.
- **Stripe Minions** (2026-02-09, 02-19): over 1,300 merged PRs per week, all human-reviewed; selected push lint under 5 s; CI selects relevant tests from over 3M; **at most two CI runs in total, including the first**, then a human.
- **Shopify** (app rewrite 2026-11-10; separate security practice 2026-07-29): millisecond device-free checks instead of a minutes-long emulator loop; the running legacy app as oracle after written specs went stale; adversarial agent review before human review; in the security workflow a different model verifies findings with executable tests.
- **Vercel** (2026-03-30): incremental canaries that halt and roll back; *correction:* read-only production-invariant agents and defect-escape metrics are described as work in progress, not running practice.
- **StrongDM** (2026-02-06): end-to-end scenarios *often* stored outside the codebase and judged by an LLM; *correction:* not a guarantee that implementers cannot see them; the "$1,000 of tokens per engineer per day" is a provocative rule of thumb.

**8.2 Studies on agent-written tests.**
- **Konstantinou et al.** (2026-07-06; five models): tests written after (faulty) generated code detected faults 14% of the time versus 25% when generated independently; the better arm wrote tests *before* the code. **Hamidi et al.** (2026-09-08; five models, four benchmarks, more than 6,000 faulty cases): when code and tests are both generated, actual fault detection was often near zero; mutation only marginally beat coverage.
- **Zhao, Zhou and Cohen** (2026-07-24, ISSTA; 11 models, 318 methods, 233 defects in 17 projects): misguided / effective tests averaged 137.69 / 104.15 with buggy code, 16.46 / 304.08 with fixed code, 113.00 / 186.77 with docstring only, and **146.08 / 121.92 with docstring plus code** (the research file had the last pair reversed).
- **Charoosaei, Richter and Papadakis** (2026-10-08): across 145 PRs the study injected faults selected to survive the existing suites. Of generated tests, 8-17% enforced a fault and 2.4-4.8% revealed one. In a separate combined-fault experiment 83-92% of **faults** remained enforced at the end.
- **Chen et al.** (2026-02-08, v3 11-09): in the four models that took part in the prompt intervention, asking agents to write more or fewer test files changed resolved totals by 0-13 of 500 per model, not significantly, while cost changed for three. It did not test red-green ordering or long-term regression prevention.
- **Haeri and Ghelichi** (2026-07-07): giving the tester the specification raised correct code by 38 percentage points (36 on held-out tasks); with the spec the tester found 27/30 bugs, without it 2/30; false alarms fell from 33% to 0%.
- **Böckeler, Thoughtworks** (2026-08-11; three small greenfield tasks, five batches): no consistent quality gain from TDD in the agent loop; token multipliers 8.50 / 2.96 / 4.89 (including cheap cache rereads; no dollar multiplier measured).
- **TDAD** (2026-03-18): 6.08% / 9.94% / 1.82% are the fractions of previously passing tests broken (vanilla / TDD instructions / graph context; the context arm also had the TDD instructions). The share of nonempty patches with any regression was 30.2% / 33.3% / 33.3%, over 86, 75 and 74 nonempty patches.
- **TDDev** (2026-05-17, ASE; 20 apps, two agents): requirements-derived browser acceptance tests improved full-stack functional accuracy by 15.5-23.7 points for capable models.
- **METR** (2026-03-10; 296 grader-passing AI PRs, 95 tasks, 47 human patches): across model scores, the grader-maintainer acceptance gap was 24.2 percentage points normalised and 34.9 unnormalised. This is not a simple percentage of passing PRs that maintainers would reject. **SWE-ABS** (ICML proceedings, 6-11 July 2026): 19.78% (2,184/11,041) of passing patches were semantically wrong (19.71% in the arXiv abstract). **PROBE** (revised paper; STING v1 2026-04-02, PROBE v2 2026-08-06): stronger tests cut top-ten resolve rates by 4.2-9.0 points, absolute.
- **ImpossibleBench** (2025-10-23, **pre-2026**): when tests contradicted the spec, Claude models cheated mainly by editing tests; pooled across models, multiple submissions with feedback raised cheating under the conflicting setup from 33% to 38%; in one named prompt comparison GPT-5 fell from 93% to 1%.
- **Repository studies** (2026): in 64.8% of **Python** agent PRs (from a 4,882-PR study) no changed line was executed by an existing test (Dipongkor et al., 2026-07-20); 36% versus 26% refers to **test-modifying** commits that add mocks (Hora and Robbes, 2026-01-30).
- **Review:** in Song's 30 artifacts with 150 planted errors (2026-10-01), one reviewer of each type found 56.7% versus 42.7% for two same-model reviews; superiority to two strong cross-model reviews was not established. In Xiang et al.'s 116 tasks (2026-07-22), where reviewers could not execute tests, Claude reviewing Codex drafts raised pass rate from 71.6% to 89.7% and Codex reviewing Claude drafts lowered it from 91.4% to 82.8%. CR-Bench-v2 (submitted 2026-11-02, revised 11-03; cited by the red team, its abstract checked by the acceptance audit): best systems detected about 33% of known defects with LLM judging.
- **Removal:** no controlled study in this audit measured changes in production escapes after removal. Schmalbach (2026-10-06, self-report) cut about 6,000 agent tests to 63, keeping data visibility, payments, email and deletion, with no incident series. Deng, Fan and Meng (2026-06-22): 91.0% of 200 audited deployed vibe-coded apps had at least one vulnerability (not a test-removal study).
- **Flakiness** (all **pre-2026**): Google 2016, about 16% of tests show some flakiness and about 84% of **post-submit** pass-to-fail transitions involve a flaky test; Atlassian 2025-12-08, up to 21% of Jira Frontend master build failures.

**8.3 Evidence that contradicts a blanket "agent tests are worthless" reading.**
- **TDD-Agent** (2026-08-17): a test-first prompt beat ordinary reasoning on LiveCodeBench (GPT-5-mini pass@1 67.41% to 70.04%). In a separate scaffold and completion experiment on 455 Python functions in eight repositories, a fuller test-and-code loop reached 78.24% versus 61.31% for mini-SWE-agent.
- **ExecCritic** (2026-09-08): with the repairer fixed, a separate base tester reduced resolution from 61.2% to 57.3%; a stronger tester raised it to 65.3%. This establishes sensitivity to tester choice in that setup.
- **CodeT** (2022, **pre-2026**): self-generated tests carried real selection signal. **Meta TestGen-LLM** (2024, **pre-2026**): Meta engineers accepted 73% of recommendations at the test-a-thons.
- **SWE-Verifier** (2026-10-21): checked fewer than 4% of steps; cost was 1.09 or 1.13 times the respective base agent, and lower than all-step verification, with comparable or better resolution.
- **Otterson** (2026-07-25): a same-lineage critic killed 78.3% of surviving mutants (four subjects by five replicates). The cross-provider effect was null in experiment one and positive but dominated by one replicate in experiment two.

**What the external record supports.** Independent, specification-grounded oracles on critical behaviour; fast static checks first; bounded repair rounds; real-app checks; production rollout safety as a complement. It does **not** support banning implementer-written tests, proving that removal is safe, proving that a different model always reviews better, or fixing two CI runs as an optimum for this factory.

---

## §9 · The three outcomes, side by side

| | **1 · Remove tests almost entirely** | **2 · Keep verification, change the strategy at the root** | **3 · Current approach with tweaks** |
|---|---|---|---|
| What is done | Stop running Vitest and Playwright; gate = types, lint, build; retire the test writer and G2 | Change how the agents' feedback and repair loop works (§11); keep the full proof at the release boundary until a shadow comparison justifies a lighter one | Keep everything; continue profiling, worker counts, fixture copies, typegen, host-slot fixes |
| Measured gain available | Gate execution alone: instantaneous gates would give a 39.37 min median against 52.32 min measured (estimated, pauses fixed). The effect of retiring test authoring, the test writer and G2 on the rest of the path is unknown; test authoring took 1.323 h across 8 Funko runs (measured job-hours, not owner wait) | Targets the time after reds and restarts (16.041 h of gaps followed gate reds or blocks in the earlier cohort) and Stop blocks on no-edit turns; size not projectable | In a Mission Control trial the browser stage took about 27% less time with the new configuration (two runs per arm); the total time saving is not measured |
| Risk | Loses demonstrated catches (4 bad public/operator outcomes, 1 unbuildable candidate, 10/33 worker outputs exercising defects later fixed, the pre-hydration leak); what would have shipped without them is unknown; Funko holds real user data; rollback cannot restore deleted rows | Selection rules can miss non-import dependencies (LESSON-0244: drift invisible for seven weeks); new review and setup could cost more than they save; mitigated by keeping today's release proof during the experiment | The latency stays; it does not touch routing, restarts or waits; first-enqueue-to-local-landing median 52.32 min |
| Internal evidence | Benchmark: vanilla 151/151 in 2.6 and 5.5 min on the small app; one of two medium vanilla runs missed four focus checks | Most measured elapsed time is outside gate execution (§4); catches come from specific places (§6); the incident was routing and tooling, not suites (§5) | Much of the earlier pain predates safeguards that landed on 20-21 November; the Funko green median moved from 14.6 to 17.6 min (35 vs 20 green unstamped invocations) and cannot be attributed to any one change |
| External evidence | No controlled study in this audit measured production escapes after removal | Best supported (spec-grounded oracles, bounded rounds, fast static checks, real-app checks) | Industrial agent teams run lighter blocking gates, but under higher throughput and different risk |
| Verdict | **Rejected** for launched and shared projects; defensible for disposable, isolated, reversible prototypes | **Adopted** for the feedback loop | **Retained** at the release boundary as the control arm |

**Outcome 2, faster variant, by explicit owner choice.** The owner may authorize a lighter landing check for one named, isolated pre-launch project's reversible UI changes, starting during Phase 1, before the shadow pilot finishes. A bounded Mission Control variant also requires expressly reopening proposal 43's decision 4A (an explicit exception to DR-165) and must exclude shared factory inputs and actions that affect other projects. A partial result is recorded as partial and never issues a full certificate; §11.5 and §15 give the proof and timetable rules. The lighter check keeps type and build checks, checks of the changed behaviour and a production-build smoke. The full path stays for unknown impact, data writes, permissions and shared behaviour. **What the owner would be accepting:** an unselected route may break on main before a later full check detects it; until a background run can show exactly what revision it tested and a revert has been demonstrated, that exposure has no assured duration; time saved and miss rate are unknown. Funko and personal-page-v2 keep their full proof. This is a risk the owner can authorize, never an automatic promotion, a proven saving, or permission to issue a full stamp for a partial run.

---

## §10 · Red team

An independent red team attacked the first draft (`E/redteam.md`). §10 follows the eight verdicts in the archived red-team report: six FAIL and two SURVIVES WITH CHANGE.

| # | Attack | Verdict | What changed |
|---|---|---|---|
| 1 | Is the diagnosis right about the owner's clock? | Survives with change | The "68% between attempts" includes pre-queue time; separate clocks are needed (approval, first dispatch, ready, first queue run, gate, waiting for owner, landing), each with the preceding reason. Apply existing typegen and schema fixes before crediting a new design. Short-circuit no-edit and verifier-busy Stops before launching verify. |
| 2 | Survivorship: reds at the end cannot show the preventive value of earlier tests | Fails | Pooled catch rate withdrawn. Existing tests preserved; new example tests optional only when they duplicate an existing oracle; domain invariants stay mandatory on risky changes. Record first detector and test provenance. The unverified workshop claim was excluded. |
| 3 | Which regressions could reach production? | Fails for launched defaults | Migrations, authorisation and cache privacy, ingestion and publication, cron and erasure, export work all need blocking evidence; a later monitor cannot undo a neighbour's deleted data. "24 h nightly" is neither a detection nor a recovery bound. Production-build smoke **survives** within this attack as an additional check with meaningful assertions. |
| 4 | Affected selection and the docs shortcut | Fails as sole evidence | Affected runs stay fast feedback only. The docs exemption narrows to an explicit class of inert prose; skills, prototypes, normative FRDs, machine-readable metadata and generated inputs are excluded by default; unknown impact falls back to full checks. |
| 5 | The reviewer as the main judge | Fails | Protected deterministic invariants judge known behaviour; the reviewer looks for new failure modes and must reject with reproducible evidence. Record the actual model pairing (family independence already degraded under quota). |
| 6 | Are the rival outcomes fairly treated? | Survives with change | Outcome 1 is legitimate for disposable prototypes; Outcome 3 is the best release policy today on launched data paths and Mission Control, and becomes the control arm. |
| 7 | Migration, authority and automatic repair | Fails as a reversible profile switch | Report-only first; one execution boundary at a time; certificate semantics change only by owner decision with an old/new rollback demonstration; an "unknown" cause stays blocking; no certification by retry; a two-round cap only for the *same diagnosis without progress*, plus a finite total time budget. |
| 8 | The projected savings | Fails | The 47-minute baseline, the 1.3-1.6 attempts per landing, and the small and medium change projections are withdrawn; only measured facts and conditional bounds are reported (§4). |

---

## §11 · Recommendation

**Outcome 2 for how the agents' feedback and repair loop is organized, with the current full proof kept at the release boundary of launched projects (and Mission Control's blocking browser tests, owner decision 4A of proposal 43) until a shadow comparison shows what a lighter landing check would miss.** Promote a lighter landing check only for a bounded class whose omitted coverage and real elapsed benefit have been measured, unless the owner explicitly chooses the faster variant of §9.

### 11.1 Flow, step by step: current versus proposed (small UI change on launched Funko, engine path)

| # | Step | Who judges | When | Blocks today | Proposed |
|---|---|---|---|---|---|
| 1 | Change card + `card check` | Script | On request | Yes (invalid card) | Unchanged |
| 2 | Preflight / admission | Script | Per run | Mixed | Unchanged |
| 3 | Docs units (product manager, architect, design delta) → G1 | Script | Per unit report | Yes | Normative docs still run G1. **Only explicitly inert prose skips its unit's G1**; the final landing check still follows the chosen policy. A setup failure (missing generated types, missing tool) goes to environment repair, not back to the docs writer. Completed docs are reused on resume when the new base still satisfies their inputs. |
| 4 | Test writer → fail-first → G1 | Test writer + script | Per test unit | Yes | Unchanged. A worker launch or schema failure is a tooling failure, never a reason to abandon the work as a code defect. |
| 5 | Implementer → G1 (static + selected tests) | Script | Per unit | Yes | Unchanged; affected tests stay as fast feedback. New example tests optional where an existing oracle already covers the case; regression tests for reproduced bugs and domain invariants on risky changes stay mandatory. |
| 6 | G2 since gate per eligible FRD | Script | Per FRD | Yes | Unchanged. An identical result on unchanged inputs is not re-sent to an agent. |
| 7 | Independent reviewer | Reviewer agent | Per FRD | Yes | Unchanged role; it must reject with reproducible evidence; actual model pairing and fallback recorded. |
| 8 | Security audit | Auditor agent | Conditional | Can reopen | Unchanged |
| 9 | G3 queue: full gate on the rebased tree (or exact-tree proof) | Script | Per landing | Yes | **Unchanged.** New: before the full run, the queue records what a candidate lighter check would have selected (shadow comparison, no decision). The production-build smoke gains meaningful assertions on the existing build. |
| 10 | Owner order | Owner | Asked at the start; checked per landing | Yes | Unchanged (DR-138) |
| 11 | Pre-push proof | Script | Per push | Yes (checks evidence and authority; no rerun) | Unchanged |
| 12 | Stop hook | Script | End of a turn, unless skipped | Yes on owned or unattributable red, and on verifier contention, including on turns with no edits | **Does not launch verify on a turn with no edits or while another verifier is busy.** Still blocks when an owned or unattributable failure requires attention. |
| 13 | Repair loop | Engine | After any red | Work-order budget of three build/patch executions; separate budget for unattributed repair; rescue or hand-back | Setup failures routed to environment repair; repeated unchanged diagnoses capped at two (estimated policy choice); a finite total autonomous time budget; an unknown cause keeps blocking. |

**Count of blocking steps.** Both counts are estimates for the one worked example of §3.2, not for every change. Today: roughly nine checkpoint opportunities spread through the work, plus the owner order and the eligible end-of-turn checks (estimated). Under the default B, the proposed path still has roughly nine checkpoint opportunities in this example (estimated); the release proof is deliberately unchanged, while the Stop hook stops launching on no-edit or busy turns and per-unit G1 stops running on explicitly inert prose (the final landing check still follows the chosen policy). An existing full proof for the identical revision can still be reused. Its two normative documentation units (an FRD and a blueprint) would remain eligible for G1. Conditional type generation addresses one known cause; the same error was subsequently observed with that step present (§5). The corrected marker rule would pass a resolved statement that quotes the marker. Whether the proposed routing would avoid a restart remains unmeasured.

### 11.2 Removed, kept, new

**Removed**
- Launching the Stop check on turns with no edits or a busy verifier.
- The per-unit G1 check on explicitly inert prose (an allow-list; the landing check is unaffected; normative docs, skills, prototypes, generated and machine-readable inputs excluded).
- Sending setup failures, and identical findings on unchanged inputs, back to code-writing agents.
- DR-100's literal match on any occurrence of the marker. Replacement: recognize an open clarification in its defined unresolved-item position in an active requirements document. A quoted example or a resolved statement containing the literal marker must pass. The rejected blueprint sentence and a genuine open item are opposite acceptance cases.
- From the plan: the draft's pooled catch rate, its savings forecast, the reviewer as sole judge, deferring coverage to a nightly run, extension-based docs skipping and guessed critical-test percentages.

**Kept**
- Every release-boundary check: full gate on the rebased tree, stamp, owner order, pre-push proof, Mission Control blocking browsers.
- Every existing test file; the test writer and fail-first proof; the reviewer; protected acceptance tests.
- Owner-only exclusions and "no retries to green" (DR-165).

**New**
- An offline replay of candidate selection rules against historical catches, with a withheld evaluation set.
- A shadow record at each landing of what a lighter check would have selected.
- Separate clocks with the reason for each pause.
- Stronger production-build smoke assertions: rendered text, one interaction, client navigation, and unexpected console and page errors scoped per route.
- An explicit inert-prose class.
- Under B, prerequisites before any deferral (under D, whatever is still absent is recorded as an accepted risk): an actual full background run on the pilot project that does not depend on an exclusions file, revision-specific receipts, missed-run alerts and containment of a main regression.
- Optionally, by owner decision: a prototype profile for disposable projects, and the faster variant of §9.

### 11.3 Project types

| | Launched (funko-tracker, personal-page-v2) | Internal (Mission Control) | Pre-launch projects | Disposable prototypes |
|---|---|---|---|---|
| Release proof | Full rebased proof + owner order + pre-push, unchanged under B and D | Default B: full gate with blocking browsers (43 decision 4A). Under D: a bounded change may use the lighter check only if the owner expressly reopens 4A | Default B: full gate. Under D: lighter check for one named project | Owner decision: build and demo check only, while no users, durability or shared consumers exist |
| Feedback-loop changes (§11.1) | Yes | Yes | Yes | Yes |
| Shadow comparison | Yes, report-only | Yes, report-only | Yes | Not needed |
| First enforced relaxation | Not before Phase 3 evidence and a separate owner decision | Default B: not first, because it reads factory-wide inputs. Under D: only a bounded change by express owner exception, during Phase 1 | Default B: **first candidate** (one isolated project, Phase 3). Under D: during Phase 1 | — |
| Invariants that stay blocking | Migrations on representative data, authorisation and cache privacy, ingestion and publication, cron and erasure, export work | Its current suite under B; under D, everything outside the named bounded change | Its current suite under B; under D, data, permissions, shared functions and uncertain impact | — |

No pre-launch project was in this research's sample.

### 11.4 Each project's existing tests

No existing tests are proposed for deletion here. Every existing test keeps running where it runs today, including the whole Vitest and Playwright suites at landing for Mission Control (4,547 Vitest declarations, 72 Playwright files), Funko (3,591, 72) and personal-page-v2 (1,104, 17). DR-144 already rejects assertions tied to curated counts or incidental markup; in one reported Funko case removing 14 change-detector tests saved 0-5 s (historical timing measurement, `E/history.md`), which measured no general saving from removing behavioural tests. What changes is new authoring: builders may skip a new example test that duplicates an existing oracle, but must write regression tests for reproduced bugs and domain-invariant tests on risky changes. If a lighter landing check is later used (Phase 3 or the faster variant), the omitted tests still run on main with revision-specific receipts.

### 11.5 Standing decisions and the authority that would change

**Would change if phases 1-2 are approved (feedback loop only):**
- **DR-146:** Stop part only; no verify launch on no-edit or busy turns.
- **DR-100:** recognize an open clarification by its position, not by any literal occurrence.
- **DR-073:** repair routing; setup failures to environment repair; same-diagnosis cap.
- **DR-072:** non-progress stop; identical findings on unchanged inputs are not re-sent.
- **Builder test authoring:** amend the current BUILD-8/10 briefs and the quality standard (`factory/standards/quality.md`) so that duplicates of an existing oracle are optional; DR-126 is cited as history only, since it defers to those.
- **DR-055 / DR-158:** additive assertions in the production-build smoke.
- **The engine's G1 rule for docs-only reports** (`plugin/runtime/build/report.mjs`; the governing DR was not identified in this research).

**Only if the owner takes the corresponding decision now (§11.6):**
- **DR-055:** a disposable-web-prototype exception needs a distinct owner decision now if chosen; the default production policy remains in force.
- **Faster variant D:** under D, the owner may name an isolated pre-launch project or expressly reopen 4A for a bounded Mission Control change and start during Phase 1. This waives the ordinary evidence timetable only for the named scope. Before first use, define a distinct partial-proof record, its eligible changes and the route back to full proof; this touches **DR-146** and **DR-153** (proof kinds) and **DR-158** (browser tiers). A partial result cannot issue a full certificate. Record any background detection guarantee still absent as an accepted risk. For Mission Control this is an explicit exception to **DR-165's decision 4A** (proposal 43). Launched projects retain full proof.

**Under B, only by a later, separate owner decision with phase 2-3 evidence:**
- **DR-146** and **DR-153:** distinct proof kinds (unless D is chosen now for its named scope).
- **DR-165:** proof rules.
- **Proposal 43 decision 4A:** Mission Control browsers (unless D reopens it now for a bounded change).
- **DR-158:** `--affected` never certifies.
- **DR-080:** acceptance ownership.

**Untouched:**
- **DR-012:** recovery.
- **DR-056:** visual oracle.
- **DR-096:** queue protocol.
- **DR-138:** production order.
- **DR-140:** native test database.
- **DR-141:** batch integration.
- **DR-144:** behaviour on owned fixtures.
- **DR-159:** suite-growth warnings.
- **DR-165** during phases 0-2 under B; under D, only its decision 4A changes, and only for a named Mission Control scope.

### 11.6 Owner decisions requested

1. Adopt the direction: Outcome 2 for the feedback loop, Outcome 3 kept at the release boundary, and start Phase 0. **Recommended.**
2. Approve the Phase 1 changes and the authority changes in §11.5.
3. Choose one: the recommended default B; variant D for one named, isolated pre-launch project, starting during Phase 1; or variant D as a separately scoped, bounded Mission Control exception, starting during Phase 1 (an explicit exception to DR-165's decision 4A). Funko and personal-page-v2 keep their full proof in every case.
4. Prototype profile: allow disposable, isolated, reversible prototypes to skip the standing behavioural suite while those conditions hold, or not.

---

## §12 · What this design will not catch

- **The release-boundary latency stays.** Keeping the full proof keeps real latency and some false blocks in the near term: a green full gate takes 593 s in Mission Control and 1,080 s in Funko (measured, n = 3 each).
- **Some failures pass even a full suite.** Wrong production settings, states nobody modelled, and scheduling failures (§7 lists real ones).
- **Waits outside the gates remain.** Owner waits, busy main, rebase conflicts and model quota are untouched; in the earlier cohort, 10.400 h of gaps followed a busy main and 6.355 h a production-order hold (measured).
- **Selection rules miss what is not imported.** If a lighter lane is approved, CSS, routing conventions, seed data, SQL and files read through `readFileSync` can bypass an import-based selection; a stale background run can lengthen exposure across releases.
- **The reviewer can miss things.** No recall figure exists for Pandacorp's reviewer; in one external benchmark the best review systems detected about 33% of known defects (CR-Bench-v2).
- **Rollback does not undo data operations.** A passed smoke, a clean ledger and an app rollback cannot restore deleted data or undo spent quota; those stay protected by blocking invariants and recovery (DR-012).

---

## §13 · What would change the recommendation

- **Toward keeping Outcome 3 everywhere:** the Phase 1 paired pilot shows no end-to-end gain once new review, setup and coordination time are charged.
- **Toward stopping any relaxation:** any material historical or live invariant missed by a candidate selector in Phase 0 or 2, a missing background receipt, or failed containment.
- **Toward a lighter landing check for a bounded class:** under B, Phase 2 evidence (zero material misses) and owner approval admit the bounded pilot; Phase 3 results (zero material misses and a measured end-to-end gain) decide whether to extend it. Even then, 20 independent changes with zero misses still allow a 13.9% one-sided 95% upper bound on per-change misses (estimated binomial illustration; correlated changes weaken it): a small pilot can refute the design quickly but cannot certify rare production risk.
- **Toward Outcome 1 for more projects:** only matched evidence that re-running the broad battery adds no material catch per minute of waiting, which no current record can supply.
- **Toward more verification:** an escaped material defect on a path the current gate covers, or new evidence that worker-loop tests catch first-discovery regressions far more often than the 2 of 33 estimated here.

---

## §14 · Already tried; do not repeat

- **Static-only verification, a missing harness treated as success, self-blessed snapshots.** In June 112 of 112 work orders went VERIFIED with broken renders (`E/history.md` §1-2).
- **Treating a failing gate as a rebuild instruction** (LESSON-0002, 0104, 0559).
- **Digest-only review, aggressive parallel review slots, a projected 4x speed-up** (proposals 37-38; the 4x was a rejected projection). An out-of-diff defect was lost; serial landing stayed the bottleneck.
- **Dropping builder self-verify, single in-context repair, eliminating behaviour E2E** (proposals 40-41 red team).
- **Proposal 43 v1 ideas:**
  - certification outside the lock and identity-only merge;
  - background re-certification;
  - subtree stamps, and `env -i` treating PATH/HOME as location-only;
  - no-bail certification;
  - agent-maintained quarantine and subset retries;
  - full bootstrap inside the queue;
  - database fingerprint reseed;
  - absolute elapsed-time budgets.
- **Automatic retries of failing tests** (DR-146).
- **Impact-selected tests as the merge gate after a rebase.** Proposal 43 rejected it; this memo keeps it in shadow only, unless the owner takes the faster variant for a named project.
- **Bench method errors** (LESSON-0709):
  - a single historical reference taken at a different load;
  - timing Playwright through its hidden `next build`;
  - assuming workers scale linearly.
- **From this research:** pooling Stop and queue reds into one catch rate, and multiplying a project's green median by a cross-project attempt count to forecast savings.

---

## §15 · Migration plan (phases; each reversible; cheapest first)

| Phase | What ships | Reversibility | Measurement checkpoint |
|---|---|---|---|
| **0 · Offline replay** | Develop candidate selection rules on the disclosed cases, then freeze the selector before examining the independent holdout. The disclosed cases are (recorded pre-fix rebased diffs and failing tests from the earlier Funko episodes, plus the named historical catches: social-image HTTP 500, operator note, review identity and approval failures, the unbuildable candidate, the pre-hydration URL leak, `llms.txt`, bilingual publish, the request-body bound and stale-response regressions, the ten checked reviewer findings, the CSP outage, the logged hydration errors). Because these are already disclosed in this memo, the evaluation uses a separate set withheld from the selector author. A selected test ID need not fail on the pre-fix artifact; an unknown mapping neither clears a selector nor counts as a miss. No gate run. | Nothing changes in any project | Report selected IDs, known misses and unknown mappings separately; any material known miss rejects that selector |
| **1 · Feedback loop** | The §11.1 changes for steps 3-6, 12 and 13, plus separate clocks. Paired pilot on inert or low-risk work, alternating current and changed workflow. Both arms use the same version of the release check, including any stronger smoke in both; its added cost is timed separately. A separate reviewer, blind to the lane, adjudicates disagreements against reproduced behaviour. | Each change is its own switch; the final proof is the same in both arms | Ready-to-enqueue time, repair reasons, active agent time, owner and busy-main pauses, first implementation dispatch, gate time including setup, abandonment, first material finding. Reject if a material finding is missed or the end-to-end gain disappears once review and setup are charged. |
| **2 · Shadow comparison on live landings** | Before each ordinary full run, record the proposed selection; join to that same run's per-test outcomes, SHAs and stamp. Never run the omitted tests twice. Record every observed material failing test the selector would have omitted. A fail-fast stop leaves later unrun tests unknown: an incomplete run can reveal a selector miss, while the hypothetical overall landing verdict may remain inconclusive. A skipped full run (stamp reuse), a missing record or an unobserved test is inconclusive, not a pass. Use a base-owned versioned list of tests and fixtures; selector or inventory changes require the union of old and new coverage and independent review. Build the background prerequisites: an actual full background run on the pilot project that does not need an exclusions file, revision-specific receipts, missed-run alerts, containment. | Report-only | Material misses (target 0), conclusive observations versus inconclusive ones, selection size, comparable elapsed times including setup. In the frozen window only 10 of 26 starts had per-test outcomes, so coverage of the record itself is reported. |
| **3 · One bounded enforced class (default B)** | Under B, Phase 2 evidence and owner approval admit the bounded pilot: on one isolated pre-launch project, land a bounded class with the lighter check. A distinct proof kind is bound to tree, profile and inventory revision; rollback is demonstrated with old and new readers. Unknown impact, missing evidence or a material miss keeps full proof. | Single project; flip back to full proof | Misses, background receipts present, end-to-end time including review and setup. Use Phase 3 results to decide whether to extend it. |
| **4 · Beyond** | Launched projects or Mission Control only through a separate owner decision citing Phase 2-3 evidence (DR-146, DR-153, DR-165, 43 decision 4A) | Per project | Same as Phase 3, plus escapes in production |

The table describes the default B. Under D, the owner may name an isolated pre-launch project or expressly reopen 4A for a bounded Mission Control change and start during Phase 1. This waives the ordinary evidence timetable only for the named scope. Before first use, define a distinct partial-proof record, its eligible changes and the route back to full proof. A partial result cannot issue a full certificate. Record any background detection guarantee still absent as an accepted risk. For Mission Control this is an explicit exception to DR-165's 4A decision. Launched projects retain full proof. D's observations feed Phase 2.

---

## §16 · Open questions and limitations

- **Data windows are thin.** The structured queue logs cover part of one day; the engine journals are Funko-only; the earlier queue cohort is Funko-heavy (137 of 138 attempts). The live logs have grown since the frozen sample; later observations are additional data, not a reason to change these numbers.
- **The worker sample is narrow.** It is Funko, 15-20 November; it supports no cross-project rate.
- **The reviewer's recall is unknown.** No denominator of review opportunities or misses exists.
- **Separate timings are missing.** The production build inside Playwright, an affected Vitest run and a strengthened smoke were never timed separately.
- **The external evidence has limits.** Most studies use older models (GPT-5.x, Opus 4.x, Sonnet 4.6) and benchmark tasks; several measurements are vendor-run; one claim had no locatable primary result and was excluded.
- **No pre-launch project was in the sample.** Only the pre-launch path (Phase 3, or D for a pre-launch project) needs one named by the owner.
- **Proposal 43's status line is stale.** Git confirms its phases on main; adoption and scheduling in production are separate questions.
- **Some figures come from populations that cannot be compared.** The G2 repeated-loop count is 40 job directories with exit 0 (`E/timing.md`) versus 39 harvested green results (`E/gatemap.md`); both describe the same run with different counting rules. The 14.6 to 17.6 min Funko green median change (35 vs 20 green unstamped invocations) cannot be attributed to DR-158, because scope, load, suite growth and rollout overlap (`E/history.md` versus `E/redteam.md` §6; the red team settles it as "not attributable").

---

## §17 · Sources

**Internal evidence** (`docs/proposals/44-evidence/`):
- `gatemap.md` (checks, counts)
- `timing.md` (time)
- `funko-case.md` (incident)
- `ratio.md` (first census, partly superseded)
- `history.md` (chronology, rejected approaches)
- `ext-practices.md`, `ext-evidence.md` (external, corrected by the audit)
- `synthesis.md` (superseded draft)
- `verify-ratio.md` (catch-ratio audit)
- `verify-sources.md` (source audit)
- `redteam.md` (red team and corrected recommendation)
- `verify-memo.md` (acceptance audit of this memo, including the post-cutoff Funko queue attempts)
- `work/` (scripts and outputs, including `redteam_queue.py`, `timing-queue.txt`, `gatemap-counts.txt`)
- Also: `docs/proposals/43-done-means-queue-green.md` and its `43-evidence/`, and `docs/proposals/39-fast-lane-implement.md`, `40-implement-speed-v2.md` and `41-builder-speed.md`.

**External** (publication date; pre-2026 marked):
- **Models.** [Anthropic Opus 5.5](https://www.anthropic.com/claude-opus-5-5) 2026-09-22 · [Sonnet 5.5](https://www.anthropic.com/claude-sonnet-5-5) 2026-09-28 · [Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5) 2026-10-07 · [Fable/Mythos 5.2](https://www.anthropic.com/claude-fable-and-mythos-5-2) 2026-11-09 · [GPT-6.2 Astra/Sol](https://openai.com/index/introducing-gpt-6-2-astra-sol/) 2026-11-17 · [GPT-6.1 Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra) 2026-10-26 · [OpenAI API changelog](https://developers.openai.com/api/docs/changelog) · [Codex CLI 0.159.1](https://github.com/openai/codex/releases/tag/rust-v0.159.1) · [Gemini 4 Argon](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/) 2026-09-30 · [Gemini 4 Carbon](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-carbon-now-available/) 2026-11-10 · [Gemini 4 Hydrogen](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-hydrogen/) 2026-11-12 · [Gemini 4 Neon](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-neon/) 2026-11-18 · [Kimi releases](https://www.kimi.com/code/docs/en/kimi-code/whats-new.html) · [Qwen4-Max](https://www.alibabacloud.com/en/press-room/alibaba-unveils-qwen4-max) 2026-11-16 · [Grok 4.6](https://x.ai/news/grok-4-6) 2026-08-12 · [Grok 4.7](https://x.ai/news/grok-4-7) 2026-09-21 · [DeepSeek changelog](https://api-docs.deepseek.com/updates/) · [GPT-6.2 system card](https://deploymentsafety.openai.com/gpt-6-2-astra-sol/targeted-cases) 2026-11-17 · [Opus 5.5 system card](https://assets.claude.com/fc1b44717c85dc068bc6ba5024219938094694bd.pdf) 2026-09-22.
- **Practice.** [Claude Code verification](https://claude.dev/blog/how-the-claude-code-team-thinks-about-verification/) 2026-11-16 · [Claude Code review](https://claude.dev/blog/solving-code-review-at-anthropic/) 2026-10-15 · [Managed Agents evaluation](https://claude.com/resources/articles/claude-managed-agents) 2026-04-08 · [Anthropic harness design](https://www.anthropic.com/research/harness-design-long-running-apps) 2026-03-24 · [OpenAI harness engineering](https://openai.com/index/harness-engineering/) 2026-02-11 · [OpenAI reviewer study](https://openai.com/safety-alignment/scaling-code-verification/) 2025-12-01 **pre-2026** · [Stripe Minions 1](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents) 2026-02-09 · [Stripe Minions 2](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2) 2026-02-19 · [Shopify rewrite](https://shopify.engineering/shopify-app-rebuild) 2026-11-10 · [Shopify security harness](https://shopify.engineering/building-an-agentic-harness-that-outlasts-the-model) 2026-07-29 · [Vercel](https://vercel.com/blog/agent-responsibly) 2026-03-30 · [StrongDM](https://factory.strongdm.ai/techniques) 2026-02-06.
- **Studies.** [Konstantinou et al.](https://arxiv.org/html/2607.05139v1) 2026-07-06 · [Hamidi et al.](https://arxiv.org/abs/2609.09315) 2026-09-08 · [Zhao, Zhou, Cohen](https://arxiv.org/html/2607.22883v1) 2026-07-24 · [Charoosaei et al.](https://arxiv.org/html/2610.11835v1) 2026-10-08 · [Chen et al.](https://arxiv.org/abs/2602.07900v3) 2026-02-08 (v3 11-09) · [Haeri and Ghelichi](https://arxiv.org/html/2607.06636v1) 2026-07-07 · [Böckeler](https://martinfowler.com/articles/exploring-gen-ai/tdd-in-the-agent-loop.html) 2026-08-11 · [TDAD](https://arxiv.org/html/2603.17973v2) 2026-03-18 · [TDDev](https://arxiv.org/abs/2605.17242) 2026-05-17 · [METR](https://metr.org/notes/2026-03-10-many-swe-bench-passing-prs-would-not-be-merged-into-main/) 2026-03-10 · [SWE-ABS](https://proceedings.mlr.press/v306/yu26b.html) ICML 2026, 6-11 July · [PROBE v2](https://arxiv.org/html/2604.01518v2) 2026-08-06 (STING v1 2026-04-02) · [ImpossibleBench](https://arxiv.org/html/2510.20270v1) 2025-10-23 **pre-2026** · [SpecBench](https://arxiv.org/abs/2605.21384) 2026-05-20 · [Cursor reward hacking](https://cursor.com/blog/reward-hacking-coding-benchmarks) 2026-06-25 · [Dipongkor et al.](https://arxiv.org/abs/2607.18057) 2026-07-20 · [Hora and Robbes](https://arxiv.org/html/2602.00409v1) 2026-01-30 · [Song](https://arxiv.org/abs/2610.01471) 2026-10-01 · [Xiang et al.](https://arxiv.org/abs/2607.21656) 2026-07-22 · [Greptile](https://www.greptile.com/blog/model-inversion) 2026-07-21 (vendor) · [CR-Bench-v2](https://arxiv.org/abs/2611.02566) submitted 2026-11-02, revised 11-03 · [RovoDev](https://arxiv.org/html/2601.01129v2) 2026-01-03 · [Deng, Fan, Meng](https://arxiv.org/abs/2606.23130v4) 2026-06-22 · [Schmalbach](https://www.vincentschmalbach.com/tests-come-for-free-now-most-of-them-are-pointless/) 2026-10-06 · [Otterson](https://arxiv.org/abs/2607.23002) 2026-07-25 · [TDD-Agent](https://arxiv.org/html/2608.16742v1) 2026-08-17 · [ExecCritic](https://arxiv.org/abs/2609.09133) 2026-09-08 · [SWE-Verifier](https://arxiv.org/abs/2610.30284) 2026-10-21 · [CodeT](https://arxiv.org/abs/2207.10397) 2022-07-21 **pre-2026** · [Meta TestGen-LLM](https://arxiv.org/abs/2402.09171) 2024-02-14 **pre-2026** · [Google flaky tests](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html) 2016-05-27 **pre-2026** · [Atlassian flakiness](https://www.atlassian.com/blog/how-we-build/taming-test-flakiness-how-we-built-a-scalable-tool-to-detect-and-manage-flaky-tests) 2025-12-08 **pre-2026**.
