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

## Order & parallelization

```
WO-08-001 (lib/manual: authored-content index)  ← FRD-01
        │
        ▼
WO-08-002 (Manual page shell + side menu + reader)  ← FRD-13, WO-08-001
        │
        ├─ WO-08-003 (Reference: commands + agents)   ← FRD-07 readers
        ├─ WO-08-004 (Reference: rules + standards)   ← FRD-07 readers
        └─ WO-08-005 (Tutorial/Guides/Concepts content, incl. DR-049 structure page)  ← WO-08-001
```

WO-08-003/004/005 are parallel once the shell (002) exists. 003/004 additionally need the FRD-07
readers; 005 needs only the authored content + index.

## Work orders
| ID | Title | Deploy unit | Depends on |
|---|---|---|---|
| WO-08-001 | `lib/manual.ts` — index authored Manual content | `lib/manual.ts` (new) | FRD-01 |
| WO-08-002 | Manual page shell: side menu (Diátaxis) + reader | `app/manual/page.tsx` | FRD-13, WO-08-001 |
| WO-08-003 | Reference: commands + agents (derived) | `components/manual/reference*` | FRD-07 (001/002), WO-08-002 |
| WO-08-004 | Reference: decision rules + standards (derived) | `components/manual/reference*` | FRD-07 (003/004), WO-08-002 |
| WO-08-005 | Tutorial/Guides/Concepts content (+ DR-049 structure page) | `content/manual/**` | WO-08-001, WO-08-002 |
</content>
