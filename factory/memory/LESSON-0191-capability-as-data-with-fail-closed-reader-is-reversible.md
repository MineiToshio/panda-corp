---
id: LESSON-0191
type: pattern
domain: factory-engineering
tags: [feature-flag, fail-closed, reversibility, dr-120, policy-as-data]
context: withdrawing (or re-granting) a runtime capability that was implemented as a policy VALUE read by a fail-closed checker, rather than as code that exists/is called
trigger: use this when designing — or reversing — a capability/permission gate for a runtime, skill or feature that might need to be granted, withdrawn and possibly re-granted more than once
source: "panda-corp — DR-120 Codex `implement` capability withdrawal, 2026-09-02 (agent-inferred), factory/memory/_inbox.md note"
provenance: agent-inferred
created: 2026-09-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [DR-120, LESSON-0192]
---

**Situation:** DR-120 needed to withdraw a Codex `implement` capability promoted earlier (EXPERIMENTAL /
`attended_foreground` / targeted-only). The withdrawal turned out to be a ONE-VALUE edit: flipping
`implement.codex` from `EXPERIMENTAL` to `FALLBACK` in `skill-runtime-policy.json` — because
`launch-codex-implement.sh` and `codex/supervisor.mjs` already read that policy file and fail closed
unless the status exactly matches the promoted value. No new machinery was needed to turn the existing
checks into the enforcement of the freeze.

**Lesson:** when a capability/permission might need to be granted, later withdrawn, and possibly
re-granted, express the CURRENT grant as DATA read by a fail-closed checker — never as a code branch, or
as machinery that is added/removed. The reader's fail-closed default (deny unless the datum matches the
promoted value) does the enforcement; toggling the datum reverses the whole capability with zero new code.

**Apply next time:** when building a new capability gate (a runtime promotion, an experimental flag, a
permission), put the "is this granted" question behind ONE canonical data file/field with a fail-closed
reader (deny by default, allow only on an exact match against the promoted value) — never let a capability
be granted purely by code existing or being reachable. This makes a future reversal (and re-reversal) a
single-value edit instead of a code change. See LESSON-0192 for the mirror-image trap: a gate that then
asserts the PRESENCE of today's specific value, instead of the underlying invariant, breaks the moment
that value legitimately changes.
