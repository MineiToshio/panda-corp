import type { ElkNode, ElkPort } from "elkjs/lib/elk-api";
import type { DataModel, DataModelEntity } from "@/lib/architecture/data-model/types";
import { routeGraph } from "./elkEngine";
import { entityGeometry, HEADER_HEIGHT, ROW_HEIGHT } from "./entityGeometry";
import type { ModelLayout } from "./layoutTypes";
import { separateParallelRoutes } from "./routing";

export type { ModelEdge, ModelLayout, ModelNode, ModelSelection } from "./layoutTypes";

function fieldPort(
  node: ElkNode,
  entity: DataModelEntity,
  attributes: readonly string[] | undefined,
  { id, side }: { id: string; side: "EAST" | "WEST" },
): ElkPort {
  const row = entity.attributes.findIndex((field) => field.id === attributes?.[0]);
  return {
    id,
    width: 0,
    height: 0,
    x: side === "EAST" ? node.width : 0,
    y: row < 0 ? HEADER_HEIGHT / 2 : HEADER_HEIGHT + ROW_HEIGHT * (row + 0.5),
    layoutOptions: { "elk.port.side": side },
  };
}

/** Layered, crossing-minimized orthogonal layout with fixed ports on the actual field rows. */
export async function layoutModel(model: DataModel, signal?: AbortSignal): Promise<ModelLayout> {
  const tokens = new Map(model.entities.map((entity, index) => [entity.id, index]));
  const children: ElkNode[] = model.entities.map((entity, index) => ({
    id: `n${index}`,
    ...entityGeometry(entity),
    ports: [],
    layoutOptions: { "elk.portConstraints": "FIXED_POS" },
  }));
  const graphEdges = model.relationships.map((relation, index) => {
    const ends = [relation.from, relation.to].map((endpoint, end) => {
      const nodeIndex = tokens.get(endpoint.entity);
      const node = nodeIndex === undefined ? undefined : children[nodeIndex];
      const entity = nodeIndex === undefined ? undefined : model.entities[nodeIndex];
      if (!node || !entity) throw new Error(`Unknown entity reference: ${endpoint.entity}`);
      const port = fieldPort(node, entity, endpoint.attributes, {
        id: `p${index}_${end}`,
        side: end === 0 ? "EAST" : "WEST",
      });
      node.ports?.push(port);
      return port.id;
    });
    return { id: `r${index}`, sources: [ends[0] ?? ""], targets: [ends[1] ?? ""] };
  });
  const graph = await routeGraph(
    {
      id: "model",
      children,
      edges: graphEdges,
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.randomSeed": "7",
        "elk.padding": "[top=40,left=40,bottom=40,right=40]",
        "elk.spacing.nodeNode": "48",
        "elk.spacing.componentComponent": "80",
        "elk.layered.spacing.nodeNodeBetweenLayers": "100",
        "elk.layered.layering.strategy": "COFFMAN_GRAHAM",
        "elk.layered.layering.coffmanGraham.layerBound": "6",
        "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.aspectRatio": "1.3",
      },
    },
    signal,
  );
  const positions = new Map(graph.children?.map((node) => [node.id, node]));
  const routes = new Map(graph.edges?.map((edge) => [edge.id, edge]));
  const nodes = model.entities.map((entity, index) => {
    const node = positions.get(`n${index}`);
    if (node?.x === undefined || node.y === undefined) throw new Error("Missing entity geometry");
    return { entity, x: node.x, y: node.y, width: node.width ?? 0, height: node.height ?? 0 };
  });
  const edges = model.relationships.map((relationship, index) => {
    const sections = routes.get(`r${index}`)?.sections;
    if (!sections?.length) throw new Error("Missing relationship route");
    return {
      relationship,
      points: sections.flatMap((section) => [
        section.startPoint,
        ...(section.bendPoints ?? []),
        section.endPoint,
      ]),
    };
  });
  const separated = separateParallelRoutes(edges, nodes);
  return {
    nodes,
    edges: separated,
    width: Math.max(
      graph.width ?? 0,
      ...separated.flatMap((edge) => edge.points.map((point) => point.x + 40)),
    ),
    height: Math.max(
      graph.height ?? 0,
      ...separated.flatMap((edge) => edge.points.map((point) => point.y + 40)),
    ),
  };
}
