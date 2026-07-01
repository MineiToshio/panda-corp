---
id: LESSON-0017
type: gotcha
domain: testing
tags: [vitest, react, fake-timers, flushSync, act, testing-library]
context: testing a React component that reverts state via setTimeout (e.g. a copy-confirmation flash), using vitest fake timers
source: mission-control lessons.md (2026-06-16) — WO building the CopyButton/copy-confirmation component
provenance: agent-inferred
created: 2026-06-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
links: []
---

**Situation:** A React component using `setTimeout` to revert state (e.g. `setCopied(false)` after a
copy-confirmation flash) tested with `vi.advanceTimersByTime()` — the callback runs synchronously OUTSIDE
React's `act()`, so the state update isn't flushed to the DOM before the test's assertion runs, producing
a flaky/failing test even though the component behaves correctly in the browser.

**Lesson:**
1. Wrap the timer-triggered state update in `flushSync` (from `react-dom`) so it's synchronous when the
   fake timer fires — `flushSync(() => setCopied(false))` inside the `setTimeout` callback.
2. Separately: `vitest 4.1.9` does not ship `vi.runAllMicrotasksAsync` — polyfill it in `vitest.setup.ts` as
   an `act()`-wrapped chain of `await Promise.resolve()` calls, and declare its TS type via a `declare
   module "vitest"` augmentation placed **inside** `vitest.setup.ts` itself (a real module with imports) —
   a standalone `vitest.d.ts` with the same augmentation breaks vitest's own exported members
   (`afterEach`/`describe`/`vi`).

**Apply next time:** Any component with a `setTimeout`-driven state revert tested under vitest fake timers
needs `flushSync` in the callback (or an equivalent explicit `act()` wrap) to avoid a false-flaky DOM
assertion; keep the microtask-polyfill + its type augmentation together in `vitest.setup.ts`, never split
across a `.d.ts`.
