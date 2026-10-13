/**
 * readCardProject — REVIEWER adversarial tests (DR-015, builder-blind).
 *
 * The read now runs for shipped and discarded cards too, whose project folders are the most
 * likely to be stale (moved, deleted, half-written status.yaml). These pin that such a card
 * never takes the board down and never changes its terminal column (REQ-02-001, AC-02-011.1,
 * AC-02-013.1): a missing folder is the deliberate absent state, a malformed status.yaml is a
 * typed `malformed` result (DR-078), and the column still comes from the card status alone.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readCardProject } from "@/app/board/_utils/readCardProject";
import { deriveColumn } from "@/lib/board/board";
import type { IdeaCard } from "@/lib/ideas/ideas";

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "board-card-project-reviewer-"));
  const broken = join(root, "broken");
  mkdirSync(join(broken, ".pandacorp", "comms"), { recursive: true });
  writeFileSync(join(broken, ".pandacorp", "status.yaml"), "phase: [unclosed\n  running: {\n");
  writeFileSync(join(broken, ".pandacorp", "comms", "spec-resumen.md"), "## Spec\n\nDigest");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function card(overrides: Partial<IdeaCard>): IdeaCard {
  return { slug: "c", title: "C", status: "discovered", body: "", ...overrides };
}

describe("readCardProject reviewer · stale terminal-card projects", () => {
  it("a shipped card pointing at a MISSING project folder reads as absent and stays in shipped", () => {
    const shipped = card({ status: "shipped", project: join(root, "does-not-exist") });
    const data = readCardProject(shipped);
    expect(data.projectStatus).toEqual({ present: false, malformed: false, status: null });
    expect(data.specContent).toBeUndefined();
    expect(data.architectureContent).toBeUndefined();
    expect(data.docNodes ?? []).toEqual([]);
    expect(data.workOrders).toBeUndefined();
    expect(deriveColumn(shipped, data.projectStatus)).toBe("shipped");
  });

  it("a discarded card whose status.yaml is MALFORMED yields a typed malformed result, keeps its digest and stays discarded", () => {
    const discarded = card({ status: "discarded", project: join(root, "broken") });
    const data = readCardProject(discarded);
    expect(data.projectStatus?.present).toBe(true);
    expect(data.projectStatus?.malformed).toBe(true);
    expect(data.specContent).toContain("Digest");
    expect(data.architectureContent).toBeUndefined();
    expect(deriveColumn(discarded, data.projectStatus)).toBe("discarded");
  });
});
