---
id: BL-0121
type: bug
area: hooks
title: "Backlog-drain worktrees lack gitignored personal state (`factory/gamification-ledger.json`) so `check-derived-drift.sh` is RED inside every fresh worktree"
status: open
severity: p2
opened: 2026-09-03
closed:
source: "orchestrator session 2026-09-03, proposal 33 implementation (wave 0 drain) — (agent-inferred)"
closes:
links: [BL-0035]
---

## Problem

During the 2026-09-03 backlog drain, 3 independent implementer agents (BL-0055, BL-0090, BL-0093) each hit `bash plugin/scripts/check-derived-drift.sh` exit 1 inside `.claude/worktrees/bl-BL-XXXX` because `factory/gamification-ledger.json` (gitignored per-machine state, recorded in `.gitignore` line 43) does not exist in a fresh `git worktree`. Each agent worked around the failure by manually copying the file from the main checkout before running the gate.

Evidence of scope:

```
.gitignore:43:factory/gamification-ledger.json
plugin/scripts/check-unbacked-precious.sh:55:    factory/profile.md|factory/portfolio.md|factory/ports.yaml|factory/gamification-ledger.json) return 0 ;;
plugin/scripts/test-check-derived-drift.sh:63:  printf '{}\n' > "$d/factory/gamification-ledger.json"
plugin/scripts/vault-overlay-sync.sh:27:FILES=(factory/profile.md factory/portfolio.md factory/ports.yaml factory/gamification-ledger.json factory/memory/_inbox.md)
plugin/scripts/backup-pandacorp-state.sh:91:           "$ROOT/factory/memory/_last-sweep" "$ROOT/factory/ports.yaml" "$ROOT/factory/gamification-ledger.json"; do
```

The drift gate is wired in `plugin/hooks/hooks.json` line 69, running as part of the Stop hook. Worktree creation occurs in `.claude/engines/pandacorp-backlog.js` lines 133–134:

```javascript
- If BRANCH exists but has no registered worktree, attach it with `git -C ${FACTORY_ROOT} worktree add $WT $BRANCH`.
- If neither exists, create it with `git -C ${FACTORY_ROOT} worktree add $WT -b $BRANCH`.
```

The `check-derived-drift.sh` gate (lines 54–56) calls `node` scripts that perform manifest + capability checks, and those passes implicitly assume the factory state is complete — but a linked worktree inherits `.gitignore` entries yet does NOT inherit gitignored per-machine files, so the gate fails when it encounters missing precious state.

Impact: **p2** — the gate itself is important (manifest integrity, DR-113) but the false positive blocks legitimate backlog-drain operations inside fresh worktrees, forcing every agent to manually copy gitignored state before proceeding.

## Root cause

The drift gate assumes all factory state required by its checks exists in the checkout. Gitignored files like `factory/gamification-ledger.json` (personal, machine-local state per DR-033) are listed in `.gitignore` but do not propagate to linked worktrees created via `git worktree add`. The gate does not distinguish between "a real drift signal" (manifest version mismatch, symlink corruption) and "expected per-machine state is absent in a fresh worktree" (a legitimate condition for untethered copies).

## Fix plan

1. **Amend `check-derived-drift.sh` (line 42)** to detect whether the checkout is a linked worktree:
   - Run `git rev-parse --git-common-dir` and compare to `git rev-parse --git-dir`; if they differ, the checkout is a linked worktree.
   - If it IS a linked worktree AND `factory/gamification-ledger.json` is absent, emit a one-line notice ("Linked worktree, skipping personal-state checks") and exit 0 (PASS).
   - If it is NOT a linked worktree and the file is absent, preserve current behavior (may be a real problem worth flagging in main checkout).

2. **Expand the audit** (check-derived-drift.sh, after the fix) to scan for any other gitignored files that the drift gate or its called scripts assume exist. Search `plugin/scripts/check-*.sh` for references to paths matching `factory/` or `.pandacorp/` and ensure each is classified as either:
   - Disposable (regenerable, covered by `is_disposable()` in `check-unbacked-precious.sh`), OR
   - Part of the backup manifest (covered by `is_backed_up()` in `check-unbacked-precious.sh`), OR
   - Optional/absent-in-worktrees (new classification: safe to miss in linked checkouts).

3. **Add the worktree-detection logic** to `check-derived-drift.sh` as a helper function:
   ```bash
   _is_linked_worktree() {
     local common_dir; common_dir=$(git -C "$ROOT" rev-parse --git-common-dir 2>/dev/null)
     local git_dir; git_dir=$(git -C "$ROOT" rev-parse --git-dir 2>/dev/null)
     [ -n "$common_dir" ] && [ "$common_dir" != "$git_dir" ]
   }
   ```

## Tests (prove the fix — TDD, RED → GREEN)

Before the fix, these cases must behave as shown; after the fix, PASS cases must PASS:

1. **PASS (currently RED, wrongly):**
   ```bash
   cd .claude/worktrees/test-linked && bash ../../plugin/scripts/check-derived-drift.sh
   ```
   Precondition: a fresh linked worktree with `.gitignore` inherited but `factory/gamification-ledger.json` absent.
   Reason: The ledger is gitignored personal state; absent in worktrees is normal, not a drift signal.

2. **RED (must still RED):**
   ```bash
   cd main-checkout && rm factory/gamification-ledger.json && bash plugin/scripts/check-derived-drift.sh
   ```
   Reason: Missing precious state in MAIN checkout (not a worktree) IS a red flag — the backup script expects it.

3. **GREEN (must still GREEN):**
   ```bash
   cd main-checkout && bash plugin/scripts/check-derived-drift.sh
   ```
   Reason: With all state intact, the gate passes (baseline).

4. **GREEN (new canary, worktree with ledger manually seeded):**
   ```bash
   cd .claude/worktrees/test-linked && cp ../../factory/gamification-ledger.json . && bash ../../plugin/scripts/check-derived-drift.sh
   ```
   Reason: Worktree with the ledger present also passes (not forced to fail just for being a worktree).

Test execution: `plugin/scripts/test-check-derived-drift.sh` gains cases 1, 2, 4 (case 3 already exists as the baseline). Simulate a linked worktree by creating a test fixture with `git -C $root worktree add $tempdir -b test-branch`, then running the gate.

## Done when

- All four test cases pass (linked worktrees without the ledger exit 0; main checkout remains strict; manual seeding in a worktree also works)
- The gate still blocks stale manifests, broken symlinks, and all other real drift signals (no softening of actual checks)
- The audit (step 2) is complete — `grep -n "factory/" plugin/scripts/check-*.sh` returns a comment explaining each reference
- Plugin version bumped (PATCH, since this is a bug fix to an existing gate)
- Entry added to `plugin/docs/decision-log.md` (tag: "worktree-safety fix")

## Out of scope

- Committing or generating `factory/gamification-ledger.json` in worktrees (it remains per-machine only, never versioned)
- Changes to the backup manifest or `.gitignore` (those stay unchanged)
- Softening the drift gate's checks for real manifest/symlink problems (the gate remains strict for actual drift)
- Auto-seeding gitignored files at worktree creation time (the fix is gate-side, not bootstrap-side)
