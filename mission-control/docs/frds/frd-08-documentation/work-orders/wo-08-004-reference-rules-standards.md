---
id: WO-08-004
type: work-order
slug: reference-rules-standards
title: 'WO-08-004 — Reference: decision rules + standards (DERIVED, DR-046)'
status: DRAFT
parent: FRD-08
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-08-004 — Reference: decision rules + standards (DERIVED, DR-046)

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-08-reference-rules`, `CMP-08-reference-standards`](../blueprint.md#5-components--interfaces) + [§2 derivation](../blueprint.md#2-how-the-reference-is-derived-the-dr-046-core).

## Goal
Render the Reference's **decision rules** and **standards** catalogs, **derived** from the FRD-07
readers (`readDecisionRules()`, `readStandards()`) — NOT hand-maintained. DR-046 core. Standards
automatically reflect DR-049 / the rewritten `structure.md`.

## Acceptance criteria (EARS, from FRD-08 + DR-046)
- **AC-08-004.1** — The Reference SHALL list all decision rules derived from `factory/decisions/registry.yaml` via `readDecisionRules()`, with the auto-approves/asks-you indicator (paired with label, not color alone).
- **AC-08-004.2** — The Reference SHALL list the standards derived from `factory/standards/*.md` via `readStandards()`, with domain/severity/enforcement (per FRD-07 derivation, incl. the §6 fallback).
- **AC-08-004.3** — WHEN a rule/standard is added/renamed/removed in the factory, it SHALL appear/rename/disappear in the Reference with no edit to any Manual file (DR-046) — verified by swapping fixtures.
- **AC-08-004.4** — The standards Reference SHALL pick up DR-049 / the rewritten `structure.md` automatically (no special-casing).
- **AC-08-004.5** — No hand-maintained catalog array; FRD-13 tokens.

## Dependencies
- FRD-07 WO-07-003 (`readDecisionRules`), WO-07-004 (`readStandards`). Cross-feature — REUSE.
- WO-08-002 (shell). Intra-feature.
- FRD-13 tokens. Cross-feature.

## TDD plan
1. RED: tests rendering from the readers; DR-046 fixture-swap tests for both catalogs; anti-pattern (imports reader, not literal array).
2. GREEN: implement the two catalog views.
3. Refactor.

## Definition of done
- Component tests green incl. DR-046 swap tests; tsc + biome clean; no hand-copied catalog. `.pandacorp/verify.sh` passes.

## Status Note

**Built:** Two dedicated Reference catalog components for the Manual's decision rules and standards
views, replacing the inline stubs from WO-08-002. `DocReader.tsx` now delegates both catalogs to
the dedicated components (refactor, no behavior change to the shell).

**Files delivered:**
- `app/manual/ReferenceRulesView.tsx` — `ReferenceRulesView` (CMP-08-reference-rules): lists all
  decision rules from `readDecisionRules()` props. Each entry shows id, patron, default, optional
  nota, and a `requiereHumano` indicator as a **text label** ("Auto-aprobado" / "Requiere humano")
  plus `data-requires-human` attribute — never color alone (AC-08-004.1). Empty state handled.
- `app/manual/ReferenceStandardsView.tsx` — `ReferenceStandardsView` (CMP-08-reference-standards):
  lists all standards from `readStandards()` props. Each entry shows title plus three labelled
  badges: severity (`data-severity`), domain (`data-domain`), enforcement (`data-enforcement`) —
  AC-08-004.2. `structure.md` renders through the same uniform loop (AC-08-004.4). Empty state handled.
- `app/manual/ReferenceRulesStandards.test.tsx` — 42 component tests RED→GREEN covering AC-08-004.1..5,
  including DR-046 fixture-swap tests (add/remove/rename a rule or standard → view reflects it with
  no Manual file edit) and FRD-13 token checks (no hardcoded colors in inline styles).
- `app/manual/DocReader.tsx` — refactored: removed the inline `RulesView` / `StandardsView` stubs
  and 6 now-unused style constants; delegated to `ReferenceRulesView` + `ReferenceStandardsView`.
  All WO-08-002 tests (34) still pass.

**Interfaces / contracts exposed:**

```tsx
// ReferenceRulesView — CMP-08-reference-rules
export interface ReferenceRulesViewProps { rules: DecisionRule[]; }
export function ReferenceRulesView({ rules }: ReferenceRulesViewProps): React.JSX.Element
// data-testid="reference-rules-view"
// data-testid="reference-rules-empty" — when rules=[]
// data-testid="reference-rule-{id}" — <li> per rule
// data-testid="rule-indicator-{id}" — text label + data-requires-human="true|false"
// data-testid="rule-nota-{id}" — optional nota paragraph

// ReferenceStandardsView — CMP-08-reference-standards
export interface ReferenceStandardsViewProps { standards: Standard[]; }
export function ReferenceStandardsView({ standards }: ReferenceStandardsViewProps): React.JSX.Element
// data-testid="reference-standards-view"
// data-testid="reference-standards-empty" — when standards=[]
// data-testid="reference-standard-{id}" — <li> per standard
// data-testid="standard-severity-{id}" + data-severity
// data-testid="standard-domain-{id}" + data-domain
// data-testid="standard-enforcement-{id}" + data-enforcement
```

**Integration seams:**
- Both components receive pre-read data as props from `page.tsx` (server reads) via `ManualShell`
  → `DocReader` prop chain. Zero filesystem access in these client components.
- `DocReader.tsx` routes `activePage.catalog === "rules"` → `<ReferenceRulesView rules={rules} />`
  and `activePage.catalog === "standards"` → `<ReferenceStandardsView standards={standards} />`.
- Both import their types directly from `@/lib/registry` and `@/lib/standards` (FRD-07 readers).
  No hand-maintained catalog array anywhere.

**Test file:** `app/manual/ReferenceRulesStandards.test.tsx` (42 tests, AC-08-004.1..5).

**Gate:** 105 tests in `app/manual/` GREEN (42 new + 34 WO-08-002 + 29 WO-08-003). tsc clean.
Biome clean. Pre-existing WO-08-005 failures (10) in `content/manual/` are unchanged — that is a
separate work order for hand-authored concept content, out of scope here.
</content>
