---
id: BL-0034
type: bug
area: plugin-skill
title: "Memory-sweep orphan-of-harvest check must exclude portfolio entries with no resolvable status.yaml"
status: open
severity: p2
opened: 2026-07-04
closed:
source: "factory/memory/_inbox.md harvest 2026-07-04 (agent-inferred note, 2026-07-04)"
closes:
links: []
---

## Problem
The `pandacorp-memory-review` scheduled routine (canonical definition `plugin/docs/routines.md`, step
"PASO 0", line: "Detecta proyectos huérfanos de cosecha: cualquier proyecto del portfolio con
`phase: release` en su `.pandacorp/status.yaml` cuyo `last_harvest` falte o sea anterior a su último
build") assumes every `phase: release` entry in `factory/portfolio.md` has a real, resolvable
`.pandacorp/status.yaml` at its project root. This is false for **Mission Control**: it lives INSIDE the
factory repo (`mission-control/`) as the factory's own interface/tool, not as a sibling product project,
and has no real `.pandacorp/status.yaml` of its own — only test fixtures under `e2e/` and
`src/tests/` that could be mistaken for the real file by a naive path-glob check. Left as-is, the orphan
check either fails silently (can't find/parse a status.yaml, skips or errors quietly) or worse, matches a
test fixture and treats it as Mission Control's real machine state — either way it is a false signal in a
routine that is supposed to "exit silently when there's nothing to do".

## Root cause
The orphan-detection logic treats "entry in `factory/portfolio.md` with `phase: release`" and "has a
project-root `.pandacorp/status.yaml`" as equivalent. Mission Control breaks that equivalence: it is a
portfolio entry (the factory tracks it) but is not a sibling project with its own overlay — it's the
factory's in-repo tool.

## Fix plan
Update the `pandacorp-memory-review` canonical prompt (`plugin/docs/routines.md`, PASO 0 orphan-detection
step) to explicitly resolve each portfolio entry's expected `.pandacorp/status.yaml` path and skip/exclude
entries where that path does not exist as a real (non-fixture) file, rather than assuming every
`phase: release` entry has one. Mission Control specifically should either be excluded outright (documented
as "factory-internal, not a sibling project") or checked via whatever its actual machine-state marker is
(if any) instead of a generic sibling-project status.yaml glob. Also audit whether any other in-repo
tool (present or future) shares this shape, and generalize the exclusion rule rather than hardcoding
just "mission-control".

## Tests (prove the fix)
A documented manual repro is acceptable here (this is a scheduled-routine prompt, not testable code): run
the orphan-detection step's logic against the current `factory/portfolio.md` and confirm Mission Control
is no longer flagged as harvest-orphaned nor matched against an e2e/test fixture. If the detection logic
is later extracted into an actual script (rather than living purely in the routine prompt), add a unit
test asserting a portfolio entry with no resolvable status.yaml is excluded, not false-matched.

## Done when
`plugin/docs/routines.md`'s `pandacorp-memory-review` orphan-detection step explicitly handles portfolio
entries with no resolvable real `.pandacorp/status.yaml` (Mission Control included), and the routine's
installed copy is re-synced from the updated canonical text per the file's own "this file wins" discipline.

## Out of scope
Does not touch the harvest/review/status steps themselves, nor the ≥20-notes/≥7-days early-fire
thresholds — only the orphan-of-harvest detection.
