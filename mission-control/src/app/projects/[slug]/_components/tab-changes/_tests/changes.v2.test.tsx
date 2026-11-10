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
    staleSuspect: "",
    staleHint: "",
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

it("DR-147: a card the reconciler suspects already shipped leaves Listos para construir for its own group", () => {
  const base = {
    type: "change",
    cls: "standard",
    date: "2026-11-07",
    frd: "frd-10-public-discovery",
    dependsOn: "",
    rebuildsVerified: false,
    body: "Body",
    implementedSha: "",
    closingAt: "",
    staleHint: "",
  } as const;
  const items: ChangeQueueItem[] = [
    { ...base, id: "pending", title: "Pending", status: "ready", staleSuspect: "" },
    {
      ...base,
      id: "shipped",
      title: "Shipped",
      status: "ready",
      staleSuspect: "every work order of frd-10-public-discovery is VERIFIED",
    },
    {
      ...base,
      id: "hinted",
      title: "Hinted",
      status: "ready",
      staleSuspect: "",
      staleHint: "frd.md changed",
    },
  ];
  render(<ChangesPanel result={{ items, errors: [] }} projectPath="/tmp/project" slug="project" />);
  const headings = screen.getAllByRole("heading").map((node) => node.textContent);
  expect(headings).toContain("¿Ya hecho? Revisar1");
  expect(headings).toContain("Listos para construir2");
  const ready = screen
    .getAllByTestId("change-card")
    .filter((card) => card.getAttribute("data-item") !== "shipped")
    .map((card) => card.getAttribute("data-item"));
  expect(ready).toEqual(["pending", "hinted"]);
  expect(screen.getAllByText("¿Ya hecho?")).toHaveLength(2);
});
