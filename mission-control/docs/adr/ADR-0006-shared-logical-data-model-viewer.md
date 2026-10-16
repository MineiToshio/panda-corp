# ADR-0006 — Shared Architecture and logical data-model viewer

- **Status:** Accepted for the owner-authorized implementation scope
- **Date:** 2026-10-16
- **Decision agent/runtime:** OpenAI Codex, documenting the owner's requested behavior
- **Traces:** FRD-02 REQ-02-013/015; FRD-04 REQ-04-012

## Context

Board cards already have a complete Architecture digest with stack, data-model narrative, services, environment-variable names, ADRs, live work-order dependency graph and per-FRD cards. The owner requested that complete surface in the portfolio/direct workspace too, with an inspectable logical model inside **Modelo de datos**. Narrative entity bullets cannot reliably establish fields, key groups, mapped attributes or both endpoint cardinalities. Mission Control itself uses filesystem state and has no database.

## Decision

Reuse the complete existing `ArchitectureDigest` in both contexts and a single `readArchitectureArtifacts(projectPath)` server reader. The workspace order is **Resumen · Work orders · Arquitectura · Cambios · Party · Observabilidad · Documentos · Comandos**. Architecture is not replaced by a standalone database tab. A structured model can make board Architecture available even when no narrative digest exists.

The canonical project-owned artifact is `docs/product/data-model.json`, validated against the version-1 consumer contract before crossing the server/client boundary:

```ts
type Attribute = {
  id: string; name: string; type: string; optional: boolean;
  keys?: ("PK" | "FK" | "UQ")[];
};
type Entity = {
  id: string; name: string; description?: string; attributes: Attribute[];
  keyGroups?: { kind: "PK" | "UQ"; attributes: string[] }[];
};
type Endpoint = {
  entity: string; attributes?: string[]; min: 0 | 1; max: 1 | "many";
};
type Relationship = {
  id: string; name?: string; from: Endpoint; to: Endpoint; description?: string;
};
type Artifact = {
  schemaVersion: 1; persistence: "relational" | "document" | "none";
  entities: Entity[]; relationships: Relationship[];
};
```

IDs are stable and unique in their scope. Endpoint/entity, field and composite-key references must resolve. Attribute mappings are ordered and appear on both endpoints with matching arity. Endpoint `min/max` produces exactly `1`, `0..1`, `0..*` or `1..*`. Self/parallel relationships, isolated entities and explicit association entities remain intact. `none` requires empty entities/relationships. Document persistence uses declared logical links; MC invents no SQL constraints or join entities.

`src/lib/architecture/data-model/types.ts` owns serializable types, `model.ts` owns pure validation, and `read-data-model.ts` owns the server-only, read-only file boundary. The file is bounded to 1 MiB and the parser rejects unsupported versions, unknown properties, duplicate IDs, invalid key/cardinality/reference mappings and malformed JSON. `DataModelResult` discriminates `ready | none | missing | error`; usable models with zero entities remain an explicit empty view. Invalid sources never become missing or a valid empty graph. A missing JSON source may preserve an existing narrative's explicit no-database declaration; invalid JSON never silently falls back to it.

Use native DOM/SVG plus the already-installed Dagre dependency. Keep entity cards 248px wide, headers 38px high, rows 24px high and field text 12px, expressed through feature tokens. **Diagrama** is the default at all widths. Native pointer capture pans the background-transformed stage; labelled controls and keyboard arrows give equivalent movement, with zoom/fit/reset, search, selection and expanded modal focus handling. **Esquema** shows compact Prisma-like textual model blocks and explicit cardinalities from the same data; it is not an HTML attribute table or an executable Prisma schema.

## Alternatives and trade-offs

The initial proposal preferred React Flow + ELK for node controls and port-aware orthogonal routing. The owner's compact native-canvas direction supersedes that recommendation: the application already has Dagre and DOM/SVG experience, the model is read-only and fixed-layout, and adding two graph engines would increase dependency/interaction surface. Native rendering requires explicit accessibility, focus, selection, cardinality endpoints and edge-routing checks; those costs remain visible in the FRD. Mermaid is appropriate for portable static diagrams but does not provide this attribute/search/selection product contract. Reusing the work-order DAG as an ERD would lose field/key/cardinality semantics, so only the layout dependency/patterns are reused.

## Consequences and boundaries

- One model artifact, one validator/reader and one viewer serve board, portfolio and direct project pages.
- Every other Architecture section remains; missing narrative does not suppress a present model/error state.
- MC's own artifact declares `persistence: none`; previews/tests alone use illustrative relational fixtures.
- A usable model states **Modelo diseñado. Implementación sin verificar.** No phase, timestamp or manually authored flag proves the operational schema. Schema extraction, verification receipts and live introspection remain future work.
- The factory architecture skill/template must separately adopt the artifact as a producer; reviewed backfill belongs to that factory change. Product implementation does not silently alter factory tooling or claim every project already emits the source.
- The scoped visual reference is `docs/design/prototype/data-model-viewer/index.html` (round 2). Verification evidence must distinguish prototype review, product checks and actual project-produced data; this ADR itself certifies none of them.
