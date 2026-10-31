import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { readSpecDigest } from "./read-spec";
import { parseSpec, type SpecFrd } from "./spec";

/** Live FRD metadata shared by both digest mounts. Narrative stays in the authored digest. */
export interface DigestFrd {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly ui?: string | boolean;
  readonly workOrders: readonly WorkOrder[];
  readonly blueprint: string;
  readonly detail?: SpecFrd;
}

/** Read FRD identity/kind and blueprint summaries; work-order truth is supplied by the one bundle. */
export function readDigestFrds(projectPath: string, workOrders: readonly WorkOrder[]): DigestFrd[] {
  const dir = join(projectPath, "docs/frds");
  if (!existsSync(dir)) return [];
  const spec = parseSpec(readSpecDigest(projectPath) ?? "");
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^frd-/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const parsed = matter(readFileSync(join(dir, entry.name, "frd.md"), "utf-8"), {
        excerpt: false,
      });
      const id =
        typeof parsed.data.id === "string"
          ? parsed.data.id
          : (entry.name.match(/^frd-\d+/i)?.[0].toUpperCase() ?? entry.name);
      const title =
        typeof parsed.data.title === "string"
          ? parsed.data.title
          : (parsed.content.match(/^#\s+(.*)$/m)?.[1] ?? entry.name);
      const blueprintPath = join(dir, entry.name, "blueprint.md");
      const blueprint = existsSync(blueprintPath)
        ? (matter(readFileSync(blueprintPath, "utf-8"), { excerpt: false })
            .content.split(/\r?\n/)
            .find((line) => line.trim() && !/^(#|---|\w+:)/.test(line)) ?? "")
        : "";
      const ui =
        typeof parsed.data.ui === "string" || typeof parsed.data.ui === "boolean"
          ? parsed.data.ui
          : undefined;
      return {
        detail: spec.frds.find((frd) => frd.id === id),
        id,
        title,
        slug: entry.name,
        ui,
        blueprint,
        workOrders: workOrders.filter((order) => order.frd === entry.name),
      };
    });
}
