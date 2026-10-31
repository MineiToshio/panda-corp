import fs from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { dependencyChain } from "@/lib/deps-layout/chain";
import { frdLayout } from "@/lib/deps-layout/frd-layout";
import { workOrderLayout } from "@/lib/deps-layout/work-order-layout";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { DependencyCanvas } from "../DependencyCanvas";

const order = (id: string, frd: string, dependsOn: string[] = []): WorkOrder => ({
  id,
  frd,
  title: `${id} — Title of ${id}`,
  state: "todo",
  dependsOn,
  relPath: "docs/x.md",
});
const orders = [
  order("WO-01-001", "frd-01-a"),
  order("WO-01-002", "frd-01-a", ["WO-01-001"]),
  order("WO-02-001", "frd-02-b", ["WO-01-002", "WO-01-001"]),
  order("WO-02-002", "frd-02-b"),
];
const frds = [
  { slug: "frd-01-a", code: "FRD-01", title: "Foundation" },
  { slug: "frd-02-b", code: "FRD-02", title: "Feature" },
];
const data = {
  orders,
  frds,
  frdGeometry: frdLayout(orders, frds),
  workLayouts: Object.fromEntries(
    ["", ...frds.map((f) => f.slug)].map((slug) => [slug, workOrderLayout(orders, slug)]),
  ),
  chains: Object.fromEntries(orders.map((o) => [o.id, dependencyChain(orders, o.id)])),
};
const go = (query: string) =>
  window.history.replaceState(null, "", `/portfolio/demo/observability?view=deps&${query}`);
beforeEach(() => go(""));

describe("URL values not in the set are ignored", () => {
  it.each([
    "constructor",
    "__proto__",
    "toString",
    "frd-99-nope",
  ])("AC-12-004.5: frd=%s falls back to the whole graph", (value) => {
    go(`dag=wo&frd=${value}`);
    render(<DependencyCanvas data={data} />);
    const graph = screen.getByRole("region", { name: "Grafo de dependencias, desplazable" });
    expect(within(graph).getAllByRole("button")).toHaveLength(4);
    expect(screen.getByRole("combobox")).toHaveValue("");
  });
  it("AC-12-006.2: a focus outside the shown set draws no card and no chain", () => {
    go("dag=wo&frd=frd-01-a&focus=WO-02-002");
    const { container } = render(<DependencyCanvas data={data} />);
    expect(screen.queryByRole("region", { name: "Work order en foco" })).not.toBeInTheDocument();
    expect(container.querySelector("[data-chain]")).toBeNull();
  });
  it("AC-12-004.1: an unknown dag level renders the FRD level", () => {
    go("dag=bogus");
    render(<DependencyCanvas data={data} />);
    expect(
      screen.getByRole("region", { name: "Mapa de dependencias entre FRDs, desplazable" }),
    ).toBeInTheDocument();
  });
});
describe("bounded canvas and removed controls", () => {
  it("AC-12-004.5: the region bounds its height so the canvas pans inside it", () => {
    const css = fs.readFileSync(`${__dirname}/../DependencyMap.module.css`, "utf8");
    const region = css.match(/\.region\s*{[^}]*}/)?.[0] ?? "";
    expect(region).toMatch(/overflow: auto/);
    expect(region).toMatch(/(max-)?height:/);
  });
  it("AC-12-004.3 AC-12-004.4 AC-12-004.5: no jump, follow, zoom, fit or fullscreen control", () => {
    go("dag=wo");
    render(<DependencyCanvas data={data} />);
    expect(
      screen.queryByRole("button", { name: /error|seguir|zoom|ajustar|pantalla completa/i }),
    ).not.toBeInTheDocument();
  });
  it("AC-12-004.2: keyboard focus lights the chain and blur clears it without a URL write", async () => {
    go("dag=wo");
    const user = userEvent.setup();
    const { container } = render(<DependencyCanvas data={data} />);
    await user.tab();
    while (document.activeElement?.getAttribute("data-wo") !== "WO-01-002") await user.tab();
    expect(container.querySelector('[data-wo="WO-02-002"][data-chain="dim"]')).not.toBeNull();
    expect(location.search).not.toContain("focus=");
    await user.tab();
    expect(container.querySelector('[data-wo="WO-01-002"][data-chain]')).not.toBeNull();
  });
});
