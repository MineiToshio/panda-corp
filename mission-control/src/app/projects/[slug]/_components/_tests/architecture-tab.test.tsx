import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TabBar } from "../tabbar";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("project=collection&tab=work-orders&wo=WO-01-001"),
}));

describe("shared Architecture workspace entry", () => {
  it("AC-04-012.1 — places Arquitectura after Observabilidad and preserves the selected project", () => {
    render(<TabBar activeTab="architecture" />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Resumen",
      "Spec",
      "Observabilidad",
      "Arquitectura",
      "Cuentas",
      "Cambios",
      "Documentos",
      "Comandos",
    ]);
    fireEvent.click(screen.getByRole("tab", { name: "Arquitectura" }));
    const query = new URLSearchParams(push.mock.calls[0]?.[0]);
    expect(query.get("project")).toBe("collection");
    expect(query.get("tab")).toBe("architecture");
    expect(query.has("wo")).toBe(false);
  });
});
