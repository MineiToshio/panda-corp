import dagre from "@dagrejs/dagre";
import type {
  DataModel,
  DataModelEntity,
  DataModelRelationship,
} from "@/lib/architecture/data-model/types";

const NODE_WIDTH = 248;
export const HEADER_HEIGHT = 38;
export const ROW_HEIGHT = 24;
const PADDING = 36;

/** A compact entity card positioned in graph coordinates. */
export interface ModelNode {
  entity: DataModelEntity;
  x: number;
  y: number;
  width: number;
  height: number;
}
/** A routed relation, retaining the endpoint field mapping from its source. */
export interface ModelEdge {
  relationship: DataModelRelationship;
  points: { x: number; y: number }[];
}
/** Deterministic layout dimensions and positioned model objects. */
export interface ModelLayout {
  nodes: ModelNode[];
  edges: ModelEdge[];
  width: number;
  height: number;
}

function mappedPort(
  node: ModelNode,
  attributes: readonly string[] | undefined,
  fallback: { x: number; y: number },
) {
  const fieldIndex = node.entity.attributes.findIndex((field) => field.id === attributes?.[0]);
  return {
    x: fallback.x < node.x + node.width / 2 ? node.x : node.x + node.width,
    y: fieldIndex < 0 ? fallback.y : node.y + HEADER_HEIGHT + ROW_HEIGHT * (fieldIndex + 0.5),
  };
}

/** Lay out all entities, including isolated entities, parallel edges and self-relations. */
export function layoutModel(model: DataModel): ModelLayout {
  // Dagre uses ordinary objects internally; source IDs remain opaque outside this boundary.
  const nodeIds = new Map(model.entities.map((entity, index) => [entity.id, `n${index}`]));
  const edgeIds = new Map(model.relationships.map((relation, index) => [relation.id, `r${index}`]));
  function graphNodeId(id: string): string {
    const token = nodeIds.get(id);
    if (!token) throw new Error(`Unknown entity reference: ${id}`);
    return token;
  }
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({
    rankdir: "LR",
    marginx: PADDING,
    marginy: PADDING,
    nodesep: 48,
    ranksep: 112,
    edgesep: 28,
  });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const entity of model.entities)
    graph.setNode(graphNodeId(entity.id), {
      width: NODE_WIDTH,
      height: HEADER_HEIGHT + ROW_HEIGHT * entity.attributes.length,
    });
  for (const relation of model.relationships)
    graph.setEdge(
      graphNodeId(relation.from.entity),
      graphNodeId(relation.to.entity),
      {},
      edgeIds.get(relation.id),
    );
  dagre.layout(graph);
  const nodes = model.entities.map((entity) => {
    const node = graph.node(graphNodeId(entity.id));
    return {
      entity,
      x: node.x - node.width / 2,
      y: node.y - node.height / 2,
      width: node.width,
      height: node.height,
    };
  });
  const edges = model.relationships.map((relationship) => {
    const route = graph.edge({
      v: graphNodeId(relationship.from.entity),
      w: graphNodeId(relationship.to.entity),
      name: edgeIds.get(relationship.id),
    });
    const points = route.points.map((point: { x: number; y: number }) => ({ ...point }));
    const from = nodes.find((node) => node.entity.id === relationship.from.entity);
    const to = nodes.find((node) => node.entity.id === relationship.to.entity);
    if (from && to && points.length > 1) {
      points[0] = mappedPort(from, relationship.from.attributes, points[0]);
      points[points.length - 1] = mappedPort(
        to,
        relationship.to.attributes,
        points[points.length - 1],
      );
    }
    return { relationship, points };
  });
  return {
    nodes,
    edges,
    width: graph.graph().width ?? NODE_WIDTH + PADDING * 2,
    height: graph.graph().height ?? PADDING * 2,
  };
}
