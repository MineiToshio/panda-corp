import path from "node:path";
import { cache } from "react";
import { now } from "@/lib/clock/clock";
import { readEvents } from "@/lib/events/events";
import { readStatus } from "@/lib/status/status";
import { readPublishedWorkOrders } from "@/lib/work-orders/published";
import { aggregateProgress } from "@/lib/work-orders/work-orders";
import { buildSignal } from "./build-signal";
import { latestBuildEvent } from "./live-events";
import { deriveStations } from "./stations";
/** Structural project identity accepted by the scene's cached loader. */
export interface FraguaProject {
  readonly slug: string;
  readonly path: string;
  readonly name: string;
}
/** One request-scoped load: frontmatter owns structure, project events only own liveness. */
export const loadFraguaScene = cache((project: FraguaProject) => {
  const source = readPublishedWorkOrders(project.path);
  const orders = source.items.filter((order) => /^WO-\d+-\d+$/.test(order.id));
  const result = readStatus(project.path);
  const status = result.present && !result.malformed ? result.status : {};
  const eventProject = path.basename(project.path);
  const events = readEvents({ project: eventProject, cap: Number.MAX_SAFE_INTEGER }).events;
  const lastEventAt = latestBuildEvent(events, eventProject);
  const nowIso = now().toISOString();
  return {
    orders,
    errors: source.errors,
    stations: deriveStations(orders),
    progress: aggregateProgress(orders),
    phase: status.phase,
    signal: buildSignal({
      running: status.running,
      supervisorHeartbeat: status.supervisorHeartbeat,
      lastEventAt,
      nowMs: Date.parse(nowIso),
    }),
    nowIso,
    eventProject,
  };
});
