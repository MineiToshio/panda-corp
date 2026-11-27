---
id: LESSON-0729
type: gotcha
domain: factory-engineering
tags: [memory-harvesting, provenance, decision-log, librarian, dr-047, eval-gate]
context: harvesting a lesson from a project's decision-log.md when the triggering entry sits next to, or shares a date/crisis with, another entry that IS owner-stated
trigger: use this when assigning provenance (owner-stated vs agent-inferred vs ci-verified) to a lesson sourced from a decision-log entry, especially one filed alongside a sibling entry from the same incident/date
source: "panda-corp's own 2026-11-26 scheduled memory-review sweep, harvesting funko-tracker's decision-log: LESSON-0727 (dev-default + egress alert) and LESSON-0728 (cache public reads) were landed the same week, from the same Neon-egress-pressure incident, documented as adjacent/sibling decision-log entries. LESSON-0727's entry explicitly attributes its fix to an owner decision/directive, so owner-stated was correct there. LESSON-0728's entry (funko-tracker commit 23e6a703, 2026-11-25, 'Reuse the public browse revision on runtime visits') describes a technical response the AGENT made on its own — no explicit owner directive is recorded for that specific caching architecture. A first pass tagged LESSON-0728 owner-stated anyway, by inheriting the sibling entry's provenance rather than checking that specific entry's own text; caught before commit, corrected to agent-inferred. (LESSON-0728 later independently earned owner-stated through a DIFFERENT path — the owner's 2026-11-26 approval of DR-166 T3, which names the pattern explicitly — so its final provenance is owner-stated for a reason unrelated to this near-miss.)"
provenance: agent-inferred
created: 2026-11-26
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0727, LESSON-0728]
---

**Situation:** two decision-log entries from the same incident/date/crisis are harvested into separate
lessons; one entry explicitly attributes its decision to an owner statement/directive, the other merely
describes a technical response the agent made on its own. Provenance was briefly assigned to the second
lesson by inheriting the first's `owner-stated` tag, rather than checking what that specific entry's own
text actually attributes.

**Lesson:** `provenance` is a property of the ONE decision-log entry a lesson is sourced from, never of
the date, the crisis, or a sibling entry filed next to it. Entries that land together (same incident, same
day, same decision-log section) are not automatically the same provenance — one can be an explicit owner
directive while the neighboring one is the agent's own unprompted technical choice. Misattributing
`owner-stated` matters because it bypasses DR-047's eval-gate cross-corroboration requirement (an
`agent-inferred`, single-trajectory candidate cannot self-activate; an `owner-stated` one can) — so an
inherited, wrong provenance tag can wrongly auto-activate a lesson that should have stayed `candidate`.

**Apply next time:** when harvesting a lesson whose source is a decision-log entry, read THAT SPECIFIC
entry's own text and ask: does it say the owner stated/decided/directed this, or does it only describe
what was changed/fixed? Do not default to a sibling or adjacent entry's provenance just because they
share a date, an incident, or a decision-log section. If the specific entry is ambiguous or silent on
attribution, default to `agent-inferred` and let a later, independent event (a different corroborating
project, or an explicit owner approval of a related policy) earn `owner-stated` on its own merits — as
happened for LESSON-0728, which reached `owner-stated` through the owner's unrelated DR-166 approval, not
through its sibling LESSON-0727's provenance.
