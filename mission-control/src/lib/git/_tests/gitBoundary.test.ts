import fs from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "_tests") return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? sources(file) : /\.[cm]?[jt]sx?$/.test(file) ? [file] : [];
  });
}

it("REQ-01-011: only the git boundary imports child_process", () => {
  const root = path.resolve("src");
  const offenders = sources(root).filter(
    (file) =>
      !file.startsWith(path.join(root, "lib/git/")) &&
      /(?:from\s*|import\s*\(|require\s*\()\s*["'](?:node:)?child_process["']/.test(
        fs.readFileSync(file, "utf8"),
      ),
  );
  expect(offenders.map((file) => path.relative(root, file))).toEqual([]);
});
