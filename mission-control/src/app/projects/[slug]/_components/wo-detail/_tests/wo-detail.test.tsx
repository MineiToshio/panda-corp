import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { WorkOrderDetail } from "../wo-detail";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const order: WorkOrder = {
  id: "WO-05-001",
  title: "WO-05-001 — Build reader",
  frd: "frd-05-orders",
  state: "review",
  relPath: "docs/frds/frd-05-orders/work-orders/wo-05-001.md",
  difficulty: "medium",
  reopenCount: 2,
  lastUpdated: "2026-10-22",
  requirements: ["REQ-05-004"],
  artifacts: ["src/reader.ts"],
};
const content =
  "# WO-05-001\n## Summary\nAbout this reader\n## In Scope\nRead facts\n## Out of Scope\nMutations\n## Acceptance Criteria\n- **AC-05-008.4** — WHEN opened THEN it SHALL read.\n## Status Note\nFirst block\n\nSecond block\n\nHidden block";
describe("AC-05-008.4 work-order reading summary", () => {
  it("renders ordered source cards, marked criteria, folded note, facts and copy-only command", () => {
    render(<WorkOrderDetail order={order} content={content} activeWoTab="summary" />);
    const headings = screen.getAllByRole("heading").map((node) => node.textContent);
    expect(headings.slice(0, 5)).toEqual([
      "Build reader",
      "De qué trata",
      "Qué cambia",
      "Fuera de alcance",
      "Cómo se comprueba",
    ]);
    expect(headings.indexOf("Qué se construyó")).toBeGreaterThan(
      headings.indexOf("Cómo se comprueba"),
    );
    expect(screen.getByText("WHEN").tagName).toBe("MARK");
    expect(screen.getByText("AC-05-008.4")).toBeInTheDocument();
    expect(screen.getByText("Hidden block").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Archivos que toca")).toBeInTheDocument();
    expect(screen.getByText("src/reader.ts")).toBeInTheDocument();
    expect(screen.getByText("Media")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copiar /pandacorp:implement WO-05-001" }),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole("list", { name: "Avance de la work order" })
        .querySelector('[aria-current="step"]'),
    ).toHaveTextContent("En revisión");
    expect(screen.getByText(/El contenido viene/)).toBeInTheDocument();
  });
  it("uses woview and preserves filters when switching tabs or returning", async () => {
    render(
      <WorkOrderDetail
        order={order}
        content={content}
        activeWoTab="summary"
        navigationBaseHref="/portfolio/demo/observability?view=tablero&state=review&frd=FRD-05&wo=WO-05-001"
      />,
    );
    await userEvent.click(screen.getByRole("tab", { name: "Documento completo" }));
    expect(push).toHaveBeenCalledWith(
      "/portfolio/demo/observability?view=tablero&state=review&frd=FRD-05&wo=WO-05-001&woview=full",
    );
    const back = screen.getByRole("link", { name: "Volver" }).getAttribute("href") ?? "";
    expect(back).toContain("view=tablero");
    expect(back).toContain("state=review");
    expect(back).not.toContain("wo=");
  });
  it("shows a blocker instead of steps and keeps the full source readable", () => {
    render(
      <WorkOrderDetail
        order={{ ...order, state: "fail", blockedReason: "Needs owner" }}
        content={content}
        activeWoTab="full"
      />,
    );
    expect(screen.queryByRole("list", { name: "Avance de la work order" })).not.toBeInTheDocument();
    expect(screen.getByText("Bloqueado")).toBeInTheDocument();
    const paper = screen.getByRole("article");
    expect(within(paper).getByText("Hidden block")).toBeInTheDocument();
    expect(within(paper).getByRole("button", { name: "Copiar documento" })).toBeInTheDocument();
  });
  it("shows the explicit no-summary message when all source sections are absent", () => {
    render(<WorkOrderDetail order={order} content="# Only a title" activeWoTab="summary" />);
    expect(screen.getByText(/no publica resumen/)).toBeInTheDocument();
  });
});

it("AC-05-008.4 renders criterion inline Markdown and keeps document metadata folded", () => {
  const { rerender } = render(
    <WorkOrderDetail
      order={order}
      content={content.replace(
        "it SHALL read.",
        "it SHALL read **facts**, `paths` and [the source](https://example.com).",
      )}
      activeWoTab="summary"
    />,
  );
  expect(screen.getByText("facts").tagName).toBe("STRONG");
  expect(screen.getByText("paths").tagName).toBe("CODE");
  expect(screen.getByRole("link", { name: "the source" })).toHaveAttribute(
    "href",
    "https://example.com",
  );
  expect(screen.getByText("SHALL").tagName).toBe("MARK");
  rerender(
    <WorkOrderDetail
      order={order}
      content={`---\nimplementation_status: IN_REVIEW\ndifficulty: medium\n---\n${content}`}
      activeWoTab="full"
    />,
  );
  const metadata = screen.getByText("Metadatos del documento").closest("details");
  expect(metadata).not.toHaveAttribute("open");
  expect(screen.getByText(/implementation_status: IN_REVIEW/)).toBeInTheDocument();
});
