---
id: BL-0058
type: bug
area: plugin-skill
title: "canvas-procedure.md Relay must ask the owner to connect claude-in-chrome before degrading to clipboard when list_connected_browsers returns empty"
status: open
severity: p1
opened: 2026-07-10
closed:
source: "pandacast .pandacorp/run/lessons.md 2026-07-10 (owner-stated): 'esa era la idea' — DR-109's relay silently degraded past the claude-in-chrome step to clipboard when list_connected_browsers returned empty, when the intended flow was to ask the owner to connect the extension first (a one-click fix vs a full manual round every relay call)"
closes:
links: []
---

## Problem
`plugin/skills/design/references/canvas-procedure.md`'s Relay mechanism has a rung ladder of degrading
fallbacks for handing prompts to the Claude Design canvas, with `claude-in-chrome` (via
`list_connected_browsers`) as the cheapest/most-automated rung and clipboard (owner pastes manually) as a
degraded fallback. When `list_connected_browsers` returns an empty result, the current documented
behavior silently falls through to the clipboard rung — but connecting the claude-in-chrome extension is
a single click for the owner, while clipboard removes ALL automation for every relay round of the
session (owner must copy/paste every single prompt by hand). The owner explicitly flagged this
degradation as wrong during the pandacast build ("that was the idea" — meaning: ask first).

## Root cause
The relay's fallback ladder treats "the browser tool returned empty" as equivalent to "the browser tool is
unavailable", collapsing straight to the next rung, when in this specific case the empty result usually
means "the extension just isn't connected yet this session" — a recoverable, cheap-to-fix state, not a
structural unavailability.

## Fix plan
Amend `canvas-procedure.md`'s Relay section (and its failure-modes table): when `list_connected_browsers`
returns empty, do NOT silently fall through to clipboard. Instead, ask the owner (in Spanish, per DR-009)
to connect the claude-in-chrome extension and retry `list_connected_browsers` once; only degrade to
clipboard if the owner declines or a retry still returns empty.

## Tests (prove the fix — TDD, RED → GREEN)
Documented manual repro: simulate `list_connected_browsers` returning empty during a relay round; before
the fix, the skill's doc has the agent silently proceed to clipboard; after the fix, the doc requires the
agent to ask the owner to connect the extension first, with a bounded retry, before falling back.
Automated canary infeasible (this is a relay/prompting-doc behavior, not executable code) — the manual
repro plus the before/after doc diff is the proof.

## Done when
`canvas-procedure.md`'s Relay section explicitly documents "ask to connect the extension before
degrading" as the required behavior on an empty `list_connected_browsers` result; plugin version bumped.

## Out of scope
Changing the rest of the fallback ladder (browser → clipboard → manual) or the `claude-in-chrome`
extension itself.
