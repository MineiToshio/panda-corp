---
description: UX/UI design phase of a Pandacorp project - visual research, design system, 3 navigable HTML mockups with accessibility verification, and the owner's visual gate. Use inside the project after /pandacorp:spec.
---

# /pandacorp:design

Design phase. Runs IN the project (requires `docs/product/prd.md` and `docs/frds/` — if they are missing, run `/pandacorp:spec` first).

This phase works at **two layers (DR-049)**: it establishes the project's **global design system** (the PDD — `docs/design/` + root `DESIGN.md`, ONE per project, never per-feature), and when it designs a specific UI feature it writes that feature's design **inside the FRD module** (`docs/frds/frd-NN-<slug>/fdd.md` + `mocks/`). The product-level **direction** mockups below are the exploration that picks the system; they are a different thing from a feature's `mocks/`.

## Steps

1. **Visual research** (`designer` agent): references from 3-5 well-designed apps in the domain → `docs/design/references.md`.
2. **Design system (bespoke per domain)**: the `designer` defines `docs/design/design-tokens.json` (palette, typography, spacing, radii) and `DESIGN.md` at the root (tokens + allowed components + prohibitions). shadcn/ui is the **accessible component base, not the look**: the palette/typography/mood are tailored to THIS app's domain and audience (tweakcn.com only as a token-format reference). Each app has its own identity; never reuse Mission Control's RPG style (that's the factory's internal tool, not a product template).
3. **Voice and microcopy** (`copywriter` agent, in parallel with the design system): defines `docs/design/voice-and-tone.md` and writes the real microcopy for the key screens of the FRDs (labels, buttons, empty/loading/error states, onboarding) with i18n keys. The `designer` consumes these texts in the mockups instead of inventing them — so the text stops being improvised filler and keeps a consistent voice.
4. **3 design directions in parallel** (3 `designer` agents, one per direction, genuinely distinct): `docs/design/mockups/direction-{1,2,3}.html` — self-contained, navigable, mobile-first, covering the key screens of the FRDs with the `copywriter`'s real microcopy (never lorem ipsum). These are **product-level** exploration to pick the design system — they stay in `docs/design/`, NOT inside any FRD module.
5. **Automatic verification before the gate**: screenshots at 375px/1280px (Playwright) → `docs/design/mockups/screenshots/`; accessibility (axe-core) → `docs/design/a11y-report.md`. Serious violations are fixed BEFORE presenting.
6. **VISUAL GATE (the owner)**: present the 3 directions (open the HTML or show them the screenshots) and wait for their choice or feedback. **Iterate in place (DR-032)**: first read `.pandacorp/comms/iteration.md` (phase `design`); for each round of changes refine the mockups and **append** an entry (what was tried, what was rejected and why, what's still open). Choosing a direction does **not** force advancing: the owner can keep polishing it for as many rounds as they want. Re-running `design` resumes from the journal — it doesn't regenerate from scratch or repeat what was discarded.
7. **Freeze the contract**: chosen direction → final `design-tokens.json`, `docs/design/design-decisions.md` with the rationale, remove ambiguity from DESIGN.md. The `copywriter` leaves the final strings with their i18n keys so the implementation doesn't rewrite them.
8. **Per-feature design (DR-049)**: with the global system frozen, the design of a specific UI feature lives **inside its FRD module**, not in `docs/design/`. For each FRD with UI, the `designer` writes `docs/frds/frd-NN-<slug>/fdd.md` (the feature's design — screens, states, component usage, all on the frozen tokens) and that feature's HTML prototypes/screenshots in `docs/frds/frd-NN-<slug>/mocks/`. CONDITIONAL: only for features that have UI; the design system itself is **never duplicated per feature**. Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
9. **Advance gate (DR-032)**: as long as the owner hasn't given their "ok, advance", leave `advance_pending: true` in `.pandacorp/status.yaml` and do **not** write the transition. Only when they approve: `.pandacorp/status.yaml` → `phase: architecture` + `advance_pending: false`, and close the `design` thread in `.pandacorp/comms/iteration.md`. Next step: `/pandacorp:blueprint`.

## Rules
- The later implementation can ONLY use the frozen tokens — this contract is the mechanism that compensates for the owner's weakness in design.
- Empty, loading and error states are designed here, not improvised while coding.
- **Bespoke per domain, never a house style.** Each app's look & feel is designed from scratch for its sector and audience; shadcn/ui is only the accessible component base. Mission Control's RPG/"guild" style is the factory's internal tool and is never applied to product apps.
- **Feasibility before freezing (order fix).** The `designer` emits `docs/design/technical-assumptions.md` (costly/risky interactions the design assumes) for the `architect` to read in `/pandacorp:blueprint`; a high-risk assumption triggers a feasibility spike before the design contract is frozen, so the owner never approves a design the architecture can't support cheaply.
