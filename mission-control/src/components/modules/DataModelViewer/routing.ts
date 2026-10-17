import type { ModelEdge, ModelNode } from "./layoutTypes";

type Point = ModelEdge["points"][number];
function entersCard(a: Point, b: Point, node: ModelNode): boolean {
  return a.y === b.y
    ? a.y > node.y &&
        a.y < node.y + node.height &&
        Math.max(a.x, b.x) > node.x &&
        Math.min(a.x, b.x) < node.x + node.width
    : a.x > node.x &&
        a.x < node.x + node.width &&
        Math.max(a.y, b.y) > node.y &&
        Math.min(a.y, b.y) < node.y + node.height;
}
function safe(points: Point[], nodes: ModelNode[]) {
  return points.every(
    (point, index) =>
      point.x >= 0 &&
      point.y >= 0 &&
      (index === 0 || !nodes.some((node) => entersCard(points[index - 1] ?? point, point, node))),
  );
}
function offsetRoute(points: Point[], segment: number, delta: number): Point[] {
  const a = points[segment];
  const b = points[segment + 1];
  if (!a || !b) return points;
  const first = { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 };
  const last = { x: a.x + ((b.x - a.x) * 2) / 3, y: a.y + ((b.y - a.y) * 2) / 3 };
  const shift = a.y === b.y ? { x: 0, y: delta } : { x: delta, y: 0 };
  return [
    ...points.slice(0, segment + 1),
    first,
    { x: first.x + shift.x, y: first.y + shift.y },
    { x: last.x + shift.x, y: last.y + shift.y },
    last,
    ...points.slice(segment + 1),
  ];
}

function distinctRoute(
  points: Point[],
  nodes: ModelNode[],
  seen: Set<string>,
  index: number,
): Point[] {
  const deltas = [12, -12, 24, -24, 36, -36, 6, -6, 1 / (index + 1), -1 / (index + 1)];
  for (let segment = 0; segment < points.length - 1; segment += 1) {
    for (const delta of deltas) {
      const candidate = offsetRoute(points, segment, delta);
      if (safe(candidate, nodes) && !seen.has(JSON.stringify(candidate))) return candidate;
    }
  }
  throw new Error("Cannot separate overlapping relationship routes");
}

/** ELK can co-route distinct composite references sharing the same first field; keep them visibly distinct. */
export function separateParallelRoutes(edges: ModelEdge[], nodes: ModelNode[]): ModelEdge[] {
  const seen = new Set<string>();
  return edges.map((edge, index) => {
    const points = seen.has(JSON.stringify(edge.points))
      ? distinctRoute(edge.points, nodes, seen, index)
      : edge.points;
    seen.add(JSON.stringify(points));
    return { ...edge, points };
  });
}
