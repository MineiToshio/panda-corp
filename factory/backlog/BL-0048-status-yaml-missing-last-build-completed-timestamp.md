---
id: BL-0048
type: change
area: build-engine
title: "status.yaml needs an explicit last_build_completed_at field so the memory-review orphan-of-harvest check doesn't parse free-text comments"
status: open
severity: p2
opened: 2026-07-06
closed:
source: "factory/memory/_inbox.md 2026-07-06 note (librarian harvest 2026-07-06) — detecting mission-control as orphaned (last_harvest 2026-07-03 vs. its 2026-07-06 FRD-17 close-out) required parsing status.yaml's free-text safe_to_test comment"
closes:
links: [BL-0034]
---

## Problem
The `pandacorp-memory-review` scheduled routine's "orphaned harvest" check (`plugin/docs/routines.md`,
PASO 0) needs to compare a project's `last_harvest` timestamp against when it last completed a
build/close-out, to detect a `phase: release` project whose harvest is stale relative to its own
history. `.pandacorp/status.yaml` has no dedicated machine field for "when did the last build/FRD
close-out complete" — the only things available are a free-text `safe_to_test` comment (not a
timestamp field, prose that varies per project/author) and a generic `updated_at` (bumped by many
unrelated writes, not specifically a build-completion marker). Detecting Mission Control as orphaned
(`last_harvest` 2026-07-03 vs. its actual 2026-07-06 FRD-17 close-out) required parsing that prose
comment — fragile, and liable to silently miss the signal on a project whose `status.yaml` writer used
different wording.

Impact: the orphan-of-harvest detection (already known to be imperfect for a different reason, see
BL-0034 — Mission Control's portfolio-entry/status.yaml resolution) has a SECOND, independent
correctness gap: even when the file resolves correctly, the comparison itself is a fragile text-parse
instead of a direct field comparison.

## Root cause
`status.yaml`'s schema (`factory/standards/build-orchestration.md` / the engine's writer) was never
given a dedicated, structured "last build/close-out completed" timestamp — build-completion signals
exist only as side effects (a prose comment, a generic `updated_at` bump) rather than a first-class
field written at the FRD-gate/close-out safe point (DR-050).

## Fix plan
1. Add a `last_build_completed_at: <ISO8601>` field to the `status.yaml` schema
   (`factory/standards/build-orchestration.md`), written by the build engine at each FRD-gate/close-out
   safe point (the same safe-point where other status fields already update, DR-050) — not just at
   final release.
2. Update the `pandacorp-memory-review` routine's orphan-detection step (`plugin/docs/routines.md`,
   PASO 0) to compare `last_harvest` directly against `last_build_completed_at` instead of parsing
   `safe_to_test` prose.
3. Backfill is not required (existing projects simply lack the field until their next close-out) —
   the routine should treat a missing field as "cannot determine, skip" rather than a false orphan
   signal, consistent with BL-0034's "exit silently when there's nothing to do" principle.

## Tests (prove the fix — TDD, RED → GREEN)
A documented manual repro is acceptable for the routine-prompt half (not testable code): confirm the
orphan-detection step reads `last_build_completed_at` when present and degrades to "skip" when absent.
If `status.yaml` writing is scripted (not just engine-internal), add an assertion that a close-out
safe-point run stamps `last_build_completed_at` with a fresh ISO8601 timestamp.

## Done when
`status.yaml`'s schema documents `last_build_completed_at`, the build engine writes it at each
close-out safe point, and the `pandacorp-memory-review` routine's orphan check compares it directly
instead of parsing `safe_to_test` prose. Plugin version bumped for the routine/schema doc change.

## Out of scope
Does not touch BL-0034's Mission Control path-resolution gap (that is about WHETHER a status.yaml
resolves at all; this is about WHAT field to compare once it does) — both should land before the
orphan check is fully trustworthy, but they are independent fixes.
