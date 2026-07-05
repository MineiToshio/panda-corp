---
id: BL-0035
type: bug
area: build-engine
title: "Investigate unexplained deletion of 11 versioned mission-control/.pandacorp files"
status: done
severity: p1
opened: 2026-07-04
closed: 2026-07-04
source: "factory/memory/_inbox.md harvest 2026-07-04 (agent-inferred note, 2026-07-04)"
closes: "Done-when (b): genuine audit of every candidate script found no path bug; mitigations + guards shipped (backup layer, hardened block-dangerous, factory deny rules, AGENTS.md protected-paths rule) so a recurrence is attributable and non-destructive"
links: [DR-113, BL-0030]
---

## Problem
During the 2026-07-04 session that built the Claude↔Codex multi-runtime portability layer, 11 versioned
files under `mission-control/.pandacorp/` were found deleted from the working tree with **no known
cause**: the session's initial snapshot was clean, no subagent spawned in that session touched that path,
and the files were restored via `git checkout`. This is a real data-loss incident on committed project
state (not a lesson, not a workaround) — the cause is unknown and could recur silently, including on
files that are NOT trivially restorable if the deletion happens to coincide with an uncommitted edit.

## Root cause
UNKNOWN. Candidate suspects to investigate (none confirmed): a worktree-sweep/cleanup script touching the
wrong path, the owner's parallel Codex-app validation session (mentioned as running the same day) doing
something unexpected in its sandbox, or an unrelated merge-queue/worktree-teardown operation targeting a
stale path that happened to alias `mission-control/.pandacorp/`.

## Fix plan
1. Audit every script that deletes or sweeps paths under `.pandacorp/` or `worktrees/` (merge-queue.sh,
   any worktree-bootstrap/teardown script, any cleanup cron) for a path-matching bug that could catch
   `mission-control/.pandacorp/` unintentionally.
2. Check whether the Codex sandbox/validation flow run the same day writes to or clears any `.pandacorp/`
   path as part of its own setup.
3. Add a lightweight guard/log (e.g. a pre-delete assertion or an audit log line) on any script that does
   bulk-delete under `.pandacorp/` or `worktrees/`, so a future occurrence is attributable instead of a
   silent mystery.
4. If no root cause is found after a genuine audit, at minimum document the incident + mitigation
   (e.g. "always confirm `git status` is clean before any worktree/merge-queue operation") in the relevant
   script's header or `build-orchestration.md`.

## Tests (prove the fix)
A documented manual repro/audit trail is acceptable if the root cause is a one-off environmental issue
found by code audit (not independently reproducible) — record what was checked and ruled out. If a
concrete bug is found in a sweep/teardown script, add a unit/integration test that asserts the script
never touches paths outside its intended scope (e.g. a path-prefix assertion test).

## Done when
Either (a) a root cause is identified and fixed with a regression test, or (b) a genuine audit of all
candidate scripts finds nothing, and that audit + a documented mitigation/guard is recorded so a
recurrence is attributable rather than mysterious.

## Out of scope
Does not require re-architecting the worktree/merge-queue system — only auditing for this specific
failure mode and adding attribution/guards.

## Investigation results (2026-07-04, closing audit)

**Timeline established:** working tree clean at the portability session's start (~03:5x local); the wipe
(all of `mission-control/.pandacorp/`: 11 tracked files + the gitignored inbox/comms contents) happened
before ~15:2x local, when the FIRST independent Codex verification round detected it; tracked files were
restored exactly via `git checkout` at ~15:3x; the gitignored inbox contents were unrecoverable (no APFS
local snapshots existed — checked `tmutil listlocalsnapshots`, empty).

**Ruled out by direct audit:**
- `merge-queue.sh` — its only deletes are the serialization lock and one manifest json (`run/worktrees/<branch>.json`); path-safe.
- `worktree-bootstrap.sh` — only writes (`.env.local`, manifest); no deletes.
- `canary.sh` — deletes only its `__canary__` sandboxes and its own tsconfig.
- Worktree vectors: `mission-control/.claude/worktrees/` empty since Jul 2 (no MC-nested worktree that day); the factory-level `busy-nightingale` worktree was swept at 16:27, AFTER the wipe.
- Claude-session transcripts: no `rm -rf mission-control/.pandacorp`, `git clean`, or `worktree remove --force` hits in any session in the window (searchable layer).
- The portability session's own subagents: all file-scoped away from that path.

**Unproven prime suspect:** the owner's Codex-app verification run (round 1) — an external runtime with
workspace-write access, parallel subagents, an explicit instruction to exercise the change-queue path,
and ZERO of our hooks/guardrails (the exact PORT-6 enforcement gap). Its own report surfaced the deletion
as a finding, which is consistent with a sibling subagent's sloppy cleanup mid-run but proves nothing.
No other process was active in the window with write access. Cause remains UNCONFIRMED.

**Mitigations shipped (this close):**
1. **Out-of-repo backup layer** — `plugin/scripts/backup-pandacorp-state.sh` snapshots every project's
   `.pandacorp/{inbox,comms,run/lessons.md,status.yaml}` + the factory's personal gitignored data
   (ideas cards, profile, portfolio, memory inbox) to `~/.pandacorp-backups/<repo>/<date>/`, 30-day
   retention; wired to SessionStart in BOTH the factory's `.claude/settings.json` and the plugin's
   `hooks.json` (product projects). First snapshot verified on disk.
2. **Hardened `block-dangerous.sh`** — blocks recursive deletes on protected state paths
   (`.pandacorp`, `factory/{ideas,memory,profile,portfolio}`) and any `git clean -x` variant
   (removes gitignored files). 11-case payload test passed (blocks the six destructive forms,
   allows node_modules/.next cleans, the done/-archive move, and single-file rm).
3. **Factory-root deny rules** — `.claude/settings.json` now denies `Bash(rm -rf:*)` + force-push +
   repo-delete at the FACTORY root (previously only product projects had them via the template).
4. **AGENTS.md "PROTECTED STATE PATHS" rule** — binds non-Claude runtimes (the unguarded vector) as
   an always-in-context instruction: never delete/recreate/bulk-clean `.pandacorp` or the factory's
   personal dirs; archive, never rm. The real enforcement port for external runtimes is BL-0030.
