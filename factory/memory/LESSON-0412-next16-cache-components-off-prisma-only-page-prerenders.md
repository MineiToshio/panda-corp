---
id: LESSON-0412
type: gotcha
domain: nextjs
tags: [nextjs16, cache-components, prerendering, prisma, dynamic-rendering]
context: a Next.js 16 App Router page that only reads from Prisma (no cookies/headers/searchParams) in a project that has NOT opted into Cache Components
trigger: use this when a Next 16 page that should reflect live database state instead serves build-time/stale data, with no obvious caching directive anywhere in the page's own code
source: "pandasaga .pandacorp/run/lessons.md 2026-10-15 (agent-inferred): With Cache Components off, a Next 16 page that only queries Prisma (no request API) is prerendered at build; 'not cached' needs await connection() or force-dynamic."
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a Next.js 16 App Router page component only called a Prisma query — it never read
`cookies()`, `headers()`, or `searchParams`, none of the usual "this makes a route dynamic" signals. With
the project's Cache Components feature flag OFF (the default for most projects not yet opted in), Next
treated the page as fully static and PRERENDERED it at build time: the database query ran once, at build,
and every subsequent request served that frozen snapshot — with no error, warning, or any caching
directive visible in the page's own source to explain why.

**Lesson:** in Next 16 without Cache Components enabled, "reads a dynamic data source" (a database query)
is NOT by itself a signal that makes a route dynamic — only specific request-time APIs (`cookies()`,
`headers()`, `draftMode()`, `searchParams`, or an explicit opt-out) do. A page whose only "dynamic-looking"
work is a plain data-layer call will silently prerender at build and serve stale data forever unless told
otherwise.

**Apply next time:** for any Next 16 page (with Cache Components off) that must reflect live backend state
and has no other request-time API call, explicitly force dynamic rendering: `await connection()` (the
documented Next API for "opt this render into dynamic/per-request behavior") or `export const dynamic =
'force-dynamic'` at the route segment. Don't rely on "it queries a database" as an implicit dynamic signal
— verify by checking the build output's route type (Static vs Dynamic) for every page that reads live
data.
