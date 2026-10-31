import type { Tone } from "@/components/core/Chip/vocabulary";
import type { CopyKey } from "@/lib/copy/copy";
import type { ManualPage } from "@/lib/manual/manual";

/** Ordered documentation groups, shared by the home, search and index. */
export const DOC_GROUPS = [
  { id: "tutorial", tone: "pink", key: "documentacion.explore.groups.tutorial.label" },
  { id: "guides", tone: "teal", key: "documentacion.explore.groups.guides.label" },
  { id: "concepts", tone: "blue", key: "documentacion.explore.groups.concepts.label" },
  { id: "workflows", tone: "violet", key: "documentacion.explore.groups.workflows.label" },
] as const satisfies readonly { id: string; tone: Tone; key: CopyKey }[];

/** Curated entry points; their existence is checked against the authored registry. */
export const ESSENTIALS = [
  "el-pipeline",
  "el-equipo",
  "los-gates-humanos",
  "estado-y-archivos",
] as const;
/** Daily task entry points in display order. */
export const DAILY_GUIDES = [
  "g-cambio",
  "g-capturar",
  "g-handoff",
  "g-modo",
  "g-feedback",
  "g-implement-parcial",
] as const;

/** Stable, encoded reader URL. */
export function pageHref(page: Pick<ManualPage, "group" | "slug">): string {
  return `/manual/${encodeURIComponent(page.group)}/${encodeURIComponent(page.slug)}`;
}

/** Resolve the group's hue without maintaining page-specific visual state. */
export function groupTone(group: string): Tone {
  return DOC_GROUPS.find((entry) => entry.id === group)?.tone ?? "slate";
}

/** Return pages in their authored group order. */
export function groupPages(pages: readonly ManualPage[], group: string): ManualPage[] {
  return pages.filter((page) => page.group === group).sort((a, b) => a.order - b.order);
}
