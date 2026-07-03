---
id: BL-0015
type: change
area: plugin-skill
title: "Work orders lack a `## Summary` section, so Mission Control shows the file path as the WO summary"
status: done
severity: p2
opened: 2026-07-01
closed: 2026-07-03
source: "owner/conversation 2026-07-01 (memory harvest); evidence mission-control/src/lib/work-orders/work-orders.ts:219"
closes: "work-orders skill + WO template now require a filled ## Summary in every generated WO (plugin/skills/work-orders/SKILL.md, plugin/templates/docs/work-order-template.md); iterate's reopen/new-WO/new-feature paths keep it current (plugin/skills/iterate/SKILL.md); EN-doc language route chosen (recorded in plugin/docs/decision-log.md); MC's existing deriveWorkOrderSummary() reader + its unit tests already render/cover this with zero MC changes; fix-forward (no backfill of the ~118 existing WOs); plugin v9.55.0"
links: []
---

## Problem
In Mission Control, the "summary" of a work order shows only the **file path** (useless to the owner). This
is NOT an MC bug: MC already supports a real summary — `deriveWorkOrderSummary()` in
`mission-control/src/lib/work-orders/work-orders.ts:219` reads the first non-empty paragraph under a
`## Summary` heading in the WO markdown, and the WO reader exposes it as the optional `summary` field
(REQ-05-003: "Summary + Full document tabs"). The **generated work orders contain no `## Summary` section**,
so `deriveWorkOrderSummary` returns `undefined` and the UI falls back to the `relPath`. The display is empty
**by omission upstream**, not by an MC defect.

Impact: the WO Summary tab / board never shows what a work order actually delivers — the owner sees a path
where a one-line "what this builds" should be.

## Root cause
The `work-orders` skill (and `iterate`/`implement` when they create or edit WOs) writes the WO body without a
`## Summary` section, and the WO template/README does not require one. There is nothing for MC to render, so
it degrades to the path.

## Fix plan
1. **Emit the section.** The `work-orders` skill + the WO template (`plugin/templates/**/work-orders/`) write a
   `## Summary` section — a one/two-line description of what the WO delivers — in every generated WO;
   `iterate`/`implement` do the same when they add or edit a WO.
2. **Language decision (recommend ES-comms).** Two options, pick one and record it:
   - *Minimal:* `## Summary` in the committed English WO doc → MC's existing `deriveWorkOrderSummary` renders it
     (no MC change), but the owner-facing text is English.
   - *Owner-faithful (recommended):* emit a **Spanish** summary replica in `.pandacorp/comms/` (same
     EN-doc / ES-comms split used elsewhere) and have MC read THAT for the owner-facing summary — this adds a
     small **MC follow-on** change (a new comms reader wired into the WO summary field). Matches the language
     rule for owner-facing text.
3. **Backfill (optional).** Add `## Summary` to MC's existing WOs so the current board stops showing paths, or
   accept a fix-forward on newly generated/edited WOs.

## Tests (prove the fix — TDD, RED → GREEN)
- **Generated-WO assertion:** the `work-orders` skill/template output for a WO must contain a `## Summary`
  section (fails today — none is written).
- **Reader unit (already partly covered in MC):** a WO fixture WITH `## Summary` → `deriveWorkOrderSummary`
  returns the text; WITHOUT → `undefined`. If the ES-comms route is chosen, add an MC reader test that the
  comms replica is read into the `summary` field.

## Done when
- Newly generated/edited WOs carry a `## Summary`; the WO template requires it.
- The EN-doc vs ES-comms decision is recorded (decision-log); if ES-comms, the MC follow-on reader is filed as
  its own `/pandacorp:change` in Mission Control and linked here.
- Plugin semver bumped (MINOR) per DR-034; entry in `plugin/docs/decision-log.md`.
- MC's WO Summary tab/board shows a real summary instead of a path.

## Out of scope
The owner activity-feed noise ([BL-0010]).
