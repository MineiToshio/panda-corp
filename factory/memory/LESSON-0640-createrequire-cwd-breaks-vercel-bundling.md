---
id: LESSON-0640
type: anti-pattern
domain: nextjs
tags: [vercel, nft, bundling, createRequire, module-not-found, serverless]
context: a Next.js server/proxy module that needs to dynamically require another module at runtime
trigger: use this when a Next.js server-side module reaches for createRequire(join(process.cwd(), ...)) to load another module dynamically, before it ships to Vercel
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-08 (agent-inferred): loading a module via createRequire(join(process.cwd(), ...)) in Next proxy/server code worked locally but crashed on Vercel with MODULE_NOT_FOUND, because Vercel's file-tracing bundler (nft) can't see a dynamic require built from a runtime cwd-joined path; fixed with a static import plus a regression test"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** Next.js server/proxy code loaded a module at runtime with `createRequire(join(process.cwd(),
...))`. It worked in local `next dev`/`next start` (where the full filesystem is present), but Vercel's
production deploy crashed with `MODULE_NOT_FOUND` — the module simply wasn't present in the deployed
function's bundle.

**Lesson:** Vercel's deploy bundler (Next's file-tracing, `nft`) determines which files to include in a
serverless function by statically analyzing `import`/`require` calls at build time. A `require` built
dynamically from a runtime-computed path (`createRequire` + `process.cwd()` + string-joined path) is
invisible to that static analysis — the bundler cannot trace it, so the required file is silently left out
of the deployed bundle. The gap only shows up in production, because local dev has the whole repo on disk
and never needs the trace to be complete.

**Apply next time:** never load a module via `createRequire(join(process.cwd(), ...))` (or any other
dynamically-constructed require path) in Next.js server/proxy/API code that will deploy to Vercel (or any
nft-based serverless bundler) — use a static `import`/`require` with a literal path instead, so the
bundler's file tracer can see and include it. Add a regression test that asserts the module loads via a
static dependency path, so a future refactor can't silently reintroduce the dynamic form.
