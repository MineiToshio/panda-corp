import type { DependencyOrder } from "./types";
/** Drop dangling references and duplicates without fabricating dependencies. */
export function dependencyStructure(orders: readonly DependencyOrder[]): DependencyOrder[] {
  const ids = new Set(orders.map((order) => order.id));
  return orders.map((order) => ({
    id: order.id,
    frd: order.frd,
    dependsOn: [...new Set(order.dependsOn ?? [])].filter((id) => ids.has(id)),
  }));
}
/** Longest prerequisite depth, cycle-bounded using the prototype's recursion order. */
export function dependencyDepths(orders: readonly DependencyOrder[]): Map<string, number> {
  const byId = new Map(orders.map((order) => [order.id, order]));
  const depths = new Map<string, number>();
  function depthOf(id: string, seen = new Set<string>()): number {
    const cached = depths.get(id);
    if (cached !== undefined) return cached;
    if (seen.has(id)) return 0;
    seen.add(id);
    const depth = Math.max(
      0,
      ...(byId.get(id)?.dependsOn ?? []).map((id) => depthOf(id, seen) + 1),
    );
    depths.set(id, depth);
    return depth;
  }
  orders.forEach((order) => {
    depthOf(order.id);
  });
  return depths;
}
/** The prototype's horizontal cubic curve between natural-size cards. */
export function horizontalCurve(
  a: { x: number; y: number },
  b: { x: number; y: number },
  width: number,
  height: number,
): string {
  const x1 = a.x + width,
    y1 = a.y + height / 2,
    x2 = b.x,
    y2 = b.y + height / 2,
    mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}
