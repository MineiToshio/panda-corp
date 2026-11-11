---
id: LESSON-0660
type: gotcha
domain: performance
tags: [algorithmic-complexity, batch-processing, quadratic, cli-command]
context: a command that iterates over N items (publish, export, audit) and, for each item, calls a helper that itself recomputes or recertifies something over the WHOLE batch rather than just that one item
trigger: use this when a per-item command loop (publish/export/audit over N items) calls a helper that internally recomputes or recertifies state across the ENTIRE batch on every single call
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-09 (agent-inferred): media:publish's prepareAttendedAsset (mediaPublish.ts:113) called authorizedViews(run) once per asset, and each call re-certified all 146 views in the run; both dry-run and apply each took ~90 minutes over 146 photos as a result."
provenance: agent-inferred
created: 2026-11-11
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a publish command processed N catalog photos one at a time. For every single photo, it
called an "authorized views" check that internally re-derived and re-certified ALL N views in the run
from scratch, rather than reusing a value computed once for the whole command invocation. With N=146,
this meant 146 full re-certifications instead of one — both the dry run and the real apply took roughly
90 minutes each.

**Lesson:** a function named/shaped like a per-run computation (`authorizedViews(run)`) that is actually
called from inside a per-ITEM loop silently turns a linear command into an O(n²) one — nothing about the
call site looks wrong (it reads as "check this item is authorized"), and nothing errors; the command
just runs N times slower than its own logic requires, and that slowdown is easy to misattribute to "this
step is just inherently slow" rather than to the loop structure.

**Apply next time:** before accepting a per-item command's runtime as a given, check whether any helper
called INSIDE the per-item loop internally recomputes something over the whole batch rather than just
the current item — if so, hoist that batch-level computation to run exactly once per command invocation
(before the loop starts), and pass the already-computed result into each per-item call instead of letting
each call re-derive it.
