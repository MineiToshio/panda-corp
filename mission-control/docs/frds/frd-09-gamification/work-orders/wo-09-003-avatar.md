# WO-09-003 — `CMP-09-avatar` pixel-art agent avatar

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-09-avatar`](../blueprint.md#3-components--interfaces).

## Goal
Build the reusable pixel-art (Final-Fantasy-style) agent avatar component. Static sprite assets keyed
by agent id; graceful fallback when a sprite is missing. Reused by FRD-07 (agents section) and FRD-10
(party in the Hall hero).

## Acceptance criteria (EARS, from FRD-07/09/13)
- **AC-09-003.1** — `CMP-09-avatar` SHALL render a pixel-art avatar for a given agent id, FF-style, at a tokenized size/radius (FRD-13 elevation/radius tokens).
- **AC-09-003.2** — WHEN the sprite for an id is missing, the component SHALL degrade gracefully (placeholder or removal) and SHALL NOT break the layout (architecture §7).
- **AC-09-003.3** — The avatar SHALL carry an `alt`/`aria-label` in Spanish (FRD-13 a11y).
- **AC-09-003.4** — The component SHALL use only FRD-13 tokens for any chrome (border/background), no hardcoded colors.

## Dependencies
- FRD-13 tokens. Cross-feature.
- Sprite assets (static, in the app). No `lib/` reader.

## TDD plan
1. RED: tests for render-by-id, missing-sprite fallback, Spanish `alt`, token usage.
2. GREEN: implement the component + sprite map.
3. Refactor.

## Definition of done
- Component tests green; tsc + biome clean; tokens only; Spanish a11y. `.pandacorp/verify.sh` passes.
</content>
