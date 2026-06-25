/**
 * deps — dependency derivation for the WoDag graph (DR-087: real deps only).
 *
 * Split out of layout.ts to keep that file under the size limit. Pure module.
 */

/** WorkOrder shape this module needs for edge derivation. */
export interface DepSource {
  id: string;
  frd: string;
  dependsOn?: string[];
}

/**
 * Build the `dependsOn` map used to construct the DAG.
 *
 * Dependencies are REAL (DR-087): each work order's `dependsOn` is read from its
 * frontmatter. We keep only entries that resolve to a known work order and drop
 * self-references; a work order with no declared dependencies is an INDEPENDENT
 * node. There is no fabricated fallback.
 */
export function deriveDeps<T extends DepSource>(
  workOrders: readonly T[],
): Array<T & { dependsOn: string[] }> {
  const idSet = new Set(workOrders.map((w) => w.id.trim()));
  return workOrders.map((wo) => {
    const deps = (wo.dependsOn ?? [])
      .map((d) => d.trim())
      .filter((d) => idSet.has(d) && d !== wo.id.trim());
    return { ...wo, dependsOn: [...new Set(deps)] };
  });
}
