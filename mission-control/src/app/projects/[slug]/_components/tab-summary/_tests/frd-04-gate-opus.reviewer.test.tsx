/**
 * FRD-04 gate — opus reviewer adversarial tests (WO-04-005).
 *
 * Exercises the two tab bodies FRD-04 owns directly — Resumen (TabSummary) and
 * Documentos (TabDocuments) — TOGETHER, hitting edges the implementer did not see,
 * anchored to the FRD's EARS acceptance criteria:
 *
 *  - AC-04-003.3 / AC-04-004.1 / "Aprobar la recomendación":
 *      the approve one-click copies EXACTLY `/pandacorp:decide "Aprobado: <rec>"`
 *      and is a SINGLE interactive control (no <button>-in-<button> → React #418,
 *      the defect this WO was reopened for). Verified across MULTIPLE pending
 *      decisions, and with a recommendation that itself contains a double quote
 *      (a real comms edge the implementer's single fixture did not cover).
 *  - WHERE clause: a pending decision WITHOUT a recommendation must NOT render an
 *      approve affordance (the one-click is conditional on a recommendation).
 *  - AC-04-006.1 / AC-04-006.2: the doc nav and rendered body work TOGETHER — the
 *      selected node is the only one marked aria-current="page" and the body
 *      renders the selected markdown.
 *  - DR-061 read-only invariant: neither tab body renders a <form> or a
 *      destructive control; the ONLY interactive elements are copy affordances and
 *      navigation links (the app never writes or calls Claude).
 *
 * These are CORRECTION-lens assertions (HTML validity / a11y / exact AC behavior /
 * read-only invariant), not visual nits. They are mutation-killing: a regression to
 * the nested-button form, a drift in the copied command, or a destructive control
 * leaking in would turn one RED.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ActivityLog, DecisionPoint } from "@/lib/docs/activity";
import type { DocNode } from "@/lib/docs/tree";
import { TabDocuments } from "../../tab-documents/tab-documents";
import { TabSummary } from "../tab-summary";

const EMPTY_LOG: ActivityLog = { entries: [] };

function renderSummary(decisions: DecisionPoint[], pending: number) {
  return render(
    <TabSummary
      summary="proj"
      keyPoints={[]}
      activityLog={EMPTY_LOG}
      decisions={decisions}
      pendingDecisions={pending}
    />,
  );
}

/** Assert no <button> in the document contains a descendant <button>. */
function assertNoNestedButtons(): void {
  const buttons = screen.getAllByRole("button");
  expect(buttons.length).toBeGreaterThan(0);
  for (const btn of buttons) {
    expect(
      within(btn).queryAllByRole("button"),
      "invalid <button>-in-<button> nesting (HTML validity, keyboard a11y, React #418)",
    ).toHaveLength(0);
  }
}

describe("FRD-04 gate (opus) — Resumen approve affordance", () => {
  it("renders a single interactive control per approve affordance across MULTIPLE pending decisions (no nested <button>)", () => {
    const decisions: DecisionPoint[] = [
      { title: "¿Subir el límite de gasto?", recommendation: "Usar 500 €/mes", resolved: false },
      { title: "¿Qué proveedor de email?", recommendation: "Resend", resolved: false },
    ];
    renderSummary(decisions, 2);
    assertNoNestedButtons();
  });

  it("copies the EXACT /pandacorp:decide command, preserving a recommendation that contains a double quote", () => {
    // Real comms edge: a recommendation with an embedded double quote. The copied
    // command must reproduce it verbatim (no escaping/truncation drift).
    const rec = 'Plan "Pro"';
    renderSummary([{ title: "Plan?", recommendation: rec, resolved: false }], 1);
    const expected = `/pandacorp:decide "Aprobado: ${rec}"`;
    expect(document.body.innerHTML).toContain(expected);
    // The copy affordance carries the exact value (the CopyButton's value === command).
    const approve = screen.getByTestId("approve-btn");
    expect(approve.textContent).toContain(expected);
  });

  it("does NOT render an approve affordance for a pending decision that carries NO recommendation (the WHERE clause)", () => {
    renderSummary([{ title: "Algo sin recomendación", resolved: false }], 1);
    // The decision card is shown (it is pending)...
    expect(screen.getByTestId("decision-warn-panel")).toBeInTheDocument();
    // ...but with no recommendation there is nothing to approve.
    expect(screen.queryByTestId("approve-btn")).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("Aprobado:");
  });

  it("a resolved decision shows no warn card and no approve affordance", () => {
    renderSummary([{ title: "Ya decidido", recommendation: "X", resolved: true }], 0);
    expect(screen.queryByTestId("decision-warn-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("approve-btn")).not.toBeInTheDocument();
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
  it("the Resumen tab renders no <form> and its only buttons are copy affordances", () => {
    const decisions: DecisionPoint[] = [
      { title: "¿Subir gasto?", recommendation: "500 €/mes", resolved: false },
    ];
    const { container } = renderSummary(decisions, 1);
    expect(container.querySelector("form")).toBeNull();
    // Every interactive button is the shared CopyButton (read/copy only — no run/write).
    for (const btn of screen.getAllByRole("button")) {
      expect(btn.getAttribute("data-testid")).toBe("copy-button");
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
