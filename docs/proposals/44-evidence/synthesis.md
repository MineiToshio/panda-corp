# Verification strategy for Pandacorp: diagnosis and proposed redesign

Synthesis of the research files in this folder (`gatemap.md`, `timing.md`, `funko-case.md`, `ratio.md`, `history.md`, `ext-practices.md`, `ext-evidence.md`), cross-checked against the live scripts where it decides the recommendation. Date 2026-11-21. Status: **proposal, nothing implemented**.

Labels: **MEASURED** (observed in logs, transcripts, git or code, with the source file named), **ESTIMATED** (arithmetic or extrapolation on measured data, or a classification judgement), **EXTERNAL** (published third-party source, as reported in `ext-*.md`).

**Verification status of inputs.** The independent verifier outputs (`findings/verify-sources.md`, `findings/verify-ratio.md`) were **not present** when this was written. Therefore: every EXTERNAL citation is *pending independent verification*, and the headline "2 real product bugs in 101 automated-gate red episodes" (ratio.md) is *pending independent verification*. Where I re-checked something myself it is stated.

---

## 0. Verdict in one paragraph

**Outcome 2: keep verification, change it at the root.** The data does not support outcome 1 (the independent reviewer is the single most productive bug-finder in the record, about 85 real findings including two open redirects and a rate-limit bypass, and funko-tracker holds real user data), and it does not support outcome 3 (six months of tweaks, 73 verification-related decisions, and the funko landing still takes a median 18 min per gate run with 43% first-attempt success). The slowness is not "tests" in general. It is (a) whole-suite browser and unit runs placed at every blocking point, (b) a red → repair → rerun loop fed mostly by environment, flake and process reds, and (c) document and process rules wired as blocking code gates. What pays for itself: a skeptical reviewer that drives the running app, typecheck/build, a small critical-path behaviour suite on the launched app, and a production-build smoke that fails on console/page errors. Move everything else to a nightly, non-blocking run.

---

## 1. Diagnosis in numbers

### 1.1 How big the verification system is

| Fact | Value | Label / source |
|---|---|---|
| Vitest tests (literal `it`/`test` calls) MC / FT / PP | 4,547 / 3,591 / 1,104 | MEASURED, gatemap.md |
| Vitest files MC / FT / PP | 540 / 889 / 180 | MEASURED, gatemap.md |
| Playwright spec files MC / FT / PP | 72 / 72 / 17 | MEASURED, gatemap.md |
| Visual baseline images MC / FT / PP | 10 / 0 / 16 | MEASURED, gatemap.md |
| Test LOC vs non-test src LOC | MC 85,440 vs 69,220 (1.23×); FT 119,129 vs 79,011 (1.51×); PP 19,243 vs 16,899 (1.14×) | MEASURED counts, ratio ESTIMATED arithmetic, gatemap.md |
| Gate machinery per project (verify.sh + merge-queue.sh + Stop hook + policy + stamp) | 1,464 + 1,021 + 330 + 360 + 307 = 3,482 lines | MEASURED, `wc -l` on `plugin/templates/...` and `plugin/scripts/verify-before-stop.sh` (re-checked) |
| Build engine runtime (non-test .mjs) | 19,371 lines | MEASURED, `wc -l plugin/runtime/build/**/*.mjs` (re-checked) |
| Verification-related decisions in the registry | 73 of 165 DR IDs | MEASURED count of a manual scope selection, gatemap.md |
| Named report rows a full verify can emit | up to 16 | MEASURED, gatemap.md |
| Blocking verification checkpoints for one small UI change on a launched project (engine path) | ~9 plus one Stop gate per agent turn (see §3.2) | ESTIMATED from gatemap.md tables |

### 1.2 Where the time goes

**Queue (landing) gate, all projects, 2026-11-21** (timing.md; the structured queue ledgers only cover this one day):

| Metric | Value | Label |
|---|---|---|
| Queue attempts / gate reds / green-awaiting-order / landings | 26 / 8 / 9 / 5 | MEASURED |
| Red share among executed gates | 8/17 = 47% | MEASURED |
| Mean queue attempts per landing | 2.60 | MEASURED (n=5 landings) |
| Green queue-gate wall median: MC / FT / PP | 593 s / 1,080 s / 101 s | MEASURED, gatemap.md (archived reports) |
| Share of gate stage time: Playwright / Vitest / static / other | 62.5% / 32.0% / 5.4% / 0.2% | MEASURED, timing.md (17 gates) |
| Lock + host-slot waiting, whole day | 5 s + 172 s | MEASURED |
| Red gate time on Nov 21 that produced no product fix | ≈ 35 min | MEASURED durations, ESTIMATED classification, ratio.md §3 |
| First-attempt-start to landing | median 52 min, p90 121 min (n=5) | MEASURED |

**Queue, funko-tracker, Nov 1–20** (proposal 43 transcript audit, `docs/proposals/43-evidence/out/episodes-audit.md`, re-read):

| Metric | Value | Label |
|---|---|---|
| Queue invocations / episodes / gate reds | 138 / 62 / 60 | MEASURED |
| Episodes landing on first attempt | 26/61 = 43% | MEASURED |
| Landed-episode wall time running the queue vs between attempts | 25.3 h (32%) vs 54.3 h (68%) | MEASURED (between-attempt time includes repair, owner, waits) |
| Green funko queue median after DR-158 | 14.6 → 17.6 min (got worse) | MEASURED, history.md |

