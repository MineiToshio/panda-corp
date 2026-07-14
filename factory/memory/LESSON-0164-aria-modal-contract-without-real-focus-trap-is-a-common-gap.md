---
id: LESSON-0164
type: anti-pattern
domain: accessibility
tags: [a11y, wcag, focus-trap, modal, dialog, inert]
context: a modal/dialog/drawer component carries the WCAG modal contract's ARIA markup (role="dialog", aria-modal) but was never audited for whether keyboard focus is actually trapped inside it
trigger: use this when auditing or building a modal, dialog, drawer, or lightbox that claims role="dialog"/aria-modal="true" — verify real focus behavior, not just the ARIA attributes
source: "personal-page-v2 docs/decision-log.md 2026-07-11 (Full-site QA overhaul) — a fixed production bug: a Lightbox and a mobile nav drawer both carried the WCAG modal ARIA contract but had NO real focus trap; fixed by adding a shared `useFocusTrap` hook (focus-in on open + Tab-cycle containment) plus background `inert` on the rest of the page"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0019, LESSON-0045]
---

**Situation:** two separate modal-like components (a lightbox, a mobile nav drawer) had the markup a WCAG
modal contract requires (`role="dialog"`, `aria-modal="true"`) and passed a static a11y linter (Biome's a11y
rules, or a shallow axe-core scan on a closed state), but neither actually trapped keyboard focus: Tab could
move focus out to background content while the modal was visually open, and background content was not
`inert`, so assistive tech could still reach it.

**Lesson:** having the right ARIA attributes on a modal is necessary but NOT sufficient to satisfy the modal
contract — the ARIA role is a promise to assistive tech that focus behaves like a real modal (trapped inside,
background unreachable), and nothing about static markup or a linter enforces that promise is kept. This gap
is easy to miss because it only shows up under actual keyboard interaction while the modal is open (Tab past
the last focusable element, or Shift+Tab past the first) — a scan of the closed DOM, or an axe-core pass that
doesn't drive focus through the open modal, will not catch it.

**Apply next time:** any component claiming `role="dialog"`/`aria-modal="true"` needs (1) focus moved INTO the
modal on open, (2) a Tab-cycle trap keeping focus inside while open (wrap-around at both ends), and (3)
background content marked `inert` (or `aria-hidden` + non-focusable) while the modal is open — implement once
as a shared hook/utility and reuse across every modal-like component rather than re-deriving per component.
Test by actually driving Tab/Shift+Tab through an OPEN modal, not just scanning static markup.
