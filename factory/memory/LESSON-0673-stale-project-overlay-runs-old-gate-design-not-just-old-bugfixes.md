---
id: LESSON-0673
type: gotcha
domain: factory-engineering
tags: [overlay-version, upgrade, stop-gate, verify-sh, gate-design, read-only-session]
context: a Pandacorp project's `.pandacorp/overlay_version` lags behind the factory's current gate design (not just a bugfix) — the project still runs the OLDER gate's full behavior, not the newer one, until `/pandacorp:upgrade` syncs it
trigger: use this when a Stop/verify gate blocks a session on drift the session never touched, especially a read-only or exploratory session, before concluding the gate itself is broken or the drift is new — check whether the project's overlay_version actually carries the gate DESIGN (not just a bug patch) that would have prevented this block
source: "mission-control .pandacorp/run/lessons.md 2026-11-10 (agent-inferred): the Stop gate ran verify.sh COMPLETE in a read-only session and blocked on a pre-existing Biome format red in src/lib/status/status.ts (already committed at a6146909, untouched by the session, clean tree) — mission-control's overlay_version was 8.114.4, stamped before DR-146 (overlay 8.119.0+) introduced `verify.sh --light` for the Stop hook specifically to stop full-gate runs from blocking on pre-existing, session-unrelated drift"
provenance: agent-inferred
created: 2026-11-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0244, LESSON-0262, DR-146]
---

**Situation:** a factory-level gate redesign (DR-146: the Stop hook runs a light `verify.sh --light` instead of the full gate, precisely so pre-existing drift the session didn't touch can't block it) had already shipped at the plugin/overlay level, but the project itself (mission-control) was still stamped at an older `overlay_version` from before that design landed. A read-only session in that project hit the OLD heavier Stop-gate behavior — the full `verify.sh` — and was blocked by a Biome format red in an already-committed file the session never opened.

**Lesson:** LESSON-0262 covers a narrower case (a hook bugfix landing mid-session on the global plugin). This is broader: an entire gate's *design* (not a point fix) can change at the factory level, and that redesign does nothing for a project until that project's own `/pandacorp:upgrade` pulls the new overlay in. A project's `overlay_version` being older than the version that shipped a gate redesign is sufficient, on its own, to predict "this project still runs the OLD gate's full behavior" — including blocking a read-only session on unrelated pre-existing drift the newer design was built specifically to exempt.

**Apply next time:** when a gate blocks on content the current session did not touch, check two things before treating it as a live defect or as fresh drift: (1) the project's `.pandacorp/status.yaml` `overlay_version` against the factory's current plugin version and the version that shipped the relevant gate behavior (a decision-log/registry entry names it), and (2) whether `/pandacorp:upgrade` on that project is pending. If the overlay predates the redesign, the block is an overlay-lag artifact, not a new bug — route it as "this project needs `/pandacorp:upgrade`" rather than filing a defect against the gate itself.
