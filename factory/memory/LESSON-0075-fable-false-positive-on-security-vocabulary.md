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

**Contradiction flagged 2026-09-07 (librarian review) — NOT reconciled, needs owner/further check.** This
lesson (2026-07-05) calls "Fable-class" the CHEAP/fast tier that fell back to the more expensive Opus.
The current tier terminology (`factory/standards/agent-portability.md`, DR-111/CONV-12,
`factory/standards/conventions.md:51`) instead names **Fable as the MOST expensive tier** ("never
auto-selected... owner request only"), separate from and above haiku/sonnet/opus. Either the "Fable"
codename was repurposed/renamed across a model-era transition (see the 2026-09-02 model-era-audit sprint,
proposal 33/36) and this lesson's tier label is now stale terminology while its underlying finding
(a safety classifier can false-positive on the factory's own security-adjacent vocabulary and silently
force an escalation to a costlier tier) likely still holds under whatever tier plays that "cheap" role
today — or the two docs are describing genuinely different things and are not in conflict. Left as
`status: candidate`, not deprecated/edited further; flagging only, per DR-047 (reconcile, never erase).

**Reconciled 2026-11-13 (librarian review, scheduled sweep).** Confirmed from the canonical text
(`factory/standards/agent-portability.md` PORT-2, re-checked live this pass): Fable today names
Claude's MOST expensive tier, never auto-selected — the opposite of the cheap/fast role this lesson's
2026-07-05 finding described. This is a confirmed terminology drift across the model-era transition
(proposal 33/36), not a conflicting claim about the same thing — so the two docs are not actually in
tension once read with their own era's vocabulary. The underlying finding stands and generalizes:
**whichever tier plays the cheap/fast delegation role at the time** can have a safety classifier that
false-positives on the factory's own defensive-security vocabulary ("command gate", "hardening",
"offensive security") and silently falls back to a costlier tier. Treat "Fable" in this lesson's body as
a dated codename, not a live tier name — re-verify against the current `agent-portability.md` tier
table before acting on it. Not re-tested on a current cheap tier this pass (no live repro available);
left `status: candidate` pending that corroboration.
