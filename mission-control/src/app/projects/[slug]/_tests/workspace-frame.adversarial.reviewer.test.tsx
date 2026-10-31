/**
 * FRD-04 gate, WO-04-010 (DR-015, DR-080): builder-blind adversarial suite over the real standalone
 * route and readers. Only the portfolio entry list and the client router are boundaries.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "@/lib/copy/copy";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import { openStandalone } from "./standaloneRoute";

const state = vi.hoisted(() => ({ items: [] as ProjectListItem[] }));
vi.mock("@/lib/portfolio/portfolio", () => ({
  allProjects: () => state.items,
  readPortfolio: () => state.items,
}));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => window.location.pathname,
}));

const TAB_ORDER = [
  "Resumen",
  "Spec",
  "Observabilidad",
  "Arquitectura",
  "Cuentas",
  "Cambios",
  "Documentos",
  "Comandos",
];
let root: string;
function write(relative: string, content: string): void {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function project(status: ProjectListItem["status"]): void {
  state.items = [
    { name: "Frame fixture", path: root, exists: true, stage: "implementation", status },
  ];
}
function tabNames(): string[] {
  return screen.getAllByRole("tab").map((tab) => tab.getAttribute("data-testid") ?? "");
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-adversarial-"));
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  vi.stubEnv("PANDACORP_FACTORY_ROOT", root);
  project({
    present: true,
    malformed: false,
    status: { project: "Frame fixture", phase: "implementation" },
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("WO-04-010 route boundaries", () => {
  it.each([
    "/projects/frame-fixture/foo%20bar",
    "/projects/frame-fixture/a%2Fb",
    "/projects/frame-fixture/se%C3%B1al",
    "/projects/frame-fixture?tab=foo%20bar",
  ])("AC-25-008.1: unknown section %s settles on the unknown card, no redirect loop", async (href) => {
    render(await openStandalone(href));
    expect(screen.getByTestId("project-hero-compact")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-tab-body")).toBeInTheDocument();
  });

  it.each([
    ["/projects/frame-fixture?tab=party", "Resumen"],
    ["/projects/frame-fixture/party", "Resumen"],
    ["/projects/frame-fixture?tab=Work%20orders", "Observabilidad"],
    ["/projects/frame-fixture/work-orders", "Observabilidad"],
    ["/projects/frame-fixture/observabilidad", "Observabilidad"],
  ])("AC-12-006.4 AC-25-004.1: legacy link %s lands on %s", async (href, tab) => {
    render(await openStandalone(href));
    expect(screen.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
  });
});

describe("WO-04-010 frame contract", () => {
  it("AC-04-012.1 AC-04-014.1: eight ordered tabs, hero only on Resumen", async () => {
    render(await openStandalone("/projects/frame-fixture"));
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(TAB_ORDER);
    expect(tabNames()).not.toContain("tab-party");
    expect(screen.getByTestId("project-hero")).toBeInTheDocument();
    expect(screen.queryByTestId("project-hero-compact")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it.each([
    "spec",
    "observability",
    "architecture",
    "accounts",
    "changes",
    "documents",
    "commands",
  ])("AC-04-014.1: %s keeps the compact header and the switcher", async (tab) => {
    fs.writeFileSync(path.join(root, "docs/index.md"), "# Index\n");
    render(await openStandalone(`/projects/frame-fixture/${tab}`));
    const compact = screen.getByTestId("project-hero-compact");
    expect(screen.queryByTestId("project-hero")).toBeNull();
    expect(within(compact).getByRole("heading", { name: "Frame fixture" })).toBeInTheDocument();
    expect(
      within(compact).getByRole("button", { name: t("workspace.hero.switcher.label") }),
    ).toBeInTheDocument();
  });

  it("a malformed status.yaml keeps the frame with its no-version fallback", async () => {
    project({ present: true, malformed: true, status: {} });
    render(await openStandalone("/projects/frame-fixture"));
    expect(screen.getByTestId("project-hero")).toHaveTextContent("Sin versión");
  });

  it.each([
    [180, false],
    [181, true],
  ])("subtitle limit: %i characters, toggle %s", async (length, toggle) => {
    write(
      "factory/ideas/frame.md",
      `---\ntitle: Frame\nstatus: in-pipeline\nproject: ${root}\n---\n${"x".repeat(length)}\n`,
    );
    render(await openStandalone("/projects/frame-fixture"));
    expect(screen.queryByRole("button", { name: t("workspace.hero.subtitle.more") }) !== null).toBe(
      toggle,
    );
  });
});

describe("WO-04-010 digest mounts (DR-078)", () => {
  function brokenFrd(): void {
    write("docs/frds/frd-01-x/frd.md", "---\nid: [\n---\n# Broken\n");
  }
  function brokenOrder(): void {
    write("docs/frds/frd-01-x/frd.md", "---\nid: FRD-01\ntitle: Live\n---\n# Live\n");
    write("docs/frds/frd-01-x/work-orders/wo-01-001-a.md", "---\nid: [\n---\n# Broken\n");
  }
  it("AC-04-013.4: the two unpublished lines read in order when the project has no FRDs", async () => {
    render(await openStandalone("/projects/frame-fixture/spec"));
    const text = screen.getByTestId("workspace-tab-body").textContent ?? "";
    const first = text.indexOf("El spec todavía no está publicado.");
    const second = text.indexOf("Su PRD y sus FRDs reales siguen disponibles.");
    expect(first).toBeGreaterThanOrEqual(0);
    expect(second).toBeGreaterThan(first);
  });

  it("AC-04-013.4: the two unpublished lines read in order when the project has FRDs", async () => {
    write("docs/frds/frd-01-x/frd.md", "---\nid: FRD-01\ntitle: Live\n---\n# Live\n");
    render(await openStandalone("/projects/frame-fixture/spec"));
    const text = screen.getByTestId("workspace-tab-body").textContent ?? "";
    expect(text.indexOf("Su PRD y sus FRDs reales siguen disponibles.")).toBeGreaterThan(
      text.indexOf("El spec todavía no está publicado."),
    );
    expect(text).toContain("Live");
  });

  it("DR-078: a malformed FRD is visible on Spec, not an empty list", async () => {
    brokenFrd();
    render(await openStandalone("/projects/frame-fixture/spec"));
    expect(screen.getByTestId("workspace-tab-body").textContent).toMatch(
      /unexpected end of the stream/,
    );
  });

  it("DR-078: a malformed work order is visible on Spec and Arquitectura", async () => {
    brokenOrder();
    write(
      ".pandacorp/comms/arquitectura-resumen.md",
      "---\nproyecto: X\n---\n## Stack y tecnologías\n| Capa | Elección | Por qué |\n|---|---|---|\n| UI | Next.js | Shared |\n",
    );
    for (const tab of ["spec", "architecture"]) {
      const { unmount } = render(await openStandalone(`/projects/frame-fixture/${tab}`));
      expect(screen.getByTestId("workspace-tab-body").textContent).toMatch(
        /docs\/frds\/frd-01-x\/work-orders\/wo-01-001-a\.md: YAML malformado/,
      );
      unmount();
    }
  });
});
