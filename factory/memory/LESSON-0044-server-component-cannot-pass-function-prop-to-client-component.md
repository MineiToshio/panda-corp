---
id: LESSON-0044
type: gotcha
domain: nextjs
tags: [react-server-components, rsc, client-component, function-prop, prerender]
context: a Next.js Server Component passing a formatter or callback function as a prop to a Client Component
trigger: use this when a Server Component needs to pass a formatter/callback function as a prop to a Client Component in a Next.js App Router project
source: "personal-page-v2 .pandacorp/run/lessons.md"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a Server Component tried to pass a formatter FUNCTION prop (e.g. `(index: number) =>
string`) to a Client Component. Next.js throws "Functions cannot be passed directly to Client Components"
at prerender time, not at typecheck — the type system does not catch this.

**Lesson:** functions cannot cross the RSC (Server → Client) boundary as props, and this fails silently
at typecheck (TypeScript has no notion of the RSC serialization boundary) — it only surfaces as a runtime
prerender error.

**Apply next time:** resolve the function server-side into a plain, serializable value (e.g. a
precomputed string tuple/array, or the specific formatted values needed) BEFORE passing it as a prop
across the RSC boundary, rather than passing the function itself.
