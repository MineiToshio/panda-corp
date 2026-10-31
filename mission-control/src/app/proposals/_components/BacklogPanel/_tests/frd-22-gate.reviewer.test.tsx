/**
 * FRD-22 — REVIEWER FRD-GATE acceptance and boundary tests (DR-015, DR-080).
 * Written against the FRD and the blueprint Contracts, independently of the implementer's suite.
 */

import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BacklogItem } from "@/lib/backlog/backlog";
import { discardBacklogAction } from "../../../_actions/discard-backlog";
import { BacklogPanel } from "../BacklogPanel";

vi.mock("../../../_actions/discard-backlog", () => ({ discardBacklogAction: vi.fn() }));

function item(id: string, patch: Partial<BacklogItem> = {}): BacklogItem {
  return {
    id,
    title: `Issue ${id}`,
    type: "bug",
    area: "hooks",
    status: "open",
    severity: "p0",
    source: "SOURCE-EVIDENCE",
    closes: "",
    links: ["LINK-EVIDENCE"],
    opened: "2026-10-17",
    closed: null,
    body: "## Problem\nBroken build",
    ...patch,
  };
}
const panel = (items: BacklogItem[], errors: { file: string; reason: string }[] = []): void => {
  render(<BacklogPanel result={{ items, errors }} />);
};
const many = (count: number, patch: Partial<BacklogItem>): BacklogItem[] =>
  Array.from({ length: count }, (_, i) => item(`BL-${1000 + i}`, patch));
const rows = (): number => screen.getAllByRole("button", { name: /^BL-\d+ · / }).length;

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/proposals/backlog");
});

describe("filters (AC-22-010.1, AC-22-010.2, worked example)", () => {
  it("tile and bar combine, counts follow the blueprint, and Quitar filtros restores all", () => {
    panel([
      item("BL-1", { area: "hooks" }),
      item("BL-2", { area: "plugin-skill" }),
      item("BL-3", { area: "plugin-skill", severity: "p1" }),
      item("BL-4", { status: "doing", area: "plugin-skill" }),
      item("BL-5", { status: "done", area: "plugin-skill" }),
    ]);
    expect(screen.getByRole("button", { name: /P0 · urgente/ })).toHaveTextContent("2");
    fireEvent.click(screen.getByRole("button", { name: /P0 · urgente/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Skills/ }));
    expect(screen.getByText("2 ítems")).toBeVisible();
    expect(screen.queryByRole("button", { name: /BL-1 ·/ })).toBeNull();
    expect(screen.getByRole("button", { name: /BL-2 ·/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /BL-4 ·/ })).toBeVisible();
    expect(screen.getByText("Hechos y descartados 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));
    expect(screen.getByText("4 ítems")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Quitar filtros" })).toBeNull();
  });

  it("an empty filtered result reads the catalogue sentence and En curso disappears", () => {
    panel([item("BL-1"), item("BL-2", { severity: "p1", type: "change" })]);
    fireEvent.click(screen.getByRole("button", { name: /P0 · urgente/ }));
    fireEvent.click(screen.getByRole("button", { name: /Mejoras/ }));
    expect(screen.getByText("Nada abierto con este filtro.")).toBeVisible();
    expect(screen.queryByRole("heading", { name: /En curso/ })).toBeNull();
  });
});

describe("page limits (AC-22-010.4, blueprint Contracts)", () => {
  it.each([
    ["p0", 20],
    ["p1", 20],
    ["p2", 10],
    [null, 10],
  ] as const)("%s shows exactly its page and no bar at the size, and a bar one above", (severity, size) => {
    const { unmount } = render(
      <BacklogPanel result={{ errors: [], items: many(size, { severity }) }} />,
    );
    expect(rows()).toBe(size);
    expect(screen.queryByRole("button", { name: /^Mostrar/ })).toBeNull();
    unmount();
    panel(many(size + 1, { severity }));
    expect(rows()).toBe(size);
    expect(screen.getByRole("button", { name: "Mostrar 1 más · quedan 1" })).toBeVisible();
  });

  it("the history pages at 15 and is collapsed then closable (AC-22-006.2)", () => {
    panel(many(17, { status: "done" }));
    const history = screen.getByText("Hechos y descartados 17").closest("details");
    if (!history) throw new Error("the history must be a native disclosure");
    expect(history.open).toBe(false);
    fireEvent.click(screen.getByText("Hechos y descartados 17"));
    expect(history.open).toBe(true);
    expect(within(history).getAllByRole("button", { name: /^BL-/ })).toHaveLength(15);
    fireEvent.click(within(history).getByRole("button", { name: "Mostrar 2 más · quedan 2" }));
    expect(within(history).getAllByRole("button", { name: /^BL-/ })).toHaveLength(17);
    expect(within(history).queryByRole("button", { name: /^Mostrar/ })).toBeNull();
  });

  it("the history card is omitted when there is none (AC-22-006.1)", () => {
    panel([item("BL-1")]);
    expect(screen.queryByText(/Hechos y descartados/)).toBeNull();
  });
});

describe("states and how-to (AC-22-001.2, AC-22-004.2, AC-22-009.1, AC-22-010.3)", () => {
  it("an empty backlog is explicit and offers no command", () => {
    panel([]);
    // "Nada abierto con este filtro." belongs to a filtered result (AC-22-010.2), and an empty
    // backlog has no filter to blame.
    expect(screen.getByText("No hay ítems en el backlog.")).toBeVisible();
    expect(screen.queryByText("Nada abierto con este filtro.")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Copiar/ })).toBeNull();
  });

  it("the whole-queue command comes first, then one that names a real actionable item", () => {
    panel([item("BL-0042", { status: "doing" }), item("BL-0050", { status: "done" })]);
    const commands = screen
      .getAllByRole("button", { name: /^Copiar/ })
      .map((button) => button.getAttribute("aria-label"));
    expect(commands).toEqual([
      "Copiar /pandacorp:implement-backlog",
      "Copiar /pandacorp:implement-backlog BL-0042",
    ]);
  });

  it("the read-error notice names file and reason above the tiles and keeps the parsed rows", () => {
    panel([item("BL-1")], [{ file: "BL-9.md", reason: "bad yaml" }]);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("BL-9.md");
    expect(alert).toHaveTextContent("bad yaml");
    expect(
      alert.compareDocumentPosition(screen.getByRole("button", { name: /P0 · urgente/ })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /BL-1 ·/ })).toBeVisible();
  });
});

