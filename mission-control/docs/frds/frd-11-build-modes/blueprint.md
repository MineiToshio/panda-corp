# Blueprint — FRD-11 Build entry and target selection

## Day 1 contract (2026-11-12)

The amended [FRD](frd.md) and [FDD](fdd.md) replace the four-card mode design. Producer evidence is the engine's `detect.mjs` at **540afa2c**, documented in [the shared read contract](../../product/build-engine-v2.md). This is the MC-CMD implementation contract; earlier VERIFIED WOs remain delivery history and are not reopened or re-stamped by this doc task.

| Component/interface | Responsibility | Traces |
|---|---|---|
| CMP-11-build-entry (existing shared BuildModePicker location may be retained) | Copy-only Construir/Reanudar/Objetivo action group, target select and one exact command; no mode store/power table; transient per-project state. | REQ-11-007 to -010 |
| IF-11-build-command | One pure resolver for bare implement, resume, parent-FRD target and `change:<id>` card target. Reused by Comandos, Campaña, Cambios and WO fact sheet. | REQ-11-007/008/009 |
| CMP-11-comandos-panel / CMP-11-tab-commands | Compose next-step/decision commands with the shared picker, using server-resolved project and available FRDs/cards. | REQ-11-007/008, FRD-04 REQ-04-006/019 |
| IF-11-targets | Buildable pending FRDs and ready/draft cards, exclude stale-suspect and terminal/closing cards; building v2 card selects resume. Keep explicit card/FRD identifiers. | REQ-11-008 |
| CMP-02-campaign | Mount the same picker under Construir o reanudar with project identity. | REQ-11-009 |

## Behavior boundaries

- The app never runs the engine. No API mutation or new filesystem write is added.
- Ignore/remove old browser power preferences from generated commands. Selecting an action or target is transient view state and resets on project switch/reload; FRD-25 continues to own workspace/tab/document URLs.
- An individual WO has no engine target parser: select its parent FRD with explicit explanatory copy. Never silently claim a one-WO build.
- No target means no executable placeholder command to copy. A broken target source has an explicit error/empty state; it never produces a guessed target. Preserve the shared copy feedback and existing component tokens.

## Verification contract

Unit/component checks cover exact strings for all three actions, no legacy argument despite stored mode, FRD/card/draft/stale/building eligibility, empty/cleared selection, and project-switch reset. Integration checks cover Comandos and Campaña sharing the resolver, Cambios resume, and parent-FRD scope in the WO detail. Keyboard/accessibility and phone/tablet/desktop overflow checks cover the changed controls. Do not compare the replacement with retired power-card screenshots as if the behavior were unchanged.

## Historical implementation records

WO-11-001/002 delivered the v1 mode catalog/store/selector; WO-11-003/004 delivered the Órbita four-card Comandos surface. Their prior Build Plan is recoverable in git and their work-order files remain historical evidence. The Day 1 MC-CMD batch owns the replacement implementation and its tests; these prior stamps do not verify the new REQ-11-007 to -010 criteria.
