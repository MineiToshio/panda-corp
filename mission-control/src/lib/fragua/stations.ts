import type { Tone } from "@/components/core/Chip/vocabulary";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
/** A station's counts and visible tokens derive only from the work-order reader. */
export interface FraguaStationData {
  readonly key: "todo" | "inProgress" | "review" | "done";
  readonly state: string;
  readonly tone: Tone;
  readonly sprites: readonly string[];
  readonly count: number;
  readonly tokens: readonly WorkOrder[];
  readonly overflow: number;
}
const STATIONS = [
  { key: "todo", state: "todo", tone: "slate", sprites: ["product-manager"] },
  {
    key: "inProgress",
    state: "in_progress",
    tone: "blue",
    sprites: ["frontend-dev", "backend-dev"],
  },
  { key: "review", state: "review", tone: "amber", sprites: ["reviewer", "test-writer"] },
  { key: "done", state: "done", tone: "green", sprites: ["devops"] },
] as const;
/** Events never enter this function: real work-order ids and frontmatter own all four stations. */
export function deriveStations(orders: readonly WorkOrder[]): FraguaStationData[] {
  const real = orders.filter((order) => /^WO-\d+-\d+$/.test(order.id));
  return STATIONS.map((station) => {
    const list = real.filter(
      (order) =>
        order.state === station.state || (station.key === "inProgress" && order.state === "fail"),
    );
    return {
      ...station,
      count: list.length,
      tokens: list.slice(0, 8),
      overflow: Math.max(0, list.length - 8),
    };
  });
}
