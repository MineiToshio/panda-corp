import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { readChangeQueue } from "@/lib/changes/changes";
import { t } from "@/lib/copy/copy";
import { listProjectFrds } from "@/lib/frds/frd-index";
import { listWorkOrders } from "@/lib/work-orders/work-orders";
import { TabCommands } from "../_components/tab-commands/tab-commands";
import type { PanelProps } from "./types";

const readTargets = cache((projectPath: string) => {
  const frds = fs.existsSync(path.join(projectPath, "docs/frds"))
    ? listProjectFrds(projectPath)
    : [];
  const orders = listWorkOrders(projectPath).filter((order) => order.state !== "done");
  const changes = readChangeQueue(projectPath).items.filter(
    (item) => item.status === "ready" || item.status === "draft" || item.status === "building",
  );
  return [
    ...frds.map((frd) => ({ value: frd.code, label: `${frd.code} · ${frd.title}` })),
    ...orders.map((order) => ({ value: order.id, label: `${order.id} · ${order.title}` })),
    ...changes.map((change) => ({
      value: `change:${change.id}`,
      label: t("workspace.comandos.target.changeOption", { title: change.title }),
    })),
  ];
});
/** Resolve the read-only target catalogue once per request and preserve shared next-step facts. */
export default async function ComandosPanel({ project }: PanelProps): Promise<React.JSX.Element> {
  return (
    <TabCommands
      phase={project.phase}
      slug={project.slug}
      nextStep={project.nextStep}
      targets={readTargets(project.projectPath)}
    />
  );
}
