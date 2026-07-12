---
id: BL-0067
type: bug
area: build-engine
title: "Preserve unsafe gate-worktree crash evidence"
status: done
severity: p1
opened: 2026-07-11
closed: 2026-07-11
source: "R10 installed canary follow-up"
closes: "DR-118 protected gate-worktree lifecycle; plugin 9.92.8; overlay 8.74.0"
links: [DR-118]
---

## Problem

The build baseline prescribed `git worktree remove --force` with a recursive-delete fallback for
`.pandacorp/run/gate-worktree`. That path can contain the only uncommitted evidence left by a crashed
review, and the instruction contradicted the factory-wide protected-state rule.

## Root cause

DR-118 originally classified the gate checkout as disposable run state and treated every preexisting
directory as stale. It did not distinguish a safely reusable registered clean worktree from dirty,
orphaned, unregistered or ambiguous crash residue.

## Fix plan

Remove destructive baseline cleanup. Reuse the exact path only when Git registers it and its tree is
clean. Preserve every unsafe state and fall back to the legacy synchronous gate. Bind this behavior in
the engine harness, runtime-switch source guard, standard, skill and Manual.

## Tests (prove the fix — TDD, RED → GREEN)

`node plugin/scripts/test-pandacorp-build.mjs` asserts safe registered-clean reuse, preserved dirty or
orphaned residue with synchronous fallback, and a source guard against force-removal/recursive deletion.
`node plugin/scripts/test-runtime-switch.mjs` binds the same invariant at the cross-runtime source seam.

## Done when

The engine and propagated copy contain no destructive gate-worktree cleanup; both suites pass; DR-118,
the implement skill and Manual state the preservation/fallback contract; plugin and overlay versions bump.

## Out of scope

Changing gate concurrency, gate verdict semantics, or adding automatic evidence recovery.
