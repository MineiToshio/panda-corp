import { cache } from "react";
import { type BuildTarget, isBuildTarget } from "@/lib/build-mode-store";
import { readChangeQueue } from "@/lib/changes/changes";
import { t } from "@/lib/copy/copy";
import { listProjectFrds } from "@/lib/frds/frd-index";
import { listWorkOrders } from "@/lib/work-orders/work-orders";

/** Shared read-only catalogue of published FRDs with pending work and eligible cards. */
export const readBuildTargets = cache((projectPath: string): BuildTarget[] => {
  const orders = listWorkOrders(projectPath);
  return [
    ...listProjectFrds(projectPath)
      .filter((frd) => orders.some((order) => order.frd === frd.slug && order.state !== "done"))
      .map((frd) => ({ value: frd.code, label: `${frd.code} · ${frd.title}` })),
    ...readChangeQueue(projectPath).items.map((change) => ({
      value: `change:${change.id}`,
      label: t("workspace.comandos.target.changeOption", { title: change.title }),
      status: change.status,
      staleSuspect: change.staleSuspect,
    })),
  ].filter(isBuildTarget);
});
