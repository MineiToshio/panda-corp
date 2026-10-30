import path from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PortfolioPage from "@/app/portfolio/page";
import { listWorkOrders } from "@/lib/work-orders/work-orders";
import { WoDag } from "../../_observability/WoDag/WoDag";
import { ProjectWorkspace } from "../../ProjectWorkspace";
import ProjectWorkspacePage from "../../page";
import { makeLinkResolver } from "../document-links";
import { TabBar } from "../tabbar";
import { WorkOrderDetail } from "../wo-detail/wo-detail";
import { WoFrdFilteredBoard } from "../wo-frd-filtered-board/wo-frd-filtered-board";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", async (actual) => ({
  ...(await actual<typeof import("next/navigation")>()),
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("@/hooks/useLiveSnapshot", () => ({
  useLiveSnapshot: () => ({ snapshot: null, connected: false, lastEventAt: null }),
}));
vi.mock("@/lib/portfolio/portfolio", () => ({
  railProjects: () => projects,
  activeProjects: () => projects,
  readPortfolio: () => projects,
}));
const fixture = path.resolve("e2e/fixtures/factory-root/mission-control");
const status = { present: false, malformed: false, status: null } as const;
const projects = [
  { name: "First Project", path: "/nonexistent/project-one", status, exists: false },
  { name: "Selected Project", path: fixture, status, exists: true },
];
const orders = listWorkOrders(fixture);
const selectedOrder = orders.find((order) => order.id === "WO-01-001");
if (!selectedOrder) throw new Error("The navigation fixture requires WO-01-001");
const order = selectedOrder;
afterEach(() => {
  vi.clearAllMocks();
});

