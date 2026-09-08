---
id: LESSON-0040
type: gotcha
domain: testing
tags: [playwright, e2e, port-collision, webServer, reuseExistingServer]
context: running a Playwright e2e suite whose webServer config defaults to a fixed port shared with another process on the same machine
trigger: use this when a Playwright e2e suite fails en masse and more than one project/dev-server may be running on the same machine
source: "personal-page-v2 .pandacorp/run/lessons.md + .pandacorp/comms/progress.md 2026-07-01 close-out — mission-control's own next-server + Playwright run occupied port 3000 during this project's e2e; corroborated by mission-control .pandacorp/run/lessons.md 2026-07-06 (FRD-17 build) — an ORPHANED next dev process blocked verify.sh's own webServer step with Next's 'Another next dev server is already running' even though the reserved port was free; corroborated a THIRD time on mission-control's FRD-23 build (2026-07-07), same orphaned-lock mechanism; corroborated a FOURTH time back on personal-page-v2 (2026-07-06/07, /pandacorp:upgrade + the verify-before-stop gate): a co-located `pnpm run dev` held `.next/dev/lock`, so Playwright's webServer could not boot on ANY port and the whole gate went RED despite 649 green unit/static checks (DR-075); separately, reusing a long-lived dev server (~25 min of accumulated HMR) instead of a fresh boot produced 2 false-red `shell.spec.ts` mobile-nav failures that passed clean on a clean boot — same family of trap, now recurring across BOTH projects with no code-side fix landed (BL-0049 open); corroborated a FIFTH time on personal-page-v2 (2026-07-10, `.pandacorp/run/lessons.md`) — `verify.sh` went RED with the exact 'Another next dev server is already running' message while a live dev server sat on port 4010 (a different port from the reserved e2e port), confirming again this is a process-level lock, not a port-bind failure, and that tests/typecheck/lint all stayed green in the same run; corroborated a SIXTH time on personal-page-v2 (2026-07-12, `.pandacorp/run/lessons.md`) — same 'Another next dev server is already running' RED on port 4010 with a foreign dev server already holding it, same diagnosis, same workaround (`lsof -i :4010` before blaming code); BL-0037/BL-0049 remain open, no code-side fix landed after six occurrences across two projects. Corroborated a SEVENTH/EIGHTH time on personal-page-v2 (2026-09-06, `.pandacorp/run/lessons.md`, harvested 2026-09-07): (a) Next 16 refuses a SECOND `next dev` in the same project directory — confirmed as a PER-DIRECTORY dev lock, not a port clash, so `verify.sh` REDs even when the reserved port is free, matching the process-level-lock mechanism already documented here; (b) a genuinely NEW discriminator/facet — reusing an already-running `next dev` for the e2e gate (`PORT=<devport>` + `reuseExistingServer`) is NOT a safe workaround if that server was started without `--hostname 127.0.0.1` (plain `pnpm dev`) while Playwright connects to `127.0.0.1`: the HMR WebSocket handshake fails (`ERR_INVALID_HTTP_RESPONSE`), the dev client never finishes hydration, and every INTERACTION test fails deterministically (a disabled-until-mounted control like a theme toggle stays disabled; a drawer/Lightbox never opens) while render/smoke tests still pass — a failure signature that looks EXACTLY like a real regression. Discriminator: the same interactions work in a normal browser, and a Playwright probe shows the failed HMR socket; see `factory/memory/LESSON-0197` for the hydration-check diagnostic pattern this produced. (c) `preview_stop` reported the server 'stopped' while the underlying `next-server` process survived and kept holding the lock, RED-ing the NEXT run — confirm the port is actually free (`lsof -nP -iTCP:<port> -sTCP:LISTEN`) after any stop, and check process ancestry before killing anything (a server parented by `Claude.app` is NOT reliably 'this session's own and safe to kill' — the owner can start one through the app too; compare start time against what the owner was doing, not ancestry alone). Corroborated a NINTH time on personal-page-v2 (2026-09-07/08, `.pandacorp/run/lessons.md`) — 25 spurious Playwright failures (smoke/visual/shell/fidelity across every page) fired from verify-before-stop.sh's own HOOK-TRIGGERED verify.sh run, right after 9 clean commits with no source change since the last green gate log (941/941 unit + 150/150 e2e); lsof -i :4010 showed the OWNER's own long-lived pnpm dev squatting the gate's reserved port, silently reused via reuseExistingServer — same mechanism as the earlier occurrences, but this is the first time it fired from an AUTOMATED Stop-hook invocation rather than a manual gate run, meaning the agent could not always tell from the transcript alone that a hook (not a code change) triggered the run. New general diagnostic rule this occurrence sharpens: whenever ANY automated/hook-triggered verify.sh run reports a broad, page-spanning regression immediately after a gate that was green minutes earlier with zero source diff, check lsof -i :<dev_port_base> (or do a clean, isolated re-run) BEFORE touching baselines or code — for this project the false-positive rate on that specific pattern is now 3-for-3."
provenance: agent-inferred
created: 2026-07-03
status: active
promotion: approved   # 2026-09-03 promoted via /pandacorp:learn (proposal 33 §12.4 sitting) → factory/standards/build-orchestration.md#BUILD-3
confidence: medium
times_applied: 1
applied_in: [mission-control]
links: [BL-0037, BL-0049, LESSON-0185, BUILD-3, factory/standards/build-orchestration.md#BUILD-3]
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
error can fire even on a free port. If reusing an already-running dev server for the gate (rather than
booting fresh), confirm it was started with `--hostname 127.0.0.1` — otherwise Playwright's HMR WebSocket
handshake can fail silently and produce interaction-test-only failures indistinguishable from a real
regression (see the SEVENTH occurrence above). After stopping any preview/dev server, verify the port is
actually free with `lsof` rather than trusting a "stopped" report, and judge process ancestry by start
time relative to owner activity, not by parent process alone. See BL-0037 (foreign port occupant) and
BL-0049 (orphaned same-project lock) for the proposed build-engine preflight fixes. Also apply this same
check when the failure fires from an AUTOMATED/hook-triggered `verify.sh` run (e.g. `verify-before-stop.sh`)
rather than a manual invocation — a broad, page-spanning regression reported immediately after a gate that
was green minutes earlier with zero source diff is the signature; check `lsof -i :<dev_port_base>` or do a
clean isolated re-run before touching baselines/code. This exact failure mode has now recurred NINE times
across two projects (personal-page-v2 ×7, mission-control ×2) with no code-side fix landed yet — a strong
signal that BL-0049's preflight check is worth prioritizing.