**Stop hook** (end-of-turn gate, `plugin/scripts/verify-before-stop.sh`):

| Metric | Value | Label |
|---|---|---|
| Stop-hook red events Jul 6 – Nov 21, three projects | 664 events, 93 episodes | MEASURED, ratio.md §2 |
| Re-fires of one foreign Biome formatting error | 232 | MEASURED, ratio.md group #135 |
| Funko Stop runs before DR-146 (Nov 10) | 1,206 runs, 8 green, 15.6 h machine time | MEASURED, history.md |
| Lock-contention blocks during a pure discussion with no edits (funko, Nov 20) | 5 blocks, 404 ms of verifier time | MEASURED, funko-case.md; contention exit 75 → hook exit 2 confirmed at `verify-before-stop.sh:250-253` |

**Build engine, funko, 8 runs Nov 13–21** (timing.md, journal envelopes, overlapping, MEASURED intervals):

| Phase | Summed hours | Median per interval |
|---|---|---|
| Implement | 4.81 h | 543 s |
| Docs and planning | 3.06 h | 571 s |
| Test authoring | 1.32 h | 598 s |
| G2 FRD gate | 1.97 h (1.87 h of it is 40 reruns of the same commit, an engine bug since fixed, BL-0316/0317) | 150 s |
| Repair | 0.68 h | 452 s |
| Review | 0.56 h | 533 s |
| G3 land | 0.19 h | 343 s |

Excluding the fixed G2 loop, verification-shaped phases (test authoring + review + repair + G2 + G3) are ≈ 2.85 h of ≈ 10.7 h ≈ 27% (ESTIMATED, envelopes overlap). Docs and planning are another ≈ 29%. So inside the engine, verification is a large minority, not the majority; the queue's full gate and its retry loop are the bigger time sink after work is "done".

**The owner's incident** (funko "which Funko lines to follow", funko-case.md, MEASURED): approval → owner stop = **1 h 29 m 37 s**, **zero feature code dispatched**. Two docs-only G1 reds: a missing generated Next type (environment, `PageProps` TS2304) and DR-100's literal-substring check matching the sentence "no `[NEEDS CLARIFICATION]` remains" (process rule false positive, confirmed at `verify.sh:1129-1149`). Then two test-writer launch failures from an invalid Codex output schema (tooling). Failed gate stages ran for 12.9 s in total; the repair windows around them took 21 min (MEASURED); failure-associated critical path ≈ 58 min (ESTIMATED). **Zero product defects** were involved. The same `PageProps` environment red recurred in the Nov 18 and Nov 18–19 runs.

**Benchmarks** (history.md, proposals 39–41, MEASURED): small change vanilla agent 2.6–5.5 min vs old engine 51–84 min to done, same oracle score 151/151; after the fast lane, engine small USABLE 8–11 min but done 40–44 min; medium 43.5 min USABLE / 89.9 min done vs vanilla 11.5–12.1 min. Builders wrote 8–10× vanilla's unit-test volume and 6× its E2E volume.

### 1.3 What the gates catch

| Checkpoint | Real user-facing bugs caught | Population | Label / source |
|---|---|---|---|
| Stop hook (whole-project verify at turn end) | 2 of 93 episodes (both minor, ppv2; one was a reviewer-authored test merely re-run) | Jul 6 – Nov 21 top-level Claude transcripts | MEASURED census, classification ESTIMATED, **pending independent verification** (ratio.md) |
| Queue full gate, Nov 21 | 0 of 8 reds | one day, 3 projects | MEASURED, ratio.md §3 |
| Queue full gate, funko Nov 1–20 | 19 "own defect not covered by earlier evidence" + 7 "repair broke something else" = 26 of 60 reds | 20 days, funko, incl. subagent transcripts | MEASURED labels, 13/16 sample agreement, episodes-audit.md |
| Of those 19 own defects, plausibly user-facing | ≈ 5–8 (misplaced `"use client"` breaking the build; OG image HTTP 500 on the real server; focus-trap fix; AppShell sign-in AC; export-recovery e2e; image-rule logic) | my reading of the 19 one-line stage descriptions in `w-tr/episodes.md` | ESTIMATED by me |
| Rest of the 19 | ≈ 4 static/contract (knip ×2, skill-contract doc tests ×2, allowlist), ≈ 3 stale tests (legacy redirects, fixture alignment), ≈ 3 unclear (publicCache ×2, DB tests) | same | ESTIMATED by me |
| Independent reviewer / FRD gate | ≈ 85 real findings, ≈ 80–85% of its findings real (open redirects ×2, rate-limit bypass, lost photo credits, wrong "finished" states) | ~20 review docs and patch commits | ESTIMATED, not re-verified one by one (ratio.md §4) |
| Escapes despite all gates | ≥ 20 (ppv2 blog broken in production by CSP; MC hydration errors logged during a green gate; funko timezone, scale, cron, deploy config; rate-limit bypass found by a deferred review after landing) | bug cards, incident commits | MEASURED lower bound (ratio.md §6) |
| Tests that are themselves the defect | 10 of 36 `type: bug` cards are about the test harness | cards | MEASURED (ratio.md §7) |

