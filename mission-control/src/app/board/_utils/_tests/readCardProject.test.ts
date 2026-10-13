/**
 * readCardProject — the per-card project read behind the board page.
 *
 * Traceability: REQ-02-009 (tabs), REQ-02-011 (Spec digest), REQ-02-013 (Arquitectura digest).
 * The digests and docs are read for ANY card linked to a project (in-pipeline, shipped,
 * discarded), not only in-pipeline ones; a card with no project reads nothing.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readCardProject } from "@/app/board/_utils/readCardProject";
import type { IdeaCard } from "@/lib/ideas/ideas";

let projectPath: string;
let bareProjectPath: string;

function write(root: string, rel: string, content: string): void {
  const file = join(root, rel);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, content);
}

beforeAll(() => {
  const root = mkdtempSync(join(tmpdir(), "board-card-project-"));
  projectPath = join(root, "launched");
  write(
    projectPath,
    ".pandacorp/status.yaml",
    "project: Launched\nphase: release\nrunning: true\n",
  );
  write(projectPath, ".pandacorp/comms/spec-resumen.md", "## Spec\n\nDigest");
  write(projectPath, ".pandacorp/comms/arquitectura-resumen.md", "## Arquitectura\n\nDigest");
  write(projectPath, "docs/product/prd.md", "# PRD");
  write(projectPath, "docs/frds/frd-01-core/frd.md", "# FRD");
  bareProjectPath = join(root, "bare");
  write(bareProjectPath, ".pandacorp/status.yaml", "project: Bare\nphase: product\n");
});

afterAll(() => {
  rmSync(join(projectPath, ".."), { recursive: true, force: true });
});

function card(overrides: Partial<IdeaCard>): IdeaCard {
  return { slug: "c", title: "C", status: "discovered", body: "", ...overrides };
}

describe("readCardProject", () => {
  it("WHEN a shipped card has a project THEN it gets the digests, scoped docs and live artifacts", () => {
    const data = readCardProject(card({ status: "shipped", project: projectPath }));
    expect(data.specContent).toContain("Spec");
    expect(data.architectureContent).toContain("Arquitectura");
    expect(data.docNodes?.map((n) => n.relPath)).toEqual(
      expect.arrayContaining(["docs/product/prd.md", "docs/frds/frd-01-core/frd.md"]),
    );
    expect(data.frdCount).toBe(1);
    expect(data.workOrders).toBeDefined();
    expect(data.projectStatus?.present).toBe(true);
  });

  it("WHEN a discarded card has a project THEN it gets the digests and docs", () => {
    const data = readCardProject(card({ status: "discarded", project: projectPath }));
    expect(data.specContent).toBeDefined();
    expect(data.architectureContent).toBeDefined();
    expect(data.docNodes?.length).toBeGreaterThan(0);
  });

  it("WHEN an in-pipeline card has a project THEN it behaves as before", () => {
    const data = readCardProject(card({ status: "in-pipeline", project: projectPath }));
    expect(data.projectStatus?.present && data.projectStatus.status.phase).toBe("release");
    expect(data.specContent).toBeDefined();
    expect(data.architectureContent).toBeDefined();
  });

  it("WHEN the project has no architecture digest THEN the heavy live artifacts are not read", () => {
    const data = readCardProject(card({ status: "shipped", project: bareProjectPath }));
    expect(data.specContent).toBeUndefined();
    expect(data.architectureContent).toBeUndefined();
    expect(data.workOrders).toBeUndefined();
    expect(data.envVars).toBeUndefined();
    expect(data.adrs).toBeUndefined();
  });

  it("WHEN a discovered card has no project THEN nothing is read", () => {
    expect(readCardProject(card({ status: "discovered" }))).toEqual({
      projectStatus: null,
      docNodes: undefined,
      frdCount: undefined,
      specContent: undefined,
      architectureContent: undefined,
      workOrders: undefined,
      envVars: undefined,
      adrs: undefined,
    });
  });
});
