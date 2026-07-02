---
id: LESSON-0014
type: library-verdict
domain: content-cms
tags: [blog, cms, mdx, velite, next-mdx, contentlayer, seo, static-generation]
context: choosing a content/blog architecture for a developer blog that needs SEO and a static build
trigger: use this when choosing a blog/content architecture for a developer site that needs SEO and a static build
source: "factory/memory/_inbox.md (2026-06-2x) — real-world failure observed: toshiominei.com returns HTTP 500 opening a post on a client-rendered/server-backed blog"
provenance: agent-inferred
created: 2026-06-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
links: []
---

**Need:** A developer blog/CMS that needs good SEO and a reliable static build.

**Tried:** A server-side/client-rendered CMS approach (e.g. Firebase-backed content, rendered at request
time) — FAILED in practice: client-rendered content indexes poorly for SEO, and it adds a runtime failure
point (observed real-world case: a post page returning HTTP 500 at request time instead of failing at
build time where it would be caught).

**Use instead:** MDX/Markdown committed to git, built statically — `Velite` or Next.js's native
`@next/mdx`. Both integrate with Next's static generation so content ships as part of the build, with no
runtime dependency and much better SEO (server-rendered/static HTML, not client-hydrated content).

**Verdict on a related library: `Contentlayer` is ABANDONED** — do not choose it for a new project; prefer
`Velite` or `@next/mdx` for MDX-in-git content pipelines.

**Recommend next time** this need appears (a git-backed developer blog/content site): reach for `Velite`
or `@next/mdx`; avoid a server/client-rendered CMS for content that needs to be indexed and avoid
`Contentlayer` (unmaintained).
