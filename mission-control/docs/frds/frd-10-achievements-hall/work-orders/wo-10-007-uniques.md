# WO-10-007 — Unique achievements by category

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-10-uniques`](../blueprint.md#4-components--interfaces).

## Goal
Render the unique (one-time) achievements grouped by category (Discovery, Speed, Quality,
Consistency, Mastery), with date+project when unlocked and the condition when locked.

## Acceptance criteria (EARS, from FRD-10)
- **AC-10-007.1** — The section SHALL group unique achievements by category, from `computeUniques()`.
- **AC-10-007.2** — An unlocked achievement SHALL show its **date** and **project**; a locked one SHALL show its **condition** (achievable, not obscure).
- **AC-10-007.3** — The visual difference between locked/unlocked SHALL not rely on color alone (icon/shape/label present, FRD-13).
- **AC-10-007.4** — Styling SHALL use FRD-13 tokens only; numbers `tabular-nums`.

## Dependencies
- WO-10-003 (`computeUniques`), WO-10-005 (page shell). Intra-feature.
- FRD-13 tokens. Cross-feature.

## TDD plan
1. RED: tests for category grouping, unlocked (date+project) vs locked (condition), not-color-alone, tokens.
2. GREEN: implement.
3. Refactor.

## Definition of done
- Component tests green; tsc + biome clean; tokens only. `.pandacorp/verify.sh` passes.
</content>
