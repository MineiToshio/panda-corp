---
id: LESSON-0662
type: gotcha
domain: data-pipelines
tags: [export, incremental-diff, mode-confusion, dead-code-path]
context: a command/script that supports both an incremental/trial (dry-run) mode and a full/bulk/sweep mode, where both modes share the same staleness-comparison logic originally written for the incremental case
trigger: use this when a "full"/bulk-export or sweep mode of a command shares its staleness/diff-comparison logic with that same command's incremental or trial/dry-run mode
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-09 (agent-inferred): catalog:sql/export in full mode compared coverage-application timestamps (last_checked_at, onboarded_at) against the current run the same way the trial/incremental mode does — so a full/sweep export could NEVER produce output, because the full-mode comparison always evaluated as 'nothing changed.' Fixed 2026-11-09 (6252eb81)."
provenance: agent-inferred
created: 2026-11-11
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a command's "full" export mode (meant to emit everything, unconditionally) reused the
same timestamp-based staleness check its "trial"/incremental mode uses to decide what's new since last
time. Because a full export isn't comparing against a prior checkpoint at all, that incremental check
always evaluated to "nothing is newer than last time" — the full mode could never emit anything, for any
input, until the bug was found and fixed.

**Lesson:** an incremental/diff-based staleness check is only meaningful relative to a specific prior
checkpoint; a "full"/bulk/sweep mode that shares the SAME check without also disabling or bypassing it
inherits a condition that is structurally always false (or always true) for that mode, silently
disabling the whole mode rather than producing a visibly wrong result — it just looks like "there was
nothing to export," which reads as correct behavior on an empty or fully-synced catalog and only shows
itself as a bug once someone expects full mode to actually produce something.

**Apply next time:** when a command has more than one mode and one mode's defining feature is "ignore
incremental state, process everything," explicitly bypass (not just reuse) whatever staleness/diff
condition the incremental mode relies on — and add a test asserting the full mode emits output on a
catalog that is already fully synced/up-to-date, since that is exactly the case the incremental check
would otherwise swallow.
