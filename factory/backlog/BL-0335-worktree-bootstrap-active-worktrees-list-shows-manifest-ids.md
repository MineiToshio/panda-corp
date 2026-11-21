---
id: BL-0335
type: bug
area: templates
title: "worktree-bootstrap.sh's 'Other active worktrees' listing prints bootstrap manifest ids (or HEAD) instead of worktree paths"
status: open
severity: p2
opened: 2026-11-21
closed:
source: "panda-corp agent-inferred note, 2026-11-21: 'worktree-bootstrap.sh ends with \"Other active worktrees:\" but lists bootstrap-<sha256> manifest ids (funko: ~30) or HEAD (ppv2) instead of worktree paths; cosmetic but misleading noise.'"
closes:
links: []
---

## Problem

`plugin/templates/shared/.pandacorp/worktree-bootstrap.sh` prints an "Other active worktrees:" section
at the end of its run, intended to help the owner/agent see what else is checked out. In practice it
lists internal bootstrap-manifest identifiers (`bootstrap-<sha256>`, observed ~30 of them on
funko-tracker) or the literal string `HEAD` (observed on personal-page-v2) rather than the actual
worktree paths an operator would recognize and act on. The information is not actionable in this form —
a reader cannot tell which real worktree each line refers to.

## Root cause

Not yet diagnosed precisely — needs a read of the script's listing logic (likely iterating
`.pandacorp/run/worktrees/` manifest files or `git worktree list` output and printing an internal
identifier/ref field instead of the `worktree <path>` field).

## Fix plan

1. Read the listing code in `worktree-bootstrap.sh` and identify where it derives the printed value.
2. Print the actual worktree path (what `git worktree list --porcelain` reports as `worktree <path>`,
   or the manifest's own recorded path field) instead of the internal manifest id / ref name.
3. Bump plugin PATCH + `OVERLAY_VERSION`; record in `plugin/docs/decision-log.md`.

## Tests (prove the fix — TDD, RED → GREEN)

Extend the existing `plugin/scripts/test-worktree-bootstrap.sh` fixture: create two or more worktrees,
run bootstrap, and assert the "Other active worktrees" output lists their real filesystem paths (RED
today — it lists manifest ids/`HEAD`; GREEN after).

## Done when

- [ ] The listing shows real worktree paths in the fixture test.
- [ ] Plugin + overlay versions bumped; decision-log entry.

## Out of scope

Any functional change to bootstrap's actual reconstitution steps (deps, launch.json, secrets); this item
is purely about the cosmetic output of the "Other active worktrees" section.
