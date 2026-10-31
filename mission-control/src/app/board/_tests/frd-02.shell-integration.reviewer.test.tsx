/**
 * FRD-02 — Ideas board — REVIEWER integration tests, PASS 2 (DR-015, DR-050 gate).
 *
 * The board and the idea are separate routes since WO-02-016, so the seam is now: the board asks
 * for the idea's public URL, and that URL mounts the idea over the same card the board routed.
 * Both halves run for real over a factory on disk.
 *
 * Adversarial angles:
 *   1. DR-062 / AC-02-009.1: the idea uses the SHARED Tabs primitive with its keyboard contract.
 *   2. AC-02-009.3/.4: a tab pick survives a re-render and a reload of the same URL.
 *   3. AC-02-010.2/.3/.7: phase coherence for shipped and stageless ideas.
 *   4. AC-02-002.1/AC-02-003: the board stays read-only and detail-free.
 *
 * EARS anchors: AC-02-002.1, AC-02-003.*, AC-02-009.1/.3/.4, AC-02-010.2/.3/.5/.7.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BoardPage from "@/app/board/page";
import { idea, mountIdea, project, resetFactory } from "./ideaRouteFixture";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => router,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const previousRoot = process.env.PANDACORP_FACTORY_ROOT;
const root = mkdtempSync(join(tmpdir(), "frd02-shell-"));
process.env.PANDACORP_FACTORY_ROOT = root;

const TRACKER =
  "title: Tracker de Funkos\nstatus: discovered\nproject_type: web\nreturn_type: mixed";

beforeEach(() => {
  resetFactory();
  router.push.mockClear();
  router.replace.mockClear();
});
afterEach(cleanup);
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  process.env.PANDACORP_FACTORY_ROOT = previousRoot;
});

async function mountBoard(): Promise<void> {
  window.history.replaceState(null, "", "/board");
  render(await BoardPage({ searchParams: Promise.resolve({}) }));
}

describe("FRD-02 shell · the board hands the card to its own route", () => {
  it("a card click asks for the public idea URL and the board embeds no detail", async () => {
    idea("tracker", TRACKER);
    await mountBoard();
    await userEvent.click(screen.getByRole("link", { name: /Tracker de Funkos/ }));
    expect(router.push).toHaveBeenCalledWith("/board/tracker");
    expect(screen.queryByTestId("card-detail")).toBeNull();
  });

  it("the board reads no project document for its cards", async () => {
    idea("demo", 'title: Idea demo\nstatus: in-pipeline\nproject: "demo"');
    project("implementation");
    await mountBoard();
    expect(screen.getByRole("progressbar", { name: "0/1 WO" })).toBeInTheDocument();
    const page = readFileSync("src/app/board/page.tsx", "utf8");
    expect(page).not.toMatch(/readCardProject|readSpecDigest|readArchitecture|listProjectDocs/);
  });
});

describe("FRD-02 shell · DR-062: the idea uses the ONE shared Tabs primitive", () => {
  it("renders tabs-root[data-level=sub] with role=tab, and no Comandos tab", async () => {
    idea("tracker", TRACKER);
    await mountIdea("tracker");
    expect(screen.getByTestId("tabs-root")).toHaveAttribute("data-level", "sub");
    expect(screen.getByTestId("card-detail-tab-propuesta")).toHaveAttribute("role", "tab");
    expect(screen.getByTestId("card-detail-tab-campana")).toHaveAttribute("role", "tab");
    expect(screen.queryByTestId("card-detail-tab-comandos")).toBeNull();
    expect(screen.getByTestId("card-detail-tab-propuesta")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("ArrowRight cycles and wraps across the idea's tabs", async () => {
    const user = userEvent.setup();
    idea("demo", 'title: Idea demo\nstatus: in-pipeline\nproject: "demo"');
    project("product");
    await mountIdea("demo/proposal");
    const propuesta = screen.getByTestId("card-detail-tab-propuesta");
    propuesta.focus();
    for (const id of ["spec", "arquitectura", "docs", "campana"]) {
      await user.keyboard("{ArrowRight}");
      expect(screen.getByTestId(`card-detail-tab-${id}`)).toHaveFocus();
    }
    await user.keyboard("{ArrowRight}");
    expect(propuesta).toHaveFocus();
  });
});

describe("FRD-02 shell · AC-02-009.3/.4: tab persistence", () => {
  it("the pick lives in the URL segment and survives a remount of that URL", async () => {
    idea("demo", 'title: Idea demo\nstatus: in-pipeline\nproject: "demo"');
    project("implementation");
    await mountIdea("demo/proposal");
    fireEvent.click(screen.getByTestId("card-detail-tab-docs"));
    expect(window.location.pathname).toBe("/board/demo/documents");
    const docs = screen.getByTestId("card-detail-panel-docs");
    expect(within(docs).getByTestId("card-detail-summary")).toBeInTheDocument();
    cleanup();
    await mountIdea("demo/documents");
    expect(screen.getByTestId("card-detail-tab-docs")).toHaveAttribute("aria-selected", "true");
  });
});

describe("FRD-02 shell · AC-02-010.*: La Campaña phase coherence", () => {
  it("a shipped idea opens with release current and every earlier room done", async () => {
    idea("lanzada", "title: Idea lanzada\nstatus: shipped");
    await mountIdea("lanzada/campaign");
    expect(screen.getByTestId("campaign-phase-release")).toHaveAttribute(
      "data-phase-state",
      "current",
    );
    expect(screen.getByTestId("campaign-phase-research")).toHaveAttribute(
      "data-phase-state",
      "done",
    );
    expect(screen.getByTestId("campaign-phase-build")).toHaveAttribute("data-phase-state", "done");
  });

  it("an in-pipeline idea with no status opens on research and a locked sheet stays readable", async () => {
    const user = userEvent.setup();
    idea("rota", 'title: Sin status\nstatus: in-pipeline\nproject: "demo"');
    await mountIdea("rota/campaign");
    expect(screen.getByTestId("campaign-phase-research")).toHaveAttribute(
      "data-phase-state",
      "current",
    );
    expect(screen.getByTestId("campaign-phase-release")).toHaveAttribute(
      "data-phase-state",
      "locked",
    );
    await user.click(screen.getByTestId("campaign-phase-release"));
    expect(await screen.findByTestId("campaign-phase-ficha")).toBeInTheDocument();
    expect(screen.queryByTestId("ficha-locked-marker")).toBeNull();
    expect(screen.getByTestId("ficha-header")).toHaveTextContent(/en espera/i);
  });
});

describe("FRD-02 shell · read-only board invariants", () => {
  it("no drag handles exist, and the capture dialog leaves the board mounted behind it", async () => {
    const user = userEvent.setup();
    idea("tracker", TRACKER);
    await mountBoard();
    expect(document.querySelector("[draggable='true']")).toBeNull();
    await user.click(screen.getByTestId("intake-trigger"));
    expect(screen.getByTestId("idea-board")).toBeInTheDocument();
  });

  it("the return link goes to the board, and merely reading the idea writes nothing", async () => {
    const file = idea("tracker", TRACKER);
    const before = readFileSync(file, "utf8");
    await mountIdea("tracker/proposal");
    expect(screen.getByRole("link", { name: "Volver al tablero" })).toHaveAttribute(
      "href",
      "/board",
    );
    expect(readFileSync(file, "utf8")).toBe(before);
  });
});
