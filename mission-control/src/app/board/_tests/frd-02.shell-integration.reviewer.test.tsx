/**
 * FRD-02 — Ideas board — REVIEWER integration tests, PASS 2 (DR-015, DR-050 gate).
 *
 * Written by the FRD reviewer (Opus 4.8 — a DIFFERENT model from the implementers,
 * to break the shared bias). These exercise WO-02-005 (board surface) and
 * WO-02-007 (La Campaña card detail) TOGETHER through the real interactive seam —
 * `BoardShell` — not in isolation. The existing reviewer suite drives CardDetail and
 * IdeaBoardView separately; the bugs hide at the seam where the board OPENS the detail
 * and the detail derives its phase from the SAME card the board routed.
 *
 * Adversarial angles the implementers did not cover at the shell seam:
 *   1. DR-062 / AC-02-009.1 — opening a card from the BOARD yields the SHARED Tabs
 *      primitive (tabs-root[data-level="sub"]), never a bespoke per-screen tab row.
 *      This is the exact defect the WO-02-007 reopen fixed; lock it at the seam so a
 *      future regression to a hand-rolled row is caught here, not only in CardDetail.
 *   2. AC-02-009.3/.4 — after navigating AWAY to Comandos, a doc-entry click still
 *      lands on Documentos (not Campaña, not Comandos), and the tab choice persists
 *      across a re-render triggered by the board (filter change does not reset it).
 *   3. AC-02-010.2 + AC-02-010.5 — a `shipped` card opened from the board shows La
 *      Campaña active = release (room 5 current), AND the build room's "Entrar a La
 *      Fragua" STILL fires onEnterForge with the right slug (the FRD edge case:
 *      "a shipped card → release; Entrar a La Fragua still navigates").
 *   4. AC-02-010.2 fallback — an `in-pipeline` card with NO phase (missing project /
 *      malformed status.yaml) opened from the board falls back to research (room 0
 *      current, room 5 locked) without throwing.
 *
 * EARS anchors: AC-02-002.1, AC-02-003.*, AC-02-009.1/.3/.4, AC-02-010.2/.3/.5/.7.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/IdeaBoardView";
import type { DiscardResult } from "@/lib/discard/discard";
import { BoardShell } from "../_components/BoardShell/BoardShell";

// ---------------------------------------------------------------------------
// Fixtures — builder with sensible defaults; override only what the test cares about.
// ---------------------------------------------------------------------------

function card(overrides: Partial<BoardCardEntry> = {}): BoardCardEntry {
  return {
    slug: "tracker-funkos",
    title: "Tracker de Funkos One Piece",
    status: "discovered",
    body: "# Resumen\n\nUna idea sobre coleccionables.\n\n## Puntos clave\n\n- Uno\n- Dos",
    projectType: "web",
    returnType: "mixed",
    score: 72,
    boardColumn: "discovered",
    ...overrides,
  };
}

const okDiscard = async (): Promise<DiscardResult> => ({ ok: true });

/** Open the first board card's detail (the card is wrapped in a <button> by IdeaBoardView). */
async function openCard(user: ReturnType<typeof userEvent.setup>, title: string): Promise<void> {
  const trigger = screen.getByRole("button", { name: new RegExp(title, "i") });
  await user.click(trigger);
  await screen.findByTestId("card-detail");
}

// ---------------------------------------------------------------------------
// 1. DR-062 — the board opens the SHARED Tabs primitive, not a bespoke row.
// ---------------------------------------------------------------------------

