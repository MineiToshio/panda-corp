import { describe, expect, it } from "vitest";
import { validateDataModel } from "../model";

// A tenancy-aware schema exercises two FKs between the same tables and a composite identity.
function projectSchema() {
  return {
    schemaVersion: 1,
    persistence: "relational",
    entities: [
      {
        id: "users",
        name: "Usuarios",
        attributes: [
          { id: "tenant", name: "tenant_id", type: "uuid", optional: false, keys: ["PK"] },
          { id: "id", name: "id", type: "uuid", optional: false, keys: ["PK"] },
          { id: "manager", name: "manager_id", type: "uuid", optional: true, keys: ["FK"] },
        ],
        keyGroups: [{ kind: "PK", attributes: ["tenant", "id"] }],
      },
      {
        id: "tasks",
        name: "Tasks",
        attributes: [
          { id: "tenant", name: "tenant_id", type: "uuid", optional: false },
          { id: "author", name: "author_id", type: "uuid", optional: false, keys: ["FK"] },
          { id: "reviewer", name: "reviewer_id", type: "uuid", optional: true, keys: ["FK"] },
        ],
      },
    ],
    relationships: [
      {
        id: "author",
        name: "Created by",
        from: { entity: "tasks", attributes: ["tenant", "author"], min: 0, max: "many" },
        to: { entity: "users", attributes: ["tenant", "id"], min: 1, max: 1 },
      },
      {
        id: "reviewer",
        from: { entity: "tasks", attributes: ["tenant", "reviewer"], min: 0, max: "many" },
        to: { entity: "users", attributes: ["tenant", "id"], min: 0, max: 1 },
      },
      {
        id: "manager",
        from: { entity: "users", attributes: ["manager"], min: 0, max: "many" },
        to: { entity: "users", attributes: ["id"], min: 0, max: 1 },
      },
    ],
  };
}

function at<T>(values: readonly T[], index = 0): T {
  const value = values[index];
  if (value === undefined) throw new Error("Missing fixture member");
  return value;
}

