# WO-12-004 — Timeline selector (WO → task → action, durations)

**Components/Interfaces:** `IF-12-timeline` · **Traces:** REQ-12-003, REQ-12-007
**Deploy unit:** observability selectors (pure) · **Location:** `app/_observability/selectors/timeline.ts` (+ `.test.ts`)

## Acceptance criteria (verbatim EARS)
- AC-12-003.1: INSIDE a project, it SHALL offer an **RPG ↔ timeline/tree toggle** over the same data: work orders → tasks → actions, with duration and parent-child relationship.
- AC-12-007.1: ... time per work order ... derived from the same event file.

## Scope
- `toTimeline(events): TimelineRow[]` — fold the event tail into a tree: work order → task → action, each row carrying `start`/`end`/`duration` and `parentId`. Pure, derived from event `at` + `work_order`/`task` ids.
- Tolerate missing end (in-progress) → open duration; tolerate orphan actions (no task) gracefully.

## Dependencies
- FRD-01 `lib/events` types.

## TDD / Definition of done
- Tests: a fixture stream yields the correct WO→task→action nesting with `parentId`; durations computed from paired start/end; an unfinished item has an open duration; orphan/malformed events don't break the fold.
- Pure. Gate green.

## Status: BLOCKED

**Blocked at:** 2026-06-16 — Freeze-on-red (DR-015 cap exhausted)

**Reviewer verdict:** REJECTED cycle 2 (final allowed cycle). B2 blocking bug in `deriveWoRow` no-task branch (`timeline.ts:238-242`):

- A no-task WO with one closed (`ok`) + one open (never-closes) direct action is reported as `status:"ok"`, `end` set, `duration:0` — must be `status:"running"`, `end:null`, `duration:null`.
- Failing tests: `timeline.review2.test.ts` — 10/12 PASS, 2 FAIL (B2 assertions).
- Root cause: `hasTerminal` on `woAcc` is set by the first closed direct action; the no-task branch collapses all direct-action state into `woAcc`, losing per-action open/closed granularity.
- Required fix: add `hasOpenDirectAction` flag to `NodeAcc`; set it when a direct-action event has no terminal status; in `deriveWoRow` no-task branch treat WO as `running` when `hasOpenDirectAction === true`.

**HEAD:** stays at `654bfe8` (no broken fix committed). `last_green_sha=d13d887` unchanged.

**Escalation required from owner.** Test command run: `vitest run timeline.review2.test.ts` → 10/12 PASS, 2 FAIL.
