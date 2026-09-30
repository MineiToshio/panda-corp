---
id: BL-0206
type: bug
area: build-engine
title: "a haiku mech agent hand-transcribing drift-proof.mjs's JSON stdout dropped a closing bracket, and the engine's fail-closed JSON parse turned a proven pre-existing drift into a spurious reopen"
status: done
severity: p1
opened: 2026-09-26
closed: 2026-09-30
source: "docs/reviews/canary-f2-report.md §4.3 (canary F2, wf_8bab7752-702, FRD-05)"
closes: "plugin/scripts/drift-seal.mjs, plugin/scripts/drift-proof.mjs (seal, --out, replay), plugin/runtime/engine/pandacorp-build.src.js (parseDriftProof, runDriftProof); tests BL-0206 a-j in test-pandacorp-build.mjs, test-drift-proof.mjs"
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

## Resolution (2026-09-30)
**Design choice and why.** The engine is a Dynamic Workflow with NO filesystem, so any read of a script's result passes through a MECH agent — "write to a file and read the file" alone still ends with a model re-typing the file's content. So the model is not removed from the path; what changes is that **its copy can no longer be mistaken for the truth**: (a) `drift-proof.mjs prove` SEALS its single line (new `plugin/scripts/drift-seal.mjs`: ASCII-only body, `"sum"` = a cyrb53 checksum of the body as the LAST key, `version: 2`) and stores the sealed line at `.pandacorp/run/drift-proofs/<frd>/<pin>-<n>.json` (`--out`); (b) the engine (`parseDriftProof`, with its own copy of the checksum — a Workflow script has no imports) recomputes the seal over the exact text it received; (c) any mismatch / unparseable / empty relay is a **transport fault, never a verdict**: `drift-proof.mjs replay` re-prints the stored line (seconds, no probe re-runs, ≤ 2 re-reads through the same single MECH spawn site); (d) if every read fails, the gate's claims are UNPROVEN: no reopen, no card, no `drift:` entry, loud `DriftProofUnreadable`, and a reviewer's own `needs-owner` block is kept (the lift needs proven drift). Chosen over "retry the command" (minutes of probe re-runs, same correlated model error) and over "return only a file path" (the engine still has to read the content). A checksum detects ANY alteration — including the silently valid-JSON kind canary F1 actually produced (see BL-0209), which no JSON-parse-error retry could catch.
**What stays fail-closed (negative controls):** an intact script refusal (`{ok:false,error}`), genuine probe results (unloadable/flaky/owned/no base), a claim with no probe. A pre-seal script (`version` 1, skew with an older installed plugin) is still read with a warning. `drift-record`'s result (the other relay) is re-run once when unreadable (idempotent on disk); a refusal is final. BL-0178's R4 ("dead runner ⇒ cycle fault") is amended on purpose: a proof that never arrived is UNPROVEN (DR-122 `nota` clarified; `factory/standards/build-orchestration.md` documents "a model never transcribes machine JSON into a verdict").
**Tests** (`test-pandacorp-build.mjs`, RED on the pre-change artifact): `BL-0206 a` (the exact F2 corruption: a dropped `]` → re-read → proven, NO patch), `b` (two altered reads then an intact third), `c` (every read unreadable → UNPROVEN, bounded at 2 re-reads), `d` (unreadable under needs-owner keeps the block), `e`/`f` (negative controls: intact refusal and a genuine load-error stay cycle faults), `g` (version skew), `h`/`h2` (the REAL script's line is accepted; a one-character edit is rejected and recovered), `i`/`j` (drift-record retry / refusal), amended `BL-0178 R4`; `test-drift-proof.mjs` (+16: seal, ASCII, stored copy byte-identical, replay refusals for tampered/missing/escaping paths, `--out` validation).
**Not verified:** no live engine run (the suite drives scripted agents); the real-world rate at which a haiku mech alters the line is unmeasured.

## Red-team addendum (2026-09-30)
The first cut turned an UNPROVEN reviewer claim into `status: 'discarded'` (engine-stamped), which is not an open
fail, so a green verdict carrying it was CERTIFIED: a dead or garbling MECH relay (three unreadable reads, e.g. an
agent outage returning nothing) waived a contradicted contract, and `BL-0178 R4` had been rewritten to assert "the
FRD lands VERIFIED". Fixed: the entry stays an OPEN `fail` (claim stripped, `driftVerdict: 'unproven'`); a green
resting on it is deferred (`DriftProofUnproven`: not certified, not reopened, nothing reverted — it re-gates next pass);
under a reopen it rides along as a finding and the verifier inherits it. R4 and `c` assert the fail-closed outcome
again; new scenarios `k` (legacy serial path) and `l` (reopen). Also: `prove --out` deletes the previous copy at its
path first, so `replay` can never serve an older run's proof at the same pin/sequence (test-drift-proof.mjs).
