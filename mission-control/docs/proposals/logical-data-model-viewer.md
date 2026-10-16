# Logical data model viewer

Date: 2026-10-16 · Status: concept approved; mockup under visual review · Product: Mission Control

## Recommendation

Reuse the full **Arquitectura** surface in both the board and the portfolio's project workspace. Inside its existing **Modelo de datos** section, replace the entity-list presentation with one read-only logical entity–relationship viewer. Show entities/tables, all attributes, logical types, key roles, optionality, and explicitly declared relationship cardinalities. Give the diagram a large, expandable canvas with selectable tables and relationships. Treat visual readability as an acceptance requirement.

The owner approved the proposal in principle on 2026-10-16 and requested mockups before implementation. In the same design round, the owner explicitly replaced the proposed standalone database tab with full Architecture reuse in the portfolio. Both entry contexts now expose the same architecture content. This document is a proposed design, not an implemented feature, approved dependency installation, FRD, or build-state transition. The linked change request remains `draft` until the visual design and artifact contract are settled.

## Current integration points — inspected 2026-10-16

| Observed source | Present behavior | Proposed extension |
|---|---|---|
| `src/lib/architecture/architecture.ts` | `ArchDataModel` holds `isNone`, prose, and entity title/description pairs | Keep legacy narrative compatibility; read structured model separately |
| `src/app/board/_components/CardDetail/ArchitectureDigest/ArchitectureDigest.tsx` | `DataModel` renders entity cards and a no-database branch | Embed the shared viewer in the existing data-model section |
| `src/app/board/_utils/readCardProject.ts` | Resolves linked project paths and reads architecture artifacts for board cards | Use the same model reader as the workspace; avoid a digest dependency for model availability |
| `src/app/portfolio/page.tsx` | Embeds `ProjectWorkspace`, with URL-derived selection | Reuse the workspace Architecture tab, preserving selected project |
| `src/app/projects/[slug]/_components/tabbar.tsx` and `ProjectWorkspace.tsx` | Seven workspace tabs; no database tab | Add `architecture` once in the shared workspace and tab resolver; reuse full architecture content |
| `src/app/projects/[slug]/_observability/WoDag/` | Existing graph layout, zoom, and fullscreen code | Reuse suitable shell/control patterns; ER cardinalities require their own renderer |
| `package.json` | React/Next, YAML parser and Dagre installed; no React Flow, Mermaid or ELK dependency | Evaluate and pin new packages during architecture, not in this proposal |
| `docs/product/architecture.md` | Mission Control itself has no relational database; the filesystem is its data source | Its own architecture data-model section should state **Este proyecto no usa base de datos** |

The factory's `plugin/templates/docs/architecture-template.md` currently permits a small diagram **or a list**. `plugin/templates/docs/architecture-digest-template.md` asks for entity bullets. Neither establishes a machine-readable entity/attribute/cardinality contract. A renderer alone cannot recover missing semantics reliably.

## Experience

**Board:** Arquitectura → open project → Arquitectura → **Modelo de datos**. Replace the existing entity-list presentation when structured data is present. Include a prominent **Ampliar modelo** control; do not force the owner to inspect a miniature diagram inside the detail pane. Preserve the current architecture-stage default tab.

**Portfolio:** select a project in implementation → **Arquitectura**. Reuse the complete board Architecture content: stack, data model, services, environment-variable names, decisions and implementation plan. Also make this available for released projects. Direct project pages and the embedded portfolio workspace use the same architecture component and readers. Suggested deep links: `/portfolio?project=<slug>&tab=architecture` and `/projects/<slug>?tab=architecture`. There is no standalone Base de datos tab.

**Diagram:** entity/table cards with a clear header and attribute rows: name, logical type, PK/FK/unique role when applicable, and optional/required state. Relationship endpoints use crow's-foot markers plus readable `1`, `0..1`, `0..*`, `1..*` labels. Selecting an entity emphasizes its neighbors; selecting a relationship explains both directions in Spanish. Pan, zoom, fit-to-view and expansion are presentation-only interactions. Search by table or attribute should center the result.

**Many-to-many:** show the logical N:M relation when that is the declared model. When an association entity is declared (for example, Membership with `joined_at`), display it as an entity with its two 1:N relationships. Do not silently invent or hide join entities. Model the cardinality at **both** endpoints; “1:N” alone omits optionality.

**Visual direction:** retain Mission Control's RPG shell, typography and tokens; make the schema canvas quiet and readable. Use restrained accents for selection, not a different color for every table. Route connectors to the corresponding fields where mappings exist; otherwise connect to entity headers. Avoid decorative motion. At narrow widths, offer an entity list with complete details and textual relationships, plus optional expanded diagram; never shrink all text to fit.

