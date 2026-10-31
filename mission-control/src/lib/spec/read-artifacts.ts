import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { listWorkOrders } from "@/lib/work-orders/work-orders";
import { readDigestFrds } from "./read-frds";
import { readSpecDigest } from "./read-spec";

/** Per-band source failures travel separately from deliberate absence. */
export interface DigestSourceErrors {
  readonly env?: string;
  readonly adrs?: string;
  readonly workOrders?: string;
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

/** Validate every work-order source before using the legacy tolerant state reader. */
export function readDigestWorkOrders(projectPath: string) {
  const dir = join(projectPath, "docs/frds");
  if (!existsSync(dir)) return [];
  for (const frd of readdirSync(dir, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  )) {
    const orders = join(dir, frd.name, "work-orders");
    if (!existsSync(orders)) continue;
    for (const file of readdirSync(orders).filter((name) => /^wo-.*\.md$/i.test(name))) {
      const source = join(orders, file);
      const parsed = matter(readFileSync(source, "utf-8"), { excerpt: false });
      if (
        parsed.data.implementation_status !== undefined &&
        !["PLANNED", "IN_PROGRESS", "IN_REVIEW", "VERIFIED", "BLOCKED"].includes(
          parsed.data.implementation_status,
        )
      )
        throw new Error(`${source}: invalid implementation_status`);
    }
  }
  return listWorkOrders(projectPath);
}

/** Request-scoped Spec mount seam: narrative plus live identity, kinds, counts and state. */
export function readSpecArtifacts(projectPath: string) {
  const orders = readArtifact(() => readDigestWorkOrders(projectPath), []);
  const frds = readArtifact(() => readDigestFrds(projectPath, orders.value), []);
  return {
    body: readSpecDigest(projectPath) ?? "",
    frds: frds.value,
    frdCount: frds.value.length,
    workOrders: orders.value,
    sourceErrors: { workOrders: orders.error, frds: frds.error } satisfies DigestSourceErrors,
  };
}
