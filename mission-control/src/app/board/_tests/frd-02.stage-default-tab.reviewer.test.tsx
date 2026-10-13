/**
 * FRD-02 — AC-02-009.1 (stage-based default tab) — REVIEWER adversarial tests (DR-015).
 *
 * Builder-blind: written by the per-change reviewer, not the implementer. They exercise the
 * default-tab rule at the real seam (`BoardShell` opening `CardDetail`) and at its boundaries:
 *   1. Per-card initialisation — the stage default is derived for EACH opened card; a tab the
 *      owner picked on card A never leaks into card B, and re-opening A re-derives A's default.
 *   2. Fallback boundaries — an empty-string digest counts as absent (release + empty
 *      architecture digest → Spec), a stageless in-pipeline card falls back to research, and a
 *      shipped card with no digests lands on Propuesta (never Documentos/Campaña).
 *   3. Initial-only derivation — a live refresh that advances the card's stage while its detail
 *      is open does NOT yank the owner off the tab they are on (AC-02-009.4).
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BoardShell } from "@/app/board/_components/BoardShell/BoardShell";
import { CardDetail } from "@/app/board/_components/CardDetail/CardDetail";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/IdeaBoardView";
import type { DiscardResult } from "@/lib/discard/discard";

const SPEC = "## Requisitos\n\n- REQ-01-001 Auth";
const ARCH = "## Stack\n\nNext.js";

function card(overrides: Partial<BoardCardEntry> = {}): BoardCardEntry {
  return {
    slug: "idea-a",
    title: "Idea Alfa",
    status: "discovered",
    body: "# Resumen\n\nUna idea.",
    projectType: "web",
    returnType: "mixed",
    score: 70,
    boardColumn: "discovered",
    ...overrides,
  };
}

const okDiscard = async (): Promise<DiscardResult> => ({ ok: true });

function selectedTabIds(): string[] {
  return screen
    .getAllByRole("tab")
    .filter((t) => t.getAttribute("aria-selected") === "true")
    .map((t) => t.getAttribute("data-testid") ?? "");
}

async function openByTitle(user: ReturnType<typeof userEvent.setup>, title: string): Promise<void> {
  await user.click(screen.getByRole("button", { name: new RegExp(title, "i") }));
  await screen.findByTestId("card-detail");
}

describe("FRD-02 reviewer · AC-02-009.1 stage default tab", () => {
  it("derives the default per opened card at the BoardShell seam (no tab carried from A to B)", async () => {
    const user = userEvent.setup();
    const cards = [
      card({
        slug: "idea-a",
        title: "Idea Alfa",
        status: "in-pipeline",
        phase: "architecture",
        boardColumn: "architecture",
        specContent: SPEC,
        architectureContent: ARCH,
      }),
      card({
        slug: "idea-b",
        title: "Idea Beta",
        status: "recommended",
        boardColumn: "discovered",
      }),
    ];
    render(<BoardShell cards={cards} discardAction={okDiscard} />);

    await openByTitle(user, "Idea Alfa");
    expect(selectedTabIds()).toEqual(["card-detail-tab-arquitectura"]);
    await user.click(screen.getByTestId("card-detail-tab-campana"));
    expect(selectedTabIds()).toEqual(["card-detail-tab-campana"]);

    await user.click(screen.getByTestId("card-detail-back"));
    await openByTitle(user, "Idea Beta");
    expect(selectedTabIds()).toEqual(["card-detail-tab-propuesta"]);

    await user.click(screen.getByTestId("card-detail-back"));
    await openByTitle(user, "Idea Alfa");
    expect(selectedTabIds()).toEqual(["card-detail-tab-arquitectura"]);
  });

  it.each([
    {
      name: "release + empty-string architecture digest → Spec",
      props: {
        status: "in-pipeline",
        phase: "release",
        specContent: SPEC,
        architectureContent: "",
      },
      expected: "card-detail-tab-spec",
    },
    {
      name: "in-pipeline with no phase (stageless) + both digests → Propuesta",
      props: {
        status: "in-pipeline",
        phase: undefined,
        specContent: SPEC,
        architectureContent: ARCH,
      },
      expected: "card-detail-tab-propuesta",
    },
    {
      name: "shipped with no digests → Propuesta (never Documentos/Campaña)",
      props: {
        status: "shipped",
        phase: undefined,
        specContent: undefined,
        architectureContent: undefined,
      },
      expected: "card-detail-tab-propuesta",
    },
  ] as const)("fallback boundary: $name", ({ props, expected }) => {
    render(<CardDetail slug="idea-a" title="Idea Alfa" body="# Resumen\n\nUna idea." {...props} />);
    expect(selectedTabIds()).toEqual([expected]);
  });

  it("a live refresh that advances the open card's stage keeps the owner's current tab", async () => {
    const user = userEvent.setup();
    const atDesign = card({
      status: "in-pipeline",
      phase: "design",
      boardColumn: "design",
      specContent: SPEC,
    });
    const { rerender } = render(<BoardShell cards={[atDesign]} discardAction={okDiscard} />);
    await openByTitle(user, "Idea Alfa");
    expect(selectedTabIds()).toEqual(["card-detail-tab-spec"]);

    const atArchitecture = card({
      status: "in-pipeline",
      phase: "architecture",
      boardColumn: "architecture",
      specContent: SPEC,
      architectureContent: ARCH,
    });
    rerender(<BoardShell cards={[atArchitecture]} discardAction={okDiscard} />);
    expect(screen.getByTestId("card-detail-tab-arquitectura")).toBeInTheDocument();
    expect(selectedTabIds()).toEqual(["card-detail-tab-spec"]);
  });
});
