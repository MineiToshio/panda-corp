import type { DataModel } from "@/lib/architecture/data-model/types";

/** Independent review fixture: stable IDs differ from labels; parallel, composite and self links. */
export function dataModelFixture(): DataModel {
  return {
    schemaVersion: 1,
    persistence: "relational",
    entities: [
      {
        id: "person",
        name: "Persona",
        description: "Personas registradas",
        attributes: [
          { id: "tenant", name: "organization_id", type: "UUID", optional: false },
          { id: "key", name: "person_id", type: "UUID", optional: false },
          { id: "boss", name: "manager_id", type: "UUID", optional: true, keys: ["FK"] },
        ],
        keyGroups: [{ kind: "PK", attributes: ["tenant", "key"] }],
      },
      {
        id: "task",
        name: "Tarea",
        attributes: [
          { id: "tenant", name: "organization_id", type: "UUID", optional: false },
          { id: "author", name: "author_id", type: "UUID", optional: false, keys: ["FK"] },
          { id: "reviewer", name: "reviewer_id", type: "UUID", optional: true, keys: ["FK"] },
        ],
      },
      { id: "isolated", name: "Registro aislado", attributes: [] },
    ],
    relationships: [
      {
        id: "authored",
        name: "Autoría",
        from: { entity: "task", attributes: ["tenant", "author"], min: 0, max: "many" },
        to: { entity: "person", attributes: ["tenant", "key"], min: 1, max: 1 },
      },
      {
        id: "reviewed",
        name: "Revisión",
        from: { entity: "task", attributes: ["tenant", "reviewer"], min: 0, max: "many" },
        to: { entity: "person", attributes: ["tenant", "key"], min: 0, max: 1 },
      },
      {
        id: "managed",
        name: "Supervisión",
        from: { entity: "person", attributes: ["boss"], min: 0, max: "many" },
        to: { entity: "person", attributes: ["key"], min: 0, max: 1 },
      },
    ],
  };
}
