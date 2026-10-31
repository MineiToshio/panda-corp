import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Nav } from "../Nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
const css = document.createElement("style");
css.textContent = ".mini { display: none; }";
afterEach(() => css.remove());
describe("AC-19-005.2: exact destination names with described counts", () => {
  it("keeps counts outside names, alerts Inicio and hides zero proposals", () => {
    document.head.append(css);
    const view = render(<Nav counts={{ inicio: 3, tablero: 14, propuestas: 2 }} />);
    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAccessibleDescription(
      "3 asuntos esperan tu decisión",
    );
    expect(screen.getByRole("link", { name: "Tablero" })).toHaveAccessibleDescription("14");
    expect(screen.getByRole("link", { name: "Propuestas" })).toHaveAccessibleDescription(
      "2 cosas esperan tu decisión",
    );
    expect(screen.getByTestId("inicio-rail-dot")).toHaveAttribute("aria-hidden", "true");
    view.rerender(<Nav counts={{ inicio: 0, propuestas: 0 }} />);
    expect(screen.getByRole("link", { name: "Propuestas" })).not.toHaveAttribute(
      "aria-describedby",
    );
    expect(screen.queryByTestId("inicio-rail-dot")).toBeNull();
  });
});
