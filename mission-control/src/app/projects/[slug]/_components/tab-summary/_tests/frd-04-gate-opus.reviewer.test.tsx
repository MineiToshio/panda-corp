/**
 * FRD-04 gate — reviewer adversarial tests, reconciled for WO-04-011 (Órbita Resumen).
 *
 * Exercises the Resumen decision surface (DecisionsCard and its dialog) and Documentos, anchored to
 * AC-04-014.5, the REQ-04-004 scoped-command and no-approve clauses, and the read-only invariant
 * (DR-061). The v1 age hint and warn card moved to the project Tu turno (WO-18-002); the visible
 * "Obsoleta" tag is out of v2.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { DecisionPoint } from "@/lib/docs/activity";
import type { DocNode } from "@/lib/docs/tree";
import { TabDocuments } from "../../tab-documents/tab-documents";
import { DecisionsCard } from "../DecisionsCard";

function renderDecisions(decisions: DecisionPoint[]) {
  return render(
    <DecisionsCard decisions={decisions} projectName="Funko Tracker" projectHref="/projects/x" />,
  );
}

function decision(overrides: Partial<DecisionPoint> = {}): DecisionPoint {
  return {
    id: "2026-06-15-1",
    title: "¿Subir el límite de gasto?",
    date: "2026-06-15",
    status: "pending",
    resolved: false,
    ...overrides,
  };
}

async function openFirst(): Promise<HTMLElement> {
  const [row] = screen.getAllByRole("button");
  if (!row) throw new Error("no decision row");
  await userEvent.click(row);
  return screen.getByRole("dialog");
}

function assertNoNestedButtons(): void {
  const buttons = screen.getAllByRole("button");
  expect(buttons.length).toBeGreaterThan(0);
  for (const btn of buttons) {
    expect(within(btn).queryAllByRole("button")).toHaveLength(0);
  }
}

describe("FRD-04 gate — Resumen decisions", () => {
  it("AC-04-014.5: rows and the open dialog nest no button inside a button", async () => {
    renderDecisions([decision({ recommendation: "Usar 500 €/mes" }), decision({ id: "b" })]);
    assertNoNestedButtons();
    await openFirst();
    assertNoNestedButtons();
  });

  it("REQ-04-004: a recommendation renders verbatim as text, never as an approve affordance", async () => {
    const rec = 'Plan "Pro"';
    renderDecisions([decision({ recommendation: rec })]);
    const dialog = await openFirst();
    expect(within(dialog).getByText(rec)).toBeInTheDocument();
    expect(screen.queryByTestId("approve-btn")).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("Aprobado:");
    expect(within(dialog).queryByRole("button", { name: /aprobar/i })).not.toBeInTheDocument();
  });

  it("REQ-04-004: the dialog command embeds this decision's id, never the bare form", async () => {
    renderDecisions([decision()]);
    const dialog = await openFirst();
    expect(
      within(dialog).getByRole("button", { name: "Copiar /pandacorp:decide 2026-06-15-1" }),
    ).toBeInTheDocument();
    expect(dialog.innerHTML).not.toMatch(/\/pandacorp:decide<\/code>/);
  });

  it("AC-04-014.5: Resuelta and Pendiente are chip words, and an in-file resolution is flagged", () => {
    renderDecisions([
      decision({ id: "a", title: "Abierta" }),
      decision({ id: "b", title: "Cerrada", status: "resolved", resolved: true }),
      decision({
        id: "c",
        title: "Marcada",
        status: "resolved",
        resolved: true,
        resolvedInFile: true,
      }),
    ]);
    expect(screen.getByRole("button", { name: /Abierta/ })).toHaveTextContent("Pendiente");
    expect(screen.getByRole("button", { name: /Cerrada/ })).toHaveTextContent("Resuelta");
    const flagged = screen.getByRole("button", { name: /Marcada/ });
    expect(flagged).toHaveTextContent("Resuelta");
    expect(flagged).toHaveTextContent("ya resuelta en el archivo");
  });

  it("REQ-04-004 exclusion: an obsolete decision is never pending and shows no Obsoleta tag", () => {
    renderDecisions([decision({ status: "obsolete", resolved: true })]);
    expect(screen.queryByText("Pendiente")).not.toBeInTheDocument();
    expect(screen.queryByText("Obsoleta")).not.toBeInTheDocument();
  });

  it("edge: an undated legacy decision renders with no date and engine entries hide with a count", () => {
    renderDecisions([
      decision({ id: "legacy-1", date: null, title: "Legacy" }),
      decision({ id: "e", title: "17:35 Gate verde" }),
      decision({ id: "f", title: "2026-10-18T17:35 Reversión" }),
    ]);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(document.body.textContent).toContain("2 entradas automáticas del motor ocultas");
    expect(document.body.textContent).not.toMatch(/NaN|Invalid/);
  });

  it("empty and error: no decisions has its sentence, a read error replaces the list", () => {
    const { unmount } = renderDecisions([]);
    expect(screen.getByText("Sin decisiones tuyas registradas.")).toBeInTheDocument();
    unmount();
    render(
      <DecisionsCard
        decisions={[]}
        projectName="X"
        projectHref="/x"
        error={<p>fallo de lectura</p>}
      />,
    );
    expect(screen.getByText("fallo de lectura")).toBeInTheDocument();
    expect(screen.queryByText("Sin decisiones tuyas registradas.")).not.toBeInTheDocument();
  });
});

describe("FRD-04 gate (opus) — Documentos nav + body integration", () => {
  const NODES: DocNode[] = [
    { id: "prd", label: "prd.md", group: "Product", relPath: "docs/product/prd.md" },
    {
      id: "frd-04-frd",
      label: "frd.md",
      group: "Feature: frd-04-project-workspace",
      relPath: "docs/frds/frd-04-project-workspace/frd.md",
    },
  ];

  it("marks EXACTLY the selected node aria-current and renders its markdown body (AC-04-006.1/.2)", () => {
    const md = "# Workspace\n\nbody copy";
    render(<TabDocuments nodes={NODES} selectedId="frd-04-frd" content={md} project="mc" />);

    const items = screen.getAllByTestId("doc-nav-item");
    const current = items.filter((el) => el.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain("frd.md");

    const body = screen.getByTestId("documents-body");
    expect(body).toHaveTextContent("body copy");
    // react-markdown turns the "# Workspace" heading into a real heading.
    expect(within(body).getByRole("heading", { name: "Workspace" })).toBeInTheDocument();
  });

  it("renders the graceful empty state with no docs and never throws (AC-04-006.3)", () => {
    render(<TabDocuments nodes={[]} selectedId={null} content={null} project="mc" />);
    expect(screen.getByTestId("documents-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("documents-nav")).not.toBeInTheDocument();
  });
});

describe("FRD-04 gate (opus) — read-only invariant (DR-061)", () => {
  it("the decision surface renders no form and its dialog offers only copy and navigation", async () => {
    const { container } = renderDecisions([decision({ recommendation: "500 €/mes" })]);
    expect(container.querySelector("form")).toBeNull();
    const dialog = await openFirst();
    expect(dialog.querySelector("form")).toBeNull();
    for (const btn of within(dialog).getAllByRole("button")) {
      expect(btn.getAttribute("aria-label") ?? "").toMatch(/^(Copiar|Cerrar)/);
    }
  });

  it("the Documentos tab renders no <form> and no buttons — navigation is plain links", () => {
    const nodes: DocNode[] = [
      { id: "prd", label: "prd.md", group: "Product", relPath: "docs/product/prd.md" },
    ];
    const { container } = render(
      <TabDocuments nodes={nodes} selectedId="prd" content="# Title" project="mc" />,
    );
    expect(container.querySelector("form")).toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // Nav items are anchors with an href (URL-driven selection, no client mutation).
    for (const a of screen.getAllByTestId("doc-nav-item")) {
      expect(a.tagName.toLowerCase()).toBe("a");
      expect(a.getAttribute("href")).toBeTruthy();
    }
  });
});