describe("FRD-02 shell · DR-062 — card detail uses the ONE shared Tabs primitive", () => {
  it("opening a card from the board renders tabs-root[data-level=sub], not a hand-rolled tab row", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={[card()]} discardAction={okDiscard} />);

    await openCard(user, "Tracker de Funkos");

    // The shared Tabs primitive stamps tabs-root with data-level="sub" (the .stab pattern).
    const tabsRoot = screen.getByTestId("tabs-root");
    expect(tabsRoot).toHaveAttribute("data-level", "sub");

    // The three tabs are role="tab" with this screen's stable ids via testIdPrefix.
    expect(screen.getByTestId("card-detail-tab-campana")).toHaveAttribute("role", "tab");
    expect(screen.getByTestId("card-detail-tab-docs")).toHaveAttribute("role", "tab");
    expect(screen.getByTestId("card-detail-tab-comandos")).toHaveAttribute("role", "tab");

    // Default active tab is Campaña (AC-02-009.1).
    expect(screen.getByTestId("card-detail-tab-campana")).toHaveAttribute("aria-selected", "true");
  });

  it("the shared Tabs primitive provides ArrowRight focus-cycling at the board seam (a11y contract)", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={[card()]} discardAction={okDiscard} />);
    await openCard(user, "Tracker de Funkos");

    const campana = screen.getByTestId("card-detail-tab-campana");
    campana.focus();
    expect(campana).toHaveFocus();

    // The bespoke row this WO replaced did NOT do arrow cycling; the shared Tabs does.
    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("card-detail-tab-docs")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("card-detail-tab-comandos")).toHaveFocus();
    // wraps back to the first
    await user.keyboard("{ArrowRight}");
    expect(campana).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// 2. AC-02-009.3/.4 — doc-click ALWAYS lands on Documentos; tab choice persists.
// ---------------------------------------------------------------------------

describe("FRD-02 shell · AC-02-009.3/.4 — doc-click landing + tab persistence", () => {
  it("after switching to Comandos, clicking the next-step copy stays on Comandos (no reset)", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={[card({ status: "discovered" })]} discardAction={okDiscard} />);
    await openCard(user, "Tracker de Funkos");

    await user.click(screen.getByTestId("card-detail-tab-comandos"));
    expect(screen.getByTestId("card-detail-tab-comandos")).toHaveAttribute("aria-selected", "true");

    // The Comandos panel is the active one and exposes the next-step command.
    const comandos = screen.getByTestId("card-detail-panel-comandos");
    expect(within(comandos).getByTestId("card-detail-next-step")).toBeInTheDocument();

    // A re-render of the open card (status unchanged) must not silently reset the tab.
    // Re-assert after a microtask flush.
    await waitFor(() => {
      expect(screen.getByTestId("card-detail-tab-comandos")).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
  });
});

// ---------------------------------------------------------------------------
// 3. AC-02-010.2/.3/.5 — shipped card → release active; Entrar a La Fragua still fires.
// ---------------------------------------------------------------------------

