import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readCardProject } from "@/app/board/_utils/readCardProject";
import PortfolioPage from "@/app/portfolio/page";
import { parseNavigationUrl } from "@/lib/navigation/urls";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import { readSpecDigest } from "@/lib/spec/read-spec";
import { openStandalone } from "../../_tests/standaloneRoute";

const navigation = vi.hoisted(() => ({ push: vi.fn(), query: "" }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({
    push: navigation.push,
    replace: (href: string) => {
      window.history.replaceState({}, "", href);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
  }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

const projects: ProjectListItem[] = [];
const digests = new Map<string, string>();
vi.mock("@/lib/portfolio/portfolio", () => ({
  activeProjects: () => projects,
  allProjects: () => projects,
  readPortfolio: () => projects,
}));
vi.mock("@/lib/spec/read-spec", () => ({
  readSpecDigest: vi.fn((projectPath: string) => digests.get(projectPath) ?? null),
}));

let fixtureRoot: string;

function projectAt(index: number): ProjectListItem {
  const project = projects[index];
  if (project === undefined) throw new Error(`Missing fixture project ${index}`);
  return project;
}

function makeProject(name: string): ProjectListItem {
  return {
    name,
    path: path.join(fixtureRoot, name),
    exists: true,
    stage: "implementation",
    running: false,
    status: { present: false, malformed: false, status: null },
  };
}

function digest(name: string): string {
  return `---
proyecto: ${name}
fase: producto
---
> Vista del proyecto ${name}.

## 📋 PRD
### Usuarios
- **Usuario ${name}**: necesita una vista completa.

### Documentación
[Documento existente](docs/frds/frd-01-a/frd.md).
[Documento desconocido](docs/private.md).
[Referencia externa](https://example.com/reference).
[Sección local](#objetivo).

## 🔬 Research
### Referentes
- **Evidencia ${name}**: investigación visible.

## 🧩 FRDs
### FRD-01 · Función ${name} · UI
Resumen del FRD.
**Overview:** Detalle ${name}.
`;
}

beforeAll(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spec-workspace-review-"));
  projects.push(
    makeProject("First project"),
    makeProject("Selected project"),
    makeProject("Empty project"),
  );
  for (const project of projects) {
    fs.mkdirSync(project.path, { recursive: true });
  }
  for (const id of ["frd-01-a", "frd-02-b", "frd-03-c"]) {
    const folder = path.join(projectAt(1).path, "docs/frds", id);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, "frd.md"), "# Feature\n");
    fs.writeFileSync(path.join(folder, "blueprint.md"), "# Design\n");
  }
  digests.set(projectAt(0).path, digest("First narrative"));
  digests.set(projectAt(1).path, digest("Selected narrative"));
});

afterAll(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

beforeEach(() => {
  vi.clearAllMocks();
  navigation.query = "project=Selected+project&tab=work-orders&wo=WO-01-001&wotab=full&doc=stale";
});

describe("Spec workspace independent review", () => {
  it("shares the board's exact digest source and live folder-count input", async () => {
    const board = readCardProject({
      slug: "selected",
      title: "Selected project",
      status: "in-pipeline",
      body: "",
      project: projectAt(1).path,
    });
    expect(board.specContent).toBe(digests.get(projectAt(1).path));
    expect(board.frdCount).toBe(3);
    render(await openStandalone("/projects/selected-project?tab=spec"));
    // The bundle also reads the digest for FRD detail: the count may move, the source may not.
    expect(new Set(vi.mocked(readSpecDigest).mock.calls.map(([path]) => path))).toEqual(
      new Set([projectAt(1).path]),
    );
    expect(screen.getByRole("article", { name: "Resumen del spec" })).toHaveTextContent(
      `FRDs · las piezas del v1 (${board.frdCount})`,
    );
  });

  it("opens the selected Portfolio project's full digest and counts real FRD folders, not narrative cards or docs", async () => {
    const { rerender } = render(
      await PortfolioPage({
        searchParams: Promise.resolve({ project: "Selected project", tab: "spec" }),
      }),
    );
    expect(screen.getByTestId("workspace-page")).toHaveAttribute("data-slug", "selected-project");
    expect(screen.getByRole("tab", { name: "Spec" })).toHaveAttribute("aria-selected", "true");
    const article = screen.getByRole("article", { name: "Resumen del spec" });
    expect(
      within(article).getByRole("heading", { name: "Selected narrative" }),
    ).toBeInTheDocument();
    expect(within(article).getByText("Usuario Selected narrative")).toBeInTheDocument();
    expect(within(article).getByText("Evidencia Selected narrative")).toBeInTheDocument();
    expect(within(article).getByText(/FRDs · las piezas del v1 \(3\)/)).toBeInTheDocument();
    expect(article).not.toHaveTextContent("First narrative");
    expect(readSpecDigest).toHaveBeenCalledWith(projectAt(1).path);
    expect(readSpecDigest).not.toHaveBeenCalledWith(projectAt(0).path);
    fireEvent.click(within(article).getAllByRole("button", { name: /Feature/ })[0] as HTMLElement);
    expect(screen.getByRole("dialog")).toHaveTextContent("Detalle Selected narrative");
    rerender(
      await PortfolioPage({
        searchParams: Promise.resolve({ project: "First project", tab: "spec" }),
      }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("article", { name: "Resumen del spec" })).not.toHaveTextContent(
      "Selected narrative",
    );
  });

  it("scopes Spec document links to the selected project and neutralizes unknown paths", async () => {
    render(
      await PortfolioPage({
        searchParams: Promise.resolve({ project: "Selected project", tab: "spec" }),
      }),
    );
    const article = screen.getByRole("article", { name: "Resumen del spec" });
    const link = within(article).getByRole("link", { name: "Documento existente" });
    const query = parseNavigationUrl(link.getAttribute("href") ?? "");
    expect(query.project).toBe("selected-project");
    expect(query.tab).toBe("documents");
    expect(query.doc).toBe("docs/frds/frd-01-a/frd");
    expect(link).not.toHaveAttribute("target", "_blank");
    expect(within(article).queryByRole("link", { name: "Documento desconocido" })).toBeNull();
    expect(within(article).getByText("Documento desconocido")).toBeInTheDocument();
    expect(within(article).getByRole("link", { name: "Referencia externa" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(within(article).getByRole("link", { name: "Sección local" })).toHaveAttribute(
      "href",
      "#objetivo",
    );
  });

  it("accepts tab=spec on a standalone project slug and uses the same digest component", async () => {
    render(await openStandalone("/projects/selected-project?tab=spec"));
    expect(screen.getByTestId("card-detail-spec")).toHaveTextContent("Selected narrative");
    expect(screen.getByRole("tab", { name: "Spec" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows an honest empty Spec without falling back to another project's digest", async () => {
    render(
      await PortfolioPage({
        searchParams: Promise.resolve({ project: "Empty project", tab: "spec" }),
      }),
    );
    expect(screen.getByTestId("workspace-page")).toHaveAttribute("data-slug", "empty-project");
    expect(screen.getByRole("tab", { name: "Spec" })).toHaveAttribute("aria-selected", "true");
    const body = screen.getByTestId("workspace-tab-body");
    expect(body.textContent?.trim().length).toBeGreaterThan(0);
    expect(body).not.toHaveTextContent("First narrative");
    expect(body).not.toHaveTextContent("Selected narrative");
    expect(body).toHaveTextContent("El spec todavía no está publicado.");
    expect(body).toHaveTextContent("Su PRD y sus FRDs reales siguen disponibles.");
    expect(new Set(vi.mocked(readSpecDigest).mock.calls.map(([file]) => file))).toEqual(
      new Set([projectAt(2).path]),
    );
  });

  it("switches to Spec while preserving project context and clearing stale tab detail", async () => {
    render(await openStandalone("/projects/selected-project?tab=commands"));
    fireEvent.click(screen.getByRole("tab", { name: "Spec" }));
    const next = parseNavigationUrl(navigation.push.mock.calls[0]?.[0] ?? "/");
    expect(next.project).toBe("selected-project");
    expect(next.tab).toBe("spec");
    for (const stale of ["wo", "wotab", "doc"]) expect(next[stale]).toBeUndefined();
  });

  it("keeps Summary as the default and does not read Spec eagerly", async () => {
    render(await openStandalone("/projects/selected-project"));
    expect(screen.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByTestId("card-detail-spec")).toBeNull();
    expect(screen.queryByRole("article", { name: "Resumen del spec" })).toBeNull();
  });
});
