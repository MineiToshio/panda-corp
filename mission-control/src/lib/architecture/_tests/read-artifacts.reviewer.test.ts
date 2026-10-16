import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readCardProject } from "@/app/board/_utils/readCardProject";
import { dataModelFixture } from "@/test/dataModelFixture";
import { readArchitectureArtifacts } from "../read-artifacts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function projectWithModel(raw: unknown): string {
  const root = mkdtempSync(join(tmpdir(), "review-architecture-"));
  roots.push(root);
  mkdirSync(join(root, "docs/product"), { recursive: true });
  writeFileSync(join(root, "docs/product/data-model.json"), JSON.stringify(raw));
  return root;
}

describe("shared architecture artifact integration", () => {
  it("feeds the same complete model to workspace and board even without a prose digest", () => {
    const model = dataModelFixture();
    const root = projectWithModel(model);
    const workspace = readArchitectureArtifacts(root);
    const board = readCardProject({
      slug: "review",
      title: "Review",
      status: "shipped",
      body: "",
      project: root,
    });
    expect(workspace.architectureContent).toBeUndefined();
    expect(workspace.dataModel).toEqual({
      kind: "ready",
      model,
      source: "docs/product/data-model.json",
    });
    expect(board.dataModel).toEqual(workspace.dataModel);
    expect(workspace.workOrders).toEqual([]);
    expect(board.workOrders).toEqual(workspace.workOrders);
  });

  it("keeps malformed, missing, and no-persistence project artifacts distinct on both surfaces", () => {
    const root = projectWithModel({ unexpected: true });
    expect(readArchitectureArtifacts(root).dataModel.kind).toBe("error");
    expect(
      readCardProject({
        slug: "review",
        title: "Review",
        status: "discarded",
        body: "",
        project: root,
      }).dataModel?.kind,
    ).toBe("error");
    writeFileSync(
      join(root, "docs/product/data-model.json"),
      JSON.stringify({ schemaVersion: 1, persistence: "none", entities: [], relationships: [] }),
    );
    expect(readArchitectureArtifacts(root).dataModel).toEqual({ kind: "none" });
    expect(readArchitectureArtifacts(join(root, "absent")).dataModel).toEqual({ kind: "missing" });
  });
});
