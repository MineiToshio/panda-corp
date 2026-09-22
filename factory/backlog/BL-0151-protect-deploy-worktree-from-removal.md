---
id: BL-0151
type: bug
area: hooks
title: "the local-deployment worktree has no mechanical protection against git worktree remove / rm -rf"
status: done
severity: p1
opened: 2026-09-22
closed: 2026-09-22
source: "incident 2026-09-22, mission-control/.pandacorp/run/lessons.md last entry — a worktree cleanup pass during the speed-sprint canary launches deleted the live deploy"
closes: "plugin/scripts/block-dangerous.sh (git worktree remove / rm -rf guard) — commit efa5cea62daca3ef429c758eab9e0f65c656c946"
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

## Resolution (2026-09-22, commit `efa5cea62daca3ef429c758eab9e0f65c656c946`)
Implemented on branch `bl-0151-protect-deploy-worktree`, isolated in its own worktree (DR-096).

1. **`plugin/scripts/block-dangerous.sh`** — new `_is_protected_deploy_path()` helper: returns true
   when a path operand (a) resolves under `/Users/Shared/local-deployments/**` (DR-089's canonical
   root — this branch alone would have caught the ORIGINAL incident, since the worktree was not yet
   locked when it was removed), OR (b) is reported `locked` by `git worktree list --porcelain`
   (generalizes to any other operator-pinned worktree, per the item's own "Out of scope" — no
   second project hardcoded). Wired into two new/extended rules: a dedicated `git worktree remove`
   rule (any force level — a single `--force` doesn't even bypass git's own lock, only `-f -f`
   does, verified live against a throwaway fixture; the gate blocks pre-emptively regardless of
   force level rather than special-casing which one actually succeeds) and the existing recursive
   `rm` loop (so a raw `rm -rf` that bypasses git entirely is caught too). Deviated from step 2's
   "or at minimum hard-warns" language — implemented as a hard block (consistent with every other
   rule in this gate; there is no warn-and-confirm mechanism in `block-dangerous.sh` today).
2. **`plugin/scripts/test-block-dangerous.sh`** — 9 new cases under "BL-0151": locked-worktree
   `remove`/`remove -f -f`/`rm -rf` (blocked), `local-deployments/` path `remove`/`remove -f -f`/
   `rm -rf` (blocked), an unlocked non-deploy worktree via both `remove` and `rm -rf` (allowed — no
   false positive on the ordinary DR-096 cleanup flow), and a lookalike directory name
   (`local-deployments-archive`, allowed — no prefix false positive). Confirmed RED first (3
   lock-detection cases failed: `git worktree list --porcelain` reports the PHYSICAL,
   symlink-resolved path, and macOS's `mktemp` fixture paths go through `/var` → `/private/var`;
   fixed by resolving both sides with `pwd -P` before comparing). GREEN 66/66 after, run twice.
   `bash plugin/scripts/run-engine-tests.sh` stayed 23/23 green (this suite is not in its
   `EXPLICIT_SH_SUITES` allowlist — that gap is tracked separately as BL-0136, not this item's scope).
3. **`factory/standards/infra.md`** — one-line pointer added to the "Local deployments" section
   naming the new mechanical protection.
4. **`mission-control/.pandacorp/run/deploy-local.sh`** — added the idempotent
   `git -C "$DEPLOY" worktree lock --reason "..." "$DEPLOY" 2>/dev/null || true` re-assertion after
   the checkout step, exactly per the fix plan's step 1 snippet (with the worktree path argument
   `git worktree lock` requires — confirmed via a throwaway fixture that it errors without one, even
   run from inside the target worktree). **Deviation from the fix plan:** this file — and
   `serve.sh` — are `.pandacorp/run/*.sh`, gitignored machine-local runtime (`infra.md`'s own
   "Local deployments" section: "regenerable runtime… reconstruct from this reference if needed").
   No `plugin/templates/shared/.pandacorp/deploy-local.sh` template exists in this repo to edit (verified: `find plugin/templates -iname '*deploy*'` returns nothing) — Mission Control's copy under
   `mission-control/.pandacorp/run/` IS the canonical reference implementation infra.md points to,
   not a generated projection of a template. Being gitignored, this edit cannot be committed to this
   branch (or any branch); it was applied directly to the file in the main checkout's working tree
   (not this worktree, which never had a copy of it — confirmed by its absence there). It is backed
   up by the existing `backup-pandacorp-state.sh` (`run/*.sh`) mechanism, unchanged by this item.
   **Not verified live** (task constraint: never touch `/Users/Shared/local-deployments/panda-corp`
   or run a real redeploy) — the `git worktree lock <path> <path>` invocation pattern itself was
   proven correct against an isolated throwaway git fixture instead (idempotent re-lock produces
   the expected swallowed non-zero exit).
