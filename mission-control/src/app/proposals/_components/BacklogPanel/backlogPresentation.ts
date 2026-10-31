import type { Tone } from "@/components/core/Chip/vocabulary";
import type { BacklogSeverity } from "@/lib/backlog/backlog";
import { t } from "@/lib/copy/copy";
export const PRIORITIES = ["p0", "p1", "p2"] as const;
export const PRIORITY_TONE = { p0: "coral", p1: "amber", p2: "slate" } as const satisfies Record<
  BacklogSeverity,
  Tone
>;
const LABEL = { p0: "tileUrgent", p1: "tileImportant", p2: "tileSomeday" } as const;
/** Catalogue-backed written priority label shared by tiles and group headings. */
export function priorityLabel(priority: BacklogSeverity): string {
  return `${t(`propuestas.priority.${priority}`)} · ${t(`propuestas.backlog.${LABEL[priority]}`)}`;
}
