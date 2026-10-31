/** Canonical tier grouping; undeclared models remain unknown. */
export function modelTier(model: string): "opus" | "sonnet" | "haiku" | "unknown" {
  const value = model.toLowerCase();
  if (value.includes("opus")) return "opus";
  if (value.includes("sonnet")) return "sonnet";
  if (value.includes("haiku")) return "haiku";
  return "unknown";
}
