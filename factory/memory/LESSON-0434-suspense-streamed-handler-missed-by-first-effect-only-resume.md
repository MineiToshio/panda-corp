---
id: LESSON-0434
type: gotcha
domain: nextjs
tags: [react, suspense, streaming, useeffect, resume-pattern, hydration]
context: a root-layout (or any ancestor) component that resumes a pending action by reading a client-side handler registry inside its OWN first `useEffect`
trigger: use this when designing a "resume after mount" pattern that depends on a handler registered by a DIFFERENT component, and that component may be streamed in later under `<Suspense>`
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-18 (agent-inferred), FRD-03 gate"
provenance: agent-inferred
created: 2026-10-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a root-layout "resumer" read a client-side handler registry inside its own first
`useEffect` to resume a pending action after mount. Components streamed in LATER under a `<Suspense>`
boundary (common on a full document load) register their handlers after the resumer's first effect
already ran — so the resumer never sees them. A unit test with a pre-registered handler never exposed
this, because the handler was already present before the resumer's effect fired; only an e2e test that
drove a REAL sign-in (and therefore a real full-document load with real streaming timing) reproduced it.

**Lesson:** "read once on first mount" is only safe when every dependency is guaranteed to exist BEFORE
that mount — which Suspense streaming does not guarantee for a sibling/descendant registered later in
the stream. A resume pattern that silently assumes synchronous availability will pass every test that
pre-populates its dependency and fail only under the realistic timing a genuine streamed load produces.

**Apply next time:** a resume/consumer effect that depends on a registry populated by a component that
may stream in later must RETRY (poll, subscribe, or re-run on a registration event) rather than read
once — and its test coverage must include at least one full, real-navigation e2e test (not just a unit
test with the dependency pre-seeded) to catch the timing-dependent case.
