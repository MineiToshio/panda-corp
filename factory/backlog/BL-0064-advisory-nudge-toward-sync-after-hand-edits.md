---
id: BL-0064
type: change
area: hooks
title: "Advisory nudge toward /sync after significant inline hand-edits (fire-once, never block)"
status: open
severity: p2
opened: 2026-07-10
closed:
source: "external-repo mining of github.com/NateBJones-Projects/ringer, 2026-07-10"
closes:
links: [DR-081, BL-0033]
---

## Problem
When the owner hand-edits a product project's source across several files outside spec/design/implement/
change, nothing reminds them `/pandacorp:sync` exists to reconcile docs backwards (DR-081); doc drift
stays silent until the next cold sync.

## Fix plan
Adopt ringer's nudge discipline (`hooks/ringer_nudge.py`), not a new gate: an advisory `PostToolUse` hook
that, on a threshold of inline source edits to a project with a `.pandacorp/` overlay and no active build
lock, injects ONE line: "N files hand-edited — run /pandacorp:sync to reconcile docs." Must fire at most
once per session (atomic marker file, per ringer's pattern), NEVER block, and be silenced by an explicit
owner "skip sync".

## Tests (prove the fix — TDD, RED → GREEN)
RED = today, no hook exists; hand-editing N files in a project with a `.pandacorp/` overlay produces no
nudge. GREEN = a fixture session that edits ≥ threshold files triggers exactly one nudge line, a second
threshold-crossing in the same session produces no second nudge (marker file present), and an explicit
"skip sync" suppresses it.

## Done when
The hook is wired, fires at most once per session, never blocks, and is documented in
`plugin/hooks/hooks.json` + the area's decision log; OR — per the red-team note below — the owner declines
and this item is closed `wontfix` with the hook-design pattern left captured in memory only.

## Out of scope
Making `/pandacorp:sync` itself smarter or more automatic — this item is only the reminder nudge, not a
change to the sync engine.

## Note (red-team, why p3 — confirm with owner before building)
Inline editing is a SUPPORTED path (that is what `/sync` is for) — the nudge must point to `/sync`, never
scold toward a front door. If the owner doesn't want the reminder, close `wontfix`; the hook-design pattern
is already captured in memory.
