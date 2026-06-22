/**
 * BRD-01 — Board search input tests.
 *
 * The board exposes a search input (prototype `#pc-q`, "Buscar ideas…") that
 * filters the visible cards by title + body, plus a "Limpiar" reset offered
 * whenever a search query or a category filter is active. These tests drive
 * that behaviour through the real BoardShell seam.
 *
 * Stack: Vitest + @testing-library/react (jsdom).
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BoardShell } from "@/app/board/_components/BoardShell/BoardShell";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/IdeaBoardView";
import type { DiscardResult } from "@/lib/discard/discard";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeEntry = (overrides: Partial<BoardCardEntry> & { slug: string }): BoardCardEntry => ({
  title: overrides.slug,
  status: "discovered",
  body: "",
  boardColumn: "discovered",
  ...overrides,
});

const FUNKO_CARD = makeEntry({
  slug: "funko-tracker",
  title: "Tracker de Funkos",
  body: "Una idea sobre coleccionables y figuras.",
  projectType: "web",
  returnType: "mixed",
  score: 72,
  boardColumn: "discovered",
});

const BUDGET_CARD = makeEntry({
  slug: "budget-buddy",
  title: "Control de gastos",
  body: "Dividir gastos entre roommates.",
  projectType: "mobile",
  returnType: "monetary",
  score: 60,
  boardColumn: "discovered",
});

const ALL_CARDS: BoardCardEntry[] = [FUNKO_CARD, BUDGET_CARD];

const noOpDiscard: (slug: string) => Promise<DiscardResult> = vi
  .fn()
  .mockResolvedValue({ ok: true });

// ---------------------------------------------------------------------------
// BRD-01 — search input presence + behaviour
// ---------------------------------------------------------------------------

describe("BoardShell BRD-01 — search input", () => {
  it("renders the search input (#pc-q, 'Buscar ideas…')", () => {
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    const input = screen.getByTestId("board-search");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("id", "pc-q");
    expect(input).toHaveAttribute("placeholder", "Buscar ideas…");
  });

  it("typing a query filters the board by title (non-matching cards hidden)", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);

    await user.type(screen.getByTestId("board-search"), "funko");

    const col = screen.getByTestId("board-column-discovered");
    expect(within(col).getByText("Tracker de Funkos")).toBeInTheDocument();
    expect(within(col).queryByText("Control de gastos")).not.toBeInTheDocument();
  });

  it("the query also matches the card body / summary (not only the title)", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);

    // "roommates" appears only in the budget card body.
    await user.type(screen.getByTestId("board-search"), "roommates");

    const col = screen.getByTestId("board-column-discovered");
    expect(within(col).getByText("Control de gastos")).toBeInTheDocument();
    expect(within(col).queryByText("Tracker de Funkos")).not.toBeInTheDocument();
  });

  it("the search is case-insensitive", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);

    await user.type(screen.getByTestId("board-search"), "FUNKO");

    const col = screen.getByTestId("board-column-discovered");
    expect(within(col).getByText("Tracker de Funkos")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// BRD-01 — "Limpiar" reset
// ---------------------------------------------------------------------------

describe("BoardShell BRD-01 — Limpiar reset", () => {
  it("the 'Limpiar' button is hidden when there is no active search or filter", () => {
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    expect(screen.queryByTestId("board-clear-filters")).not.toBeInTheDocument();
  });

  it("the 'Limpiar' button appears once a query is typed", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);

    await user.type(screen.getByTestId("board-search"), "funko");
    expect(screen.getByTestId("board-clear-filters")).toBeInTheDocument();
  });

  it("clicking 'Limpiar' clears the query and restores all cards", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);

    await user.type(screen.getByTestId("board-search"), "funko");
    const col = screen.getByTestId("board-column-discovered");
    expect(within(col).queryByText("Control de gastos")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("board-clear-filters"));

    expect(screen.getByTestId("board-search")).toHaveValue("");
    expect(within(col).getByText("Tracker de Funkos")).toBeInTheDocument();
    expect(within(col).getByText("Control de gastos")).toBeInTheDocument();
    // And the reset button is gone again.
    expect(screen.queryByTestId("board-clear-filters")).not.toBeInTheDocument();
  });

  it("'Limpiar' also appears when only a category filter is active (no query)", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);

    // Activate the 'web' category via the native <select> (value = projectType slug).
    await user.selectOptions(screen.getByTestId("category-filter"), "web");

    expect(screen.getByTestId("board-clear-filters")).toBeInTheDocument();
  });
});
