import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listWorkOrders, readWorkOrderDetail, readWorkOrderDoc } from "../work-orders";

let root: string;
const folder = "docs/frds/frd-05-orders/work-orders";
function write(id: string, body: string) {
  fs.mkdirSync(path.join(root, folder), { recursive: true });
  fs.writeFileSync(path.join(root, folder, `${id.toLowerCase()}-test.md`), body);
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "wo-detail-"));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});
describe("AC-05-008.4 detail source contract", () => {
  it("extracts facts, heading families, criteria and downstream dependencies; excludes superseded orders", () => {
    write(
      "WO-05-001",
      "---\nimplementation_status: IN_REVIEW\ndifficulty: medium\nreopen_count: 2\nlast_updated: 2026-10-22\nsource_requirements: [REQ-05-001]\nartifacts: [src/a.ts]\n---\n# WO-05-001 Build it\n## Goal\nAbout\n## In Scope\nChange\n## Out of Scope\nExcluded\n## Requirements & Acceptance Criteria\n- **AC-05-008.4** — WHEN opened THEN it SHALL read.\n## Status Note\nBuilt",
    );
    write("WO-05-002", "---\ndependsOn: [WO-05-001]\n---\n# WO-05-002 Next");
    write("WO-05-003", "---\nstatus: SUPERSEDED\n---\n# WO-05-003 Old");
    const result = readWorkOrderDetail(root, "WO-05-001");
    expect(result.kind).toBe("found");
    if (result.kind !== "found") return;
    expect(result.order).toMatchObject({
      difficulty: "medium",
      reopenCount: 2,
      lastUpdated: "2026-10-22",
      requirements: ["REQ-05-001"],
      artifacts: ["src/a.ts"],
    });
    expect(result.sections).toMatchObject({
      about: "About",
      scope: "Change",
      outOfScope: "Excluded",
      built: "Built",
      criteria: [{ id: "AC-05-008.4", text: "WHEN opened THEN it SHALL read." }],
    });
    expect(result.dependents.map((o) => o.id)).toEqual(["WO-05-002"]);
    expect(listWorkOrders(root)).toHaveLength(2);
  });
  it("supports legacy markers, empty summaries and malformed YAML without throwing", () => {
    write("WO-05-001", "# WO-05-001 Legacy\n## Status: done\n## Definition of done\n- Works");
    expect(readWorkOrderDetail(root, "WO-05-001")).toMatchObject({
      kind: "found",
      order: { state: "done" },
      sections: { criteria: [{ text: "Works" }] },
    });
    write("WO-05-002", "---\nbroken: [\n---\n# WO-05-002 Broken");
    expect(() => readWorkOrderDetail(root, "WO-05-002")).not.toThrow();
    expect(readWorkOrderDetail(root, "WO-99-999")).toEqual({ kind: "not-found" });
    expect(readWorkOrderDetail(root, "../../secret")).toEqual({ kind: "not-found" });
  });
  it("rejects traversal, absolute paths and escaping symlinks", () => {
    write("WO-05-001", "# WO-05-001 Valid");
    for (const rel of [
      "../../secret",
      "/etc/passwd",
      "docs/frds/frd-05-orders/work-orders/../../secret.md",
      "docs/frds/frd-05-orders/work-orders/wo-../secret.md",
    ])
      expect(readWorkOrderDoc(root, rel)).toBeNull();
    fs.writeFileSync(path.join(root, "outside.md"), "Outside work-orders");
    fs.symlinkSync(path.join(root, "outside.md"), path.join(root, folder, "wo-05-002-link.md"));
    expect(readWorkOrderDoc(root, `${folder}/wo-05-002-link.md`)).toBeNull();
  });
});
