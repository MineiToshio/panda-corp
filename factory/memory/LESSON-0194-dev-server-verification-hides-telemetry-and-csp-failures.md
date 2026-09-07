---
id: LESSON-0194
type: gotcha
domain: testing
tags: [telemetry, csp, next-dev, verification, production-parity]
context: verifying that analytics/telemetry events fire correctly, or that a CSP-sensitive code path works, using `next dev` (directly, or via an e2e suite whose Playwright webServer boots dev)
trigger: use this when a gate/verification for analytics instrumentation or a CSP-gated code path runs only against `next dev`
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-06, 'Telemetría: verificar en dev no es verificar' session (agent-inferred)"
provenance: agent-inferred
created: 2026-09-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0193, LESSON-0195]
---

**Situation:** a telemetry audit run against `next dev` looked clean, but real ingestion showed gaps. Root
causes: (a) a `capture()` call on an uninitialized analytics SDK is dropped SILENTLY, and if the wrapper
wraps the call in try/catch, neither an error nor an event results — a unit-tested helper with a green
test can emit nothing at runtime; (b) `next dev`'s React Strict Mode duplicates mount effects (inflating
apparent event counts) and dev's CSP is looser than production's, so a page broken in prod renders fine in
dev; (c) a missing event can mean the PAGE never mounted, not that the instrumentation itself is broken;
(d) an e2e gate whose Playwright `webServer` boots `next dev` never exercises the production CSP at all —
a `script-src` missing `'unsafe-eval'` can break a client runtime (e.g. `new Function`-based MDX
compilation) while the gate stays green throughout.

**Lesson:** `next dev` is not evidence for telemetry correctness OR CSP-gated behavior — it systematically
hides both classes of production-only failure (a permissive CSP, duplicated Strict Mode effects).
Verifying "in dev" is not verifying either concern.

**Apply next time:** verify telemetry and any CSP-sensitive code path against `next build` + `next start`
(or the actual deployed artifact), never `next dev` alone. Before touching a telemetry wrapper over a
missing event, first confirm the component that calls `track*` actually mounts. Treat a green e2e gate
that runs only against `next dev` as blind to production CSP violations — route anything CSP-sensitive
through (or add) a production-build verification step.
