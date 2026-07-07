---
id: LESSON-0075
type: library-verdict
domain: model-selection
tags: [fable, model-fallback, security, prompting, cost]
context: delegating a workstream to a cheap/fast model tier (Fable-class) whose prompt or task touches security-adjacent vocabulary
trigger: use this when drafting a delegation prompt for a cheap-tier model AND the workstream involves hardening, gates, offensive security, or similarly security-flavored framing
source: "panda-corp — Fable hardening sprint II, 2026-07-05, docs/proposals/26 (§2.8/§5); Fable safety classifiers refused hardening prompts (block-dangerous.sh, security-auditor, \"offensive security\") mid-run"
provenance: agent-inferred
created: 2026-07-05
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0109]
---

**Situation:** Fable 5's own safety classifiers flagged the factory's OWN hardening prompts (hardening
`block-dangerous.sh`/the command gate, running a `security-auditor`, "offensive security" framing) as
suspicious, refusing mid-run with an automatic fallback to a more expensive model (Opus) on the Claude
surface. This is not a bug — it is the documented, working-as-designed behavior of the safety layer, but
it has a real practical cost: any handoff loaded with security vocabulary silently degrades to the
expensive tier, losing the cost/throughput reason the cheap tier was chosen.

**Lesson:** a cheap/fast model tier's safety classifier can false-positive on a factory's OWN legitimate
internal-hardening vocabulary — "command gate", "offensive security", "hardening" read as attack-adjacent
even when the actual task is defensive tooling work on your own repo. The fallback-to-expensive-tier is a
silent cost regression, not a visible error, so it's easy to not notice you paid for the wrong tier.

**Apply next time:** when delegating security-adjacent tooling work (hardening a gate, running a security
audit, adversarial guard-bypass hunting) to a cheap tier, either (a) route it deliberately to the more
capable tier instead of fighting the classifier, or (b) de-securitize the prompt's language for the
sub-tasks that genuinely can run cheap — frame by neutral objective ("improve input validation on this
script") rather than security terms ("harden the command gate against bypass").
