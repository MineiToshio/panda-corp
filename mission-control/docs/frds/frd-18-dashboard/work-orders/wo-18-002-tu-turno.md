# WO-18-002 — `IF-18-turn` human-gate queue + `TuTurno` component

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`IF-18-turn`, `CMP-18-turn`) · [architecture §4.4](../../../product/architecture.md).
> Visual reference: `prototype/index.html` queue build (621–629, 665–666).

## Goal
The "Tu turno" hero queue: ONLY genuine human gates, urgency-ordered, each with its copyable command.

## Scope
- `IF-18-turn(...)` — pure: build the queue from pending decisions (`status.pending_decisions` +
  `.pandacorp/inbox/decisions.md` kinds: spend money / deploy prod / design-stack / delete data),
  shipped projects awaiting `/pandacorp:review-launch` (DR-043), the memory-backlog nudge (FRD-17
  `memoryHealth`), and ideas in "Descubierta" awaiting prioritization. Ordered by urgency.
- `components/dashboard/tu-turno.tsx` — render the queue (each item → command via `CopyButton`, click
  navigates), or an *al día* badge when empty.

## Acceptance criteria
- **AC-18-002.1** (REQ-18-010) The queue contains exactly the four genuine-gate sources; each item shows
  its exact `/pandacorp:*` command.
- **AC-18-002.2** (REQ-18-011) Routine progress is EXCLUDED: a running build, an auto-retried failed WO,
  and `advance_pending` (DR-032) NEVER appear here (asserted explicitly).
- **AC-18-002.3** (REQ-18-012) Items are urgency-ordered; the header shows the count waiting, or an
  *al día* badge when none.
- **AC-18-002.4** (REQ-18-002) Clicking an item navigates to the relevant project/idea/board; the command
  is copyable; nothing executes.
- **AC-18-002.5** Empty queue → calm *al día* state (no manufactured urgency, REQ-18-003). Spanish + a11y.

## TDD
`IF-18-turn` pure tests: fixtures with decisions/shipped/memory-backlog/undiscovered + a fixture that
includes a running build + `advance_pending` to assert they are excluded. `tu-turno.test.tsx` for render
+ ordering + al-día.

## Definition of done
- ACs RED → GREEN; exclusions enforced; urgency-ordered; al-día. `.pandacorp/verify.sh` green.

## Dependencies
- FRD-01 `lib/status`, `lib/ideas`; FRD-02 `lib/board`, `lib/next-step`, `CopyButton`; FRD-17 `lib/memory`.
