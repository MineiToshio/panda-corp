import type { Suggestion } from "@/lib/self-suggest/self-suggest";

const UNRELIABLE_SIGNAL_RATIO = 0.6;
type SignalGroupKind = "board" | "recurring" | "unused" | "other";
/** Public signal group data contract. */
export interface SignalGroupData {
  readonly kind: SignalGroupKind;
  readonly items: readonly Suggestion[];
  readonly unreliable: boolean;
}
/** Pure grouping; a noisy population-sized signal is information, never another owner action. */
export function groupSignals(
  suggestions: readonly Suggestion[],
  skillCount: number,
): SignalGroupData[] {
  const groups: Record<SignalGroupKind, Suggestion[]> = {
    board: [],
    recurring: [],
    unused: [],
    other: [],
  };
  for (const item of suggestions) {
    const kind =
      item.kind === "bottleneck"
        ? "board"
        : item.kind === "recurring-lesson"
          ? "recurring"
          : item.kind === "unused-capability"
            ? "unused"
            : "other";
    groups[kind].push(item);
  }
  return (Object.keys(groups) as SignalGroupKind[])
    .filter((kind) => groups[kind].length > 0)
    .map((kind) => ({
      kind,
      items: groups[kind],
      unreliable:
        kind === "unused" &&
        skillCount > 0 &&
        new Set(groups.unused.map((x) => x.target ?? x.title)).size / skillCount >=
          UNRELIABLE_SIGNAL_RATIO,
    }));
}
