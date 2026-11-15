---
id: BL-0325
type: bug
area: build-engine
title: "session-cleanup.mjs treats hook-written .pandacorp/run/ runtime files as protected owner state"
status: open
severity: p2
opened: 2026-11-15
closed:
source: "factory/memory/_inbox.md, 2026-11-13 (agent-inferred)"
closes:
links: [DR-145]
---

## Problem
`plugin/scripts/session-cleanup.mjs`'s `finish` refuses to remove a session-owned worktree when its
`.pandacorp/` subtree is non-empty — `protectedPath` (line ~19) matches ANY path containing
`.pandacorp(/|$)`, with no distinction between genuine owner state (decisions, inbox, ideas, the
project's `status.yaml`) and disposable hook-runtime scratch files written automatically DURING the
session by Claude Code's own hooks: `.pandacorp/run/derived-drift-last-ok.json` (written by the
`check-derived-drift.sh` Stop-hook cache) and `.pandacorp/run/sessions/<session_id>.touched` (written by
`warn-adhoc-write.sh`'s per-session edit record, DR-099). When a worktree's ONLY remaining content under
`.pandacorp/` is one or both of these, `finish` still refuses to remove it, reporting the worktree kept
as holding "owner-state" — even though both files are purely this session's own runtime bookkeeping,
safe to delete once the session ends, and neither is read by anything outside that same session's own
hooks. Observed live during this harvest's own cleanup: deleting the two files by name (not the
directory) let `finish` proceed and remove the worktree.

## Root cause
`protectedPath`'s regex is a blanket match on the `.pandacorp/` prefix with no finer-grained exception
list. It correctly protects `.pandacorp/inbox/`, `.pandacorp/comms/`, `.pandacorp/status.yaml`, etc. (real
owner/project state with no other writer, DR-145's own mandate), but it has no notion of
"`.pandacorp/run/` holds ephemeral hook-runtime scratch, not durable state" — the exact distinction
`factory/standards/agent-portability.md`'s `.pandacorp/` layout already draws (`.pandacorp/run/` is listed
as gitignored runtime, separate from `.pandacorp/inbox/`/`.pandacorp/comms/`).

## Fix plan
Add a narrow, explicitly-named disposable-files allowlist to `session-cleanup.mjs` (do NOT broaden
`protectedPath` to exclude all of `.pandacorp/run/` wholesale — other things may legitimately live there,
e.g. in-flight build state `.pandacorp/run/build/`, which must stay protected while a build is live/
resumable): before the protected-path check, `rm` (ignore-missing) exactly
`.pandacorp/run/derived-drift-last-ok.json` and `.pandacorp/run/sessions/<this-session-id>.touched` (never
another session's `.touched` file) within the worktree being considered, THEN re-run the
existing emptiness/protected-path check. Keep the check itself unchanged otherwise — this is a
pre-cleanup step for two specifically-named, session-scoped files, not a loosening of the general rule.

## Tests (prove the fix — TDD, RED → GREEN)
Extend `plugin/scripts/test-session-cleanup.mjs`: RED = a fixture worktree whose only `.pandacorp/`
content is `.pandacorp/run/derived-drift-last-ok.json` + the current session's own
`.pandacorp/run/sessions/<id>.touched` is currently kept by `finish` (reason: owner-state/protected-path).
GREEN = after the fix, the same fixture is removed cleanly. Adversarial case (must stay kept): a fixture
where `.pandacorp/run/` ALSO contains something else (e.g. `.pandacorp/run/build/state.json`, or another
session's `.touched` file) must still be refused.

## Done when
The two named files are excluded from the protected-path veto (and only those two, only when nothing
else protected remains); the adversarial case above still refuses cleanup; plugin version bumped per
DR-034; a decision-log entry links this item.

## Out of scope
Any other file under `.pandacorp/run/` not named above; deciding whether other hook-runtime files should
also be disposable is a separate, explicit follow-up (file a new item if one is found), not an implicit
widening of this fix's allowlist.
