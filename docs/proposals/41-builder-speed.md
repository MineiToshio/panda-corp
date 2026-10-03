# 41 — Fast-lane builder speed: write less, run less, read less

**Status:** proposed, revised after one red-team · **Date:** 2026-10-03
**Home:** FACTORY proposal (build engine). Plugin 9.120.2; fast lane is the default (DR-124), lanes K = 2 (DR-125). Nothing here has been executed.

---

## TL;DR

1. **The builder is limited by what it generates, not by its tools.** Across 20 builder transcripts, 71.5 % of builder time is model time: about 117 min of output generation at about 185 tok/s and about 30 min of per-turn latency (756 turns). Builders write **4.2-4.8× vanilla's output tokens** for the same app. App code is only 1.3-1.7× vanilla; the gap is unit tests (8-10×), e2e specs (6×) and fix churn.
2. **Engine plumbing is not the problem.** `commit-wo`, `park-wo`, receipts, `wo_start` and `preserved-tests` cost about 1 % and stay as they are.
3. **Ship C1-C6, plus C7 behind a flag that is off by default:** a unit-test budget that keeps one behaviour e2e spec per UI FRD; the AC ids printed up front; a narrowed self-verify; tests written with the code; a lean `fast-builder` agent; batched turns; sonnet at effort `medium` (C7). The red-team removed the e2e ban and the single self-repair attempt.
4. **PROJECTION:** about **15-20 summed builder-minutes** saved per medium run. That is about 58 → 38-43 min. All-USABLE on the medium bench goes from 56.9 → about 46-49 min at K = 2.

   Small-bench USABLE goes to about 6.5-9 min. **Neither the ≤ 30 min medium target nor the ≤ 6 min small target is reachable from builder changes alone.** The engine's land, verify and lane-USABLE path (13-24 min outside the builders) is the next proposal.
5. **Pre-registered kill rule:**
   - any small run below 151/151, or any medium run below 285/289, reverts the change;
   - becoming the default needs 289/289 on both medium runs (§5).

---

## §1 · Evidence

| Fact | Source |
|---|---|
| Builder wall time per run (sum):<br>• FM-3: 54.8 min<br>• FM-5: 61.0<br>• FM-9: 66.1 (10 builders, K = 2)<br>• F-4: 9.6<br>• F-5: 11.7<br>Model share is 63-83 %. | `pandacorp-bench-medium/runs/FM-{3,5,9}/wf_*/agent-*.jsonl`, `pandacorp-bench-form/runs/F-{4,5}/` |
| Tool time, all 5 runs:<br>• ad-hoc Playwright: 21.4 min (62 runs)<br>• `verify.sh`: 13.0 (32 runs)<br>• vitest: 9.5 (189 runs)<br>• screenshot side-checks: 6.4<br>• `commit-wo`: 2.3 (67 calls) | same |
| Chars written, builder vs vanilla:<br>• FM-9: 600k, of which unit 295k, e2e 88k, app 139k<br>• V-1: 132k, of which unit 35k, e2e 12k, app 81k | same, `runs/V-1/stream.jsonl` |
| Vanilla, whole app:<br>• V-1: 12.1 min, 52 turns, 289/289<br>• V-2: 11.5 min, 285/289; **all 4 misses are dialog focus traps** (M-232/239/330/337)<br>• B-3: 5.5 min, 151/151<br>• B-4: 2.6 min, 151/151 | `runs/V-{1,2}/`, `pandacorp-bench-form/runs/B-{3,4}/` |
| FM-3, FM-4, FM-5, FM-7, FM-9: all 289/289 at USABLE. The small oracle is 151/151 in all 16 runs, vanilla included, so it is **saturated** and cannot detect a regression. | `runs/results.md`, `runs/V-2/V-2.json` |
| **No fix-forward ran in FM-3/5/9** (no `fix:` meta label). Every engine verify was green first time, because the builders' own e2e absorbed the reds. | `*.meta.json` |
| `commit-wo` `ac-uncited` refusals: 19 (FM-3 3, FM-5 9, FM-9 7). They were partial: the AC ids were already in the prompt (`woCtx` → `acText`), but sub-ACs got skipped. | transcripts; `pandacorp-build.src.js` `woCtx` |
| Self-verify reds: 6. **2 real** (STRUCT-2 data-layer); 4 were environment or partial-build artifacts (knip on a dependency that a later WO uses; flakes). **6 verify re-runs only recovered an exit code hidden by `\| tail`.** | transcripts |
| Orientation before the first write: 0.5-2.4 min per builder, 23.5 min in total. At least 9 builders `cat` `verify.sh`. Peak context 107-459k tokens. | transcripts |
| `implementer.md` asks for the full suite per WO, 3 fidelity cycles and a memory INDEX read, contradicting the fast prompt's "verify ONCE". | `plugin/agents/implementer.md` |
| Engine verify runs `bash .pandacorp/verify.sh` with no args, i.e. the full Playwright suite before USABLE. The DR-125 gate runs **after** USABLE. | `build-mech-verify.mjs:186` |

