---
id: LESSON-0195
type: gotcha
domain: react
tags: [react, useeffect, effect-order, analytics-init, provider]
context: a Provider component that initializes an SDK (analytics, telemetry, feature flags) inside its own `useEffect`, with subtree components that also call that SDK from their OWN mount effects
trigger: use this when a Provider initializes any SDK inside `useEffect` and components in its subtree also track/call that SDK from their own mount effects
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-06 (agent-inferred)"
provenance: agent-inferred
created: 2026-09-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0194]
---

**Situation:** an analytics Provider initialized its SDK inside `useEffect`. Trackers mounted in its
subtree ALSO fired from their own mount effects — and consistently arrived before the SDK was ready,
silently dropping the earliest events.

**Lesson:** React fires child effects BEFORE parent effects (bottom-up), so a Provider that initializes a
dependency in `useEffect` is structurally guaranteed to run AFTER at least the first render of every
subtree consumer's own mount effect. This is not a race that sometimes loses — it always loses on initial
mount.

**Apply next time:** never assume a Provider's `useEffect` init completes before a child's own `useEffect`
runs. A cheap fix that doesn't touch the architecture: buffer calls in the wrapper (queue them) until init
resolves, then flush the buffer — this survives the ordering without moving init out of an effect or
requiring every consumer to wait on a ready-flag.
