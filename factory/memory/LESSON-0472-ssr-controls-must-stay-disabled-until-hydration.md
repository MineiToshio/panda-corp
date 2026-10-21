---
id: LESSON-0472
type: anti-pattern
domain: frontend
tags: [hydration, ssr, client-component, disabled-until-mount, testing-methodology]
context: an interactive control (menu, form field) rendered server-side that must wait for client-side React bindings before it can safely respond to a click
trigger: use this when building or testing an interactive control whose behavior depends on React event handlers that only attach after hydration
provenance: agent-inferred
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-20 (agent-inferred) — AccountMenu and GoalEditor controls"
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0197, LESSON-0139, LESSON-0436]
---

**Situation:** `AccountMenu` and `GoalEditor` controls looked usable in the server-rendered HTML
(visually enabled, no `disabled` attribute) but silently dropped clicks before React finished
hydrating. A real test with Next's JS chunks deliberately retained/delayed showed the controls
rendered as enabled markup with NO React event bindings attached yet — a state a hydrated-only RTL
render or a fast local dev reload never reproduces, because hydration there completes almost
instantly.

**Lesson:** "visually enabled in served HTML" and "actually wired to a handler" are two different
facts that can diverge for an arbitrarily long (or slow-network-dependent) window. A control that
looks interactive in its SSR snapshot but has no attached handler yet will silently eat a click
rather than erroring, so the defect is invisible to any test that only checks the hydrated end state.

**Apply next time:** keep interactive controls explicitly `disabled` (or otherwise visibly
non-interactive) until the client confirms mount/hydration, rather than relying on the SSR markup
looking enabled. Test BOTH the raw pre-hydration SSR snapshot (with JS chunks retained/delayed) and
the fully hydrated RTL/Playwright render — a passing hydrated-only test suite does not prove the
pre-hydration window is safe.
