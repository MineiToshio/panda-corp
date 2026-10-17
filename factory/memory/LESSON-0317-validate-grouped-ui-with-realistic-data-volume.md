---
id: LESSON-0317
type: pattern
domain: design-process
tags: [design-verification, data-volume, catalog, qa]
context: reviewing a grouped/collection/catalog UI design with sample data before it goes to the owner or into the build
trigger: use this when preparing or reviewing a grouped list/grid/catalog UI mockup, OR a graph/diagram-layout algorithm, and the available sample/fixture data is far smaller or simpler than the real product's actual data
source: "funko-tracker .pandacorp/comms/iteration.md ronda 7, 2026-10 (owner-stated): the owner explicitly asked to populate the mockup with a realistic catalog size (~150-200 items for a single franchise) rather than a handful of samples, wanting to see how the grouping/layout held up \"a nivel real\". Corroborated 2026-10-16 (Mission Control, owner-stated): the owner's logical-model viewer correction explicitly required validating the graph/ERD layout algorithm and initial centering against the ACTUAL PandaSaga schema, not only small fixtures, before accepting the layout as correct — same principle, a second project and a second UI shape (graph layout, not a catalog grid)."
provenance: owner-stated
created: 2026-10-15
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0311, LESSON-0306]
---

**Situation:** a grouped collection UI (items clustered by category/type, with per-group and
per-collection counts and visual density) looked fine with a dozen sample items but the owner
explicitly asked to re-test it with a realistic catalog volume — the actual order of magnitude the
real product data will carry — before judging the design.

**Lesson:** a dozen sample items can hide every failure mode that only appears at real scale: how
many groups actually exist, how uneven group sizes really are, whether "load more"/pagination
affordances are even needed, whether a dense grid feels overwhelming or well-organized, whether
counts/totals look right. A design or UI verification pass that only ever sees toy-sized sample data
is validating a different product than the one that will ship.

**Apply next time:** before presenting or shipping a list/grid/catalog-type UI for review, populate it
with (or at least test against) a dataset at the real expected order of magnitude — not a convenient
small sample — so layout, density, grouping and pagination decisions are validated against the shape
of data the product will actually carry. The same applies to a graph/diagram-layout algorithm (ERD,
dependency map): validate the layout, grouping and initial centering against an actual production-scale
schema/dataset, not only a small hand-built fixture — small fixtures hide uneven node sizes, dense
clusters, and centering failures that only appear at real scale.
