import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BoardShell } from "@/app/board/_components/BoardShell/BoardShell";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/IdeaBoardView";

const cards: BoardCardEntry[] = [
  {
    slug: "alpha",
    navigationSlug: "public-alpha",
    title: "Alpha",
    body: "hidden needle",
    status: "discovered",
    projectType: "web",
  },
  {
    slug: "beta",
    title: "Beta",
    body: "",
    status: "in-pipeline",
    boardColumn: "building",
    projectType: "cli",
    project: "/beta",
    isRunning: true,
  },
];
const discardAction = vi.fn().mockResolvedValue({ ok: true });
function board(entries = cards) {
  return render(
    <BoardShell
      cards={entries}
      discardAction={discardAction}
      favoriteAction={vi.fn().mockResolvedValue({ ok: false })}
    />,
  );
}
beforeEach(() => {
  window.history.replaceState(null, "", "/board");
  localStorage.clear();
});
describe("Órbita board", () => {
  it("AC-02-016.1 AC-02-016.4 searches body across phases, filters categories and clears URL state", async () => {
    const user = userEvent.setup();
    board();
    expect(screen.getByRole("link", { name: "Alpha" })).toHaveAttribute(
      "href",
      "/board/public-alpha",
    );
    await user.type(screen.getByRole("searchbox"), "needle");
    expect(screen.getByText("1 idea coincide")).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("link", { name: "Beta" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Limpiar/ }));
    await user.click(screen.getByRole("button", { name: "CLI 1" }));
    expect(screen.getByRole("link", { name: "Beta" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Alpha" })).not.toBeInTheDocument();
    expect(window.location.search).toContain("category=cli");
  });
  it("AC-02-016.2 AC-02-016.3 jumps and remembers hidden empty columns", async () => {
    const user = userEvent.setup();
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const view = board();
    await user.click(screen.getByRole("button", { name: "5 Construcción 1" }));
    expect(scroll).toHaveBeenCalled();
    await user.click(screen.getByRole("switch"));
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
    view.unmount();
    board();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("button", { name: /Diseño 0/ })).not.toBeInTheDocument();
  });
  it("AC-02-016.1 keeps six empty columns and distinguishes no matches", async () => {
    const view = board([]);
    expect(screen.getAllByRole("status", { name: "Sin ideas en esta fase" })).toHaveLength(6);
    view.unmount();
    board();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "absent" } });
    expect(screen.getAllByRole("status", { name: "Sin coincidencias" })).toHaveLength(2);
    expect(screen.getAllByRole("status", { name: "Sin ideas en esta fase" })).toHaveLength(4);
    expect(screen.getByText("0 ideas coinciden")).toBeVisible();
  });
  it("AC-02-012.3 AC-02-012.4 optimistically flips the named star then reverts on failure without moving the card", async () => {
    let finish: (value: { ok: false; reason: "not-found" }) => void = () => {};
    const action = vi.fn(
      () =>
        new Promise<{ ok: false; reason: "not-found" }>((resolve) => {
          finish = resolve;
        }),
    );
    render(<BoardShell cards={cards} discardAction={discardAction} favoriteAction={action} />);
    const star = screen.getByRole("button", { name: "Marcar como favorita: Alpha" });
    await userEvent.click(star);
    expect(star).toHaveAttribute("aria-pressed", "true");
    await act(async () => finish({ ok: false, reason: "not-found" }));
    expect(star).toHaveAttribute("aria-pressed", "false");
    expect(
      within(screen.getByTestId("board-column-discovered")).getByRole("link", { name: "Alpha" }),
    ).toBeVisible();
    expect(screen.queryByText("Recomendada")).not.toBeInTheDocument();
  });
  it("opens native capture and zero-count discarded dialogs while retaining the board", async () => {
    const user = userEvent.setup();
    board();
    await user.click(screen.getByRole("button", { name: "Capturar ideas" }));
    const dialog = screen.getByRole("dialog", { name: "Capturar ideas" });
    expect(dialog.tagName).toBe("DIALOG");
    expect(within(dialog).getAllByRole("button", { name: /Copiar/ })).toHaveLength(4);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Capturar ideas" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Descartadas · 0" }));
    expect(screen.getByRole("dialog", { name: "Ideas descartadas · 0" })).toBeVisible();
  });
});
