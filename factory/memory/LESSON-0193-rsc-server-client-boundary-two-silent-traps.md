---
id: LESSON-0193
type: gotcha
domain: nextjs
tags: [rsc, server-components, client-boundary, csp, mdx, use-client]
context: implementing a feature that crosses the Next.js Server/Client Component boundary, especially a lookup map keyed to client components, or code that dynamically compiles/evaluates content (e.g. client-side MDX)
trigger: use this when a Server Component needs to read a value exported by a "use client" module, OR when deciding where to run code that uses `new Function`/`eval` (e.g. client-side MDX compilation) under a CSP that may forbid `unsafe-eval` in production
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-06 (agent-inferred)"
provenance: agent-inferred
created: 2026-09-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0194]
---

**Situation:** two silent traps found crossing the RSC server/client boundary in the same feature.
(1) A Server Component read an object exported by a `"use client"` module (`export const map = { pre: Foo
}`). It CAN render the client COMPONENTS inside that object (they arrive as client references), but
reading the object itself from server code evaporates it: a spread returns empty, an override falls back
to the default, and the UI silently disappears with no thrown error. (2) Anything using `new
Function`/`eval` (here, `getMDXComponent` for client-side MDX rendering) cannot safely live in a client
boundary once production's CSP lacks `unsafe-eval` — it works fine in dev (looser CSP) and breaks only in
production, with no local signal.

**Lesson:** the RSC boundary has failure modes that stay invisible until you specifically exercise the
crossing: reading a client-exported non-component VALUE from server code, and shipping eval-based
rendering into a client boundary that a stricter production CSP will reject.

**Apply next time:**
1. Build maps/lookups that reference client components on the SERVER side, keyed to the component
   reference itself — never import them as plain data from a `"use client"` module.
2. Render anything that uses `new Function`/`eval` (client-side MDX compilation, similar dynamic-code
   patterns) on the SERVER and pass the result to the client component as a `ReactNode` prop; context
   still flows correctly because it depends on tree position, not on where the element was created.
3. Prefer making the invariant STRUCTURAL over relying on discipline — e.g. remove `html`/raw-markup from
   the prop type a client component accepts, so it cannot compile MDX even if someone tries.
4. A structural guard (scan the tree for a `"use client"` boundary plus a forbidden import) catches what
   e2e cannot and runs in milliseconds — but always prove it fails RED against a real violation before
   trusting it green.
