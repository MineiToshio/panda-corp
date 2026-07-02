/**
 * WO-02-013 — reviewer adversarial suite (DR-015 / DR-080)
 *
 * The "Siguiente paso" ("Qué puedes correr") panel must interpolate the card's real
 * slug into EVERY command carrying the `<idea>` token — not only the first (`spec`).
 * The implementer's own suite only asserted `spec`; these tests exercise the edges the
 * implementer did not see:
 *   AC-02-013.2 — holds for the SECOND option too (`/pandacorp:explore <idea>`), and
 *                 across phases; the literal `<idea>` never appears anywhere in the panel.
 *   Abuse — a slug with regex-special chars must be substituted literally (String.replace
 *           replacement semantics, e.g. `$&`), not corrupted; a plain slug never leaks `<idea>`.
 *
 * These are authored by the reviewer (the builder may not edit them, DR-080).
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  CampaignPipeline,
  type CampaignPipelineProps,
} from "@/components/modules/CampaignPipeline/CampaignPipeline";

const baseProps = (overrides: Partial<CampaignPipelineProps> = {}): CampaignPipelineProps => ({
  slug: "panda-script",
  activePhase: 0,
  onEnterForge: vi.fn(),
  ...overrides,
});

describe("WO-02-013 — <idea> interpolation across every command (AC-02-013.1/.2)", () => {
  it("substitutes the slug into the SECOND option too (explore, not only spec)", () => {
    render(<CampaignPipeline {...baseProps({ activePhase: 0 })} />);
    const panel = screen.getByTestId("ficha-next-step");
    // Research phase has two commands: spec (first) AND explore (second).
    expect(panel).toHaveTextContent("/pandacorp:spec panda-script");
    expect(panel).toHaveTextContent("/pandacorp:explore panda-script");
  });

  it("the literal `<idea>` token never appears in the research panel", () => {
    render(<CampaignPipeline {...baseProps({ activePhase: 0 })} />);
    const panel = screen.getByTestId("ficha-next-step");
    expect(panel).not.toHaveTextContent("<idea>");
  });

  it("holds in the product phase too (its re-run spec option carries the token)", () => {
    render(<CampaignPipeline {...baseProps({ activePhase: 1 })} />);
    const panel = screen.getByTestId("ficha-next-step");
    expect(panel).toHaveTextContent("/pandacorp:spec panda-script");
    expect(panel).not.toHaveTextContent("<idea>");
  });

  it("no `<idea>` leaks in any phase's panel (research → release)", () => {
    for (let phase = 0; phase <= 5; phase++) {
      const { unmount } = render(
        <CampaignPipeline
          {...baseProps({ activePhase: phase as CampaignPipelineProps["activePhase"] })}
        />,
      );
      const panel = screen.getByTestId("ficha-next-step");
      expect(panel).not.toHaveTextContent("<idea>");
      unmount();
    }
  });

  it("a slug with regex-replacement-special chars is substituted literally, not corrupted", () => {
    // `$&` in a String.replace replacement string means "the matched substring" — a naive
    // replace(pattern, slug) would expand it. The rendered command must show the slug verbatim.
    render(<CampaignPipeline {...baseProps({ activePhase: 0, slug: "a$&b" })} />);
    const panel = screen.getByTestId("ficha-next-step");
    expect(panel).toHaveTextContent("/pandacorp:spec a$&b");
    expect(panel).not.toHaveTextContent("<idea>");
    // If `$&` had been expanded, the command would read `/pandacorp:spec a<idea>b`.
    expect(panel).not.toHaveTextContent("a<idea>b");
  });

  it("picking a mode folds its flag onto the slug-substituted explore-phase spec command", () => {
    render(<CampaignPipeline {...baseProps({ activePhase: 0 })} />);
    const panel = screen.getByTestId("ficha-next-step");
    const select = within(panel).getByRole("combobox", { name: "Modo del comando" });
    fireEvent.change(select, { target: { value: "--ask" } });
    expect(panel).toHaveTextContent("/pandacorp:spec panda-script --ask");
    expect(panel).not.toHaveTextContent("<idea>");
  });
});
