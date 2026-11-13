---
id: LESSON-0678
type: gotcha
domain: testing
tags: [vitest, test-isolation, shuffled-order, localstorage, matchmedia, module-cache, flaky-tests]
context: a vitest suite that passes under its old/default run order starts failing (or had been silently relying on cross-test contamination to pass) once tests run in randomized order with an explicit seed
trigger: use this when a vitest suite's test-order randomization (DR-146's shuffled run + fixed seed) surfaces assertions that only pass/fail depending on which tests ran before them
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-11-12 (agent-inferred)"
provenance: agent-inferred
created: 2026-11-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0097, LESSON-0671, DR-146]
---

**Situation:** once the project's test runs started using Vitest's shuffled order with an explicit,
reproducible seed (DR-146), assertions that had quietly depended on execution order began failing. Root
cause was not flakiness in the usual timing/network sense but **cross-test pollution via shared global
mutable state** that no test was resetting: `localStorage` left populated by an earlier test, `matchMedia`
replaced (mocked) in one test and never restored for the next, and the module cache retaining a
`vi.doMock` override from a prior test into a later one that expected the real module.

**Lesson:** a suite's pass/fail record under one fixed execution order proves nothing about test
isolation — it only proves that order happens to not expose the shared-state leaks. Randomized order with
a fixed seed is a cheap, free detector for exactly this class of defect (a complement to LESSON-0097's
narrower Node-vs-jsdom `localStorage` shadowing and LESSON-0671's broader owner policy on flaky tests):
any global the test environment exposes (storage APIs, `matchMedia`/other `window` property overrides,
`vi.doMock`'s module registry) is a leak vector unless a test explicitly owns and resets it.

**Apply next time:** when a shuffled/seeded test run surfaces assertions that only fail depending on
what ran earlier, don't chase it as app-code flakiness — isolate the fixture: clear `localStorage` (and
any other storage) in `beforeEach`/`afterEach`, restore any replaced `window`/global (e.g. `matchMedia`)
to its original value or re-apply the mock per-test rather than once for the file, and prefer `vi.mock`
(hoisted, consistent per test file) or explicit `vi.doUnmock`/`vi.resetModules()` after a `vi.doMock` so
the module cache doesn't bleed into the next test. Reproduce the exact failing order with the printed/
`PANDACORP_VITEST_SEED` seed (DR-146) before and after the fix to confirm the isolation actually closed
the gap, not just that the suite happened to pass again.
