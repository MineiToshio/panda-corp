---
id: BL-0217
type: change
area: build-engine
title: "trial a small-scope build lane (one builder committing per WO + time-boxed opus FRD gate + mech close) as arm C against a vanilla single agent on a spec WITH a server surface"
status: open
severity: p1
opened: 2026-10-01
closed:
source: "pandacorp-bench-form benchmark 2026-10-01 (/Users/Shared/Proyectos/pandacorp-bench-form/runs/results.md, spec/redteam.md)"
closes:
links: [DR-015, DR-050, DR-057, DR-060, DR-097, BL-0218]
---

## Problem
Controlled benchmark (1 FRD / 3 WOs / 47 ACs, a client-only 6-field form, hidden 151-test oracle, blind judge):
`/pandacorp:implement` 9.117.1 took 84.3 min / ≈25 USD (35 agents, 1 owner relaunch) for oracle 151/151 and judge
93/100; a single sonnet-5-5 agent with a direct prompt took 2.7 and 5.2 min / ≈0.6 USD for oracle 151/151 and judge
79/100 (B-1). Under the owner's objective ("1 h at ~90% beats 5 h at ~95%") the engine loses 16-31× on time. Its
measurable extra value came from the opus FRD gate (2 real edge defects + a token bug the builder had diagnosed but
was not allowed to fix, + adversarial tests). Even the red-teamed improvement set (9.118.x) leaves ≈40 min of fixed
tail on a project a single agent builds in 3-5 min.

## Fix plan
1. Design a `small-scope` lane (opt-in arg first): ONE builder agent implements all WOs of a single small FRD and
   commits after EACH WO itself (it is the only writer → per-WO commits keep DR-097 honesty and DR-073/117 revert
   targeting); then the unchanged opus FRD gate (time-boxed), `verify.sh`, the security audit, a mech close.
2. The red-team rejections of the naive "solo" path (spec/redteam.md, change f) are the acceptance bar: no IN_REVIEW
   WO without its commit, resume never skips uncommitted work, foundation gate preserved on UI projects, server-surface
   detection fail-closed on a new empty project.
3. Benchmark it as arm C vs vanilla B on a SECOND spec with a server surface (route handler + DB), n ≥ 2 per arm.

## Tests (prove the fix — TDD, RED → GREEN)
Engine scenarios: solo-lane-commits-per-wo, solo-lane-crash-mid-wo-resumes-honestly, solo-lane-refuses-multi-frd,
solo-lane-keeps-foundation-gate-on-ui. Benchmark: arm C wall clock ≤ 30 min with oracle ≥ 90% and judge ≥ arm B.

## Done when
Arm C measured n ≥ 2 on two specs; decision recorded (DR) to adopt, keep opt-in or drop; decision-log entry.
