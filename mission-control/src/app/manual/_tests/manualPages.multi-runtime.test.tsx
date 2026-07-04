/**
 * manualPages — the multi-runtime bespoke page (FRD-08, DR-113).
 *
 * Proves the registry resolves the "multi-runtime" slug to the bespoke renderer
 * (not the markdown fallback), and that the composed page mounts its four parts:
 * the two-doors diagram, the runtime comparison, the source-of-truth map and the
 * modification guide. Guards against the orphaned-component bug class (a component
 * built + unit-tested but never mounted by the page).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getManualPageComponent } from "../manualPages";

describe("manualPages — multi-runtime", () => {
  it("resolves the 'multi-runtime' slug to a bespoke renderer", () => {
    const Component = getManualPageComponent("multi-runtime");
    expect(Component).not.toBeNull();
  });

  it("returns null for an unregistered slug (falls back to markdown)", () => {
    expect(getManualPageComponent("does-not-exist")).toBeNull();
  });

  it("mounts the four composed parts of the multi-runtime concept page", () => {
    const Component = getManualPageComponent("multi-runtime");
    if (Component === null) throw new Error("expected a bespoke renderer for multi-runtime");
    render(<Component />);

    // The page title as an <h1> (first DocH passes level={1}).
    expect(screen.getByRole("heading", { level: 1, name: /Operar desde cualquier agente/ }));
    // The four bespoke diagrams are all mounted.
    expect(screen.getByTestId("manual-diagram-multi-runtime")).toBeTruthy();
    expect(screen.getByTestId("manual-diagram-runtime-comparison")).toBeTruthy();
    expect(screen.getByTestId("manual-diagram-sot-map")).toBeTruthy();
    expect(screen.getByTestId("manual-diagram-modification-guide")).toBeTruthy();
  });
});
