---
id: LESSON-0022
type: anti-pattern
domain: factory-engineering
tags: [build-engine, dr-085, hardening, security-audit, telemetry, release-gate, false-done]
context: the build engine set phase:release after the FRD loop WITHOUT running the DR-085 hardening (the security-auditor + analytics agents never spawned), declaring "done" over an un-audited, under-instrumented build — a supervising pass then found 1 CRITICAL + 1 HIGH security bug that would otherwise have shipped
source: project personal-page-v2 (pass-3, run wf_978129ab-eca) — agent-type census showed only architect/implementer/reviewer ran; status.yaml phase:release was set with NO security-auditor and NO analytics agent; the follow-up manual hardening found CRITICAL (no security headers/CSP) + HIGH (ASI01 path-traversal in the blog-generator) + 3 telemetry gaps
provenance: agent-inferred
created: 2026-07-01
status: active
promotion: approved
confidence: high
times_applied: 1
applied_in: [pandacorp-build.js Hardening phase (audit-20, 2026-07-01)]
links: [BL-0012, DR-085, DR-017]
---

**Situation:** DR-085 folds the hardening (security audit + telemetry verification + quality close-out)
INTO construction: "the build is not done until secure, quality-gated, audited and instrumented", and only
then `phase: release`. But the `pandacorp-build` engine, after verifying all 11 FRDs + a cross-feature
integration review + a visual QA sweep, **set `phase: release` and `running: false` without ever spawning
the `security-auditor` or `analytics` agents** (confirmed by an agent-type census across all run dirs:
architect/implementer/reviewer only). The supervising agent noticed the omission and ran the hardening by
hand — which surfaced a CRITICAL (no security headers/CSP anywhere) and a HIGH (ASI01 path-traversal in the
blog-generator skill) plus 3 telemetry gaps. All would have shipped had the "done" been trusted.

**Lesson:** An automated "done"/release transition that is gated only on the FRD loop completing — while a
mandated, distinct step (the security + telemetry hardening) is skipped — is a **false-done**: the flag
says released, the work isn't. A per-unit gate (each FRD passed) is NOT the whole-program safety step
(OWASP/ASI audit + instrumentation verification); collapsing "all features verified" into "release-ready"
drops the audit that exists precisely to catch cross-cutting, whole-program defects (headers/CSP, agentic
tool-misuse, missing telemetry) that no single FRD gate covers.

**Apply next time (durable principle):** A phase/state transition that asserts a multi-step definition of
done must be gated on EACH mandated step having actually run, not on a proxy (the last per-unit gate). If a
required step (a security audit, an instrumentation check) is owned by a distinct agent/stage, the
"advance" must verify that stage produced evidence — or refuse to advance and hand off to whoever runs it.
Never let "all the pieces passed" stand in for "the whole-program audit ran."

> The concrete engine fix (the release transition must require the DR-085 hardening to have run — the
> engine spawns security-auditor + analytics before phase:release, or it does NOT set phase:release and
> hands off) is an **actionable defect**, tracked as **BL-0012** in `factory/backlog/` (DR-103).

**Why it matters:** a build that self-declares release without the audit can ship real security holes (here
it nearly shipped a CRITICAL). The whole point of DR-085 (audit moved INTO construction) is defeated if the
engine can reach `phase: release` without running it.
