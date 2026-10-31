import fs from "node:fs";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { FraguaToken } from "../FraguaToken";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const order: WorkOrder = {
  id: "WO-06-013",
  title: "WO-06-013 — Forge",
  summary: "**First** sentence. Second sentence.",
  frd: "frd-06-party",
  state: "fail",
  relPath: "docs/x.md",
};
describe("token contract", () => {
  it("AC-06-002.3 AC-06-020.4: focus shows code, state, title, first sentence and FRD; blur closes", async () => {
    const user = userEvent.setup();
    render(
      <FraguaToken order={order} route="/portfolio/demo/observability" frdTitle="La Fragua" />,
    );
    await user.tab();
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("WO-06-013");
    expect(tip).toHaveTextContent("Bloqueado");
    expect(tip).toHaveTextContent("First sentence.");
    expect(tip).not.toHaveTextContent("Second sentence");
    expect(tip).toHaveTextContent("FRD-06 · La Fragua");
    await user.tab();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
  it("AC-06-001.6: a failed token draws coral and activation opens the order on its route", async () => {
    const user = userEvent.setup();
    render(<FraguaToken order={order} route="/portfolio/demo/observability" />);
    const token = screen.getByRole("button", { name: "WO-06-013: Forge" });
    expect(token).toHaveAttribute("data-tone", "coral");
    await user.click(token);
    expect(push).toHaveBeenCalledWith("/portfolio/demo/observability?wo=WO-06-013");
  });
});
describe("motion contract", () => {
  const css = fs.readFileSync(`${__dirname}/../Fragua.module.css`, "utf8");
  it("AC-06-014.1 AC-06-018.5: reduced motion stops crews and courier, keeps static content", () => {
    const blocks = css.match(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\n}/g)?.join("");
    expect(blocks).toMatch(/\.active \.cast img[\s\S]*?animation: none/);
    expect(blocks).toMatch(/\.courier\s*{\s*display: none/);
    expect(blocks).not.toMatch(/\.stations|\.tokens|\.station/);
  });
  it("AC-06-020.8: below 900 px one station per row", () => {
    expect(css).toMatch(
      /@media \(max-width: 899px\)[\s\S]*?\.stations\s*{\s*grid-template-columns: minmax\(0, 1fr\)/,
    );
  });
});
