/**
 * FRD-02 — AC-02-009.1 (stage-based default tab) — REVIEWER adversarial tests (DR-015).
 *
 * Builder-blind, through the real idea route over a real factory on disk (the board no longer
 * embeds the detail, so the seam is the per-idea read):
 *   1. Per-idea derivation: a tab picked on idea A never leaks into idea B, and a fresh visit to A
 *      re-derives A's default.
 *   2. Fallback boundaries: a linked project always has Arquitectura (AC-02-013.1), a blank digest
 *      counts as absent, a stageless in-pipeline idea stays on Propuesta, Documentos and Campaña
 *      are never the default.
 *   3. Initial-only derivation: a stage that advances under an idea whose URL already names a tab
 *      does not move the owner (AC-02-009.4).
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { idea, mountIdea, project, put, resetFactory } from "./ideaRouteFixture";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const previousRoot = process.env.PANDACORP_FACTORY_ROOT;
const root = mkdtempSync(join(tmpdir(), "frd02-stage-tab-"));
process.env.PANDACORP_FACTORY_ROOT = root;

const LINKED = 'title: Idea Alfa\nstatus: in-pipeline\nproject: "demo"';

function selectedTabIds(): string[] {
  return screen
    .getAllByRole("tab", { selected: true })
    .map((tab) => tab.getAttribute("data-testid") ?? "");
}

beforeEach(resetFactory);
afterEach(cleanup);
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  process.env.PANDACORP_FACTORY_ROOT = previousRoot;
});

describe("FRD-02 reviewer · AC-02-009.1 stage default tab", () => {
  it("derives the default per idea (no tab carried from A to B)", async () => {
    idea("alfa", LINKED);
    idea("beta", "title: Idea Beta\nstatus: recommended");
    project("architecture");

    await mountIdea("alfa");
    expect(selectedTabIds()).toEqual(["card-detail-tab-arquitectura"]);
    fireEvent.click(screen.getByTestId("card-detail-tab-campana"));
    expect(selectedTabIds()).toEqual(["card-detail-tab-campana"]);
    expect(window.location.pathname).toBe("/board/alfa/campaign");
    cleanup();

    await mountIdea("beta");
    expect(selectedTabIds()).toEqual(["card-detail-tab-propuesta"]);
    cleanup();

    await mountIdea("alfa");
    expect(selectedTabIds()).toEqual(["card-detail-tab-arquitectura"]);
  });

  it.each([
    ["product", "card-detail-tab-spec"],
    ["design", "card-detail-tab-spec"],
    ["architecture", "card-detail-tab-arquitectura"],
    ["implementation", "card-detail-tab-arquitectura"],
    ["release", "card-detail-tab-arquitectura"],
  ])("at %s the default is %s, and the URL records it", async (phase, expected) => {
    idea("alfa", LINKED);
    project(phase);
    await mountIdea("alfa");
    expect(selectedTabIds()).toEqual([expected]);
    expect(window.location.pathname).not.toBe("/board/alfa");
  });

  it("release without an architecture digest still lands on Arquitectura: a linked project owns the tab", async () => {
    idea("alfa", LINKED);
    project("release", { digests: false });
    put("demo/.pandacorp/comms/spec-resumen.md", "## FRDs\n### FRD-01 · Live\nResumen.\n");
    await mountIdea("alfa");
    expect(selectedTabIds()).toEqual(["card-detail-tab-arquitectura"]);
  });

  it("product with a blank spec digest counts as absent: no Spec tab, Propuesta default", async () => {
    idea("alfa", LINKED);
    project("product", { digests: false });
    put("demo/.pandacorp/comms/spec-resumen.md", "");
    await mountIdea("alfa");
    expect(screen.queryByTestId("card-detail-tab-spec")).toBeNull();
    expect(selectedTabIds()).toEqual(["card-detail-tab-propuesta"]);
  });

  it("a stageless in-pipeline idea with both digests stays on Propuesta", async () => {
    idea("alfa", LINKED);
    project("product");
    put("demo/.pandacorp/status.yaml", "project: Demo\n");
    await mountIdea("alfa");
    expect(selectedTabIds()).toEqual(["card-detail-tab-propuesta"]);
  });

  it("a shipped idea with no project lands on Propuesta, never Documentos or Campaña", async () => {
    idea("alfa", "title: Idea Alfa\nstatus: shipped");
    await mountIdea("alfa");
    expect(selectedTabIds()).toEqual(["card-detail-tab-propuesta"]);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("a stage that advances keeps the tab the URL already names", async () => {
    idea("alfa", LINKED);
    project("design");
    await mountIdea("alfa/spec");
    expect(selectedTabIds()).toEqual(["card-detail-tab-spec"]);
    cleanup();
    project("architecture");
    await mountIdea("alfa/spec");
    expect(screen.getByTestId("card-detail-tab-arquitectura")).toBeInTheDocument();
    expect(selectedTabIds()).toEqual(["card-detail-tab-spec"]);
  });
});
