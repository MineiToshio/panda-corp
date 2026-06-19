# FRD-07 mocks — Configuration

**Visual source = the Configuración view of `docs/design/prototype/index.html`** (the owner-approved
whole-app prototype — DR-054/056), rendered by:

- `configView()` — the section landing: `gxHero` banner + the four `.stab` section sub-tabs
  (Skills · Agentes · Reglas · Estándares) + the `secthead`-grouped card grid.
- `configDetail()` — the per-item detail: `← Volver` + `panel` header + `cfgTabs` (Resumen / Detalle).
- Per-kind card builders: `gxSkillCard`, `gxAgentCard`, `gxRuleCard`, `gxStdCard`.
- Skill mini-flow graph: `flowDiagram` + `flowNode` + `agentChips`; helpers `secthead`, `avatar`,
  `sevBadge`, `enfBadge`, `cfgTabs`.
- Reference data: the `CONFIG.{skills,agents,rules,estandares}` arrays + `AGMETA` (agent level/XP) +
  `AVCOL` (per-agent color).

This is the Configuración surface only (a single FRD's screens), not the whole app. The design on the
frozen tokens (the PDD) is documented in `../fdd.md`.

> Fidelity, not novelty: nothing is relaxed or re-styled — the visual is transcribed from the approved
> prototype. **A scoped self-contained HTML slice + a baseline screenshot are captured by the build's
> visual-fidelity gate** (DR-055/056); this re-anchor pass is documentation-only and points the
> implementer at the exact render functions above.
>
> In the real app the four Reference catalogs are **read live** from the factory (`plugin/skills/`,
> `plugin/agents/`, `factory/decisions/registry.yaml`, `factory/standards/`) — the prototype's
> `CONFIG.*` arrays are a hand-kept stand-in for that derivation (DR-046). Read-only either way.
