---
id: LESSON-0472
type: anti-pattern
domain: frontend
tags: [hydration, ssr, client-component, disabled-until-mount, testing-methodology]
context: an interactive control (menu, form field) rendered server-side that must wait for client-side React bindings before it can safely respond to a click
trigger: use this when building or testing an interactive control whose behavior depends on React event handlers that only attach after hydration
provenance: agent-inferred
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-20 (agent-inferred) — AccountMenu and GoalEditor controls; same-project follow-up 2026-10-21, commit 95d30f46f86a1c5b38cb221ad1c37465bcc3e1b3 and funko-tracker-branded-email/.pandacorp/run/branded-email/{readiness-probes.json,readiness-fixed-probes.json,readiness-unit-independent.log}"
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

**Same-project follow-up (2026-10-21):** a controlled checkbox adds a misleading native success signal:
before hydration, clicking changed `checked` to true while `aria-checked`, the selected-row summary and
React's draft remained false. Hydration reset it, and saving did not persist the selection. The hydrated
control persisted normally. A Wishlist remove button likewise produced no POST or toast before
hydration, but both after hydration. Commit `95d30f4` shares a `useSyncExternalStore` readiness hook and
disables these controls in SSR. Held-JS browser probes then observed disabled controls before hydration
and successful persistence / POST / toast after it; an independent run passed the three readiness tests.
Do not treat `checkbox.checked` alone as proof of a controlled React change: assert the application's
selected state and the persisted result. This extends the existing lesson, rather than establishing a
new hydration rule or cross-project corroboration. Final canonical receipts under
`funko-tracker/.pandacorp/run/branded-email/` (`full-gate.json`, `final-full-verify.log`,
`final-optimized-receipt.json`) verify source `95d30f4`: all 11 standard subgates green,
1,493 unit tests in 373 files and 356 browser tests passing (two production-only cases skipped in the
default development run). A separate optimized production smoke passed two tests; this is not evidence
that the whole browser suite passed in optimized mode.
