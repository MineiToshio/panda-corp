/**
 * WO-02-016 gate suite (reviewer, DR-015/DR-080): the idea route over a real factory on disk.
 * Only the framework seams are faked (router, revalidatePath): readers, identities, digests and the
 * bounded Server Actions are the production ones, so the source-error and mount-debt contracts
 * (DR-078, AC-02-010.5, AC-02-011.3, AC-02-011.4, AC-02-013.3, AC-02-016.7) are proven end to end.
 */

import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import matter from "gray-matter";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PersistentBoard from "@/app/board/[...segments]/page";
import { idea, mountIdea, project, put, resetFactory } from "./ideaRouteFixture";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => router,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const previousRoot = process.env.PANDACORP_FACTORY_ROOT;
const root = mkdtempSync(join(tmpdir(), "frd02-idea-route-"));
process.env.PANDACORP_FACTORY_ROOT = root;

const linked = 'title: Idea demo\nstatus: in-pipeline\nproject: "demo"\nproject_type: web';
const panel = () => screen.getByRole("tabpanel");
const selected = () => screen.getByRole("tab", { selected: true });

beforeEach(() => {
  resetFactory();
  router.push.mockClear();
  router.replace.mockClear();
  router.refresh.mockClear();
});
afterEach(cleanup);
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  process.env.PANDACORP_FACTORY_ROOT = previousRoot;
});

