---
id: BL-0324
type: bug
area: build-engine
title: "Engine test suites fail under the default macOS TMPDIR; build-engine-cli.md's claim they pass is false"
status: open
severity: p1
opened: 2026-11-15
closed:
source: "factory/memory/_inbox.md, 2026-11-13 (agent-inferred); verified live during the 2026-11-15 factory harvest"
closes:
links: [DR-157]
---

## Problem
`plugin/docs/build-engine-cli.md` ("Test environment notes") states: "Path comparisons (worktree
registrations, G2 snapshot manifests) use `realOrResolved`, which realpaths the deepest existing
ancestor and appends the missing tail, so they are symlink-safe (macOS `/var` is `/private/var`) even
after the directory is removed; the suites pass with the default `TMPDIR`." This is false on this
machine (and, since `/var` -> `/private/var` is a stock macOS symlink, on any unmodified macOS
install): with the default `TMPDIR` (`/var/folders/.../T/`), at least four engine suites fail with
`reason: "symlink-path"` mismatches:

```
$ node plugin/scripts/test-build-v2-disk.mjs        # RESULT 16 passed, 10 failed
$ node plugin/scripts/test-build-v2-integrate.mjs    # 2 failures (integrateCommitted, removeIntegrationWorktree)
$ node plugin/scripts/test-build-v2-land.mjs         # 2 failures
$ node plugin/scripts/test-build-v2-cli.mjs          # 1 failure
```

Setting `TMPDIR` to its own realpath before running (`TMPDIR="$(cd /private/var/folders/.../T && pwd)/"`)
makes `test-build-v2-disk.mjs` pass clean (26 passed, 0 failed) with no other change — confirming the
symlink is the trigger and the doc's "pass with the default TMPDIR" claim does not hold. (The note also
named `test-build-v2-hardening.mjs`, `test-build-v2-next.mjs` and `test-build-v2-report.mjs` as
affected; not independently re-verified in this harvest pass, but should be checked by whoever fixes
this, since they likely exercise the same worktree-path comparisons.)

## Root cause
`plugin/runtime/build/integrate/git.mjs`'s `realOrResolved` is the engine's own symlink-safe path
comparator and IS used correctly throughout `plugin/runtime/build/integrate/worktrees.mjs`,
`plugin/runtime/build/units/worktrees.mjs` and `plugin/runtime/build/next/g2.mjs`. But
`plugin/scripts/worktree-sweep.mjs` — which `gcWorktrees` (`plugin/runtime/build/lifecycle/buildDir.mjs`,
via `cleanEngineWorktrees`) calls into for the engine-worktree-reclamation half of disk/GC logic — compares
paths with plain `path.resolve()` in three places (`worktree-sweep.mjs:131`, `:267`, `:399`), never
`realOrResolved`. `git worktree list` reports a worktree's path already realpath'd (canonical,
`/private/var/...`), while the engine's own computed/expected path is built from `os.tmpdir()` /
`TMPDIR`-derived literals (`/var/...`, the symlink form). `path.resolve()` does not realpath, so the two
forms never compare equal, and the mismatch is misreported as `reason: "symlink-path"` — read by the
disk/GC/land/cli/integrate test suites as "this worktree does not belong where expected," failing
assertions that have nothing to do with the actual engine behavior being tested.

## Fix plan
In `plugin/scripts/worktree-sweep.mjs`, replace the three `path.resolve()` comparisons (lines ~131, ~267,
~399) with the same `realOrResolved` comparator already used by `plugin/runtime/build/integrate/git.mjs`
(import it, or inline the equivalent realpath-deepest-existing-ancestor logic if a circular-import
concern makes a direct import impractical — `worktree-sweep.mjs` is a `plugin/scripts/` CLI consumed by
`buildDir.mjs`, so check the import direction first). Re-run the four confirmed suites (plus
`test-build-v2-hardening.mjs`/`test-build-v2-next.mjs`/`test-build-v2-report.mjs`) with the DEFAULT
`TMPDIR` (unset any override) to confirm green. Once fixed, `build-engine-cli.md`'s existing claim
becomes true again and needs no wording change — but add a one-line canary note (or CI smoke) so a
future regression on this exact comparator doesn't silently reintroduce the mismatch.

## Tests (prove the fix — TDD, RED → GREEN)
RED (current main, this harvest's own repro, no env override): `node plugin/scripts/test-build-v2-disk.mjs`
→ `RESULT 16 passed, 10 failed`; `test-build-v2-integrate.mjs`/`test-build-v2-land.mjs`/`test-build-v2-cli.mjs`
each fail 1-2 cases with `symlink-path` reasons. GREEN (after the fix, same default `TMPDIR`, no override):
all four suites pass clean, matching the current behavior already observed when `TMPDIR` is manually set
to its own realpath.

## Done when
`worktree-sweep.mjs`'s three path comparisons use the symlink-safe comparator; the four confirmed suites
(plus the three unverified-but-named ones) pass under the DEFAULT `TMPDIR` on macOS with no env override;
plugin version bumped per DR-034; a decision-log entry links this item.

## Out of scope
Any broader audit of every `path.resolve()` call in the engine for symlink-safety beyond
`worktree-sweep.mjs`'s three identified sites — scope this item to the sites that actually cause the
observed failures; file a follow-up if a broader sweep turns up more.
