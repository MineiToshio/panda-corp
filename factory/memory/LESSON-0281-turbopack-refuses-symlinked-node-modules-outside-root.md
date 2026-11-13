---
id: LESSON-0281
type: gotcha
domain: nextjs
tags: [turbopack, next-16, node-modules, symlink, worktree]
context: a Next.js project running in a git worktree (or any directory) whose node_modules is a SYMLINK pointing outside that directory's own root (e.g. to the main checkout's node_modules)
trigger: use this when verify.sh/e2e in a factory worktree fails with "Symlink [project]/node_modules is invalid, it points out of the filesystem root" or any similar Turbopack filesystem-root complaint
source: "mission-control .pandacorp/run/lessons.md 2026-10-03 (agent-inferred) — in a factory worktree, symlinking node_modules back to the main checkout to skip a reinstall worked for vitest/tsc/biome but Next 16's Turbopack webServer refused to start, erroring that the symlink points outside the project's filesystem root"
provenance: agent-inferred
created: 2026-10-10
status: active   # 2026-11-01 librarian eval-gate: the 2026-10-21/22 funko-tracker generalization already meets the cross-corroboration bar (mission-control + funko-tracker, 2 distinct projects) — missed at the time it was added
promotion: proposed   # 2026-11-01 (librarian review) — target: factory/standards/build-orchestration.md (worktree bootstrap section): add a MUST — never symlink a directory from outside the worktree's own root in a worktree-setup.sh when the project's dev/build server runs on Turbopack; install for real (pnpm install --frozen-lockfile, hardlinked from the shared store) or use an APFS clone (cp -cR), never a cross-root symlink. Corroborated across 2 distinct projects (mission-control's node_modules case, funko-tracker's gitignored reference-asset-folder case) with zero contradicting evidence — the same Turbopack filesystem-root containment check fires for ANY cross-root symlink, not just node_modules, so this is a standing worktree-bootstrap rule, not a one-off workaround.
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0039]
---

**Situation:** inside a factory worktree, `node_modules` was symlinked to the main checkout's
`node_modules` (a cheap way to avoid a full reinstall per worktree). `vitest`, `tsc` and `biome` all
tolerated the symlink and ran fine. Next 16's Turbopack dev/build server did not: it explicitly refused
to start, erroring "Symlink [project]/node_modules is invalid, it points out of the filesystem root" —
Turbopack performs its own filesystem-root containment check on `node_modules` that the other tools don't.

**Lesson:** this is a DIFFERENT mechanism from LESSON-0039's workspace-root auto-detection confusion (both
are Turbopack-in-a-worktree traps, but that one is about multiple lockfiles misdirecting workspace
detection; this one is an explicit, deliberate refusal of any symlink escaping the project directory). Not
every tool in a verify.sh pipeline validates the same filesystem assumptions — a dependency-resolution
shortcut that is invisible to static/unit tooling can still break the one tool (the webServer / Turbopack)
that actually needs a real, self-contained `node_modules` tree.

**Apply next time:** in a factory worktree, install real dependencies (`pnpm install --frozen-lockfile`,
hardlinked from the shared pnpm store — cheap, not a full download) rather than symlinking the main
checkout's `node_modules` before running `verify.sh`/e2e. Reserve symlinking, if ever used, for tools
proven not to touch Turbopack's dev/build server; when in doubt, install for real.

**Generalization (funko-tracker, 2026-10-21/22, `.pandacorp/run/lessons.md`, agent-inferred):** the same
refusal fires for ANY symlinked directory escaping the worktree's own filesystem root, not just
`node_modules`. A project's `worktree-setup.sh` linked a large gitignored reference-asset folder
(`funko-ref`) from outside the worktree to skip re-copying it; Next 16's Turbopack refused to start the
webServer with "symlink target leaves the filesystem root," exactly the same mechanism as the
`node_modules` case. Working fixes: an APFS clone (`cp -cR`, cheap and nearly instant on macOS, unlike a
real copy elsewhere) instead of a symlink, or moving the symlink's target to live INSIDE the project tree
(e.g. under a gitignored subdirectory of the worktree itself) so it never crosses the root boundary
Turbopack checks. Treat this as a blanket rule for worktree bootstrap scripts: never symlink ANY directory
from outside the worktree root when the project's dev/build server runs on Turbopack.

**Third mechanism — a WORKER'S OWN ad-hoc "fix" reproduces it, not just a bootstrap shortcut
(funko-tracker, 2026-11-12, agent-inferred):** a Codex worker, finding its worktree's `node_modules`
incomplete or misconfigured, "fixed" it itself by symlinking `.bin`/`.pnpm` back to the main checkout —
the same cross-root symlink Turbopack refuses, this time created mid-build by an agent trying to be
helpful rather than by a bootstrap script taking a shortcut. The error was generic ("Could not find the
Next.js package"), not the explicit filesystem-root message, making it harder to trace back to a symlink.
**Apply next time (addendum):** this is a governance gap, not just a technical one — a worker must never
be allowed to "repair" a worktree's dependency tree on its own initiative; only the project's own
`worktree-setup.sh`/the shared bootstrap script may install/link dependencies. State this explicitly in
any worker brief for a project with a Turbopack dev/build server, and if a worker reports a missing-package
error, re-run the bootstrap's install step rather than letting the worker invent its own fix.
