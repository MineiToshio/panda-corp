---
id: WO-07-005
type: work-order
slug: page-shell
title: WO-07-005 — Configuration page shell + section tabs
status: DRAFT
parent: FRD-07
implementation_status: IN_PROGRESS
source_requirements: []
last_updated: '2026-06-16'
---
# WO-07-005 — Configuration page shell + section tabs

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-07-config-page`](../blueprint.md#3-components--interfaces).

## Goal
Build `app/configuration/page.tsx` (Server Component): the four section tabs (Skills · Agents ·
Decision rules · Standards) and the container that mounts each section. Architecture §11 surface
`app/configuration`.

## Acceptance criteria (EARS, from FRD-07)
- **AC-07-005.1** — The Configuration page SHALL offer the four sections **Skills · Agents · Decision rules · Standards** as selectable tabs.
- **AC-07-005.2** — Selecting a tab SHALL render that section's view; the default selection SHALL be Skills.
- **AC-07-005.3** — The tabs SHALL use FRD-13 design tokens only (no hardcoded colors), with the rationed accent on the active tab; the active state SHALL be paired with shape/label, not color alone (FRD-13 a11y).
- **AC-07-005.4** — Tab labels and `aria-label`s SHALL be in Spanish (i18n), keyboard-navigable, with a visible focus ring (FRD-13).

## Dependencies
- FRD-13 `docs/design/design-tokens.json` (tokens). Cross-feature.
- No `lib/` reader required for the shell itself (sections are mounted in 006–009).

## TDD plan
1. RED: `app/configuration/page.test.tsx` — renders 4 tabs, default Skills, switches section, a11y (roles/labels).
2. GREEN: implement the shell + tab state.
3. Refactor: factor a reusable `SectionTabs` if it overlaps with FRD-04 tabs.

## Definition of done
- Component tests green (`@testing-library/react`); tsc + biome clean; tokens only; Spanish labels.
- `.pandacorp/verify.sh` passes.
</content>
