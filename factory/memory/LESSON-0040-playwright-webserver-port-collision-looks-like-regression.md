---
id: LESSON-0040
type: gotcha
domain: testing
tags: [playwright, e2e, port-collision, webServer, reuseExistingServer]
context: running a Playwright e2e suite whose webServer config defaults to a fixed port shared with another process on the same machine
trigger: use this when a Playwright e2e suite fails en masse and more than one project/dev-server may be running on the same machine
source: "personal-page-v2 .pandacorp/run/lessons.md + .pandacorp/comms/progress.md 2026-07-01 close-out — mission-control's own next-server + Playwright run occupied port 3000 during this project's e2e; corroborated by mission-control .pandacorp/run/lessons.md 2026-07-06 (FRD-17 build) — an ORPHANED next dev process blocked verify.sh's own webServer step with Next's 'Another next dev server is already running' even though the reserved port was free; corroborated a THIRD time on mission-control's FRD-23 build (2026-07-07), same orphaned-lock mechanism; corroborated a FOURTH time back on personal-page-v2 (2026-07-06/07, /pandacorp:upgrade + the verify-before-stop gate): a co-located `pnpm run dev` held `.next/dev/lock`, so Playwright's webServer could not boot on ANY port and the whole gate went RED despite 649 green unit/static checks (DR-075); separately, reusing a long-lived dev server (~25 min of accumulated HMR) instead of a fresh boot produced 2 false-red `shell.spec.ts` mobile-nav failures that passed clean on a clean boot — same family of trap, now recurring across BOTH projects with no code-side fix landed (BL-0049 open); corroborated a FIFTH time on personal-page-v2 (2026-07-10, `.pandacorp/run/lessons.md`) — `verify.sh` went RED with the exact 'Another next dev server is already running' message while a live dev server sat on port 4010 (a different port from the reserved e2e port), confirming again this is a process-level lock, not a port-bind failure, and that tests/typecheck/lint all stayed green in the same run; corroborated a SIXTH time on personal-page-v2 (2026-07-12, `.pandacorp/run/lessons.md`) — same 'Another next dev server is already running' RED on port 4010 with a foreign dev server already holding it, same diagnosis, same workaround (`lsof -i :4010` before blaming code); BL-0037/BL-0049 remain open, no code-side fix landed after six occurrences across two projects. Corroborated a SEVENTH/EIGHTH time on personal-page-v2 (2026-09-06, `.pandacorp/run/lessons.md`, harvested 2026-09-07): (a) Next 16 refuses a SECOND `next dev` in the same project directory — confirmed as a PER-DIRECTORY dev lock, not a port clash, so `verify.sh` REDs even when the reserved port is free, matching the process-level-lock mechanism already documented here; (b) a genuinely NEW discriminator/facet — reusing an already-running `next dev` for the e2e gate (`PORT=<devport>` + `reuseExistingServer`) is NOT a safe workaround if that server was started without `--hostname 127.0.0.1` (plain `pnpm dev`) while Playwright connects to `127.0.0.1`: the HMR WebSocket handshake fails (`ERR_INVALID_HTTP_RESPONSE`), the dev client never finishes hydration, and every INTERACTION test fails deterministically (a disabled-until-mounted control like a theme toggle stays disabled; a drawer/Lightbox never opens) while render/smoke tests still pass — a failure signature that looks EXACTLY like a real regression. Discriminator: the same interactions work in a normal browser, and a Playwright probe shows the failed HMR socket; see `factory/memory/LESSON-0197` for the hydration-check diagnostic pattern this produced. (c) `preview_stop` reported the server 'stopped' while the underlying `next-server` process survived and kept holding the lock, RED-ing the NEXT run — confirm the port is actually free (`lsof -nP -iTCP:<port> -sTCP:LISTEN`) after any stop, and check process ancestry before killing anything (a server parented by `Claude.app` is NOT reliably 'this session's own and safe to kill' — the owner can start one through the app too; compare start time against what the owner was doing, not ancestry alone). Corroborated a NINTH time on personal-page-v2 (2026-09-07/08, `.pandacorp/run/lessons.md`) — 25 spurious Playwright failures (smoke/visual/shell/fidelity across every page) fired from verify-before-stop.sh's own HOOK-TRIGGERED verify.sh run, right after 9 clean commits with no source change since the last green gate log (941/941 unit + 150/150 e2e); lsof -i :4010 showed the OWNER's own long-lived pnpm dev squatting the gate's reserved port, silently reused via reuseExistingServer — same mechanism as the earlier occurrences, but this is the first time it fired from an AUTOMATED Stop-hook invocation rather than a manual gate run, meaning the agent could not always tell from the transcript alone that a hook (not a code change) triggered the run. New general diagnostic rule this occurrence sharpens: whenever ANY automated/hook-triggered verify.sh run reports a broad, page-spanning regression immediately after a gate that was green minutes earlier with zero source diff, check lsof -i :<dev_port_base> (or do a clean, isolated re-run) BEFORE touching baselines or code — for this project the false-positive rate on that specific pattern is now 3-for-3. Corroborated a TENTH
time on personal-page-v2 (2026-09-08, `.pandacorp/run/lessons.md`): a `next dev` left running 6h+ degraded
on TWO fronts simultaneously — (a) content-collections' incremental sync silently DROPPED a generated
locale document (`allAboutPages.js` lost its `es` entry, tripping the DR-078 fail-loud reader with a
missing-content error even though the source `.mdx` on disk was correct) and (b) the HMR socket returned
`ERR_INVALID_HTTP_RESPONSE`, the client never hydrated, and 0/15 `.reveal` nodes got `is-visible` (see
LESSON-0197) — together producing 24 `verify.sh` failures spanning EVERY route (visual + smoke + shell),
of which only 2 were real once a freshly-booted server replaced the degraded one. New general rule this
sharpens: a long-lived dev server is not just a port/lock risk, it can also silently corrupt its own
generated-content cache; a gate red that is BOTH broad (many unrelated routes) AND mixed (some content
errors, some hydration errors) is a stronger tell for killing and restarting the dev server than either
symptom alone. Corroborated an ELEVENTH time (2026-09-08, same project): the OWNER's own long-lived `pnpm
dev` on the reserved port 4010 (started in his own terminal, not by this session) was silently reused via
`reuseExistingServer`, producing ~24 e2e failures scattered across unrelated routes (mobile nav, lightbox,
visual diffs) plus a WebSocket webpack-hmr connection-failed console error,
while all 126 purely server-rendered checks still passed (the tell that only the CLIENT runtime is dead);
`lsof -nP -iTCP:4010 -sTCP:LISTEN` identified the foreign process; killing it and re-running went
150/150 green with zero code changes — Next 16 cannot be sidestepped by picking a different port
(`PORT=4011` aborts with an already-running-dev-server error for the same directory), the owner's
server must be stopped first. Corroborated a TWELFTH time (2026-09-10, same project) with the precise
mechanism behind the not-started-with-`--hostname 127.0.0.1` facet above: a reused dev server bound to
`localhost` served HMR/webpack assets, but Playwright navigated via `127.0.0.1` — Next 16's
`allowedDevOrigins` treats `localhost` and `127.0.0.1` as DIFFERENT, cross-origin hosts and blocks dev
requests from the unlisted one (a blocked-cross-origin-request console error for webpack-hmr),
killing HMR and producing ~30 failures across routes untouched by the change. Fix candidate for the
build-orchestration template: `allowedDevOrigins: [127.0.0.1]` in `next.config`, or launch dev with
`--hostname 127.0.0.1` so both parties agree on the same host; the safe workaround without touching the
owner's server is gating from a worktree with its own `PORT=<free-port>` (Playwright boots its own,
same-origin server there). THIRTEENTH corroboration (2026-09-11/12, same project, `.pandacorp/run/lessons.md`,
two related but distinct findings): (a) a full `verify.sh` run mid-session, after hours of heavy background
build activity, crashed the shared Playwright dev webServer partway through the [mobile] e2e project — a
sharp cutover at one specific test, every subsequent test in that browser project returning
`net::ERR_EMPTY_RESPONSE`, the desktop project unaffected; NOT reproducible in isolation (a scoped rerun and
a full standalone e2e rerun both passed 100% clean twice) — root cause confirmed as environmental resource
contention from concurrent build activity, not a code defect, per the debugging rule that a genuine cause
must also explain the NON-failures (isolated reruns had none of that contention and passed clean). New
diagnostic signature: a broad, single-cutover e2e failure (one browser project, every route, right after N
consecutive passes) is as strong a signal of webServer resource exhaustion as of a stale/orphaned process —
rerun in isolation before assuming either a code regression or a lock/port issue. (b) a plain leftover
`node` dev-server process (confirmed via `lsof -i :4010`) held the reserved port with a broken HMR socket;
killing it and rerunning fixed ~23 unrelated failures immediately — the FOURTEENTH corroboration of the
core stale-process mechanism, no new facet beyond confirming the fix again. FOURTEENTH-mechanism corroboration,
2026-09-12 (same project): `merge-queue.sh` itself (the shared template, `plugin/templates/shared/.pandacorp/merge-queue.sh`)
calls `bash .pandacorp/verify.sh` with **no `PORT` override** — when the shared main checkout already has its
own dev server bound to the reserved port (likely with parallel worktree sessions active), Playwright's
`reuseExistingServer: true` silently reused that unrelated server instead of the worktree's own branch,
producing a spray of 27 failures across routes the change never touched; exporting `PORT=<free-port>` before
calling `merge-queue.sh` collapsed the same merge attempt to exactly the 2 routes actually affected. This is
a template-level instance of the same family — tracked as an actionable fix in **BL-0133** (`merge-queue.sh`
should detect the collision and export a free `PORT` itself, not rely on the caller remembering to)."
provenance: agent-inferred
created: 2026-07-03
status: active
promotion: approved   # 2026-09-03 promoted via /pandacorp:learn (proposal 33 §12.4 sitting) → factory/standards/build-orchestration.md#BUILD-3
confidence: medium
times_applied: 3
applied_in: [mission-control, personal-page-v2, panda-corp]
links: [BL-0037, BL-0049, BL-0133, LESSON-0197, LESSON-0185, BUILD-3, factory/standards/build-orchestration.md#BUILD-3]
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
clean isolated re-run before touching baselines/code. This exact failure mode has now recurred FOURTEEN+ times
across two projects (personal-page-v2 ×12+, mission-control ×2) with no code-side fix landed yet — a strong
signal that BL-0049's preflight check is worth prioritizing. Two further discriminators found on the tenth
through twelfth occurrences: a reused server can also silently corrupt a codegen/content cache (not just
HMR/hydration) — a mixed RED (some content errors, some interaction errors) spanning unrelated routes is
as strong a "restart the dev server" signal as a purely-interaction-only failure pattern; and when
`--hostname` is not the direct cause, check whether the reused server was bound to `localhost` while
Playwright navigates via `127.0.0.1` — Next 16's `allowedDevOrigins` treats these as different origins and
blocks dev requests from the unlisted one. Thirteenth/fourteenth occurrences add two more discriminators:
a SHARP, SINGLE-CUTOVER failure (one browser project, every subsequent route, right after several
consecutive clean passes, NOT reproducible in isolation) points to shared-resource exhaustion from
concurrent build activity rather than a stale process or a code regression — verify via an isolated rerun
before concluding either; and `merge-queue.sh` itself needs a `PORT` override before calling `verify.sh`,
or the shared-checkout landing path is exposed to this same class every time a parallel worktree session
has its own dev server up (see BL-0133).
