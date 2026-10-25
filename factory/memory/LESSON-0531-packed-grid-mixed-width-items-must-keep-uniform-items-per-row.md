---
id: LESSON-0531
type: problem-solution
domain: ui-layout
tags: [grid, print-export, contact-sheet, packing-algorithm, mixed-size-items]
context: a one-sheet/contact-sheet packed grid export where some items are visually wider ("big"/non-standard-size/multi-pack items) than the rest
trigger: use this when designing or reviewing a packed grid layout algorithm (a printable contact sheet, a poster export) that places mixed-width items into rows and must look visually consistent across the whole sheet
source: "funko-tracker .pandacorp/inbox/changes/done/export-uniform-columns.md (2026-10-24, bug) — exporting a full catalog to one printable sheet produced 7 items per row at the top and 5 further down, because \"big\" items (non-standard format or multi-packs) consumed `cols - 2` worth of row-width in the packing algorithm, which locally made sense per-item but produced visibly uneven row density across the sheet as a whole"
provenance: agent-inferred
created: 2026-10-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: [funko-tracker]
links: [LESSON-0316]
---

**Situation:** a packed one-sheet export algorithm placed items into rows, where a subset of "big" items
(non-standard-format or multi-piece packs) were coded to occupy more horizontal space by subtracting a
fixed amount from the row's available column count (`cols - 2`). This was locally correct — each big item
did get the extra width it needed — but the consequence only became visible at full-sheet scale: rows
without any big items packed 7 items across, while rows containing one or more big items packed only 5,
so the exported sheet visibly alternated between denser and sparser rows with no consistent rhythm.

**Lesson:** a packing algorithm that computes "how many items fit in THIS row" independently, item by
item or row by row, can be locally correct at every single decision point and still produce a globally
inconsistent, visually "off" result once many rows are laid out together — the defect only shows up when
you look at the whole sheet, not any one row. This is the packed-grid counterpart to LESSON-0316's
grouped-grid finding (there, mixed-size GROUPS sharing a row broke reflow predictability; here, mixed-size
ITEMS within a single packing pass break per-row density consistency) — both are instances of "a mixed-size
layout needs a rule that holds across the WHOLE layout, not just locally per row/group."

**Apply next time:** when a packed grid/sheet layout mixes items of different effective widths, decide
and test the items-per-row (or items-per-group) count as a GLOBAL, sheet-wide invariant first (e.g. "every
row has the same number of items regardless of which items are big"), and derive each big item's actual
rendered width from that invariant — rather than letting each item's local width requirement silently
determine how many fit in its own row. Verify visually at full real-data scale (a long sheet with many
rows), not just a few sample rows, since the defect is only visible in aggregate.
