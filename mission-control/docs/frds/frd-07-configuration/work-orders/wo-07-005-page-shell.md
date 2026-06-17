---
id: WO-07-005
type: work-order
slug: page-shell
title: WO-07-005 — Configuration page shell + section tabs
status: DRAFT
parent: FRD-07
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
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

## Status Note

**What it built:** Configuration page shell at `app/configuration/` with four section tabs
(Habilidades · Agentes · Reglas de decisión · Estándares), default Skills, per-section panel
placeholders (WO-07-006 through WO-07-009 replace them), and full a11y wiring.

**Files delivered:**
- `app/configuration/SectionTabs.tsx` — `"use client"` tab bar. Controlled component;
  receives `activeSection: SectionId` + `onSectionChange: (id: SectionId) => void`.
- `app/configuration/ConfigurationShell.tsx` — `"use client"` shell; owns `useState<SectionId>` (default `"skills"`); renders `SectionTabs` + active `SectionPanel` (one mounted at a time).
- `app/configuration/page.tsx` — Server Component route entry; renders page chrome + mounts `ConfigurationShell`.
- `app/configuration/page.test.tsx` — 45 tests RED→GREEN covering AC-07-005.1..4.

**Interfaces / contracts exposed (for WO-07-006 through WO-07-009):**
```ts
// app/configuration/SectionTabs.tsx
export type SectionId = "skills" | "agents" | "rules" | "standards";
export interface SectionTabsProps { activeSection: SectionId; onSectionChange: (id: SectionId) => void; }
export function SectionTabs(props: SectionTabsProps): React.JSX.Element

// app/configuration/ConfigurationShell.tsx
export function ConfigurationShell(): React.JSX.Element
// Replace SectionPanel bodies with real section components when sections ship.
```

**Integration seams:**
- `data-testid="config-shell"` — root wrapper of ConfigurationShell.
- `data-testid="config-section-tabs"` — the tab bar nav element.
- `data-testid="config-tab-{skills|agents|rules|standards}"` — each tab button.
- `data-testid="config-section-{skills|agents|rules|standards}"` — each panel (role="tabpanel", aria-labelledby="config-tab-id-{id}").
- `data-testid="configuration-page"` — the page `<main>` root.
- Tab button ids: `config-tab-id-{sectionId}` — used by panels' `aria-labelledby`.

**Test coverage:** `app/configuration/page.test.tsx` (45 tests).

**Verify gate:** 163/163 test files, 4385 tests pass, 2 expected-fail, 5 skipped. biome clean. tsc clean. `verify.sh` green.

**Note for librarian (candidate lesson):** The WO-07-004 implementer committed all `app/configuration/` files (including this WO's deliverables) in its own commit before WO-07-005 ran. Pattern repeats from WO-12-005: when parallel agents work in overlapping directories, the first commit picks up all untracked files. Verify with `git show HEAD --name-only` before assuming files need a new commit. (agent-inferred)
</content>
