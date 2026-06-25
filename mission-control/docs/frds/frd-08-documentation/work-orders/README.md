# FRD-08 — Documentation (Manual) · work orders

Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
See the [feature blueprint](../blueprint.md) and the [platform architecture](../../../product/architecture.md).

TDD: RED → GREEN → refactor. The Reference catalogs **reuse FRD-07's readers** (no new reader for
them); only `lib/manual.ts` (authored-content index) is new.

## Cross-feature dependencies
- **FRD-07** — `IF-07-reference` (`readSkills`/`readAgents`), `IF-07-registry`
  (`readDecisionRules`), `IF-07-standards` (`readStandards`). The Reference WOs depend on those
  readers existing (FRD-07 WO-07-001..004). **Do not duplicate them** (DR-046).
- **FRD-01** — `lib/config.ts` foundation + fixture pattern.
- **FRD-13** — design tokens; all UI WOs depend on tokens.
- **FRD-02** — `CopyButton` for inline command chips.

## Order & parallelization (Phase 2)

The UI work orders (shell + two Reference + concept content) were **collapsed into one coarse WO**
(WO-08-002); `lib/manual.ts` stays VERIFIED and is consumed as-is. See the blueprint's **Build Plan
(Phase 2)**.

```
WO-08-001 (lib/manual: authored-content index)  VERIFIED (consumed as-is)
        │
        ▼
WO-08-002 (Documentación UI surface)  ← foundation-first: FRD-13 (WO-13-006/007/008) → FRD-07 (WO-07-005 cards) → here
```
The Referencia **reuses FRD-07's catalog cards verbatim** (DR-057) and derives the catalogs through
FRD-07's readers (DR-046), so WO-08-002 builds **after** FRD-07's UI WO.

## Work orders
| ID | Title | Deploy unit | Status | Depends on |
|---|---|---|---|---|
| WO-08-001 | `lib/manual.ts` — index authored Manual content | `lib/manual.ts` | VERIFIED | WO-01-001 |
| WO-08-002 | Documentación UI surface (re-anchor to prototype) | `src/app/manual/**` | VERIFIED | WO-08-001, WO-07-005, WO-07-001, WO-07-003, WO-07-004, WO-13-006, WO-13-007, WO-13-008 |
</content>
