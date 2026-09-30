---
id: BL-0209
type: bug
area: build-engine
title: "drift-record dispatch is asymmetric: FRD-02 and FRD-03 each got a drift-record agent after their drift-proof confirmed a preexisting claim, but FRD-04's equally-confirmed claim (REQ-04-003) never got one — no card, no frd.md drift: line"
status: done
severity: p2
opened: 2026-09-26
closed: 2026-09-30
source: "docs/reviews/canary-f1-report.md §4 and §5.2 (canary F1, explore mode + gateContextScope)"
closes: "same root cause and fix as BL-0206; tests BL-0209 root cause and BL-0209 b in test-pandacorp-build.mjs"
links: [BL-0201, BL-0178]
---

## Problem
Canary F1 ran three differential drift proofs to completion and inspected `drift-proof.mjs prove`'s raw
output directly (not the reviewer's paraphrase). `req-04-003.drift-probe.ts` (FRD-04, "the Summary tab has
no Mission Objectives bar") failed identically at HEAD and BASE — a textbook confirmed preexisting drift,
methodologically identical to the three others that DID get carded:

| Probe | HEAD | BASE | Verdict | Card filed |
|---|---|---|---|---|
| `ac-02-010-4.drift-probe.ts` | fail | fail | preexisting — correct | `frd-02-ideas-board-drift-ac-02-010-4.md` |
| `ac-02-010-8.drift-probe.ts` | fail | fail | preexisting — correct | `frd-02-ideas-board-drift-ac-02-010-8.md` |
| `req-03-001.drift-probe.ts` | fail | fail | preexisting — correct | `frd-03-portfolio-drift-req-03-001.md` |
| `req-04-003.drift-probe.ts` | fail | fail | preexisting — correct, **but no `drift-record` ran and no card exists** | none |

`frd.md` frontmatter confirms the asymmetry: `frd-02-ideas-board/frd.md:11: drift: [AC-02-010.4,
AC-02-010.8]`, `frd-03-portfolio/frd.md:10: drift: [REQ-03-001]` — but **FRD-04 has no `drift:` line at
all**, despite its own `drift-proof:frd-04` agent confirming REQ-04-003 preexisting in the same run. A real,
proven drift silently failed to reach `.pandacorp/inbox/changes/` — invisible to the owner, invisible in
`frd.md`, present only in the run's own transcript and `gate:frd-04`'s report text.

## Root cause
Not yet determined from the available transcripts (canary F1 §6 "Not verified": "Root cause of FRD-04's
missing `drift-record` dispatch (scheduling gap vs an intentional per-run cap) — not distinguishable from
the available transcripts without reading the engine's own dispatch logic"). Two live hypotheses to
distinguish by reading `plugin/runtime/engine/pandacorp-build.src.js`'s drift-record dispatch call site:
(a) a scheduling/ordering gap where FRD-04's dispatch was queued behind FRD-02/03's and something ended the
run before it fired, or (b) a deliberate but undocumented per-run cap on `drift-record` dispatches that
silently drops the Nth+1 confirmed claim instead of queuing or logging it.

## Fix plan
1. Read the `drift-record` dispatch call site (`startDriftFinder`'s sibling / wherever `drift-proof`'s
   confirmed-preexisting result triggers `label: 'drift-record:<frd>'`) and determine which hypothesis holds
   by tracing the actual gating condition against the F1 run's transcript order (FRD-02, 03, 04 dispatch
   order and any budget/cap check between them).
2. If (a) a scheduling gap: fix the ordering/await so every FRD with a confirmed preexisting claim this
   cycle gets its `drift-record` dispatch, regardless of how many other FRDs already got theirs in the same
   run.
3. If (b) a deliberate cap: make it EXPLICIT and LOUD — log which claim was dropped and why, and route the
   dropped claim into a next-run retry path (persist the pending record request keyed by contract id, so a
   later run's `drift-record` dispatch picks it up) rather than silently discarding proven evidence.
4. Either way: this is a fail-loud read/write boundary violation (DR-078) — a proven fact must never vanish
   without an explicit, loud reason. Add an engine-level invariant check: every `drift-proof` result with
   `verdict:'preexisting'` must correspond to either a `drift-record` dispatch this run OR an explicit,
   logged deferral reason — never neither.

## Tests (prove the fix — TDD, RED → GREEN)
- A regression test in `plugin/scripts/test-pandacorp-build.mjs`'s DR-122/drift-record scenarios: 3+
  concurrent FRDs each produce a confirmed-preexisting drift-proof result in the same run; assert ALL of
  them get a `drift-record:<frd>` dispatch (or, if a real cap exists by design, assert the dropped one is
  logged loudly and queued for next-run retry — never silently absent).
- A test anchored in the exact F1 shape: FRD-02, FRD-03, FRD-04 each confirm one preexisting claim in the
  same run; assert `frd.md` frontmatter carries a `drift:` line for all three FRDs, not two.

## Done when
- [ ] Root cause identified and documented (scheduling gap vs cap) in this item's Problem/Root cause
      sections (update this file with the finding).
- [ ] Fix lands per whichever branch of the Fix plan applies; the invariant check exists.
- [ ] The regression test above is RED before the fix and GREEN after.
- [ ] `factory/standards/build-orchestration.md`'s DR-122/drift-record section documents the invariant
      (every confirmed preexisting claim gets a dispatch or a logged, queued deferral).

## Out of scope
- The separate BL-0206 mech-relay JSON truncation defect (a different failure mode: a genuinely proven
  claim turned into a spurious reopen by a transcription error, not a dispatch that never happened).

## Root cause (found 2026-09-30 from the canary F1 run's own artifacts, not hypothesized)
Neither hypothesis (a) nor (b) held: **there was no asymmetric dispatch**. The engine's own run log for `wf_d8545504-d0a` says it: `frd-04-project-workspace: drift claim on REQ-04-003 is a CYCLE FAULT (cycle-fault: the probe is load-error at last_green_sha — unproven)`. `adjudicateDrift` only calls `recordDrift` for claims the engine classified `preexisting`; FRD-04's was classified a cycle fault, so `confirmed` was empty and no `drift-record` was owed (FRD-02/03 were classified `preexisting` — their log lines say so). The canary report's "confirmed preexisting" came from reading `drift-proof.mjs`'s raw stdout in the agent's tool result, which IS correct — but the engine never saw that text. Comparing the `drift-proof:frd-04` agent's Bash tool result with the `output` field it returned (agent `a413442d041689509`): the relay is 9 characters shorter (2212 vs 2221) and differs at exactly one place — `…"},{"parsed":true…` where the real line has `…"}],"base":[{"parsed":true…`. The mech dropped the `],"base":[` seam: **still valid JSON**, so it parsed, `probe.base` became `undefined`, `probeRunState(undefined)` = `load-error`, and the claim became a cycle fault (FRD-04 was reopening anyway for AC-04-011, so it cost no extra cycle; it lost the owner card). **This is the SAME root cause as BL-0206** (a model re-typing machine JSON), in its silent valid-JSON variant that BL-0206's own plan (a parse-error retry) could not have caught — which is why the fix is a seal, not a retry.

## Resolution (2026-09-30)
Fixed by BL-0206's seal + stored-copy re-read (see that item): the altered relay now fails the seal, the stored line is re-read, the claim is classified from the real facts (`preexisting`) and the `drift-record` is dispatched. **Invariant (Fix plan §4):** every confirmed pre-existing drift reaches a `drift-record` dispatch or a logged reason — `recordDrift` has no cap and no cross-FRD ordering dependence (`already recorded this run`, or the loud ⚠⚠ "card could NOT be written"); documented in `factory/standards/build-orchestration.md`. **Tests** (`test-pandacorp-build.mjs`): `BL-0209 root cause` (the exact F1 corruption — asserted to PARSE as valid JSON with `base` gone — is caught by the seal, re-read, and the drift-record IS dispatched; no "load-error at last_green_sha" verdict), `BL-0209 b` (three FRDs, one confirmed pre-existing drift each under `parallelGates`, the last one's relay altered exactly as F1: 3 `drift-record` dispatches and 3 `drift:` lines, never "two of three"). Both RED on the pre-change artifact.
