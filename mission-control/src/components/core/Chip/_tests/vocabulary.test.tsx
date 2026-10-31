/** WO-13-011 — IF-13-vocabulary and the Chip family. AC-13-010.1: hue carries meaning with text or an icon, status hues mean status only. */
import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { t } from "@/lib/copy/copy";
import { Chip } from "../Chip";
import { CountPill } from "../CountPill";
import { FilterChip } from "../FilterChip";
import {
  CATEGORY_TONES,
  PHASE_PRESENTATION,
  PHASES,
  phasePresentation,
  RARITY_TONE,
  RETURN_PRESENTATION,
  STATUS_TONES,
  statePresentation,
  WORK_ORDER_STATE_PRESENTATION,
  WORK_ORDER_STATES,
} from "../vocabulary";

const CORE = path.resolve(__dirname, "../..");
const OWNED = [
  "Button",
  "Chip",
  "CountBadge",
  "TierBadge",
  "CmdRow",
  "CopyButton",
  "CopyText",
  "Field",
  "MoreBar",
  "StateBadge",
  "StateDot",
  "Avatar",
  "Ring",
  "ProgressBar",
  "PhaseStepper",
  "KeyValue",
  "Toast",
  "Segmented",
  "BadgeIcon",
];
const NEW = [
  "Chip",
  "CopyText",
  "Field",
  "MoreBar",
  "StateDot",
  "Ring",
  "PhaseStepper",
  "KeyValue",
  "Segmented",
  "BadgeIcon",
];

describe("AC-13-010.1: vocabulary", () => {
  it("AC-13-010.1: every phase and work-order state has a tone, an icon and a catalogue label; unknown ones are neutral", () => {
    for (const id of PHASES) expect(t(PHASE_PRESENTATION[id].labelKey)).not.toBe("");
    for (const id of WORK_ORDER_STATES)
      expect(t(WORK_ORDER_STATE_PRESENTATION[id].labelKey)).not.toBe("");
    expect(phasePresentation("nope").tone).toBe("slate");
    expect(statePresentation(undefined).tone).toBe("slate");
    expect(statePresentation("blocked").tone).toBe("coral");
  });

  it("AC-13-010.1: green, amber and coral only appear for phase or state; categories never use them", () => {
    const status = new Set<string>(STATUS_TONES);
    for (const id of WORK_ORDER_STATES)
      expect(
        status.has(WORK_ORDER_STATE_PRESENTATION[id].tone) ||
          ["slate", "blue"].includes(WORK_ORDER_STATE_PRESENTATION[id].tone),
      ).toBe(true);
    for (const r of Object.values(RETURN_PRESENTATION)) expect(status.has(r.tone)).toBe(false);
    for (const tone of Object.values(RARITY_TONE))
      expect(CATEGORY_TONES as readonly string[]).toContain(tone);
  });
});

describe("AC-13-010.1: chip family", () => {
  it("AC-13-010.1: a hue chip shows its text and its icon; a count pill shows its number", () => {
    const { container } = render(
      <>
        <Chip tone="green" icon="check" label="Verificado" />
        <CountPill count={7} />
      </>,
    );
    expect(screen.getByText("Verificado").getAttribute("data-tone")).toBe("green");
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("AC-13-010.1: FilterChip state is aria-pressed", () => {
    const onClick = vi.fn();
    render(
      <FilterChip pressed onClick={onClick}>
        Todos
      </FilterChip>,
    );
    const chip = screen.getByRole("button", { name: "Todos" });
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("AC-13-010.1: no new or restyled leaf primitive paints a coloured edge stripe", () => {
    const stripe =
      /border-(left|right|inline-start|inline-end)\s*:|border(Left|Right)\b|border-[lr]-/;
    const offenders: string[] = [];
    for (const dir of NEW) {
      for (const f of fs.readdirSync(path.join(CORE, dir)).filter((n) => /\.(tsx|css)$/.test(n))) {
        if (stripe.test(fs.readFileSync(path.join(CORE, dir, f), "utf8")))
          offenders.push(`${dir}/${f}`);
      }
    }
    expect(OWNED.length).toBe(19);
    expect(offenders).toEqual([]);
  });
});
