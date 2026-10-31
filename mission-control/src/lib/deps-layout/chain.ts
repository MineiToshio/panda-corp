import { dependencyStructure } from "./structure";
import type { DependencyOrder } from "./types";
/** Full transitive chains, cycle-safe, excluding the focus itself and unknown ids. */
export function dependencyChain(
  input: readonly DependencyOrder[],
  focus: string,
): { upstream: string[]; downstream: string[] } {
  const orders = dependencyStructure(input),
    byId = new Map(orders.map((order) => [order.id, order]));
  if (!byId.has(focus)) return { upstream: [], downstream: [] };
  function visit(direction: "up" | "down"): string[] {
    const seen = new Set([focus]);
    function walk(id: string): void {
      const adjacent =
        direction === "up"
          ? (byId.get(id)?.dependsOn ?? [])
          : orders.filter((order) => order.dependsOn?.includes(id)).map((order) => order.id);
      for (const next of adjacent) {
        if (seen.has(next)) continue;
        seen.add(next);
        walk(next);
      }
    }
    walk(focus);
    return [...seen].filter((id) => id !== focus);
  }
  return { upstream: visit("up"), downstream: visit("down") };
}
