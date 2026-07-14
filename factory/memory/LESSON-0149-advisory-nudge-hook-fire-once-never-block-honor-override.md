---
id: LESSON-0149
type: pattern
domain: hooks
tags: [hooks, nudge, ux, advisory, worktree-isolation]
context: designing an advisory hook that reminds the owner/agent of a next step (e.g. "run /pandacorp:sync") without gating anything
trigger: use this when adding a non-blocking reminder/nudge hook to the factory or a project's tooling
source: "external-repo mining of github.com/NateBJones-Projects/ringer, 2026-07-10 (factory/decision-log.md same-date entry, filed alongside BL-0064); ringer hooks/ringer_nudge.py; cf. BL-0033 worktree-nudge overfiring"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0033, BL-0064]
---

**Situation:** the factory already has a precedent for a nudge that goes wrong — the worktree-isolation
nudge hook overfired against the factory repo itself (BL-0033), becoming noise. A later mining pass over
an external tool (ringer) surfaced its own advisory-nudge pattern (`hooks/ringer_nudge.py`) as the
positive counter-example: fire once per session, never block, always honor an explicit override.

**Lesson:** an advisory nudge hook is only useful while it stays rare and dismissible. The three
invariants that keep it useful: (1) fire **at most once per session**, enforced by an atomic marker file
(not a heuristic re-check each time); (2) **never block** — it is a suggestion, never a gate, regardless
of how confident the trigger condition is; (3) **always honor an explicit "do it inline"/"skip" override**
from the owner in that session. A nudge that repeats, blocks, or ignores an override degrades into noise
and gets disabled (the BL-0033 fate) — the design must prevent that from the start, not patch it after
the first complaint.

**Apply next time:** before shipping any new advisory hook, verify all three invariants are implemented
(marker-file fire-once, non-blocking, override-honoring) — reuse this checklist rather than re-deriving
nudge hygiene per hook.
