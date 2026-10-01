---
id: LESSON-0274
type: pattern
domain: process-design
tags: [owner-preference, build-engine, speed, iteration, product-process]
context: deciding what to optimize a build engine or any assisted construction workflow for, when a tension exists between completeness/polish and time-to-first-useful-result
trigger: use this when prioritizing work on an assisted build/construction workflow and a tradeoff exists between shipping something usable faster vs. more complete/polished more slowly
source: "mission-control .pandacorp/run/lessons.md 2026-09-30 (owner-stated) — the owner prefers an app at ~90% in ~1 hour over one at ~95% in ~5 hours, because he iterates regardless, and detecting failures earlier (at the ~1-hour mark) is itself valuable; also recorded in factory/profile.md 2026-09-30"
provenance: owner-stated
created: 2026-10-01
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0246]
---

**Situation:** the owner stated a clear, generalizable preference for how an assisted build/construction
workflow should trade off speed against completeness: an app delivered at roughly 90% quality in about one
hour beats one delivered at roughly 95% quality in about five hours — because he iterates on the result
regardless of which path produced it, and a faster first result surfaces failures/direction problems
sooner, when they're cheaper to correct.

**Lesson:** for this owner, a build/construction workflow's primary optimization target is TIME TO FIRST
USEFUL RESULT, not completeness or polish at first delivery — "useful" here means good enough to iterate
on and learn from, not a finished product. This is distinct from (and complements) LESSON-0246's adoption
signal: that lesson says a slow assisted path gets abandoned for a manual escape hatch; this one says WHY,
from the owner's own stated preference — he would rather get an imperfect result fast and iterate than wait
longer for a more complete one, because the extra completeness time doesn't buy him anything he values as
much as an earlier chance to find out what's wrong.

**Apply next time:** when deciding what an assisted build/construction workflow should prioritize (default
settings, what gates block vs. warn, how much the engine polishes before declaring something ready to look
at), weigh time-to-first-usable-result heavily — a design that trades some completeness for materially
faster delivery of something the owner can react to and iterate on is, for THIS owner, a better tradeoff
than the reverse, even though "launch on red/incomplete work" is never acceptable on its own terms (the
quality gates themselves are not optional; what's tunable is how much work happens before the owner sees a
usable checkpoint).
