---
id: WO-08-004
type: work-order
slug: reference-rules-standards
title: 'WO-08-004 — Reference: decision rules + standards (DERIVED, DR-046)'
status: DRAFT
parent: FRD-08
implementation_status: PLANNED
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
</content>
