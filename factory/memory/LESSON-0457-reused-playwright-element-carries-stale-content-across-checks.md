---
id: LESSON-0457
type: gotcha
domain: testing
tags: [playwright, test-isolation, stale-state, qa-scripts, dialog]
context: a single Playwright script/page session runs several sequential checks against the same app without reloading or explicitly resetting shared UI state (e.g. a modal/dialog) between them
trigger: use this when a Playwright script reuses the same page/dialog across multiple sequential assertions and a later check appears to pass or fail against the WRONG content
source: "mission-control .pandacorp/run/lessons.md 2026-10-20 (agent-inferred) — a reused dialog still showing a prior check's content made a later click/assert look like it hit the current check's target when it had not"
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a Playwright script drove several sequential checks against the same running page without
navigating away or explicitly closing/clearing a shared dialog between them. A later check's click landed
off-target (see the companion scroll-into-view gotcha) and, because the dialog from the PRIOR check was
still open and showing its own content, the script's result looked like a pass/fail of the current check
when it was actually still reading stale state left over from the previous one.

**Lesson:** a shared, long-lived UI element (a modal/dialog/panel the script opens once and re-triggers
rather than re-opening fresh) silently carries state across sequential checks in the same script run.
Combined with any other interaction bug (a mis-click, a race), this produces a result that LOOKS like it
answered the current check's question while actually reading a leftover answer from an earlier one — a
much harder failure to notice than an outright crash, because the script still reports a clean pass/fail.

**Apply next time:** when a script runs multiple sequential checks that each open/interact with the same
dialog/modal/panel, explicitly close or clear it at the end of each check (or re-open it fresh for the
next one) rather than assuming the next interaction will naturally replace its content — verify the
dialog's content matches the CURRENT check's expectation before trusting an assertion against it.
