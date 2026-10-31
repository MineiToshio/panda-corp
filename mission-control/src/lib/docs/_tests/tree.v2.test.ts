import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { listProjectDocs, readDoc } from "../tree";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});
it("AC-04-014.8: discovers purpose/type including work orders and rejects symlink ancestors", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "s5c-docs-"));
  roots.push(root);
  for (const file of [
    "docs/product/prd.md",
    "docs/product/architecture.md",
    "docs/design/DESIGN.md",
    "docs/analytics/events.md",
    "docs/reviews/gate.md",
    "docs/frds/frd-01-test/work-orders/wo-01-001.md",
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), "# Test");
  }
  const nodes = listProjectDocs(root);
  expect(nodes.map((n) => n.purpose)).toEqual(
    expect.arrayContaining(["product", "global", "design", "analytics", "reviews", "workOrders"]),
  );
  expect(nodes.find((n) => n.relPath.endsWith("wo-01-001.md"))?.type).toBe("Work order");
  expect(readDoc(root, "../escape.md")).toBeNull();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "s5c-outside-"));
  roots.push(outside);
  fs.writeFileSync(path.join(outside, "secret.md"), "secret");
  fs.symlinkSync(outside, path.join(root, "docs/adr"));
  expect(listProjectDocs(root).some((n) => n.relPath.includes("secret"))).toBe(false);
});
