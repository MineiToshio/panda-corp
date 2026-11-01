import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitForLayout } from "@/components/modules/DataModelViewer/_tests/waitForLayout";
import { parseNavigationUrl } from "@/lib/navigation/urls";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import { loadWorkspaceProject } from "../_panels/workspaceProject";
import { ProjectWorkspace } from "../ProjectWorkspace";
import ProjectWorkspacePage from "../page";
import { workspaceSelection } from "../workspace-route";
import { openStandalone } from "./standaloneRoute";

const state = vi.hoisted(() => ({
  items: [] as ProjectListItem[],
  push: vi.fn(),
  liveSnapshot: vi.fn(() => ({ snapshot: null, connected: false, lastEventAt: null })),
}));
vi.mock("@/hooks/useLiveSnapshot", () => ({ useLiveSnapshot: state.liveSnapshot }));
vi.mock("@/lib/portfolio/portfolio", () => ({
  allProjects: () => state.items,
  readPortfolio: () => state.items,
}));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ push: state.push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => window.location.pathname,
}));

let root: string;
let item: ProjectListItem;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-frame-"));
  fs.cpSync(
    path.resolve("e2e/fixtures/factory-root/mission-control/docs"),
    path.join(root, "docs"),
    { recursive: true },
  );
  const pending = path.join(root, "docs/frds/frd-01-x/work-orders/wo-01-004-polish.md");
  fs.writeFileSync(
    pending,
    fs
      .readFileSync(pending, "utf8")
      .replace("implementation_status: PENDING", "implementation_status: PLANNED"),
  );
  vi.stubEnv("PANDACORP_FACTORY_ROOT", root);
  item = {
    name: "Fixture project",
    path: root,
    exists: true,
    stage: "implementation",
    status: {
      present: true,
      malformed: false,
      status: { project: "Fixture project", phase: "implementation" },
    },
  };
  state.items = [item];
  state.push.mockClear();
  state.liveSnapshot.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  // Remove only the files this suite created; managed state directories are never bulk-cleaned.
  function removeFiles(directory: string): void {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) removeFiles(file);
      else fs.unlinkSync(file);
    }
  }
  removeFiles(root);
});
function write(relative: string, content: string): void {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function published(): void {
  write(
    ".pandacorp/comms/spec-resumen.md",
    fs.readFileSync(
      path.resolve("e2e/fixtures/factory-root/mission-control/.pandacorp/comms/spec-resumen.md"),
      "utf8",
    ),
  );
  write(
    ".pandacorp/comms/arquitectura-resumen.md",
    `---
proyecto: Fixture architecture
fase: producto
---
## Stack y tecnologías
| Capa | Elección | Por qué |
|---|---|---|
| UI | Next.js | Shared routing |
## Integraciones y operación
### Delivery
Reads project documents.
`,
  );
  write(
    "docs/frds/frd-01-x/frd.md",
    "---\nid: FRD-01\ntitle: Live feature\nui: true\n---\n# Live feature\n",
  );
}
function mount(tab = "summary", base = "/portfolio/fixture-project/summary") {
  return render(
    <ProjectWorkspace
      item={item}
      selection={workspaceSelection({ tab })}
      navigationBaseHref={base}
    />,
  );
}

describe("workspace real mount", () => {
  it.each([
    undefined,
    "WO-01-001",
  ])("uses the event emitter folder identity with work-order selection %s", (wo) => {
    render(
      <ProjectWorkspace
        item={item}
        selection={workspaceSelection({ tab: "observability", wo })}
        navigationBaseHref="/projects/fixture-project/observability"
      />,
    );
    expect(state.liveSnapshot).toHaveBeenCalled();
    for (const call of state.liveSnapshot.mock.calls) {
      expect(call).toEqual([{ project: path.basename(root) }]);
    }
  });

  it.each([
    "foo%20bar",
    "foo%",
    "%E0%A4%A",
  ])("renders the unknown section card for %s without a redirect loop", async (section) => {
    render(await openStandalone(`/projects/fixture-project/${section}`));
    expect(screen.getByText("Esta sección no existe")).toBeVisible();
  });

  it("AC-04-012.1 AC-04-013.1 AC-04-014.1 AC-04-014.2: default hero, eight ordered tabs and live badges", () => {
    mount();
    expect(screen.getByTestId("project-hero")).toBeVisible();
    expect(screen.queryByTestId("project-hero-compact")).toBeNull();
    const tabs = within(
      screen.getByRole("tablist", { name: "Secciones de Fixture project" }),
    ).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent?.replace(/\d+$/u, ""))).toEqual([
      "Resumen",
      "Spec",
      "Observabilidad",
      "Arquitectura",
      "Cuentas",
      "Cambios",
      "Documentos",
      "Comandos",
    ]);
    expect(screen.getByRole("tab", { name: /^Documentos/ })).toHaveTextContent(/\d/);
  });
  it("AC-04-013.4: an unpublished Spec keeps its real FRDs and PRD link", () => {
    mount("spec", "/projects/fixture-project/spec");
    expect(screen.getByText("El spec todavía no está publicado.")).toBeVisible();
    expect(screen.getByText("Su PRD y sus FRDs reales siguen disponibles.")).toBeVisible();
    expect(screen.getByRole("link", { name: "PRD completo" })).toHaveAttribute(
      "href",
      expect.stringContaining("/projects/fixture-project/documents/"),
    );
    expect(screen.getByTestId("spec-frd")).toBeVisible();
  });
  it("AC-12-006.4: aliases select Observabilidad; unknown sections keep the compact frame", () => {
    expect(workspaceSelection({ tab: "Work orders" }).activeTab).toBe("observability");
    mount("unknown-tab");
    expect(screen.getByTestId("project-hero-compact")).toBeVisible();
    expect(screen.getByText("Esta sección no existe")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ir al resumen" })).toHaveAttribute(
      "href",
      "/portfolio/fixture-project/summary",
    );
  });
  it.each([
    "/portfolio/fixture-project",
    "/projects/fixture-project",
  ])("AC-04-013.2 AC-04-013.3: %s carries live FRDs, orders, construction state and document context", async (base) => {
    published();
    mount("spec", `${base}/spec`);
    const card = screen.getByRole("button", { name: "FRD-01 Live feature" });
    expect(card).toHaveTextContent("UI");
    expect(within(card).getByRole("img")).toBeVisible();
    expect(card).not.toHaveTextContent("work orders planificadas");
    const link = screen.getByRole("link", { name: "Documento del producto" });
    expect(link).toHaveAttribute("href", `${base}/documents/docs%2Fproduct%2Fprd`);
    card.focus();
    fireEvent.click(card);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByTestId("arch-frd-wo")).toHaveLength(4);
    expect(within(dialog).getByRole("link", { name: "Ver work orders" })).toHaveAttribute(
      "href",
      `${base}/observability?frd=FRD-01`,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    await act(async () => Promise.resolve());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(card).toHaveFocus();
  });
  it.each([
    "spec",
    "architecture",
  ])("AC-04-013.2 AC-04-012.2: %s carries sourceErrors from malformed real orders and FRDs", (tab) => {
    published();
    write(
      "docs/frds/frd-01-x/work-orders/wo-01-001-reader.md",
      "---\nid: WO-01-001\nimplementation_status: INVALID\n---\n",
    );
    write("docs/frds/frd-01-x/frd.md", "---\nui: [\n---\n");
    mount(tab, `/projects/fixture-project/${tab}`);
    expect(screen.getByText(/implementation_status no es PLANNED/)).toBeVisible();
    expect(screen.getByText(/unexpected end|flow collection|missed comma/i)).toBeVisible();
  });
  it("AC-04-012.2: architecture mounts all shared bands, live FRDs, orders and the route context", () => {
    published();
    write(".env.example", "# Delivery endpoint\nAPI_URL=\n");
    mount("architecture", "/projects/fixture-project/architecture");
    const report = screen.getByTestId("card-detail-architecture");
    expect(within(report).getByText("Stack y tecnologías")).toBeVisible();
    expect(within(report).getByText("Integraciones y operación")).toBeVisible();
    expect(within(report).getByText("Modelo de datos")).toBeVisible();
    expect(within(report).getByTestId("arch-env-block")).toHaveTextContent("API_URL");
    expect(within(report).getByTestId("arch-adrs")).toBeVisible();
    const tile = within(screen.getByTestId("arch-plan")).getAllByRole("img")[0];
    expect(tile).toHaveAccessibleName(/WO-01/);
    fireEvent.click(screen.getByRole("button", { name: "FRD-01 Live feature" }));
    expect(
      within(screen.getByRole("dialog")).getByRole("link", { name: "Ver work orders" }),
    ).toHaveAttribute("href", "/projects/fixture-project/observability?frd=FRD-01");
  });
  it("AC-04-012.4 AC-02-015.7: malformed models have one error; explicit none and missing remain distinct", () => {
    published();
    write("docs/product/data-model.json", "{ invalid");
    const view = mount("architecture");
    expect(screen.getAllByText("No se pudo leer el modelo de datos")).toHaveLength(1);
    view.unmount();
    write(
      "docs/product/data-model.json",
      '{"schemaVersion":1,"persistence":"none","entities":[],"relationships":[]}',
    );
    const none = mount("architecture");
    expect(
      screen.getByText("Este proyecto declara explícitamente que no usa base de datos."),
    ).toBeVisible();
    none.unmount();
    fs.unlinkSync(path.join(root, "docs/product/data-model.json"));
    mount("architecture");
    expect(
      screen.getByText(
        "Todavía no hay un modelo de datos publicado; queda visiblemente pendiente.",
      ),
    ).toBeVisible();
  });
  it.each([
    "spec",
    "architecture",
  ])("AC-04-013.5 AC-04-012.5: switching project resets %s modal state and artifacts", (tab) => {
    published();
    const view = mount(tab, `/portfolio/fixture-project/${tab}`);
    fireEvent.click(screen.getByRole("button", { name: "FRD-01 Live feature" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    const secondPath = path.join(root, "second");
    fs.mkdirSync(secondPath);
    const second = { ...item, name: "Second project", path: secondPath, stage: "product" as const };
    state.items = [item, second];
    view.rerender(
      <ProjectWorkspace
        item={second}
        selection={workspaceSelection({ tab })}
        navigationBaseHref={`/portfolio/second-project/${tab}`}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "FRD-01 Live feature" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Second project", level: 1 })).toBeVisible();
  });
  it("AC-04-014.2: malformed changes produce an unknown count and no badge", () => {
    write(".pandacorp/inbox/changes/broken.md", "---\nid: [\n---\n");
    const project = loadWorkspaceProject(item);
    expect(project.counts.openChanges).toBeNull();
    mount();
    expect(screen.getByRole("tab", { name: "Cambios" })).toBeVisible();
    expect(screen.queryByText("cambios abiertos")).toBeNull();
  });
  it.each([
    "product",
    "design",
    "architecture",
    "implementation",
    "release",
  ] as const)("AC-04-012.3: standalone architecture resolves %s projects", async (phase) => {
    item = { ...item, stage: phase };
    state.items = [item];
    const element = await ProjectWorkspacePage({
      params: Promise.resolve({ slug: "fixture-project" }),
      searchParams: Promise.resolve({}),
      routeState: { project: "fixture-project", tab: "architecture" },
      requestHref: "/projects/fixture-project/architecture",
    });
    render(element);
    expect(screen.getByRole("tab", { name: "Arquitectura" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("heading", { name: "Fixture project", level: 1 })).toBeVisible();
  });
  it("AC-04-012.3: canonical standalone architecture queries redirect before interactive mounting", async () => {
    try {
      await ProjectWorkspacePage({
        params: Promise.resolve({ slug: "fixture-project" }),
        searchParams: Promise.resolve({ tab: "architecture" }),
      });
      throw new Error("Expected a canonical redirect");
    } catch (error) {
      expect(error).toHaveProperty(
        "digest",
        expect.stringContaining("/projects/fixture-project/architecture"),
      );
    }
    expect(parseNavigationUrl("/projects/fixture-project/architecture")).toMatchObject({
      project: "fixture-project",
      tab: "architecture",
    });
  });
  it.each([
    [false, undefined, "Sin construcción activa"],
    [true, "2026-10-31T11:59:00Z", "Construyendo"],
    [true, "2026-10-31T10:00:00Z", "Sin señal"],
  ] as const)("AC-04-014.1: build state is signal-backed (%s, %s)", (running, heartbeat, label) => {
    vi.stubEnv("MC_CLOCK", "2026-10-31T12:00:00Z");
    item = {
      ...item,
      running,
      status: {
        present: true,
        malformed: false,
        status: { phase: "implementation", running, supervisorHeartbeat: heartbeat },
      },
    };
    state.items = [item];
    mount();
    const hero = within(screen.getByTestId("project-hero"));
    expect(hero.getByText(label, { exact: false })).toBeVisible();
    expect(hero.getByText("Sin versión")).toBeVisible();
  });
  it("AC-04-014.1: no plan and no orders keep their drawn hero fallbacks", () => {
    for (const file of fs.readdirSync(path.join(root, "docs/frds/frd-01-x/work-orders")))
      fs.unlinkSync(path.join(root, "docs/frds/frd-01-x/work-orders", file));
    const summary = mount();
    expect(
      within(screen.getByTestId("project-hero")).getByText("Plan aún sin work orders"),
    ).toBeVisible();
    summary.unmount();
    mount("documents");
    expect(
      within(screen.getByTestId("project-hero-compact")).getByText("Sin work orders"),
    ).toBeVisible();
  });
  it("AC-04-012.2: architecture keeps env and ADR source failures explicit at the real mount", () => {
    published();
    fs.mkdirSync(path.join(root, ".env.example"));
    fs.unlinkSync(path.join(root, "docs/adr/ADR-0001-stack.md"));
    fs.mkdirSync(path.join(root, "docs/adr/ADR-0001-stack.md"));
    mount("architecture");
    expect(within(screen.getByTestId("arch-env-block")).getByRole("alert")).toHaveTextContent(
      /EISDIR|directory/i,
    );
    expect(within(screen.getByTestId("arch-adrs")).getByRole("alert")).toBeVisible();
  });
  it("AC-04-012.5: changing project clears the model search and selection on the new route", async () => {
    published();
    window.history.replaceState({}, "", "/projects/fixture-project/architecture");
    const view = mount("architecture", "/projects/fixture-project/architecture");
    await waitForLayout();
    const search = screen.getByRole("searchbox", { name: "Buscar entidad o atributo" });
    fireEvent.change(search, { target: { value: "no-matching-entity" } });
    expect(search).toHaveValue("no-matching-entity");
    const secondPath = path.join(root, "second");
    fs.mkdirSync(path.join(secondPath, "docs/product"), { recursive: true });
    fs.writeFileSync(
      path.join(secondPath, "docs/product/data-model.json"),
      JSON.stringify({
        schemaVersion: 1,
        persistence: "relational",
        entities: [
          {
            id: "second",
            name: "SecondModel",
            attributes: [{ id: "id", name: "id", type: "uuid", optional: false }],
          },
        ],
        relationships: [],
      }),
    );
    const second = { ...item, name: "Second project", path: secondPath };
    state.items = [item, second];
    act(() => {
      window.history.replaceState({}, "", "/projects/second-project/architecture");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    view.rerender(
      <ProjectWorkspace
        item={second}
        selection={workspaceSelection({ tab: "architecture" })}
        navigationBaseHref="/projects/second-project/architecture"
      />,
    );
    await waitForLayout();
    expect(screen.getByRole("searchbox", { name: "Buscar entidad o atributo" })).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Esquema" }));
    expect(await screen.findByText("SecondModel")).toBeVisible();
    expect(screen.queryByText("no-matching-entity")).toBeNull();
  });
});
