---
id: LESSON-0008
type: anti-pattern
domain: parsing
tags: [regex, parsing, markdown, frontmatter, gotcha]
context: a regex/marker parser over markdown or source text matches the FIRST substring occurrence anywhere in the file instead of a specific anchored location, silently misparsing real content
trigger: use this when writing a regex/marker parser (status fields, delimited lists) over markdown or freeform text
source: "mission-control lessons.md — WO-05-001 work-orders.ts STATUS_RE (2026-06-16/17, committed WO-01-003/WO-01-005 misparsed done→todo); WO-17-001 parseProjects over-count (2026-06-16, comma-split before stripping parentheticals). Third corroborating instance — panda-corp factory/memory/_inbox.md, 2026-08-02 harvest: a naive line-by-line HTML-comment state machine proposed to fix BL-0061 (PASO 0's pending-note overcount) closes a drained-history comment block too early whenever the block's own prose QUOTES a worked example that itself contains the literal comment-close token (e.g. a documented grep pattern ending in that token) — the block-close marker is matched at its FIRST occurrence rather than the one that actually terminates the block, the same substring-greedy-vs-anchored failure this lesson already names, applied to a delimiter PAIR rather than a single field marker."
provenance: agent-inferred
created: 2026-06-30
status: active
promotion: none
confidence: high
times_applied: 1
applied_in: [personal-page-v2]
links: [BL-0061]
---

**Situation:** Two independent parser bugs in Mission Control's readers shared one root cause. (1)
`work-orders.ts`'s `STATUS_RE` matched the *first* `"Status:"`-like token anywhere in a work-order file
with no line/heading anchor — prose like `status: IdeaStatus;` (a TypeScript type annotation quoted in the
doc) shadowed the real canonical `## Status: DONE` heading, so real committed work orders misparsed
done→todo. (2) `parseProjects` split a projects string on `", "` *before* stripping `(...)` parenthetical
notes, so words inside a note were captured as phantom project names (over-counting). (3) A THIRD, later
instance found the same root cause in a delimiter-PAIR context rather than a single marker: a proposed
comment-stripping fix for BL-0061 (factory `_inbox.md`'s pending-note overcount) closed an
`<!-- ... -->` block on the FIRST line containing the closing token, when the block's own prose quoted a
worked example that also contained that token earlier — the real closing token, further down, was never
reached, so the rest of a fully-drained block misread as live content.

**Lesson:** A text/marker parser that scans for a **substring anywhere in the document** rather than
**anchoring to its structural location** (a heading line, a delimited field) will eventually match the
wrong occurrence — prose, an example, a comment, a nested note — and silently misparse real, committed
content. This is invisible until a specific fixture reproduces the shadowing case; a happy-path test with
only one occurrence of the marker never catches it.

**Apply next time:** When writing any marker/status parser over markdown or freeform text: (a) anchor to a
structural position (`^#{1,6}\s*Status`, a specific field/line, not "find `Status:` anywhere") or scan the
**last** match if multiple are structurally valid; (b) strip nested/parenthetical content *before*
splitting on a delimiter that could also appear inside it; (c) for a **delimiter PAIR** (an opening and a
closing marker, e.g. `<!--`/`-->`), never close on the first occurrence of the closing token after the
opening one — if the block's own content can legitimately quote that token (a worked example, a code
snippet), match the closing token that immediately precedes the NEXT opening marker or EOF (a
DOTALL/multiline regex spanning the whole block), not a line-by-line first-close state machine. General
principle: **parse markers line-anchored, never substring-greedy — for delimiter pairs specifically, closing
must be resolved against the block's true boundary, not its first plausible occurrence.**
