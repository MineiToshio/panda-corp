import { describe, expect, it } from "vitest";
import type { DataModelEndpoint } from "@/lib/architecture/data-model/types";
import { HEADER_HEIGHT, ROW_HEIGHT } from "../entityGeometry";
import { layoutModel, type ModelEdge, type ModelNode } from "../layout";
import { modelFixture } from "./fixture";

type Point = { x: number; y: number };

function assertEndpoint(nodes: ModelNode[], endpoint: DataModelEndpoint, point: Point | undefined) {
  const node = nodes.find((candidate) => candidate.entity.id === endpoint.entity);
  if (!node || !point) throw new Error("Missing relationship endpoint");
  const index = node.entity.attributes.findIndex(
    (attribute) => attribute.id === endpoint.attributes?.[0],
  );
  expect(index).toBeGreaterThanOrEqual(0);
  expect(point.y).toBeCloseTo(node.y + HEADER_HEIGHT + ROW_HEIGHT * (index + 0.5));
  expect(
    Math.min(Math.abs(point.x - node.x), Math.abs(point.x - node.x - node.width)),
  ).toBeLessThan(0.01);
}

function intersectsInterior(start: Point, end: Point, node: ModelNode): boolean {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  return (
    right > node.x + 0.01 &&
    left < node.x + node.width - 0.01 &&
    bottom > node.y + 0.01 &&
    top < node.y + node.height - 0.01
  );
}

function assertSegments(edge: ModelEdge, nodes: ModelNode[]) {
  for (let index = 1; index < edge.points.length; index += 1) {
    const start = edge.points[index - 1];
    const end = edge.points[index];
    if (!start || !end) throw new Error("Missing path segment");
    const horizontal = Math.abs(start.y - end.y) < 0.01;
    const vertical = Math.abs(start.x - end.x) < 0.01;
    expect(horizontal || vertical, `Diagonal segment in ${edge.relationship.id}`).toBe(true);
    for (const node of nodes) {
      expect(
        intersectsInterior(start, end, node),
        `${edge.relationship.id} enters ${node.entity.id}`,
      ).toBe(false);
    }
  }
}

describe("readable card sizing independent acceptance", () => {
  it("reserves space for a complete long attribute and long type on the same row", async () => {
    const attributeName = "externalProviderTransactionReference";
    const attributeType = "PaymentProviderTransactionState";
    const model = modelFixture();
    const entity = model.entities[0];
    if (!entity) throw new Error("Fixture requires an entity");
    const layout = await layoutModel({
      ...model,
      entities: [
        {
          ...entity,
          attributes: [
            {
              id: "long",
              name: attributeName,
              type: attributeType,
              optional: false,
              keys: ["PK", "FK", "UQ"],
            },
          ],
        },
      ],
      relationships: [],
    });
    const node = layout.nodes[0];
    if (!node) throw new Error("Long-field entity disappeared");
    // 6px per glyph is a deliberately conservative floor for a 12px monospace font.
    expect(node.width).toBeGreaterThan((attributeName.length + attributeType.length) * 6);
    expect(node.entity.attributes[0]?.name).toBe(attributeName);
    expect(node.entity.attributes[0]?.type).toBe(attributeType);
  });

  it("preserves a full entity heading when its attributes are short", async () => {
    const name = "ExternalProviderTransactionReconciliationConfiguration";
    const model = modelFixture();
    const entity = model.entities[0];
    if (!entity) throw new Error("Fixture requires an entity");
    const layout = await layoutModel({
      ...model,
      entities: [{ ...entity, name }],
      relationships: [],
    });
    expect(layout.nodes[0]?.width).toBeGreaterThan(name.length * 6);
  });

  it("routes parallel and self relationships orthogonally to their mapped rows without entering cards", async () => {
    const model = modelFixture();
    const layout = await layoutModel(model);
    expect(layout.edges.map((edge) => edge.relationship.id)).toEqual(
      model.relationships.map((relation) => relation.id),
    );
    expect(new Set(layout.edges.map((edge) => JSON.stringify(edge.points))).size).toBe(
      model.relationships.length,
    );
    for (const edge of layout.edges) {
      expect(edge.points.length).toBeGreaterThan(1);
      assertEndpoint(layout.nodes, edge.relationship.from, edge.points[0]);
      assertEndpoint(layout.nodes, edge.relationship.to, edge.points.at(-1));
      assertSegments(edge, layout.nodes);
    }
  });
});