**Why 2/101 and 26/60 differ** (both can be true):

1. *Population.* ratio.md's 101 is 93 Stop-hook episodes over four months (mostly the pre-DR-146 full Stop regime, which fired mid-work by design) plus 8 queue reds on one day. Proposal 43's 60 is funko-only queue reds over 20 days, including subagent transcripts that ratio.md did not scan.
2. *Definition.* ratio.md's "real" means "the fix changed product behaviour a user would see". Proposal 43's (a) means "a defect of this branch not caught by whatever ran before the queue", which includes knip, formatting-adjacent build errors, doc-contract tests and stale expectations.
3. *Position.* The Stop hook catches in-progress states (21 "mid-work transient" episodes); the queue is frequently the **first time the relevant tests ran at all** (proposal 43 B4: 28 of 62 episodes had no visible gate before queuing). A queue red on the agent's own branch is mostly "the agent did not run its own affected tests", not "the full suite found a hidden regression".

Reconciled estimate (ESTIMATED): of ≈ 161 automated-gate reds across both datasets, ≈ 7–10 (4–6%) were user-facing product bugs; ≈ 30–35 (20%) were genuine defects of the change of any kind; ≈ 60–65% were environment, flake, mid-work, process or stale tests. Proposal 43's own retrospective said its audited cross-repair defects "would have been detected by static checks plus full Vitest", i.e. without Playwright (history.md §4). Browser layer: 0 of 15 Playwright episodes at Stop/queue in ratio.md were real; 4 of the 19 own defects in proposal 43 were e2e (OG 500, export recovery, publicCache ×2). So the browser layer is not worthless, but its catches come from a handful of specific specs, while it costs 62% of gate time.

### 1.4 Is the problem tests, the rules around them, or the environment?

All three, but not equally, and they multiply:

- **Environment/harness failures are the largest single red source**: 33 + 21 mid-work of 93 Stop episodes (ratio.md); ≈ 19–23 of 60 funko queue reds (episodes-audit.md); the owner's incident. Examples: missing generated types, missing `DATABASE_URL`, shared Postgres, port collisions, load timeouts at load avg 20–34 on 10 CPUs, invalid reporter identity, Codex schema rejection.
- **Rules and loops turn cheap reds into expensive hours**: 12.9 s of failing gate → 21 min of repair in the incident; 232 re-fires of one formatting error; 40 identical G2 reruns; 68% of funko episode time sits between queue attempts. Every red, whatever its cause, triggers a code-repair loop with a full-suite rerun.
- **Test volume and placement set the price of each loop iteration**: whole Vitest (401 s funko) and whole Playwright incl. build (708 s funko) on every landing attempt; builder-written test volume 8–10× vanilla; test LOC exceeds product LOC in all three projects.

Pure test execution is the minority of the elapsed time; the multiplier is *(number of blocking points) × (whole-suite cost per point) × (attempts per point, inflated by non-product reds)*.

---

## 2. The three outcomes, evaluated with equal seriousness

### 2.1 Outcome 1 — remove tests almost entirely

**What it would mean here.** Delete or stop running the Vitest and Playwright suites (MC 4,547 / FT 3,591 / PP 1,104 tests; 161 Playwright specs). `verify.sh` reduces to `tsc` + Biome (+ maybe `next build`). Retire the test-writer agent, fail-first proof in `plugin/runtime/build/report.mjs`, G2, the protected-oracle machinery (`oracle-review.mjs`), test-outcome ledger, exclusions/budget policy (`test-gate-policy.mjs`), green stamps, nightly runs. The reviewer either goes too (pure "tests" removal plus "less verification") or stays as the only behavioural check.

**Gain (projection method: remove measured stage times and attempts).** Funko landing gate 1,080 s → ~30 s static + build (ESTIMATED 2–4 min). Attempts per landing → ~1.1. Test-authoring phase (1.32 h across 8 runs) and test tokens disappear. Per small change ESTIMATED done time ≈ vanilla-like, 10–20 min.

