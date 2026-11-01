---
id: LESSON-0599
type: pattern
domain: build-orchestration
tags: [dr-141, batch-integration, merge-queue, verification, synthesis]
context: assembling a DR-141 batch integration from several independently-verified, finished build lanes before running the combined gate once
trigger: use this when planning or executing a DR-141 batch integration (combining several finished, independently-verified lanes into one branch before the full gate) and deciding what, beyond "each lane was green on its own," still needs checking
source: "synthesis over 3 evidence-anchored candidates, two distinct projects: LESSON-0548 (funko-tracker, 2026-10-28 — an integration branch assembled with real git-merge commits re-raises already-resolved conflicts when a rebase-based merge-queue.sh linearizes it); LESSON-0589 (mission-control, 2026-10-31 — two lanes conflicting on the same artifact need to be classified additive vs competing-implementation before resolving, not resolved uniformly); LESSON-0590 (mission-control, 2026-10-31 — a security guard added by one lane and an unguarded raw use added by a different lane each pass review alone but reopen a vulnerability only once integrated) — librarian reflection pass, 2026-11-01."
provenance: agent-inferred
created: 2026-11-01
status: active   # 2026-11-01 librarian eval-gate: the 3 folded facets already span 2 distinct projects (funko-tracker + mission-control) with zero contradicting evidence, meeting the cross-corroboration bar
promotion: proposed   # 2026-11-01 (librarian review) — target: factory/standards/build-orchestration.md, DR-141 batch-integration procedure: add an explicit "integration verification" sub-step, distinct from each lane's own gate — (1) require the assembled integration branch to have LINEAR history (squash-built, no merge commits of its own) before handing it to a rebase-based merge-queue.sh; (2) when resolving a conflict between two lanes touching the same artifact, classify it additive (independent content → keep both) vs competing-implementation (same concern, different mechanism → determine which one actually governs the runtime/rendered result before discarding the other) rather than resolving uniformly; (3) re-run any check whose correctness depends on a cross-cutting guard/boundary (security PoCs, global lint rules, auth boundaries) against the FULLY INTEGRATED tree, not just against each source lane — per-lane review cannot see a problem that only exists once lanes are combined.
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0548, LESSON-0589, LESSON-0590, DR-141]
---

**Situation:** DR-141 (batch integration — combine several finished, independently-verified lanes into
one branch, then run the full gate ONCE on the combined result) has now surfaced three distinct failure
shapes across two projects, all sharing the same root structure: something that looks safe/correct when
checked per-lane turns out to be unsafe/incorrect only once the lanes are actually combined, and no
single lane's own review or gate could have caught it because the problem didn't exist yet in that lane's
own branch. (1) An integration branch built with real `git merge` commits has a correct final tree, but a
downstream rebase-based landing step re-raises conflicts the hand-resolved merge had already settled,
because rebase replays history rather than trusting the merge's result. (2) Two lanes editing the same
artifact can conflict in two fundamentally different ways — purely additive (keep both) or competing
implementations of the same outcome (pick the one that actually governs, discard the dead one) — and
resolving either shape with the other's default is wrong. (3) Two lanes can each be the "safe half" of a
vulnerability that only exists once combined (one lane adds a raw unguarded use, a different lane adds
the guard meant to prevent exactly that use elsewhere) — each lane's own review has nothing to flag.

**Lesson:** "every lane passed its own gate" is necessary but not sufficient evidence that a DR-141 batch
integration is safe to land. Batch integration is not just a mechanical union of already-verified work —
it creates new facts (a non-linear history to reconcile, a conflict needing classification, a combined
codebase a security property depends on) that did not exist in any single lane and that no per-lane
review was ever positioned to see. The integration step itself needs its own small, targeted verification
pass, separate from and in addition to each lane's own gate.

**Apply next time:** when assembling a DR-141 batch integration: (1) build the integration branch as
LINEAR/squash history if the landing mechanism rebases onto the target — never hand a rebase-based queue
a branch containing its own merge commits; (2) before resolving any conflict on a shared artifact between
two lanes, explicitly classify it (additive vs competing-implementation) rather than defaulting to one
resolution strategy for every conflict; (3) re-run any check that depends on a cross-cutting guard or
boundary (security PoCs, centralized parsing/sanitization, auth checks, global lint rules) against the
FULLY INTEGRATED tree — treat a per-lane pass of such a check as informative, never as proof it still
holds after integration.
