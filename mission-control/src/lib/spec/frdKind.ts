import type { Tone } from "@/components/core/Chip/vocabulary";

/** Digest kind wins; otherwise classify the FRD's ui frontmatter, preserving a textual kind tag. */
export function frdKind(tag?: string | null, ui?: string | boolean): { label: string; tone: Tone } {
  const value =
    tag?.trim() || (ui === true ? "UI" : ui === false ? "Infra" : ui?.trim()) || "Infra";
  if (/^ui$|frontend|interface/i.test(value)) return { label: "UI", tone: "pink" };
  if (/tool|cli/i.test(value)) return { label: "Tool/CLI", tone: "teal" };
  if (/api/i.test(value)) return { label: "API", tone: "blue" };
  if (/data|datos/i.test(value)) return { label: "Data", tone: "gold" };
  return { label: "Infra", tone: "slate" };
}
