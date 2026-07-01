---
id: LESSON-0018
type: pattern
domain: parsing
tags: [markdown, parser, algorithm, flush-on-heading]
context: parsing a markdown file with an unknown number of delimited blocks (e.g. open/closed sections) into structured data, in one pass
source: mission-control lessons.md (2026-06-16) — parsing Spanish owner-facing comms files
provenance: agent-inferred
created: 2026-06-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
links: []
---

**Situation:** A markdown reader needed to parse an arbitrary number of heading-delimited blocks (e.g.
OPEN/CLOSED status sections) out of a comms/log file without regex lookahead.

**Lesson:** The **flush-on-heading** pattern — track the current block's accumulated state as you scan
lines, and "flush" (commit) it whenever the next heading (or EOF) is hit — handles any number of
open/closed blocks in a single O(n) pass with no regex lookahead needed. Reliable for markdown log/comms
files with a variable, unpredictable number of sections.

**Apply next time:** For any markdown-block parser (status logs, changelogs, structured comms files),
default to flush-on-heading rather than a multi-pass regex/lookahead approach — it's simpler, O(n), and
handles an arbitrary number of blocks correctly.