describe("validateDataModel", () => {
  it("preserves entities, composite keys, parallel relationships and self relationships", () => {
    const raw = projectSchema();
    expect(validateDataModel(raw)).toEqual({
      kind: "ready",
      model: raw,
      source: "docs/product/data-model.json",
    });
  });

  it("distinguishes explicit no persistence from an intentionally empty document model", () => {
    expect(
      validateDataModel({ schemaVersion: 1, persistence: "none", entities: [], relationships: [] }),
    ).toEqual({ kind: "none" });
    expect(
      validateDataModel({
        schemaVersion: 1,
        persistence: "document",
        entities: [],
        relationships: [],
      }),
    ).toMatchObject({ kind: "ready", model: { entities: [] } });
  });

  it.each([
    null,
    [],
    {},
    { schemaVersion: 1, persistence: "relational", entities: "users", relationships: [] },
    { schemaVersion: 1, persistence: "none", entities: [{ id: "unexpected" }], relationships: [] },
    { schemaVersion: 1, persistence: "sqlite", entities: [], relationships: [] },
  ])("fails loudly on malformed artifact %j", (raw) => {
    expect(validateDataModel(raw).kind).toBe("error");
  });

  it("reports unsupported schema versions distinctly", () => {
    expect(validateDataModel({ ...projectSchema(), schemaVersion: 2 })).toEqual({
      kind: "error",
      message: "Unsupported data model schemaVersion; expected 1.",
    });
  });

  it.each([
    [
      "duplicate entity",
      (raw: ReturnType<typeof projectSchema>) => raw.entities.push(at(raw.entities)),
    ],
    [
      "duplicate attribute",
      (raw: ReturnType<typeof projectSchema>) =>
        at(raw.entities).attributes.push({ ...at(at(raw.entities).attributes), keys: [] }),
    ],
    [
      "duplicate relationship",
      (raw: ReturnType<typeof projectSchema>) => raw.relationships.push(at(raw.relationships)),
    ],
    [
      "unknown entity",
      (raw: ReturnType<typeof projectSchema>) => {
        at(raw.relationships).to.entity = "missing";
      },
    ],
    [
      "unknown attribute",
      (raw: ReturnType<typeof projectSchema>) => {
        at(raw.relationships).to.attributes = ["tenant", "missing"];
      },
    ],
    [
      "unpaired mapping",
      (raw: ReturnType<typeof projectSchema>) => {
        at(raw.relationships).to.attributes = ["id"];
      },
    ],
    [
      "unknown key group attribute",
      (raw: ReturnType<typeof projectSchema>) => {
        at(at(raw.entities).keyGroups ?? []).attributes = ["missing"];
      },
    ],
    [
      "repeated key group attribute",
      (raw: ReturnType<typeof projectSchema>) => {
        at(at(raw.entities).keyGroups ?? []).attributes = ["id", "id"];
      },
    ],
  ])("rejects %s", (_label, mutate) => {
    const raw = projectSchema();
    mutate(raw);
    expect(validateDataModel(raw).kind).toBe("error");
  });

  it.each([
    { id: "id", name: "id", type: "uuid" },
    { id: "id", name: "id", type: "uuid", optional: "false" },
    { id: "id", name: "id", type: "uuid", optional: false, keys: ["INDEX"] },
    { id: "id", name: "id", type: "uuid", optional: false, keys: ["PK", "PK"] },
    { id: "id", name: "id", type: "uuid", optional: false, typo: true },
  ])("rejects malformed attributes %j", (attribute) => {
    expect(
      validateDataModel({
        ...projectSchema(),
        relationships: [],
        entities: [{ id: "test", name: "Test", attributes: [attribute] }],
      }).kind,
    ).toBe("error");
  });

  it.each([
    { entity: "users", min: 2, max: "many" },
    { entity: "users", min: 0, max: 0 },
    { entity: "users", min: 0, max: "1" },
    { entity: "users", min: 0, max: 1, attributes: [] },
  ])("rejects malformed endpoints %j", (endpoint) => {
    expect(
      validateDataModel({
        ...projectSchema(),
        relationships: [{ id: "invalid", from: endpoint, to: endpoint }],
      }).kind,
    ).toBe("error");
  });

  it("rejects oversized collections before parsing members", () => {
    expect(validateDataModel({ ...projectSchema(), entities: Array(101).fill(null) }).kind).toBe(
      "error",
    );
  });

  it("accepts document references without attribute mappings", () => {
    const raw = projectSchema();
    expect(
      validateDataModel({
        ...raw,
        persistence: "document",
        relationships: [
          {
            id: "contains",
            from: { entity: "users", min: 0, max: 1 },
            to: { entity: "tasks", min: 0, max: "many" },
          },
        ],
      }).kind,
    ).toBe("ready");
  });

  it("rejects a mapping supplied at only one endpoint", () => {
    const raw = projectSchema();
    expect(
      validateDataModel({
        ...raw,
        relationships: [
          {
            id: "contains",
            from: { entity: "users", attributes: ["id"], min: 0, max: 1 },
            to: { entity: "tasks", min: 0, max: "many" },
          },
        ],
      }).kind,
    ).toBe("error");
  });

  it("rejects multiple primary key groups and unknown key kinds", () => {
    const raw = projectSchema();
    const users = at(raw.entities);
    for (const keyGroups of [
      [
        { kind: "PK", attributes: ["id"] },
        { kind: "PK", attributes: ["tenant"] },
      ],
      [{ kind: "INDEX", attributes: ["id"] }],
      [
        { kind: "UQ", attributes: ["id"] },
        { kind: "UQ", attributes: ["id"] },
      ],
    ]) {
      expect(
        validateDataModel({ ...raw, relationships: [], entities: [{ ...users, keyGroups }] }).kind,
      ).toBe("error");
    }
  });

  it("requires nonblank bounded identifiers", () => {
    const raw = projectSchema();
    for (const id of [" ", "x".repeat(121)]) {
      expect(
        validateDataModel({
          ...raw,
          relationships: [],
          entities: [
            {
              ...at(raw.entities),
              id,
            },
          ],
        }).kind,
      ).toBe("error");
    }
  });
});
