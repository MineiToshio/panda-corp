---
id: LESSON-0386
type: pattern
domain: ui-design
tags: [dashboard, summary-header, information-architecture]
context: a dashboard/summary header that aggregates a whole collection/account while the app also tracks several named sub-goals/sub-entities with their own progress
trigger: use this when a summary/dashboard header shows an aggregate metric for the whole collection/account and there is an instinct to also surface one particular sub-goal's progress next to it
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (owner-stated)"
provenance: owner-stated
created: 2026-10-17
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** an app tracked both a whole collection (aggregate progress) and several independent
named goals (each with its own progress). Placing one goal's progress next to the collection-wide
summary header read as arbitrary to the owner — why THIS goal, and not the others?

**Lesson:** a header that summarizes a WHOLE aggregate (an entire collection, account, or dataset)
should show only that aggregate — mixing in one particular sub-entity's own progress (one goal out
of several, one project out of a portfolio) makes the choice of which sub-entity to feature look
unmotivated to the user, since there's no principled reason it's that one and not another. Give
each sub-entity (goal, project, list) its own progress display inside its own view/tab, never
borrowed space on the aggregate header.

**Apply next time:** when a screen has both a whole-aggregate summary and multiple independent named
sub-entities each with their own progress, keep the aggregate header pure (whole-aggregate numbers
only) and move every sub-entity's progress into that sub-entity's own list/detail view.
