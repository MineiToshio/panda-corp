---
id: LESSON-0345
type: gotcha
domain: css
tags: [dead-code-removal, line-pattern, media-query, diff-review]
context: removing "dead" CSS identified by matching a text/line pattern, when a media query or selector list bundles the dead rule with a still-live one on the same source line
trigger: use this when removing CSS flagged as dead/unused by a pattern match on lines/blocks, before saving the result
source: "pandasaga .pandacorp/run/lessons.md 2026-10-14 (agent-inferred): removing dead CSS by line pattern dropped an unrelated, still-live rule bundled in a media query with the dead selector (`.saga-books` bundled with `.crumbs` in the same block)"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0230]
---

**Situation:** a dead-CSS cleanup removed a selector (`.saga-books`) that shared a media-query block with
a still-live, unrelated selector (`.crumbs`). The removal matched and deleted the whole block/line
pattern rather than only the dead selector within it, silently taking the live rule down with it.

**Lesson:** CSS selectors are frequently grouped — a comma-separated selector list, or two unrelated
rules nested inside the same media-query block — so a dead-code match on "this selector" can span or
sit beside code that is NOT dead. A pattern-based removal that deletes the matched span/block wholesale,
without checking what else lives in that span, can silently remove unrelated live styles with no error.

**Apply next time:** before saving a dead-CSS removal (automated or by hand), diff the actual removed
lines against the full list of selectors/rules the match touched, and confirm every other selector in a
shared block/list is independently verified dead too — never delete a bundled block on the strength of
one selector's dead-code finding alone.
