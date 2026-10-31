import fs from "node:fs";
import path from "node:path";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT } from "@/components/modules/ProjectCard/_tests/fixture";
import { servicesFixture } from "@/lib/services/_tests/fixture";
import { PortfolioOverview } from "../PortfolioOverview";

beforeEach(() => window.history.replaceState(null, "", "/portfolio"));

describe("portfolio overview", () => {
  it("AC-03-008.3: an unknown change count names the read failure and links to its source", () => {
    window.history.replaceState(null, "", "/portfolio?view=lista");
    render(
      <PortfolioOverview
        projects={[{ ...PROJECT, counts: { ...PROJECT.counts, openChanges: null } }]}
        directory={servicesFixture()}
      />,
    );
    expect(screen.getByRole("link", { name: "No se pudo leer" })).toHaveAttribute(
      "href",
      `/portfolio/${PROJECT.id}/changes`,
    );
  });
  it("AC-03-008.2: Lista replaces cards, keeps URL and history, renders one labelled row with live decisions", async () => {
    const user = userEvent.setup();
    render(<PortfolioOverview projects={[PROJECT]} directory={servicesFixture()} />);
    expect(screen.getByRole("button", { name: "Tarjetas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Lista" }));
    expect(window.location.search).toBe("?view=lista");
    expect(screen.getByRole("button", { name: "Lista" })).toHaveAttribute("aria-pressed", "true");
    const table = screen.getByRole("table", { name: "Comparativa de proyectos" });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByRole("cell", { name: "4" })).toHaveAttribute(
      "data-label",
      "Decisiones",
    );
    expect(within(table).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    expect(document.querySelector(".proj-card")).toBeNull();
    act(() => {
      window.history.replaceState(null, "", "/portfolio");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".proj-card")).toHaveLength(1);
  });
  it("REQ-03-006 / U1: empty portfolio keeps Cuentas reachable", async () => {
    const user = userEvent.setup();
    render(<PortfolioOverview projects={[]} directory={servicesFixture()} />);
    expect(
      screen.getByRole("heading", { name: "Tu fábrica todavía no tiene proyectos" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cuentas" }));
    expect(screen.getByRole("table", { name: "Cuentas de la fábrica" })).toBeVisible();
    expect(screen.getByText("Directorio de cuentas de la fábrica")).toBeVisible();
    expect(window.location.search).toBe("?view=cuentas");
  });
  it("AC-03-008.2: the shared table uses a single DOM and its existing mobile breakpoint", () => {
    const css = fs.readFileSync(path.resolve("src/components/core/Table/Table.module.css"), "utf8");
    expect(css).toMatch(/max-width:\s*1023px/);
    expect(css).toContain("attr(data-label)");
  });
});

vi.mock("@/lib/portfolio/overview", () => ({ getProjectOverview: vi.fn() }));
vi.mock("@/lib/services/services", () => ({ getServicesDirectory: () => servicesFixture() }));
vi.mock("@/app/projects/[slug]/ProjectWorkspace", () => ({
  ProjectWorkspace: ({
    item,
    headingLevel,
    navigationBaseHref,
  }: {
    item: { name: string };
    headingLevel: number;
    navigationBaseHref: string;
  }) => (
    <section
      aria-label="Workspace"
      data-heading-level={headingLevel}
      data-base={navigationBaseHref}
    >
      {item.name}
    </section>
  ),
}));
vi.mock("@/app/projects/[slug]/workspace-route", () => ({
  workspaceSelection: () => ({ activeTab: "summary" }),
  workspaceHref: (_family: string, _params: unknown, id: string) => `/portfolio/${id}/summary`,
}));
vi.mock("@/lib/navigation/identities", () => ({
  resolveProjectNavigation: (id: string, items: { name: string }[]) =>
    id === "alpha" || id === "Alpha Project" ? items[0] : undefined,
}));
vi.mock("@/lib/navigation/NavigationCanonical", () => ({
  NavigationCanonical: ({ href }: { href: string }) => (
    <span data-testid="canonical" data-href={href} />
  ),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useParams: () => ({ segments: ["unknown-project"] }),
  useSearchParams: () => new URLSearchParams(),
}));

import { getProjectOverview } from "@/lib/portfolio/overview";
import PortfolioNotFound from "../not-found";
import { PortfolioContent as PortfolioPage } from "../PortfolioContent";

const page = (query = {}, routeState?: Record<string, string>) =>
  PortfolioPage({ searchParams: Promise.resolve(query), routeState });
beforeEach(() => vi.mocked(getProjectOverview).mockReturnValue([PROJECT]));

describe("portfolio page assembly", () => {
  it("REQ-03-006: root renders overview without selecting a workspace", async () => {
    render(await page());
    expect(screen.getByRole("heading", { level: 1, name: "Portafolio" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Workspace" })).not.toBeInTheDocument();
  });
  it.each([
    "tarjetas",
    "lista",
    "cuentas",
  ])("accepts view=%s on the server and hydration seed", async (view) => {
    window.history.replaceState(null, "", `/portfolio?view=${view}`);
    render(await page({ view }));
    expect(screen.getByTestId("canonical")).toHaveAttribute("data-href", `/portfolio?view=${view}`);
    if (view === "lista")
      expect(screen.getByRole("table", { name: "Comparativa de proyectos" })).toBeVisible();
    if (view === "cuentas")
      expect(screen.getByRole("table", { name: "Cuentas de la fábrica" })).toBeVisible();
  });
  it("REQ-03-005: explicit public identity mounts full-width workspace with no Portafolio heading", async () => {
    render(await page({}, { project: "alpha", tab: "summary" }));
    expect(screen.getByRole("region", { name: "Workspace" })).toHaveAttribute(
      "data-heading-level",
      "1",
    );
    expect(screen.queryByRole("heading", { name: "Portafolio" })).not.toBeInTheDocument();
    expect(screen.getByTestId("canonical")).toHaveAttribute(
      "data-href",
      "/portfolio/alpha/summary",
    );
  });
  it("keeps the server-resolved accounts view while the legacy URL hydrates, and supports Back", async () => {
    window.history.replaceState(null, "", "/portfolio?portfolioView=accounts");
    render(await page({ portfolioView: "accounts" }));
    expect(screen.getByRole("button", { name: "Cuentas" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("table", { name: "Cuentas de la fábrica" })).toBeVisible();
    act(() => {
      window.history.replaceState(null, "", "/portfolio");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("button", { name: "Tarjetas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("normalizes the legacy accounts and project URLs with replace through NavigationCanonical", async () => {
    const { unmount } = render(await page({ portfolioView: "accounts", keep: "yes" }));
    expect(screen.getByTestId("canonical").getAttribute("data-href")).toContain("view=cuentas");
    expect(screen.getByTestId("canonical").getAttribute("data-href")).not.toContain(
      "portfolioView",
    );
    unmount();
    render(await page({ project: "Alpha Project" }));
    expect(screen.getByTestId("canonical")).toHaveAttribute(
      "data-href",
      "/portfolio/alpha/summary",
    );
  });
  it("rejects unknown projects, repeated views and unsupported overview views with the 404 boundary", async () => {
    await expect(page({ project: "unknown" })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(page({ view: "unsupported" })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(page({ view: ["lista", "cuentas"] })).rejects.toThrow("NEXT_NOT_FOUND");
    render(<PortfolioNotFound />);
    expect(screen.getByRole("heading", { name: "Este proyecto no existe" })).toBeVisible();
    expect(screen.getByText("No hay ningún proyecto «unknown-project».")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver todos los proyectos" })).toHaveAttribute(
      "href",
      "/portfolio",
    );
  });
  it("AC-14-003.1 AC-14-003.2: production imports contain no retired rail, chips, snapshot or last-sync modules", () => {
    const root = path.resolve("src");
    const sources = fs
      .readdirSync(root, { recursive: true, withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() &&
          /\.(ts|tsx)$/.test(entry.name) &&
          !entry.parentPath.includes("_tests") &&
          !entry.parentPath.includes(`${path.sep}tests`),
      );
    const imports = sources.flatMap((entry) => {
      const file = path.join(entry.parentPath, entry.name);
      return [
        ...fs.readFileSync(file, "utf8").matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g),
      ].map((match) => ({ file, target: match[1] ?? "" }));
    });
    expect(
      imports.filter((item) =>
        /ProjectRail|SelectableProjectRail|PortfolioLayout|WorkspaceSlot|formatLastSync|PortfolioViews|status-chips|BusinessSnapshot|RecoveryHint|PortfolioEmpty/.test(
          item.target,
        ),
      ),
    ).toEqual([]);
    expect(fs.readFileSync(path.resolve("src/lib/portfolio/portfolio.ts"), "utf8")).not.toMatch(
      /export function railProjects/,
    );
  });
});
