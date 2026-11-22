---
id: LESSON-0692
type: library-verdict
domain: nextjs
tags: [next16, security-advisory, ci, build, ghsa]
context: running `next build` with a Next.js 16.4.x release that has an open security advisory affecting the AI-agent-detection path
trigger: use this when `next build` aborts locally (or in a Codex/Claude agent session) with a SecurityFatalError, but the exact same build succeeds in Vercel's own CI
source: "funko-tracker .pandacorp/run/lessons.md, 2026-11 (agent-inferred); fix applied in commit b5ea3e55 'fix(deps): upgrade Next.js to 16.4.5 for GHSA-mfr8-8qww-v76h and close native no-JS GET visibility (review P2)'. FLAGGED DISCREPANCY, not merged (DR-047 — reconcile, never overwrite): a second, narrower instance (pandasaga, factory/memory/_inbox.md 2026-11-21, `/pandacorp:upgrade` 8.98.0->9.9.5, agent-inferred) reports the OPPOSITE practical outcome on Next 16.4.0 — the first full `next build` during the upgrade went RED once on this same SecurityFatalError-class nudge (its own message reportedly said 'retry the same command to continue'), then the IDENTICAL command succeeded with only a warning on a bare retry, with NO version change. This directly contradicts this lesson's 'retrying... wastes time; the fix is the advisory's own remediation' framing, at least for whatever narrower nudge shape fired there. Not reconciled: it is unconfirmed whether 16.4.0 vs. 16.4.x, a different/lower-severity advisory, or a non-agent-driven invocation explains the diverging behavior. Treat BOTH reports as true for their own observed version/context until someone reproduces both paths side by side; do not generalize either one past its own evidence."
provenance: agent-inferred
created: 2026-11-18
status: candidate
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** `next build` aborted with a `SecurityFatalError` under Next.js 16.4.x, but only when run
from an AI-agent tool invocation (Codex/Claude Code); the identical build succeeded unmodified in
Vercel's own CI pipeline for the same commit.

**Lesson:** Next's CLI deliberately refuses to build when it detects it is being driven by an AI agent
AND the installed version has a known, unpatched npm security advisory (here GHSA-mfr8-8qww-v76h) — this
is intentional defense-in-depth triggered by the combination of "agent-detected" + "vulnerable version",
not a false CI/local mismatch and not a bug in the agent's invocation. Vercel's CI is unaffected because
it is not agent-driven. Treating the abort as an environment/tooling problem (retrying, changing how the
command is invoked) wastes time; the fix is the advisory's own remediation.

**Apply next time:** when `next build` SecurityFatalErrors specifically under an agent-driven invocation
while the same build passes ordinary CI, check the installed Next.js version against currently open
GHSA advisories for Next.js before assuming an environment bug — upgrade to the patched version named by
the advisory (here, 16.4.1 → 16.4.5 for GHSA-mfr8-8qww-v76h) rather than working around the detection.

**Open discrepancy (2026-11-21, pandasaga, unreconciled):** a different report on Next 16.4.0 says the
SAME class of SecurityFatalError-style nudge fired once during `/pandacorp:upgrade`'s first `next build`
and then resolved on a plain retry (warning only, no version bump). Before assuming either "retry fixes
it" or "only an upgrade fixes it" is universally true, check which specific advisory/nudge is firing and
at which exact Next.js patch version — the two reports may describe genuinely different mechanisms (a hard
security block vs. a one-time confirmation nudge) rather than one being wrong.
