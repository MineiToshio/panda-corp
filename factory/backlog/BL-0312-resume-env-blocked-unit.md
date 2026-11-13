---
id: BL-0312
type: bug
area: build-engine
title: "Add a fenced recovery command that re-admits an env-infra blocked unit"
status: done
severity: p1
opened: 2026-11-13
closed: 2026-11-13
source: "owner, funko-tracker run br-2026-11-13-01 (option B approved 2026-11-13)"
closes: "plugin 10.3.0 — unblock + start --resume --unblock (CLI 3.14b, BUILD-15, DR-151 note)"
links: [DR-150, DR-151]
---

## Problem
In funko-tracker run `br-2026-11-13-01` the docs unit `u-docs-explore-home-alive` finished its work but its worker
declared itself blocked because the Codex sandbox could not reach the native test Postgres. The CLI handed it back with
cause `env-infra` (state `blocked`, the run then `finished`). After the coordinator fixed the environment there is no
supported way to continue: `next` returns `done` (every unit terminal), `start --resume` refuses a `finished` run,
`answer` accepts only `q-`/doubt/gate ids and `handback` only blocks. `plugin/runtime/build/failure/handbackText.mjs`
still tells the owner "Arreglar el entorno y reanudar", a promise the CLI cannot keep. The preserved dirty worktree
(13 documents) can only be recovered by hand, outside the engine.

## Root cause
The hand-back is a one-way transition: `planHandback` moves the unit and its dependents to `blocked` (a terminal unit
state) and nothing in the CLI ever moves a `blocked` unit back to `queued`. The env-infra cause, which by definition is
not a defect of the unit's work, gets the same terminal treatment as an exhausted budget.

## Fix plan
1. `plugin/runtime/build/failure/unblock.mjs`: pure `planUnblock` + I/O `applyUnblock` + fenced `unblockCommand`.
   Accept only a `blocked` work unit (docs/tests/build/patch) whose latest `handback` journal event names it as the
   root (`data.unit`) with cause `env-infra`; refuse everything else (exit 6). Effect: the unit and the dependents that
   hand-back blocked return to `queued` at the SAME attempt (no budget spent), `handbacks_in_a_row` resets, WOs
   `BLOCKED -> PLANNED` with one commit on the integration branch, the decisions entry is marked resolved, the stale
   `report.json` is kept as `report-a<n>-blocked.json`, and the journal gets `unblocked` + `unit_state` events
   (folded by `foldJournal`). The unit's registered worktree is reused untouched by `prepareUnitWorktree`.
2. `start --resume --unblock <unit> --reason "<fix>"`: the same effect for a run that already ended (`finished` or
   any resumable status); the run becomes `active` again.
3. The brief of a re-admitted unit says it resumes after an environment fix and points at the previous report.
4. `handbackText.mjs`: the env-infra option names the real command.
5. Document in `plugin/docs/build-engine-cli.md` and `plugin/skills/implement/references/engine-v2.md`.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-build-v2-unblock.mjs`: happy path (docs unit; build unit with a dependent and a WO), same attempt,
worktree changes preserved, journal replay agrees; adversarial: wrong epoch (fence), non-blocked unit, non-env cause,
dependent named instead of root, doubt-consult unit, a second unblock refused, resume of a finished run without
`--unblock` still refused.

## Done when
- The test file passes and the existing build-v2 suites stay green.
- CLI reference and engine-v2 reference document the command; the hand-back text names it.
- Plugin version bumped, decision logs updated.

## Out of scope
Automatic re-admission without the coordinator's explicit command; any other hand-back cause.
