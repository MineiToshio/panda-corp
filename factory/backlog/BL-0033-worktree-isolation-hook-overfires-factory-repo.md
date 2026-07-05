---
id: BL-0033
type: bug
area: hooks
title: "Scope the DR-096 worktree-isolation PreToolUse hook away from factory-only doc/plugin edits"
status: open
severity: p2
opened: 2026-07-04
closed:
source: "factory/memory/_inbox.md harvest 2026-07-04 (agent-inferred note, 2026-07-03)"
closes:
links: [DR-096]
---

## Problem
The DR-096 worktree-isolation PreToolUse hook (`plugin/scripts/warn-adhoc-write.sh`) fires on every
`Edit`/`Write` in ANY git repo whose git-dir isn't under `/worktrees/` — including pure
`factory/standards/`, `factory/decisions/registry.yaml`, or `plugin/skills/*/SKILL.md` prose edits made
directly in this factory repo itself. But DR-096's own text plus `factory/standards/build-orchestration.md`
scope the isolation rule to **product-project parallel sessions with a whole-program gate** (tsc/knip/
visual e2e) — a category the factory repo itself does not run (there is no `verify.sh` whole-program gate
over `factory/` or `plugin/` prose). The hook does not distinguish repo type or change type, so it
over-fires on a class of edit that carries no real cross-session-red risk, training the operator (and any
agent) to routinely rationalize past a nudge that was supposed to matter.

## Root cause
`warn-adhoc-write.sh` triggers on "shared main checkout, not a worktree, outside an active build" alone.
It has no signal for "is this repo one that runs a whole-program gate another parallel session could red"
— the factory repo (this one) qualifies as "shared main checkout" by the same file-system test as a
product project, even though it has no such gate.

## Fix plan
Add a scope check to `warn-adhoc-write.sh` (or a config it reads) that suppresses the nudge when the repo
being edited is the factory repo itself (detectable via a marker file, e.g. `factory/constitution.md` at
repo root, or an explicit allowlist) AND the edited paths are prose/config under `factory/` or
`plugin/**/*.md` (not `plugin/scripts/`, not build-engine JS, not templates that ship to product
projects — those DO warrant the nudge since a build could be reading them). Alternatively, if scoping
proves too fragile to get right mechanically, document the carve-out explicitly in DR-096's text /
`build-orchestration.md` so an agent reading the nudge has a documented "this doesn't apply here" instead
of silently rationalizing past it each time.

## Tests (prove the fix)
A script/CLI assertion: run the hook (or its underlying detection function) against a synthetic edit to
`factory/standards/foo.md` in this repo and assert it suppresses the nudge; run it against an edit to a
product-project file under a sibling repo with a `verify.sh` and assert it still fires.

## Done when
`warn-adhoc-write.sh` (or its config) no longer nudges on factory-only doc/plugin prose edits in this
repo, while still nudging on product-project code edits; the carve-out (if kept as a documented exception
instead of a mechanical one) is written into DR-096 or `build-orchestration.md`.

## Out of scope
Does not touch the isolation rule itself for product projects, nor the loud-hand-back / conversation-
isolation mechanisms (those are unaffected and still needed).
