/**
 * WO-02-015 gate suite (reviewer, DR-015/DR-080): board edges the builder's suites do not cross.
 * Oracle: frd.md REQ-02-002/005/006/014/017, AC-02-016.1-.4, AC-02-012.3 and the frozen prototype's
 * `board()` / `filterBoard()` (docs/design/prototype/prototype.js).
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoardShell } from "@/app/board/_components/BoardShell/BoardShell";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/IdeaBoardView";
import type { DiscardResult } from "@/lib/discard/discard";

const STORAGE_KEY = "mission-control:board:hide-empty";
const discardAction = async (): Promise<DiscardResult> => ({ ok: true });

function card(overrides: Partial<BoardCardEntry> & { slug: string }): BoardCardEntry {
  return {
    title: overrides.slug,
    status: "discovered",
    body: "",
    boardColumn: "discovered",
    ...overrides,
  };
}

const CARDS = [
  card({ slug: "alfa", title: "Alfa", body: "contiene ZAFIRO", projectType: "web" }),
  card({
    slug: "beta",
    title: "Beta",
    status: "in-pipeline",
    boardColumn: "building",
    projectType: "cli",
  }),
];

const columnIds = () =>
  screen
    .getAllByRole("region")
    .map((region) => region.getAttribute("data-testid"))
    .filter((id) => id?.startsWith("board-column-"));

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/board");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/board");
});

describe("search and category (AC-02-016.1, AC-02-016.4)", () => {
  it("matches body text case-insensitively across columns, and owns the URL with a replace", async () => {
    const user = userEvent.setup();
    const push = vi.spyOn(window.history, "pushState");
    render(<BoardShell cards={CARDS} discardAction={discardAction} />);
    await user.type(screen.getByRole("searchbox"), "zafiro");
    expect(screen.getAllByTestId("idea-card")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Alfa" })).toBeInTheDocument();
    expect(screen.getByText("1 idea coincide")).toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.get("boardQuery")).toBe("zafiro");
    expect(push).not.toHaveBeenCalled();
  });

  it("search and category intersect, and a discarded card never matches", async () => {
    const user = userEvent.setup();
    render(
      <BoardShell
        cards={[...CARDS, card({ slug: "gone", title: "Zafiro", status: "discarded" })]}
        discardAction={discardAction}
      />,
    );
    await user.type(screen.getByRole("searchbox"), "zafiro");
    await user.click(screen.getByRole("button", { name: /^CLI 1$/ }));
    expect(screen.queryAllByTestId("idea-card")).toHaveLength(0);
    expect(screen.getByText("0 ideas coinciden")).toBeInTheDocument();
  });

  it("a blank query is no filter: no Limpiar, no match line (the prototype trims first)", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={CARDS} discardAction={discardAction} />);
    await user.type(screen.getByRole("searchbox"), "   ");
    expect(screen.queryByRole("button", { name: "Limpiar" })).toBeNull();
    expect(screen.queryByText(/ideas? coincid/)).toBeNull();
  });

  it("the polite live region exists BEFORE the first filter, so the first count is announced", async () => {
    const user = userEvent.setup();
    const { container } = render(<BoardShell cards={CARDS} discardAction={discardAction} />);
    // biome-ignore lint/style/noRestrictedGlobals: a live region has no role/name to query by
    const region = container.ownerDocument.getElementById("board-count");
    expect(region).toHaveAttribute("aria-live", "polite");
    await user.click(screen.getByRole("button", { name: /^CLI 1$/ }));
    expect(region).toHaveTextContent("1 idea coincide");
  });
});

describe("empty markers (REQ-02-014, frozen filterBoard)", () => {
  it("a truly empty phase keeps its own marker while a filter is active", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={CARDS} discardAction={discardAction} />);
    await user.type(screen.getByRole("searchbox"), "zafiro");
    expect(within(screen.getByTestId("board-column-design")).getByRole("status")).toHaveTextContent(
      "Sin ideas en esta fase",
    );
    expect(
      within(screen.getByTestId("board-column-building")).getByRole("status"),
    ).toHaveTextContent("Sin coincidencias");
  });

  it("an empty board renders six marked columns and no match line", () => {
    render(<BoardShell cards={[]} discardAction={discardAction} />);
    expect(columnIds()).toHaveLength(6);
    expect(screen.getAllByText("Sin ideas en esta fase")).toHaveLength(6);
    expect(screen.queryByText(/coinciden/)).toBeNull();
  });
});

describe("hide-empty (AC-02-016.3)", () => {
  it("removes empty phases and their chips and persists the choice", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<BoardShell cards={CARDS} discardAction={discardAction} />);
    await user.click(screen.getByRole("switch"));
    expect(columnIds()).toEqual(["board-column-discovered", "board-column-building"]);
    const nav = screen.getByRole("navigation", { name: "Ir a una fase" });
    expect(within(nav).getAllByRole("button")).toHaveLength(2);
    unmount();
    render(<BoardShell cards={CARDS} discardAction={discardAction} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(columnIds()).toHaveLength(2);
  });

  it("a phase whose cards are only filtered out is not empty: it stays with «Sin coincidencias»", async () => {
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, "true");
    render(<BoardShell cards={CARDS} discardAction={discardAction} />);
    await user.type(screen.getByRole("searchbox"), "no-such-idea");
    expect(columnIds()).toEqual(["board-column-discovered", "board-column-building"]);
    expect(screen.getAllByText("Sin coincidencias")).toHaveLength(2);
  });

  it("a garbage stored value and an unavailable localStorage leave the default board", () => {
    localStorage.setItem(STORAGE_KEY, "yes please");
    const first = render(<BoardShell cards={CARDS} discardAction={discardAction} />);
    expect(columnIds()).toHaveLength(6);
    first.unmount();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    render(<BoardShell cards={CARDS} discardAction={discardAction} />);
    expect(columnIds()).toHaveLength(6);
  });
});

describe("discarded dialog (REQ-02-017)", () => {
  const discarded = card({
    slug: "file-name",
    navigationSlug: "public-slug",
    title: "Vieja",
    status: "discarded",
    boardColumn: "discarded",
    projectType: "web",
    discardReason: "saturado",
  });

  it("button always shown at zero, title carries the count, no Descartada column", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={CARDS} discardAction={discardAction} />);
    await user.click(screen.getByRole("button", { name: "Descartadas · 0" }));
    expect(screen.getByRole("dialog", { name: "Ideas descartadas · 0" })).toBeInTheDocument();
    expect(screen.queryByTestId("board-column-discarded")).toBeNull();
  });

  it("a row shows title, category, restore hint and reason, and opens that idea by public slug", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={[...CARDS, discarded]} discardAction={discardAction} />);
    await user.click(screen.getByRole("button", { name: "Descartadas · 1" }));
    const row = within(screen.getByRole("dialog")).getByRole("button", { name: /Vieja/ });
    expect(row).toHaveTextContent("web · leer propuesta y restaurar");
    expect(row).toHaveTextContent("Motivo: saturado");
    await user.click(row);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.location.href).toContain("public-slug");
    expect(new URL(window.location.href).searchParams.get("discarded")).toBeNull();
    expect(await screen.findByTestId("card-detail")).toBeInTheDocument();
  });
});

describe("cards (REQ-02-002, REQ-02-005, REQ-02-006, AC-02-012.3)", () => {
  it("no drag, arrow or move control exists on the board", () => {
    const { container } = render(<BoardShell cards={CARDS} discardAction={discardAction} />);
    expect(container.ownerDocument.querySelectorAll('[draggable="true"]')).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /mover|move/i })).toBeNull();
  });

  it("the column owes no card to the favourite flag and a failed toggle reverts the star", async () => {
    const user = userEvent.setup();
    const favoriteAction = vi.fn(async () => ({ ok: false as const, error: "write-failed" }));
    render(
      <BoardShell
        cards={CARDS}
        discardAction={discardAction}
        // @ts-expect-error the failure shape is irrelevant to the reverting star
        favoriteAction={favoriteAction}
      />,
    );
    const star = screen.getByRole("button", { name: "Marcar como favorita: Alfa" });
    await user.click(star);
    expect(favoriteAction).toHaveBeenCalledWith("alfa", true);
    expect(
      await screen.findByRole("button", { name: "Marcar como favorita: Alfa", pressed: false }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("board-column-discovered")).getByRole("link", { name: "Alfa" }),
    ).toBeInTheDocument();
  });
});
