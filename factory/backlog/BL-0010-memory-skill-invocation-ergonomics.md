---
id: BL-0010
type: change
area: plugin-skill
title: "/memory ergonomics — harvest THIS project when run inside one; bare /memory shouldn't default to harvest"
status: open
severity: p2
opened: 2026-06-30
closed:
source: "owner/conversation 2026-06-30"
closes:
links: [DR-047]
---

## Problem
Two small UX rough edges in `/pandacorp:memory` (owner-raised):
1. `harvest` is only framed as a factory-run action (target a project or offer recent ones). When the owner is
   working INSIDE a project, the natural gesture is "harvest THIS project" — but the skill doesn't default to
   the current project.
2. Bare `/pandacorp:memory` (no mode) **defaults to `harvest`** (the `$ARGUMENTS` line: `harvest [<project>]`
   (default)). Harvest is the action that WRITES — firing it accidentally is easy. The owner expected a bare
   invocation to ask, or to land somewhere read-only.
Impact: a write action is one accidental keystroke away, and the in-project harvest gesture is more friction
than it should be.

## Fix plan
1. **Smart default target for harvest:** if `/pandacorp:memory harvest` is invoked with no `<project>` arg AND
   the cwd is a Pandacorp project (`.pandacorp/status.yaml` present, via `scripts/is-pandacorp-project.sh`),
   default the target to THAT project (write the lessons to the factory as usual). Keep the factory-run +
   explicit-target + `/loop` portfolio-sweep paths intact (harvest must stay runnable from the factory for the
   factory `_inbox.md` and the autonomous sweep). Edit `plugin/skills/memory/SKILL.md` (harvest step 1).
2. **Bare `/memory` shouldn't silently harvest:** change the default so a mode-less `/pandacorp:memory` either
   (a) asks which mode, or (b) lands on `status` (read-only summary + the commands) — recommended (b):
   non-destructive, informative, and offers the next action. Edit the `$ARGUMENTS` line + step ordering in
   `plugin/skills/memory/SKILL.md`.

## Tests (prove the fix — TDD, RED → GREEN)
Behavior lives in a SKILL prompt, so proof is a documented manual repro against the edited `SKILL.md`
(automation of skill-prompt behavior is infeasible; assert the instruction text is unambiguous):
- **In-project harvest default:** the harvest step MUST instruct: no `<project>` arg + cwd is a Pandacorp
  project (`is-pandacorp-project.sh` true) → target the current project. A grep/read confirms the branch is
  present; a manual run inside a project harvests that project without naming it.
- **Bare invocation non-destructive:** the `$ARGUMENTS`/default instruction MUST route a mode-less invocation
  to `status` (read-only) or an explicit ask — NOT to `harvest`. A grep confirms `harvest` is no longer the
  bare default; a manual bare `/memory` writes nothing.
- **Preserved paths:** factory-run, explicit `harvest <project>`, and the `/loop` sweep instructions are
  unchanged (confirm the text still describes them).

## Done when
Running `/memory` inside a project harvests that project by default; a bare `/memory` no longer auto-writes
(asks or shows `status`); factory-run + sweep unaffected; plugin PATCH/MINOR bump + a `plugin/docs/decision-log.md`
entry recording the ergonomics change.

## Out of scope
The harvest/review LOGIC itself (what a lesson is, how it's deduped) — only the invocation ergonomics
(default target + default mode) change.
