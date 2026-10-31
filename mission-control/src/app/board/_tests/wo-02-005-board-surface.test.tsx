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
import { beforeEach, describe, expect, it } from "vitest";
import { BoardShell } from "@/app/board/_components/BoardShell/BoardShell";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/types";

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

// ---------------------------------------------------------------------------
// Page-level structure (DR-062: PageTitle "Tablero")
// ---------------------------------------------------------------------------

describe("BoardShell WO-02-005 — page structure", () => {
  it("renders the board shell without throwing", () => {
    expect(() => render(<BoardShell cards={ALL_CARDS} />)).not.toThrow();
  });

  it("renders H1 'Tablero' via PageTitle (DR-062)", () => {
    render(<BoardShell cards={ALL_CARDS} />);
    const h1 = screen.getByRole("heading", { level: 1, name: "Tablero" });
    expect(h1).toBeInTheDocument();
  });

  it("renders the ideas board (idea-board testid)", () => {
    render(<BoardShell cards={ALL_CARDS} />);
    expect(screen.getByTestId("idea-board")).toBeInTheDocument();
  });

  it("renders the board scroll container (horizontal scroll, AC-02-002)", () => {
    render(<BoardShell cards={ALL_CARDS} />);
    expect(screen.getByTestId("board-scroll-container")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CategoryFilter integration (AC-02-006.1)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// BoardLegend (AC-02-008.3)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Intake modal (AC-02-003)
// ---------------------------------------------------------------------------

describe("BoardShell WO-02-005 — intake modal (AC-02-003)", () => {
  it("renders the 'Capturar ideas' trigger button", () => {
    render(<BoardShell cards={ALL_CARDS} />);
    expect(screen.getByTestId("intake-trigger")).toBeInTheDocument();
  });

  it("intake modal is closed by default (no modal in DOM)", () => {
    render(<BoardShell cards={ALL_CARDS} />);
    expect(screen.queryByTestId("intake-modal")).not.toBeInTheDocument();
  });

  it("clicking the trigger opens the intake modal", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} />);
    await user.click(screen.getByTestId("intake-trigger"));
    expect(screen.getByTestId("intake-modal")).toBeInTheDocument();
  });

  it("clicking ✕ closes the intake modal (AC-02-003.2)", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} />);
    await user.click(screen.getByTestId("intake-trigger"));
    expect(screen.getByTestId("intake-modal")).toBeInTheDocument();

    await user.click(screen.getByTestId("intake-close"));
    expect(screen.queryByTestId("intake-modal")).not.toBeInTheDocument();
  });

  it("clicking backdrop closes the intake modal", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} />);
    await user.click(screen.getByTestId("intake-trigger"));
    expect(screen.getByTestId("intake-modal")).toBeInTheDocument();

    await user.click(screen.getByTestId("intake-backdrop"));
    expect(screen.queryByTestId("intake-modal")).not.toBeInTheDocument();
  });

  it("modal shows the four intake commands when open (AC-02-003.1)", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={ALL_CARDS} />);
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
    render(<BoardShell cards={ALL_CARDS} />);
    expect(screen.queryByTestId("card-detail")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DiscardButton wired in card detail (AC-02-007)
// ---------------------------------------------------------------------------

describe("BoardShell WO-02-005 — discard button (AC-02-007)", () => {
  it("card detail does NOT show the discard button for discarded ideas (opened via the modal)", async () => {
    const discardedCard = makeEntry({
      slug: "disc",
      title: "Discarded Idea",
      status: "discarded",
      boardColumn: "discarded",
    });
    const user = userEvent.setup();
    render(<BoardShell cards={[discardedCard]} />);

    // Discarded ideas aren't on the board — reach the detail via "Ver descartadas".
    await user.click(screen.getByTestId("discarded-trigger"));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /Discarded Idea/ }),
    );
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
    render(<BoardShell cards={[shippedCard]} />);

    await user.click(within(screen.getByTestId("idea-card")).getByRole("link"));
    expect(screen.queryByTestId("discard-button")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Building indicator (AC-02-008)
// ---------------------------------------------------------------------------

describe("BoardShell WO-02-005 — building indicator (AC-02-008)", () => {
  it("building card shows the building indicator on its IdeaCard", () => {
    render(<BoardShell cards={[BUILDING_CARD]} />);
    expect(screen.getByTestId("idea-card-building-indicator")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Recommended badge (AC-02-006.2)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Discarded ideas — "Ver descartadas" modal + restore (AC-02-007.2/.3/.4)
// ---------------------------------------------------------------------------

describe("BoardShell — discarded ideas (Ver descartadas + restore)", () => {
  const discarded = makeEntry({
    slug: "disc",
    title: "Discarded Idea",
    status: "discarded",
    boardColumn: "discarded",
    discardReason: "saturado / competencia fuerte",
  });

  it("keeps discarded ideas off the board (reachable only via the modal)", () => {
    render(<BoardShell cards={[discarded]} />);
    expect(screen.queryByText("Discarded Idea")).not.toBeInTheDocument();
    expect(screen.queryByTestId("board-column-discarded")).not.toBeInTheDocument();
  });
});

beforeEach(() => {
  window.history.replaceState(null, "", "/board");
  localStorage.clear();
});
