import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { parseArchitecture } from "@/lib/architecture/architecture";
import { readArchitectureDigest } from "@/lib/architecture/read-architecture";
import { readSpecDigest } from "@/lib/spec/read-spec";
import { parseSpec } from "@/lib/spec/spec";
/** The single project-wide display identity for a discovered FRD folder. */
export interface ProjectFrd {
  readonly slug: string;
  readonly code: string;
  readonly title: string;
}
function heading(folder: string): string | undefined {
  try {
    return (
      fs
        .readFileSync(path.join(folder, "frd.md"), "utf8")
        .replace(/^---[\s\S]*?---/, "")
        .match(/^#\s+(.+)$/m)?.[1]
        ?.replace(/^FRD[- ]\d+\s*[·:—–-]?\s*/i, "")
        .trim() || undefined
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
      return undefined;
    throw error;
  }
}
/** Cached folder index. Missing sources are empty; other listing failures propagate. */
export const listProjectFrds = cache((projectPath: string): ProjectFrd[] => {
  const root = path.join(projectPath, "docs/frds");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  const folders = entries.filter(
    (entry) => entry.isDirectory() && /^frd-\d+(?:-|$)/i.test(entry.name),
  );
  const spec = readSpecDigest(projectPath),
    architecture = readArchitectureDigest(projectPath);
  const specFrds = spec ? parseSpec(spec).frds : [],
    archFrds = architecture ? parseArchitecture(architecture).frds : [];
  return folders
    .map((folder) => {
      const code = `FRD-${folder.name.match(/^frd-(\d+)/i)?.[1]?.padStart(2, "0")}`;
      const title =
        specFrds.find((frd) => frd.id === code)?.title?.trim() ||
        archFrds.find((frd) => frd.id === code)?.title?.trim() ||
        heading(path.join(root, folder.name)) ||
        folder.name
          .replace(/^frd-\d+-?/i, "")
          .replaceAll("-", " ")
          .replace(/^./, (first) => first.toUpperCase()) ||
        code;
      return { slug: folder.name, code, title };
    })
    .sort((a, b) => a.code.localeCompare(b.code) || a.slug.localeCompare(b.slug));
});
