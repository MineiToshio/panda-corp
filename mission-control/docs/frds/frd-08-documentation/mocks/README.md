# FRD-08 mocks — Documentation · the Manual ("Códice del gremio")

**Visual source = the Manual view of `docs/design/prototype/index.html`** (the owner-approved whole-app
prototype — DR-054/056), rendered by:

- `manualView()` — the navigable shell: `gxHero` banner + a **sticky** `panel` side nav (grouped
  `.navitem`s under the four Diátaxis group headers) + the reading area.
- `manualContent(id)` — routes the selected page to its reader kind:
  - **Empezar aquí** → `manualLanding()` + `manualQuickstart()`;
  - **Guías** → `manualGuide(id)` / `guiaDoc()`;
  - **Referencia** → `refSection(sec)` (reuses the Configuración cards + `configDetail`);
  - **Conceptos** → `docPage(p)` incl. the **Autoaprendizaje** page (`docPage` p=14).
- Diagrams: `pipelineDiagram`, `teamDiagram`, `channelsDiagram`, `archDiagram`, `cockpitDataDiagram`,
  `snapshotMini`; helpers `docH`, `docCmd`; nav data `MANUALNAV`.

This is the Manual surface only (a single FRD's screens), not the whole app. The design on the frozen
tokens (the PDD) is documented in `../fdd.md`.

> **The Reference catalogs are AUTO-DERIVED (DR-046).** In the real app the Comandos / Agentes /
> Reglas / Estándares catalogs are read at build/read time from the canonical source
> (`plugin/skills/`, `plugin/agents/` frontmatter, `factory/decisions/registry.yaml`,
> `factory/standards/`) — never a hand-maintained copy. The prototype's `CONFIG.*` arrays are the
> hand-kept stand-in. The design here is the **navigable shell + the readers + the derived catalogs**.
>
> Fidelity, not novelty: nothing is relaxed or re-styled — the visual is transcribed from the approved
> prototype. **A scoped self-contained HTML slice + a baseline screenshot are captured by the build's
> visual-fidelity gate** (DR-055/056); this re-anchor pass is documentation-only.
