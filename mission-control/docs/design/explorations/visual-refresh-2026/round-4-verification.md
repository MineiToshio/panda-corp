# Órbita round 4 — semantic color and visual hierarchy

Date: 2026-10-17. Status: **reviewable design iteration**, not a final design freeze or production implementation. Same stable review: http://127.0.0.1:1988/preview.html.

## Owner request and scope

The owner likes the modern composition, but finds the all-purple treatment flat. The current app's useful colored distinctions are the reference for scanning Spec and documents. This round changes the exploration only: palette, panel emphasis, document-type affordances, workflow coloring and active-tab visibility. It preserves the previous real-data snapshot and complete Board/Portfolio journeys. No source documents, statuses or priorities are fabricated.

The [proposal](proposal.md#round-4--semantic-color-and-visual-hierarchy) records the shared palette. Color always accompanies a label or icon. Body text stays neutral; links, headings and type badges use theme-specific colors. Product is blue, research/data teal, contracts violet, design pink, architecture/decisions amber, value/verified progress green, problem context coral, and references/planned/excluded material slate. Card/background tint, section icon and heading weight give each level distinct emphasis. The FRD verified/total display is derived from captured orders. The project picker, board and work-order colors derive from their captured phase/state. On narrow screens the selected tab is brought into view inside its own scroll strip.

## Verification evidence

- Canonical design preflight: browser ran, **CLEAN**. Report: `evidence/round4-preflight.json`.
- Responsive/a11y matrix: **107 states**, 0 axe WCAG A/AA violations, 0 outer horizontal overflow, exactly one H1 and 0 runtime errors. Core Spec/Architecture/Work orders/Documents for PandaSaga and Mission Control at 320/375/768/1280 in both themes; Inicio/Tablero/Manual, summary and project-picker states at the same widths/themes; remaining three projects' Spec at desktop. Report: `evidence/round4-matrix.json`.
- Existing flow regressions: **14 assertions** pass, including Board/shared Architecture, all FRDs, project search/change, 35 PandaSaga orders/full source, five projects' full PRD/source-tree matches, all 39 schema entities, relation selection/deselection and mobile document search. Report: `evidence/round4-flows.json`.
- Document-type and Manual states: **20 rendered states plus wrapper navigation** pass, with no axe violations, overflow or runtime errors. Actual FRD, FDD, blueprint and ADR documents show their correct type/tone at 375/1280 in both themes; Manual tutorial selects pink; the wrapper opens Spec and switches phone/theme. Report: `evidence/round4-details.json`.
- Active tab visibility: four selected tabs at 320/375/768/1280 remain fully inside the tab strip, without moving the page. Report: `evidence/round4-tabs.json`.
- Final architecture palette and wrapper: **8 states plus wrapper navigation** pass after the amber intro refinement, in both themes at all four widths. Report: `evidence/round4-final-palette.json`.
- Parent visual inspection: dark desktop Spec, light FRD list, phone Spec and light phone document reader inspected from fresh browser screenshots. Colored labels and icons reinforce card tint; project context remains readable. Phone does not compress the reader into a side column. The phone FRD list and light desktop Architecture were also inspected.
- Independent review: recorded separately under `evidence/round4-review.md`; findings and closure are noted below.

The matrix ran before the final purpose-based group-heading refinement and tab centering. Document/Manual detail states and the dedicated tab probe cover those changes; the canonical preflight is rerun on the final HTML. No production gate, physical-device Safari run, full ancillary feature oracle, performance benchmark or final owner approval is claimed. Evidence and the unchanged real-data snapshot stay local and ignored by Git. Earlier rounds are archived under `mockups/round-3/`.

## Independent review closure

The independent review found one semantic blocker and three presentation nits. All four were resolved in this round:

1. Project phases were hidden by the old mobile `.phase-tag` rule. Every picker choice now spells its phase in the descriptive line at every width; color reinforces visible text.
2. Long Scope v1 content created an empty half-row beside Excluded scope. Scope now spans the full grid, with two bullet columns at desktop and one on phone; Excluded scope and Open decisions follow as a pair.
3. The static title and demo copy still named round 3. Both now name round 4.
4. The optional demo strip lacked a landmark. It is now a named region.

The parent reran **33 affected states** (Spec for two projects, summary and project picker at four widths/two themes, plus visible demo chrome): 0 axe violations, outer overflow or runtime errors, one H1. Report: `evidence/round4-review-fixes.json`. The scope layout was inspected from a fresh final screenshot. The reviewer also checked the five phone picker labels and the targeted visual/demo fixes, and closed with no remaining blockers. Final canonical preflight is CLEAN. This was one independent audit followed by targeted closure, not an open-ended re-audit.
