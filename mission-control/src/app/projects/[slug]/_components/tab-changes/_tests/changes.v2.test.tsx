import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { ChangeQueueItem } from "@/lib/changes/changes";
import { ChangesPanel } from "../ChangesPanel";

it("REQ-04-010 / REQ-04-011: orders active groups, combines history and uses absolute dates", () => {
  const items = ["ready", "draft", "building", "closing", "done", "discarded"].map((status) => ({
    id: status,
    title: status,
    status,
    type: "change",
    cls: "standard",
    date: "2026-10-19",
    frd: "FRD-04",
    dependsOn: "",
    rebuildsVerified: false,
    body: "Body",
    implementedSha: "",
    closingAt: "",
  })) as ChangeQueueItem[];
  render(<ChangesPanel result={{ items, errors: [] }} projectPath="/tmp/project" slug="project" />);
  expect(screen.getByText("Historial 2").closest("details")).not.toHaveAttribute("open");
  expect(
    screen
      .getAllByRole("heading")
      .map((node) => node.textContent)
      .slice(0, 4),
  ).toEqual(["Listos para construir1", "En construcción1", "Cerrando1", "Borradores1"]);
  expect(screen.getAllByTitle("2026-10-19")[0]).toHaveTextContent("19 oct. 2026");
  expect(screen.queryByRole("main")).not.toBeInTheDocument();
});
