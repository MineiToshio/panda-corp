import type { DataModel, DataModelResult } from "@/lib/architecture/data-model/types";

/** Illustrative relational model with distinct display names and field IDs. */
export function modelFixture(): DataModel {
  return {
    schemaVersion: 1,
    persistence: "relational",
    entities: [
      {
        id: "account",
        name: "Account",
        description: "Cuenta de ejemplo",
        attributes: [
          { id: "id", name: "accountId", type: "uuid", optional: false, keys: ["PK"] },
          { id: "email", name: "email", type: "text", optional: true, keys: ["UQ"] },
        ],
      },
      {
        id: "entry",
        name: "Entry",
        attributes: [
          { id: "id", name: "entryId", type: "uuid", optional: false, keys: ["PK"] },
          { id: "owner", name: "ownerId", type: "uuid", optional: false, keys: ["FK"] },
          { id: "reviewer", name: "reviewerId", type: "uuid", optional: true, keys: ["FK"] },
        ],
        keyGroups: [{ kind: "UQ", attributes: ["owner", "reviewer"] }],
      },
      {
        id: "audit",
        name: "Audit",
        attributes: [{ id: "id", name: "auditId", type: "uuid", optional: false }],
      },
    ],
    relationships: [
      {
        id: "ownership",
        name: "Propiedad",
        from: { entity: "account", attributes: ["id"], min: 1, max: 1 },
        to: { entity: "entry", attributes: ["owner"], min: 0, max: "many" },
      },
      {
        id: "review",
        name: "Revisión",
        from: { entity: "account", attributes: ["id"], min: 0, max: 1 },
        to: { entity: "entry", attributes: ["reviewer"], min: 0, max: "many" },
      },
      {
        id: "self",
        name: "Referencia propia",
        from: { entity: "entry", attributes: ["owner"], min: 0, max: 1 },
        to: { entity: "entry", attributes: ["reviewer"], min: 0, max: "many" },
      },
    ],
  };
}

/** Ready result for UI tests without reading any owner's project. */
export function readyFixture(): DataModelResult {
  return { kind: "ready", source: "docs/product/data-model.json", model: modelFixture() };
}