---

## §2 · Decisions after the red-team

| # | Change | Mechanism | Saving per medium run (PROJECTION) | Risk | Bound | DR |
|---|---|---|---|---|---|---|
| C1 | **Unit-test budget.** Grouped AC citation; **one behaviour e2e spec per UI FRD is kept** | `fastBuilderPrompt`:<br>• about one unit test file per WO module;<br>• unit-test chars ≤ production chars;<br>• an `it`/`describe` title may cite **at most 3** AC ids.<br>• Each UI FRD keeps or extends one e2e spec covering the primary flow plus, for every dialog, Escape, the focus trap and the return of focus.<br>• `acCitation` is unchanged. `commit-wo` reports `max_acs_per_it` in its receipt (advisory, measured). | 5-9 | Fewer self-written regressions | Floor unchanged; the cap stops one assertion covering many ACs; the behaviour e2e covers V-2's miss class; §5 kill rule | DR-126 (amends 124/125) |
| C2 | **AC ids to cite, printed up front** | `fastWoBrief` prints `cite: AC-…`, the exact list `woAcIds` checks, sub-ACs included | ~1 | None | — | — |
| C3 | **Narrowed self-verify** | `fastSelfVerify` becomes `verify.sh --since <base> --only=structure-guard,data-layer,api-error-contract,biome,tsc,vitest` (no knip, madge, doc-lint, residual-ambiguity).<br>Then **the FRD's own e2e spec files once**, plus one `--last-failed` re-run per fix.<br>Forbidden: whole-file re-runs, temporary screenshot specs, `next dev`/`next build`.<br>The verdict comes from `.pandacorp/run/gate-report.json` or `; echo EXIT=$?`, never `\| tail` alone. | 3-6 | e2e reds found later | Own specs still run in-loop; the engine's full verify (DR-055/074/075) still gates USABLE | DR-106, DR-125 (verify dedupe), via DR-126 |
| C4 | **Tests written with the code** | Code and tests for a WO in the same batch, then one vitest run on that WO's files; RED-first is no longer required. `preserved-tests` (DR-107) and `vitest related` in `commit-wo` stay. **Two in-context repair attempts stay.** | 2-3 | Tautological tests | Oracle; the behaviour e2e (C1); the post-USABLE gate probes | TDD exception for the fast lane, in DR-126 |
| C5 | **Lean `fast-builder` agent, inlined context** | New `plugin/agents/fast-builder.md`. It carries verbatim: the forbidden list (`any`, `@ts-ignore`, secrets), the DR-080 acceptance-suite ban and the "never declare done falsely" rule.<br>`fastWoBrief` inlines:<br>• blueprint sections for the CMP/IF ids the WO cites;<br>• the mock path;<br>• the exact commands;<br>• Status Notes of the WOs it depends on, **only when that dependency's commit is an ancestor of the builder's base** (otherwise it says "Read it").<br>Memory retrieval moves to the plan: LESSON ids are cited in the WO. The classic lane keeps `implementer`. | 2-3 | A seam missed; a lost guarantee | Read on demand; clauses copied verbatim; `EMIT('implementer')` telemetry unchanged | DR-047 (retrieval point), via DR-126 |
| C6 | **Fewer turns** | The prompt asks for all of a WO's files in 1-2 heredoc or parallel Write calls, and for chained checks. **One fidelity script per FRD** renders every UI WO's route and screenshots it next to its mock. | 2-3 | None | The script covers each UI WO's mock (DR-056 in-loop check) | DR-056 kept |
| C7 | **Sonnet at effort `medium`**, behind a flag, **off by default** | `fastBuilder` `effort`: `args.builderEffort` for sonnet (default unset = today); opus keeps `high`. | 2-4 (not verified) | More first-pass bugs | Opus rungs (DR-073/108); flipped only after §5.3 | DR-073/108, CONV-12 |
| **Σ** | | | **15-20 summed, after overlap** | | | |

### Rejected or kept as is

- **Ban on new e2e specs (design C1): rejected.** V-2 lost exactly the dialog-focus class, which only behaviour e2e catches.
- **Unlimited multi-AC `it` (design C1): rejected.** Under it, the regex floor stops meaning anything.
- **One self-repair attempt (design C4), and dropping self-verify (vanilla profile): rejected.** No fix-forward ran in three medium runs because the builder repaired in context; a fresh fix-forward costs orientation plus two full verifies and, under lanes, holds the main mutex.
- **Relaxing the S3 floor to per-WO coverage: rejected.** The volume came from how the prompt was read, not from the floor (a grouped citation already passes). With C2 the floor costs about 1 min.
- **Batching `commit-wo` / dropping its related tests: kept.** Saving < 1 min; `fastRecommit` needs it as mechanical proof; DR-097/107 revert targeting needs one commit per WO.
- **Handing the engine's red verify back to the builder's context: not possible.** A Workflow `agent()` cannot be resumed. Fix-forward instead gets the failing test names plus the Status Notes.

