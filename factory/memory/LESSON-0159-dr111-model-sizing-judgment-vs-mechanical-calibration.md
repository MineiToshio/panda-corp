---
id: LESSON-0159
type: pattern
domain: build-orchestration
tags: [dr-111, subagent-sizing, model-tiering, orchestration]
context: an orchestrator dispatching a wave of independent QA/fix batches must decide, per batch, whether it needs a judgment-tier or a mechanical-tier subagent (DR-111/CONV-12)
trigger: use this when sizing a batch of parallel work-order/fix batches under DR-111 and deciding which ones need the judgment tier vs the mechanical tier
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-12 (agent-inferred) — a nine-batch full-site QA overhaul sized each batch independently per DR-111; opus was used for judgment-heavy batches (error-boundary/net design, blog DOM/slug architecture decisions, real focus-trap implementation, client-side navigation architecture) and sonnet for mechanical/scoped ones (CSS token swaps, component dedup, copy localization, contact-form hardening); no batch needed escalation mid-run"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** DR-111/CONV-12 requires computing a subagent's model tier from the SUBTASK's complexity, not
inheriting the parent's tier. Doing this well requires a concrete sense of which QA/fix batches are
"judgment-heavy" vs "mechanical" — the policy states the rule but not the classification.

**Lesson:** a working, concrete split observed across nine independent QA-fix batches in one session:
- **Judgment-heavy (escalate to the JUDGE tier):** designing an error-boundary/error-net architecture from
  scratch (root vs locale-level not-found/global-error), a DOM/slug architecture decision for blog content
  (build-time heading-id stamping shared between server compile and client TOC), implementing a REAL focus
  trap (not just adding ARIA attributes), and redesigning client-side navigation semantics (when a route
  change should be a full document nav vs a client transition).
- **Mechanical (STANDARD tier is enough):** CSS design-token swaps (contrast fixes), removing duplicated
  components byte-for-byte, localizing copy/aria-labels through existing i18n plumbing, and hardening an
  existing form with a bounded, well-specified change (add a fetch timeout, wrap an existing status in
  `role="alert"`, single-source a constant).
The dividing line in practice was not "how many files changed" but "does this batch require inventing a new
architecture/contract, or does it apply an existing one consistently" — the former needed judgment, the
latter did not, and none of the mechanical-tier batches needed mid-run escalation.

**Apply next time:** when sizing a wave of QA/fix batches, ask "does this batch invent a new contract/
architecture, or consistently apply an existing one?" — the former routes to the JUDGE tier, the latter to
STANDARD. Escalate upward only if a STANDARD-tier batch turns out to require an architectural decision
mid-run; never downgrade a batch already identified as inventing a contract.
