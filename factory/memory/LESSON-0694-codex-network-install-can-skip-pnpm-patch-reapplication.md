---
id: LESSON-0694
type: gotcha
domain: build-engine
tags: [pnpm, patched-dependencies, codex, worktree, next]
context: a Codex build/patch worker with network access runs its own dependency install inside a project worktree that relies on pnpm `patchedDependencies` (e.g. a patched `next` package)
trigger: use this when tests that depend on a pnpm-patched package (e.g. a native/SWC-related Next.js patch) go red inside a worktree right after a worker's own dependency install, with no code change to explain it
source: "funko-tracker .pandacorp/run/lessons.md, 2026-11 (agent-inferred): a Codex worker with network access left node_modules/next without its pnpm patchedDependencies patch applied; the project's nativePostRdc tests went red until 'pnpm install --frozen-lockfile' re-applied the patch"
provenance: agent-inferred
created: 2026-11-18
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0281]
---

**Situation:** a Codex worker, running with network access inside its own worktree, performed (or
triggered) a dependency install that left `node_modules/next` without the project's pnpm
`patchedDependencies` patch applied. Tests exercising the patched behavior (`nativePostRdc`) went red
with no corresponding code change; re-running `pnpm install --frozen-lockfile` re-applied the patch and
the tests passed again.

**Lesson:** a pnpm patch (`patchedDependencies` in `package.json`/`pnpm-lock.yaml`) is not guaranteed to
survive every install path a worker might take — an install run under different conditions (network
access, a different pnpm invocation, a partial/incremental install) can land a package without its patch
applied, producing a test failure that looks like a code regression but is actually a dependency-state
gap. This is a distinct mechanism from LESSON-0281's cross-root-symlink Turbopack refusal (both are
worktree `node_modules`-integrity traps, but this one is a silently-skipped patch, not a filesystem-root
violation).

**Apply next time:** if a worker-reported test failure traces to patched-dependency behavior with no
matching code change, suspect a missed patch re-application before debugging the test itself; re-run
`pnpm install --frozen-lockfile` to re-apply `patchedDependencies` and re-test. Per the existing
LESSON-0281 governance rule, a worker should not be left to "fix" this itself ad hoc — route it back
through the project's own bootstrap/install step, which owns dependency installation.
