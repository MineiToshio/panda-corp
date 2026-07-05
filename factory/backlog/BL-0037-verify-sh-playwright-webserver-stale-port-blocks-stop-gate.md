---
id: BL-0037
type: bug
area: templates
title: "stack-a-nextjs verify.sh Playwright webServer on a fixed port fails the Stop gate with a stale-server error, not a code error"
status: open
severity: p2
opened: 2026-07-04
closed:
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-03 — a left-over preview dev server on :4010 made the Stop gate fail ('Another next dev server is already running'), masquerading as a code failure"
closes:
links: []
---

## Problem
`stack-a-nextjs`'s `e2e/playwright.config.ts` webServer binds to the project's reserved port (e.g. 4010)
and, in the no-`server-env.json` local case, sets `reuseExistingServer: !isCI` (true locally). When a
PRIOR preview/dev-server session on that same port was left running (e.g. from an interactive preview
tool, not from Playwright itself, or from an earlier aborted verify run), the webServer step can fail
with an ambiguous "Another next dev server is already running" error. Because this happens inside
`verify.sh`/the Stop gate, it reads exactly like a real code failure — the agent (or the enforcement
hook) has no cheap signal that the actual cause is a stale port occupant, not a regression. Found and
worked around manually on personal-page-v2.

## Root cause
The webServer config neither detects "the thing on this port is a leftover/foreign process, not a
reusable dev server I should trust" nor fails with an actionable message distinguishing "collision with a
stale/foreign process" from "collision with a real code error surfaced during boot". `reuseExistingServer`
is a blunt boolean: it either always reuses whatever answers on the port, or never does — there's no
freshness/ownership check in between.

## Fix plan
1. In `verify.sh` (`plugin/templates/stack-a-nextjs/verify.sh`), before invoking Playwright, add a
   preflight check on the project's reserved e2e port: if something is listening, verify it responds like
   the project's own app (e.g. hit a known route/health signal) — if it doesn't, fail fast with an
   actionable message ("port <N> is occupied by an unrelated process; free it before running verify"),
   rather than letting Playwright's webServer step produce its generic ambiguous error.
2. Consider whether the Stop-gate hook's error-attribution logic (already lesson-adjacent to
   LESSON-0005/BL-0005 "foreign red basename attribution") should special-case this Playwright webServer
   message so it's reported as an environment/port issue, not a code regression, when it re-surfaces.
Files: `plugin/templates/stack-a-nextjs/verify.sh`, possibly the Stop-gate hook's failure-classification
logic (check `plugin/hooks/` for where gate failures get attributed).

## Tests (prove the fix — TDD, RED → GREEN)
- **Stale-port detection (script assertion):** start an unrelated dummy server on the project's reserved
  e2e port, then run `verify.sh` — it must fail FAST with a message naming the port-collision cause,
  before Playwright's webServer timeout/generic error is reached. Today it surfaces Playwright's own
  ambiguous error after the full webServer timeout.
- **Legitimate reuse still works:** with the project's OWN dev server already running and healthy on that
  port, `verify.sh` must still pass by reusing it (no regression to the intended `reuseExistingServer`
  fast-path).

## Done when
`verify.sh` distinguishes a foreign/stale port occupant from a legitimate reusable dev server before
handing off to Playwright, proven by the two script assertions above; `OVERLAY_VERSION` bumped for the
stack-a-nextjs template change.

## Out of scope
Changing the `server-env.json`-present behavior (already correctly disables reuse); building a general
port-management daemon — this is a preflight check, not a port broker.
