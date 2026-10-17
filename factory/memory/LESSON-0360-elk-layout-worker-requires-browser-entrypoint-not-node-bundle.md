---
id: LESSON-0360
type: gotcha
domain: graph-visualization
tags: [elkjs, web-worker, bundling, browser-vs-node, next.js]
context: running the ELK graph-layout library's bundled adapter inside a browser Web Worker in a Next.js app
trigger: use this when integrating elkjs (or a similar library that ships both a Node and a browser/worker build) into a browser Web Worker
source: "factory/memory/_inbox.md agent-inferred note — Mission Control, 2026-10-16: ELK's bundled adapter passed Node-targeted layout tests but hit its document/self environment-detection branch inside a browser worker and failed with 'Worker is not a constructor'"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** ELK's bundled adapter passed every layout test run under Node (the test environment), but
failed at runtime inside the actual browser Web Worker with `_Worker is not a constructor` — the bundle
branches internally on whether `document`/`self` look like a Node or a browser environment, and the branch
it picked under test (Node) was never exercised against the real browser worker boundary.

**Lesson:** a library shipping one "universal" bundled adapter that branches on environment detection can
pass every test run in the WRONG environment (Node) while being fundamentally broken in the REAL target
environment (a browser Worker) — green Node tests are not evidence the browser-worker code path works at
all.

**Apply next time:** when a layout/graph library needs to run inside a browser Worker, use its thin
API-only package (e.g. `elk-api`) paired with the library's actual algorithm worker script, rather than its
bundled "works everywhere" adapter. Because a worker implemented as a Node-style fake has no real
`terminate()`, guard any native-disposal call-site. Verify the integration against BOTH the real Next.js
dev-server boundary and a production browser build — not just a Node-run unit test — before trusting it.
