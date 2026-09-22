---
id: BL-0157
type: bug
area: build-engine
title: "enforceWholeFrdTraceability stamped a brand-new {green:false, failure} object over EVERY deficient verdict — destroying a reject's reopen/findings and forcing a deficient-but-green re-gate to block 'error' with no retry and no logged class"
status: done
severity: p1
opened: 2026-09-22
closed: 2026-09-22
source: "canary C forensics (wf_1cf782d6-2ed, FRD-23, canary-c-forensics.md §1/§5/§7) — a whole-project verify.sh scope full ran GREEN (11/11 sub-gates) while the FRD ended BLOCKED (error), traced entirely to the traceability oracle, never the built code"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js enforceWholeFrdTraceability + gateConverge + inRunRetry"
links: [BL-0149, BL-0150, BL-0155, BL-0156]
---

## Problem
`enforceWholeFrdTraceability` (`pandacorp-build.js:744-750` pre-fix) requires at least one
`traceability` entry per `contractClass`, one of 7 (`requirement`, `acceptance-criterion`,
`invariant`, `edge-case`, `limit`, `error`, `exclusion`). When a verdict's inventory was deficient —
FRD-23's two reviewers covered every `REQ-*` only through its acceptance criteria, never writing a
standalone `requirement` entry — the function returned a **BRAND-NEW** `{ green: false, traceability,
failure }` object for every deficient case, silently DESTROYING whatever the real verdict carried:
`reopen`, `findings`, `missingFoundation`, `blocked_reason`.

Two confirmed effects in canary C (`wf_1cf782d6-2ed`, FRD-23, `canary-c-forensics.md`):

1. **Gate 1** returned a legitimate localized reject — `reopen: ['WO-23-007']` + 3 concrete findings
   (a `readFileSync` missing a null-guard, a missing wo-\*.md listing in the seal, a docstring gap).
   The oracle wiped `reopen`/`findings`, so `gateConverge` read a bare "no specific reopen" failure and
   skipped the DR-073 patch-first path straight to `attemptRepair` — an opus xhigh fixer given NO
   findings, forced to rediscover them by reading the engine source and the reviewer's own test
   (confirmed in its transcript, 49 tool calls where a findings-fed patch would have taken a handful).
2. **Gate 2** (the post-repair re-gate, on `main`) returned a genuinely clean `green: true` —
   `verify.sh` scope `full` was 11/11 GREEN — but the SAME 30-entry inventory again lacked
   `requirement`. The oracle converted it to `{ green: false, failure }` with **no** `blocked_reason`.
   `gateConverge`'s only remaining branch (`Gate failed with no specific reopen → TRY TO REPAIR`) had
   already been exhausted this cycle, so it fell to `blockFrd(f.frd, reason)` with `reason` defaulting
   to `'error'` — no second attempt, no `apply-gate`, and no log naming which class was missing.
   `WO-23-007` was left `IN_REVIEW` forever (never stamped `VERIFIED` despite the code being correct),
   `track.jsonl` has an unclosed `review_start`, and `notify-end`'s owner-facing `progress.md` narrated
   a false "needs your decision to apply the fix" when the fix was already committed and green.

Sibling finding (same run): the Codex executor's `validateReviewResult`
(`plugin/runtime/codex/executor.mjs:210-215`) has the SAME strict all-7-classes check, but THROWS
(`INVALID_RESULT`) instead of silently rewriting the object — a different failure shape (a hard abort
vs a data-destroying downgrade), and Codex is frozen read-only (DR-120) in every product project, so
it is noted here, not fixed: the throw path does not exhibit BL-0157's "destroys reopen/findings"
symptom, and changing its retry semantics without a live Codex build to test against would be
speculative. Left for a future BL if Codex is ever un-frozen.

## Root cause
`enforceWholeFrdTraceability` treated "the reviewer's traceability inventory is incomplete" as
INTERCHANGEABLE with "the code itself is broken" — both collapsed into the same generic
`{ green: false, failure }` shape, discarding every other field the real verdict carried. A reviewer
INVENTORY gap (a format/completeness defect in how the verdict is REPORTED) is not evidence the BUILD
failed; conflating the two meant a locally-fixable format gap paid the cost of, and inherited the
blocking semantics of, a genuine code red.

## Fix plan (B1 + B2 + B3)
1. **B1** (`enforceWholeFrdTraceability`): a result that is already a REJECT (`result.green !== true`)
   now keeps every field it returned (`{ ...result, ... }`) — only a traceability note is appended to
   `failure`. A GREEN result is the only shape still overridden, and only when the SOLE defect is
   `missing` contract classes (not `invalidBoundary`/`waivedFailure`, and not a null/garbled result —
   those keep the pre-fix hard-fail contract, since they are evidence of a genuine problem, not a
   reviewer paperwork gap): it downgrades to `{ green: false, traceabilityDeficient: true,
   missingClasses, failure }`, never stamped `VERIFIED`. The log always names the missing class(es).
