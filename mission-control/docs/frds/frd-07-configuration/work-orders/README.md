# FRD-07 — Configuration · work orders

Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
See the [feature blueprint](../blueprint.md) and the [platform architecture](../../../product/architecture.md).

Each work order targets **one deploy unit** and is testable in isolation (TDD: RED → GREEN →
refactor). The `lib/**` readers (data layer) come first; the page/components consume them.

## Cross-feature dependencies
- **FRD-01 (data reading layer)** — the `lib/config.ts` foundation (`resolveFactoryRoot`,
  `PANDACORP_FACTORY_ROOT`) and the fixture-tree testing pattern. All readers depend on it.
- **FRD-13 (visual system & tokens)** — `docs/design/design-tokens.json` + per-agent accent
  tokens. All UI WOs depend on tokens being available (zero hardcoded colors).
- **FRD-09 (gamification)** — `IF-09-agent-xp` (agent level/title/XP from real work orders) and the
  pixel-art avatar component. Agent WOs (WO-07-006/007) depend on FRD-09 WO-09-002/003.

## Order & parallelization (Phase 2)

The UI work orders were **collapsed into one coarse WO** (WO-07-005); the three `lib/**` readers stay
VERIFIED and are consumed as-is. See the blueprint's **Build Plan (Phase 2)**.

```
WO-07-001 (lib/reference: skills + agents) ─┐  VERIFIED
WO-07-003 (lib/registry) ───────────────────┼─ VERIFIED (consumed as-is)
WO-07-004 (lib/standards) ───────────────────┘  VERIFIED
        │
        ▼
WO-07-005 (Configuración UI surface)   ← foundation-first: FRD-13 (WO-13-006/007/008) + FRD-09 (agent XP/avatar)
```

## Work orders
| ID | Title | Deploy unit | Status | Depends on |
|---|---|---|---|---|
| WO-07-001 | `lib/reference.ts` — read skills + agents catalogs | `lib/reference.ts` | VERIFIED | WO-01-001 |
| WO-07-003 | `lib/registry.ts` — read decision rules | `lib/registry.ts` | VERIFIED | WO-01-001 |
| WO-07-004 | `lib/standards.ts` — read standards (+ derivation fallback) | `lib/standards.ts` | VERIFIED | WO-01-001 |
| WO-07-005 | Configuración UI surface (re-anchor to prototype) | `src/app/configuration/**` | PLANNED | WO-07-001, WO-07-003, WO-07-004, WO-09-002, WO-01-007, WO-13-006, WO-13-007, WO-13-008 |
</content>
