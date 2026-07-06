---
id: WO-17-006
type: work-order
parent: FRD-17
title: 'WO-17-006 — MemoryHealth: remove the obsolete "SOLO DEMO" demo frame'
implementation_status: IN_REVIEW
reopen_count: 0
dependsOn: [WO-17-005]
difficulty: trivial
---

# WO-17-006 — Remove the obsolete "SOLO DEMO" demo frame from MemoryHealth

Drains the queued change `mc-memory-health-remove-solo-demo-frame` (type `change`,
class `standard`).

## Context

`MemoryHealth.tsx` (WO-17-005, CMP-17-health) wrapped the staleness nudge and the
first-harvest invite in the prototype's `bDemo` frame (`index.html` ~L563): a dashed
border, a warn "SOLO DEMO" pill, and a note saying "en la app real el aviso lo decide…".

That wrapper came from the HTML prototype, where the trigger was simulated. In the
current implementation the logic is already **real**: `shouldNudge` is computed from
real thresholds (`MEMORY_RAW_NOTES_THRESHOLD`, `MEMORY_STALE_DAYS_THRESHOLD`) over real
`health` data (AC-17-005.2). The frame's note literally described what the code now does,
so the frame was obsolete and misleading — it made a genuine signal look simulated.

## Scope

1. Remove the `BDemo` component and its associated styles (`B_DEMO_FRAME_STYLE`,
   `B_DEMO_HEAD_STYLE`, `B_DEMO_PILL_STYLE`, `B_DEMO_NOTE_STYLE`) from `MemoryHealth.tsx`.
2. Render the shared `Banner` (DR-057) directly for both the staleness nudge and the
   first-harvest invite (keeping the `marginTop` spacing the frame provided).
3. Update the file's JSDoc that documented the demo frame.

No change to `shouldNudge` / threshold logic or to any other panel behavior — this is a
visual-wrapper removal only.

## Acceptance criteria

- AC-17-006.5 — the "SOLO DEMO" pill and the "En la app real…" demo note no longer render
  in the nudge or the first-harvest invite.
- AC-17-006.6 — the real `Banner` (heading, Spanish detail, `/pandacorp:memory` command,
  copy button) still renders, unchanged, for both nudge and invite.
- AC-17-006.7 — gate green (`verify.sh`): tests, tsc, biome, knip (no dead `B_DEMO_*` left).

## Status Note

Built: removed the `BDemo` demo wrapper and its four `B_DEMO_*` style constants from
`src/components/modules/MemoryHealth/MemoryHealth.tsx`; the staleness nudge
(`data-testid="memory-health-nudge"`) and the fresh-factory first-harvest invite
(`data-testid="memory-health-first-harvest"`) now render the shared `Banner` primitive
directly, each in a wrapper `<div>` carrying `style={{ marginTop: "10px" }}` to preserve
the spacing the frame used to add. Updated the component-level JSDoc to explain the frame
was dropped because the trigger is real.

Interfaces/contracts: no change to the public surface — `MemoryHealthProps`
(`health: MemoryHealthData`, optional `promotionsCount`) and every existing `data-testid`
are unchanged. Consumers see the same testids and the same Banner content; only the dashed
demo chrome around them is gone.

Decisions/assumptions inherited by the consumer:
- The nudge/invite testids stay on the OUTER wrapper `<div>` (not on the `Banner`), so
  existing `within(nudge)`/`within(invite)` queries keep working.
- Spacing above the banners is kept at `10px` (`marginTop`) — the same value the removed
  `B_DEMO_FRAME_STYLE` supplied — so vertical rhythm is unchanged.
- The unrelated `DemoControls` party component (DR-061) keeps its own "SOLO DEMO" wrapper;
  this change is scoped strictly to `MemoryHealth`.

Tests covering it: `src/components/modules/MemoryHealth/_tests/memory-health.test.tsx`
(`describe("wo-17-006: the obsolete SOLO DEMO demo frame is removed")` — asserts no
"SOLO DEMO" pill, no "En la app real" note, and that the real Banner + copy button still
stand). The pre-existing 31 tests in that file and in `memory-health.loop-v2.test.tsx`
still pass unchanged (35 total green). tsc/biome/knip clean.
