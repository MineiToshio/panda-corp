---
id: BL-0206
type: bug
area: build-engine
title: "a haiku mech agent hand-transcribing drift-proof.mjs's JSON stdout dropped a closing bracket, and the engine's fail-closed JSON parse turned a proven pre-existing drift into a spurious reopen"
status: open
severity: p1
opened: 2026-09-26
closed:
source: "docs/reviews/canary-f2-report.md §4.3 (canary F2, wf_8bab7752-702, FRD-05)"
closes:
links: [BL-0201, BL-0178]
---

## Problem
`drift-proof:frd-05` (a haiku `pandacorp:mech` agent) ran `drift-proof.mjs prove`, which correctly proved
the judge's spec-drift probe (`blueprint-req-05-001.drift-probe.ts`) fails identically at the gate's pin
and at `last_green_sha` — a textbook `preexisting` drift the engine should record and move on from
(BL-0178 `driftPolicy:'record'`). The mech agent's job is only to run the command and relay its stdout;
instead it hand-transcribed the 2,207-character JSON into its own `output` field and **dropped one closing
bracket** (`…"}]}],"cleanup"` became `…"}],"cleanup"`, 2,205 chars, `Expecting ',' delimiter` at char 2205).

The engine's own JSON parse of that relayed output failed, and its fail-closed rule for unparseable
drift-proof output ("the drift-proof output is not valid JSON — every drift claim stays a cycle fault",
BL-0178) — correct as a DEFAULT — turned a PROVEN pre-existing drift into a cycle fault, which was then
patched: `patch:frd-05` (opus) rewrote `blueprint.md` §1 (`b2be2723`, docs-only) and a full
verify/certify ladder followed. **Cost: 12.3 minutes on the critical tail and 4.01 $, with no owner card**
(a real pre-existing drift that should have produced a `.pandacorp/inbox/changes/*-drift-*.md` card
instead silently vanished into an unnecessary blueprint rewrite). `track.jsonl` also mis-records FRD-05 as
`review_end pass` only — no reopen line appears, unlike FRD-03/04's genuine reopens.

## Root cause
The engine trusts a model agent (haiku `mech`) to relay a machine-generated JSON blob verbatim through its
own text-generation output field. A model relaying JSON through natural-language generation is not a
lossless copy channel — it can (and here did) drop or alter a character. The fail-closed JSON-parse-error
path is the RIGHT response to genuinely malformed output; the actual bug is that malformed output can be
produced by a transcription error in a step that should never need to transcribe at all.

## Fix plan
- `drift-proof.mjs` (or the mech step that invokes it): write its full JSON result to a file (e.g.
  `.pandacorp/run/drift-proofs/<frd>/<contract-id-slug>.json`) instead of relying on the calling agent to
  relay stdout by hand, and have the `mech` agent's job become "run the command, return the file path" —
  removing the model from the JSON-copying path entirely.
- `plugin/runtime/engine/pandacorp-build.src.js` (wherever the drift-proof step's result is consumed):
  read the JSON from that file directly; keep the current fail-closed behavior for a GENUINELY malformed
  or missing file (still a cycle fault, still logged loudly) but never for a model's own transcription of
  an otherwise-valid result.
- Defense in depth: if any relay-through-agent-output path remains for a machine JSON payload, have the
  engine retry the parse once (re-invoke the same command) before treating a parse failure as a cycle
  fault, and only fail closed after a second genuine failure — never after a single lossy transcription.

## Tests (prove the fix — TDD, RED → GREEN)
- A unit test around the drift-proof consumption path that feeds a well-formed `drift-proof.mjs` output
  written to a file and asserts the engine reads and trusts it without any agent-relay step.
- A regression test anchored in the bug: simulate the exact truncation (`…"}]}],"cleanup"` →
  `…"}],"cleanup"`) as agent-relayed text and assert the NEW code path never sees it (because the engine
  reads the file, not the relay) — i.e. the bug class is structurally impossible, not merely retried away.
- Keep (or add) a negative-control test that a truly malformed/missing drift-proof file still fails closed
  as a cycle fault with the existing loud log.

## Done when
- [ ] `drift-proof.mjs`'s result reaches the engine via a file the engine reads directly, not an agent's
      relayed text.
- [ ] The regression test above passes; the existing fail-closed negative control still passes.
- [ ] `bash plugin/scripts/run-engine-tests.sh` green with the new/updated tests.
- [ ] `factory/standards/build-orchestration.md`'s DR-122/drift-record section notes the file-based
      hand-off (why a model must never transcribe machine JSON).

## Out of scope
- Redesigning the broader DR-122 differential-proof mechanism (still sound) — only its result hand-off
  changes.
- The separate, already-tracked asymmetric `drift-record` dispatch gap for FRD-04 (canary F1) — that is a
  different defect (see the F1 backlog items filed alongside this one).
