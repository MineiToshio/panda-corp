import { PHASE_PRESENTATION } from "@/components/core/Chip/vocabulary";
import { t } from "@/lib/copy/copy";
import type { BoardCardEntry } from "./IdeaBoardView";

/** Canonical board columns reuse the shared phase vocabulary. */
export const BOARD_PHASES = (
  [
    ["discovered", "discovered"],
    ["documented", "product"],
    ["design", "design"],
    ["architecture", "architecture"],
    ["building", "implementation"],
    ["shipped", "release"],
  ] as const
).map(([id, phase], index) => ({
  id,
  step: index + 1,
  label: t(PHASE_PRESENTATION[phase].labelKey),
  tone: PHASE_PRESENTATION[phase].tone,
}));

/** Preserve the two-axis resolution supplied by the server; support pre-project callers. */
export function columnFor(card: BoardCardEntry): string {
  if (card.boardColumn) return card.boardColumn;
  if (card.status === "recommended") return "discovered";
  if (card.status === "in-pipeline") return "documented";
  return card.status;
}
