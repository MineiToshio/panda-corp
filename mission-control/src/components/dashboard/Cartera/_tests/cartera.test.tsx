import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PROJECT } from "@/components/modules/ProjectCard/_tests/fixture";
import { ProjectCard } from "@/components/modules/ProjectCard/ProjectCard";
import { buildSignal } from "@/lib/fragua/build-signal";
import { deriveVerdict } from "@/lib/fragua/verdict";
import { Cartera } from "../Cartera";

describe("Inicio portfolio", () => {
  it("REQ-18-021: consumes the card's nextCommand and order; empty factory offers both first actions", () => {
    const { rerender } = render(
      <Cartera cards={[{ ...PROJECT, nextCommand: "/pandacorp:release" }]} />,
    );
    expect(screen.getByText("/pandacorp:release")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver portafolio" })).toHaveAttribute(
      "href",
      "/portfolio",
    );
    rerender(<Cartera cards={[]} />);
    expect(screen.getByText("Tu fábrica todavía no tiene proyectos")).toBeVisible();
    expect(screen.getByRole("button", { name: "Copiar /pandacorp:new-idea" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Copiar /pandacorp:spec <idea>" })).toBeVisible();
  });
  it.each([
    false,
    true,
  ])("AC-06-019.7 AC-12-001.2: scene verdict, Inicio and Portafolio share the freshness signal; fresh=%s", (fresh) => {
    const signal = buildSignal({
      running: true,
      lastEventAt: fresh ? PROJECT.nowIso : "2026-10-30T10:00:00Z",
      nowMs: Date.parse(PROJECT.nowIso),
    });
    const verdict = deriveVerdict({
      orders: [],
      phase: "implementation",
      signal,
      nowMs: Date.parse(PROJECT.nowIso),
    });
    const project = { ...PROJECT, build: signal };
    render(
      <>
        <section aria-label="Inicio">
          <Cartera cards={[project]} />
        </section>
        <section aria-label="Portafolio">
          <ProjectCard project={project} />
        </section>
      </>,
    );
    expect(verdict.health).toBe(fresh ? "building" : "noSignal");
    if (!fresh) expect(verdict.text).toContain("hace 2 h");
    for (const label of ["Inicio", "Portafolio"]) {
      const surface = within(screen.getByRole("region", { name: label }));
      expect(
        surface.getByText(fresh ? "Construyendo" : "Sin señal · último evento hace 2 h"),
      ).toBeVisible();
      if (!fresh) expect(surface.queryByText("Construyendo")).not.toBeInTheDocument();
    }
  });
});
