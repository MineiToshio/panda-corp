---
id: LESSON-0440
type: pattern
domain: testing
tags: [e2e, playwright, test-hygiene, delegation, codex, cross-runtime]
context: delegating the authorship of e2e tests to an agent/runtime less tuned to this project's own test conventions (a different runtime, a fresh contributor, an external reviewer writing tests)
trigger: use this when briefing ANY agent — a different runtime, a fresh contributor — to author or extend an e2e test suite for an existing project
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-19 (agent-inferred), Codex-written FRD-05 gate tests"
provenance: agent-inferred
created: 2026-10-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0067]
---

**Situation:** Codex-written reviewer e2e tests (for an FRD-05 gate) shipped with two hygiene defects
that the existing project's OWN gates would have caught had they been habitual for the author: an
unscoped `getByRole('alert')` locator that ALSO matched Next.js's own route announcer (a false-positive
match), and an order-dependent test that relied on state shared with another test (passed alone, failed
depending on run order).

**Lesson:** test-hygiene conventions (scoped locators, order-independence, each test owning its own
fixtures) are often tacit — enforced by habit and prior review inside a team/runtime, never written down
anywhere a new author could read them. An agent unfamiliar with those tacit conventions, even a
technically capable one, will not reproduce them by default; it has to be told explicitly.

**Apply next time:** when delegating e2e test authorship to an agent/runtime not already steeped in this
project's test conventions, state the test-hygiene rules EXPLICITLY in the brief: every locator must be
scoped to avoid matching framework-level accessibility landmarks, every test must pass both alone AND in
any run order, and every test must set up its own fixture data rather than relying on another test's
side effects.
