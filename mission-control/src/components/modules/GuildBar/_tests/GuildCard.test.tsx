import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { computeGuildLevel, xpForLevel } from "@/lib/gamification/gamification";
import { GuildCard } from "../GuildCard";

describe("AC-09-008.1: sidebar guild card", () => {
  it("shows canonical rank, level-relative XP and gold progress; zero outcomes have zero fill", () => {
    const level = computeGuildLevel({
      workOrdersDone: 40,
      phasesCompleted: 2,
      releases: 1,
      greenTestRuns: 3,
    });
    const current = level.xp - xpForLevel(level.level);
    const total = xpForLevel(level.level + 1) - xpForLevel(level.level);
    const view = render(<GuildCard level={level} />);
    expect(
      screen.getByRole("link", {
        name: `Gremio nivel ${level.level}: ${level.title}, ${current} / ${total} XP al nivel ${level.level + 1}`,
      }),
    ).toHaveAttribute("href", "/achievements");
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      String(level.pctToNext),
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-tone", "gold");
    expect(screen.getByText(String(level.level))).toHaveClass("crest");
    view.rerender(
      <GuildCard
        level={computeGuildLevel({
          workOrdersDone: 0,
          phasesCompleted: 0,
          releases: 0,
          greenTestRuns: 0,
        })}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });
});
