---
id: BL-0036
type: bug
area: templates
title: "stack-a-nextjs projects lack a next-env.d.ts gitignore entry, so it dirties main on every build"
status: open
severity: p2
opened: 2026-07-04
closed:
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-03 — next-env.d.ts flipped modified on every build, blocked merge-queue.sh twice in one session (worked around via `git checkout -- next-env.d.ts`)"
closes:
links: []
---

## Problem
In a Next.js project scaffolded from `stack-a-nextjs`, `next-env.d.ts` is a tracked (committed) file that
Next.js regenerates/touches on every `next dev`/`next build` run. This makes the file show as modified in
`git status` after essentially any local run, even with zero real source changes. `merge-queue.sh`
preflights on `git status --porcelain` being clean in the main checkout (`plugin/templates/shared/.pandacorp/merge-queue.sh:44`)
— a dirty `next-env.d.ts` alone blocked a merge twice in one session on personal-page-v2, and had to be
manually discarded (`git checkout -- next-env.d.ts`) before the queue would proceed. This is pure noise:
the file's regenerated content carries no information worth committing per-run.

## Root cause
`plugin/templates/shared/.gitignore` (the template shipped to every stack) has no entry for
`next-env.d.ts`, so `stack-a-nextjs` projects track a file whose content Next.js's own tooling
regenerates as a side effect of running the dev server or build — an anti-pattern already well known in
the Next.js ecosystem (the framework's own default `create-next-app` gitignore excludes it).

## Fix plan
1. Add `next-env.d.ts` to `plugin/templates/shared/.gitignore` (or, if it must stay tracked for some
   stack-a-specific reason, add it to `stack-a-nextjs`'s own gitignore overlay instead — check whether
   `shared/.gitignore` is meant to be stack-agnostic before deciding which file to touch).
2. For already-scaffolded projects, `/pandacorp:upgrade`'s conformance sync should propagate the new
   gitignore line (verify it does not require a manual `git rm --cached next-env.d.ts` step to fully take
   effect — if it does, document that one-time step in the upgrade skill's output).
Files: `plugin/templates/shared/.gitignore` (or `plugin/templates/stack-a-nextjs/.gitignore` if
stack-specific), `plugin/skills/upgrade/SKILL.md` (if a one-time untrack step is needed).

## Tests (prove the fix — TDD, RED → GREEN)
- **Gitignore assertion:** scaffold (or use a fixture of) a `stack-a-nextjs` project, run `next dev` once
  and stop it, then assert `git status --porcelain -- next-env.d.ts` is empty (the file is ignored, not
  merely unchanged). Today, on a project created before this fix, the file shows as tracked and
  modifiable.
- **Merge-queue regression guard:** with a fixture where `next-env.d.ts` has been touched (simulating a
  post-build state) but no other file changed, assert `merge-queue.sh`'s preflight (`git status
  --porcelain`) no longer sees it as dirty.

## Done when
`plugin/templates/shared/.gitignore` (or the stack-a overlay) ignores `next-env.d.ts`; a fresh
`stack-a-nextjs` scaffold shows the file as untracked/ignored after a `next dev` run; `OVERLAY_VERSION`
bumped; this item links back to LESSON-0048..0059 harvest batch in its `source`.

## Out of scope
Any other Next.js-generated artifact already covered by `.next/` in the shared gitignore; changing how
`/pandacorp:upgrade` handles OTHER conformance drift beyond this one file.
