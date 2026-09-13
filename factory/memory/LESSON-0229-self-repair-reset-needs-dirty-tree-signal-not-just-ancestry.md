---
id: LESSON-0229
type: anti-pattern
domain: build-orchestration
tags: [dr-065, self-repair, hard-reset, ancestry, safety-precondition]
context: designing or reviewing any auto-repair/self-healing mechanism that resets a working tree to a last-known-good commit after detecting a failure
trigger: use this when a self-repair recipe decides to hard-reset to a last-known-good SHA — before relying on "is it an ancestor of HEAD" as the sole safety check
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-12 (agent-inferred, translated from Spanish) — DR-065's foundation self-repair recipe hard-resets to last_green_sha after verifying only that it is an ANCESTOR of HEAD. On personal-page-v2 that SHA was from 2026-09-08 with ~30 verified commits on top of it and a fully clean tree (zero half-built surfaces) -- the recipe as specified would have destroyed verified work, not WIP. The real trigger for a safe reset is whether half-built surfaces actually exist (a dirty git status / files tied to the failed surface), not whether the target SHA is merely an ancestor."
provenance: agent-inferred
created: 2026-09-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0130]
---

**Situation:** a self-repair recipe (DR-065) that resets hard to `last_green_sha` after a failure checks
only that the target SHA is an ancestor of `HEAD` before resetting. On one project, the last-green SHA was
~30 verified commits and several days behind `HEAD`, with a fully clean tree — running the recipe as
specified would have discarded real, already-verified work, not the WIP it was meant to discard.

**Lesson:** "the target SHA is an ancestor of HEAD" is necessary but not sufficient evidence that a
destructive hard-reset is the correct action. The real question a self-repair recipe must answer before
resetting is "does a half-built, failed surface actually still exist to discard" — evidenced by a dirty
`git status` or files tied to the specific failed WO/surface — not merely "is the rollback target an
ancestor." A clean tree with many legitimately-verified commits ahead of the rollback target means there
is nothing to repair by resetting; the recipe should refuse and escalate instead.

**Apply next time:** when designing or auditing any auto-repair/self-healing mechanism that hard-resets to
a last-known-good state, require BOTH an ancestry check AND a concrete signal that unfinished/failed work
actually exists (dirty tree, specific files) before resetting — never treat ancestry alone as sufficient
justification for a destructive rollback.
