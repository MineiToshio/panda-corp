import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { cache } from "react";
import { listWorkOrders, readWorkOrderDoc } from "./work-orders";

const STATUSES = ["PLANNED", "IN_PROGRESS", "IN_REVIEW", "VERIFIED", "BLOCKED"];
function entries(folder: string): fs.Dirent[] {
  try {
    return fs.readdirSync(folder, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}
function validateSource(projectPath: string, relPath: string): void {
  const source = readWorkOrderDoc(projectPath, relPath);
  if (source === null) throw new Error(`${relPath}: unreadable work order`);
  const data = matter(source, { excerpt: false }).data;
  if (data.status === "SUPERSEDED") return;
  if (data.implementation_status !== undefined && !STATUSES.includes(data.implementation_status))
    throw new Error(`${relPath}: invalid implementation_status`);
}
/** Strict view boundary over the same cached raw reader; absent plans are legitimate, failed sources throw. */
export const readPublishedWorkOrders = cache((projectPath: string) => {
  const folders = entries(path.join(projectPath, "docs/frds"));
  for (const folder of folders.filter(
    (entry) => entry.isDirectory() && /^frd-\d/.test(entry.name),
  )) {
    const rel = path.join("docs/frds", folder.name, "work-orders");
    for (const file of entries(path.join(projectPath, rel)).filter((entry) =>
      /^wo-.+\.md$/i.test(entry.name),
    ))
      validateSource(projectPath, path.join(rel, file.name));
  }
  return listWorkOrders(projectPath);
});
