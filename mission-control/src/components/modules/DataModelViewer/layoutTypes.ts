import type { DataModelEntity, DataModelRelationship } from "@/lib/architecture/data-model/types";

/** Entity or edge selection highlights the graph without a second relationship panel. */
export type ModelSelection = { kind: "entity" | "relationship"; id: string } | null;
/** Content-sized entity positioned in graph coordinates. */
export interface ModelNode {
  entity: DataModelEntity;
  x: number;
  y: number;
  width: number;
  height: number;
}
/** Routed relation with unchanged identity, mapping and cardinalities. */
export interface ModelEdge {
  relationship: DataModelRelationship;
  points: { x: number; y: number }[];
}
/** Geometry consumed by both embedded and expanded diagrams. */
export interface ModelLayout {
  nodes: ModelNode[];
  edges: ModelEdge[];
  width: number;
  height: number;
}
