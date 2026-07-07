---
id: LESSON-0106
type: gotcha
domain: content-rendering
tags: [mdx, content-collections, remark, rehype, layout, structured-rendering, prose]
context: a design mock groups MDX content by section (2-column rows, cards, a ledger) but the compiled MDX output is a flat sequence of sibling elements
trigger: use this when a page's design requires visually grouping markdown/MDX content by section (2-column rows, cards, any non-linear layout) rather than a single linear prose column
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-06/07 — the /now page's mock is a 2-column ledger grid per status block, but content-collections' compiled MDX renders as flat siblings (h2, p, p, h2…); CSS alone over `.prose` could not regroup them, requiring a structured render/post-process fix (landed as the `now-status-blocks-two-column-ledger` change)"
provenance: agent-inferred
created: 2026-07-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0014]
---

**Situation:** A page's approved mock groups MDX/Markdown content by section — e.g. each `## heading` plus
its following paragraphs forms one visual unit (a 2-column row, a card). The MDX pipeline (`content-
collections`, and any remark/rehype-based compiler behaves the same way) compiles that markdown into a
FLAT sequence of sibling HTML elements (`h2`, `p`, `p`, `h2`, `p`...) with no wrapping element per section —
the heading-to-paragraphs grouping that the author intended in the source file is not preserved in the
compiled output tree.

**Lesson:** CSS alone cannot recover a grouping that does not exist in the DOM — no selector can wrap N
flat siblings into one grid cell after the fact (`:has()` + sibling combinators can style siblings, but
cannot re-parent them into a shared container to size/position them as a unit). Any layout that needs
per-section grouping (2-column rows, cards, a ledger) requires either (a) a structured content shape
(frontmatter-driven array of section objects, not raw prose) rendered with an explicit React/component
loop, or (b) a remark/rehype transform that walks the flat AST and wraps each `heading + its following
siblings until the next heading` in a container element BEFORE the final render.

**Apply next time:** before committing to "just write MDX and grid it with CSS" for a design that groups
content by section, check the mock against the compiler's actual output shape (flat siblings, not a
nested per-section tree). If the mock needs grouping, plan for a structured-render or an AST wrap
transform as part of that feature's design, not as a post-hoc CSS patch.
