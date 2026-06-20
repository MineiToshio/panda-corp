/**
 * WO-13-009 — DemoControls tests
 *
 * DR-061 SOLO DEMO wrapper: dashed border + "🔧 SOLO DEMO" tag + one-line note.
 * Demo-only, never ships in read-only MC.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DemoControls } from "../DemoControls";

describe("DemoControls", () => {
  it("renders root element", () => {
    render(
      <DemoControls note="Estos controles no existen en Mission Control real.">
        <button type="button">Test control</button>
      </DemoControls>,
    );
    expect(screen.getByTestId("demo-controls-root")).toBeInTheDocument();
  });

  it("renders the SOLO DEMO badge", () => {
    render(
      <DemoControls note="Solo demo note.">
        <span>child</span>
      </DemoControls>,
    );
    expect(screen.getByTestId("demo-controls-badge")).toHaveTextContent("SOLO DEMO");
  });

  it("renders the note text", () => {
    render(
      <DemoControls note="El build se lanza con /pandacorp:implement.">
        <span>child</span>
      </DemoControls>,
    );
    expect(screen.getByTestId("demo-controls-note")).toHaveTextContent(
      "El build se lanza con /pandacorp:implement.",
    );
  });

  it("renders children inside the wrapper", () => {
    render(
      <DemoControls note="note">
        <button data-testid="child-btn" type="button">
          Control
        </button>
      </DemoControls>,
    );
    expect(screen.getByTestId("child-btn")).toBeInTheDocument();
  });

  it("has dashed border style (DR-061 visual contract)", () => {
    render(
      <DemoControls note="note">
        <span>x</span>
      </DemoControls>,
    );
    const root = screen.getByTestId("demo-controls-root");
    const style = root.getAttribute("style") ?? "";
    expect(style).toContain("dashed");
  });

  it("badge uses warn color token (not hardcoded hex)", () => {
    render(
      <DemoControls note="note">
        <span>x</span>
      </DemoControls>,
    );
    const badge = screen.getByTestId("demo-controls-badge");
    const style = badge.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(style).toContain("--color-warn");
  });

  it("does not use hardcoded hex in root inline styles", () => {
    render(
      <DemoControls note="note">
        <span>x</span>
      </DemoControls>,
    );
    const root = screen.getByTestId("demo-controls-root");
    const style = root.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("renders the wrench icon in the badge", () => {
    render(
      <DemoControls note="note">
        <span>x</span>
      </DemoControls>,
    );
    expect(screen.getByTestId("demo-controls-badge")).toHaveTextContent("🔧");
  });
});
