/**
 * Manual multi-runtime page vs DR-120 (FRD-08): every non-Claude runtime is read/review-only on
 * build state; the `attended_foreground` Codex profile is withdrawn. The page may mention the old
 * profile only as withdrawn, and must never prescribe a Codex build.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getManualPageComponent } from "../manualPages";

function renderPage(): HTMLElement {
  const Component = getManualPageComponent("multi-runtime");
  if (Component === null) throw new Error("expected a bespoke renderer for multi-runtime");
  return render(<Component />).container;
}

describe("multi-runtime Manual page — DR-120 alignment", () => {
  it("does not prescribe a Codex build (no attended build test, no 7200 s budget)", () => {
    const text = renderPage().textContent ?? "";

    expect(text).not.toMatch(/build atendido/i);
    expect(text).not.toContain("7200");
    expect(text).not.toMatch(/target, varios FRDs/);
  });

  it("the verification trail gives Codex a read/review check and leaves build to Claude", () => {
    renderPage();

    expect(screen.getByText("Codex, solo lectura")).toBeTruthy();
    expect(screen.getByText("Claude, el único que construye")).toBeTruthy();
  });

  it("the verification trail makes Codex refuse to launch implement", () => {
    renderPage();

    const step = screen.getByText("Codex, solo lectura").closest("li, div");
    expect(step?.parentElement?.textContent).toMatch(/implement/);
    expect(step?.parentElement?.textContent).toMatch(/Claude Code/);
  });

  it("the Codex door is labelled read-only in the diagram", () => {
    renderPage();

    const door = screen.getByTestId("multi-runtime-door-codex");
    expect(within(door).getByText(/solo lectura/i)).toBeTruthy();
  });

  it("the shared core does not hardcode a skill count that drifts", () => {
    renderPage();

    const core = screen.getByTestId("multi-runtime-core");
    expect(core.textContent).not.toMatch(/\d+ SKILL\.md/);
  });

  it("the Notificaciones row does not promise chat progress of an attended Codex build", () => {
    renderPage();

    const row = screen.getByTestId("runtime-row-Notificaciones");
    expect(row.textContent).not.toMatch(/build atendido/i);
    expect(row.textContent).toMatch(/Codex/);
  });

  it("states that read-only is still instruction until BL-0030 makes it configuration", () => {
    const text = renderPage().textContent ?? "";

    expect(text).toMatch(/workspace-write/);
    expect(text).toMatch(/BL-0030/);
  });
});
