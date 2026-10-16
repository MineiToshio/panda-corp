/** Canonical project artifact; shared by the pure validator and server reader. */
export const DATA_MODEL_SOURCE = "docs/product/data-model.json";
export const MAX_DATA_MODEL_BYTES = 1024 * 1024;

/** A stored attribute, with explicitly declared nullability and key membership. */
export interface DataModelAttribute {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly optional: boolean;
  readonly keys?: readonly ("PK" | "FK" | "UQ")[];
}

/** An ordered primary or unique key; IDs reference attributes within its entity. */
export interface DataModelKeyGroup {
  readonly kind: "PK" | "UQ";
  readonly attributes: readonly string[];
}

/** A table or document entity with stable IDs independent of display names. */
export interface DataModelEntity {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly attributes: readonly DataModelAttribute[];
  readonly keyGroups?: readonly DataModelKeyGroup[];
}

/** Multiplicity at this end of the relationship, optionally with an ordered attribute mapping. */
export interface DataModelEndpoint {
  readonly entity: string;
  readonly attributes?: readonly string[];
  readonly min: 0 | 1;
  readonly max: 1 | "many";
}

/** A distinct edge; parallel edges and self references remain independently addressable. */
export interface DataModelRelationship {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly from: DataModelEndpoint;
  readonly to: DataModelEndpoint;
}

/** Validated version-one persistent model. Empty entities are an explicit valid state. */
export interface DataModel {
  readonly schemaVersion: 1;
  readonly persistence: "relational" | "document";
  readonly entities: readonly DataModelEntity[];
  readonly relationships: readonly DataModelRelationship[];
}

/** Honest read states: no persistence, absent source, invalid source, or a usable model. */
export type DataModelResult =
  | { readonly kind: "ready"; readonly model: DataModel; readonly source: typeof DATA_MODEL_SOURCE }
  | { readonly kind: "none" }
  | { readonly kind: "missing" }
  | { readonly kind: "error"; readonly message: string };
