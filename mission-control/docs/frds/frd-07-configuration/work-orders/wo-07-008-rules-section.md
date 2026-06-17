---
id: WO-07-008
type: work-order
slug: rules-section
title: 'WO-07-008 — Decision rules section: list + detail'
status: DRAFT
parent: FRD-07
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-07-008 — Decision rules section: list + detail

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-07-rules-list`, `CMP-07-rule-detail`](../blueprint.md#3-components--interfaces).

## Goal
Render the Decision rules section: an explainer of what a decision rule IS, ALL DRs with an
**auto-approves (●) / asks-you (●)** indicator, a detail (the pre-approved default), and a
**"New decision rule"** button that copies `/pandacorp:learn`.

## Acceptance criteria (EARS, from FRD-07)
- **AC-07-008.1** — The section SHALL explain what a decision rule IS (short intro).
- **AC-07-008.2** — The section SHALL list ALL decision rules (`readDecisionRules()`) each with an indicator: **auto-approves (●)** when `requiereHumano` is false, **asks you (●)** when true, paired with a label/shape (not color alone, FRD-13).
- **AC-07-008.3** — WHEN the owner clicks a rule, the detail SHALL show the pre-approved default and how it is applied (escalates to you vs auto-applied + verified by a script/hook/CI).
- **AC-07-008.4** — The section SHALL include a **"New decision rule"** button that **copies** `/pandacorp:learn` to the clipboard (reuses `CopyButton`); it SHALL NOT execute anything (architecture §1).

## Dependencies
- WO-07-003 (`readDecisionRules()`), WO-07-005 (page shell). Intra-feature.
- `CopyButton` (FRD-02). Cross-feature.
- FRD-13 tokens. Cross-feature.

## TDD plan
1. RED: tests for intro, list with ●/● indicator (+ label), click→detail, copy-`/pandacorp:learn` button (clipboard, no exec).
2. GREEN: implement list + detail + button.
3. Refactor.

## Definition of done
- Component tests green; tsc + biome clean; tokens only; copy-only (no exec). `.pandacorp/verify.sh` passes.

## Status Note

Built and wired end-to-end. 86 tests GREEN (41 in `_rules/DecisionRulesSection.test.tsx` + 45 pre-existing in `page.test.tsx`). tsc exits 0. Biome clean on WO-07-008 files (pre-existing 17 errors in agents/standards WOs unchanged).

**What it built:**
- `app/configuration/_rules/DecisionRulesSection.tsx` — `"use client"` component (CMP-07-rules-list + CMP-07-rule-detail). Props-down: receives `rules: DecisionRule[]` from the server. Owns `selectedId` state for the toggle-detail interaction.
- `app/configuration/_rules/DecisionRulesSection.test.tsx` — 41 tests covering AC-07-008.1..4.
- `app/configuration/ConfigurationShell.tsx` — extended with `rules?: DecisionRule[]` prop; routes the `rules` tab to `DecisionRulesSection` instead of the placeholder.
- `app/configuration/page.tsx` — server-side `readDecisionRules()` call, passes result to `ConfigurationShell`.

**Interfaces/contracts exposed:**
```ts
// app/configuration/_rules/DecisionRulesSection.tsx
export interface DecisionRulesSectionProps { rules: DecisionRule[] }
export function DecisionRulesSection(props): React.JSX.Element

// app/configuration/ConfigurationShell.tsx (extended)
export interface ConfigurationShellProps { rules?: DecisionRule[]; /* + pre-existing props */ }
```

**Integration seams:**
- Consumes `readDecisionRules(): DecisionRule[]` from `lib/registry.ts` (WO-07-003, IF-07-registry).
- Reuses `CopyButton` (FRD-02) for the `/pandacorp:learn` copy-only button (AC-07-008.4).
- Wired into the `rules` tab of `ConfigurationShell` via the `activeSection === "rules"` branch.
- `page.tsx` reads rules server-side and passes down (architecture §3 — filesystem reads stay server-side).

**data-testid contract (for integration tests):**
- `rules-section` — root wrapper
- `rules-intro` — intro paragraph (AC-07-008.1)
- `rules-list` — `<ul>` of rule items
- `rule-item-{id}` — each rule button (`data-auto`, `data-selected`)
- `rule-indicator-{id}` — indicator chip (`data-indicator="auto"|"human"`)
- `rule-indicator-label-{id}` — text label alongside the dot (not color alone, FRD-13)
- `rule-detail` — detail panel (visible when a rule is selected)
- `rule-detail-default` — pre-approved default text
- `rule-detail-mode` — how it is applied (`data-mode="auto"|"human"`)
- `rule-detail-nota` — optional nota (only when `rule.nota` is set)
- `rules-new-rule-btn` — wrapper div for the CopyButton (contains `data-testid="copy-button"`)

**Test files:** `app/configuration/_rules/DecisionRulesSection.test.tsx`, `app/configuration/page.test.tsx`
</content>
