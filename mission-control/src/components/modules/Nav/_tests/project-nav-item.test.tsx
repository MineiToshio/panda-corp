import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProjectOverviewItem } from "@/lib/portfolio/overview";
import { ProjectNavItem } from "../ProjectNavItem";

function project(id: string, total: number | null = 10): ProjectOverviewItem {
  return {
    id,
    name: id,
    path: `/projects/${id}`,
    phase: "implementation",
    source: {
      name: id,
      path: `/projects/${id}`,
      exists: true,
      running: false,
      status: { present: false, malformed: false, status: null },
    },
    stageIndex: 5,
    build: { kind: "idle", lastSignalAt: null, ageMinutes: null },
    nowIso: "2026-10-30T12:00:00Z",
    lastCommit: { at: "2026-10-30T10:00:00Z" },
    pathMissing: false,
    counts: {
      ordersTotal: total,
      ordersVerified: 4,
      frds: 1,
      docs: 1,
      adrs: 0,
      openChanges: 0,
      pendingDecisions: 0,
    },
    nextCommand: "/pandacorp:implement",
  };
}

describe("AC-19-005.1: phase and project progress", () => {
  it("uses shared phase hue, initials, percentage and exact no-orders wording", () => {
    const view = render(<ProjectNavItem project={project("Alpha Beta")} />);
    expect(screen.getByRole("img", { name: "Alpha Beta" })).toHaveAttribute("data-tone", "violet");
    expect(screen.getByRole("link")).toHaveTextContent("Construcción · 40%");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/portfolio/Alpha%20Beta/summary");
    view.rerender(<ProjectNavItem project={project("Alpha Beta", 0)} />);
    expect(
      screen.getByRole("link", { name: "Alpha Beta: Construcción, sin work orders" }),
    ).toBeInTheDocument();
    view.rerender(<ProjectNavItem project={project("Alpha Beta", null)} />);
    expect(screen.getByRole("link")).not.toHaveTextContent("0%");
    expect(screen.getByRole("link")).not.toHaveAccessibleName(/sin work orders/);
  });
});

it("DR-078: announces the unread-file count instead of a fabricated percentage", () => {
  render(
    <ProjectNavItem
      project={{
        ...project("PersonalPage", null),
        orderErrors: [
          {
            file: "docs/frds/frd-03/work-orders/wo-03-002.md",
            reason: "malformed YAML frontmatter",
          },
        ],
      }}
    />,
  );
  expect(
    screen.getByRole("link", { name: "PersonalPage: Construcción · 1 archivo sin leer" }),
  ).toHaveTextContent("1 archivo sin leer");
  expect(screen.getByRole("link")).not.toHaveTextContent("40%");
});
