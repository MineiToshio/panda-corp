---
id: LESSON-0127
type: gotcha
domain: frontend-design
tags: [css, design-tokens, contrast, mock-to-content-migration, mdx]
context: migrating a design mock's emphasis markup into real markdown/MDX content, or diagnosing an owner's "this text looks washed out/dull" report on a page with a highlighted element inside a muted paragraph
trigger: use this when a mock highlights key phrases with one HTML element (e.g. `<em>`) but the real content is authored with markdown that compiles to a DIFFERENT element (e.g. `**strong**` -> `<strong>`), or when an owner reports body text looking "dull"/"washed out"
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-0x — About page (FRD-04, about.css): the mock used <em> for emphasis and had it styled, but the real about.mdx content used **strong**, which inherited the paragraph's --color-fg-muted and read as flat/dull; owner's first instinct was to raise the WHOLE body to full color, then reverted once the real fix (style strong explicitly to a near-white --color-fg, keep the body muted) was found (agent-inferred + owner-stated)"
provenance: agent-inferred
created: 2026-07-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a design mock emphasized key phrases with `<em>` and had CSS for it; the real MDX content
authored the same emphasis with `**strong**` markdown instead. Nothing styled `strong` explicitly, so it
inherited the surrounding paragraph's muted foreground token and read as flat/apagado. The owner's first
diagnosis was that the BODY color itself was too dim and asked to raise it to full color — which was then
reverted once the actual fix (keep the body muted, give `strong` its own near-full-contrast color) was
identified.

**Lesson:** two related but distinct traps, both about not verifying which ELEMENT actually carries the
missing style before changing something else: (1) migrating a mock to real content is not just a content
swap — if the mock's emphasis technique (`em`) differs from the markup the real content naturally produces
(`strong`), the CSS written for one does not cover the other, and the gap is invisible until someone reads
the compiled HTML, not the markdown source; (2) a "this text looks dull/washed out" report is, more often
than not, actually about the HIGHLIGHTED element lacking its own explicit style (so it falls back to
inheriting the body's muted tone) rather than the base body color being wrong — moving the base color is
the wrong fix and creates a new problem (an overly bright body) that then has to be reverted.

**Apply next time:** when migrating a mock's emphasis/highlight technique into real markdown/MDX content,
explicitly verify (by inspecting the compiled/rendered HTML, not just re-reading the markdown) which
element the real content actually compiles the emphasis to, and style THAT element, not just whichever one
the mock happened to use. When triaging a "text looks dull" report, diagnose the RELATIVE contrast of the
highlighted/emphasized element first (does it have its own color, or is it silently inheriting the muted
body tone?) before touching the base body color.