describe("DR-078: an unreadable source is an error at the mount, never an empty list", () => {
  it.each([
    [
      "an ADR that cannot be read",
      () => mkdirSync(join(root, "demo/docs/adr/ADR-0001-x.md"), { recursive: true }),
      /EISDIR/,
    ],
    ["an ADR folder that is a file", () => put("demo/docs/adr", "not a folder"), /ENOTDIR/],
    [
      "an .env.example that cannot be read",
      () => mkdirSync(join(root, "demo/.env.example")),
      /EISDIR/,
    ],
    ["a malformed .env.example", () => put("demo/.env.example", "no es env"), /invalid variable/],
    [
      "a work order with a broken frontmatter",
      () => put("demo/docs/frds/frd-01-live/work-orders/wo-01-002-x.md", "---\ntitle: [\n---\n"),
      /./,
    ],
    [
      "a work order with an unknown state",
      () =>
        put(
          "demo/docs/frds/frd-01-live/work-orders/wo-01-002-x.md",
          "---\nimplementation_status: LISTO\n---\n",
        ),
      /wo-01-002-x\.md: implementation_status no es PLANNED, IN_PROGRESS, IN_REVIEW, VERIFIED ni BLOCKED/,
    ],
    [
      "a work-orders folder that is a file",
      () => {
        rmSync(join(root, "demo/docs/frds/frd-01-live/work-orders"), { recursive: true });
        put("demo/docs/frds/frd-01-live/work-orders", "not a folder");
      },
      /ENOTDIR/,
    ],
  ])("Arquitectura names %s", async (_name, breakSource, message) => {
    idea("demo", linked);
    project();
    breakSource();
    await mountIdea("demo/architecture");
    const alerts = within(panel()).getAllByRole("alert");
    expect(alerts.map((alert) => alert.textContent).join(" ")).toMatch(message);
  });

  it("Spec names a broken order and a broken FRD before any architecture exists", async () => {
    idea("demo", linked);
    project("product");
    unlinkSync(join(root, "demo/.pandacorp/comms/arquitectura-resumen.md"));
    put(
      "demo/docs/frds/frd-01-live/work-orders/wo-01-002-x.md",
      "---\nimplementation_status: LISTO\n---\n",
    );
    put("demo/docs/frds/frd-02-rota/frd.md", "---\ntitle: [\n---\n");
    await mountIdea("demo/spec");
    const alerts = within(panel()).getAllByRole("alert");
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect(alerts.map((alert) => alert.textContent).join(" ")).toContain(
      "wo-01-002-x.md: implementation_status no es PLANNED",
    );
  });

  it("a healthy project shows no source alert (the alerts are not decorative)", async () => {
    idea("demo", linked);
    project();
    await mountIdea("demo/architecture");
    expect(within(panel()).queryAllByRole("alert")).toHaveLength(0);
  });

  it("a malformed status.yaml keeps the page standing on the research fallback (AC-02-010.2)", async () => {
    idea("demo", linked);
    project();
    put("demo/.pandacorp/status.yaml", "phase: [unclosed\n  running: {\n");
    await mountIdea("demo/campaign");
    expect(screen.getByTestId("campaign-phase-research")).toHaveAttribute(
      "data-phase-state",
      "current",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Idea demo" })).toBeInTheDocument();
  });
});

describe("mount wiring (AC-02-010.5, AC-02-011.3, AC-02-011.4, AC-02-013.3, AC-02-016.7)", () => {
  it("AC-02-010.5: the reached build sheet links the canonical Resumen, never the party alias", async () => {
    idea("demo", linked);
    project("implementation");
    await mountIdea("demo/campaign");
    expect(screen.getByRole("link", { name: "Entrar a La Fragua" })).toHaveAttribute(
      "href",
      "/portfolio/demo-publica/summary",
    );
  });

  it("AC-02-010.5: a build phase not reached has no action, and its sheet stays readable", async () => {
    idea("demo", linked);
    project("design");
    await mountIdea("demo/campaign");
    fireEvent.click(screen.getByTestId("campaign-phase-build"));
    expect(screen.queryByRole("link", { name: "Entrar a La Fragua" })).toBeNull();
    expect(screen.getAllByTestId("ficha-team-member").length).toBeGreaterThan(0);
  });

  it("FRD edge case: a shipped card keeps the forge link in its build sheet", async () => {
    idea("demo", 'title: Idea demo\nstatus: shipped\nproject: "demo"');
    project("release");
    await mountIdea("demo/campaign");
    expect(screen.getByTestId("campaign-phase-release")).toHaveAttribute(
      "data-phase-state",
      "current",
    );
    fireEvent.click(screen.getByTestId("campaign-phase-build"));
    expect(screen.getByRole("link", { name: "Entrar a La Fragua" })).toHaveAttribute(
      "href",
      "/portfolio/demo-publica/summary",
    );
  });

  it("AC-02-011.3 AC-02-016.7: the live FRD card opens whole, tagged, with progress once building", async () => {
    idea("demo", linked);
    project("implementation");
    await mountIdea("demo/spec");
    const frd = screen.getByRole("button", { name: "FRD-01 Live" });
    expect(within(frd).getByText("UI")).toBeInTheDocument();
    expect(within(frd).getByRole("img")).toBeInTheDocument();
    expect(screen.queryByText(/Título rancio/)).toBeNull();
    fireEvent.click(frd);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /Contrato/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Blueprint/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /work orders/i })).toHaveAttribute(
      "href",
      "/portfolio/demo-publica/observability?frd=FRD-01",
    );
  });

  it.each([
    "product",
    "design",
    "architecture",
  ])("AC-02-013.3 AC-02-016.7: at %s a planned count replaces any live state", async (phase) => {
    idea("demo", linked);
    project(phase);
    await mountIdea("demo/architecture");
    expect(within(panel()).getAllByText("1 work order planificada")[0]).toBeInTheDocument();
    expect(within(panel()).queryByRole("img", { name: /WO-01-001/ })).toBeNull();
  });

  it.each([
    "implementation",
    "release",
  ])("AC-02-013.3: at %s the mosaic reads the live frontmatter", async (phase) => {
    idea("demo", linked);
    project(phase);
    await mountIdea("demo/architecture");
    const mosaic = within(within(panel()).getByTestId("arch-plan"));
    expect(mosaic.getByRole("img", { name: /WO-01-001/ })).toBeInTheDocument();
    expect(within(panel()).queryByText("1 work order planificada")).toBeNull();
  });

  it("AC-02-013.1: a linked project with no architecture says so instead of hiding the tab", async () => {
    idea("demo", linked);
    project("product", { digests: false });
    await mountIdea("demo/architecture");
    expect(selected()).toHaveTextContent("Arquitectura");
    expect(within(panel()).getByText("La arquitectura todavía no está publicada.")).toBeVisible();
  });

  it("a stale linked project keeps the page and its tabs without a source to read", async () => {
    idea("demo", linked);
    await mountIdea("demo");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Propuesta",
      "Arquitectura",
      "Documentos0",
      "Campaña",
    ]);
  });
});

