---
id: BL-0174
type: bug
area: build-engine
title: "blockFrd truncates `failure` to the first 200 chars, so a reviewer's praise-first prose buries the real blocking cause"
status: done
severity: p1
opened: 2026-09-25
closed: 2026-09-25
source: "canary D2 (wf_faf48b18-881), canary-d-frd02-forensics.md finding #2 (H4/#c)"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js blockFrd (~:2107) + the two `frdGateSerial`/`frdGateSplit` generic gate-fail prompts — F1"
links: [BL-0159]
---

## Problem
Canary D2's `gate:frd-02-ideas-board` verdict opened with praise for the passing work ("WO-02-014 ...
is CORRECT and must NOT be reverted. [...] The focused gate `verify.sh --since d9addc89` is GREEN
[...]") for over 200 characters BEFORE naming the actual blocking cause (two FRD-vs-build
contradictions in AC-02-010.4/.8). `blockFrd` (`pandacorp-build.js`, then ~line 2104) stored only
`String(failure).slice(0, 200)` into `blockedFailures`, so it kept exclusively the praise. The
close-out narrative (BL-0159's own quoting mechanism) then told the owner "solo falta tu OK a
WO-02-014" — false: WO-02-014 was fine, the FRD needed the owner to reconcile two stale acceptance
criteria. `decisions.md` (written separately, with the full untruncated text) was correct;
`progress.md` was not.

## Root cause
A head-slice truncation with no awareness of WHERE in the prose the real cause sits. The reviewer's
own `traceability` array already names the failing contracts precisely (`status: 'fail'` entries),
but `blockFrd` never consulted it — it only had the free-text `failure` string to truncate blindly.

## Fix plan
1. `blockFrd(frd, reason, failure = '', trace = null)`: accept the gate's own `traceability` array
   when the caller has one in scope. Filter entries with `status === 'fail'`, take their contract id
   (`contract.split(' — ')[0]`, capped to 4), and prefix them to `failure` as `FAIL <ids> · <failure>`
   before slicing — raise the cap from 200 to 400 chars.
2. Thread `trace` through every `blockFrd` call site that has a gate/regate/reregate object in scope
   (5 sites: the C1 needs-owner/external classification, the B2 traceability-still-deficient exits ×2,
   the post-repair traceability-deficient exit, and the final generic-block fallback).
3. Add a prompt directive to both copies of the generic "can't pinpoint specific WOs" gate exit:
   `failure` MUST open with one sentence naming the RED cause; context/praise comes after, never before.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-pandacorp-build.mjs`, marker `// ---- BL-0174..0177 ----`:
- `BL-0174a`: a needs-owner block whose `failure` opens with >200 chars of praise and whose
  `traceability` has 2 `fail` entries — asserts `blockedFailures[frd]` opens with `FAIL <ids> ·`, the
  real cause text survives, and the stored text is ≤400 chars.
- `BL-0174b` (doc lock-in): asserts the gate prompt's generic exit instructs `failure` to lead with the
  cause.

## Done when
- [x] `BL-0174a`/`BL-0174b` are green; confirmed RED against the pre-fix engine (200-char cap keeps
  only the praise, no `trace` param existed).
- [x] `bash plugin/scripts/run-engine-tests.sh` green (173/173, full suite).
- [x] plugin version bumped (9.109.0) as part of this release's batch, `mission-control`'s engine copy
  byte-identical to the template.

## Out of scope
Rewriting how reviewers are instructed to WRITE `failure` beyond the one-sentence-first directive —
BL-0174b locks in the instruction, not a stricter schema. A structured `{ cause, context }` split was
considered and rejected as scope creep for a p1 truncation bug.
