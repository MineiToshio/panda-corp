import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ObservabilidadPanel from "../../../_panels/ObservabilidadPanel";
import type { PanelProps } from "../../../_panels/types";
import { TabBar } from "../../tabbar";

const source = vi.hoisted(() => ({
  orders: vi.fn(),
  frds: vi.fn(),
  drift: vi.fn(),
  detail: vi.fn(),
  map: vi.fn(),
}));
vi.mock("@/lib/work-orders/published", () => ({ readPublishedWorkOrders: source.orders }));
vi.mock("@/lib/frds/frd-index", () => ({ listProjectFrds: source.frds }));
vi.mock("@/lib/frds/frd-drift", () => ({ readFrdDrift: source.drift }));
vi.mock("../../deps/DependencyMap", () => ({
  DependencyMap: (props: unknown) => {
    source.map(props);
    return <div>Dependency map</div>;
  },
}));
vi.mock("../../wo-detail/WoDetail", () => ({
  WoDetail: (props: unknown) => {
    source.detail(props);
    return <div>Order detail</div>;
  },
}));
vi.mock("../../../_observability/WoLiveRefresh/wo-live-refresh", () => ({
  WoLiveRefresh: () => <span data-testid="live" />,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
const props = {
  project: {
    slug: "demo",
    folder: "demo-folder",
    name: "Demo",
    projectPath: "/tmp/demo",
    frds: [],
  },
  route: {
    navigationBaseHref: "/portfolio/demo/observability?view=deps",
    state: { view: "deps" },
    woTabParam: "summary",
  },
} as unknown as PanelProps;
beforeEach(() => {
  source.orders.mockReturnValue({
    items: [{ id: "WO-01-001", title: "Source", frd: "frd-01-core", state: "done", relPath: "" }],
    errors: [],
  });
  source.frds.mockReturnValue([{ slug: "frd-01-core", code: "FRD-01", title: "Core" }]);
  source.drift.mockReturnValue({ ok: true, ids: [] });
  vi.clearAllMocks();
});
describe("AC-12-002.1 AC-12-002.2 AC-12-002.3 server mounts", () => {
  it("places Observabilidad third after Spec", () => {
    render(<TabBar activeTab="observability" navigationBaseHref="/portfolio/demo/observability" />);
    expect(
      screen
        .getAllByRole("tab")
        .slice(0, 3)
        .map((node) => node.textContent),
    ).toEqual(["Resumen", "Spec", "Observabilidad"]);
  });
  it("mounts the new dependency seam over real project identity and one live subscriber", () => {
    render(<ObservabilidadPanel {...props} />);
    expect(source.map).toHaveBeenCalledWith({
      project: { slug: "demo", path: "/tmp/demo" },
      route: { dag: undefined, focus: undefined, frd: undefined },
    });
    expect(source.orders).toHaveBeenCalledTimes(1);
    expect(source.frds).toHaveBeenCalledTimes(1);
    expect(source.drift).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId("live")).toHaveLength(1);
    expect(screen.queryByText(/La Fragua|Línea de tiempo|RPG/)).not.toBeInTheDocument();
  });
  it("mounts the detail with full-view selection and filter context instead of unrelated lists", () => {
    window.history.replaceState(null, "", "/portfolio/demo/observability?wo=WO-01-001");
    render(
      <ObservabilidadPanel
        {...props}
        route={{ ...props.route, woParam: "WO-01-001", woTabParam: "full" }}
      />,
    );
    expect(source.detail).toHaveBeenCalledWith(
      expect.objectContaining({
        project: props.project,
        woId: "WO-01-001",
        view: "Documento completo",
        navigationBaseHref: props.route.navigationBaseHref,
      }),
    );
    expect(screen.getAllByTestId("live")).toHaveLength(1);
    window.history.replaceState(null, "", "/");
  });
  it("fails loud on a malformed work-order source instead of drawing empty or invented data", async () => {
    const { readPublishedWorkOrders: actualReader } = await vi.importActual<
      typeof import("@/lib/work-orders/published")
    >("@/lib/work-orders/published");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wo-panel-"));
    try {
      const folder = path.join(root, "docs/frds/frd-01-core/work-orders");
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, "wo-01-001-broken.md"), "---\nbroken: [\n---\n# Broken");
      source.orders.mockImplementation(actualReader);
      render(<ObservabilidadPanel {...props} project={{ ...props.project, projectPath: root }} />);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
    expect(screen.getByRole("alert")).toHaveTextContent(
      "docs/frds/frd-01-core/work-orders/wo-01-001-broken.md",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("YAML malformado");
    expect(screen.queryByText("Dependency map")).not.toBeInTheDocument();
  });
  it("keeps a legitimately empty project free of tiles, groups and filters", () => {
    source.orders.mockReturnValue({ items: [], errors: [] });
    render(<ObservabilidadPanel {...props} />);
    expect(screen.getByText(/todavía no tiene work orders/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

it("AC-05-008.2 renders an empty project before docs/frds exists", async () => {
  const { readPublishedWorkOrders } = await vi.importActual<
    typeof import("@/lib/work-orders/published")
  >("@/lib/work-orders/published");
  const { listProjectFrds } =
    await vi.importActual<typeof import("@/lib/frds/frd-index")>("@/lib/frds/frd-index");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wo-panel-empty-"));
  try {
    source.orders.mockImplementation(readPublishedWorkOrders);
    source.frds.mockImplementation(listProjectFrds);
    render(<ObservabilidadPanel {...props} project={{ ...props.project, projectPath: root }} />);
    expect(screen.getByText(/todavía no tiene work orders/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  } finally {
    fs.rmdirSync(root);
  }
});

it("DR-078: a per-file failure keeps valid work-order views mounted", () => {
  const valid = { id: "WO-01-001", title: "Valid", frd: "frd-01-core", state: "done", relPath: "" };
  source.orders.mockReturnValue({
    items: [valid],
    errors: [
      {
        file: "docs/frds/frd-01-core/work-orders/wo-01-002-broken.md",
        reason: "malformed YAML frontmatter",
      },
    ],
  });
  render(<ObservabilidadPanel {...props} />);
  expect(screen.getByText("Dependency map")).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("wo-01-002-broken.md");
  expect(screen.getByRole("alert")).toHaveTextContent("YAML malformado");
});
