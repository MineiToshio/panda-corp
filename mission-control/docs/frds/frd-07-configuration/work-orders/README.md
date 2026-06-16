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

## Order & parallelization

```
WO-07-001 (lib/reference: skills) ─┐
WO-07-002 (lib/reference: agents) ─┼─ parallel (independent readers, depend only on FRD-01)
WO-07-003 (lib/registry) ──────────┤
WO-07-004 (lib/standards) ─────────┘
        │
        ▼
WO-07-005 (config page shell + section tabs)   ← depends on FRD-13 tokens
        │
        ├─ WO-07-006 (Skills section + detail + flow)      ← WO-07-001
        ├─ WO-07-007 (Agents section + detail + XP)        ← WO-07-002 + FRD-09 IF-09-agent-xp
        ├─ WO-07-008 (Decision rules section + detail)     ← WO-07-003
        └─ WO-07-009 (Standards section + detail)          ← WO-07-004
```

The four readers (001–004) are fully parallel. The four section WOs (006–009) are parallel once the
shell (005) exists and their respective reader is done.

## Work orders
| ID | Title | Deploy unit | Depends on |
|---|---|---|---|
| WO-07-001 | `lib/reference.ts` — read skills catalog | `lib/reference.ts` | FRD-01 |
| WO-07-002 | `lib/reference.ts` — read agents catalog | `lib/reference.ts` | FRD-01 |
| WO-07-003 | `lib/registry.ts` — read decision rules | `lib/registry.ts` | FRD-01 |
| WO-07-004 | `lib/standards.ts` — read standards (+ derivation fallback) | `lib/standards.ts` | FRD-01 |
| WO-07-005 | Configuration page shell + section tabs | `app/configuration/page.tsx` | FRD-13 |
| WO-07-006 | Skills section: list + detail + mini-flow | `components/config/skills*` | WO-07-001, WO-07-005 |
| WO-07-007 | Agents section: list + detail + XP bar | `components/config/agents*` | WO-07-002, WO-07-005, FRD-09 |
| WO-07-008 | Decision rules section: list + detail | `components/config/rules*` | WO-07-003, WO-07-005 |
| WO-07-009 | Standards section: categorized list + detail | `components/config/standards*` | WO-07-004, WO-07-005 |
</content>
