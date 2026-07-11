---
id: LESSON-0119
type: gotcha
domain: platform-tooling
tags: [scheduled-tasks, permissions, claude-code, unattended, allowlist]
context: making a Claude Code scheduled/recurring routine (a factory loop job like memory-review, review-launch, consistency-sweep) actually run unattended
trigger: use this when creating or debugging a scheduled/cron routine that must run headless with no human present to click through permission prompts
source: "panda-corp — routines-unattended-allowlist fix 2026-07-08, factory/memory/_inbox.md"
provenance: owner-stated
created: 2026-07-09
status: candidate
promotion: proposed
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0030, BL-0054]
---

**Situation:** the factory's local scheduled routines (`~/.claude/scheduled-tasks/`: daily memory-review,
weekly review-launch, weekly consistency-sweep) silently "never ran by themselves" — they were stalling,
not failing loudly. Root cause found and fixed 2026-07-08 (owner-approved fix, not a workaround).

**Lesson:** scheduled tasks run headless in permission mode `default`. Any tool call NOT already covered by
an allow-rule raises an interactive permission prompt — which BLOCKS an unattended run indefinitely (it
stalls silently, it never times out or auto-proceeds). `defaultMode` is repo-wide (can't be scoped to just
one task from `settings.json`); the only way to get a true zero-prompt guarantee per task is
`bypassPermissions` or setting that one task's mode in the app UI (not exposed via the `scheduled-tasks` MCP
tool) — the owner-approved fix here was neither: a deliberately-scoped BROAD allowlist. The allowlist itself
has its own trap: permission rules must use wildcards, not exact strings — a plugin-scripts rule pinned to
one version (`.../pandacorp/9.71.0/scripts/*:*`) or one exact command string breaks the moment the plugin
version bumps or the command text changes even slightly, silently reintroducing the stall. The general
Bash-matcher glob supports `*` mid-string including across path separators, so pin the pattern at the
STRUCTURAL segment that's stable (`.../pandacorp/*/scripts/*:*`), not the value that changes on every
release.

**Apply next time:** when a recurring/unattended routine needs to run truly hands-off, pre-seed its full
tool surface in a broad-but-scoped allowlist (never per-version/per-exact-command rules) BEFORE relying on
it to run unattended; if a routine "never runs by itself" with no error, suspect a silent permission-prompt
stall first, not a scheduling bug. A genuinely new tool the routine hasn't used before can still prompt once
even with a broad allowlist — that residual gap needs `bypassPermissions` or per-task UI mode to fully close.

**Proposed for promotion** (librarian, 2026-07-09): owner-stated, high confidence, a verified fix already
landed (`.claude/settings.local.json`) — and the doc gap it exposes is independently tracked (BL-0054:
`plugin/docs/routines.md` has zero coverage of the permission-allowlist prerequisite).

**Target:** `plugin/docs/routines.md` — codify as a documented prerequisite for creating any new scheduled
routine: pre-seed a broad, wildcard-anchored (never per-version/per-exact-command) permission allowlist for
the routine's full tool surface before relying on unattended execution; document the residual
`bypassPermissions`/per-task-UI-mode gap for genuinely new tools. Closing BL-0054 with this content
resolves both the doc gap and this lesson's promotion in one edit.

**Rationale:** this is a platform-wide operational gotcha (every current and future scheduled routine is
exposed to it), the fix is already verified in production, and the target doc currently has NO coverage of
it — a single owner-stated, high-confidence lesson with a concrete, low-risk documentation target is
reasonable to promote without waiting for a second project (scheduled routines are factory-infrastructure,
not per-product-project, so "cross-project" corroboration does not apply the same way here).
