---
description: Keep the published logical data model current with every schema change, for every stack.
applies_when: always
globs: ["**/*"]
source: Pandacorp standard — data-modeling (DATA-7)
---

# Published logical data model — DATA-7

## Update it in the same change (MUST)

Every project publishes **`docs/product/data-model.json`**, the single structured input used by Mission Control's **Modelo de datos** section inside the shared Arquitectura tab (board and portfolio). This rule applies to every stack, ORM, SQL or document store, including projects with no database.

- `architecture` creates it from the approved platform model and refreshes it on every model revision. Before implementation it describes the approved design; after implementation, the current checked-in schema/model definitions are the authority for the implemented shape. Keep planned schema changes together with their implementation, rather than publishing an unimplemented future schema as current code.
- Any change that adds, removes, renames or changes an entity/table/collection, attribute or logical type, nullability, PK/FK/UQ or composite key, relation, endpoint field mapping or cardinality **MUST update the artifact in the same work order/change and commit**. Adding or removing persistence is also a model change. Update the architecture/affected blueprint and decision log when their facts change. Update the Spanish Architecture digest when its narrative changes; it is not the structured source.
- The agent editing the canonical schema owns regeneration/update of this artifact. The independent reviewer checks schema → artifact correspondence before the change closes. This includes implementation, fixes, iterations and direct/manual edits reconciled by `sync`, before and after launch. An unchanged logical shape (e.g. a data-only migration or a physical index with no logical constraint change) needs no JSON churn: record why it is unchanged in review evidence.
- Prefer a deterministic project-local exporter from the canonical schema when one exists. Otherwise inspect the actual definitions/migrations and update the artifact explicitly, with independent review. Never infer relationships merely from field names, invent entities to fill gaps, or connect to production to read rows. Never manufacture a schema-verification flag, timestamp or receipt.
- Both viewer modes and both entry points read this one artifact. Do not maintain a second diagram, Prisma-like display copy or portfolio-specific model by hand. Mission Control displays a designed model with implementation unverified; this rule does not turn it into live-database verification.
- A legacy project without an artifact must publish one when its model is next created/changed or deliberately backfilled. Until then it remains visibly pending. Do not retrofit or overwrite unrelated projects during an upgrade; never use `persistence: none` to conceal missing knowledge. A no-database project publishes explicit none as below.

## Version-1 publishing contract

JSON only, UTF-8, at most 1 MiB; no secrets, connection strings or records. Root keys are exactly `schemaVersion`, `persistence`, `entities`, `relationships`. Do not add `$schema`, a verification flag or provider-specific top-level metadata.

- `schemaVersion`: `1`; `persistence`: `relational`, `document` or `none`.
- Entity: `id`, `name`, optional `description`, ordered `attributes`, optional `keyGroups`. At most 100 entities. Keep authored IDs stable when the concept is unchanged.
- Attribute: `id`, `name`, `type` (logical string), `optional` (boolean), optional `keys` (unique values from `PK`, `FK`, `UQ`). At most 100 attributes per entity. References use IDs, not labels.
- Key group: `kind` (`PK` or `UQ`), ordered `attributes` (local attribute IDs). Preserve composite groups, rather than marking each participating field individually unique.
- Relationship: `id`, optional `name`/`description`, `from`, `to`. At most 400 relationships. Each endpoint has `entity` (entity ID), optional ordered `attributes` (local attribute IDs), `min` (`0` or `1`) and `max` (`1` or `"many"`). Supply mappings on both endpoints or neither; when present, they must be nonempty, duplicate-free and have equal arity. Declare both cardinalities explicitly. Preserve self/parallel links and real association entities.
- Text must be nonblank: IDs/types at most 120 characters, names at most 200, descriptions at most 4000. At most 100 key groups per entity, with at most one PK group and no duplicate group; each reference list contains 1–100 unique local attribute IDs.
- Reject duplicate IDs, dangling references, unknown properties and invalid key/cardinality declarations. A published empty model and explicit none are different; none requires both arrays empty.

No database (only after establishing that fact):

```json
{"schemaVersion":1,"persistence":"none","entities":[],"relationships":[]}
```

Small logical example; replace with the project's real entities and mappings, never copy sample data as its schema. Here each profile has exactly one user; each user has zero or one profile:

```json
{
  "schemaVersion": 1,
  "persistence": "relational",
  "entities": [
    {"id":"user","name":"User","attributes":[{"id":"id","name":"id","type":"uuid","optional":false,"keys":["PK"]}]},
    {"id":"profile","name":"Profile","attributes":[{"id":"id","name":"id","type":"uuid","optional":false,"keys":["PK"]},{"id":"userId","name":"userId","type":"uuid","optional":false,"keys":["FK","UQ"]}]}
  ],
  "relationships": [
    {"id":"user-profile","from":{"entity":"user","attributes":["id"],"min":1,"max":1},"to":{"entity":"profile","attributes":["userId"],"min":0,"max":1}}
  ]
}
```

## Verification and closure

The architecture readiness verifier and FRD/change reviewer open the canonical schema or approved model **and** this artifact, compare all changed fields/keys/mappings/cardinalities, and record the source paths and pass/fail result. A missing, invalid or stale artifact for a model-changing change is a **correctness blocker**, not a visual nit. Run the project's exporter/validator and regression checks when available. A JSON parser or a touch/modified timestamp alone does not prove correspondence; unsupported generators require explicit reviewed comparison. No schema change is done while this published model is stale.
