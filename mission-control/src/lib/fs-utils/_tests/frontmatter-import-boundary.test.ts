import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const WRAPPER_PATH = path.join(SOURCE_ROOT, "lib/fs-utils/parseFrontmatter.ts");
const IMPORT_PATTERN = /(?:from\s*|import\s*\(|require\s*\()\s*["']gray-matter["']/;
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);

function collectImports(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectImports(entryPath);
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) return [];
    return IMPORT_PATTERN.test(fs.readFileSync(entryPath, "utf-8")) ? [entryPath] : [];
  });
}

describe("frontmatter parser import boundary", () => {
  it("keeps gray-matter imports inside the shared wrapper", () => {
    expect(collectImports(SOURCE_ROOT)).toEqual([WRAPPER_PATH]);
  });
});
