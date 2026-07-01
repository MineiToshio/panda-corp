---
id: LESSON-0008
type: anti-pattern
domain: parsing
tags: [regex, parsing, markdown, frontmatter, gotcha]
context: a regex/marker parser over markdown or source text matches the FIRST substring occurrence anywhere in the file instead of a specific anchored location, silently misparsing real content
source: mission-control lessons.md — WO-05-001 work-orders.ts STATUS_RE (2026-06-16/17, committed WO-01-003/WO-01-005 misparsed done→todo); WO-17-001 parseProjects over-count (2026-06-16, comma-split before stripping parentheticals)
provenance: agent-inferred
created: 2026-06-30
status: active
promotion: none
confidence: high
times_applied: 0
links: []
---

**Situation:** Two independent parser bugs in Mission Control's readers shared one root cause. (1)
`work-orders.ts`'s `STATUS_RE` matched the *first* `"Status:"`-like token anywhere in a work-order file
with no line/heading anchor — prose like `status: IdeaStatus;` (a TypeScript type annotation quoted in the
doc) shadowed the real canonical `## Status: DONE` heading, so real committed work orders misparsed
done→todo. (2) `parseProjects` split a projects string on `", "` *before* stripping `(...)` parenthetical
notes, so words inside a note were captured as phantom project names (over-counting).

**Lesson:** A text/marker parser that scans for a **substring anywhere in the document** rather than
**anchoring to its structural location** (a heading line, a delimited field) will eventually match the
wrong occurrence — prose, an example, a comment, a nested note — and silently misparse real, committed
content. This is invisible until a specific fixture reproduces the shadowing case; a happy-path test with
only one occurrence of the marker never catches it.

**Apply next time:** When writing any marker/status parser over markdown or freeform text: (a) anchor to a
structural position (`^#{1,6}\s*Status`, a specific field/line, not "find `Status:` anywhere") or scan the
**last** match if multiple are structurally valid; (b) strip nested/parenthetical content *before*
splitting on a delimiter that could also appear inside it. General principle: **parse markers
line-anchored, never substring-greedy.**
