---
id: LESSON-0139
type: gotcha
domain: testing
tags: [playwright, hydration, client-component, flake, topass, domcontentloaded]
context: a Playwright spec that clicks/interacts with an element immediately after navigation resolves (`domcontentloaded`), on a page where that element belongs to a React Client Component
trigger: use this when a Playwright click or interaction fails with "element not found" right after navigation, on a page/component that needs client-side hydration, and the failure reads like an unrelated flake rather than a real interaction bug
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-10 (agent-inferred) — a Playwright click right after domcontentloaded landed on an un-hydrated Client Component under load, failing as 'element not found'; fixed by wrapping click+assert in expect(...).toPass() instead of guessing at animation/timing waits"
provenance: agent-inferred
created: 2026-07-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0040, LESSON-0066, LESSON-0079]
---

**Situation:** a Playwright spec navigated with `waitUntil: "domcontentloaded"` and immediately clicked an
element belonging to a React Client Component. Under load, the click landed before React finished
hydrating that component, and the assertion failed with a generic "element not found" — indistinguishable
at first glance from a real interaction bug, since `domcontentloaded` had already resolved and the element
existed in the static HTML.

**Lesson:** `domcontentloaded` only guarantees the initial HTML parsed; it says nothing about React
hydration completing for a Client Component, which is a separate, timing-variable step. This is a THIRD
distinct Playwright flake class in the same family as LESSON-0040 (port/process collision) and LESSON-0066
/ LESSON-0079 (network-idle unreliability, cold-boot server warm-up) — all four share the symptom
"element/interaction not found right after navigation, looks like a regression" but have different root
causes (process collision vs. network heuristic vs. server warm-up vs. client hydration lag), so the fix
for one does not transfer to another.

**Apply next time:** when a click/interaction immediately follows navigation on a page with Client
Components, do not guess at a fixed extra wait or switch to `networkidle` (which reintroduces LESSON-0066's
trap) — wrap the click+assertion in `expect(async () => { ... }).toPass()` (or the equivalent
retry-until-true assertion) so Playwright retries through the hydration window instead of failing on the
first un-hydrated attempt. If an "element not found" failure appears only under load/first-run and not on
isolated re-runs, check hydration timing before suspecting the interaction logic itself.
