import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Progreso } from "../Progreso";

it("REQ-18-021: guild shows real rank, level, XP, next level and one fresh achievement without streaks", () => {
  const { rerender } = render(
    <Progreso
      level={{ level: 2, title: "Aprendiz", xp: 20, next: 50, pctToNext: 40 }}
      achievement={{ title: "First launch", unlockedAt: "2026-10-29", fresh: true }}
      trophies={1}
    />,
  );
  expect(screen.getByRole("heading", { name: "Gremio" })).toBeVisible();
  expect(screen.getByText("Nivel 2 · 20 XP")).toBeVisible();
  expect(screen.getByText("30 XP para el nivel 3 · 1 trofeos")).toBeVisible();
  expect(screen.getByText("Nuevo")).toBeVisible();
  expect(screen.getByText("First launch")).toBeVisible();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
  expect(screen.queryByText(/racha|streak/i)).not.toBeInTheDocument();
  rerender(
    <Progreso
      level={{ level: 1, title: "Humano", xp: 0, next: 50, pctToNext: 0 }}
      achievement={null}
      trophies={0}
    />,
  );
  expect(screen.queryByText("Nuevo")).not.toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
});
