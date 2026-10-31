import fs from "node:fs";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { oracleEnv } from "@/lib/config/oracleEnv";

interface OracleSignal {
  kind: string;
  target: string;
}
interface OracleStream {
  key: string;
  items: OracleSignal[];
}

function oracleExtras(): { memory: { streams: OracleStream[] } } {
  return JSON.parse(
    fs
      .readFileSync("docs/design/prototype/data/extras.js", "utf8")
      .replace(/^window.MC_EXTRAS = /, "")
      .trim()
      .replace(/;$/, ""),
  );
}

afterEach(() => vi.unstubAllEnvs());
it("FRD-17/18/22: production readers reconcile counts against the approved oracle fixture", async () => {
  for (const [key, value] of Object.entries(oracleEnv(process.cwd()))) vi.stubEnv(key, value);
  vi.resetModules();
  const { loadProposalsData } = await import("@/lib/proposals/data");
  const { resolveOwnerActions } = await import("@/lib/proposals/ownerActions");
  const { projectInboxes } = await import("@/lib/inicio/inbox");
  const { deriveFlightGroups } = await import("@/lib/inicio/flight");
  const { getProjectOverview } = await import("@/lib/portfolio/overview");
  const data = loadProposalsData();
  const actions = resolveOwnerActions(data, new Date(process.env.MC_CLOCK ?? ""));
  const signals = oracleExtras().memory.streams.find((stream) => stream.key === "suggestions");
  expect(signals?.items).toHaveLength(42);
  expect(data.suggestions).toHaveLength(35);
  expect(
    signals?.items
      .filter(
        (signal) =>
          signal.kind === "unused-capability" &&
          !data.suggestions.some(
            (item) => item.kind === signal.kind && item.target === signal.target,
          ),
      )
      .map((signal) => signal.target),
  ).toEqual(["absorb", "bug", "iterate", "memory", "new-version", "scaffold", "work-orders"]);
  const recurring = data.suggestions.filter((item) => item.kind === "recurring-lesson");
  const proposed = data.lessons.filter((lesson) => lesson.promotion === "proposed");
  expect(recurring).toHaveLength(12);
  expect(proposed).toHaveLength(4);
  expect(proposed.every((lesson) => recurring.some((item) => item.target === lesson.id))).toBe(
    true,
  );
  expect(actions.waitingLessons).toHaveLength(12);
  expect(data.backlog.errors).toEqual([]);
  expect(data.backlog.items.filter((item) => ["open", "doing"].includes(item.status))).toHaveLength(
    11,
  );
  const groups = deriveFlightGroups(projectInboxes());
  expect(groups.map((group) => [group.kind, group.rows.length])).toEqual([
    ["building", 18],
    ["review", 9],
    ["draft", 2],
  ]);
  expect(groups.flatMap((group) => group.rows)).toHaveLength(29);
  expect(groups.flatMap((group) => group.rows).map((row) => row.project)).toContain(
    "Mission Control",
  );
  expect(groups.flatMap((group) => group.rows).map((row) => row.project)).not.toContain(
    "Pandacorp (Mission Control)",
  );
  expect(getProjectOverview().find((item) => item.path.includes("mission-control"))?.name).toBe(
    "Mission Control",
  );
});

it("FRD-01 document scope excludes the oracle's root design and engineering rule files", async () => {
  const { listProjectDocs } = await import("@/lib/docs/tree");
  const snapshot: {
    projects: { id: string; docs: { relPath: string }[] }[];
  } = JSON.parse(
    fs
      .readFileSync("docs/design/prototype/data/snapshot.js", "utf8")
      .replace(/^window.MC_SNAPSHOT = /, "")
      .trim()
      .replace(/;$/, ""),
  );
  const oracle = snapshot.projects.find((project) => project.id === "funko-tracker");
  const docs = listProjectDocs(
    path.resolve("docs/design/prototype/fixtures/projects/funko-tracker"),
  );
  expect(oracle?.docs).toHaveLength(82);
  expect(docs).toHaveLength(80);
  expect(oracle?.docs.filter((item) => !docs.some((doc) => doc.relPath === item.relPath))).toEqual([
    expect.objectContaining({ relPath: "DESIGN.md" }),
    expect.objectContaining({ relPath: "docs/rules/README.md" }),
  ]);
});
