import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectLastAchievement } from "@/lib/inicio/achievement";
import { type AchievementNotice, AchievementToast } from "../AchievementToast";

const instant = "2026-10-30T12:00:00Z";
function notice(id: string, date = "2026-10-28T12:00:00Z"): AchievementNotice {
  const last = selectLastAchievement(
    [
      {
        name: id,
        category: "Discovery",
        rarity: "Común",
        unlocked: true,
        condition: "Real outcome",
        date,
      },
    ],
    instant,
  );
  return { id, title: id, description: "Real outcome", fresh: last?.fresh ?? false };
}
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe("AC-09-008.2: once-per-browser achievement notice", () => {
  it("two days raises a polite notice without taking focus, nine seconds records it; reload stays closed", () => {
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    const view = render(<AchievementToast achievement={notice("Timer trophy")} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveTextContent("¡Nuevo logro!");
    expect(button).toHaveFocus();
    act(() => vi.advanceTimersByTime(8999));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).toBeNull();
    expect((localStorage.getItem("orbita-ach-seen") ?? "").split("|")).toContain("Timer trophy");
    view.unmount();
    render(<AchievementToast achievement={notice("Timer trophy")} />);
    expect(screen.queryByRole("status")).toBeNull();
    button.remove();
  });
  it.each(["Ver", "Cerrar aviso"])("%s closes and remembers the id", (action) => {
    render(<AchievementToast achievement={notice(action)} />);
    const target = screen.getByRole(action === "Ver" ? "link" : "button", { name: action });
    if (action === "Ver") expect(target).toHaveAttribute("href", "/achievements/trophies");
    fireEvent.click(target);
    expect(screen.queryByRole("status")).toBeNull();
    expect((localStorage.getItem("orbita-ach-seen") ?? "").split("|")).toContain(action);
  });
  it("nine days old is absent, flagged-new is fresh, stored ids suppress notices", () => {
    const view = render(<AchievementToast achievement={notice("Old", "2026-10-21T12:00:00Z")} />);
    expect(screen.queryByRole("status")).toBeNull();
    localStorage.setItem("orbita-ach-seen", "Stored");
    view.rerender(<AchievementToast achievement={notice("Stored")} />);
    expect(screen.queryByRole("status")).toBeNull();
    view.rerender(
      <AchievementToast
        achievement={{ ...notice("Flagged", "2026-10-21T12:00:00Z"), fresh: true }}
      />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
  it("blocked storage still dismisses and suppresses repeat notices in this view", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const view = render(<AchievementToast achievement={notice("Private")} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    view.unmount();
    render(<AchievementToast achievement={notice("Private")} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
