import fs from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { WorkOrderBoard } from "../wo-board";

const orders: WorkOrder[] = Array.from({ length: 21 }, (_, i) => ({
  id: `WO-01-${String(i).padStart(3, "0")}`,
  title: `Reader ${i}`,
  frd: "frd-01-core",
  state: "done",
  relPath: "",
}));
describe("AC-05-008.3 capped board", () => {
  it("renders 8 / 4 caps before hydration, 13 / 17 remainder, reveals and collapses", async () => {
    render(<WorkOrderBoard orders={orders} />);
    expect(screen.getAllByRole("region")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Mostrar 13 más" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mostrar 17 más" })).toBeInTheDocument();
    const css = fs.readFileSync(
      "src/app/projects/[slug]/_components/wo-board/board.module.css",
      "utf8",
    );
    expect(css).toMatch(/:nth-child\(n\s*\+\s*9\)/);
    expect(css).toMatch(/:nth-child\(n\s*\+\s*5\)/);
    expect(css).toContain("max-width: 759px");
    await userEvent.click(screen.getByRole("button", { name: "Mostrar 13 más" }));
    expect(screen.getByRole("button", { name: "Mostrar menos" })).toBeInTheDocument();
    expect(document.querySelector('[data-expanded="true"]')).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mostrar menos" }));
    expect(document.querySelector('[data-expanded="true"]')).not.toBeInTheDocument();
    expect(screen.getAllByText("Sin work orders")).toHaveLength(3);
  });
  it("adds a fifth, coral blocker column only for failed orders and uses the same card", () => {
    const first = orders[0];
    if (!first) throw new Error("Missing fixture order");
    render(
      <WorkOrderBoard
        orders={[{ ...first, state: "fail", blockedReason: "Need a decision" }]}
        navigationBaseHref="/portfolio/demo/observability?view=tablero&state=fail"
      />,
    );
    const blocked = screen.getByRole("region", { name: "Bloqueado: 1" });
    expect(blocked).toHaveAttribute("data-tone", "coral");
    expect(within(blocked).getByText("Need a decision")).toBeInTheDocument();
    expect(within(blocked).getByRole("link")).toHaveAttribute(
      "href",
      "/portfolio/demo/observability?view=tablero&state=fail&wo=WO-01-000",
    );
    expect(within(blocked).getByText("Bloqueado", { selector: ".chip" })).toBeInTheDocument();
  });
});
