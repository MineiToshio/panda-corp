---
id: LESSON-0499
type: gotcha
domain: testing
tags: [prototype, oracle, hash-routes, test-isolation, design-checker]
context: an automated checker that drives a design prototype's oracle states by navigating hash routes
  on ONE reused browser page/tab across scenarios, rather than a fresh page per state
trigger: use this when writing or debugging a prototype/oracle checker that walks several hash-route
  states and reuses a single page instance across them
source: "mission-control .pandacorp/run/lessons.md 2026-10-22 (agent-inferred): a prototype checker that
  reused one page across hash routes accumulated scenario mutations and open dialogs from earlier states,
  corrupting later oracle-state checks"
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0185, LESSON-0066]
---

**Situation:** a design-prototype checker that validates multiple oracle states by changing the hash
route on ONE already-open page accumulated leftover DOM/state mutations (open dialogs, prior scenario's
form input, toggled UI) from earlier states into later ones — a hash-route change does not reset
client-side component state the way a full navigation/reload does, so each subsequent state's check was
really checking "the prototype's state after every prior state ran," not the state in isolation.

**Lesson:** a hash-route change is a client-side navigation, not a fresh page load — any open
dialog/modal, filled form or toggled UI left behind by the PREVIOUS scenario silently carries into the
NEXT one being checked on the same page instance. This is the same "no shared mutable state between test
cases" principle the project's own test-isolation rules already require for ordinary test suites, applied
here to a hand-rolled prototype/oracle checker that doesn't go through the normal test harness.

**Apply next time:** when a checker needs to verify several hash-route-addressed oracle states, load (or
reload) a fresh page for each state rather than reusing one page and only changing the hash — or
explicitly reset all known mutable UI (close dialogs, clear forms) before each check if a fresh load is
genuinely too costly. Never trust a later state's check result if an earlier state's page is still live
underneath it.
