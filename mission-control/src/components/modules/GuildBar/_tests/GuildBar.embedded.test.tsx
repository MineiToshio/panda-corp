/**
 * FRD-19 — GuildBar `embedded` variant (DR-057 extend).
 *
 * The shell topbar hosts GuildBar inside its own surface, so the embedded variant drops the
 * standalone rpgpanel chrome + bottom margin while keeping the same level/XP content. The default
 * (standalone) variant is unchanged — covered by GuildBar.test.tsx.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GuildOutcomes } from "@/lib/gamification/gamification";
import { GuildBar } from "../GuildBar";

const OUTCOMES: GuildOutcomes = {
  workOrdersDone: 5,
  phasesCompleted: 1,
  releases: 0,
  greenTestRuns: 20,
};

describe("FRD-19 — GuildBar embedded variant (shell topbar)", () => {
  it("keeps the same level/title/XP content when embedded", () => {
    render(<GuildBar outcomes={OUTCOMES} embedded />);
    expect(screen.getByTestId("guild-bar")).toBeInTheDocument();
    expect(screen.getByTestId("guild-bar-level")).toBeInTheDocument();
    expect(screen.getByTestId("guild-bar-title")).toBeInTheDocument();
    expect(screen.getByTestId("xp-bar")).toBeInTheDocument();
  });

  it("drops the standalone panel chrome + bottom margin (data-variant='embedded')", () => {
    render(<GuildBar outcomes={OUTCOMES} embedded />);
    const bar = screen.getByTestId("guild-bar");
    expect(bar).toHaveAttribute("data-variant", "embedded");
    expect(bar).toHaveAttribute("data-embedded", "true");
    expect(bar.style.marginBottom).toBe("");
  });

  it("default (non-embedded) keeps the standalone rpgpanel block + bottom margin", () => {
    render(<GuildBar outcomes={OUTCOMES} />);
    const bar = screen.getByTestId("guild-bar");
    expect(bar).toHaveAttribute("data-variant", "rpgpanel");
    expect(bar).not.toHaveAttribute("data-embedded");
    expect(bar.style.marginBottom).toBe("16px");
  });
});
