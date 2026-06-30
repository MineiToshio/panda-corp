/**
 * FRD-04 gate — opus reviewer adversarial tests (WO-04-005).
 *
 * Exercises the two tab bodies FRD-04 owns directly — Resumen (TabSummary) and
 * Documentos (TabDocuments) — TOGETHER, hitting edges the implementer did not see,
 * anchored to the FRD's EARS acceptance criteria:
 *
 *  - AC-04-003.3 / AC-04-004.1: every pending decision card renders its stable id
 *      and a `/pandacorp:decide <id>` command scoped to that decision (never the
 *      bare un-scoped form, which would walk every pending one). NO one-click
 *      "approve" affordance exists (owner decision, 2026-06-30 — removed: it let
 *      the owner record an answer without the context the real conversation gives).
 *      The recommendation TEXT still renders as context.
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

describe("FRD-04 gate (opus) — Resumen decision card (no approve affordance)", () => {
  it("renders no nested <button> across MULTIPLE pending decisions with recommendations", () => {
    const decisions: DecisionPoint[] = [
      {
        id: "2026-06-15-1",
        title: "¿Subir el límite de gasto?",
        date: "2026-06-15",
        status: "pending",
        recommendation: "Usar 500 €/mes",
        resolved: false,
      },
      {
        id: "2026-06-15-2",
        title: "¿Qué proveedor de email?",
        date: "2026-06-15",
        status: "pending",
        recommendation: "Resend",
        resolved: false,
      },
    ];
    renderSummary(decisions, 2);
    assertNoNestedButtons();
  });

  it("a recommendation with an embedded double quote renders verbatim as context (no escaping/truncation drift) and never as a one-click command", () => {
    // Real comms edge: a recommendation with an embedded double quote.
    const rec = 'Plan "Pro"';
    renderSummary(
      [
        {
          id: "2026-06-15-1",
          title: "Plan?",
          date: "2026-06-15",
          status: "pending",
          recommendation: rec,
          resolved: false,
        },
      ],
      1,
    );
    expect(document.body.innerHTML).toContain(rec);
    // No approve-btn anywhere — the recommendation is context only, never a copyable
    // "Aprobado: …" command (owner decision, 2026-06-30).
    expect(screen.queryByTestId("approve-btn")).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("Aprobado:");
  });

  it("the /pandacorp:decide command always embeds this decision's id, never a bare un-scoped command (with or without a recommendation)", () => {
    renderSummary(
      [
        {
          id: "2026-06-15-1",
          title: "Algo sin recomendación",
          date: "2026-06-15",
          status: "pending",
          resolved: false,
        },
      ],
      1,
    );
    expect(screen.getByTestId("decision-id")).toHaveTextContent("2026-06-15-1");
    expect(document.body.innerHTML).toContain("/pandacorp:decide 2026-06-15-1");
    // Never the old un-scoped form (no trailing id), which would walk every pending decision.
    expect(document.body.innerHTML).not.toMatch(/\/pandacorp:decide<\/code>/);
  });

  it("a resolved decision shows no warn card and no approve affordance", () => {
    renderSummary(
      [
        {
          id: "2026-06-15-1",
          title: "Ya decidido",
          date: "2026-06-15",
          status: "resolved",
          recommendation: "X",
          resolved: true,
        },
      ],
      0,
    );
    expect(screen.queryByTestId("decision-warn-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("approve-btn")).not.toBeInTheDocument();
  });

  it("an obsolete decision shows the 'Obsoleta' tag, distinct from a plain resolved one", () => {
    renderSummary(
      [
        {
          id: "2026-06-15-1",
          title: "Ya no aplica",
          date: "2026-06-15",
          status: "obsolete",
          resolved: true,
        },
      ],
      0,
    );
    expect(screen.getByTestId("decision-obsolete-tag")).toHaveTextContent("Obsoleta");
  });
});

describe("FRD-04 gate (opus) — pending decision age hint (owner request, 2026-06-30)", () => {
  /** YYYY-MM-DD for "now minus N days" — relative to the real clock, deterministic regardless of when the test runs. */
  function daysAgoIso(n: number): string {
    const d = new Date(Date.now() - n * 86_400_000);
    return d.toISOString().slice(0, 10);
  }

  it("a decision dated today shows 'hoy'", () => {
    renderSummary(
      [
        {
          id: `${daysAgoIso(0)}-1`,
          title: "Algo",
          date: daysAgoIso(0),
          status: "pending",
          resolved: false,
        },
      ],
      1,
    );
    expect(screen.getByTestId("decision-age")).toHaveTextContent("hoy");
  });

  it("a decision dated 12 days ago shows 'hace 12 días'", () => {
    renderSummary(
      [
        {
          id: `${daysAgoIso(12)}-1`,
          title: "Algo viejo",
          date: daysAgoIso(12),
          status: "pending",
          resolved: false,
        },
      ],
      1,
    );
    expect(screen.getByTestId("decision-age")).toHaveTextContent("hace 12 días");
  });

  it("a legacy decision (no date) shows no age hint", () => {
    renderSummary(
      [{ id: "legacy-1", title: "Legacy", date: null, status: "pending", resolved: false }],
      1,
    );
    expect(screen.queryByTestId("decision-age")).not.toBeInTheDocument();
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
      {
        id: "2026-06-15-1",
        title: "¿Subir gasto?",
        date: "2026-06-15",
        status: "pending",
        recommendation: "500 €/mes",
        resolved: false,
      },
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
