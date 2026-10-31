import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectListItem } from "../portfolio";

vi.mock("../portfolio", () => ({ allProjects: vi.fn() }));
vi.mock("../lastCommit", () => ({ getLastCommit: vi.fn() }));
vi.mock("@/lib/work-orders/work-orders", () => ({
  aggregateProgress: vi.fn(),
}));
vi.mock("@/lib/work-orders/published", () => ({ readPublishedWorkOrders: vi.fn() }));
vi.mock("@/lib/docs/tree", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/docs/tree")>()),
  listProjectDocs: vi.fn(),
}));
vi.mock("@/lib/changes/openChanges", () => ({ countOpenChanges: vi.fn() }));
vi.mock("@/lib/events/events", () => ({ readEvents: () => ({ events: [] }) }));
vi.mock("@/lib/navigation/identities", () => ({
  getProjectNavigation: (_path: string, name: string) => ({ slug: name.toLowerCase() }),
}));

import { countOpenChanges } from "@/lib/changes/openChanges";
import { listProjectDocs } from "@/lib/docs/tree";
import { readPublishedWorkOrders } from "@/lib/work-orders/published";
import { aggregateProgress } from "@/lib/work-orders/work-orders";
import { getLastCommit } from "../lastCommit";
import { getProjectOverview } from "../overview";
import { allProjects } from "../portfolio";

const project = (
  name: string,
  stage: ProjectListItem["stage"] = "implementation",
): ProjectListItem => ({
  name,
  path: `/absent/${name}`,
  exists: true,
  stage,
  running: true,
  status: {
    present: true,
    malformed: false,
    status: {
      phase: stage,
      running: true,
      pendingDecisions: 3,
      supervisorHeartbeat: "2026-10-30T11:00:00Z",
    },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("MC_CLOCK", "2026-10-30T12:00:00Z");
  vi.mocked(allProjects).mockReturnValue([project("Alpha")]);
  vi.mocked(readPublishedWorkOrders).mockReturnValue({ items: [], errors: [] });
  vi.mocked(aggregateProgress).mockReturnValue({ done: 2, total: 5, pct: 40 });
  vi.mocked(listProjectDocs).mockReturnValue([
    { id: "frd", label: "frd", group: "Feature: frd-01-a", relPath: "docs/frds/frd-01-a/frd.md" },
    {
      id: "blueprint",
      label: "blueprint",
      group: "Feature: frd-02-b",
      relPath: "docs/frds/frd-02-b/blueprint.md",
    },
    { id: "adr", label: "adr", group: "Global", relPath: "docs/adr/001.md" },
  ]);
  vi.mocked(countOpenChanges).mockReturnValue({ ok: true, count: 4, errors: [] });
  vi.mocked(getLastCommit).mockReturnValue({ at: "2026-10-30T10:00:00Z" });
});

describe("AC-03-008.1: canonical overview", () => {
  it("derives counts once from their canonical readers, rejects stale running claims, and exposes the public slug", () => {
    const [item] = getProjectOverview();
    expect(item).toMatchObject({
      id: "alpha",
      stageIndex: 5,
      nextCommand: "/pandacorp:implement",
      build: { kind: "no-signal" },
      counts: {
        ordersVerified: 2,
        ordersTotal: 5,
        frds: 2,
        docs: 3,
        adrs: 1,
        openChanges: 4,
        pendingDecisions: 3,
      },
    });
    expect(readPublishedWorkOrders).toHaveBeenCalledExactlyOnceWith("/absent/Alpha");
    expect(countOpenChanges).toHaveBeenCalledExactlyOnceWith("/absent/Alpha");
  });
  it("sorts by last commit descending, missing dates last, with name ties", () => {
    vi.mocked(allProjects).mockReturnValue([
      project("Zed"),
      project("Beta"),
      project("Alpha"),
      project("Recent"),
    ]);
    vi.mocked(getLastCommit).mockImplementation((p) =>
      p.endsWith("Zed")
        ? { at: null, reason: "unreadable" }
        : { at: p.endsWith("Recent") ? "2026-10-30T11:00:00Z" : "2026-10-29T10:00:00Z" },
    );
    expect(getProjectOverview().map((p) => p.name)).toEqual(["Recent", "Alpha", "Beta", "Zed"]);
  });
  it.each([
    ["product", 2, "/pandacorp:design"],
    ["design", 3, "/pandacorp:architecture"],
    ["architecture", 4, "/pandacorp:implement"],
    ["implementation", 5, "/pandacorp:implement"],
    ["release", 6, "/pandacorp:review-launch"],
  ] as const)("maps %s to stage %s and its next command", (phase, stageIndex, nextCommand) => {
    vi.mocked(allProjects).mockReturnValue([project("Alpha", phase)]);
    expect(getProjectOverview()[0]).toMatchObject({ phase, stageIndex, nextCommand });
  });
  it("advances a completely verified implementation to release", () => {
    vi.mocked(aggregateProgress).mockReturnValue({ done: 5, total: 5, pct: 100 });
    expect(getProjectOverview()[0]?.nextCommand).toBe("/pandacorp:release");
  });
  it("keeps a missing folder, omits all counts, and never calls project readers or git", () => {
    vi.mocked(allProjects).mockReturnValue([
      { ...project("Missing"), exists: false, stage: undefined },
    ]);
    const [item] = getProjectOverview();
    expect(item).toMatchObject({ pathMissing: true, phase: undefined, stageIndex: 0 });
    expect(Object.values(item?.counts ?? {})).toEqual(Array(7).fill(null));
    expect(readPublishedWorkOrders).not.toHaveBeenCalled();
    expect(getLastCommit).not.toHaveBeenCalled();
  });
  it("does not manufacture zero for a failed source or malformed status", () => {
    vi.mocked(countOpenChanges).mockReturnValue({
      ok: false,
      count: null,
      errors: [{ file: "queue", reason: "invalid" }],
    });
    vi.mocked(allProjects).mockReturnValue([
      { ...project("Alpha"), status: { present: true, malformed: true, status: {} } },
    ]);
    expect(getProjectOverview()[0]?.counts).toMatchObject({
      openChanges: null,
      pendingDecisions: null,
    });
    vi.mocked(listProjectDocs).mockImplementation(() => {
      throw new Error("unreadable");
    });
    expect(Object.values(getProjectOverview()[0]?.counts ?? {})).toEqual(Array(7).fill(null));
  });
});

it("REQ-03-003: displays the approved short project name without changing its source identity", () => {
  vi.mocked(allProjects).mockReturnValue([project("Pandacorp (Mission Control)")]);
  const item = getProjectOverview()[0];
  expect(item?.name).toBe("Mission Control");
  expect(item?.source.name).toBe("Pandacorp (Mission Control)");
  expect(item?.id).toBe("pandacorp (mission control)");
});

it("DR-115 DR-078: a partial strict plan exposes file failures and withholds exact totals", () => {
  vi.mocked(readPublishedWorkOrders).mockReturnValue({
    items: [],
    errors: [
      { file: "docs/frds/frd-03/work-orders/wo-03-002.md", reason: "malformed YAML frontmatter" },
    ],
  });
  expect(getProjectOverview()[0]).toMatchObject({
    counts: { ordersVerified: null, ordersTotal: null },
    orderErrors: [{ file: "docs/frds/frd-03/work-orders/wo-03-002.md" }],
    nextCommand: "/pandacorp:implement",
  });
});
