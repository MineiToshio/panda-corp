---
id: LESSON-0566
type: pattern
domain: build-engine
tags: [design-tokens, visual-baseline, gate-test-defective, re-bless, cascade]
context: a global design-token/CSS change (a restyle, a token-system swap) is landed in one FRD, and every LATER FRD's whole-project gate also runs the now-stale visual/snapshot baselines the token change invalidated
trigger: "use this when a global token/design-system change is about to land — before letting later FRDs discover the resulting stale-baseline reds on their own"
source: "mission-control .pandacorp/run/lessons.md 2026-10-30/31 (agent-inferred) — a global token change turned every subsequent full gate red through stale baselines; later FRDs were blocked and reverted for a defect they did not cause, until the baselines were re-blessed in the SAME FRD that changed the tokens"
provenance: agent-inferred
created: 2026-10-31
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0002, LESSON-0104, LESSON-0559, LESSON-0561]
---

**Situation:** a global design-token/CSS change (the kind LESSON-0561 documents at the file level) landed
inside one FRD. Every visual/snapshot baseline the whole-project gate runs — not just the ones the
changing FRD itself touched — was computed against the OLD tokens, so every LATER FRD's full gate also
went red against those now-stale baselines. Each later FRD, having made no change related to the actual
cause, was treated as broken: blocked, and in at least one case reverted, for a defect it did not
introduce.

**Lesson:** a whole-project gate that re-runs EVERY baseline on every FRD's close (not just the ones that
FRD touched) means a global token/design-system change has a blast radius equal to the whole baseline
set, not just the files the changing WO edited. Re-blessing those baselines is not optional cleanup to
defer — until it happens, every FRD that lands afterward inherits the stale-baseline red as if it were
its own regression, and the gate's own remedy for an apparent regression (DR-073's rebuild/revert path,
LESSON-0002) actively makes this worse: it discards and rebuilds correct, unrelated work to "fix" a red
that the token change — not that work — caused.

**Apply next time:** when a work order changes global design tokens/CSS wholesale, re-bless every
baseline the change invalidates IN THE SAME FRD/commit, before any later FRD's gate can run against the
stale set — do not let it leak forward. If a later FRD's gate turns up a baseline red that traces to an
earlier global token change rather than its own work, route it as `gate-test-defective`
(LESSON-0002/LESSON-0104/LESSON-0559) and re-bless at the source, never rebuild/revert the later,
unrelated FRD to chase a cause outside its own diff.
