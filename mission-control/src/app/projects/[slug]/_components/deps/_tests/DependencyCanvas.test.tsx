import fs from "node:fs";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dependencyChain } from "@/lib/deps-layout/chain";
import { frdLayout } from "@/lib/deps-layout/frd-layout";
import { workOrderLayout } from "@/lib/deps-layout/work-order-layout";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { DependencyCanvas } from "../DependencyCanvas";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const orders: WorkOrder[] = [
  {
    id: "WO-01-001",
    frd: "frd-01-a",
    title: "WO-01-001 — First",
    state: "done",
    dependsOn: [],
    relPath: "docs/one.md",
  },
  {
    id: "WO-01-002",
    frd: "frd-01-a",
    title: "WO-01-002 — Second",
    state: "review",
    dependsOn: ["WO-01-001"],
    relPath: "docs/two.md",
  },
  {
    id: "WO-02-001",
    frd: "frd-02-b",
    title: "WO-02-001 — Third",
    state: "todo",
    dependsOn: ["WO-01-002"],
    relPath: "docs/three.md",
  },
  {
    id: "WO-02-002",
    frd: "frd-02-b",
    title: "Independent",
    state: "fail",
    relPath: "docs/four.md",
  },
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
  chains: Object.fromEntries(orders.map((order) => [order.id, dependencyChain(orders, order.id)])),
};
beforeEach(() =>
  window.history.replaceState(null, "", "/portfolio/demo/observability?view=deps&keep=yes"),
);
describe("two-level dependency view", () => {
  it("AC-12-004.1 AC-12-006.1: FRD title opens filtered work-order level, URL survives", async () => {
    const user = userEvent.setup();
    render(<DependencyCanvas data={data} />);
    expect(screen.getByRole("heading", { name: "Grafo de dependencias" })).toBeInTheDocument();
    expect(screen.getByText("2 FRDs")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /FRD-01 Foundation/ }));
    expect(location.search).toContain("dag=wo");
    expect(location.search).toContain("frd=frd-01-a");
    expect(location.search).toContain("keep=yes");
    expect(screen.getByRole("combobox")).toHaveValue("frd-01-a");
  });
  it("AC-12-004.2 AC-12-006.2: pin full chain and focus card, clear via repeat, Escape, background and button", async () => {
    window.history.replaceState(null, "", "/portfolio/demo/observability?dag=wo&view=deps");
    const user = userEvent.setup();
    const { container } = render(<DependencyCanvas data={data} />);
    const graph = screen.getByRole("region", { name: "Grafo de dependencias, desplazable" });
    const node = within(graph).getByRole("button", { name: /WO-01-002 · Second/ });
    await user.click(node);
    expect(location.search).toContain("focus=WO-01-002");
    const side = screen.getByRole("region", { name: "Work order en foco" });
    expect(within(side).getByText("Depende de · 1")).toBeInTheDocument();
    expect(within(side).getByText("Desbloquea · 1")).toBeInTheDocument();
    expect(container.querySelector('[data-wo="WO-02-002"][data-chain="dim"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-chain="on"][data-wo]')).toHaveLength(3);
    await user.click(node);
    expect(screen.queryByRole("region", { name: "Work order en foco" })).not.toBeInTheDocument();
    await user.click(node);
    await user.keyboard("{Escape}");
    expect(location.search).not.toContain("focus=");
    await user.click(node);
    fireEvent.click(graph);
    expect(location.search).not.toContain("focus=");
    await user.click(node);
    await user.click(screen.getByRole("button", { name: "Quitar foco" }));
    expect(location.search).not.toContain("focus=");
    await user.click(node);
    window.history.replaceState(null, "", `${location.pathname}${location.search}#dependency`);
    await user.click(screen.getByRole("button", { name: "Abrir work order" }));
    expect(push).toHaveBeenCalledWith(
      "/portfolio/demo/observability?dag=wo&view=deps&focus=WO-01-002&wo=WO-01-002&woview=summary#dependency",
    );
  });
  it("AC-12-004.2 AC-12-004.6: transient hover, title stripped and clamped with full tooltip", async () => {
    window.history.replaceState(null, "", "/portfolio/demo/observability?dag=wo");
    const user = userEvent.setup();
    render(<DependencyCanvas data={data} />);
    const graph = screen.getByRole("region", { name: "Grafo de dependencias, desplazable" });
    const node = within(graph).getByRole("button", { name: /WO-01-002 · Second/ });
    await user.hover(node);
    expect(node).toHaveAttribute("data-chain", "on");
    expect(location.search).not.toContain("focus=");
    await user.unhover(node);
    expect(node).not.toHaveAttribute("data-chain");
    expect(node).toHaveAttribute("title", "WO-01-002 · Second · En revisión");
    expect(within(node).getByText("Second")).toBeInTheDocument();
  });
  it("AC-12-004.3 AC-12-004.4 AC-12-004.5 AC-12-006.3: narrow ordered lists, no retired controls, bounded natural canvas", () => {
    const { container } = render(<DependencyCanvas data={data} />);
    expect(container.querySelectorAll("ol.dag-list details.dl-frd")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: /zoom|fullscreen|seguir|primer error|ajustar/i }),
    ).not.toBeInTheDocument();
    const css = fs.readFileSync(
      "src/app/projects/[slug]/_components/deps/DependencyMap.module.css",
      "utf8",
    );
    expect(css).toMatch(/overflow:\s*auto/);
    expect(css).toMatch(/max-width:\s*899px/);
    expect(css).toMatch(/text-overflow:\s*ellipsis/);
  });
  it("AC-12-006.3: work-order list is ordered by build step; invalid URL focus and filter ignored", () => {
    window.history.replaceState(
      null,
      "",
      "/portfolio/demo/observability?dag=wo&focus=missing&frd=missing",
    );
    render(<DependencyCanvas data={data} />);
    expect(screen.getByText("Paso 1 · 2 work orders")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Work order en foco" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("");
  });
});

it.each(["FRD-01", "frd-01-a"])("AC-12-006.1 scopes canonical codes and slugs: %s", (frd) => {
  window.history.replaceState(
    null,
    "",
    `/portfolio/demo/observability?view=deps&dag=wo&frd=${frd}&focus=WO-01-002`,
  );
  render(<DependencyCanvas data={data} />);
  const graph = screen.getByRole("region", { name: "Grafo de dependencias, desplazable" });
  expect(within(graph).getAllByRole("button")).toHaveLength(3);
  expect(within(graph).queryByRole("button", { name: /WO-02-002/ })).not.toBeInTheDocument();
  expect(screen.getByRole("combobox")).toHaveValue("frd-01-a");
  expect(screen.getByRole("region", { name: "Work order en foco" })).toBeInTheDocument();
});