function setUrl(href: string): void {
  act(() => {
    window.history.replaceState({}, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

describe("persistent project workspace navigation", () => {
  it("opens a non-first project work order, changes representation and returns without losing identity", async () => {
    const href = "/portfolio/selected-project/work-orders/WO-01-001/summary?frd=frd-01-x";
    setUrl(href);
    render(
      await PortfolioPage({
        searchParams: Promise.resolve({ frd: "frd-01-x" }),
        routeState: { project: "selected-project", tab: "work-orders", wo: order.id },
      }),
    );
    expect(screen.getByRole("heading", { level: 2, name: "Selected Project" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Volver al tablero de work orders" })).toHaveAttribute(
      "href",
      "/portfolio/selected-project/work-orders?frd=frd-01-x",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Documento completo" }));
    expect(navigation.push).toHaveBeenCalledWith(
      "/portfolio/selected-project/work-orders/WO-01-001/full?frd=frd-01-x",
    );
  });

  it.each([
    { view: "cuentas" },
    { portfolioView: "accounts" },
  ])("AC-25-002.1/004.1 — restores the global accounts directory from %j", async (query) => {
    setUrl("/portfolio/selected-project/summary");
    render(
      await PortfolioPage({
        searchParams: Promise.resolve(query),
        routeState: { project: "selected-project", tab: "summary" },
      }),
    );
    expect(screen.getByRole("tab", { name: "Cuentas" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("searchbox")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Selected Project" })).not.toBeInTheDocument();
  });

  it("canonicalizes the default document to its explicit allowlisted key", async () => {
    setUrl("/portfolio/selected-project/documents");
    render(
      await PortfolioPage({
        searchParams: Promise.resolve({}),
        routeState: { project: "selected-project", tab: "documents" },
      }),
    );
    expect(navigation.replace).toHaveBeenCalledWith(
      expect.stringMatching(/^\/portfolio\/selected-project\/documents\/.+/),
      { scroll: false },
    );
  });

  it("restores standalone detail paths with the same shared workspace", async () => {
    setUrl("/projects/selected-project/work-orders/WO-01-001/full");
    render(
      await ProjectWorkspacePage({
        params: Promise.resolve({ slug: "selected-project" }),
        searchParams: Promise.resolve({}),
        routeState: { tab: "work-orders", wo: order.id, wotab: "full" },
      }),
    );
    expect(screen.getByRole("tab", { name: "Documento completo" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("link", { name: "Volver al tablero de work orders" })).toHaveAttribute(
      "href",
      "/projects/selected-project/work-orders",
    );
  });

  it("never selects the first project for an explicit unknown or duplicate project parameter", async () => {
    await expect(
      PortfolioPage({ searchParams: Promise.resolve({ project: "missing" }) }),
    ).rejects.toThrow("404");
    await expect(
      PortfolioPage({
        searchParams: Promise.resolve({ project: ["First Project", "Selected Project"] }),
      }),
    ).rejects.toThrow("404");
  });

  it("rejects unknown work orders and documents instead of opening an unrelated default", () => {
    const item = projects[1];
    if (!item) throw new Error("Missing project fixture");
    expect(() =>
      ProjectWorkspace({
        item,
        selection: {
          activeTab: "observabilidad",
          woParam: "WO-missing",
          woTabParam: "summary",
          docParam: undefined,
        },
      }),
    ).toThrow("404");
    expect(() =>
      ProjectWorkspace({
        item,
        selection: {
          activeTab: "documents",
          woParam: undefined,
          woTabParam: "summary",
          docParam: "../../private",
        },
      }),
    ).toThrow("404");
  });

  it("preserves the live query state when changing a server-owned tab", () => {
    setUrl("/portfolio/selected-project/work-orders?state=done&frd=frd-01-x");
    render(
      <TabBar
        activeTab="observabilidad"
        navigationBaseHref="/portfolio/selected-project/work-orders"
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Spec" }));
    expect(navigation.push).toHaveBeenCalledWith(
      "/portfolio/selected-project/spec?state=done&frd=frd-01-x",
    );
  });

  it("restores filters from the URL and updates their work-order links", () => {
    setUrl("/portfolio/selected-project/work-orders?frd=frd-01-x&state=done");
    render(
      <WoFrdFilteredBoard
        orders={orders}
        navigationBaseHref="/portfolio/selected-project/work-orders"
      />,
    );
    const link = screen.getByRole("link", { name: `Ver detalle: ${order.title}` });
    expect(link).toHaveAttribute(
      "href",
      "/portfolio/selected-project/work-orders/WO-01-001/summary?frd=frd-01-x&state=done",
    );
    expect(screen.queryByRole("link", { name: /Board view/ })).not.toBeInTheDocument();
    setUrl("/portfolio/selected-project/work-orders");
    expect(screen.getAllByRole("link", { name: /Ver detalle:/ })).toHaveLength(orders.length);
  });

  it("preserves the standalone origin and a document heading in Markdown reader links", () => {
    const resolver = makeLinkResolver(
      "docs/product/prd.md",
      [
        {
          id: "docs/frds/frd-01-x/frd",
          relPath: "docs/frds/frd-01-x/frd.md",
          label: "FRD",
          group: "Feature",
        },
      ],
      "Selected Project",
      "/projects/selected-project/observability?wo=WO-01-001&woview=full",
    );
    expect(resolver("../frds/frd-01-x/frd.md#acceptance")).toEqual({
      href: "/projects/selected-project/documents/docs%2Ffrds%2Ffrd-01-x%2Ffrd#acceptance",
      external: false,
    });
  });

  it("restores a pinned DAG work order and updates URL selection on clear", () => {
    setUrl("/portfolio/selected-project/observability?view=dag&dag-wo=WO-01-001");
    render(<WoDag workOrders={orders} project="fixture" />);
    expect(screen.getByRole("button", { name: "limpiar" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "limpiar" }));
    expect(new URLSearchParams(window.location.search).get("dag-wo")).toBeFalsy();
  });

  it("retains filter state in a standalone work-order detail return link", () => {
    render(
      <WorkOrderDetail
        order={order}
        content={null}
        activeWoTab="full"
        navigationBaseHref="/projects/selected-project/work-orders/WO-01-001/full?state=done"
      />,
    );
    expect(screen.getByRole("link", { name: "Volver al tablero de work orders" })).toHaveAttribute(
      "href",
      "/projects/selected-project/work-orders?state=done",
    );
  });
});
