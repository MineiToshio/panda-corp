import { describe, expect, it } from "vitest";
import type { ModelEdge, ModelNode } from "../layout";
import { separateParallelRoutes } from "../routing";
import { modelFixture } from "./fixture";

function card(id: string, geometry: Omit<ModelNode, "entity">): ModelNode {
  const entity = modelFixture().entities[0];
  if (!entity) throw new Error("Fixture entity required");
  return { entity: { ...entity, id }, ...geometry };
}

function coincident(points: ModelEdge["points"]): ModelEdge[] {
  const relationship = modelFixture().relationships[0];
  if (!relationship) throw new Error("Fixture relationship required");
  return [0, 1, 2].map((index) => ({
    relationship: { ...relationship, id: `parallel-${index}` },
    points: points.map((point) => ({ ...point })),
  }));
}

describe("parallel routing corridor safety independent acceptance", () => {
  it.each([
    {
      name: "horizontal",
      points: [
        { x: 100, y: 50 },
        { x: 300, y: 50 },
      ],
      nodes: [
        card("source", { x: 0, y: 0, width: 100, height: 100 }),
        card("target", { x: 300, y: 0, width: 100, height: 100 }),
        card("obstacle", { x: 150, y: 51, width: 100, height: 40 }),
      ],
    },
    {
      name: "vertical",
      points: [
        { x: 100, y: 100 },
        { x: 100, y: 300 },
      ],
      nodes: [
        card("source", { x: 50, y: 0, width: 100, height: 100 }),
        card("target", { x: 50, y: 300, width: 100, height: 100 }),
        card("obstacle", { x: 101, y: 150, width: 40, height: 100 }),
      ],
    },
  ])("separates $name duplicates on the unobstructed side without moving field endpoints", ({
    points,
    nodes,
    name,
  }) => {
    const edges = coincident(points);
    const before = JSON.stringify({ edges, nodes });
    const routed = separateParallelRoutes(edges, nodes);
    expect(JSON.stringify({ edges, nodes })).toBe(before);
    expect(new Set(routed.map((edge) => JSON.stringify(edge.points))).size).toBe(3);
    expect(routed[0]?.points).toEqual(points);
    for (const edge of routed) {
      expect(edge.points[0]).toEqual(points[0]);
      expect(edge.points.at(-1)).toEqual(points.at(-1));
      for (const point of edge.points) {
        if (name === "horizontal") expect(point.y).toBeLessThanOrEqual(50);
        else expect(point.x).toBeLessThanOrEqual(100);
      }
    }
  });
});
