import { render, screen } from "@testing-library/react";
import { Children, isValidElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AchievementToast } from "@/components/modules/AchievementToast/AchievementToast";
import RootLayout from "../layout";

const readers = vi.hoisted(() => ({
  runGit: vi.fn(() => "2026-06-15T10:00:00Z"),
  last: vi.fn(),
  trophies: vi.fn(),
}));
vi.mock("@/lib/git/git", async (original) => ({
  ...(await original<typeof import("@/lib/git/git")>()),
  runGit: readers.runGit,
}));
vi.mock("@/lib/profile/profile", () => ({ readProfile: () => ({ present: true }) }));
vi.mock("@/lib/inicio/achievement", () => ({
  lastAchievement: readers.last,
  guildAchievements: readers.trophies,
}));

function find<T>(node: unknown, type: unknown): ReactElement<T>[] {
  if (!isValidElement<{ children?: React.ReactNode }>(node)) return [];
  const matches = node.type === type ? [node as ReactElement<T>] : [];
  return [
    ...matches,
    ...Children.toArray(node.props.children).flatMap((child) => find<T>(child, type)),
  ];
}

const previousRoot = process.env.PANDACORP_FACTORY_ROOT;
beforeEach(() => {
  process.env.PANDACORP_FACTORY_ROOT = "e2e/fixtures/factory-root";
  localStorage.clear();
  readers.runGit.mockClear();
  readers.last.mockReturnValue({ title: "Newest", fresh: true });
  readers.trophies.mockReturnValue([
    { name: "Newest", unlocked: true, isNew: true, date: "2026-10-30", condition: "First" },
    { name: "Second", unlocked: true, isNew: true, date: "2026-10-29", condition: "Other" },
  ]);
});
afterEach(() => {
  process.env.PANDACORP_FACTORY_ROOT = previousRoot;
});

describe("FRD-19 gate: root layout reads", () => {
  it("the layout body spawns no git; repository reads belong to a deferred, deduplicated slot", () => {
    RootLayout({ children: null });
    expect(readers.runGit).not.toHaveBeenCalled();
  });

  it("AC-09-008.2: a fresh trophy behind an already seen newest one is still raised once", () => {
    localStorage.setItem("orbita-ach-seen", "Newest");
    const tree = RootLayout({ children: null });
    const [toast] = find<React.ComponentProps<typeof AchievementToast>>(tree, AchievementToast);
    render(toast as ReactElement);
    expect(screen.getByRole("status")).toHaveTextContent("Second");
  });
});
