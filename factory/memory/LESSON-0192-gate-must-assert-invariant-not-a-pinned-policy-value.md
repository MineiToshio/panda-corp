---
id: LESSON-0192
type: anti-pattern
domain: factory-engineering
tags: [gate-brittleness, invariant, policy-reversal, test-design, dr-120]
context: a canary/assertion gate that checks for the PRESENCE of a specific policy value (e.g. `status === "EXPERIMENTAL" && profile === "attended_foreground"`), or for one specific denial message, instead of the underlying invariant the policy exists to guarantee
trigger: use this when writing a gate/canary/test that asserts a capability or policy is correctly configured, especially one built to pin a promotion/experiment that might later be reversed
source: "panda-corp — DR-120 Codex capability withdrawal, 2026-09-02 (agent-inferred); `check-skill-capabilities.mjs` asserted the exact promoted profile and REDded on its own policy's legitimate reversal, requiring the assertions to be inverted by hand; same class as `test-r10-certification-permit.mjs`, which matched on one specific denial MESSAGE and broke when a stricter check began denying earlier for a different reason"
provenance: agent-inferred
created: 2026-09-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [DR-120, LESSON-0191]
---

**Situation:** `check-skill-capabilities.mjs` asserted the PRESENCE of the exact promoted profile
(`status === "EXPERIMENTAL" && profile === "attended_foreground"`). When DR-120 reversed that policy
(EXPERIMENTAL → FALLBACK), the gate REDded on its own legitimate policy change, and the assertions had to
be inverted by hand before the reversal could ship green. `test-r10-certification-permit.mjs` had the same
shape one level down: it matched on one specific denial MESSAGE and broke when a stricter check started
denying earlier, for a different reason, before that message was ever reached.

**Lesson:** a gate that hard-codes TODAY's specific policy value (a literal status string, a literal
denial message) as its passing condition will break the moment that policy legitimately changes — even
when the change is correct and intentional. The gate pins a snapshot of policy, not the property the
policy is supposed to guarantee.

**Apply next time:** write the gate against the INVARIANT the policy must always uphold — e.g. "policy
file, its projection, and every consuming reader agree, and no surface silently grants more capability
than the canonical source" rather than "status equals X"; "the action was refused" rather than "refused
with exactly THIS message". Treat the specific value as data the invariant is checked against, not as the
thing being asserted. This lets a legitimate policy reversal ship without the test itself needing to be
rewritten. See LESSON-0191 for the companion pattern this protects (capability-as-data reversibility).
