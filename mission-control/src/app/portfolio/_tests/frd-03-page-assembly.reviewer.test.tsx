/**
 * FRD-03 REVIEWER: adversarial assembly over the REAL PortfolioPage and the REAL overview resolver
 * (DR-015, DR-050). Only the portfolio source, git and the workspace mount are faked, so what is
 * asserted is the assembled surface: overview by default, every phase once, the designed states.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import type { StatusResult } from "@/lib/status/status";

const absent: StatusResult = { present: false, malformed: false, status: null };

function status(fields: Record<string, unknown>): StatusResult {
  return { present: true, malformed: false, status: fields as never };
}

function project(name: string, overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    name,
    path: `/p/${name}`,
    status: absent,
    exists: true,
    ...overrides,
  };
}

const NOW = "2026-10-30T12:00:00.000Z";
const mocks = vi.hoisted(() => ({
  items: [] as ProjectListItem[],
  commits: new Map<string, { at: string } | { at: null; reason: "unreadable" }>(),
}));

vi.mock("@/lib/portfolio/portfolio", () => ({ allProjects: () => mocks.items }));
vi.mock("@/lib/portfolio/lastCommit", () => ({
  getLastCommit: (projectPath: string) =>
    mocks.commits.get(projectPath) ?? { at: null, reason: "no-repository" },
}));
vi.mock("@/lib/clock/clock", () => ({ now: () => new Date(NOW) }));
vi.mock("@/lib/events/events", () => ({ readEvents: () => ({ events: [] }) }));
vi.mock("@/lib/services/services", async () => {
  const { servicesFixture } = await import("@/lib/services/_tests/fixture");
  return { getServicesDirectory: () => servicesFixture() };
});
vi.mock("@/app/projects/[slug]/ProjectWorkspace", async (actual) => ({
  ...(await actual<typeof import("@/app/projects/[slug]/ProjectWorkspace")>()),
  ProjectWorkspace: ({ item }: { item: { name: string } }) => <h1>{item.name} workspace</h1>,
}));
vi.mock("next/navigation", async (actual) => ({
  ...(await actual<typeof import("next/navigation")>()),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

import PortfolioPage from "../page";

async function renderPage(query: Record<string, string> = {}): Promise<void> {
  render(await PortfolioPage({ searchParams: Promise.resolve(query) }));
}

const cardTitles = (): (string | null)[] =>
  screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);

function card(name: string): HTMLElement {
  const found = screen.getByRole("heading", { level: 3, name }).closest(".proj-card");
  if (!(found instanceof HTMLElement)) throw new Error(`No card for ${name}`);
  return found;
}

afterEach(() => {
  cleanup();
  mocks.items = [];
  mocks.commits.clear();
  window.history.replaceState(null, "", "/");
});

describe("FRD-03 page assembly (reviewer)", () => {
  it("REQ-03-006: no selection shows the overview, never a default project's workspace", async () => {
    mocks.items = [project("alpha", { stage: "implementation" })];
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Portafolio" })).toBeVisible();
    expect(screen.queryByTestId("portfolio-page-workspace")).toBeNull();
    expect(screen.getByRole("button", { name: "Tarjetas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("REQ-03-001: every phase, and an unknown phase, is listed exactly once", async () => {
    const phases = ["product", "design", "architecture", "implementation", "release"] as const;
    mocks.items = [...phases.map((stage) => project(stage, { stage })), project("sin-fase")];
    await renderPage();
    expect(cardTitles().sort()).toEqual([...phases, "sin-fase"].sort());
    expect(within(card("sin-fase")).queryByText(/Etapa \d de 6/)).toBeNull();
    expect(within(card("product")).getByText(/Etapa 2 de 6 del pipeline/)).toBeVisible();
    expect(within(card("release")).getByText(/Etapa 6 de 6 del pipeline/)).toBeVisible();
  });

  it("REQ-03-002: a re-versioned project back in implementation shows Construcción and keeps its place", async () => {
    mocks.items = [
      project("newer", { stage: "release" }),
      project("reversioned", { stage: "implementation" }),
    ];
    mocks.commits.set("/p/newer", { at: "2026-10-30T11:00:00Z" });
    mocks.commits.set("/p/reversioned", { at: "2026-10-29T11:00:00Z" });
    await renderPage();
    expect(cardTitles()).toEqual(["newer", "reversioned"]);
    expect(within(card("reversioned")).getAllByText("Construcción")[0]).toBeVisible();
    expect(card("reversioned")).toHaveTextContent("Etapa 5 de 6 del pipeline");
  });

  it("AC-03-008.1: order is by instant, not by the text of mixed offsets; no date goes last", async () => {
    mocks.items = [
      project("undated", { stage: "design" }),
      project("text-later", { stage: "design" }),
      project("instant-later", { stage: "design" }),
    ];
    // Textually greater, but one hour EARLIER as an instant (LESSON-0009).
    mocks.commits.set("/p/text-later", { at: "2026-10-30T10:30:00+01:00" });
    mocks.commits.set("/p/instant-later", { at: "2026-10-30T10:00:00Z" });
    await renderPage();
    expect(cardTitles()).toEqual(["instant-later", "text-later", "undated"]);
  });

  it("REQ-03-003: Construyendo only while running with signal, Sin señal when stale, nothing when idle", async () => {
    mocks.items = [
      project("live", {
        stage: "implementation",
        running: true,
        status: status({ supervisorHeartbeat: "2026-10-30T11:59:00Z" }),
      }),
      project("stale", {
        stage: "implementation",
        running: true,
        status: status({ supervisorHeartbeat: "2026-10-30T09:00:00Z" }),
      }),
      project("idle", { stage: "implementation", running: false }),
    ];
    await renderPage();
    expect(within(card("live")).getByText("Construyendo")).toBeVisible();
    expect(within(card("stale")).queryByText("Construyendo")).toBeNull();
    expect(within(card("stale")).getByText(/Sin señal/)).toBeVisible();
    expect(within(card("idle")).queryByText("Construyendo")).toBeNull();
    expect(within(card("idle")).queryByText(/Sin señal/)).toBeNull();
    expect(within(card("idle")).queryByText(/detenid/i)).toBeNull();
  });

  it("REQ-03-005: an explicit project opens its workspace with no overview chrome", async () => {
    mocks.items = [
      project("alpha", { stage: "implementation" }),
      project("beta", { stage: "design" }),
    ];
    await renderPage({ project: "beta" });
    expect(screen.getByRole("heading", { level: 1, name: "beta workspace" })).toBeVisible();
    expect(screen.queryByTestId("portfolio-overview")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Portafolio" })).toBeNull();
  });

  it("an unknown project and an unsupported view are bounded 404s, never the first project", async () => {
    mocks.items = [project("alpha", { stage: "implementation" })];
    await expect(renderPage({ project: "does-not-exist" })).rejects.toThrow("404");
    await expect(renderPage({ view: "kanban" })).rejects.toThrow("404");
  });

  it("factory-empty: first-action card in Tarjetas and Lista; Cuentas opens from the URL", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { name: /todavía no tiene proyectos/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cuentas" })).toBeVisible();
    expect(screen.getByTestId("portfolio-overview")).toHaveTextContent("/pandacorp:new-idea");
    cleanup();
    window.history.replaceState(null, "", "/portfolio?view=cuentas");
    await renderPage({ view: "cuentas" });
    expect(screen.getByRole("table", { name: "Cuentas de la fábrica" })).toBeVisible();
  });

  it("AC-03-008.2: the Decisiones column equals the live count; a missing folder is unknown, not 0", async () => {
    window.history.replaceState(null, "", "/portfolio?view=lista");
    mocks.items = [
      project("alpha", { stage: "implementation", status: status({ pendingDecisions: 7 }) }),
      project("gone", { stage: "release", exists: false }),
    ];
    await renderPage({ view: "lista" });
    const table = screen.getByRole("table", { name: "Comparativa de proyectos" });
    const cells = [...table.querySelectorAll('td[data-label="Decisiones"]')].map(
      (cell) => cell.textContent,
    );
    expect(cells).toEqual(["7", "—"]);
  });

  it("no business snapshot, rail row or last-sync chip survives on a launched project", async () => {
    mocks.items = [
      {
        ...project("shipped", { stage: "release" }),
        // Fields the reader no longer carries: a stray copy must still render nothing.
        lastSync: "2026-06-15",
        snapshot: { users: "742", returnMetric: "$1 900 MRR", verdict: "double-down" },
      } as ProjectListItem,
    ];
    await renderPage();
    expect(screen.queryByText("$1 900 MRR")).toBeNull();
    expect(screen.queryByText("double-down")).toBeNull();
    expect(screen.queryByText("2026-06-15")).toBeNull();
    expect(screen.queryByTestId("selectable-project-row")).toBeNull();
  });
});

describe("FRD-03 missing project folder (reviewer)", () => {
  const gone = (repo?: string): ProjectListItem =>
    project("gone", { stage: "architecture", exists: false, repo });

  it("edge case: the chip and recovery commands appear with the rest of its card intact", async () => {
    mocks.items = [gone("https://example.com/gone.git")];
    await renderPage();
    const missing = card("gone");
    expect(within(missing).getByText("Ruta no encontrada")).toBeVisible();
    expect(missing).toHaveTextContent("git clone https://example.com/gone.git /p/gone");
    expect(missing).toHaveTextContent("/pandacorp:sync-portfolio");
    expect(within(missing).getByRole("list", { name: /Arquitectura/ })).toBeVisible();
    expect(within(missing).getByText(/Etapa 4 de 6 del pipeline/)).toBeVisible();
  });

  it("no repo: no clone command and no invented no-remote warning", async () => {
    mocks.items = [gone()];
    await renderPage();
    const missing = card("gone");
    expect(within(missing).getByText("Ruta no encontrada")).toBeVisible();
    expect(within(missing).queryByText(/git clone/)).toBeNull();
    expect(within(missing).queryByText(/Sin remoto registrado/)).toBeNull();
  });

  it("the chip disappears once the folder exists again", async () => {
    mocks.items = [project("back", { stage: "architecture", exists: true })];
    await renderPage();
    expect(screen.queryByText("Ruta no encontrada")).toBeNull();
  });
});