describe("item dialog (AC-22-005.3, AC-22-007.1, AC-22-009.2)", () => {
  it.each(["done", "discarded"] as const)("a %s item has no command and no discard", (status) => {
    window.history.replaceState(null, "", "/proposals/backlog/BL-1");
    panel([item("BL-1", { status })]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: /^Copiar/ })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Descartar" })).toBeNull();
  });

  it("evidence, source, links and dates stay out of the row and the dialog", () => {
    window.history.replaceState(null, "", "/proposals/backlog/BL-1");
    panel([item("BL-1")]);
    expect(document.body.textContent).not.toMatch(/SOURCE-EVIDENCE|LINK-EVIDENCE/);
  });

  it("a blank reason reaches the action as a failure-free call and closes on success", async () => {
    vi.mocked(discardBacklogAction).mockResolvedValue({ ok: true });
    window.history.replaceState(null, "", "/proposals/backlog/BL-1");
    panel([item("BL-1")]);
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Descartar del backlog");
    expect(screen.getByLabelText("Motivo (opcional)")).toHaveAttribute("maxlength", "500");
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(await screen.findByText("Hechos y descartados 1")).toBeInTheDocument();
    expect(discardBacklogAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("the behaviour specs own their fixtures (WO-22-002: no persistent test data)", () => {
  it.each([
    "e2e/backlog.spec.ts",
    "e2e/proposals.spec.ts",
  ])("%s never adopts a crash leftover as the file to restore", (spec) => {
    const source = fs.readFileSync(path.resolve(spec), "utf8");
    expect(source).not.toMatch(/originals\.set\(file, fs\.existsSync\(file\)/);
  });
});
