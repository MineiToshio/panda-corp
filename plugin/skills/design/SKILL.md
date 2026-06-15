---
description: UX/UI design phase of a Pandacorp project - visual research, design system, 3 navigable HTML mockups with accessibility verification, and the owner's visual gate. Use inside the project after /pandacorp:spec.
---

# /pandacorp:design

Design phase. Runs IN the project (requires `docs/prd.md` and `docs/frds/` — if they are missing, run `/pandacorp:spec` first).

## Steps

1. **Visual research** (`designer` agent): references from 3-5 well-designed apps in the domain → `docs/design/references.md`.
2. **Design system**: the `designer` defines `docs/design/design-tokens.json` (palette, typography, spacing, radii — shadcn/ui base; tweakcn.com as a format reference) and `DESIGN.md` at the root (tokens + allowed components + prohibitions).
3. **Voice and microcopy** (`copywriter` agent, in parallel with the design system): defines `docs/design/voice-and-tone.md` and writes the real microcopy for the key screens of the FRDs (labels, buttons, empty/loading/error states, onboarding) with i18n keys. The `designer` consumes these texts in the mockups instead of inventing them — so the text stops being improvised filler and keeps a consistent voice.
4. **3 design directions in parallel** (3 `designer` agents, one per direction, genuinely distinct): `docs/design/mockups/direction-{1,2,3}.html` — self-contained, navigable, mobile-first, covering the key screens of the FRDs with the `copywriter`'s real microcopy (never lorem ipsum).
5. **Automatic verification before the gate**: screenshots at 375px/1280px (Playwright) → `docs/design/mockups/screenshots/`; accessibility (axe-core) → `a11y-report.md`. Serious violations are fixed BEFORE presenting.
6. **VISUAL GATE (the owner)**: present the 3 directions (open the HTML or show them the screenshots) and wait for their choice or feedback. **Iterate in place (DR-032)**: first read `docs/iteration.md` (phase `design`); for each round of changes refine the mockups and **append** an entry (what was tried, what was rejected and why, what's still open). Choosing a direction does **not** force advancing: the owner can keep polishing it for as many rounds as they want. Re-running `design` resumes from the journal — it doesn't regenerate from scratch or repeat what was discarded.
7. **Freeze the contract**: chosen direction → final `design-tokens.json`, `docs/design/design-decisions.md` with the rationale, remove ambiguity from DESIGN.md. The `copywriter` leaves the final strings with their i18n keys so the implementation doesn't rewrite them.
8. **Advance gate (DR-032)**: as long as the owner hasn't given their "ok, advance", leave `advance_pending: true` in `docs/status.yaml` and do **not** write the transition. Only when they approve: `docs/status.yaml` → `phase: architecture` + `advance_pending: false`, and close the `design` thread in `docs/iteration.md`. Next step: `/pandacorp:blueprint`.

## Rules
- The later implementation can ONLY use the frozen tokens — this contract is the mechanism that compensates for the owner's weakness in design.
- Empty, loading and error states are designed here, not improvised while coding.
