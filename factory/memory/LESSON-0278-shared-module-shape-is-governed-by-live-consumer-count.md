---
id: LESSON-0278
type: pattern
domain: code-architecture
tags: [shared-helper, shared-predicate, consumers, rule-of-three, module-design, ssot, synthesis]
context: a shared predicate/helper/utility module's correct SHAPE (export both meanings vs. one, exist vs. deleted, wide contract vs. narrowed) changes as its live consumer count changes over the life of a codebase, and no linter tracks this
trigger: use this when adding, removing, or "fixing" a call site of a shared predicate/helper/utility module — before changing the shared module itself, check its CURRENT live consumer count and shape the module to match it
source: "synthesis over 3 evidence-anchored candidates across 2 distinct projects: LESSON-0252 (personal-page-v2, 2026-09-22 — hrefKind.ts exported both isInternalHref and isOffSiteHref once two call sites needed almost-but-not-quite the same boolean, preventing the two meanings from drifting apart inline), LESSON-0266 (personal-page-v2, 2026-09-25 — 4 days later, a content-rule change removed the branch that was hrefKind.ts's second consumer; the module was deleted and inlined in the SAME change, because a single remaining import still passes knip's 'used' check with nothing automated flagging the decay), LESSON-0272 (mission-control, 2026-09-30 — before narrowing a shared ACTIVE_PHASES helper to satisfy one FRD, grepping its other consumers found a second FRD and a route that needed the WIDER set; the fix was a new explicitly-named derived subset for the one caller that needed less, leaving the shared helper's contract intact). Librarian reflection pass, 2026-10-01 scheduled memory review."
provenance: agent-inferred
created: 2026-10-01
status: active
promotion: proposed   # target: factory/standards/patterns.md (new "Shared-module lifecycle" section) or quality.md's review checklist — rationale: this 3-facet discipline (export-both-when-2-diverge / delete-when-drops-to-1 / derive-a-subset-don't-narrow-the-shared-contract) recurred independently across 2 distinct projects (personal-page-v2, mission-control) via 3 separate incidents, is cheap to state as a review checklist item ("grep every consumer of a shared helper before changing or deleting it"), and closes a real gap: knip/linters only see import counts, never WHY a module exists or whether a change silently narrows it for consumers the author didn't check.
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0252, LESSON-0266, LESSON-0272]
---

**Situation:** three separate incidents across two distinct projects all turned on the same underlying
fact: a shared predicate/helper/utility module's CORRECT shape is not fixed — it tracks its live consumer
count, and that count can both grow and shrink as unrelated features/content-rule changes land. (1) A
module was correctly split into two exported meanings once a second call site needed an
almost-but-not-quite-identical boolean (LESSON-0252). (2) Four days later, an unrelated content-rule
change removed that second call site's branch, silently dropping the module to one consumer — and it was
deleted/inlined in the same change, because nothing automated (knip included) flags "used by exactly one
caller now, used to be two" (LESSON-0266). (3) In a different project, a change "fixing" a shared helper
to match one FRD's new requirement would have silently broken two OTHER consumers (another FRD, a route)
that needed the original wider behavior; the actual fix derived a new, narrower, explicitly-named subset
for the one caller that needed less, leaving the shared contract untouched (LESSON-0272).

**Lesson:** a shared predicate/helper/utility module is not a static design decision made once at
extraction time — its justified shape (one export or two, exists or inlined-away, wide contract or
narrowed) is a live function of its CURRENT consumer count, and that count silently drifts as unrelated
changes land at any one of its call sites. No automated tool tracks this: a linter like knip only answers
"is this still imported at all", never "does the number/nature of its consumers still match the shape this
module was given." Three concrete rules fall out of the same underlying fact: when a SECOND genuinely
distinct consumer appears, name and export both meanings rather than inlining a near-duplicate (LESSON-0252);
when a change drops a module back to a SINGLE consumer, delete it and inline its logic in the SAME change,
not a later cleanup pass (LESSON-0266); when ONE consumer wants a narrower/different view, derive a new
subset for that caller rather than narrowing the shared contract every OTHER consumer still depends on
(LESSON-0272).

**Apply next time:** before extracting, deleting, or changing the logic of any shared predicate/helper/
utility module, `grep` every current call site that imports it and ask what EACH one actually needs right
now — not what the module's original design doc said. Two distinct needs among ≥2 live consumers → export
both, named explicitly. A change removes what was one of only two consumers → delete the module and inline
it in that same change. One consumer now wants a narrower/different result than the shared contract
provides → give that one caller its own derived subset; never narrow the shared contract to fit it.
