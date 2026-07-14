---
id: LESSON-0163
type: gotcha
domain: react
tags: [react, dom, mdx, client-navigation, reparenting]
context: an MDX/markdown rendering pipeline post-processes rendered code blocks (or any React-rendered subtree) with a client-side effect that moves/reparents raw DOM nodes for a UI enhancement (e.g. a copy button, syntax decoration)
trigger: use this when a client-side effect directly manipulates or reparents DOM nodes inside a React-rendered subtree, especially anything React might re-render or unmount on client-side navigation
source: "personal-page-v2 docs/decision-log.md 2026-07-11 (Full-site QA overhaul) — a fixed production bug: `CodeBlockEnhancer`, a client effect that reparented React-owned DOM to add copy-button chrome to rendered code blocks, crashed with `NotFoundError` on client-side navigation; fixed by replacing the DOM-manipulating effect with a React-owned MDX `pre` component override (`CodeBlock`)"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0168]
---

**Situation:** a `useEffect`-based enhancer directly moved/wrapped DOM nodes that React had rendered and
still owned (React's virtual DOM diff still expected those nodes at their original positions). On a normal
full page load this worked (React had already committed once, and the reparenting happened after). On
CLIENT-SIDE navigation, React re-rendered/reconciled the subtree, tried to remove/move a node the effect had
already detached and relocated, and threw `NotFoundError` — a crash invisible in any test that only exercises
a fresh page load.

**Lesson:** any DOM-manipulating effect (moving nodes, wrapping them in new containers, injecting siblings
directly via `appendChild`/`insertBefore`) that touches elements React rendered is a latent crash under
client-side navigation/reconciliation, even if it works perfectly on first mount — because React's internal
node bookkeeping and the effect's direct DOM mutation are now two sources of truth for the same nodes, and
they diverge the moment React tries to reconcile again. The general fix is not a defensive check in the
effect; it is to stop the direct manipulation entirely and express the same visual enhancement as a
React-owned component (here: an MDX component override for the element being enhanced, e.g. `pre`) so React
is the only thing that ever creates/removes/moves those nodes.

**Apply next time:** when a rendering pipeline needs to "enhance" already-rendered content (copy buttons,
syntax highlighting glue, badges) with client-side DOM tricks, prefer a component override (MDX component map,
a wrapper component) over a `useEffect` that reparents/mutates existing DOM — and specifically test the
enhancement survives a CLIENT-SIDE navigation to/from the page, not just a fresh load, since that is exactly
where DOM-ownership conflicts surface.
