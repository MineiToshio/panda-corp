---
id: BL-0259
type: bug
area: templates
title: "e2e/_responsive-helper.ts (stack-a template) marks every visually-hidden node as \"clipped\" and every carousel without an explicit opt-out marker as a violation"
status: open
severity: p2
opened: 2026-10-19
closed:
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-18 (agent-inferred), gate FRD-01 — note explicitly flagged as \"Candidato a BL de fábrica\""
closes:
links: []
---

## Problem

`plugin/templates/stack-a-nextjs/e2e/_responsive-helper.ts`'s verbatim-responsive check marks as
"clipped" ANY text that is deliberately visually hidden (`.sr-only`/visually-hidden utility classes, a
1px-sized element with `overflow: hidden`) — a standard, intentional accessibility pattern, not a
responsive-layout defect. The same helper also flags ANY carousel lacking an explicit
`data-scroll-x="intentional"` marker as a violation. Together, no route that legitimately uses
`sr-only` text can be "blessed" by this check without the marker workaround, and every carousel needs
the same opt-out — the helper cannot currently tell "deliberately hidden/scrollable by design" from
"actually clipped/broken."

## Root cause

The helper's clipped-text detection does not exempt nodes that are visually hidden ON PURPOSE (checking
only rendered box size/overflow, not `.sr-only`-style CSS patterns or `aria-hidden`/screen-reader-only
conventions), and its carousel-scroll detection requires an explicit per-instance opt-out marker instead
of recognizing the scrollable-by-design pattern structurally (e.g. `overflow-x: auto` + a fixed-width
scroll track).

## Fix plan

1. In the clipped-text check, exempt nodes matching the standard visually-hidden pattern (zero/1px
   dimensions combined with `overflow: hidden` AND either a recognized `sr-only`-style class name or
   `position: absolute` off-screen placement) before reporting a clip violation.
2. For the carousel check, recognize the structural pattern (horizontal `overflow-x` scroll with content
   wider than its container) as intentional by default, keeping `data-scroll-x="intentional"` as an
   optional explicit override rather than a required one.

## Tests (prove the fix — TDD, RED → GREEN)

- A fixture page with a standard `.sr-only` text node: the helper does NOT report it as clipped. RED
  today (reported as clipped).
- A fixture horizontally-scrollable carousel with no `data-scroll-x` marker: the helper does NOT report
  a violation. RED today (reported as a violation).
- A fixture page with a GENUINELY clipped (accidentally cut off, not visually-hidden-by-design) text
  node still reports a violation — the fix must not blind the check entirely.

## Done when

- All three tests above are green; `bash plugin/scripts/run-engine-tests.sh` stays green.
- Plugin + `OVERLAY_VERSION` bumped (this is an overlay template file); `plugin/docs/decision-log.md`
  entry.

## Out of scope

Any change to the stack-a template's OTHER e2e helpers; this item targets only
`_responsive-helper.ts`'s clipped-text and carousel-scroll checks.
