---
id: BL-0012
type: bug
area: build-engine
title: Engine must not set phase:release without running the DR-085 hardening (security-auditor + analytics)
status: open
severity: p1
opened: 2026-07-01
closed:
source: LESSON-0022
closes:
links: [LESSON-0022, DR-085, DR-017]
---

**Problem:** The `pandacorp-build` engine set `phase: release` + `running: false` after verifying all FRDs
+ a cross-feature integration review + a visual QA sweep, but **never spawned the `security-auditor` or
`analytics` agents** that DR-085 mandates as construction's last step (agent-type census across all run
dirs: architect/implementer/reviewer only). The supervising agent ran the hardening manually and it
surfaced a **CRITICAL** (no security headers/CSP anywhere in `next.config.ts`) + a **HIGH** (ASI01
path-traversal in the blog-generator's `resolvePostPath`) + 3 telemetry gaps (`page_viewed` never fired,
etc.). All would have shipped if `phase: release` had been trusted as "done". Evidence: run
`wf_978129ab-eca`, project personal-page-v2.

**Fix plan:**
1. **Gate the release transition on the hardening actually running.** In
   `plugin/templates/shared/.claude/workflows/pandacorp-build.js`, once all FRDs are `VERIFIED`, the
   close-out MUST run the DR-085 hardening before it may set `phase: release`: spawn the `security-auditor`
   (OWASP + ASI01–ASI10 when the product has an agentic/LLM component — this project ships the FRD-08
   blog-generator skill) and the `analytics` agent (telemetry-fires verification), plus the whole-project
   quality close-out. Critical/High security findings are fixed (fast WOs through the FRD gate) before
   release.
2. **If the engine cannot run those stages, it must NOT self-declare release.** Fallback: leave
   `phase: implementation` + emit a `needs-hardening` signal so the `/pandacorp:implement` supervising skill
   runs the hardening (as it did here manually) and only then advances. Never set `phase: release` on the
   FRD loop alone.
3. **Evidence artifact.** The hardening must leave a durable record (a `docs/reviews/security-*.md` +
   the telemetry verification section in `docs/analytics/events.md`) so "audited + instrumented" is
   checkable, not assumed. The release transition asserts those exist.
4. **Docs.** Reinforce in `factory/standards/build-orchestration.md` + the `/pandacorp:implement` SKILL
   close-out that `phase: release` REQUIRES the DR-085 hardening evidence; reference DR-085.

**Done when:** the engine cannot reach `phase: release` without a security-audit + telemetry-verification
stage having run and left evidence (verified on a repro where the audit is forced to run); plugin MINOR +
`OVERLAY_VERSION` bump (engine changed); then set LESSON-0022 `promotion: approved` and back-link.
