---
id: LESSON-0584
type: pattern
domain: error-handling
tags: [partial-failure, fail-loud, dr-078, derived-value, aggregate, batch-reader]
context: a batch reader/aggregator where some of the underlying source items fail to read/parse while others succeed, and one or more downstream derived values (totals, counts, badges) are computed from the mix
trigger: use this when a reader processes multiple source files/items and must produce both per-item results and a derived aggregate, and some items can legitimately fail while others succeed
source: "mission-control docs/decision-log.md + .pandacorp/run/lessons.md 2026-10-31 (agent-inferred, three related findings from the same close-out pass): (1) a reader returned valid items PLUS explicit per-file errors instead of failing the whole batch or silently dropping the bad files; (2) a derived total computed over an incomplete source withheld its EXACT figure rather than presenting a precise-looking number that was actually wrong; (3) a SEPARATE authoritative counter/badge that was still fully derivable from the unaffected portion of the source was kept visible rather than being blanked just because some other, unrelated part of the source had errors"
provenance: agent-inferred
created: 2026-11-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0569]
---

**Situation:** a close-out pass on a reader/aggregation surface found three related defects stemming
from the same root issue — a batch source with some failing items either (a) caused the WHOLE batch to
be treated as failed/hidden, hiding valid data along with the bad; or (b) let a downstream total look
exact and trustworthy when it was actually computed over an incomplete set; or (c) blanked a counter that
was fully computable from the GOOD part of the data, just because some unrelated item elsewhere had
failed.

**Lesson:** "some items failed" is not one fact that taints everything downstream uniformly — it is a
fact about THOSE SPECIFIC ITEMS, and each derived value must be checked individually for whether it
actually depends on the failed portion. A derived value that depends on the complete set (an exact total,
"all N items") must be marked incomplete/uncertain when the source is incomplete. A derived value that
only depends on the unaffected portion (a counter whose inputs are all still readable) should NOT be
blanked or hidden just because something else, unrelated, failed elsewhere in the same batch. Getting
this wrong in either direction is a defect: over-propagating uncertainty hides good data; under-propagating
it presents a wrong number as if it were exact.

**Apply next time:** when building a reader/aggregator over multiple source items with partial-failure
potential, (1) always return valid items alongside explicit per-item errors — never collapse the whole
batch to a single pass/fail; (2) for every derived value computed from the batch, trace whether it
depends on the complete set or only the surviving items, and label/withhold it accordingly — "exact N"
only when N's inputs are all known-good, a visible partial/incomplete marker otherwise; (3) never blank
an otherwise-fully-derivable value just because an unrelated part of the same source failed.
