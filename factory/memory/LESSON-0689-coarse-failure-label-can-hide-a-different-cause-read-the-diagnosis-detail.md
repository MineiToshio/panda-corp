---
id: LESSON-0689
type: anti-pattern
domain: build-engine
tags: [diagnosis, failure-classification, dependency, scope, debugging]
context: a build worker's failure is reported under a coarse failure label/category (e.g. "dependency") whose standard remedy exists in the system (e.g. "unblock env-infra")
trigger: use this when deciding how to recover from a reported build/worker failure labeled with a generic cause category, before applying that category's generic remedy
source: "funko-tracker br-2026-11-16-01, u-build-wo-12-003, BL-0327 — a blocked work order's failure was labeled dependency (the engine's failure-mapping forwarded every dependency-shaped cause to dependency_missing), which rendered as missing infrastructure; the real cause was an artifact-ownership/scope gap (files written outside the WO's declared artifact allowlist), which needed a scope repair, not an infra unblock — the generic remedy did not apply and had no path forward."
provenance: agent-inferred
created: 2026-11-18
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0327]
---

**Situation:** a work order's worker reported a blocked static gate (files outside its declared artifact
scope). The engine's failure-mapping logic collapsed this into the generic `dependency_missing` category,
which is normally rendered to the operator as "missing infrastructure" and whose only supported remedy is
an unblock command for environment/infra gaps. That remedy did not fit: the real cause was a scope/
ownership mismatch between what the worker wrote and what its work order declared as owned artifacts, and
no unblock command could fix it — the build had no supported continuation until the mapping itself was
fixed to distinguish the two causes.

**Lesson:** a coarse failure label exists to route to a generic remedy, and that mapping can over-collapse
genuinely different root causes into the same bucket. Accepting the label at face value and reaching for
its generic remedy, without reading the underlying diagnosis detail, can send the investigation down a
dead end (as here: there was no infra gap to unblock) and waste the attempts/time budget available to
recover.

**Apply next time:** when a failure is reported under a generic category, read the diagnosis detail
(the worker's own description of what went wrong) before applying that category's standard remedy —
especially when the standard remedy clearly doesn't fit the symptom described (e.g. "missing
infrastructure" rendered for what is actually a files-outside-scope report). If the detail describes a
different root cause than the label implies, fix the classification/mapping rather than forcing the
generic remedy to apply.
