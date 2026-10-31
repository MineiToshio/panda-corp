import fs from "node:fs";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import ResumenPanel from "../../../_panels/ResumenPanel";
import { ProjectHero } from "../../ProjectHero/ProjectHero";
import { FrdProgress } from "../FrdProgress";
import { summaryFixture } from "./summaryFixture";

const state = vi.hoisted(() => ({ items: [] as ProjectListItem[] }));
vi.mock("@/lib/portfolio/portfolio", () => ({
  allProjects: () => state.items,
  readPortfolio: () => state.items,
}));
class FakeEventSource {
  close() {}
}
let fixture: ReturnType<typeof summaryFixture>;
beforeEach(() => {
  fixture = summaryFixture();
  state.items = [fixture.item];
  vi.stubGlobal("EventSource", FakeEventSource);
});
afterEach(() => {
  fixture.cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Resumen composition", () => {
  it("AC-04-014.3 AC-06-020.1: mounts La Fragua from project facts before the copyable next step, without another main", () => {
    const project = {
      ...fixture.project(),
      counts: { ...fixture.project().counts, openChanges: 3 },
      lastMove: "2026-10-30T12:00:00Z",
    };
    render(
      <>
        <ProjectHero project={project} />
        <ResumenPanel project={project} route={fixture.route} />
      </>,
    );
    expect(screen.queryByRole("main")).toBeNull();
    expect(within(screen.getByTestId("project-hero")).getByText("0/1")).toBeVisible();
    expect(within(screen.getByTestId("project-hero")).getByText("cambios abiertos")).toBeVisible();
    expect(screen.getByRole("button", { name: "Copiar /pandacorp:implement" })).toBeVisible();
    expect(screen.getByText("La Fragua · Display Name")).toBeVisible();
    expect(screen.getByText("Falta 1")).toBeVisible();
    expect(screen.getByText("3 cambios abiertos")).toBeVisible();
    expect(screen.getByText(/Último movimiento/)).not.toHaveTextContent("sin registro");
    expect(
      screen
        .getByText("La Fragua · Display Name")
        .compareDocumentPosition(screen.getByText("Siguiente paso:")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen
        .getByText("La Fragua · Display Name")
        .compareDocumentPosition(screen.getByRole("heading", { name: "Avance por FRD 1" })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("El equipo descansa: no hay un build corriendo.")).toBeVisible();
  });
  it("AC-04-014.4: unfinished first, eight rows, shared titles, state alternatives, counts and filtered links", () => {
    const frds = Array.from({ length: 10 }, (_, i) => ({
      slug: `frd-${i + 1}-test`,
      code: `FRD-${String(i + 1).padStart(2, "0")}`,
      title: `Feature ${i + 1}`,
    }));
    render(
      <FrdProgress
        frds={frds}
        orders={[
          {
            id: "WO-01-001",
            title: "Done",
            frd: frds[0]?.slug ?? "",
            state: "done",
            relPath: "done.md",
          },
          {
            id: "WO-02-001",
            title: "Review",
            frd: frds[1]?.slug ?? "",
            state: "review",
            relPath: "review.md",
          },
        ]}
        navigationBaseHref="/projects/demo/summary"
      />,
    );
    const rows = within(screen.getByRole("list")).getAllByRole("link");
    expect(rows).toHaveLength(8);
    expect(rows[0]).toHaveTextContent("FRD-02 Feature 2");
    expect(rows[0]).toHaveTextContent("0/1");
    expect(rows[0]).toHaveAttribute("href", "/projects/demo/observability?frd=FRD-02");
    expect(screen.getByRole("img")).toHaveAccessibleName("1 En revisión");
    expect(screen.getByText("10 FRDs en total")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver todos" })).toHaveAttribute(
      "href",
      "/projects/demo/observability",
    );
  });
  it("AC-04-014.7: raw log is collapsed and never leaks prose into structured progress", () => {
    fixture.write(".pandacorp/comms/progress.md", "- Raw engine details\n");
    render(<ResumenPanel project={fixture.project()} route={fixture.route} />);
    const summary = screen.getByText("Bitácora técnica del motor");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Sin avances registrados todavía.")).toBeVisible();
    expect(screen.getByText("Raw engine details")).not.toBeVisible();
  });
  it("AC-04-014.4 AC-04-014.5 AC-04-014.7: errors stay in their owning cards, rather than claiming an empty source", () => {
    fixture.write(".pandacorp/inbox/decisions.md", "## malformed heading\n");
    fixture.write(".pandacorp/inbox/changes/bad.md", "---\ntype: nonsense\n---\n# Broken\n");
    render(<ResumenPanel project={fixture.project()} route={fixture.route} />);
    expect(
      screen.getAllByRole("alert").some((alert) => alert.textContent?.includes("Decisiones")),
    ).toBe(true);
    expect(
      screen.getAllByRole("alert").some((alert) => alert.textContent?.includes("Últimos avances")),
    ).toBe(true);
    expect(screen.queryByText("Sin decisiones tuyas registradas.")).toBeNull();
    expect(screen.queryByText("Sin avances registrados todavía.")).toBeNull();
  });
  it("AC-04-014.6: the single-column CSS puts Tu turno ahead of the informational column", () => {
    const css = fs.readFileSync(
      "src/app/projects/[slug]/_components/tab-summary/tab-summary.module.css",
      "utf8",
    );
    expect(css).toMatch(/max-width:\s*1023px/);
    expect(css).toMatch(/\.action\s*\{\s*order:\s*-1/);
  });
});

it("REQ-04-004: project queue shares the real pending count, stable command and age with La Fragua", () => {
  fixture.write(
    ".pandacorp/inbox/decisions.md",
    `# Decisions
## 2026-10-25 (PENDIENTE) — Choose hosting
- **Qué necesito de ti:** Choose a host
## 2026-10-26 (PENDIENTE) — Already decided
- **Estado:** RESUELTO
`,
  );
  render(<ResumenPanel project={fixture.project()} route={fixture.route} />);
  expect(screen.getByRole("heading", { name: "Tu turno 1" })).toBeVisible();
  expect(screen.getByText("Espera tu decisión")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Copiar /pandacorp:decide 2026-10-25-1" }),
  ).toBeVisible();
  expect(screen.getAllByText(/hace \d+ días/).length).toBeGreaterThan(0);
});

it("omits the FRD footer when all rows fit within the prototype's eight-row limit", () => {
  const frds = Array.from({ length: 8 }, (_, i) => ({
    slug: `frd-${i + 1}-test`,
    code: `FRD-${String(i + 1).padStart(2, "0")}`,
    title: `Feature ${i + 1}`,
  }));
  render(<FrdProgress frds={frds} orders={[]} navigationBaseHref="/projects/demo/summary" />);
  expect(screen.queryByRole("link", { name: "Ver todos" })).not.toBeInTheDocument();
});

it("DR-078: malformed source files are named beside valid FRD progress and recent changes", () => {
  const raw = fs.readFileSync(
    "src/lib/work-orders/_tests/fixtures/personal-page-invalid-order.md",
    "utf8",
  );
  fixture.write("docs/frds/frd-03-projects-case-studies/frd.md", "# FRD-03 Case studies\n");
  fixture.write("docs/frds/frd-03-projects-case-studies/work-orders/wo-03-002-broken.md", raw);
  fixture.write(
    ".pandacorp/inbox/changes/done/blog-cover-alt-field.md",
    fs.readFileSync("src/lib/work-orders/_tests/fixtures/personal-page-invalid-change.md", "utf8"),
  );
  fixture.write(
    ".pandacorp/inbox/changes/valid.md",
    "---\ntype: change\nstatus: ready\ndate: 2026-10-30\n---\n# Valid recent change\n",
  );
  const project = fixture.project();
  expect(project.progress.total).toBeNull();
  render(<ResumenPanel project={project} route={fixture.route} />);
  expect(
    screen
      .getAllByRole("alert")
      .some(
        (alert) =>
          alert.textContent?.includes("wo-03-002-broken.md") &&
          alert.textContent?.includes("YAML malformado"),
      ),
  ).toBe(true);
  expect(
    screen
      .getAllByRole("alert")
      .some((alert) => alert.textContent?.includes("blog-cover-alt-field.md")),
  ).toBe(true);
  expect(screen.getByRole("link", { name: /FRD-01 Reading/ })).toBeVisible();
  expect(screen.getByRole("link", { name: /Valid recent change/ })).toBeVisible();
  expect(screen.queryByText(/19\/25|76%/)).not.toBeInTheDocument();
});