## Research and technology decision

| Candidate | What the primary documentation establishes | Assessment for this feature |
|---|---|---|
| [Mermaid ER](https://mermaid.js.org/syntax/entityRelationshipDiagram.html) | Supports entity attributes, key markers and four cardinality endpoints | Good for portable documentation diagrams; richer per-attribute interaction and native product styling would need additional work |
| [React Flow database schema node](https://reactflow.dev/ui/components/database-schema-node) | Demonstrates table-shaped custom nodes with handles | Preferred interaction foundation; adapt the concept to MC tokens rather than adopting a second component system |
| [React Flow layout guide](https://reactflow.dev/learn/layouting/layouting) | Layout is external; Dagre places nodes, while ELK also routes edges | React Flow alone is not an automatic diagram layout solution |
| [ELK Layered](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html) | Supports orthogonal routing, ports, self-loops and multiple edges | Preferred initial layout candidate for variable-height tables and attribute-level connections |
| Existing SVG + Dagre in MC | Local code has graph interactions and a Dagre dependency | Fewer added dependencies, but ER endpoints, field ports, selection and accessibility would require custom work |

Recommendation: **React Flow + ELK**, subject to a bounded integration spike and visual approval. Implement custom cardinality endpoints and use ELK's routed bend points in custom edges; a default smooth-step edge would discard ELK's routing result. Disable connection editing, deletion and persistent schema modifications. Prefer stable computed positions over draggable tables in v1, avoiding stale routes after manual movement.

[React Flow's core license is MIT](https://raw.githubusercontent.com/xyflow/xyflow/main/LICENSE). No hosted diagram service or paid Pro example is required for the proposed approach. Dependency versions, compatibility, transitive dependencies and the license of any copied example must still be checked before installation. Lazy-load the viewer and layout engine only when opened. [React Flow offers keyboard and screen-reader support](https://reactflow.dev/learn/advanced-use/accessibility), but MC must localize its messages and verify the final implementation, including the textual alternative.

This recommendation is an engineering judgment from the documented capabilities, not a completed package integration or performance benchmark.

## Review mockup — round 1

The [navigable preview](../design/prototype/data-model-viewer/index.html) implements the owner's revised information architecture: complete Architecture content shared between the board and portfolio, with the ERD inside the existing data-model section. There is no standalone database tab. It uses an explicitly illustrative six-entity model, not a real project's schema.

The preview includes the stack matrix, services, environment-variable names, ADRs, implementation-plan summary and per-FRD cards in both contexts. It supports table/relationship selection, search, diagram/list, zoom and expansion, dark/light themes, mobile lists, and distinct unavailable states. [Verification evidence](../design/verification/data-model-viewer/a11y-report.md) covers this mockup only. Visual approval and the subsequent feature contracts/implementation remain pending.

## Artifact contract — proposed, not yet adopted

Introduce a versioned project-owned artifact at **`docs/product/data-model.json`**. It owns logical entities, attributes and business cardinalities. The architecture document links to it; the Spanish digest summarizes it without duplicating its schema. Both MC surfaces consume one validated server-side reader and one viewer.

Minimum contract:

- `schemaVersion`, `persistence: relational | document | none`, `entities`, `relationships`.
- Entity: stable ID, canonical name, optional display label/description, ordered attributes.
- Attribute: stable ID, name, logical type, optionality; key roles and composite key groups when applicable.
- Relationship: stable ID, explicit source/target entity IDs, endpoint `{ min: 0 | 1, max: 1 | many }` cardinalities, name, optional description, and optional ordered attribute mappings.
- Optional source references into schema/migration files; safe project-relative paths only.

For document databases use entities/documents, embedded/referenced semantics and declared logical links; do not manufacture relational tables or FK constraints. If the architecture needs richer non-relational semantics than this version can represent, show an explicit unsupported state rather than a misleading ERD.

Validation must reject duplicate IDs, dangling relationships, invalid cardinalities, malformed key groups or field mappings, excessive input size, and unsupported contract versions. A self-relation and two different relations between the same entities are valid. Render text as text, never executable diagram HTML or imported project code.

### Lifecycle and source of truth

1. **Architecture owns the designed model.** The architect writes the structured artifact with the architecture output. Existing projects need an explicit backfill from their reviewed architecture and schema; never infer relationships from column names alone.
2. **Implementation owns the operational schema.** The build keeps code and the logical artifact reconciled at its existing safe points. A stack-specific extractor can provide independent structural comparison later; the owner-facing reader must never execute arbitrary project code.
3. **Verification is separate evidence.** A future build-produced comparison receipt should bind the model hash and relevant schema-file hashes to its check result. MC derives “changed since verification” from mismatched inputs. Without such a receipt, show **Modelo diseñado · implementación sin verificar**, even during implementation or release. Do not introduce a manually maintained `verified` boolean or claim that timestamps prove freshness.
4. **Business semantics remain explicit.** Foreign keys, uniqueness and nullability help compare structure; they do not prove every business minimum-participation rule. Unknown semantics stay unknown; code extraction must not overwrite an authored business cardinality.

The first delivery can display the designed model across both surfaces with honest provenance. Generalized Prisma/Drizzle/SQL extraction and deployment-database introspection are separate work. No live credentials or row data are needed.

## Empty and error states

| Condition | Owner-facing result |
|---|---|
| Project explicitly declares no database | **Este proyecto no usa base de datos**; optional existing content-entity summary |
| Artifact missing in an older project | **Modelo lógico pendiente**; retain narrative summary when available |
| Present but malformed / unsupported | **No se pudo leer el modelo** with a bounded diagnostic; keep the rest of the project usable |
| Only a designed model is available | Show diagram with **Modelo diseñado · implementación sin verificar** |
| Verification inputs changed | **Cambios posteriores a la verificación**; continue showing the current designed model |

Artifact availability must not depend on the Spanish architecture digest existing. The surrounding Architecture panel should remain reachable when a valid model is the available architecture artifact. Missing, no-database, invalid and unverified are distinct states.

## Proposed acceptance criteria

These are proposal-level requirements for later FRD integration, not claims of passing tests.

- WHEN an architecture-stage board project has a valid logical model, THEN its Arquitectura tab SHALL expose all declared entities, attributes and relationships through the shared viewer.
- WHEN an implementation or released project is selected in the portfolio, THEN Arquitectura SHALL display the same complete architecture content and data model as the board and the standalone project workspace.
- WHEN the owner selects a relationship, THEN the viewer SHALL explain both endpoint cardinalities, including optionality, in Spanish.
- WHEN the model contains 1:1, optional 1:1, 1:N, N:M, a self-reference, multiple relationships or a composite-key mapping, THEN the viewer SHALL preserve the declared semantics without losing or inventing entities or fields.
- WHEN artifact input is missing, explicitly none, malformed or unsupported, THEN MC SHALL display the corresponding distinct state without crashing the board or portfolio.
- WHEN implementation verification is absent or stale, THEN MC SHALL expose that limitation beside the diagram.
- WHEN the owner uses keyboard navigation or a narrow viewport, THEN every entity, attribute and relationship SHALL remain accessible through a readable textual view.
- WHEN the owner opens or leaves fullscreen, changes tabs or changes selected project, THEN focus and project selection SHALL remain correct and another project's model SHALL NOT leak into the view.
- WHEN representative small and dense models are rendered in light/dark themes, THEN automated checks SHALL detect table overlap and connector intersections with unrelated tables, and browser review SHALL verify legible labels, non-overlapping endpoint markers and usable expansion.

Visual fixtures should include a small 4–6-entity model, a 30-entity model with variable field counts and long labels, and the cardinality edge cases above. These are proposed test inputs, not asserted production-project sizes. Measure layout latency and bundle impact in the spike before promising a performance threshold.

## Delivery boundaries and next step

1. **Design and feasibility:** approve an in-context mockup for both navigation contexts of the shared Architecture surface; spike custom ER endpoints, ELK routes and dense-model readability. Confirm the JSON contract and data producer ownership.
2. **Viewer and integration:** validated reader, shared viewer, board integration, full Architecture workspace tab, direct links, textual fallback, missing/invalid states and scoped tests. Integrate FRD-02 and FRD-04; add a dedicated FRD if the feature warrants it, plus FDD, blueprint/ADR and work orders through the normal change flow.
3. **Producer and backfill:** the architecture skill/template must emit the agreed artifact. That is a separate factory-tooling dependency (factory backlog/learn routing), with Manual documentation in its own change; do not silently alter the factory from a product queue item. Backfill selected existing projects with review. The UI can ship its pending state independently, but the feature is not end-to-end complete until at least one real database project produces a valid model.

Potential later work: schema comparison adapters, model diffs, file export and manual layout persistence. Keep v1 focused on reliable viewing. The full proposal requires owner visual approval before implementation; there is no production deployment or build execution in this research turn.
