/**
 * WO-13-007 — Chip (CMP-13-chip) — TDD tests
 *
 * The ONE pill primitive (.chip). Tones: ok/warn/danger/info/accent/secondary.
 * frd/verde/live are tone presets, NOT new components.
 *
 * Traceability: AC-13-006.x — tokens only, WCAG AA, tabular-nums on numeric content.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Chip, type ChipProps } from "@/components/core/Chip/Chip";

function renderChip(props: ChipProps) {
  return render(<Chip {...props} />);
}

describe("frd-13/wo-13-007: Chip — tone rendering", () => {
  const tones: ChipProps["tone"][] = ["ok", "warn", "danger", "info", "accent", "secondary"];

  for (const tone of tones) {
    it(`frd-13: Chip tone="${tone}" — renders with data-tone attribute`, () => {
      renderChip({ tone, children: "Label" });
      const chip = screen.getByTestId("chip");
      expect(chip.getAttribute("data-tone")).toBe(tone);
    });
  }
});

describe("frd-13/wo-13-007: Chip — content", () => {
  it("frd-13: Chip — renders children text", () => {
    renderChip({ tone: "ok", children: "Activo" });
    expect(screen.getByText("Activo")).toBeDefined();
  });

  it("frd-13: Chip — has data-testid='chip'", () => {
    renderChip({ tone: "warn", children: "Aviso" });
    expect(screen.getByTestId("chip")).toBeDefined();
  });
});

describe("frd-13/wo-13-007: Chip — tokens only (no hardcoded hex in inline styles)", () => {
  it("frd-13: Chip — inline style uses var() not hardcoded hex", () => {
    const { container } = renderChip({ tone: "warn", children: "X" });
    const el = container.firstElementChild as HTMLElement | null;
    if (!el) throw new Error("No element");
    const style = el.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});

describe("frd-13/wo-13-007: Chip — optional label prop", () => {
  it("frd-13: Chip — renders label prop as text", () => {
    renderChip({ tone: "info", label: "FRD-13" });
    expect(screen.getByText("FRD-13")).toBeDefined();
  });
});
