import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Nav } from "../Nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/board" }));

describe("AC-19-005.2 gate: no manufactured urgency", () => {
  it("Inicio with nothing for the owner shows no count, no description and no dot", () => {
    render(<Nav counts={{ inicio: 0, tablero: 0, propuestas: 0 }} />);
    const inicio = screen.getByRole("link", { name: "Inicio" });
    expect(inicio).not.toHaveAttribute("aria-describedby");
    expect(inicio).not.toHaveTextContent("0");
    expect(screen.queryByTestId("inicio-rail-dot")).toBeNull();
  });
});