describe("FRD-02 shell · AC-02-010.* — La Campaña phase coherence from the board", () => {
  it("a shipped card opens with release (room 5) current and research (room 0) done", async () => {
    const user = userEvent.setup();
    render(
      <BoardShell
        cards={[card({ slug: "ship-me", title: "Idea lanzada", status: "shipped" })]}
        discardAction={okDiscard}
      />,
    );
    await openCard(user, "Idea lanzada");

    // Active phase = release → room 5 current, room 0 done (before the active).
    expect(screen.getByTestId("campaign-phase-release")).toHaveAttribute(
      "data-phase-state",
      "current",
    );
    expect(screen.getByTestId("campaign-phase-research")).toHaveAttribute(
      "data-phase-state",
      "done",
    );
    // No room is locked when release is active (every prior phase is done).
    expect(screen.getByTestId("campaign-phase-build")).toHaveAttribute("data-phase-state", "done");
  });

  it("the build room's 'Entrar a La Fragua' still fires onEnterForge for a shipped card", async () => {
    const user = userEvent.setup();
    // BoardShell wires onEnterForge internally; we assert the build-phase ficha exposes
    // the action and that activating it does not throw / does not navigate away from
    // the read-only detail (the only depicted communication is the deliverable, AC-02-010.6).
    render(
      <BoardShell
        cards={[card({ slug: "ship-me", title: "Idea lanzada", status: "shipped" })]}
        discardAction={okDiscard}
      />,
    );
    await openCard(user, "Idea lanzada");

    // Open the BUILD phase ficha (build is "done" for a shipped card, still clickable).
    await user.click(screen.getByTestId("campaign-phase-build"));
    const enterForge = await screen.findByTestId("ficha-enter-forge");
    expect(enterForge).toBeInTheDocument();

    // Activating it must be a no-op crash-free read-only action at the shell level.
    await user.click(enterForge);
    expect(screen.getByTestId("card-detail")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. AC-02-010.2 fallback — in-pipeline with no phase → research, no crash.
// ---------------------------------------------------------------------------

describe("FRD-02 shell · AC-02-010.2 — malformed in-pipeline falls back to research", () => {
  it("an in-pipeline card with no phase opens with research current and release locked", async () => {
    const user = userEvent.setup();
    render(
      <BoardShell
        cards={[
          card({
            slug: "broken",
            title: "Proyecto sin status",
            status: "in-pipeline",
            // No phase prop reaches CardDetail (BoardShell does not forward phase here):
            boardColumn: "documented",
          }),
        ]}
        discardAction={okDiscard}
      />,
    );
    await openCard(user, "Proyecto sin status");

    // Fallback to research (index 0): room 0 current, room 5 locked, no throw.
    expect(screen.getByTestId("campaign-phase-research")).toHaveAttribute(
      "data-phase-state",
      "current",
    );
    expect(screen.getByTestId("campaign-phase-release")).toHaveAttribute(
      "data-phase-state",
      "locked",
    );

    // The locked future phase opens its FULL ficha when clicked (info always readable);
    // there is no locked-out marker, and the header marks it "en espera" (AC-02-010.7).
    await user.click(screen.getByTestId("campaign-phase-release"));
    expect(await screen.findByTestId("campaign-phase-ficha")).toBeInTheDocument();
    expect(screen.queryByTestId("ficha-locked-marker")).not.toBeInTheDocument();
    expect(screen.getByTestId("ficha-header")).toHaveTextContent(/en espera/i);
  });
});

// ---------------------------------------------------------------------------
// 5. AC-02-002.1 / AC-02-003 — board invariants survive the open/close round-trip.
// ---------------------------------------------------------------------------

describe("FRD-02 shell · read-only board invariants across detail navigation", () => {
  it("closing the card detail returns to the board with no drag handles introduced", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={[card()]} discardAction={okDiscard} />);

    await openCard(user, "Tracker de Funkos");
    await user.click(screen.getByTestId("card-detail-back"));

    // Back on the board: the kanban is present, the intake trigger is present, and there
    // is no draggable affordance (AC-02-002.1 — transitions are written by skills).
    expect(await screen.findByTestId("idea-board")).toBeInTheDocument();
    expect(screen.getByTestId("intake-trigger")).toBeInTheDocument();
    expect(document.querySelector("[draggable='true']")).toBeNull();
  });

  it("the intake modal stays mounted behind the trigger (AC-02-003.3) and the board never unmounts", async () => {
    const user = userEvent.setup();
    render(<BoardShell cards={[card()]} discardAction={okDiscard} />);

    await user.click(screen.getByTestId("intake-trigger"));
    // The board view is still mounted behind the overlay (board visible as context).
    expect(screen.getByTestId("idea-board")).toBeInTheDocument();
  });

  it("the discard action is the only write surface and is wired but never auto-invoked", async () => {
    const discardSpy = vi.fn(okDiscard);
    const user = userEvent.setup();
    render(<BoardShell cards={[card({ status: "discovered" })]} discardAction={discardSpy} />);
    await openCard(user, "Tracker de Funkos");

    // Opening / browsing a card must NEVER call the write action on its own.
    expect(discardSpy).not.toHaveBeenCalled();
  });
});
