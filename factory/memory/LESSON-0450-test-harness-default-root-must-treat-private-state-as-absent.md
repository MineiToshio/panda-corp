---
id: LESSON-0450
type: anti-pattern
domain: testing
tags: [hermetic-tests, gitignored-state, test-harness, owner-private-data, dr-033]
context: a module/reader that resolves a catalog or identity source relative to a DEFAULT root (e.g. `cwd/..`) when no explicit root/fixture is passed in
trigger: use this when a test suite exercises code that reads from a default, caller-unspecified root and the test passes in a clean clone or fresh worktree but fails ONLY in the owner's main checkout
source: "mission-control commit 7b0d60c3 (2026-10-20), test mission-control/src/test/_tests/ownerPrivateState.test.ts — fixed by this same commit"
provenance: ci-verified
created: 2026-10-21
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: [mission-control]
links: [LESSON-0090]
---

**Situation:** `getProjectNavigation` read the identity catalog from `cwd/..`, which in the owner's real
checkout resolves to the private, gitignored `factory/navigation-identities.json`. 129 render tests using
fixture project ids threw "unregistered project" because they were unknowingly being checked against the
OWNER'S real catalog instead of being catalog-absent by default. The tests passed in a clean clone or a
fresh worktree (no such file exists there) and failed only in the main checkout — making the failure look
environment-specific/flaky instead of a real hermeticity bug. The fix (now shipped, with a dedicated test)
makes the harness treat its OWN checkout root as catalog-absent, while tmp fixture roots still exercise the
real reader.

**Lesson:** any reader that silently falls back to a DEFAULT root to find owner/instance-specific private
state (gitignored, no fixture seam) makes test behavior depend on whether that private state happens to
exist on the machine running the tests — this is a hermeticity bug (DR-033: framework code and the owner's
personal data must never blend), not a flaky test. The fact that it "only fails in the main checkout" is
itself the tell: a correctly hermetic test suite's result must not depend on which checkout it runs in.

**Apply next time:** when a reader resolves a catalog/identity/config source from an implicit default root,
the TEST HARNESS (not each individual test) must force that default root to be catalog-absent (point it at
an empty/known root) and require fixtures to opt in to the real reader explicitly via an injected path. Diagnose any test that passes in a clean clone/worktree but fails only in the main checkout as a hermeticity
leak of the owner's private state before assuming environment flakiness.
