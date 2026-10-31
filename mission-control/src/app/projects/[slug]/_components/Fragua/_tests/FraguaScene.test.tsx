import fs from "node:fs";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSignal } from "@/lib/fragua/build-signal";
import { deriveStations } from "@/lib/fragua/stations";
import { aggregateProgress, type WorkOrder } from "@/lib/work-orders/work-orders";
import { FraguaScene } from "../FraguaScene";

const state = vi.hoisted(() => ({
  orders: [] as WorkOrder[],
  running: false,
  fresh: true,
  push: vi.fn(),
}));
vi.mock("@/lib/fragua/scene-data", () => ({
  loadFraguaScene: () => {
    const nowIso = "2026-10-30T12:00:00Z";
    return {
      orders: state.orders,
      stations: deriveStations(state.orders),
      progress: aggregateProgress(state.orders),
      phase: "implementation",
      eventProject: "demo",
      nowIso,
      signal: buildSignal({
        running: state.running,
        lastEventAt: state.fresh ? nowIso : "2026-10-30T11:00:00Z",
        nowMs: Date.parse(nowIso),
      }),
    };
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push, refresh: vi.fn() }) }));
vi.mock("@/hooks/useLiveSnapshot", () => ({ useLiveSnapshot: () => ({ snapshot: null }) }));
const project = { slug: "demo", name: "Demo", path: "/tmp/demo" };
function order(state: WorkOrder["state"], id = "WO-06-001"): WorkOrder {
  return {
    id,
    title: `${id} — Real title`,
    summary: "First sentence. Second sentence.",
    frd: "frd-06-party",
    state,
    relPath: "docs/order.md",
  };
}
beforeEach(() => {
  state.orders = [];
  state.running = false;
  state.fresh = true;
});
describe("Fragua scene acceptance", () => {
  it("AC-06-013.1 AC-06-013.4 AC-06-020.3 AC-06-020.5: idle existing plan retains stations, never-built has no bar", () => {
    const { rerender, container } = render(<FraguaScene project={project} />);
    expect(screen.getByText(/Aún no hay work orders:/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    state.orders = [order("review")];
    rerender(<FraguaScene project={project} />);
    expect(screen.getByText("El equipo descansa: no hay un build corriendo.")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-station]")).toHaveLength(4);
    expect(container.querySelectorAll("[data-wo]")).toHaveLength(1);
    expect(screen.getByText("Nada por empezar")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-station="todo"] span')).not.toHaveLength(0);
  });
  it("AC-06-002.3 AC-06-020.4: token tooltip, first sentence, named FRD, scroll and blur close; tap navigates", async () => {
    state.orders = [order("review")];
    const user = userEvent.setup();
    render(<FraguaScene project={project} frds={[{ slug: "frd-06-party", title: "La Fragua" }]} />);
    const token = screen.getByRole("button", { name: "WO-06-001: Real title" });
    await user.hover(token);
    expect(within(screen.getByRole("tooltip")).getByText("FRD-06 · La Fragua")).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("First sentence.");
    expect(screen.getByRole("tooltip")).not.toHaveTextContent("Second sentence");
    fireEvent.scroll(window);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.focus(token);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.blur(token);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await user.tab();
    expect(token).toHaveFocus();
    fireEvent.scroll(window);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await user.click(token);
    expect(state.push).toHaveBeenCalledWith("/projects/demo/observability?wo=WO-06-001");
  });
  it("AC-04-014.3 (Resumen owns the start command) AC-06-012.1 AC-06-012.2 AC-06-012.3 AC-06-013.2 AC-06-013.3 AC-06-020.2 AC-06-020.6 AC-06-020.7: read-only live, stale and foot facts", () => {
    state.orders = [order("todo"), order("done", "WO-06-002")];
    state.running = true;
    const { container, rerender } = render(<FraguaScene project={project} openChanges={2} />);
    expect(screen.getByText("Construyendo ahora")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAccessibleName(/1 verificadas/);
    expect(container.querySelector(".fr-courier")).toBeInTheDocument();
    expect(screen.getByText("Falta 1")).toBeInTheDocument();
    expect(screen.getByText("2 cambios abiertos")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /Demo ·|Simulación|effort|Equilibrado|Reiniciar|Pausar/,
    );
    state.fresh = false;
    rerender(<FraguaScene project={project} />);
    expect(screen.getByText("Sin señal")).toBeInTheDocument();
    expect(container.querySelector(".fr-courier")).not.toBeInTheDocument();
    expect(container.querySelector('[data-live="false"]')).toBeInTheDocument();
  });
  it("AC-06-014.1 AC-06-018.5 AC-06-020.8: CSS turns motion off, keeps static live text and stacks below 900", () => {
    const css = fs.readFileSync(
      "src/app/projects/[slug]/_components/Fragua/Fragua.module.css",
      "utf8",
    );
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/animation:\s*none/);
    expect(css).toMatch(/max-width:\s*899px/);
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });
});
