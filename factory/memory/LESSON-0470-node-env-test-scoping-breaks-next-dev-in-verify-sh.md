---
id: LESSON-0470
type: gotcha
domain: build-orchestration
tags: [node-env, verify-sh, nextjs, vitest, dev-server, type-generation]
context: a `verify.sh` browser/e2e lane that starts a Next.js dev server alongside Vitest-based tests, and the temptation to set one blanket `NODE_ENV` for the whole lane
trigger: use this when configuring a verify.sh (or similar combined gate) lane that both runs Vitest AND starts a Next.js dev server in the same process/shell scope
provenance: agent-inferred
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-20 (agent-inferred)"
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0433]
---

**Situation:** `verify.sh`'s browser lane set `NODE_ENV=test` around its ENTIRE scope, including the
Next.js dev server it started. Vitest already selects its own test environment regardless of
`NODE_ENV`, but Next dev needs the standard `development` value — with `NODE_ENV=test` forced, Next
16.4's type generation added an unexpected `.next/dev/dev` types path, and the server's own generated
config drifted from its normal development output.

**Lesson:** `NODE_ENV` is a single global knob shared by every process in the same shell scope; a
test runner (Vitest) and an app dev server (Next) can need DIFFERENT values at the same time, and
forcing one blanket value for a whole combined gate lane silently changes the OTHER tool's behavior
(here, type-generation paths) even though that tool is not the one being tested.

**Apply next time:** scope `NODE_ENV` (and similar environment-mode variables) to the SPECIFIC
process that needs a non-default value, not the whole gate/lane — let Vitest select its own test
environment independently, and let Next dev run under standard `development`. After the server
stops, restore only the generated config delta this run's own process actually produced (verified,
not assumed) rather than leaving a `NODE_ENV`-induced side effect in place.
