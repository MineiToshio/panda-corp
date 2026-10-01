---
id: LESSON-0268
type: gotcha
domain: tooling
tags: [git, pathspec, glob, nextjs, dynamic-route]
context: running git add/clean/rm (or any git command taking a pathspec) over a path containing literal square brackets, e.g. a Next.js dynamic-route segment like app/[slug]/page.tsx
trigger: use this when about to run git add/clean/rm/checkout with a path argument that contains square brackets (most commonly a Next.js/other-framework dynamic-route folder name)
source: "mission-control .pandacorp/run/lessons.md 2026-09-26 (agent-inferred) — `git add|clean -- '<path with [slug]>'` treated `[slug]` as a glob character class and also touched sibling paths (e.g. `s/`) that happened to match the class"
provenance: agent-inferred
created: 2026-10-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a git command targeting a path containing a literal `[slug]` segment (a Next.js dynamic
route folder) silently also touched an unrelated sibling path (e.g. `s/`) because git's default pathspec
matching treats `[...]` as a glob character class, not literal brackets — `[slug]` matches any single
character `s`, `l`, `u`, `g` at that position, which happened to match a real sibling directory.

**Lesson:** by default, git pathspecs are glob-aware; a path containing `[`, `]`, `*`, `?` or `\` is NOT
matched literally unless told to be. Any dynamic-route-style folder name (Next.js `[slug]`, `[...rest]`,
Remix/SvelteKit equivalents) is exactly this shape, and a `git add`/`git clean`/`git checkout`/`git rm`
invocation against it can silently expand to touch unintended siblings with no error — it looks like it
worked, because it DID run, just against more paths than intended.

**Apply next time:** when a git pathspec argument contains square brackets (or any other glob
metacharacter) from a real file/folder name rather than as an intentional glob, prefix the git invocation
with `--literal-pathspecs` (or escape the brackets) so the path is matched exactly. This applies to any
script or ad hoc command operating on dynamic-route framework conventions, not just one project's build
tooling.
