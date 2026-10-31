---
id: LESSON-0562
type: gotcha
domain: routing
tags: [url, normalization, validation, route-grammar, order-of-operations]
context: a route/URL handler normalizes the input before validating it against the route grammar
trigger: "use this when a route/URL parser normalizes input (e.g. collapsing or trimming a path tail) before checking it against the route grammar — before trusting that an invalid tail is correctly rejected"
source: "mission-control factory/memory/_inbox.md 2026-10-30 (agent-inferred) — FRD-25 gate: normalizing a URL before validating its grammar erased invalid tails, turning them into valid selections; caught by v2-boundaries.reviewer.test.tsx, AC-25-008.1, red against extra tails beyond the ones routeHref itself produces"
provenance: agent-inferred
created: 2026-10-31
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** a route handler ran a normalization step (cleaning up a URL's path tail) BEFORE checking
the result against the route grammar. For certain malformed/extra tails, normalization itself erased the
invalid part, so the grammar check saw an already-cleaned, valid-looking path and accepted an input that
should have been rejected. The gap only surfaced when the test suite fed tails the app's own `routeHref`
helper would never itself produce (i.e. genuinely adversarial/out-of-grammar input), not just the paths
the app generates internally.

**Lesson:** normalizing input before validating it can silently convert an invalid input into a valid
one when the normalization step is lossy (trimming, collapsing, truncating) — the validator then never
sees the thing that was actually wrong. Order of operations matters: a grammar/shape check needs to run
against the RAW input (or normalization needs to be grammar-aware itself, rejecting instead of silently
cleaning up anything outside the grammar). Testing only with paths the app's own URL-building helper
produces is not enough — it never generates the malformed tails that only directly-typed or adversarial
input would.

**Apply next time:** when a route/URL parser normalizes its input, test the normalizer itself against
adversarial/extra tails beyond what the app's own URL-building helper would generate, not just round-trip
cases; if normalization can delete/collapse an invalid segment, validate the grammar BEFORE normalizing,
or make the normalization step itself grammar-aware (reject rather than silently clean up anything
outside the grammar).
