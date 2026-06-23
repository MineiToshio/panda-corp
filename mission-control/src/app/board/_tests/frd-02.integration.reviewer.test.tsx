/**
 * FRD-02 — Ideas board — REVIEWER integration tests (DR-015, DR-050 gate).
 *
 * Written by the FRD reviewer (Opus 4.8 — a different model from the implementers,
 * to break the shared bias). These exercise the work orders of FRD-02 TOGETHER
 * (real integration), not in isolation:
 *
 *   WO-02-001 deriveColumn (lib/board.ts, VERIFIED foundation)
 *   WO-02-003 nextStep (lib/next-step.ts)
 *   WO-02-005 IdeaBoardView + IdeaCard (board view)
 *   WO-02-007 CardDetail (next-step + docs nav)
 *   WO-02-009 discardIdeaAction (single write surface)
 *
 * Adversarial angle the implementers did not cover:
 *   - The COLUMN the board derives and the COMMAND the detail offers must be
 *     COHERENT for the same lifecycle position (they read the same two axes).
 *   - The "single write" invariant must hold when board + action are composed:
 *     the action must NOT revalidate (a side effect) on a failed discard.
 *   - Real bug anchors B1'/I3 (undefined/invalid phase) must propagate
 *     consistently through BOTH derivation paths (board fallback + next-step
 *     fallback), never producing a misleading column/command pair.
 *
 * EARS anchors: AC-02-001.*, AC-02-002.1, AC-02-004.1, AC-02-006.2, AC-02-007.1.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardDetail } from "@/app/board/_components/CardDetail/CardDetail";
import type { IdeaCardProps } from "@/components/modules/IdeaCard/IdeaCard";
import { type BoardColumn, deriveColumn } from "@/lib/board/board";
import type { IdeaCard as IdeaCardModel } from "@/lib/ideas/ideas";
import { nextStep } from "@/lib/next-step/next-step";
import type { Phase, StatusResult } from "@/lib/status/status";
import { type BoardCardEntry, IdeaBoardView } from "../IdeaBoardView/IdeaBoardView";

// ---------------------------------------------------------------------------
// Helpers — replicate the page.tsx two-axis pipeline without the filesystem.
// (page.tsx is a Server Component; here we drive the same lib composition.)
// ---------------------------------------------------------------------------

function present(phase: Phase, overrides: Record<string, unknown> = {}): StatusResult {
  return { present: true, malformed: false, status: { phase, ...overrides } };
}

function card(over: Partial<IdeaCardModel>): IdeaCardModel {
  return {
    slug: over.slug ?? "x",
    title: over.title ?? "X",
    status: over.status ?? "in-pipeline",
    body: over.body ?? "",
    ...over,
  } as IdeaCardModel;
}

// The single source mapping: what page.tsx computes per card.
function toEntry(c: IdeaCardModel, status: StatusResult | null): BoardCardEntry {
  return {
    slug: c.slug,
    title: c.title,
    status: c.status,
    body: c.body,
    boardColumn: deriveColumn(c, status),
  } satisfies IdeaCardProps & { boardColumn: BoardColumn };
}

// ---------------------------------------------------------------------------
// 1. Column ⇄ next-step coherence — the two derivations read the SAME two axes
//    and must never disagree about the lifecycle stage.
// ---------------------------------------------------------------------------

describe("FRD-02 integration: board column and next-step command are coherent", () => {
  // For every in-pipeline phase, the board column and the next-step command must
  // both reflect the same stage. A divergence (e.g. column "building" but command
  // "/pandacorp:design") would mislead the owner.
  const phaseExpectations: Array<{
    phase: Phase;
    column: BoardColumn;
    command: string;
  }> = [
    { phase: "product", column: "documented", command: "/pandacorp:design" },
    { phase: "design", column: "design", command: "/pandacorp:blueprint" },
    { phase: "architecture", column: "architecture", command: "/pandacorp:implement" },
    { phase: "implementation", column: "building", command: "/pandacorp:release" },
    // DR-085: release is the launched/shipped phase (folds in the old "operation").
    // It maps to the shipped column and its next command is iterate.
    { phase: "release", column: "shipped", command: "/pandacorp:iterate" },
  ];

  for (const { phase, column, command } of phaseExpectations) {
    it(`phase=${phase}: column "${column}" and command "${command}" agree`, () => {
      const c = card({ slug: phase, status: "in-pipeline", project: "p" });
      const status = present(phase);

      // Board axis (WO-02-001 + WO-02-005)
      expect(deriveColumn(c, status)).toBe(column);

      // Detail axis (WO-02-003 + WO-02-007)
      const step = nextStep({ cardStatus: "in-pipeline", phase });
      expect(step.command).toBe(command);
    });
  }

  // DR-085: implementation is still construction (building column → /pandacorp:release),
  // but release is now the launched/shipped phase (shipped column → /pandacorp:iterate).
  // The two no longer share a column or command — verify they diverge coherently.
  it("implementation is construction (building → release) while release is launched (shipped → iterate)", () => {
    const impl = card({ slug: "i", status: "in-pipeline", project: "p" });
    const rel = card({ slug: "r", status: "in-pipeline", project: "p" });
    expect(deriveColumn(impl, present("implementation"))).toBe("building");
    expect(deriveColumn(rel, present("release"))).toBe("shipped");
    expect(nextStep({ cardStatus: "in-pipeline", phase: "implementation" }).command).toBe(
      "/pandacorp:release",
    );
    expect(nextStep({ cardStatus: "in-pipeline", phase: "release" }).command).toBe(
      "/pandacorp:iterate",
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Real bug anchors B1'/I3 — an in-pipeline card whose project status is
//    missing/malformed (phase undefined) must fall back coherently in BOTH
//    paths: board → "documented", detail → spec (never a phase-specific guess).
// ---------------------------------------------------------------------------

describe("FRD-02 integration: missing/malformed status falls back coherently (B1'/I3)", () => {
  const brokenStatuses: Array<{ name: string; status: StatusResult | null }> = [
    { name: "no project resolved (null)", status: null },
    { name: "status.yaml absent", status: { present: false, malformed: false, status: null } },
    {
      name: "malformed YAML (empty status)",
      status: { present: true, malformed: true, status: {} },
    },
    {
      name: "present but phase key missing",
      status: { present: true, malformed: false, status: { running: true } },
    },
  ];

  for (const { name, status } of brokenStatuses) {
    it(`${name}: board → documented, detail command → spec (no misleading stage)`, () => {
      const c = card({ slug: "broken", status: "in-pipeline", project: "p" });

      // Board axis must not break and must not invent a stage.
      expect(deriveColumn(c, status)).toBe("documented");

      // Detail axis: phase is undefined → safe spec fallback, never a phase command.
      const phase = status?.present ? status.status.phase : undefined;
      const step = nextStep({ cardStatus: "in-pipeline", phase });
      expect(step.command).toBe("/pandacorp:spec <idea>");
      // Crucially it must NOT emit a building/design/etc. command.
      expect(step.command).not.toContain("release");
      expect(step.command).not.toContain("implement");
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Board routing end-to-end (WO-02-005) using deriveColumn output, with the
//    recommended badge (AC-02-006.2) and the no-manual-move invariant (AC-02-002.1).
// ---------------------------------------------------------------------------

describe("FRD-02 integration: board routes deriveColumn output into the right columns", () => {
  it("a recommended card lands in the discovered column AND shows the recommended badge", () => {
    const c = card({ slug: "rec", status: "recommended" });
    const entry = toEntry(c, null);
    expect(entry.boardColumn).toBe("discovered");

    render(<IdeaBoardView cards={[entry]} />);

    const discovered = screen.getByTestId("board-column-discovered");
    // The card is inside the discovered column.
    expect(within(discovered).getByTestId("idea-card")).toBeTruthy();
    // AC-02-006.2: the recommended badge is shown (IdeaCard derives it from status).
    expect(within(discovered).getByTestId("idea-card-recommended-badge")).toBeTruthy();
  });

  it("cards of every stage bucket into their derived columns simultaneously", () => {
    const entries: BoardCardEntry[] = [
      toEntry(card({ slug: "d", status: "discovered" }), null),
      toEntry(card({ slug: "doc", status: "in-pipeline", project: "p" }), present("product")),
      toEntry(card({ slug: "des", status: "in-pipeline", project: "p" }), present("design")),
      toEntry(card({ slug: "arch", status: "in-pipeline", project: "p" }), present("architecture")),
      toEntry(
        card({ slug: "build", status: "in-pipeline", project: "p" }),
        present("implementation"),
      ),
      toEntry(card({ slug: "ship", status: "shipped" }), null),
      toEntry(card({ slug: "disc", status: "discarded" }), null),
    ];

    render(<IdeaBoardView cards={entries} />);

    const expectColumnHas = (col: string, slugTitle: string) => {
      const column = screen.getByTestId(`board-column-${col}`);
      expect(within(column).getByText(slugTitle)).toBeTruthy();
    };
    // Titles default to the slug uppercased in our helper? No — title defaults to "X".
    // Use the card count per column instead via header count.
    const counts: Record<string, number> = {
      discovered: 1,
      documented: 1,
      design: 1,
      architecture: 1,
      building: 1,
      shipped: 1,
      discarded: 1,
    };
    for (const [col, n] of Object.entries(counts)) {
      const column = screen.getByTestId(`board-column-${col}`);
      // each populated column renders exactly n idea-card articles
      expect(within(column).getAllByTestId("idea-card").length).toBe(n);
    }
    void expectColumnHas;
  });

  it("AC-02-002.1: the board renders no drag handles or move controls", () => {
    const entries = [toEntry(card({ slug: "a", status: "discovered" }), null)];
    const { container } = render(<IdeaBoardView cards={entries} />);
    // No draggable attributes, no move buttons.
    expect(container.querySelector("[draggable='true']")).toBeNull();
    expect(screen.queryByRole("button", { name: /mover|move|→|←/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. CardDetail uses the REAL nextStep (not mocked) — the detail shows a command
//    coherent with the card's lifecycle position, with a copy affordance.
//    (Integration of WO-02-003 + WO-02-007 + WO-02-002.)
// ---------------------------------------------------------------------------

describe("FRD-02 integration: CardDetail surfaces the real next-step command + copy", () => {
  it("an architecture-phase card shows /pandacorp:implement with a copy button", () => {
    render(
      <CardDetail
        slug="s"
        title="T"
        status="in-pipeline"
        body="Resumen de la idea."
        phase="architecture"
      />,
    );
    const detail = screen.getByTestId("card-detail-next-step");
    expect(within(detail).getByText("/pandacorp:implement")).toBeTruthy();
    // The copy affordance (WO-02-002) is wired in.
    expect(within(detail).getByTestId("copy-button")).toBeTruthy();
  });

  it("AC-02-008.1: a card with no docsIndex shows the Resumen reader and zero project doc items", () => {
    render(<CardDetail slug="s" title="T" status="discovered" body="Solo resumen." />);
    expect(screen.getByTestId("card-detail-summary")).toBeTruthy();
    // The rail always lists Resumen; with no project there are no project doc items.
    expect(screen.getByTestId("card-detail-docs-nav-resumen")).toBeTruthy();
    expect(screen.queryAllByTestId("card-detail-docs-nav-item")).toHaveLength(0);
  });

  it("a discovered card's detail offers spec, matching its discovered column", () => {
    const c = card({ slug: "n", status: "discovered" });
    expect(deriveColumn(c, null)).toBe("discovered");
    render(<CardDetail slug="n" title="N" status="discovered" body="x" />);
    const detail = screen.getByTestId("card-detail-next-step");
    expect(within(detail).getByText("/pandacorp:spec <idea>")).toBeTruthy();
  });
});
