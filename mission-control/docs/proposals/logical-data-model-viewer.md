# Logical data model viewer

Date: 2026-10-16 · Status: implemented and independently reviewed · Product: Mission Control

## Decision and experience

Reuse the complete **Arquitectura** surface in board cards, the portfolio's selected-project workspace and direct project pages. Keep the existing **Modelo de datos** heading and all stack, services, environment, ADR, implementation-plan and per-FRD sections. There is no separate database-only tab. The workspace order is **Resumen · Spec · Work orders · Arquitectura · Cambios · Party · Observabilidad · Documentos · Comandos**; deep links use `/portfolio?project=<slug>&tab=architecture` and `/projects/<slug>?tab=architecture`.

Inside **Modelo de datos**, show a compact read-only logical ER diagram by default at every viewport width. Entity cards size to complete text without truncation, headers 38px, attribute rows 24px and field text 12px. Show all declared fields, logical types, optionality, PK/FK/UQ roles, composite groups and explicit `1`, `0..1`, `0..*`, `1..*` endpoint cardinalities. Preserve association entities, isolated entities, self-relations and parallel edges; never infer or invent joins.

Drag the canvas background with native pointer capture to pan; provide keyboard arrows and labelled directional controls, zoom, fit/reset, search, selection and **Ampliar modelo** with modal focus/Escape behavior. Canvas navigation does not depend on scrollbars. The **Esquema** alternative uses compact Prisma-like textual model blocks with full key/cardinality semantics. It is a viewing representation, not executable Prisma or HTML attribute tables. Both modes consume the same model.

The scoped [round-2 prototype](../design/prototype/data-model-viewer/index.html) is the implementation's feature reference. Round-1 mockups are archived design history. Existing whole-app visual sources still own the surrounding shell. Mockup checks establish mockup behavior only; current product checks and real-project data evidence must be recorded separately.

## Technical decision

Use native DOM/SVG plus `elkjs@0.12.0` for layered orthogonal fixed-field-port routing (ADR-0007). Dagre continues serving work-order graphs. Custom field ports and cardinality labels preserve model semantics. `src/components/modules/DataModelViewer/` owns the shared viewer; `src/lib/architecture/data-model/{types,model,read-data-model}.ts` owns types/validation/server reads. `src/lib/architecture/read-artifacts.ts` supplies one complete Architecture bundle to board and workspace. The ELK API loads with its algorithm worker only for model layout.

The initial research preferred React Flow + ELK. Native DOM/SVG remains the renderer; the owner’s later actual-project readability correction adopts ELK for routing alone, without React Flow. The alternatives remain useful context: [React Flow's schema-node example](https://reactflow.dev/ui/components/database-schema-node) demonstrates custom nodes, [its layout guide](https://reactflow.dev/learn/layouting/layouting) separates rendering from layout, [ELK Layered](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html) supports port-aware routing, and [Mermaid ER](https://mermaid.js.org/syntax/entityRelationshipDiagram.html) provides portable attribute/cardinality notation. These are researched alternatives, not installed dependencies or performance claims. Native rendering keeps the existing stack but requires explicit focus, accessibility, selection and edge-routing checks. The accepted rationale is [ADR-0006](../adr/ADR-0006-shared-logical-data-model-viewer.md).

## Artifact, truth and error states

The project-owned canonical source is **`docs/product/data-model.json`**:

- `schemaVersion: 1`, `persistence: relational | document | none`, `entities`, `relationships`.
- Entity: `{ id, name, description?, attributes, keyGroups? }`.
- Attribute: `{ id, name, type, optional, keys?: (PK | FK | UQ)[] }`.
- Key group: `{ kind: PK | UQ, attributes: string[] }` referencing local attribute IDs.
- Relationship: `{ id, name?, description?, from, to }`; each endpoint is `{ entity, attributes?, min: 0 | 1, max: 1 | many }`. Both ordered field mappings, when present, must have equal arity.

The bounded server reader validates unknown/unsupported fields/versions, duplicate IDs, references, key groups, endpoint cardinalities and malformed UTF-8 JSON. Invalid data is never recast as empty. It never executes project code. Document persistence uses declared logical entities/links, without manufacturing SQL constraints. MC itself declares `persistence: none` with empty arrays; relational examples belong to tests/preview only.

| Source state | Owner-facing behavior |
|---|---|
| Missing | Published model pending; retain available narrative |
| Explicit none | State that the project does not need persistence |
| Ready with zero entities | Explicit published empty-model state |
| Malformed, oversized, unsupported or unreadable | Inline error/diagnostic; retain other Architecture sections |
| Ready model | Diagram/Esquema with **Modelo diseñado. Implementación sin verificar.** |

A present structured artifact keeps Architecture available even if the narrative digest is missing. A missing JSON source may preserve a legacy narrative's explicit no-database branch; invalid JSON never silently uses that fallback. Phase, work-order state and timestamps cannot prove the operational schema. A comparison receipt/schema extractor would be a later, independently verified capability, not a manually maintained flag in this contract.

## Delivery and dependency boundary

The canonical acceptance criteria are now [FRD-02 REQ-02-013/015](../frds/frd-02-ideas-board/frd.md) and [FRD-04 REQ-04-012](../frds/frd-04-project-workspace/frd.md), with aligned FDDs, blueprints, API and coarse work orders. WO-02-007 owns shared model reading/rendering and board integration; WO-04-004 owns workspace navigation/mounting. Existing machine-status fields and historical gate notes are not evidence that this extension passed.

Current product checks passed: the canonical 11-subgate verification, four dedicated desktop/mobile E2E cases, and independent adversarial/runtime/accessibility review. See the [delivery report](../reviews/logical-data-model-viewer/delivery.md) and [independent review](../reviews/logical-data-model-viewer/review.md). The round-2 prototype remains separate design evidence.

The factory architecture skill/template producer is a **separate factory-tooling dependency**. Existing database projects require reviewed backfill; the consumer never silently generates invented schemas. MC can expose useful pending/none states independently, but a real database-project producer round trip remains unverified until that separate dependency supplies evidence. General schema extraction/comparison, live database introspection, export and persisted manual layout are outside this delivery.

Current readability correction supersedes the round-2 mockup’s fixed widths, inset whole-viewer expansion and lower relation inspector. Full-window mode shows only the graph and floating controls. The initial camera centers a readable connected table rather than shrinking all 39 tables; Ajustar explicitly provides the whole-model overview.

Current navigation follows the owner-selected Architecture dependency map: shared top-right GraphControls icons and browser-native fullscreen first, with the graph-only full-window dialog as fallback. Fine wheel input, 15% button zoom and animation-frame camera batching maintain usable movement without recreating field tables. ADR-0008 supersedes the separate control design; the logical artifact/ELK requirements remain unchanged.

Current owner usability amendment (2026-10-17, ADR-0009): relationship activation toggles the selected connector off on repetition; diagram entity text cannot be selected, while schema code remains copyable. Esquema uses one full-width column of initially closed native entity accordions, opening one at a time with natural heights. Shared Architecture places Integraciones y operación immediately after Stack and before Modelo de datos, retaining all authored operational facts. Fluid shell/digest panels use available width; intro prose alone retains reading limits. Integrated phone/tablet navigation is owned by FRD-19. See the current [delivery report](../reviews/architecture-responsive-usability/delivery.md); prior delivery evidence remains historical.
