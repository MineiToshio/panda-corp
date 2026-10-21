---
id: LESSON-0481
type: gotcha
domain: validation
tags: [zod, zod4, csp, jitless, instrumentation-client, capability-probe]
context: browser-side Zod schema startup under a production CSP that excludes unsafe-eval
trigger: use this when a production page reports script-src blocked eval while Zod validation and hydration still appear to work
source: "funko-tracker 2026-10-21: branded-email csp-counterexample.json and live-baseline-csp.json under .pandacorp/run/branded-email/; funko-tracker-branded-email/.pandacorp/run/branded-email/csp-diagnosis.json; funko-tracker-csp-validation commit b27603a257c21fa88f2768ecf2a2c9844674b6e3, src/lib/validation/_tests/browserConfiguration.test.ts and .pandacorp/run/csp-validation/{red,green,focused}.log; installed zod 4.6.5 src/v4/core/util.ts allowsEval and core.ts jitless config"
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0193, LESSON-0194]
---

**Situation:** a production-browser gate found `script-src blocked eval` on a hydrated page. The same
observer accepted a strict-CSP static counterexample, and navigation without the observer reproduced the
violation. Its emitted app-chunk location resolved to Zod's `Function("")` capability probe. The already
deployed baseline also reported eval before the unrelated email change. Installed Zod **4.6.5** catches
the probe's exception and falls back, so an absence of page errors or successful parsing did not prove
an absence of CSP violations.

**Lesson:** a dependency can violate CSP merely by probing dynamic-code support, even when its fallback
works. In the inspected Zod version, `allowsEval` checks `globalConfig.jitless` before attempting the
probe, and `config({ jitless: true })` disables this path. Configure it before any browser schema
construction; the project's fix imports a configuration module first from Next.js
`instrumentation-client.ts`, before its environment module constructs schemas. Inspect the installed
version and its initialization order rather than assuming every Zod release behaves identically.

**Apply next time:** distinguish a caught capability probe from required runtime compilation by locating
the browser violation in the emitted chunk and dependency source. Keep the existing CSP and configure
Zod's supported interpreter mode early. Exercise the actual startup entry and real schemas in a fresh
process with a counting, throwing `Function` proxy: require **zero attempts**, alongside valid and invalid
input assertions. Here the old entry failed with one attempt, the configured entry passed with zero,
and the focused suite passed 24 tests. This synthetic regression proof does **not** replace a production
browser rerun: browser/full-gate validation of the fix was still pending at harvest. Unlike the MDX
case in LESSON-0193, moving all validation server-side or allowing unsafe-eval is not the evidenced fix.
