# WO-06-001 — Iconic event vocabulary + event view-model mapper

**Components/Interfaces:** `IF-06-icon-map`, `IF-06-event-vm` · **Traces:** REQ-06-012, REQ-06-013, REQ-06-011
**Deploy unit:** Party tab (pure logic module) · **Location:** `app/projects/[slug]/_party/event-vm.ts` (+ `.test.ts`)

## Acceptance criteria (verbatim EARS)
- AC-06-012.1: The events SHALL use a **fixed, bounded iconic vocabulary** (~12 types: read, write, edit, test ✓/✗, message, start, end); tool = extra icon.
- AC-06-013.1: **Failure SHALL be a first-class state** ... agent in a "downed" state + danger color + error icon, distinct from "completed". Never hidden in a log.
- AC-06-011.1: EACH agent SHALL have a **fixed color** reused across the ENTIRE UI (its sprite, the event feed and its cards). If several projects are being built, project-color (left border) + agent-color (second border).

## Scope
- Define `EVENT_ICON: Record<EventType, IconRef>` covering the §5 vocabulary (`read, write, edit, test_ok, test_fail, message, start, end, handoff, blocked, review, achievement`). Centralized constant — no magic strings.
- `toEventVM(event: DashboardEvent): EventVM` → `{ icon, toolIcon?, agentColorKey, projectColorKey?, isFailure, label (Spanish), at, workOrder?, project? }`.
- `isFailure` true when `status === 'fail'` or `event === 'test_fail'`.
- `agentColorKey` derived from `event.agent` (the token key, not a hex — FRD-13 owns the value).
- `projectColorKey` set only when `event.project` is present (multi-project, REQ-06-011).

## Dependencies
- FRD-01 `lib/events` — the `DashboardEvent` type + `EventType` enum (intra-platform). Use its exported types; do not redefine the schema.

## TDD / Definition of done
- RED→GREEN tests with event fixtures: every `EventType` maps to an icon; a `tool` adds a tool icon; `test_fail`/`status:'fail'` → `isFailure`; an event with `project` → `projectColorKey` set, without → undefined; labels are Spanish.
- Pure, no I/O, no DOM. `pnpm vitest run` green, `tsc --noEmit` clean, biome clean.
