import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import matter from "@/lib/fs-utils/parseFrontmatter";
import { parseWorkOrderFile, readWorkOrderDoc, type WorkOrder } from "./work-orders";

/** An individually failed source, kept separate from successfully parsed work orders. */
export interface WorkOrderReadError {
  readonly file: string;
  readonly reason: string;
}
/** Strict published plan: invalid files never become fabricated todo orders. */
export interface PublishedWorkOrders {
  readonly items: WorkOrder[];
  readonly errors: WorkOrderReadError[];
}
const STATUSES = ["PLANNED", "IN_PROGRESS", "IN_REVIEW", "VERIFIED", "BLOCKED"];
function entries(folder: string): fs.Dirent[] {
  try {
    return fs.readdirSync(folder, { withFileTypes: true });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : "unknown";
    if (code === "ENOENT") return [];
    throw new Error(`${folder}: directory could not be listed (${code})`, { cause: error });
  }
}
function readSource(
  projectPath: string,
  relPath: string,
): { superseded: boolean } | { reason: string } {
  const source = readWorkOrderDoc(projectPath, relPath);
  if (source === null) return { reason: "file could not be read" };
  if (!source.trim()) return { reason: "file is empty" };
  let data: Record<string, unknown>;
  try {
    data = matter(source, { excerpt: false }).data;
  } catch {
    return { reason: "malformed YAML frontmatter" };
  }
  if (data.status === "SUPERSEDED") return { superseded: true };
  if (
    data.implementation_status !== undefined &&
    (typeof data.implementation_status !== "string" ||
      !STATUSES.includes(data.implementation_status))
  )
    return { reason: "invalid implementation_status" };
  return { superseded: false };
}
/** Shared request-cached strict source. Per-file errors preserve siblings; directory failures throw. */
export const readPublishedWorkOrders = cache((projectPath: string): PublishedWorkOrders => {
  const items: WorkOrder[] = [];
  const errors: WorkOrderReadError[] = [];
  const folders = entries(path.join(projectPath, "docs/frds"));
  for (const folder of folders.filter(
    (entry) => entry.isDirectory() && /^frd-\d/.test(entry.name),
  )) {
    const rel = path.join("docs/frds", folder.name, "work-orders");
    for (const file of entries(path.join(projectPath, rel)).filter((entry) =>
      /^wo-.+\.md$/i.test(entry.name),
    )) {
      const relPath = path.join(rel, file.name);
      const result = readSource(projectPath, relPath);
      if ("reason" in result) errors.push({ file: relPath, reason: result.reason });
      else if (!result.superseded)
        items.push(parseWorkOrderFile(path.join(projectPath, relPath), folder.name, projectPath));
    }
  }
  return { items, errors };
});
