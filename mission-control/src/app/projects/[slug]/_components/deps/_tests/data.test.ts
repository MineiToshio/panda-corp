import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { loadDependencyMap } from "../data";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
it("AC-12-004.7 AC-12-004.8: real frontmatter supplies real edges; recoloring keeps geometry fixed", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deps-map-"));
  roots.push(root);
  const folder = path.join(root, "docs/frds/frd-01-feature/work-orders");
  fs.mkdirSync(folder, { recursive: true });
  const first = path.join(folder, "wo-01-001.md"),
    second = path.join(folder, "wo-01-002.md");
  fs.writeFileSync(
    first,
    "---\nid: WO-01-001\nimplementation_status: PLANNED\ndependsOn: []\n---\n# First\n",
  );
  fs.writeFileSync(
    second,
    "---\nid: WO-01-002\nimplementation_status: IN_REVIEW\ndependsOn: [WO-01-001]\n---\n# Second\n",
  );
  const before = loadDependencyMap(root);
  expect(before.workLayouts[""]?.edges.map((edge) => [edge.from, edge.to])).toEqual([
    ["WO-01-001", "WO-01-002"],
  ]);
  fs.writeFileSync(first, fs.readFileSync(first, "utf8").replace("PLANNED", "VERIFIED"));
  const after = loadDependencyMap(root);
  expect(after.orders.find((order) => order.id === "WO-01-001")?.state).toBe("done");
  expect(after.workLayouts).toEqual(before.workLayouts);
  expect(after.frdGeometry).toEqual(before.frdGeometry);
});
it("AC-12-004.1: a project without any work orders has an honest empty model", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deps-empty-"));
  roots.push(root);
  expect(loadDependencyMap(root).orders).toEqual([]);
});
