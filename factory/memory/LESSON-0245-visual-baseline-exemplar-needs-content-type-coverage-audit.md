---
id: LESSON-0245
type: gotcha
domain: testing
tags: [visual-regression, playwright, baseline-selection, content-coverage, blog, mdx]
context: a visual-regression/screenshot gate that blesses ONE exemplar page per route class (e.g. "the" blog-post baseline, "the" case-study baseline) rather than one baseline per actual page
trigger: use this when picking or auditing which single page a visual-regression baseline exemplar represents for an entire route class (blog posts, case studies, product pages)
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-15 (agent-inferred) — the visual gate blessed /en/blog/welcome as the sole blog-post baseline exemplar; that specific post has no bullet list and no callout block, so the .prose bullet-list styling and the 'What I took away' callout component have ZERO visual regression coverage across the whole blog-post route class, even though the gate reports green."
provenance: agent-inferred
created: 2026-09-16
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0036, LESSON-0047]
---

**Situation:** a visual-regression gate blessed a single page (`/en/blog/welcome`) as the representative
baseline for an entire route class (all blog posts). That page happened to contain neither a bullet list
nor a callout block — two content primitives the MDX pipeline supports and other posts use — so the gate
was structurally blind to regressions in either primitive's styling, while still reporting a fully green,
fully-blessed suite.

**Lesson:** a "one exemplar per route class" visual-baseline strategy is only as good as the exemplar's
content coverage. Picking a page because it exists (or because it was the first one built) rather than
because it exercises every content primitive the class supports silently narrows what the gate can ever
catch — the same shape as LESSON-0036/LESSON-0047's other visual-gate blind spots, but caused by baseline
SELECTION rather than capture timing or tooling.

**Apply next time:** when a visual-regression suite blesses a single exemplar per route/content class,
enumerate the content primitives that class's template/CMS schema supports (lists, callouts, tables,
embeds, code blocks, images) and verify the chosen exemplar page actually contains each one — or bless
more than one exemplar so the union covers them all — rather than accepting the first or most convenient
page as sufficient coverage.
