---
id: LESSON-0271
type: gotcha
domain: documentation
tags: [convention, frd, exception, i18n, scope]
context: about to apply a generic project-wide convention (e.g. "product copy is in English") to a specific feature/surface, without checking whether that surface's own FRD documents an exception
trigger: use this when applying a generic, project-wide coding/content convention to a SPECIFIC feature surface, especially copy-language or similar blanket rules
source: "mission-control .pandacorp/run/lessons.md 2026-09-26 (agent-inferred) — the project's generic rule is product copy in English, but the Manual feature's own FRD (FRD-08) explicitly requires its content to be in Spanish; trusting the generic rule without checking the feature's FRD would have produced the wrong-language content"
provenance: agent-inferred
created: 2026-10-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a project-wide convention stated a blanket rule (product-facing copy is written in
English). One specific feature's own FRD explicitly overrode that rule for its own surface (that feature's
content is Spanish, by deliberate product requirement), documented in that feature's own FRD rather than
as a general exception anywhere the blanket rule itself is stated.

**Lesson:** a project-wide convention is a DEFAULT, not an exception-free law — a specific feature's FRD
can, and sometimes does, carry a documented override for its own surface. Applying the generic rule from
memory/habit, without checking whether the surface you're actually touching has its own FRD-level
exception, produces confidently-wrong output (here: content in the wrong language) that looks correct
because it matches the project's usual pattern everywhere else.

**Apply next time:** before applying a blanket project convention to a specific feature/surface, check that
feature's own FRD (or equivalent per-feature canonical doc) for a documented override before trusting the
generic rule — the source-of-truth hierarchy (FRD > FDD > tokens > blueprint > WO) means the feature-level
doc wins over a project-wide default when the two conflict, and the conflict is not always obvious without
checking.
