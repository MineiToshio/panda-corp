import { dependencyDepths, dependencyStructure, horizontalCurve } from "./structure";
import type { DependencyOrder, DependencyPosition, WorkOrderGeometry } from "./types";
/** Prototype depsView arithmetic: 176×46 cards, 64/12 gaps, 16 px inset, structure only. */
export function workOrderLayout(
  input: readonly DependencyOrder[],
  filter?: string,
): WorkOrderGeometry {
  const orders = dependencyStructure(input);
  const selected = filter && orders.some((order) => order.frd === filter) ? filter : undefined;
  const inScope = (order: DependencyOrder) => !selected || order.frd === selected;
  const scoped = orders.filter(
    (order) =>
      inScope(order) ||
      orders.some(
        (other) =>
          inScope(other) &&
          ((other.dependsOn ?? []).includes(order.id) ||
            (order.dependsOn ?? []).includes(other.id)),
      ),
  );
  if (!scoped.length) return { width: 0, height: 0, nodes: [], edges: [], steps: [] };
  const ids = new Set(scoped.map((order) => order.id));
  const depths = dependencyDepths(
    scoped.map((order) => ({ ...order, dependsOn: order.dependsOn?.filter((id) => ids.has(id)) })),
  );
  const columns: DependencyOrder[][] = [];
  for (const order of scoped) {
    const depth = depths.get(order.id) ?? 0;
    columns[depth] ??= [];
    columns[depth].push(order);
  }
  columns.forEach((column) => {
    column.sort((a, b) => a.frd.localeCompare(b.frd) || a.id.localeCompare(b.id));
  });
  const positions = new Map<string, DependencyPosition>();
  columns.forEach((column, x) => {
    column.forEach((order, y) => {
      positions.set(order.id, {
        id: order.id,
        x: 16 + x * 240,
        y: 16 + y * 58,
        depth: x,
        outOfScope: !inScope(order),
      });
    });
  });
  const nodes = scoped
    .map((order) => positions.get(order.id))
    .filter((node): node is DependencyPosition => node !== undefined);
  const edges = scoped.flatMap((order) =>
    (order.dependsOn ?? []).flatMap((from) => {
      const a = positions.get(from),
        b = positions.get(order.id);
      return a && b ? [{ from, to: order.id, path: horizontalCurve(a, b, 176, 46) }] : [];
    }),
  );
  return {
    width: 32 + columns.length * 176 + (columns.length - 1) * 64,
    height: 32 + Math.max(...columns.filter(Boolean).map((column) => column.length)) * 58 - 12,
    nodes,
    edges,
    steps: columns.filter(Boolean).map((column) => column.map((order) => order.id)),
  };
}
