---
id: LESSON-0312
type: anti-pattern
domain: ux-patterns
tags: [grouping, visual-hierarchy, dense-grid, classification]
context: grouping a long, dense grid/list of items into categories within a single continuous scroll
trigger: use this when designing how to visually group a long dense grid/list (a catalog, an inventory) into categories, and a thin text-label divider between groups ("Category Name - N") is the default instinct
source: "funko-tracker .pandacorp/comms/iteration.md ronda 6, 2026-10 (owner-stated): a collection view grouped items with thin text dividers between sections inside one continuous grid; the owner's reaction was 'no se distingue' (it doesn't read as separated/classified)"
provenance: owner-stated
created: 2026-10-13
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0056]
---

**Situation:** a long, dense item grid was grouped into categories using a thin text-label divider
("Category Name - N") placed between sections, inside one otherwise-continuous scrolling grid. The owner
reported that the grouping did not read as a real classification at a glance.

**Lesson:** a thin text label between rows of otherwise-identical grid cells is too visually weak to
register as a CLASSIFICATION boundary — a user's eye tracks the repeating card shapes, not the occasional
interruption in the gutter. Grouping within a dense, visually homogeneous grid needs a structurally
distinct treatment (a contained "shelf"/panel per group with its own header and visible boundary, a
chapter-style section header with stronger weight/spacing, or a sticky "jump to" index) rather than a
label-only divider, or the grouping is effectively invisible.

**Apply next time:** when grouping a dense grid/list into categories, give each group a structurally
distinct container (background/boundary/header treatment that differs from the item cards themselves)
rather than relying on a text label alone to carry the classification; if the information density is very
high, pair it with a jump-to-section index.
