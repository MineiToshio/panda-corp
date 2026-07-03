---
id: LESSON-0040
type: gotcha
domain: testing
tags: [playwright, e2e, port-collision, webServer, reuseExistingServer]
context: running a Playwright e2e suite whose webServer config defaults to a fixed port shared with another process on the same machine
trigger: use this when a Playwright e2e suite fails en masse and more than one project/dev-server may be running on the same machine
source: "personal-page-v2 .pandacorp/run/lessons.md + .pandacorp/comms/progress.md 2026-07-01 close-out — mission-control's own next-server + Playwright run occupied port 3000 during this project's e2e"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** Playwright's e2e `webServer` defaults to port 3000 (`playwright.config.ts`). A sibling
project's own dev server was already listening there; `reuseExistingServer` silently reused it, so every
e2e test in this project ran against the WRONG app and failed en masse — looking exactly like a mass
regression. Confirmed twice: once via the raw lesson note, once again during the project's final
cross-feature close-out gate run, resolved by re-running on the project's reserved port (`PORT=4010`)
in isolation, which passed clean (56/56).

**Lesson:** a Playwright e2e suite that fails broadly right after passing cleanly (or that fails in a way
inconsistent with the actual diff) should raise suspicion of a port collision with an unrelated sibling
process BEFORE the failure is diagnosed as a real regression — `reuseExistingServer` makes the collision
silent (no bind-error, just the wrong app answering).

**Apply next time:** pass an explicit, project-reserved `PORT=<free-port>` to the verify/merge-queue
script (each project should own a reserved port block, per `factory/ports.yaml`) to rule out cross-project
port collision before investigating a suspicious mass e2e failure as a genuine regression.
