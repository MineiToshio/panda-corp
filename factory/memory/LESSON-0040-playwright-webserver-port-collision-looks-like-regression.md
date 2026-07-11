---
id: LESSON-0040
type: gotcha
domain: testing
tags: [playwright, e2e, port-collision, webServer, reuseExistingServer]
context: running a Playwright e2e suite whose webServer config defaults to a fixed port shared with another process on the same machine
trigger: use this when a Playwright e2e suite fails en masse and more than one project/dev-server may be running on the same machine
source: "personal-page-v2 .pandacorp/run/lessons.md + .pandacorp/comms/progress.md 2026-07-01 close-out — mission-control's own next-server + Playwright run occupied port 3000 during this project's e2e; corroborated by mission-control .pandacorp/run/lessons.md 2026-07-06 (FRD-17 build) — an ORPHANED next dev process blocked verify.sh's own webServer step with Next's 'Another next dev server is already running' even though the reserved port was free; corroborated a THIRD time on mission-control's FRD-23 build (2026-07-07), same orphaned-lock mechanism; corroborated a FOURTH time back on personal-page-v2 (2026-07-06/07, /pandacorp:upgrade + the verify-before-stop gate): a co-located `pnpm run dev` held `.next/dev/lock`, so Playwright's webServer could not boot on ANY port and the whole gate went RED despite 649 green unit/static checks (DR-075); separately, reusing a long-lived dev server (~25 min of accumulated HMR) instead of a fresh boot produced 2 false-red `shell.spec.ts` mobile-nav failures that passed clean on a clean boot — same family of trap, now recurring across BOTH projects with no code-side fix landed (BL-0049 open); corroborated a FIFTH time on personal-page-v2 (2026-07-10, `.pandacorp/run/lessons.md`) — `verify.sh` went RED with the exact 'Another next dev server is already running' message while a live dev server sat on port 4010 (a different port from the reserved e2e port), confirming again this is a process-level lock, not a port-bind failure, and that tests/typecheck/lint all stayed green in the same run."
provenance: agent-inferred
created: 2026-07-03
status: active
promotion: proposed   # 2026-07-07 (librarian review) — target factory/standards/build-orchestration.md (verify.sh e2e preflight): recurred 3x across 2 distinct projects (personal-page-v2, mission-control x2) with no code-side fix; codify "check for orphaned dev-server lock + port collision before trusting a webServer failure as a regression" as a standing MUST, pending BL-0037/BL-0049
confidence: medium
times_applied: 1
applied_in: [mission-control]
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
lock) for the proposed build-engine preflight fixes. This exact failure mode has now recurred FIVE times
across two projects (personal-page-v2 ×3, mission-control ×2) with no code-side fix landed yet — a strong
signal that BL-0049's preflight check is worth prioritizing.
