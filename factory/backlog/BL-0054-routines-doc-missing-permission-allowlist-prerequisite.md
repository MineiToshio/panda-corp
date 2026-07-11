---
id: BL-0054
type: change
area: standards
title: "Document the permission-allowlist prerequisite next to each routines.md cron definition"
status: open
severity: p2
opened: 2026-07-09
closed:
source: "factory/memory/_inbox.md note, 2026-07-08 — routines-unattended-allowlist fix session"
closes:
links: [LESSON-0119]
---

## Problem
`plugin/docs/routines.md` declares itself the canonical, versioned definition of the factory's scheduled
routines ("if a machine is rebuilt or the factory is cloned, they must be recreated"). It does NOT document
that unattended running requires a pre-seeded `permissions.allow` surface (or a per-task `dontAsk`/bypass
mode) — scheduled tasks run headless in permission mode `default`, and any tool not already covered raises
a prompt that silently STALLS the run forever (2026-07-08 incident, fixed in `.claude/settings.local.json`,
a gitignored/personal file with no git history — see LESSON-0119). A machine that recreates the routines
purely from `routines.md` (its stated purpose) will recreate the task but hit the exact same silent stall,
because the doc never says the allowlist is a prerequisite.

## Root cause
`routines.md` was written to document WHAT each routine does (cron, description, prompt) but never HOW to
make it actually run unattended — the permission-mode dependency was discovered and fixed operationally
(editing `settings.local.json` directly) without updating the canonical doc that claims to be sufficient to
recreate the routines from scratch.

## Fix plan
Add a short "Prerequisite: unattended permissions" subsection to `plugin/docs/routines.md` (near the top,
before the per-routine sections) stating: scheduled tasks run in permission mode `default`; recreating a
routine requires the relevant tool surface pre-seeded in `permissions.allow` (broad-but-scoped wildcards,
not per-version/per-exact-command rules — the plugin-scripts segment must glob the version:
`.../pandacorp/*/scripts/*:*`); point to the current allowlist's location (`.claude/settings.local.json`,
gitignored) and note the residual gap (a genuinely new tool can still prompt once even with a broad
allowlist; the hard zero-prompt guarantee needs `bypassPermissions` or the per-task UI mode). Cross-link
LESSON-0119.

## Tests (prove the fix — TDD, RED → GREEN)
Manual doc check (documentation-only change, no executable gate applies): confirm `plugin/docs/routines.md`
contains the new subsection and it is referenced from at least one of the three per-routine sections (or
once at the top, applying to all three). RED = subsection absent (current state, verified via
`grep -n "allowlist\|permissions.allow" plugin/docs/routines.md` returning nothing); GREEN = present.

## Done when
`plugin/docs/routines.md` documents the permission-allowlist prerequisite (grep finds it), links
LESSON-0119, and the plugin version is bumped per DR-034 (PATCH — doc-only, no behavior change) with a
decision-log entry.

## Out of scope
Building an automated drift/prerequisite checker (that's BL-0039's territory — detecting divergence between
this doc and the installed tasks, a different problem than this doc being incomplete).
