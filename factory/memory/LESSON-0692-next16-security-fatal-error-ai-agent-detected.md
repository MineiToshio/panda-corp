---
id: LESSON-0692
type: library-verdict
domain: nextjs
tags: [next16, security-advisory, ci, build, ghsa]
context: running `next build` with a Next.js 16.4.x release that has an open security advisory affecting the AI-agent-detection path
trigger: use this when `next build` aborts locally (or in a Codex/Claude agent session) with a SecurityFatalError, but the exact same build succeeds in Vercel's own CI
source: "funko-tracker .pandacorp/run/lessons.md, 2026-11 (agent-inferred); fix applied in commit b5ea3e55 'fix(deps): upgrade Next.js to 16.4.5 for GHSA-mfr8-8qww-v76h and close native no-JS GET visibility (review P2)'"
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
