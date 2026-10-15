---
id: BL-0236
type: change
area: plugin-skill
title: "Design skill's publish flow never announces a 'not yet published, pending verification' state"
status: open
severity: p2
opened: 2026-10-15
closed:
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (agent-inferred, corroborated by the owner's own stated frustration): the owner checked the published mockup link while a finished round was still waiting on its verification gate, saw the PRIOR round's content, and concluded no work had happened, because nothing explicitly told them the new round was finished-but-not-yet-published"
closes:
links: [LESSON-0326]
---

## Problem
The design skill's "Review and publish" procedure (`plugin/skills/design/references/iteration-loop.md`
§Review and publish) instructs publishing the prototype's one artifact after a round is complete, but
has no instruction to communicate the IN-BETWEEN state — work finished, verification gate still
running, not yet republished. During that window the owner's only visible signal is the PRIOR round's
published content, which is indistinguishable from "nothing has happened yet."

In practice (funko-tracker, 2026-10) this reached the owner directly: they checked the published link
mid-gate, saw the old round, and concluded the agent hadn't done anything — eroding trust in the
process even though the work was, in fact, done and simply queued behind verification.

## Root cause
`iteration-loop.md`'s publish procedure is written as a single step ("publish by updating the
artifact") with no companion instruction for the window between "round finished" and "gate passed,
republished." There is no prescribed message to send the owner marking that window explicitly, so
whether it happens depends on each session's own judgment rather than a standing rule.

## Fix plan
1. Add an explicit instruction to `references/iteration-loop.md`'s "Review and publish" section:
   the moment a round's work is functionally complete and enters its verification gate, tell the owner
   ("finished, not yet published — verifying") before the gate resolves, rather than leaving the
   previously-published artifact as the only visible signal.
2. Add the companion half: publish as soon as the gate passes, to keep the stale-link window as short
   as possible (already implied by the existing flow, but make it explicit alongside the new
   announcement instruction so both halves of the window are covered).
3. Cross-check whether the SAME gap exists in any other skill with a comparable
   complete-then-gate-then-publish shape (e.g. `implement`'s close-out, `release`'s launch gate) and
   note it there too if so, rather than fixing only the design skill's instance.

## Tests (prove the fix — TDD, RED → GREEN)
This is a prose/instruction fix (no executable gate), so prove it via a documented manual check: before
the fix, `iteration-loop.md` has no sentence instructing a pending-state announcement (grep for
"not yet published" / "pendiente de verificar" returns nothing); after the fix, it does.

## Done when
`references/iteration-loop.md` explicitly instructs announcing the pending state before a round's
gate resolves, the publish-ASAP-after-gate instruction is explicit alongside it, the cross-check in
step 3 is recorded (either a matching fix elsewhere or a documented reason it doesn't apply), and the
plugin version is bumped.

## Out of scope
Building an automated mechanism that detects/announces this state (e.g. a hook); this item is scoped to
making the instruction explicit in the skill's own procedure text.
