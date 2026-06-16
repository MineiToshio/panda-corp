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
</content>
