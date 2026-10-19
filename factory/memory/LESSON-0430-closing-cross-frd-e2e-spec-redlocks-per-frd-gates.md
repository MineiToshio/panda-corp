---
id: LESSON-0430
type: gotcha
domain: build-orchestration
tags: [e2e, playwright, test-discovery, frd-gate, close-out]
context: authoring a closing/cross-FRD e2e spec (one that walks every FRD, e.g. a fidelity sweep) inside the same `e2e/` directory default test discovery scans
trigger: use this when adding an end-to-end spec that is meant to exercise EVERY FRD at close-out (a full-sweep fidelity/regression spec), on a project whose per-FRD gates may run the unscoped `playwright test e2e/` discovery
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-18 (agent-inferred), FRD-01 repair"
provenance: agent-inferred
created: 2026-10-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0018, LESSON-0021]
---

**Situation:** a closing e2e spec (`fidelity.spec.ts`) was written to walk ALL FRDs of the project as a
final sweep. Because it lived inside `e2e/` with no exclusion, it fell into the default
`playwright test e2e/` discovery glob and ran during every per-FRD gate while the build was still in
progress — asserting against FRDs that hadn't been built yet, red-locking the FULL verify.sh of EACH
per-FRD gate until the whole build finished.

**Lesson:** a spec that is deliberately scoped to the WHOLE, FINISHED project (not the single FRD a
gate is currently verifying) is a different category from a per-feature smoke/shell spec, and default
test discovery does not know the difference — it runs everything it finds under `e2e/`. This is a
distinct mechanism from BL-0018 (which scoped `--since` to specific blocking spec files): even with
that fix, a NEW closing spec added to the default discovery path can still redlock every intermediate
gate if nothing excludes it explicitly.

**Apply next time:** name or place a cross-FRD/closing spec so it is excluded from default discovery
(a `*.closeout.spec.ts` suffix, a separate `e2e-closeout/` directory, or an explicit exclude pattern in
the Playwright config) and either skip it entirely until the build reaches close-out, or make it
self-aware of partial build state (quarantine FRDs not yet built rather than asserting on them).