**Risks (with real cases).**
- If the reviewer goes too: the ≈ 85 reviewer catches are gone, including security (two open redirects, rate-limit bypass, prototype pollution) and data-integrity bugs (export retry duplicates, ingest scope continuation). EXTERNAL: 91% of 200 audited vibe-coded apps had a vulnerability, 65.8% critical/high (Deng et al. 2026, pending verification).
- Even with the reviewer kept: regressions in untouched code on a launched app with real data are only found by users. The 19 funko own-defects included a production build break and an OG image 500. Rollback does not undo irreversible data operations (account deletion/erasure, export, ingest publication).
- No measured case of removal going well (EXTERNAL: only Schmalbach's anecdote, and he kept 63 tests on money/data/permissions/email).

**Internal + external read.** Supported only for the *implementer-authored unit layer and in-loop TDD* (EXTERNAL: same-model tests detect 14% vs 25% of faults; TDD in the loop no gain at 3–8.5× tokens; agent tests changed SWE-bench outcomes by 0–13/500). Not supported as a whole. **Rejected**, mainly because funko is launched with user data and the reviewer evidence is strong.

### 2.2 Outcome 2 — keep some verification, change the strategy at the root

**What it would mean here.** Detailed in §3. In short: one independent judge per change (reviewer driving the running app, spec-grounded acceptance checks it or the test-writer authored without seeing the code); a small blocking landing gate (build, typecheck, affected tests, a critical-path suite, a production-build smoke that fails on console/page errors); everything else nightly and non-blocking; no blocking doc/process gates on code; Stop hook advisory; environment reds classified mechanically and never sent to code repair; repair cap of 2.

**Gain (projection method: measured stage medians for kept stages + estimated new stages, measured attempts scaled by the share of red classes removed from the blocking path).** Funko landing gate 18 min → 5–9 min; attempts 2.6 → 1.3–1.6; gate wall per funko landing ≈ 47 min → ≈ 8–14 min (all ESTIMATED, §3.6).

**Risks.** Regressions in code the change did not touch and that the critical suite does not cover can reach main and, for launched projects, production, until the nightly run (≤ 24 h). Affected-test selection can miss tests coupled through data/config/docs (LESSON-0244: defects escaped a diff-scoped verifier until the next full baseline). The reviewer becomes the critical judge; if it is weak or lazy the net is thinner than today. Proposal 43 rejected "impact selection and moving browser checks off the blocking path" on coverage grounds (history.md §2), so this explicitly reverses a prior decision; §5 lists what would reverse it again.

**Internal + external read.** Internal: the productive checks are exactly the ones kept (reviewer; static+targeted Vitest would have caught the audited repair defects; the specific e2e catches map to critical/smoke specs). The actual escapes (CSP in production, hydration errors, console errors) are failure classes only a production-build smoke with console-as-failure covers, and today's heavy gate does not. External: best supported option (spec-grounded tests +36–38 pp; externally supplied targeted tests cut silent regressions 18.8% → 4.8% with 1.7% of the suite; separate skeptical evaluator; Stripe caps CI rounds at 2, Anthropic at 3; OpenAI keeps merge gates minimal and flakes non-blocking; Anthropic ranks E2E > property > differential > unit; Vercel and Anthropic add production-side rollout safety). All EXTERNAL, pending verification.

### 2.3 Outcome 3 — current approach with tweaks

**What it would mean here.** Keep `verify.sh` full gate as landing proof, the Stop light gate, G1/G2/G3, test-writer and builder TDD, DR-100, DR-165 exclusions. Continue the existing backlog: BL-0332 (host slot ceiling for direct Playwright), typegen bootstrap (BL-0331), worker counts, fixture copy, added-test budgets.

**Gain (projection method: history of tweak campaigns).** Proposal 43 Playwright profiling: ~27% faster Playwright stage (MEASURED, 2 runs per arm); a full MC gate target 8.7 → 5.5–6.5 min (ESTIMATED by proposal 43). Funko full gate might go 18 → ~13 min. Attempts per landing unchanged unless reds drop.

**Risks.** Low new defect risk. The speed problem persists: since June there were at least nine verification campaigns (history.md §1); the September sprint missed its 4× target; DR-158 made the funko green queue median *worse* (14.6 → 17.6 min); first-attempt landing stays ≈ 43%; 73 verification decisions keep growing; each tweak adds rules and machinery (DR-165 alone added exclusions with Keychain signing, nightly runs, budgets, reporter integrity). The tweaks optimise the cost of each full run, not the number of blocking points or the non-product red rate, which is where the hours are.

**Internal + external read.** Internally weak (plateau). Externally weak: industrial agent factories run lighter blocking gates; the parts of the current approach with null/negative evidence (implementer TDD, blocking implementer unit tests, unbounded repair, blocking pixel baselines) would all stay. **Rejected.**

---

## 3. Recommended target design

### 3.1 Principles

1. **One judge that cannot be edited by the implementer.** Acceptance checks come from the FRD/card, not from the code, and the implementing agent cannot change them (keep the existing protected-hash oracle mechanism, `report.mjs` / `oracle-review.mjs`).
2. **Run what the change touches, where it is cheap; run everything, where it is free.** Blocking = affected + critical + smoke. Full = nightly, non-blocking.
3. **A red must mean "your change is wrong".** Environment and flake signatures are classified by script, never by the agent, and never consume a code-repair round.
4. **Docs and process rules never block code.** They report; the doc author fixes them in its own step.
5. **Hard caps everywhere.** 2 repair rounds per change, then hand back to the owner with a diagnosis.
6. **Risk sets the depth**, not the size of the bureaucracy: launched projects with user data get more, not internal tools.

### 3.2 Flow before vs after (small UI change on launched funko-tracker)

**Before (today, engine path)** — blocking verification checkpoints in bold:
1. Owner asks → conversation agent classifies, writes card, `card check`.
2. CLI preflight/admission.
3. Product-manager docs unit → **G1** (whole-project static light verify) → integrate.
4. Architect docs unit → **G1** → integrate.
5. (UI without design) designer delta → **G1**.
6. Test-writer acceptance unit, fail-first proof → **G1** with tests → integrate.
7. Implementer unit (TDD, self-verify) → **G1** (static + changed tests) → integrate.
8. **G2** per FRD (`--since`: statics + changed Vitest + Playwright incl. build).
9. **Independent reviewer** per FRD + adversarial probes + review ingestion validation.
10. Optional **security audit** (risk-selected).
11. **G3 / merge queue**: lock, rebase, env prepare, stamp check, full verify (12–16 stages: all statics, full Vitest, prod build, full Playwright smoke/shell/visual/responsive/headers, DB clean, reporter integrity, policy).
12. Exit 21 → owner order → queue rerun with release variable → **pre-push proof** → ff + push.
13. Close-out: change reconcile, session cleanup.
Plus a **Stop gate** at the end of every agent turn (light verify; blocks on own red and on lock contention), and two other Stop hooks (lesson capture, derived drift) that can return exit 2.

Count: **≈ 9 blocking automated checkpoints + 1 human order + N Stop gates**; up to 3 repair executions per stage; 5–7 agent roles.

**After (proposed)**:

| # | Step | Judge | When | Blocks? | Time budget |
|---|---|---|---|---|---|
| 1 | Owner asks → card (`ui`, `design_source`, risk tier auto-computed from `.pandacorp/risk-paths` + launched flag) | conversation agent + script | request | — | 1–3 min |
| 2 | One docs agent writes the FRD/blueprint delta (PM + architect merged for small changes; split stays for medium/large) | docs agent; doc-lint **advisory**, auto-fix where mechanical | per change | No | ≤ 10 min |
| 3 | Acceptance checks from the FRD only, without seeing code. Medium/large or risk tier ≥ 2: test-writer. Small, low risk: the reviewer derives them in step 5 | test-writer (spec-only context), protected by hash | per change, before or parallel to implementation | No (they are the oracle) | ≤ 10 min |
| 4 | Implementer inner loop: `tsc`, Biome **with auto-fix**, affected Vitest, run the app; no TDD instruction, no unit-test quota | deterministic tools, seconds | inner loop | Only its own report check (G1 = build-check + affected tests) | G1 ≤ 3 min |
| 5 | Reviewer in fresh context, ideally the other model family from the implementer: reads diff + FRD, drives the running app against acceptance checks / feature map, writes failing probes for any defect. Risk tier ≥ 2 adds security lens | reviewer agent | per change (not only per FRD) | **Yes** | tier 1 ≤ 10 min; tier 2 ≤ 20 min |
| 6 | Landing gate (merge queue): rebase, env preflight (typegen, prisma generate, ports, DB; failure = "env not ready", not red), `next build`, `tsc`, affected Vitest, **critical-path suite**, **prod-build smoke** (one URL per route type, fails on `pageerror`, console error, hydration warning, failed request, HTTP ≥ 500, CSP violation) | deterministic | per landing | **Yes** | MC/PP ≤ 4 min; FT ≤ 8 min |
| 7 | Owner order (launched only), ff + push with landing-profile proof (pre-push hook unchanged in shape) | owner | per landing | **Yes** (human) | owner |
| 8 | Post-deploy production smoke against the live URL (launched only): same smoke, read-only routes | deterministic | after deploy | No; red → notify owner + one-command rollback | ≤ 2 min |
| 9 | Nightly full run on main tip: full Vitest, full Playwright incl. visual/responsive, knip, madge, doc-lint, mutation on changed core logic weekly | deterministic | nightly | No; red → auto card with SHA range; critical-suite red on launched → owner notified | unbounded |
| 10 | Weekly reviewer sweep on risk paths and recent escapes (Anthropic-style "review agents run nightly over existing code") | reviewer agent | weekly | No | bounded tokens |

Count: **3 blocking automated checkpoints (G1, reviewer, landing) + 1 human order**, no Stop gate. Agent roles for a small change: docs, implementer, reviewer (3, from 5–7).

### 3.3 Removed, kept, new

**REMOVED from any blocking path** (code may stay, runs nightly or advisory):
- Stop-hook verification (`verify-before-stop.sh` calling `verify.sh --light`): becomes advisory or off; never blocks on exit 75. Evidence: 664 red events ≈ 2 real; 5 blocks during a discussion with no edits.
- G1 on docs-only units; tests on docs-only landings (path-based skip: no file outside `docs/`, `*.md`, `.pandacorp/inbox` changed → no test stage). Evidence: owner's incident.
- DR-100 residual-ambiguity, doc-lint, structure guard, live-data asserts, status-schema checks as blocking gates → advisory in the doc author's step. At minimum fix DR-100 to match the bracketed marker syntax only.
- Biome formatting as a red → auto-fix and commit.
- G2 per-FRD gate (its job is taken by the per-change reviewer plus landing gate).
- Full Vitest and full Playwright (visual, responsive, headers, shell, all behaviour specs) at landing → nightly.
- Pixel visual baselines as a blocking gate → reviewer compares against the mock for UI changes; nightly keeps the diff as a signal.
- Builder TDD/fail-first and unit-test volume expectations for implementers (DR-126 already reduced them; finish the job).
- Added-test budget enforcement and per-test owner exclusions (no longer needed when non-critical tests do not block; keep the code dormant for the critical suite if the owner wants it).

**STAYS**:
- Owner explicit order per landing on launched projects; `main` only production branch; pre-push proof (proof of the new landing profile); merge lock and exact-SHA ff; agents never authorize exclusions.
- Protected acceptance oracle (implementer cannot edit it).
- Independent reviewer, now per change and risk-tiered.
- `tsc`, `next build`, affected Vitest in the inner loop and at landing.
- Local native Postgres isolation (DR-140), per-worktree ports/env (DR-158), fail-closed route smoke for UI (DR-055, in its smaller form).
- The existing test files (none deleted wholesale; see §3.5).
- Funko GitHub Actions CI (static + Vitest on push/PR) as a free extra net.

**NEW**:
- Risk tier per change: tier 2 if it touches `.pandacorp/risk-paths` (auth, permissions, rate limits, data deletion/erasure, export, ingest publication, migrations, public endpoints, redirects) or any launched-project data write; tier 1 otherwise.
- Critical-path suite per launched project: tests tagged `@critical`, chosen by the reviewer from acceptance criteria on risk paths, target ≤ 2 min.
- Production-build smoke with console/page errors as failures (targets the actual escapes: ppv2 CSP outage, MC hydration errors, duplicate keys).
- Mechanical red classifier (signature-based; §3.4).
- Post-deploy production smoke + rollback recipe (launched).
- Gate-red ledger and escape tags (§3.7).

### 3.4 Flaky and environment reds must not trigger repair loops

1. **Prevent**: env preflight before any gate (typegen, Prisma client, ports, DB template, deps); failure reports "environment not ready" (existing exit 16 path) and is fixed by the coordinator script, not by the implementer. Admission: do not start a gate when load avg > CPU count (the funko timeouts occurred at load 20–34 on 10 CPUs). Finish BL-0332 so every Playwright invocation takes the host slot.
2. **Classify by signature, not by agent prose**: `EADDRINUSE`, connection refused, `TS2304` on `.next/types`/generated paths, missing env var, `Test timed out` / `Hook timed out` with load > CPUs, reporter/schema errors, `ENOSPC` → class `infra`. Assertion failures in tests the change touched or imports → class `change`. Assertion failures in unrelated tests → class `foreign`.
3. **Route**: `change` → repair (counts toward the cap). `infra` → one rerun of the **whole** blocking set in a fresh environment (not a subset retry), ledgered; still `infra` → hand back to the owner immediately, no code edits. `foreign` on main → nightly card; does not block the change unless it is a critical-suite test, in which case owner hand-back.
4. **This changes a standing rule** (DR-165 "no reruns"). Argument: the rerun is a classifier for environment signatures only, never for assertion failures, so it cannot launder a real behavioural failure; it avoids the documented pattern where an agent "repairs" a timeout by editing tests or product. The prior objection to "subset retries" and "agent-maintained quarantine" (proposal 43 v1) is respected: whole-set rerun, no agent quarantine, the branch grants itself nothing. Owner decision required.

### 3.5 Repair cap

- Max **2 repair rounds per change** across G1, reviewer and landing combined (today: 3 per stage, plus rescue). EXTERNAL: Stripe 2 CI rounds, Anthropic 3 rounds then escalate; ImpossibleBench: more feedback rounds increased cheating 33% → 38% (pending verification).
- After the cap, hand back to the owner with: failing check, classifier verdict, the diff, and the reviewer's note. Work preserved on its branch.

### 3.6 Project tiers

| Aspect | Pre-launch projects (no users yet) | Mission Control (internal tool) | Launched with users and data (funko-tracker; personal-page-v2 at lower data risk) |
|---|---|---|---|
| Reviewer | per change, tier 1 default | per change, tier 1 default | per change; tier 2 mandatory on risk paths; **no deferred review may land on launched main for risk paths** (escape #11) |
| Acceptance checks | reviewer-derived for small | reviewer-derived for small | test-writer for medium/large and all tier 2 |
| Landing gate | build, tsc, affected Vitest, route smoke | same; owner previously chose blocking browser verification, this replaces it with route smoke + nightly full Playwright (owner decision needed) | build, tsc, affected Vitest, **critical suite**, prod-build smoke |
| Owner order | no | no | yes (unchanged) |
| After landing | nightly full | nightly full | post-deploy prod smoke + rollback recipe; nightly full; critical red → owner notified |
| Data migrations / destructive ops | reviewer | reviewer | reviewer tier 2 + verified native recovery window (DR-012) + migration dry run on a prod-shaped local copy |

**Existing suites** (MC 4,547 / FT 3,591 / PP 1,104 tests; 72 / 72 / 17 Playwright specs): keep all files. Re-label in three classes: `critical` (blocking at landing on launched projects, target ≈ 1–3% of tests, ≤ 2 min), `affected` (selected dynamically per change), everything else `nightly`. Prune over time through an owner-approved weekly card: nightly tests that went red twice without a product cause, change-detector tests (DR-144), duplicate builder unit tests. Agents propose; the owner approves deletions (consistent with "agents never authorize exclusions"). The visual baselines (MC 10, PP 16) move to nightly signal.

### 3.7 Minimal logging to measure the catch ratio from now on

1. `.pandacorp/run/gate-reds.jsonl`, kept indefinitely, one row per non-green check at any checkpoint: `{ts, project, change_slug, checkpoint (g1|reviewer|landing|nightly|prod-smoke), stage, failing_ids, tree, head, classifier_class}`.
2. Green-after-red link, appended automatically when the same branch next goes green: `{red_row, green_tree, changed_paths, fix_kind}` with `fix_kind` derived from paths: `src-nontest | tests-only | baselines-only | config-env | none(rerun)`.
3. Commit trailer on the fixing commit: `Gate-Red: <row> cause=product|test|flake|env|process`.
4. Reviewer findings as structured rows: `{change, severity, class (security|data|logic|ux|a11y|nit), fixed_sha}`.
5. Escape tags on bug cards: `escaped_past: [checkpoints]`, `would_catch: <check>`.
6. Per-change cycle time: card created → owner approval → landed, from existing journal and queue events.
A monthly script computes: user-facing catches per checkpoint, false-block rate, minutes per real catch, escapes per landing.

### 3.8 Projected time saved (separating measured from projected)

| Quantity | Today | After | Basis |
|---|---|---|---|
| Funko landing gate wall per attempt | 1,080 s median (MEASURED) | 5–9 min | ESTIMATED: statics ≈ 25 s (MEASURED medians: tsc 2.3, biome 2.1, knip 3.1, madge 7.6, doc-lint 5.7), build 2–4 min (unmeasured separately; inside the 708 s Playwright aggregate), affected Vitest 1–2.5 min (ESTIMATED from 401 s full suite incl. Postgres setup), critical suite ≤ 2 min (target), smoke 1–2 min |
| MC landing gate | 593 s (MEASURED) | 3–4 min | ESTIMATED, same method (tsc 8.2 s, full Vitest 98 s) |
| Attempts per landing | 2.60 (MEASURED, n=5) | 1.3–1.6 | ESTIMATED: ≈ 55–70% of reds are env/flake/process/stale-test (MEASURED-classified in two audits) and leave the blocking path or are auto-handled |
| Gate wall per funko landing | ≈ 47 min (2.6 × 18, ESTIMATED from measured parts) | ≈ 8–14 min | ESTIMATED |
| Small change, card to done | 40–44 min on benchmarks (MEASURED, proposal 40/41); real funko incident 90 min without code | 15–25 min | ESTIMATED: implement 8–11 min USABLE (MEASURED fast lane) + reviewer 5–10 + landing 4–8 |
| Medium change, card to done | 89.9 min (MEASURED, one run) | 50–65 min | ESTIMATED |
| Stop-hook machine time | 15.6 h over 1,206 funko runs pre-DR-146 (MEASURED); light now 16–29 s median per turn | 0 blocking | design |
| Blocking checkpoints, small UI change, launched | ≈ 9 + per-turn Stop | 3 + owner order | ESTIMATED count from §3.2 |

Projections are bounded by the weakest measurement: the queue ledgers cover one day and five landings; the engine timings come from funko only; the affected-test runtime and the build-only runtime were never measured separately. Treat the after-column as a hypothesis for the phase checkpoints in §6, not a promise.

---

## 4. What this design would NOT catch, and whether that is acceptable

| Gap | Why it opens | Acceptable? |
|---|---|---|
| Regressions in untouched code not covered by critical/smoke/affected tests | full suite moves to nightly | **Acceptable for MC and pre-launch** (owner prefers occasional bug). **For funko, acceptable only because** the critical suite covers data/auth/export/deletion paths and production smoke + rollback limit exposure to ≤ 24 h for non-critical UI. If escapes rise (§5), revert. |
| Tests coupled through data/config/docs that the import graph misses | affected selection is import-based | Partly. Mitigate: changes to config, `package.json`, env, schema, migrations, or shared `src/lib` modules above a fan-in threshold trigger full Vitest at landing (still no Playwright). |
| Pixel-level visual regressions | baselines leave the blocking path | Yes: 0 baseline reds in the census were real bugs; taste escapes (funko colours, footer) were not caught by baselines either. Reviewer compares UI changes against mocks. |
| Responsive breakage on untouched pages | responsive specs nightly | Yes, low cost of a 24 h delay. |
| Intermittent real races (a real bug that looks like a timeout) | infra classifier allows one rerun | Partly. Only on infra signatures and under load > CPUs; same-tree pass/fail pairs go to the ledger and a nightly card. A real race in a critical path will still fail the critical suite or show up in nightly suspects. |
| Reviewer misses (LLM reviewers are inconsistent; same-model review limited) | reviewer becomes the main behavioural judge | Accept with measurement: structured reviewer findings + escape tags reveal recall; weekly risk-path sweep adds a second look. |
| Doc inconsistencies (stale FRD, unresolved markers, status schema drift) | doc gates advisory | Yes: none of these was ever a product bug in the census; they still appear in reports and nightly. |
| Dead code / circular imports (knip, madge) | nightly | Yes: invisible to users; 0 real in census. |
| Irreversible data loss from agent actions | not a test problem | Not covered by tests today either (EXTERNAL data-loss incidents were permission failures). Keep `block-dangerous.sh`, owner gates and DR-012 recovery. |
| Security bugs outside risk-path labels | tier depends on path list | Partly: keep the weekly reviewer sweep and the pre-release security auditor. |

---

## 5. Decision triggers, and what must not be repeated

### 5.1 What would change the recommendation

- **Toward more verification (revert a phase):** funko escapes tagged `escaped_past: landing` at severity ≥ medium rise > 50% over the Phase 0 baseline across 4 weeks; or nightly full run finds ≥ 1 regression per week on main that the landing gate passed and users could hit; or any data-integrity incident on a launched project traced to a removed check.
- **Toward less verification:** after 8 weeks the critical suite has caught 0 real defects and the reviewer catches stay high → shrink critical further; if the landing smoke catches nothing in 8 weeks, keep it anyway (it guards the escape class that actually reached production).
- **Toward a different lever:** if Phase 2 does not cut funko landing wall by ≥ 40%, verification is not the bottleneck; re-measure docs/planning (≈ 29% of engine time) and orchestration instead.
- **If the pending verifier (`verify-ratio.md`) finds** many genuine product regressions inside the build-worker loop (class "genuine regression exposed and fixed in src" ≥ ~20% of sampled worker reds), keep affected tests mandatory in the implementer loop (already in the design) and consider widening the landing selection. If it overturns the 2/101 headline substantially (e.g. > 15% user-facing), slow the migration and keep full Vitest at landing for launched projects.
- **If `verify-sources.md` refutes** the key external claims (spec-grounded tests, TDD-in-loop null result, reviewer value), the internal data still carries the recommendation, but the reviewer-centred design should be re-weighted toward a slightly larger critical suite.

### 5.2 Already tried; do not repeat (history.md §2)

- Static-only verification, missing harness treated as success, self-blessed snapshots (112/112 WOs green with broken renders in June). This design keeps a fail-closed real-browser smoke for UI.
- Treating a failing gate as a rebuild instruction (LESSON-0002/0104/0559).
- Digest-only review, aggressive parallel review slots, projected 4× (proposal 37/38): lost out-of-diff defects; serial landing was the bottleneck.
- Dropping builder self-verify entirely, single in-context repair, eliminating behaviour E2E (proposal 40/41 red team).
- Proposal 43 v1: certification outside the lock, identity-only merge, background recertification, subtree stamps, `env -i`, no-bail certification, **agent-maintained quarantine and subset retries**, full bootstrap in queue, DB fingerprint reseed, absolute elapsed-time budgets.
- Bench method errors: single historical reference at different load, timing Playwright through hidden `next build`, assuming linear worker scaling (LESSON-0709).
- Explicitly *reversed* here (owner decision needed): proposal 43's rejection of impact selection and of moving browser checks off the blocking path; DR-165 "no reruns" (narrowed); full verify as the only landing proof; MC's blocking full browser verification.

---

## 6. Migration plan (phases, reversible, with measurement checkpoints)

Every phase is a per-project gate profile switch (e.g. one setting read by `verify.sh` and `merge-queue.sh`), so the old full gate remains callable and is still what runs nightly. Reverting a phase is flipping the profile back.

**Phase 0 — Measure (1 week, no behaviour change).** Add the red ledger, green-after-red link, classifier tag (report-only), reviewer findings rows, escape tags, cycle-time extraction. Wait for `verify-ratio.md` / `verify-sources.md`. *Checkpoint:* baseline catch ratio per checkpoint, attempts per landing, funko landing wall, escapes per week, per-change cycle time, with n ≥ 15 landings.

**Phase 1 — Remove pure friction (all projects).** Stop hook advisory (never blocks, never on exit 75); docs-only changes skip test stages; doc/process gates advisory; DR-100 marker match fixed; Biome auto-fix; env preflight as "not ready"; classifier routes `infra` away from code repair; repair cap 2. *Checkpoint:* Stop blocks/week → 0; docs-only change time; repair rounds per change; share of reds classed infra; no change in escapes.

**Phase 2 — Slim landing gate, staged by risk.** MC first (internal), then personal-page-v2, then funko once its `@critical` suite exists and has been reviewed by the owner. Landing = build, tsc, affected Vitest, critical (launched), prod-build smoke; full suite nightly with auto-cards. *Checkpoint (per project, 2 weeks):* landing wall −40% or better, attempts per landing ≤ 1.6, nightly regressions on main that passed landing ≤ 1/week, escapes not above Phase 0 baseline. Fail → revert that project's profile.

**Phase 3 — Engine flow.** Merge docs roles for small changes; test-writer only for medium/large/tier 2; no builder TDD; reviewer per change, risk-tiered, preferably cross-family; G2 retired; no deferred review on launched risk paths. *Checkpoint:* small/medium done time vs proposal 40/41 baselines (40–44 / 89.9 min), reviewer real-finding count and precision, escapes.

**Phase 4 — Suite hygiene and production net.** Owner-approved weekly pruning card; visual baselines to nightly signal; post-deploy production smoke and rollback recipe for funko and ppv2; weekly reviewer sweep on risk paths. *Checkpoint:* nightly suite runtime and flake rate, production smoke catches, and the monthly catch-ratio report becomes the standing evidence for any future gate change (no new blocking check without a measured catch).

Standing constraints kept throughout: owner explicit order for every launched landing; `main` the only production branch; agents never authorize exclusions or test deletions; nothing implemented until the owner approves this proposal. Constraints this proposal asks the owner to change explicitly: DR-165 "no reruns" (narrowed to infra signatures), full verify as landing proof (replaced by the landing profile with nightly full), MC blocking browser verification (replaced by route smoke), DR-146/DR-100 as blocking gates (advisory).
