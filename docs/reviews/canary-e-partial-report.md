# Canary E — partial run report (usage-limit cut)

- Run: workflow `wf_7a12ea20-7f1`, engine 9.112.0 (overlay 8.89.0, engine byte-identical to
  `plugin/templates/shared/.claude/engines/pandacorp-build.js`), branch `canary-e-parallel-gates`
  (worktree `/Users/Shared/Proyectos/panda-corp-canary-e`), replay base `c575adfc`, `last_green_sha` at launch `d9addc89`.
- Args: `mode:powerful, maxAgents:40, parallelGates:true, gateSlots:2, gateEvidence:"digested"`, 4 FRDs (02/03/04/05).
- Launched 21:27:41Z; first agent 21:28:11Z. At ~22:03:31Z the owner's usage limit hit: 11 agents failed with
  0 billable calls (`<synthetic>` in the rollup). Everything after 22:03:31Z is invalid data.
- Engine result: `blockedFrds:[frd-02]` (the 429'd re-gate returned nothing, so traceability "missing all 7 classes"),
  `reopenedFrds:[frd-03]`, `stopReason:"agents"` (weighted ceiling 46 ≥ 40).
- Lease released after the run (`release` → `quiesced_at 2026-09-26T00:02:57Z`, `status` → `lease:null`,
  `status.yaml running:false`). Gate slots `gate-worktree-1/2` kept (detached at `e045b293`).
- Measurement: `usage-rollup.mjs` (9.112.0, BL-0181 dedupe) appended to the canary's `.pandacorp/track.jsonl` as
  `usage_summary` with `partial:true`, `corrected:"BL-0181"`.

## 1. Verdict

| What | Status in E | Evidence |
|---|---|---|
| D1 parallel gates: 2 slots created and used, concurrent evidence and gates | **Confirmed live** (max concurrency 2, 0 legacy fallbacks, slot salvage via `gate-release` worked twice) | engine log lines 11-14; rollup `concurrency_max:2` |
| D1 throughput | **Not realized.** The landing lane blocks new gate launches (§3), and a stalled evidence collector delayed FRD-02 (§4.3). The two opus gates overlapped only 1.1 min. FRD-04/05 never started a gate in 36 min | usage table §4 |
| `gateEvidence:"digested"` in the nested project (BL-0187) | **Confirmed live**: both collectors BOOTSTRAPPED, reports parsed, **0 `GateEvidenceFallback`** events on 2026-09-25 (the last ones are 2026-09-22) | `dashboard-events.ndjson`; journal #13/#15 |
| digested cost | **Strong signal (n=1)**: gate+evidence 2.51 $ (FRD-03) and 1.72 $ (FRD-02) vs D2 5.77 $ and 7.48 $ (−57 % / −77 %) | §4 |
| digested finding parity | **Mixed.** FRD-03: re-found D2's date-validation CORRECTION, plus a stronger finding D2 missed (the chip was mounted only in the unmounted `PortfolioTable`). FRD-02: **lost** D2's REQ-02-010 / AC-02-010.4/.8 drift. The reviewer read those ACs, mapped AC-02-010.4 to the existing CampaignPipeline tests, and passed them. Cause not attributable (stochastic judge vs digested) at n=1 | journal #17/#27 vs D2 journal |
| DR-122 (a*) differential drift proof | **Confirmed live on FRD-03**: REQ-03-001 claimed pre-existing, probe RED 2/2 at pin `e045b293` and 2/2 at base `d9addc89`. It was adjudicated PROVEN, excluded from the inherited fails, recorded as draft card `frd-03-portfolio-drift-req-03-001.md`, and put in `drift: [REQ-03-001]` in the frontmatter. Cost 0.02 $ and 0.6 min. **Not exercised on FRD-02** (no claim was made, see parity) | log lines 18-19; journal #19/#21; commit `a824bf2f` |
| C2/BL-0184/BL-0182 plumbing | **Confirmed**: reviewer tests salvaged, then ported sha256-pinned onto main, then hash re-checked before verify. `unport` and the stale-pin guard ran only as 429 failures, so they are **not validated** | journal #23/#25/#32 |
| New defect | **BL-0191**: a correct patch was refused post-certification and "reverted" (§2) | engine log line 22 |

## 2. Why FRD-03 went `pass` → `revert` (confirmed cause)

Sequence (canary `track.jsonl` + journal): the gate rejected FRD-03 at 21:45:13 (`reopen WO-03-006`, 2 findings,
3 open fails + 1 drift claim). `patch` returned green, then `verify-patch` returned `green:true` with every inherited
contract `pass:true`. That verifier, as its prompt instructs, **already committed** VERIFIED, `frd_end`,
`review_end pass` (21:58:38), `last_green_sha: a824bf2f` and the snapshot publication `1acb4fee`. Only **after** that
did the engine downgrade the verdict to red and run `revertAndReopen`.

**Cause: a false negative in the BL-0178 inherited-contract matcher** (`pandacorp-build.js:2818-2826`):

- The inherited fails were REQ-03-007, AC-03-007.2 and an **id-less** `error`-class contract ("Error — unparseable
  last sync SHALL show an explicit invalid-date chip…"). REQ-03-001 was excluded correctly as proven drift.
- The prompt lists each one as `• [<class>] <contract> — the gate's tests: <files>` (`:2796`) and asks for
  `contract: <its text VERBATIM as listed>`. The verifier echoed `error: Error — … — the gate's tests: …`.
- The matcher accepts `norm(r.contract) === norm(e.contract)` or equal `contractIdOf()`. The two REQ/AC contracts
  matched by id. The id-less contract can only match exactly, and the class prefix plus the tests suffix that the
  prompt itself adds make an exact match impossible by construction.
- Engine log (line 22): `⛔ frd-03-portfolio: the post-patch verifier claims GREEN but 1 inherited fail contract(s)
  are not proven closed (Error — unparseable last sync …) — REFUSING to certify (BL-0178)`. Replaying the matcher
  offline over the journal's gate traceability and `inheritedResolved` reproduces `OPEN: [the error contract]`.
- The verifier *did* prove that contract: `pass:true`, `tests:[frd-03-last-sync-rail.reviewer.test.tsx,
  formatLastSync.review.test.ts]`.

**Second, latent defect exposed:** the refusal comes after the certifier's side effects, and nothing compensates for
them. `last_green_sha` already pointed at `a824bf2f`, the commit that contains the patch. So `revert` had nothing to
check out (it said so explicitly, "the rebuild starts from the same WO-03-006 code the gate just rejected"). The
"in-run retry from the clean base" (`build:WO-03-006`, opus) produced `f4824d69`, which changes only the WO doc and
no `src/`. For a *genuine* refusal this path would leave rejected code as `last_green_sha` and never discard it. The
WP-08 partial-report cage in the same function has the same post-hoc shape.

Ruled out:

- The stale-pin guard and `landParallelVerdict` re-verify. FRD-02 never landed, and its `stale-pin`/`reverify` were
  429 failures after the revert.
- Untracked tests from another FRD (BL-0183/0184). The refusal is a pure engine-side string match. No verify.sh run
  was involved.
- `emitGateOutcome`/`finalizeGate`. `finalizeGate` stashed exactly the 3 open fails and excluded the adjudicated drift.

Main did advance during the ladder, but only through FRD-03's own commits: `95d03eab` patch, `a824bf2f` certify,
`1acb4fee` publish, `5909f454` reopen, `f4824d69` rebuild.

Waste from this defect: revert + rebuild + commit cost **1.28 $ and 4.1 min**, and the re-gate was already launched
(D2-equivalent ≈ 2.5 $ and 10 min) when the 429 hit. → **BL-0191**.

## 3. The landing lane blocks new gates (confirmed)

`pandacorp-build.js:4104`: `if (gateResults.length) { await landParallelVerdict(); continue }`. The landing,
including a whole `convergeOne` ladder (port, patch, verify, revert, in-run retry build, re-gate), is awaited inline
at the loop top. `launchParallelGates()` is only reached at `:4165`, after it. Launches also have no deferral log for
FRD-04/05 (`logGateDeferral` never fired), which confirms that `launchParallelGates` never ran with a free slot:

- Slot 2 was free from 21:47:04 (after `gate-release:frd-03`) and slot 1 from 21:51:41 (after `gate-release:frd-02`),
  until the cut at 22:03:31. That is **≈ 28 slot-minutes idle**, and live gates = 0 from 21:51:41.
- FRD-04/05 were gate-ready from the start and **never started a gate in 36 min**.
- FRD-02's PASS sat unlanded in `gateResults` for **12 min** (21:51:41 → 22:03:38) behind FRD-03's ladder. The
  ladder's commits then made FRD-02's pin stale, so it would have paid a stale-pin re-verify it would not otherwise
  need.

Landing needs a quiet **main**, not the slots: slots are detached worktrees at their own pin, and the stale-pin guard
already re-verifies any PASS whose pin main has moved past. → **BL-0192**.

## 4. Measurement (valid part only, BL-0181-deduped, cache-write excluded as in D2's 36.24 $)

### 4.1 Per agent (E)

| Agent | Model | Start (Z) | Min | $ |
|---|---|---|---:|---:|
| baseline-precheck | haiku | 21:28:11 | 0.9 | 0.06 |
| plan | opus | 21:29:05 | 1.8 | 0.82 |
| pin + gate-worktree:1/2 | haiku | 21:30:55 | 0.5 | 0.06 |
| evidence:frd-02 | haiku | 21:31:24 | **13.5** (10.0 stalled, §4.3) | 0.10 |
| evidence:frd-03 | haiku | 21:31:25 | 4.4 | 0.09 |
| gate:frd-03 | opus | 21:35:47 | 10.2 | 2.42 |
| gate:frd-02 | opus | 21:44:52 | 6.3 | 1.62 |
| drift-proof + drift-record:frd-03 | haiku | 21:46:01 | 0.6 | 0.02 |
| gate-release ×2 | haiku | 21:46 / 21:51 | 1.0 | 0.08 |
| port-reviewer-tests + reviewer-test-hash:frd-03 | haiku | 21:47:04 | 0.7 | 0.06 |
| patch:frd-03 | opus | 21:47:29 | 8.4 | 4.62 |
| verify-patch:frd-03 | sonnet | 21:56:11 | 3.2 | 0.93 |
| revert:frd-03 *(BL-0191 waste)* | opus | 21:59:23 | 1.0 | 0.40 |
| build:WO-03-006 *(BL-0191 waste)* | opus | 22:00:24 | 2.0 | 0.77 |
| commit:WO-03-006 *(BL-0191 waste)* | haiku | 22:02:24 | 1.1 | 0.11 |
| 11 agents after 22:03:31 (429) | `<synthetic>` | 22:03 | 0 | 0 |
| **Total** | | wall 35.5 min | | **12.18 $** (+5.15 $ cache-write, estimated, not verified) |

By phase: Review 10.40 $, Plan 0.82 $, Build 0.88 $ (the no-op retry), Baseline 0.06 $.

### 4.2 E vs D2 (D2 = `wf_faf48b18-881`, corrected `usage_summary` in `mission-control/.pandacorp/track.jsonl`)

| Metric | E | D2 | Δ |
|---|---:|---:|---:|
| gate:frd-03, gate only | 10.2 min / 2.42 $ | 11.8 min / 5.77 $ | −14 % / −58 % |
| gate:frd-03, slot total (evidence + gate) | 14.6 min / 2.51 $ | 11.8 min / 5.77 $ | +24 % / −57 % |
| gate:frd-02, gate only | 6.3 min / 1.62 $ | 17.6 min / 7.48 $ | −64 % / −78 % |
| gate:frd-02, slot total | 19.8 min (≈ 9.8 without the stall) / 1.72 $ | 17.6 min / 7.48 $ | +13 % (−44 %) / −77 % |
| Verdicts | 03 reopen (2 findings + drift) · 02 pass | 03 reopen (date CORRECTION + drift) · 02 block (drift 02-010) | FRD-02 parity lost |
| patch + verify frd-03 | 11.6 min / 5.55 $ (bigger fix: rail + parser) | 5.5 min / 1.55 $ | not comparable (different findings) |
| Start → first verdict | 17.8 min (21:28:11 → 21:45:59) | 20.6 min (0 → 3.0 + 17.6) | −14 % |
| Max concurrency | 2 (opus gate overlap only 1.1 min) | 4 (builds; gates serial) | — |
| DR-122 differential proof | 0.02 $ / 0.6 min | n/a | — |
| `GateEvidenceFallback` | 0 | n/a | — |

The first-verdict figures are measured from the first agent's start. The plan's 17.5 and 19 min used a different anchor.

### 4.3 Extra finding: evidence collector stall (proposed BL, not filed)

`evidence:frd-02` (haiku) ran `verify.sh` without a Bash `timeout`. The run takes ~150 s, longer than the 120 s default,
so it was backgrounded. The agent then polled `until [ -f <MAIN tree>/.pandacorp/run/gate-report.json ]` for the full
600 s: that was the wrong tree, because the report is in the slot. The report was actually ready at ~21:34. **10 min**
of FRD-02's critical path were lost. `evidence:frd-03` passed `timeout: 300000` and did not stall. The collector
prompt (`pandacorp-build.js:1865-1873`) should mandate `timeout: 600000` and the absolute slot report path, or become
a deterministic script.

### 4.4 Honest projection of a full E (PROJECTION, not measured)

Assumptions: BL-0191 fixed (FRD-03 lands at ~21:59 on the first verify), BL-0192 fixed (FRD-04/05 launch into the
free slots at ~21:42/21:47), and the evidence stall fixed. FRD-04/05 gate times are D2's scaled by E's observed
gate-time ratios (0.36-0.86), and cost by E/D2 gate-cost ratios (0.22-0.44). FRD-04's patch is taken as D2's to E's
FRD-03 size.

- Gate segment (first gate → last landing): **≈ 39-46 min** vs D2 67 min (criterion ≤ 40 min: borderline).
- Run wall including close-out + visual-qa (12 min in D2): ≈ 62-69 min vs D2 87.5 min, where D2 also includes a
  17.6-min build phase that E does not have.
- Σ review (4 gates incl. evidence): ≈ 7-9.5 $ vs 24.61 $ (criterion ≤ 18.5 $: met by a wide margin, **if**
  parity holds).
- Run total: ≈ 19-23 $ vs D2 36.24 $ (≈ 32.6 $ excluding D2's build phase).
- **Budget caveat:** under `maxAgents:40` (weighted, opus = 3) E could not have finished 4 FRDs even without the 429.
  After the ladder, remaining budget was 8 units (log: split estimate 15 > remaining 8). Without BL-0191 it would be
  ≈ 15. That covers FRD-02's landing plus one gate + reopen ladder, not FRD-05. The D1/DR-122/BL-0184 machinery
  (worktrees, evidence, drift, port/hash/unport, stale-pin, release) adds ~10-15 MECH units per 4-FRD run that D2
  did not have.

## 5. Recommendation

**Relaunch E from `c575adfc` after fixing BL-0191 and BL-0192** (and preferably the evidence-timeout fix of §4.3),
with `maxAgents` ≥ 60.

Do not decide the defaults on this run yet:

- D1's throughput claim is unmeasured, because the lane blocked exactly the overlap D1 exists for.
- digested's cost win is strong, but its parity has one lost finding at n=1.

A relaunch costs **≈ 20-25 $ deduped** (≈ 26-32 $ including the unverified cache-write estimate) and ~65-70 min.

If the owner prefers not to spend it, what the current data *does* support:

- `gateEvidence:"digested"` for cost (−57 % to −77 % per gate), but only with a parity watch on drift findings.
- DR-122 `driftPolicy:"record"` stays the default: it worked end to end at 0.02 $.
- `parallelGates` must stay **off** until BL-0192 lands.

## 6. Not verified

- Whether digested or judge stochasticity caused FRD-02's lost drift finding (n=1).
- FRD-04/05 behavior under E. They never ran.
- The stale-pin guard, re-verify and unport paths. They only ran as 429 failures.
- The absolute cache-write cost. It is estimated at 1.25× input, not a verified rate.
- `vm_stat` contention (criterion `c`). It was not captured.
- The `last_green_sha` audit (BL-0190). It does not exist yet. Manually: `1acb4fee` published `a824bf2f` while
  the engine had refused FRD-03, which is exactly the violation class BL-0190 targets.
