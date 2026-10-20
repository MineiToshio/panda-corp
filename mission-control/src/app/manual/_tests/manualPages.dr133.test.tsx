/** Owner authorization remains separate from automation evidence (DR-133). */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getManualPageComponent } from "../manualPages";

function renderPage(): HTMLElement {
  const Component = getManualPageComponent("multi-runtime");
  if (Component === null) throw new Error("expected a bespoke renderer for multi-runtime");
  return render(<Component />).container;
}
describe("multi-runtime Manual page — DR-133", () => {
  it("grants Codex full native authority without claiming unattended parity", () => {
    const text = renderPage().textContent ?? "";
    expect(screen.getByText("Codex, acceso completo")).toBeTruthy();
    expect(screen.getByText("Claude, su motor nativo")).toBeTruthy();
    expect(text).toMatch(/ambos pueden ejecutar todos los skills/i);
    expect(text).toMatch(/no se promete\s+ejecución nocturna/i);
    expect(text).not.toMatch(/debe negarse y remitirte|Codex es solo lectura/);
  });
  it("labels the Codex door with full access", () => {
    renderPage();
    expect(
      within(screen.getByTestId("multi-runtime-door-codex")).getByText(/acceso completo/i),
    ).toBeTruthy();
  });
  it("keeps shared skill counts dynamic", () => {
    renderPage();
    expect(screen.getByTestId("multi-runtime-core").textContent).not.toMatch(/\d+ SKILL\.md/);
  });
});
