---
id: BL-0256
type: bug
area: templates
title: "merge-queue.sh never installs dependencies in main, so the first worktree landing that introduces/changes the stack leaves main's node_modules missing"
status: open
severity: p1
opened: 2026-10-18
closed:
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-17 (agent-inferred) — after landing a worktree that installed the project's stack, the main checkout had no node_modules, and the Stop hook's verify.sh failed with \"biome not found\""
closes:
links: [BL-0149, BL-0155]
---

## Problem

After a worktree whose own build introduced/changed the project's dependency set (the first stack-install
work order, or any WO that touches `package.json`/`pnpm-lock.yaml`) lands into main via
`plugin/templates/shared/.pandacorp/merge-queue.sh`, the main checkout itself is left with no
`node_modules` — because `merge-queue.sh` only fast-forwards/merges git refs, it never installs anything.
The very next action against main (the Stop hook's `verify.sh`) then fails with a misleading error like
"biome not found", which reads exactly like a real tooling/build defect rather than what it actually is:
the shared checkout's own environment was never brought up to date with the lockfile it just received.

## Root cause

`grep -n "pnpm install" plugin/templates/shared/.pandacorp/merge-queue.sh` returns zero matches — the
script has no install step at all. It implicitly assumes main's `node_modules` is already correct and
only ever needs git-level merging, which is true for every landing except the one that itself changes
the dependency set for the first time (e.g. the first stack-install WO of a freshly scaffolded project,
where main predates any `package.json`).

## Fix plan

1. In `merge-queue.sh`, after a successful land into main, detect whether the landed diff touched
   `pnpm-lock.yaml` (or `package.json`); if so, run `pnpm install --frozen-lockfile` in main. Reuse the
   BL-0149 lockfile-sha idempotency marker pattern already proven in `worktree-bootstrap.sh` so repeat
   landings that didn't touch the lockfile stay cheap (no-op).
2. As a cheaper defense-in-depth, consider having the Stop hook's `verify.sh` detect a missing
   `node_modules/.bin/<tool>` binary and report "main checkout is not installed" explicitly, instead of
   the tool's own bare "command not found" message — so this class of failure is never mistaken for a
   real code regression again, even if step 1 has a gap.
3. Plugin PATCH bump + `OVERLAY_VERSION` PATCH (the script ships in the overlay) + decision-log entry.

## Tests (prove the fix — TDD, RED → GREEN)

Extend the merge-queue test coverage (a new or existing `test-merge-queue.sh`, mirroring BL-0248's planned
suite): a fixture repo with main lacking `node_modules`, landing a branch whose commits add a new
dependency to `pnpm-lock.yaml` — after `merge-queue.sh` runs, `node_modules/.bin/<new-bin>` exists in
main. RED today (no install step exists at all); GREEN after the fix. A second case (landing a branch
that does NOT touch the lockfile) asserts no install is attempted (idempotency marker unchanged).

## Done when

- The new test(s) are green; `bash plugin/scripts/run-engine-tests.sh` stays green.
- Plugin + `OVERLAY_VERSION` bumped; `plugin/docs/decision-log.md` entry.

## Out of scope

Re-syncing every existing project's already-landed `merge-queue.sh` by hand (that is `/pandacorp:upgrade`'s
normal job once this ships, not a step of this item).

## Corroborating occurrence (2026-10-29)

A second live instance of main's `node_modules` drifting behind its own committed lockfile, this time
surfacing as a deterministic e2e failure rather than a missing-binary error: funko-tracker's main
checkout had `node_modules` installed 2026-10-22, but the lockfile had `zod`/`undici` bumped 2026-10-25
— the piece route consistently hit its own error boundary in main while every freshly-provisioned
worktree at the same commit passed cleanly (fresh worktrees always install from the current lockfile).
Confirms the same root gap this item already tracks (no install step after a lockfile-touching landing)
and adds a second concrete symptom shape (a silent app-level failure, not just a missing-tool error) to
watch for once this item ships its Stop-hook defense-in-depth step. The generalizable diagnostic
counterpart (compare installed vs. lockfile-pinned versions before calling a main-only failure a real
regression) is captured separately as `factory/memory/LESSON-0545`. No new backlog item — same item,
same scope, corroboration only.
