---
id: LESSON-0578
type: gotcha
domain: nextjs
tags: [nextjs, cold-start, dev-server, route-compilation, revalidate, timeout]
context: a signed/authenticated revalidation or webhook-style endpoint hit against a `pnpm dev` (Next.js dev server) instance that has not yet compiled that route
trigger: use this when a revalidate/webhook-style endpoint with a short (seconds-scale) timeout budget reports a timeout/stale result on its FIRST hit against a Next.js dev server, but succeeds on retry
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-30 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-31
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** funko-tracker's signed local `catalog:revalidate` call has a 10-second budget. The first
hit against a freshly started `pnpm dev` server had to JIT-compile that route (Next.js dev's on-demand
route compilation) before the endpoint could even start its own work, exceeded the 10s budget, and was
reported as stale/failed — a retry against the now-compiled route succeeded immediately.

**Lesson:** a short, fixed timeout budget for a dev-server-hosted endpoint implicitly budgets only for
the endpoint's OWN logic — it does not account for Next.js dev's one-time, per-route JIT compilation cost
on cold start, which alone can consume the entire budget before any real work starts. The symptom
(reported timeout/stale) looks exactly like a real revalidation failure.

**Apply next time:** when testing or calling a webhook-style/revalidate endpoint against a Next.js DEV
server (not an issue against a production `next start`/`next build` server, where routes are
pre-compiled), warm the route first with a throwaway request — or extend the timeout budget for dev-only
testing — before trusting a timeout as a real failure; don't apply the same tight timeout budget
uncritically to dev and production.
