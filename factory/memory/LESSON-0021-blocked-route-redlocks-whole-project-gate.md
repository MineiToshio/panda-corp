---
id: LESSON-0021
type: anti-pattern
domain: factory-engineering
tags: [build-engine, gate, dr-075, dr-085, needs-owner, coupling, red-lock, whole-project-gate]
context: a route/work-order legitimately BLOCKED on an owner action (a missing env var) red-locks the WHOLE-project gate, because the shell-presence + baseline gates assert every nav route renders — so one blocked node couples unrelated FRDs and the baseline/close-out to it
source: project personal-page-v2 (runs wf_9e98acaf-92e / wf_978129ab-eca) — FRD-07 contact BLOCKED needs-owner (NEXT_PUBLIC_WEB3FORMS_KEY unset → /contact fails-loud); shell.spec.ts + the baseline verify.sh test /contact → whole-project gate RED, which also blocked FRD-01's close-out and the baseline self-heal, none related to contact
provenance: agent-inferred
created: 2026-07-01
status: active
promotion: proposed
confidence: high
times_applied: 0
links: [BL-0011, DR-085, DR-075, DR-055, LESSON-0002]
---

**Situation:** FRD-07 (contact) was correctly BLOCKED `needs-owner` — the page fails-loud (DR-078) without
`NEXT_PUBLIC_WEB3FORMS_KEY`, which only the owner can set. But the whole-project gates test EVERY nav
destination: `shell.spec.ts` (Shell-Presence, DR-075) asserts `<main>` on `/en/contact`, and the baseline
`verify.sh` (baseline self-heal + close-out) runs that suite. So the single blocked route turned the
whole-project gate RED — which then blocked the FRD-01 foundation from closing and blocked the baseline on
resume, neither of which has anything to do with contact. The per-FRD `--since` gates didn't see it (they
don't run `shell.spec` on contact), so features verified fine; only the FULL gate coupled everything. The
owner's reaction was exactly right: "why did the whole build stop for one form's env var?"

**Lesson:** A shared, whole-project gate that asserts over ALL nodes (every route) **couples every
unrelated unit to any single blocked node**. When one node is legitimately BLOCKED on an out-of-band
action (an owner secret, an external account), its failure should not red-lock the baseline, the
close-out, or sibling units — otherwise a one-form env var halts a whole build. The block is a tracked
owner TODO, not a code defect; the gate must be able to hold that node ASIDE while everything else
proceeds to green.

**Apply next time (durable principle):** A fail-closed gate that ranges over a set (all routes, all
surfaces) must be **blocked-node-aware**: a unit whose owning work order is in a legitimate
`BLOCKED: needs-owner` state is excluded from the deterministic whole-project assertions (or its failure
is advisory) until it is unblocked — so an out-of-band block on one node never couples the baseline and
unrelated units to it. Generalizes beyond routes: any shared gate over N units needs a way to quarantine a
deliberately-blocked unit rather than fail the whole set.

> The concrete engine fix (make the shell/baseline gate skip or soft-fail a `needs-owner`-blocked route's
> assertions until unblocked) is an **actionable defect**, tracked as **BL-0011** in `factory/backlog/`
> (DR-103) — not part of this durable lesson.

**Why it matters:** the owner reads "whole build stopped" as the engine over-coupling, and they're right —
it erodes trust in the build's autonomy. The fix lets a build keep finishing every independent feature and
reach a testable green while a single owner-gated node waits, instead of stalling the baseline on one
missing secret. Sibling of LESSON-0002 (both: the whole-project gate behaving too bluntly).
