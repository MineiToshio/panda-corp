---
id: LESSON-0184
type: pattern
domain: factory-engineering
tags: [enforcement, ssot, drift, synthesis, promise-without-mechanism, verification-tooling]
context: designing or reviewing ANY declared rule, guard condition, trigger, or contract description (a MUST in a standard, a "regenerate on X" doc claim, a duplicated validation check, an authored test suite, an instruction doc describing a file's edit contract) that is supposed to stay true over time without a human re-checking it
trigger: use this when authoring, reviewing, or auditing a rule/mechanism/contract that is supposed to hold going forward (a MUST rule, a "this triggers that" doc claim, a guard condition restated in more than one place, a verification script, an instruction doc describing how to edit a file) and deciding whether prose/discipline is enough to keep it true
source: "synthesized from 4 evidence-anchored candidates, all panda-corp, 2026-07-07..2026-07-21: LESSON-0113 (a doc/README asserted a trigger — 'regenerate on every commit' — that was never wired to any actual hook/gate/CLI, found independently in the standards layer AND the FRD-23 read-model); LESSON-0143 (two independent restatements of the same guard/schema rule — code call sites, and a template's descriptive comment vs its validator — drifted apart the moment one side changed); LESSON-0151 (an authored verification test suite that is never continuously executed degrades silently — a machine-specific path, a drifted fixture — and the silence is mistaken for health); LESSON-0178 (a file converted from hand-edited to generated left its INSTRUCTION docs, not just its code readers, still telling agents to hand-edit it, tripping the derived-drift gate) — librarian reflection pass, 2026-07-28"
provenance: agent-inferred
created: 2026-07-28
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0113, LESSON-0143, LESSON-0151, LESSON-0178, LESSON-0069]
---

**Situation:** across four independent incidents over two weeks, a declared rule/mechanism/contract that
was supposed to hold going forward quietly stopped being true, in four different guises: a documented
trigger that was never wired to any real hook or gate; a guard condition restated in two places that
drifted apart when only one side was updated; a test suite that was authored once and then simply never
run again; and an instruction doc that kept describing a file's OLD (hand-edited) contract after the file
became a generated projection of a new source. Nothing in any of the four cases "broke" loudly — each
just silently stopped matching reality, and the gap was found by an unrelated audit or a downstream agent
tripping over the stale assumption, not by the mechanism itself failing visibly.

**Lesson:** a rule/trigger/contract written down ONCE — in a standard's MUST line, a README's "this
regenerates on X," a duplicated guard condition, an authored test, or an instruction doc — is a
*declaration of intent*, not a *durable guarantee*. Writing it down does not make it self-maintaining;
only an ACTIVE mechanism does: (a) a single, wired enforcement point (a real hook/CI step/gate the rule
actually calls, not prose describing one), (b) a single source of truth when the same fact/guard is
needed in more than one place (never two independent restatements left to agree "by discipline"), and
(c) continuous execution (a schedule/trigger that actually runs the check, not a script that exists but
is only ever invoked by hand). Absence of active enforcement is the DEFAULT state for anything merely
documented — assume a described mechanism does NOT exist until you find its actual call site, the same
"verify against the live artifact, not the doc" principle LESSON-0069 names for facts, applied here to
MECHANISMS instead of facts.

**Apply next time:** when authoring or reviewing any rule/trigger/contract meant to hold going forward:
(1) before trusting a doc's "X triggers Y" or "this MUST happen," grep for the actual enforcing call site
— if none exists, either wire it in the same change or file the gap as a tracked backlog item immediately
(never leave the doc implying it's already live); (2) the moment the same guard/schema rule is needed in
a second place, extract a single shared resolver/script instead of restating it — two sites cannot be
trusted to stay in sync by discipline alone; (3) verification tooling only counts as "proven passing" if
it runs continuously (CI/schedule/hook) — an authored-but-manual-only test is unverified, not verified;
(4) when a file's edit contract changes (e.g. hand-edited → generated), grep and sweep every INSTRUCTION
doc that describes the OLD contract, not just the code readers, in the same change.
