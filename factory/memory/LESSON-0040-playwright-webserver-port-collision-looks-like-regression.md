---
id: LESSON-0040
type: gotcha
domain: testing
tags: [playwright, e2e, port-collision, webServer, reuseExistingServer]
context: running a Playwright e2e suite whose webServer config defaults to a fixed port shared with another process on the same machine
trigger: use this when a Playwright e2e suite fails en masse and more than one project/dev-server may be running on the same machine
source: "personal-page-v2 .pandacorp/run/lessons.md + .pandacorp/comms/progress.md 2026-07-01 close-out — mission-control's own next-server + Playwright run occupied port 3000 during this project's e2e; corroborated by mission-control .pandacorp/run/lessons.md 2026-07-06 (FRD-17 build) — an ORPHANED next dev process blocked verify.sh's own webServer step with Next's 'Another next dev server is already running' even though the reserved port was free"
provenance: agent-inferred
created: 2026-07-03
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0037, BL-0049]
---

**Situation:** Playwright's e2e `webServer` defaults to port 3000 (`playwright.config.ts`). A sibling
project's own dev server was already listening there; `reuseExistingServer` silently reused it, so every
e2e test in this project ran against the WRONG app and failed en masse — looking exactly like a mass
regression. Confirmed twice: once via the raw lesson note, once again during the project's final
cross-feature close-out gate run, resolved by re-running on the project's reserved port (`PORT=4010`)
in isolation, which passed clean (56/56). A second, distinct trap was later confirmed on Mission Control's
FRD-17 build: an ORPHANED `next dev` process (left running from an earlier session, e.g. a Preview
dev-server) blocked a fresh `verify.sh` run with Next.js's OWN lock error — even though the reserved port
was completely free. Next's dev-server lock is process-level, not port-level, so a port check alone does
not catch it.

**Lesson:** a Playwright e2e suite (or `verify.sh`'s webServer step) that fails broadly, or with an
ambiguous "another dev server is already running" message, has (at least) two independent, similarly-
disguised causes to rule out before it is diagnosed as a real regression: (1) **port collision** — a
DIFFERENT process (often a sibling project) already answering on the shared port, silently reused via
`reuseExistingServer`; (2) **orphaned same-project lock** — a stray `next dev` process from a previous
session (Preview, an aborted verify run) tripping Next's own dev-server lock regardless of which port is
free. Both look like a code regression; neither is caught by generic port-bind checks alone.

**Apply next time:** pass an explicit, project-reserved `PORT=<free-port>` to the verify/merge-queue
script (each project should own a reserved port block, per `factory/ports.yaml`) to rule out cross-project
port collision; ADDITIONALLY, before trusting a Playwright webServer failure as a real regression, check
for and clear any orphaned `next dev` process for THIS project (`ps`/lock-file check), since Next's lock
error can fire even on a free port. See BL-0037 (foreign port occupant) and BL-0049 (orphaned same-project
lock) for the proposed build-engine preflight fixes.
