/** Minimal structural input keeps these predicates independent of the filesystem reader. */
type ChangeState = { readonly status: string; readonly staleSuspect: string };

/**
 * The statuses ChangesPanel shows by default ("open" — ready + draft; DR-092/DR-115).
 *
 * Deliberately EXCLUDES `building`/`closing`: those are "in flight" (the engine is
 * already draining/closing the item — DR-069 §7), not "pending" (waiting to be picked
 * up). A pending-count badge built on this set must not inflate while the build is
 * simply doing its job.
 */
const OPEN_STATUSES: ReadonlySet<string> = new Set(["ready", "draft"]);

/**
 * True when an item is genuinely waiting for the build (DR-092/DR-147): open (`ready`/`draft`)
 * and not suspected by the factory's reconciler of having already shipped (`stale_suspect`).
 * Every pending count and the "Listos para construir"/"Borradores" groups derive from this one rule.
 */
export function isPendingChange(item: ChangeState): boolean {
  return OPEN_STATUSES.has(item.status) && item.staleSuspect === "";
}

/** An open card the reconciler flagged (`stale_suspect`, DR-147): it waits for the owner, not the build. */
export function isSuspectedChange(item: ChangeState): boolean {
  return OPEN_STATUSES.has(item.status) && item.staleSuspect !== "";
}
