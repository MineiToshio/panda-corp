---
id: LESSON-0066
type: anti-pattern
domain: testing
tags: [playwright, networkidle, domcontentloaded, e2e-hygiene, flake]
context: "a Playwright e2e spec uses `waitUntil: \"networkidle\"` while sibling specs in the same suite use `domcontentloaded` + explicit assertions, OR the target app keeps a live connection open by design (SSE/WebSocket)"
trigger: use this when writing or reviewing a Playwright spec's navigation `waitUntil` option, especially in a suite that may run under a shared/contended webServer (merge queue, CI), or when the app under test keeps an SSE/WebSocket connection permanently open
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-03 — e2e/home-fidelity.spec.ts flaked once under the shared merge-queue webServer, passed clean in isolation seconds later. Corroborated on a DIFFERENT project (mission-control, .pandacorp/run/lessons.md 2026-10, agent-inferred): Mission Control's served app keeps a live SSE connection open for its real-time telemetry panel, so `waitUntil: \"networkidle\"` never resolves at all against it — a deterministic hang, not a contention flake."
provenance: agent-inferred
created: 2026-07-04
status: active
promotion: none
confidence: medium
times_applied: 1
applied_in: [mission-control]
links: [LESSON-0040, LESSON-0185]
---

**Situation:** one spec in an otherwise-consistent e2e suite used `waitUntil: "networkidle"` (against the
project's own documented "domcontentloaded, NOT networkidle" e2e-hygiene rule the other specs already
followed). It flaked once when run under the shared merge-queue webServer (contended with other
network/dev-server activity) and passed cleanly in isolation seconds later.

**Lesson:** `networkidle` waits for a quiet-network heuristic that becomes unreliable the moment the
page (or the shared host machine) has ANY ongoing background network activity — exactly the condition a
shared/contended webServer (merge queue, CI, parallel dev servers) creates. A suite that is otherwise
consistent about avoiding `networkidle` in favor of `domcontentloaded` + explicit element/state
assertions has effectively already learned this; a lone straggler spec re-introduces the same flake
class. This compounds LESSON-0040 (port collision under shared webServer) as another way a shared test
environment produces symptoms that look like a regression.

**Apply next time:** grep a Playwright suite for `networkidle` before trusting its stability under a
shared/CI webServer; migrate any straggler to `domcontentloaded` + an explicit assertion (element
visible, network response, app-specific ready signal) matching the suite's own established convention.

**Second mechanism (2026-10, mission-control, DIFFERENT project — eval-gate corroboration):** an app
that intentionally keeps a connection open for its whole lifetime (SSE for live telemetry, a WebSocket
for live updates) makes `networkidle` not just flaky but structurally unable to resolve at all against
that app — there is never a quiet-network moment to detect. Before picking `waitUntil` for ANY app,
check whether it opens a long-lived connection by design; if so, `networkidle` is categorically wrong,
not just risky, and `domcontentloaded` + an explicit selector/ready-signal wait is the only correct
choice.
