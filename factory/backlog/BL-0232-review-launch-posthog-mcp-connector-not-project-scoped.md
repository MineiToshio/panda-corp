---
id: BL-0232
type: bug
area: plugin-skill
title: "review-launch step 2b has no durable, per-project fallback when the session's PostHog MCP connector is absent or scoped to the wrong org"
status: open
severity: p2
opened: 2026-10-13
closed:
source: "factory/memory/_inbox.md note, panda-corp 2026-10-12 pandacorp-review-launch scheduled sweep — the running session had NO PostHog MCP connector configured at all; every sweep since personal-page-v2's 2026-10-07 launch has fallen back to 'sin datos' even though its 10/10 events are verified firing in production. See LESSON-0286 (the generalizable MCP-session-scope lesson this splits from) and LESSON-0198/LESSON-0199 (related PostHog/claude-in-chrome scoping gotchas)."
closes:
links: [LESSON-0286, LESSON-0198, LESSON-0199, BL-0087]
---

## Problem
`plugin/skills/review-launch/SKILL.md` step 2b reads PostHog metrics via an MCP connector assumed to be
present and scoped to the project under review. In practice an MCP connector is bound to the SESSION it
was configured in, not to the project being reviewed: a scheduled/unattended `pandacorp-review-launch`
run may have no PostHog connector at all (observed 2026-10-12), or — per the personal-memory finding on
the same tool — a connector scoped to only ONE org, which silently fails for every other portfolio
project. The routine's only observed behavior on either failure is to report "sin datos", which is
indistinguishable from "there really is no PostHog data" — masking real signal (personal-page-v2's events
verifiably fire in production the whole time).

## Root cause
Step 2b was designed assuming a working, correctly-scoped MCP connector is a given for every scheduled
run. There is no detection of (a) connector absence vs (b) connector present-but-wrong-scope vs (c)
genuinely no data, and no documented fallback path that doesn't depend on whichever MCP connector the
session happens to carry.

## Fix plan
1. In `plugin/skills/review-launch/SKILL.md` step 2b, add an explicit connector-state check before
   reading any metric: distinguish "no PostHog MCP tool available this session", "connector available but
   returns a project/org that does not match the project under review" (c.f. LESSON-0198's silent-redirect
   gotcha), and "connector correctly scoped, metric genuinely absent" — report each state differently to
   the owner, never collapse all three into "sin datos".
2. Add a documented fallback for scheduled/unattended runs that doesn't depend on a live MCP connector:
   either (a) a per-project PostHog personal API key (read-only HogQL via REST) stored the same way other
   project secrets are (SOPS+age, `external-services.md`), or (b) an owner-run "paste back documented
   query results" loop for sessions with no connector, whichever is cheaper to wire — pick one, document
   the choice and the rejected alternative in the decision-log.
3. Update `factory/standards/external-services.md` if a new secret/connector pattern is introduced.

## Tests (prove the fix — TDD, RED → GREEN)
Documented manual repro: run `/pandacorp:review-launch` in a session with the PostHog MCP tool
unavailable (or pointed at an unrelated org) against a project with verified live PostHog events — RED =
current behavior reports "sin datos" with no distinction from a real absence of data; GREEN = the routine
explicitly reports "no connector available" or "connector scoped to a different project" and, if the
chosen fallback is wired, still surfaces the real metric via the fallback path.

## Done when
- step 2b distinguishes connector-absent / wrong-scope / genuinely-empty in its own output (checkable by
  reading the routine's report on a run with each of the three states forced).
- the chosen fallback (API-key REST path or documented paste-back loop) is implemented and documented in
  `external-services.md` if applicable.
- the decision-log records which fallback was chosen and why.
- back-links `LESSON-0286` with `promotion` left as-is (this item itself does not change the lesson's
  promotion status).

## Out of scope
Fixing BL-0087 (review-launch trusting `status.yaml` over the live deployed artifact) — a related but
distinct gap, already tracked separately.
