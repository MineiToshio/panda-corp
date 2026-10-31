import type { WorkOrder } from "@/lib/work-orders/work-orders";

/** Explicit live phase wins; older mounts can infer construction from live order states. */
export function hasConstructionStarted(
  phase: string | null,
  orders: readonly WorkOrder[],
  explicit?: boolean,
): boolean {
  return (
    explicit ??
    (/[Cc]onstru|implementation|release|[Ll]anzamiento/.test(phase ?? "") ||
      orders.some((order) => order.state !== "todo"))
  );
}
/** Old project-slug mounts and new canonical route mounts share one link base. */
export function digestNavigationBase(base?: string, project?: string): string | undefined {
  return base ?? (project ? `/portfolio/${encodeURIComponent(project)}` : undefined);
}
