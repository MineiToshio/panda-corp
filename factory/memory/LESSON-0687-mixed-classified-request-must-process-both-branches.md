---
id: LESSON-0687
type: anti-pattern
domain: build-engine
tags: [request-classification, dispatch, dispute, scope-repair, control-flow]
context: a single incoming request bundles two different kinds of items (e.g. an ordinary fix plus a disputed/protected one) that are normally handled by two separate code paths
trigger: use this when a dispatcher/classifier decides "which branch handles this request" by checking for the presence of ONE special category (a dispute, an exception, a protected item) inside a request that may also contain ordinary items
source: "funko-tracker br-2026-11-16-01, BL-0329 — mixed file-approval requests containing both an ordinary artifact fix and a protected-test dispute were routed to the dispute-only branch, which silently discarded the ordinary artifact repair instead of applying it before opening the dispute."
provenance: agent-inferred
created: 2026-11-18
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0327, BL-0329]
---

**Situation:** a scope-repair request named files spanning two categories: ordinary artifacts that could be
approved directly, and one protected/disputed file requiring owner sign-off. The classification logic
checked "does this request touch a protected item?" and, on yes, routed the whole request to the
dispute-opening branch alone — which never touched the ordinary artifacts at all, silently dropping that
half of the requested repair.

**Lesson:** when a single request can legitimately contain items from more than one category, a
classifier that picks exactly one branch based on the presence of the "special" category will silently
discard whichever other category's items were also present — the bug is invisible in the common case
(a request containing ONLY one category) and only appears on a mixed request, which is exactly the shape
most likely to be under-tested.

**Apply next time:** when a request/payload can contain items of more than one kind, process each kind on
its own path within the SAME request (ordinary items applied directly; special items routed to their own
sub-flow) rather than using the special category's mere presence to select a single exclusive branch for
the whole request. Add a mixed-category fixture (not just a pure-ordinary and a pure-special one) to any
test suite covering this kind of classifier.
