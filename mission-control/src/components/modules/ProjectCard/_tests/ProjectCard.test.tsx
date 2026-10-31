import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FirstProjectCard } from "../FirstProjectCard";
import { ProjectCard } from "../ProjectCard";
import { PROJECT } from "./fixture";

describe("AC-03-008.1: project card", () => {
  it("renders every fact, a named progress ring, six accessible steps and one workspace link", () => {
    const { container } = render(<ProjectCard project={PROJECT} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/portfolio/alpha/summary");
    expect(screen.getByRole("img", { name: "Alpha Project" })).toBeVisible();
    expect(screen.getByRole("img", { name: "2 de 5 work orders verificadas" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByText("40%")).toBeVisible();
    expect(container.querySelectorAll(".stepper li[data-tip]")).toHaveLength(6);
    expect(screen.getByText(/Etapa 5 de 6.*último cambio/)).toHaveTextContent("hace 2 h");
    expect(screen.getByText(/WO verificadas/)).toHaveTextContent("2/5");
    expect(screen.getByText(/FRDs/)).toHaveTextContent("3 FRDs");
    expect(screen.getByText(/docs/)).toHaveTextContent("8 docs");
    expect(screen.getByText("/pandacorp:implement")).toBeVisible();
    expect(screen.queryByTestId("freshness-badge")).not.toBeInTheDocument();
  });
  it("shows Sin WOs instead of a ring and keeps unknown phases entirely pending", () => {
    const { container } = render(
      <ProjectCard
        project={{
          ...PROJECT,
          phase: undefined,
          stageIndex: 0,
          counts: { ...PROJECT.counts, ordersVerified: 0, ordersTotal: 0 },
        }}
        compact
      />,
    );
    expect(screen.getByText("Sin WOs")).toBeVisible();
    expect(container.querySelector(".ring")).toBeNull();
    expect(container.querySelectorAll('.stepper li[data-state="next"]')).toHaveLength(6);
  });
  it("REQ-03-003: stale running is Sin señal; fresh running is Construyendo", () => {
    const { rerender } = render(
      <ProjectCard
        project={{
          ...PROJECT,
          build: { kind: "no-signal", lastSignalAt: "2026-10-30T10:00:00Z", ageMinutes: 120 },
        }}
      />,
    );
    expect(screen.getByText(/Sin señal/)).toBeVisible();
    expect(screen.queryByText("Construyendo")).not.toBeInTheDocument();
    rerender(
      <ProjectCard
        project={{
          ...PROJECT,
          build: { kind: "live", lastSignalAt: PROJECT.nowIso, ageMinutes: 0 },
        }}
      />,
    );
    expect(screen.getByText("Construyendo")).toBeVisible();
  });
  it.each([
    "https://github.com/example/alpha",
    undefined,
  ])("U2: missing path recovery, repo=%s, never nests copy buttons in the title link", (repo) => {
    const { container } = render(<ProjectCard project={{ ...PROJECT, pathMissing: true, repo }} />);
    expect(container.querySelector("article.proj-card.is-missing")).toBeVisible();
    expect(screen.getByText("Ruta no encontrada")).toBeVisible();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Copiar /pandacorp:sync-portfolio" })).toBeVisible();
    expect(Boolean(screen.queryByText(/^git clone/))).toBe(Boolean(repo));
    expect(container.querySelector("a button")).toBeNull();
    expect(container.querySelector("article")).toHaveAttribute("data-tone", "violet");
    expect(container.querySelectorAll(".stepper li")).toHaveLength(6);
    expect(screen.getByText(/Etapa 5 de 6/)).toBeVisible();
    expect(
      within(screen.getByRole("status")).getByRole("button", {
        name: "Copiar /pandacorp:sync-portfolio",
      }),
    ).toBeVisible();
    expect(container.querySelector(".facts")).toBeNull();
    expect(screen.queryByText(/último cambio/)).not.toBeInTheDocument();
  });
  it("U1: the first project card explains both concrete commands", () => {
    render(<FirstProjectCard />);
    expect(
      screen.getByRole("heading", { name: "Tu fábrica todavía no tiene proyectos" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Copiar /pandacorp:new-idea" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Copiar /pandacorp:spec <idea>" })).toBeVisible();
  });
});
