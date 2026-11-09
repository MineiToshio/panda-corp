---
id: BL-0305
type: change
area: plugin-agent
title: "Nudge implementer/reviewer prompts to cite LESSON-NNNN explicitly so the citation counter is trustworthy"
status: open
severity: p2
opened: 2026-11-09
closed:
source: "factory/memory/_inbox.md note, 2026-11-06 review pass (agent-inferred) — sampled 151 active lessons, 73 at times_applied: 0 including several high-confidence/corroborated ones already promotion: approved/proposed; generalizable half captured as LESSON-0634"
closes:
links: [LESSON-0634]
---

## Problem
`plugin/scripts/count-lesson-citations.sh` is the ONLY mechanism allowed to move `times_applied`/
`applied_in` (per `factory/memory/README.md`'s lifecycle and the `memory` skill's own rule — "never
hand-edit them, never trust an agent's claim"). It works by grepping durable artifacts (blueprints,
ADRs, reviews, Status Notes) for a literal `LESSON-NNNN` string. A 2026-11-06 review pass sampled 151
`active` lessons and found 73 at `times_applied: 0` — including several high-confidence,
cross-corroborated lessons already carrying `promotion: approved` or `promotion: proposed`
(e.g. LESSON-0102, LESSON-0103, LESSON-0109, LESSON-0059). This is strong evidence the counter is a
near-universal false negative in this store: builders very likely ARE retrieving and applying `INDEX.md`
lessons when they shape a decision, but rarely write the explicit `LESSON-NNNN` id into the artifact they
produce, so the grep finds nothing. Left as-is, the counter cannot do the one job it exists for (telling
`review`'s prune pass which lessons are genuinely cold once the prune freeze lifts) — see LESSON-0634 for
the generalized form of this finding and why it must NOT be read as "these lessons are unused."

## Fix plan
Add an explicit citation nudge to the build-side prompts that actually read `INDEX.md`/lesson files and
make retrieval-shaped decisions — the `implement` skill's implementer/reviewer subagent prompts
(`plugin/skills/implement/SKILL.md` and/or the agent definitions under `plugin/agents/` that those
subagents run as) and, if blueprint/ADR authoring reads memory too, `architecture`'s prompts. The nudge:
when a retrieved `LESSON-NNNN` materially shaped a decision (a library choice, an avoided trap, a pattern
followed), write its id verbatim into the durable artifact you are producing (blueprint section, ADR,
review finding, Status Note) — not just "I applied prior lessons" in prose. Keep it a lightweight
one-line instruction near wherever those prompts already tell the agent to read `INDEX.md`; do not add a
new gate or block anything on it (the existing citation count stays advisory/measurement-only).

## Tests (prove the fix — TDD, RED → GREEN)
Prompt-text change, no executable gate currently runs these prompts in isolation. RED = current prompt
text (grep the relevant `plugin/skills/implement/SKILL.md` / agent files for "LESSON-NNNN" or "INDEX.md")
has no instruction to cite the id back into the artifact. GREEN = the updated prompt text contains the
citation nudge; manually verify on the next real `/pandacorp:implement` run that at least one produced
artifact (blueprint/ADR/review) contains a literal `LESSON-NNNN` citation where a lesson was actually
retrieved and applied, and that `count-lesson-citations.sh` picks it up.

## Done when
The citation nudge ships in the relevant prompt(s), the plugin version is bumped per DR-034 (PATCH —
prompt adjustment, no new capability), a decision-log entry links this item and LESSON-0634, and the next
real build's `count-lesson-citations.sh` run registers at least one new citation it would not have
registered before.

## Out of scope
Changing `count-lesson-citations.sh` itself, the prune-freeze threshold, or any deprecation logic — this
item only makes the existing counter less likely to false-negative at the source (the prompts that could
cite but currently don't). Re-evaluating which of the 73 zero-citation lessons to deprecate is `review`'s
job once prune-freeze lifts, informed by LESSON-0634, not this item's.
