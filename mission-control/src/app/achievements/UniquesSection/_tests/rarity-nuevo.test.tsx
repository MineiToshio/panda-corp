/**
 * WO-10-012 — UniquesSection renders per-trophy rarity + the NUEVO badge (FRD-10 v2).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Unique } from "@/lib/achievements/achievements";
import { UniquesSection } from "../UniquesSection";

function mkUnique(over: Partial<Unique>): Unique {
  return {
    name: "El cohete",
    category: "Speed",
    rarity: "Raro",
    unlocked: false,
    condition: "Lanza rápido.",
    ...over,
  };
}

describe("UniquesSection — rarity + NUEVO (v2)", () => {
  it("renders a rarity tag with its label for every trophy", () => {
    render(<UniquesSection uniques={[mkUnique({ rarity: "Épico" })]} />);
    const tags = screen.getAllByTestId("unique-rarity");
    expect(tags.length).toBeGreaterThan(0);
    expect(tags[0]?.textContent).toContain("Épico");
  });

  it("shows a NUEVO badge on an unlocked trophy flagged isNew", () => {
    render(
      <UniquesSection
        uniques={[
          mkUnique({
            unlocked: true,
            isNew: true,
            date: "2026-06-28",
            project: "p",
            rarity: "Leyenda",
          }),
        ]}
      />,
    );
    expect(screen.getByTestId("unique-nuevo")).toBeDefined();
  });

  it("does NOT show NUEVO when the trophy is not new", () => {
    render(
      <UniquesSection
        uniques={[mkUnique({ unlocked: true, isNew: false, date: "2026-01-01", project: "p" })]}
      />,
    );
    expect(screen.queryByTestId("unique-nuevo")).toBeNull();
  });
});
