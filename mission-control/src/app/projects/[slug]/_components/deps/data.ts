import { cache } from "react";
import { dependencyChain } from "@/lib/deps-layout/chain";
import { frdLayout } from "@/lib/deps-layout/frd-layout";
import { workOrderLayout } from "@/lib/deps-layout/work-order-layout";
import { listProjectFrds } from "@/lib/frds/frd-index";
import { readPublishedWorkOrders } from "@/lib/work-orders/published";
/** Resolve every natural-size layout once on the server, never after client hydration. */
export const loadDependencyMap = cache((projectPath: string) => {
  const orders = readPublishedWorkOrders(projectPath).items;
  const frds = orders.length ? listProjectFrds(projectPath) : [];
  return {
    orders,
    frds,
    frdGeometry: frdLayout(orders, frds),
    workLayouts: Object.fromEntries(
      ["", ...frds.map((frd) => frd.slug)].map((slug) => [slug, workOrderLayout(orders, slug)]),
    ),
    chains: Object.fromEntries(
      orders.map((order) => [order.id, dependencyChain(orders, order.id)]),
    ),
  };
});
/** Serializable server model handed to the canvas island. */
export type DependencyMapData = ReturnType<typeof loadDependencyMap>;
