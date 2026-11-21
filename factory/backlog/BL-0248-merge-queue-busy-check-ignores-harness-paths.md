---
id: BL-0248
type: bug
area: templates
title: "merge-queue.sh treats untracked harness paths as a busy main; navigation-identity.json has no tracked-or-ignored decision"
status: open
severity: p1
opened: 2026-10-17
closed:
source: "funko-tracker architecture phase 2026-10-17: merge-queue.sh handed back with exit 12; docs/proposals/architecture-skill-v2.md"
closes:
links: [DR-096, DR-099]
---

## Problem

`plugin/templates/shared/.pandacorp/merge-queue.sh` refuses to land (exit 12, "the main checkout is busy") whenever
`git -C "$MAIN_WT" status --porcelain` is non-empty (lines ~73 and ~95). In funko-tracker the main checkout had NO
uncommitted work, only two untracked paths written by tooling: `.claude/worktrees/` (the harness's own session
worktrees, created by `EnterWorktree`) and `.pandacorp/navigation-identity.json` (written into every project by
`plugin/scripts/navigation-identities.sh`, contract `factory/standards/navigation-identities.md`). The lead had to
add both to `.git/info/exclude` by hand (`funko-tracker/.git/info/exclude`, "local-only (not versioned)") before the
merge could land. Every project that uses worktrees hits this on its first landing.

## Root cause

Two gaps: (1) the busy check counts untracked files, but an untracked path cannot block a fast-forward merge unless
the merge would write that same path; (2) `navigation-identity.json` was introduced (plugin v9.129.0) without
deciding whether a project commits it (it is a stable reference, like `status.yaml`) or ignores it (owner-private),
and without adding it to the template `.gitignore` or to the scaffold's commit set.

## Fix plan

1. `merge-queue.sh`: compute busy from TRACKED changes only (`git status --porcelain --untracked-files=no`), and
   separately fail only if an untracked path in main would be overwritten by the incoming commits
   (`git diff --name-only <main>..<branch>` intersected with `git ls-files --others --exclude-standard`).
2. Decide `navigation-identity.json`'s status in `factory/standards/navigation-identities.md` (recommendation:
   committed, since it carries only an opaque immutable id and `status.yaml` is committed too; or ignored if the
   owner wants it private) and make scaffold/adopt/`navigation-identities.sh` follow it (commit it, or add it to
   `templates/shared/.gitignore` + the upgrade additive `.gitignore` step).
3. `.claude/worktrees/` is already in `templates/shared/.gitignore` (plugin v9.130.0, OVERLAY 8.101.0).
4. Plugin PATCH bump (+ `OVERLAY_VERSION` PATCH since `merge-queue.sh` ships in the overlay) + decision-log.

## Tests (prove the fix — TDD, RED → GREEN)

Extend `plugin/scripts/test-worktree-bootstrap.sh` (or a new `test-merge-queue.sh` opted into
`run-engine-tests.sh`'s `EXPLICIT_SH_SUITES`): a temp repo with a clean main plus an untracked
`.claude/worktrees/x/` and an untracked `.pandacorp/navigation-identity.json` → `merge-queue.sh` lands (RED today:
exit 12). A tracked uncommitted change in main → still exit 12. An untracked file at a path the branch adds → still
refused.

## Done when

- The tests pass in `run-engine-tests.sh`; the standard states the file's status and the templates follow it.
- Plugin + overlay versions bumped; decision-log entry.

## Corroborating occurrence (2026-11-21, personal-page-v2)

Reproduced on a THIRD project with the SAME file (`.pandacorp/navigation-identity.json`), confirming the
bug is still live in the current `merge-queue.sh` (read 2026-11-21): the "busy main" preflight
(`main_busy()`, the Python helper around line ~633) exempts only three specific runtime paths
(`queue-log.jsonl`, `test-outcomes.jsonl`, `gate-reports/`) and otherwise, for a non-nested project
(`QUEUE_PREFIX` empty), returns "busy" (`sys.exit(0)`) on ANY status-porcelain entry at all — tracked OR
untracked — because `if not prefix or path in touched: sys.exit(0)` short-circuits true whenever
`prefix` is empty, before even checking whether the untracked path is touched by the incoming branch.
Agent-inferred note: "merge-queue.sh exit 12 fires at preflight on ANY untracked file in the main
checkout (here an owner-owned `.pandacorp/navigation-identity.json` that is not gitignored), before the
gate/stamp, so no gate time or `[certified-tree]` re-run can be measured through the queue until that
file is committed or ignored." The Fix plan above (compute busy from tracked changes only, and check
untracked-overwrite risk separately) still applies and is unimplemented.
