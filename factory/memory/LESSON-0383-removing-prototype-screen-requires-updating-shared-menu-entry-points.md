---
id: LESSON-0383
type: gotcha
domain: design-fidelity
tags: [prototype, oracle, fidelity-gate, navigation, shared-shell]
context: removing a screen from an already-frozen prototype oracle that is used as a measured fidelity baseline
trigger: use this when a screen is removed (or its route changed) from a frozen prototype after the fidelity oracle was captured
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (agent-inferred)"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a screen was removed from a frozen prototype after its fidelity oracle had already
been captured. The screen's own measurement was correctly dropped, but the oracle's measured
heights/anchor offsets for SHARED shell menus (the account menu, a mobile "Menú" sheet) still
included that screen's now-deleted entry point/link — so a build that correctly removed the screen
(and its menu link) failed the measured fidelity gate, because the menu's real height no longer
matched the stale oracle measurement that still counted the removed link.

**Lesson:** a frozen prototype's shared chrome (navigation menus, shell sheets, global headers) is
measured as a WHOLE, so removing content from one screen can invalidate the oracle's measurement for
a totally different, shared surface that merely links to it — a correct, faithful implementation of
the change can fail a stale fidelity gate for a reason that has nothing to do with the change's own
screen.

**Apply next time:** when removing (or substantially changing) a screen from a frozen prototype,
explicitly check every shared shell/menu surface that links to it, remove its entry point there too,
and re-capture/re-measure those shared surfaces in the oracle — not just the removed screen itself.
