---
id: BL-0129
type: bug
area: build-engine
title: "Bare /implement's empty-plan early exit never drains the DR-069 ready-changes queue"
status: open
severity: p1
opened: 2026-09-13
closed:
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-11 (agent-inferred) — the build engine's DR-069 change-queue drain (safePoint()) only runs INSIDE the main per-wave build loop, called at each wave boundary. On a bare /implement where the planner finds plan.frds.length === 0 (every existing FRD already VERIFIED), the engine takes the early ensureStopped('nothing to build') exit BEFORE the loop — so the ready-changes queue is never scanned or drained, even though .pandacorp/inbox/changes/*.md had 4 status:ready items waiting. The run reported {note: 'all verified'} as if there were truly nothing to do. Reproduced live 2026-09-11 in personal-page-v2."
closes:
links: []
---

## Problem
When `/pandacorp:implement` runs bare (no explicit `args.change`) and the planner finds
`plan.frds.length === 0` (every existing FRD already `VERIFIED`), the engine takes the early
`ensureStopped('nothing to build')` exit path **before** entering the main per-wave build loop. The
DR-069 ready-changes queue drain (`safePoint()`) is only ever invoked from inside that loop, at wave
boundaries — so on this early-exit path it never runs, even when `.pandacorp/inbox/changes/*.md` has
`status: ready` items genuinely waiting to be built. The engine reports `{note: "all verified"}`, which
reads as "truly nothing to do" when in fact real, ready, queued changes were silently skipped. Reproduced
live 2026-09-11 on personal-page-v2 with 4 `status: ready` items sitting unprocessed.

## Root cause
`safePoint()` (the DR-069 drain call) is wired only at wave-boundary call sites inside the main build
loop. The `plan.frds.length === 0` branch is a separate, earlier code path that exits before the loop is
ever entered, so it structurally cannot reach any `safePoint()` call.

## Fix plan
Before the `plan.frds.length === 0` branch declares "nothing to build" and exits, call `safePoint()` (or
an equivalent ready-changes-queue check) once. If the queue has `status: ready` items, drain them via the
existing `processChange` path instead of taking the early exit; only report "nothing to build" once the
queue is confirmed empty too.

## Tests (prove the fix — TDD, RED → GREEN)
Fixture: a project with all FRDs `VERIFIED` and ≥1 `.pandacorp/inbox/changes/*.md` with `status: ready`.
RED (current code): engine exits with `{note: "all verified"}` and the change file is untouched. GREEN
(fixed): engine drains the change via `processChange` before reporting "nothing to build", and the change
file's status advances accordingly.

## Done when
A bare `/implement` on an all-VERIFIED project with a `status: ready` change in the queue drains that
change instead of silently reporting "nothing to build"; the new test passes; `plugin/runtime/plugin-metadata.json`
bumped PATCH and manifests regenerated.

## Out of scope
Changing DR-069's `processChange` semantics themselves (see BL-0132 for a separate, related gap in what
`processChange` stamps on the FRD/WOs it creates).
