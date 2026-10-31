import { readPublishedWorkOrders, type WorkOrderReadError } from "@/lib/work-orders/published";
import { readDigestFrds } from "./read-frds";
import { readSpecDigest } from "./read-spec";

/** Per-band source failures travel separately from deliberate absence. */
export interface DigestSourceErrors {
  readonly env?: string;
  readonly adrs?: string;
  readonly workOrders?: string;
  readonly workOrderFiles?: readonly WorkOrderReadError[];
  readonly frds?: string;
}

/** Keep a failed source explicit while allowing unrelated report bands to render. */
export function readArtifact<T>(read: () => T, fallback: T): { value: T; error?: string } {
  try {
    return { value: read() };
  } catch (error) {
    return { value: fallback, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Both digest and workspace consume the same strict, request-cached published plan. */
export const readDigestWorkOrders = readPublishedWorkOrders;

/** Request-scoped Spec mount seam: narrative plus live identity, kinds, counts and state. */
export function readSpecArtifacts(projectPath: string) {
  const orders = readArtifact(() => readDigestWorkOrders(projectPath), { items: [], errors: [] });
  const frds = readArtifact(() => readDigestFrds(projectPath, orders.value.items), []);
  return {
    body: readSpecDigest(projectPath) ?? "",
    frds: frds.value,
    frdCount: frds.value.length,
    workOrders: orders.value.items,
    sourceErrors: {
      workOrderFiles: orders.value.errors,
      workOrders:
        orders.error ??
        (orders.value.errors.map((issue) => `${issue.file}: ${issue.reason}`).join("; ") ||
          undefined),
      frds: frds.error,
    } satisfies DigestSourceErrors,
  };
}
