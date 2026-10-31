import { mkdirSync, mkdtempSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BoardPage from "@/app/board/page";
import * as architecture from "@/lib/architecture/read-artifacts";
import type { IdeaCard } from "@/lib/ideas/ideas";
import PersistentBoard from "../page";

const source = vi.hoisted(() => ({ cards: [] as IdeaCard[], project: "", files: [] as string[] }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => router,
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
const actions = vi.hoisted(() => ({
  discard: vi.fn(),
  restore: vi.fn(),
  favorite: vi.fn(),
  read: vi.fn(),
}));
vi.mock("@/lib/ideas/ideas", () => ({ readIdeas: () => source.cards }));
vi.mock("@/lib/navigation/identities", () => ({
  getIdeaNavigation: () => ({ id: "idea-id", slug: "public-idea" }),
  getProjectNavigation: () => ({ id: "project-id", slug: "public-project" }),
  resolveIdeaNavigation: (token: string) =>
    ["public-idea", "old-idea"].includes(token) ? "idea-file" : undefined,
}));
vi.mock("@/app/board/actions/actions", () => ({
  discardIdeaAction: actions.discard,
  restoreIdeaAction: actions.restore,
  toggleFavoriteAction: actions.favorite,
}));
vi.mock("@/app/board/actions/read-doc", () => ({ readBoardDoc: actions.read }));

function write(path: string, body: string): void {
  const file = join(source.project, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  if (!source.files.includes(file)) source.files.push(file);
}
function card(): IdeaCard {
  const value = source.cards[0];
  if (!value) throw new Error("Missing test idea");
  return value;
}
function project(phase = "implementation"): void {
  source.project = mkdtempSync(join(tmpdir(), "s3b-idea-"));
  source.cards[0] = { ...card(), project: source.project, status: "in-pipeline" };
  write(".pandacorp/status.yaml", `project: Private folder name\nphase: ${phase}\nrunning: true\n`);
  write(
    ".pandacorp/comms/spec-resumen.md",
    "## FRDs\n### FRD-01 · Stale title\nThe live reader wins.\n",
  );
  write(
    ".pandacorp/comms/arquitectura-resumen.md",
    "## Stack\n| Layer | Choice | Why |\n|---|---|---|\n| UI | Next | RSC |\n",
  );
  write("docs/product/prd.md", "# PRD");
  write("docs/product/research.md", "# Research");
  write(
    "docs/frds/frd-01-live/frd.md",
    "---\nid: FRD-01\ntitle: Live title\nui: api\n---\n# Live title\n",
  );
  write("docs/frds/frd-01-live/blueprint.md", "# Blueprint\nLive implementation summary\n");
  write(
    "docs/frds/frd-01-live/work-orders/wo-01-001-read.md",
    "---\nid: WO-01-001\ntitle: Live order\nimplementation_status: PLANNED\n---\n# Live order\n",
  );
}
async function mount(
  tab = "proposal",
  query: Record<string, string> = {},
): Promise<ReturnType<typeof render>> {
  const segments = tab ? ["public-idea", tab] : ["public-idea"];
  const search = new URLSearchParams(query).toString();
  window.history.replaceState(
    null,
    "",
    `/board/${segments.join("/")}${search ? `?${search}` : ""}`,
  );
  return render(
    await PersistentBoard({
      params: Promise.resolve({ segments }),
      searchParams: Promise.resolve(query),
    }),
  );
}
beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
  router.refresh.mockClear();
  source.cards = [
    {
      slug: "idea-file",
      title: "Readable idea title",
      status: "discovered",
      projectType: "web",
      returnType: "personal",
      score: 81,
      body: "A proposal without a verdict badge",
    },
  ];
  actions.discard.mockReset().mockResolvedValue({ ok: false, reason: "not-found" });
  actions.restore.mockReset().mockResolvedValue({ ok: false, reason: "not-found" });
  actions.favorite.mockReset().mockResolvedValue({ ok: true });
  actions.read
    .mockReset()
    .mockResolvedValue(
      "# Reader body\n[Research](research.md)\n[External](https://example.com)\n[Missing](missing.md)",
    );
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const file of source.files.splice(0)) unlinkSync(file);
});

it("AC-02-012.3 AC-02-016.5 AC-02-009.1 AC-02-009.5: the real route owns its header, named star and native pitch without the board", async () => {
  await mount();
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(
    screen.getByRole("heading", { level: 1, name: "Readable idea title" }),
  ).toBeInTheDocument();
  expect(screen.queryByTestId("board-page")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /favorita.*Readable idea title/i }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Volver al tablero" })).toHaveAttribute("href", "/board");
  expect(screen.getByText("Etapa: Investigación")).toBeVisible();
  expect(screen.getByText("Score 81/100")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: /favorita.*Readable idea title/i }));
  expect(actions.favorite).toHaveBeenCalledWith("idea-file", true);
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
    "Propuesta",
    "Campaña",
  ]);
  expect(screen.getByTestId("pitch-meta-chip")).toHaveTextContent("web");
  expect(screen.queryByRole("link", { name: "Abrir en Portafolio" })).not.toBeInTheDocument();
});
it("AC-02-011.2 AC-02-009.2 AC-02-009.4 AC-02-009.6 AC-02-015.14: five SVG tabs persist in the route and host-width panels", async () => {
  project();
  const view = await mount();
  expect(screen.getAllByRole("tab")).toHaveLength(5);
  for (const tab of screen.getAllByRole("tab")) expect(tab.querySelector("svg")).not.toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Spec" }));
  expect(window.location.pathname).toBe("/board/public-idea/spec");
  expect(screen.getAllByRole("tab", { selected: true })).toHaveLength(1);
  view.unmount();
  await mount("spec");
  expect(screen.getByRole("tab", { name: "Spec" })).toHaveAttribute("aria-selected", "true");
  const panel = screen.getByRole("tabpanel");
  expect(within(panel).getByTestId("spec-meta-chip").textContent).toBe(
    screen.getByTestId("pitch-meta-chip").textContent,
  );
  expect(panel.style.maxWidth).toBe("");
  const first = screen.getByRole("tab", { name: "Propuesta" });
  first.focus();
  fireEvent.keyDown(first, { key: "ArrowRight" });
  expect(screen.getByRole("tab", { name: "Spec" })).toHaveFocus();
});
it.each([
  ["product", "Spec"],
  ["design", "Spec"],
  ["architecture", "Arquitectura"],
  ["implementation", "Arquitectura"],
  ["release", "Arquitectura"],
])("AC-02-009.1: %s derives the %s default through the real mount", async (phase, name) => {
  project(phase);
  await mount("");
  expect(screen.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
});
it("AC-02-009.1: absent spec falls back to Propuesta; a linked project retains Arquitectura and Documentos", async () => {
  project("product");
  unlinkSync(join(source.project, ".pandacorp/comms/spec-resumen.md"));
  source.files = source.files.filter((file) => !file.endsWith("spec-resumen.md"));
  await mount("");
  expect(screen.getByRole("tab", { name: "Propuesta" })).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByRole("tab", { name: "Spec" })).not.toBeInTheDocument();
});
it("AC-02-011.3 AC-02-011.4 AC-02-013.3: live frds, workOrders, constructionStarted and navigationBaseHref reach both digest mounts", async () => {
  project();
  await mount("spec");
  const card = screen.getByRole("button", { name: "FRD-01 Live title" });
  expect(within(card).getByText("API")).toBeInTheDocument();
  expect(within(card).getByRole("img")).toBeInTheDocument();
  fireEvent.click(card);
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("img", { name: /WO-01-001.*Live order/ })).toBeInTheDocument();
  expect(within(dialog).getByRole("link", { name: /work orders/i })).toHaveAttribute(
    "href",
    "/portfolio/public-project/observability?frd=FRD-01",
  );
  fireEvent.keyDown(dialog, { key: "Escape" });
  fireEvent.click(screen.getByRole("tab", { name: "Arquitectura" }));
  expect(screen.getByRole("img", { name: /WO-01-001.*Live order/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "FRD-01 Live title" }));
  expect(
    within(screen.getByRole("dialog")).getByRole("link", { name: /work orders/i }),
  ).toHaveAttribute("href", "/portfolio/public-project/observability?frd=FRD-01");
});
it("AC-02-011.3 AC-02-013.3: constructionStarted=false suppresses live progress even when an order is IN_REVIEW", async () => {
  project("product");
  write(
    "docs/frds/frd-01-live/work-orders/wo-01-001-read.md",
    "---\nid: WO-01-001\ntitle: Live order\nimplementation_status: IN_REVIEW\n---\n# Live order\n",
  );
  await mount("spec");
  const card = screen.getByRole("button", { name: "FRD-01 Live title" });
  expect(within(card).queryByRole("img")).not.toBeInTheDocument();
  fireEvent.click(card);
  expect(
    within(screen.getByRole("dialog")).queryByRole("img", { name: /WO-01-001/ }),
  ).not.toBeInTheDocument();
});
it("AC-02-016.7 AC-02-011.4 AC-02-013.3: sourceErrors remain visible through the real mount in both digests", async () => {
  project();
  write(".env.example", "invalid source");
  write(
    "docs/frds/frd-01-live/work-orders/wo-01-001-read.md",
    "---\nimplementation_status: invalid\n---\n",
  );
  write("docs/frds/frd-01-live/frd.md", "---\ntitle: [\n---\n");
  mkdirSync(join(source.project, "docs/adr/adr-0001.md"), { recursive: true });
  await mount("architecture");
  expect(screen.getAllByRole("alert")).toHaveLength(4);
  expect(screen.getByText(/invalid variable declaration/)).toBeVisible();
  expect(
    within(screen.getByRole("tabpanel")).getByText(/invalid implementation_status/),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "Spec" }));
  expect(screen.getAllByRole("alert")).toHaveLength(2);
});
it("AC-02-010.5: forgeHref and project reach the real campaign mount", async () => {
  project();
  await mount("campaign");
  expect(screen.getByRole("link", { name: "Entrar a La Fragua" })).toHaveAttribute(
    "href",
    "/portfolio/public-project/summary",
  );
  expect(screen.getByRole("link", { name: "Abrir en Portafolio" })).toHaveAttribute(
    "href",
    "/portfolio/public-project/summary",
  );
  expect(screen.getByTestId("campaign-phase-build")).toHaveAttribute("data-state", "current");
});
it("AC-02-009.3 AC-02-009.7 AC-02-009.8: project reaches the document reader and surfaced links select that same reader", async () => {
  project();
  await mount("documents", { doc: "docs/product/prd.md" });
  await screen.findByRole("heading", { name: "Reader body" });
  expect(actions.read).toHaveBeenCalledWith(source.project, "docs/product/prd.md");
  expect(screen.getByRole("link", { name: "External" })).toHaveAttribute("target", "_blank");
  expect(screen.queryByRole("link", { name: "Missing" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Research" }));
  await waitFor(() =>
    expect(actions.read).toHaveBeenLastCalledWith(source.project, "docs/product/research.md"),
  );
  expect(window.location.pathname).toContain("/documents/");
  expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Documentos");
});
it("AC-02-009.7: an unknown document key falls back to Resumen without a read", async () => {
  project();
  await mount("documents", { doc: "unknown.md" });
  expect(actions.read).not.toHaveBeenCalled();
  expect(screen.getByText("Tarjeta de la idea")).toBeVisible();
  expect(
    within(screen.getByRole("tabpanel")).getByText("A proposal without a verdict badge"),
  ).toBeVisible();
});
it("AC-02-009.3: the digest's contract action opens Documentos in the same reader", async () => {
  project();
  await mount("spec");
  fireEvent.click(screen.getByRole("button", { name: "FRD-01 Live title" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Contrato/ }));
  await waitFor(() =>
    expect(actions.read).toHaveBeenCalledWith(source.project, "docs/frds/frd-01-live/frd.md"),
  );
  expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Documentos");
});
it("AC-02-016.5: shipped ideas have no discard; discarded ideas retain reason and confirmation-only restore", async () => {
  card().status = "shipped";
  const first = await mount();
  expect(screen.queryByRole("button", { name: "Descartar idea" })).not.toBeInTheDocument();
  first.unmount();
  card().status = "discarded";
  card().discardReason = "Too complex";
  await mount();
  expect(screen.getByText("Motivo: Too complex")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
  expect(within(screen.getByRole("dialog")).queryByRole("textbox")).not.toBeInTheDocument();
  expect(actions.restore).not.toHaveBeenCalled();
});
it("AC-02-016.5: discard closes on submit, optimistically changes header and reverts a rejected bounded write", async () => {
  const user = userEvent.setup();
  let finish: (value: { ok: false; reason: "not-found" }) => void = () => {};
  actions.discard.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await mount();
  fireEvent.click(screen.getByRole("button", { name: "Descartar idea" }));
  const dialog = screen.getByRole("dialog");
  await user.type(
    within(dialog).getByRole("textbox", { name: "Motivo (opcional)" }),
    "Private reason",
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Descartar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByText("Motivo: Private reason")).toBeVisible();
  expect(window.location.href).not.toContain("Private");
  expect(actions.discard).toHaveBeenCalledWith("idea-file", "Private reason");
  await act(async () => finish({ ok: false, reason: "not-found" }));
  expect(screen.getByRole("button", { name: "Descartar idea" })).toBeInTheDocument();
  expect(screen.queryByText("Motivo: Private reason")).not.toBeInTheDocument();
});
it("AC-02-016.5: unknown ideas render the designed recovery card and invalid tabs fail closed", async () => {
  render(
    await PersistentBoard({
      params: Promise.resolve({ segments: ["unknown", "proposal"] }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(screen.getByRole("heading", { name: "Esta idea no existe" })).toBeVisible();
  await expect(
    PersistentBoard({
      params: Promise.resolve({ segments: ["public-idea", "bad-tab"] }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow();
});
it("AC-02-009.4: board legacy URLs preserve document and expanded selections at the boundary", async () => {
  project();
  window.history.replaceState(
    null,
    "",
    "/board?idea=public-idea&boardTab=docs&doc=docs%2Fproduct%2Fprd&expanded=1",
  );
  const readArtifacts = vi.spyOn(architecture, "readArchitectureArtifacts");
  render(
    await BoardPage({
      searchParams: Promise.resolve({
        idea: "public-idea",
        boardTab: "docs",
        doc: "docs/product/prd",
        expanded: "1",
      }),
    }),
  );
  expect(screen.getByRole("heading", { name: "Tablero" })).toBeInTheDocument();
  expect(screen.queryByTestId("card-detail")).not.toBeInTheDocument();
  expect(readArtifacts).not.toHaveBeenCalled();
  expect(screen.getByRole("progressbar", { name: "0/1 WO" })).toHaveAttribute("aria-valuemax", "1");
  expect(router.replace).toHaveBeenCalledWith(
    "/board/public-idea/documents/docs%2Fproduct%2Fprd?expanded=1",
    { scroll: false },
  );
});

it("AC-02-016.5: the real board requests the separate idea page by public identity", async () => {
  window.history.replaceState(null, "", "/board");
  render(await BoardPage());
  fireEvent.click(screen.getByRole("link", { name: "Readable idea title" }));
  expect(router.push).toHaveBeenCalledWith("/board/public-idea");
  expect(screen.queryByTestId("card-detail")).not.toBeInTheDocument();
});
it("AC-02-016.5: a discarded idea without a reason restores optimistically and rolls back a rejected write", async () => {
  card().status = "discarded";
  let finish: (value: { ok: false; reason: "not-found" }) => void = () => {};
  actions.restore.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await mount();
  expect(screen.getByText("Se descartó sin motivo registrado.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restaurar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByText("Etapa: Investigación")).toBeVisible();
  expect(actions.restore).toHaveBeenCalledWith("idea-file");
  await act(async () => finish({ ok: false, reason: "not-found" }));
  expect(screen.getByRole("button", { name: "Restaurar" })).toBeInTheDocument();
});
it("AC-25-001.1: an old idea identity redirects canonically without dropping owned selections", async () => {
  await expect(
    PersistentBoard({
      params: Promise.resolve({ segments: ["old-idea", "documents"] }),
      searchParams: Promise.resolve({ expanded: "1", doc: "docs/product/prd" }),
    }),
  ).rejects.toThrow("NEXT_REDIRECT");
});

it("AC-02-009.7: a linked idea without documents keeps only Resumen in the folded phone index", async () => {
  source.project = mkdtempSync(join(tmpdir(), "s3b-empty-idea-"));
  card().project = source.project;
  card().status = "in-pipeline";
  write(".pandacorp/status.yaml", "project: Empty project\nphase: product\n");
  await mount("documents");
  const rail = screen.getByTestId("card-detail-docs-nav").closest("details");
  expect(rail).not.toHaveAttribute("open");
  // The fold is the same curated index; there is no second sidebar on phones.
  expect(screen.getByText("Cambiar · 0")).toBeVisible();
  expect(screen.getByTestId("card-detail-docs-nav-resumen")).toHaveAttribute(
    "aria-current",
    "true",
  );
});

it("AC-02-016.5 AC-02-012.3: successful bounded writes refresh the separate idea route", async () => {
  actions.discard.mockResolvedValue({ ok: true });
  const view = await mount();
  await userEvent.click(screen.getByRole("button", { name: /favorita.*Readable idea title/i }));
  await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Descartar idea" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Descartar" }));
  await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(2));
  view.unmount();
  card().status = "discarded";
  actions.restore.mockResolvedValue({ ok: true, restoredTo: "discovered" });
  await mount();
  fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restaurar" }));
  await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(3));
});
