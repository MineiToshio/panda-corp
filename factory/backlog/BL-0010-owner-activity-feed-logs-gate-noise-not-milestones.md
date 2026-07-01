---
id: BL-0010
type: change
area: build-engine
title: "Owner activity feed logs raw gate-tool exit lines, not milestones"
status: open
severity: p2
opened: 2026-07-01
closed:
source: "owner/conversation 2026-07-01 (memory harvest); evidence mission-control/.pandacorp/comms/progress.md:24-30"
closes:
links: []
---

## Problem
The owner-facing **Activity feed** — Mission Control's Summary tab (AC-04-003.2), which the portfolio→resumen
view renders through `readActivityLog` in `mission-control/src/lib/docs/activity.ts` — reads
`.pandacorp/comms/progress.md`. During a build, the engine/supervisor appends **raw gate-tool exit lines**
into that owner file, e.g. `mission-control/.pandacorp/comms/progress.md:24-30`:

```
- **Biome:** limpio. Exit 0.
- **tsc:** limpio. Exit 0.
- **knip:** limpio. Exit 0.
- **madge:** sin dependencias circulares. Exit 0.
- **Vitest:** 327 ficheros / 7060 tests pasados… Exit 0. VERDE.
- **Smoke (Playwright):** 14/14 pasados… Exit 0.
- **Visual (Playwright):** 14/14 baselines coincidentes. Exit 0.
```

For the owner these are **noise**: no context, no legible timestamp, no relevance. The owner wants
**milestones** — what FRD/WO was built or changed, what decision was taken, what got blocked — not the
tool run-log. Mission Control only *displays* what is written into `progress.md`; it cannot add milestone
context that was never emitted, so the fix is on the **writer** (factory) side, not in MC.

Impact: the factory's main owner-facing "what happened" surface reads like a CI log instead of a progress
narrative — it undersells real progress and buries the signal (decisions, blocks) the owner actually needs.

## Root cause
The build supervisor's run-summary (and the agents' progress notes) append **every gate-tool result verbatim**
into `.pandacorp/comms/progress.md`, mixing an engineering tool-log with the owner narrative. There is no
separation between a *technical gate log* and the *owner-facing milestone feed*, and no written contract for
what belongs in `progress.md` — so tool-exit lines leak into the feed MC renders.

## Fix plan
1. **Define the contract.** `.pandacorp/comms/progress.md` is the OWNER-facing milestone feed (Spanish): it
   records what *advanced* (FRD/WO built or changed, decisions taken, items blocked needing the owner) — NOT
   raw gate-tool exit lines. Gate results either stay out entirely or go to a separate technical log the
   activity feed does not render. Document this in `factory/standards/build-orchestration.md` (supervisor /
   comms section) and in the `implement` skill.
2. **Update the writers.** Adjust the `implement` skill's supervisor run-summary and the agents' progress-note
   guidance (`plugin/skills/implement/SKILL.md`, `plugin/agents/*.md`) so they append milestone entries, not
   `**Biome:** limpio. Exit 0.`-style lines.
3. **(Optional MC follow-on, out of scope here)** if any residual technical lines slip through, MC's
   `readActivityLog` could filter a known noise pattern on read — but the enabling change is the writer.
   File that as a separate MC `/pandacorp:change` only if needed after step 2.

## Tests (prove the fix — TDD, RED → GREEN)
- **Noise canary:** grep a freshly-written `progress.md` (or a fixture produced by the supervisor summary
  routine) for the forbidden pattern `^- \*\*(Biome|tsc|knip|madge|Vitest|Smoke|Visual)\b.*Exit` — must
  return **no** match in the owner feed after the fix (matches today at lines 24-30, 73-75).
- **Milestone positive:** the same feed must contain at least one milestone entry referencing an FRD/WO id
  or a decision, proving the feed carries signal, not just the absence of noise.

## Done when
- The `implement` supervisor + agents no longer write raw gate-tool exit lines into `progress.md`.
- The writer contract is documented (`build-orchestration.md` + the `implement` skill).
- Plugin semver bumped (MINOR — changed skill/agent behavior) per DR-034; entry in `plugin/docs/decision-log.md`.
- The noise canary is in place and green; on the next build MC's activity feed shows milestones.

## Out of scope
Mission Control's rendering/filtering (a separate MC change if wanted). The WO-summary-shows-path issue is
[BL-0011].
