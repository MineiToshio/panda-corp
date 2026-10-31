import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TabBar } from "../tabbar";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));
describe("workspace tab strip", () => {
  it("AC-04-014.2: positive counts get badges; zero and unknown counts do not", () => {
    render(
      <TabBar
        activeTab="summary"
        projectName="Demo"
        counts={{ orders: 12, services: 2, openChanges: null, documents: 0, frds: 4, adrs: 1 }}
      />,
    );
    expect(screen.getByRole("tab", { name: "Observabilidad 12" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Cuentas 2" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Cambios" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Documentos" })).toBeVisible();
    expect(screen.getByRole("tablist", { name: "Secciones de Demo" })).toBeVisible();
  });
  it("AC-04-012.1 AC-04-013.1: shared tabs carry prototype hooks and support keyboard selection", () => {
    render(
      <TabBar activeTab="summary" navigationBaseHref="/projects/demo/summary" projectName="Demo" />,
    );
    const summary = screen.getByRole("tab", { name: "Resumen" });
    summary.focus();
    fireEvent.keyDown(summary, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Spec" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement ?? summary, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/projects/demo/spec");
    expect(summary).toHaveAttribute("data-tabkey", "tab");
    expect(summary).toHaveAttribute("data-tabval", "Resumen");
    expect(summary).toHaveAttribute("aria-controls", "workspace-panel-summary");
  });
});
