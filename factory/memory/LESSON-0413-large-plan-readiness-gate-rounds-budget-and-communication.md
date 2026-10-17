---
id: LESSON-0413
type: pattern
domain: build-orchestration
tags: [readiness-gate, dr-100, judge-tier, architecture, large-plan, owner-communication]
context: the architecture phase's independent readiness-gate rounds on a large work-order plan (here, 29 WOs)
trigger: use this when architecting or auditing readiness for a plan large enough (roughly 20+ WOs) that more than one independent gate round is plausible, or when deciding whether to run multiple JUDGE-tier checks in parallel
source: "pandasaga .pandacorp/run/lessons.md 2026-10-15/16 (agent-inferred + owner-stated): three independent fresh-context JUDGE gates (readiness, repo-grounding, consistency) each found disjoint blockers the author's own self-check passed, worth running in parallel; each fresh gate round on the 29-WO plan went one level deeper (structure -> cross-WO wiring -> contract fields and library behaviour), budget 3-4 rounds rather than one; and the owner explicitly asked for a round cap stated up front plus an explanation of why each round costs time, since 4+ silent full rounds made the phase feel endless."
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0279, LESSON-0243, BL-0245]
---

**Situation:** architecting a large plan (29 work orders) for a content-heavy product required multiple
independent readiness-gate passes before the blueprint was clean. Three DIFFERENT fresh-context JUDGE
gates (readiness, repo-grounding, consistency), run in parallel, each caught genuinely different blockers
that the plan author's own self-check had passed — no single gate would have caught all of them. Across
rounds, each fresh pass went one level deeper than the last: the first round caught structural problems,
the second caught cross-WO wiring gaps, the third caught contract-field and library-behavior mismatches
only visible once earlier issues were fixed. By round 4+, with no round budget stated up front, the owner
experienced the phase as open-ended rather than converging.

**Lesson:** three distinct facets worth carrying forward on any similarly large plan: (1) running multiple
independently-scoped JUDGE-tier gates in PARALLEL (not sequentially merged into one mega-check) is worth
the extra cost because each one's narrower scope catches what the others structurally cannot, including
blockers the author's own self-check already passed; (2) a large plan's gate rounds are not redundant
repeats of the same check — each round tends to go one level deeper (structure, then wiring, then
contract/runtime behavior), so budgeting 3-4 rounds for a plan this size is realistic, not a sign something
is wrong; (3) from the OWNER's side, an unstated round budget makes a legitimately-converging multi-round
process feel endless — the fix is communication, not fewer rounds: state an expected round budget before
starting, and once a stated cap is reached, switch remaining rounds to a narrower "fix + delta
verification" scope rather than another full independent pass, explaining why.

**Apply next time:** on a large plan, run the independent gate types (readiness/repo-grounding/consistency
or equivalent) in parallel rather than one after another. Expect and budget for 3-4 full rounds on a plan
in the 20+ WO range rather than treating round 2+ as a sign of failure. State the expected round budget to
the owner BEFORE the first round, and after the stated cap, narrow subsequent rounds to fixes + delta
verification only, saying so explicitly — don't let the process just keep running silently.
