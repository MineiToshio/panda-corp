---
id: LESSON-0166
type: gotcha
domain: nextjs
tags: [next-themes, next-intl, app-router, client-navigation, hydration]
context: a Next.js App Router project nests its theme provider (next-themes, with its pre-hydration anti-flash inline script) inside a dynamic route segment (e.g. `[locale]`) whose param changes on a client-side navigation
trigger: use this when a language/theme switcher (or any control that changes a dynamic route param wrapping a provider with its own injected script) logs "Encountered a script tag while rendering React component" or otherwise misbehaves only on client-side navigation
source: "personal-page-v2 docs/decision-log.md 2026-07-09 — a fixed production bug: `next-themes`' pre-hydration anti-flash `<script>` remounted outside React's hydration pass whenever a client-side `router.push()` crossed the `[locale]` segment boundary that the theme/analytics providers live inside, logging a React warning on every language switch; fixed by making the language switcher do a full document navigation (`window.location.assign`) instead of a client-side route change"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0168]
---

**Situation:** `<html>`/`<body>` and the theme/analytics providers lived inside `app/[locale]/layout.tsx`,
whose `locale` param is exactly what a language switch changes. A client-side route change
(`router.push()`/`next/navigation`) across that segment re-renders the tree via RSC reconciliation instead of
a fresh hydration pass. `next-themes`' pre-hydration anti-flash inline `<script>` (designed to run once,
before React hydrates, to set the theme class before first paint) then gets remounted OUTSIDE that hydration
pass, and React logs "Encountered a script tag while rendering React component" on every switch — a warning
that signals the anti-flash guarantee itself is now unreliable post-switch, not just cosmetic noise.

**Lesson:** a provider whose correctness depends on running exactly once, before hydration (an anti-flash
theme script is the common case) cannot safely live inside a dynamic segment that a client-side navigation is
expected to change — crossing that segment via `router.push()` re-triggers the provider's mount machinery
mid-tree instead of a real hydration pass, breaking the "before first paint" guarantee the provider relies on.
The general options are: (a) restructure so the provider lives in a locale-INDEPENDENT root layout (bigger,
riskier change), or (b) make navigations that change the segment's param do a FULL document navigation
instead of a client-side one — semantically justified when the param change already implies `<html lang>`
and all copy change anyway (a language switch is not "the same page, new state").

**Apply next time:** before nesting an anti-flash/pre-hydration script-owning provider inside any dynamic
route segment, check whether normal app navigation is expected to change that segment's param on the client;
if so, either hoist the provider above the dynamic segment, or force navigations that change that param to be
full document loads rather than client-side transitions.
