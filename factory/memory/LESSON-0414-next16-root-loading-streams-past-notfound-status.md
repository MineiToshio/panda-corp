---
id: LESSON-0414
type: gotcha
domain: nextjs
tags: [nextjs16, app-router, loading-tsx, streaming, notfound, status-code, spoiler-safety]
context: a Next.js 16 App Router project with a root app/loading.tsx and page-level notFound() calls used to render an "unknown/ineligible" state
trigger: use this when relying on notFound()'s HTTP status code (404) as a test oracle or as a signal consumers read, in an App Router project that has a root-level loading.tsx
source: "pandasaga .pandacorp/run/lessons.md 2026-10-15 (agent-inferred): In Next 16 App Router a root app/loading.tsx makes every nested page stream, so a later notFound() for an unknown/ineligible id answers 200, not 404; spoiler-safe unknown == ineligible states should render one shared unavailable component inline and tests should assert the rendered state, never the status code."
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0162]
---

**Situation:** a root-level `app/loading.tsx` was added to show an instant loading shell while nested
pages fetch data. Once present, Next streams the response: the initial HTTP response (status 200) is sent
immediately with the loading shell, and the page's actual content — including any `notFound()` call made
later during rendering — is streamed in afterward over the SAME already-200 response. A page that calls
`notFound()` for an unknown/ineligible resource id therefore never produces an HTTP 404; the response
status was already committed to 200 before the `notFound()` branch even ran.

**Lesson:** this is a distinct mechanism from LESSON-0162's root-not-found-tsx gap (which is about an
entirely MISSING root boundary) — here the root boundary exists and the page-level `notFound()` call is
itself correct, but App Router's streaming model means the HTTP status code it sets is no longer a
reliable signal once a root `loading.tsx` is in play: status codes commit as soon as the first chunk of
the stream flushes, which happens before a deeper `notFound()` resolves. Any consumer (status-code-based
test assertions, a status-code-based access check, spoiler-safety logic distinguishing "doesn't exist"
from "not yet unlocked") that relies on the 404 status will see 200 instead and silently misbehave.

**Apply next time:** in an App Router project with a root (or any ancestor) `loading.tsx`, never treat a
descendant page's `notFound()` HTTP status as a reliable signal — test and gate on the RENDERED content
instead (assert the actual unavailable/not-found UI appears in the DOM), not the response status code. For
spoiler-safe "unknown id == ineligible id" states specifically, render ONE shared inline "unavailable"
component for both cases rather than relying on status-code semantics to distinguish them.
