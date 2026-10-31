/**
 * FRD-13 reviewer probe (DR-015), re-authored at the FRD close.
 *
 * WO-13-013 retired StateBadge. REQ-13-007 did not retire with it: every state still has to be told by
 * an icon and a label, not by hue. The vocabulary every surface reads carries that contract now.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AGENT_STATES, STATE_BADGE } from "@/app/_design/tokens/tokens";
import { Chip } from "@/components/core/Chip/Chip";
import {
  CATEGORY_TONES,
  STATUS_TONES,
  WORK_ORDER_STATE_PRESENTATION,
  WORK_ORDER_STATES,
} from "@/components/core/Chip/vocabulary";
import { t } from "@/lib/copy/copy";

afterEach(cleanup);

describe("REQ-13-007: state is never colour alone", () => {
  it("every work-order state renders a distinct icon beside a non-empty label", () => {
    const shapes = WORK_ORDER_STATES.map((state) => {
      const { tone, icon, labelKey } = WORK_ORDER_STATE_PRESENTATION[state];
      const { container, unmount } = render(
        <Chip tone={tone} icon={icon}>
          {t(labelKey)}
        </Chip>,
      );
      const chip = screen.getByTestId("chip");
      expect(chip.textContent?.trim()).not.toBe("");
      const svg = container.querySelector("svg")?.innerHTML ?? "";
      expect(svg).not.toBe("");
      unmount();
      return svg;
    });
    expect(new Set(shapes).size).toBe(WORK_ORDER_STATES.length);
  });

  it("the agent state map stays shape-distinct", () => {
    const icons = AGENT_STATES.map((state) => STATE_BADGE[state].icon);
    expect(new Set(icons).size).toBe(AGENT_STATES.length);
    for (const state of AGENT_STATES) expect(STATE_BADGE[state].label.trim()).not.toBe("");
  });

  it("AC-13-010.1: status hues and category hues never overlap", () => {
    const status = new Set<string>(STATUS_TONES);
    expect(CATEGORY_TONES.filter((tone) => status.has(tone))).toEqual([]);
  });
});
