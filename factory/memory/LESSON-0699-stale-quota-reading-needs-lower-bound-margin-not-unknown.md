---
id: LESSON-0699
type: gotcha
domain: build-engine
tags: [capacity, quota, staleness, scheduler, dr-162, health-ordering]
context: a multi-provider scheduler/allocator comparing usage readings of different ages across providers to decide which to prefer
trigger: use this when an allocator treats an old-but-present usage/quota reading as fully "unknown" and lets a fresher high-usage reading from another provider win by default
source: "mission-control .pandacorp/run/lessons.md 2026-11-13, during the DR-162 shared-capacity-allocator build (agent-inferred, fixed same day): the allocator treated a stale (>1h old) Codex weekly-window reading as 'unknown' and defaulted to preferring Claude at 95% usage anyway, because 'unknown' outranked a known-but-old high reading. Fixed by giving a stale reading an explicit lower-bound-plus-margin estimate and ordering candidates by account health before task-type preference; documented in the 2026-11-14 decision log ('Keep stale quota bounds and prioritize account health') and plugin/docs/capacity.md."
provenance: agent-inferred
created: 2026-11-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [DR-162, LESSON-0697, LESSON-0153]
---

**Situation:** a usage reading for one provider's window was over an hour old; the scheduler's freshness
check classified it as "unknown" rather than "known but aging," and a strict preference for "unknown
beats a known 95%-full reading" let the scheduler pick an actually-near-exhausted provider over the
stale one, which (once re-checked) still had real headroom.

**Lesson:** "unknown" and "stale" are not the same uncertainty level — a reading that was accurate an
hour ago is still informative, just no longer exact. Collapsing a stale-but-present reading into the
same bucket as "never observed" throws away real signal and can make a scheduler prefer a FRESH high-
usage reading over an OLDER lower one, picking the worse candidate. The fix applied two changes
together: treat a stale reading as a lower bound plus a margin that grows with age (rather than as a
blank), and order candidates by overall account health before task-type preference — so a genuinely
near-exhausted account never wins just because its data happens to be newer.

**Apply next time:** when a scheduler/allocator compares readings of different ages across sources,
don't binarize staleness into "known" vs "unknown" — decay a stale-but-present reading toward a
conservative (worse-case, margin-widening) estimate instead of discarding it, and rank candidates by
health/safety before ranking by preference. A fresher-but-worse reading should never beat an
older-but-better one just because freshness was used as the tiebreaker instead of the actual values.
