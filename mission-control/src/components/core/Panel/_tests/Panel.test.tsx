/**
 * WO-13-007 — Panel / RpgPanel (CMP-13-panel) — TDD tests
 *
 * The app-wide surface. Base .panel re-skinned by RPG embossed override (rpgpanel/rpggrid).
 * .secondary is the resting-tile variant.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Panel, type PanelProps } from "@/components/core/Panel/Panel";

function renderPanel(props: Partial<PanelProps> = {}) {
  return render(<Panel {...props}>Contenido del panel</Panel>);
}

describe("frd-13/wo-13-007: Panel — variant rendering", () => {
  it("frd-13: Panel — renders default 'panel' variant", () => {
    renderPanel();
    const el = screen.getByTestId("panel");
    expect(el.getAttribute("data-variant")).toBe("panel");
  });

  it("frd-13: Panel — renders 'rpgpanel' variant", () => {
    renderPanel({ variant: "rpgpanel" });
    const el = screen.getByTestId("panel");
    expect(el.getAttribute("data-variant")).toBe("rpgpanel");
  });

  it("frd-13: Panel — renders 'secondary' variant", () => {
    renderPanel({ variant: "secondary" });
    const el = screen.getByTestId("panel");
    expect(el.getAttribute("data-variant")).toBe("secondary");
  });

  it("frd-13: Panel — renders children", () => {
    renderPanel();
    expect(screen.getByText("Contenido del panel")).toBeDefined();
  });

  it("frd-13: Panel — has data-testid='panel'", () => {
    renderPanel();
    expect(screen.getByTestId("panel")).toBeDefined();
  });
});

describe("frd-13/wo-13-007: Panel — grid variant", () => {
  it("frd-13: Panel — grid=true adds data-grid attribute", () => {
    renderPanel({ variant: "rpgpanel", grid: true });
    const el = screen.getByTestId("panel");
    expect(el.getAttribute("data-grid")).toBe("true");
  });

  it("frd-13: Panel — grid=false (default) does not set data-grid", () => {
    renderPanel({ variant: "rpgpanel" });
    const el = screen.getByTestId("panel");
    expect(el.getAttribute("data-grid")).not.toBe("true");
  });
});

describe("frd-13/wo-13-007: Panel — glow prop", () => {
  it("frd-13: Panel — glow='warn' adds data-glow='warn'", () => {
    renderPanel({ glow: "warn" });
    const el = screen.getByTestId("panel");
    expect(el.getAttribute("data-glow")).toBe("warn");
  });

  it("frd-13: Panel — glow='accent' adds data-glow='accent'", () => {
    renderPanel({ glow: "accent" });
    const el = screen.getByTestId("panel");
    expect(el.getAttribute("data-glow")).toBe("accent");
  });
});

describe("frd-13/wo-13-007: Panel — tokens only", () => {
  it("frd-13: Panel — inline style uses var() not hardcoded hex", () => {
    const { container } = renderPanel();
    const el = container.firstElementChild as HTMLElement | null;
    if (!el) throw new Error("No element");
    const style = el.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
