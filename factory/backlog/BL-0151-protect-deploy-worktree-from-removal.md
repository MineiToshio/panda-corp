---
id: BL-0151
type: bug
area: hooks
title: "the local-deployment worktree has no mechanical protection against git worktree remove / rm -rf"
status: open
severity: p1
opened: 2026-09-22
closed:
source: "incident 2026-09-22, mission-control/.pandacorp/run/lessons.md last entry — a worktree cleanup pass during the speed-sprint canary launches deleted the live deploy"
closes:
links: [DR-089]
---

## Problem
During today's post-canary worktree cleanup, a haiku-tier agent ran `git worktree remove` on
`/Users/Shared/local-deployments/panda-corp` — the pinned, detached-HEAD worktree that launchd's
`com.pandacorp.mission-control` service serves live on `127.0.0.1:1987` (`factory/standards/infra.md:70`,
`mission-control/.pandacorp/run/serve.sh`'s `DEPLOY_DIR`). The launchd process kept running with a
now-ghost cwd: `/` returned 200 while `/board` returned 500. Recovery was manual (`git worktree add
--detach` back to the same sha, `pnpm install`, `pnpm build`, `launchctl kickstart -k`), verified 200 on
`/`, `/board` and `/portfolio`, and the worktree was locked by hand afterward (`git worktree lock
/Users/Shared/local-deployments/panda-corp`) as a stopgap. Nothing today makes that protection durable or
mechanical — a future cleanup pass (by an agent, or the owner) can repeat the exact same deletion, because
neither `block-dangerous.sh` (the PreToolUse dangerous-command gate) nor the deploy machinery itself
refuses or guards against it.

## Root cause
`plugin/scripts/block-dangerous.sh` has no rule at all for `git worktree remove` or an `rm -rf` targeting
a deploy directory — a worktree cleanup command reads as an ordinary, safe git operation to the gate,
because nothing in its pattern set distinguishes "a disposable canary/scoped-change worktree" from "the
one worktree launchd is actively serving from." Separately, `.pandacorp/run/deploy-local.sh` (the
redeploy script) assumes the deploy worktree already exists and is healthy — it never asserts or restores
a `git worktree lock`, so a lock applied by hand today (as the incident's stopgap) has no mechanism
keeping it in place across future redeploys or re-creations of the worktree.

## Fix plan
1. **`plugin/templates/shared/.pandacorp/deploy-local.sh`** (and the mission-control copy, kept in sync
   per the template): after `git -C "$DEPLOY" checkout --detach "$TARGET"`, assert the worktree is locked
   (`git -C "$DEPLOY" worktree lock --reason "pandacorp local deployment (DR-089) — never remove; see
   infra.md" 2>/dev/null || true`, idempotent — a git worktree lock on an already-locked worktree is a
   no-op error, safely swallowed). This makes the protection self-healing on every redeploy, not a one-time
   manual fix.
2. **`plugin/scripts/block-dangerous.sh`**: add a rule that refuses (or at minimum hard-warns, requiring
   explicit confirmation) any `git worktree remove` / `rm -rf` whose target path (a) is currently
   `git worktree lock`ed, or (b) matches the known deploy-root pattern
   (`/Users/Shared/local-deployments/**` — the canonical root per `infra.md`'s "Local deployments"
   section). A locked worktree already refuses `git worktree remove` at the git level with a clear error
   ("is locked") UNLESS `--force` is passed — the gate's job is specifically to catch the `--force` case
   and any raw `rm -rf` that bypasses git entirely.
3. Extend `plugin/scripts/test-block-dangerous.sh` (or the nearest existing test harness for this hook)
   with cases: `git worktree remove --force <locked-or-deploy-path>` → blocked; `rm -rf
   /Users/Shared/local-deployments/<x>` → blocked; an ordinary `git worktree remove` of an unlocked,
   non-deploy worktree → unaffected (no false positive on the normal DR-096 worktree-cleanup flow).

## Tests (prove the fix — TDD, RED → GREEN)
New cases in the block-dangerous test suite (RED before, GREEN after) per step 3 above. A `deploy-local.sh`
unit/integration check (or a documented manual repro, since the script's own effect is a launchd/git
worktree state change) asserting the worktree is `git worktree list`-reported as `locked` after a normal
redeploy run, even starting from an unlocked state.

## Done when
- `block-dangerous.sh` blocks `git worktree remove --force` and `rm -rf` on a locked or deploy-root
  worktree path, proven by the new test cases, with zero regressions on the existing dangerous-command
  suite.
- `deploy-local.sh` re-asserts the lock on every run; verified live once on the real deploy worktree.
- `factory/standards/infra.md`'s "Local deployments" section gets a one-line pointer to this mechanical
  protection (so the current prose-only guidance isn't left stale once code backs it).

## Out of scope
Generalizing the protection to EVERY project's local deployment beyond Mission Control's — the fix targets
the pattern (deploy-root path + lock state), which already generalizes by construction; no per-project
hardcoding is added.
