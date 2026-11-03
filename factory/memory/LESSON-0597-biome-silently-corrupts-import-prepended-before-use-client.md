---
id: LESSON-0597
type: gotcha
domain: nextjs
tags: [biome, formatter, use-client, rsc, next-build]
context: editing a Next.js file that starts with the `"use client"` directive and adding/reordering an import above it
trigger: use this when a Next.js client file behaves as if it were a Server Component after an edit, with no error from tsc or biome, and the file's TOP had a recent edit near its import lines
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-31/11-01 (agent-inferred)"
provenance: agent-inferred
created: 2026-11-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0193]
---

**Situation:** a late edit prepended an `import` statement above the file's `"use client"` directive
(which must be the very first statement). Biome's formatter silently rewrote the now-second-statement
directive from `"use client"` into `("use client")` — a harmless-looking parenthesized expression
statement, not a directive at all. Neither `tsc` nor `biome` flagged an error; the file type-checks and
lints clean. Only `next build` (which specifically requires the directive to be the literal first
statement) caught that the file had silently stopped being a Client Component.

**Lesson:** `tsc` and `biome` have no concept of the `"use client"` directive's positional contract — to
them, `("use client")` is just a valid, harmless expression statement, so a formatter-driven corruption of
the directive produces ZERO signal from the fast, commonly-run checks. The only check that actually
enforces directive-first placement is the Next.js build itself.

**Apply next time:** never place an edit (an import, a comment, anything) above `"use client"`/`"use
server"` in a file — these directives must stay the literal first statement. After any edit near the top
of such a file, re-open it and visually confirm the directive is still the first line (or run `next build`
on a sample), rather than trusting a green `tsc`/`biome` pass as proof the file still compiles as intended.