describe("REQ-02-007, REQ-02-008, REQ-02-018: the bounded writes from the real header", () => {
  it("discard writes status, reason and the prior status, leaves the body and refreshes the route", async () => {
    const user = userEvent.setup();
    const file = idea("sola", "title: Sola\nstatus: recommended\nscore: 40", "Cuerpo intacto.");
    await mountIdea("sola/proposal");
    await user.click(screen.getByRole("button", { name: "Descartar idea" }));
    const dialog = screen.getByRole("dialog", { name: "Descartar idea" });
    expect(within(dialog).getByText("Confirmar")).toBeInTheDocument();
    expect(within(dialog).getByText(/«Sola».*Podrás restaurarla después\./)).toBeInTheDocument();
    const reason = within(dialog).getByRole("textbox", { name: "Motivo (opcional)" });
    expect(reason).toHaveAttribute("placeholder", "Por qué…");
    await user.type(reason, "  mercado lleno  ");
    await user.click(within(dialog).getByRole("button", { name: "Descartar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    const after = matter(readFileSync(file, "utf8"), { excerpt: false });
    expect(after.data).toMatchObject({
      status: "discarded",
      discard_reason: "mercado lleno",
      status_before_discard: "recommended",
      score: 40,
    });
    expect(after.content.trim()).toBe("Cuerpo intacto.");
    expect(window.location.href).not.toContain("mercado");
  });

  it("a blank reason writes status alone (the reason is optional)", async () => {
    const user = userEvent.setup();
    const file = idea("sola", "title: Sola\nstatus: discovered");
    await mountIdea("sola/proposal");
    await user.click(screen.getByRole("button", { name: "Descartar idea" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "   ");
    await user.click(within(dialog).getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    const data = matter(readFileSync(file, "utf8"), { excerpt: false }).data;
    expect(data.status).toBe("discarded");
    expect(data).not.toHaveProperty("discard_reason");
  });

  it("Cancelar and Escape write nothing", async () => {
    const user = userEvent.setup();
    const file = idea("sola", "title: Sola\nstatus: discovered");
    const before = readFileSync(file, "utf8");
    await mountIdea("sola/proposal");
    await user.click(screen.getByRole("button", { name: "Descartar idea" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Descartar idea" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it("restore takes no reason and returns the exact prior status, clearing the discard fields", async () => {
    const user = userEvent.setup();
    const file = idea(
      "demo",
      'title: Idea demo\nstatus: discarded\nstatus_before_discard: in-pipeline\ndiscard_reason: caro\nproject: "demo"',
    );
    project("architecture");
    await mountIdea("demo/proposal");
    expect(screen.getByText("Descartada")).toBeInTheDocument();
    expect(screen.getByText("Motivo: caro")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restaurar" }));
    const dialog = screen.getByRole("dialog", { name: "Restaurar idea" });
    expect(within(dialog).queryByRole("textbox")).toBeNull();
    expect(within(dialog).getByText(/«Idea demo».*su columna del tablero/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Restaurar" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    const data = matter(readFileSync(file, "utf8"), { excerpt: false }).data;
    expect(data.status).toBe("in-pipeline");
    expect(data).not.toHaveProperty("discard_reason");
    expect(data).not.toHaveProperty("status_before_discard");
  });

  it("a shipped idea offers no discard, whatever its project reports", async () => {
    idea("demo", 'title: Idea demo\nstatus: shipped\nproject: "demo"');
    project("release");
    await mountIdea("demo/proposal");
    expect(screen.queryByRole("button", { name: "Descartar idea" })).toBeNull();
    expect(screen.getByRole("link", { name: "Abrir en Portafolio" })).toBeInTheDocument();
  });

  it("REQ-02-018: a discarded idea keeps its whole documentation and every project tab", async () => {
    idea("demo", 'title: Idea demo\nstatus: discarded\nproject: "demo"');
    project("architecture");
    await mountIdea("demo/documents");
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByText("Se descartó sin motivo registrado.")).toBeInTheDocument();
    expect(screen.getAllByTestId("card-detail-docs-nav-item").length).toBe(4);
    expect(screen.queryByRole("button", { name: "Descartar idea" })).toBeNull();
  });

  it("the header star writes only the favourite flag and names the idea (AC-02-012.1, AC-02-012.3)", async () => {
    const user = userEvent.setup();
    const file = idea("sola", "title: Sola\nstatus: discovered");
    await mountIdea("sola");
    await user.click(screen.getByRole("button", { name: "Marcar como favorita: Sola" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    const data = matter(readFileSync(file, "utf8"), { excerpt: false }).data;
    expect(data).toEqual({ title: "Sola", status: "discovered", favorite: true });
  });
});

const PRD_SEGMENT = encodeURIComponent("docs/product/prd.md");

describe("REQ-02-009: Documentos through the real reader", () => {
  it("a relative link selects the surfaced document; unknown ones stay plain text", async () => {
    const user = userEvent.setup();
    idea("demo", linked);
    project();
    await expect(mountIdea("demo/documents", { doc: "docs/product/prd.md" })).rejects.toMatchObject(
      {
        digest: `NEXT_REDIRECT;replace;/board/demo/documents/${PRD_SEGMENT};307;`,
      },
    );
    await mountIdea(`demo/documents/${PRD_SEGMENT}`);
    expect(await screen.findByRole("heading", { name: "PRD" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sin destino" })).toBeNull();
    expect(screen.getByText("Sin destino")).toBeInTheDocument();
    await user.click(
      within(screen.getByTestId("card-detail-doc-reader")).getByRole("button", {
        name: "Investigación",
      }),
    );
    expect(await screen.findByRole("heading", { name: "Research body" })).toBeInTheDocument();
    expect(selected()).toHaveTextContent("Documentos");
  });

  it("a traversal or out-of-scope key falls back to Resumen and reads nothing", async () => {
    put("demo/secret.md", "# Secreto");
    idea("demo", linked);
    project();
    await mountIdea(`demo/documents/${encodeURIComponent("../secret.md")}`);
    expect(screen.queryByText("Secreto")).toBeNull();
    expect(screen.getByText("Tarjeta de la idea")).toBeInTheDocument();
  });

  it("a surfaced document that cannot be read shows the reader's error, not an empty paper", async () => {
    idea("demo", linked);
    project();
    const file = join(root, "demo/docs/product/prd.md");
    chmodSync(file, 0o000);
    try {
      await mountIdea(`demo/documents/${PRD_SEGMENT}`);
      expect(await screen.findByText("No se pudo leer este documento.")).toBeInTheDocument();
    } finally {
      chmodSync(file, 0o644);
    }
  });

  it("a document that left the project falls back to Resumen", async () => {
    idea("demo", linked);
    project();
    unlinkSync(join(root, "demo/docs/product/prd.md"));
    await mountIdea(`demo/documents/${PRD_SEGMENT}`);
    expect(screen.getByText("Tarjeta de la idea")).toBeInTheDocument();
  });

  it("AC-02-009.7: building and release ideas add the command box, earlier stages do not", async () => {
    idea("demo", linked);
    project("implementation");
    const view = await mountIdea("demo/documents");
    expect(within(panel()).getByText("/pandacorp:iterate")).toBeInTheDocument();
    view.unmount();
    project("design");
    await mountIdea("demo/documents");
    expect(within(panel()).queryByText("/pandacorp:iterate")).toBeNull();
  });
});

describe("route boundaries", () => {
  it("a tab the idea does not offer falls back to the stage default and rewrites the URL", async () => {
    idea("sola", "title: Sola\nstatus: discovered");
    await mountIdea("sola/spec");
    expect(selected()).toHaveTextContent("Propuesta");
    expect(window.location.pathname).toBe("/board/sola/proposal");
  });

  it.each([
    ["a fourth segment", ["sola", "documents", "a", "b"]],
    ["a detail under another tab", ["sola", "spec", "a"]],
    ["an unknown tab", ["sola", "comandos"]],
  ])("%s is a 404", async (_name, segments) => {
    idea("sola", "title: Sola\nstatus: discovered");
    await expect(
      PersistentBoard({ params: Promise.resolve({ segments }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it.each(["no-existe", "..%2Fsecreto", "%00"])("%s renders the designed card", async (token) => {
    idea("sola", "title: Sola\nstatus: discovered");
    await mountIdea(token);
    expect(screen.getByTestId("idea-not-found")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Esta idea no existe" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Volver al tablero" })).toHaveAttribute(
      "href",
      "/board",
    );
  });

  it("a card filename that is not its public slug redirects keeping the selection", async () => {
    idea("Con_Mayus", "title: Otra\nstatus: discovered");
    await expect(
      PersistentBoard({
        params: Promise.resolve({ segments: ["Con_Mayus", "campaign"] }),
        searchParams: Promise.resolve({ phase: "design" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});