---

## §3 · PROJECTION

| | Today (measured) | After (C7 off) | After (C7 on, unverified) | Vanilla |
|---|---|---|---|---|
| Medium builder, summed | 54.8-61.0 (sequential) / 66.1 (K = 2) | 38-43 / 47-51 | 36-41 / 45-49 | — |
| Medium all-USABLE | 67.8 (FM-3) / 56.9 (FM-9) | 50-54 / 47-49 | 48-52 / 46-48 | 11.5-12.1 |
| Small builder | 9.6-11.7 | 7.5-9 | 6.5-8 | — |
| Small USABLE | 8.0-11.8 | 7-9.5 | 6.5-8.5 | 2.6-5.5 |

- **Overlap counted once:** C1 owns test-tied thinking; C7 applies only to what remains; C4/C5/C6 share turn latency (lower bound taken); C3 excludes e2e spec generation.
- **Engine time outside the builders** is about 13 min (FM-3) and about 24 min (FM-9). Getting medium to ≤ 30 min also needs land/verify/lane-USABLE work, plus one builder per FRD inside a lane: FM-9 paid orientation 10 times. **That is out of scope here** and is filed as the next proposal.

---

## §4 · Phased implementation

Each phase ships alone. Tests go in `plugin/scripts/test-pandacorp-build.mjs` (mech ops in `test-build-mech.mjs`). Every phase bumps `plugin/runtime/plugin-metadata.json` (MINOR: builder behaviour changes), regenerates the manifests, and bumps OVERLAY_VERSION, because the engine is an overlay file. Each phase also records DR-126 and gets a `plugin/docs/decision-log.md` entry.

| Phase | Ships | Named tests |
|---|---|---|
| 1 · Brief and self-verify | C2, C3, C6 | `fast-wo-brief-lists-every-cited-ac-id`<br>`self-verify-only-excludes-knip-madge-doclint`<br>`self-verify-command-surfaces-exit-code`<br>`builder-prompt-forbids-next-dev-and-shot-specs`<br>`builder-prompt-own-specs-once-plus-last-failed`<br>`builder-prompt-one-fidelity-script-per-frd` |
| 2 · Test budget | C1, C4 | `builder-prompt-carries-test-budget`<br>`builder-prompt-requires-behaviour-e2e-for-ui-frd`<br>`builder-prompt-keeps-preserved-tests-restore`<br>`ac-citation-grouped-title-passes`<br>`ac-citation-missing-sub-ac-refuses` (floor regression)<br>`commit-wo-receipt-reports-max-acs-per-it` |
| 3 · Lean agent | C5, `generate-codex-agents.mjs` | `fast-builder-agent-carries-forbidden-dr080-done-clauses`<br>`fast-lane-uses-fast-builder-classic-uses-implementer`<br>`status-note-inlined-only-when-dep-is-ancestor-of-base`<br>`lane-builder-told-to-read-unlanded-dep-note`<br>`implementer-telemetry-emit-unchanged`<br>`codex-mirror-exists-for-fast-builder` |
| 4 · Effort flag | C7 | `builder-effort-unset-by-default`<br>`builder-effort-flag-sets-sonnet-medium`<br>`opus-builder-keeps-high-effort` |

Standards follow in Phase 2's change: `factory/standards/build-orchestration.md` §5d; the TDD clause in `quality-and-testing.md` (fast-lane exception citing DR-126); `plugin/agents/implementer.md` step 2 (points to `fast-builder` in the fast lane).

---

## §5 · Measurement (pre-registered)

**Arms:**

| Arm | What it is | Runs |
|---|---|---|
| F | Today's measured runs | FM-3, FM-5, FM-9, F-4, F-5 |
| F2 | Phases 1-3, C7 off | small F-6/F-7, medium FM-10/FM-11, K = 2 |
| F2e | F2 plus `builderEffort: medium` | small F-8/F-9, medium FM-12/FM-13, K = 2 |

**Recorded every run:** oracle at USABLE and final; T_usable per FRD and all-USABLE; summed builder minutes; output tokens and turns per builder; `ac-uncited` refusals; Playwright runs per builder; duplicate verify runs; `max_acs_per_it`; fix-forwards; unit/e2e/app chars.

### 5.1 Kill (any arm, any run)

- **Small:** any run below 151/151 at USABLE or at final.
- **Medium:** any run below 285/289.

