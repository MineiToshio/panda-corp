---
id: BL-0274
type: bug
area: build-engine
title: "close-preloop's plain `git add -- .pandacorp/status.yaml` fails when .pandacorp is gitignored"
status: open
severity: p1
opened: 2026-10-22
closed:
source: "mission-control .pandacorp/run/lessons.md 2026-10-22 (agent-inferred): a targeted run's bounded pre-loop close died with \"FATAL: bounded pre-loop close returned an invalid receipt\" (plugin/runtime/engine/pandacorp-build.src.js:1910) and left a quiesced lease; recovered with finalize-release + a manual commit. Mission Control lives inside the factory repo at mission-control/, so .pandacorp/ there is gitignored even though .pandacorp/status.yaml is individually tracked (the exact trap LESSON-0103/CONV-14 documents)."
closes:
links: [LESSON-0103, "factory/standards/conventions.md#CONV-14"]
---

## Problem
`plugin/scripts/pandacorp-build-state.mjs`'s `close-preloop` command (line 57) stages the lease-release
commit with a plain `execFileSync("git", ["add", "--", allowed_paths[0]], ...)`, where `allowed_paths[0]`
is `.pandacorp/status.yaml`. When the project's `.pandacorp/` directory is itself gitignored — true for
Mission Control, which lives inside the factory repo at `mission-control/.pandacorp/` and is excluded by
the factory's own `.gitignore`, even though `status.yaml` is individually force-tracked — this plain
`git add` refuses with "The following paths are ignored by one of your .gitignore files", exactly the
gotcha LESSON-0103/CONV-14 already documents for ordinary agent commits. Here it fires inside the build
engine's own fenced two-phase close: `assertOnlyStatus` after staging never sees the path staged, the
commit never happens, `close-preloop`'s receipt comes back without `done: true`/`lease_released: true`,
and the caller (`pandacorp-build.src.js:1910`) throws `FATAL: bounded pre-loop close returned an invalid
receipt` — killing the run and leaving a quiesced-but-not-released lease that needed a manual
`finalize-release` + commit to recover. Any project that lives inside the factory repo (Mission Control
today, any future in-repo project) hits this on every bounded pre-loop close.

## Root cause
The `close-preloop` handler never anticipated a project whose entire `.pandacorp/` is gitignored at the
parent-repo level while `status.yaml` is individually tracked inside it — the same "already tracked does
not exempt a path from the ignore check when named explicitly" trap LESSON-0103 generalizes. A plain
`git add -- <path>` runs the ignore check unconditionally; only `-u` (touches already-tracked paths,
skips the ignore check) or `-f` (force) bypass it.

## Fix plan
1. `plugin/scripts/pandacorp-build-state.mjs:57` — replace the plain `git add -- <path>` with
   `git add -u -- <path>` first; if that still leaves the path unstaged (the rarer variant LESSON-0103
   also documents, where `-u` alone doesn't suffice), fall back to `git add -f -- <path>`. Keep the
   existing `assertOnlyStatus` fencing unchanged — only the staging command changes.
2. Mirror the same fix anywhere else in the engine that stages `.pandacorp/status.yaml` directly via a
   bare `git add` (grep `pandacorp-build-state.mjs` and `build-state.mjs` for other `git`, `"add"` call
   sites; `stamp-last-green`'s two-commit sequence in `pandacorp-build.src.js` already uses a plain
   `git add .pandacorp/status.yaml` too and should get the same `-u`-then-`-f` treatment).

## Tests (prove the fix — TDD, RED → GREEN)
- Extend `plugin/scripts/test-build-state.mjs`'s close-preloop coverage with a fixture project whose
  `.pandacorp/` directory is itself listed in `.gitignore` (but `status.yaml` individually tracked,
  mirroring Mission Control's real layout) — RED before the fix (receipt missing `done`/`lease_released`,
  or the underlying `git add` throwing), GREEN after.
- A focused regression for `stamp-last-green`'s own `git add .pandacorp/status.yaml` call under the same
  gitignored-parent fixture.

## Done when
- `close-preloop` (and `stamp-last-green`) stage `.pandacorp/status.yaml` with `git add -u --` falling
  back to `-f --`, never a bare `git add --`.
- The new fixture test is GREEN; the full `test-build-state.mjs`/`test-pandacorp-build.mjs` suites stay
  green.
- Plugin version bumped (PATCH — behavior fix, no skill/agent interface change) and manifests regenerated.

## Out of scope
- Any broader audit of every `git add` call site in the engine beyond `close-preloop` and
  `stamp-last-green` — file a separate item if more turn up.