2. **B2** (`gateConverge` + `inRunRetry`): a result with `traceabilityDeficient` and no `reopen` list
   re-asks the SAME serial gate exactly ONCE — a directive naming the missing class(es) verbatim — via
   a new `traceabilityReasked` flag that makes a second consecutive re-ask impossible (recurses into
   the normal ladder with the flag set). If the re-ask is still deficient, it blocks `needs-owner`
   (`persistGateBlock` + `blockFrd`) — never the generic `attemptRepair` (an implementer editing
   production code for a formatting gap) and never the default `'error'` reason. A reject WITH a
   `reopen` list (deficient or not) is untouched — it still takes the normal DR-073 patch-first path.
3. **B3** (`WHOLE_FRD_ORACLE` + the `traceability` schema description, both driven from
   `plugin/agents/reviewer.md`'s canonical `<!-- WHOLE_FRD_ORACLE_START -->` block, regenerated via
   `plugin/scripts/generate-build-prompt-fragments.mjs`): states explicitly that each of the 7 classes
   needs >= 1 entry, that a `REQ-NN-MMM` requirement is its OWN `requirement` entry distinct from its
   acceptance-criterion entries, and that a genuinely inapplicable class gets a `not-applicable` entry
   with `tests: []` instead of being omitted — the exact gap that caused FRD-23's reviewers to omit
   `requirement` twice in a row while believing their inventory was complete.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-pandacorp-build.mjs` — R1/R2/R3 (new), exercising the REAL oracle path (the
harness only auto-fills `traceability` when the key is absent, so each fixture passes an explicit,
incomplete array):
- **R1** — replica of canary C gate 1: a REJECT with `reopen` + `findings` and an incomplete
  traceability (missing `requirement`). Asserts `patch:` fired, `repair:` did NOT, and the specific
  finding text reached the patch prompt (proof `reopen`/`findings` survived the oracle).
- **R2** — a deficient GREEN followed by a complete GREEN. Asserts exactly 2 `gate:` calls (one
  re-ask, not a loop), zero `repair:` calls, one `apply-gate:` call, and the FRD verifies.
- **R3** — two deficient GREENs in a row (replica of canary C gate 2). Asserts exactly 2 `gate:`
  calls, zero `apply-gate:`/`repair:` calls, one `persist-block:` call, the FRD ends `blockedFrds` with
  `blockedReasons['frd-r3'] === 'needs-owner'` (never `'error'`).

Existing invariants re-verified, not just re-run: `WP06f` (a green verdict missing the 7 classes in
digested mode is still rejected, never stamped) and `G2`/`G2b` (a NULL gate result and a
`waivedFailure` contradiction both still block `'error'` through the pre-existing generic
`attemptRepair` ladder — confirming B1's scope guard correctly excludes them from the new re-ask path)
all pass unmodified. `test-whole-frd-gate-contract.mjs` passes (the 7-class wording, the
`enforceWholeFrdTraceability`/`waivedFailure` identifiers, and the Codex cross-check all still hold).
`bash plugin/scripts/run-engine-tests.sh` — 23/23 suites, 0 failures.

## Done when
- [x] `test-pandacorp-build.mjs` R1/R2/R3 green; WP06f/G2/G2b unmodified and still green.
- [x] `test-whole-frd-gate-contract.mjs` green.
- [x] `bash plugin/scripts/run-engine-tests.sh` green (23/23 suites).
- [x] `mission-control/.claude/engines/pandacorp-build.js` re-synced byte-identical to the template
      (`cmp` confirmed) and `mission-control/.pandacorp/status.yaml`'s `overlay_version` bumped to
      match.
- [x] `claude plugin validate plugin/` passes.
- [x] `plugin/agents/reviewer.md`'s canonical block edited (not the generated engine constant by hand)
      and `.codex/agents/reviewer.toml` regenerated via `generate-codex-agents.mjs`.

## Out of scope
- The Codex executor's `validateReviewResult` (`plugin/runtime/codex/executor.mjs:210-215`) shares the
  strict all-7-classes contract but fails differently (a thrown `INVALID_RESULT`, not a silent object
  rewrite) — noted above, left unfixed (Codex is frozen read-only, DR-120; no live Codex build to
  verify a retry-semantics change against).
- Re-running canary C (or an equivalent FRD-23-shaped build) live to confirm the fix converges the real
  scenario end-to-end — this item is fixed and unit-tested against a faithful replica of the two
  observed verdicts, not yet re-validated against a fresh live build.
