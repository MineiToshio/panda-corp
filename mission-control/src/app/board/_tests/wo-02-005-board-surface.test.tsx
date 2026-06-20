/**
 * WO-02-005 — Board surface integration tests (RED → GREEN phase)
 *
 * Tests the integrated board surface: PageTitle "Tablero", category filter,
 * intake modal, card clickability → CardDetail, DiscardButton wiring.
 *
 * Acceptance criteria covered:
 *   AC-02-002 — Wide columns, horizontal scroll, no manual move
 *   AC-02-005 — Category + return chips on cards
 *   AC-02-006 — Filter by category; recommended badge
 *   AC-02-008 — Building indicator; legend
 *   AC-02-003 — Intake modal: backdrop + blur, 4 commands, ✕/Escape closes
 *   AC-02-007 — Discard action via DiscardButton on card detail
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

const WEB_CARD = makeEntry({
  slug: "web-idea",
  title: "Web Idea",
  status: "discovered",
  projectType: "web",
  returnType: "monetary",
  score: 80,
  boardColumn: "discovered",
});

const AI_CARD = makeEntry({
  slug: "ai-idea",
  title: "AI Idea",
  status: "recommended",
  projectType: "ai",
  returnType: "opportunity",
  score: 90,
  boardColumn: "discovered",
});

const BUILDING_CARD = makeEntry({
  slug: "building-idea",
  title: "Building Idea",
  status: "in-pipeline",
  projectType: "cli",
  returnType: "personal",
  score: 75,
  boardColumn: "building",
  isRunning: true,
});

const ALL_CARDS: BoardCardEntry[] = [WEB_CARD, AI_CARD, BUILDING_CARD];

const noOpDiscard: (slug: string) => Promise<DiscardResult> = vi
  .fn()
  .mockResolvedValue({ ok: true });

// ---------------------------------------------------------------------------
// Page-level structure (DR-062: PageTitle "Tablero")
// ---------------------------------------------------------------------------

describe("BoardShell WO-02-005 — page structure", () => {
  it("renders the board shell without throwing", () => {
    expect(() =>
      render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />),
    ).not.toThrow();
  });

  it("renders H1 'Tablero' via PageTitle (DR-062)", () => {
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    const h1 = screen.getByRole("heading", { level: 1, name: "Tablero" });
    expect(h1).toBeInTheDocument();
  });

  it("renders the page-title data-testid (PageTitle contract)", () => {
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    expect(screen.getByTestId("page-title")).toBeInTheDocument();
  });

  it("renders the ideas board (idea-board testid)", () => {
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    expect(screen.getByTestId("idea-board")).toBeInTheDocument();
  });

  it("renders the board scroll container (horizontal scroll, AC-02-002)", () => {
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    expect(screen.getByTestId("board-scroll-container")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CategoryFilter integration (AC-02-006.1)
// ---------------------------------------------------------------------------

describe("BoardShell WO-02-005 — category filter (AC-02-006)", () => {
  it("renders the category filter", () => {
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    expect(screen.getByTestId("category-filter")).toBeInTheDocument();
  });

  it("renders 'Todas' reset chip in the filter", () => {
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    expect(screen.getByTestId("category-filter-all")).toBeInTheDocument();
  });

  it("renders one chip per distinct project_type", () => {
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    const options = screen.getAllByTestId("category-filter-option");
    // web, ai, cli
    expect(options).toHaveLength(3);
  });

  it("clicking a category chip filters the board (only matching cards visible)", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);

    // Click 'web' filter
    const options = screen.getAllByTestId("category-filter-option");
    const webChip = options.find((o) => o.textContent?.includes("web"));
    expect(webChip).toBeTruthy();
    // webChip is asserted truthy above — safe cast via expect guard
    await user.click(webChip as HTMLElement);

    // Web Idea should be visible in discovered column
    const discoveredCol = screen.getByTestId("board-column-discovered");
    expect(within(discoveredCol).getByText("Web Idea")).toBeInTheDocument();

    // AI Idea should NOT be visible (filtered out)
    // It WAS in discovered col too, so now it shouldn't appear
    expect(within(discoveredCol).queryByText("AI Idea")).not.toBeInTheDocument();
  });

  it("clicking 'Todas' resets the filter (all cards visible again)", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);

    // Select web filter first
    const options = screen.getAllByTestId("category-filter-option");
    const webChip = options.find((o) => o.textContent?.includes("web"));
    await user.click(webChip as HTMLElement);

    // Reset
    await user.click(screen.getByTestId("category-filter-all"));

    // Both cards visible again
    const discoveredCol = screen.getByTestId("board-column-discovered");
    expect(within(discoveredCol).getByText("Web Idea")).toBeInTheDocument();
    expect(within(discoveredCol).getByText("AI Idea")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// BoardLegend (AC-02-008.3)
// ---------------------------------------------------------------------------

describe("BoardShell WO-02-005 — legend (AC-02-008)", () => {
  it("renders the board legend", () => {
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    expect(screen.getByTestId("board-legend")).toBeInTheDocument();
  });

  it("legend has category section", () => {
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    expect(screen.getByTestId("board-legend-category-section")).toBeInTheDocument();
  });

  it("legend has return type section", () => {
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    expect(screen.getByTestId("board-legend-return-section")).toBeInTheDocument();
  });

  it("legend has score section", () => {
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    expect(screen.getByTestId("board-legend-score-section")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Intake modal (AC-02-003)
// ---------------------------------------------------------------------------

describe("BoardShell WO-02-005 — intake modal (AC-02-003)", () => {
  it("renders the 'Capturar ideas' trigger button", () => {
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    expect(screen.getByTestId("intake-trigger")).toBeInTheDocument();
  });

  it("intake modal is closed by default (no modal in DOM)", () => {
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    expect(screen.queryByTestId("intake-modal")).not.toBeInTheDocument();
  });

  it("clicking the trigger opens the intake modal", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    await user.click(screen.getByTestId("intake-trigger"));
    expect(screen.getByTestId("intake-modal")).toBeInTheDocument();
  });

  it("clicking ✕ closes the intake modal (AC-02-003.2)", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    await user.click(screen.getByTestId("intake-trigger"));
    expect(screen.getByTestId("intake-modal")).toBeInTheDocument();

    await user.click(screen.getByTestId("intake-close"));
    expect(screen.queryByTestId("intake-modal")).not.toBeInTheDocument();
  });

  it("clicking backdrop closes the intake modal", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    await user.click(screen.getByTestId("intake-trigger"));
    expect(screen.getByTestId("intake-modal")).toBeInTheDocument();

    await user.click(screen.getByTestId("intake-backdrop"));
    expect(screen.queryByTestId("intake-modal")).not.toBeInTheDocument();
  });

  it("modal shows the four intake commands when open (AC-02-003.1)", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    await user.click(screen.getByTestId("intake-trigger"));

    expect(screen.getByTestId("intake-command-explore")).toBeInTheDocument();
    expect(screen.getByTestId("intake-command-new-idea")).toBeInTheDocument();
    expect(screen.getByTestId("intake-command-discover")).toBeInTheDocument();
    expect(screen.getByTestId("intake-command-recommend")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Card clickability → CardDetail (AC-02-004)
// ---------------------------------------------------------------------------

describe("BoardShell WO-02-005 — card click → detail (AC-02-004)", () => {
  it("card detail is not shown by default", () => {
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);
    expect(screen.queryByTestId("card-detail")).not.toBeInTheDocument();
  });

  it("clicking an idea card opens its card detail", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);

    const [firstCard] = screen.getAllByTestId("idea-card");
    expect(firstCard).toBeDefined();
    await user.click(firstCard as HTMLElement);
    expect(screen.getByTestId("card-detail")).toBeInTheDocument();
  });

  it("the opened card detail shows the card's title", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={[WEB_CARD]} discardAction={noOpDiscard} />);

    await user.click(screen.getByTestId("idea-card"));
    const detail = screen.getByTestId("card-detail");
    expect(within(detail).getByText("Web Idea")).toBeInTheDocument();
  });

  it("a back/close button returns to the board view", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} discardAction={noOpDiscard} />);

    const [firstCard2] = screen.getAllByTestId("idea-card");
    expect(firstCard2).toBeDefined();
    await user.click(firstCard2 as HTMLElement);
    expect(screen.getByTestId("card-detail")).toBeInTheDocument();

    const backBtn = screen.getByTestId("card-detail-back");
    await user.click(backBtn);
    expect(screen.queryByTestId("card-detail")).not.toBeInTheDocument();
    // Board returns to view
    expect(screen.getByTestId("idea-board")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DiscardButton wired in card detail (AC-02-007)
// ---------------------------------------------------------------------------

describe("BoardShell WO-02-005 — discard button (AC-02-007)", () => {
  it("card detail shows the discard button for non-discarded ideas", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={[WEB_CARD]} discardAction={noOpDiscard} />);

    await user.click(screen.getByTestId("idea-card"));
    expect(screen.getByTestId("discard-button")).toBeInTheDocument();
  });

  it("card detail does NOT show the discard button for discarded ideas", async () => {
    const discardedCard = makeEntry({
      slug: "disc",
      title: "Discarded Idea",
      status: "discarded",
      boardColumn: "discarded",
    });
    const user = userEvent.setup();
    render(<BoardShell cards={[discardedCard]} discardAction={noOpDiscard} />);

    await user.click(screen.getByTestId("idea-card"));
    expect(screen.queryByTestId("discard-button")).not.toBeInTheDocument();
  });

  it("card detail does NOT show the discard button for shipped ideas", async () => {
    const shippedCard = makeEntry({
      slug: "shipped",
      title: "Shipped Idea",
      status: "shipped",
      boardColumn: "shipped",
    });
    const user = userEvent.setup();
    render(<BoardShell cards={[shippedCard]} discardAction={noOpDiscard} />);

    await user.click(screen.getByTestId("idea-card"));
    expect(screen.queryByTestId("discard-button")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Building indicator (AC-02-008)
// ---------------------------------------------------------------------------

describe("BoardShell WO-02-005 — building indicator (AC-02-008)", () => {
  it("building card shows the building indicator on its IdeaCard", () => {
    render(<BoardShell cards={[BUILDING_CARD]} discardAction={noOpDiscard} />);
    expect(screen.getByTestId("idea-card-building-indicator")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Recommended badge (AC-02-006.2)
// ---------------------------------------------------------------------------

describe("BoardShell WO-02-005 — recommended badge (AC-02-006)", () => {
  it("recommended card shows the badge inside the discovered column", () => {
    render(<BoardShell cards={[AI_CARD]} discardAction={noOpDiscard} />);
    const col = screen.getByTestId("board-column-discovered");
    expect(within(col).getByTestId("idea-card-recommended-badge")).toBeInTheDocument();
  });
});
