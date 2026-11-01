---
id: LESSON-0589
type: pattern
domain: build-orchestration
tags: [dr-141, batch-integration, merge-conflict, css, documentation]
context: resolving a merge conflict during DR-141 batch integration when two independently-finished lanes both touched the same artifact (a shared doc section, a shared stylesheet rule) in different ways
trigger: use this when integrating several finished build lanes in one batch and two lanes conflict on the same document section or the same CSS mechanism
source: "mission-control .pandacorp/run/lessons.md 2026-10-31 (agent-inferred, DR-141 integration pass) — two conflict shapes recurred: (a) two lanes each ADDED a different section to the same shared doc (components.md, an FDD) — the right resolution was to keep BOTH additions, not pick one; (b) two lanes implemented the SAME visual effect with different CSS mechanisms (one via grid, one via flex) — the right resolution required first checking whether one lane's approach already subsumed/superseded the other's before deciding whether to keep one or both"
provenance: agent-inferred
created: 2026-11-01
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [DR-141, LESSON-0548]
---

**Situation:** a DR-141 batch-integration pass hit two distinct shapes of conflict across lanes sharing
the same artifacts. When two lanes each appended a NEW, independent section to the same document
(component inventory, an FDD), the conflict was purely additive — both sections belonged in the merged
result side by side. When two lanes instead each solved the SAME visual problem via different CSS
mechanisms (one lane's rule used `display: grid`, another's used `display: flex` for what was functionally
the same layout outcome), naively keeping both left dead/overridden CSS behind, and deciding which to keep
required first checking whether one mechanism's behavior already covered what the other was trying to
achieve.

**Lesson:** not every merge conflict in a batch integration is the same KIND of conflict, and treating
them uniformly (always "pick a side", or always "keep both") is wrong in one direction or the other.
Two lanes adding genuinely independent content to a shared doc is a true additive case — keep both. Two
lanes solving the same problem with different mechanisms is a supersession candidate — before keeping
both (which leaves redundant/conflicting code) or picking one, check which approach actually wins the
runtime outcome (e.g. CSS specificity/cascade) and whether the other is now dead weight.

**Apply next time:** when resolving a DR-141 batch-integration conflict, first classify it: additive
(independent content touching the same file/section → keep both) versus competing-implementation (two
lanes solved the same concern differently → determine which one actually governs the rendered/runtime
result before deciding what to discard, rather than keeping both by default).
