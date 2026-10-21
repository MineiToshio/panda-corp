---
id: BL-0266
type: bug
area: hooks
title: "verify-before-stop.sh produces a false red in a nested product-project worktree by resolving the wrong root"
status: open
severity: p2
opened: 2026-10-21
closed:
source: "factory/memory/_inbox.md note, 2026-10-20 (agent-inferred) — session cwd mission-control/.claude/worktrees/<name>, gate failed with ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND unrelated to the code under review"
closes:
links: []
---

## Problem
`plugin/scripts/verify-before-stop.sh`, run in a session whose cwd is a worktree of a nested product
project (`mission-control/.claude/worktrees/<name>`), ran `.pandacorp/verify.sh` against the FACTORY root
instead of the nested `mission-control/` app's own root, producing
`ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND` — a false red with no relation to the actual code change under
review. `plugin/scripts/worktree-bootstrap.sh` (used when the worktree is created) already resolves the
nested app correctly; `verify-before-stop.sh` does not follow the same resolution when it later fires as
the Stop gate inside that worktree.

## Root cause
`verify-before-stop.sh` locates the project's verify script via `verify="$cwd/.pandacorp/verify.sh"`,
trusting the hook payload's `cwd` field directly. For a nested project worktree this either (a) resolves
to a `.pandacorp/verify.sh` that is the FACTORY's own (if `cwd` reported by the host is stale/wrong and
actually points above the nested app), or (b) resolves correctly to the path but that path's own
`verify.sh` logic does not account for running from inside a worktree of the NESTED project rather than
the factory's own pnpm workspace root, and falls through to factory-root package resolution. Either way,
the gate ends up invoking pnpm/verify logic scoped to the factory root instead of
`mission-control/`'s own installed workspace.

## Fix plan
Make `verify-before-stop.sh` resolve the project root the same way `worktree-bootstrap.sh` does for a
nested product project (walk from `cwd` to the nearest ancestor/self directory containing both
`.pandacorp/verify.sh` and that project's own `package.json`/workspace marker, rather than trusting a
single-level `$cwd/.pandacorp/verify.sh` guess) before invoking the gate. Reuse the existing resolution
helper from `worktree-bootstrap.sh` rather than re-deriving a second implementation.

## Tests (prove the fix — TDD, RED → GREEN)
A test that invokes `verify-before-stop.sh` with a fixture `cwd` set to a nested-project worktree path
(mirroring `mission-control/.claude/worktrees/<name>`) and asserts it resolves and runs THAT project's
`.pandacorp/verify.sh`/package manifest, not the factory root's. RED = current script errors with
`ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND` or otherwise targets the factory root. GREEN = it runs the nested
project's own verify script.

## Done when
`verify-before-stop.sh` resolves the correct nested-project root from a worktree cwd, the new test passes,
the plugin version is bumped per DR-034 (PATCH), and a decision-log entry links this item.

## Out of scope
Any change to `worktree-bootstrap.sh` itself (it already resolves correctly) — this item only ports the
same resolution logic into `verify-before-stop.sh`.
