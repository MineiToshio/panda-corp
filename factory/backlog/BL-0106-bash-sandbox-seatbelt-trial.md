---
id: BL-0106
type: change
area: hooks
title: "Trial the OS-enforced Bash sandbox as a layer orthogonal to block-dangerous.sh"
status: open
severity: p2
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-26"
closes:
links: [BL-0035]
---

## Problem
`.claude/settings.json:3-8` guards the Claude side with four `permissions.deny` rules (`rm -rf`,
`git push --force`, `git push -f`, `gh repo delete`) and no sandbox configuration. The OS-enforced Bash
sandbox (Seatbelt on macOS) is GA and unused. A command-pattern denylist catches the shapes someone thought
of; an OS sandbox catches the ones nobody did — relevant because BL-0035's root cause is still **UNKNOWN**.

## Fix plan
Enable `/sandbox` in a throwaway session and run one full `/pandacorp:implement` on a **disposable** project,
confirming nothing legitimate is blocked (the engine's file and network access, worktree creation, the gate
worktree, `npm`/`pnpm`). Only if that is clean, propose the settings change. This is an **orthogonal layer,
not a replacement** for `block-dangerous.sh` (which is fail-closed by design and stays).

## Tests (prove the fix — TDD, RED → GREEN)
The disposable-project build completes under the sandbox with no legitimate operation blocked; a seeded
out-of-tree write attempt is blocked by the sandbox.

## Done when
Either the sandbox is enabled with the verification above recorded, or the trial's blocking findings are
recorded and the item is closed as "not adoptable yet" with the specific blockers named.

## Out of scope
Removing or weakening `block-dangerous.sh` or the four `deny` rules (§9 items 2 and 3).
