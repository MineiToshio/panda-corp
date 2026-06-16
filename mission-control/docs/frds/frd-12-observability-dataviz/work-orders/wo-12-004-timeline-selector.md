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
