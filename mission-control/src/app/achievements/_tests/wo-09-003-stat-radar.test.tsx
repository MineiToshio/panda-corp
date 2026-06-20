/**
 * WO-09-003 — StatRadar component tests (RED → GREEN → refactor)
 *
 * StatRadar = the 6-axis "Atributos del gremio" SVG radar chart.
 * Matches prototype statRadar() (~L459):
 *   - SVG with viewBox="0 0 330 280"
 *   - 6 axes: Producción / Velocidad / Calidad / Constancia / Ideación / Alcance
 *   - 4 grid rings (25%, 50%, 75%, 100%) as polygons
 *   - 6 spoke lines (cx=165, cy=140, R=90)
 *   - Data polygon (accent fill + opacity .2 + accent stroke + glow filter)
 *   - 6 accent dots on data points
 *   - Pixel-font axis labels
 *
 * Visual reference: prototype statRadar() ~L459
 * Token slice: accent (polygon + dots), bd (rings + spokes), pixel font labels
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatRadar } from "../StatsPanel";

afterEach(cleanup);

const DEFAULT_AXES = {
  produccion: 60,
  velocidad: 40,
  calidad: 75,
  constancia: 50,
  ideacion: 80,
  alcance: 30,
};

// ── Structure ────────────────────────────────────────────────────────────────

describe("StatRadar — structure", () => {
  it("renders without crashing", () => {
    render(<StatRadar axes={DEFAULT_AXES} />);
    expect(screen.getByTestId("stat-radar")).toBeDefined();
  });

  it("renders an SVG element", () => {
    render(<StatRadar axes={DEFAULT_AXES} />);
    const radar = screen.getByTestId("stat-radar");
    const svg = radar.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("SVG has correct viewBox", () => {
    render(<StatRadar axes={DEFAULT_AXES} />);
    const radar = screen.getByTestId("stat-radar");
    const svg = radar.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 330 280");
  });

  it("renders the ATRIBUTOS DEL GREMIO header label", () => {
    render(<StatRadar axes={DEFAULT_AXES} />);
    const radar = screen.getByTestId("stat-radar");
    expect(radar.textContent).toContain("ATRIBUTOS DEL GREMIO");
  });
});

// ── 6-axis labels ────────────────────────────────────────────────────────────

describe("StatRadar — 6-axis labels (prototype AX array)", () => {
  it("renders Producción axis label", () => {
    render(<StatRadar axes={DEFAULT_AXES} />);
    expect(screen.getByTestId("stat-radar").textContent).toContain("Producción");
  });

  it("renders Velocidad axis label", () => {
    render(<StatRadar axes={DEFAULT_AXES} />);
    expect(screen.getByTestId("stat-radar").textContent).toContain("Velocidad");
  });

  it("renders Calidad axis label", () => {
    render(<StatRadar axes={DEFAULT_AXES} />);
    expect(screen.getByTestId("stat-radar").textContent).toContain("Calidad");
  });

  it("renders Constancia axis label", () => {
    render(<StatRadar axes={DEFAULT_AXES} />);
    expect(screen.getByTestId("stat-radar").textContent).toContain("Constancia");
  });

  it("renders Ideación axis label", () => {
    render(<StatRadar axes={DEFAULT_AXES} />);
    expect(screen.getByTestId("stat-radar").textContent).toContain("Ideación");
  });

  it("renders Alcance axis label", () => {
    render(<StatRadar axes={DEFAULT_AXES} />);
    expect(screen.getByTestId("stat-radar").textContent).toContain("Alcance");
  });
});

// ── SVG polygons and elements ────────────────────────────────────────────────

describe("StatRadar — SVG ring polygons and data polygon", () => {
  it("renders 4 grid ring polygons (25/50/75/100% rings)", () => {
    render(<StatRadar axes={DEFAULT_AXES} />);
    const radar = screen.getByTestId("stat-radar");
    const svg = radar.querySelector("svg");
    // 4 rings + 1 base polygon + 1 data polygon = at least 6 polygons
    const polygons = svg?.querySelectorAll("polygon");
    expect(polygons?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("renders spoke lines from center (6 spokes)", () => {
    render(<StatRadar axes={DEFAULT_AXES} />);
    const radar = screen.getByTestId("stat-radar");
    const svg = radar.querySelector("svg");
    const lines = svg?.querySelectorAll("line");
    expect(lines?.length ?? 0).toBe(6);
  });

  it("renders the data polygon (accent fill)", () => {
    render(<StatRadar axes={DEFAULT_AXES} />);
    const radar = screen.getByTestId("stat-radar");
    const svg = radar.querySelector("svg");
    // The data polygon uses accent fill
    const dataPolygon = svg?.querySelector("[data-testid='radar-data-polygon']");
    expect(dataPolygon).not.toBeNull();
  });

  it("renders 6 data point dots (one per axis)", () => {
    render(<StatRadar axes={DEFAULT_AXES} />);
    const radar = screen.getByTestId("stat-radar");
    const svg = radar.querySelector("svg");
    const dots = svg?.querySelectorAll("[data-testid='radar-dot']");
    expect(dots?.length).toBe(6);
  });
});

// ── Accessibility ────────────────────────────────────────────────────────────

describe("StatRadar — accessibility", () => {
  it("SVG has a title or aria-label describing the chart", () => {
    render(<StatRadar axes={DEFAULT_AXES} />);
    const radar = screen.getByTestId("stat-radar");
    const svg = radar.querySelector("svg");
    const hasAriaLabel = svg?.getAttribute("aria-label") !== null;
    const hasTitle = svg?.querySelector("title") !== null;
    const hasRole = svg?.getAttribute("role") !== null;
    expect(hasAriaLabel || hasTitle || hasRole).toBe(true);
  });
});

// ── Design tokens ────────────────────────────────────────────────────────────

describe("StatRadar — design tokens", () => {
  it("data polygon uses accent token (no hardcoded color)", () => {
    render(<StatRadar axes={DEFAULT_AXES} />);
    const radar = screen.getByTestId("stat-radar");
    const svg = radar.querySelector("svg");
    const dataPolygon = svg?.querySelector("[data-testid='radar-data-polygon']");
    const stroke = dataPolygon?.getAttribute("stroke") ?? "";
    const fill = dataPolygon?.getAttribute("fill") ?? "";
    // Must reference a CSS variable (var(--color-accent)) not a raw hex
    expect(stroke.includes("var(") || fill.includes("var(")).toBe(true);
  });

  it("ring polygons use border token for stroke (no hardcoded color)", () => {
    render(<StatRadar axes={DEFAULT_AXES} />);
    const radar = screen.getByTestId("stat-radar");
    const svg = radar.querySelector("svg");
    const rings = svg?.querySelectorAll("[data-testid='radar-ring']");
    expect(rings?.length ?? 0).toBe(4);
    for (const ring of rings ?? []) {
      const stroke = ring.getAttribute("stroke") ?? "";
      expect(stroke.includes("var(")).toBe(true);
    }
  });
});
