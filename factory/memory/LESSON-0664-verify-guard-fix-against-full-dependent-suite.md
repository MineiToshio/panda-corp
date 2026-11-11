---
id: LESSON-0664
type: gotcha
domain: testing
tags: [guard-fix, regression, integration-suite, scope-of-verification]
context: fixing a gate/guard/validator (e.g. a retry-budget-consuming check) whose root cause was a LOCAL configuration error rather than a real application defect
trigger: use this when fixing a gate/guard/validator that failed due to a LOCAL configuration error, before declaring the fix good
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-09 (agent-inferred): postverify had consumed its 3 retry attempts on a local MEDIA_PUBLIC_BASE_URL configuration error (not a real defect); the config fix (7a44fe00) landed, but it broke 21 HTTP fixture tests in the ingest integration suite — caught only because that suite was explicitly re-run after the fix, not assumed clean."
provenance: agent-inferred
created: 2026-11-11
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0244]
---

**Situation:** a retry-consuming guard turned out to be failing because of a local config value, not a
real application bug. The config fix landed and resolved the originating symptom — but the SAME change
broke 21 unrelated HTTP fixture tests in the project's integration suite, a consequence that only
surfaced because the integration suite was run explicitly after the fix rather than assumed unaffected.

**Lesson:** a fix scoped to "the one scenario that was failing" can still touch shared config/guard
surface that OTHER tests in the same project depend on in ways that have nothing to do with the
originating symptom — the narrowness of the bug's trigger says nothing about the breadth of the fix's
blast radius. Declaring a guard fix "good" on the strength of the one scenario it was meant to resolve is
a different claim from "this didn't break anything else," and only the second claim is actually load-
bearing before landing.

**Apply next time:** after fixing a gate/guard/validator — especially one whose root cause was
configuration rather than logic — run the FULL dependent test/integration suite that exercises that
guard before declaring the fix good, not just the scenario that motivated the fix. This is the same
principle LESSON-0244 states for a `--since`-scoped gate (a scoped check is structurally blind to drift
outside its own window) applied specifically to the moment right after a guard/config fix lands.
