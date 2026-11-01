import type { Tone } from "@/components/core/Chip/vocabulary";
import type { IconName } from "@/components/core/Icon/iconData";

import { type CopyKey, t } from "@/lib/copy/copy";

const TYPES: Readonly<Record<string, { tone: Tone; icon: IconName }>> = {
  PRD: { tone: "blue", icon: "flag" },
  FRD: { tone: "violet", icon: "book" },
  FDD: { tone: "pink", icon: "palette" },
  Blueprint: { tone: "amber", icon: "cube" },
  ADR: { tone: "amber", icon: "shield" },
  "Work order": { tone: "violet", icon: "clipboard" },
  Diseño: { tone: "pink", icon: "palette" },
  Analítica: { tone: "teal", icon: "chart" },
  Revisión: { tone: "slate", icon: "eye" },
};

/** One shared hue and icon for the document paper, index entry and type filter. */
export function documentPresentation(type: string): { tone: Tone; icon: IconName } {
  return TYPES[type] ?? { tone: "slate", icon: "file" };
}

/** Human-readable document category; the raw source type remains the URL filter identity. */
export function documentTypeLabel(type: string): string {
  const key =
    `workspace.documentos.types.${Object.hasOwn(TYPES, type) ? type : "Documento"}` as CopyKey;
  return t(key);
}
