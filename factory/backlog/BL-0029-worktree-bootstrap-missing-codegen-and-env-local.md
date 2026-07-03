---
id: BL-0029
type: change
area: build-engine
title: "worktree-bootstrap.sh should run codegen and copy .env.local so a fresh worktree passes typecheck/tests/build without manual steps"
status: open
severity: p2
opened: 2026-07-03
closed:
source: "personal-page-v2 .pandacorp/run/lessons.md — 2026-07-0x, harvested via /pandacorp:memory"
closes:
links: []
---

## Problem
A freshly created git worktree (via `EnterWorktree`/`worktree-bootstrap.sh`) has no
`.content-collections/generated` codegen output and no `.env.local` (gitignored) copied over from the
main checkout. In personal-page-v2, `next build` had to be run once manually (to trigger the
content-collections codegen) and `.env.local` had to be copied manually before typecheck/tests/build would
pass in the new worktree — an undocumented prerequisite that costs time and is easy to forget, silently
producing spurious failures that look like real regressions.

## Root cause
`worktree-bootstrap.sh` materializes the git worktree and installs dependencies, but does not know about
project-specific codegen steps (content-collections, or any other codegen-on-build tool a given project
uses) or about copying gitignored local env files that are prerequisites for the gate to run at all.

## Fix plan
Extend `worktree-bootstrap.sh` (or the project template's own bootstrap hook, if a per-project
customization point already exists) to: (1) copy `.env.local` (and any other gitignored `*.local.*` env
files) from the main checkout into the new worktree if present; (2) run the project's codegen step (detect
via a project-declared script, e.g. a `postbootstrap` npm script or a documented convention, rather than
hardcoding `content-collections` specifically — this needs to generalize across stacks). Document the
convention (e.g. a `scripts.worktree-bootstrap` entry in `package.json`) so future stacks can opt in.

## Tests (prove the fix — TDD, RED → GREEN)
RED: in a project with a codegen-on-build step and a gitignored `.env.local`, create a fresh worktree via
the current bootstrap and confirm `npm run typecheck`/`build` fails due to missing codegen output and/or
missing env vars. GREEN: after the fix, the same fresh-worktree flow has `.env.local` present and codegen
already run, and typecheck/build succeed without any manual intervention.

## Done when
- `worktree-bootstrap.sh` (or its per-project hook) copies gitignored local env files and runs any
  declared codegen step automatically.
- The RED→GREEN fixture test passes for at least one real project using this pattern.
- The convention for declaring a codegen step is documented (template README or standards doc).
- `closed:` + `closes:` set, `status: done`.

## Out of scope
Generalizing to every possible codegen tool up front — start with a documented opt-in convention (a
declared script) rather than trying to auto-detect every framework's codegen step.