On a kill, revert first the change whose class lost the points:
- dialog, keyboard or a11y misses → C1's e2e part and C3;
- logic and boundary misses → C1's unit budget and C4.

Then re-run once.

### 5.2 F2 becomes the default if all of these hold

- **Medium oracle: both FM-10 and FM-11 at 289/289.** The small oracle is saturated and cannot carry the decision. A run at 285-288 is not a kill, but it blocks the default until a third run scores 289/289.
- **Medium all-USABLE:** median ≤ 50 min. **Summed builder time:** ≤ 52 min (vs 66.1).
- **Small:** 151/151 both runs; median USABLE ≤ 9.5 min.
- **Mechanism checks:**
  - `ac-uncited` ≤ 2 per medium run;
  - 0 duplicate verify runs;
  - Playwright runs ≤ 2 + fixes per UI builder;
  - output tokens ≤ 260k per medium run.
- **Fix-forwards:** ≤ 1 per medium run. More means C3 pushed reds downstream: restore the previous self-verify.

### 5.3 C7 is flipped on only if all of these hold

- FM-12 and FM-13 both score 289/289, and F-8/F-9 both score 151/151.
- Summed builder minutes are ≥ 3 below the F2 median.
- Fix-forwards are no more than in F2.

Otherwise the flag stays off.

---

## §6 · Red-team record

| # | Objection | Disposition |
|---|---|---|
| R1 | Vanilla at 1/7 the test volume is not "100 %": V-2 lost 4 points, all dialog focus traps, the class only behaviour e2e catches. A ban on new e2e leaves dialogs and keyboard flows unexercised before USABLE. | **Accepted.** One behaviour e2e spec per UI FRD (primary flow plus Escape, trap and return for every dialog). |
| R2 | A regex floor with unlimited multi-AC `it` titles is satisfied by one assertion. | **Accepted.** Cap of 3 per title; the receipt measures it. Not a refusal, because a refusal brings back the rework turns C2 removes. |
| R3 | The small oracle is saturated, so "3 of 4 runs" would pass a V-2-style regression. | **Accepted.** The default needs both medium runs at 289/289 (§5.2). The owner's floor of ≥ 285/289 stays as the kill line. |
| R4 | The AC ids are already in the prompt, and the refusals came from skipped sub-ACs. A 2-4 min saving is overstated. | **Accepted.** C2 prints the exact checked list; saving restated as about 1 min. |
| R5, R6 | Zero fix-forwards in three runs means the builder's e2e kept the engine green. Moving those reds costs a fresh agent plus two full verifies, and with lanes it holds the main mutex. | **Accepted.** C3 is narrowed: the FRD's own specs run once, plus `--last-failed`. Two in-context repair attempts kept. A fix-forward ceiling is in §5.2. R6's surviving pieces (no knip/madge, readable exit, no shot specs or `next dev`) ship as stated. |
| R7 | DR-125 probes run after USABLE, so they do not bound tautological tests before USABLE. | **Accepted.** The bound is restated as the oracle plus the behaviour e2e. `preserved-tests` and `vitest related` are kept. The TDD exception is recorded in DR-126. |
| R8 | A 15-line agent drops the forbidden list, the DR-080 ban and the false-done rule. | **Accepted.** Copied verbatim and tested. |
| R9 | Status Notes inlined in a lane can be stale when the dependency landed on another chain. | **Accepted.** Inlined only when the dependency's commit is an ancestor of the builder's base; otherwise the builder is told to Read it. |
| R10 | Codex mirrors and Mission Control telemetry. | **Accepted.** Regenerate the mirrors. The telemetry keys on `EMIT('implementer')`, which is unchanged; a test pins it. |
| R11, R12 | Fidelity script must satisfy DR-056 per UI WO; flip C7 only after ≥ 2 medium runs per arm at 289/289. | **Accepted** (C6, §5.3). |
| R13 | The savings are double-counted (C1/C7 thinking; C4/C5/C6 latency; C3/C1 e2e generation), and the 25 % discount is arbitrary. | **Accepted.** §3 counts each overlap once: 15-20 summed minutes. The ≤ 30 min medium target is declared out of reach without engine work. |

No red-team condition was rejected. Three design ideas were withdrawn: the e2e ban, unlimited multi-AC titles, and the single repair attempt.

---

## Orchestrator decision (2026-10-03, owner-delegated)
Implement C1-C6 and C7 (builder effort medium) together. To save subscription usage, measure ONE configuration (C7 on): small bench n=2, medium bench n=1 with lanes K=2. Kill/acceptance as pre-registered (small 151/151 both runs; medium 289/289; medium all-USABLE <= 50 min). If accepted, C7 ships ON by default (DR-126); if quality drops, re-measure with C7 off before deciding.
