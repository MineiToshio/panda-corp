---
id: LESSON-0683
type: gotcha
domain: nextjs
tags: [app-router, next16, useActionState, server-actions, progressive-enhancement, streaming, loading-tsx, no-js, decodeFormState]
context: a Next.js App Router route uses a Server Action with useActionState behind a segment loading.tsx, and must keep working for a native (JavaScript-disabled) multipart form POST, not only for the hydrated client path
trigger: use this when a native/no-JS form submission against a Server Action appears to produce no visible result (an empty/missing region) even though the action itself ran correctly, in a route segment that has an automatic loading.tsx streaming boundary
source: "funko-tracker, FRD-01 catalog-browsing, commits 72797cbb/8ad0883a/ef4a27a9 and docs/decision-log.md 2026-11-14 + docs/reviews/e2e-platform-inventory.md section 'Native Discovery response streaming after 8ad0883a': a native (no-JS) POST to the Explore route's Discovery action returned the correct zero/two-card result, but React restored it inside a hidden `S:` streamed buffer behind the segment's pending loading.tsx boundary; a script-disabled client can never reveal that buffer, so the result page looked empty. The fix detects the absence of Next's `next-action` fetch header (i.e. a native form submission) and renders the result directly in the Explore layout outside the automatic loading boundary, reusing the same useActionState server reference and permalink; GET and hydrated-action requests keep the original independent streams. The regression that caught it used Next's real server-reference form encoder plus decodeFormState on React's complete HTML document stream (no browser, no Next server) — a prior test that only checked the static HTML for a DOM test-id after the POST had NOT exercised this path and passed falsely."
provenance: agent-inferred
created: 2026-11-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0414]
---

**Situation:** a route segment had an automatic `loading.tsx` Suspense boundary, and a Server Action
(`useActionState`) on that route needed to keep working for a native, JavaScript-disabled form
submission (progressive enhancement), not only for the client-hydrated path. The action's returned
state WAS correct, but a script-disabled browser receiving the completed HTTP response could not see
it: React had placed the restored result inside a hidden streamed buffer behind the segment's pending
loading boundary, which only a script execution normally flushes into the visible DOM.

**Lesson:** App Router's automatic streaming boundary (`loading.tsx`) is not merely a cosmetic shell —
for a native/no-JS form POST it can hide a Server Action's own correctly-restored `useActionState`
result inside a buffer that never becomes visible without JavaScript. This is a distinct mechanism from
LESSON-0414 (which is about `notFound()`'s HTTP status committing early once a root `loading.tsx` makes
the response stream): here the STATUS and the ACTION RESULT are both correct, but the rendered HTML
reachable without scripts is empty. The fix is to detect the no-JS case (the absence of Next's internal
`next-action` fetch header distinguishes a native multipart POST from a client/hydrated action call) and
render the result directly, outside the automatic loading boundary, while leaving the normal GET/hydrated
paths untouched. Testing this also requires a different tool: simply POSTing and checking the returned
static HTML for a marker is not sufficient (a test that does only that can pass even when the real
buffering bug is present) — the reliable regression encodes the actual form with Next's own
server-reference encoder and decodes the response with `decodeFormState` against React's real,
complete HTML stream.

**Apply next time:** in an App Router project that supports native/no-JS form submission against a
Server Action on a route segment with its own `loading.tsx`, don't assume "the action returned the right
state" is equivalent to "a script-disabled client can see it" — verify the no-JS path by decoding the
real HTML stream (Next's server-reference encoder + `decodeFormState`), not just by checking the static
HTML for an expected marker. If the result is missing for the native path specifically, render it
outside the segment's automatic streaming boundary when the `next-action` header is absent, while
keeping GET and hydrated-action requests on their normal independent streams.

**Second occurrence, same project, a different slot — the boundary also wraps parallel-route slots, not
only the main segment (funko-tracker, 2026-11-17, docs/decision-log.md + `docs/frds/frd-12-web-performance/
blueprint.md#native-goal-receiver-in-the-request-layout--2026-11-17`):** the first full-browser run past
the personal-island specs showed a native (no-JS) goal POST's result hidden inside a streamed buffer
again — this time because the segment's `loading.tsx` boundary also wraps its `@goal` parallel-route
slot, not just the segment's own direct children. The fix generalizes the same way: render the native
goal receiver directly in the route's request layout (outside the automatic boundary) and remove the
`@goal` slot, reusing the verified native-action-kind detection for both Discovery and goal. **Apply next
time (addition):** when auditing a `loading.tsx`-boundary route for this class of bug, check every
parallel-route slot it wraps, not only the segment's main `page.tsx`/action — the boundary's streaming
applies to the whole segment tree, so any Server Action reachable through ANY of its slots can hide its
native-POST result the same way. Still single-project evidence (both occurrences are funko-tracker); stays
`candidate` per DR-047 until a different project corroborates it.
