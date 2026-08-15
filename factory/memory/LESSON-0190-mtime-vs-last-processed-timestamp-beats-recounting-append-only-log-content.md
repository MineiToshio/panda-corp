---
id: LESSON-0190
type: pattern
domain: factory-engineering
tags: [staleness-check, append-only-log, mtime, incremental-processing, performance]
context: "a routine that must decide whether an append-only log/inbox file (only ever written by a capture event or a periodic drain/harvest) has new content since it was last processed"
trigger: "use this when designing or fixing a check that decides whether an append-only log has pending/new content since a last-processed marker — before re-reading and counting/parsing the file's content, consider comparing its mtime against the last-processed timestamp"
source: "factory/memory/_inbox.md agent-inferred note (2026-08-11 pandacorp-memory-review sweep) — proposed as a cheaper alternative to PASO 0's line-counting approach (see BL-0061's note-count overcounting lineage): compare a project's `.pandacorp/run/lessons.md` mtime against its `status.yaml`'s `last_harvest` timestamp instead of reading/counting the file's live lines every run"
provenance: agent-inferred
created: 2026-08-11
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0180, BL-0061, BL-0086]
---

**Situation:** a scheduled routine (`pandacorp-memory-review` PASO 0) needed to decide, for each portfolio
project, whether its append-only `.pandacorp/run/lessons.md` had any pending notes since the last harvest.
The direct approach — read the file and count/parse its live (non-drained) lines every run — is both
wasteful (re-reading a file that usually hasn't changed) and error-prone (the drained-history
`<!-- Drained ... -->` comment blocks make naive line-counting wildly overcount, per BL-0061's own
lineage).

**Lesson:** when a file is append-only and is ONLY ever written by either a capture event (appending a new
note) or a periodic drain (which also touches the file, e.g. clearing it), the file's own mtime is a
sufficient, much cheaper proxy for "has anything happened since X" than reading and counting/parsing its
content — if `mtime <= last_processed_timestamp`, nothing changed since, full stop, no need to open the
file at all. This is a different axis than LESSON-0180 (which is about a staleness check needing lag
TOLERANCE for a two-phase stamp-then-commit write): this lesson is about avoiding the content-read/count
step entirely when a cheaper existence check (mtime comparison) already answers the same question.

**Apply next time:** before building or fixing a "does this append-only log have new content since
timestamp T" check, reach for a file-mtime-vs-T comparison first, and only fall back to reading/parsing
content when the check needs to know WHAT changed (not just WHETHER anything changed). Still combine with
LESSON-0180's lag-tolerance guidance if the "last processed" timestamp itself comes from a two-phase
stamp-then-commit write (a fresh stamp can legitimately predate its own recording commit by the
operation's normal duration) — an mtime check on the SOURCE file avoids that specific problem too, since
it reads the file's own write time directly rather than a separately recorded marker.
